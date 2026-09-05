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
  quatTrack, vecTrack, setTrack,
  tubeBetween, boxSpan, moveBoxCentreTo, spinAboutWorld, radiusAbout, boxOverlap,
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

  /* 2026-09-05, PROPORTION. Measured on this file: the hopper's top grate is 2,700 x 1,980 mm
     and its rim 2,420 mm square, over a belt 1,520 mm wide and beside a tank 2,000 mm across.
     The bin that feeds the line was the widest thing in the product — wider than the tank it
     fills. Scaled to 0.80, so the rim is 1,936 mm: still overhanging the belt, which is what a
     feed bin does, but no longer larger than the vessel. Everything below measures the hopper
     after this, so the skirt and the legs are built to the size it actually is. */
  const HOPPER_SCALE = 0.80;
  const hopperBefore = exactBox(hopper).getSize(new THREE.Vector3());
  hopper.scale.multiplyScalar(HOPPER_SCALE);
  scene.updateMatrixWorld(true);

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
  /* 벨트의 윗면. 상자 두 귀퉁이를 잇는 직선은 슬래브의 두께만큼 낮아, 그 선에 맞춰
     스커트를 내리면 스커트가 벨트에 잠긴다. 벨트 자신의 꼭짓점을 z 로 나눠 담고 각
     칸에서 가장 높은 y 를 쓴다. */
  const beltTop = (() => {
    const bins = new Map();
    const v3 = new THREE.Vector3();
    const im3 = new THREE.Matrix4();
    for (const mesh of meshes(belt)) {
      const pos = mesh.geometry.getAttribute('position');
      const copies = mesh.isInstancedMesh ? mesh.count : 1;
      for (let c = 0; c < copies; c += 1) {
        const w = mesh.isInstancedMesh
          ? new THREE.Matrix4().multiplyMatrices(mesh.matrixWorld, mesh.getMatrixAt(c, im3) ?? im3)
          : mesh.matrixWorld;
        for (let i = 0; i < pos.count; i += 1) {
          v3.fromBufferAttribute(pos, i).applyMatrix4(w);
          const key = Math.round(v3.z * 20);
          bins.set(key, Math.max(bins.get(key) ?? -Infinity, v3.y));
        }
      }
    }
    const keys = [...bins.keys()].sort((x, y) => x - y);
    return (z) => {
      const k = z * 20;
      let below = keys[0];
      let above = keys[keys.length - 1];
      for (const key of keys) { if (key <= k) below = key; if (key >= k) { above = key; break; } }
      if (below === above) return bins.get(below);
      const t = (k - below) / (above - below);
      return bins.get(below) + t * (bins.get(above) - bins.get(below));
    };
  })();
  const beltAt = (z) => beltTop(z);
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
  /* 벨트 윗면을 상자나 구간 보간으로 추정하면 슬래브 두께만큼 낮게 잡혀 스커트가 벨트에
     잠긴다 — 두 번 다르게 추정했고 두 번 다 잠겼다. 추정을 그만두고, 벨트의 실제 면에
     대고 광선을 쏘아 밖으로 나올 때까지 5 mm 씩 올린다. */
  const beltFaces = (() => {
    const tris = [];
    const im4 = new THREE.Matrix4();
    for (const mesh of meshes(belt)) {
      const pos = mesh.geometry.getAttribute('position');
      const idx = mesh.geometry.getIndex();
      const copies = mesh.isInstancedMesh ? mesh.count : 1;
      for (let c = 0; c < copies; c += 1) {
        const w = mesh.isInstancedMesh
          ? new THREE.Matrix4().multiplyMatrices(mesh.matrixWorld, mesh.getMatrixAt(c, im4) ?? im4)
          : mesh.matrixWorld;
        const n = idx ? idx.count : pos.count;
        for (let i = 0; i < n; i += 3) {
          tris.push([0, 1, 2].map((k) => new THREE.Vector3()
            .fromBufferAttribute(pos, idx ? idx.getX(i + k) : i + k).applyMatrix4(w)));
        }
      }
    }
    return tris;
  })();
  const insideBelt = (x, y, z) => {
    let crossings = 0;
    for (const [a, b, c] of beltFaces) {
      const d = (b.y - c.y) * (a.z - c.z) - (b.z - c.z) * (a.y - c.y);
      if (Math.abs(d) < 1e-12) continue;
      const u = ((b.y - c.y) * (z - c.z) - (b.z - c.z) * (y - c.y)) / d;
      const v = ((c.y - a.y) * (z - c.z) - (c.z - a.z) * (y - c.y)) / d;
      const w2 = 1 - u - v;
      if (u < 0 || v < 0 || w2 < 0) continue;
      if (u * a.x + v * b.x + w2 * c.x > x) crossings += 1;
    }
    return crossings % 2 === 1;
  };
  /** 벨트 밖에서 가장 낮은 자리. 스커트의 아래 모서리는 여기에 놓인다. */
  const clearOfBelt = (x, z) => {
    let y = beltAt(z) + SKIRT_GAP;
    for (let step = 0; step < 200 && insideBelt(x, y, z); step += 1) y += 0.005;
    return y;
  };
  const skirtColour = colourOf(hopperBody).clone().multiplyScalar(0.86);
  const skirt = new THREE.BufferGeometry();
  const verts = [];
  const index = [];
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const base = verts.length / 3;
    verts.push(a.x, a.y, a.z, b.x, b.y, b.z,
      b.x, clearOfBelt(b.x, b.z), b.z, a.x, clearOfBelt(a.x, a.z), a.z);
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

  /* Legs, outside the belt on both sides and clear of the tank.
   *
   * 2026-09-05: they used to be four vertical posts stopping at mouth + 500 mm, which is
   * where the funnel is 1,132 mm wide — and the posts stood 1,800 mm apart. Their tops were
   * in mid-air beside the funnel, holding nothing. Each leg now runs from its foot to the
   * nearest point of the hopper's own rim, so it ends ON the thing it carries. The two on
   * the belt's right lean inward, because the belt leaves no floor under the rim there. */
  const legColour = colourOf(hopperBody).clone().multiplyScalar(0.70);
  const rimBox = worldBox(node(scene, 'hopperRim'));
  const legXs = [beltBox.min.x - 0.140, Math.min(beltBox.max.x + 0.140, wallXOf(axis, radius, tailZ) - 0.120)];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const legs = [];
  for (const [side, x] of [['L', legXs[0]], ['R', legXs[1]]]) {
    for (const [end, z] of [['F', tailZ + 0.470], ['B', tailZ - 0.470]]) {
      const topX = clamp(x, rimBox.min.x + 0.060, rimBox.max.x - 0.060);
      const topZ = clamp(z, rimBox.min.z + 0.060, rimBox.max.z - 0.060);
      tubeBetween(hopper.parent, matOf(hopperBody), legColour,
        [x, 0, z], [topX, rimBox.max.y - 0.020, topZ], 0.045, `hopperLeg${side}${end}`, 8);
      legs.push(`hopperLeg${side}${end}`);
    }
  }

  /* ------------------------------------------------- THE BELT RUNS THE WRONG WAY.
   *
   * 2026-09-05, measured on this file. `conveyor-module` is tilted 33.2 degrees about x, so
   * its local +z points DOWN the slope: world (0, -0.548, +0.836). Every beltMark track runs
   * local z upward with time — from -1,460 to +1,340 mm, four times over the clip — so the
   * belt surface travels down the slope, from the tank end toward the hopper.
   *
   * The hopper discharges at world z 1,162..1,982 (the low end) and the delivery chute is at
   * world z -600..-80, 2.5 m up (the high end). The 2026-09-04 pass moved the hopper to that
   * low end and built the chute at the high end without touching the belt animation, so the
   * belt has been carrying away from the tank it feeds ever since.
   *
   * The pulleys were already right: rotating +local y turns their world -x axle so the top
   * surface goes up the slope. It is the marks that are reversed here.
   *
   * And they did not agree on speed either. The marks moved 11,200 mm per clip = 1,350 mm/s;
   * the pulleys turned 5.000 rev of a 479 mm drum = 906 mm/s of belt. A third of the belt's
   * travel was not coming from the pulleys. Both are re-derived from one number now: the
   * pulley turns a whole 7 revolutions per clip (so its keyframes close exactly), and the
   * marks are re-pitched so their travel is that same distance to the millimetre. */
  {
    const beltTravel = (() => {
      const rollers = ['conveyorRollerA', 'conveyorRollerB'].map((name) => {
        const pivot = node(scene, name);
        const centre = new THREE.Vector3().setFromMatrixPosition(pivot.matrixWorld);
        /* The node's rest orientation is what puts its local y on the world axle; the clip has
           to be written on top of it, not instead of it, or a 1.6 m drum spins about the belt's
           normal like a turntable. */
        const rest = pivot.quaternion.clone();
        const axle = new THREE.Vector3(0, 1, 0).transformDirection(pivot.matrixWorld).normalize();
        /* Measure the drum, not the stripes welded 8 mm proud of it: the belt rides the drum. */
        const drum = pivot.children.find((c) => c.isMesh && !/Stripe/.test(c.name || ''));
        return { name, pivot, rest, radius: radiusAbout(drum, centre, axle), axle };
      });
      /* Both drums are the same casting; take the one the belt actually wraps. */
      const radius = Math.max(...rollers.map((r) => r.radius));
      const REVOLUTIONS = 7;                       // whole turns, so the quaternion closes
      const travel = REVOLUTIONS * 2 * Math.PI * radius;

      const beltNormal = new THREE.Vector3(0, 1, 0).transformDirection(conveyor.matrixWorld).normalize();
      const downSlope = new THREE.Vector3(0, 0, 1).transformDirection(conveyor.matrixWorld).normalize();
      const upSlope = downSlope.clone().negate();
      const KEYS = 85;
      const times = Array.from({ length: KEYS }, (_, i) => (i / (KEYS - 1)) * run.duration);
      const rollerReport = [];
      for (const { name, radius: r, axle, rest } of rollers) {
        /* omega x r at the top of the drum has to point up the slope. */
        const surface = new THREE.Vector3().crossVectors(axle, beltNormal);
        const sign = surface.dot(upSlope) >= 0 ? 1 : -1;
        const values = new Float32Array(times.length * 4);
        const spin = new THREE.Quaternion();
        for (let i = 0; i < times.length; i += 1) {
          const angle = sign * 2 * Math.PI * REVOLUTIONS * (times[i] / run.duration);
          spin.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
          const q = rest.clone().multiply(spin);
          values[i * 4] = q.x; values[i * 4 + 1] = q.y; values[i * 4 + 2] = q.z; values[i * 4 + 3] = q.w;
        }
        setTrack(run, name, 'quaternion',
          new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, Float32Array.from(times), values));
        rollerReport.push({ roller: name, radiusMm: mm(r), revolutionsPerClip: REVOLUTIONS, sign,
          surfaceSpeedMmPerS: Math.round((2 * Math.PI * r * REVOLUTIONS / run.duration) * 1000) });
      }

      /* Seven marks tile a window of seven pitches; the travel has to be a whole number of
         pitches or the marks land somewhere else at the loop. Pick the smallest number of
         pitches that keeps the window inside the belt. */
      const beltLocal = (() => {
        const inv = new THREE.Matrix4().copy(conveyor.matrixWorld).invert();
        const box = new THREE.Box3();
        const v = new THREE.Vector3();
        for (const mesh of meshes(belt)) {
          const pos = mesh.geometry.getAttribute('position');
          for (let i = 0; i < pos.count; i += 1) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv));
        }
        return box;
      })();
      const MARKS = 7;
      const ROLLER_MARGIN = 0.130;                 // keep the marks off the drums
      const windowMax = (beltLocal.max.z - beltLocal.min.z) - 2 * ROLLER_MARGIN;
      let steps = Math.ceil((MARKS * travel) / windowMax);
      const pitch = travel / steps;
      const windowZ = MARKS * pitch;
      const zTop = (beltLocal.min.z + beltLocal.max.z) / 2 + windowZ / 2;
      const speed = travel / run.duration;

      for (let i = 0; i < MARKS; i += 1) {
        const name = `beltMark${i + 1}`;
        const old = run.tracks.find((t) => t.name === `${name}.position`);
        const x = old ? old.values[0] : 0;
        const y = old ? old.values[1] : 0.180;
        const offset = i * pitch;
        /* z(t) = zTop - ((offset + speed*t) mod window): up the slope, wrapping at the head. */
        const ts = [0];
        const zs = [zTop - (offset % windowZ)];
        let wrapAt = (windowZ - (offset % windowZ)) / speed;
        while (wrapAt < run.duration - 1e-6) {
          ts.push(wrapAt, wrapAt);
          zs.push(zTop - windowZ, zTop);
          wrapAt += windowZ / speed;
        }
        ts.push(run.duration);
        zs.push(zTop - ((offset + speed * run.duration) % windowZ));
        setTrack(run, name, 'position', vecTrack(name, 'position', ts, zs.map((z) => [x, y, z])));
      }
      return {
        why: 'the belt surface travelled away from the tank it feeds, and its speed did not come from its own pulleys',
        marksTravelledMm: { before: 11200, after: mm(travel) },
        beltSpeedMmPerS: { before: 1350, after: Math.round(speed * 1000) },
        pulleySurfaceSpeedMmPerS: { before: 906, after: Math.round(speed * 1000) },
        markPitchMm: mm(pitch), markWindowMm: mm(windowZ), pitchesPerClip: steps,
        directionBefore: 'down the slope, toward the hopper', directionAfter: 'up the slope, toward the tank inlet',
        rollers: rollerReport,
      };
    })();
    report.beltDirection = beltTravel;
  }

  report.lineDirection = {
    why: 'the conveyor ran through the tank wall and the belt delivered nowhere; the conveyor moved clear, the belt now empties into a side inlet, and the hopper moved to the tail it should have been feeding',
    hopperScale: { factor: HOPPER_SCALE, wasMm: hopperBefore.toArray().map(mm), nowMm: exactBox(hopper).getSize(new THREE.Vector3()).toArray().map(mm), beltWidthMm: mm(beltBox.max.x - beltBox.min.x) },
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

/* ------------------------------------------------- 5b. three more measured defects */
/* 2026-09-04, found by scripts/asset-geometry-audit.mjs once it had a narrow phase. */
{
  const report5b = {};

  /* THE BOTTLING TABLE FLOATS ABOVE ITS OWN LEGS. The four legs top out at y 1.139 and
     the table's underside is 1.179 — a 40 mm gap — and their feet stop 19 mm above the
     floor. Each leg is stretched to span floor to table. */
  const table = worldBox(node(scene, 'bottlingTable'));
  const legFix = [];
  for (const name of ['bottlingLegLB', 'bottlingLegLF', 'bottlingLegRB', 'bottlingLegRF']) {
    const leg = node(scene, name);
    const box = worldBox(leg);
    const want = table.min.y;                       // up into the table, down to the floor
    const factor = want / (box.max.y - box.min.y);
    leg.scale.y *= factor;
    leg.updateMatrixWorld(true);
    const after = worldBox(leg);
    leg.position.y -= after.min.y - 0;               // seat it on the floor
    leg.updateMatrixWorld(true);
    legFix.push({ name, wasMm: [mm(box.min.y), mm(box.max.y)], nowMm: [0, mm(want)] });
  }
  scene.updateMatrixWorld(true);
  report5b.bottlingLegs = { why: 'the table stood 40 mm clear of its own legs and the legs stopped 19 mm above the floor', legs: legFix };

  /* THE MIXER DRIVE HEAD IS INSIDE THE PIPE IT STANDS BESIDE. Pass 4 put a shaft and a
     coupling on the tank apex so the mixer's turning could be seen from outside — and
     `pipeTopRise` rises through exactly that spot, y 4.579..5.199, swallowing all of it.
     A visible indicator nobody can see is the defect it was meant to cure. The head is
     lifted until the coupling stands above the pipe. */
  /* 2026-09-05: lifting was the wrong half of the answer. The top loop runs straight over the
     tank's apex — `pipeTopRise` up the mixer's own axis, `pipeTopReturn` across it 900 mm
     higher — so clearing one put the head inside the other (the hub was 80 mm inside
     pipeTopReturn). The loop moves 350 mm along z first, off the mixer axis and clear of the
     tank hatch, and the head is then lifted only as far as it still needs. */
  const LOOP_SHIFT = 0.350;
  const loopParts = ['pipeOverhead', 'pipeLowerLoopRise', 'pipeTopRise', 'pipeTopReturn', 'pipeTopDrop'];
  for (const name of loopParts) node(scene, name).position.z += LOOP_SHIFT;
  scene.updateMatrixWorld(true);
  const headParts = ['mixerDriveShaft', 'mixerDriveHub', 'mixerDriveCoupling'];
  const headBox = new THREE.Box3();
  for (const name of headParts) headBox.union(exactBox(node(scene, name)));
  let lift = 0;
  for (const name of loopParts) {
    const pipe = exactBox(node(scene, name));
    const clashes = pipe.max.x > headBox.min.x && pipe.min.x < headBox.max.x
      && pipe.max.z > headBox.min.z && pipe.min.z < headBox.max.z;
    if (clashes) lift = Math.max(lift, (pipe.max.y + 0.060) - headBox.min.y);
  }
  if (lift > 0) {
    for (const name of headParts) {
      const part = node(scene, name);
      if (name === 'mixerDriveShaft') part.scale.y *= (worldBox(part).max.y - worldBox(part).min.y + lift) / (worldBox(part).max.y - worldBox(part).min.y);
      part.position.y += lift;
    }
    scene.updateMatrixWorld(true);
  }
  report5b.mixerDriveHead = {
    why: 'the drive head added so the mixer can be seen running stood inside pipeTopRise, and after the 2026-09-04 lift, inside pipeTopReturn',
    loopMovedAlongZmm: mm(LOOP_SHIFT), liftedMm: mm(Math.max(0, lift)),
  };

  /* THE TANK'S OUTLET HANDWHEEL IS A RING ROUND THE PIPE ITSELF.
   *
   * 2026-09-05. `valveWheel` is a torus of outer diameter 505 mm whose centre sits exactly ON
   * the outlet pipe's axis (x -450, y 799) at z 1,320 — so its rim crosses that axis at
   * z 1,502..1,572, and any pipe leaving the valve runs through the wheel. It is also 290 mm
   * inside `pumpMotor`. It moves onto a stem above the valve body, where a handwheel goes:
   * the pipe axis is then clear and the same `valveWheelPivot` track turns it about the stem,
   * because the pivot is rotated so its local x — the axis the clip already spins — is up. */
  const valveBody = node(scene, 'valveBody');
  const valveBodyBox = worldBox(valveBody);
  const wheelPivot = node(scene, 'valveWheelPivot');
  const wheelWas = worldBox(node(scene, 'valveWheel'));
  const wheelHalf = (wheelWas.max.z - wheelWas.min.z) / 2;
  const stemBottom = valveBodyBox.max.y;
  const stemTop = stemBottom + 0.120;
  spinAboutWorld(wheelPivot, [0, 0, 1], Math.PI / 2, wheelWas.getCenter(new THREE.Vector3()));
  moveBoxCentreTo(wheelPivot, [
    (valveBodyBox.min.x + valveBodyBox.max.x) / 2,
    stemTop,
    (valveBodyBox.min.z + valveBodyBox.max.z) / 2,
  ]);
  const stemX = (valveBodyBox.min.x + valveBodyBox.max.x) / 2;
  const stemZ = (valveBodyBox.min.z + valveBodyBox.max.z) / 2;
  tubeBetween(node(scene, 'tankValve'), matOf(valveBody), colourOf(valveBody),
    [stemX, stemBottom - 0.030, stemZ], [stemX, stemTop + 0.020, stemZ], 0.034, 'valveStem', 10);
  /* The wheel is a torus: a stem up its middle passes through the hole and touches nothing, so
     the inspector still called it a floating part. It gets the hub a handwheel has, turning
     with it, wide enough to reach the rim. */
  const wheelInner = (() => {
    let smallest = Infinity;
    const v = new THREE.Vector3();
    const centre = exactBox(wheelPivot).getCenter(new THREE.Vector3());
    for (const m of meshes(wheelPivot)) {
      const pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i += 1) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).sub(centre);
        smallest = Math.min(smallest, Math.hypot(v.x, v.z));
      }
    }
    return smallest;
  })();
  tubeBetween(wheelPivot, matOf(valveBody), colourOf(valveBody).clone().multiplyScalar(0.9),
    [stemX, stemTop - 0.016, stemZ], [stemX, stemTop + 0.016, stemZ], wheelInner + 0.014, 'valveWheelHub', 12);
  scene.updateMatrixWorld(true);
  report5b.valveHandwheel = {
    why: 'the handwheel was a ring centred on the outlet pipe\'s own axis, so its rim crossed the bore, and it stood 290 mm inside the pump motor',
    wasCentreMm: wheelWas.getCenter(new THREE.Vector3()).toArray().map(mm),
    nowCentreMm: exactBox(wheelPivot).getCenter(new THREE.Vector3()).toArray().map(mm),
    stem: 'valveStem', wheelOuterRadiusMm: mm(wheelHalf),
  };

  /* THE PUMP IS INSIDE THE TANK — AND INSIDE THE TANK'S OUTLET VALVE.
   *
   * `pumpHousing` put 48 of its 383 vertices 180 mm inside the tank body. The 2026-09-04 pass
   * pushed it 226 mm along z, which cleared the tank and left `valveBody` 290 mm inside
   * `pumpMotor` and `valvePipe` 114 mm inside it — the tank's own outlet was buried in the
   * machine that is supposed to draw from it.
   *
   * It moves once, far enough to be clear of everything at 50 mm, and along -x as well so the
   * casing is centred on the outlet valve's axis and the suction line is a straight run. The
   * distance is searched, not guessed: every part of the pump is boxed against every other
   * part of the machine at each step. */
  const service = node(scene, 'service-network');
  const movableLater = new Set(['pipeFeed', 'pipeReturn', 'pipeTransfer', 'pipeUnionValve']);
  const serviceMeshes = new Set(meshes(service));
  const others = meshes(scene).filter((m) => !serviceMeshes.has(m) && !movableLater.has(m.name));
  const otherBoxes = others.map((m) => ({ name: m.name, box: exactBox(m) }));
  const CLEAR_5B = 0.050;
  const servicePos = service.position.clone();
  const clashOf = (dx, dz) => {
    service.position.set(servicePos.x + dx, servicePos.y, servicePos.z + dz);
    scene.updateMatrixWorld(true);
    for (const m of serviceMeshes) {
      const b = exactBox(m).expandByScalar(CLEAR_5B);
      for (const o of otherBoxes) if (b.intersectsBox(o.box)) return `${m.name} x ${o.name}`;
    }
    return null;
  };
  const PUMP_DX = -0.320;                          // casing centred near the outlet valve's x, motor clear of the suction spool
  let pumpDz = null;
  for (let dz = 0; dz <= 1.400; dz += 0.010) {
    if (!clashOf(PUMP_DX, dz)) { pumpDz = dz; break; }
  }
  if (pumpDz === null) throw new Error('no clear place for the pump along z');
  clashOf(PUMP_DX, pumpDz);
  /* And its plinth was floating: `pumpBase` sat 319 mm above the floor with a 60 mm gap
     to the pump it was carrying. Stretched to stand on the floor and meet the pump. */
  const base = node(scene, 'pumpBase');
  const baseBox = worldBox(base);
  const pumpAfter = worldBox(node(scene, 'pumpHousing'));
  const baseWant = pumpAfter.min.y;
  base.scale.y *= baseWant / (baseBox.max.y - baseBox.min.y);
  base.updateMatrixWorld(true);
  base.position.y -= worldBox(base).min.y;
  scene.updateMatrixWorld(true);
  report5b.pump = {
    why: 'the pump casing stood inside the tank body, the tank\'s outlet valve stood inside the pump motor, and the plinth floated 319 mm above the floor',
    movedMm: [mm(PUMP_DX), 0, mm(pumpDz)],
    clearanceMm: mm(CLEAR_5B),
    housingBoxMm: exactBox(node(scene, 'pumpHousing')).min.toArray().map(mm)
      .concat(exactBox(node(scene, 'pumpHousing')).max.toArray().map(mm)),
    plinth: { wasMm: [mm(baseBox.min.y), mm(baseBox.max.y)], nowMm: [0, mm(baseWant)] },
  };

  report.measuredDefects = report5b;
}

