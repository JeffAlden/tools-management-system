import sharp from "sharp";

export const imageWidths = [300, 600, 1200] as const;
export function imageVariantKey(key: string, width: number) {
  return `${key}.${width}.webp`;
}

export async function optimizeImage(input: Buffer, signature: boolean) {
  const decoder = sharp(input, { limitInputPixels: 20000000 });
  const meta = await decoder.metadata();
  if (
    !["png", "jpeg", "webp"].includes(meta.format || "") ||
    (meta.pages || 1) > 1
  )
    throw new Error("Unsupported image");
  if (signature) {
    const stats = await decoder.stats();
    if (
      (meta.hasAlpha && stats.channels.at(-1)!.max === 0) ||
      stats.channels.slice(0, 3).every((c) => c.min === 255)
    )
      throw new Error("Blank signature");
    // Preserve signature pixels and transparency without lossy compression.
    return {
      buffer: await decoder.rotate().png().toBuffer(),
      mime: "image/png",
      extension: ".png",
    };
  }
  return {
    buffer: await decoder
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer(),
    mime: "image/webp",
    extension: ".webp",
  };
}

export function renderImageVariant(
  input: Buffer,
  width: number,
  signature: boolean,
) {
  if (!imageWidths.includes(width as (typeof imageWidths)[number]))
    throw new Error("Invalid image width");
  return sharp(input, { limitInputPixels: 20000000 })
    .rotate()
    .resize({ width })
    .webp(
      signature ? { lossless: true, effort: 4 } : { quality: 80, effort: 4 },
    )
    .toBuffer();
}
