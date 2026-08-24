#!/usr/bin/env node
/**
 * Procedural three.js factory → GLB rail for the generation pipeline
 * (docs/generate-pipeline.ko.md).
 *
 * A factory module exports one function `(THREE) => THREE.Object3D` (default export or the
 * first exported function). This script instantiates it headlessly and writes a binary GLB
 * that the normal Clunk gate (inspect → optimize → passport) can consume.
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

const root = create(THREE);
if (!root || !root.isObject3D) throw new Error("Factory must return a THREE.Object3D.");

const scene = new THREE.Scene();
scene.add(root);

const exporter = new GLTFExporter();
const result = await exporter.parseAsync(scene, { binary: true });
if (!(result instanceof ArrayBuffer)) throw new Error("Expected a binary GLB ArrayBuffer.");

await writeFile(resolve(outPath), Buffer.from(result), { flag: "wx" });
process.stdout.write(`[threejs-to-glb] ${outPath} (${result.byteLength.toLocaleString()} bytes)\n`);
