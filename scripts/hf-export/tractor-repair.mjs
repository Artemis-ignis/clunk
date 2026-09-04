/**
 * hf-tractor-compact — 2026-09-03 repair pass.
 *
 * Measured on the file that was on sale
 * (public/market/hf-tractor-compact/tractor.compact.m1.glb):
 *
 *   1. THE FRONT WHEELS ARE INSIDE THE TRACTOR. `tread -> hood`, `tread ->
 *      chassis` and `tread -> frontFenderLeft` all measure 0.0 mm surface
 *      distance at every one of 24 phases of both clips. The cause is
 *      geometric, not a stray part:
 *        - the front wheel's lug radius is 669 mm about an axle at y = 670, so
 *          the tyre's crown reaches y = 1339, and the hood starts at y = 1230
 *          and the chassis at y = 910;
 *        - the chassis is a 3.60 x 0.34 x 1.82 m slab, and the front wheels sit
 *          at z = +-780 with a half width of 184 mm, so 314 mm of each front
 *          wheel is buried in it — and the REAR wheels (z +-880, half width
 *          248) are buried in it too;
 *        - under `steer` the front wheels turn +-22 deg about their own centre,
 *          which sweeps their inner face a further 145-213 mm towards the
 *          centreline, so no amount of narrowing the chassis alone is enough
 *          while the wheel crown is above the chassis floor.
 *      Two changes, both of them the machine's real proportions rather than a
 *      nudge: the chassis and rear deck are narrowed to +-600 mm so the rear
 *      wheels clear them, and the front wheels are scaled to 0.665 (890 mm
 *      diameter against the rear's 1718 mm, the ratio a compact tractor has)
 *      with the axle dropped to match, which puts the whole front wheel below
 *      the chassis floor at every steering angle.
 *
 *   2. THE STEPS ARE INSIDE THE REAR TYRES. `entryStepLeft/Right` (x 100-800,
 *      y 520-640) sit inside the rear wheel disc, which spans x 78-1702 at that
 *      height. Moved forward into the gap between the axles.
 *
 *   3. 182 MESHES = 182 DRAW CALLS for 58,312 drawn triangles, eleven of them
 *      invisible collider / socket-marker proxies. Proxies deleted (socket
 *      nodes kept), the rest merged per (animated node, material).
 *
 *   4. THE TINES ON THE MOUNTED CULTIVATOR SWING +-2 deg — the same dead motion
 *      the standalone cultivator had. Same fix: the pivot is raised into its
 *      clamp and the swing becomes 0 -> +8 deg, three cycles per `drive`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  THREE, loadGlb, saveGlb, meshes, node, worldBox, exactBox, mm, drawnTris, matOf, boxGeo, colourOf, addMesh,
  mergeByAnchor, pruneEmpty, dropHiddenProxies, bakeInstances, unshareGeometry, quatTrack, setTrack,
} from './machine-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const IN = process.argv[2] ?? path.join(REPO, 'public/market/hf-tractor-compact/tractor.compact.m1.glb');
const OUT = process.argv[3] ?? path.join(REPO, 'examples/harvest-frontier/runtime-animated/tractor.repaired.glb');

const gltf = await loadGlb(IN);
const scene = gltf.scene;
const clips = gltf.animations;
const drive = clips.find((c) => c.name === 'drive');
if (!drive) throw new Error('the `drive` clip is gone');
const report = { input: path.relative(REPO, IN), output: path.relative(REPO, OUT) };
report.before = { meshes: meshes(scene).length, drawnTriangles: drawnTris(scene), groundMinYmm: mm(exactBox(scene).min.y) };
const sizeZ = (name) => mm(worldBox(node(scene, name)).getSize(new THREE.Vector3()).z);

/* ------------------------------------------------------- 1. the frame is a frame */
const frame = [];
for (const [name, half] of [['chassis', 0.600], ['rearDeck', 0.600]]) {
  const m = node(scene, name);
  const was = worldBox(m).getSize(new THREE.Vector3()).z / 2;
  m.scale.z *= half / was;   // *= : the packaged meshes carry a KHR_mesh_quantization scale on the node
  scene.updateMatrixWorld(true);
  frame.push({ part: name, halfWidthMmBefore: mm(was), halfWidthMmAfter: sizeZ(name) / 2 });
}
report.frameWidth = { why: 'the rear wheels (inner face z = -656 mm) were buried in a 1.82 m wide slab', parts: frame };

/* --------------------------------------------------------- 2. the front wheels */
const WHEEL_SCALE = 0.665;
const wheelReport = [];
for (const side of ['Left', 'Right']) {
  const wheel = node(scene, `wheelFront${side}`);
  const before = worldBox(wheel);
  wheel.scale.setScalar(WHEEL_SCALE);
  scene.updateMatrixWorld(true);
  // seat the (now smaller) wheel back on the ground
  const radius = exactBox(wheel).getSize(new THREE.Vector3()).y / 2;
  wheel.position.y = radius;
  scene.updateMatrixWorld(true);
  const after = exactBox(wheel);
  wheelReport.push({
    node: wheel.name, scale: WHEEL_SCALE,
    diameterMmBefore: mm(before.getSize(new THREE.Vector3()).y),
    diameterMmAfter: mm(after.getSize(new THREE.Vector3()).y),
    crownYmmAfter: mm(after.max.y), axleYmm: mm(radius), bottomYmm: mm(after.min.y),
  });
}
const rearDiameter = mm(exactBox(node(scene, 'wheelRearLeft')).getSize(new THREE.Vector3()).y);
report.frontWheels = {
  why: 'the crown sat 429 mm above the chassis floor and 109 mm above the hood floor',
  wheels: wheelReport,
  rearDiameterMm: rearDiameter,
  frontToRearRatio: +(wheelReport[0].diameterMmAfter / rearDiameter).toFixed(3),
  chassisFloorYmm: mm(worldBox(node(scene, 'chassis')).min.y),
};
/* the axle beam follows the hubs down and out */
{
  const axle = node(scene, 'frontAxle');
  const before = worldBox(axle);
  axle.position.y = wheelReport[0].axleYmm / 1000;
  /* 650 mm reaches 13 mm into the hub (z 637-923) and stops 10 mm short of the
     tyre's inner face (z -660), so the beam ends inside the wheel it carries
     without crossing the tread. */
  axle.scale.z *= 0.650 / (before.getSize(new THREE.Vector3()).z / 2);
  scene.updateMatrixWorld(true);
  report.frontAxle = { yMmBefore: mm(before.getCenter(new THREE.Vector3()).y), yMmAfter: mm(worldBox(axle).getCenter(new THREE.Vector3()).y), halfWidthMmAfter: sizeZ('frontAxle') / 2 };
}

