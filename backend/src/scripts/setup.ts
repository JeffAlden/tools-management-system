import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { pool, rows } from "../repositories/db.js";
import { account } from "../validators/index.js";
import { audit } from "../middleware/security.js";
const input = account.parse({
  username: process.env.SETUP_USERNAME,
  name: process.env.SETUP_NAME,
  password: process.env.SETUP_PASSWORD,
  role: "Developer",
});
const db = await pool.getConnection();
try {
  const [lock] = await rows(
    db,
    "SELECT GET_LOCK('altech_tms_setup',30) AS acquired",
  );
  if (lock.acquired !== 1) throw new Error("Setup lock unavailable");
  await db.beginTransaction();
  if ((await rows(db, "SELECT id FROM users LIMIT 1")).length)
    throw new Error("Setup refused: users already exist.");
  const user = {
    id: randomUUID(),
    username: input.username,
    name: input.name,
    role: "Developer" as const,
  };
  await db.execute(
    "INSERT INTO users(id,username,name,password_hash,role) VALUES(?,?,?,?,?)",
    [
      user.id,
      user.username,
      user.name,
      await argon2.hash(input.password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      }),
      user.role,
    ],
  );
  await audit(
    db,
    user,
    "System initialized",
    "Initial Developer account created through secure setup.",
  );
  await db.commit();
  console.log("Initial Developer created. Remove SETUP_* variables.");
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.query("SELECT RELEASE_LOCK('altech_tms_setup')");
  db.release();
  await pool.end();
}
