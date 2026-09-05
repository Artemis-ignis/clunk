/**
 * Mine Entrance Kit — the tub (empty and loaded), with a rolling-wheel clip.
 *
 * Reference reality: a hand-pushed colliery tub on 2 ft gauge was about 0.9 m long, 0.6-0.7 m
 * wide and 0.6-0.8 m over the rim, with 250-300 mm chilled-iron wheels. Those are the numbers
 * below, and the wheels are sized so the tub actually belongs on this kit's track:
 *
 *   tread radius   0.130 m, tread width 0.050 m, tread centres 0.600 m apart = SPEC.gauge
 *   flange radius  0.152 m, hanging 22 mm below the tread on the INSIDE of the rail
 *
 * That 22 mm is the whole point. Standing on a floor the tub rests on its flanges, so its
 * lowest point is y = 0 and it grounds like every other part in the kit. Lift it by
 * SPEC.cartLiftOntoRail (0.088 m) and the tread lands on the railhead at exactly y = 0.110
 * with the flange dropping 22 mm down the inside face of the rail — a wheel gripping a rail,
 * not a wheel parked near one. ./build.mjs measures both states and fails on either.
 *
 * The tub is carpentry, not a box: four corner posts, three courses of boards a side with real
 * air gaps, a boarded floor and two iron bands. Same discipline as the cozy crate, and for the
 * same reason — the gaps are the shadow lines the eye reads the object by.
 *
 * ANIMATION
 * The two axle assemblies are the only nodes in the kit that are not baked flat, because a
 * wheel has to turn about something. Each is a node at the axle centre carrying its axle bar
 * and both wheels; the clip `wheels_roll` drives their quaternion through a full revolution in
 * four 90-degree steps. Rotation channels only — no scale track anywhere in the kit.
 */
import {
  SPEC,
  at,
  beam,
  board,
  crystal,
  flatPainter,
  ironPainter,
  kitUserData,
  lathe,
  lump,
  meshOf,
  mineMaterial,
  orePainter,
  painted,
  timberPainter,
  tube,
} from "./mine-kit.mjs";

// --- authored dimensions (metres) ---------------------------------------------------------
const AXLE_Y = SPEC.wheelFlangeRadius; // 0.152 — flange bottom lands on y = 0
const TREAD_Z = SPEC.gauge / 2; // 0.300
const AXLE_X = 0.29; // axle centres, 0.580 m wheelbase
const TUB_X = 0.86;
const TUB_Z = 0.62;
const FLOOR_Y = 0.3;
const TUB_H = 0.42;
const RIM_Y = FLOOR_Y + TUB_H; // 0.720
const POST = 0.06;
const BOARD_T = 0.02;
const COURSE_Y = [FLOOR_Y + 0.075, FLOOR_Y + 0.21, FLOOR_Y + 0.345];
const COURSE_H = 0.11;

const postPainter = timberPainter({ role: "timberDark", grainAxis: "y", grainStep: 0.07, boardAxis: "x", boardStep: 0.4, seed: 61 });
const wallPainter = timberPainter({ role: "timberBody", grainAxis: "x", grainStep: 0.15, boardAxis: "y", boardStep: 0.135, seed: 67, wear: 0.4 });
const sideWallPainter = timberPainter({ role: "timberBody", grainAxis: "z", grainStep: 0.14, boardAxis: "y", boardStep: 0.135, seed: 71, wear: 0.4 });
const floorPainter = timberPainter({ role: "timberDark", grainAxis: "x", grainStep: 0.18, boardAxis: "z", boardStep: 0.19, seed: 73 });
const framePainter = timberPainter({ role: "timberLight", grainAxis: "x", grainStep: 0.16, boardAxis: "z", boardStep: 0.48, seed: 79 });
const bandPainter = ironPainter({ seed: 83, polish: 0.2, rust: 0.35 });
const wheelPainter = ironPainter({ seed: 89, polish: 0.35, rust: 0.25 });

