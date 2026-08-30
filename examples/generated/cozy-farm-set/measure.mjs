/**
 * Measures a Cozy Farm Set factory in real metres.
 *
 * Clunk's inspect report prints RAW accessor bounds (the union of every primitive's local
 * min/max, node transforms ignored), so it cannot answer "how tall is this thing". This
 * script instantiates the factory and walks the actual world matrices instead.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as THREE from "three";

const [modulePath] = process.argv.slice(2);
if (!modulePath) {
  process.stderr.write("Usage: measure.mjs <factory.mjs>\n");
  process.exit(1);
}

const mod = await import(pathToFileURL(resolve(modulePath)).href);
const create = typeof mod.default === "function" ? mod.default : Object.values(mod).find((v) => typeof v === "function");
const root = create(THREE);
root.updateMatrixWorld(true);

const worldBox = new THREE.Box3().setFromObject(root);
const size = worldBox.getSize(new THREE.Vector3());
const f = (n) => Number(n.toFixed(4));

let triangles = 0;
let meshes = 0;
const materials = new Set();
const parts = [];
root.traverse((node) => {
  if (!node.isMesh) return;
  meshes += 1;
  materials.add(node.material.name);
  const geometry = node.geometry;
  const tris = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
  triangles += tris;
  const box = new THREE.Box3().setFromObject(node);
  parts.push({ name: node.name, material: node.material.name, tris, minY: f(box.min.y), maxY: f(box.max.y), maxZ: f(box.max.z) });
});

// A floating part is a mesh whose world bounding box never comes near anything below it.
// Reported so the "no floating parts" self-check is measured, not asserted.
const sorted = [...parts].sort((a, b) => a.minY - b.minY);

process.stdout.write(
  `${JSON.stringify(
    {
      factory: modulePath,
      worldBounds: {
        min: [f(worldBox.min.x), f(worldBox.min.y), f(worldBox.min.z)],
        max: [f(worldBox.max.x), f(worldBox.max.y), f(worldBox.max.z)],
        sizeMeters: { width: f(size.x), height: f(size.y), depth: f(size.z) },
      },
      groundedAtY: f(worldBox.min.y),
      triangles,
      meshes,
      materials: materials.size,
      declaredUserData: root.userData,
      partsByLowestPoint: sorted,
    },
    null,
    2,
  )}\n`,
);
