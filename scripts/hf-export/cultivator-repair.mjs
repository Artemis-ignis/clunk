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
 *
 * 2026-09-05 penetration pass. The inspector's new GEO-PART-PENETRATION rule read the file
 * this pass had just put on sale and found one crossing left in it:
 *
 *   4. THE RIGHT DEPTH WHEEL WAS STILL IN TINE 7'S LANE. `gaugeWheelRight_rubber` crosses
 *      `sweep7` — a 148.8 x 77 x 10.2 mm overlap box, 21 triangle pairs actually intersecting.
 *      The left one is clear by 21.8 mm, so it is not the drop or the fork: it is where the
 *      pass before this one chose to put them. It measured a lane between two whole tine
 *      BOXES (141.4 mm) that is 0.4 mm wider than the wheel (141.0), let that through on a
 *      12 mm slack, moved each wheel 14.7 mm off that centre to make the pair symmetric, and
 *      then bolted the spokes on afterwards, adding 3.3 mm to each side of a wheel the
 *      placement had already measured. Step 2a is re-cut: the spokes go on first and the
 *      distance is searched on a 5 mm grid by triangle-to-triangle clearance, with the
 *      direction decided for the pair. Left 145 mm inboard (26.7 mm clear), right 175 mm
 *      (15.2 mm), the two carriers 100 and 70 mm off the nearest tine.
 *
 * THE THREE COMMANDS THAT REBUILD THE FILE ON SALE (verified byte-for-byte against the
 * delivered file before this pass changed it, 2026-09-05):
 *
 *   node scripts/hf-export/cultivator-repair.mjs examples/harvest-frontier/runtime-animated/cultivator.compact.m1.glb
 *   node scripts/hf-export/package-machine-glb.mjs examples/harvest-frontier/runtime-animated/cultivator.repaired.glb
 *   node tmp/hf-speed/finish.mjs examples/harvest-frontier/runtime-animated/cultivator.repaired.m1.glb public/market/hf-cultivator-compact/cultivator.compact.m1.glb
 *
 * The default IN below is the file in the shop, which was true the first time this pass ran
 * and has not been since: the shop holds this pass's own output now, whose `cultivatorFrame`
 * and the rest are merged into `body_metal`. Pass the packaged export as argv[2], as above.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  THREE, loadGlb, saveGlb, meshes, node, worldBox, mm, mergeByAnchor, pruneEmpty, bakeInstances, unshareGeometry,
  dropHiddenProxies, exactBox, quatTrack, setTrack, drawnTris, radiusAbout,
  wheelSymmetryDeg, retimeClip, solveGroundLoop,
  matOf, colourOf, addMesh, boxGeo, boxSpan,
} from './machine-lib.mjs';
import { soupDist } from './glb-surgery.mjs';

/* The floor a wheel rolls on is its lug circle, not the box of its rest pose. */
const rollingFloor = [];

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
/* 2026-09-05. The 2026-09-03 pass raised the pivot 340 mm on the reasoning that the clamp
 * is the hinge. It overshot: the clamp BOLT — the round part a buyer reads as the hinge —
 * has its centre at y 832, and a 340 mm raise put the rotation centre at 1077, a full
 * 245 mm above the only pin in the picture. Measured off `tineBolt<n>-1` and moved onto it,
 * so the shank turns about the pin that is drawn. */
const pivotRaise = [];
let pivotRaiseMm = 0;
for (let t = 1; t <= 7; t += 1) {
  const pivot = node(scene, `pivottine${String(t).padStart(2, '0')}`);
  const child = pivot.children.find((c) => c.name.startsWith('tine'));
  const bolt = exactBox(node(scene, `tineBolt${t}-1`)).getCenter(new THREE.Vector3());
  const was = new THREE.Vector3().setFromMatrixPosition(pivot.matrixWorld);
  const raise = bolt.y - was.y;
  pivot.position.y += raise;
  child.position.y -= raise;
  scene.updateMatrixWorld(true);
  pivotRaiseMm = mm(raise);
  pivotRaise.push({
    node: pivot.name, boltCentreYmm: mm(bolt.y), pivotWasYmm: mm(was.y), pivotNowYmm: mm(bolt.y), raisedMm: mm(raise),
  });
}
report.tinePivotRaise = {
  why: 'the visible hinge is the clamp bolt at y 832; the 2026-09-03 pass put the rotation centre 245 mm above it, so the shank swung about a point that is not drawn',
  pivots: pivotRaise,
};