/* ----------------------------------------------------------------- 3. the steps */
const steps = [];
for (const side of ['Left', 'Right']) {
  const step = node(scene, `entryStep${side}`);
  const before = worldBox(step).getCenter(new THREE.Vector3()).x;
  step.position.x = -0.370;
  scene.updateMatrixWorld(true);
  steps.push({ part: step.name, xMmBefore: mm(before), xMmAfter: mm(worldBox(step).getCenter(new THREE.Vector3()).x) });
}
/* The steps never had anything holding them up — inside the tyre nobody could
   tell. Out in the open they need the bracket a real one hangs from, so each
   gets an arm welded under the (now narrower) chassis and a drop to the tread. */
const stepMetal = matOf(node(scene, 'entryStepLeft'));
const stepColour = colourOf(node(scene, 'entryStepLeft'));
const stepRoot = node(scene, 'tractorRoot');
for (const [side, sign] of [['Left', -1], ['Right', 1]]) {
  const arm = addMesh(stepRoot, boxGeo(0.100, 0.075, 0.400, stepColour), stepMetal, `entryStepArm${side}`,
    [-0.470, 0.885, sign * 0.760]);
  const drop = addMesh(stepRoot, boxGeo(0.100, 0.250, 0.080, stepColour), stepMetal, `entryStepHanger${side}`,
    [-0.470, 0.745, sign * 0.920]);
  void arm; void drop;
}
report.entrySteps = {
  why: 'they sat inside the rear tyre, which spans x 78-1702 mm at step height',
  parts: steps,
  bracketAdded: ['entryStepArmLeft/Right (under the chassis edge)', 'entryStepHangerLeft/Right (down to the tread)'],
};

/* ------------------------------------------------- 4. the mounted cultivator tines */
const PIVOT_RAISE = 0.34;
const LIFT = THREE.MathUtils.degToRad(8);
const KEYS = 61;
const times = Array.from({ length: KEYS }, (_, i) => (i / (KEYS - 1)) * drive.duration);
const tines = [];
for (let t = 1; t <= 7; t += 1) {
  const name = `pivottine${String(t).padStart(2, '0')}`;
  const pivot = node(scene, name);
  const child = pivot.children.find((c) => c.name.startsWith('tine'));
  pivot.position.y += PIVOT_RAISE;
  child.position.y -= PIVOT_RAISE;
  const phase = ((t - 1) / 7) * Math.PI * 2;
  setTrack(drive, name, 'quaternion', quatTrack(name, times, times.map((time) => {
    const u = (time / drive.duration) * 3 * Math.PI * 2 + phase;
    return [0, 0, ((1 - Math.cos(u)) / 2) * LIFT];
  })));
  tines.push(name);
}
scene.updateMatrixWorld(true);
report.tines = { wasDegrees: '+-2', nowDegrees: '0 .. +8', cyclesPerClip: 3, pivotRaisedMm: mm(PIVOT_RAISE), nodes: tines };

/* -------------------------------------------------------- 5. invisible proxies out */
report.hiddenProxies = dropHiddenProxies(scene);

/* ---------------------------------------------------------------- 6. ground contact */
const root = node(scene, 'tractorRoot');
const beforeGround = exactBox(scene).min.y;
root.position.y -= beforeGround;
scene.updateMatrixWorld(true);
report.ground = { beforeMm: mm(beforeGround), afterMm: mm(exactBox(scene).min.y) };

/* -------------------------------------------------------------------- 7. draw calls */
/* SKIP_MERGE=1 leaves every part under its authored name, for gate runs that need to say WHICH part touched which. */
if (!process.env.SKIP_MERGE) {
report.bakedInstances = bakeInstances(scene);
report.merge = mergeByAnchor(scene, clips);
report.unsharedGeometries = unshareGeometry(scene);
report.prunedEmptyNodes = pruneEmpty(scene, clips);
}

report.after = { meshes: meshes(scene).length, drawnTriangles: drawnTris(scene), groundMinYmm: mm(exactBox(scene).min.y) };
await saveGlb(OUT, scene, clips);
fs.writeFileSync(OUT.replace(/\.glb$/, '.report.json'), JSON.stringify(report, null, 2));
process.stdout.write(`${path.relative(REPO, OUT)}\n  meshes ${report.before.meshes} -> ${report.after.meshes}   drawnTriangles ${report.before.drawnTriangles} -> ${report.after.drawnTriangles}   ground ${report.before.groundMinYmm} -> ${report.after.groundMinYmm} mm\n`);
