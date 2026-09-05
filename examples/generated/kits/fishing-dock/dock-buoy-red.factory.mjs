/**
 * Fishing Dock — red can buoy: a squat float with a lifting eye and a chain shackle.
 * One `(THREE) => Object3D` default export. Geometry lives in ./buoy.build.mjs.
 */
import { buildBuoy } from "./buoy.build.mjs";

export default function createDockBuoyRed(THREE) {
  return buildBuoy(THREE, "red");
}
