/**
 * Fishing Dock — fish crate with its lid on. One `(THREE) => Object3D` default export.
 * Geometry and palette live in ./crate.build.mjs.
 */
import { buildFishCrate } from "./crate.build.mjs";

export default function createDockFishCrateClosed(THREE) {
  return buildFishCrate(THREE, "closed");
}
