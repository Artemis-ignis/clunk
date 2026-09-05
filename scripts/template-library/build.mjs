#!/usr/bin/env node
/**
 * Builds the Clunk template library: every template, in every colourway, with the thumbnail,
 * the sprite sheet and the measurements that go with it.
 *
 * Output tree (gitignored; scripts/template-library/upload.mjs mirrors it into R2 under the
 * same relative keys, prefixed `templates/`):
 *
 *   outputs/template-library/library.json
 *   outputs/template-library/contact-sheet.png
 *   outputs/template-library/<template>/<palette>.glb
 *   outputs/template-library/<template>/<palette>.thumb.webp
 *   outputs/template-library/<template>/sheet-<palette>.png
 *   outputs/template-library/<template>/sheet-<palette>.json
 *
 * Every number written into library.json is measured off the file that was just written — the
 * triangle count comes from the exported scene, the byte length and hash from the bytes on
 * disk, the sheet grid from the baker's own manifest. Nothing is asserted from the registry.
 *
 *   node scripts/template-library/build.mjs [--out outputs/template-library] [--only <id>,<id>]
 *                                           [--skip-sheets] [--skip-thumbnails]
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import sharp from "sharp";
import { bakeTemplate, paletteSwatches } from "./bake.mjs";
import { COLOURWAYS } from "./palette.mjs";
import { ANIMATION_TEMPLATES, DEFAULT_SIZE_ID, MAX_SCALE, MIN_SCALE, SIZES, TEMPLATES } from "./templates.mjs";

const REPO = resolve(import.meta.dirname, "..", "..");
const HERO = resolve(REPO, "outputs/market-launch/wave1/tools/hero-render.mjs");
const SHEET_BAKER = resolve(REPO, "scripts/sprite-sheet-from-glb.mjs");
const MATERIAL_ATLAS = resolve(REPO, "scripts/template-library/material-atlas.mjs");

/**
 * The material ceiling the studio's own review holds a saved file to — mobile is what
 * `web-three-mobile` resolves to (packages/core/src/assetops-profiles.ts, MOBILE_BUDGET).
 * A template over it is refused with a 422 and never reaches the customer, so the library
 * folds those models' palettes into a swatch before filing them. See ./material-atlas.mjs.
 */
const MAX_MATERIALS = 6;

const THUMB_PX = 384;
const SHEET_CELL = 64;
const SHEET_VIEWS = 8;
/** A library file has to survive a Worker fetch and a 3 MB response budget with room to spare. */
const MAX_TEMPLATE_BYTES = 3 * 1024 * 1024;

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  if (process.argv[i].startsWith("--")) {
    const flag = process.argv[i].slice(2);
    const next = process.argv[i + 1];
    args.set(flag, next && !next.startsWith("--") ? (i += 1, next) : "true");
  }
}
const OUT = resolve(REPO, args.get("out") ?? "outputs/template-library");
const ONLY = args.get("only") ? new Set(args.get("only").split(",").map((value) => value.trim())) : null;
const SKIP_SHEETS = args.get("skip-sheets") === "true";
const SKIP_THUMBS = args.get("skip-thumbnails") === "true";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const log = (line) => process.stdout.write(`${line}\n`);

/** Renders `glb` to a webp thumbnail through the wave-1 hero renderer, unchanged. */
async function renderThumbnail(glbPath, outPath, scratch) {
  const png = join(scratch, `${basename(outPath)}.png`);
  execFileSync(process.execPath, [HERO, glbPath, png], { stdio: ["ignore", "ignore", "pipe"] });
  await sharp(png).resize(THUMB_PX, THUMB_PX, { fit: "inside" }).webp({ quality: 82 }).toFile(outPath);
  return (await readFile(outPath)).byteLength;
}

/**
 * Bakes an 8-direction sheet through scripts/sprite-sheet-from-glb.mjs and files the two
 * artifacts under the library's own naming. The manifest's internal path fields are rewritten
 * to the filed names so the JSON a user downloads points at the PNG they downloaded with it.
 */
async function bakeSheet(glbPath, templateDir, paletteId, scratch) {
  const stage = join(scratch, `sheet-${Math.random().toString(36).slice(2)}`);
  await mkdir(stage, { recursive: true });
  execFileSync(
    process.execPath,
    [SHEET_BAKER, glbPath, stage, "--size", String(SHEET_CELL), "--views", String(SHEET_VIEWS)],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const produced = await readdir(stage);
  const sheetPng = produced.find((name) => name.endsWith(".sheet.png"));
  const sheetJson = produced.find((name) => name.endsWith(".sheet.json"));
  if (!sheetPng || !sheetJson) throw new Error(`sprite-sheet-from-glb produced no sheet for ${glbPath}`);

  const pngName = `sheet-${paletteId}.png`;
  const jsonName = `sheet-${paletteId}.json`;
  const pngBytes = await readFile(join(stage, sheetPng));
  const manifest = JSON.parse(await readFile(join(stage, sheetJson), "utf8"));
  manifest.source = { ...manifest.source, path: pngName };
  manifest.sheet = { ...manifest.sheet, path: pngName };
  if (Array.isArray(manifest.frames)) {
    manifest.frames = manifest.frames.map((frame) => ({ ...frame, ...(frame.path ? { path: pngName } : {}) }));
  }
  const jsonBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(templateDir, pngName), pngBytes);
  await writeFile(join(templateDir, jsonName), jsonBytes);
  await rm(stage, { recursive: true, force: true });
  return {
    png: pngName,
    json: jsonName,
    byteLength: pngBytes.byteLength,
    sha256: sha256(pngBytes),
    manifestByteLength: jsonBytes.byteLength,
    grid: manifest.grid,
    frames: manifest.grid ? manifest.grid.columns * manifest.grid.rows : SHEET_VIEWS,
    cellPx: SHEET_CELL,
    views: SHEET_VIEWS,
  };
}

