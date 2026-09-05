/**
 * Village Square 15 — Low Stone Wall (corner).
 * Two arms meeting in a full-thickness quoin; joins a straight at x = +0.500 and at
 * z = -0.500. Its origin is the QUOIN, not the bounding-box centre, because the quoin is
 * what a run is snapped to. See ./wall.build.mjs.
 */
import { buildWall } from "./wall.build.mjs";

export default function createVillageWallCorner(THREE) {
  return buildWall(THREE, "corner");
}
