import { Router } from "express";
import rateLimit from "express-rate-limit";
import argon2 from "argon2";
import { pool, rows, transaction } from "../repositories/db.js";
import {
  authenticated,
  audit,
  createSession,
  HttpError,
} from "../middleware/security.js";
import { login, password } from "../validators/index.js";
import { z } from "zod";
export const authRouter = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Try again later." },
});
// Equivalent Argon2 work for unknown users avoids a cheap username timing probe.
const dummyHash = await argon2.hash("timing-only-" + crypto.randomUUID(), {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
});
authRouter.get("/session", async (req, res) => {
  const csrf = req.session?.csrf || (await createSession(res, null));
  res.json({ user: req.user || null, csrf });
});
authRouter.post("/login", loginLimiter, async (req, res) => {
  const input = login.parse(req.body);
  const result = await transaction(async (db) => {
    // Serialize sign-ins per account, including concurrent browser logins.
    const [user] = await rows(
      db,
      "SELECT id,username,name,role,password_hash,active FROM users WHERE username=? FOR UPDATE",
      [input.username],
    );
    const valid = await argon2.verify(user?.password_hash || dummyHash, input.password);
    if (!user || !user.active || !valid)
      throw new HttpError(401, "Invalid username or password.");
    const safe = { id: user.id, username: user.username, name: user.name, role: user.role };
    await db.execute("DELETE FROM sessions WHERE user_id=? OR token_hash=?", [
      user.id, req.session!.hash,
    ]);
    await audit(db, safe, "Sign in", "Authenticated session created.");
    return { user: safe, csrf: await createSession(res, safe.id, db) };
  });
  res.json(result);
});
authRouter.post("/logout", authenticated, async (req, res) => {
  await transaction(async (db) => {
    await db.execute("DELETE FROM sessions WHERE token_hash=?", [
      req.session!.hash,
    ]);
    await audit(db, req.user!, "Logout", "Session revoked.");
  });
  res.json({ user: null, csrf: await createSession(res, null) });
});
authRouter.post("/password", authenticated, loginLimiter, async (req, res) => {
  const input = z
    .object({
      currentPassword: z.string().min(1).max(128),
      newPassword: password,
    })
    .strict()
    .parse(req.body);
  const newHash = await argon2.hash(input.newPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
  const csrf = await transaction(async (db) => {
    const [user] = await rows(
      db,
      "SELECT password_hash FROM users WHERE id=? FOR UPDATE",
      [req.user!.id],
    );
    if (!(await argon2.verify(user.password_hash, input.currentPassword)))
      throw new HttpError(400, "Current password is incorrect.");
    await db.execute("UPDATE users SET password_hash=? WHERE id=?", [
      newHash,
      req.user!.id,
    ]);
    await db.execute("DELETE FROM sessions WHERE user_id=?", [req.user!.id]);
    await audit(
      db,
      req.user!,
      "Password changed",
      "All previous sessions revoked.",
    );
    return createSession(res, req.user!.id, db);
  });
  res.json({ csrf, user: req.user });
});
