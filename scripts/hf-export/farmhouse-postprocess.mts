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
 *   against `farmhousebatch2`, at 0.0127-0.1337 mm. All eight are pushed 1 mm
 *   INTO the house along their own thin axis, which is far more than a depth
 *   buffer needs and far less than an eye can see on a 30 mm pane.
 *
 * Not changed: the foundation still sits 75.9 mm into the ground, which is what
 * a foundation is for and is reported rather than "corrected"; no material,
 * colour or vertex colour is touched anywhere.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  THREE, loadGlb, saveGlb, meshes, triangleCount, worldBox, sizeMm, mm,
} from './fix-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const IN = process.argv[2] ?? path.join(REPO, 'examples/harvest-frontier/exports/building/farmhouse.glb');
const OUT = process.argv[3] ?? path.join(REPO, 'examples/harvest-frontier/exports/building/farmhouse.fixed.glb');

/** How far each pane retreats into the wall. */
const PANE_INSET = Number(process.env.PANE_INSET ?? 0.001);

const house = await loadGlb(IN);
const scene = house.scene;
const before = { triangles: triangleCount(scene), meshes: meshes(scene).length, boundsMm: sizeMm(worldBox(scene)) };

// The house's own centre decides which way "inward" is for every pane, so no
// per-window direction has to be typed in and got wrong.
const centre = worldBox(scene).getCenter(new THREE.Vector3());
const moved: { pane: string; axis: string; beforeMm: number; afterMm: number }[] = [];
for (const pane of meshes(scene)) {
  if (!/^windowPane(_\d+)?$/.test(pane.name)) continue;
  const box = worldBox(pane);
  const size = box.getSize(new THREE.Vector3());
  // The thin axis is the glass's normal; X and Z only -- a pane is never thin in Y.
  const axis = size.x < size.z ? 'x' : 'z';
  const paneCentre = box.getCenter(new THREE.Vector3());
  const inward = Math.sign(centre[axis] - paneCentre[axis]) || 1;
  const beforeValue = paneCentre[axis];
  // The move is decided in WORLD space and then carried back through the pane's
  // own parent, because several of these panes hang off a `window` node that is
  // yawed 90 or 180 degrees -- adding to `position[axis]` directly sends half of
  // them the wrong way, straight out through the wall.
  const target = pane.getWorldPosition(new THREE.Vector3());
  target[axis] += inward * PANE_INSET;
  pane.position.copy(pane.parent ? pane.parent.worldToLocal(target) : target);
  scene.updateMatrixWorld(true);
  moved.push({
    pane: pane.name,
    axis,
    beforeMm: mm(beforeValue),
    afterMm: mm(worldBox(pane).getCenter(new THREE.Vector3())[axis]),
  });
}

scene.updateMatrixWorld(true);
const after = { triangles: triangleCount(scene), meshes: meshes(scene).length, boundsMm: sizeMm(worldBox(scene)) };
await saveGlb(OUT, house);
const report = {
  builtAt: new Date().toISOString(),
  input: path.relative(REPO, IN).replace(/\\/g, '/'),
  output: path.relative(REPO, OUT).replace(/\\/g, '/'),
  paneInsetMm: mm(PANE_INSET),
  panesMoved: moved,
  notChanged: [
    'farmhouseFoundation stays 75.9 mm below y=0 - that is a foundation, not a fault',
    'no material, colour or vertex colour touched',
  ],
  before,
  after,
};
fs.writeFileSync(OUT.replace(/\.glb$/, '.report.json'), JSON.stringify(report, null, 2));
process.stdout.write(`${JSON.stringify(report, null, 2)}\nwrote ${OUT}\n`);