const TINES = 7;
const CYCLES = 3;
const KEYS = 61;
const times = Array.from({ length: KEYS }, (_, i) => (i / (KEYS - 1)) * work.duration);

/* How far the shank may swing before the sweep leaves the soil.
 *
 * The sweep tip is 894 mm AHEAD of the clamp bolt and only 832 mm below it, so the lever is
 * almost horizontal and one degree of swing lifts the tip about 13 mm. The 2026-09-03 pass
 * used 8 degrees, which is 105 mm of daylight under a blade whose job is to be in the
 * ground. The angle is solved here against the tip itself rather than assumed: swing the
 * real geometry and keep the largest angle whose highest tip stays inside the 20 mm ground
 * band the audit asks for. */
const GROUND_BAND = 0.020;
function tipRiseAt(angle) {
  const probe = node(scene, 'pivottine01');
  const keep = probe.quaternion.clone();
  probe.quaternion.setFromEuler(new THREE.Euler(0, 0, angle, 'XYZ'));
  scene.updateMatrixWorld(true);
  const y = exactBox(node(scene, 'sweep01')).min.y;
  probe.quaternion.copy(keep);
  scene.updateMatrixWorld(true);
  return y;
}
const restTip = tipRiseAt(0);
let loA = 0; let hiA = THREE.MathUtils.degToRad(8);
for (let i = 0; i < 40; i += 1) {
  const mid = (loA + hiA) / 2;
  if (tipRiseAt(mid) - restTip <= GROUND_BAND) loA = mid; else hiA = mid;
}
const LIFT = loA;

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
  why: 'a spring tine flexes about its clamp bolt; with the tip 894 mm out on the lever, 8 degrees of that is 105 mm of air under the blade',
  wasDegrees: '0 .. +8 about a pivot 245 mm above the bolt',
  nowDegrees: `0 .. +${(LIFT * 180 / Math.PI).toFixed(2)} about the bolt`,
  tipRiseMm: mm(tipRiseAt(LIFT) - restTip),
  groundBandMm: mm(GROUND_BAND),
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

/* ================================================ 2026-09-05 gauge wheel + toolbar pass */

/* ------------------------------- 2c. the toolbar was bolted to nothing */
{
  const toolbar = exactBox(node(scene, 'cultivatorToolbar'));
  const rail = exactBox(node(scene, 'toolbarCrossRail2'));
  const frame = node(scene, 'toolbar');
  const metal = matOf(node(scene, 'cultivatorToolbar'));
  const colour = colourOf(node(scene, 'cultivatorToolbar'));
  const risers = [];
  for (const z of [-1.300, -0.650, 0, 0.650, 1.300]) {
    const name = `toolbarRiser${z < 0 ? 'L' : (z > 0 ? 'R' : 'C')}${Math.round(Math.abs(z) * 1000)}`;
    boxSpan(frame, metal, colour,
      [Math.max(toolbar.min.x, rail.min.x) + 0.010, rail.max.y - 0.010, z - 0.060],
      [Math.min(toolbar.max.x, rail.max.x) - 0.010, toolbar.min.y + 0.012, z + 0.060],
      name);
    risers.push(name);
  }
  scene.updateMatrixWorld(true);
  report.toolbarRisers = {
    why: 'the 2.72 m toolbar floated 39.9 mm over the cross rails and read as a part attached to nothing',
    gapMm: mm(toolbar.min.y - rail.max.y),
    risers,
  };
}

/* ---------------------------------------------------------------- 3. ground contact */
const root = node(scene, 'cultivatorRoot');
const beforeGround = Math.min(exactBox(scene).min.y, ...rollingFloor);
root.position.y -= beforeGround;
scene.updateMatrixWorld(true);
report.ground = { beforeMm: mm(beforeGround), afterMm: mm(exactBox(scene).min.y) };

