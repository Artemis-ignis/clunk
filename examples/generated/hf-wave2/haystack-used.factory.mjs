/**
 * HF Wave 2 entry point — "haystack-used": the same round bale, half fed out, with a terraced
 * bite scooped out of the barrel and the straw that came out of it on the ground.
 * One `(THREE) => Object3D` default export, as scripts/threejs-to-glb.mjs requires.
 */
import { buildHaystack } from "./haystack.build.mjs";

export default function createHaystackUsed(THREE) {
  return buildHaystack(THREE, "used");
}
