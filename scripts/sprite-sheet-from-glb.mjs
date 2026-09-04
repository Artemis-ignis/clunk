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
import { unbakePalette } from "./lib/unbake-palette.mjs";

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

/**
 * Framing mode.
 *
 * `sphere` (the default, and what every sheet baked before 2026-09-03 used) puts a
 * perspective camera at r/sin(fov/2) from the bounding sphere's centre. It is safe and it
 * wastes the cell: a tall, thin subject — a tree — occupies the sphere's diameter in height
 * and a fraction of it in width, so most of the cell is empty alpha, and because the camera
 * distance is re-derived per direction the subject's footprint drifts from cell to cell.
 *
 * `box` fits an ORTHOGRAPHIC camera to the union of the projected bounding boxes over every
 * direction AND every animation frame at once, then keeps that one scale and one anchor
 * pixel for all of them. Two things follow that a sprite sheet needs and the sphere fit
 * cannot give: the object's ground-contact point lands on the same pixel in every cell (so
 * the sheet drops onto a tile grid without the subject sliding around), and the tightest
 * scale that still clears `--pad` pixels on all four sides of the worst case is used, so
 * nothing is ever clipped and the cell is as full as the worst direction allows.
 */
const FIT = options.get("fit") ?? "sphere";
if (FIT !== "sphere" && FIT !== "box") throw new Error("--fit must be sphere or box.");
/** Clear pixels demanded on every side of every cell. Nothing may touch the cell edge. */
const PAD = Number(options.get("pad") ?? 0);
if (!Number.isInteger(PAD) || PAD < 0 || PAD * 2 >= CELL) throw new Error("--pad must be a non-negative integer smaller than half the cell.");
/**
 * Supersampling factor. The rasteriser writes binary alpha, which is what a sprite sheet
 * wants; at 64 px that also meant a 1.4 px fence rail resolved into a dotted line, because a
 * rail either covered a pixel centre or did not. Rendering at SS× and resolving by coverage
 * keeps the alpha hard while letting a thin member decide a pixel on area rather than on
 * whether it happened to cross the centre.
 */
const SS = Number(options.get("ss") ?? 1);
if (!Number.isInteger(SS) || SS < 1 || SS > 6) throw new Error("--ss must be an integer between 1 and 6.");
/** Ambient floor. Raising it is how a shadow-side interior stops crushing to black. */
const AMBIENT_OPT = options.has("ambient") ? Number(options.get("ambient")) : null;
/** Camera-relative fill from the side opposite the key; 0 disables it (the original rig). */
const FILL_OPT = options.has("fill") ? Number(options.get("fill")) : null;
/**
 * Key and sky strengths. They exist as flags because raising the ambient floor to rescue a
 * crushed interior, without taking the same amount back out of the key and the sky, pushes
 * every upward-facing surface past 1.0 and the crate's lid comes out as blown white paper.
 * Exposure is a budget: ambient + key + sky is what an up-facing surface receives.
 */
const KEY_STRENGTH = options.has("key-strength") ? Number(options.get("key-strength")) : 0.82;
const SKY_STRENGTH = options.has("sky") ? Number(options.get("sky")) : 0.34;
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
const bytes = await unbakePalette(await readFile(resolve(glbPath)));
const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const gltf = await new Promise((ok, fail) => loader.parse(arrayBuffer, "", ok, fail));
const root = gltf.scene;
root.updateMatrixWorld(true);

/**
 * Flattens the scene into world-space triangles carrying their material's display colour.
 * Re-run per pose: a rotated pivot changes matrixWorld, and the triangles are what the
 * rasteriser sees, so a cached list would draw every frame in the rest pose.
 */
function collectTriangles() {
  const triangles = [];
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
  return triangles;
}

let triangles = collectTriangles();
if (!triangles.length) throw new Error("The model contains no triangles to rasterise.");

// Framing is fixed from the REST pose and reused for every frame. Reframing per frame
// would make the subject breathe as a limb swings, which reads as the camera moving
// rather than the character.
const box = new THREE.Box3().setFromObject(root);
const centre = box.getCenter(new THREE.Vector3());
const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1e-6);