/**
 * Folds a palette-heavy model down to one material, in place, and says what it did.
 *
 * Runs last, after the thumbnail and the sheet, and in its own process. Both of those open
 * the GLB with three's loader in Node, which cannot unpack an embedded image; the swatch the
 * fold adds is exactly such an image. Doing it afterwards means the pictures are rendered
 * from the plain model and the file that ships is the one the studio can save.
 */
function foldMaterials(glbPath) {
  const raw = execFileSync(
    process.execPath,
    [MATERIAL_ATLAS, glbPath, "--limit", String(MAX_MATERIALS), "--json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const report = JSON.parse(raw.trim().split("\n").pop());
  return {
    status: report.status,
    materialsBefore: report.materialsBefore,
    materialsAfter: report.materialsAfter,
    ...(report.status === "folded"
      ? { swatchPx: report.swatchPx, worstColourStep: report.worstColourStep, worstShadingStep: report.worstShadingStep }
      : {}),
  };
}

async function buildFactoryTemplate(template, scratch) {
  const dir = join(OUT, template.id);
  await mkdir(dir, { recursive: true });
  const palettes = [];
  let facts = null;
  let clips = [];

  for (const colourway of COLOURWAYS) {
    const baked = await bakeTemplate(REPO, template, colourway);
    if (baked.bytes.byteLength > MAX_TEMPLATE_BYTES) {
      throw new Error(`${template.id}/${colourway.id} is ${baked.bytes.byteLength} bytes, over the 3 MB ceiling.`);
    }
    const glbName = `${colourway.id}.glb`;
    const glbPath = join(dir, glbName);
    await writeFile(glbPath, baked.bytes);
    facts ??= baked.facts;
    clips = baked.clips.length ? baked.clips : clips;

    const entry = {
      id: colourway.id,
      name: colourway.name,
      note: colourway.note,
      swatches: await paletteSwatches(REPO, template, colourway),
      glb: glbName,
      byteLength: baked.bytes.byteLength,
      sha256: sha256(baked.bytes),
    };
    if (!SKIP_THUMBS) {
      const thumbName = `${colourway.id}.thumb.webp`;
      entry.thumbnail = thumbName;
      entry.thumbnailByteLength = await renderThumbnail(glbPath, join(dir, thumbName), scratch);
    }
    if (template.sheet && !SKIP_SHEETS) entry.sheet = await bakeSheet(glbPath, dir, colourway.id, scratch);

    // The file is finished here, so the length and the hash are taken from the bytes on disk
    // rather than from what the exporter returned — the fold rewrites them.
    const atlas = foldMaterials(glbPath);
    if (atlas.status === "folded") {
      const folded = await readFile(glbPath);
      if (folded.byteLength > MAX_TEMPLATE_BYTES) {
        throw new Error(`${template.id}/${colourway.id} is ${folded.byteLength} bytes after the material fold, over the 3 MB ceiling.`);
      }
      entry.byteLength = folded.byteLength;
      entry.sha256 = sha256(folded);
      entry.materialAtlas = atlas;
    } else {
      entry.materials = atlas.materialsAfter;
    }
    palettes.push(entry);
    log(
      `  ${template.id}/${colourway.id}  ${entry.byteLength.toLocaleString()} B  ${baked.facts.triangles} tri`
      + (atlas.status === "folded" ? `  materials ${atlas.materialsBefore} -> ${atlas.materialsAfter}` : ""),
    );
  }
  return { palettes, facts, clips };
}

/** A rigged Harvest Frontier export goes into the library byte-for-byte, in one colourway. */
async function buildPassthroughTemplate(template, scratch) {
  const dir = join(OUT, template.id);
  await mkdir(dir, { recursive: true });
  const bytes = await readFile(resolve(REPO, template.source));
  if (bytes.byteLength > MAX_TEMPLATE_BYTES) throw new Error(`${template.id} is over the 3 MB ceiling.`);
  const glbPath = join(dir, "original.glb");
  await writeFile(glbPath, bytes);

  const json = readGltfJson(bytes);
  const facts = {
    triangles: null,
    materials: (json.materials ?? []).length,
    nodes: (json.nodes ?? []).length,
    boundsMetres: null,
    byteLength: bytes.byteLength,
  };
  const entry = {
    id: "original",
    name: "기본",
    note: "하베스트 프론티어 수출본 그대로입니다. 이 템플릿은 색을 바꾸지 않습니다.",
    swatches: [],
    glb: "original.glb",
    byteLength: bytes.byteLength,
    sha256: sha256(bytes),
  };
  if (!SKIP_THUMBS) {
    entry.thumbnail = "original.thumb.webp";
    entry.thumbnailByteLength = await renderThumbnail(glbPath, join(dir, "original.thumb.webp"), scratch);
  }
  log(`  ${template.id}/original  ${bytes.byteLength.toLocaleString()} B  (passthrough)`);
  return { palettes: [entry], facts, clips: (json.animations ?? []).map((clip) => clip.name ?? "clip") };
}

/** The JSON chunk of a GLB, without decoding the binary chunk. */
function readGltfJson(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    if (type === 0x4e4f534a) return JSON.parse(new TextDecoder().decode(bytes.subarray(offset + 8, offset + 8 + length)));
    offset += 8 + length;
  }
  throw new Error("GLB has no JSON chunk.");
}

/** One grid of every template's default thumbnail, so the whole library is one look. */
async function writeContactSheet(entries) {
  const tiles = [];
  for (const entry of entries) {
    const palette = entry.palettes.find((item) => item.thumbnail);
    if (palette) tiles.push(join(OUT, entry.id, palette.thumbnail));
  }
  if (!tiles.length) return null;
  const cell = 256;
  const columns = Math.min(6, tiles.length);
  const rows = Math.ceil(tiles.length / columns);
  const composites = await Promise.all(tiles.map(async (tile, index) => ({
    input: await sharp(tile).resize(cell, cell, { fit: "contain", background: { r: 236, g: 236, b: 236 } }).png().toBuffer(),
    left: (index % columns) * cell,
    top: Math.floor(index / columns) * cell,
  })));
  const out = join(OUT, "contact-sheet.png");
  await sharp({
    create: { width: columns * cell, height: rows * cell, channels: 3, background: { r: 236, g: 236, b: 236 } },
  }).composite(composites).png().toFile(out);
  return out;
}

async function main() {
  const scratch = join(OUT, ".scratch");
  await mkdir(scratch, { recursive: true });
  if (!existsSync(HERO)) throw new Error(`hero renderer is missing: ${HERO}`);

  const registry = [...TEMPLATES, ...ANIMATION_TEMPLATES].filter((template) => !ONLY || ONLY.has(template.id));
  const entries = [];
  for (const template of registry) {
    log(`[template-library] ${template.id}`);
    const built = template.mode === "passthrough"
      ? await buildPassthroughTemplate(template, scratch)
      : await buildFactoryTemplate(template, scratch);
    const clips = template.clip
      ? [{ id: template.clip.name, name: template.clip.koreanName ?? template.clip.name, node: template.clip.node, loop: Boolean(template.clip.loop) }]
      : built.clips.map((name) => ({ id: name, name, node: null, loop: false }));
    entries.push({
      id: template.id,
      name: template.name,
      kind: template.kind,
      keywords: template.keywords ?? [],
      // Every model in this library is code in this repository or an export already in the
      // Clunk catalogue. The runtime repeats this line to the user with the result.
      source: template.factory ?? template.source,
      license: "creator-owned",
      assembly: template.mode === "passthrough" ? "copied-export" : "code-factory-rebake",
      facts: built.facts,
      ...(clips.length ? { clips } : {}),
      palettes: built.palettes,
      sizes: SIZES,
      defaultSizeId: DEFAULT_SIZE_ID,
      scales: SIZES.map((size) => size.scale),
      scaleRange: { min: MIN_SCALE, max: MAX_SCALE },
    });
  }

  const contactSheet = await writeContactSheet(entries);
  await rm(scratch, { recursive: true, force: true });

  const library = {
    schema: "clunk.template-library.v1",
    generatedAt: new Date().toISOString(),
    generator: "clunk-template-library-build-v1",
    // The one sentence the whole feature stands on. The runtime copies it into every result.
    honesty: "코드 템플릿 조립 · AI 아님. 저장소의 three.js 팩토리를 팔레트만 바꿔 다시 굽고, 요청 시 크기만 바꿔 돌려줍니다.",
    colourways: COLOURWAYS.map(({ id, name, note, transform }) => ({ id, name, note, transform })),
    sizes: SIZES,
    scaleRange: { min: MIN_SCALE, max: MAX_SCALE },
    templates: entries,
  };
  await writeFile(join(OUT, "library.json"), `${JSON.stringify(library, null, 2)}\n`);

  const files = entries.flatMap((entry) => entry.palettes.flatMap((palette) => [
    palette.byteLength,
    palette.thumbnailByteLength ?? 0,
    palette.sheet?.byteLength ?? 0,
    palette.sheet?.manifestByteLength ?? 0,
  ].filter(Boolean)));
  log("");
  log(`[template-library] templates ${entries.length}  files ${files.length}  bytes ${files.reduce((a, b) => a + b, 0).toLocaleString()}`);
  log(`[template-library] library.json  ${join(OUT, "library.json")}`);
  if (contactSheet) log(`[template-library] contact sheet ${contactSheet}`);
}

await main();
