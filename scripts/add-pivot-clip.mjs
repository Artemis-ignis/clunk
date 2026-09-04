#!/usr/bin/env node
/**
 * Writes a named rotation clip onto a hinge node of a GLB that already ships,
 * without re-exporting the model.
 *
 * Why it exists: `cozy-fence-gate` was sold as a 3D file with a documented
 * hinge (`gate_pivot`) and, separately, as an 8-frame open/close sprite sheet
 * baked by turning that hinge. The GLB itself carried ZERO animation clips, so
 * a buyer who paid for the 3D gate got a gate that could not open, while the
 * buyer of the 64 px sheet got the motion. Re-exporting the model through
 * three.js to add the clip would have rewritten every byte of a file whose
 * geometry nobody has any reason to touch; this reads the shipped glTF, appends
 * an animation to it, and writes it back with the meshes untouched.
 *
 * The keys are not invented. They are the same numbers the product page's own
 * viewer plays (app/api/_lib/listing-variants.ts LISTING_CLIPS) and the same
 * ones the sprite baker turned the hinge with: 8 frames at 8 fps, 0 -> -90 -> 0
 * degrees about +Y, plus the wrap key at 1.000 s so the cycle closes.
 *
 * `--shrink <mesh>:<factor>` scales one mesh's vertices radially about their
 * own X/Z centroid. One use, and it is a measured one: the gate's two hinge
 * PINS are vertical cylinders whose outermost facet stops 1.1436 mm short of
 * the outer face of the PINTLE they sit in, parallel to it and facing the same
 * way -- 32 cm2 of same-facing coplanar overlap on the one face of the hinge a
 * buyer can actually see. Thinning the pin puts that facet back inside the
 * pintle, where nothing can see it.
 *
 *   node scripts/add-pivot-clip.mjs <in.glb> <out.glb> --node gate_pivot \
 *        --clip swing --axis y --fps 8 --degrees 0,-22,-48,-74,-90,-74,-48,-22 --wrap
 */
