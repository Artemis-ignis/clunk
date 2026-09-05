/**
 * Mine Entrance Kit entry point — straight 1.2 m track module with three sleepers.
 * One `(THREE) => Object3D` default export, as scripts/threejs-to-glb.mjs requires.
 * All geometry, palette and budget decisions live in ./rail.build.mjs.
 */
import { buildRail } from "./rail.build.mjs";

export default function createMineRailStraight(THREE) {
  return buildRail(THREE, "straight");
}
