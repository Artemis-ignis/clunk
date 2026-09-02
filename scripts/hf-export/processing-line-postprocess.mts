/**
 * Corrections applied to the exported Harvest Frontier processing line, AFTER
 * Harvest Frontier's own export and WITHOUT touching the Harvest Frontier
 * checkout.
 *
 * Every fix answers a defect measured on the file that is on sale
 * (numbers in outputs/audit/hf/hf-processing-line/):
 *
 *   1. A WHITE ROD THROUGH FOUR BOTTLE SHOULDERS. `bottleRailTop` (world
 *      z 1.280..1.360) and its two posts `bottleRailSupportA/B` sit on the same
 *      line as the bottles (bottle glass z 1.170..1.520, shoulders
 *      1.184..1.506), so the rail passes straight through every bottle and each
 *      post stands inside bottle 1 and bottle 6. The rail and its posts are
 *      translated 330 mm in +z -- BEHIND the bottles as the product camera sees
 *      them, so the bottles occlude the rail instead of the rail cutting them --
 *      and still land 200 mm inside the table's back edge.
 *
 *   2. THE BOTTLES DO NOT TOUCH THE TABLE. Measured: bottlingTable top face
 *      y = 1.2599 m, every bottleGlass base y = 1.2750 m -- the six bottles hang
 *      15.1 mm ABOVE the top, they are not sunk into it. Each productBottle
 *      group is dropped so its base bites 4 mm into the table top: contact, but
 *      not a coplanar face pair (which would be a z-fight).
 *
 *   3. THE BROWN BOX AT THE TABLE'S END is `bottleStopper` (b8894c, world
 *      x 2.690..2.810, y 1.300..1.540). Its base floats 40 mm over the table and
 *      its body is buried 76 mm inside bottleGlass_5. It is put ON THE TABLE TOP
 *      -- not on the floor -- because it is a member of the `bottleRail` group:
 *      it is the end-stop of the bottling line, and a line end-stop belongs on
 *      the line. It is moved outboard, clear of bottle 6, and dropped so it
 *      stands on the table with a 5 mm bite.
 *
 *   4. THE TAN SPHERE AND CROSS BESIDE THE TANK are `pumpHub` and
 *      `pumpVane1..4`. They are not orphans -- the chain is pumpBase ->
 *      pumpHousing -> pumpCover -> pumpPivot -> hub -> vanes -- but the vanes
 *      are cantilevered: each is a 260 mm rod whose node sits at local
 *      x = +0.13, i.e. it starts at the hub centre and hangs 130 mm PAST the
 *      hub (hub radius 120 mm) into open air, outboard of the tank silhouette.
 *      They are pulled back onto the hub centre.
 *
 *   5. THE AMBER PLANE ACROSS THE DECK is `foundationSafetyStripe`: 6.05 m x
 *      60 mm x 35 mm at y 0.2226..0.2574, hovering 12.8 mm above the deck top
 *      (0.2098) and running behind the table legs and both sides of the silo.
 *      It also produces 8 coplanar triangle pairs against bottlingLegLF/RF at
 *      0.1166 mm. Deleted.
 *
 *   6. DUPLICATED MESHES. `pumpVane1`/`pumpVane3` and `pumpVane2`/`pumpVane4`
 *      have IDENTICAL world boxes -- vane3 is vane1 rotated 180 deg about its
 *      OWN long axis, so the rotation is a no-op -- giving 516 coplanar
 *      triangle pairs at 0.0000 mm over 64,421 mm2, twice. vane3 and vane4 are
 *      deleted. The `hopperRimBar1..4` set is NOT a duplicate set: bars 1 and 2
 *      run along x at z = -1.33 / +0.97, bars 3 and 4 run along z at
 *      x = -3.50 / -1.20. They are the four sides of one rim and all four are
 *      full length, so the 718 coplanar pairs are the four CORNERS overlapping.
 *      Deleting two of them would leave a U. Bars 3 and 4 are shortened in z
 *      instead, until they stop 3 mm short of bars 1 and 2.
 *
 *   7. THE SILO LID GAP AND THE BLACK CRESCENT. `tankLid` is a full spheroid
 *      (r = 0 at y 4.404, r = 0.840 at y 4.690, r = 0 at y 4.976) hanging over
 *      `tankCone`, a true cone (r = 0.820 at y 4.130 up to r = 0 at y 4.770).
 *      Its underside is a bowl, so it touches the cone only inside r = 0.45 and
 *      its skirt hangs free from there out to r = 0.84. The lid is translated
 *      down as far as it can go while still enclosing the cone's apex. The
 *      black crescent is `tankHatch`, a flat 434 x 80 x 440 mm plate offset
 *      169.7 mm from the dome axis: inside r = 0.277 it is buried, outside it
 *      pokes out, and the part that pokes out is the crescent. It is moved onto
 *      the dome axis -- where the pipe actually enters -- and set so its rim is
 *      buried all the way round and its top face stands proud of the apex.
 *
 *   8. THE CONVEYOR DISCHARGES INTO A CRATE. The belt's low end (underside
 *      y 0.697 at z 2.132) and its end roller `mesh_39_instance_1`
 *      (y 0.504..1.169, z 1.711..2.375) run straight through `crateBody_1` and
 *      `crateBody_2`; the audit measures mesh_38_instance_2 150.9 mm inside
 *      crateBody_2 during `run`.
 *
 *   9. THE THREE CRATES INTERPENETRATE: crateBody / crateBody_1 overlap by
 *      402 x 520 x 661 mm, and crateBody_2 straddles both. All three are
 *      re-placed on the deck as a row plus one stack, with 4-5 mm between
 *      faces (a 0 mm touch is a coplanar pair, i.e. a z-fight).
 *
 *  10. GROUND. Lowest vertex -78.99 mm (`conveyorFootPlateL`). The root is
 *      raised so the lowest vertex sits on y = 0.
 *
 * Nothing else is touched: no material, no colour, no vertex colour, no clip
 * name, duration or key time.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  THREE, loadGlb, saveGlb, meshes, node, mesh, triangleCount, worldBox, sizeMm, mm,
  coincidentMeshes, removeNode, lowestY, seatOnGround, boxGapMm,
} from './fix-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const IN = process.argv[2] ?? path.join(REPO, 'examples/harvest-frontier/runtime-animated/processing.line.m1.glb');
const OUT = process.argv[3] ?? path.join(REPO, 'examples/harvest-frontier/runtime-animated/processing.line.fixed.glb');

const loaded = await loadGlb(IN);
const scene = loaded.scene;
const N = (name: string): THREE.Object3D => node(scene, name);
const M = (name: string): THREE.Mesh => mesh(scene, name);
const box = (name: string): THREE.Box3 => worldBox(N(name));
const arr = (b: THREE.Box3): number[][] => [b.min.toArray().map((v) => mm(v)), b.max.toArray().map((v) => mm(v))];
const report: Record<string, unknown> = {
  builtAt: new Date().toISOString(),
  input: path.relative(REPO, IN).replace(/\\/g, '/'),
  output: path.relative(REPO, OUT).replace(/\\/g, '/'),
};

/** Lowest / highest world vertex of one subtree, in metres (not the AABB). */
function extremeY(root: THREE.Object3D, want: 'min' | 'max'): number {
  root.updateMatrixWorld(true);
  let best = want === 'min' ? Infinity : -Infinity;
  const p = new THREE.Vector3();
  for (const m of meshes(root)) {
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 1) {
      const y = p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).y;
      best = want === 'min' ? Math.min(best, y) : Math.max(best, y);
    }
  }
  return best;
}

