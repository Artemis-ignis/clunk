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
 *
 * 2026-09-05 wheel pass. The operator looked at the delivered file and said the wheels
 * are not fixed to the tractor and hang in the air. They were right. Measured here:
 *
 *   5. NOTHING HELD THE FRONT AXLE UP. `frontAxle` is a 140 x 140 mm beam floating at
 *      y 375-515 mm with 395 mm of air between its top and the chassis floor (909.9 mm).
 *      From the side the front wheel stands on its own. A bolster now drops from the
 *      chassis onto the beam and carries the beam's pivot pin.
 *
 *   6. NO WHEEL WAS ON AN AXLE. Every hub measured 20-21 mm of air to the nearest axle
 *      metal (tmp/wheel-gap.mjs). Each of the four gets the joint a wheel has: a flange
 *      whose rim is built from THE HUB'S OWN FACE VERTICES, so the two meet at 0.0 mm and
 *      the faces that touch point in opposite directions (a butt joint, not a z-fight);
 *      a spigot that runs on into the hub bore; a shaft back to the beam.
 *
 *   7. THE FRONT FENDERS WERE LEFT AT THE OLD WHEEL'S HEIGHT. When the front wheels were
 *      scaled to 0.665 the fenders stayed at y 1140-1260 over a tyre whose crown is now
 *      889.5 mm — 250 mm of daylight — and 140 mm outboard of the tyre centre. Re-seated
 *      over the tyre they cover, and given a stay to the chassis.
 *
 *   8. THE FRONT WHEELS ROLLED 31 % SHORT. Over `drive` the rears turn 1080 deg at
 *      r 859.3 mm (16.199 m) and the fronts 1440 deg at r 445.1 mm (11.259 m). Every
 *      rolling part is re-keyed to one ground distance and lands on its own lug spacing,
 *      so the clip still loops.
 *
 *   9. THE STEERING WAS GEARED 3.2:1 — +-39.2 deg of handwheel for +-12.4 deg of wheel.
 *      The handwheel now turns +-200 deg for the same lock: 16.1:1, inside the 15-25:1 a
 *      real tractor has. The wheel lock is left alone; it was already Ackermann-correct.
 *
 *  10. THE IMPLEMENT DID NOT REACH THE GROUND. Gauge wheels 16.8 mm up, cultivator
 *      sweeps 22.3 mm up. Both seated.
 *
 * 2026-09-05 speed pass. Everything above left the six wheels agreeing with each other at
 * 7.49 m/s — 26.9 km/h, three times what a compact tractor works a field at. `drive` is
 * re-cut to 9.0 km/h (2.50 m/s):
 *
 *  11. THE CLIP LENGTH IS NOW THE FREE VARIABLE. A wheel may only stop on a whole multiple
 *      of its own symmetry angle, and at a third of the distance those angles are too
 *      coarse to cut 5.4 m three ways within half a percent. The distance is chosen from
 *      the ones every wheel can land on and the clip length follows from it, so the speed
 *      asked for is the speed delivered. `steer` keeps its shape, stretched by the same
 *      factor: its handwheel, its kingpin lock and its 2:1 length are untouched.
 *
 *  12. THE SYMMETRY WAS READ FROM THE LUG COUNT, 360/48 = 7.5 deg, but the lug ring
 *      repeats every 15 deg with the instances expanded — so the file on sale ended
 *      `drive` with its front wheels half a lug pitch from where they started.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  THREE, loadGlb, saveGlb, meshes, node, worldBox, exactBox, mm, drawnTris, matOf, boxGeo, colourOf, addMesh,
  mergeByAnchor, pruneEmpty, dropHiddenProxies, bakeInstances, unshareGeometry, quatTrack, setTrack,
  axleHubJoint, boxSpan, moveBoxCentreTo, cylGeo, radiusAbout,
  wheelSymmetryDeg, retimeClip, solveGroundLoop,
} from './machine-lib.mjs';

/* A lugged tyre is not a circle. Seating it on the box of its rest pose leaves the lug
 * tips below the floor a third of a turn later — the 2026-09-05 render caught the gauge
 * wheel 5.5 mm under the ground mid-clip. Seat every wheel on the largest radius any of
 * its vertices has about its own axle instead, and it touches at every angle. */
