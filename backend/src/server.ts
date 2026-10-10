import { app, logger } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./repositories/db.js";
await pool.query("SELECT 1");
const server = app.listen(env.PORT, "0.0.0.0", () =>
  logger.info({ port: env.PORT }, "API listening"),
);
const cleanup = setInterval(() => {
  pool
    .execute("DELETE FROM sessions WHERE expires_at<UTC_TIMESTAMP(3)")
    .catch(() => logger.error("Session cleanup failed"));
}, 3600000);
cleanup.unref();
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    clearInterval(cleanup);
    server.close(() => {
      pool.end().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
