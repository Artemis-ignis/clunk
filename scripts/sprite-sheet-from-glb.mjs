/**
 * Bakes a 3D asset into a 2D sprite sheet.
 *
 * A text-to-image model asked for the same character sixteen times returns sixteen
 * characters. This route cannot: there is one mesh, and every frame is that mesh seen
 * from a different angle, so the sprite is consistent by construction rather than by
 * prompt. It is how a great deal of shipped 2D game art is actually made.
 *
 * The rasteriser is the same z-buffered software renderer the Cozy Farm Set uses for
 * review (examples/generated/cozy-farm-set/preview.mjs) with two things it lacked and a
 * sprite sheet needs: an alpha channel, so the cell drops into a scene without a
 * background plate, and an optional palette reduction, because a photographic gradient
 * upscaled with nearest-neighbour is not pixel art.
 *
 * No GPU, no browser, no inference cost. It runs wherever node runs.
 *
 * Usage:
 *   node scripts/sprite-sheet-from-glb.mjs <model.glb> <out-dir> [options]
 *
 *   --size 64            cell size in pixels (square)
 *   --views 4            4 (N/E/S/W) or 8 (adds the diagonals)
 *   --pitch 0.62         camera height; 0 is level with the model, 1 is steeply overhead
 *   --palette 32         reduce to N colours (0 disables)
 *   --no-sheet           write the cells only, skip the packed sheet
 *
 * Writes <stem>.<view>.png per cell, <stem>.sheet.png, and <stem>.sheet.json — the
 * manifest shape scripts/sprite-sheet-audit-cli.ts consumes, so the sheet can be
 * inspected the moment it exists.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { deflateSync } from "node:zlib";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

// --- Arguments ---------------------------------------------------------------------------
const positional = [];
const options = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const token = process.argv[i];
  if (token.startsWith("--")) {
    const [flag, inline] = token.slice(2).split("=");
    if (inline !== undefined) options.set(flag, inline);
    else if (process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) options.set(flag, process.argv[++i]);
    else options.set(flag, "true");
  } else positional.push(token);
}
const [glbPath, outArgument] = positional;
if (!glbPath || !outArgument) {
  process.stderr.write("Usage: sprite-sheet-from-glb.mjs <model.glb> <out-dir> [--size 64] [--views 4] [--palette 32]\n");
  process.exit(2);
}
const outDir = resolve(outArgument);
const CELL = Number(options.get("size") ?? 64);
const VIEW_COUNT = Number(options.get("views") ?? 4);
const PITCH = Number(options.get("pitch") ?? 0.62);
const PALETTE = Number(options.get("palette") ?? 0);
const WRITE_SHEET = options.get("no-sheet") !== "true";
if (!Number.isInteger(CELL) || CELL < 8 || CELL > 1024) throw new Error("--size must be an integer between 8 and 1024.");
if (VIEW_COUNT !== 4 && VIEW_COUNT !== 8) throw new Error("--views must be 4 or 8.");
if (PALETTE && (!Number.isInteger(PALETTE) || PALETTE < 2 || PALETTE > 256)) throw new Error("--palette must be between 2 and 256.");

// --- PNG (RGBA) --------------------------------------------------------------------------
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

/** Colour type 6: truecolour with alpha. The background is transparent, not painted. */
function encodePngRgba(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour + alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Scene -------------------------------------------------------------------------------
const bytes = await readFile(resolve(glbPath));
const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const gltf = await new Promise((ok, fail) => loader.parse(arrayBuffer, "", ok, fail));
const root = gltf.scene;
root.updateMatrixWorld(true);

/** Flattens the scene into world-space triangles carrying their material's display colour. */
const triangles = [];
{
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  root.traverse((node) => {
    if (!node.isMesh) return;
    const position = node.geometry.attributes.position;
    const index = node.geometry.index;
    const count = index ? index.count : position.count;
    // A low-poly asset carries its palette one of two ways: named materials, or a COLOR_0
    // attribute with a white material over it. Reading only the material turns every
    // vertex-coloured model — every tree and crate in this catalogue — into a white blob.
    const vertexColour = node.geometry.attributes.color;
    const colour = node.material?.color?.getHex(THREE.SRGBColorSpace) ?? 0xcccccc;
    const materialRgb = [((colour >> 16) & 255) / 255, ((colour >> 8) & 255) / 255, (colour & 255) / 255];
    // glTF stores COLOR_0 linear; the material path above came back through sRGB, so the
    // two are brought to the same space before they meet the same shading maths.
    const readVertexColour = (vertexIndex) => {
      const linear = [
        vertexColour.getX(vertexIndex),
        vertexColour.getY(vertexIndex),
        vertexColour.getZ(vertexIndex),
      ];
      return linear.map((channel) => (channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055));
    };
    for (let i = 0; i < count; i += 3) {
      const i0 = index ? index.getX(i) : i;
      const i1 = index ? index.getX(i + 1) : i + 1;
      const i2 = index ? index.getX(i + 2) : i + 2;
      a.fromBufferAttribute(position, i0).applyMatrix4(node.matrixWorld);
      b.fromBufferAttribute(position, i1).applyMatrix4(node.matrixWorld);
      c.fromBufferAttribute(position, i2).applyMatrix4(node.matrixWorld);
      let rgb = materialRgb;
      if (vertexColour) {
        // Flat shading already treats the face as one colour, so the face takes the mean
        // of its three vertices rather than interpolating across it.
        const v0 = readVertexColour(i0);
        const v1 = readVertexColour(i1);
        const v2 = readVertexColour(i2);
        rgb = [0, 1, 2].map((k) => ((v0[k] + v1[k] + v2[k]) / 3) * materialRgb[k]);
      }
      triangles.push({ a: a.clone(), b: b.clone(), c: c.clone(), rgb });
    }
  });
}
if (!triangles.length) throw new Error("The model contains no triangles to rasterise.");

const box = new THREE.Box3().setFromObject(root);
const centre = box.getCenter(new THREE.Vector3());
const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1e-6);

