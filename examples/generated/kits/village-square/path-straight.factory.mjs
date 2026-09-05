/**
 * Village Square 11 — Cobbled Path Tile (straight run).
 * One `(THREE) => Object3D` default export, as scripts/threejs-to-glb.mjs requires.
 * Every dimension, the interlock contract and the laying pattern live in ./path.build.mjs.
 */
import { buildPathTile } from "./path.build.mjs";

export default function createVillagePathStraight(THREE) {
  return buildPathTile(THREE, "straight");
}
