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
  dropHiddenProxies, exactBox, quatTrack, setTrack, drawnTris, radiusAbout, angularSymmetryDeg,
  matOf, colourOf, addMesh, boxGeo, boxSpan,
} from './machine-lib.mjs';

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

/* -------------------------- 2a. the depth wheels run on the ground, between the tines */
/* Measured on this file: `gaugeWheelLeft/Right` hang with their lowest vertex at y 102.5 mm.
 * The wheel that sets working depth was 102 mm above the ground it sets that depth against.
 * Dropping it alone is not enough - at ground level it cuts straight through sweep1 / sweep7 -
 * so each wheel is first moved into the clear lane between two tine ranks (found by measuring
 * the tine boxes, not by a constant: the ranks are not mirror images), and then dropped until
 * its own largest radius touches. The fork and the two supports follow it in, and their lower
 * ends are stretched down to the new axle so the wheel stays carried. */
{
  const wheels = [];
  /* The lanes between the tine ranks, measured on the tines themselves. They are NOT mirror
     images: every sweep is bolted 25.2 mm to one side of its own shank, so the left lane
     centres on -1084.7 and the right on +1055.3. The wheels go on the SAME |z| — the mean of
     the two — because a machine with one wheel 29 mm further out than the other is the defect
     the audit reported; the residual clearance to the nearest sweep is measured and reported. */
  const tineBoxes = [];
  for (let t = 1; t <= 7; t += 1) tineBoxes.push(exactBox(node(scene, `pivottine${String(t).padStart(2, '0')}`)));
  const laneCentres = {};
  for (const [side, sign] of [['Left', -1], ['Right', 1]]) {
    const wheelBox = exactBox(node(scene, `gaugeWheel${side}`));
    const halfWidth = (wheelBox.max.z - wheelBox.min.z) / 2;
    const lanes = tineBoxes.map((b) => ({ min: b.min.z, max: b.max.z })).sort((a, b) => a.min - b.min);
    let best = null;
    for (let i = 0; i + 1 < lanes.length; i += 1) {
      const width = lanes[i + 1].min - lanes[i].max;
      if (width < halfWidth * 2 - 0.012) continue;   // the tine box is its widest sweep, not its width at wheel height
      const centre = (lanes[i].max + lanes[i + 1].min) / 2;
      if (sign * centre <= 0) continue;
      const move = Math.abs(centre - (wheelBox.min.z + wheelBox.max.z) / 2);
      if (!best || move < best.move) best = { centre, width, move };
    }
    if (!best) throw new Error(`gaugeWheel${side}: no clear lane between the tines`);
    laneCentres[side] = best;
  }
  const symmetric = (Math.abs(laneCentres.Left.centre) + Math.abs(laneCentres.Right.centre)) / 2;
  for (const [side, sign] of [['Left', -1], ['Right', 1]]) {
    const pivot = node(scene, `pivotgaugeWheel${side}`);
    const wheel = node(scene, `gaugeWheel${side}`);
    const wheelBox = exactBox(wheel);
    const halfWidth = (wheelBox.max.z - wheelBox.min.z) / 2;
    const best = { centre: sign * symmetric, width: laneCentres[side].width };
    const deltaZ = best.centre - (wheelBox.min.z + wheelBox.max.z) / 2;
    const axleWorld = new THREE.Vector3().setFromMatrixPosition(wheel.matrixWorld);
    const radius = radiusAbout(wheel, axleWorld, [0, 0, 1]);
    const deltaY = -(axleWorld.y - radius);
    for (const name of [`pivotgaugeWheel${side}`, `collidergaugeWheel${side}`, `gaugeWheel${side}fork`]) {
      const part = scene.getObjectByName(name);
      if (!part) continue;
      part.position.z += deltaZ;
      part.position.y += deltaY;
    }
    for (const name of [`gaugeWheel${side}supportFront`, `gaugeWheel${side}supportRear`]) {
      const part = node(scene, name);
      const box = exactBox(part);
      const height = box.max.y - box.min.y;
      part.position.z += deltaZ;
      part.scale.y *= (height - deltaY) / height;
      scene.updateMatrixWorld(true);
      const now = exactBox(part);
      part.position.y += box.max.y - now.max.y;
    }
    scene.updateMatrixWorld(true);
    wheel.updateMatrixWorld(true);
    rollingFloor.push(new THREE.Vector3().setFromMatrixPosition(wheel.matrixWorld).y - radius);
    /* how close the wheel now runs to the sweeps either side of it, on the sweeps' own boxes */
    const now = exactBox(wheel);
    let nearest = Infinity; let nearestName = null;
    for (let t = 1; t <= 7; t += 1) {
      const sweep = exactBox(node(scene, `sweep${String(t).padStart(2, '0')}`));
      const dz = Math.max(sweep.min.z - now.max.z, now.min.z - sweep.max.z);
      const dx = Math.max(sweep.min.x - now.max.x, now.min.x - sweep.max.x);
      const dy = Math.max(sweep.min.y - now.max.y, now.min.y - sweep.max.y);
      const clearance = Math.max(dx, dy, dz);
      if (clearance < nearest) { nearest = clearance; nearestName = `sweep${String(t).padStart(2, '0')}`; }
    }
    wheels.push({
      node: pivot.name,
      bottomWasMm: mm(wheelBox.min.y), bottomNowMm: mm(now.min.y),
      droppedMm: mm(-deltaY), movedInboardMm: mm(-sign * deltaZ),
      laneCentreMm: mm(laneCentres[side].centre), placedAtMm: mm(best.centre),
      wheelWidthMm: mm(halfWidth * 2), radiusMm: mm(radius),
      axleZmm: mm(new THREE.Vector3().setFromMatrixPosition(wheel.matrixWorld).z),
      nearestSweep: nearestName, clearanceToSweepMm: mm(nearest),
    });
  }
  report.gaugeWheels = {
    why: 'the part that sets working depth ran 102.5 mm clear of the ground, and at ground level it cut through sweep1 and sweep7',
    wheels,
    axleSymmetryMm: +Math.abs(Math.abs(wheels[0].axleZmm) - Math.abs(wheels[1].axleZmm)).toFixed(1),
    note: 'the two lanes are 29.4 mm apart in |z| because every sweep is bolted 25.2 mm to one side of its own shank; the wheels are placed on the mean so the machine is symmetric, and the box overlap that leaves against the nearest sweep is reported above',
  };
}

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