// --- Rasteriser --------------------------------------------------------------------------
// The key light travels with the camera. A world-fixed sun is right for one render and
// wrong for a sheet: the facings that turn away from it come out as black silhouettes,
// and a sprite sheet whose north view is unreadable is not a sheet. Every direction gets
// the same light from the same relative place — high, to the right, slightly behind the
// viewer — which is how a commercial pack reads the same at every facing.
/**
 * Where the key sits relative to the camera. The sideways term is the one that decides how
 * evenly the eight facings read: with a strongly side-placed key a diagonal facing shows two
 * partly-lit faces and a cardinal facing shows one flat-on face, and the sheet's mean
 * brightness swings between them — the flicker the 2026-09-03 audit measured at 48% on the
 * market stall. Overridable so the rig can be tuned against that measurement instead of
 * guessed at.
 */
const KEY_OFFSET = options.has("key")
  ? (() => {
    const [right, up, toward] = String(options.get("key")).split(",").map(Number);
    if (![right, up, toward].every(Number.isFinite)) throw new Error("--key wants three numbers: right,up,toward");
    return { right, up, toward };
  })()
  : { right: 0.52, up: 0.74, toward: 0.42 };
const KEY = [1.0, 0.94, 0.84];
const SKY = [0.62, 0.72, 0.82]; // cool hemisphere fill from above
const AMBIENT = AMBIENT_OPT ?? 0.2;
/** Bounce from the shadow side, also camera-relative, so it cannot favour one facing. */
const FILL_OFFSET = { right: -0.68, up: 0.18, toward: 0.30 };
const FILL_STRENGTH = FILL_OPT ?? 0;
const FILL = [0.82, 0.86, 1.0];

/** The camera basis for a view direction, shared by the fit pass and the rasteriser. */
function basisFor(dir) {
  const eyeDir = new THREE.Vector3(...dir).normalize();
  const forward = eyeDir.clone().negate();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  return { eyeDir, forward, right, up };
}

/**
 * The one anchor every cell shares: the centre of the model's footprint at its lowest
 * point — where the object touches the ground. Fixed from the rest pose, so a swinging
 * leaf cannot drag the anchor with it.
 */
let ANCHOR = null;
/** { scale, ax, ay } in cell pixels, solved once over every view and every frame. */
let ORTHO = null;

