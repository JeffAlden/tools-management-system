import multer from "multer";
import {
  imageWidths,
  imageVariantKey,
  optimizeImage,
  renderImageVariant,
} from "./images.js";
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
  mime: string;
};
export async function prepareFiles(
  files: Express.Multer.File[],
): Promise<PreparedFile[]> {
  const prepared: PreparedFile[] = [];
  try {
    await mkdir(uploadDir, { recursive: true, mode: 0o700 });
    for (const file of files) {
      let output: Buffer;
      let mime: string;
      let extension: string;
      try {
        const optimized = await optimizeImage(
          file.buffer,
          file.fieldname.endsWith("Signature"),
        );
        output = optimized.buffer;
        mime = optimized.mime;
        extension = optimized.extension;
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
        key: randomUUID() + extension,
        size: output.length,
        mime,
      };
      prepared.push(attachment);
      await writeFile(path.join(uploadDir, attachment.key), output, {
        flag: "wx",
        mode: 0o600,
      });
      for (const width of imageWidths) {
        const variant = await renderImageVariant(
          output,
          width,
          file.fieldname.endsWith("Signature"),
        );
        await writeFile(
          path.join(uploadDir, imageVariantKey(attachment.key, width)),
          variant,
          { flag: "wx", mode: 0o600 },
        );
      }
    }
    return prepared;
  } catch (error) {
    await removeFiles(prepared);
    throw error;
  }
}
export async function removeFiles(files: PreparedFile[]) {
  await Promise.all(
    files.flatMap((f) =>
      [f.key, ...imageWidths.map((w) => imageVariantKey(f.key, w))].map((key) =>
        unlink(path.join(uploadDir, key)).catch(() => {}),
      ),
    ),
  );
}
export async function attach(
  db: DB,
  files: PreparedFile[],
  requestId: string,
  userId: string | null,
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
        file.mime,
        file.size,
      ],
    );
}
