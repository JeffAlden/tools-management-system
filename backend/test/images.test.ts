import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { optimizeImage, renderImageVariant } from "../src/services/images.js";

test("large photos become smaller WebP files capped at 1200 pixels wide", async () => {
  const input = await sharp({
    create: { width: 2400, height: 1600, channels: 3, background: "#5577aa" },
  })
    .png()
    .toBuffer();
  const result = await optimizeImage(input, false);
  const metadata = await sharp(result.buffer).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 800);
  assert.ok(result.buffer.length < input.length);
  for (const width of [300, 600, 1200]) {
    const variant = await renderImageVariant(result.buffer, width, false);
    assert.equal((await sharp(variant).metadata()).width, width);
  }
  await assert.rejects(async () =>
    renderImageVariant(result.buffer, 999, false),
  );
});

test("signatures retain pixels and transparency; previews remain lossless", async () => {
  const input = await sharp({
    create: {
      width: 680,
      height: 260,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="680" height="260"><path d="M10 100 L100 60 L200 140" stroke="black" stroke-width="3" fill="none"/></svg>',
        ),
      },
    ])
    .png()
    .toBuffer();
  const result = await optimizeImage(input, true);
  assert.equal(result.mime, "image/png");
  assert.deepEqual(
    await sharp(result.buffer).raw().toBuffer(),
    await sharp(input).raw().toBuffer(),
  );
  const preview = await renderImageVariant(result.buffer, 300, true);
  assert.equal((await sharp(preview).metadata()).hasAlpha, true);
});

test("invalid images and blank signatures are rejected; WebP is accepted", async () => {
  await assert.rejects(() => optimizeImage(Buffer.from("not an image"), false));
  const blank = await sharp({
    create: {
      width: 50,
      height: 50,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();
  await assert.rejects(() => optimizeImage(blank, true));
  const webp = await sharp({
    create: { width: 50, height: 50, channels: 3, background: "blue" },
  })
    .webp()
    .toBuffer();
  assert.equal(
    (await sharp((await optimizeImage(webp, false)).buffer).metadata()).width,
    50,
  );
});
