#!/usr/bin/env node
/**
 * Folds a model's palette of flat, texture-free materials into ONE material plus two tiny
 * swatch images, so a model that is over budget only because it is colourful stops being
 * over budget without a single colour changing.
 *
 * Why this exists
 * ---------------
 * The Cozy Farm Set is authored the way its own kit header describes: one material per
 * palette role, created once and reused. A market stall that carries carrots, cabbages,
 * tomatoes and potatoes on a two-tone timber frame under two-tone canvas needs eleven of
 * them; the shed needs nine. The mobile inspection profile allows six
 * (packages/core/src/assetops-profiles.ts, MOBILE_BUDGET.maxMaterials), so /studio refused
 * to save either one: MAT-MATERIAL-BUDGET is an ERROR, an ERROR is a hard blocker, and the
 * series route answers 422.
 *
 * The budget is not wrong and is not lowered here. What it counts is draw calls, and eleven
 * flat colours genuinely do cost eleven of them. So the file is fixed instead: every
 * material's baseColorFactor becomes a texel of a swatch image, every material's roughness
 * and metalness become a texel of a second swatch image in the glTF-standard G/B packing,
 * and every primitive is pointed at its own texel through a constant TEXCOORD_1. Eleven
 * draw calls become one, and a conforming renderer reproduces the original colours and the
 * original shading exactly — the metal stays metal, the glass stays smooth.
 *
 * What it refuses to do
 * ---------------------
 * If the materials differ in anything a per-texel swatch cannot express — alpha mode,
 * double-sidedness, emission, an existing texture, an extension — they are not
 * interchangeable, and the model is left alone with a non-zero exit. Collapsing those would
 * change how the model renders, which is the one thing this must not do.
 *
 * The swatch is addressed through TEXCOORD_1 so the authored TEXCOORD_0 survives for a buyer
 * who wants to put their own texture on the model — the same choice
 * scripts/palette-bake-sweep.mjs made for the models that already carry a swatch sheet.
 *
 *   node scripts/template-library/material-atlas.mjs <in.glb> [out.glb] [--limit 6] [--json]
 *
 * With no out path the file is rewritten in place. A model already at or under the limit is
 * passed through untouched and reported as `skipped`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

/** baseColorFactor is linear; a PNG swatch is read back as sRGB. */
const linearToSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055);
const byte = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));

// --- PNG (8-bit RGBA, filter 0) -----------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = -1;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(rgba, width, height) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Everything about a material that a per-texel swatch cannot express. Two materials may be
 * folded together only if all of these match; colour, roughness and metalness are what the
 * swatches carry and so are deliberately absent from the comparison.
 */
function shadingClass(material) {
  return JSON.stringify({
    alphaMode: material.getAlphaMode(),
    alphaCutoff: material.getAlphaMode() === "MASK" ? material.getAlphaCutoff() : null,
    doubleSided: material.getDoubleSided(),
    emissive: material.getEmissiveFactor(),
    textured: [
      material.getBaseColorTexture(),
      material.getMetallicRoughnessTexture(),
      material.getNormalTexture(),
      material.getOcclusionTexture(),
      material.getEmissiveTexture(),
    ].map((texture) => Boolean(texture)),
    extensions: material.listExtensions().map((extension) => extension.extensionName).sort(),
  });
}

/** Smallest power of two at least `value`. */
const pow2 = (value) => 2 ** Math.ceil(Math.log2(Math.max(1, value)));

