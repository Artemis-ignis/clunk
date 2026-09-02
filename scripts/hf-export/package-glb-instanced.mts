/**
 * meshopt packaging for a corrected machine GLB that carries GPU instancing.
 *
 * WHY THIS EXISTS. `optimize-glb.mts` is the packaging pass for this repo and it
 * is the one to use. It cannot read `tractor.compact.m1.glb` or anything derived
 * from it: that file declares EXT_mesh_gpu_instancing as a REQUIRED extension
 * (its four `treadLugs` nodes carry 48 lug instances each), and the NodeIO in
 * `optimize-glb.mts` does not register it, so the read throws
 * `Missing required extension, "EXT_mesh_gpu_instancing"`. The runtime-animated
 * machines did not come from that script, which is why the gap never showed.
 *
 * WHAT IS DIFFERENT. Only two things:
 *   - EXTMeshGPUInstancing is registered, so the lug instances survive the trip
 *     instead of the read failing. Baking them into 192 loose meshes would have
 *     been the alternative and it would have cost a buyer four draw calls per
 *     wheel for nothing.
 *   - The material palette bake is skipped. It is already baked: these inputs
 *     ship a collapsed `*-palette-*` material set whose base colour factor is
 *     white with the colour in COLOR_0, so re-running the bake would multiply by
 *     1. The script asserts that, and refuses rather than silently shifting a
 *     colour if it ever stops being true.
 * Everything else -- dedup, prune, meshopt at level 'high' -- is the same pass in
 * the same order, and the output is written as a sibling `.m1.glb`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import {
  EXTMeshGPUInstancing,
  EXTMeshoptCompression,
  KHRMaterialsEmissiveStrength,
  KHRMaterialsClearcoat,
  KHRMaterialsIOR,
  KHRMaterialsSpecular,
  KHRMaterialsTransmission,
  KHRMaterialsUnlit,
  KHRMaterialsVolume,
  KHRMeshQuantization,
} from '@gltf-transform/extensions';
import { dedup, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const io = new NodeIO()
  .registerExtensions([
    EXTMeshGPUInstancing,
    EXTMeshoptCompression,
    KHRMaterialsEmissiveStrength,
    KHRMaterialsClearcoat,
    KHRMaterialsIOR,
    KHRMaterialsSpecular,
    KHRMaterialsTransmission,
    KHRMaterialsUnlit,
    KHRMaterialsVolume,
    KHRMeshQuantization,
  ])
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;

for (const argument of process.argv.slice(2)) {
  const inputPath = path.resolve(argument);
  const outputPath = inputPath.replace(/\.glb$/, '.m1.glb');
  const document = await io.read(inputPath);
  for (const material of document.getRoot().listMaterials()) {
    const [r, g, b] = material.getBaseColorFactor();
    if (Math.min(r, g, b) < 0.999) {
      throw new Error(`${material.getName()} carries colour in its base factor (${r},${g},${b}); this packaging pass would drop it -- use optimize-glb.mts instead`);
    }
  }
  const materialsBefore = document.getRoot().listMaterials().length;
  await document.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  await io.write(outputPath, document);
  const before = fs.statSync(inputPath).size;
  const after = fs.statSync(outputPath).size;
  process.stdout.write(
    `${path.basename(inputPath, '.glb')}: ${before} -> ${after} B (${Math.round((1 - after / before) * 100)}% smaller), materials ${materialsBefore} -> ${document.getRoot().listMaterials().length}\n`,
  );
}
