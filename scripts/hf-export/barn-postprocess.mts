/**
 * Corrections applied to the exported barn, AFTER Harvest Frontier's own export
 * and WITHOUT touching the Harvest Frontier checkout.
 *
 * Measured on the file that is on sale (outputs/audit/hf/hf-barn/):
 *
 *   1. BOTH GABLE ENDS ARE OPEN. The four walls stop at y = 4.80 m and the roof
 *      underside starts at 4.847 m at the eaves and climbs to the ridge, so at
 *      z = +-3.2 there is a triangular hole the full width of the barn. From
 *      dead ahead you look straight through the building and see the far roof
 *      slope; from three-quarters you see an empty interior. A game that only
 *      ever shows one side of a barn can afford that. A GLB a buyer rotates
 *      cannot. Each end is closed with a slab in the barn's OWN wall material,
 *      its top edge stepped to follow the measured roof underside so it can
 *      never poke through the roof.
 *
 *   2. THE CORNERS ARE A DOUBLED SKIN. `barnRearWall` spans x -4.2..4.2 and
 *      `barnLeftWall` / `barnRightWall` also reach x = -+4.2, so at each corner
 *      two outer faces land on the same plane: 250 coplanar triangle pairs at a
 *      minimum separation of 0.0021 mm over 1.81 m^2, and the same again for
 *      `barnUpperFront`. That is 1.8 square metres of guaranteed flicker on any
 *      real GPU. The rear wall and the upper front are narrowed until their end
 *      faces finish 5 mm INSIDE the side walls, where nothing can see them.
 *
 *   3. THE DOOR LEAVES SHIP TWICE. `barnbatch2` holds four welded lumps at two
 *      positions: [-3.666, 0.701, 2.220] and [2.634, 0.701, 2.220], each
 *      1032 x 1958 x 880 mm, each present twice with identical bounds. Half of
 *      that mesh is a duplicate nobody can see and everybody downloads.
 *
 *   4. A BLANK PANEL SITS ON THE GABLE. `barnSignboard` (plus its back face) is
 *      a 2720 x 820 x 4 mm two-triangle plane with no texture and no lettering,
 *      reading as an unfinished cream rectangle on the front gable.
 *
 * Deliberately NOT changed, on instruction: the corner posts keep their own
 * colour, the plank striping stays as authored, and no material is added,
 * removed or recoloured anywhere.
 *
 * ---------------------------------------------------------------------------
 * 2026-09-03, second pass (measured on the file then on sale):
 *
 *   5. THE GLASS IS IN THE MULLIONS' OWN PLANE. `windowPane` sits 0.0915 mm
 *      from `barnbatch0`'s window bars and `windowPane_1` 0.0761 mm, over
 *      405.97 + 310.76 = 716.73 cm^2 of same-facing overlap: two windows of
 *      guaranteed stipple on any depth buffer. Both panes are pushed 6 mm along
 *      their own thin axis AWAY from the barn, which is the direction that
 *      keeps them inside their frame's rebate -- pushing them inward instead
 *      would take `windowPane` 1.2 mm out through the back of its frame posts.
 *
 *   6. THE OPEN BAY IS AN EMPTY BOX. The barn's front is open the full width
 *      and 3.5 m high, and behind it are a floor slab, a rear wall and one
 *      beam: from three-quarters the eye reaches the back wall with nothing in
 *      between, so the building reads as a facade. A hay loft over the rear
 *      2.04 m, the two posts that carry it, a ladder up to it and six straw
 *      bales are added -- 200 triangles, no new material, every colour taken
 *      from a part the barn already ships. Every new box BUTTS its neighbour
 *      exactly; nothing overlaps, so no crossing triangle and no same-facing
 *      coplanar pair is created.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  THREE, loadGlb, saveGlb, mesh, node, lumps, deleteLumps, removeNode,
  triangleCount, worldBox, sizeMm, mm, coincidentMeshes,
  averageColour, buildBoxes, paneClearance, type BoxSpec,
} from './fix-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const IN = process.argv[2] ?? path.join(REPO, 'examples/harvest-frontier/exports/building/barn.glb');
const OUT = process.argv[3] ?? path.join(REPO, 'examples/harvest-frontier/exports/building/barn.fixed.glb');

/** How far the rear wall and upper front finish inside the side walls. */
const CORNER_BITE = 0.005;
/** Clearance the new gable keeps below the roof it fills up to. */
const ROOF_MARGIN = 0.03;
/** How far the gable's foot laps behind the wall top, so no seam opens. */
const WALL_LAP = 0.06;

