/**
 * Offline preview renderer for the Cozy Farm Set.
 *
 * The generation rail is deliberately headless and texture-free, and this repository has no
 * GPU, no browser and no render dependency. But an asset that has never been looked at is not
 * an asset that has been reviewed — the triangle count says nothing about whether a part floats,
 * whether two materials collapse into one value, or whether the silhouette still reads small.
 *
 * So this is a z-buffered software rasteriser built on nothing but node:zlib. It loads the
 * SHIPPED GLB (not the factory) through GLTFLoader.parse, flat-shades it the way the style bible
 * describes the lighting — warm key, cool sky fill, soft ambient — and writes PNGs:
 *
 *   <name>.view-<n>.png     three-quarter, rear-quarter and side views at full size
 *   <name>.silhouette.png   pure black on white at 96 px, the 10-metre readability check
 *
 * Usage: node preview.mjs <asset.glb> <output-directory>
 */
import { readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { deflateSync } from "node:zlib";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const [glbPath, outDir] = process.argv.slice(2);
if (!glbPath || !outDir) {
  process.stderr.write("Usage: preview.mjs <asset.glb> <output-directory>\n");
  process.exit(1);
}

// --- PNG ---------------------------------------------------------------------------------
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

function encodePng(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Scene -------------------------------------------------------------------------------
const buffer = await readFile(resolve(glbPath));
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
const gltf = await new Promise((ok, fail) => new GLTFLoader().parse(arrayBuffer, "", ok, fail));
const root = gltf.scene;
root.updateMatrixWorld(true);

/** Flattens the scene into world-space triangles carrying their material's display colour. */
const triangles = [];
const a = new THREE.Vector3();
const b = new THREE.Vector3();
const c = new THREE.Vector3();
root.traverse((node) => {
  if (!node.isMesh) return;
  const position = node.geometry.attributes.position;
  const index = node.geometry.index;
  const count = index ? index.count : position.count;
  const colour = node.material.color.getHex(THREE.SRGBColorSpace);
  const rgb = [((colour >> 16) & 255) / 255, ((colour >> 8) & 255) / 255, (colour & 255) / 255];
  for (let i = 0; i < count; i += 3) {
    const i0 = index ? index.getX(i) : i;
    const i1 = index ? index.getX(i + 1) : i + 1;
    const i2 = index ? index.getX(i + 2) : i + 2;
    a.fromBufferAttribute(position, i0).applyMatrix4(node.matrixWorld);
    b.fromBufferAttribute(position, i1).applyMatrix4(node.matrixWorld);
    c.fromBufferAttribute(position, i2).applyMatrix4(node.matrixWorld);
    triangles.push({ a: a.clone(), b: b.clone(), c: c.clone(), rgb });
  }
});

const box = new THREE.Box3().setFromObject(root);
const centre = box.getCenter(new THREE.Vector3());
const radius = box.getSize(new THREE.Vector3()).length() / 2;

// --- Rasteriser --------------------------------------------------------------------------
const KEY_DIR = new THREE.Vector3(0.52, 0.74, 0.42).normalize(); // warm sun, high and to the right
const KEY = [1.0, 0.94, 0.84];
const SKY = [0.62, 0.72, 0.82]; // cool hemisphere fill from above
const AMBIENT = 0.2;

function render({ width, height, dir, background, silhouette }) {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i += 1) {
    pixels[i * 3] = background[0];
    pixels[i * 3 + 1] = background[1];
    pixels[i * 3 + 2] = background[2];
  }
  const depth = new Float64Array(width * height).fill(Infinity);

  const eye = new THREE.Vector3(...dir).normalize().multiplyScalar(radius * 3.1).add(centre);
  const forward = new THREE.Vector3().subVectors(centre, eye).normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  const focal = 1 / Math.tan((30 * Math.PI) / 360);
  const v = new THREE.Vector3();

  const project = (point) => {
    v.subVectors(point, eye);
    const z = -v.dot(forward); // camera looks down -Z
    if (z > -0.01) return null;
    return { x: ((focal * v.dot(right)) / -z * 0.5 + 0.5) * width, y: (1 - ((focal * v.dot(up)) / -z * 0.5 + 0.5)) * height, z: -z };
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

    let shade = [0, 0, 0];
    if (!silhouette) {
      // Flat shading from the world-space face normal: exactly the read a low-poly asset
      // gets in engine, and the honest test of whether the facets separate on their own.
      ab.subVectors(tri.b, tri.a);
      ac.subVectors(tri.c, tri.a);
      normal.crossVectors(ab, ac).normalize();
      if (normal.dot(new THREE.Vector3().subVectors(eye, tri.a)) < 0) normal.negate();
      const key = Math.max(0, normal.dot(KEY_DIR)) * 0.82;
      const sky = (normal.y * 0.5 + 0.5) * 0.34;
      shade = tri.rgb.map((channel, i) => channel * (AMBIENT + key * KEY[i] + sky * SKY[i]));
    }

    const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x)));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
    const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        // Edge functions normalised by the signed area, so an interior pixel yields three
        // non-negative weights for either winding order (nothing here is back-face culled —
        // the depth buffer decides, which is also how a missing interior face shows up).
        const w0 = ((p1.x - px) * (p2.y - py) - (p2.x - px) * (p1.y - py)) / area;
        const w1 = ((p2.x - px) * (p0.y - py) - (p0.x - px) * (p2.y - py)) / area;
        const w2 = ((p0.x - px) * (p1.y - py) - (p1.x - px) * (p0.y - py)) / area;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * p0.z + w1 * p1.z + w2 * p2.z;
        const offset = y * width + x;
        if (z >= depth[offset]) continue;
        depth[offset] = z;
        for (let channel = 0; channel < 3; channel += 1) {
          pixels[offset * 3 + channel] = silhouette
            ? 24
            : Math.round(Math.min(1, Math.max(0, shade[channel])) ** (1 / 1.05) * 255);
        }
      }
    }
  }
  return { pixels, width, height };
}

const stem = basename(glbPath).replace(/\.glb$/i, "");
const VIEWS = [
  { tag: "view-1-three-quarter", dir: [0.78, 0.5, 0.92] },
  { tag: "view-2-rear-quarter", dir: [-0.85, 0.42, -0.78] },
  { tag: "view-3-side", dir: [1.0, 0.22, 0.06] },
];

const written = [];
for (const view of VIEWS) {
  const frame = render({ width: 760, height: 760, dir: view.dir, background: [236, 234, 228], silhouette: false });
  const file = join(outDir, `${stem}.${view.tag}.png`);
  await writeFile(file, encodePng(frame.width, frame.height, frame.pixels));
  written.push(file);
}
const small = render({ width: 96, height: 96, dir: VIEWS[0].dir, background: [255, 255, 255], silhouette: true });
const silhouetteFile = join(outDir, `${stem}.silhouette.png`);
await writeFile(silhouetteFile, encodePng(small.width, small.height, small.pixels));
written.push(silhouetteFile);

process.stdout.write(`${JSON.stringify({ glb: glbPath, triangles: triangles.length, written }, null, 2)}\n`);
