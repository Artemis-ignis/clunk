/**
 * Fishing Dock — straight deck module.
 * One `(THREE) => Object3D` default export, as scripts/threejs-to-glb.mjs requires.
 * All geometry, palette and interlock decisions live in ./deck.build.mjs and ./dock-kit.mjs.
 */
import { buildDeckModule } from "./deck.build.mjs";

export default function createDockPlankStraight(THREE) {
  return buildDeckModule(THREE, "straight");
}
