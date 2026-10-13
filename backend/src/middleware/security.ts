import type { Request, Response, NextFunction } from "express";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { pool, rows, type DB } from "../repositories/db.js";
import { env, allowedOrigins } from "../config/env.js";
export type Role = "Developer" | "Admin" | "User";
export type User = { id: string; username: string; name: string; role: Role };
declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: { hash: string; csrf: string };
    }
  }
}
import { HttpError } from "./errors.js";
export { HttpError } from "./errors.js";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const cookieName = env.NODE_ENV === "production" ? "__Host-tms" : "tms";
export async function createSession(
  res: Response,
  userId: string | null,
  db: DB = pool,
) {
  const token = randomBytes(32).toString("hex");
  const csrf = randomBytes(32).toString("hex");
  await db.execute(
    "INSERT INTO sessions(token_hash,csrf,user_id,expires_at) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 8 HOUR))",
    [hashToken(token), csrf, userId],
  );
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 3600 * 1000,
  });
  return csrf;
}
export async function session(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies[cookieName];
  if (typeof token === "string" && /^[a-f0-9]{64}$/.test(token)) {
    const [record] = await rows(
      pool,
      `SELECT s.token_hash,s.csrf,s.user_id,u.id,u.username,u.name,u.role,u.active FROM sessions s LEFT JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP(3)`,
      [hashToken(token)],
    );
    if (record && (!record.user_id || record.active)) {
      req.session = { hash: record.token_hash, csrf: record.csrf };
      if (record.user_id)
        req.user = {
          id: record.id,
          username: record.username,
          name: record.name,
          role: record.role,
        };
    }
  }
  next();
}
export function csrf(req: Request, _res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const candidate = req.get("X-CSRF-Token") || "";
  if (
    !allowedOrigins.has(req.get("Origin") || "") ||
    !req.session ||
    !/^[a-f0-9]{64}$/.test(candidate) ||
    !timingSafeEqual(Buffer.from(candidate), Buffer.from(req.session.csrf))
  )
    throw new HttpError(
      403,
      "Invalid request security token. Refresh and try again.",
    );
  next();
}
export function authenticated(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.user) throw new HttpError(401, "Please sign in.");
  next();
}
export function roles(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new HttpError(401, "Please sign in.");
    if (!allowed.includes(req.user.role))
      throw new HttpError(403, "Access denied.");
    next();
  };
}
export async function audit(
  db: DB,
  user: User | null,
  action: string,
  details: string,
  requestId: string | null = null,
) {
  await db.execute(
    "INSERT INTO activity_logs(actor_id,actor_role,action,details,request_id) VALUES(?,?,?,?,?)",
    [user?.id || null, user?.role || null, action, details, requestId],
  );
}
