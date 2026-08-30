/**
 * Harvest Frontier tree set entry point — "broadleaf-round-forked".
 * One `(THREE) => Object3D` export, as scripts/threejs-to-glb.mjs requires.
 * All geometry, palette and budget decisions live in ./tree-kit.mjs.
 */
import { createTemplate } from "./tree-kit.mjs";

export default createTemplate("broadleaf-round-forked");
