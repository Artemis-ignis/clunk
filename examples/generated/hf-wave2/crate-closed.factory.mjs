/**
 * HF Wave 2 entry point — "crate-closed": lidded crate, boarded lid with cleats.
 * One `(THREE) => Object3D` default export, as scripts/threejs-to-glb.mjs requires.
 * All geometry, palette and budget decisions live in ./crate.build.mjs.
 */
import { buildCrate } from "./crate.build.mjs";

export default function createCrateClosed(THREE) {
  return buildCrate(THREE, "closed");
}