scene.updateMatrixWorld(true);
const before = {
  triangles: triangleCount(scene),
  meshes: meshes(scene).length,
  boundsM: sizeMm(worldBox(scene)).map((v) => +(v / 1000).toFixed(4)),
  groundMinYmm: mm(lowestY(scene)),
};

// ------------------------------------------------------- 1. the bottle rail
/*
 * The rail and its two posts are moved as one, in +z only. The product camera
 * sits on -z, so +z is BEHIND the bottles: they occlude the rail rather than
 * the rail cutting across them. The table runs z 0.710..1.890, so the move
 * leaves the posts 200 mm inside the table's back edge and 90 mm clear of the
 * nearest bottle. Nothing is rotated or resized.
 */
const RAIL_BEHIND = 0.33;
const railBefore = { rail: arr(box('bottleRailTop')), gapToBottle3Mm: boxGapMm(N('bottleRailTop'), N('productBottle3')) };
for (const name of ['bottleRailTop', 'bottleRailSupportA', 'bottleRailSupportB']) N(name).position.z += RAIL_BEHIND;
scene.updateMatrixWorld(true);
report.fix1_bottleRail = {
  movedNodes: ['bottleRailTop', 'bottleRailSupportA', 'bottleRailSupportB'],
  movedMm: [0, 0, RAIL_BEHIND * 1000],
  before: railBefore,
  after: { rail: arr(box('bottleRailTop')), gapToBottle3Mm: boxGapMm(N('bottleRailTop'), N('productBottle3')) },
  perBottleGapMm: [1, 2, 3, 4, 5, 6].map((i) => boxGapMm(N('bottleRailTop'), N(`productBottle${i}`))),
  postGapsMm: [
    boxGapMm(N('bottleRailSupportA'), N('productBottle1')),
    boxGapMm(N('bottleRailSupportB'), N('productBottle6')),
  ],
};