/** One wheel: a tread disc plus a flange disc, axis along Z, authored about the axle centre. */
function wheel(THREE, z, side) {
  const half = SPEC.wheelWidth / 2;
  const parts = [];
  // Tread. TWELVE segments, and the number is load-bearing rather than aesthetic: a lathe's
  // lowest vertex sits at r*cos(pi/n), so a 10-segment wheel bottoms out at 0.951 r and the
  // whole tub would stand 7.4 mm off the floor with nothing in the file admitting it. At 12 the
  // ring has a vertex at exactly -90 degrees, so the flange bottom is exactly -r, the cart's
  // lowest point is exactly y = 0, and SPEC.flangeDrop is exactly 22 mm.
  parts.push(
    lathe(THREE, [[SPEC.wheelTreadRadius, -half], [SPEC.wheelTreadRadius, half]], 12, [0, 0, z], [Math.PI / 2, 0, 0]),
  );
  // Flange, on the inboard face. `side` is the sign of z, so the flange always faces the
  // centreline and always ends up between the rails.
  const flangeCentre = z - side * (half + SPEC.flangeThickness / 2);
  parts.push(
    lathe(
      THREE,
      [[SPEC.wheelFlangeRadius, -SPEC.flangeThickness / 2], [SPEC.wheelFlangeRadius, SPEC.flangeThickness / 2]],
      12,
      [0, 0, flangeCentre],
      [Math.PI / 2, 0, 0],
    ),
  );
  // Hub boss, so the wheel is not a coin. Sits outboard of the bearing block, not through it.
  parts.push(tube(THREE, 0.042, 0.07, 8, [0, 0, z - side * 0.03], [Math.PI / 2, 0, 0]));
  return parts;
}

