/**
 * meshopt packaging pass for the Harvest Frontier exports.
 *
 * Same shape as Harvest Frontier's tools/assets/optimize-*-glb.ts: bake the
 * authored albedo into COLOR_0, collapse the fine-grained authored materials
 * into a small shared palette, then dedup / prune / meshopt. Nothing in HF is
 * touched — the pass reads the .glb this repo's exporter produced and writes a
 * sibling .m1.glb.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Material, NodeIO, type Document, type Primitive } from '@gltf-transform/core';
import {
  EXTMeshoptCompression,
  KHRMaterialsEmissiveStrength,
  KHRMaterialsClearcoat,
  KHRMaterialsIOR,
  KHRMaterialsSpecular,
  KHRMaterialsTransmission,
  KHRMaterialsUnlit,
  KHRMaterialsVolume,
  KHRMeshQuantization,
  type Clearcoat,
  type EmissiveStrength,
  type Transmission,
  type Unlit,
} from '@gltf-transform/extensions';
import { dedup, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../examples/harvest-frontier/exports');

const io = new NodeIO()
  .registerExtensions([
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

const extensionName = (ctor: { EXTENSION_NAME: string }): string => ctor.EXTENSION_NAME;
const rounded = (value: number): string => value.toFixed(3);

function bakeMaterialPalette(document: Document, slug: string): { before: number; after: number } {
  const root = document.getRoot();
  const before = root.listMaterials().length;
  const palette = new Map<string, Material>();
  const unlitExtension = document.createExtension(KHRMaterialsUnlit);
  const transmissionExtension = document.createExtension(KHRMaterialsTransmission);
  const clearcoatExtension = document.createExtension(KHRMaterialsClearcoat);
  const emissiveStrengthExtension = document.createExtension(KHRMaterialsEmissiveStrength);

  const kindFor = (source: Material): string => {
    if (source.getAlpha() < 0.01) return `hidden:${rounded(source.getAlpha())}`;
    if (source.getExtension<Unlit>(extensionName(KHRMaterialsUnlit))) return 'unlit';
    const transmission = source.getExtension<Transmission>(extensionName(KHRMaterialsTransmission));
    if (source.getAlphaMode() !== Material.AlphaMode.OPAQUE || source.getAlpha() < 0.999 || transmission) {
      return `glass:${rounded(source.getAlpha())}:${rounded(transmission?.getTransmissionFactor() ?? 0.12)}`;
    }
    const emissive = source.getEmissiveFactor();
    if (Math.max(...emissive) > 0.0001) {
      const strength = source.getExtension<EmissiveStrength>(extensionName(KHRMaterialsEmissiveStrength))?.getEmissiveStrength() ?? 1;
      return `emissive:${emissive.map(rounded).join(',')}:${rounded(strength)}`;
    }
    if ((source.getExtension<Clearcoat>(extensionName(KHRMaterialsClearcoat))?.getClearcoatFactor() ?? 0) > 0.0001) return 'coated';
    if (source.getMetallicFactor() >= 0.45) return 'metal';
    if (source.getRoughnessFactor() >= 0.88) return 'rubber';
    if (source.getRoughnessFactor() <= 0.3) return 'gloss';
    return 'matte';
  };

  const createPaletteMaterial = (key: string, source: Material): Material => {
    const alphaMatch = key.match(/^glass:([0-9.]+):([0-9.]+)/);
    const hiddenMatch = key.match(/^hidden:([0-9.]+)/);
    const material = document.createMaterial(`${slug}-palette-${key.replace(/[^a-zA-Z0-9-]/g, '-')}`);
    const alpha = alphaMatch ? Number(alphaMatch[1] ?? 1) : hiddenMatch ? Number(hiddenMatch[1] ?? 0) : 1;
    material.setBaseColorFactor([1, 1, 1, alpha]);
    material.setAlphaMode(alphaMatch !== null || hiddenMatch !== null ? 'BLEND' : 'OPAQUE');
    if (hiddenMatch || key === 'unlit') {
      material.setExtension(KHRMaterialsUnlit.EXTENSION_NAME, unlitExtension.createUnlit());
      return material;
    }
    if (alphaMatch) {
      material.setRoughnessFactor(0.18);
      material.setMetallicFactor(0.08);
      material.setExtension(
        KHRMaterialsTransmission.EXTENSION_NAME,
        transmissionExtension.createTransmission().setTransmissionFactor(Number(alphaMatch[2])),
      );
      return material;
    }
    const emissiveMatch = key.match(/^emissive:([^:]+):([0-9.]+)/);
    if (emissiveMatch) {
      material.setRoughnessFactor(0.28);
      material.setMetallicFactor(0.1);
      const rgb = (emissiveMatch[1] ?? '1,1,1').split(',').map(Number);
      material.setEmissiveFactor([rgb[0] ?? 1, rgb[1] ?? 1, rgb[2] ?? 1]);
      const strength = Number(emissiveMatch[2] ?? 1);
      if (strength !== 1) {
        material.setExtension(
          KHRMaterialsEmissiveStrength.EXTENSION_NAME,
          emissiveStrengthExtension.createEmissiveStrength().setEmissiveStrength(strength),
        );
      }
      return material;
    }
    const settings: Record<string, readonly [number, number]> = {
      coated: [0.46, 0.34], metal: [0.52, 0.58], rubber: [0.94, 0.03], gloss: [0.24, 0.18], matte: [0.76, 0.06],
    };
    const [roughness, metalness] = settings[key] ?? [0.76, 0.06];
    material.setRoughnessFactor(roughness);
    material.setMetallicFactor(metalness);
    if (key === 'coated') {
      const sourceClearcoat = source.getExtension<Clearcoat>(extensionName(KHRMaterialsClearcoat));
      material.setExtension(
        KHRMaterialsClearcoat.EXTENSION_NAME,
        clearcoatExtension.createClearcoat()
          .setClearcoatFactor(Math.max(0.12, sourceClearcoat?.getClearcoatFactor() ?? 0.18))
          .setClearcoatRoughnessFactor(sourceClearcoat?.getClearcoatRoughnessFactor() ?? 0.28),
      );
    }
    return material;
  };

  const bakeColor = (primitive: Primitive, source: Material): void => {
    if (source.getBaseColorTexture()) throw new Error(`textured primitive refuses palette bake: ${source.getName()}`);
    const factor = source.getBaseColorFactor();
    const position = primitive.getAttribute('POSITION');
    if (!position) return;
    const colors = primitive.getAttribute('COLOR_0');
    const count = position.getCount();
    if (colors) {
      const array = colors.getArray();
      if (!array) return;
      const elementSize = colors.getElementSize();
      const normalized = colors.getNormalized();
      const componentType = colors.getComponentType();
      const max = componentType === 5121 ? 255 : componentType === 5123 ? 65535 : 1;
      const output = new Float32Array(array.length);
      for (let index = 0; index < count; index += 1) {
        const offset = index * elementSize;
        for (let component = 0; component < elementSize; component += 1) {
          const raw = Number(array[offset + component] ?? 1);
          const value = normalized ? raw / max : raw;
          output[offset + component] = component < 3 ? value * (factor[component] ?? 1) : value;
        }
      }
      colors.setArray(output).setNormalized(false);
      return;
    }
    const output = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      output[index * 3] = factor[0];
      output[index * 3 + 1] = factor[1];
      output[index * 3 + 2] = factor[2];
    }
    primitive.setAttribute('COLOR_0', document.createAccessor(`${source.getName()}-baked-color`).setType('VEC3').setArray(output));
  };

  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const source = primitive.getMaterial();
      if (!source) continue;
      const key = kindFor(source);
      let shared = palette.get(key);
      if (!shared) {
        shared = createPaletteMaterial(key, source);
        palette.set(key, shared);
      }
      bakeColor(primitive, source);
      primitive.setMaterial(shared);
    }
  }
  return { before, after: palette.size };
}

const files: string[] = [];
for (const group of fs.readdirSync(OUT)) {
  const dir = path.join(OUT, group);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith('.glb') && !file.endsWith('.m1.glb')) files.push(path.join(dir, file));
  }
}

const report: Record<string, unknown>[] = [];
for (const inputPath of files) {
  const slug = path.basename(inputPath, '.glb');
  const outputPath = inputPath.replace(/\.glb$/, '.m1.glb');
  const document = await io.read(inputPath);
  const palette = bakeMaterialPalette(document, slug);
  await document.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  await io.write(outputPath, document);
  const before = fs.statSync(inputPath).size;
  const after = fs.statSync(outputPath).size;
  report.push({ slug, before, after, ratio: Math.round((after / before) * 1000) / 1000, materials: palette });
  process.stdout.write(`${slug}: ${before} -> ${after} B (${Math.round((1 - after / before) * 100)}% smaller), materials ${palette.before} -> ${palette.after}\n`);
}
fs.writeFileSync(path.join(OUT, 'optimize.report.json'), JSON.stringify(report, null, 2));
