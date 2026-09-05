/**
 * Mine Entrance Kit — the tool rack, with a pick and a shovel leaning on it.
 *
 * Reference reality: a miner's pick was 900-1000 mm on the haft with a 350-400 mm double-pointed
 * head; a round-mouth shovel about 1.15 m overall with a 250 x 290 mm blade. Both are below at
 * those sizes, and both LEAN — a tool standing dead vertical in a rack is the single fastest way
 * to make a prop look placed by a script.
 *
 * WHAT THE FIRST PASS GOT WRONG, AND HOW THIS ONE ANSWERS IT
 *   - the shovel blade was placed by arithmetic and came out through the underside of the base
 *     timber, sticking out at the front. Each tool is now built in its own local frame with its
 *     foot at the origin, leaned by rotating about that origin, and then SEATED by measuring its
 *     own lowest vertex. Nothing is placed by a number anyone typed.
 *   - the pick's points ran fore-and-aft, so from the storefront's three-quarter view the head
 *     read as a single black wedge aimed at the camera. They now run across the haft in the
 *     leaning plane, which is the orientation a pick is recognisable in.
 *   - the rail stood at 1.14 m, above the head of a 0.96 m pick, so neither tool could reach
 *     the thing it was supposed to be leaning on. The rack is now 0.98 m to the rail and both
 *     tools measurably touch it.
 *
 * The tools are their own mesh: delete `tools` and the rack is still a rack.
 */
import {
  at,
  beam,
  board,
  ground,
  ironPainter,
  kitUserData,
  lathe,
  lowestY,
  meshOf,
  mineMaterial,
  painted,
  prism,
  timberPainter,
  translateAll,
} from "./mine-kit.mjs";

const BASE_X = 0.9;
const UPRIGHT_X = 0.33;
const UPRIGHT_H = 0.98;
const RAIL_Y = 0.92;
const FRAME_Z = -0.06;

const basePainter = timberPainter({ role: "timberDark", grainAxis: "x", grainStep: 0.16, boardAxis: "z", boardStep: 0.3, seed: 241 });
const rackPainter = timberPainter({ role: "timberBody", grainAxis: "y", grainStep: 0.12, boardAxis: "x", boardStep: 0.66, seed: 251, wear: 0.3 });
const haftPainter = timberPainter({ role: "timberLight", grainAxis: "y", grainStep: 0.1, seed: 257, wear: 0.9 });
const steelPainter = ironPainter({ seed: 263, polish: 0.55, rust: 0.14 });
const pegPainter = ironPainter({ seed: 269, polish: 0.15, rust: 0.5 });

/**
 * Lean a tool built about its own foot, then seat it on the ground by measurement.
 *
 * `tilt` tips it within the leaning plane and `back` tips it toward the rack. Both rotations
 * are taken about the tool's own origin, which is its foot, so the foot stays put and only the
 * far end travels — and the residual dip (a blade corner swinging below zero, for instance) is
 * then taken out by reading the lowest vertex rather than by guessing a clearance.
 */
function planted(THREE, parts, footX, footZ, tilt, back) {
  const placed = parts.map((geometry) => at(THREE, geometry, [footX, 0, footZ], [back, 0, tilt]));
  translateAll(THREE, placed, -lowestY(placed));
  return placed;
}