const rollingFloor = [];
function seatWheelOnItsLugs(scene, wheelNode, mover) {
  wheelNode.updateMatrixWorld(true);
  const centre = new THREE.Vector3().setFromMatrixPosition(wheelNode.matrixWorld);
  const radius = radiusAbout(wheelNode, centre, [0, 0, 1]);
  const before = centre.y;
  mover.position.y -= centre.y - radius;
  scene.updateMatrixWorld(true);
  wheelNode.updateMatrixWorld(true);
  rollingFloor.push(new THREE.Vector3().setFromMatrixPosition(wheelNode.matrixWorld).y - radius);
  return { node: wheelNode.name, axleWasMm: mm(before), axleNowMm: mm(radius), lugRadiusMm: mm(radius) };
}

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
  // seat the (now smaller) wheel back on the ground, on its lug tips
  wheel.position.y = exactBox(wheel).getSize(new THREE.Vector3()).y / 2;
  scene.updateMatrixWorld(true);
  seatWheelOnItsLugs(scene, wheel, wheel);
  const radius = new THREE.Vector3().setFromMatrixPosition(wheel.matrixWorld).y;
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

/* ============================================================ 2026-09-05 wheel pass */

/* --------------------------------------------- 4a. the front axle hangs from something */
{
  const beam = node(scene, 'frontAxle');
  const beamBox = exactBox(beam);
  const chassisBox = exactBox(node(scene, 'chassis'));
  const metal = matOf(beam);
  const dark = colourOf(beam);
  const root = node(scene, 'tractorRoot');
  const x0 = beamBox.min.x - 0.030;
  const x1 = beamBox.max.x + 0.030;
  boxSpan(root, metal, dark, [x0, beamBox.max.y - 0.020, -0.150], [x1, chassisBox.min.y + 0.010, 0.150], 'frontAxleBolster');
  const pinY = beamBox.max.y - 0.010;
  const pin = addMesh(root, cylGeo(0.048, 0.048, (x1 - x0) + 0.120, 14, dark).rotateZ(Math.PI / 2), metal, 'frontAxlePivotPin', [0, 0, 0]);
  pin.position.copy(root.worldToLocal(new THREE.Vector3((x0 + x1) / 2, pinY, 0)));
  scene.updateMatrixWorld(true);
  const bolster = exactBox(node(scene, 'frontAxleBolster'));
  report.frontAxleCarrier = {
    why: 'the front axle beam floated 395 mm under the chassis with nothing between the two, so from the side the front wheel stood on its own',
    beamTopYmm: mm(beamBox.max.y),
    chassisFloorYmm: mm(chassisBox.min.y),
    airGapWasMm: mm(chassisBox.min.y - beamBox.max.y),
    bolsterMinMm: bolster.min.toArray().map(mm),
    bolsterMaxMm: bolster.max.toArray().map(mm),
    pinYmm: mm(pinY),
  };
}

/* ------------------------------------------------- 4b. every hub sits on an axle now */
{
  const root = node(scene, 'tractorRoot');
  const metal = matOf(node(scene, 'frontAxle'));
  const joints = {};
  /* the rear tyres stopped 0.7 mm short of the floor; seat them before the joint is
     measured, or the flange is built against a hub that then moves. */
  const rearSeat = [];
  for (const name of ['wheelRearLeft', 'wheelRearRight']) rearSeat.push(seatWheelOnItsLugs(scene, node(scene, name), node(scene, name)));
  report.rearWheelSeat = rearSeat;
  for (const [wheelName, hubName, sign, spec] of [
    ['wheelFrontLeft', 'hub', -1, { flange: 0.035, spigot: { radius: 0.070, depth: 0.180 }, shaft: { radius: 0.062, to: -0.500 } }],
    ['wheelFrontRight', 'hub_1', +1, { flange: 0.035, spigot: { radius: 0.070, depth: 0.180 }, shaft: { radius: 0.062, to: 0.500 } }],
    ['wheelRearLeft', 'hub_2', -1, { flange: 0.040, spigot: { radius: 0.100, depth: 0.220 }, shaft: { radius: 0.108, to: -0.410 } }],
    ['wheelRearRight', 'hub_3', +1, { flange: 0.040, spigot: { radius: 0.100, depth: 0.220 }, shaft: { radius: 0.108, to: 0.410 } }],
  ]) {
    const hub = node(scene, hubName);
    const wheel = node(scene, wheelName);
    joints[wheelName] = axleHubJoint(root, hub, 2, sign, {
      ...spec,
      material: metal,
      colour: colourOf(hub).clone().multiplyScalar(0.9),
      name: wheelName.replace('wheel', 'axle'),
    });
    const centre = exactBox(wheel).getCenter(new THREE.Vector3());
    const pivot = new THREE.Vector3().setFromMatrixPosition(wheel.matrixWorld);
    joints[wheelName].pivotVsAabbCentreMm = mm(centre.distanceTo(pivot));
  }
  scene.updateMatrixWorld(true);
  report.axleJoints = {
    why: 'each hub measured 20-21 mm of air to the nearest axle metal; the flange rim is built from the hub OWN face vertices, so the joint closes at 0.0 mm by construction and the two faces that meet point in opposite directions',
    joints,
  };
}