export async function foldMaterialsIntoAtlas(bytes, limit = 6) {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
  const document = await io.readBinary(new Uint8Array(bytes));
  const root = document.getRoot();
  const materials = root.listMaterials();

  if (materials.length <= limit) {
    return {
      status: "skipped",
      materialsBefore: materials.length,
      materialsAfter: materials.length,
      bytes: Buffer.from(bytes),
    };
  }

  const classes = new Set(materials.map(shadingClass));
  if (classes.size > 1) {
    const error = new Error(
      `${materials.length} materials fall into ${classes.size} shading classes (alpha mode, double-sidedness, `
      + "emission, textures or extensions differ), which one material cannot carry per texel.",
    );
    error.detail = { materialsBefore: materials.length, shadingClasses: classes.size };
    throw error;
  }

  // --- the swatch grid ---------------------------------------------------------------------
  // One block per material, laid out square, then rounded up to a power of two. Sampling is
  // NEAREST at the block's centre texel, so no filter can blend two palette colours together.
  const BLOCK = 4;
  const columns = Math.ceil(Math.sqrt(materials.length));
  const size = pow2(columns * BLOCK);
  const base = new Uint8Array(size * size * 4);
  const metalRough = new Uint8Array(size * size * 4);
  const uvFor = [];

  materials.forEach((material, index) => {
    const cx = (index % columns) * BLOCK;
    const cy = Math.floor(index / columns) * BLOCK;
    const [r, g, b, a] = material.getBaseColorFactor();
    const roughness = material.getRoughnessFactor();
    const metalness = material.getMetallicFactor();
    for (let y = cy; y < cy + BLOCK; y += 1) {
      for (let x = cx; x < cx + BLOCK; x += 1) {
        const at = (y * size + x) * 4;
        base[at] = byte(linearToSrgb(r));
        base[at + 1] = byte(linearToSrgb(g));
        base[at + 2] = byte(linearToSrgb(b));
        base[at + 3] = byte(a);
        // glTF metallicRoughnessTexture: roughness in G, metalness in B, read linearly.
        metalRough[at] = 255;
        metalRough[at + 1] = byte(roughness);
        metalRough[at + 2] = byte(metalness);
        metalRough[at + 3] = 255;
      }
    }
    uvFor.push([(cx + BLOCK / 2) / size, (cy + BLOCK / 2) / size]);
  });

  const buffer = root.listBuffers()[0] ?? document.createBuffer();
  const baseTexture = document.createTexture("palette-base-colour")
    .setImage(encodePng(base, size, size))
    .setMimeType("image/png");
  const metalRoughTexture = document.createTexture("palette-metallic-roughness")
    .setImage(encodePng(metalRough, size, size))
    .setMimeType("image/png");

  const folded = document.createMaterial("palette")
    .setBaseColorFactor([1, 1, 1, 1])
    .setRoughnessFactor(1)
    .setMetallicFactor(1)
    .setAlphaMode(materials[0].getAlphaMode())
    .setDoubleSided(materials[0].getDoubleSided())
    .setEmissiveFactor(materials[0].getEmissiveFactor())
    .setBaseColorTexture(baseTexture)
    .setMetallicRoughnessTexture(metalRoughTexture);
  if (materials[0].getAlphaMode() === "MASK") folded.setAlphaCutoff(materials[0].getAlphaCutoff());

  // NEAREST in both directions, so a texel is a palette entry and nothing between two
  // entries is ever sampled.
  const NEAREST = 9728;
  for (const info of [folded.getBaseColorTextureInfo(), folded.getMetallicRoughnessTextureInfo()]) {
    info.setTexCoord(1);
    info.setMagFilter(NEAREST);
    info.setMinFilter(NEAREST);
  }

  const slotOf = new Map(materials.map((material, i) => [material, i]));
  const accessors = new Map();
  /** What each repointed primitive used to render as, kept for the check below. */
  const expected = [];
  let primitives = 0;
  let repointed = 0;
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      primitives += 1;
      const material = primitive.getMaterial();
      const position = primitive.getAttribute("POSITION");
      if (!material || !slotOf.has(material) || !position) continue;
      const slot = slotOf.get(material);
      expected.push({
        primitive,
        baseColor: material.getBaseColorFactor(),
        roughness: material.getRoughnessFactor(),
        metalness: material.getMetallicFactor(),
      });
      const count = position.getCount();
      const key = `${slot}:${count}`;
      if (!accessors.has(key)) {
        const [u, v] = uvFor[slot];
        const array = new Float32Array(count * 2);
        for (let i = 0; i < count; i += 1) {
          array[i * 2] = u;
          array[i * 2 + 1] = v;
        }
        accessors.set(
          key,
          document.createAccessor(`palette-uv-${slot}`).setType("VEC2").setArray(array).setBuffer(buffer),
        );
      }
      primitive.setAttribute("TEXCOORD_1", accessors.get(key));
      primitive.setMaterial(folded);
      repointed += 1;
    }
  }

  // --- the check ---------------------------------------------------------------------------
  // Moving colour into a texture is not verifiable by eye: a renderer that reads the swatch
  // shows the same picture whether the fold was right or wrong, and one that ignores it shows
  // white either way. So every repointed primitive is read back the way a renderer will read
  // it — take the UV that was actually written, sample the texel it lands on, undo the sRGB
  // encoding — and compared against the colour that primitive used to carry. The tolerance is
  // one sRGB step, the floor for eight-bit storage, and the same bar
  // scripts/palette-bake-sweep.mjs holds its own bake to.
  let worstColourStep = 0;
  let worstShadingStep = 0;
  for (const entry of expected) {
    const uv = entry.primitive.getAttribute("TEXCOORD_1");
    const [u, v] = uv.getElement(0, [0, 0]);
    const x = Math.min(size - 1, Math.max(0, Math.floor(u * size)));
    const y = Math.min(size - 1, Math.max(0, Math.floor(v * size)));
    const at = (y * size + x) * 4;
    for (let k = 0; k < 3; k += 1) {
      const want = byte(linearToSrgb(entry.baseColor[k]));
      worstColourStep = Math.max(worstColourStep, Math.abs(base[at + k] - want));
    }
    worstColourStep = Math.max(worstColourStep, Math.abs(base[at + 3] - byte(entry.baseColor[3])));
    worstShadingStep = Math.max(
      worstShadingStep,
      Math.abs(metalRough[at + 1] - byte(entry.roughness)),
      Math.abs(metalRough[at + 2] - byte(entry.metalness)),
    );
  }
  if (worstColourStep > 1 || worstShadingStep > 1) {
    const error = new Error(
      `the folded swatch does not reproduce the original materials: worst colour error ${worstColourStep} sRGB steps, `
      + `worst roughness/metalness error ${worstShadingStep} steps (1 is the eight-bit floor).`,
    );
    error.detail = { worstColourStep, worstShadingStep };
    throw error;
  }

  for (const material of materials) material.dispose();

  const out = Buffer.from(await io.writeBinary(document));
  return {
    status: "folded",
    materialsBefore: materials.length,
    materialsAfter: root.listMaterials().length,
    swatchPx: size,
    primitives,
    repointed,
    /** Worst per-channel disagreement between the swatch and the material it replaced. */
    worstColourStep,
    worstShadingStep,
    bytes: out,
  };
}

