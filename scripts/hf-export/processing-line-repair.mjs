/**
 * hf-processing-line — 2026-09-03 repair pass.
 *
 * Measured on the file that was on sale
 * (public/market/hf-processing-line/processing.line.m1.glb):
 *
 *   1. A 6.60 x 3.80 m FLAT GREEN SLAB IS PART OF THE PRODUCT.
 *      `processingFoundation`, 528 triangles, y 0.109 - 0.289 m, sitting under
 *      the whole machine and sticking out past it on every side. A buyer who
 *      drops this into a scene gets a green rectangle welded to their floor.
 *      Deleted. The conveyor feet that stood ON it are re-seated on y = 0.
 *
 *   2. ONLY 15 OF 142 PARTS MOVE IN AN 8.30 s CLIP, and two of the fifteen
 *      cannot be seen:
 *        - `mixerBladeUpper/Lower` turn 1.14 m but they are INSIDE the opaque
 *          tank (tankBody y 0.83-4.09 m), so from outside the tank is dead.
 *          A drive head is added on the tank apex — a shaft stub through the
 *          lid and a coupling bar — turning on the same `mixerPivot`, so the
 *          mixer running is visible from outside.
 *        - `conveyorRollerA/B` turn 0.68 m but they are smooth untextured
 *          cylinders, and a smooth cylinder turning looks identical to a smooth
 *          cylinder standing still. Three dark stripes are added to each roller
 *          at 120 degrees, welded into the roller's own draw call.
 *      Two static instruments are given the motion a running line has:
 *      `gaugePointer` sweeps its dial and `valveWheel` turns, each on a new
 *      pivot placed at the part's real centre of rotation.
 *
 *   3. 142 MESHES = 142 DRAW CALLS. Merged per (animated node, material).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  THREE, loadGlb, saveGlb, meshes, node, worldBox, mm, matOf, meshTris, drawnTris,
  mergeByAnchor, pruneEmpty, dropHiddenProxies, bakeInstances, unshareGeometry, exactBox, boxGeo, cylGeo, colourOf, addMesh,
  quatTrack, setTrack,
} from './machine-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const IN = process.argv[2] ?? path.join(REPO, 'public/market/hf-processing-line/processing.line.m1.glb');
const OUT = process.argv[3] ?? path.join(REPO, 'examples/harvest-frontier/runtime-animated/processing.line.repaired.glb');

const gltf = await loadGlb(IN);
const scene = gltf.scene;
const clips = gltf.animations;
const run = clips.find((c) => c.name === 'run');
if (!run) throw new Error('the `run` clip is gone');
const report = { input: path.relative(REPO, IN), output: path.relative(REPO, OUT) };
report.before = { meshes: meshes(scene).length, drawnTriangles: drawnTris(scene), groundMinYmm: mm(exactBox(scene).min.y) };

/* ------------------------------------------------------------- 1. the green slab */
const slab = node(scene, 'processingFoundation');
const slabBox = worldBox(slab);
report.foundation = {
  decision: 'deleted',
  sizeMm: slabBox.getSize(new THREE.Vector3()).toArray().map(mm),
  yRangeMm: [mm(slabBox.min.y), mm(slabBox.max.y)],
  triangles: meshTris(slab),
  colour: `#${colourOf(slab).getHexString()}`,
  why: 'a ground plane is the buyer\'s scene, not the machine; it stuck out past the machine on every side and read as a green rectangle glued under it',
};
slab.removeFromParent();
scene.updateMatrixWorld(true);

/* -------------------------------------------------------- 2. invisible proxies out */
report.hiddenProxies = dropHiddenProxies(scene);

/* --------------------------------------------------------------- 3. roller stripes */
/* One dark stripe per 120 degrees, 8 mm proud of a 332 mm roller, running its
   whole length. Same material as the roller, so after the merge these cost no
   extra draw call — they only give the eye something to follow. */
