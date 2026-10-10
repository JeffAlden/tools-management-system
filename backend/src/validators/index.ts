import { z } from "zod";
export const id = z.uuid();
const text = (max: number) => z.string().trim().min(1).max(max);
export const password = z
  .string()
  .min(12)
  .max(128)
  .refine(
    (v) =>
      /[a-z]/.test(v) &&
      /[A-Z]/.test(v) &&
      /[0-9]/.test(v) &&
      /[^A-Za-z0-9]/.test(v),
    "Use 12–128 characters with uppercase, lowercase, number and symbol.",
  );
export const login = z
  .object({ username: text(64), password: z.string().min(1).max(128) })
  .strict();
export const account = z
  .object({
    username: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_.-]{3,64}$/),
    name: text(150),
    password,
    role: z.enum(["Developer", "Admin", "User"]),
  })
  .strict();
export const accountUpdate = z
  .object({
    name: text(150),
    role: z.enum(["Developer", "Admin", "User"]),
    active: z.boolean(),
  })
  .strict();
export const tool = z
  .object({
    code: text(64),
    name: text(200),
    totalQty: z.number().int().min(0).max(1000000),
  })
  .strict();
export const toolImport = z
  .object({ tools: z.array(tool).min(1).max(1000) })
  .strict();
export const requestInput = z
  .object({
    borrowerName: text(150),
    position: text(150),
    plate: text(40),
    requestDate: z.iso.datetime({ offset: true }),
    items: z
      .array(
        z
          .object({
            name: text(200),
            requestedQty: z.number().int().min(1).max(1000000),
            note: z.string().trim().max(2000),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
export const returnInput = z
  .object({
    version: z.number().int().positive(),
    items: z
      .array(
        z
          .object({
            id,
            returnedQty: z.number().int().min(0),
            status: z.enum([
              "Not returned",
              "partial return",
              "Returned",
              "Not working",
            ]),
            conditionNote: z.string().trim().max(2000),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
export const handoverInput = z
  .object({ version: z.number().int().positive() })
  .strict();
export type ReturnItem = z.infer<typeof returnInput>["items"][number];
