/**
 * Load every exported GLB back through GLTFLoader (+ MeshoptDecoder for the
 * .m1 derivatives) and write the delivery manifest from the FILES, not from
 * the in-memory scene the exporter happened to hold.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../examples/harvest-frontier/exports');
const raw = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.raw.json'), 'utf8')) as {
  generatedAt: string;
  assets: Record<string, any>[];
};

async function load(file: string): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  const buffer = fs.readFileSync(file);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder as unknown as Parameters<GLTFLoader['setMeshoptDecoder']>[0]);
  return await new Promise((ok, fail) => loader.parse(arrayBuffer as ArrayBuffer, '', (gltf) => ok({ scene: gltf.scene, animations: gltf.animations }), fail));
}

function measure(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
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
    for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) if (material) materials.add(material.uuid);
  });
  if (box.isEmpty()) box.set(new THREE.Vector3(), new THREE.Vector3());
  box.getSize(size);
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return {
    triangles: Math.round(triangles),
    drawCalls: meshes,
    materials: materials.size,
    sizeMeters: { x: r(size.x), y: r(size.y), z: r(size.z) },
    groundedAtY: r(box.min.y),
  };
}

const assets: Record<string, unknown>[] = [];
for (const entry of raw.assets) {
  const rawFile = path.join(OUT, entry.file);
  const m1File = rawFile.replace(/\.glb$/, '.m1.glb');
  const rawLoaded = await load(rawFile);
  const rawMeasured = measure(rawLoaded.scene);
  const hasM1 = fs.existsSync(m1File);
  const m1Loaded = hasM1 ? await load(m1File) : null;
  const m1Measured = m1Loaded ? measure(m1Loaded.scene) : null;
  const clips = (m1Loaded ?? rawLoaded).animations.map((c) => ({
    name: c.name,
    seconds: Math.round(c.duration * 1000) / 1000,
    tracks: c.tracks.length,
  }));
  const renderName = `${entry.group}-${entry.slug}`;
  assets.push({
    group: entry.group,
    slug: entry.slug,
    files: {
      raw: entry.file,
      meshopt: hasM1 ? entry.file.replace(/\.glb$/, '.m1.glb') : null,
    },
    bytes: { raw: fs.statSync(rawFile).size, meshopt: hasM1 ? fs.statSync(m1File).size : null },
    measured: { raw: rawMeasured, meshopt: m1Measured },
    animationClips: clips,
    provenanceAssetId: entry.provenanceAssetId,
    license: entry.license,
    note: entry.note,
    // What the re-socketing pass actually did to this NPC's carried kit.
    ...(entry.kit ? { kit: entry.kit } : {}),
    render: fs.existsSync(path.join(OUT, 'render', `${renderName}.png`)) ? `render/${renderName}.png` : null,
  });
  process.stdout.write(`${entry.group}/${entry.slug}: raw ${rawMeasured.triangles}t/${rawMeasured.drawCalls}d/${rawMeasured.materials}m -> m1 ${m1Measured?.triangles}t/${m1Measured?.drawCalls}d/${m1Measured?.materials}m | ${m1Measured?.sizeMeters.x}x${m1Measured?.sizeMeters.y}x${m1Measured?.sizeMeters.z} m | clips ${clips.map((c) => `${c.name}:${c.seconds}s`).join(',') || '-'}\n`);
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({
  generatedAt: raw.generatedAt,
  source: 'Harvest Frontier (C:/Users/50106/Desktop/Harvest Frontier) — read-only',
  exporter: 'Clunk/scripts/hf-export/export-hf-assets.mts (three r185 GLTFExporter) + optimize-glb.mts (@gltf-transform meshopt, HF optimize-*-glb.ts pattern)',
  renderer: 'Clunk/outputs/market-launch/wave1/tools/hero-render.mjs (flat-shaded software rasteriser, no PBR)',
  assets,
}, null, 2));
process.stdout.write(`\nwrote ${path.join(OUT, 'manifest.json')}\n`);
