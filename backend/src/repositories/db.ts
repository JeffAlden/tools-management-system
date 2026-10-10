import mysql, { type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { readFileSync } from "node:fs";
import { env } from "../config/env.js";
export const pool = mysql.createPool({
  host: env.MYSQL_HOST,
  port: env.MYSQL_PORT,
  user: env.MYSQL_USER,
  password: env.MYSQL_PASSWORD,
  database: env.MYSQL_DATABASE,
  connectionLimit: 10,
  charset: "utf8mb4",
  timezone: "Z",
  dateStrings: true,
  ssl: env.MYSQL_SSL_CA
    ? { ca: readFileSync(env.MYSQL_SSL_CA), rejectUnauthorized: true }
    : undefined,
});
// DATETIME defaults and audit timestamps must use the same UTC convention as
// parameter serialization and explicit UTC_TIMESTAMP lifecycle updates.
pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'");
});
export type DB = PoolConnection | typeof pool;
export async function rows<T = Record<string, any>>(
  db: DB,
  sql: string,
  values: any[] = [],
): Promise<T[]> {
  const [result] = await db.execute<RowDataPacket[]>(sql, values);
  return result as T[];
}
export async function transaction<T>(
  fn: (db: PoolConnection) => Promise<T>,
): Promise<T> {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const value = await fn(db);
    await db.commit();
    return value;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}