function render(dir) {
  const W = CELL * SS;
  const rgba = Buffer.alloc(W * W * 4); // zero-filled: fully transparent
  const depth = new Float64Array(W * W).fill(Infinity);

  // Distance that actually fits the bounding sphere: d = r / sin(fov/2), plus a small
  // margin. A fixed multiple of the radius happened to work for the wide, squat models
  // in this catalogue and cut the head and boots off the first tall one — a character is
  // 1.62 m of mostly height, and 3.1 radii at a 30 degree field shows 1.46 m of it.
  const fitDistance = (radius / Math.sin((30 * Math.PI) / 360)) * 1.06;
  const eye = new THREE.Vector3(...dir).normalize().multiplyScalar(fitDistance).add(centre);
  const { forward, right, up } = basisFor(dir);
  const keyLen = Math.hypot(KEY_OFFSET.right, KEY_OFFSET.up, KEY_OFFSET.toward);
  const keyDir = keyLen === 0 ? null : new THREE.Vector3()
    .addScaledVector(right, KEY_OFFSET.right)
    .addScaledVector(up, KEY_OFFSET.up)
    .addScaledVector(forward, -KEY_OFFSET.toward)
    .normalize();
  const fillDir = new THREE.Vector3()
    .addScaledVector(right, FILL_OFFSET.right)
    .addScaledVector(up, FILL_OFFSET.up)
    .addScaledVector(forward, -FILL_OFFSET.toward)
    .normalize();
  const focal = 1 / Math.tan((30 * Math.PI) / 360);
  const v = new THREE.Vector3();

  const project = FIT === "box"
    // Orthographic, in the one scale and around the one anchor solved for the whole sheet.
    ? (point) => {
      v.subVectors(point, ANCHOR);
      return {
        x: (ORTHO.ax + v.dot(right) * ORTHO.scale) * SS,
        y: (ORTHO.ay - v.dot(up) * ORTHO.scale) * SS,
        z: v.dot(forward),
      };
    }
    : (point) => {
      v.subVectors(point, eye);
      const z = -v.dot(forward);
      if (z > -0.01) return null;
      return {
        x: ((focal * v.dot(right)) / -z * 0.5 + 0.5) * W,
        y: (1 - ((focal * v.dot(up)) / -z * 0.5 + 0.5)) * W,
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
    // A zero key vector turns the key off entirely: --ambient 1 --fill 0 --key 0,0,0 renders
    // pure albedo, which is how a facing-to-facing brightness swing is attributed to the
    // light rig or to the model's own colours rather than argued about.
    const key = keyDir ? Math.max(0, normal.dot(keyDir)) * KEY_STRENGTH : 0;
    const fill = Math.max(0, normal.dot(fillDir)) * FILL_STRENGTH;
    const sky = keyDir ? (normal.y * 0.5 + 0.5) * SKY_STRENGTH : 0;
    const shade = tri.rgb.map((channel, i) => channel * (AMBIENT + key * KEY[i] + fill * FILL[i] + sky * SKY[i]));

    const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x)));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
    const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
    const maxY = Math.min(W - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((p1.x - px) * (p2.y - py) - (p2.x - px) * (p1.y - py)) / area;
        const w1 = ((p2.x - px) * (p0.y - py) - (p0.x - px) * (p2.y - py)) / area;
        const w2 = ((p0.x - px) * (p1.y - py) - (p1.x - px) * (p0.y - py)) / area;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * p0.z + w1 * p1.z + w2 * p2.z;
        const offset = y * W + x;
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
  if (SS === 1) return rgba;

  /**
   * Coverage resolve. A pixel is opaque when at least half of its subsamples were covered —
   * hard alpha kept, but decided on area, so a rail thinner than a pixel comes out as a
   * continuous line instead of a dotted one. Colour is the mean of the covered subsamples
   * only, so an edge pixel is not darkened toward the transparent background.
   */
  const out = Buffer.alloc(CELL * CELL * 4);
  const half = (SS * SS) / 2;
  for (let y = 0; y < CELL; y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      let covered = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const o = ((y * SS + sy) * W + x * SS + sx) * 4;
          if (rgba[o + 3] === 0) continue;
          covered += 1;
          r += rgba[o];
          g += rgba[o + 1];
          b += rgba[o + 2];
        }
      }
      if (covered < half || covered === 0) continue;
      const o = (y * CELL + x) * 4;
      out[o] = Math.round(r / covered);
      out[o + 1] = Math.round(g / covered);
      out[o + 2] = Math.round(b / covered);
      out[o + 3] = 255;
    }
  }
  return out;
}

/**
 * Solves the one orthographic scale and anchor pixel the whole sheet shares.
 *
 * Every vertex of every pose is projected into every view's camera plane; the extents are
 * unioned, and the scale is the largest that still leaves `PAD` clear pixels on all four
 * sides of that union. Because the solve happens once, the anchor cannot move between
 * cells: whatever jitter remains in a cell's alpha bounding box is the silhouette genuinely
 * changing shape, not the camera.
 */
