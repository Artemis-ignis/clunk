#!/usr/bin/env node
/**
 * Downscales one hero PNG to the marketplace's 512 x 512 webp preview.
 *
 * This is its own process on purpose. `sharp` and `@gltf-transform/functions` cannot be
 * loaded into the SAME node process on this machine: gltf-transform pulls `ndarray-pixels`,
 * which carries its own nested sharp 0.35.3, and loading it after the repository's own
 * sharp 0.34.5 fails with ERR_DLOPEN_FAILED out of libvips. build.mjs needs both, so the
 * image half is spawned rather than imported.
 *
 *   node preview-encode.mjs <hero.png> <preview.webp>
 */
import sharp from "sharp";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  process.stderr.write("Usage: preview-encode.mjs <hero.png> <preview.webp>\n");
  process.exit(1);
}
// 512 x 512, quality 80 — the previewStandard recorded in
// outputs/market-launch/wave1/upload-manifest.json for every 3D listing in the shop.
await sharp(input).resize(512, 512, { fit: "inside" }).webp({ quality: 80 }).toFile(output);
