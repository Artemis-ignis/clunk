/**
 * hf-cultivator-compact — 2026-09-03 repair pass.
 *
 * Measured on the file that was on sale
 * (public/market/hf-cultivator-compact/cultivator.compact.m1.glb):
 *
 *   1. THE `work` CLIP DOES NOT SHOW WORK. `pivottine01..07.quaternion` swings
 *      +-2 deg (0.028 in the quaternion z component). The gauge wheels turn
 *      exactly three whole revolutions over the 1.627 s clip, so eight evenly
 *      spaced frames land on the same wheel angle every time and the eight
 *      frames are pixel-identical. Replaced with a 0 -> +8 deg lift and fall of
 *      each tine, three cycles per clip, each tine a seventh of a cycle behind
 *      the one before, so the rank ripples instead of standing still. Rest pose
 *      stays the DEEPEST point, so the clip only ever lifts the tines out of
 *      the soil and the ground gate is not broken by the animation.
 *
 *   2. 104 MESHES = 104 DRAW CALLS. Nine of them are invisible collider and
 *      socket-marker proxies (opacity 0). Those are deleted; the socket nodes
 *      themselves stay, so attach points are unchanged. The rest are merged per
 *      (animated node, material), which never merges two things that can move
 *      apart.
 *
 *   3. THE MACHINE FLOATS 19.3 mm. The root is dropped so the sweep tips touch.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  THREE, loadGlb, saveGlb, meshes, node, worldBox, mm, mergeByAnchor, pruneEmpty, bakeInstances, unshareGeometry,
  dropHiddenProxies, exactBox, quatTrack, setTrack, drawnTris,
} from './machine-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const IN = process.argv[2] ?? path.join(REPO, 'public/market/hf-cultivator-compact/cultivator.compact.m1.glb');
const OUT = process.argv[3] ?? path.join(REPO, 'examples/harvest-frontier/runtime-animated/cultivator.repaired.glb');

const gltf = await loadGlb(IN);
const scene = gltf.scene;
const clips = gltf.animations;
const report = { input: path.relative(REPO, IN), output: path.relative(REPO, OUT) };
report.before = { meshes: meshes(scene).length, drawnTriangles: drawnTris(scene), groundMinYmm: mm(exactBox(scene).min.y) };

/* ------------------------------------------------- 1. the work clip actually works */
const work = clips.find((c) => c.name === 'work');
if (!work) throw new Error('the `work` clip is gone');

/*
 * The tine pivots were authored 340 mm BELOW the clamp that holds the shank, so
 * any real swing dragged the clamp sideways through the toolbar it is bolted to.
 * Each pivot is raised into its own clamp and its child lowered by the same
 * amount, which leaves the rest pose bit-identical and moves only the centre of
 * rotation — after which the shank swings in its clamp the way a spring tine does.
 */
const PIVOT_RAISE = 0.34;
const pivotRaise = [];
for (let t = 1; t <= 7; t += 1) {
  const pivot = node(scene, `pivottine${String(t).padStart(2, '0')}`);
  const child = pivot.children.find((c) => c.name.startsWith('tine'));
  const before = worldBox(pivot).clone();
  pivot.position.y += PIVOT_RAISE;
  child.position.y -= PIVOT_RAISE;
  scene.updateMatrixWorld(true);
  const after = worldBox(pivot);
  pivotRaise.push({ node: pivot.name, raisedMm: mm(PIVOT_RAISE), restPoseShiftMm: mm(after.min.distanceTo(before.min)) });
}
report.tinePivotRaise = { why: 'the pivot sat 340 mm below the clamp, so a visible swing dragged the clamp through the toolbar', pivots: pivotRaise };

const TINES = 7;
const CYCLES = 3;
const LIFT = THREE.MathUtils.degToRad(8);
const KEYS = 61;
const times = Array.from({ length: KEYS }, (_, i) => (i / (KEYS - 1)) * work.duration);
const tineMotion = [];
for (let t = 1; t <= TINES; t += 1) {
  const name = `pivottine${String(t).padStart(2, '0')}`;
  const phase = ((t - 1) / TINES) * Math.PI * 2;
  const eulers = times.map((time) => {
    const u = (time / work.duration) * CYCLES * Math.PI * 2 + phase;
    // 0 at the bottom, LIFT at the top: (1 - cos)/2 keeps the rest pose the deepest.
    return [0, 0, ((1 - Math.cos(u)) / 2) * LIFT];
  });
  setTrack(work, name, 'quaternion', quatTrack(name, times, eulers));
  tineMotion.push({ node: name, degrees: [0, +(LIFT * 180 / Math.PI).toFixed(2)], cyclesPerClip: CYCLES, phaseOffsetTurns: +((t - 1) / TINES).toFixed(3) });
}
report.tineLift = {
  wasDegrees: '+-2 (quaternion z delta 0.028)',
  nowDegrees: `0 .. +${(LIFT * 180 / Math.PI).toFixed(1)}`,
  cyclesPerClip: CYCLES,
  keysPerTrack: KEYS,
  tines: tineMotion,
};

/* --------------------------------------------------------- 2. invisible proxies out */
report.hiddenProxies = dropHiddenProxies(scene);

/*
 * The gauge wheels were authored exactly as wide as the gap in their forks, so
 * the tyre's two side faces were coplanar with the fork's inner faces at 0.0 mm
 * — 4,056 cm2 of the file's z-fighting total. Each wheel is narrowed to 94 % of
 * its width about its own axle, which puts 3.6 mm of air on each side.
 */
for (const name of ['gaugeWheelLeft', 'gaugeWheelRight']) {
  const wheel = node(scene, name);
  const before = worldBox(wheel).getSize(new THREE.Vector3()).z;
  wheel.scale.z = 0.94;
  scene.updateMatrixWorld(true);
  report.gaugeWheelWidth = report.gaugeWheelWidth ?? [];
  report.gaugeWheelWidth.push({ node: name, widthMmBefore: mm(before), widthMmAfter: mm(worldBox(wheel).getSize(new THREE.Vector3()).z) });
}

/* ---------------------------------------------------------------- 3. ground contact */
const root = node(scene, 'cultivatorRoot');
const beforeGround = exactBox(scene).min.y;
root.position.y -= beforeGround;
scene.updateMatrixWorld(true);
report.ground = { beforeMm: mm(beforeGround), afterMm: mm(exactBox(scene).min.y) };

/* ------------------------------------------------------------------- 4. draw calls */
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
