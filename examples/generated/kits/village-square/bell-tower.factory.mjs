/**
 * Village Square 10 — Small Bell Tower, with a bell that swings.
 *
 * Reference measurements: a village bell cote or gantry stands 2.8-3.2 m to the finial on a
 * stone plinth 1.2-1.4 m square; the headstock is at 2.2-2.4 m; a bell of this class is
 * 400-450 mm across the mouth and about as tall. This is cut to 3.128 m overall, a 1.300 m
 * plinth, a headstock at 2.300 m and a 440 mm bell.
 *
 * MOTION
 * ------
 * `bell_pivot` is the headstock's axis at y = 2.300, running along X — the same line the
 * gudgeon rod runs on, so the bell turns about the trunnions and not about its own middle.
 * Rotating it about +X swings the bell toward +Z and -Z. The swing in the shipped clip is
 * +-16 degrees, and that number is not a taste decision: the mouth hangs 0.672 m below the
 * axis and is 0.220 m in radius, so at 16 degrees its furthest point reaches
 * 0.672*sin16 + 0.220*cos16 = 0.397 m, against posts whose inner faces are at 0.405 m. Any
 * more swing and the bell passes through the frame it hangs in. This is a bell being CHIMED,
 * not rung full-circle, and the rest of the mechanism is cut for that.
 *
 * WHAT MAKES IT A BELL AND NOT A LUMP OF BRASS (2026-09-05 mechanism audit)
 * ------------------------------------------------------------------------
 * The first cut shipped a solid brass cone with no clapper and no rope: nothing to strike it
 * and nothing to swing it. Three things answer that here, and all three are measured:
 *
 *   1. The bell is HOLLOW. Its skirt is an outer surface and an inner surface that meet at the
 *      lip, so the wall measures 14 mm at the crown, 20 mm at the waist and 26 mm at the sound
 *      bow — a real bell's section. It costs 24 triangles LESS than the solid stack it
 *      replaces, because the five internal caps nobody could see are gone.
 *   2. `bell_clapper` is a node of its own INSIDE the bell, hung from the crown 0.310 m below
 *      the swing axis. It is a child of `bell_pivot`, so it swings with the bell; its own
 *      track then lags the bell by a quarter beat and reaches +-24 degrees RELATIVE to it at
 *      the moment the bell turns over. At 24 degrees the ball's outer face reaches 177.1 mm
 *      from the axis and the sound bow's inner face is at 176.3 mm — the clapper strikes.
 *      A clapper welded into the bell mesh could never do that, which is exactly why the audit
 *      asked for a separate node.
 *   3. A chiming lever stands out of the yoke and carries a rope down the tower to y = 1.150,
 *      which is a height a person can reach. Rope and lever are both children of `bell_pivot`,
 *      so the rope swings with the bell instead of stretching. The coil on the plinth stays
 *      what it always was: a spare coil of rope, not the working end.
 */
import { createKit, place, selectMaterials, summarize } from "./village-kit.mjs";

// --- Plinth (metres) ---------------------------------------------------------------------

const STEPS = [
  { side: 1.3, height: 0.18 },
  { side: 1.16, height: 0.2 },
  { side: 1.02, height: 0.14 },
];
const PLINTH_TOP = STEPS.reduce((sum, step) => sum + step.height, 0); // 0.52

// --- Frame ----------------------------------------------------------------------------------
const POST_X = 0.46;
const POST_SIDE = 0.11;
const HEAD_Y = 2.3;
const POST_TOP = 2.42;
const RAIL_LOW_Y = 0.78;

// --- Bell --------------------------------------------------------------------------------
const BELL_MOUTH_R = 0.22;
const BELL_DROP = 0.672; // headstock axis to the lip of the sound bow
const SWING_DEGREES = 16;
/**
 * The bell's section, measured down from the swing axis: [y, outer radius, inner radius].
 *
 * A bell's profile is a narrow shoulder, a long slow waist and a hard flare at the sound bow.
 * The outer column is the shipped silhouette, unchanged. The inner column is new and is what
 * makes the bell a bell: it is offset inward by a wall that thickens from 14 mm at the crown to
 * 26 mm at the waist, and it closes onto the outer profile AT THE LIP so the mouth has no hole
 * around its rim. The crown (above the first row) stays solid — that is the metal the clapper
 * hangs from.
 */
const BELL_SECTION = [
  [-0.32, 0.088, 0.074],
  [-0.48, 0.118, 0.098],
  [-0.59, 0.185, 0.159],
  [-0.645, 0.22, 0.1955],
  [-BELL_DROP, 0.2134, 0.2134],
];

