/**
 * Prove the exported clips actually drive the exported nodes.
 *
 * A GLB can carry an animation whose tracks name nodes that do not exist in the
 * file — three's exporter will happily write tracks it could not bind, and the
 * failure is silent at load time. So this loads each animated GLB back through
 * GLTFLoader, resolves every track through the same PropertyBinding the runtime
 * uses, then runs a real AnimationMixer and checks that the bound nodes' local
 * transforms MOVE away from the rest pose.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../examples/harvest-frontier/exports');

async function load(file: string): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  const buffer = fs.readFileSync(file);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder as unknown as Parameters<GLTFLoader['setMeshoptDecoder']>[0]);
  return await new Promise((ok, fail) => loader.parse(arrayBuffer as ArrayBuffer, '', (gltf) => ok({ scene: gltf.scene, animations: gltf.animations }), fail));
}

interface ClipReport {
  clip: string;
  scaledUpNodes?: string[];
  seconds: number;
  tracks: number;
  unbound: string[];
  movedNodes: number;
  maxDelta: number;
  /**
   * Largest gap between a track's first and last keyframe. A clip meant to loop
   * has to close on itself, or it pops once per cycle - and a pop in a walk or
   * a hoe swing is the kind of thing a buyer notices on the second play.
   */
  loopGap: number;
}

function snapshot(scene: THREE.Object3D): Map<string, number[]> {
  const state = new Map<string, number[]>();
  scene.traverse((node) => {
    state.set(node.uuid, [
      node.position.x, node.position.y, node.position.z,
      node.quaternion.x, node.quaternion.y, node.quaternion.z, node.quaternion.w,
      node.scale.x, node.scale.y, node.scale.z,
    ]);
  });
  return state;
}

const files = fs.readdirSync(OUT)
  .filter((group) => fs.statSync(path.join(OUT, group)).isDirectory() && group !== 'render' && group !== '2d')
  .flatMap((group) => fs.readdirSync(path.join(OUT, group))
    .filter((f) => f.endsWith('.m1.glb'))
    .map((f) => path.join(OUT, group, f)));

const report: Record<string, ClipReport[]> = {};
let failures = 0;

for (const file of files) {
  const { scene, animations } = await load(file);
  if (animations.length === 0) continue;
  const slug = path.basename(file, '.m1.glb');
  const rows: ClipReport[] = [];

  for (const clip of animations) {
    // 1. Every track must resolve to a node that is really in this file.
    const unbound = clip.tracks
      .filter((track) => {
        const parsed = THREE.PropertyBinding.parseTrackName(track.name);
        return THREE.PropertyBinding.findNode(scene, parsed.nodeName) === undefined
          || THREE.PropertyBinding.findNode(scene, parsed.nodeName) === null;
      })
      .map((track) => track.name);

    // 2. A real mixer must actually change those nodes' local transforms.
    const rest = snapshot(scene);
    const mixer = new THREE.AnimationMixer(scene);
    const action = mixer.clipAction(clip);
    action.play();
    let movedNodes = 0;
    let maxDelta = 0;
    // Sample a few phases so a clip whose first frame equals the rest pose is
    // still caught moving.
    for (const phase of [0.17, 0.41, 0.63, 0.86]) {
      mixer.setTime(clip.duration * phase);
      const moved = new Set<string>();
      scene.traverse((node) => {
        const before = rest.get(node.uuid);
        if (!before) return;
        const now = [
          node.position.x, node.position.y, node.position.z,
          node.quaternion.x, node.quaternion.y, node.quaternion.z, node.quaternion.w,
          node.scale.x, node.scale.y, node.scale.z,
        ];
        const delta = Math.max(...now.map((v, i) => Math.abs(v - (before[i] ?? 0))));
        if (delta > 1e-5) moved.add(node.uuid);
        maxDelta = Math.max(maxDelta, delta);
      });
      movedNodes = Math.max(movedNodes, moved.size);
    }
    action.stop();
    mixer.uncacheClip(clip);
    // Put the scene back so the next clip measures against the same rest pose.
    scene.traverse((node) => {
      const before = rest.get(node.uuid);
      if (!before) return;
      node.position.set(before[0]!, before[1]!, before[2]!);
      node.quaternion.set(before[3]!, before[4]!, before[5]!, before[6]!);
      node.scale.set(before[7]!, before[8]!, before[9]!);
    });

    // Which nodes this clip scales up from the file's rest scale of 0 - the
    // glTF-has-no-visibility trick, verified rather than assumed.
    const shown: string[] = [];
    {
      const probe = new THREE.AnimationMixer(scene);
      probe.clipAction(clip).play();
      probe.setTime(clip.duration * 0.5);
      scene.traverse((node) => { if (node.scale.x > 0.5 && (rest.get(node.uuid)?.[7] ?? 1) < 0.5) shown.push(node.name); });
      probe.stopAllAction();
      probe.uncacheClip(clip);
      scene.traverse((node) => {
        const before = rest.get(node.uuid);
        if (before) node.scale.set(before[7]!, before[8]!, before[9]!);
      });
    }

    // Does the clip close? Compare each track's first sample against its last.
    const loopGap = Math.max(0, ...clip.tracks.map((track) => {
      const stride = track.values.length / track.times.length;
      let gap = 0;
      for (let i = 0; i < stride; i += 1) {
        const first = track.values[i] ?? 0;
        const last = track.values[track.values.length - stride + i] ?? 0;
        gap = Math.max(gap, Math.abs(first - last));
      }
      return gap;
    }));

    const row: ClipReport = {
      clip: clip.name,
      scaledUpNodes: shown,
      seconds: Math.round(clip.duration * 1000) / 1000,
      tracks: clip.tracks.length,
      unbound,
      movedNodes,
      maxDelta: Math.round(maxDelta * 100000) / 100000,
      loopGap: Math.round(loopGap * 100000) / 100000,
    };
    rows.push(row);
    const ok = unbound.length === 0 && movedNodes > 0;
    if (!ok) failures += 1;
    process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${slug.padEnd(18)} ${clip.name.padEnd(9)} ${String(row.seconds).padStart(6)}s  tracks=${String(row.tracks).padStart(2)}  unbound=${unbound.length}  nodesMoved=${row.movedNodes}  maxDelta=${row.maxDelta}  loopGap=${row.loopGap}\n`);
  }
  report[slug] = rows;
}

fs.writeFileSync(path.join(OUT, 'clip-verification.json'), JSON.stringify({
  checkedAt: new Date().toISOString(),
  method: 'GLTFLoader (+MeshoptDecoder) -> PropertyBinding.findNode per track -> AnimationMixer.setTime at 4 phases -> local TRS diff vs rest pose; loopGap is the largest first-keyframe-to-last-keyframe difference across the clip tracks',
  failures,
  assets: report,
}, null, 2));

process.stdout.write(`\n${failures === 0 ? 'all clips bind and animate' : `${failures} clip(s) FAILED`}\n`);
if (failures > 0) process.exitCode = 1;
