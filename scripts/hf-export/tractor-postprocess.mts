/**
 * Corrections applied to the exported compact tractor, AFTER Harvest Frontier's
 * own export and WITHOUT touching the Harvest Frontier checkout.
 *
 * Every fix answers a defect measured on the file that is on sale (numbers in
 * outputs/audit/hf/hf-tractor-compact/):
 *
 *   1. THE STEER CLIP DRIVES THE FRONT TYRE THROUGH THE FENDER. The clip swings
 *      `steeringPivotwheelFrontLeft` y = 0 -> +19.19 -> -25.10 deg and
 *      `steeringPivotwheelFrontRight` y = 0 -> +25.10 -> -19.19 deg. The fender
 *      arch is authored OVERLAPPING the tyre at rest -- 148 of its vertices are
 *      inside the tyre solid at every phase -- but every one of those is on a
 *      face that points inboard or down, so at zero lock the arch reads clean.
 *      Yawing the wheel about the vertical axis through its own centre swings
 *      the tyre's leading and trailing shoulders OUTBOARD, and at full lock they
 *      come out through the fender's outboard face by up to 74.33 mm: the arch
 *      is cut into two floating islands with black lugs across the gap (see
 *      outputs/audit/hf/hf-tractor-compact/frames/steer-front-f4.png).
 *
 *      So "zero tyre/fender contact" is not reachable by any steering angle --
 *      it is already false at 0 deg by construction. The measure used here is
 *      the one the eye uses: OUTBOARD OVERSHOOT, how far the tyre pokes past
 *      the fender's outboard face inside the fender's own x/y footprint. That is
 *      0.00 mm at rest. Every steering key's yaw is scaled by one factor and the
 *      factor is binary-searched for the largest value that keeps the overshoot
 *      at 0 at both locks of both wheels. Scaling, not clamping, so the clip
 *      keeps its asymmetry and its easing.
 *
 *   2. THE STEERING WHEEL IS INSIDE THE BONNET. `tractorMesh2` (column) and
 *      `tractorMesh3` (rim) hang off the node `steeringWheel` at x = -0.18, i.e.
 *      AHEAD of the cab windshield (x -85..+5 mm) and inside `hood`
 *      (x -1820..-20 mm). Measured: tractorMesh3 353.82 mm inside hood,
 *      tractorMesh2 153.45 mm, plus 92.94 mm inside chassis and 44.84 mm inside
 *      the windshield. The NODE is moved back and up -- the direction and the
 *      distance are searched for the shortest move that leaves the assembly
 *      cutting nothing else in the tractor at any yaw the clip reaches.
 *
 *   3. THREE PARTS FLOAT. `rearFenderLeft` and `rearFenderRight` stand 36.96 mm
 *      outboard of the body with nothing between; `frontBumper` hangs 12.46 mm
 *      below it. Each node is moved along the axis the gap is on until the gap
 *      is 0 -- touching, not overlapping.
 *
 *   4. EVERY TINE BOLT IS MODELLED TWICE. `tineBolt{1..7}-1` and
 *      `tineBolt{1..7}-2` are the same 240 mm cylinder 140 mm apart, so their
 *      walls overlap by 100 mm with exactly coincident facets: 36 coplanar
 *      triangle pairs each at 0.0000 mm over 26,711 mm2, seven times over. The
 *      `-2` copy goes. The `-1` survivor is then centred on its clamp (local
 *      z -0.07 -> 0), because a lone bolt left at -0.07 stands 80 mm proud on
 *      one side of a 220 mm clamp and 60 mm short on the other.
 *
 *   5. THE DRIVE CLIP SINKS. Ground minimum: rest -2.50 mm, `drive` down to
 *      -19.29 mm, `steer` down to -8.48 mm. Measured per subtree, the tractor
 *      itself never goes below +0.67 mm -- every sub-zero reading is the
 *      cultivator implement carried on the hitch. So the IMPLEMENT is raised by
 *      its own worst dip and the tractor is left standing where it stands.
 *
 *   6. FOUR TRACKS DO NOTHING -- BUT THEY HOLD THE POSE. `pivothitchLowerLeft`,
 *      `pivothitchLowerRight`, `pivothitchTopLink` and `pivotdepthAdjust` each
 *      hold two keys with a delta of exactly 0, in `drive` only. Their constants
 *      are z = -16.617 / +16.617 / -10.885 / -13.749 deg against a rest pose of
 *      0, so simply deleting them would swing the hitch and the depth adjuster
 *      back to a pose the asset never shows. Each constant is baked into its node
 *      first, then the track goes -- and as a side effect `steer`, which never
 *      carried these tracks, now shows the hitch where `drive` shows it instead
 *      of snapping between the two.
 *
 * Note for the report: `cultivatorFrame`, `tine1..7`, `sweep1..7` and
 * `gaugeWheel*` are present in this GLB, under `implementcultivator`. They are
 * the same meshes sold separately as `hf-cultivator-compact`; that geometry is
 * deliberately left alone here beyond the ground correction above.
 *
 * Nothing else is touched: no material, no colour, no clip name, no duration and
 * no key time.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadGlb, saveGlb, node, mesh, meshes, removeNode,
  worldBox, boxGapMm, mm, triangleCount, THREE,
} from './fix-lib.mjs';
import { surface, contact, outboardOvershootMm, lowestMm, atPhase, shortestClearMove, PHASES } from './fix-contact.mjs';
import { bakeAndRemoveDeadTracks } from './fix-tracks.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const IN = process.argv[2] ?? path.join(REPO, 'examples/harvest-frontier/runtime-animated/tractor.compact.m1.glb');
const OUT = process.argv[3] ?? path.join(REPO, 'examples/harvest-frontier/runtime-animated/tractor.fixed.glb');

const loaded = await loadGlb(IN);
const scene = loaded.scene;
const clips = loaded.animations;
const report: Record<string, unknown> = { input: path.relative(REPO, IN), output: path.relative(REPO, OUT) };

// ------------------------------------- 0. dead tracks, baked before anything is measured
/*
 * This runs FIRST because it moves things. Every dead track here holds a
 * constant that is not the node's rest pose, so the constant is written into the
 * node and only then is the track dropped; see fix-tracks.mts. Doing it first
 * means every measurement below is taken on the pose the asset actually ships.
 */
