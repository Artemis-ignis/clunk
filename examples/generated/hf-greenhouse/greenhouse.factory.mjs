/**
 * HF Order #5 entry point — "greenhouse glass-finish kit", the HF-signed measured instance.
 * One `(THREE) => Object3D` default export, as scripts/threejs-to-glb.mjs requires.
 * All geometry, palette and the panel-omission contract live in ./greenhouse-kit.mjs.
 */
import { greenhouseGlassKit } from "./greenhouse-kit.mjs";

export default function createGreenhouse(THREE) {
  return greenhouseGlassKit(THREE, {
    frameWidth: 8.4,
    frameHeight: 3.4,
    frameDepth: 6.5,
    ridgeRise: 0.75,
    mullionRows: 2,
    mullionCols: 5,
    mullionThickness: 0.055,
    omitPanels: ["door-bay", "side-low-south"],
  });
}