const stripes = [];
for (const rollerName of ['conveyorRollerA', 'conveyorRollerB']) {
  const pivot = node(scene, rollerName);
  const drum = pivot.children.find((c) => c.isMesh);
  /* The drum's own frame, not the world box: the conveyor is inclined, so the
     world AABB of a tilted cylinder is 36 mm wider than the cylinder. */
  const toPivot = new THREE.Matrix4().copy(pivot.matrixWorld).invert().multiply(drum.matrixWorld);
  const pos = drum.geometry.getAttribute('position');
  const v = new THREE.Vector3();
  const local = new THREE.Box3();
  for (let i = 0; i < pos.count; i += 1) local.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(toPivot));
  const size = local.getSize(new THREE.Vector3());
  const axis = size.x > size.y && size.x > size.z ? 'x' : (size.y > size.z ? 'y' : 'z');
  const length = size[axis];
  const radius = ((axis === 'x' ? size.y : size.x) + (axis === 'z' ? size.y : size.z)) / 4;
  const dark = colourOf(drum).clone().multiplyScalar(0.28);
  for (let i = 0; i < 3; i += 1) {
    const angle = (i / 3) * Math.PI * 2;
    const r = radius + 0.001;                       // 6 mm into the drum, 8 mm proud of it
    const g = axis === 'y' ? boxGeo(0.090, length * 0.96, 0.014, dark) : boxGeo(length * 0.96, 0.090, 0.014, dark);
    const m = addMesh(pivot, g, matOf(drum), `${rollerName}Stripe${i + 1}`, [0, 0, 0]);
    if (axis === 'y') { m.position.set(Math.sin(angle) * r, 0, Math.cos(angle) * r); m.rotation.y = angle; }
    else { m.position.set(0, Math.cos(angle) * r, Math.sin(angle) * r); m.rotation.x = angle; }
  }
  stripes.push({ roller: rollerName, axis, radiusMm: mm(radius), lengthMm: mm(length), stripes: 3, colour: `#${dark.getHexString()}` });
}
report.rollerStripes = { why: 'a smooth untextured cylinder turning is indistinguishable from one standing still', rollers: stripes };

/* ------------------------------------------------------------- 4. mixer drive head */
/* mixerPivot already turns 1.14 m of blade — inside a solid tank. This puts the
   same rotation where a buyer can see it: a shaft stub out of the tank apex and
   a coupling bar across it. */
const mixerPivot = node(scene, 'mixerPivot');
const lid = node(scene, 'tankLid');
const lidTop = worldBox(lid).max.y;
const mixerWorldY = new THREE.Vector3().setFromMatrixPosition(mixerPivot.matrixWorld).y;
const shaftMesh = node(scene, 'mixerShaft');
const metal = matOf(shaftMesh);
const shaftTopWorld = lidTop + 0.20;
const shaftBottomWorld = lidTop - 0.12;
const shaftH = shaftTopWorld - shaftBottomWorld;
addMesh(mixerPivot, cylGeo(0.045, 0.045, shaftH, 12, colourOf(shaftMesh)), metal, 'mixerDriveShaft',
  [0, (shaftBottomWorld + shaftH / 2) - mixerWorldY, 0]);
const couplingColour = colourOf(shaftMesh).clone().multiplyScalar(0.35);
addMesh(mixerPivot, boxGeo(0.46, 0.070, 0.100, couplingColour), metal, 'mixerDriveCoupling',
  [0, (shaftTopWorld - 0.045) - mixerWorldY, 0]);
addMesh(mixerPivot, cylGeo(0.085, 0.085, 0.080, 12, colourOf(shaftMesh)), metal, 'mixerDriveHub',
  [0, (shaftTopWorld - 0.130) - mixerWorldY, 0]);
report.mixerDriveHead = {
  why: 'the blades turn inside an opaque tank, so nothing outside said the mixer was running',
  parts: ['mixerDriveShaft', 'mixerDriveHub', 'mixerDriveCoupling'],
  onNode: 'mixerPivot (the clip already turns it 8.30 s / revolution set)',
  tankApexYmm: mm(lidTop),
  couplingYmm: mm(shaftTopWorld - 0.045),
};