/* ------------------------------------------- 5c. the bottling bench becomes a conveyor */
/* 2026-09-05. What the file called a filling line was a flat metal bench 2,250 x 1,180 mm with
 * six bottles standing on it, one rail along the far side, and a stop plate. Nothing above the
 * bottles, nothing under them, and in the 8.30 s clip not one of them moves — the only thing
 * that happens at the bottling end of a bottling machine is a lamp glowing.
 *
 * The bench becomes what it is drawn to be: a belt with two end drums, a bed, guide rails on
 * both sides of the bottles, and the bottles riding it. The drum diameter is not chosen for
 * looks — it is 2 x pitch x 3 / 4pi, the size at which two thirds of a turn carries the belt
 * exactly one station pitch, so the drums and the bottles and the belt marks all close
 * together at the end of the clip. */
const station = {};
{
  const bottling = node(scene, 'bottling-module');
  const railGroup = node(scene, 'bottleRail');
  const table = node(scene, 'bottlingTable');
  const tableBox = worldBox(table);
  const bottleNames = ['productBottle1', 'productBottle2', 'productBottle3', 'productBottle4', 'productBottle5', 'productBottle6'];
  const bottleGroups = bottleNames.map((n) => node(scene, n));
  const bottleBoxes = bottleGroups.map((b) => exactBox(b));
  const centresX = bottleBoxes.map((b) => (b.min.x + b.max.x) / 2).sort((a, b) => a - b);
  const PITCH = (centresX[centresX.length - 1] - centresX[0]) / (centresX.length - 1);
  const bottleDia = bottleBoxes[0].max.x - bottleBoxes[0].min.x;
  const bottleHeight = bottleBoxes[0].max.y - bottleBoxes[0].min.y;

  /* one pitch per clip = two thirds of a drum turn */
  const ROLLER_R = (PITCH * 3) / (4 * Math.PI);
  const rollerY = tableBox.max.y + ROLLER_R;
  const beltTopY = tableBox.max.y + 2 * ROLLER_R;
  const rollerAX = tableBox.min.x + ROLLER_R;
  const rollerBX = tableBox.max.x - ROLLER_R;
  const z0 = (tableBox.min.z + tableBox.max.z) / 2 + 0.045;     // the line the bottles run on
  const SIDE_GAP = 0.044;
  const beltHalf = bottleDia / 2 + SIDE_GAP;
  const deckFrom = rollerAX + ROLLER_R;
  const deckTo = rollerBX - ROLLER_R;

  /* The row sweeps (six bottles at pitch) + one pitch + one diameter. Centre that on the table
     so no bottle is ever off the belt, at any moment of the clip. */
  const swept = bottleGroups.length * PITCH + bottleDia;
  const firstX = tableBox.min.x + (tableBox.max.x - tableBox.min.x - swept) / 2 + bottleDia / 2;

  const metal = matOf(node(scene, 'bottlingTable'));
  const matte = matOf(node(scene, 'conveyorRailLeft'));
  const rubber = matOf(node(scene, 'conveyorBelt'));
  const frameColour = colourOf(node(scene, 'conveyorRailLeft'));
  const beltColour = colourOf(node(scene, 'conveyorBelt'));

  /* bed and belt, between the two drums */
  boxSpan(bottling, matte, frameColour.clone().multiplyScalar(0.9),
    [deckFrom, tableBox.max.y, z0 - beltHalf], [deckTo, beltTopY - 0.030, z0 + beltHalf], 'bottleBeltBed');
  boxSpan(bottling, rubber, beltColour,
    [deckFrom, beltTopY - 0.030, z0 - beltHalf], [deckTo, beltTopY, z0 + beltHalf], 'bottleBeltSurface');

  /* the two drums, each on its own node so the clip can turn it */
  const drumColour = colourOf(node(scene, 'bottlingTable'));
  const stripeColour = drumColour.clone().multiplyScalar(0.28);
  const KEYS_R = 25;
  const timesR = Array.from({ length: KEYS_R }, (_, i) => (i / (KEYS_R - 1)) * run.duration);
  const drums = [['bottleRollerA', rollerAX], ['bottleRollerB', rollerBX]];
  for (const [name, x] of drums) {
    const pivot = new THREE.Object3D();
    pivot.name = name;
    bottling.add(pivot);
    bottling.updateMatrixWorld(true);
    pivot.position.copy(bottling.worldToLocal(new THREE.Vector3(x, rollerY, z0)));
    pivot.updateMatrixWorld(true);
    const drum = cylGeo(ROLLER_R, ROLLER_R, beltHalf * 2 + 0.060, 14, drumColour);
    drum.rotateX(Math.PI / 2);                                  // axle along z, like the belt's
    addMesh(pivot, drum, metal, `${name}Drum`, [0, 0, 0]);
    for (let i = 0; i < 3; i += 1) {
      const angle = (i / 3) * Math.PI * 2;
      const bar = boxGeo(0.024, 0.010, beltHalf * 2 + 0.040, stripeColour);
      const m = addMesh(pivot, bar, metal, `${name}Stripe${i + 1}`, [0, 0, 0]);
      m.position.set(Math.sin(angle) * (ROLLER_R - 0.003), Math.cos(angle) * (ROLLER_R - 0.003), 0);
      m.rotation.z = -angle;
    }
    /* the top of the drum has to travel the way the bottles do, +x */
    setTrack(run, name, 'quaternion', quatTrack(name, timesR,
      timesR.map((t) => [0, 0, -(2 / 3) * 2 * Math.PI * (t / run.duration)])));
  }

  /* two guide rails, one either side of the bottles, on four posts off the table.
     `bottleStopper` — a plate the bottles would now drive straight through — is re-cut as the
     near rail, and the two authored rail posts become two of the four. */
  const railY = [beltTopY + 0.172, beltTopY + 0.252];
  const railZ = [z0 - (beltHalf + 0.040), z0 + (beltHalf + 0.040)];
  const resizeTo = (object, size) => {
    const box = exactBox(object);
    const now = box.getSize(new THREE.Vector3());
    object.scale.set(
      object.scale.x * (size[0] / now.x), object.scale.y * (size[1] / now.y), object.scale.z * (size[2] / now.z));
    object.updateMatrixWorld(true);
    return object;
  };
  const railLength = rollerBX - rollerAX;
  const railParts = [['bottleRailTop', railZ[1]], ['bottleStopper', railZ[0]]];
  node(scene, 'bottleStopper').name = 'bottleGuideRailNear';
  for (const [name, z] of railParts) {
    const rail = node(scene, name === 'bottleStopper' ? 'bottleGuideRailNear' : name);
    resizeTo(rail, [railLength, railY[1] - railY[0], 0.080]);
    moveBoxCentreTo(rail, [(rollerAX + rollerBX) / 2, (railY[0] + railY[1]) / 2, z]);
  }
  /* The old stop plate was brass; a pair of guide rails either side of the same line that are
     two different colours reads as two different parts. Repaint it as the rail it now is. */
  {
    const railColour = colourOf(node(scene, 'bottleRailTop'));
    const near = node(scene, 'bottleGuideRailNear');
    const attribute = near.geometry.getAttribute('color');
    for (let i = 0; i < attribute.count; i += 1) attribute.setXYZ(i, railColour.r, railColour.g, railColour.b);
    attribute.needsUpdate = true;
  }
  const postXs = [rollerAX + railLength * 0.16, rollerAX + railLength * 0.84];
  const postSize = [0.080, railY[0] - tableBox.max.y, 0.080];
  const authoredPosts = ['bottleRailSupportA', 'bottleRailSupportB'];
  let authored = 0;
  const posts = [];
  for (const z of railZ) {
    for (const x of postXs) {
      const wanted = [x, tableBox.max.y + postSize[1] / 2, z];
      if (authored < authoredPosts.length) {
        const post = node(scene, authoredPosts[authored]);
        resizeTo(post, postSize);
        moveBoxCentreTo(post, wanted);
        posts.push(authoredPosts[authored]);
        authored += 1;
      } else {
        const name = `bottleRailPost${posts.length + 1}`;
        boxSpan(railGroup, metal, colourOf(node(scene, 'bottleRailTop')),
          [x - postSize[0] / 2, tableBox.max.y, z - postSize[2] / 2],
          [x + postSize[0] / 2, railY[0], z + postSize[2] / 2], name);
        posts.push(name);
      }
    }
  }

  /* the bottles ride the belt: one node, one pitch per clip, wrapping. Six identical bottles
     at one pitch means the arrangement at the end of the clip is the arrangement at the
     start, so the loop does not read as a jump. */
  const train = new THREE.Object3D();
  train.name = 'bottleTrain';
  bottling.add(train);
  bottling.updateMatrixWorld(true);
  const order = bottleGroups
    .map((g, i) => ({ g, x: (bottleBoxes[i].min.x + bottleBoxes[i].max.x) / 2 }))
    .sort((a, b) => a.x - b.x);
  order.forEach(({ g }, i) => {
    const keep = g.matrixWorld.clone();
    train.add(g);
    train.updateMatrixWorld(true);
    g.matrix.copy(new THREE.Matrix4().copy(train.matrixWorld).invert().multiply(keep));
    g.matrix.decompose(g.position, g.quaternion, g.scale);
    g.updateMatrixWorld(true);
    const box = exactBox(g);
    moveBoxCentreTo(g, [
      firstX + i * PITCH,
      (box.min.y + box.max.y) / 2 + (beltTopY - box.min.y),
      z0,
    ]);
  });

  /* belt marks, in the two strips of belt the bottles never stand on, so they can be proud of
     the surface without a bottle sitting on one. Half a pitch apart: one clip carries two. */
  const markZ = [[z0 - beltHalf, z0 - bottleDia / 2 - 0.008], [z0 + bottleDia / 2 + 0.008, z0 + beltHalf]];
  const markPitch = PITCH / 2;
  let markCount = 0;
  for (let x = firstX - PITCH / 4; x < deckTo - 0.030; x += markPitch) {
    if (x < deckFrom + 0.030) continue;
    markCount += 1;
    for (let s = 0; s < 2; s += 1) {
      boxSpan(train, matte, frameColour.clone().multiplyScalar(1.25),
        [x - 0.010, beltTopY - 0.002, markZ[s][0]], [x + 0.010, beltTopY + 0.010, markZ[s][1]],
        `bottleBeltMark${markCount}${s === 0 ? 'F' : 'B'}`);
    }
  }
  bottling.updateMatrixWorld(true);
  const trainRest = train.position.clone();
  setTrack(run, 'bottleTrain', 'position', vecTrack('bottleTrain', 'position', [0, run.duration],
    [[trainRest.x, trainRest.y, trainRest.z], [trainRest.x + PITCH, trainRest.y, trainRest.z]]));
  scene.updateMatrixWorld(true);

  Object.assign(station, {
    pitch: PITCH, bottleDia, bottleHeight, z0, beltTopY, rollerR: ROLLER_R,
    rollerAX, rollerBX, deckFrom, deckTo, beltHalf, tableTopY: tableBox.max.y,
    firstX, bottleTopY: beltTopY + bottleHeight,
    stations: bottleGroups.map((_, i) => firstX + i * PITCH),
    railZ, railY,
  });
  report.bottleConveyor = {
    why: 'the bottling end was a flat bench: no belt, no rails, nothing over the bottles, and in an 8.30 s clip not one bottle moved',
    pitchMm: mm(PITCH),
    drumDiameterMm: mm(2 * ROLLER_R),
    drumTurnPerClip: '2/3 revolution — exactly one station pitch of belt',
    beltTopMm: mm(beltTopY),
    beltWidthMm: mm(beltHalf * 2),
    beltRunMm: [mm(deckFrom), mm(deckTo)],
    bottlesTravelMm: mm(PITCH),
    bottleRestXmm: [mm(firstX), mm(firstX + (bottleGroups.length - 1) * PITCH)],
    bottleSweptXmm: [mm(firstX - bottleDia / 2), mm(firstX + bottleGroups.length * PITCH + bottleDia / 2)],
    tableXmm: [mm(tableBox.min.x), mm(tableBox.max.x)],
    guideRails: { parts: ['bottleRailTop', 'bottleStopper (re-cut from the old stop plate)'], zMm: railZ.map(mm), yMm: railY.map(mm) },
    posts, marks: markCount * 2,
  };
}

