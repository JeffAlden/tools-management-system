import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pino from "pino";
import { ZodError } from "zod";
import multer from "multer";
import { env } from "./config/env.js";
import { pool } from "./repositories/db.js";
import { session, csrf, HttpError } from "./middleware/security.js";
import { authRouter } from "./routes/auth.js";
import { requestsRouter, attachmentsRouter } from "./routes/requests.js";
import {
  toolsRouter,
  usersRouter,
  dashboardRouter,
  logsRouter,
} from "./routes/management.js";
import { reportsRouter } from "./routes/reports.js";
export const logger = pino({
  redact: ["password", "password_hash", "cookie", "authorization"],
});
export const app = express();
app.disable("x-powered-by");
if (env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests. Try again shortly." },
  }),
);
app.get("/api/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
});
app.use(
  "/api",
  (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  },
  express.json({ limit: "512kb" }),
  cookieParser(),
  session,
  csrf,
);
app.use("/api/auth", authRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/attachments", attachmentsRouter);
app.use("/api/tools", toolsRouter);
app.use("/api/users", usersRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/logs", logsRouter);
app.use("/api/reports", reportsRouter);
app.use((_req, _res, next) => next(new HttpError(404, "Not found.")));
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  let status = 500,
    message = "The server could not process this request.";
  if (error instanceof HttpError) {
    status = error.status;
    message = error.message;
  } else if (error instanceof ZodError) {
    status = 400;
    message = error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
  } else if (error instanceof multer.MulterError) {
    status = 400;
    message = "Upload rejected: check file size, count and fields.";
  } else if (error instanceof SyntaxError) {
    status = 400;
    message = "Invalid request data.";
  } else if (error.code === "ER_DUP_ENTRY") {
    status = 409;
    message = "Username or tool code already exists.";
  } else if (error.status === 413) {
    status = 413;
    message = "Request is too large.";
  } else
    logger.error({ code: error.code || "INTERNAL_ERROR" }, "Request failed");
  res.status(status).json({ error: message });
};
app.use(errorHandler);
