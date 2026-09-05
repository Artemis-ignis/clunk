/**
 * Fishing Dock — fish crate open, with the catch and crushed ice in it.
 * Same outside dimensions as the closed crate, so the two swap in place.
 */
import { buildFishCrate } from "./crate.build.mjs";

export default function createDockFishCrateOpen(THREE) {
  return buildFishCrate(THREE, "open");
}