// --- Rasteriser --------------------------------------------------------------------------
const KEY_DIR = new THREE.Vector3(0.52, 0.74, 0.42).normalize(); // warm sun, high and to the right
const KEY = [1.0, 0.94, 0.84];
const SKY = [0.62, 0.72, 0.82]; // cool hemisphere fill from above
const AMBIENT = 0.2;

function render(dir) {
  const rgba = Buffer.alloc(CELL * CELL * 4); // zero-filled: fully transparent
  const depth = new Float64Array(CELL * CELL).fill(Infinity);

  const eye = new THREE.Vector3(...dir).normalize().multiplyScalar(radius * 3.1).add(centre);
  const forward = new THREE.Vector3().subVectors(centre, eye).normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  const focal = 1 / Math.tan((30 * Math.PI) / 360);
  const v = new THREE.Vector3();

  const project = (point) => {
    v.subVectors(point, eye);
    const z = -v.dot(forward);
    if (z > -0.01) return null;
    return {
      x: ((focal * v.dot(right)) / -z * 0.5 + 0.5) * CELL,
      y: (1 - ((focal * v.dot(up)) / -z * 0.5 + 0.5)) * CELL,
      z: -z,
    };
  };

  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (const tri of triangles) {
    const p0 = project(tri.a);
    const p1 = project(tri.b);
    const p2 = project(tri.c);
    if (!p0 || !p1 || !p2) continue;
    const area = (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y);
    if (area === 0) continue;

    // Flat shading from the world-space face normal: the read a low-poly asset gets in
    // engine, and the honest test of whether the facets separate on their own.
    ab.subVectors(tri.b, tri.a);
    ac.subVectors(tri.c, tri.a);
    normal.crossVectors(ab, ac).normalize();
    if (normal.dot(new THREE.Vector3().subVectors(eye, tri.a)) < 0) normal.negate();
    const key = Math.max(0, normal.dot(KEY_DIR)) * 0.82;
    const sky = (normal.y * 0.5 + 0.5) * 0.34;
    const shade = tri.rgb.map((channel, i) => channel * (AMBIENT + key * KEY[i] + sky * SKY[i]));

    const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x)));
    const maxX = Math.min(CELL - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
    const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
    const maxY = Math.min(CELL - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((p1.x - px) * (p2.y - py) - (p2.x - px) * (p1.y - py)) / area;
        const w1 = ((p2.x - px) * (p0.y - py) - (p0.x - px) * (p2.y - py)) / area;
        const w2 = ((p0.x - px) * (p1.y - py) - (p1.x - px) * (p0.y - py)) / area;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * p0.z + w1 * p1.z + w2 * p2.z;
        const offset = y * CELL + x;
        if (z >= depth[offset]) continue;
        depth[offset] = z;
        for (let channel = 0; channel < 3; channel += 1) {
          rgba[offset * 4 + channel] = Math.round(Math.min(1, Math.max(0, shade[channel])) ** (1 / 1.05) * 255);
        }
        // Opaque exactly where the mesh covered the pixel. No partial coverage: a hard
        // edge is what a pixel-art sheet wants, and it keeps every cell's alpha binary
        // so an engine can key on it without a threshold.
        rgba[offset * 4 + 3] = 255;
      }
    }
  }
  return rgba;
}

