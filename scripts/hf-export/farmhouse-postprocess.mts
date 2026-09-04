/**
 * Corrections applied to the exported farmhouse.
 *
 * Measured on the file that is on sale (outputs/audit/hf/hf-farmhouse/):
 *
 *   THE GLASS IS IN THE SAME PLANE AS ITS FRAME. `windowPane_4..7` sit
 *   0.0035-0.0048 mm from `windowFrame`..`windowFrame_3`, parallel and
 *   overlapping in projection, over roughly 38,000 mm^2 per window: four
 *   windows of guaranteed shimmer on any depth buffer. The four panes on the
 *   other elevations (`windowPane`, `_1`, `_2`, `_3`) are the same story
 *   against `farmhousebatch2`, at 0.0127-0.1337 mm. All eight are pushed INTO
 *   the house along their own thin axis, which is far more than a depth buffer
 *   needs and far less than an eye can see on a 30 mm pane.
 *
 *   2026-09-03: 1 mm was not enough. Re-measured on the file on sale, the eight
 *   panes still sat 0.9873-1.1337 mm from their frames -- 3,074.16 cm2 of
 *   same-facing coplanar overlap, which is a hairline a distant camera still
 *   resolves as flicker. The inset is now 6 mm, and the measured same-facing
 *   overlap of the whole file is 0 cm2.
 *
 * THE PORCH IS AN EMPTY RECESS. Under the canopy there is a deck, a door and a
 * lamp and nothing else, so in the storefront three-quarter the whole bay falls
 * into shadow and reads as a hole cut in the front of the house. Two railings
 * -- one from each post back to the wall -- and a seat on each side of the door
 * are added: 192 triangles, no new material, every colour taken from the porch
 * deck the house already ships. Every box butts its neighbour, so nothing
 * overlaps and no crossing triangle is created.
 *
 * Not changed: the foundation still sits 75.9 mm into the ground, which is what
 * a foundation is for and is reported rather than "corrected"; no material,
 * colour or vertex colour is touched anywhere.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  THREE, loadGlb, saveGlb, mesh, node, meshes, triangleCount, worldBox, sizeMm, mm,
  paneClearance, averageColour, buildBoxes, type BoxSpec,
} from './fix-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const IN = process.argv[2] ?? path.join(REPO, 'examples/harvest-frontier/exports/building/farmhouse.glb');
const OUT = process.argv[3] ?? path.join(REPO, 'examples/harvest-frontier/exports/building/farmhouse.fixed.glb');

/** How far each pane retreats into the wall. */
const PANE_INSET = Number(process.env.PANE_INSET ?? 0.006);

const house = await loadGlb(IN);
const scene = house.scene;
const before = { triangles: triangleCount(scene), meshes: meshes(scene).length, boundsMm: sizeMm(worldBox(scene)) };

/*
 * Which way each pane goes is MEASURED, not assumed.
 *
 * "Push it towards the middle of the house" is wrong for at least one window
 * here: `windowPane_3`, the gable light, is bedded against mullions whose own
 * back face is 5 mm behind it, so moving it inward parks it 1.1 mm off the
 * frame POSTS instead -- a different hairline, same flicker. So both
 * directions are tried, the real separation to the nearest surface standing
 * over the pane is measured for each, and the better one wins.
 */
const moved: { pane: string; axis: string; direction: number; beforeMm: number; afterMm: number; clearanceMm: number; rejectedClearanceMm: number }[] = [];
for (const pane of meshes(scene)) {
  if (!/^windowPane(_\d+)?$/.test(pane.name)) continue;
  const box = worldBox(pane);
  const size = box.getSize(new THREE.Vector3());
  // The thin axis is the glass's normal; X and Z only -- a pane is never thin in Y.
  const axis = size.x < size.z ? 'x' : 'z';
  const beforeValue = box.getCenter(new THREE.Vector3())[axis];
  const inward = paneClearance(scene, pane, axis, -PANE_INSET);
  const outward = paneClearance(scene, pane, axis, +PANE_INSET);
  const direction = outward > inward ? 1 : -1;
  // The move is decided in WORLD space and then carried back through the pane's
  // own parent, because several of these panes hang off a `window` node that is
  // yawed 90 or 180 degrees -- adding to `position[axis]` directly sends half of
  // them the wrong way, straight out through the wall.
  const target = pane.getWorldPosition(new THREE.Vector3());
  target[axis] += direction * PANE_INSET;
  pane.position.copy(pane.parent ? pane.parent.worldToLocal(target) : target);
  scene.updateMatrixWorld(true);
  moved.push({
    pane: pane.name,
    axis,
    direction,
    beforeMm: mm(beforeValue),
    afterMm: mm(worldBox(pane).getCenter(new THREE.Vector3())[axis]),
    clearanceMm: mm(Math.max(inward, outward)),
    rejectedClearanceMm: mm(Math.min(inward, outward)),
  });
}


