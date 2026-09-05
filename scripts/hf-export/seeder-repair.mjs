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
  quatTrack, setTrack, radiusAbout, boxSpan, angularSymmetryDeg, fixInvertedWinding,
} from './machine-lib.mjs';

/* The floor a wheel rolls on is its lug circle, not the box of its rest pose. */
const rollingFloor = [];

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

/* --------------------------------------- 1. the row units stay in the ground (2026-09-05)
 * The 2026-09-03 pass gave `pivotrowUnit01..04` a 0 -> +8 deg contour float. On a rigid row
 * unit that lift takes EVERY ground-engaging tool off the ground at once, and the mechanism
 * audit measured exactly that over `sow`: opener discs 20.4-49.3 mm up, gauge wheels
 * 14.9-36.6 mm, closing wheels 71.4-144.9 mm — the whole machine 14.9 mm clear of the floor
 * at its lowest phase, for the entire clip. A planter that is sowing does not lift its
 * openers; `sow` has no transport phase to lift them for. The tracks are removed and the
 * units left at the pose they rest in, which is down. */
{
  const removed = [];
  for (let r = 1; r <= 4; r += 1) {
    const name = `pivotrowUnit${String(r).padStart(2, '0')}`;
    const index = sow.tracks.findIndex((t) => t.name === `${name}.quaternion`);
    if (index >= 0) { sow.tracks.splice(index, 1); removed.push(name); }
  }
  /* the node's own rest quaternion is left exactly as Harvest Frontier authored it: that
     pose IS the down pose, and overwriting it with identity lifted the openers 16.2 mm. */
  scene.updateMatrixWorld(true);
  report.rowUnitFloat = {
    why: 'a lift on a rigid row unit takes the openers, the gauge wheels and the closing wheels out of the ground together, which is what the audit measured over the whole sow clip',
    removedTracks: removed,
    restPose: 'down',
  };
}

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

/* ================================================= 2026-09-05 mechanism pass */

/* --------------------------------- 3a. the metering shaft spins on its own axis */
/* `pivotseedMeterShaft01..04` sit at (310.1, 923.9), the shaft mesh at (118.2, 1074.7):
 * 244.1 mm of eccentricity, so over `sow` a 56 x 56 x 240 mm shaft swung its box centre
 * 512.3 mm and left the 380 x 120 x 400 mm metering housing entirely. Put the pivot on the
 * shaft and it turns in its bearing. */
{
  const shafts = [];
  for (let r = 1; r <= 4; r += 1) {
    const tag = String(r).padStart(2, '0');
    const pivot = node(scene, `pivotseedMeterShaft${tag}`);
    const shaft = node(scene, `seedMeterShaft${tag}`);
    const centre = exactBox(shaft).getCenter(new THREE.Vector3());
    const was = new THREE.Vector3().setFromMatrixPosition(pivot.matrixWorld);
    const keep = shaft.matrixWorld.clone();
    pivot.parent.updateMatrixWorld(true);
    pivot.position.copy(pivot.parent.worldToLocal(centre.clone()));
    pivot.updateMatrixWorld(true);
    new THREE.Matrix4().copy(pivot.matrixWorld).invert().multiply(keep)
      .decompose(shaft.position, shaft.quaternion, shaft.scale);
    scene.updateMatrixWorld(true);
    const now = new THREE.Vector3().setFromMatrixPosition(pivot.matrixWorld);
    shafts.push({
      node: pivot.name,
      eccentricityWasMm: mm(was.distanceTo(centre)),
      eccentricityNowMm: mm(now.distanceTo(exactBox(shaft).getCenter(new THREE.Vector3()))),
      shaftCentreMm: centre.toArray().map(mm),
    });
  }
  report.seedMeterShaft = {
    why: 'the shaft orbited a point 244 mm away and flew out of its own housing every clip',
    shafts,
  };
}

/* --------------------------------- 3b. the tools that work the soil touch the soil */
/* Every rolling part is seated on the largest radius it has about its own axle, so it is on
 * the floor at every phase and not only in the rest pose. */
{
  const seat = (wheelName, moverName) => {
    const wheel = node(scene, wheelName);
    const mover = node(scene, moverName);
    wheel.updateMatrixWorld(true);
    const centre = new THREE.Vector3().setFromMatrixPosition(wheel.matrixWorld);
    const radius = radiusAbout(wheel, centre, [0, 0, 1]);
    const before = exactBox(wheel).min.y;
    mover.position.y -= centre.y - radius;
    scene.updateMatrixWorld(true);
    wheel.updateMatrixWorld(true);
    rollingFloor.push(new THREE.Vector3().setFromMatrixPosition(wheel.matrixWorld).y - radius);
    return { node: wheelName, movedBy: moverName, bottomWasMm: mm(before), radiusMm: mm(radius), axleYmm: mm(radius) };
  };
  const seated = [];
  for (let r = 1; r <= 4; r += 1) {
    const tag = String(r).padStart(2, '0');
    seated.push(seat(`gaugeWheel${tag}`, `pivotgaugeWheel${tag}`));
    for (const side of ['Left', 'Right']) {
      seated.push(seat(`closingWheel${tag}${side}`, `pivotclosingWheel${tag}${side}`));
      seated.push(seat(`openerDisc${tag}${side}`, `openerDisc${tag}${side}`));
    }
  }
  report.groundEngagingTools = {
    why: 'the gauge wheel that sets sowing depth ran 111.2 mm above the floor and the closing wheels 16.9 mm; a depth wheel in the air sets no depth',
    seated,
  };
}