// --- Palette reduction -------------------------------------------------------------------
/**
 * Median cut over the opaque pixels of every cell at once, so the whole sheet shares one
 * palette. Reducing each cell separately would give the same object a different set of
 * browns per direction, which is the drift this route exists to avoid.
 */
function quantise(cells, colours) {
  const samples = [];
  for (const rgba of cells) {
    for (let i = 0; i < rgba.length; i += 4) {
      if (rgba[i + 3] === 0) continue;
      samples.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
    }
  }
  if (!samples.length) return [];

  const boxes = [samples];
  while (boxes.length < colours) {
    let widest = -1;
    let widestSpread = -1;
    let widestChannel = 0;
    for (let b = 0; b < boxes.length; b += 1) {
      if (boxes[b].length < 2) continue;
      for (let channel = 0; channel < 3; channel += 1) {
        let lo = 255;
        let hi = 0;
        for (const s of boxes[b]) {
          if (s[channel] < lo) lo = s[channel];
          if (s[channel] > hi) hi = s[channel];
        }
        if (hi - lo > widestSpread) {
          widestSpread = hi - lo;
          widest = b;
          widestChannel = channel;
        }
      }
    }
    if (widest < 0 || widestSpread <= 0) break;
    const box = boxes[widest];
    box.sort((p, q) => p[widestChannel] - q[widestChannel]);
    const half = box.length >> 1;
    boxes.splice(widest, 1, box.slice(0, half), box.slice(half));
  }

  const palette = boxes.filter((b) => b.length).map((b) => {
    const sum = [0, 0, 0];
    for (const s of b) {
      sum[0] += s[0];
      sum[1] += s[1];
      sum[2] += s[2];
    }
    return [Math.round(sum[0] / b.length), Math.round(sum[1] / b.length), Math.round(sum[2] / b.length)];
  });

  for (const rgba of cells) {
    for (let i = 0; i < rgba.length; i += 4) {
      if (rgba[i + 3] === 0) continue;
      let best = 0;
      let bestDistance = Infinity;
      for (let p = 0; p < palette.length; p += 1) {
        const dr = rgba[i] - palette[p][0];
        const dg = rgba[i + 1] - palette[p][1];
        const db = rgba[i + 2] - palette[p][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bestDistance) {
          bestDistance = d;
          best = p;
        }
      }
      rgba[i] = palette[best][0];
      rgba[i + 1] = palette[best][1];
      rgba[i + 2] = palette[best][2];
    }
  }
  return palette;
}

// --- Bake --------------------------------------------------------------------------------
// Cardinal directions first so a 4-view sheet reads S/W/N/E in the order engines expect;
// the diagonals slot between them when --views 8 is asked for.
const CARDINAL = [
  { tag: "south", dir: [0, PITCH, 1] },
  { tag: "west", dir: [-1, PITCH, 0] },
  { tag: "north", dir: [0, PITCH, -1] },
  { tag: "east", dir: [1, PITCH, 0] },
];
const DIAGONAL = [
  { tag: "southwest", dir: [-1, PITCH, 1] },
  { tag: "northwest", dir: [-1, PITCH, -1] },
  { tag: "northeast", dir: [1, PITCH, -1] },
  { tag: "southeast", dir: [1, PITCH, 1] },
];
const VIEWS = VIEW_COUNT === 4
  ? CARDINAL
  : [CARDINAL[0], DIAGONAL[0], CARDINAL[1], DIAGONAL[1], CARDINAL[2], DIAGONAL[2], CARDINAL[3], DIAGONAL[3]];

await mkdir(outDir, { recursive: true });
const stem = basename(glbPath).replace(/\.glb$/i, "");
const cells = VIEWS.map((view) => render(view.dir));
const palette = PALETTE ? quantise(cells, PALETTE) : [];

const written = [];
for (let i = 0; i < VIEWS.length; i += 1) {
  const file = join(outDir, `${stem}.${VIEWS[i].tag}.png`);
  await writeFile(file, encodePngRgba(CELL, CELL, cells[i]));
  written.push(file);
}

/**
 * Everything the sprite auditor measures, measured here from the same buffers that were
 * just written. Handing it a sheet without these leaves its quality lane UNAVAILABLE —
 * a sheet nobody can grade, which is the state this whole rail exists to end.
 */
const coverage = cells.map((rgba) => {
  let opaque = 0;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 0) opaque += 1;
  return opaque / (CELL * CELL);
});

