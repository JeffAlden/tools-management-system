import { Router } from "express";
import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import { z } from "zod";
import { pool, rows, transaction } from "../repositories/db.js";
import {
  roles,
  authenticated,
  audit,
  HttpError,
} from "../middleware/security.js";
import {
  id,
  tool,
  toolImport,
  account,
  accountUpdate,
  password,
} from "../validators/index.js";
export const toolsRouter = Router();
toolsRouter.use(roles("Admin", "Developer"));
toolsRouter.get("/", async (_req, res) =>
  res.json(
    await rows(
      pool,
      "SELECT id,code,name,total_qty FROM tools WHERE active=1 ORDER BY name",
    ),
  ),
);
toolsRouter.post("/", async (req, res) => {
  const input = tool.parse(req.body),
    toolId = randomUUID();
  await transaction(async (db) => {
    await db.execute(
      "INSERT INTO tools(id,code,name,total_qty) VALUES(?,?,?,?)",
      [toolId, input.code, input.name, input.totalQty],
    );
    await audit(db, req.user!, "Tool created", input.code);
  });
  res.status(201).json({ id: toolId });
});
toolsRouter.patch("/:id", async (req, res) => {
  const input = tool.parse(req.body),
    toolId = id.parse(req.params.id);
  await transaction(async (db) => {
    if (
      !(
        await rows(
          db,
          "SELECT id FROM tools WHERE id=? AND active=1 FOR UPDATE",
          [toolId],
        )
      ).length
    )
      throw new HttpError(404, "Tool not found.");
    await db.execute("UPDATE tools SET code=?,name=?,total_qty=? WHERE id=?", [
      input.code,
      input.name,
      input.totalQty,
      toolId,
    ]);
    await audit(db, req.user!, "Tool updated", input.code);
  });
  res.json({ ok: true });
});
toolsRouter.delete("/:id", async (req, res) => {
  const toolId = id.parse(req.params.id);
  await transaction(async (db) => {
    if (
      !(
        await rows(
          db,
          "SELECT id FROM tools WHERE id=? AND active=1 FOR UPDATE",
          [toolId],
        )
      ).length
    )
      throw new HttpError(404, "Tool not found.");
    await db.execute("UPDATE tools SET active=0 WHERE id=?", [toolId]);
    await audit(db, req.user!, "Tool archived", toolId);
  });
  res.json({ ok: true });
});
toolsRouter.post("/import", async (req, res) => {
  const input = toolImport.parse(req.body);
  if (
    new Set(input.tools.map((t) => t.code.toLowerCase())).size !==
    input.tools.length
  )
    throw new HttpError(400, "Duplicate tool codes.");
  await transaction(async (db) => {
    for (const item of [...input.tools].sort((a, b) =>
      a.code.localeCompare(b.code),
    ))
      await db.execute(
        "INSERT INTO tools(id,code,name,total_qty) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE name=?,total_qty=?,active=1",
        [
          randomUUID(),
          item.code,
          item.name,
          item.totalQty,
          item.name,
          item.totalQty,
        ],
      );
    await audit(
      db,
      req.user!,
      "Catalog imported",
      `${input.tools.length} tools upserted.`,
    );
  });
  res.json({ count: input.tools.length });
});
export const usersRouter = Router();
usersRouter.use(roles("Admin", "Developer"));
usersRouter.get("/", async (req, res) =>
  res.json(
    await rows(
      pool,
      `SELECT id,username,name,role,active,created_at FROM users ${req.user!.role === "Admin" ? "WHERE role IN ('Admin','User')" : ""} ORDER BY username`,
    ),
  ),
);
usersRouter.post("/", async (req, res) => {
  const input = account.parse(req.body);
  if (req.user!.role === "Admin" && input.role !== "User")
    throw new HttpError(403, "Admins may create Regular User accounts only.");
  const
    userId = randomUUID(),
    hash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
  await transaction(async (db) => {
    await db.execute(
      "INSERT INTO users(id,username,name,role,password_hash) VALUES(?,?,?,?,?)",
      [userId, input.username, input.name, input.role, hash],
    );
    await audit(
      db,
      req.user!,
      "Account created",
      `${input.username} (${input.role})`,
    );
  });
  res.status(201).json({ id: userId });
});
usersRouter.patch("/:id", roles("Developer"), async (req, res) => {
  const userId = id.parse(req.params.id),
    input = accountUpdate.parse(req.body);
  if (userId === req.user!.id && (!input.active || input.role !== "Developer"))
    throw new HttpError(
      400,
      "You cannot disable or demote your own Developer account.",
    );
  await transaction(async (db) => {
    const [user] = await rows(db, "SELECT * FROM users WHERE id=? FOR UPDATE", [
      userId,
    ]);
    if (!user) throw new HttpError(404, "Account not found.");
    await db.execute("UPDATE users SET name=?,role=?,active=? WHERE id=?", [
      input.name,
      input.role,
      input.active,
      userId,
    ]);
    await db.execute("DELETE FROM sessions WHERE user_id=?", [userId]);
    await audit(
      db,
      req.user!,
      "Account updated",
      `${user.username}: ${input.role}, active=${input.active}`,
    );
  });
  res.json({ ok: true });
});
usersRouter.post("/:id/password", roles("Developer"), async (req, res) => {
  const userId = id.parse(req.params.id),
    input = z.object({ newPassword: password }).strict().parse(req.body);
  if (userId === req.user!.id)
    throw new HttpError(400, "Use Change Password for your own account.");
  const hash = await argon2.hash(input.newPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
  await transaction(async (db) => {
    if (
      !(await rows(db, "SELECT id FROM users WHERE id=? FOR UPDATE", [userId]))
        .length
    )
      throw new HttpError(404, "Account not found.");
    await db.execute("UPDATE users SET password_hash=? WHERE id=?", [
      hash,
      userId,
    ]);
    await db.execute("DELETE FROM sessions WHERE user_id=?", [userId]);
    await audit(
      db,
      req.user!,
      "Password reset",
      `Account ${userId}; sessions revoked.`,
    );
  });
  res.json({ ok: true });
});
export const dashboardRouter = Router();
dashboardRouter.get("/", authenticated, async (req, res) => {
  const result = await rows(
    pool,
    `SELECT status,COUNT(*) AS count FROM borrow_requests ${req.user!.role === "User" ? "WHERE user_id=?" : ""} GROUP BY status`,
    req.user!.role === "User" ? [req.user!.id] : [],
  );
  res.json(Object.fromEntries(result.map((r) => [r.status, r.count])));
});
export const logsRouter = Router();
logsRouter.get("/", roles("Admin", "Developer"), async (req, res) =>
  res.json(
    await rows(
      pool,
      `SELECT l.id,l.action,l.details,l.request_id,l.created_at,u.name AS actor,u.username FROM activity_logs l LEFT JOIN users u ON u.id=l.actor_id ${req.user!.role === "Admin" ? "WHERE l.actor_role IS NULL OR l.actor_role<>'Developer'" : ""} ORDER BY l.id DESC LIMIT 5000`,
    ),
  ),
);
