import { readFile } from "node:fs/promises";
import { pool, rows } from "../repositories/db.js";
const db = await pool.getConnection();
try {
  const [lock] = await rows(
    db,
    "SELECT GET_LOCK('altech_tms_migration',30) AS acquired",
  );
  if (lock.acquired !== 1) throw new Error("Migration lock unavailable");
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(version INT PRIMARY KEY,applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB",
  );
  if (
    !(await rows(db, "SELECT version FROM schema_migrations WHERE version=1"))
      .length
  ) {
    const sql = await readFile(
      new URL("../../../database/schema.sql", import.meta.url),
      "utf8",
    );
    for (const statement of sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.query(statement);
    await db.execute("INSERT INTO schema_migrations(version) VALUES(1)");
  }
  if (
    !(await rows(db, "SELECT version FROM schema_migrations WHERE version=2"))
      .length
  ) {
    // Check the column as DDL is not transactional; safe to retry after interruption.
    const [column] = await rows(
      db,
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='deleted_at'",
    );
    if (!column) {
      const sql = await readFile(
        new URL(
          "../../../database/migrations/002-account-deletion.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await db.query(sql);
    }
    await db.execute("INSERT INTO schema_migrations(version) VALUES(2)");
  }
  if (!(await rows(db, "SELECT version FROM schema_migrations WHERE version=3")).length) {
    const sql = await readFile(new URL("../../../database/migrations/003-public-requests.sql", import.meta.url), "utf8");
    for (const statement of sql.split(";").map((s) => s.trim()).filter(Boolean))
      await db.query(statement);
    await db.execute("INSERT INTO schema_migrations(version) VALUES(3)");
  }
  console.log("Schema version 3 ready.");
} finally {
  await db.query("SELECT RELEASE_LOCK('altech_tms_migration')");
  db.release();
  await pool.end();
}