/* ------------------ 2b. a smooth wheel turning looks like one standing still */
{
  const spoked = [];
  for (const side of ['Left', 'Right']) {
    const wheel = node(scene, `gaugeWheel${side}`);
    const tyre = meshes(wheel).reduce((a, b) => (exactBox(b).getSize(new THREE.Vector3()).y > exactBox(a).getSize(new THREE.Vector3()).y ? b : a));
    const box = exactBox(wheel);
    const radius = (box.max.y - box.min.y) / 2;
    const width = box.max.z - box.min.z;
    const dark = colourOf(tyre).clone().multiplyScalar(0.30);
    for (let i = 0; i < 3; i += 1) {
      const angle = (i / 3) * Math.PI * 2;
      const m = addMesh(wheel, boxGeo(radius * 0.86, 0.034, width + 0.016, dark), matOf(tyre), `gaugeWheel${side}Spoke${i + 1}`, [0, 0, 0]);
      m.position.set(Math.cos(angle) * radius * 0.45, Math.sin(angle) * radius * 0.45, 0);
      m.rotation.z = angle;
    }
    spoked.push({ wheel: `gaugeWheel${side}`, spokes: 3, colour: `#${dark.getHexString()}` });
  }
  scene.updateMatrixWorld(true);
  report.wheelSpokes = { why: 'the only round thing that moves on this machine had no feature to follow', wheels: spoked };
}