/* ------------------------------------------ 4c. the front fenders cover a smaller wheel */
{
  const fenders = [];
  const root = node(scene, 'tractorRoot');
  const chassis = exactBox(node(scene, 'chassis'));
  for (const [side, sign] of [['Left', -1], ['Right', 1]]) {
    const fender = node(scene, `frontFender${side}`);
    const tyre = exactBox(node(scene, `wheelFront${side}`));
    const before = exactBox(fender);
    const wantWidth = (tyre.max.z - tyre.min.z) + 0.030;
    fender.scale.z *= wantWidth / (before.max.z - before.min.z);
    scene.updateMatrixWorld(true);
    const scaled = exactBox(fender);
    const height = scaled.max.y - scaled.min.y;
    moveBoxCentreTo(fender, new THREE.Vector3(
      (before.min.x + before.max.x) / 2,
      tyre.max.y + 0.070 + height / 2,
      (tyre.min.z + tyre.max.z) / 2,
    ));
    scene.updateMatrixWorld(true);
    const box = exactBox(fender);
    const inner = sign < 0 ? box.max.z : box.min.z;
    const hinge = sign * (chassis.max.z - 0.010);
    const reach = inner + sign * 0.060;                    // 60 mm INTO the fender, not up against it
    boxSpan(root, matOf(fender), colourOf(fender),
      [box.min.x + 0.240, box.min.y - 0.075, Math.min(hinge, reach)],
      [box.min.x + 0.360, box.min.y + 0.020, Math.max(hinge, reach)],
      `frontFenderStay${side}`);
    fenders.push({
      part: fender.name,
      wasYmm: [mm(before.min.y), mm(before.max.y)], nowYmm: [mm(box.min.y), mm(box.max.y)],
      wasZmm: [mm(before.min.z), mm(before.max.z)], nowZmm: [mm(box.min.z), mm(box.max.z)],
      tyreCrownYmm: mm(tyre.max.y), clearanceMm: mm(box.min.y - tyre.max.y),
      stay: `frontFenderStay${side}`,
    });
  }
  scene.updateMatrixWorld(true);
  report.frontFenders = {
    why: 'the front wheels were scaled to 0.665 and the fenders were left where the big wheel had been: 250 mm of daylight over the tyre and 140 mm off its centre, held up by nothing',
    fenders,
  };
}