// --------------------------------------------------------- 2. seat the bottles
/*
 * Measured, not assumed: the table's top face and each bottle's lowest vertex.
 * The bottles are ABOVE the table, so they are dropped, and dropped 4 mm past
 * contact so the base disc is inside the table rather than coplanar with it.
 */
const BITE = 0.004;
const tableTop = extremeY(N('bottlingTable'), 'max');
const bottleFix: Record<string, unknown>[] = [];
for (let i = 1; i <= 6; i += 1) {
  const group = N(`productBottle${i}`);
  const glass = M(i === 1 ? 'bottleGlass' : `bottleGlass_${i - 1}`);
  const baseBefore = extremeY(glass, 'min');
  const drop = baseBefore - (tableTop - BITE);
  group.position.y -= drop;
  scene.updateMatrixWorld(true);
  bottleFix.push({
    bottle: `productBottle${i}`,
    tableTopMm: mm(tableTop),
    baseBeforeMm: mm(baseBefore),
    floatBeforeMm: mm(baseBefore - tableTop),
    droppedMm: mm(drop),
    baseAfterMm: mm(extremeY(glass, 'min')),
  });
}
report.fix2_bottleSeating = bottleFix;

// ----------------------------------------------------------- 3. the end-stop
/*
 * Outboard past bottle 6 in +x, and down onto the table with a 5 mm bite.
 * It stays on the table because it is part of the bottleRail group.
 */
const stopper = N('bottleStopper');
const stopBefore = {
  box: arr(box('bottleStopper')),
  insideBottle6Mm: mm(Math.max(0, box('bottleGlass_5').max.x - box('bottleStopper').min.x)),
  floatOverTableMm: mm(extremeY(stopper, 'min') - tableTop),
};
const bottle6MaxX = box('bottleGlass_5').max.x;
stopper.position.x += (bottle6MaxX + 0.034) - box('bottleStopper').min.x;
stopper.position.y -= extremeY(stopper, 'min') - (tableTop - 0.005);
scene.updateMatrixWorld(true);
report.fix3_bottleStopper = {
  choice: 'on the table top',
  why: 'bottleStopper is a child of the bottleRail group - it is the bottling line end-stop, so it belongs on the line, not on the floor',
  before: stopBefore,
  after: {
    box: arr(box('bottleStopper')),
    gapToBottle6Mm: boxGapMm(stopper, N('bottleGlass_5')),
    tableTopMm: mm(tableTop),
    baseMm: mm(extremeY(stopper, 'min')),
    insideTableEdgeMm: mm(box('bottlingTable').max.x - box('bottleStopper').max.x),
  },
};

// ------------------------------------------------ 6a. the duplicated vanes
/*
 * coincidentMeshes() finds the pairs by world box; the report records which
 * groups it found before anything is deleted, so the removal is never silent.
 */
const coincident = coincidentMeshes(scene).map((group) => ({
  meshes: group.map((m) => m.name),
  worldBox: arr(worldBox(group[0])),
  trianglesEach: group.map((m) => {
    const idx = m.geometry.getIndex();
    return (idx ? idx.count : m.geometry.getAttribute('position').count) / 3;
  }),
}));
const vaneTris = removeNode(scene, 'pumpVane3') + removeNode(scene, 'pumpVane4');

// ---------------------------------------------------------- 4. the pump vanes
/*
 * Each surviving vane is pulled from local x = 0.13 to x = 0, so the rod is
 * centred on the hub instead of hanging past it. Vane 2 keeps a 4 mm offset:
 * both rods run along the same axis and share their end-cap planes, which is a
 * 0 mm coplanar pair -- 4 mm puts it past the 2 mm z-fight threshold.
 */
