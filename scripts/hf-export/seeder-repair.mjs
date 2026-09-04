/**
 * hf-seeder-compact — 2026-09-03 repair pass.
 *
 * Measured on the file that was on sale
 * (public/market/hf-seeder-compact/seeder.compact.m1.glb):
 *
 *   1. 410 MESHES = 410 DRAW CALLS, the worst number in the whole catalogue,
 *      for 51,602 triangles. Four identical row units of 32 parts each, four
 *      hoppers of 9, and 24 opener-disc parts. Merged per (animated node,
 *      material): every node the `sow` clip drives keeps its own mesh, and only
 *      parts that are rigidly bolted to the same moving thing are welded.
 *
 *   2. THE `sow` CLIP MOVES ONLY WHAT IS ROUND. Every one of its 24 tracks is
 *      the same rotation: opener discs, gauge wheels, closing wheels and seed
 *      meter shafts all spin about their own axles. Spinning bodies of
 *      revolution with no texture on them look still, and the machine itself —
 *      frame, row units, hoppers — does not move at all. Two things are added:
 *        - `pivotrowUnit01..04` float on their parallel links, 0 to +8 deg,
 *          two cycles per clip, each row a quarter-cycle behind the one in
 *          front, which is how a planter rides a contour. Rest pose stays the
 *          LOWEST point so the clip only ever lifts the openers out of the
 *          furrow and the ground gate is unaffected.
 *        - a mechanical agitator drive on the outboard face of each hopper
 *          (`hopperAgitatorPivot01..04`): a pulley with a dark crank arm,
 *          turning four times per clip. The seed meter shafts it drives were
 *          already animated but sit inside the meter housing where nothing can
 *          see them.
 *
 *   3. THE OPENERS SIT 13.6 mm UNDER THE GROUND at rest. The root is raised.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  THREE, loadGlb, saveGlb, meshes, node, worldBox, exactBox, mm, matOf, drawnTris,
  mergeByAnchor, pruneEmpty, dropHiddenProxies, bakeInstances, unshareGeometry, boxGeo, cylGeo, colourOf, addMesh,
  quatTrack, setTrack,
} from './machine-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const IN = process.argv[2] ?? path.join(REPO, 'public/market/hf-seeder-compact/seeder.compact.m1.glb');
const OUT = process.argv[3] ?? path.join(REPO, 'examples/harvest-frontier/runtime-animated/seeder.repaired.glb');

const gltf = await loadGlb(IN);
const scene = gltf.scene;
const clips = gltf.animations;
const sow = clips.find((c) => c.name === 'sow');
if (!sow) throw new Error('the `sow` clip is gone');
const report = { input: path.relative(REPO, IN), output: path.relative(REPO, OUT) };
report.before = { meshes: meshes(scene).length, drawnTriangles: drawnTris(scene), groundMinYmm: mm(exactBox(scene).min.y) };

report.hiddenProxies = dropHiddenProxies(scene);

/*
 * The 258 cm2 of same-facing coplanar overlap the audit measured is all one
 * thing, repeated eight times: each closing wheel's hub face sits 1.92 mm from
 * the face of the arm that carries it, inside the 2 mm the z-fight check calls
 * coplanar. Each wheel is moved 5 mm further out along its arm, which is 5 mm on
 * a 346 mm wheel and takes the gap to 6.9 mm.
 */
const closing = [];
for (let r = 1; r <= 4; r += 1) {
  for (const side of ['Left', 'Right']) {
    const pivot = node(scene, `pivotclosingWheel${String(r).padStart(2, '0')}${side}`);
    const was = mm(worldBox(pivot).min.x);
    pivot.position.x += 0.005;
    scene.updateMatrixWorld(true);
    closing.push({ node: pivot.name, xMmBefore: was, xMmAfter: mm(worldBox(pivot).min.x) });
  }
}
report.closingWheelGap = { movedMm: 5, wheels: closing };

/*
 * The remaining z-fight risk the audit measured is the seed hose lying flat
 * against the bracket behind it: 0.04 mm of separation over 15.7 cm2 per row.
 * Each hose is lifted 4 mm off that face along the face's own normal.
 */
