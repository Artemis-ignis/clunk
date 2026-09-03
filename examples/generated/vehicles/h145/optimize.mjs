#!/usr/bin/env node
/**
 * The `.m1` packaging pass for the H145 — the same meshopt rail the rest of the catalogue ships
 * on (scripts/hf-export/optimize-glb.mts), with one deliberate difference.
 *
 * That pass bakes every material's colour into COLOR_0 and collapses the authored materials into
 * a handful of palette materials, because the Harvest Frontier assets carry dozens of authored
 * materials and need the draw calls back. This model already ships nine, each of which is a
 * different physical surface — clearcoated paint, tinted glazing, brushed rotor-head metal, heat
 * -tinted exhaust, satin blade — so collapsing them would trade the one thing a buyer is paying
 * for (the PBR response) for a saving that is not needed. The livery is ALREADY vertex colour,
 * so the part of that pass which actually earns its keep here is already done in the factory.
 *
 * What runs: dedup, prune, then meshopt at level "high" with quantisation. Node names, the node
 * hierarchy and both animation clips are preserved — a pivot that loses its name stops being a
 * rig, and the optimiser has no business doing that.
 *
 *   node examples/generated/vehicles/h145/optimize.mjs [in.glb] [out.glb]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import {
  EXTMeshoptCompression,
  KHRMaterialsClearcoat,
  KHRMaterialsEmissiveStrength,
  KHRMaterialsIOR,
  KHRMaterialsSpecular,
  KHRMaterialsTransmission,
  KHRMaterialsVolume,
  KHRMeshQuantization,
} from "@gltf-transform/extensions";
import { dedup, meshopt, prune } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IN = path.resolve(process.argv[2] ?? path.join(HERE, "h145.glb"));
const OUT = path.resolve(process.argv[3] ?? IN.replace(/\.glb$/, ".m1.glb"));

const io = new NodeIO()
  .registerExtensions([
    EXTMeshoptCompression,
    KHRMaterialsClearcoat,
    KHRMaterialsEmissiveStrength,
    KHRMaterialsIOR,
    KHRMaterialsSpecular,
    KHRMaterialsTransmission,
    KHRMaterialsVolume,
    KHRMeshQuantization,
  ])
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;

const document = await io.read(IN);
const before = {
  materials: document.getRoot().listMaterials().length,
  nodes: document.getRoot().listNodes().length,
  animations: document.getRoot().listAnimations().map((a) => a.getName()),
  bytes: fs.statSync(IN).size,
};

await document.transform(
  dedup(),
  // `keepAttributes` is off, but names and extras stay: prune only removes what nothing references.
  prune({ keepLeaves: false }),
  meshopt({ encoder: MeshoptEncoder, level: "high" }),
);

await io.write(OUT, document);

const after = {
  materials: document.getRoot().listMaterials().length,
  nodes: document.getRoot().listNodes().length,
  animations: document.getRoot().listAnimations().map((a) => a.getName()),
  bytes: fs.statSync(OUT).size,
};

const namedBefore = new Set();
const reread = await io.read(OUT);
for (const n of reread.getRoot().listNodes()) if (n.getName()) namedBefore.add(n.getName());
const REQUIRED = [
  "main_rotor_hub", "fenestron_rotor", "door_left_slide", "door_right_slide",
  "door_rear_left", "door_rear_right",
];
const missing = REQUIRED.filter((n) => !namedBefore.has(n));

process.stdout.write(
  `${JSON.stringify(
    {
      in: IN,
      out: OUT,
      before,
      after,
      bytesSavedPct: Math.round((1 - after.bytes / before.bytes) * 1000) / 10,
      rigNodesPreserved: missing.length === 0,
      missingRigNodes: missing,
    },
    null,
    2,
  )}\n`,
);
if (missing.length) process.exitCode = 1;