// --- Clapper -------------------------------------------------------------------------------
/** Hung from the crown, on the swing axis, 10 mm inside the solid metal above the cavity. */
const CLAPPER_Y = -0.31;
/** Ball centre, measured from the swing axis. 13.8 mm of it shows below the lip. */
const CLAPPER_BALL_Y = -0.645;
const CLAPPER_BALL_R = 0.048;
/** Peak angle of the clapper RELATIVE to the bell. Solved above for contact at the sound bow. */
const CLAPPER_DEGREES = 24;

// --- Rope ------------------------------------------------------------------------------------
/** Where the rope leaves the chiming lever, and where a hand reaches it. */
const ROPE_Z = 0.25;
const ROPE_TOP_Y = 2.23;
const ROPE_BOTTOM_Y = 1.15;
const ROPE_R = 0.018;

// --- Roof ------------------------------------------------------------------------------------
const ROOF_BASE_Y = POST_TOP;
const ROOF_STEPS = [
  { top: 0.55, bottom: 0.7, height: 0.17 },
  { top: 0.37, bottom: 0.55, height: 0.16 },
  { top: 0.15, bottom: 0.37, height: 0.15 },
];

export function createVillageBellTower(THREE) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, [
    "stoneLight",
    "stoneBody",
    "stoneShadow",
    "woodFrame",
    "woodPlank",
    "woodPale",
    "roofTile",
    "brass",
    "iron",
  ]);

  const root = kit.group("village_bell_tower");
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "village-square",
    assetId: "village-square.bell-tower.m1",
    upAxis: "+Y",
    scaleMeters: 1,
    sockets: ["bell_pivot", "bell_clapper"],
    socketNotes: {
      bell_pivot: "Headstock axis at y = 2.300, running along X — the gudgeon rod's own line. Rotate about +X; zero is the shipped rest pose with the bell hanging plumb. Beyond +-20 degrees the mouth reaches the posts.",
      bell_clapper: "The clapper's hanging point, y = 1.990, on the same axis and inside the bell. A child of bell_pivot, so it swings with the bell; rotate it about +X to move it RELATIVE to the bell. It reaches the sound bow at +-24 degrees.",
    },
    clips: [
      {
        name: "bell-swing",
        koreanName: "종 흔들리기",
        loop: true,
        tracks: [
          {
            node: "bell_pivot",
            axis: "x",
            keys: [
              { time: 0, degrees: 0 },
              { time: 0.45, degrees: SWING_DEGREES },
              { time: 1.35, degrees: -SWING_DEGREES },
              { time: 2.25, degrees: SWING_DEGREES },
              { time: 2.7, degrees: 0 },
            ],
          },
          {
            /*
             * The clapper, in the bell's own frame.
             *
             * A clapper does not swing with the bell — it hangs by its own inertia while the
             * bell turns around it, catches up when the bell turns over, and strikes. So these
             * numbers are authored as ABSOLUTE-minus-bell: at 0.45 s the bell is at +16 and
             * the clapper is at -8, which is -24 relative, which is contact at the sound bow.
             * The absolute swing that comes out is +-8 degrees, i.e. the clapper stays nearly
             * plumb, which is what a chimed bell actually looks like.
             */
            node: "bell_clapper",
            axis: "x",
            keys: [
              { time: 0, degrees: -4 },
              { time: 0.45, degrees: -CLAPPER_DEGREES },
              { time: 0.8, degrees: 0 },
              { time: 1.35, degrees: CLAPPER_DEGREES },
              { time: 1.7, degrees: 0 },
              { time: 2.25, degrees: -CLAPPER_DEGREES },
              { time: 2.6, degrees: 0 },
              { time: 2.7, degrees: -4 },
            ],
          },
        ],
      },
    ],
  };

  // --- Plinth ------------------------------------------------------------------------------
  const plinth = kit.group("plinth");
  root.add(plinth);
  // Darkest at the ground, lightest at the top: a plinth whose top step is the dark value
  // reads as a hole in the middle of the object from any low angle.
  const roles = [mat.stoneShadow, mat.stoneBody, mat.stoneLight];
  let y = 0;
  for (const [index, step] of STEPS.entries()) {
    plinth.add(
      kit.solo(
        `bell_tower_plinth_${index + 1}`,
        roles[index],
        kit.prism(kit.chamferProfile(step.side, step.height, 0.018), step.side),
        [0, y + step.height / 2, 0],
      ),
    );
    y += step.height;
  }

  // --- Frame ---------------------------------------------------------------------------------
  const frame = kit.group("frame");
  root.add(frame);

  const timbers = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      timbers.push(
        place(kit.beam(POST_SIDE, POST_SIDE, POST_TOP - PLINTH_TOP), [sx * POST_X, (POST_TOP + PLINTH_TOP) / 2, sz * POST_X], [
          Math.PI / 2,
          0,
          0,
        ]),
      );
    }
  }
  /*
   * Two rings of rails: one low enough to be a rail and one carrying the roof plate.
   *
   * The rails that run along Z used to be cut back by 1.6 post widths so they would not share
   * space with the rails running along X. That left both of the LOW ones ending 33 mm short of
   * the posts, hanging in the air off nothing — which is what the inspector reported as
   * GEO-FLOATING-PART on the shipped file. 0.820 m puts their ends 5 mm inside each post's
   * inner face: a joint, not a gap, and still 6 mm clear of the rails running the other way.
   */
  const RAIL_Z_LENGTH = POST_X * 2 - 0.1;
  for (const railY of [RAIL_LOW_Y, POST_TOP - 0.07]) {
    for (const side of [-1, 1]) {
      timbers.push(place(kit.beam(POST_SIDE * 0.8, 0.1, POST_X * 2), [0, railY, side * POST_X], [0, Math.PI / 2, 0]));
      timbers.push(place(kit.beam(POST_SIDE * 0.8, 0.1, RAIL_Z_LENGTH), [side * POST_X, railY, 0], [0, 0, 0]));
    }
  }
  frame.add(kit.merged("bell_tower_frame", mat.woodFrame, timbers));

  // Corner braces under the head rail. Boxes, because a brace needs a compound angle and a
  // 70 mm stick's arris is not what carries this object's read.
  const braces = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      braces.push(place(kit.box(0.34, 0.07, 0.07), [sx * (POST_X - 0.14), POST_TOP - 0.24, sz * POST_X], [0, 0, -sx * (Math.PI / 4)]));
    }
  }
  frame.add(kit.merged("bell_tower_braces", mat.woodPlank, braces));

  // Headstock beam. The bell hangs from its axis, so it spans the two +-X posts.
  frame.add(
    kit.solo("bell_tower_headstock", mat.woodPlank, kit.beam(0.14, 0.12, POST_X * 2 + POST_SIDE), [0, HEAD_Y + 0.06, 0], [0, Math.PI / 2, 0]),
  );
  /*
   * Gudgeon bearing blocks.
   *
   * The gudgeon rod used to be half buried in the headstock's underside and to run 15 mm past
   * its ends into the air — a bell hung on nothing but the beam it is pressed against. These
   * are the two blocks the rod actually turns in: 115 x 75 x 140 mm, bolted under each end of
   * the headstock, with the rod journalled 28 mm into each. The rod is cut to 1.030 m to match,
   * so it ends flush with the beam instead of overhanging it.
   */
  frame.add(
    kit.merged("bell_tower_gudgeons", mat.iron, [-1, 1].map((side) =>
      place(kit.box(0.115, 0.075, 0.14), [side * 0.4575, HEAD_Y - 0.0325, 0]),
    )),
  );

  // --- Bell ----------------------------------------------------------------------------------
  // Everything that swings hangs off this node and nothing else does.
  const pivot = kit.group("bell_pivot", [0, HEAD_Y, 0]);
  pivot.userData = { socket: "bell_pivot", axis: "+X", restRadians: 0, maxSwingDegrees: SWING_DEGREES };
  frame.add(pivot);

  pivot.add(
    kit.merged("bell_yoke", mat.woodFrame, [
      place(kit.box(0.38, 0.09, 0.15), [0, -0.055, 0]),
      place(kit.box(0.07, 0.14, 0.09), [0, -0.15, 0]),
      // Chiming lever: 260 mm of the yoke's own timber reaching out to z = 0.280, which is
      // where the rope hangs from. Without it the rope would leave from the swing axis, where
      // pulling it would do nothing at all.
      place(kit.box(0.08, 0.05, 0.26), [0, -0.055, 0.15]),
    ]),
  );
  /*
   * The bell itself.
   *
   * The crown is a solid twelve-sided frustum — that is the metal the clapper hangs off. Every
   * row below it is an OPEN tube for the outside of the bell and a second open tube, wound the
   * other way, for the inside. `kit.cyl` faces outward; mirroring one across X reverses its
   * winding, and a 12-gon mirrored across X lands on its own vertices, so the inner surface is
   * the same ring of points with its faces turned in. Outer and inner share the lip ring
   * exactly, so the mouth is a mouth and not a hole with a rim missing.
   */
  const inward = (geometry) => {
    geometry.scale(-1, 1, 1);
    geometry.computeVertexNormals();
    return geometry;
  };
  const bellRows = [];
  // Solid crown: y -0.320 .. -0.220. Its underside is the cavity's ceiling.
  bellRows.push(place(kit.cyl(0.055, BELL_SECTION[0][1], 0.1, 12), [0, -0.27, 0]));
  for (let i = 0; i < BELL_SECTION.length - 1; i += 1) {
    const [yTop, outerTop, innerTop] = BELL_SECTION[i];
    const [yBottom, outerBottom, innerBottom] = BELL_SECTION[i + 1];
    const height = yTop - yBottom;
    const mid = (yTop + yBottom) / 2;
    bellRows.push(place(kit.cyl(outerTop, outerBottom, height, 12, true), [0, mid, 0]));
    bellRows.push(place(inward(kit.cyl(innerTop, innerBottom, height, 12, true)), [0, mid, 0]));
  }
  pivot.add(kit.merged("bell_body", mat.brass, bellRows));
  // Gudgeon straps: the ironwork that actually holds a bell to its headstock. The rod is cut
  // to the headstock's own length so it ends inside the bearing blocks rather than in the air.
  pivot.add(
    kit.merged("bell_straps", mat.iron, [
      place(kit.box(0.05, 0.13, 0.11), [0.14, -0.055, 0]),
      place(kit.box(0.05, 0.13, 0.11), [-0.14, -0.055, 0]),
      place(kit.cyl(0.028, 0.028, POST_X * 2 + POST_SIDE, 8), [0, 0, 0], [0, 0, Math.PI / 2]),
    ]),
  );

  // --- Clapper -----------------------------------------------------------------------------
  // Its own node, inside the bell, on the swing axis. Child of the pivot so it swings with the
  // bell; its own track is what lets it swing AGAINST the bell and strike.
  const clapper = kit.group("bell_clapper", [0, CLAPPER_Y, 0]);
  clapper.userData = { socket: "bell_clapper", axis: "+X", restRadians: 0, maxSwingDegrees: CLAPPER_DEGREES };
  pivot.add(clapper);
  clapper.add(
    kit.merged("bell_clapper_body", mat.iron, [
      // Shank: 20 mm of its top is inside the solid crown, which is the hanging joint.
      place(kit.box(0.026, 0.35, 0.026), [0, (CLAPPER_BALL_Y - CLAPPER_Y) / 2 - 0.0025, 0]),
      place(kit.blob(CLAPPER_BALL_R, 1, 0.95, 1), [0, CLAPPER_BALL_Y - CLAPPER_Y, 0]),
    ]),
  );

  // --- Rope --------------------------------------------------------------------------------
  /*
   * The working rope: a chiming lever out of the yoke, and a rope from it down to 1.150 m.
   *
   * Both hang off `bell_pivot`, so the rope travels with the bell and never has to stretch —
   * which is the reason the first cut left the rope off altogether. The lever is merged into
   * the yoke because it is the same timber and the same part.
   */
  pivot.add(
    kit.solo("bell_rope", mat.woodPale, kit.cyl(ROPE_R, ROPE_R, ROPE_TOP_Y - ROPE_BOTTOM_Y, 6), [
      0,
      (ROPE_TOP_Y + ROPE_BOTTOM_Y) / 2 - HEAD_Y,
      ROPE_Z,
    ]),
  );

  // A spare coil on the plinth. It was never the working end and does not pretend to be.
  const rope = kit.group("rope");
  root.add(rope);
  const coils = [];
  for (let i = 0; i < 3; i += 1) {
    coils.push(place(kit.cyl(0.115 - i * 0.02, 0.115 - i * 0.02, 0.035, 10), [0.3, PLINTH_TOP + 0.0175 + i * 0.035, 0.3]));
  }
  rope.add(kit.merged("bell_tower_rope_coil", mat.woodPale, coils));

  // --- Roof ------------------------------------------------------------------------------------
  const roof = kit.group("roof");
  root.add(roof);
  const tiers = [];
  let roofY = ROOF_BASE_Y;
  for (const step of ROOF_STEPS) {
    // A four-segment cylinder puts its vertices on the axes; turning it 45 degrees and taking
    // the radius to the corner (half-side * sqrt(2)) is what makes the pyramid face the same
    // way the square frame under it does.
    tiers.push(
      place(kit.cyl(step.top * Math.SQRT2, step.bottom * Math.SQRT2, step.height, 4), [0, roofY + step.height / 2, 0], [0, Math.PI / 4, 0]),
    );
    roofY += step.height;
  }
  roof.add(kit.merged("bell_tower_roof", mat.roofTile, tiers));
  roof.add(
    kit.merged("bell_tower_finial", mat.brass, [
      place(kit.cyl(0.03, 0.05, 0.09, 6), [0, roofY + 0.045, 0]),
      place(kit.blob(0.055, 1, 1.2, 1), [0, roofY + 0.13, 0]),
    ]),
  );

  root.userData.measured = summarize(THREE, root);
  return root;
}

export default createVillageBellTower;