import { NodeIO } from "@gltf-transform/core";
import {
  EXTMeshoptCompression,
  KHRMaterialsClearcoat,
  KHRMaterialsEmissiveStrength,
  KHRMaterialsIOR,
  KHRMaterialsSpecular,
  KHRMaterialsTransmission,
  KHRMaterialsUnlit,
  KHRMaterialsVolume,
  KHRMeshQuantization,
} from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { statSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const [input, output] = args.filter((value) => !value.startsWith("--") && !args[args.indexOf(value) - 1]?.startsWith("--"));
const NODE = flag("node", "gate_pivot");
const CLIP = flag("clip", "swing");
const AXIS = flag("axis", "y");
const FPS = Number(flag("fps", 8));
const DEGREES = flag("degrees", "0,-22,-48,-74,-90,-74,-48,-22").split(",").map(Number);
const WRAP = args.includes("--wrap");
const SHIFT = flag("axis-shift", null)?.split(",").map(Number) ?? null;
const SHRINK = flag("shrink", null);

if (!input || !output) {
  process.stderr.write("usage: add-pivot-clip.mjs <in.glb> <out.glb> [--node N] [--clip C] [--axis y] [--fps 8] [--degrees ...] [--wrap]\n");
  process.exit(1);
}

/** Axis-angle to the flat [x, y, z, w] a rotation sampler stores. */
function quaternion(axis, degrees) {
  const radians = (degrees * Math.PI) / 360; // half angle
  const s = Math.sin(radians);
  const c = Math.cos(radians);
  return [axis === "x" ? s : 0, axis === "y" ? s : 0, axis === "z" ? s : 0, c];
}

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions([
    EXTMeshoptCompression, KHRMaterialsClearcoat, KHRMaterialsEmissiveStrength, KHRMaterialsIOR,
    KHRMaterialsSpecular, KHRMaterialsTransmission, KHRMaterialsUnlit, KHRMaterialsVolume, KHRMeshQuantization,
  ])
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

const document = await io.read(input);
const root = document.getRoot();
const target = root.listNodes().find((node) => node.getName() === NODE);
if (!target) throw new Error(`node "${NODE}" is not in ${input}`);
if (root.listAnimations().some((animation) => animation.getName() === CLIP)) {
  throw new Error(`${input} already carries a clip called "${CLIP}"`);
}

let shrunk = null;
if (SHRINK) {
  const [meshName, factorText] = SHRINK.split(":");
  const factor = Number(factorText);
  const holder = root.listNodes().find((node) => node.getName() === meshName);
  const mesh = holder?.getMesh();
  if (!mesh) throw new Error(`mesh node "${meshName}" is not in ${input}`);
  const before = [];
  const after = [];
  for (const primitive of mesh.listPrimitives()) {
    const accessor = primitive.getAttribute("POSITION");
    const array = accessor.getArray();
    let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
    for (let i = 0; i < array.length; i += 3) {
      minX = Math.min(minX, array[i]); maxX = Math.max(maxX, array[i]);
      minZ = Math.min(minZ, array[i + 2]); maxZ = Math.max(maxZ, array[i + 2]);
    }
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    before.push([Math.round(minX * 10000) / 10, Math.round(maxX * 10000) / 10]);
    for (let i = 0; i < array.length; i += 3) {
      array[i] = cx + (array[i] - cx) * factor;
      array[i + 2] = cz + (array[i + 2] - cz) * factor;
    }
    accessor.setArray(array);
    let lo = Infinity; let hi = -Infinity;
    for (let i = 0; i < array.length; i += 3) { lo = Math.min(lo, array[i]); hi = Math.max(hi, array[i]); }
    after.push([Math.round(lo * 10000) / 10, Math.round(hi * 10000) / 10]);
  }
  shrunk = { mesh: meshName, factor, xRangeBeforeMm: before, xRangeAfterMm: after };
}

let shifted = null;
if (SHIFT) {
  const before = target.getTranslation().slice();
  target.setTranslation([before[0] + SHIFT[0], before[1] + SHIFT[1], before[2] + SHIFT[2]]);
  const children = target.listChildren();
  for (const child of children) {
    const t = child.getTranslation();
    child.setTranslation([t[0] - SHIFT[0], t[1] - SHIFT[1], t[2] - SHIFT[2]]);
  }
  shifted = { node: NODE, shiftMm: SHIFT.map((v) => Math.round(v * 10000) / 10), childrenCompensated: children.map((c) => c.getName()) };
}

const frames = WRAP ? [...DEGREES, DEGREES[0]] : DEGREES;
const times = frames.map((_, index) => index / FPS);
const values = frames.flatMap((degrees) => quaternion(AXIS, degrees));

const buffer = root.listBuffers()[0] ?? document.createBuffer();
const input_ = document.createAccessor(`${CLIP}-input`).setArray(new Float32Array(times)).setType("SCALAR").setBuffer(buffer);
const output_ = document.createAccessor(`${CLIP}-output`).setArray(new Float32Array(values)).setType("VEC4").setBuffer(buffer);
const sampler = document.createAnimationSampler().setInput(input_).setOutput(output_).setInterpolation("LINEAR");
const channel = document.createAnimationChannel().setTargetNode(target).setTargetPath("rotation").setSampler(sampler);
document.createAnimation(CLIP).addSampler(sampler).addChannel(channel);

await io.write(output, document);
process.stdout.write(`${JSON.stringify({
  input, output,
  node: NODE, clip: CLIP, axis: AXIS, fps: FPS,
  keys: frames.length,
  seconds: Number(times[times.length - 1].toFixed(3)),
  degrees: frames,
  axisShift: shifted,
  shrink: shrunk,
  bytesBefore: statSync(input).size,
  bytesAfter: statSync(output).size,
}, null, 2)}\n`);