const vaneBefore = { pumpVane1: arr(box('pumpVane1')), pumpVane2: arr(box('pumpVane2')), hub: arr(box('pumpHub')) };
const overhangBefore = mm(box('pumpVane1').max.x - box('pumpHub').max.x);
N('pumpVane1').position.x = 0;
N('pumpVane2').position.x = 0.004;
scene.updateMatrixWorld(true);
report.fix4_pumpVanes = {
  finding: 'not orphans: pumpHub sits on pumpCover, the vanes sit on pumpHub; the vanes were cantilevered outboard of the hub',
  overhangBeforeMm: overhangBefore,
  overhangAfterMm: mm(box('pumpVane1').max.x - box('pumpHub').max.x),
  before: vaneBefore,
  after: { pumpVane1: arr(box('pumpVane1')), pumpVane2: arr(box('pumpVane2')), hub: arr(box('pumpHub')) },
};

// ------------------------------------------------------- 5. the amber stripe
const stripeBefore = { box: arr(box('foundationSafetyStripe')), deckTopMm: mm(extremeY(N('processingFoundation'), 'max')) };
const stripeTris = removeNode(scene, 'foundationSafetyStripe');
report.fix5_safetyStripe = { deleted: 'foundationSafetyStripe', trianglesRemoved: stripeTris, before: stripeBefore };

// ------------------------------------------------------ 6b. the hopper rim
/*
 * Bars 3 and 4 run the full length in z and so overlap bars 1 and 2 by a whole
 * 120 mm section at each of the four corners. They are shortened in z until
 * they stop 3 mm short of the inner faces of bars 1 and 2. Nothing is deleted:
 * dropping two bars would leave a three-sided rim.
 */
const RIM_GAP = 0.003;
const innerBack = box('hopperRimBar1').max.z;
const innerFront = box('hopperRimBar2').min.z;
const rimBefore = { bar3: arr(box('hopperRimBar3')), bar4: arr(box('hopperRimBar4')) };
for (const name of ['hopperRimBar3', 'hopperRimBar4']) {
  const bar = N(name);
  const b = worldBox(bar);
  const centre = (b.min.z + b.max.z) / 2;
  const want = Math.min(innerFront - RIM_GAP - centre, centre - (innerBack + RIM_GAP));
  bar.scale.z *= want / ((b.max.z - b.min.z) / 2);
  scene.updateMatrixWorld(true);
}
report.fix6_duplicates = {
  coincidentGroupsFound: coincident,
  deletedNodes: ['pumpVane3', 'pumpVane4'],
  trianglesRemoved: vaneTris,
  hopperRim: {
    finding: 'hopperRimBar1..4 are the four sides of one rim, not four copies; the 718 coplanar pairs are the corners',
    action: 'hopperRimBar3 / hopperRimBar4 shortened in z, no geometry deleted',
    before: rimBefore,
    after: { bar3: arr(box('hopperRimBar3')), bar4: arr(box('hopperRimBar4')) },
    cornerGapsMm: [
      boxGapMm(N('hopperRimBar3'), N('hopperRimBar1')),
      boxGapMm(N('hopperRimBar3'), N('hopperRimBar2')),
      boxGapMm(N('hopperRimBar4'), N('hopperRimBar1')),
      boxGapMm(N('hopperRimBar4'), N('hopperRimBar2')),
    ],
  },
};

// ---------------------------------------------------- 7. the silo lid + hatch
/*
 * Both profiles are measured off the geometry, so the drop is solved, not
 * guessed: the lid goes down as far as it can while its apex still stands
 * APEX_CLEAR above the cone's apex, and the hatch is then placed on the dome
 * axis with its rim buried and its top face proud.
 */