/* ------------------------------------- 3c. the seed has a pipe from the meter down */
{
  const collars = [];
  for (let r = 1; r <= 4; r += 1) {
    const tag = String(r).padStart(2, '0');
    const tube = node(scene, `seedTube${tag}`);
    const outlet = node(scene, `hopperOutlet${tag}`);
    const tubeBox = exactBox(tube);
    const outletBox = exactBox(outlet);
    const gap = outletBox.min.y - tubeBox.max.y;
    if (gap <= 0) { collars.push({ row: tag, gapMm: mm(gap), added: false }); continue; }
    const material = matOf(meshes(tube)[0]);
    const colour = colourOf(meshes(tube)[0]);
    /* the tube is a diagonal: its top end is the corner at (min x, max y) */
    const x = tubeBox.min.x + 0.032;
    const z = (tubeBox.min.z + tubeBox.max.z) / 2;
    boxSpan(tube.parent, material, colour,
      [x - 0.034, tubeBox.max.y - 0.020, z - 0.034],
      [x + 0.034, outletBox.min.y + 0.014, z + 0.034],
      `seedTubeCollar${tag}`);
    collars.push({ row: tag, gapMm: mm(gap), part: `seedTubeCollar${tag}`, added: true });
  }
  scene.updateMatrixWorld(true);
  report.seedTubeCollars = {
    why: 'the metering housing let seed out at y 985.4 and the tube started 31 mm lower, so the seed left the machine through air',
    collars,
  };
}

/* ------------------------------- 3d. the parts bolted to the hopper touch the hopper */
{
  const closed = [];
  for (let h = 1; h <= 4; h += 1) {
    const tag = String(h).padStart(2, '0');
    /* The hopper is not a box: measured on its own eight vertices it is a truncated pyramid,
       x -200 mm at y 1045.6 and x -310 mm at y 1425.6. Seating the fittings against the
       AABB put them up to 24 mm OUTSIDE the sloping wall they are bolted through, which is
       why the connected-component rule kept calling them free-floating. Read the wall's
       real x at each fitting's own height instead. */
    const body = node(scene, `hopperBody${tag}`);
    const pos = body.geometry.getAttribute('position');
    const v = new THREE.Vector3();
    let lo = null; let hi = null;
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i).applyMatrix4(body.matrixWorld);
      if (!lo || v.y < lo.y - 1e-6) lo = { y: v.y, x: v.x };
      else if (Math.abs(v.y - lo.y) < 1e-6) lo.x = Math.min(lo.x, v.x);
      if (!hi || v.y > hi.y + 1e-6) hi = { y: v.y, x: v.x };
      else if (Math.abs(v.y - hi.y) < 1e-6) hi.x = Math.min(hi.x, v.x);
    }
    const wallXat = (y) => lo.x + ((hi.x - lo.x) * (y - lo.y)) / (hi.y - lo.y);
    for (const name of [`hopperInspectionWindow${tag}`, `hopperBolt${tag}-1`, `hopperBolt${tag}-2`]) {
      const part = node(scene, name);
      const box = exactBox(part);
      const wall = wallXat((box.min.y + box.max.y) / 2);
      const bite = wall + 0.012 - box.max.x;            // 12 mm into the hopper wall
      if (Math.abs(bite) > 1e-6) { part.position.x += bite; scene.updateMatrixWorld(true); }
      closed.push({ part: name, wallXmm: mm(wall), wasClearOfWallMm: mm(wall - box.max.x), movedMm: mm(bite) });
    }
  }
  report.hopperFittings = {
    why: 'eight bolt heads and four inspection windows read as separate floating groups: they stood off the hopper wall they are bolted through',
    parts: closed,
  };
}

