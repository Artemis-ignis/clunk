/**
 * HF Wave 2 entry point — "crate-produce": the open crate filled, with a heaped top layer of
 * apples over a fill plate.
 * One `(THREE) => Object3D` default export, as scripts/threejs-to-glb.mjs requires.
 */
import { buildCrate } from "./crate.build.mjs";

export default function createCrateProduce(THREE) {
  return buildCrate(THREE, "produce");
}