/* ------------------------------------------------ 5d. the pump is wired into the line */
/* 2026-09-05. The pump had no pipe on either side of it. `pipeFeed` was a 404 mm stub with
 * 200 mm of itself inside the casing and nothing on its far end; `pipeReturn` was a riser that
 * started in mid-air; `pipeTransfer` and `pipeUnionValve` ran through the bottling table, one
 * of its legs and the control post. Nothing joined the tank to the pump, and nothing joined
 * either of them to the bottles, which is why the bottles could not be filled by anything.
 *
 * The four authored pipes are kept and re-seated on the line they were drawn for:
 *   tank cone outlet -> valve -> pipeFeed (suction) -> pump
 *   pump -> pipeReturn (riser) -> pipeUnionValve -> pipeTransfer (elbow) -> header
 *   header -> six nozzles, one over each station, 45 mm above the bottle mouths. */
{
  const metal = matOf(node(scene, 'mixerShaft'));
  const pipes = node(scene, 'pipeNetwork');
  const pipeColour = colourOf(node(scene, 'pipeReturn'));
  const housing = exactBox(node(scene, 'pumpHousing'));
  const valveBodyBox = exactBox(node(scene, 'valveBody'));
  const valvePipeBox = exactBox(node(scene, 'valvePipe'));
  const valveAxis = {
    x: (valvePipeBox.min.x + valvePipeBox.max.x) / 2,
    y: (valvePipeBox.min.y + valvePipeBox.max.y) / 2,
  };
  const housingCentre = { x: (housing.min.x + housing.max.x) / 2, z: (housing.min.z + housing.max.z) / 2 };

  /* a. suction: the tank's outlet valve to the pump's casing */
  const suction = node(scene, 'pipeFeed');
  spinAboutWorld(suction, [0, 1, 0], -Math.PI / 2, exactBox(suction).getCenter(new THREE.Vector3()));
  moveBoxCentreTo(suction, [valveAxis.x, valveAxis.y, (valveBodyBox.max.z + housing.min.z) / 2]);
  const suctionBox = exactBox(suction);
  const flangeR = 0.150;
  for (const [z, name] of [[valveBodyBox.max.z, 'suctionFlangeValve'], [housing.min.z, 'suctionFlangePump']]) {
    tubeBetween(pipes, metal, pipeColour.clone().multiplyScalar(0.85),
      [valveAxis.x, valveAxis.y, z - 0.020], [valveAxis.x, valveAxis.y, z + 0.020], flangeR, name, 12);
  }

  /* b. discharge: casing top -> riser -> union -> elbow -> header over the bottles */
  const riser = node(scene, 'pipeReturn');
  const riserSize = exactBox(riser).getSize(new THREE.Vector3());
  /* 25 mm INTO the casing, not resting on it: a riser whose end face is exactly tangent to the
     casing's top reads to the checker as a separate assembly, and the whole filler end of the
     machine then counts as a body standing on its own. */
  moveBoxCentreTo(riser, [housingCentre.x, housing.max.y + riserSize.y / 2 - 0.025, housingCentre.z]);
  const riserBox = exactBox(riser);
  const headerY = riserBox.max.y - 0.100;
  const headerR = 0.090;

  const union = node(scene, 'pipeUnionValve');
  moveBoxCentreTo(union, [housingCentre.x, (housing.max.y + riserBox.max.y) / 2, housingCentre.z]);

  /* the elbow that brings the riser over the bottle line */
  const elbow = node(scene, 'pipeTransfer');
  spinAboutWorld(elbow, [0, 1, 0], Math.PI / 2, exactBox(elbow).getCenter(new THREE.Vector3()));
  /* The spool is 678 mm and the run from the riser to the bottle line is 475, so it has to
     overshoot one end. Overshoot into the riser, not out over the tank, or the machine grows an
     open pipe mouth pointing at nothing. */
  const elbowDepth = exactBox(elbow).getSize(new THREE.Vector3()).z;
  moveBoxCentreTo(elbow, [housingCentre.x, headerY, station.z0 + elbowDepth / 2]);

  const headerFrom = housingCentre.x;
  const headerTo = station.stations[station.stations.length - 1] + station.pitch * 0.55;
  tubeBetween(pipes, metal, pipeColour, [headerFrom, headerY, station.z0], [headerTo, headerY, station.z0],
    headerR, 'fillerHeader', 14);

  /* c. one nozzle per station. 45 mm of daylight over the bottle mouths. */
  const tipY = station.bottleTopY + 0.045;
  const nozzles = [];
  for (let i = 0; i < station.stations.length; i += 1) {
    const x = station.stations[i];
    tubeBetween(pipes, metal, pipeColour.clone().multiplyScalar(0.9),
      [x, headerY - headerR + 0.010, station.z0], [x, tipY + 0.055, station.z0], 0.030, `fillerNozzle${i + 1}`, 10);
    tubeBetween(pipes, metal, pipeColour.clone().multiplyScalar(0.7),
      [x, tipY + 0.060, station.z0], [x, tipY, station.z0], 0.017, `fillerNozzleTip${i + 1}`, 8);
    nozzles.push({ station: i + 1, xMm: mm(x), tipYmm: mm(tipY), overBottleMouthMm: mm(tipY - station.bottleTopY) });
  }

  /* d. the header is 2.7 m of pipe; it stands on two posts off the bottling table, outside
        the belt, with a short arm over to the pipe itself. */
  const postZ = station.railZ[0] - 0.080;          // outside the near guide rail, not through it
  const hangerXs = [station.stations[0] - station.pitch * 0.45, headerTo - 0.060];
  const hangers = [];
  for (let i = 0; i < hangerXs.length; i += 1) {
    const x = hangerXs[i];
    tubeBetween(pipes, metal, pipeColour.clone().multiplyScalar(0.8),
      [x, station.tableTopY, postZ], [x, headerY, postZ], 0.032, `fillerHangerPost${i + 1}`, 8);
    tubeBetween(pipes, metal, pipeColour.clone().multiplyScalar(0.8),
      [x, headerY, postZ], [x, headerY, station.z0], 0.028, `fillerHangerArm${i + 1}`, 8);
    hangers.push(`fillerHangerPost${i + 1}`);
  }
  scene.updateMatrixWorld(true);

  report.plumbing = {
    why: 'the pump had no pipe on either side of it and the bottles had nothing over them',
    suction: {
      part: 'pipeFeed (re-seated and turned onto the outlet axis)',
      fromMm: mm(valveBodyBox.max.z), toMm: mm(housing.min.z),
      spoolZmm: [mm(suctionBox.min.z), mm(suctionBox.max.z)],
      intoValveMm: mm(valveBodyBox.max.z - suctionBox.min.z),
      intoCasingMm: mm(suctionBox.max.z - housing.min.z),
      flanges: ['suctionFlangeValve', 'suctionFlangePump'],
    },
    discharge: {
      riser: { part: 'pipeReturn', yMm: [mm(riserBox.min.y), mm(riserBox.max.y)], onCasingTopMm: mm(housing.max.y) },
      union: 'pipeUnionValve', elbow: 'pipeTransfer',
      headerYmm: mm(headerY), headerXmm: [mm(headerFrom), mm(headerTo)], headerZmm: mm(station.z0),
      hangers,
    },
    nozzles,
  };
}