const APEX_CLEAR = 0.016;
const HATCH_PROUD = 0.030;
const lid = N('tankLid');
const lidAxis = new THREE.Vector3().setFromMatrixPosition(lid.matrixWorld);
function radiusProfile(name: string): { y: number; r: number }[] {
  const m = M(name);
  const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  const rows = new Map<number, number>();
  for (let i = 0; i < pos.count; i += 1) {
    p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
    const y = +p.y.toFixed(4);
    const r = Math.hypot(p.x - lidAxis.x, p.z - lidAxis.z);
    rows.set(y, Math.max(rows.get(y) ?? 0, r));
  }
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([y, r]) => ({ y, r }));
}
/** Lid surface height at a radius, on the upper or the lower shell. */
function lidSurfaceAt(profile: { y: number; r: number }[], radius: number, shell: 'upper' | 'lower'): number {
  const equator = profile.reduce((best, row) => (row.r > best.r ? row : best), profile[0]);
  const half = profile.filter((row) => (shell === 'upper' ? row.y >= equator.y : row.y <= equator.y));
  const covering = half.filter((row) => row.r + 1e-9 >= radius);
  if (covering.length === 0) return equator.y;
  return shell === 'upper' ? Math.max(...covering.map((r) => r.y)) : Math.min(...covering.map((r) => r.y));
}
const coneProfile = radiusProfile('tankCone');
const coneApex = Math.max(...coneProfile.map((r) => r.y));
const lidProfileBefore = radiusProfile('tankLid');
const lidApexBefore = Math.max(...lidProfileBefore.map((r) => r.y));
const lidDrop = Math.max(0, lidApexBefore - (coneApex + APEX_CLEAR));
/** Where the lid's underside first leaves the cone, and how tall the slot is. */
function slotProfile(): { contactRadius: number; slotAtRimMm: number } {
  const lidP = radiusProfile('tankLid');
  const equator = lidP.reduce((best, row) => (row.r > best.r ? row : best), lidP[0]);
  // The cone carries only two vertex rings (base and apex), so its flank is
  // interpolated between them rather than read off a row.
  const base = coneProfile.reduce((best, row) => (row.r > best.r ? row : best), coneProfile[0]);
  const apexRow = { y: coneApex, r: 0 };
  const coneAt = (r: number): number =>
    (r > base.r ? -Infinity : apexRow.y + ((base.y - apexRow.y) * r) / base.r);
  let contact = 0;
  for (let r = 0; r <= equator.r; r += 0.005) {
    if (coneAt(r) >= lidSurfaceAt(lidP, r, 'lower')) contact = r;
  }
  const shoulder = radiusProfile('tankShoulder');
  const below = shoulder.filter((row) => row.r >= equator.r).map((row) => row.y);
  const solidTop = below.length ? Math.max(...below) : Math.max(...shoulder.map((r) => r.y));
  return { contactRadius: +contact.toFixed(3), slotAtRimMm: mm(equator.y - solidTop) };
}
const slotBefore = slotProfile();
for (const name of ['tankLid', 'tankLidRim']) N(name).position.y -= lidDrop;
scene.updateMatrixWorld(true);
const lidProfileAfter = radiusProfile('tankLid');
const lidApexAfter = Math.max(...lidProfileAfter.map((r) => r.y));
const slotAfter = slotProfile();

// the hatch: onto the dome axis, its window solved from the dome's own surface
const hatch = N('tankHatch');
const hatchBox0 = worldBox(hatch);
const hatchHalfX = (hatchBox0.max.x - hatchBox0.min.x) / 2;
const hatchHalfZ = (hatchBox0.max.z - hatchBox0.min.z) / 2;
const hatchHeight = hatchBox0.max.y - hatchBox0.min.y;
const hatchOffsetBefore = Math.hypot(
  (hatchBox0.min.x + hatchBox0.max.x) / 2 - lidAxis.x,
  (hatchBox0.min.z + hatchBox0.max.z) / 2 - lidAxis.z,
);
const hatchCornerR = Math.hypot(hatchHalfX, hatchHalfZ);
const domeAtCorner = lidSurfaceAt(lidProfileAfter, hatchCornerR, 'upper');
const hatchTop = lidApexAfter + HATCH_PROUD;
const hatchBottom = hatchTop - hatchHeight;
hatch.position.x += lidAxis.x - (hatchBox0.min.x + hatchBox0.max.x) / 2;
hatch.position.z += lidAxis.z - (hatchBox0.min.z + hatchBox0.max.z) / 2;
hatch.position.y += (hatchBottom + hatchHeight / 2) - (hatchBox0.min.y + hatchBox0.max.y) / 2;
scene.updateMatrixWorld(true);
const hatchBox1 = worldBox(hatch);
report.fix7_siloLid = {
  coneApexMm: mm(coneApex),
  lid: {
    apexBeforeMm: mm(lidApexBefore),
    droppedMm: mm(lidDrop),
    apexAfterMm: mm(lidApexAfter),
    apexClearanceOverConeMm: mm(lidApexAfter - coneApex),
    contactRadiusBeforeM: slotBefore.contactRadius,
    contactRadiusAfterM: slotAfter.contactRadius,
    slotAtRimBeforeMm: slotBefore.slotAtRimMm,
    slotAtRimAfterMm: slotAfter.slotAtRimMm,
    limit: 'the lid is a spheroid of max radius 840 mm and the cone base radius is 820 mm, so no translation can bring the lid rim onto the cone flank; the drop is capped by the cone apex it has to keep covered',
  },
  hatch: {
    offsetFromDomeAxisBeforeMm: mm(hatchOffsetBefore),
    offsetFromDomeAxisAfterMm: mm(Math.hypot(
      (hatchBox1.min.x + hatchBox1.max.x) / 2 - lidAxis.x,
      (hatchBox1.min.z + hatchBox1.max.z) / 2 - lidAxis.z,
    )),
    boxBefore: arr(hatchBox0),
    boxAfter: arr(hatchBox1),
    domeSurfaceAtHatchCornerMm: mm(domeAtCorner),
    burialUnderDomeAtCornerMm: mm(domeAtCorner - hatchBox1.min.y),
    proudOfApexMm: mm(hatchBox1.max.y - lidApexAfter),
  },
};

