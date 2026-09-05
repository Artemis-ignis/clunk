/**
 * Village Square 14 — Low Stone Wall (straight run).
 * A 1.000 m module, 0.300 m thick, 0.550 m to the top of the coping, joining at x = +-0.500.
 * Two leaves with staggered joints; see ./wall.build.mjs.
 */
import { buildWall } from "./wall.build.mjs";

export default function createVillageWallStraight(THREE) {
  return buildWall(THREE, "straight");
}