export default function createMineToolRack(THREE) {
  const rackParts = [];
  const ironParts = [];
  const toolParts = [];

  // ---- rack ------------------------------------------------------------------------------------
  rackParts.push(painted(THREE, board(THREE, [BASE_X, 0.1, 0.3], [0, 0.05, 0], [0, 0, 0], 5, "y"), basePainter));
  for (const sx of [-1, 1]) {
    rackParts.push(painted(THREE, beam(THREE, [0.08, UPRIGHT_H, 0.08], [sx * UPRIGHT_X, 0.1 + UPRIGHT_H / 2, FRAME_Z], [0, 0, 0], 0.01), rackPainter));
  }
  // Rail across the uprights, and a lower stretcher so the frame is braced rather than hinged.
  rackParts.push(painted(THREE, beam(THREE, [0.07, 0.74, 0.07], [0, RAIL_Y, FRAME_Z], [0, 0, Math.PI / 2], 0.01), rackPainter));
  rackParts.push(painted(THREE, beam(THREE, [0.055, 0.74, 0.055], [0, 0.44, FRAME_Z], [0, 0, Math.PI / 2], 0.008), rackPainter));
  // Two iron pegs standing forward out of the rail — what a tool actually hangs on.
  for (const sx of [-1, 1]) {
    ironParts.push(painted(THREE, lathe(THREE, [[0.016, 0], [0.014, 0.09], [0.024, 0.11]], 6, [sx * 0.2, RAIL_Y, FRAME_Z + 0.03], [Math.PI / 2, 0, 0]), pegPainter));
  }
  // A small strap over each upright/rail joint. 70 x 130 mm, not the 90 x 180 mm slab the first
  // pass used — at that size two of them were the darkest thing in the render and the frame
  // read as bolted rather than pegged.
  for (const sx of [-1, 1]) {
    ironParts.push(painted(THREE, board(THREE, [0.07, 0.13, 0.014], [sx * UPRIGHT_X, RAIL_Y - 0.01, FRAME_Z + 0.047]), pegPainter));
  }

  // ---- pick, built about its foot ------------------------------------------------------------------
  {
    const local = [];
    const HAFT = 0.96;
    local.push(painted(THREE, beam(THREE, [0.045, HAFT, 0.045], [0, HAFT / 2, 0], [0, 0, 0], 0.008), haftPainter));
    // Eye, then two tapered square points running across the haft. A pick head that is one box
    // is a hammer; a head whose points run fore-and-aft is invisible from three-quarters.
    local.push(painted(THREE, beam(THREE, [0.052, 0.1, 0.052], [0, HAFT - 0.05, 0], [0, 0, 0], 0.007), steelPainter));
    for (const sx of [-1, 1]) {
      local.push(
        painted(THREE, lathe(THREE, [[0.026, 0], [0.007, 0.185]], 4, [sx * 0.03, HAFT - 0.05, 0], [0, 0, sx * -Math.PI / 2]), steelPainter),
      );
    }
    // A wedge driven into the haft above the eye, which is what stops a pick head coming off.
    local.push(painted(THREE, board(THREE, [0.03, 0.03, 0.05], [0, HAFT + 0.005, 0]), steelPainter));
    for (const geometry of planted(THREE, local, -0.33, 0.17, -0.22, -0.19)) toolParts.push(geometry);
  }

  // ---- shovel, built about its blade tip ------------------------------------------------------------
  {
    const local = [];
    // Blade: a 20 mm solid plate. Not a card — a shovel seen edge-on is the classic place a
    // zero-thickness blade disappears. The outline is authored in (x, z) and stood up by a
    // quarter turn about X, so the plate's thickness ends up across the blade.
    local.push(
      painted(
        THREE,
        at(
          THREE,
          prism(
            THREE,
            [[-0.125, -0.1], [-0.09, -0.26], [0, -0.29], [0.09, -0.26], [0.125, -0.1], [0.115, 0], [-0.115, 0]],
            0.02,
          ),
          [0, 0, 0],
          [Math.PI / 2, 0, 0],
        ),
        steelPainter,
      ),
    );
    local.push(painted(THREE, lathe(THREE, [[0.034, 0.26], [0.026, 0.35], [0.022, 0.42]], 6, [0, 0, 0]), steelPainter));
    local.push(painted(THREE, beam(THREE, [0.04, 0.68, 0.04], [0, 0.74, 0], [0, 0, 0], 0.007), haftPainter));
    // D-grip: two straps and a cross piece, so the grip is a loop you can see through.
    for (const sz of [-1, 1]) {
      local.push(painted(THREE, board(THREE, [0.014, 0.1, 0.012], [0, 1.11, sz * 0.035]), haftPainter));
    }
    local.push(painted(THREE, board(THREE, [0.016, 0.014, 0.086], [0, 1.16, 0]), haftPainter));
    for (const geometry of planted(THREE, local, 0.32, 0.17, 0.22, -0.19)) toolParts.push(geometry);
  }

  ground(THREE, [...rackParts, ...ironParts, ...toolParts]);

  const material = mineMaterial(THREE, 0.88);
  const root = new THREE.Group();
  root.name = "mine_tool_rack";
  root.add(meshOf(THREE, "rack", material, rackParts));
  root.add(meshOf(THREE, "rack_ironwork", material, ironParts));
  root.add(meshOf(THREE, "tools", material, toolParts));

  return kitUserData(THREE, root, {
    assetId: "mine-entrance.tool-rack.m1",
    variant: "tool rack with a pick and a shovel",
    surfaceLanguage: [
      "pick head is an eye plus two tapered points running across the haft, with a driven wedge",
      "shovel blade is a 20 mm solid plate on a socket, so it survives being seen edge-on",
      "both tools are seated by measuring their own lowest vertex — neither floats and neither cuts the base timber",
      "both tools lean on the rail rather than standing free beside it",
      "iron pegs turned out of the rail, small straps over both frame joints",
    ],
    parts: root.children.map((child) => child.name),
  });
}