/* ------------------------------------- 5e. the control panel stands up and is wired in */
/* Its post stopped 279 mm above the floor and its foot floated at 299 mm, so the whole panel
 * hung in the air beside the tank; the post also ran 70 mm through the bottling table it stood
 * against; and nothing ran from it to the machine it controls. */
{
  const panel = node(scene, 'control-panel');
  const pole = node(scene, 'controlPole');
  const foot = node(scene, 'controlFoot');
  const tableEdge = worldBox(node(scene, 'bottlingTable')).min.z;
  const panelBefore = exactBox(panel);
  const panelStep = Math.max(0, panelBefore.max.z - (tableEdge - 0.060));
  panel.position.z -= panelStep;
  panel.updateMatrixWorld(true);
  scene.updateMatrixWorld(true);
  const poleBox = worldBox(pole);
  const footBox = worldBox(foot);
  pole.scale.y *= poleBox.max.y / (poleBox.max.y - poleBox.min.y);
  pole.updateMatrixWorld(true);
  pole.position.y -= worldBox(pole).min.y;
  foot.position.y -= footBox.min.y;
  panel.updateMatrixWorld(true);
  scene.updateMatrixWorld(true);

  const body = worldBox(node(scene, 'controlPanelBody'));
  /* the beacon and its base stood 19.6 mm above the panel top, holding on to nothing */
  const beaconGap = exactBox(node(scene, 'controlBeaconBase')).min.y - body.max.y;
  if (beaconGap > 0) {
    for (const name of ['controlBeaconBase', 'controlBeacon']) node(scene, name).position.y -= beaconGap;
    scene.updateMatrixWorld(true);
  }
  const motor = exactBox(node(scene, 'pumpMotor'));
  const matte = matOf(node(scene, 'conveyorRailLeft'));
  const conduitColour = colourOf(node(scene, 'controlPole')).clone().multiplyScalar(0.55);
  const poleNow = worldBox(pole);
  const runX = (poleNow.min.x + poleNow.max.x) / 2;
  const runZ = poleNow.max.z + 0.020;
  const lowY = 0.250;
  const motorX = (motor.min.x + motor.max.x) / 2 - (motor.max.x - motor.min.x) * 0.29;
  /* The straight line from the panel to the motor passes under the tank. Run it at a height
     that is below the tank's shell and still inside the motor's own face. */
  const motorY = Math.min((motor.min.y + motor.max.y) / 2,
    exactBox(node(scene, 'tankBody')).min.y - 0.050);
  const legsOf = [
    [[runX, body.min.y, runZ], [runX, lowY, runZ], 'controlConduitDrop'],
    [[runX, lowY, runZ], [motorX, lowY, runZ], 'controlConduitFloor'],
    [[motorX, lowY, runZ], [motorX, motorY, runZ], 'controlConduitRise'],
    [[motorX, motorY, runZ], [motorX, motorY, motor.min.z], 'controlConduitToMotor'],
  ];
  for (const [a, b, name] of legsOf) tubeBetween(panel, matte, conduitColour, a, b, 0.025, name, 8);
  scene.updateMatrixWorld(true);
  report.controlPanel = {
    why: 'the post stopped 279 mm above the floor, its foot floated at 299 mm, and no conduit left the panel',
    poleNowMm: [mm(worldBox(pole).min.y), mm(worldBox(pole).max.y)],
    footNowMm: [mm(worldBox(foot).min.y), mm(worldBox(foot).max.y)],
    movedOffTheTableMm: mm(panelStep),
    beaconDroppedMm: mm(Math.max(0, beaconGap)),
    conduit: legsOf.map(([, , name]) => name),
    conduitEndsOnMm: [mm(motorX), mm(motorY), mm(motor.min.z)],
  };
}