/* -------------------------------- 3a. the gauge wheels roll at a real ground speed */
/* 2,880 deg over 1.627 s is eight WHOLE turns, so eight evenly spaced frames of the clip
 * land on the same wheel angle and the render saw eight identical pictures. The angle is
 * re-cut to the ground speed the same gauge wheel has on hf-tractor-compact (7.487 m/s),
 * snapped to the wheel own lug spacing so the loop still closes on an identical pose. */
{
  const TARGET_MS = 7.487;
  const rolled = {};
  const keys = 61;
  const times2 = Array.from({ length: keys }, (_, i) => (i / (keys - 1)) * work.duration);
  for (const side of ['Left', 'Right']) {
    const name = `gaugeWheel${side}`;
    const wheel = node(scene, name);
    const radius = new THREE.Vector3().setFromMatrixPosition(wheel.matrixWorld).y;
    const step = angularSymmetryDeg(wheel, new THREE.Vector3(0, 0, 1));
    const ideal = ((TARGET_MS * work.duration) / radius) * (180 / Math.PI);
    let degrees = Math.round(ideal / step) * step;
    if (Math.abs((degrees / 45) - Math.round(degrees / 45)) < 1e-6) degrees += step;
    const total = THREE.MathUtils.degToRad(degrees);
    setTrack(work, name, 'quaternion', quatTrack(name, times2, times2.map((t) => [0, 0, -(t / work.duration) * total])));
    rolled[name] = {
      wasDegrees: 2880, degrees: +degrees.toFixed(2), radiusMm: mm(radius), segmentDeg: +step.toFixed(2),
      travelM: +((degrees * Math.PI / 180) * radius).toFixed(3),
      speedMs: +(((degrees * Math.PI / 180) * radius) / work.duration).toFixed(3),
      degreesPerRenderPhase: +(degrees / 8).toFixed(1),
    };
  }
  report.rollingSpeed = {
    why: 'eight whole turns over a clip the render samples at eight phases gave eight pixel-identical frames',
    matchedTo: 'gaugeWheelLeft/Right on hf-tractor-compact, 7.487 m/s',
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
