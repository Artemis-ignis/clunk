/**
 * Village Square 13 — Cobbled Path Tile (crossing).
 * Concentric rings closing on a keystone, which is what a mason lays where four runs meet.
 * Same 1 m module and same 60 mm height as the straight and the corner. See ./path.build.mjs.
 */
import { buildPathTile } from "./path.build.mjs";

export default function createVillagePathCrossing(THREE) {
  return buildPathTile(THREE, "crossing");
}
