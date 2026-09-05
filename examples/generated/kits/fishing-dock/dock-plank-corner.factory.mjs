/**
 * Fishing Dock — corner deck module, turning from the -X edge to the +Z edge on a 45-degree
 * mitre. One `(THREE) => Object3D` default export.
 */
import { buildDeckModule } from "./deck.build.mjs";

export default function createDockPlankCorner(THREE) {
  return buildDeckModule(THREE, "corner");
}
