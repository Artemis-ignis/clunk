/**
 * Fishing Dock — end deck module: the last plate of a jetty, closed on three sides with a
 * kerb timber across the far end. One `(THREE) => Object3D` default export.
 */
import { buildDeckModule } from "./deck.build.mjs";

export default function createDockPlankEnd(THREE) {
  return buildDeckModule(THREE, "end");
}
