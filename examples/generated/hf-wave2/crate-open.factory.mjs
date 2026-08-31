/**
 * HF Wave 2 entry point — "crate-open": the same carcass with no lid, empty, showing real
 * board thickness at the rim and a little packing straw left in the bottom.
 * One `(THREE) => Object3D` default export, as scripts/threejs-to-glb.mjs requires.
 */
import { buildCrate } from "./crate.build.mjs";

export default function createCrateOpen(THREE) {
  return buildCrate(THREE, "open");
}
