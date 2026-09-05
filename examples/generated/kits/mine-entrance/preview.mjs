#!/usr/bin/env node
/**
 * Mine Entrance Kit — hero PNG to storefront preview WebP.
 *
 *   node preview.mjs <hero.png> <preview.webp>
 *
 * Same standard as the wave-1 lane (outputs/market-launch/wave1/tools/make-previews.mjs):
 * 512 x 512, fit "fill", lanczos3, WebP quality 80. A 3D preview withholds nothing but
 * resolution — the geometry is not in the picture — so there is no watermark.
 *
 * WHY THIS IS ITS OWN PROCESS
 * Importing `@gltf-transform/functions` anywhere in a process breaks sharp's raw pixel path:
 * libvips then throws "colourspace: parameter space not set" on the next toFile(). ./build.mjs
 * needs gltf-transform for the kit file's dedup/prune pass, so it cannot also call sharp — it
 * shells out to this file instead. The first run of the build hit exactly that error after
 * writing sixteen hero PNGs and no previews.
 */
import sharp from "sharp";

const [source, target] = process.argv.slice(2);
if (!source || !target) {
  process.stderr.write("Usage: preview.mjs <hero.png> <preview.webp>\n");
  process.exit(1);
}

await sharp(source).resize(512, 512, { fit: "fill", kernel: "lanczos3" }).webp({ quality: 80 }).toFile(target);
