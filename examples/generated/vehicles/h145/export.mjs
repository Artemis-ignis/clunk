#!/usr/bin/env node
/**
 * Bakes the H145 factory to GLB, with the two clips baked in, and measures what came out.
 *
 * Same rail as scripts/template-library/bake.mjs — the same THREE injection, the same addon bag,
 * the same FileReader shim GLTFExporter needs under Node — plus authored animation tracks.
 *
 *   node examples/generated/vehicles/h145/export.mjs [--lod hero|coarse] [--out <path.glb>]
 */
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries, mergeVertices, toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import createH145 from "./h145.factory.mjs";

if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class NodeFileReader {
    readAsArrayBuffer(blob) {
      void blob.arrayBuffer().then((buffer) => { this.result = buffer; this.onloadend?.(); });
    }
    readAsDataURL(blob) {
      void blob.arrayBuffer().then((buffer) => {
        this.result = `data:application/octet-stream;base64,${Buffer.from(buffer).toString("base64")}`;
        this.onloadend?.();
      });
    }
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const flag = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const LOD = flag("--lod", "hero");
const OUT = resolve(flag("--out", resolve(HERE, LOD === "hero" ? "h145.glb" : `h145.${LOD}.glb`)));

const root = createH145(THREE, { mergeGeometries, mergeVertices, toCreasedNormals }, { lod: LOD });
const scene = new THREE.Scene();
scene.add(root);
scene.updateMatrixWorld(true);

// ------------------------------------------------------------------ clips

const quat = (axis, deg) => {
  const q = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0),
    (deg * Math.PI) / 180,
  );
  return [q.x, q.y, q.z, q.w];
};

/**
 * rotor_spin — a 1.000 s loop: the main rotor turns exactly once, the Fenestron exactly nine
 * times. 9:1 is the H145's real gearing (about 400 rpm main against about 3,600 rpm tail), so
 * a game plays this at timeScale 6.67 for true rotor speed and at 1.0 for a readable idle.
 * Quaternion keys land on quarter turns, where slerp is exact, so no key is a shortcut.
 */
function spinTrack(node, axis, turns, name) {
  const keysPerTurn = 4;
  const n = turns * keysPerTurn;
  const times = [];
  const values = [];
  for (let i = 0; i <= n; i += 1) {
    times.push(i / n);
    values.push(...quat(axis, (i * 360) / keysPerTurn));
  }
  return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values);
}

const rotorSpin = new THREE.AnimationClip("rotor_spin", 1.0, [
  spinTrack(null, "y", 1, "main_rotor_hub"),
  spinTrack(null, "x", 9, "fenestron_rotor"),
]);

/**
 * doors_open — 2.400 s. The sliding doors pop 95 mm outboard before they travel 1.300 m aft,
 * which is what the real external rail does and what keeps the door clear of a fuselage that is
 * narrowing behind it. The clamshells swing 64 degrees down and outboard on longitudinal hinges.
 */
const doorTracks = [];
for (const [name, side] of [["door_left_slide", -1], ["door_right_slide", 1]]) {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`missing node ${name}`);
  const p = node.position;
  const times = [0, 0.55, 2.4];
  const values = [
    p.x, p.y, p.z,
    p.x + side * 0.085, p.y, p.z,
    p.x + side * 0.085, p.y, p.z - 1.0,
  ];
  doorTracks.push(new THREE.VectorKeyframeTrack(`${name}.position`, times, values));
}
/*
 * The clamshells now hang on the FLAT REAR BULKHEAD and hinge VERTICALLY (about Y) on their
 * outboard edges, which is what the real aircraft does. The hinge axis lies on each door's
 * forward face, so every point of the door travels aft of that plane and the parked 14 mm gap
 * is the tightest the 24-phase sweep ever sees — where the old longitudinal hinge on the curved
 * aft-lower fuselage could not clear 0.05 mm at any axis position.
 */
for (const [name, side] of [["door_rear_left", -1], ["door_rear_right", 1]]) {
  if (!root.getObjectByName(name)) throw new Error(`missing node ${name}`);
  doorTracks.push(
    new THREE.QuaternionKeyframeTrack(
      `${name}.quaternion`,
      [0, 0.5, 1.4, 2.4],
      [...quat("y", 0), ...quat("y", -side * 14), ...quat("y", -side * 70), ...quat("y", -side * 100)],
    ),
  );
}
const doorsOpen = new THREE.AnimationClip("doors_open", 2.4, doorTracks);

// ------------------------------------------------------------------ measure + write

const box = new THREE.Box3().setFromObject(root);
const size = new THREE.Vector3();
box.getSize(size);
let triangles = 0;
let nodes = 0;
const materials = new Map();
const partList = [];
root.traverse((o) => {
  nodes += 1;
  if (!o.isMesh) return;
  const g = o.geometry;
  const t = Math.floor((g.index ? g.index.count : g.attributes.position.count) / 3);
  triangles += t;
  partList.push({ name: o.name, triangles: t, material: o.material.name });
  materials.set(o.material.name, (materials.get(o.material.name) ?? 0) + t);
});

const exporter = new GLTFExporter();
const result = await exporter.parseAsync(scene, { binary: true, animations: [rotorSpin, doorsOpen] });
await writeFile(OUT, Buffer.from(result));

const r3 = (v) => Math.round(v * 1000) / 1000;
const report = {
  file: OUT,
  lod: LOD,
  triangles,
  nodes,
  meshes: partList.length,
  materials: [...materials.keys()],
  materialCount: materials.size,
  boundsMetres: { x: r3(size.x), y: r3(size.y), z: r3(size.z) },
  boundsMin: { x: r3(box.min.x), y: r3(box.min.y), z: r3(box.min.z) },
  boundsMax: { x: r3(box.max.x), y: r3(box.max.y), z: r3(box.max.z) },
  byteLength: result.byteLength,
  clips: [
    { name: "rotor_spin", duration: 1.0, tracks: rotorSpin.tracks.map((t) => t.name) },
    { name: "doors_open", duration: 2.4, tracks: doorsOpen.tracks.map((t) => t.name) },
  ],
  parts: partList.sort((a, b) => b.triangles - a.triangles),
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
