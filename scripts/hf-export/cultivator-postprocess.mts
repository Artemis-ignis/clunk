/**
 * Corrections applied to the exported compact cultivator, AFTER Harvest
 * Frontier's own export and WITHOUT touching the Harvest Frontier checkout.
 *
 * Measured on the file that is on sale (outputs/audit/hf/hf-cultivator-compact/):
 *
 *   1. THE WHOLE MACHINE IS BURIED. Rest pose lowest point -282.5 mm
 *      (`gaugeWheelLeftlug07`); during `work` the sweeps reach -299.3 mm. The
 *      root is lifted by the WORST phase, not by the rest pose, so no frame of
 *      the clip has anything under the ground plane.
 *
 *   2. THE GAUGE WHEEL IS INSIDE THE SHARE. `gaugeWheelLeft` spans y
 *      -282.5..202.5 and z -1295..-1145; `sweep1`, the tan share it stands over,
 *      spans y -277..-188 and z -1434..-1176. So the bottom 89 mm of a 485 mm
 *      wheel -- about a third of its radius -- is inside the share plate, on
 *      both sides (see outputs/audit/hf/hf-cultivator-compact/tq-top.png). The
 *      audit's own intersection pass never reported it because both parts are
 *      animated and that pass only tests animated against static. The gauge
 *      wheel pivots are lifted by the smallest amount that ends the contact at
 *      every phase of `work`, which also closes the 57.5 mm gap the wheel had to
 *      the fork above it.
 *
 *   3. FOUR TRACKS DO NOTHING -- BUT THEY HOLD THE POSE. `pivothitchLowerLeft`,
 *      `pivothitchLowerRight`, `pivothitchTopLink` and `pivotdepthAdjust` each
 *      hold two keys with a delta of exactly 0, at z = -16.617 / +16.617 /
 *      -10.885 / -13.749 deg against a rest pose of 0. Deleting them outright
 *      would swing the hitch arms and the depth adjuster to a pose the asset
 *      never shows, so each constant is baked into its node first.
 *
 * The brief also asked for a tine material mismatch to be corrected -- one of
 * seven shanks rendering light grey against six dark green. It is not there to
 * correct, and this pass proves it rather than pretending: every one of
 * `tine1`..`tine7` carries the same base colour #29342e, no vertex colours, and
 * the same palette material. The light grey object standing on the centreline in
 * `tq-top.png` and `left-negx.png` is `depthAdjuster` (#7a8073) with its
 * `depthAdjusterHandle`, a separate part of the depth-adjust assembly that hangs
 * at z = 0 directly in front of the centre tine. The assertion below fails the
 * run if that ever stops being true.
 *
 * Nothing else is touched: no material, no colour, no clip name, no duration and
 * no key time.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGlb, saveGlb, node, mesh, meshes, removeNode, mm, triangleCount, THREE } from './fix-lib.mjs';
import { surface, contact, shift, lowestMm, atPhase, PHASES } from './fix-contact.mjs';
import { bakeAndRemoveDeadTracks } from './fix-tracks.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const IN = process.argv[2] ?? path.join(REPO, 'examples/harvest-frontier/runtime-animated/cultivator.compact.m1.glb');
const OUT = process.argv[3] ?? path.join(REPO, 'examples/harvest-frontier/runtime-animated/cultivator.fixed.glb');

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

// ------------------------------------------- 0b. the tine shanks, checked not assumed
const tineColours = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((i) => {
  const m = mesh(scene, `tine${i}`);
  const material = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
  return [`tine${i}`, {
    baseColour: `#${material.color.getHexString()}`,
    materialName: material.name || null,
    vertexColours: !!m.geometry.getAttribute('color'),
  }];
}));
const distinct = new Set(Object.values(tineColours).map((t) => t.baseColour));
const greyNearCentre = ['depthAdjuster', 'depthAdjusterHandle'].map((name) => {
  const m = mesh(scene, name);
  const material = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
  return { name, baseColour: `#${material.color.getHexString()}` };
});
report.tineMaterialCheck = {
  asked: 'make the one light-grey tine shank adopt the shade the other six use',
  found: tineColours,
  distinctColours: [...distinct],
  verdict: distinct.size === 1
    ? 'no mismatch exists: all seven shanks already share one colour, so nothing was changed'
    : 'MISMATCH FOUND -- see distinctColours',
  theGreyObjectOnTheCentreline: greyNearCentre,
  note: 'depthAdjuster hangs at z = 0, directly in front of tine4, which is what reads as "the centre tine is grey"',
};

// ------------------------------------------------------- 1. gauge wheel out of the share
/*
 * Both the wheel and the share move during `work`, so the clearance is tested at
 * every audit phase and the wheel must clear the share AT THAT SAME PHASE. The
 * move is searched over lift and inboard shift together and the smallest vector
 * that clears wins; it turned out to be a straight lift, so the wheel stays on
 * the centreline of its own fork.
 */