const HOSE_N = new THREE.Vector3(-0.399, -0.280, 0.873).normalize();
const HOSE_MM = Number(process.env.HOSE_MM ?? 4);
const hoses = [];
for (let r = 1; r <= 4; r += 1) {
  const hose = node(scene, `rowHose0${r}`);
  hose.position.addScaledVector(HOSE_N, HOSE_MM / 1000);
  hoses.push(hose.name);
}
scene.updateMatrixWorld(true);
report.seedHoseLift = { alongNormal: HOSE_N.toArray().map((v) => +v.toFixed(3)), millimetres: HOSE_MM, hoses };


const KEYS = 65;
const times = Array.from({ length: KEYS }, (_, i) => (i / (KEYS - 1)) * sow.duration);

/* ------------------------------------------------------- 1. the row units ride */
const LIFT = THREE.MathUtils.degToRad(8);
const ROW_CYCLES = 2;
const rowMotion = [];
for (let r = 1; r <= 4; r += 1) {
  const name = `pivotrowUnit${String(r).padStart(2, '0')}`;
  const pivot = node(scene, name);
  const phase = ((r - 1) / 4) * Math.PI * 2;
  const eulers = times.map((t) => {
    const u = (t / sow.duration) * ROW_CYCLES * Math.PI * 2 + phase;
    return [0, 0, ((1 - Math.cos(u)) / 2) * LIFT];
  });
  setTrack(sow, name, 'quaternion', quatTrack(name, times, eulers));
  rowMotion.push({ node: name, restQuaternionZ: +pivot.quaternion.z.toFixed(5), degrees: [0, 8], phaseOffsetTurns: (r - 1) / 4 });
}
report.rowUnitFloat = { cyclesPerClip: ROW_CYCLES, rows: rowMotion };

/* --------------------------------------------- 2. a hopper agitator you can see */
const agitators = [];
for (let h = 1; h <= 4; h += 1) {
  const hopper = node(scene, `hopper${String(h).padStart(2, '0')}`);
  const body = node(scene, `hopperBody${String(h).padStart(2, '0')}`);
  const bolt = node(scene, `hopperBolt0${h}-1`);
  const metal = matOf(bolt);
  const bodyBox = worldBox(body);
  const wall = bodyBox.max.x;                       // the outboard face, the one the hero camera sees
  const centreZ = (bodyBox.min.z + bodyBox.max.z) / 2;
  const centreY = bodyBox.min.y + (bodyBox.max.y - bodyBox.min.y) * 0.55;
  const pivot = new THREE.Object3D();
  pivot.name = `hopperAgitatorPivot${String(h).padStart(2, '0')}`;
  hopper.add(pivot);
  pivot.position.copy(hopper.worldToLocal(new THREE.Vector3(wall + 0.045, centreY, centreZ)));
  hopper.updateMatrixWorld(true);

  const pulley = cylGeo(0.110, 0.110, 0.042, 16, colourOf(bolt));
  pulley.rotateZ(Math.PI / 2);                       // axle along x
  addMesh(pivot, pulley, metal, `hopperAgitatorPulley${String(h).padStart(2, '0')}`, [0, 0, 0]);
  const dark = colourOf(bolt).clone().multiplyScalar(0.32);
  addMesh(pivot, boxGeo(0.052, 0.196, 0.046, dark), metal, `hopperAgitatorCrank${String(h).padStart(2, '0')}`, [0.030, 0.052, 0]);
  addMesh(pivot, cylGeo(0.020, 0.020, 0.070, 10, dark).rotateZ(Math.PI / 2), metal, `hopperAgitatorPin${String(h).padStart(2, '0')}`, [0.055, 0.138, 0]);

  setTrack(sow, pivot.name, 'quaternion', quatTrack(pivot.name, times,
    times.map((t) => [(t / sow.duration) * 4 * Math.PI * 2, 0, 0])));
  agitators.push({ node: pivot.name, atMm: [mm(wall + 0.045), mm(centreY), mm(centreZ)], turnsPerClip: 4 });
}
report.hopperAgitator = {
  why: 'the seed meter shafts the clip already drives are inside the meter housing; from outside no hopper moved',
  drives: agitators,
};
scene.updateMatrixWorld(true);

/* ------------------------------------------------------------- 3. ground contact */
const root = node(scene, 'seederRoot');
const beforeGround = exactBox(scene).min.y;
root.position.y -= beforeGround;
scene.updateMatrixWorld(true);
report.ground = { beforeMm: mm(beforeGround), afterMm: mm(exactBox(scene).min.y) };

/* ------------------------------------------------------------------ 4. draw calls */
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