/* ------- 2a. the depth wheels run on the ground, in the lane the clearance is measured in */
/* Measured on the packaged export: `gaugeWheelLeft/Right` hang with their lowest vertex at
 * y 102.5 mm — the wheel that sets working depth was 102 mm above the ground it sets that
 * depth against. Dropping it alone is not enough: at ground level it cuts straight through
 * sweep1 / sweep7. So each wheel is dropped until its own largest radius touches, and then
 * moved sideways into the lane between two tine ranks. The fork and the two supports follow
 * it, and the supports' lower ends are stretched down to the new axle so the wheel stays
 * carried.
 *
 * 2026-09-05, second cut. The pass before this one chose the lane from the tines' own boxes
 * and then put BOTH wheels on the mean of the two |z| values, so that the machine would be
 * symmetric. Its own report recorded what that cost: -14.9 mm of box overlap on each side.
 * The inspector's new GEO-PART-PENETRATION rule then measured the right-hand one at the
 * triangles and found it real — `gaugeWheelRight_rubber` through `sweep7`, a 148.8 × 77 ×
 * 10.2 mm overlap box and 21 crossing triangle pairs. Three things were wrong with it:
 *
 *   - the lane it measured is the gap between two whole tine BOXES, 141.4 mm wide, and the
 *     wheel is 141.0 mm wide: 0.2 mm a side even at the lane's own centre, and the `- 0.012`
 *     slack in the width test let that count as clear;
 *   - the mean then moved each wheel 14.7 mm off that centre, which is 14.5 mm more than the
 *     lane had;
 *   - and the spokes went on AFTER the placement, adding 3.3 mm to each side of the wheel
 *     that the placement never saw.
 *
 * All three are one mistake: a distance was reasoned about instead of measured. This pass
 * measures. The spokes go on before the search (2b runs first now), and the offset is chosen
 * on a 5 mm grid by the triangle-to-triangle clearance the wheel actually has there —
 * `soupDist`, the same search the tractor's implement uses — with the smallest move winning
 * among offsets that measure the same. On this file the right wheel's best lane position
 * measures 15.2 mm of daylight and the left's 26.7 mm, and the two are NOT at mirrored |z|:
 * every sweep is bolted 25.2 mm to one side of its own shank, so the clear lane is displaced
 * the same way on both sides of the machine. Forcing the pair onto one |z| costs half of it —
 * the best mirrored placement measures 7.3 mm. The asymmetry that leaves is reported.
 *
 * Outboard of the last tine there is far more room, 101 mm, and it is not reachable: the two
 * supports that carry each wheel reach z 1265 and the machine's own end plate stops at 1580,
 * so any offset big enough to clear sweep7 that way hangs the supports off the end of the
 * frame. The search is capped at the machine's own half width, and that cap is measured on
 * the parts that do not move rather than written down. */
{
  const GRID_MM = 5;
  const REACH_MM = 300;
  const CAP = 0.120;                    // 120 mm: past that a part is not in this wheel's way
  const SIDES = [['Left', -1], ['Right', 1]];
  const CARRIERS = ['fork', 'supportFront', 'supportRear'];

  /** Every triangle of a subtree, in world space. */
  const worldTris = (object) => {
    object.updateMatrixWorld(true);
    const out = [];
    object.traverse((n) => {
      if (!n.isMesh) return;
      const position = n.geometry.getAttribute('position');
      const index = n.geometry.getIndex();
      const count = index ? index.count : position.count;
      const vertex = new THREE.Vector3();
      for (let i = 0; i < count; i += 3) {
        const triangle = [];
        for (let k = 0; k < 3; k += 1) {
          const v = index ? index.getX(i + k) : i + k;
          triangle.push(vertex.fromBufferAttribute(position, v).applyMatrix4(n.matrixWorld).toArray());
        }
        out.push(triangle);
      }
    });
    return out;
  };
  const triLo = (t, i) => Math.min(t[0][i], t[1][i], t[2][i]);
  const triHi = (t, i) => Math.max(t[0][i], t[1][i], t[2][i]);
  const soupBox = (tris) => ({
    lo: [0, 1, 2].map((i) => Math.min(...tris.map((t) => triLo(t, i)))),
    hi: [0, 1, 2].map((i) => Math.max(...tris.map((t) => triHi(t, i)))),
  });
  /* how far from the centreline a triangle soup reaches. An empty soup reaches nowhere: the
     collider proxies were deleted in step 2 and their marker nodes are still here, carrying
     no geometry at all. */
  const halfSpan = (tris) => {
    if (!tris.length) return 0;
    const b = soupBox(tris);
    return Math.max(Math.abs(b.lo[2]), Math.abs(b.hi[2]));
  };

  const partsOf = (side) => [
    node(scene, `pivotgaugeWheel${side}`),
    ...CARRIERS.map((c) => scene.getObjectByName(`gaugeWheel${side}${c}`)),
    scene.getObjectByName(`collidergaugeWheel${side}`),
  ].filter(Boolean);

  /* Both wheels move, so neither is an obstacle for the other. */
  const movingMeshes = new Set();
  for (const [side] of SIDES) for (const part of partsOf(side)) part.traverse((n) => { if (n.isMesh) movingMeshes.add(n); });

  /* The machine's own width, measured on the parts that do NOT move: nothing that moves here
     may end up outside it, or this fix would widen what is on sale. */
  let machineHalfZ = 0;
  const named = [];
  for (const m of meshes(scene)) {
    if (movingMeshes.has(m)) continue;
    const tris = worldTris(m);
    if (!tris.length) continue;
    machineHalfZ = Math.max(machineHalfZ, halfSpan(tris));
    named.push({ name: m.name, tris });
  }

  /* 1. down first: the drop does not depend on z, and the search wants the wheel at the height
        it will ship at. */
  const dropped = {};
  for (const [side] of SIDES) {
    const wheel = node(scene, `gaugeWheel${side}`);
    const bottomWasMm = mm(exactBox(wheel).min.y);
    const axleWorld = new THREE.Vector3().setFromMatrixPosition(wheel.matrixWorld);
    const radius = radiusAbout(wheel, axleWorld, [0, 0, 1]);
    const deltaY = -(axleWorld.y - radius);
    for (const name of [`pivotgaugeWheel${side}`, `collidergaugeWheel${side}`, `gaugeWheel${side}fork`]) {
      const part = scene.getObjectByName(name);
      if (part) part.position.y += deltaY;
    }
    for (const name of [`gaugeWheel${side}supportFront`, `gaugeWheel${side}supportRear`]) {
      const part = node(scene, name);
      const box = exactBox(part);
      const height = box.max.y - box.min.y;
      part.scale.y *= (height - deltaY) / height;
      scene.updateMatrixWorld(true);
      part.position.y += box.max.y - exactBox(part).max.y;
    }
    scene.updateMatrixWorld(true);
    dropped[side] = { deltaY, radius, bottomWasMm };
  }

  /* 2. then sideways, by measurement.
   *
   * Both wheels have to end up in the SAME lane — a machine with one depth wheel between two
   * shanks and the other hanging off the far end of the frame is not a machine. So the
   * direction is decided for the pair before either wheel moves: each side is scanned inboard
   * and outboard, and the direction each side can offer is scored by the side that offers
   * less. Measured on this file, inboard scores 15.2 mm and outboard 10.2 — the right-hand
   * wheel does have 47.2 mm out past sweep7, but its opposite number does not: sweep1 reaches
   * 50 mm further out than sweep7 does, and by the time the left wheel would clear it the
   * wheel is outside the machine's own 1580 mm half width. Inboard wins on the measurement,
   * and inside that direction each side then takes its own best distance. */
  const measure = {};
  for (const [side, sign] of SIDES) {
    const pivot = node(scene, `pivotgaugeWheel${side}`);
    const parts = partsOf(side);
    const wheelTris = worldTris(pivot);
    const window = soupBox(wheelTris);
    /* The move is purely sideways, so only what shares this wheel's x and y window can ever be
       in the way. Filtering once, per triangle, is what makes a 5 mm grid affordable. */
    const inWindow = [];
    for (const other of named) {
      const kept = other.tris.filter((t) => triHi(t, 0) >= window.lo[0] - CAP && triLo(t, 0) <= window.hi[0] + CAP
        && triHi(t, 1) >= window.lo[1] - CAP && triLo(t, 1) <= window.hi[1] + CAP);
      if (kept.length) inWindow.push({ name: other.name, tris: kept });
    }
    const obstacles = inWindow.flatMap((o) => o.tris);
    /* how far this side may still travel outward before the wheel, its fork or a support
       leaves the machine */
    const outwardRoomMm = mm(machineHalfZ - Math.max(...parts.map((p) => halfSpan(worldTris(p)))));

    /* `inboard` is positive towards the centreline on BOTH sides, so the two profiles can be
       compared to each other. Distances nearest to where the wheel already stands come first,
       so the smallest move wins among distances that measure the same. */
    const scan = [];
    for (let i = 0; i <= REACH_MM; i += GRID_MM) {
      for (const inboard of i === 0 ? [0] : [i, -i]) {
        const dz = (-sign * inboard) / 1000;
        if (-inboard > outwardRoomMm) { scan.push({ inboardMm: inboard, clearanceMm: null, why: 'the wheel or a support would be outside the machine' }); continue; }
        const moved = wheelTris.map((t) => t.map((p) => [p[0], p[1], p[2] + dz]));
        scan.push({ inboardMm: inboard, clearanceMm: mm(soupDist(moved, obstacles, CAP)) });
      }
    }
    const bestIn = scan.filter((s) => s.clearanceMm !== null && s.inboardMm > 0).reduce((a, b) => (b.clearanceMm > a.clearanceMm ? b : a), { clearanceMm: -1 });
    const bestOut = scan.filter((s) => s.clearanceMm !== null && s.inboardMm < 0).reduce((a, b) => (b.clearanceMm > a.clearanceMm ? b : a), { clearanceMm: -1 });
    measure[side] = { pivot, parts, wheelTris, inWindow, obstacles, window, outwardRoomMm, scan, bestIn, bestOut };
  }

  const inboardScore = Math.min(measure.Left.bestIn.clearanceMm, measure.Right.bestIn.clearanceMm);
  const outboardScore = Math.min(measure.Left.bestOut.clearanceMm, measure.Right.bestOut.clearanceMm);
  const direction = inboardScore >= outboardScore ? 'inboard' : 'outboard';

  const wheels = [];
  for (const [side, sign] of SIDES) {
    const m = measure[side];
    const pivot = m.pivot;
    const parts = m.parts;
    const wheel = node(scene, `gaugeWheel${side}`);
    const carriers = parts.filter((p) => p !== pivot);
    const nearest = (tris, limit = 6) => m.inWindow
      .map((o) => ({ part: o.name, gapMm: mm(soupDist(tris, o.tris, CAP)) }))
      .filter((r) => r.gapMm < mm(CAP))
      .sort((a, b) => a.gapMm - b.gapMm)
      .slice(0, limit);

    const chosen = direction === 'inboard' ? m.bestIn : m.bestOut;
    if (!chosen || chosen.clearanceMm < 5) {
      throw new Error(`pivotgaugeWheel${side}: no ${direction} distance within ${REACH_MM} mm gives 5 mm of daylight (best ${chosen?.clearanceMm} mm)`);
    }
    const before = { wheelZmm: [mm(m.window.lo[2]), mm(m.window.hi[2])], nearest: nearest(m.wheelTris) };
    for (const part of parts) part.position.z += (-sign * chosen.inboardMm) / 1000;
    scene.updateMatrixWorld(true);

    const afterWheel = worldTris(pivot);
    const afterCarriers = carriers.flatMap((p) => worldTris(p));
    const afterBox = soupBox(afterWheel);
    const axleAfter = new THREE.Vector3().setFromMatrixPosition(wheel.matrixWorld);
    rollingFloor.push(axleAfter.y - dropped[side].radius);
    const tineTris = m.inWindow.filter((o) => /^(pivottine|tine|sweep)/i.test(o.name)).flatMap((o) => o.tris);
    wheels.push({
      node: pivot.name,
      moved: parts.map((p) => p.name),
      bottomWasMm: dropped[side].bottomWasMm,
      bottomNowMm: mm(exactBox(wheel).min.y),
      droppedMm: mm(-dropped[side].deltaY),
      movedInboardMm: chosen.inboardMm,
      radiusMm: mm(dropped[side].radius),
      wheelWidthMm: mm(afterBox.hi[2] - afterBox.lo[2]),
      axleZmm: mm(axleAfter.z),
      wheelZmm: [mm(afterBox.lo[2]), mm(afterBox.hi[2])],
      before,
      surfaceClearanceMm: chosen.clearanceMm,
      tineAndSweepClearanceMm: mm(soupDist(afterWheel, tineTris, CAP)),
      carrierToTineClearanceMm: mm(soupDist(afterCarriers, tineTris, CAP)),
      nearest: nearest(afterWheel),
      bestInboardMm: m.bestIn.clearanceMm,
      bestOutboardMm: m.bestOut.clearanceMm,
      roomToMachineEdgeMm: mm(machineHalfZ - Math.max(...parts.map((p) => halfSpan(worldTris(p))))),
      scan: m.scan,
    });
  }
  report.gaugeWheels = {
    why: 'the part that sets working depth ran 102.5 mm clear of the ground, and at ground level it cut through sweep1 and sweep7',
    placedBy: `soupDist on a ${GRID_MM} mm grid over +-${REACH_MM} mm, capped by the machine's own half width`,
    machineHalfZmm: mm(machineHalfZ),
    direction,
    directionScoreMm: { inboard: inboardScore, outboard: outboardScore },
    wheels,
    axleAsymmetryMm: +Math.abs(Math.abs(wheels[0].axleZmm) - Math.abs(wheels[1].axleZmm)).toFixed(1),
    note: 'the two wheels do not sit on one |z|: every sweep is bolted 25.2 mm to one side of its own shank, so the clear lane is displaced the same way on both sides of the machine and a mirrored pair puts one wheel in a blade. Measured here, the best mirrored placement leaves 7.3 mm; letting each side take its own lane centre leaves 26.7 and 15.2 and moves the pair 30 mm apart in |z|.',
  };
}