const frameHashes = cells.map((rgba) => createHash("sha256").update(rgba).digest("hex"));
const visibleColours = new Set();
let hardAlpha = 0;
let totalPixels = 0;
let anyTransparent = false;
for (const rgba of cells) {
  for (let i = 0; i < rgba.length; i += 4) {
    totalPixels += 1;
    const alpha = rgba[i + 3];
    if (alpha === 0 || alpha === 255) hardAlpha += 1;
    if (alpha === 0) anyTransparent = true;
    else visibleColours.add((rgba[i] << 24) | (rgba[i + 1] << 16) | (rgba[i + 2] << 8) | alpha);
  }
}

/** A cell whose subject reaches the border is cropped; the engine would clip it. */
const borderTouchRatios = cells.map((rgba) => {
  let touching = 0;
  const edge = 2 * CELL + 2 * (CELL - 2);
  for (let x = 0; x < CELL; x += 1) {
    if (rgba[(0 * CELL + x) * 4 + 3] !== 0) touching += 1;
    if (rgba[((CELL - 1) * CELL + x) * 4 + 3] !== 0) touching += 1;
  }
  for (let y = 1; y < CELL - 1; y += 1) {
    if (rgba[(y * CELL) * 4 + 3] !== 0) touching += 1;
    if (rgba[(y * CELL + CELL - 1) * 4 + 3] !== 0) touching += 1;
  }
  return touching / edge;
});

/**
 * Share of visible pixels that break the pixel grid the art is drawn on. The scale is
 * inferred from the dominant run below; at scale 1 the sheet is drawn at its own
 * resolution and every pixel is on grid by construction, which is the case here because
 * the rasteriser writes cells at their final size rather than downsampling into them.
 */
function offGridRatio(scale) {
  if (scale <= 1) return 0;
  let visible = 0;
  let off = 0;
  for (const rgba of cells) {
    for (let y = 0; y < CELL; y += 1) {
      for (let x = 0; x < CELL; x += 1) {
        const o = (y * CELL + x) * 4;
        if (rgba[o + 3] === 0) continue;
        visible += 1;
        // The block's top-left pixel defines the block; anything inside it that differs
        // was resampled across a grid boundary.
        const bx = x - (x % scale);
        const by = y - (y % scale);
        const b = (by * CELL + bx) * 4;
        if (rgba[o] !== rgba[b] || rgba[o + 1] !== rgba[b + 1] || rgba[o + 2] !== rgba[b + 2]) off += 1;
      }
    }
  }
  return visible ? off / visible : 0;
}

/** Longest same-colour horizontal run, the observed pixel scale of the art. */
const dominantRunLength = (() => {
  const runs = new Map();
  for (const rgba of cells) {
    for (let y = 0; y < CELL; y += 1) {
      let run = 0;
      let previous = -1;
      for (let x = 0; x < CELL; x += 1) {
        const o = (y * CELL + x) * 4;
        const key = rgba[o + 3] === 0 ? -1 : (rgba[o] << 16) | (rgba[o + 1] << 8) | rgba[o + 2];
        if (key === previous && key !== -1) run += 1;
        else {
          if (run > 0) runs.set(run, (runs.get(run) ?? 0) + 1);
          run = key === -1 ? 0 : 1;
        }
        previous = key;
      }
      if (run > 0) runs.set(run, (runs.get(run) ?? 0) + 1);
    }
  }
  let best = 1;
  let bestCount = -1;
  for (const [length, count] of runs) if (count > bestCount) { bestCount = count; best = length; }
  return best;
})();

