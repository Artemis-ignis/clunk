/**
 * Fishing Dock — white spar buoy: a slim float on a mast with a cross topmark.
 * A different shape from the red can buoy, not a recolour of it.
 */
import { buildBuoy } from "./buoy.build.mjs";

export default function createDockBuoyWhite(THREE) {
  return buildBuoy(THREE, "white");
}