const barn = await loadGlb(IN);
const scene = barn.scene;
const before = {
  triangles: triangleCount(scene),
  meshes: 0,
  boundsMm: sizeMm(worldBox(scene)),
};
scene.traverse((n) => { if ((n as THREE.Mesh).isMesh) before.meshes += 1; });

// ------------------------------------------------------- 2. corner skins
// Done first: the gable is built from the corrected wall extents.
const sideWall = worldBox(mesh(scene, 'barnLeftWall'));
const innerX = Math.abs(sideWall.max.x) + CORNER_BITE; // -3.94 + 5 mm bite
const cornerFix: { mesh: string; beforeWidthMm: number; afterWidthMm: number }[] = [];
for (const name of ['barnRearWall', 'barnUpperFront']) {
  const target = mesh(scene, name);
  const box = worldBox(target);
  const half = box.getSize(new THREE.Vector3()).x / 2;
  const factor = innerX / half;
  target.scale.x *= factor;
  scene.updateMatrixWorld(true);
  cornerFix.push({
    mesh: name,
    beforeWidthMm: mm(half * 2),
    afterWidthMm: mm(worldBox(target).getSize(new THREE.Vector3()).x),
  });
}

// ------------------------------------------------------------ 1. gables
const roof = mesh(scene, 'barnRoof');
const walls = worldBox(mesh(scene, 'barnLeftWall'));
const wallTopY = walls.max.y;

/**
 * The roof's UNDERSIDE directly above a point, found by raycasting rather than
 * by binning vertices.
 *
 * Binning was not good enough. Sampling roof vertices in a window around x
 * mixes the two slopes and the ridge cap, and near the apex it returned a
 * height that left the gable 1.2 mm under the roof with 16 of its top vertices
 * poking through. A ray fired straight down at the exact (x, z) the step
 * occupies hits every roof surface over that point; the LOWEST hit is the
 * underside, and that is the only number a gable needs.
 */
