#!/usr/bin/env node
/**
 * Re-encode the wave-1 seamless textures in place.
 *
 * Two problems, one pass:
 *
 * 1. Four of the seven ship a 32-bit RGBA PNG whose alpha channel is 99.6% opaque and
 *    otherwise encoder dither — no transparency anyone authored. An opaque ground texture
 *    that carries an alpha channel is an invitation for an engine to blend it.
 *
 * 2. Cloudflare's static asset service was returning intermittent 500s on four of these
 *    files — a published product whose download was a coin flip. Re-encoding gives every
 *    one of them a fresh content hash, so the deploy uploads new blobs rather than
 *    skipping them as unchanged.
 *
 * Strictly lossless, which is why the saving is 7-12% and not the 66% sharp offers by
 * default: its default quantises to a 256-colour palette, and on these photographic
 * textures that is a channel error of up to 31 and visible banding. The colour channels are
 * compared byte for byte after encoding and the write is refused if they differ.
 *
 * Alpha is only dropped when it is opaque enough to be meaningless (below), so running this
 * on a texture that really does carry transparency leaves it alone.
 *
 * Usage: node scripts/texture-reencode.mjs [--dry-run]
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import sharp from "sharp";

/** Opaque enough that the channel carries nothing: fewer than 1 in 200 pixels below 255. */
const TRIVIAL_ALPHA_RATIO = 0.005;

const root = resolve(import.meta.dirname, "..");
const wave1 = join(root, "outputs", "market-launch", "wave1");
const manifestPath = join(wave1, "upload-manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const dryRun = process.argv.includes("--dry-run");

let changed = 0;
for (const product of manifest.products) {
  for (const file of product.files) {
    if (file.contentType !== "image/png" || !/^assets\/textures-vol1\//.test(file.path)) continue;
    const path = join(wave1, file.path);
    const original = readFileSync(path);
    const image = sharp(original);
    const meta = await image.metadata();

    let pipeline = sharp(original);
    let droppedAlpha = false;
    if ((meta.channels ?? 3) === 4) {
      const { data } = await sharp(original).extractChannel(3).raw().toBuffer({ resolveWithObject: true });
      let translucent = 0;
      for (const value of data) if (value !== 255) translucent += 1;
      if (translucent / data.length <= TRIVIAL_ALPHA_RATIO) {
        pipeline = pipeline.removeAlpha();
        droppedAlpha = true;
      }
    }
    // palette:false is not the default. Without it sharp quantises to 256 colours, which
    // is two thirds smaller and quietly not the same picture.
    const encoded = await pipeline.png({ compressionLevel: 9, effort: 10, palette: false }).toBuffer();

    // Prove it: every colour byte must survive. Alpha is excluded because dropping it is
    // the intended change.
    const originalRgb = await sharp(original).removeAlpha().raw().toBuffer();
    const encodedRgb = await sharp(encoded).removeAlpha().raw().toBuffer();
    if (Buffer.compare(originalRgb, encodedRgb) !== 0) {
      throw new Error(`${file.path}: 재인코딩이 색을 바꿨습니다. 쓰지 않고 중단합니다.`);
    }

    // Never write a re-encode that is not smaller: a larger file would be a pure loss, and
    // the only reason to touch these bytes at all is that they are too big.
    if (encoded.length >= original.length) {
      // Nothing to rewrite, but the manifest still has to describe what is on disk. A file
      // is listed twice when it belongs to a bundle as well as its own product, and the
      // second pass used to skip straight past without syncing the record — which left the
      // bundle publishing the hash of bytes that no longer existed.
      const actual = createHash("sha256").update(original).digest("hex");
      if (file.byteLength !== original.length || file.sha256 !== actual) {
        file.byteLength = original.length;
        file.sha256 = actual;
        changed += 1;
      }
      console.log(`${file.path}: 그대로 (${original.length}B)`);
      continue;
    }
    const sha256 = createHash("sha256").update(encoded).digest("hex");
    console.log(
      `${file.path}: ${(original.length / 1048576).toFixed(2)}MB → ${(encoded.length / 1048576).toFixed(2)}MB` +
        ` (${Math.round((1 - encoded.length / original.length) * 100)}% 감소${droppedAlpha ? ", 알파 제거" : ""})`,
    );
    if (!dryRun) {
      writeFileSync(path, encoded);
      file.byteLength = encoded.length;
      file.sha256 = sha256;
    }
    changed += 1;
  }
}

if (!dryRun && changed > 0) {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`\n${changed}개 재인코딩, 매니페스트 갱신. 다음: node scripts/seed-wave1-qa.mjs`);
} else {
  console.log(`\n${changed}개 대상${dryRun ? " (dry-run, 아무것도 쓰지 않음)" : ""}`);
}
