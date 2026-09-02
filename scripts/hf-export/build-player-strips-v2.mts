/**
 * Before / after strips for the three re-authored action clips.
 *
 * Top row is the PREVIOUS export - the file as it stood before this pass, kept
 * at tmp/hf-clips/player-farmhand.prev.glb - and the bottom row is the clip
 * that ships now, at the same six phases, front and side. `walk` and `idle` get
 * the same treatment for the opposite reason: they were not touched, and two
 * identical rows are the proof.
 *
 * Both rows come out of the SAME renderer pass per row-pair and the same
 * camera, because a strip is one GLB (see strip-lib.mts) - rendering frames
 * separately would re-fit the camera per frame and the two rows would not be
 * comparable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THREE } from './lib.mjs';
import { GLTFLoader } from '../../../Harvest Frontier/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { composeRows, renderStrip, SCRATCH, writeStripGlb, type ViewName } from './strip-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const OUT = path.resolve(REPO, 'examples/harvest-frontier/exports');
const STRIPS = path.join(OUT, 'anim-strips-v2');
const PREVIOUS = path.join(REPO, 'tmp/hf-clips/player-farmhand.prev.glb');
const CURRENT = path.join(OUT, 'npc', 'player-farmhand.glb');
const PHASES = [0, 0.2, 0.4, 0.6, 0.8, 0.95];
const REAUTHORED = new Set(['hoe', 'water', 'harvest']);
const UNCHANGED = ['walk', 'idle'];

async function load(file: string): Promise<{ scene: THREE.Object3D; clips: THREE.AnimationClip[] }> {
  const buffer = fs.readFileSync(file);
  const array = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const loader = new GLTFLoader();
  return await new Promise((ok, fail) => loader.parse(array as ArrayBuffer, '', (g) => ok({ scene: g.scene, clips: g.animations }), fail));
}

/** Six clones of one scene, posed at the six phases of one clip. */
function row(scene: THREE.Object3D, clip: THREE.AnimationClip): THREE.Object3D[] {
  const mixer = new THREE.AnimationMixer(scene);
  const action = mixer.clipAction(clip);
  action.play();
  const poses = PHASES.map((p) => {
    mixer.setTime(0);
    mixer.setTime(clip.duration * Math.min(p, 1 - 1e-6));
    scene.updateMatrixWorld(true);
    return scene.clone(true);
  });
  action.stop();
  mixer.uncacheClip(clip);
  return poses;
}

const previous = await load(PREVIOUS);
const current = await load(CURRENT);
const index: Record<string, string[]> = {};

const wanted = [...REAUTHORED, ...UNCHANGED];
for (const name of wanted) {
  const before = previous.clips.find((c) => c.name === name);
  const after = current.clips.find((c) => c.name === name);
  if (!before || !after) {
    process.stdout.write(`skip ${name}: missing in ${before ? 'current' : 'previous'} export\n`);
    continue;
  }
  const views: ViewName[] = REAUTHORED.has(name) ? ['front', 'side'] : ['side'];
  for (const view of views) {
    const beforeGlb = path.join(SCRATCH, `v2-${name}-${view}-before.glb`);
    const afterGlb = path.join(SCRATCH, `v2-${name}-${view}-after.glb`);
    await writeStripGlb(row(previous.scene, before), view, 1.35, beforeGlb);
    await writeStripGlb(row(current.scene, after), view, 1.35, afterGlb);
    const beforePng = beforeGlb.replace(/\.glb$/, '.png');
    const afterPng = afterGlb.replace(/\.glb$/, '.png');
    renderStrip(beforeGlb, beforePng);
    renderStrip(afterGlb, afterPng);

    const changed = REAUTHORED.has(name);
    const out = path.join(STRIPS, `player-${name}-${view}.png`);
    await composeRows([
      {
        label: `${name} / ${view} / BEFORE - previous export (HF applyAction${changed ? ', rejected' : ''})  -  phases ${PHASES.join(', ')}`,
        png: beforePng,
      },
      {
        label: `${name} / ${view} / AFTER - ${changed ? 'Clunk-authored clip' : 'unchanged, re-rendered as proof'} (player-farmhand.glb)`,
        png: afterPng,
      },
    ], out);
    (index[name] ??= []).push(path.relative(OUT, out).replace(/\\/g, '/'));
    process.stdout.write(`${path.relative(OUT, out)}\n`);
  }
}

fs.writeFileSync(path.join(STRIPS, 'index.json'), JSON.stringify({
  builtAt: new Date().toISOString(),
  subject: 'npc/player-farmhand.glb',
  before: 'tmp/hf-clips/player-farmhand.prev.glb (the export as it stood before the action clips were re-authored)',
  phases: PHASES,
  reauthored: [...REAUTHORED],
  unchanged: UNCHANGED,
  views: {
    front: 'subject yawed so its authored front (-Z) faces the renderer camera',
    side: 'front view yawed a further -90 deg',
  },
  renderer: 'outputs/market-launch/wave1/tools/hero-render.mjs (unmodified)',
  strips: index,
}, null, 2));
process.stdout.write(`\nwrote ${path.join(STRIPS, 'index.json')}\n`);