function solveOrthoFit(views, frameCount) {
  ANCHOR = new THREE.Vector3(centre.x, box.min.y, centre.z);
  const bases = views.map((view) => basisFor(view.dir));
  let uMin = Infinity;
  let uMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;
  const d = new THREE.Vector3();
  for (let f = 0; f < frameCount; f += 1) {
    pose(f);
    for (const tri of triangles) {
      for (const point of [tri.a, tri.b, tri.c]) {
        d.subVectors(point, ANCHOR);
        for (const { right, up } of bases) {
          const u = d.dot(right);
          const v = d.dot(up);
          if (u < uMin) uMin = u;
          if (u > uMax) uMax = u;
          if (v < vMin) vMin = v;
          if (v > vMax) vMax = v;
        }
      }
    }
  }
  pose(0);
  // The drawable square, minus a whole pixel of slack so a vertex landing exactly on the
  // boundary still rasterises inside it.
  const span = CELL - 2 * PAD - 1;
  const scale = Math.min(span / Math.max(uMax - uMin, 1e-9), span / Math.max(vMax - vMin, 1e-9));
  const slackX = span - (uMax - uMin) * scale;
  return {
    scale,
    ax: PAD + 0.5 + slackX / 2 - uMin * scale,
    // The subject sits on the floor of the cell: its lowest point is PAD pixels above the
    // bottom edge, which is where a ground-contact anchor belongs.
    ay: CELL - 1 - PAD + vMin * scale,
    extents: { uMin, uMax, vMin, vMax },
  };
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

/**
 * A clip rotates named nodes. Our factories already expose them — the fence gate hangs
 * its leaf under `gate_pivot`, the well turns its drum under `winch_pivot` — because a
 * consumer animates the asset by rotating one node rather than by swapping meshes. The
 * same discipline is what lets a sheet be baked from the model rather than drawn twice.
 *
 * {
 *   "name": "walk", "fps": 8,
 *   "tracks": [{ "node": "leg_l_pivot", "axis": "x", "degrees": [0, 25, 0, -25] }]
 * }
 *
 * Every track must declare the same number of keys: that count is the frame count.
 */
let clip = null;
if (options.has("clip")) {
  clip = JSON.parse(await readFile(resolve(options.get("clip")), "utf8"));
  if (!Array.isArray(clip.tracks) || !clip.tracks.length) throw new Error("A clip needs at least one track.");
  const lengths = new Set(clip.tracks.map((track) => track.degrees.length));
  if (lengths.size !== 1) throw new Error("Every track in a clip must declare the same number of keys.");
  clip.frames = [...lengths][0];
  if (clip.frames < 1) throw new Error("A clip needs at least one key per track.");
  for (const track of clip.tracks) {
    const node = root.getObjectByName(track.node);
    if (!node) {
      const named = [];
      root.traverse((n) => { if (n.name) named.push(n.name); });
      throw new Error(`Clip track targets "${track.node}", which this model does not carry. It exposes: ${named.join(", ") || "(no named nodes)"}`);
    }
    // The rest rotation is the base every key is applied on top of, so a clip that
    // returns to 0 returns the asset to the pose the author shipped.
    track.target = node;
    track.rest = node.rotation[track.axis];
  }
}

/** Applies frame `index` of the clip and rebuilds the world-space triangle list. */
function pose(index) {
  if (!clip) return;
  for (const track of clip.tracks) {
    track.target.rotation[track.axis] = track.rest + (track.degrees[index] * Math.PI) / 180;
  }
  root.updateMatrixWorld(true);
  triangles = collectTriangles();
}

await mkdir(outDir, { recursive: true });
const stem = basename(glbPath).replace(/\.glb$/i, "");

// Frame-major within each direction: south0..south3, west0..west3. An engine slicing a
// row at a time gets one direction's cycle, which is the order sprite runtimes expect.
const FRAME_COUNT = clip ? clip.frames : 1;
if (FIT === "box") ORTHO = solveOrthoFit(VIEWS, FRAME_COUNT);
const cells = [];
const cellMeta = [];
for (const view of VIEWS) {
  for (let f = 0; f < FRAME_COUNT; f += 1) {
    pose(f);
    cells.push(render(view.dir));
    cellMeta.push({ view: view.tag, frame: f });
  }
}
pose(0);
const palette = PALETTE ? quantise(cells, PALETTE) : [];

const written = [];
for (let i = 0; i < cells.length; i += 1) {
  const meta = cellMeta[i];
  const suffix = clip ? `${clip.name}.${meta.view}.${String(meta.frame).padStart(2, "0")}` : meta.view;
  const file = join(outDir, `${stem}.${suffix}.png`);
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
  // One row per direction when a clip is playing, so a runtime can point at a row and
  // get that facing's cycle; a single row when the sheet is stills.
  const columns = FRAME_COUNT;
  const rows = VIEWS.length;
  const sheetWidth = CELL * columns;
  const sheetHeight = CELL * rows;
  const sheet = Buffer.alloc(sheetWidth * sheetHeight * 4);
  for (let i = 0; i < cells.length; i += 1) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    for (let y = 0; y < CELL; y += 1) {
      cells[i].copy(sheet, ((row * CELL + y) * sheetWidth + col * CELL) * 4, y * CELL * 4, (y + 1) * CELL * 4);
    }
  }
  const sheetBytes = encodePngRgba(sheetWidth, sheetHeight, sheet);
  sheetFile = join(outDir, `${stem}.sheet.png`);
  await writeFile(sheetFile, sheetBytes);
  written.push(sheetFile);

  // The manifest the local sprite-sheet auditor reads, emitted in its own schema so the
  // sheet can be inspected the moment it is written. A shape the auditor rejects would
  // leave a hand-editing step in the middle of the pipeline, which is not a pipeline.
  const sheetHash = createHash("sha256").update(sheetBytes).digest("hex");
  const state = clip ? clip.name : "idle";
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
      height: sheetHeight,
    },
    grid: {
      columns,
      rows,
      frameWidth: CELL,
      frameHeight: CELL,
      padding: { x: 0, y: 0 },
      spacing: { x: 0, y: 0 },
    },
    frames: cellMeta.map((meta, i) => ({
      id: `${state}_${meta.view}_${String(meta.frame).padStart(2, "0")}`,
      index: i,
      x: (i % columns) * CELL,
      y: Math.floor(i / columns) * CELL,
      width: CELL,
      height: CELL,
      state,
      direction: meta.view,
      // The model rests on the ground, so the sprite's contact point is where an engine
      // places it against a tile. Under --fit box this is not a convention but the
      // measured pixel the solver put the model's ground-contact point on, identical in
      // every cell of the sheet; under the sphere fit it stays the cell's bottom centre.
      anchor: FIT === "box"
        ? { x: Math.round(ORTHO.ax * 10) / 10, y: Math.round(ORTHO.ay * 10) / 10 }
        : { x: CELL / 2, y: CELL - 1 },
    })),
    // One still per direction. These are facings, not a played animation, so each is its
    // own single-frame state rather than a cycle the auditor would check for motion.
    animations: VIEWS.map((view) => ({
      id: `${state}_${view.tag}`,
      state,
      direction: view.tag,
      fps: clip?.fps ?? 1,
      loop: Boolean(clip),
      frameIds: Array.from({ length: FRAME_COUNT }, (_, f) => `${state}_${view.tag}_${String(f).padStart(2, "0")}`),
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
      frameHashes: Object.fromEntries(cellMeta.map((meta, i) => [`${state}_${meta.view}_${String(meta.frame).padStart(2, "0")}`, frameHashes[i]])),
      hasTransparentPixels: anyTransparent,
      emptyFrameIds: cellMeta.filter((_, i) => coverage[i] === 0).map((meta) => `${state}_${meta.view}_${String(meta.frame).padStart(2, "0")}`),
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
      // How the cell was framed and lit, so a later bake can be reproduced exactly and a
      // sheet cannot be compared against one shot with a different rig without noticing.
      framing: FIT === "box"
        ? {
          fit: "box",
          projection: "orthographic",
          padPx: PAD,
          supersample: SS,
          metresPerPixel: Number((1 / ORTHO.scale).toFixed(6)),
          anchorPx: { x: Number(ORTHO.ax.toFixed(3)), y: Number(ORTHO.ay.toFixed(3)) },
        }
        : { fit: "sphere", projection: "perspective", padPx: 0, supersample: SS },
      light: { ambient: AMBIENT, key: KEY_STRENGTH, keyOffset: KEY_OFFSET, fill: FILL_STRENGTH, sky: SKY_STRENGTH, cameraRelative: true },
      clip: clip ? { name: clip.name, fps: clip.fps, frames: clip.frames, tracks: clip.tracks.map((t) => ({ node: t.node, axis: t.axis, degrees: t.degrees })) } : null,
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
