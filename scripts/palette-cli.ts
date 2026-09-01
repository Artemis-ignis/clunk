#!/usr/bin/env tsx
/**
 * Report an asset's palette from disk: the colours in the file and the share of visible
 * surface each covers.
 *
 * The same function the product page runs in the buyer's browser, so what this prints and
 * what the shop shows cannot disagree. Useful for checking a new asset sits in a project's
 * colour scheme before it is baked into a sprite sheet or listed.
 *
 * Usage: npm run asset:palette -- <model.glb> [more.glb ...] [--json]
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import { readPalette } from "../app/components/review/measure-palette";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const paths = args.filter((arg) => !arg.startsWith("--"));
if (paths.length === 0) {
  console.error("사용법: npm run asset:palette -- <model.glb> [...] [--json]");
  process.exit(1);
}

const loader = new GLTFLoader();
// Our own optimiser emits EXT_meshopt_compression, so the decoder is not optional here.
loader.setMeshoptDecoder(MeshoptDecoder);

const results: Array<{ file: string; palette: Array<{ hex: string; share: number }> }> = [];
for (const path of paths) {
  const bytes = await readFile(path);
  const gltf = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    "",
  );
  const palette = readPalette(THREE, gltf.scene);
  results.push({ file: path, palette });
  if (!asJson) {
    console.log(
      basename(path).padEnd(36),
      palette.map((entry) => `${entry.hex} ${(entry.share * 100).toFixed(1)}%`).join("  ") || "(색 없음)",
    );
  }
}
if (asJson) console.log(JSON.stringify({ schema: "clunk.palette.v1", results }, null, 2));