report.deadTracks = bakeAndRemoveDeadTracks(scene, clips);

// ------------------------------------------------------------------ 1. steering lock
/*
 * One factor for both pivots and both directions, so the clip keeps the
 * asymmetry it was authored with. The pass condition is outboard overshoot 0.00
 * at every lock; see the header for why "no contact at all" is unreachable.
 */
const SIDES = [
  { pivot: 'steeringPivotwheelFrontLeft', wheel: 'wheelFrontLeft', fender: 'frontFenderLeft', outboard: -1 },
  { pivot: 'steeringPivotwheelFrontRight', wheel: 'wheelFrontRight', fender: 'frontFenderRight', outboard: 1 },
] as const;

/** Signed yaw of a pure-Y quaternion key, in degrees. */
const yawOf = (x: number, y: number, z: number, w: number): number => {
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(x, y, z, w), 'YXZ');
  return (e.y * 180) / Math.PI;
};

const steerTracks = clips
  .flatMap((clip) => clip.tracks.map((track) => ({ clip, track })))
  .filter(({ track }) => SIDES.some((s) => track.name === `${s.pivot}.quaternion`));

const lockBefore: Record<string, { maxDeg: number; minDeg: number }> = {};
for (const { track } of steerTracks) {
  const v = track.values as unknown as Float32Array;
  let maxDeg = -Infinity;
  let minDeg = Infinity;
  for (let i = 0; i < v.length; i += 4) {
    const d = yawOf(v[i], v[i + 1], v[i + 2], v[i + 3]);
    maxDeg = Math.max(maxDeg, d); minDeg = Math.min(minDeg, d);
  }
  const name = track.name.split('.')[0];
  lockBefore[name] = { maxDeg: +maxDeg.toFixed(2), minDeg: +minDeg.toFixed(2) };
}