/* --------------------------------------------- 5. instruments that a running line moves */
function repivot(meshName, pivotName) {
  const m = node(scene, meshName);
  const parent = m.parent;
  const centreWorld = worldBox(m).getCenter(new THREE.Vector3());
  const pivot = new THREE.Object3D();
  pivot.name = pivotName;
  parent.add(pivot);
  pivot.position.copy(parent.worldToLocal(centreWorld.clone()));
  parent.updateMatrixWorld(true);
  const keep = m.matrixWorld.clone();
  pivot.add(m);
  pivot.updateMatrixWorld(true);
  m.matrix.copy(new THREE.Matrix4().copy(pivot.matrixWorld).invert().multiply(keep));
  m.matrix.decompose(m.position, m.quaternion, m.scale);
  scene.updateMatrixWorld(true);
  return pivot;
}
const KEYS = 49;
const times = Array.from({ length: KEYS }, (_, i) => (i / (KEYS - 1)) * run.duration);

repivot('gaugePointer', 'gaugePointerPivot');
setTrack(run, 'gaugePointerPivot', 'quaternion', quatTrack('gaugePointerPivot', times,
  times.map((t) => {
    const u = t / run.duration;
    // three sweeps up the dial and back over the clip, 0 -> 220 degrees
    const s = (1 - Math.cos(u * 3 * Math.PI * 2)) / 2;
    return [0, 0, THREE.MathUtils.degToRad(-110 + 220 * s)];
  })));

repivot('valveWheel', 'valveWheelPivot');
setTrack(run, 'valveWheelPivot', 'quaternion', quatTrack('valveWheelPivot', times,
  times.map((t) => [(t / run.duration) * Math.PI * 2, 0, 0])));

report.instruments = [
  { node: 'gaugePointerPivot', part: 'gaugePointer', motion: 'sweeps -110 to +110 degrees, three times per clip' },
  { node: 'valveWheelPivot', part: 'valveWheel', motion: 'one full turn about its own axle per clip' },
];

