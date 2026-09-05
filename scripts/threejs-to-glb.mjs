#!/usr/bin/env node
/**
 * Procedural three.js factory → GLB rail for the generation pipeline
 * (docs/generate-pipeline.ko.md).
 *
 * A factory module exports one function `(THREE) => THREE.Object3D` (default export or the
 * first exported function). This script instantiates it headlessly and writes a binary GLB
 * that the normal Clunk gate (inspect → optimize → passport) can consume.
 *
 * Clips travel with the model. A factory that owns a moving part puts its AnimationClips on
 * `root.animations` (three.js's own slot for them) and they are written into the GLB. Until
 * 2026-09-05 the only way a factory-made file got a clip was a second tool rewriting the
 * exported bytes (scripts/add-pivot-clip.mjs on the fence gate), which left the committed GLB
 * unreproducible from its factory. Factories without clips export exactly as before — the
 * option is only passed when there is something to write, so their bytes do not move.
 *
 * Texture-free procedural models only: GLTFExporter needs browser APIs the moment images are
 * involved, and the generation pipeline deliberately stays code-only geometry/materials.
 *
 *   npm run tsx -- scripts/threejs-to-glb.mjs <factory.mjs> <out.glb>
 */
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries, mergeVertices, toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// GLTFExporter reads its own assembled Blob back through FileReader even in the texture-free
// path; Node has Blob but not FileReader, so this shim covers exactly the two read modes the
// exporter uses.
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

const [modulePath, outPath] = process.argv.slice(2);
if (!modulePath || !outPath) {
  process.stderr.write("Usage: threejs-to-glb.mjs <factory-module.mjs> <output.glb>\n");
  process.exit(1);
}

const factoryModule = await import(pathToFileURL(resolve(modulePath)).href);
const create =
  typeof factoryModule.default === "function"
    ? factoryModule.default
    : Object.values(factoryModule).find((value) => typeof value === "function");
if (!create) throw new Error(`No factory function exported by ${modulePath}`);

// A factory written in the user's own project cannot resolve "three" — their
// node_modules is not ours. THREE was already injected for exactly that reason;
// the addons every real factory reaches for have to travel with it, or the
// author is pushed back into a bare import that only resolves inside this repo.
const root = create(THREE, {
  mergeGeometries,
  mergeVertices,
  toCreasedNormals,
});
if (!root || !root.isObject3D) throw new Error("Factory must return a THREE.Object3D.");

const scene = new THREE.Scene();
scene.add(root);

const exporter = new GLTFExporter();
const animations = Array.isArray(root.animations) ? root.animations.filter((clip) => clip && Array.isArray(clip.tracks)) : [];
const result = await exporter.parseAsync(scene, animations.length ? { binary: true, animations } : { binary: true });
if (!(result instanceof ArrayBuffer)) throw new Error("Expected a binary GLB ArrayBuffer.");

await writeFile(resolve(outPath), Buffer.from(result), { flag: "wx" });
process.stdout.write(`[threejs-to-glb] ${outPath} (${result.byteLength.toLocaleString()} bytes)\n`);