let sheetFile = null;
let manifestFile = null;
if (WRITE_SHEET) {
  const sheetWidth = CELL * VIEWS.length;
  const sheet = Buffer.alloc(sheetWidth * CELL * 4);
  for (let i = 0; i < cells.length; i += 1) {
    for (let y = 0; y < CELL; y += 1) {
      cells[i].copy(sheet, (y * sheetWidth + i * CELL) * 4, y * CELL * 4, (y + 1) * CELL * 4);
    }
  }
  const sheetBytes = encodePngRgba(sheetWidth, CELL, sheet);
  sheetFile = join(outDir, `${stem}.sheet.png`);
  await writeFile(sheetFile, sheetBytes);
  written.push(sheetFile);

  // The manifest the local sprite-sheet auditor reads, emitted in its own schema so the
  // sheet can be inspected the moment it is written. A shape the auditor rejects would
  // leave a hand-editing step in the middle of the pipeline, which is not a pipeline.
  const sheetHash = createHash("sha256").update(sheetBytes).digest("hex");
  const manifest = {
    schema: "clunk.sprite-sheet-review.v1",
    schemaVersion: "1",
    evidenceKind: "CONTRACT_FIXTURE",
    assetId: stem,
    // The auditor requires source and sheet to be the same bytes: `source` records the
    // provenance of the file under review, not the upstream model. The GLB that produced
    // it is recorded in `generation` below.
    source: {
      path: `${stem}.sheet.png`,
      origin: "procedural",
      sha256: sheetHash,
      bytes: sheetBytes.length,
    },
    target: {
      engine: "engine-agnostic",
      renderer: "clunk-software-rasteriser",
      platform: "2d",
      logicalFramePx: { width: CELL, height: CELL },
    },
    sheet: {
      path: `${stem}.sheet.png`,
      sha256: sheetHash,
      bytes: sheetBytes.length,
      width: sheetWidth,
      height: CELL,
    },
    grid: {
      columns: VIEWS.length,
      rows: 1,
      frameWidth: CELL,
      frameHeight: CELL,
      padding: { x: 0, y: 0 },
      spacing: { x: 0, y: 0 },
    },
    frames: VIEWS.map((view, i) => ({
      id: `idle_${view.tag}`,
      index: i,
      x: i * CELL,
      y: 0,
      width: CELL,
      height: CELL,
      state: "idle",
      direction: view.tag,
      // The model rests on the ground, so the sprite's contact point is the cell's
      // bottom centre — where an engine will place it against a tile.
      anchor: { x: CELL / 2, y: CELL - 1 },
    })),
    // One still per direction. These are facings, not a played animation, so each is its
    // own single-frame state rather than a cycle the auditor would check for motion.
    animations: VIEWS.map((view) => ({
      id: `idle_${view.tag}`,
      state: "idle",
      direction: view.tag,
      fps: 1,
      loop: false,
      frameIds: [`idle_${view.tag}`],
    })),
    qualityPolicy: {
      mode: "BLOCKING",
      strictChecks: ["pixel-discipline"],
      // The rasteriser writes each cell at its final size, so the art is drawn on a
      // 1px grid rather than upscaled from a smaller one.
      pixelGridSize: 1,
      requireTransparentBackground: true,
      minAlphaCoverage: 0.05,
      maxAlphaCoverage: 0.92,
    },
    metrics: {
      sourceHash: sheetHash,
      sheetDimensions: { width: sheetWidth, height: CELL },
      alphaCoverage: Number((coverage.reduce((sum, c) => sum + c, 0) / coverage.length).toFixed(6)),
      frameAlphaCoverages: coverage.map((c) => Number(c.toFixed(6))),
      frameHashes: Object.fromEntries(VIEWS.map((view, i) => [`idle_${view.tag}`, frameHashes[i]])),
      hasTransparentPixels: anyTransparent,
      emptyFrameIds: VIEWS.filter((_, i) => coverage[i] === 0).map((view) => `idle_${view.tag}`),
      borderTouchRatios: borderTouchRatios.map((r) => Number(r.toFixed(6))),
      silhouetteCoverages: coverage.map((c) => Number(c.toFixed(6))),
      measuredCellPx: { width: CELL, height: CELL },
      hardAlphaRatio: Number((hardAlpha / totalPixels).toFixed(6)),
      uniqueColorCount: visibleColours.size,
      dominantRunLength,
      offGridPixelRatio: Number(offGridRatio(dominantRunLength).toFixed(6)),
      // Every direction is a distinct facing, so no two cells should be identical.
      distinctFrameRatio: Number((new Set(frameHashes).size / frameHashes.length).toFixed(6)),
    },
    generation: {
      glb: basename(glbPath),
      glbSha256: createHash("sha256").update(bytes).digest("hex"),
      triangles: triangles.length,
      views: VIEW_COUNT,
      pitch: PITCH,
      palette: PALETTE
        ? { requested: PALETTE, produced: palette.length, colours: palette.map((c) => `#${c.map((n) => n.toString(16).padStart(2, "0")).join("")}`) }
        : null,
      coverage: coverage.map((c) => Number(c.toFixed(4))),
    },
  };
  manifestFile = join(outDir, `${stem}.sheet.json`);
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}
`);
  written.push(manifestFile);
}

process.stdout.write(`${JSON.stringify({
  glb: glbPath,
  triangles: triangles.length,
  cell: `${CELL}x${CELL}`,
  views: VIEWS.map((v) => v.tag),
  paletteColours: PALETTE ? palette.length : null,
  coverage: coverage.map((c) => Number(c.toFixed(4))),
  sheet: sheetFile,
  manifest: manifestFile,
  written,
}, null, 2)}\n`);