const roofRay = new THREE.Raycaster();
function roofUndersideOver(x: number, z: number): number {
  roofRay.set(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
  const hits = roofRay.intersectObject(roof, false);
  if (hits.length === 0) return Infinity;
  return Math.min(...hits.map((h) => h.point.y));
}

/**
 * A slab that fills one gable: a row of quads whose top edge steps along the
 * roof underside. Built from the barn's own wall geometry only in the sense
 * that it takes `barnRearWall`'s material and its average COLOR_0 -- no new
 * colour, no new material, and nothing invented beyond a flat panel.
 */
function buildGable(name: string, zNear: number, zFar: number): THREE.Mesh {
  const donor = mesh(scene, 'barnRearWall');
  const donorColour = donor.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
  let cr = 0; let cg = 0; let cb = 0;
  if (donorColour) {
    for (let i = 0; i < donorColour.count; i += 1) { cr += donorColour.getX(i); cg += donorColour.getY(i); cb += donorColour.getZ(i); }
    cr /= donorColour.count; cg /= donorColour.count; cb /= donorColour.count;
  }

  const SEGMENTS = 24;
  const x0 = -innerX;
  const x1 = innerX;
  const step = (x1 - x0) / SEGMENTS;
  const tops: number[] = [];
  for (let s = 0; s <= SEGMENTS; s += 1) {
    const x = x0 + s * step;
    // Both faces of the slab, plus its middle, so a step is measured against
    // the lowest roof surface anywhere over the ground it covers.
    const overhead = Math.min(
      roofUndersideOver(x, zNear),
      roofUndersideOver(x, zFar),
      roofUndersideOver(x, (zNear + zFar) / 2),
    );
    tops.push(overhead - ROOF_MARGIN);
  }
  // A stepped top edge, one flat step per segment, taking the LOWER of the two
  // ends so a step can never rise above the roof it sits under.
  const stepTop: number[] = [];
  for (let s = 0; s < SEGMENTS; s += 1) stepTop.push(Math.min(tops[s], tops[s + 1]));

  const positions: number[] = [];
  const colours: number[] = [];
  const indices: number[] = [];
  const push = (x: number, y: number, z: number) => {
    positions.push(x, y, z);
    if (donorColour) colours.push(cr, cg, cb);
    return positions.length / 3 - 1;
  };
  const quad = (a: number, b: number, c: number, d: number) => { indices.push(a, b, c, a, c, d); };
  const base = wallTopY - WALL_LAP;
  // One continuous strip, not a row of separate boxes. Independent boxes would
  // butt end face against end face at every step, which is 0 mm coplanar
  // overlap -- the artefact this whole pass exists to remove. Here only the
  // EXPOSED part of a step riser is emitted, and only the two outermost ends
  // get a cap.
  let previousTop = base;
  let previousNear = -1; let previousFar = -1;
  for (let s = 0; s < SEGMENTS; s += 1) {
    const xa = x0 + s * step;
    const xb = xa + step;
    const top = stepTop[s];
    if (top <= base) { previousTop = base; previousNear = -1; continue; }
    const on0 = push(xa, base, zNear); const on1 = push(xb, base, zNear);
    const on2 = push(xb, top, zNear); const on3 = push(xa, top, zNear);
    const of0 = push(xa, base, zFar); const of1 = push(xb, base, zFar);
    const of2 = push(xb, top, zFar); const of3 = push(xa, top, zFar);
    if (zNear > zFar) { quad(on0, on1, on2, on3); quad(of1, of0, of3, of2); }
    else { quad(on1, on0, on3, on2); quad(of0, of1, of2, of3); }
    quad(on3, on2, of2, of3); // the step's flat top
    if (previousNear < 0) {
      quad(on0, of0, of3, on3); // the strip's own left end, seen from outside
    } else if (Math.abs(top - previousTop) > 1e-4) {
      // Only the height DIFFERENCE between two steps is a real riser; the part
      // they share is interior and must not be given a face at all.
      const lo = Math.min(top, previousTop);
      const hi = Math.max(top, previousTop);
      const r0 = push(xa, lo, zNear); const r1 = push(xa, hi, zNear);
      const r2 = push(xa, hi, zFar); const r3 = push(xa, lo, zFar);
      if (top > previousTop) quad(r0, r1, r2, r3); else quad(r3, r2, r1, r0);
    }
    previousTop = top;
    previousNear = on1;
    previousFar = of1;
    if (s === SEGMENTS - 1) quad(of1, on1, on2, of2); // the strip's right end
  }
  void previousFar;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (donorColour) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const panel = new THREE.Mesh(geometry, donor.material);
  panel.name = name;
  return panel;
}

const rearBox = worldBox(mesh(scene, 'barnRearWall'));
const frontBox = worldBox(mesh(scene, 'barnUpperFront'));
const parent = node(scene, 'barnRearWall').parent!;
const frontGable = buildGable('barnFrontGable', frontBox.max.z, frontBox.min.z);
const rearGable = buildGable('barnRearGable', rearBox.min.z, rearBox.max.z);
parent.add(frontGable);
parent.add(rearGable);
scene.updateMatrixWorld(true);
const gableInfo = [frontGable, rearGable].map((m) => ({
  mesh: m.name,
  triangles: m.geometry.getIndex()!.count / 3,
  boundsMm: sizeMm(worldBox(m)),
}));

// -------------------------------------------------------- 3. duplicate doors
const doors = mesh(scene, 'barnbatch2');
const doorLumps = lumps(doors);
const byPosition = new Map<string, typeof doorLumps>();
for (const lump of doorLumps) {
  const key = lump.world.min.toArray().map((v) => v.toFixed(3)).join(',');
  const list = byPosition.get(key);
  if (list) list.push(lump); else byPosition.set(key, [lump]);
}
const duplicateDoors = [...byPosition.values()].flatMap((group) => group.slice(1));
const doorTrianglesRemoved = duplicateDoors.length ? deleteLumps(doors, duplicateDoors) : 0;

// --------------------------------------------------------- 4. blank panel
const signTriangles = removeNode(scene, 'barnSignboard');


// ------------------------------------------------------ 5. the window glass
/**
 * Both panes move OUTWARD along their own thin axis. The direction is not a
 * heuristic: `windowPane`'s frame posts run z 3260.2..3440.1 and the pane is
 * 30 mm thick at z 3265..3295, so 6 mm inward would leave its back face 1.2 mm
 * proud of the frame while 6 mm outward keeps the whole pane inside the rebate.
 * `windowPane_1` is the same window turned onto the +X elevation.
 */
const PANE_PUSH = 0.006;
const paneMoves: { pane: string; axis: string; direction: number; offsetMm: number; beforeMm: number; afterMm: number; clearanceMm: number; worstConsideredMm: number }[] = [];
for (const paneName of ['windowPane', 'windowPane_1']) {
  const pane = mesh(scene, paneName);
  const box = worldBox(pane);
  const size = box.getSize(new THREE.Vector3());
  const axis: 'x' | 'z' = size.x < size.z ? 'x' : 'z';
  const before = box.getCenter(new THREE.Vector3())[axis];
  // Both directions are measured (paneClearance) and the roomier one wins, so
  // the choice is a number rather than an assumption about which way is "in".
  // Both directions AND a short range of distances are measured; the pane goes
  // wherever the nearest surface over it is furthest away. For `windowPane_1`
  // 6 mm leaves 4.6 mm and 10 mm leaves 8.6 mm, which is not something a rule
  // of thumb would have found.
  let best = { offset: PANE_PUSH, clearance: -1 };
  let worst = { offset: PANE_PUSH, clearance: Infinity };
  for (const magnitude of [PANE_PUSH, 0.008, 0.010, 0.012]) {
    for (const sign of [-1, 1]) {
      const clearance = paneClearance(scene, pane, axis, sign * magnitude);
      if (clearance > best.clearance) best = { offset: sign * magnitude, clearance };
      if (clearance < worst.clearance) worst = { offset: sign * magnitude, clearance };
    }
  }
  const direction = Math.sign(best.offset);
  const back = worst.clearance;
  const out = best.clearance;
  const target = pane.getWorldPosition(new THREE.Vector3());
  target[axis] += best.offset;
  pane.position.copy(pane.parent ? pane.parent.worldToLocal(target) : target);
  scene.updateMatrixWorld(true);
  paneMoves.push({
    pane: paneName, axis, direction, offsetMm: mm(best.offset),
    beforeMm: mm(before), afterMm: mm(worldBox(pane).getCenter(new THREE.Vector3())[axis]),
    clearanceMm: mm(out), worstConsideredMm: mm(back),
  });
}

// ------------------------------------------------------- 6. the empty bay
/**
 * Everything below is measured off the barn's own geometry, in world metres:
 *   floor top          y = 0.150   (`barnInteriorFloor` max Y)
 *   side walls, inside x = +-3.940 (`barnLeftWall` / `barnRightWall` inner faces)
 *   rear wall, inside  z = -2.940  (`barnRearWall` max Z)
 *   tie beam           y = 3.490..3.670 at z 0.900..1.100 -- the loft stops short of it
 */
const floorTop = worldBox(mesh(scene, 'barnInteriorFloor')).max.y;
const insideX = worldBox(mesh(scene, 'barnLeftWall')).max.x;   // -3.940 -> +-3.940 by symmetry
const insideZ = worldBox(mesh(scene, 'barnRearWall')).max.z;   // -2.940
const halfX = Math.abs(insideX);

const LOFT_TOP = 3.12;
const LOFT_BOTTOM = 3.00;
const LOFT_FRONT = -0.90;
/**
 * The deck stops 10 mm short of x = 3.779, where the SILO's own ladder -- its
 * stiles at x 3855..3905 and its cage hoops at x 3779..3821 -- runs the full
 * height of the building INSIDE the barn's right wall. Reaching the wall on
 * that side put 36 crossing triangles through it. The deck's own height was
 * also dropped 50 mm so it clears the silo ladder's rung at y 3174 by 54 mm
 * rather than by 4.
 */
const LOFT_RIGHT = 3.769;
/** 1 mm clear of the rear wall's inner face, so the two skins cannot cross. */
const LOFT_BACK_CLEAR = 0.001;

const timberDonor = mesh(scene, 'barnInteriorBeam');
const strawDonor = mesh(scene, 'siloStaves');
const parentNode = node(scene, 'barnInteriorFloor').parent!;

const loftBoxes: BoxSpec[] = [
  // the deck
  { min: [-halfX, LOFT_BOTTOM, insideZ + LOFT_BACK_CLEAR], max: [LOFT_RIGHT, LOFT_TOP, LOFT_FRONT] },
  // the two posts that carry its front edge, butted to the deck underside
  { min: [-1.89, floorTop, LOFT_FRONT - 0.18], max: [-1.71, LOFT_BOTTOM, LOFT_FRONT] },
  { min: [1.71, floorTop, LOFT_FRONT - 0.18], max: [1.89, LOFT_BOTTOM, LOFT_FRONT] },
  // the ladder: two stiles up to the deck, five rungs strictly between them
  { min: [3.30, floorTop, LOFT_FRONT - 0.08], max: [3.38, LOFT_TOP, LOFT_FRONT] },
  { min: [3.62, floorTop, LOFT_FRONT - 0.08], max: [3.70, LOFT_TOP, LOFT_FRONT] },
  ...[0.60, 1.10, 1.60, 2.10, 2.60].map((y): BoxSpec => ({
    min: [3.38, y, LOFT_FRONT - 0.07], max: [3.62, y + 0.06, LOFT_FRONT - 0.01],
  })),
  // the edge beam along the deck's front, so the loft reads as a floor you
  // could fall off rather than as a ceiling
  { min: [-halfX, LOFT_TOP, LOFT_FRONT - 0.08], max: [LOFT_RIGHT, LOFT_TOP + 0.16, LOFT_FRONT] },
];
const loft = buildBoxes('barnHayLoft', loftBoxes, timberDonor, parentNode, averageColour(timberDonor));

/** Six bales: two pairs on the floor against the rear wall, one stacked on each pair. */
const BALE = { w: 1.00, h: 0.60, d: 0.70 };
const baleBoxes: BoxSpec[] = [];
for (const x0 of [-3.60, -2.55, 1.70, 2.75]) {
  baleBoxes.push({ min: [x0, floorTop, insideZ], max: [x0 + BALE.w, floorTop + BALE.h, insideZ + BALE.d] });
}
for (const x0 of [-3.35, 2.20]) {
  baleBoxes.push({
    min: [x0, floorTop + BALE.h, insideZ + 0.07],
    max: [x0 + BALE.w, floorTop + 2 * BALE.h, insideZ + 0.07 + BALE.d],
  });
}
// two more sitting ON the loft, which is what a loft is for and what makes the
// deck read as a floor from the front opening
for (const x0 of [-2.00, 0.20]) {
  baleBoxes.push({ min: [x0, LOFT_TOP, -2.50], max: [x0 + BALE.w, LOFT_TOP + BALE.h, -2.50 + BALE.d] });
}
const bales = buildBoxes('barnHayBales', baleBoxes, strawDonor, parentNode, averageColour(strawDonor));
scene.updateMatrixWorld(true);

const interior = {
  floorTopMm: mm(floorTop),
  insideHalfWidthMm: mm(halfX),
  rearWallInsideZmm: mm(insideZ),
  loft: { mesh: loft.name, triangles: loft.geometry.getIndex()!.count / 3, boundsMm: sizeMm(worldBox(loft)) },
  bales: { mesh: bales.name, triangles: bales.geometry.getIndex()!.count / 3, boundsMm: sizeMm(worldBox(bales)) },
  colourDonors: { timber: 'barnInteriorBeam', straw: 'siloStaves' },
};

// ------------------------------------------------------------------ report
scene.updateMatrixWorld(true);
let meshCount = 0;
scene.traverse((n) => { if ((n as THREE.Mesh).isMesh) meshCount += 1; });
const after = { triangles: triangleCount(scene), meshes: meshCount, boundsMm: sizeMm(worldBox(scene)) };

await saveGlb(OUT, barn);
const report = {
  builtAt: new Date().toISOString(),
  input: path.relative(REPO, IN).replace(/\\/g, '/'),
  output: path.relative(REPO, OUT).replace(/\\/g, '/'),
  gablesClosed: gableInfo,
  gableGeometry: {
    wallTopYmm: mm(wallTopY),
    lapBehindWallMm: mm(WALL_LAP),
    clearanceUnderRoofMm: mm(ROOF_MARGIN),
    note: 'top edge stepped in 24 segments, each step taking the LOWER of its two sampled roof-underside heights',
  },
  cornerSkins: { biteMm: mm(CORNER_BITE), walls: cornerFix },
  duplicateDoorLumpsRemoved: duplicateDoors.length,
  doorTrianglesRemoved,
  signboardTrianglesRemoved: signTriangles,
  paneMoves,
  interior,
  coincidentMeshGroupsRemaining: coincidentMeshes(scene).map((group) => group.map((m) => m.name)),
  before,
  after,
};
fs.writeFileSync(OUT.replace(/\.glb$/, '.report.json'), JSON.stringify(report, null, 2));
process.stdout.write(`${JSON.stringify(report, null, 2)}\nwrote ${OUT}\n`);
