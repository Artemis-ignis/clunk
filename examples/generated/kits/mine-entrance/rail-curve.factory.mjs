/**
 * Mine Entrance Kit entry point — 90 degree curve, 0.6 m centreline radius.
 * One `(THREE) => Object3D` default export, as scripts/threejs-to-glb.mjs requires.
 * All geometry, palette and budget decisions live in ./rail.build.mjs.
 */
import { buildRail } from "./rail.build.mjs";

export default function createMineRailCurve(THREE) {
  return buildRail(THREE, "curve");
}