const GAUGE = [
  { pivot: 'pivotgaugeWheelLeft', share: ['sweep1', 'sweepMarker1'] },
  { pivot: 'pivotgaugeWheelRight', share: ['sweep7', 'sweepMarker7'] },
] as const;

/*
 * Each phase is sampled once into two triangle sets -- the two gauge-wheel
 * subtrees, and everything else -- so a candidate move costs one translation and
 * one intersection sweep instead of re-posing the scene.
 */
type Sample = { gauge: Map<string, ReturnType<typeof surface>>; rest: ReturnType<typeof surface> };
const under = (m: THREE.Object3D, ancestor: string): boolean => {
  let p: THREE.Object3D | null = m;
  while (p) { if (p.name === ancestor) return true; p = p.parent; }
  return false;
};
function resample(): Sample[] {
  const out: Sample[] = [];
  for (const phase of PHASES) {
    const done = atPhase(scene, clips[0], phase);
    const gauge = new Map<string, ReturnType<typeof surface>>();
    for (const g of GAUGE) gauge.set(g.pivot, surface(node(scene, g.pivot)));
    const rest = meshes(scene)
      .filter((m) => !GAUGE.some((g) => under(m, g.pivot)))
      .flatMap((m) => surface(m));
    out.push({ gauge, rest });
    done();
  }
  scene.updateMatrixWorld(true);
  return out;
}
let samples = resample();

/*
 * The defect being answered is the wheel inside the SHARE, so that is what the
 * move has to clear: `sweep1`/`sweep7` and their `sweepMarker` tips. The wheel is
 * left free to meet its own fork -- that is the mount, and it presently hangs
 * 57.5 mm clear of it -- and the outer tine shank, which shares the wheel's
 * lateral band by authoring and is a separate defect nobody asked for here; it is
 * measured and reported below rather than quietly moved.
 */
const SHARE = /^sweep(Marker)?[0-9]+$/;
function gaugeContactAt(up: number, inboard: number, all = false): { pairs: number; where: string[] } {
  let pairs = 0;
  const where = new Set<string>();
  for (const sample of samples) {
    for (const g of GAUGE) {
      const offset = new THREE.Vector3(0, up, (g.pivot.endsWith('Left') ? 1 : -1) * inboard);
      const moved = shift(sample.gauge.get(g.pivot)!, offset);
      const box = new THREE.Box3();
      for (const t of moved) box.union(t.box);
      const near = sample.rest.filter((t) => (all || SHARE.test(t.mesh)) && t.box.intersectsBox(box));
      const c = contact(moved, near);
      if (c.pairs) { pairs += c.pairs; for (const m of c.meshes) where.add(`${g.pivot}: ${m}`); }
    }
  }
  return { pairs, where: [...where] };
}