// --- CLI --------------------------------------------------------------------------------
const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const flags = new Map();
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) {
      positional.push(argv[i]);
      continue;
    }
    const flag = argv[i].slice(2);
    const next = argv[i + 1];
    flags.set(flag, next && !next.startsWith("--") ? argv[++i] : "true");
  }
  const [input, output] = positional;
  if (!input) {
    process.stderr.write("Usage: material-atlas.mjs <in.glb> [out.glb] [--limit 6] [--json]\n");
    process.exit(2);
  }
  const inPath = resolve(input);
  const outPath = resolve(output ?? input);
  const limit = Number(flags.get("limit") ?? 6);
  try {
    const result = await foldMaterialsIntoAtlas(readFileSync(inPath), limit);
    writeFileSync(outPath, result.bytes);
    const { bytes, ...report } = result;
    report.byteLength = bytes.byteLength;
    report.path = outPath;
    process.stdout.write(flags.has("json")
      ? `${JSON.stringify(report)}\n`
      : `[material-atlas] ${report.status}  ${report.materialsBefore} -> ${report.materialsAfter} materials  `
        + `${report.byteLength.toLocaleString()} B  ${outPath}\n`);
  } catch (error) {
    process.stderr.write(`[material-atlas] ${error.message}\n`);
    process.exit(1);
  }
}