/** Worst outboard overshoot, in mm, with the pivots held at `scale` x their lock. */
function overshootAt(scale: number): number {
  let worst = 0;
  for (const side of SIDES) {
    const pivot = node(scene, side.pivot);
    for (const deg of [lockBefore[side.pivot].maxDeg, lockBefore[side.pivot].minDeg]) {
      pivot.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (deg * scale * Math.PI) / 180);
      scene.updateMatrixWorld(true);
      worst = Math.max(worst, outboardOvershootMm(
        surface(node(scene, side.wheel)),
        surface(node(scene, side.fender)),
        side.outboard,
      ));
    }
    pivot.quaternion.identity();
  }
  scene.updateMatrixWorld(true);
  return worst;
}

const overshootBefore = overshootAt(1);
let lo = 0;
let hi = 1;
if (overshootBefore > 0) {
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (overshootAt(mid) <= 0) lo = mid; else hi = mid;
  }
}
/*
 * A half-percent under the searched limit. The search tests the key extremes;
 * the quaternion interpolation between keys can graze a hundredth of a
 * millimetre past them, and a clean zero is worth 0.06 deg of lock.
 */
const STEER_SCALE = overshootBefore > 0 ? Math.floor(lo * 0.995 * 10000) / 10000 : 1;

for (const { track } of steerTracks) {
  const v = track.values as unknown as Float32Array;
  const q = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < v.length; i += 4) {
    const deg = yawOf(v[i], v[i + 1], v[i + 2], v[i + 3]) * STEER_SCALE;
    q.setFromAxisAngle(axis, (deg * Math.PI) / 180);
    v[i] = q.x; v[i + 1] = q.y; v[i + 2] = q.z; v[i + 3] = q.w;
  }
}
report.steeringLock = {
  criterion: 'outboard overshoot of the front tyre past the fender outboard face, inside the fender footprint',
  overshootBeforeMm: overshootBefore,
  overshootAfterMm: overshootAt(STEER_SCALE),
  scale: STEER_SCALE,
  perPivotDeg: Object.fromEntries(Object.entries(lockBefore).map(([k, v]) => [k, {
    before: v, after: { maxDeg: +(v.maxDeg * STEER_SCALE).toFixed(2), minDeg: +(v.minDeg * STEER_SCALE).toFixed(2) },
  }])),
  cabSteeringWheelLeftAtDeg: 39.19,
  note: 'the cab steering wheel keeps its +/-39.19 deg; against a 12.48 deg road-wheel lock that is a 3.1:1 steering ratio, which is closer to a real tractor than the 1.56:1 it had',
};

// ------------------------------------------------------- 2. steering wheel out of the bonnet
/*
 * The shortest move that clears everything, searched over direction as well as
 * distance: a pure lift would have to clear the whole 720 mm bonnet, a pure
 * shove back has to clear the windshield, and the cheapest answer is usually
 * neither. Clearance is checked at the yaw extremes the clip reaches, because
 * the rim sweeps as it turns.
 */
const steeringWheel = node(scene, 'steeringWheel');
const swMeshes = new Set(meshes(steeringWheel));
const obstacles = meshes(scene).filter((m) => !swMeshes.has(m) && !/collider|proxy|runtimeOnly|socketMarker|socketattach/i.test(m.name));
const SW_YAWS = [-39.19, -20, 0, 20, 39.19];

