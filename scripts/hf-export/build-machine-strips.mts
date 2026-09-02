/**
 * Frame strips for the four animated machines: six phases of each clip, from
 * the front and from the side, through the untouched wave-1 hero renderer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THREE, crossThree } from './lib.mjs';
import { GLTFLoader } from '../../../Harvest Frontier/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../../../Harvest Frontier/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js';
import { composeRows, renderStrip, SCRATCH, VIEW_YAW, writeStripGlb, yawForFront } from './strip-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../examples/harvest-frontier/exports');
const ANIMATED = path.resolve(HERE, '../../examples/harvest-frontier/runtime-animated');
const STRIPS = path.join(OUT, 'anim-strips');
const PHASES = [0, 0.17, 0.34, 0.5, 0.67, 0.84];

// Which way each machine travels / faces, so "front" and "side" mean something.
// The tractor drives along its local -X (gameSession.ts:5275-5276 steps the body
// by (-cos yaw, 0, sin yaw)); the two implements hang off its hitch on the same
// axis. The processing line is a static building fixture whose operator side is
// its -Z face, with the conveyor running along X.
const FRONT: Record<string, readonly [number, number]> = {
  'tractor.compact.m1.glb': [-1, 0],
  'cultivator.compact.m1.glb': [-1, 0],
  'seeder.compact.m1.glb': [-1, 0],
  'processing.line.m1.glb': [0, -1],
};

async function load(file: string): Promise<{ scene: THREE.Object3D; clips: THREE.AnimationClip[] }> {
  const buffer = fs.readFileSync(file);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder as unknown as Parameters<GLTFLoader['setMeshoptDecoder']>[0]);
  return await new Promise((ok, fail) => loader.parse(
    arrayBuffer as ArrayBuffer,
    '',
    (gltf) => ok({ scene: gltf.scene as unknown as THREE.Object3D, clips: gltf.animations as unknown as THREE.AnimationClip[] }),
    fail,
  ));
}

const index: Record<string, string[]> = {};

for (const file of fs.readdirSync(ANIMATED).filter((f) => f.endsWith('.glb'))) {
  const machine = file.replace(/\.compact\.m1\.glb$|\.m1\.glb$/, '');
  const { scene, clips } = await load(path.join(ANIMATED, file));
  const [fx, fz] = FRONT[file] ?? [0, -1];
  const frontYaw = yawForFront(fx, fz);
  scene.updateMatrixWorld(true);
  const extent = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
  const spacing = Math.max(extent.x, extent.z) * 1.12;

  for (const clip of clips) {
    const mixer = new THREE.AnimationMixer(scene);
    const action = mixer.clipAction(clip);
    action.play();
    for (const view of ['front', 'side'] as const) {
      const poses = PHASES.map((p) => {
        mixer.setTime(0);
        mixer.setTime(clip.duration * p);
        scene.updateMatrixWorld(true);
        return crossThree<THREE.Object3D>(scene.clone(true));
      });
      const glb = path.join(SCRATCH, `${machine}-${clip.name}-${view}.glb`);
      const png = glb.replace(/\.glb$/, '.png');
      // writeStripGlb yaws the whole row for a subject whose front is -Z. These
      // machines travel along -X, so pre-yaw each subject by the difference and
      // the row yaw then lands the machine's own forward at the camera.
      for (const pose of poses) pose.rotation.y += frontYaw - VIEW_YAW.front;
      await writeStripGlb(poses, view, spacing, glb);
      renderStrip(glb, png);
      const out = path.join(STRIPS, `${machine}-${clip.name}-${view}.png`);
      await composeRows([{ label: `${machine} / ${clip.name} / ${view} / ${clip.duration.toFixed(3)} s loop - phases ${PHASES.join(', ')}`, png }], out);
      (index[`${machine}.${clip.name}`] ??= []).push(path.relative(OUT, out).split(path.sep).join('/'));
      process.stdout.write(`${path.relative(OUT, out)}\n`);
    }
    action.stop();
    mixer.uncacheClip(clip);
  }
}

const indexPath = path.join(STRIPS, 'machines.json');
fs.writeFileSync(indexPath, JSON.stringify({ builtAt: new Date().toISOString(), phases: PHASES, strips: index }, null, 2));
process.stdout.write(`\nwrote ${indexPath}\n`);
