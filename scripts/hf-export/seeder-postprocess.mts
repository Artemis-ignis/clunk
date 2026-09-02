/**
 * Corrections applied to the exported compact seeder, AFTER Harvest Frontier's
 * own export and WITHOUT touching the Harvest Frontier checkout.
 *
 * Measured on the file that is on sale (outputs/audit/hf/hf-seeder-compact/):
 *
 *   1. THE STRAY PLANK. A cream plank (`depthAdjuster`, #b4ad8e, 247 x 791 x
 *      140 mm) with a red collar ring (`depthAdjusterHandle`, #b64a38) hangs off
 *      the toolbar at z = -700 mm, drops from y 906 mm to y 115 mm and stops
 *      there in mid air, and crosses the hitch A-frame on the way (the audit
 *      records `depthAdjuster` 51.74 mm inside `toolbarRail` during `sow`). See
 *      clip-sow-tq.png and tq-top.png.
 *
 *      DELETED, not mirrored. Six things say it is an orphan, not half of a
 *      pair: (a) this seeder already HAS its depth adjustment, four per-row
 *      levers `rowDepthLeverStem01..04` with their knobs, one on each row unit;
 *      (b) z = -700 is neither the centreline nor any row station -- the rows
 *      sit at -1200, -400, +400, +1200; (c) it has no mirror twin, and the
 *      symmetry scan finds no other unpaired frame part; (d) its lower 790 mm is
 *      attached to nothing, it simply ends; (e) it intersects the hitch and rail
 *      it hangs beside; (f) its only animation track, `pivotdepthAdjust`, holds
 *      two identical keys, so it is inert payload. Mirroring it to z = +700 would
 *      have produced a second plank dangling into the same nothing. For contrast
 *      the cultivator's part of the same name is a real control: it sits on the
 *      centreline, on a machine that has no per-row levers.
 *
 *   2. THE WHOLE MACHINE IS BURIED. Rest pose lowest point -115.0 mm
 *      (`openerPlate`); during `sow` the openers reach -135.6 mm. The root is
 *      lifted by the WORST phase, not the rest pose.
 *
 *   3. FIVE TRACKS DO NOTHING -- BUT THEY HOLD THE POSE. `pivotrowUnit01..04`
 *      and `pivotdepthAdjust` each hold two keys with a delta of exactly 0, at
 *      z = -3.151 and -6.876 deg against a rest pose of 0. Deleting them outright
 *      tips all four row units back by 3.15 deg and lifts the machine 20.6 mm off
 *      the ground it was just seated on, so each constant is baked into its node
 *      before the track is dropped.
 *
 * The hopper 'C' decals are deliberately untouched.
 *
 * Nothing else is touched: no material, no colour, no clip name, no duration and
 * no key time.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGlb, saveGlb, node, mesh, meshes, removeNode, worldBox, mm, triangleCount, THREE } from './fix-lib.mjs';
import { surface, contact, lowestMm, atPhase, PHASES } from './fix-contact.mjs';
import { bakeAndRemoveDeadTracks } from './fix-tracks.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const IN = process.argv[2] ?? path.join(REPO, 'examples/harvest-frontier/runtime-animated/seeder.compact.m1.glb');
const OUT = process.argv[3] ?? path.join(REPO, 'examples/harvest-frontier/runtime-animated/seeder.fixed.glb');

const loaded = await loadGlb(IN);
const scene = loaded.scene;
const clips = loaded.animations;
const report: Record<string, unknown> = { input: path.relative(REPO, IN), output: path.relative(REPO, OUT) };

// ------------------------------------- 0. dead tracks, baked before anything is measured
/*
 * This runs FIRST because it moves things. Every dead track here holds a
 * constant that is not the node's rest pose, so the constant is written into the
 * node and only then is the track dropped; see fix-tracks.mts. Doing it first
 * means every measurement below is taken on the pose the asset actually ships.
 */
report.deadTracks = bakeAndRemoveDeadTracks(scene, clips);

// ------------------------------------------------------------------ 1. the stray plank
/*
 * The case for deleting is written out as measurements, not as an opinion, so a
 * reader can check every claim in the output file.
 */