export function buildCart(THREE, variant) {
  const loaded = variant === "ore";
  const bodyParts = [];
  const ironParts = [];
  const loadParts = [];

  // ---- chassis ---------------------------------------------------------------------------
  // Two solebars inboard of the wheels and two headstocks across the ends. `beam()` extrudes
  // along +Y, so a solebar is authored as a 0.94 m upright and then yawed onto X — that is why
  // the size triple reads [section, length, section] rather than [x, y, z].
  //
  // Solebar centres sit at z = +-0.210, half-width 0.035, so their outer face is at 0.245 and
  // the wheel flange's inner face is at 0.263: 18 mm of daylight. An earlier pass had them at
  // +-0.235 and the flange cut a 7 mm slot through the frame on every wheel — invisible in a
  // three-quarter hero and obvious the moment the cart is looked at from the front.
  for (const side of [-1, 1]) {
    bodyParts.push(painted(THREE, beam(THREE, [0.08, TUB_X + 0.08, 0.07], [0, 0.26, side * 0.21], [0, 0, Math.PI / 2], 0.012), framePainter));
  }
  // Headstocks 480 mm across, not 540. At 540 they reached z = +-0.270 and the wheel flange's
  // inner face is at 0.263, so the flange cut a corner off both headstocks on every wheel —
  // found by clunk_inspect's GEO-PART-INTERSECTION rule, not by looking at the render.
  for (const side of [-1, 1]) {
    bodyParts.push(painted(THREE, beam(THREE, [0.07, 0.48, 0.08], [side * 0.43, 0.26, 0], [Math.PI / 2, 0, 0], 0.012), framePainter));
  }
  // Bearing blocks: the iron the axle actually turns in. Without them the axle ends in air.
  // Kept inboard of the hub boss (0.1725-0.2275 against the hub's 0.235) so the journal sits
  // beside the wheel rather than inside it.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      ironParts.push(
        painted(THREE, beam(THREE, [0.07, 0.1, 0.055], [sx * AXLE_X, AXLE_Y + 0.028, sz * 0.2], [0, 0, 0], 0.008), bandPainter),
      );
    }
  }
  // Buffer blocks — what meets the stop block's beam. 43 mm of timber past the rail ends.
  for (const sx of [-1, 1]) {
    bodyParts.push(painted(THREE, board(THREE, [0.05, 0.12, 0.18], [sx * 0.485, 0.3, 0]), postPainter));
  }

  // ---- tub carcass -------------------------------------------------------------------------
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      // Posts start at the floor line, not 15 mm under it: the wheel tread tops out at y = 0.282
      // and a post dropped to 0.285 left 3 mm of air between two solids that are 30 mm apart in
      // z. 18 mm is a clearance; 3 mm is a coin toss.
      bodyParts.push(
        painted(THREE, beam(THREE, [POST, TUB_H + 0.03, POST], [sx * (TUB_X / 2 - POST / 2), FLOOR_Y + TUB_H / 2 + 0.015, sz * (TUB_Z / 2 - POST / 2)], [0, 0, 0], 0.008), postPainter),
      );
    }
  }
  // Floor: three boards tucked 10 mm into the walls, so no daylight runs down the joint.
  for (const z of [-0.19, 0, 0.19]) {
    bodyParts.push(painted(THREE, board(THREE, [TUB_X - 0.06, 0.024, 0.185], [0, FLOOR_Y + 0.012, z]), floorPainter));
  }
  // Walls: three courses a side, 25 mm of air between them, set 3 mm inside the corner posts.
  const faceZ = TUB_Z / 2 - BOARD_T / 2 - 0.003;
  const faceX = TUB_X / 2 - BOARD_T / 2 - 0.003;
  for (const y of COURSE_Y) {
    for (const sz of [-1, 1]) {
      bodyParts.push(painted(THREE, board(THREE, [TUB_X - 0.13, COURSE_H, BOARD_T], [0, y, sz * faceZ], [0, 0, 0], 4, "x"), wallPainter));
    }
    for (const sx of [-1, 1]) {
      bodyParts.push(painted(THREE, board(THREE, [BOARD_T, COURSE_H, TUB_Z - 0.13], [sx * faceX, y, 0], [0, 0, 0], 3, "z"), sideWallPainter));
    }
  }
  // Two iron bands round the tub. Four straps rather than a ring: a ring would need a hole in
  // the middle of it, and four straps is what a cooper actually nails on.
  for (const y of [FLOOR_Y + 0.14, FLOOR_Y + 0.31]) {
    for (const sz of [-1, 1]) {
      ironParts.push(painted(THREE, board(THREE, [TUB_X + 0.006, 0.035, 0.01], [0, y, sz * (TUB_Z / 2 + 0.001)]), bandPainter));
    }
    for (const sx of [-1, 1]) {
      ironParts.push(painted(THREE, board(THREE, [0.01, 0.035, TUB_Z + 0.006], [sx * (TUB_X / 2 + 0.001), y, 0]), bandPainter));
    }
  }
  // Rim cap, so the top edge of the tub is a lip and not a cut.
  for (const sz of [-1, 1]) {
    bodyParts.push(painted(THREE, board(THREE, [TUB_X, 0.026, 0.05], [0, RIM_Y - 0.013, sz * (TUB_Z / 2 - 0.025)]), framePainter));
  }
  for (const sx of [-1, 1]) {
    bodyParts.push(painted(THREE, board(THREE, [0.05, 0.026, TUB_Z - 0.1], [sx * (TUB_X / 2 - 0.025), RIM_Y - 0.013, 0]), framePainter));
  }

  // ---- load ---------------------------------------------------------------------------------
  if (loaded) {
    // A dark fill plate 60 mm under the rim, then the ore heaped over it. Without the plate the
    // camera looks straight through the heap onto the floor boards and a "loaded" tub reads
    // empty from above, which is the angle a top-down game camera actually uses.
    loadParts.push(painted(THREE, board(THREE, [TUB_X - 0.12, 0.02, TUB_Z - 0.12], [0, RIM_Y - 0.06, 0]), flatPainter("adit", 91, 0.16)));
    const heap = [
      ["oreCopper", -0.29, 0.79, -0.16, 0.115],
      ["oreIron", -0.06, 0.8, -0.17, 0.12],
      ["oreGold", 0.2, 0.785, -0.15, 0.105],
      ["oreIron", 0.31, 0.78, 0.06, 0.11],
      ["oreCopper", 0.03, 0.815, 0.02, 0.125],
      ["oreIron", -0.27, 0.79, 0.09, 0.115],
      ["oreCopper", -0.11, 0.78, 0.19, 0.11],
      ["oreGold", 0.19, 0.775, 0.19, 0.1],
      ["oreIron", -0.02, 0.885, 0.09, 0.095],
    ];
    heap.forEach(([role, x, y, z, r], index) => {
      loadParts.push(
        painted(
          THREE,
          at(THREE, lump(THREE, { radius: r, detail: 0, jitter: 0.3, scale: [1.1, 0.82, 1.05], seed: 400 + index }), [x, y, z], [0.2, index * 1.3, 0.15]),
          orePainter(role, 400 + index),
        ),
      );
    });
    for (const [role, x, y, z, s, i] of [
      ["oreGold", 0.19, 0.83, 0.2, 0.032, 0],
      ["oreCopper", -0.3, 0.84, -0.15, 0.03, 1],
      ["oreIron", 0.05, 0.94, 0.09, 0.028, 2],
    ]) {
      loadParts.push(painted(THREE, crystal(THREE, s, [x, y, z], [0.3, i * 1.7, 0.2], 500 + i), orePainter(role, 500 + i)));
    }
  }

  // ---- assemble -----------------------------------------------------------------------------
  const material = mineMaterial(THREE, 0.88);
  const root = new THREE.Group();
  root.name = loaded ? "mine_cart_ore" : "mine_cart";
  root.add(meshOf(THREE, "tub", material, bodyParts));
  root.add(meshOf(THREE, "ironwork", material, ironParts));
  if (loadParts.length) root.add(meshOf(THREE, "ore_load", material, loadParts));

  // Axles. These are the only nodes in the kit that carry a transform, because a wheel has to
  // turn about a point and baking that flat would make the clip impossible.
  const axleNodes = [];
  for (const [name, sx] of [["axle_front", 1], ["axle_rear", -1]]) {
    const parts = [];
    parts.push(painted(THREE, tube(THREE, 0.022, 0.62, 8, [0, 0, 0], [Math.PI / 2, 0, 0]), wheelPainter));
    for (const sz of [-1, 1]) {
      for (const geometry of wheel(THREE, sz * TREAD_Z, sz)) parts.push(painted(THREE, geometry, wheelPainter));
    }
    const mesh = meshOf(THREE, `${name}_wheels`, material, parts);
    const node = new THREE.Group();
    node.name = name;
    node.position.set(sx * AXLE_X, AXLE_Y, 0);
    node.add(mesh);
    root.add(node);
    axleNodes.push(node);
  }

  // One revolution in 2 seconds, in four 90-degree steps. Quaternion slerp takes the short way
  // round, so a 360-degree turn written as two keys would stand still; four steps is the
  // cheapest keying that actually rolls.
  const half = Math.SQRT1_2;
  const times = [0, 0.5, 1, 1.5, 2];
  const values = [
    0, 0, 0, 1,
    0, 0, -half, half,
    0, 0, -1, 0,
    0, 0, -half, -half,
    0, 0, 0, -1,
  ];
  const clip = new THREE.AnimationClip(
    "wheels_roll",
    2,
    axleNodes.map((node) => new THREE.QuaternionKeyframeTrack(`${node.name}.quaternion`, times, values)),
  );
  root.animations = [clip];

  return kitUserData(THREE, root, {
    assetId: `mine-entrance.cart-${variant}.m1`,
    variant: loaded ? "mine tub, loaded with ore" : "mine tub, empty",
    gaugeMetres: SPEC.gauge,
    wheelTreadRadiusMetres: SPEC.wheelTreadRadius,
    flangeDropMetres: SPEC.flangeDrop,
    liftOntoRailMetres: SPEC.cartLiftOntoRail,
    animatedNodes: axleNodes.map((node) => node.name),
    clips: [{ name: "wheels_roll", seconds: 2, channels: "rotation only" }],
    surfaceLanguage: [
      "four corner posts and three courses of boards a side with 25 mm air gaps",
      "iron bands as four nailed straps, not a floating ring",
      "flanged wheels that hang 22 mm below the tread and grip this kit's own rail",
      "bearing blocks carrying the axle, so the axle ends in iron and not in air",
      loaded ? "three ore colours heaped over a dark fill plate, with cut crystal faces on top" : "an empty tub reads empty: no packing, no filler",
    ],
    parts: root.children.map((child) => child.name),
  });
}