/* --------------------------------------------------- 5. the line has to make sense */
/* 2026-09-04, measured on the file that was on sale:
 *
 *   a. THE CONVEYOR RUNS THROUGH THE TANK. `tankBody` is a cylinder of radius
 *      1.000 m on the axis x -0.450, z -0.120, standing y 0.829..4.089.
 *      `conveyorRailRight` puts 180 of its 335 vertices inside it, `conveyorBrace0`
 *      162 of 332 and up to 293 mm deep, and the belt itself 84. A third of a metre
 *      of steel passes through the wall of a sealed tank.
 *
 *   b. THE BELT DELIVERS NOWHERE. Its top end stopped in mid-air beside the tank,
 *      so the hopper above it fed a belt that carried to nothing.
 *
 * The conveyor and the hopper it feeds move together, sideways, until the conveyor
 * is clear of the cylinder — moving them apart would break the one relationship the
 * model got right. Then the belt's top end is given a chute into a side inlet, so
 * the line reads hopper -> belt -> tank. Every distance is measured off this file. */
{
  const tankBody = node(scene, 'tankBody');
  const tankBox = worldBox(tankBody);
  const axis = { x: (tankBox.min.x + tankBox.max.x) / 2, z: (tankBox.min.z + tankBox.max.z) / 2 };
  const radius = Math.min(tankBox.max.x - tankBox.min.x, tankBox.max.z - tankBox.min.z) / 2;
  const conveyor = node(scene, 'conveyor-module');
  const hopper = node(scene, 'hopper-module');

  /* Per vertex, not per box: a box over-measures a part that only clips a corner.
     Instanced meshes are read through their instance matrices, or a rail whose
     geometry sits at its own origin would look as if it were nowhere near the tank. */
  const insideCount = (group) => {
    let count = 0;
    let deepest = 0;
    const v = new THREE.Vector3();
    const im = new THREE.Matrix4();
    for (const mesh of meshes(group)) {
      const pos = mesh.geometry.getAttribute('position');
      const copies = mesh.isInstancedMesh ? mesh.count : 1;
      for (let c = 0; c < copies; c += 1) {
        const world = mesh.isInstancedMesh
          ? new THREE.Matrix4().multiplyMatrices(mesh.matrixWorld, mesh.getMatrixAt(c, im) ?? im)
          : mesh.matrixWorld;
        for (let i = 0; i < pos.count; i += 1) {
          v.fromBufferAttribute(pos, i).applyMatrix4(world);
          if (v.y < tankBox.min.y || v.y > tankBox.max.y) continue;
          const d = Math.hypot(v.x - axis.x, v.z - axis.z);
          if (d < radius) { count += 1; deepest = Math.max(deepest, radius - d); }
        }
      }
    }
    return { count, deepest };
  };

  const before = insideCount(conveyor);
  const CLEARANCE = 0.050;                        // 50 mm of daylight, not a shared surface
  const shift = before.deepest > 0 ? before.deepest + CLEARANCE : 0;
  conveyor.position.x -= shift;
  hopper.position.x -= shift;                     // the hopper feeds this belt; it travels with it
  /* The crates are staged under the conveyor, between its two feet. Left where they
     were, the right foot lands inside `crateBody_1` — a fix that makes a new
     collision is not a fix, so what stood in the conveyor's footprint travels with it. */
  node(scene, 'shipping-crates').position.x -= shift;
  scene.updateMatrixWorld(true);
  const after = insideCount(conveyor);

  /* b. The belt's top end empties through a side inlet at its own height. The chute
     starts at the belt's top edge and runs to the tank wall, 90 mm into it so it
     reads as entering rather than touching; the flange is what it enters. */
  const belt = node(scene, 'conveyorBelt');
  const beltBox = worldBox(belt);
  /** The tank wall's x at a given z, on the conveyor's side of the axis. */
  const wallXOf = (a, r, z) => a.x - Math.sqrt(Math.max(0, r * r - (z - a.z) ** 2));
  const inletZ = (beltBox.min.z + axis.z) / 2;
  const wallX = wallXOf(axis, radius, inletZ);
  const chuteY = beltBox.max.y - 0.080;
  const chuteFrom = beltBox.max.x;
  const chuteLength = (wallX + 0.090) - chuteFrom;
  const tankModule = node(scene, 'tank-module');
  const chute = addMesh(tankModule, boxGeo(chuteLength, 0.150, 0.520, colourOf(belt).clone().multiplyScalar(1.15)),
    matOf(belt), 'conveyorDeliveryChute', [0, 0, 0]);
  tankModule.worldToLocal(chute.position.set(chuteFrom + chuteLength / 2, chuteY, inletZ));
  const inlet = addMesh(tankModule, cylGeo(0.190, 0.190, 0.070, 14, colourOf(tankBody).clone().multiplyScalar(0.82)),
    matOf(tankBody), 'tankSideInlet', [0, 0, 0]);
  tankModule.worldToLocal(inlet.position.set(wallX + 0.020, chuteY, inletZ));
  inlet.rotation.z = Math.PI / 2;
  scene.updateMatrixWorld(true);

  /* d. THE HOPPER FEEDS THE TAIL OF THE BELT.
   *
   * It was a 45-degree square funnel — mouth 820 mm, rim 2.44 m, both horizontal —
   * hanging 34 mm over the belt's HEAD with nothing under it. Whatever it tipped out
   * landed where the belt ends and was carried back down. It moves to the tail, where
   * a feed hopper belongs.
   *
   * A horizontal mouth over a 33.9-degree belt cannot clear it at a constant gap: the
   * belt rises 550 mm across the mouth's own 820 mm. That is what a skirt is for. The
   * mouth sits 60 mm above the belt's HIGHEST point under it, and four walls drop from
   * the mouth's outline to 25 mm above the belt — each wall's bottom edge computed from
   * the belt's height at that corner's own z, so the skirt follows the incline exactly. */
  const beltAt = (z) => beltBox.min.y
    + ((beltBox.max.z - z) / (beltBox.max.z - beltBox.min.z)) * (beltBox.max.y - beltBox.min.y);
  const hopperBody = node(scene, 'hopperBody');
  const mouthCorners = () => {
    const pos = hopperBody.geometry.getAttribute('position');
    const all = [];
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 1) all.push(v.fromBufferAttribute(pos, i).applyMatrix4(hopperBody.matrixWorld).clone());
    const floor = Math.min(...all.map((q) => q.y));
    const low = all.filter((q) => q.y < floor + 0.02);
    const unique = [];
    for (const q of low) if (!unique.some((c) => c.distanceTo(q) < 0.02)) unique.push(q.clone());
    const cx = unique.reduce((t, q) => t + q.x, 0) / unique.length;
    const cz = unique.reduce((t, q) => t + q.z, 0) / unique.length;
    /* The face is fan-triangulated, so its centre is a vertex too. A wall built from
       the centre would be a flap hanging through the middle of the skirt. */
    const reach = Math.max(...unique.map((q) => Math.hypot(q.x - cx, q.z - cz)));
    const corners = unique.filter((q) => Math.hypot(q.x - cx, q.z - cz) > reach * 0.4);
    corners.sort((a, b) => Math.atan2(a.z - cz, a.x - cx) - Math.atan2(b.z - cz, b.x - cx));
    return corners;
  };
  const before4 = mouthCorners();
  const mouth0 = new THREE.Box3(); for (const q of before4) mouth0.expandByPoint(q);
  const halfZ = (mouth0.max.z - mouth0.min.z) / 2;
  const tailZ = beltBox.max.z - halfZ - 0.150;          // clear of the tail roller
  const beltMidX = (beltBox.min.x + beltBox.max.x) / 2;
  const MOUTH_CLEAR = 0.060;
  const wantY = beltAt(tailZ - halfZ) + MOUTH_CLEAR;    // the belt's highest point under the mouth
  hopper.position.x += beltMidX - (mouth0.min.x + mouth0.max.x) / 2;
  hopper.position.z += tailZ - (mouth0.min.z + mouth0.max.z) / 2;
  hopper.position.y += wantY - mouth0.min.y;
  scene.updateMatrixWorld(true);

  /* Lowering the funnel brings its wide top grate down to the tank's mid-height, and
     the grate overhangs 2.4 m — it reached 134 mm inside the wall. Move the whole
     hopper further from the tank until nothing of it is inside, then check the mouth
     is still over the belt it feeds; a hopper that clears the tank by leaving the belt
     has traded one defect for another. */
  const hopperInside = () => {
    let deepest = 0;
    const v2 = new THREE.Vector3();
    const im2 = new THREE.Matrix4();
    for (const mesh of meshes(hopper)) {
      const pos = mesh.geometry.getAttribute('position');
      const copies = mesh.isInstancedMesh ? mesh.count : 1;
      for (let c = 0; c < copies; c += 1) {
        const w = mesh.isInstancedMesh
          ? new THREE.Matrix4().multiplyMatrices(mesh.matrixWorld, mesh.getMatrixAt(c, im2) ?? im2)
          : mesh.matrixWorld;
        for (let i = 0; i < pos.count; i += 1) {
          v2.fromBufferAttribute(pos, i).applyMatrix4(w);
          if (v2.y < tankBox.min.y || v2.y > tankBox.max.y) continue;
          const d = Math.hypot(v2.x - axis.x, v2.z - axis.z);
          if (d < radius) deepest = Math.max(deepest, radius - d);
        }
      }
    }
    return deepest;
  };
  const grateInside = hopperInside();
  if (grateInside > 0) {
    hopper.position.x -= grateInside + CLEARANCE;
    scene.updateMatrixWorld(true);
  }
  const seated = new THREE.Box3();
  for (const q of mouthCorners()) seated.expandByPoint(q);
  const onBelt = seated.min.x >= beltBox.min.x && seated.max.x <= beltBox.max.x;
  if (!onBelt) throw new Error('clearing the tank took the hopper mouth off the belt; the two constraints do not both fit');

  const ring = mouthCorners();
  const SKIRT_GAP = 0.025;
  const skirtColour = colourOf(hopperBody).clone().multiplyScalar(0.86);
  const skirt = new THREE.BufferGeometry();
  const verts = [];
  const index = [];
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const base = verts.length / 3;
    verts.push(a.x, a.y, a.z, b.x, b.y, b.z,
      b.x, beltAt(b.z) + SKIRT_GAP, b.z, a.x, beltAt(a.z) + SKIRT_GAP, a.z);
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  skirt.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  skirt.setIndex(index);
  skirt.computeVertexNormals();
  const skirtColours = new Float32Array((verts.length / 3) * 3);
  for (let i = 0; i < verts.length / 3; i += 1) {
    skirtColours[i * 3] = skirtColour.r; skirtColours[i * 3 + 1] = skirtColour.g; skirtColours[i * 3 + 2] = skirtColour.b;
  }
  skirt.setAttribute('color', new THREE.BufferAttribute(skirtColours, 3));
  const skirtMesh = addMesh(hopper, skirt, matOf(hopperBody), 'hopperSkirt');
  /* The geometry was built in world space; carry it into the parent's frame. */
  skirtMesh.applyMatrix4(new THREE.Matrix4().copy(hopper.matrixWorld).invert());

  /* Legs, outside the belt on both sides and clear of the tank, up into the funnel's
     flank where it is wide enough to meet them. */
  const legColour = colourOf(hopperBody).clone().multiplyScalar(0.70);
  const legTop = wantY + 0.50;
  const legXs = [beltBox.min.x - 0.140, Math.min(beltBox.max.x + 0.140, wallXOf(axis, radius, tailZ) - 0.120)];
  const legs = [];
  for (const [side, x] of [['L', legXs[0]], ['R', legXs[1]]]) {
    for (const [end, z] of [['F', tailZ + 0.470], ['B', tailZ - 0.470]]) {
      const leg = addMesh(hopper, boxGeo(0.080, legTop, 0.080, legColour), matOf(hopperBody), `hopperLeg${side}${end}`);
      hopper.worldToLocal(leg.position.set(x, legTop / 2, z));
      legs.push(`hopperLeg${side}${end}`);
    }
  }

  report.lineDirection = {
    why: 'the conveyor ran through the tank wall and the belt delivered nowhere; the conveyor moved clear, the belt now empties into a side inlet, and the hopper moved to the tail it should have been feeding',
    hopper: {
      wasOver: 'the head of the belt, 34 mm clear, unsupported',
      nowOver: 'the tail of the belt',
      mouthMm: [mm(mouth0.max.x - mouth0.min.x), mm(mouth0.max.z - mouth0.min.z)],
      mouthAboveBeltMm: mm(MOUTH_CLEAR),
      clearedTankByMm: mm(grateInside > 0 ? grateInside + CLEARANCE : 0),
      mouthStillOverBelt: onBelt,
      skirt: { walls: ring.length, gapToBeltMm: mm(SKIRT_GAP), why: 'the belt rises 550 mm across the mouth, so a flat rim cannot clear it at one height' },
      legs,
    },
    conveyorInsideTank: { verticesBefore: before.count, deepestMm: mm(before.deepest), verticesAfter: after.count },
    movedSidewaysMm: mm(shift),
    delivery: { chute: 'conveyorDeliveryChute', inlet: 'tankSideInlet', lengthMm: mm(chuteLength), heightMm: mm(chuteY) },
    stillOpen: 'the hopper sits where it was authored, above the belt it feeds; whether it should be a surge bin there or a feed bin at the tail is a design call, not a measurement',
  };
}

/* ---------------------------------------------------------------- 6. ground contact */
const root = node(scene, 'processing-root');
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