/* ---------------------------------------------- 4d. the parts that hang in the air */
/* The connected-component rules that came into `packages/core` this week read the merged
 * meshes the way a buyer reads them, and they found four groups on this tractor bolted to
 * nothing. Measured, each one, and bridged with the bracket the real machine has. */
{
  const root = node(scene, 'tractorRoot');
  const matte = matOf(node(scene, 'frontBumper'));
  const matteColour = colourOf(node(scene, 'frontBumper'));
  const bumper = exactBox(node(scene, 'frontBumper'));
  const chassisBox = exactBox(node(scene, 'chassis'));
  const bridged = [];
  for (const sign of [-1, 1]) {
    boxSpan(root, matte, matteColour,
      [bumper.max.x - 0.020, 1.040, sign * 0.360 < sign * 0.260 ? sign * 0.360 : sign * 0.260],
      [chassisBox.min.x + 0.020, 1.140, sign * 0.360 > sign * 0.260 ? sign * 0.360 : sign * 0.260],
      `frontBumperStay${sign < 0 ? 'Left' : 'Right'}`);
  }
  bridged.push({ part: 'frontBumper', gapMm: mm(chassisBox.min.x - bumper.max.x), bridge: 'frontBumperStayLeft/Right to the chassis nose' });

  /* the rear fenders stop 8 mm short of the roll-bar posts that would carry them */
  for (const [side, sign] of [['Left', -1], ['Right', 1]]) {
    const fender = exactBox(node(scene, `rearFender${side}`));
    const post = exactBox(node(scene, `rollBarPost${side}`));
    const inner = sign < 0 ? fender.max.z : fender.min.z;
    const postOuter = sign < 0 ? post.min.z : post.max.z;
    boxSpan(root, matte, matteColour,
      [1.000, 2.180, Math.min(inner - sign * 0.020, postOuter + sign * 0.020)],
      [1.150, 2.262, Math.max(inner - sign * 0.020, postOuter + sign * 0.020)],
      `rearFenderStay${side}`);
    bridged.push({ part: `rearFender${side}`, gapMm: mm(Math.abs(inner - postOuter)), bridge: `rearFenderStay${side} to rollBarPost${side}` });
  }

  /* the implement toolbar floats 39.9 mm over the cross rails that should carry it */
  {
    const toolbar = exactBox(node(scene, 'cultivatorToolbar'));
    const rail = exactBox(node(scene, 'toolbarCrossRail2'));
    const frame = node(scene, 'toolbar');
    const metal = matOf(node(scene, 'cultivatorToolbar'));
    const colour = colourOf(node(scene, 'cultivatorToolbar'));
    for (const z of [-1.300, -0.650, 0, 0.650, 1.300]) {
      boxSpan(frame, metal, colour,
        [Math.max(toolbar.min.x, rail.min.x) + 0.010, rail.max.y - 0.010, z - 0.060],
        [Math.min(toolbar.max.x, rail.max.x) - 0.010, toolbar.min.y + 0.012, z + 0.060],
        `toolbarRiser${z < 0 ? 'L' : (z > 0 ? 'R' : 'C')}${Math.round(Math.abs(z) * 1000)}`);
    }
    bridged.push({ part: 'cultivatorToolbar', gapMm: mm(toolbar.min.y - rail.max.y), bridge: '5 risers down to toolbarCrossRail2' });
  }
  /* two handrails a side, 860 mm long, standing 12 mm off the hood they belong to, and a
     144 mm badge plate 101 mm in front of the nose. All four rails and the plate live inside
     the one `tractorStaticDetail` mesh, so they cannot be moved a part at a time — they get
     the mounting pads a real rail is bolted through. */
  {
    const hood = exactBox(node(scene, 'hood'));
    const nose = exactBox(node(scene, 'nose'));
    let pads = 0;
    for (const y of [1.340, 1.820]) {
      for (const sign of [-1, 1]) {
        for (const x of [-1.250, -0.800]) {
          const inner = sign * 0.737;
          const into = sign * (hood.max.z - 0.010);
          boxSpan(root, matte, matteColour,
            [x - 0.050, y - 0.014, Math.min(inner, into)],
            [x + 0.050, y + 0.014, Math.max(inner, into)],
            `handrailPad${pads += 1}`);
        }
      }
    }
    boxSpan(root, matte, matteColour, [-2.050, 1.645, -0.030], [nose.min.x + 0.010, 1.695, 0.030], 'nosePlateMount');
    bridged.push({ part: 'handrails x4', gapMm: mm(0.737 - hood.max.z), bridge: `${pads} pads to the hood side` });
    bridged.push({ part: 'nose badge plate', gapMm: mm(nose.min.x - -2.041), bridge: 'nosePlateMount back to the nose' });
  }
  scene.updateMatrixWorld(true);
  report.nothingHangsInTheAir = {
    why: 'the sale gate now reads merged meshes as connected components, and it found the front bumper, both rear fenders and the implement toolbar attached to nothing',
    bridged,
  };
}