/* ------------------------------- 5f. three things that were resting on nothing */
/* These were always here; the 2026-09-04 file hid them because `conveyorRollerA/B` were turning
 * about the belt's normal instead of their own axle, so a 1.6 m drum swept through half the
 * machine every clip and the checker read everything it passed through as "supported". With the
 * drums turning on their axles the three come back out:
 *   - the three shipping crates hover 284.8 mm above the floor,
 *   - both control buttons and the display are entirely INSIDE the panel body — bought, drawn,
 *     and invisible,
 *   - the pump's end cover stops 10 mm short of the casing it covers. */
{
  const floats = {};
  const crates = node(scene, 'shipping-crates');
  const crateBox = exactBox(crates);
  crates.position.y -= crateBox.min.y;
  scene.updateMatrixWorld(true);
  /* And the second crate stood 60 mm off the stack it belongs to, so the three staged crates
     read as two separate piles. Slid up against the first. */
  const stack = exactBox(node(scene, 'shippingCrate1'));
  const loose = node(scene, 'shippingCrate2');
  const crateGap = exactBox(loose).min.z - stack.max.z;
  if (crateGap > 0) { loose.position.z -= crateGap + 0.020; scene.updateMatrixWorld(true); }
  floats.crates = {
    wasMm: mm(crateBox.min.y), nowMm: mm(exactBox(crates).min.y),
    secondCrateClosedMm: mm(Math.max(0, crateGap + 0.020)),
  };

  /* The console's face is not vertical: measured on its own vertices it stands at z 608 mm at
     y 1,660 and leans back to z 471 mm at y 2,790. The buttons and the display were placed on a
     flat face that is not there — the display hung 91 mm in front of the panel, the buttons sat
     inside it. Each one is re-seated on the face at its own height. */
  const bodyMesh = node(scene, 'controlPanelBody');
  const faceZAt = (() => {
    const v = new THREE.Vector3();
    const pos = bodyMesh.geometry.getAttribute('position');
    let lo = null; let hi = null;
    const box = exactBox(bodyMesh);
    const mid = (box.min.y + box.max.y) / 2;
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i).applyMatrix4(bodyMesh.matrixWorld);
      const bucket = v.y < mid ? 'lo' : 'hi';
      const best = bucket === 'lo' ? lo : hi;
      if (!best || v.z > best.z) { if (bucket === 'lo') lo = { y: v.y, z: v.z }; else hi = { y: v.y, z: v.z }; }
    }
    return (y) => lo.z + (hi.z - lo.z) * ((y - lo.y) / (hi.y - lo.y));
  })();
  const seated = [];
  for (const name of ['controlButton1', 'controlButton2', 'controlDisplay']) {
    const part = node(scene, name);
    const box = exactBox(part);
    const wantMax = faceZAt((box.min.y + box.max.y) / 2) + (box.max.z - box.min.z) * 0.45;
    part.position.z += wantMax - box.max.z;
    seated.push({ name, movedMm: mm(wantMax - box.max.z), faceZmm: mm(faceZAt((box.min.y + box.max.y) / 2)) });
  }
  scene.updateMatrixWorld(true);
  {
    const glow = node(scene, 'controlDisplayGlow');
    const display = exactBox(node(scene, 'controlDisplay'));
    const box = exactBox(glow);
    const want = display.max.z - 0.004;
    glow.position.z += want - box.min.z;
    seated.push({ name: 'controlDisplayGlow', movedMm: mm(want - box.min.z), onto: 'controlDisplay' });
  }
  scene.updateMatrixWorld(true);
  floats.panelFace = { faceZmm: [mm(faceZAt(1.66)), mm(faceZAt(2.79))], parts: seated };

  const cover = node(scene, 'pumpCover');
  const casing = exactBox(node(scene, 'pumpHousing'));
  const coverBox = exactBox(cover);
  const close = coverBox.min.x - casing.max.x;
  if (close > 0) { cover.position.x -= close + 0.020; scene.updateMatrixWorld(true); }
  floats.pumpCover = { gapWasMm: mm(Math.max(0, close)), gapNowMm: mm(exactBox(cover).min.x - casing.max.x) };

  report.restingOnNothing = {
    why: 'a drum turning about the wrong axis swept through the machine and made the checker read three unsupported groups as supported',
    ...floats,
  };
}

