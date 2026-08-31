/**
 * Delivery-contract check for the Cozy Farm Set.
 *
 * Clunk's profile rules cannot express "this named node must exist" — the Harvest Frontier
 * example profile says so itself under `_limitations`. So a GLB can score 100/100 and still have
 * lost the socket contract that makes it animatable. This reads the shipped file back and
 * reports the named pivots and the glTF `extras` that carry the contract.
 *
 * It matters most across `clunk optimize`, whose clean-metadata pass is documented to remove
 * extras: run this on the source and on the optimized output and compare.
 *
 * Usage: node socket-check.mjs <asset.glb> [more.glb ...]
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const files = process.argv.slice(2);
if (!files.length) {
  process.stderr.write("Usage: socket-check.mjs <asset.glb> [more.glb ...]\n");
  process.exit(1);
}

const results = [];
for (const file of files) {
  const bytes = await readFile(resolve(file));
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new Promise((ok, fail) => new GLTFLoader().parse(arrayBuffer, "", ok, fail));

  const nodeNames = [];
  const nodesCarryingExtras = [];
  gltf.scene.traverse((node) => {
    nodeNames.push(node.name);
    const keys = Object.keys(node.userData ?? {});
    if (keys.length) nodesCarryingExtras.push({ node: node.name, keys });
  });

  const root = gltf.scene.children[0];
  results.push({
    file,
    bytes: bytes.byteLength,
    nodeCount: nodeNames.length,
    declaredSockets: root?.userData?.sockets ?? null,
    socketNodesPresent: nodeNames.filter((name) => /_pivot$|^crate_slot_/.test(name)),
    nodesCarryingExtras: nodesCarryingExtras.length,
    extrasSample: nodesCarryingExtras.slice(0, 3),
  });
}
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
