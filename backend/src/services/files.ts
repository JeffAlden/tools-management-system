import multer from "multer";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { uploadDir } from "../config/env.js";
import { HttpError } from "../middleware/security.js";
import type { DB } from "../repositories/db.js";
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 2,
    fields: 1,
    fieldSize: 256 * 1024,
    parts: 3,
  },
  fileFilter: (_req, file, cb) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.mimetype))
      return cb(
        new HttpError(400, "Only PNG, JPEG and WebP images are accepted."),
      );
    cb(null, true);
  },
});
export type PreparedFile = {
  id: string;
  kind: string;
  key: string;
  size: number;
};
export async function prepareFiles(
  files: Express.Multer.File[],
): Promise<PreparedFile[]> {
  const prepared: PreparedFile[] = [];
  try {
    await mkdir(uploadDir, { recursive: true, mode: 0o700 });
    for (const file of files) {
      let output: Buffer;
      try {
        const decoder = sharp(file.buffer, { limitInputPixels: 20000000 });
        const meta = await decoder.metadata();
        if (
          !["png", "jpeg", "webp"].includes(meta.format || "") ||
          (meta.pages || 1) > 1
        )
          throw new Error("type");
        if (file.fieldname.endsWith("Signature")) {
          const stats = await decoder.stats();
          if (
            (meta.hasAlpha && stats.channels.at(-1)!.max === 0) ||
            stats.channels.slice(0, 3).every((c) => c.min === 255)
          )
            throw new Error("blank signature");
        }
        output = await decoder
          .rotate()
          .resize({
            width: 2000,
            height: 2000,
            fit: "inside",
            withoutEnlargement: true,
          })
          .png()
          .toBuffer();
      } catch {
        throw new HttpError(
          400,
          "Invalid image or image dimensions are too large.",
        );
      }
      if (output.length > 5 * 1024 * 1024)
        throw new HttpError(400, "Processed image exceeds 5 MB.");
      const attachment = {
        id: randomUUID(),
        kind: file.fieldname,
        key: randomUUID() + ".png",
        size: output.length,
      };
      await writeFile(path.join(uploadDir, attachment.key), output, {
        flag: "wx",
        mode: 0o600,
      });
      prepared.push(attachment);
    }
    return prepared;
  } catch (error) {
    await removeFiles(prepared);
    throw error;
  }
}
export async function removeFiles(files: PreparedFile[]) {
  await Promise.all(
    files.map((f) => unlink(path.join(uploadDir, f.key)).catch(() => {})),
  );
}
export async function attach(
  db: DB,
  files: PreparedFile[],
  requestId: string,
  userId: string,
  eventId: string | null = null,
) {
  for (const file of files)
    await db.execute(
      "INSERT INTO attachments(id,request_id,event_id,uploaded_by,kind,storage_key,mime_type,size_bytes) VALUES(?,?,?,?,?,?,?,?)",
      [
        file.id,
        requestId,
        eventId,
        userId,
        file.kind,
        file.key,
        "image/png",
        file.size,
      ],
    );
}
