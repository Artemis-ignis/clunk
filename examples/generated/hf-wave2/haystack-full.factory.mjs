/**
 * HF Wave 2 entry point — "haystack-full": an intact machine-rolled round bale.
 * One `(THREE) => Object3D` default export, as scripts/threejs-to-glb.mjs requires.
 * All geometry, palette and budget decisions live in ./haystack.build.mjs.
 */
import { buildHaystack } from "./haystack.build.mjs";

export default function createHaystackFull(THREE) {
  return buildHaystack(THREE, "full");
}
