/**
 * Mine Entrance Kit entry point — stop block: half module with a timber buffer beam.
 * One `(THREE) => Object3D` default export, as scripts/threejs-to-glb.mjs requires.
 * All geometry, palette and budget decisions live in ./rail.build.mjs.
 */
import { buildRail } from "./rail.build.mjs";

export default function createMineRailStop(THREE) {
  return buildRail(THREE, "stop");
}