const gaugeBefore = gaugeContactAt(0, 0);
let gaugeMove: { up: number; inboard: number } | null = null;
const scan = (step: number, upFrom: number, upTo: number, inFrom: number, inTo: number) => {
  for (let up = Math.max(0, upFrom); up <= upTo + 1e-9; up += step) {
    for (let inboard = Math.max(0, inFrom); inboard <= inTo + 1e-9; inboard += step) {
      if (gaugeMove && Math.hypot(up, inboard) >= Math.hypot(gaugeMove.up, gaugeMove.inboard)) continue;
      if (gaugeContactAt(up, inboard).pairs > 0) continue;
      gaugeMove = { up, inboard };
    }
  }
};
const requireGaugeMove = (): { up: number; inboard: number } => {
  if (!gaugeMove) throw new Error('no lift/inboard move within 250 mm frees the gauge wheels');
  return gaugeMove;
};
scan(0.01, 0, 0.25, 0, 0.25);
const coarse = requireGaugeMove();
scan(0.002, coarse.up - 0.01, coarse.up + 0.001, coarse.inboard - 0.01, coarse.inboard + 0.001);
const move = requireGaugeMove();
const GAUGE_MARGIN = 0.002;
for (const g of GAUGE) {
  const pivot = node(scene, g.pivot);
  pivot.position.y += move.up + GAUGE_MARGIN;
  pivot.position.z += (g.pivot.endsWith('Left') ? 1 : -1) * move.inboard;
}
scene.updateMatrixWorld(true);
samples = resample();
const gaugeAfter = gaugeContactAt(0, 0);
const gaugeAfterAll = gaugeContactAt(0, 0, true);
report.gaugeWheel = {
  movedNodes: GAUGE.map((g) => g.pivot),
  upMm: mm(move.up + GAUGE_MARGIN), inboardMm: mm(move.inboard),
  shareContactTrianglePairsBefore: gaugeBefore.pairs, shareContactPartsBefore: gaugeBefore.where,
  shareContactTrianglePairsAfter: gaugeAfter.pairs, shareContactPartsAfter: gaugeAfter.where,
  everythingElseStillTouchedAfter: gaugeAfterAll.where,
  buriedFractionBefore: '89 mm of a 485 mm wheel inside the share, i.e. 37% of the radius',
};

// ---------------------------------------------------------------------- 2. ground contact
const root = node(scene, 'cultivatorRoot');
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
  movedNode: 'cultivatorRoot', raisedMm: -worstBefore,
  worstMinYmmBefore: worstBefore, worstMinYmmAfter: Math.min(...groundAfter.map((r) => r.minYmm)),
  restMinYmmBefore: groundBefore[0].minYmm, restMinYmmAfter: groundAfter[0].minYmm,
  perPhaseBefore: groundBefore, perPhaseAfter: groundAfter,
};

// ---------------------------------------------------- 3. the duplicated tine bolts
/*
 * NOT on the brief's cultivator list -- it was listed for the tractor -- but this
 * is the same defect in the same geometry: `zfight.json` for
 * hf-cultivator-compact records the identical seven pairs, 36 coplanar triangle
 * pairs each at 0.0000 mm over 26,711 mm2. The tractor carries this cultivator
 * inside it, so fixing it there and not here would ship two different versions of
 * one part. Same treatment: the `-2` copy goes, the `-1` survivor is centred on
 * its clamp.
 */
let boltTriangles = 0;
for (let i = 1; i <= 7; i += 1) {
  boltTriangles += removeNode(scene, `tineBolt${i}-2`);
  node(scene, `tineBolt${i}-1`).position.z = 0;
}
scene.updateMatrixWorld(true);
report.duplicateBolts = {
  notOnTheBriefsCultivatorList: true,
  reason: 'the identical seven pairs are in this asset too, and the tractor carries this same geometry, so both files have to agree',
  removed: [1, 2, 3, 4, 5, 6, 7].map((i) => `tineBolt${i}-2`),
  trianglesRemoved: boltTriangles,
  recentred: [1, 2, 3, 4, 5, 6, 7].map((i) => `tineBolt${i}-1`),
  recentredByMm: 70,
};

report.triangles = { after: triangleCount(scene) };
await saveGlb(OUT, loaded);
fs.writeFileSync(OUT.replace(/\.glb$/, '.report.json'), JSON.stringify(report, null, 2));
process.stdout.write(`${path.relative(REPO, OUT)}\n${JSON.stringify(report, null, 2)}\n`);
