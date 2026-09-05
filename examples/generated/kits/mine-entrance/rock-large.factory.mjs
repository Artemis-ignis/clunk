/**
 * Mine Entrance Kit entry point — 1.2 m boulder.
 * One `(THREE) => Object3D` default export, as scripts/threejs-to-glb.mjs requires.
 * All geometry, palette and budget decisions live in ./rock.build.mjs.
 */
import { buildRock } from "./rock.build.mjs";

export default function createMineRockLarge(THREE) {
  return buildRock(THREE, "large");
}