/* --------------------------------------------- 5g. a band that gripped nothing */
{
  const band = node(scene, 'tankUpperBand');
  const tank = exactBox(node(scene, 'tankBody'));
  const axis = new THREE.Vector3((tank.min.x + tank.max.x) / 2, 0, (tank.min.z + tank.max.z) / 2);
  /* The tank is not a cylinder. Measured: 1,000.1 mm across at y 829 and 940.0 mm at y 4,089 —
     a 60 mm taper over its height. At the band's own height the shell is 947.9 mm, and the
     band's inner ring is 980 mm, which is the 31.9 mm the inspector reported. Fit the shell's
     radius against height off its own vertices and pull the band onto it. */
  const tankBodyNode = node(scene, 'tankBody');
  const tankR = radiusAbout(tankBodyNode, axis, [0, 1, 0]);
  const shellRadiusAt = (() => {
    const samples = [];
    const v = new THREE.Vector3();
    for (const m of meshes(tankBodyNode)) {
      const pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i += 1) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        const r = Math.hypot(v.x - axis.x, v.z - axis.z);
        if (r > tankR * 0.5) samples.push([v.y, r]);       // skip the cap fan centres
      }
    }
    const n = samples.length;
    const sy = samples.reduce((t, s) => t + s[0], 0);
    const sr = samples.reduce((t, s) => t + s[1], 0);
    const syy = samples.reduce((t, s) => t + s[0] * s[0], 0);
    const syr = samples.reduce((t, s) => t + s[0] * s[1], 0);
    const slope = (n * syr - sy * sr) / (n * syy - sy * sy);
    const intercept = (sr - slope * sy) / n;
    return (y) => intercept + slope * y;
  })();
  const innerRadius = (object) => {
    let smallest = Infinity;
    const v = new THREE.Vector3();
    for (const m of meshes(object)) {
      const pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i += 1) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        smallest = Math.min(smallest, Math.hypot(v.x - axis.x, v.z - axis.z));
      }
    }
    return smallest;
  };
  const before = radiusAbout(band, axis, [0, 1, 0]);
  const beforeInner = innerRadius(band);
  const centre = exactBox(band).getCenter(new THREE.Vector3());
  const shellHere = shellRadiusAt(centre.y);
  const wanted = (shellHere - 0.012) / beforeInner;
  /* The band is authored flat in its own xy plane and laid down by a -90 degree turn about x,
     so its LOCAL z is the world vertical and its local x and y are the two radial axes. Scale
     the two that lie in the floor plane, or the ring comes out an ellipse. */
  const radialAxes = [['x', new THREE.Vector3(1, 0, 0)], ['y', new THREE.Vector3(0, 1, 0)], ['z', new THREE.Vector3(0, 0, 1)]]
    .filter(([, v]) => Math.abs(v.clone().transformDirection(band.matrixWorld).y) < 0.5)
    .map(([k]) => k);
  if (radialAxes.length !== 2) throw new Error(`tankUpperBand: ${radialAxes.length} radial axes, expected 2`);
  for (const k of radialAxes) band.scale[k] *= wanted;
  band.updateMatrixWorld(true);
  moveBoxCentreTo(band, centre);
  report.tankUpperBand = {
    why: 'the inspector measured it 31.9 mm clear of the tank it is a band round — it touched nothing',
    outerRadiusMm: { before: mm(before), after: mm(radiusAbout(band, axis, [0, 1, 0])) },
    innerRadiusMm: { before: mm(beforeInner), after: mm(innerRadius(band)) },
    tankShellRadiusHereMm: mm(shellHere),
    tankTaperMm: [mm(shellRadiusAt(exactBox(tankBodyNode).min.y)), mm(shellRadiusAt(exactBox(tankBodyNode).max.y))],
  };
}