function steeringWheelCuts(): { pairs: number; names: string[] } {
  let pairs = 0;
  const names = new Set<string>();
  for (const yaw of SW_YAWS) {
    steeringWheel.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (yaw * Math.PI) / 180);
    scene.updateMatrixWorld(true);
    const A = surface(steeringWheel);
    for (const m of obstacles) {
      const c = contact(A, surface(m));
      if (c.pairs) { pairs += c.pairs; names.add(m.name); }
    }
  }
  steeringWheel.quaternion.identity();
  scene.updateMatrixWorld(true);
  return { pairs, names: [...names] };
}

const swHome = steeringWheel.position.clone();
const cutsBefore = steeringWheelCuts();
/*
 * The clear window is not reachable by walking outward along a ray: at 200 mm
 * back the assembly is deeper into the rear deck than it was at 0, and only
 * above 400 mm of lift does the column's foot leave the chassis and deck. So the
 * search is an exhaustive grid over (back, up), coarse then fine, and it takes
 * the smallest vector that clears -- not the first one it meets.
 */
const swPoses = SW_YAWS.map((yaw) => {
  steeringWheel.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (yaw * Math.PI) / 180);
  scene.updateMatrixWorld(true);
  return surface(steeringWheel);
});
steeringWheel.quaternion.identity();
scene.updateMatrixWorld(true);
const obstacleTris = obstacles.flatMap((m) => surface(m));
const best = shortestClearMove(swPoses, obstacleTris, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), 1.0, 0.8);
if (!best) throw new Error('no back-and-up move clears the steering wheel');
// A hair of margin so float rounding in the exporter cannot re-open the contact.
const SW_MOVE = best.offset.clone().multiplyScalar(1 + 0.002 / best.offset.length());
steeringWheel.position.copy(swHome).add(SW_MOVE);
scene.updateMatrixWorld(true);
const cutsAfter = steeringWheelCuts();
report.steeringWheel = {
  movedNode: 'steeringWheel',
  backMm: mm(SW_MOVE.x), upMm: mm(SW_MOVE.y), totalMm: mm(SW_MOVE.length()),
  positionBefore: swHome.toArray().map((v) => mm(v)),
  positionAfter: steeringWheel.position.toArray().map((v) => mm(v)),
  cutTrianglePairsBefore: cutsBefore.pairs, cutPartsBefore: cutsBefore.names,
  cutTrianglePairsAfter: cutsAfter.pairs, cutPartsAfter: cutsAfter.names,
  auditDepthBeforeMm: { 'tractorMesh3 in hood': 353.82, 'tractorMesh2 in hood': 153.45, 'tractorMesh2 in chassis': 92.94, 'tractorMesh3 in cabWindshield': 44.84 },
};

// ----------------------------------------------------------------- 3. seat the floating parts
const FLOATERS = ['rearFenderLeft', 'rearFenderRight', 'frontBumper'] as const;
const seated: Record<string, unknown> = {};
for (const name of FLOATERS) {
  const target = mesh(scene, name);
  const others = meshes(scene).filter((m) => m !== target && !/collider|proxy|runtimeOnly|socketMarker|socketattach/i.test(m.name));
  // The audit's floating test skips instanced meshes; count them, because the
  // lugs of an instanced tyre are geometry a buyer sees.
  let nearest: { name: string; axis: 0 | 1 | 2; delta: number; gap: number } | null = null;
  const tb = worldBox(target);
  for (const other of others) {
    const ob = worldBox(other);
    const per: number[] = [
      Math.max(0, tb.min.x - ob.max.x, ob.min.x - tb.max.x),
      Math.max(0, tb.min.y - ob.max.y, ob.min.y - tb.max.y),
      Math.max(0, tb.min.z - ob.max.z, ob.min.z - tb.max.z),
    ];
    const gap = Math.hypot(...per);
    if (gap === 0) continue;                                    // already touching
    if (nearest && gap >= nearest.gap) continue;
    const axis = per.indexOf(Math.max(...per)) as 0 | 1 | 2;
    const key = (['x', 'y', 'z'] as const)[axis];
    const delta = ob.min[key] > tb.max[key] ? per[axis] : -per[axis];
    nearest = { name: other.name, axis, delta, gap };
  }
  const before = nearest ? mm(nearest.gap) : 0;
  if (nearest) {
    const axisKey = (['x', 'y', 'z'] as const)[nearest.axis];
    target.position[axisKey] += nearest.delta;
    scene.updateMatrixWorld(true);
  }
  const after = nearest ? boxGapMm(target, mesh(scene, nearest.name)) : 0;
  seated[name] = {
    nearestNeighbour: nearest?.name ?? null,
    axis: nearest ? (['x', 'y', 'z'] as const)[nearest.axis] : null,
    movedMm: nearest ? mm(nearest.delta) : 0,
    gapBeforeMm: before, gapAfterMm: after,
  };
}
report.seatedFloatingParts = seated;

