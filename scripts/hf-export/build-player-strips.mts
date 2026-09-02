/**
 * Frame strips for the player farmhand: what the game plays today, against what
 * the exported clip plays, at the same phases, front and side.
 *
 * Both rows are built inside Harvest Frontier's own three, so the exported GLB
 * is read back with HF's GLTFLoader rather than Clunk's - one THREE, one set of
 * instanceof checks, and the row can go straight back through GLTFExporter.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THREE, crossThree } from './lib.mjs';
import { GLTFLoader } from '../../../Harvest Frontier/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { createPlayerAvatar, ACTION_DURATION_SECONDS } from '../../../Harvest Frontier/src/engine/animation/playerMotion';
import { GAIT_SPEED_REFERENCE, gaitAngularVelocity } from '../../../Harvest Frontier/src/engine/animation/gait';
import { composeRows, renderStrip, SCRATCH, writeStripGlb, type ViewName } from './strip-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../examples/harvest-frontier/exports');
const STRIPS = path.join(OUT, 'anim-strips');
const PHASES = [0, 0.2, 0.4, 0.6, 0.8, 0.95];
const FINE = 1 / 240;
const TOOL_FOR_CLIP: Record<string, string> = { hoe: 'tool.hoe', water: 'tool.water', harvest: 'tool.harvest' };

/** The pose Harvest Frontier's controller produces right now, unmodified. */
function gamePose(clipName: string, phase: number): THREE.Object3D {
  const avatar = createPlayerAvatar();
  const root = crossThree<THREE.Object3D>(avatar.root);
  if (clipName === 'idle' || clipName === 'walk') {
    const moving = clipName === 'walk';
    const speed = moving ? GAIT_SPEED_REFERENCE : 0;
    const duration = moving ? (2 * Math.PI) / gaitAngularVelocity(GAIT_SPEED_REFERENCE) : (2 * Math.PI) / 0.7;
    let elapsed = 0;
    const target = duration * phase;
    avatar.motion.update(0, moving, speed);
    while (elapsed + 1e-9 < target) {
      const step = Math.min(FINE, target - elapsed);
      avatar.motion.update(step, moving, speed);
      elapsed += step;
    }
  } else {
    const action = clipName as keyof typeof ACTION_DURATION_SECONDS;
    const duration = ACTION_DURATION_SECONDS[action];
    avatar.motion.setTool(action);
    avatar.motion.trigger(action);
    avatar.motion.update(0, false, 0);
    let elapsed = 0;
    const target = Math.min(duration * phase, duration - 1e-3);
    while (elapsed + 1e-9 < target) {
      const step = Math.min(FINE, target - elapsed);
      avatar.motion.update(step, false, 0);
      elapsed += step;
    }
  }
  // Match what the export ships: no water VFX, no field journal, and only the
  // tool this clip uses (glTF cannot hide the others).
  root.getObjectByName('waterStream')?.removeFromParent();
  root.getObjectByName('tool.inspect')?.removeFromParent();
  for (const [clip, tool] of Object.entries(TOOL_FOR_CLIP)) {
    if (clip !== clipName) root.getObjectByName(tool)?.removeFromParent();
  }
  delete (root.userData as Record<string, unknown>).motionController;
  return root;
}

async function loadExported(): Promise<{ scene: THREE.Object3D; clips: THREE.AnimationClip[] }> {
  const file = path.join(OUT, 'npc', 'player-farmhand.glb');
  const buffer = fs.readFileSync(file);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const loader = new GLTFLoader();
  return await new Promise((ok, fail) => loader.parse(arrayBuffer as ArrayBuffer, '', (g) => ok({ scene: g.scene, clips: g.animations }), fail));
}

const exported = await loadExported();
const index: Record<string, string[]> = {};

for (const clip of exported.clips) {
  const mixer = new THREE.AnimationMixer(exported.scene);
  const action = mixer.clipAction(clip);
  action.play();

  for (const view of ['front', 'side'] as ViewName[]) {
    const gameRow = PHASES.map((p) => gamePose(clip.name, p));
    const clipRow = PHASES.map((p) => {
      mixer.setTime(0);
      mixer.setTime(clip.duration * Math.min(p, 1 - 1e-6));
      exported.scene.updateMatrixWorld(true);
      return exported.scene.clone(true);
    });

    const gameGlb = path.join(SCRATCH, `player-${clip.name}-${view}-game.glb`);
    const clipGlb = path.join(SCRATCH, `player-${clip.name}-${view}-clip.glb`);
    await writeStripGlb(gameRow, view, 1.35, gameGlb);
    await writeStripGlb(clipRow, view, 1.35, clipGlb);
    const gamePng = gameGlb.replace(/\.glb$/, '.png');
    const clipPng = clipGlb.replace(/\.glb$/, '.png');
    renderStrip(gameGlb, gamePng);
    renderStrip(clipGlb, clipPng);

    const out = path.join(STRIPS, `player-${clip.name}-${view}.png`);
    await composeRows([
      { label: `${clip.name} / ${view} / GAME as Harvest Frontier plays it today  -  phases ${PHASES.join(', ')}`, png: gamePng },
      { label: `${clip.name} / ${view} / EXPORTED clip (player-farmhand.glb)`, png: clipPng },
    ], out);
    (index[clip.name] ??= []).push(path.relative(OUT, out).replace(/\\/g, '/'));
    process.stdout.write(`${path.relative(OUT, out)}\n`);
  }

  action.stop();
  mixer.uncacheClip(clip);
}

fs.writeFileSync(path.join(STRIPS, 'index.json'), JSON.stringify({
  builtAt: new Date().toISOString(),
  subject: 'npc/player-farmhand.glb',
  phases: PHASES,
  views: { front: 'subject yawed so its authored front (-Z) faces the renderer camera', side: 'front view yawed a further -90 deg' },
  renderer: 'outputs/market-launch/wave1/tools/hero-render.mjs (unmodified)',
  strips: index,
}, null, 2));
process.stdout.write(`\nwrote ${path.join(STRIPS, 'index.json')}\n`);