/* -------------------------------------------------------- 5. invisible proxies out */
report.hiddenProxies = dropHiddenProxies(scene);

/* ---------------------------------------------------------------- 6. ground contact */
/* The floor is the circle the lugs roll on, not the box of the rest pose: a lugged tyre
 * standing on a flat between two lugs measures 2.8 mm high and then reaches the floor a
 * few degrees later. Dropping the root onto the rest box buried the tyre 2.8 mm. */
const root = node(scene, 'tractorRoot');
const beforeGround = Math.min(exactBox(scene).min.y, ...rollingFloor);
root.position.y -= beforeGround;
scene.updateMatrixWorld(true);
report.ground = { beforeMm: mm(beforeGround), afterMm: mm(exactBox(scene).min.y) };

/* ---------------------------------------------- 6a. the implement reaches the ground */
{
  const seated = [];
  for (const side of ['Left', 'Right']) {
    const pivot = node(scene, `pivotgaugeWheel${side}`);
    const before = exactBox(pivot).min.y;
    const seat = seatWheelOnItsLugs(scene, node(scene, `gaugeWheel${side}`), pivot);
    seated.push({ node: pivot.name, wasMm: mm(before), lugRadiusMm: seat.lugRadiusMm, axleYmm: seat.axleNowMm });
  }
  {
    const part = node(scene, 'tineGroup');
    const before = exactBox(part).min.y;
    part.position.y -= before;
    scene.updateMatrixWorld(true);
    seated.push({ node: 'tineGroup', wasMm: mm(before), nowMm: mm(exactBox(part).min.y) });
  }
  report.implementGroundContact = {
    why: 'the part that sets working depth and the blades that cut the soil were both in the air',
    parts: seated,
  };
}