// -------------------------------------------------------------- 4. the duplicated tine bolts
let boltTriangles = 0;
const boltsRemoved: string[] = [];
const boltsCentred: string[] = [];
for (let i = 1; i <= 7; i += 1) {
  boltTriangles += removeNode(scene, `tineBolt${i}-2`);
  boltsRemoved.push(`tineBolt${i}-2`);
  const survivor = node(scene, `tineBolt${i}-1`);
  survivor.position.z = 0;                                       // centre it on its clamp
  boltsCentred.push(`tineBolt${i}-1`);
}
scene.updateMatrixWorld(true);
report.duplicateBolts = {
  removed: boltsRemoved, trianglesRemoved: boltTriangles,
  recentred: boltsCentred, recentredByMm: 70,
  coplanarPairsBefore: '7 x 36 triangle pairs at 0.0000 mm over 26,711 mm2 each',
};

// ------------------------------------------------------------------------ 5. ground contact
const implement = node(scene, 'implementcultivator');
const tractorRoot = node(scene, 'tractorRoot');
function worstGround(): { whole: number; tractorOnly: number; implement: number } {
  let whole = Infinity;
  let tractorOnly = Infinity;
  let impl = Infinity;
  for (const clip of clips) {
    for (const phase of PHASES) {
      const done = atPhase(scene, clip, phase);
      impl = Math.min(impl, lowestMm(implement));
      const parent = implement.parent!;
      parent.remove(implement);
      tractorOnly = Math.min(tractorOnly, lowestMm(tractorRoot));
      parent.add(implement);
      scene.updateMatrixWorld(true);
      whole = Math.min(whole, lowestMm(tractorRoot));
      done();
    }
  }
  scene.updateMatrixWorld(true);
  return { whole, tractorOnly, implement: impl };
}
const groundBefore = worstGround();
implement.position.y -= groundBefore.implement / 1000;
scene.updateMatrixWorld(true);
const groundAfter = worstGround();
report.ground = {
  movedNode: 'implementcultivator', raisedMm: -groundBefore.implement,
  worstMinYmmBefore: groundBefore, worstMinYmmAfter: groundAfter,
  note: 'the tractor itself never dips below +0.67 mm; every sub-zero reading in the audit is the cultivator implement on the hitch, so only the implement moves',
};

// ------------------------------------------------------------------ implement provenance
report.sharedGeometryNote = {
  meshes: ['cultivatorFrame', 'cultivatorToolbar', 'toolbarCrossRail1..4', 'cultivatorWingLeft/Right', 'tine1..7', 'sweep1..7', 'gaugeWheelLeft*', 'gaugeWheelRight*'],
  statement: 'these are present inside tractor.compact.m1.glb under implementcultivator and are the same meshes sold separately as hf-cultivator-compact; their shape is untouched here',
};

// --------------------------------------------------------------------------------- write
report.triangles = { after: triangleCount(scene) };
await saveGlb(OUT, loaded);
fs.writeFileSync(OUT.replace(/\.glb$/, '.report.json'), JSON.stringify(report, null, 2));
process.stdout.write(`${path.relative(REPO, OUT)}\n${JSON.stringify(report, null, 2)}\n`);