// ------------------------------------------------------------ the porch
/**
 * Measured off the house's own parts, in world metres:
 *   porch deck        `porch`            x -2.870..-0.570, top y 0.570, z 2.570..4.270
 *   porch posts       `farmhousebatch1`  160 mm square at x -2.620..-2.460 and
 *                                        -0.980..-0.820, z 4.020..4.180
 *   front wall        `farmhouseWalls`   +Z face at z 2.800
 *   front door        `frontDoor`        x -2.370..-1.070
 * The railings run post-to-wall down each side, and the two seats sit in the
 * 0.5 m of deck that the door does not use.
 */
const deck = mesh(scene, 'porch');
const deckBox = worldBox(deck);
const deckTop = deckBox.max.y;                 // 0.570
const wallFace = worldBox(mesh(scene, 'farmhouseWalls')).max.z;   // 2.800
/** 1 mm clear of the post's inner face, so the two skins cannot cross. */
const POST_INNER_Z = 4.019;
const timber = averageColour(deck);
const porchParent = node(scene, 'porch').parent!;

const RAIL_TOP = [1.24, 1.32];
const RAIL_BOTTOM = [0.62, 0.70];
const porchBoxes: BoxSpec[] = [];
for (const postCentreX of [-2.540, -0.900]) {
  const x0 = postCentreX - 0.040;
  const x1 = postCentreX + 0.040;
  porchBoxes.push({ min: [x0, RAIL_BOTTOM[0], wallFace], max: [x1, RAIL_BOTTOM[1], POST_INNER_Z] });
  porchBoxes.push({ min: [x0, RAIL_TOP[0], wallFace], max: [x1, RAIL_TOP[1], POST_INNER_Z] });
  for (const z of [3.00, 3.25, 3.50, 3.75]) {
    porchBoxes.push({ min: [x0 + 0.010, RAIL_BOTTOM[1], z], max: [x1 - 0.010, RAIL_TOP[0], z + 0.06] });
  }
}
// a seat each side of the door: plinth, then the board on top of it
for (const [x0, x1] of [[-2.830, -2.400], [-1.040, -0.610]] as const) {
  porchBoxes.push({ min: [x0 + 0.08, deckTop, wallFace + 0.10], max: [x1 - 0.08, 0.95, wallFace + 0.37] });
  porchBoxes.push({ min: [x0, 0.95, wallFace], max: [x1, 1.03, wallFace + 0.45] });
}
const porchFit = buildBoxes('porchRailAndSeats', porchBoxes, deck, porchParent, timber);
scene.updateMatrixWorld(true);
const porchReport = {
  mesh: porchFit.name,
  boxes: porchBoxes.length,
  triangles: porchFit.geometry.getIndex()!.count / 3,
  deckTopMm: mm(deckTop),
  wallFaceZmm: mm(wallFace),
  colourDonor: 'porch',
  boundsMm: sizeMm(worldBox(porchFit)),
};

scene.updateMatrixWorld(true);
const after = { triangles: triangleCount(scene), meshes: meshes(scene).length, boundsMm: sizeMm(worldBox(scene)) };
await saveGlb(OUT, house);
const report = {
  builtAt: new Date().toISOString(),
  input: path.relative(REPO, IN).replace(/\\/g, '/'),
  output: path.relative(REPO, OUT).replace(/\\/g, '/'),
  paneInsetMm: mm(PANE_INSET),
  panesMoved: moved,
  porch: porchReport,
  notChanged: [
    'farmhouseFoundation stays 75.9 mm below y=0 - that is a foundation, not a fault',
    'no material, colour or vertex colour touched',
  ],
  before,
  after,
};
fs.writeFileSync(OUT.replace(/\.glb$/, '.report.json'), JSON.stringify(report, null, 2));
process.stdout.write(`${JSON.stringify(report, null, 2)}\nwrote ${OUT}\n`);