/* ------------------------ 6b. one ground speed for every wheel, and a real one (2026-09-05) */
/* Measured on this file after seating: the ground is y = 0, so a wheel that touches it has a
 * rolling radius equal to the height of its own pivot.
 *
 * The pass before this one made all six wheels agree on one distance, and took that distance
 * from the clip as it was authored — three whole turns of the rear wheel, 16.26 m in 2.17 s.
 * That is 7.49 m/s: 27 km/h, on a machine that works a field at 6-10. The distance now comes
 * from the speed instead. 9.0 km/h = 2.50 m/s.
 *
 * The clip length is what pays for it. A wheel may only stop on a whole multiple of its own
 * symmetry angle or the last frame of the loop is not the first one, and at a third of the
 * distance those angles are a coarse ruler: the gauge wheel repeats every 30 degrees, which
 * is 130 mm of ground, so 5.4 m cannot be cut into whole steps by all three radii at once
 * and still land within half a percent. `solveGroundLoop` searches the distances every wheel
 * CAN land on, keeps the one they disagree over least, and the clip length falls out of it —
 * length = distance / speed, so the speed asked for is the speed delivered. Everything else
 * in both clips is stretched onto the new length by `retimeClip`, so the steering and the
 * tine swing keep the shape they had.
 *
 * The symmetry angle is measured with the lug instances expanded (`wheelSymmetryDeg`). The
 * old code took 360/48 = 7.5 degrees from the lug COUNT, but the ring repeats every 15, so
 * the file on sale ended `drive` with its front wheels half a lug pitch from where they
 * started. */
{
  const steer = clips.find((c) => c.name === 'steer');
  if (!steer) throw new Error('the `steer` clip is gone');
  const rolling = ['wheelFrontLeft', 'wheelFrontRight', 'wheelRearLeft', 'wheelRearRight', 'gaugeWheelLeft', 'gaugeWheelRight'];
  const wheelData = {};
  for (const name of rolling) {
    const wheel = node(scene, name);
    let lugs = 0;
    wheel.traverse((n) => { if (/lug/i.test(n.name || '')) lugs += n.isInstancedMesh ? n.count : 1; });
    wheelData[name] = {
      radiusMm: mm(new THREE.Vector3().setFromMatrixPosition(wheel.matrixWorld).y),
      lugs,
      stepDeg: wheelSymmetryDeg(wheel, [0, 0, 1]),
      bottomYmm: mm(exactBox(wheel).min.y),
    };
  }
  const TARGET_MS = 2.50;                                     // 9.0 km/h, a compact tractor working a field
  const WAS_REAR_TURNS = 3;
  const rRear = wheelData.wheelRearLeft.radiusMm / 1000;
  const wasDistanceM = WAS_REAR_TURNS * 2 * Math.PI * rRear;
  const wasSpeedMs = wasDistanceM / drive.duration;
  const steerRatio = steer.duration / drive.duration;         // the steer clip covers two of these

  const solved = solveGroundLoop({
    targetMs: TARGET_MS,
    currentDuration: drive.duration,
    parts: rolling.map((name) => ({
      name,
      radiusMetres: wheelData[name].radiusMm / 1000,
      symmetryDeg: wheelData[name].stepDeg,
    })),
    minFactor: 0.75,
    maxFactor: 1.35,
  });
  const retimed = {
    drive: retimeClip(drive, solved.durationSeconds),
    steer: retimeClip(steer, solved.durationSeconds * steerRatio),
  };

  const table = { drive: {}, steer: {} };
  for (const [clip, scale] of [[drive, 1], [steer, steerRatio]]) {
    const keys = Math.max(33, Math.round(66 * scale) + 1);
    const clipTimes = Array.from({ length: keys }, (_, i) => (i / (keys - 1)) * clip.duration);
    let distance = 0;
    for (const part of solved.parts) {
      const step = wheelData[part.name].stepDeg;
      const degrees = Math.round((part.degrees * scale) / step) * step;   // a whole number of steps at 2x as well
      const total = THREE.MathUtils.degToRad(degrees);
      setTrack(clip, part.name, 'quaternion', quatTrack(part.name, clipTimes,
        clipTimes.map((t) => [0, 0, -(t / clip.duration) * total])));
      const travel = (degrees * Math.PI / 180) * part.radiusMetres;
      distance += travel / solved.parts.length;
      table[clip.name][part.name] = {
        degrees: +degrees.toFixed(2),
        wasDegrees: null,
        radiusMm: wheelData[part.name].radiusMm,
        lugs: wheelData[part.name].lugs,
        symmetryDeg: +step.toFixed(3),
        symmetrySteps: Math.round(degrees / step),
        loopRemainderDeg: +(degrees % step).toFixed(6),
        travelM: +travel.toFixed(4),
        speedMs: +(travel / clip.duration).toFixed(4),
        speedKmh: +((travel / clip.duration) * 3.6).toFixed(2),
        maxStepDeg: +(degrees / (keys - 1)).toFixed(1),
        degreesPerRenderPhase: +(degrees / 8).toFixed(2),
      };
    }
    table[clip.name].groundDistanceM = +distance.toFixed(4);
    table[clip.name].clipSeconds = +clip.duration.toFixed(4);
  }
  table.drive.wheelFrontLeft.wasDegrees = 2077.5;
  table.drive.wheelFrontRight.wasDegrees = 2077.5;
  table.drive.wheelRearLeft.wasDegrees = 1080;
  table.drive.wheelRearRight.wasDegrees = 1080;
  table.drive.gaugeWheelLeft.wasDegrees = 3750;
  table.drive.gaugeWheelRight.wasDegrees = 3750;

  /* The mounted cultivator's tines flex once per so many metres of soil, not once per second:
     the swing keeps the rate per metre of travel it had, which at a third of the speed is a
     third of the cycles in a clip. Whole cycles only, or the last frame is not the first. */
  const WAS_TINE_CYCLES = 3;
  const tineCyclesPerMetreWas = WAS_TINE_CYCLES / wasDistanceM;
  const tineCycles = Math.max(1, Math.round(tineCyclesPerMetreWas * solved.distanceMetres));
  const tineTimes = Array.from({ length: KEYS }, (_, i) => (i / (KEYS - 1)) * drive.duration);
  for (let t = 1; t <= 7; t += 1) {
    const name = `pivottine${String(t).padStart(2, '0')}`;
    const phase = ((t - 1) / 7) * Math.PI * 2;
    setTrack(drive, name, 'quaternion', quatTrack(name, tineTimes, tineTimes.map((time) => {
      const u = (time / drive.duration) * tineCycles * Math.PI * 2 + phase;
      return [0, 0, ((1 - Math.cos(u)) / 2) * LIFT];
    })));
  }
  report.tineSwingRate = {
    why: 'the tines flexed three times per clip at 27 km/h; at 9 km/h the clip covers a third of the ground, and three flexes over it would be three times the flexing per metre of soil',
    cyclesPerClip: { was: WAS_TINE_CYCLES, now: tineCycles },
    cyclesPerMetre: { was: +tineCyclesPerMetreWas.toFixed(4), now: +(tineCycles / solved.distanceMetres).toFixed(4) },
    hz: { was: +(WAS_TINE_CYCLES / retimed.drive.wasSeconds).toFixed(3), now: +(tineCycles / drive.duration).toFixed(3) },
    swingDegrees: +((LIFT * 180) / Math.PI).toFixed(2),
  };

  report.rollingSpeed = {
    why: 'every wheel agreed with every other wheel, and all six were doing 26.9 km/h: three times what a compact tractor works a field at',
    targetKmh: +(TARGET_MS * 3.6).toFixed(1),
    wasKmh: +(wasSpeedMs * 3.6).toFixed(2),
    nowKmh: +((solved.distanceMetres / drive.duration) * 3.6).toFixed(2),
    setBy: 'solveGroundLoop: the ground distance every wheel can land on a whole multiple of its own symmetry angle',
    groundDistanceM: { was: +wasDistanceM.toFixed(3), now: +solved.distanceMetres.toFixed(3) },
    clipSeconds: retimed,
    spreadPercent: +solved.spreadPercent.toFixed(3),
    symmetryReadFrom: 'wheelSymmetryDeg, lug instances expanded (the lug COUNT said 7.5 deg; the ring repeats every 15)',
    perClip: table,
  };

  /* the handwheel */
  const track = steer.tracks.find((t) => t.name === 'steeringWheel.quaternion');
  if (!track) throw new Error('steeringWheel has no track in `steer`');
  const times = Array.from(track.times);
  const ys = [];
  for (let i = 0; i < times.length; i += 1) {
    const q = new THREE.Quaternion(track.values[i * 4], track.values[i * 4 + 1], track.values[i * 4 + 2], track.values[i * 4 + 3]);
    ys.push(new THREE.Euler().setFromQuaternion(q, 'XYZ').y);
  }
  const wasMax = ys.reduce((t, y) => Math.max(t, Math.abs(y)), 0);
  const WANT = THREE.MathUtils.degToRad(200);
  const factor = WANT / wasMax;
  setTrack(steer, 'steeringWheel', 'quaternion', quatTrack('steeringWheel', times, ys.map((y) => [0, y * factor, 0])));
  let lock = 0;
  for (const side of ['Left', 'Right']) {
    const pivotTrack = steer.tracks.find((t) => t.name === `steeringPivotwheelFront${side}.quaternion`);
    for (let i = 0; i < pivotTrack.times.length; i += 1) {
      const q = new THREE.Quaternion(pivotTrack.values[i * 4], pivotTrack.values[i * 4 + 1], pivotTrack.values[i * 4 + 2], pivotTrack.values[i * 4 + 3]);
      lock = Math.max(lock, Math.abs(new THREE.Euler().setFromQuaternion(q, 'XYZ').y));
    }
  }
  const stepDeg = (200 * 2) / (times.filter((t, i) => i > 0 && Math.abs(ys[i] - ys[i - 1]) > 1e-6).length || 1);
  report.steeringRatio = {
    why: 'a tractor whose handwheel goes lock to lock in 78 degrees is a go-kart; real ones are 15-25 turns of ratio',
    handwheelWasDeg: +(wasMax * 180 / Math.PI).toFixed(1),
    handwheelNowDeg: 200,
    innerWheelLockDeg: +(lock * 180 / Math.PI).toFixed(1),
    ratioWas: +((wasMax / lock)).toFixed(1),
    ratioNow: +((WANT / lock)).toFixed(1),
    chose: 'turned the handwheel up rather than reducing the wheel lock, because the wheel lock is already Ackermann-correct (inner 12.4 deg, outer 9.5 deg)',
    largestKeyStepDeg: +stepDeg.toFixed(1),
  };
}

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
