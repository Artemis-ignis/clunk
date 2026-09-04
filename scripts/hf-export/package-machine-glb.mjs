/**
 * meshopt packaging for the repaired Harvest Frontier machines.
 *
 * Same pass as `package-glb-instanced.mts` — EXT_mesh_gpu_instancing registered
 * so the tractor's lug scatters survive, the material-palette bake skipped
 * because these inputs already carry a baked palette — with ONE deliberate
 * difference: `dedup()` is not run over meshes.
 *
 * WHY. `dedup()` makes four identical row units share one glTF mesh. That saves
 * bytes, and it also makes the file's own stored triangle count a quarter of
 * what a renderer rasterises: the seeder stored 10,880 triangles and drew
 * 51,602. Both the listing and the product page's in-browser re-measure read the
 * STORED number, so the shop stated a figure no buyer's frame ever cost, and the
 * audit called it out as the catalogue's second-worst defect. With mesh dedup
 * off, one node owns one mesh, the stored count and the drawn count are the same
 * number, and the figure on the card is the figure the GPU pays. Accessors and
 * materials are still deduplicated, so the saving that costs nothing is kept.
 *
 * Usage: node package-machine-glb.mjs <in.glb> [more.glb ...]   ->  <in>.m1.glb
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
      throw new Error(`${material.getName()} carries colour in its base factor (${r},${g},${b}); this packaging pass would drop it`);
    }
  }
  const materialsBefore = document.getRoot().listMaterials().length;
  await document.transform(
    dedup({ propertyTypes: ['Accessor', 'Material', 'Texture', 'Skin'] }),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  await io.write(outputPath, document);
  const before = fs.statSync(inputPath).size;
  const after = fs.statSync(outputPath).size;
  process.stdout.write(
    `${path.basename(inputPath, '.glb')}: ${before} -> ${after} B, meshes ${document.getRoot().listMeshes().length}, nodes-with-mesh ${document.getRoot().listNodes().filter((n) => n.getMesh()).length}, materials ${materialsBefore} -> ${document.getRoot().listMaterials().length}\n`,
  );
}
