#!/usr/bin/env tsx
/**
 * Measure the palette of every published listing and write the index the shop reads.
 *
 * Measured from the bytes the origin actually serves, not from local build output, so the
 * swatches on a card describe the file a buyer would download. That also makes one of the
 * shop's own claims checkable: the sprite sheets are baked from the 3D models and their
 * descriptions say the two share a palette. Measuring both the same way is what turns that
 * from a sentence into a number.
 *
 * Usage: npm run asset:palette:index [-- --origin https://…]
 */
import { writeFile } from "node:fs/promises";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import sharp from "sharp";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import { readImagePalette, readPalette, type PaletteEntry } from "../app/components/review/measure-palette";

const originArg = process.argv.indexOf("--origin");
const ORIGIN =
  originArg > -1 ? process.argv[originArg + 1] : "https://clunk.games";
const OUT = "app/data/listing-palettes.json";

/**
 * sharp resolves as `unknown` under this tsconfig's module settings, so the one call this
 * script makes is narrowed here rather than sprinkling casts through the loop. Same shape
 * scripts/luna-imagegen.ts uses.
 */
const decodeRgba = (bytes: Buffer) =>
  (sharp as unknown as (input: Buffer) => {
    ensureAlpha: () => { raw: () => { toBuffer: (o: { resolveWithObject: true }) => Promise<{ data: Uint8Array }> } };
  })(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

type Listing = {
  slug: string;
  format: string;
  artifact: { assetId: string; entryFileName: string };
};

const index = await fetch(`${ORIGIN}/api/marketplace`, { headers: { "cache-control": "no-cache" } });
if (!index.ok) throw new Error(`목록을 못 읽었습니다: ${index.status}`);
const { listings } = (await index.json()) as { listings: Listing[] };

const palettes: Record<string, PaletteEntry[]> = {};
const skipped: Array<{ slug: string; why: string }> = [];

for (const listing of listings) {
  // The public shop route, not the entitlement-gated asset API: this is the same URL the
  // product page viewer loads, so the palette describes exactly what a visitor sees.
  const url = `${ORIGIN}/market/${listing.slug}/${encodeURIComponent(listing.artifact.entryFileName)}`;
  // Retried because the origin currently returns intermittent 500s on the large texture
  // files — see `npm run market:verify`. Retrying here measures the catalogue; it does not
  // make the delivery problem go away, and the verifier is what reports that.
  let bytes: Buffer | null = null;
  let lastStatus = 0;
  for (let attempt = 0; attempt < 6 && bytes === null; attempt += 1) {
    const response = await fetch(`${url}?attempt=${attempt}`);
    lastStatus = response.status;
    if (response.ok) bytes = Buffer.from(await response.arrayBuffer());
    else await response.body?.cancel().catch(() => undefined);
  }
  if (bytes === null) {
    skipped.push({ slug: listing.slug, why: `HTTP ${lastStatus} (6회 재시도)` });
    continue;
  }
  try {
    if (listing.format === "model/gltf-binary") {
      const gltf = await loader.parseAsync(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        "",
      );
      palettes[listing.slug] = readPalette(THREE, gltf.scene);
    } else if (listing.format === "image/png") {
      const { data } = await decodeRgba(bytes);
      palettes[listing.slug] = readImagePalette(data);
    } else {
      skipped.push({ slug: listing.slug, why: `형식 ${listing.format}` });
      continue;
    }
    console.log(
      listing.slug.padEnd(38),
      palettes[listing.slug].map((e) => `${e.hex} ${(e.share * 100).toFixed(0)}%`).join(" "),
    );
  } catch (error) {
    skipped.push({ slug: listing.slug, why: error instanceof Error ? error.message : "읽기 실패" });
  }
}

await writeFile(
  OUT,
  JSON.stringify(
    {
      schema: "clunk.listing-palettes.v1",
      origin: ORIGIN,
      // Stamped so a stale index is visible rather than silently describing files that
      // have since been replaced.
      measuredAt: new Date().toISOString(),
      palettes,
    },
    null,
    2,
  ) + "\n",
  "utf8",
);
console.log(`\n${Object.keys(palettes).length}개 기록 → ${OUT}`);
if (skipped.length) console.log("건너뜀:", skipped.map((s) => `${s.slug}(${s.why})`).join(", "));
