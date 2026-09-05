/**
 * Village Square 12 — Cobbled Path Tile (corner).
 * Turns a run through 90 degrees between the -Z edge and the +X edge; same 1 m module and
 * same 60 mm height as the straight and the crossing. See ./path.build.mjs.
 */
import { buildPathTile } from "./path.build.mjs";

export default function createVillagePathCorner(THREE) {
  return buildPathTile(THREE, "corner");
}
