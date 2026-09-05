/**
 * Mine Entrance Kit entry point — mine tub loaded with ore, rolling-wheel clip.
 * One `(THREE) => Object3D` default export, as scripts/threejs-to-glb.mjs requires.
 * All geometry, palette and budget decisions live in ./cart.build.mjs.
 */
import { buildCart } from "./cart.build.mjs";

export default function createMineCartOre(THREE) {
  return buildCart(THREE, "ore");
}