/* ------------------------------ 3e2. a smooth disc turning looks like one standing still */
/* With the row-unit lift gone the only motion left in `sow` is rotation, and every rotating
 * part here is an untextured body of revolution: the render measured 0.3 % of silhouette
 * change across the clip. Each gauge and closing wheel gets three dark radial spokes in its
 * own material — the same trick the processing line's rollers got — so the wheels are
 * visibly turning without a millimetre of movement anywhere near the ground. */
{
  const spoked = [];
  for (let r = 1; r <= 4; r += 1) {
    const tag = String(r).padStart(2, '0');
    for (const wheelName of [`gaugeWheel${tag}`, `closingWheel${tag}Left`, `closingWheel${tag}Right`]) {
      const wheel = node(scene, wheelName);
      const tyre = meshes(wheel).reduce((a, b) => (exactBox(b).getSize(new THREE.Vector3()).y > exactBox(a).getSize(new THREE.Vector3()).y ? b : a));
      const box = exactBox(wheel);
      const radius = (box.max.y - box.min.y) / 2;
      const width = box.max.z - box.min.z;
      const dark = colourOf(tyre).clone().multiplyScalar(0.30);
      for (let i = 0; i < 3; i += 1) {
        const angle = (i / 3) * Math.PI * 2;
        const g = boxGeo(radius * 0.86, 0.030, width + 0.016, dark);   // 8 mm proud of each side face, or it is buried in a solid tyre
        const m = addMesh(wheel, g, matOf(tyre), `${wheelName}Spoke${i + 1}`, [0, 0, 0]);
        m.position.set(Math.cos(angle) * radius * 0.45, Math.sin(angle) * radius * 0.45, 0);
        m.rotation.z = angle;
        m.updateMatrix();
      }
      spoked.push({ wheel: wheelName, radiusMm: mm(radius), spokes: 3, colour: `#${dark.getHexString()}` });
    }
  }
  scene.updateMatrixWorld(true);
  report.wheelSpokes = {
    why: 'the render measured 0.3 % of silhouette change over the whole sow clip: everything that moves on this machine is a smooth circle',
    wheels: spoked,
  };
}

/* -------------------------------------- 3f. the hoppers were modelled inside out */
report.invertedWinding = {
  why: 'all four hopper bodies enclose a negative signed volume, so on an engine that culls back faces the bins vanish',
  flipped: fixInvertedWinding(node(scene, 'hopperGroup')),
};

/* ------------------------------------------------------------- 3. ground contact */
const root = node(scene, 'seederRoot');
const beforeGround = Math.min(exactBox(scene).min.y, ...rollingFloor);
root.position.y -= beforeGround;
scene.updateMatrixWorld(true);
report.ground = { beforeMm: mm(beforeGround), afterMm: mm(exactBox(scene).min.y) };

/* ---------------------------------------- 3e. one ground speed for every rolling part */
/* Measured after seating: the ground is y = 0, so a wheel that touches it has a rolling
 * radius equal to the height of its own axle. The opener discs set the distance (7 whole
 * turns, the count the clip already had); the gauge and closing wheels are given the angle
 * that covers the SAME distance, snapped to their own segment spacing so the loop closes on
 * a pose that looks identical to the first frame. */
{
  const rolling = [];
  for (let r = 1; r <= 4; r += 1) {
    const tag = String(r).padStart(2, '0');
    rolling.push(`gaugeWheel${tag}`);
    for (const side of ['Left', 'Right']) { rolling.push(`openerDisc${tag}${side}`); rolling.push(`closingWheel${tag}${side}`); }
  }
  const data = {};
  for (const name of rolling) {
    const wheel = node(scene, name);
    const axis = new THREE.Vector3(0, 0, 1);
    data[name] = {
      radiusMm: mm(new THREE.Vector3().setFromMatrixPosition(wheel.matrixWorld).y),
      stepDeg: angularSymmetryDeg(wheel, axis),
    };
  }
  const OPENER_TURNS = 7;
  const distance = OPENER_TURNS * 2 * Math.PI * (data.openerDisc01Right.radiusMm / 1000);
  const keys = 67;
  const times2 = Array.from({ length: keys }, (_, i) => (i / (keys - 1)) * sow.duration);
  const table = {};
  for (const name of rolling) {
    const d = data[name];
    const idealDeg = (distance / (d.radiusMm / 1000)) * (180 / Math.PI);
    const degrees = Math.max(d.stepDeg, Math.round(idealDeg / d.stepDeg) * d.stepDeg);
    const total = THREE.MathUtils.degToRad(degrees);
    setTrack(sow, name, 'quaternion', quatTrack(name, times2, times2.map((t) => [0, 0, -(t / sow.duration) * total])));
    const travel = (degrees * Math.PI / 180) * (d.radiusMm / 1000);
    table[name] = {
      degrees: +degrees.toFixed(2), radiusMm: d.radiusMm, segmentDeg: +d.stepDeg.toFixed(2),
      travelM: +travel.toFixed(3), speedMs: +(travel / sow.duration).toFixed(3),
    };
  }
  const travels = Object.values(table).map((t) => t.travelM);
  report.rollingSpeed = {
    why: 'the opener discs implied 6.41 m/s, the gauge wheels 6.13 and the closing wheels 5.86 — 9.4 % of slip between parts that all roll on the same ground',
    setBy: `openerDisc*Right at ${OPENER_TURNS} whole turns`,
    groundDistanceM: +distance.toFixed(3),
    spreadPercent: +(((Math.max(...travels) - Math.min(...travels)) / Math.max(...travels)) * 100).toFixed(2),
    perPart: table,
  };
}

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
