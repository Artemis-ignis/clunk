/**
 * Bakes one template in one colourway into GLB bytes, and measures what came out.
 *
 * This is scripts/threejs-to-glb.mjs's rail — same THREE injection, same addon bag, same
 * FileReader shim, same GLTFExporter — lifted into a function so the library builder can call
 * it seventy times in one process instead of spawning node seventy times, and so it can pass
 * an authored animation clip through the exporter's `animations` option.
 *
 * Nothing here changes what a factory produces. With `colourway.transform` set to the identity
 * the bytes are the bytes the marketplace listing already ships; scripts/template-library/
 * verify-factories.mjs is the standing proof of that.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries, mergeVertices, toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { withShiftedPalettes } from "./palette.mjs";

// GLTFExporter reads its own assembled Blob back through FileReader even in the texture-free
// path; Node has Blob but not FileReader. Same shim as scripts/threejs-to-glb.mjs.
if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class NodeFileReader {
    readAsArrayBuffer(blob) {
      void blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        this.onloadend?.();
      });
    }
    readAsDataURL(blob) {
      void blob.arrayBuffer().then((buffer) => {
        this.result = `data:application/octet-stream;base64,${Buffer.from(buffer).toString("base64")}`;
        this.onloadend?.();
      });
    }
  };
}

const ADDONS = { mergeGeometries, mergeVertices, toCreasedNormals };

const moduleCache = new Map();

async function loadModule(repoRoot, relativePath) {
  const key = resolve(repoRoot, relativePath);
  if (!moduleCache.has(key)) moduleCache.set(key, await import(pathToFileURL(key).href));
  moduleCache.set(key, await moduleCache.get(key));
  return moduleCache.get(key);
}

/** Resolves one `paletteTargets` entry to the live object the factory reads. */
export async function resolvePaletteTarget(repoRoot, spec) {
  const module = await loadModule(repoRoot, spec.module);
  let target = module[spec.export];
  if (!target) throw new Error(`${spec.module} does not export ${spec.export}`);
  for (const step of spec.path ?? []) {
    target = target[step];
    if (!target) throw new Error(`${spec.module}#${spec.export} has no entry ${spec.path.join(".")}`);
  }
  return target;
}

async function loadFactory(repoRoot, relativePath) {
  const module = await loadModule(repoRoot, relativePath);
  const create = typeof module.default === "function"
    ? module.default
    : Object.values(module).find((value) => typeof value === "function");
  if (!create) throw new Error(`No factory function exported by ${relativePath}`);
  return create;
}

/** Axis-angle to a quaternion, in the flat [x, y, z, w] layout a keyframe track wants. */
function quaternionFor(axis, degrees) {
  const vector = new THREE.Vector3(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0);
  const quaternion = new THREE.Quaternion().setFromAxisAngle(vector, (degrees * Math.PI) / 180);
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}

/**
 * A real glTF animation on the socket the factory published.
 *
 * The rotation is applied on top of whatever the pivot already holds, which for these three
 * sockets is identity by contract, so key 0 is the model's shipped rest pose.
 */
function buildClip(root, clip) {
  const node = root.getObjectByName(clip.node);
  if (!node) throw new Error(`Clip node ${clip.node} is not in the exported model.`);
  const times = clip.keys.map((key) => key.time);
  const values = clip.keys.flatMap((key) => quaternionFor(clip.axis, key.degrees));
  const track = new THREE.QuaternionKeyframeTrack(`${clip.node}.quaternion`, times, values);
  return new THREE.AnimationClip(clip.name, times[times.length - 1], [track]);
}

/** Triangles, materials, bounds and node count, measured off the scene that was exported. */
export function measureScene(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  let triangles = 0;
  let nodes = 0;
  const materials = new Set();
  root.traverse((object) => {
    nodes += 1;
    if (!object.isMesh) return;
    const geometry = object.geometry;
    const count = geometry.index ? geometry.index.count : geometry.attributes.position.count;
    triangles += Math.floor(count / 3);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material) materials.add(material.uuid);
    }
  });
  const round = (value) => Math.round(value * 1000) / 1000;
  return {
    triangles,
    materials: materials.size,
    nodes,
    boundsMetres: { x: round(size.x), y: round(size.y), z: round(size.z) },
  };
}

/**
 * Bakes `template` under `colourway`. Returns the GLB bytes plus the measurements taken from
 * the very scene those bytes were written from.
 */
export async function bakeTemplate(repoRoot, template, colourway) {
  const create = await loadFactory(repoRoot, template.factory);
  const targets = await Promise.all((template.paletteTargets ?? []).map((spec) => resolvePaletteTarget(repoRoot, spec)));
  const root = withShiftedPalettes(targets, colourway.transform, () => create(THREE, ADDONS));
  if (!root || !root.isObject3D) throw new Error(`${template.id} factory did not return an Object3D.`);

  const scene = new THREE.Scene();
  scene.add(root);
  const facts = measureScene(root);

  const options = { binary: true };
  let clips = [];
  if (template.clip) {
    clips = [buildClip(root, template.clip)];
    options.animations = clips;
  }
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(scene, options);
  if (!(result instanceof ArrayBuffer)) throw new Error("Expected a binary GLB ArrayBuffer.");
  return {
    bytes: new Uint8Array(result),
    facts: { ...facts, byteLength: result.byteLength },
    clips: clips.map((clip) => clip.name),
  };
}

/** The colours a colourway actually produced for one template, for the library's swatch strip. */
export async function paletteSwatches(repoRoot, template, colourway, limit = 6) {
  const { collectColours, shiftPaletteValue } = await import("./palette.mjs");
  const colours = [];
  for (const spec of template.paletteTargets ?? []) {
    const target = await resolvePaletteTarget(repoRoot, spec);
    const shifted = shiftPaletteValue(target, colourway.transform);
    collectColours(shifted, undefined, colours);
  }
  const unique = [];
  for (const colour of colours) {
    if (!unique.includes(colour)) unique.push(colour);
    if (unique.length >= limit) break;
  }
  return unique;
}