// ------------------------------------------------- 8 + 9. the shipping crates
/*
 * The crates are placed, not nudged, because every current position is wrong:
 * one is inside the conveyor, one is inside the other, and the third straddles
 * both. Every target below is derived from a measurement taken above:
 *
 *   deck top                       0.2098 m
 *   crate height                   0.520 m  -> a crate on the deck tops out at 0.730
 *   end roller mesh_39_instance_1  bottom 0.5043 m, z 1.711..2.375
 *
 * 0.5043 - 0.2098 = 294 mm of headroom under the discharge roller against a
 * 520 mm crate: a crate CANNOT stand under the roller. The front crate is
 * therefore put under the last run of the belt instead, stopped 11 mm short of
 * the roller in z, where the belt's underside is 973 mm up. That is as far
 * toward the discharge as a crate of this height can stand.
 *
 * In x it has to thread between the conveyor's own feet -- foot plates at
 * x -2.930..-2.510 and -1.530..-1.110 leave a 980 mm slot -- so shippingCrate2
 * loses its 4.6 deg yaw, which would have made it 976 mm wide and left 2 mm a
 * side. Square to the conveyor it is 920 mm wide with 30 mm a side.
 */
const deckTop = extremeY(N('processingFoundation'), 'max');
const crateBefore = {
  crateBody: arr(box('crateBody')),
  crateBody_1: arr(box('crateBody_1')),
  crateBody_2: arr(box('crateBody_2')),
  deckTopMm: mm(deckTop),
  crateBaseMm: mm(box('crateBody').min.y),
  floatOverDeckMm: mm(box('crateBody').min.y - deckTop),
  rollerBottomMm: mm(box('mesh_39_instance_1').min.y),
  headroomUnderRollerMm: mm(box('mesh_39_instance_1').min.y - deckTop),
  crateHeightMm: mm(box('crateBody_1').max.y - box('crateBody_1').min.y),
  overlapCrate1Crate2Mm: sizeMm(box('crateBody').clone().intersect(box('crateBody_1'))),
  beltInsideCrate3Mm: sizeMm(box('conveyorBelt').clone().intersect(box('crateBody_2'))),
  rollerInsideCrate2Mm: sizeMm(box('mesh_39_instance_1').clone().intersect(box('crateBody_1'))),
};

/** Move a crate group so its named body mesh lands where it is wanted. */
function placeCrate(group: string, body: string, target: { x?: number; y?: number; zMax?: number }): void {
  const g = N(group);
  const b = worldBox(M(body));
  if (target.x !== undefined) g.position.x += target.x - (b.min.x + b.max.x) / 2;
  if (target.y !== undefined) g.position.y += target.y - b.min.y;
  if (target.zMax !== undefined) g.position.z += target.zMax - b.max.z;
  scene.updateMatrixWorld(true);
}

