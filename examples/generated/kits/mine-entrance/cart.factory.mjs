/**
 * Mine Entrance Kit entry point — empty mine tub with a rolling-wheel clip.
 * One `(THREE) => Object3D` default export, as scripts/threejs-to-glb.mjs requires.
 * All geometry, palette and budget decisions live in ./cart.build.mjs.
 */
import { buildCart } from "./cart.build.mjs";

export default function createMineCart(THREE) {
  return buildCart(THREE, "empty");
}