const plank = node(scene, 'depthAdjustment');
const plankBox = worldBox(plank);
const plankMeshes = meshes(plank).map((m) => {
  const material = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
  const b = worldBox(m);
  return {
    name: m.name,
    colour: `#${material.color.getHexString()}`,
    boxMm: { min: b.min.toArray().map((v) => mm(v)), max: b.max.toArray().map((v) => mm(v)) },
  };
});
const plankSurface = surface(plank);
const cutParts = new Set<string>();
for (const m of meshes(scene)) {
  if (meshes(plank).includes(m)) continue;
  const c = contact(plankSurface, surface(m));
  if (c.pairs) cutParts.add(m.name);
}
const perRowLevers = meshes(scene).filter((m) => /^rowDepthLever(Stem|Knob)\d+$/.test(m.name)).map((m) => m.name);
// Anything else below it that could be holding its lower end up?
const lowerEnd = new THREE.Box3(
  new THREE.Vector3(plankBox.min.x, plankBox.min.y - 0.001, plankBox.min.z),
  new THREE.Vector3(plankBox.max.x, plankBox.min.y + 0.02, plankBox.max.z),
);
const touchingLowerEnd = meshes(scene)
  .filter((m) => !meshes(plank).includes(m) && worldBox(m).intersectsBox(lowerEnd))
  .map((m) => m.name);
const plankTriangles = removeNode(scene, 'depthAdjustment');
scene.updateMatrixWorld(true);
report.strayPlank = {
  decision: 'deleted',
  removedNode: 'depthAdjustment (pivotdepthAdjust -> depthAdjuster + depthAdjusterHandle)',
  trianglesRemoved: plankTriangles,
  parts: plankMeshes,
  hangsFromYmm: mm(plankBox.max.y), endsAtYmm: mm(plankBox.min.y), atZmm: mm(plankBox.getCenter(new THREE.Vector3()).z),
  rowStationsZmm: [-1200, -400, 400, 1200],
  itCut: [...cutParts],
  anythingSupportingItsLowerEnd: touchingLowerEnd,
  machineAlreadyHasDepthAdjustment: perRowLevers,
  whyNotMirrored: 'a mirror at z = +700 would be a second plank ending in the same mid air; the seeder adjusts depth per row, and those levers are already modelled',
};

// ---------------------------------------------------------------------- 2. ground contact
const root = node(scene, 'seederRoot');
function groundByPhase(): { pose: string; minYmm: number }[] {
  const rows = [{ pose: 'rest', minYmm: lowestMm(root) }];
  for (const clip of clips) {
    for (const phase of PHASES) {
      const done = atPhase(scene, clip, phase);
      rows.push({ pose: `${clip.name}@${phase}`, minYmm: lowestMm(root) });
      done();
    }
  }
  scene.updateMatrixWorld(true);
  return rows;
}
const groundBefore = groundByPhase();
const worstBefore = Math.min(...groundBefore.map((r) => r.minYmm));
root.position.y -= worstBefore / 1000;
scene.updateMatrixWorld(true);
const groundAfter = groundByPhase();
report.ground = {
  movedNode: 'seederRoot', raisedMm: -worstBefore,
  worstMinYmmBefore: worstBefore, worstMinYmmAfter: Math.min(...groundAfter.map((r) => r.minYmm)),
  restMinYmmBefore: groundBefore[0].minYmm, restMinYmmAfter: groundAfter[0].minYmm,
  perPhaseBefore: groundBefore, perPhaseAfter: groundAfter,
};

// ------------------------------------------------------------------------ 4. the decals
report.hopperDecals = {
  left: 'untouched, as asked',
  meshes: meshes(scene).filter((m) => /hopperInspectionWindow|hopperHandle/i.test(m.name)).map((m) => m.name),
};

report.triangles = { after: triangleCount(scene) };
await saveGlb(OUT, loaded);
fs.writeFileSync(OUT.replace(/\.glb$/, '.report.json'), JSON.stringify(report, null, 2));
process.stdout.write(`${path.relative(REPO, OUT)}\n${JSON.stringify(report, null, 2)}\n`);