const ROLLER_CLEAR = 0.011;
const CRATE_GAP = 0.005;
const STACK_GAP = 0.004;
// A crate whose base is exactly on the deck top has a face coplanar with it --
// 0 mm apart, parallel, overlapping, i.e. a z-fight. It bites in instead.
const DECK_BITE = 0.004;
// front crate: square to the conveyor, centred in the slot between the feet,
// stopped short of the end roller.
N('shippingCrate2').rotation.y = 0;
scene.updateMatrixWorld(true);
const slotCentreX = (box('conveyorFootPlateL').max.x + box('conveyorFootPlateR').min.x) / 2;
placeCrate('shippingCrate2', 'crateBody_1', {
  x: slotCentreX,
  y: deckTop - DECK_BITE,
  zMax: box('mesh_39_instance_1').min.z - ROLLER_CLEAR,
});
// back crate: behind the front one, its whole group (slats included) clear of it
{
  const front = worldBox(N('shippingCrate2'));
  placeCrate('shippingCrate1', 'crateBody', { x: slotCentreX, y: deckTop - DECK_BITE });
  const g = N('shippingCrate1');
  g.position.z += (front.min.z - CRATE_GAP) - worldBox(g).max.z;
  scene.updateMatrixWorld(true);
}
// stacked crate: on the back crate, centred on its body, off its top face
{
  const base = worldBox(M('crateBody'));
  placeCrate('shippingCrate3', 'crateBody_2', {
    x: (base.min.x + base.max.x) / 2,
    y: base.max.y + STACK_GAP,
  });
  const stacked = worldBox(M('crateBody_2'));
  N('shippingCrate3').position.z += (base.min.z + base.max.z) / 2 - (stacked.min.z + stacked.max.z) / 2;
  scene.updateMatrixWorld(true);
}
report.fix8_9_crates = {
  before: crateBefore,
  after: {
    crateBody: arr(box('crateBody')),
    crateBody_1: arr(box('crateBody_1')),
    crateBody_2: arr(box('crateBody_2')),
    baseOnDeckMm: [mm(box('crateBody').min.y), mm(box('crateBody_1').min.y), mm(deckTop)],
  },
  gapsMm: {
    frontToBack: boxGapMm(N('shippingCrate2'), N('shippingCrate1')),
    stackToBase: boxGapMm(N('shippingCrate3'), N('shippingCrate1')),
    stackToFront: boxGapMm(N('shippingCrate3'), N('shippingCrate2')),
    frontToEndRoller: boxGapMm(N('shippingCrate2'), N('mesh_39_instance_1')),
    frontToBelt: boxGapMm(N('shippingCrate2'), N('conveyorBelt')),
    frontToFootPlateL: boxGapMm(N('shippingCrate2'), N('conveyorFootPlateL')),
    frontToFootPlateR: boxGapMm(N('shippingCrate2'), N('conveyorFootPlateR')),
    frontToFootLegL: boxGapMm(N('shippingCrate2'), N('conveyorFootLegL')),
    frontToFootLegR: boxGapMm(N('shippingCrate2'), N('conveyorFootLegR')),
    stackToBelt: boxGapMm(N('shippingCrate3'), N('conveyorBelt')),
    stackToBrace17: boxGapMm(N('shippingCrate3'), N('conveyorBrace17')),
    backToTankFootLF: boxGapMm(N('shippingCrate1'), N('tankFootLF')),
  },
  whyNotUnderTheRoller: 'the deck-to-roller headroom is 294 mm and the crate is 520 mm tall; the crate is placed under the last belt run instead, 11 mm short of the roller',
};

// ------------------------------------------------------------- 10. the ground
const groundFix = seatOnGround(scene, N('processing-root'));
report.fix10_ground = { ...groundFix, lowestMesh: 'conveyorFootPlateL' };

scene.updateMatrixWorld(true);
const after = {
  triangles: triangleCount(scene),
  meshes: meshes(scene).length,
  boundsM: sizeMm(worldBox(scene)).map((v) => +(v / 1000).toFixed(4)),
  groundMinYmm: mm(lowestY(scene)),
};
report.before = before;
report.after = after;
report.trianglesRemoved = before.triangles - after.triangles;

await saveGlb(OUT, loaded);
fs.writeFileSync(OUT.replace(/\.glb$/, '.report.json'), JSON.stringify(report, null, 2));
process.stdout.write(`${JSON.stringify(report, null, 2)}\nwrote ${OUT}\n`);