/* ------------------------------------------- 5h. where every added part actually ended up */
/* Written before the merge, because after it there are no part names left to measure. */
{
  const added = {};
  const wanted = [
    'conveyorRollerAStripe1', 'conveyorRollerAStripe2', 'conveyorRollerAStripe3',
    'conveyorRollerBStripe1', 'conveyorRollerBStripe2', 'conveyorRollerBStripe3',
    'mixerDriveShaft', 'mixerDriveHub', 'mixerDriveCoupling',
    'hopperSkirt', 'hopperLegLF', 'hopperLegLB', 'hopperLegRF', 'hopperLegRB',
    'conveyorDeliveryChute', 'tankSideInlet', 'valveStem', 'valveWheelHub',
    'pipeFeed', 'suctionFlangeValve', 'suctionFlangePump',
    'pipeReturn', 'pipeUnionValve', 'pipeTransfer', 'fillerHeader',
    'fillerNozzle1', 'fillerNozzle2', 'fillerNozzle3', 'fillerNozzle4', 'fillerNozzle5', 'fillerNozzle6',
    'fillerNozzleTip1', 'fillerNozzleTip6', 'fillerHangerPost1', 'fillerHangerArm1',
    'fillerHangerPost2', 'fillerHangerArm2',
    'bottleBeltBed', 'bottleBeltSurface', 'bottleRollerADrum', 'bottleRollerBDrum',
    'bottleRailTop', 'bottleGuideRailNear', 'bottleRailSupportA', 'bottleRailSupportB',
    'bottleRailPost3', 'bottleRailPost4',
    'productBottle1', 'productBottle2', 'productBottle3', 'productBottle4', 'productBottle5', 'productBottle6',
    'bottleBeltMark1F', 'bottleBeltMark12B',
    'controlConduitDrop', 'controlConduitFloor', 'controlConduitRise', 'controlConduitToMotor',
    'controlPole', 'controlFoot', 'tankUpperBand', 'pumpBase', 'pumpHousing', 'pumpMotor', 'pumpCover',
  ];
  for (const name of wanted) {
    const found = scene.getObjectByName(name);
    if (!found) continue;
    const box = exactBox(found);
    added[name] = { minMm: box.min.toArray().map(mm), maxMm: box.max.toArray().map(mm) };
  }
  report.partPositions = added;
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