/* ---------------------- 3a. the gauge wheels roll at a real ground speed (2026-09-05) */
/* Two passes ago this clip turned the wheels 2,880 deg over 1.627 s — eight WHOLE turns, so
 * eight evenly spaced frames of the clip landed on the same wheel angle and the render saw
 * eight identical pictures. The pass after it re-cut the angle to the ground speed the same
 * gauge wheel has on hf-tractor-compact, 7.487 m/s. That number was itself 27 km/h: the
 * tractor was wrong too.
 *
 * A cultivator works at 7-10 km/h. This one is re-cut to 8.5 km/h (2.361 m/s), and because
 * the wheel carries three spokes it repeats only every 120 deg — 521 mm of ground per step —
 * the clip length is what gives: the distance is picked from the ones the wheel can land on
 * (`solveGroundLoop`) and the length follows from it, so the speed asked for is the speed
 * delivered exactly. The rest of the clip is stretched onto the new length by `retimeClip`.
 *
 * The tine swing goes with it. A spring tine flexes over the ground it is dragged through,
 * not over the clock, so the swing keeps its cycles per metre of travel — as near as whole
 * cycles allow, because a fraction of a cycle would leave the last frame off the first. */
{
  const TARGET_MS = 8.5 / 3.6;                    // 8.5 km/h
  const WAS_TARGET_MS = 7.487;                    // what the pass before this one matched
  const rolled = {};
  const wheels = ['gaugeWheelLeft', 'gaugeWheelRight'];
  const wheelData = {};
  for (const name of wheels) {
    const wheel = node(scene, name);
    wheelData[name] = {
      radiusM: new THREE.Vector3().setFromMatrixPosition(wheel.matrixWorld).y,
      stepDeg: wheelSymmetryDeg(wheel, [0, 0, 1]),
    };
  }
  /* what the file on sale carries, by the rule that built it */
  const wasIdeal = ((WAS_TARGET_MS * work.duration) / wheelData.gaugeWheelLeft.radiusM) * (180 / Math.PI);
  let wasDegrees = Math.round(wasIdeal / wheelData.gaugeWheelLeft.stepDeg) * wheelData.gaugeWheelLeft.stepDeg;
  if (Math.abs((wasDegrees / 45) - Math.round(wasDegrees / 45)) < 1e-6) wasDegrees += wheelData.gaugeWheelLeft.stepDeg;
  const wasDistanceM = ((wasDegrees * Math.PI) / 180) * wheelData.gaugeWheelLeft.radiusM;
  const wasSpeedMs = wasDistanceM / work.duration;

  const solved = solveGroundLoop({
    targetMs: TARGET_MS,
    currentDuration: work.duration,
    parts: wheels.map((name) => ({ name, radiusMetres: wheelData[name].radiusM, symmetryDeg: wheelData[name].stepDeg })),
    minFactor: 0.8,
    maxFactor: 1.3,
  });
  const retimed = retimeClip(work, solved.durationSeconds);

  const keys = 61;
  const times2 = Array.from({ length: keys }, (_, i) => (i / (keys - 1)) * work.duration);
  for (const part of solved.parts) {
    const total = THREE.MathUtils.degToRad(part.degrees);
    setTrack(work, part.name, 'quaternion', quatTrack(part.name, times2, times2.map((t) => [0, 0, -(t / work.duration) * total])));
    rolled[part.name] = {
      wasDegrees: +wasDegrees.toFixed(2),
      degrees: +part.degrees.toFixed(2),
      radiusMm: mm(part.radiusMetres),
      segmentDeg: +wheelData[part.name].stepDeg.toFixed(2),
      segmentSteps: part.steps,
      loopRemainderDeg: +(part.degrees % wheelData[part.name].stepDeg).toFixed(6),
      travelM: +part.travelMetres.toFixed(4),
      speedMs: +part.speedMs.toFixed(4),
      speedKmh: +(part.speedMs * 3.6).toFixed(2),
      maxStepDeg: +(part.degrees / (keys - 1)).toFixed(1),
      degreesPerRenderPhase: +(part.degrees / 8).toFixed(2),
    };
  }

  /* the tines keep their swing per metre of soil */
  const cyclesPerMetreWas = CYCLES / wasDistanceM;
  const cyclesNow = Math.max(1, Math.round(cyclesPerMetreWas * solved.distanceMetres));
  const tineTimes = Array.from({ length: KEYS }, (_, i) => (i / (KEYS - 1)) * work.duration);
  for (let t = 1; t <= TINES; t += 1) {
    const name = `pivottine${String(t).padStart(2, '0')}`;
    const phase = ((t - 1) / TINES) * Math.PI * 2;
    setTrack(work, name, 'quaternion', quatTrack(name, tineTimes, tineTimes.map((time) => {
      const u = (time / work.duration) * cyclesNow * Math.PI * 2 + phase;
      return [0, 0, ((1 - Math.cos(u)) / 2) * LIFT];
    })));
  }
  report.tineSwingRate = {
    why: 'the tines flexed three times per clip at 26.5 km/h; over a third of the ground the same three flexes would be three times the flexing per metre of soil',
    cyclesPerClip: { was: CYCLES, now: cyclesNow },
    cyclesPerMetre: { was: +cyclesPerMetreWas.toFixed(4), now: +(cyclesNow / solved.distanceMetres).toFixed(4) },
    hz: { was: +(CYCLES / retimed.wasSeconds).toFixed(3), now: +(cyclesNow / work.duration).toFixed(3) },
    swingDegrees: +((LIFT * 180) / Math.PI).toFixed(2),
    metresPerSwing: { was: +(wasDistanceM / CYCLES).toFixed(3), now: +(solved.distanceMetres / cyclesNow).toFixed(3) },
  };

  report.rollingSpeed = {
    why: 'the gauge wheels were matched to the tractor, and the tractor was doing 26.9 km/h: a cultivator works at 7-10',
    targetKmh: +(TARGET_MS * 3.6).toFixed(1),
    wasKmh: +(wasSpeedMs * 3.6).toFixed(2),
    nowKmh: +((solved.distanceMetres / work.duration) * 3.6).toFixed(2),
    setBy: 'solveGroundLoop: the ground distance the wheel can land on a whole multiple of its own 120 deg spoke symmetry',
    groundDistanceM: { was: +wasDistanceM.toFixed(3), now: +solved.distanceMetres.toFixed(3) },
    clipSeconds: retimed,
    spreadPercent: +solved.spreadPercent.toFixed(3),
    perPart: rolled,
  };
}

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
