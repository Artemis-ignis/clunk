/**
 * Mine Entrance Kit entry point — iron ore chunk.
 * One `(THREE) => Object3D` default export, as scripts/threejs-to-glb.mjs requires.
 * All geometry, palette and budget decisions live in ./ore.build.mjs.
 */
import { buildOre } from "./ore.build.mjs";

export default function createMineOreIron(THREE) {
  return buildOre(THREE, "iron");
}
