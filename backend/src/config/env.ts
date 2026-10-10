import dotenv from "dotenv";
import path from "node:path";
import { z } from "zod";
dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), "../.env"), quiet: true });
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_ORIGIN: z.url().default("http://localhost:5173"),
  MYSQL_HOST: z.string().default("127.0.0.1"),
  MYSQL_PORT: z.coerce.number().int().default(3306),
  MYSQL_DATABASE: z.string().default("altech_tms"),
  MYSQL_USER: z.string().min(1),
  MYSQL_PASSWORD: z.string().min(1),
  MYSQL_SSL_CA: z.string().default(""),
  UPLOAD_DIR: z.string().default("./uploads"),
  TRUST_PROXY: z.enum(["0", "1"]).default("0"),
});
export const env = schema.parse(process.env);
if (
  env.NODE_ENV === "production" &&
  (!env.APP_ORIGIN.startsWith("https://") || !env.MYSQL_SSL_CA)
)
  throw new Error("Production requires HTTPS origin and MYSQL_SSL_CA");
export const uploadDir = path.resolve(env.UPLOAD_DIR);
