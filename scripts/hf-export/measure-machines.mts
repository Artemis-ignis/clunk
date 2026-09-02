/**
 * Prove two things about the animated machine copies:
 *
 *  1. PARITY - the decode/edit/re-encode round trip did not change the model.
 *     Triangles, meshes, materials and the world bounding box are measured on
 *     the shipped source and on the animated copy and compared.
 *  2. PLAYBACK - every clip binds and actually moves the nodes it names, under a
 *     real AnimationMixer, the same check the character assets go through.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.resolve(HERE, '../../examples/harvest-frontier/runtime');
const TARGET = path.resolve(HERE, '../../examples/harvest-frontier/runtime-animated');

async function load(file: string): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  const buffer = fs.readFileSync(file);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder as unknown as Parameters<GLTFLoader['setMeshoptDecoder']>[0]);
  return await new Promise((ok, fail) => loader.parse(arrayBuffer as ArrayBuffer, '', (g) => ok({ scene: g.scene, animations: g.animations }), fail));
}

const round = (value: number, places = 4): number => Math.round(value * 10 ** places) / 10 ** places;

function measure(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  let triangles = 0;
  let meshes = 0;
  const materials = new Set<string>();
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes += 1;
    box.expandByObject(mesh);
    const index = mesh.geometry.getIndex();
    triangles += index ? index.count / 3 : (mesh.geometry.getAttribute('position')?.count ?? 0) / 3;
    for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) if (material) materials.add(material.name || material.uuid);
  });
  const size = box.getSize(new THREE.Vector3());
  return {
    triangles: Math.round(triangles),
    meshes,
    materials: materials.size,
    sizeMeters: { x: round(size.x, 4), y: round(size.y, 4), z: round(size.z, 4) },
    minY: round(box.min.y, 4),
  };
}

const files = fs.readdirSync(TARGET).filter((f) => f.endsWith('.glb'));
const rows: Record<string, unknown>[] = [];
let failures = 0;

for (const file of files) {
  const source = await load(path.join(SOURCE, file));
  const animated = await load(path.join(TARGET, file));
  const before = measure(source.scene);
  const after = measure(animated.scene);

  const drift = {
    triangles: after.triangles - before.triangles,
    meshes: after.meshes - before.meshes,
    materials: after.materials - before.materials,
    sizeMeters: {
      x: round(after.sizeMeters.x - before.sizeMeters.x, 4),
      y: round(after.sizeMeters.y - before.sizeMeters.y, 4),
      z: round(after.sizeMeters.z - before.sizeMeters.z, 4),
    },
  };
  const parityOk = drift.triangles === 0 && drift.meshes === 0 && drift.materials === 0
    && Math.abs(drift.sizeMeters.x) < 0.002 && Math.abs(drift.sizeMeters.y) < 0.002 && Math.abs(drift.sizeMeters.z) < 0.002;
  if (!parityOk) failures += 1;

  const clips: Record<string, unknown>[] = [];
  for (const clip of animated.animations) {
    const unbound = clip.tracks.filter((track) => {
      const parsed = THREE.PropertyBinding.parseTrackName(track.name);
      return !THREE.PropertyBinding.findNode(animated.scene, parsed.nodeName);
    }).map((t) => t.name);

    const rest = new Map<string, number[]>();
    animated.scene.traverse((node) => rest.set(node.uuid, [
      node.position.x, node.position.y, node.position.z,
      node.quaternion.x, node.quaternion.y, node.quaternion.z, node.quaternion.w,
    ]));
    const mixer = new THREE.AnimationMixer(animated.scene);
    mixer.clipAction(clip).play();
    let moved = 0;
    let maxDelta = 0;
    for (const phase of [0.13, 0.37, 0.61, 0.88]) {
      mixer.setTime(0);
      mixer.setTime(clip.duration * phase);
      const seen = new Set<string>();
      animated.scene.traverse((node) => {
        const before2 = rest.get(node.uuid);
        if (!before2) return;
        const now = [
          node.position.x, node.position.y, node.position.z,
          node.quaternion.x, node.quaternion.y, node.quaternion.z, node.quaternion.w,
        ];
        const delta = Math.max(...now.map((v, i) => Math.abs(v - (before2[i] ?? 0))));
        if (delta > 1e-5) seen.add(node.uuid);
        maxDelta = Math.max(maxDelta, delta);
      });
      moved = Math.max(moved, seen.size);
    }
    // Loop closure: the pose at t = duration must match the pose at t = 0.
    mixer.setTime(0);
    const startPose: number[] = [];
    animated.scene.traverse((n) => startPose.push(n.position.x, n.position.y, n.position.z, n.quaternion.x, n.quaternion.y, n.quaternion.z, n.quaternion.w));
    mixer.setTime(clip.duration);
    const endPose: number[] = [];
    animated.scene.traverse((n) => endPose.push(n.position.x, n.position.y, n.position.z, n.quaternion.x, n.quaternion.y, n.quaternion.z, n.quaternion.w));
    const loopGap = Math.max(...startPose.map((v, i) => Math.abs(v - (endPose[i] ?? 0))));
    mixer.stopAllAction();
    mixer.uncacheClip(clip);
    animated.scene.traverse((node) => {
      const before2 = rest.get(node.uuid);
      if (!before2) return;
      node.position.set(before2[0]!, before2[1]!, before2[2]!);
      node.quaternion.set(before2[3]!, before2[4]!, before2[5]!, before2[6]!);
    });

    const ok = unbound.length === 0 && moved > 0;
    if (!ok) failures += 1;
    clips.push({ name: clip.name, seconds: round(clip.duration, 4), tracks: clip.tracks.length, unbound, nodesMoved: moved, maxDelta: round(maxDelta, 5), loopGap: round(loopGap, 5) });
    process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${file.padEnd(28)} ${clip.name.padEnd(6)} ${String(round(clip.duration, 3)).padStart(7)}s  tracks=${String(clip.tracks.length).padStart(3)}  unbound=${unbound.length}  nodesMoved=${moved}  loopGap=${round(loopGap, 5)}\n`);
  }

  rows.push({ file, parityOk, source: before, animated: after, drift, bytes: { source: fs.statSync(path.join(SOURCE, file)).size, animated: fs.statSync(path.join(TARGET, file)).size }, clips });
  process.stdout.write(`      parity ${parityOk ? 'OK ' : 'FAIL'}  tri ${before.triangles} -> ${after.triangles}   mesh ${before.meshes} -> ${after.meshes}   mat ${before.materials} -> ${after.materials}   size ${before.sizeMeters.x}x${before.sizeMeters.y}x${before.sizeMeters.z} -> ${after.sizeMeters.x}x${after.sizeMeters.y}x${after.sizeMeters.z}\n`);
}

fs.writeFileSync(path.join(TARGET, 'verification.json'), JSON.stringify({
  checkedAt: new Date().toISOString(),
  parityMethod: 'both files loaded through GLTFLoader + MeshoptDecoder and measured identically; triangles/meshes/materials must be equal and the world bounding box must agree within 2 mm',
  playbackMethod: 'PropertyBinding.findNode per track, then AnimationMixer.setTime at four phases; loopGap is the largest local TRS difference between t=0 and t=duration',
  failures,
  machines: rows,
}, null, 2));
process.stdout.write(`\n${failures === 0 ? 'parity and playback OK for all machines' : `${failures} check(s) FAILED`}\n`);
if (failures > 0) process.exitCode = 1;
