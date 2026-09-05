/**
 * Village Square 01 — Stone Draw-Well, with a winch that turns.
 *
 * Reference measurements: a village draw-well's parapet is built to lean on, 700-800 mm to
 * the coping, with a shaft 800-900 mm across; the winch barrel sits about 800 mm above the
 * coping so a crank can be turned standing; the shelter roof clears a raised bucket. This is
 * cut to 780 mm to the coping, an 880 mm shaft, a barrel at 1.600 m and a ridge at 2.560 m.
 *
 * Silhouette contract — what must survive at 10 m: the round drum of coursed stone, the two
 * posts, the pitched shingle roof over them, and the crank handle standing out to one side.
 *
 * MOTION
 * ------
 * `winch_pivot` is a real node at the barrel's axis (y = 1.600, running along X). Rotating it
 * about +X turns the barrel, the rope wound on it and the crank together, because they are
 * its children and nothing else is. The barrel is journalled 20 mm into each post and the
 * axle passes through the +X post to reach the crank, which is how a winch is actually hung;
 * that is the one place in this model where two parts share space on purpose.
 *
 * NOTHING FLOATS, NOTHING IS HOLLOW
 * ---------------------------------
 * The shaft is filled with a solid stone plug from the ground to the water, so looking down
 * the well shows water in shadow rather than the inside of a tube — this kit does not rely on
 * back faces being drawn. The water is a 50 mm disc resting on that plug, not a plane.
 */
import { createKit, place, selectMaterials, summarize, wobble } from "./village-kit.mjs";

// --- Drum (metres) ------------------------------------------------------------------------
const SHAFT_R = 0.44; // inner face of the drum: an 880 mm shaft
const DRUM_R = 0.62; // outer face: a 180 mm wall of stone
const APRON_R = 0.74; // ground apron the drum stands on
const APRON_H = 0.07;
const COURSE_H = 0.21;
const COURSES = 3;
const DRUM_TOP = APRON_H + COURSES * COURSE_H; // 0.70
const COPING_INNER = 0.42;
const COPING_OUTER = 0.7;
const COPING_H = 0.09;
const PARAPET = DRUM_TOP + COPING_H; // 0.79 to the top of the coping
const BLOCKS_PER_COURSE = 14;
const APRON_BLOCKS = 16;

// --- Water --------------------------------------------------------------------------------
/*
 * 480 mm below the coping, not 780.
 *
 * A real draw-well's water is metres down. A game asset's has to be VISIBLE, and the first
 * cut put it at 0.340 where the parapet hid it from every camera angle this world uses — so
 * the well shipped a `water` material nobody could ever see. 0.480 is the depth at which the
 * storefront's own three-quarter view (22.5 degrees above the horizon) clears the near coping
 * and lands on the surface.
 */
const WATER_TOP = 0.48;
const WATER_T = 0.05;
/*
 * The shaft fill is NARROWER than the drum's bore, and by a measured amount.
 *
 * A drum block is a wedge whose inner face is a chord: its corners sit at r = 0.440 but the
 * middle of that face dips in to 0.440 * cos(180/14 deg) = 0.4290. A 16-sided cylinder of
 * radius 0.440 therefore pushes its own corners 11 mm INTO the stone, and the first build
 * shipped exactly that — scripts/asset-geometry-audit.mjs found 105 of the fill's 192
 * sampled vertices inside the drum. 0.415 clears the chord by 14 mm, which is still inside
 * the 25 mm the same audit counts as touching, so the fill is supported and not intersecting.
 */
const FILL_R = 0.415;
const WATER_R = 0.41;

// --- Frame ---------------------------------------------------------------------------------
const POST_X = 0.56; // both posts stand on the coping ring
const POST_SIDE = 0.1;
const POST_TOP = 2.1;
const HEAD_Y = POST_TOP; // head beam sits on the posts
const HEAD_H = 0.1;
/*
 * 0.715, not 0.720. At 0.720 the beam's top corners land EXACTLY on the roof deck's underside
 * plane, and a vertex on a face is a vertex the geometry audit's ray test counts as inside —
 * 12 of them, reported as a 93 mm penetration of a joint that is really a contact. 5 mm of
 * clearance says the same thing about the structure and says it unambiguously.
 */
const HEAD_HALF = 0.715;
const AXLE_Y = 1.6;
const BARREL_R = 0.09;
const ROPE_R = 0.115;
const ROPE_HALF = 0.22;
const BARREL_HALF = 0.53; // 20 mm into each post's inner face at 0.51

// --- Roof -----------------------------------------------------------------------------------
const RIDGE_Y = 2.52;
/*
 * The roof is sized to leave the well's mouth visible from above.
 *
 * At 0.92 x 0.80 the shelter measured 2.09 x 1.68 m over a drum only 1.48 m across, and from
 * the elevated camera this world uses the whole asset was a red rectangle — the drum, the
 * water, the bucket and the winch all under it. 0.86 x 0.62 is 1.72 x 1.24, which still
 * oversails the head beam by 145 mm and still keeps rain off the winch.
 */
const EAVE_X = 0.86;
/*
 * The roof's underside plane is solved to pass 4 mm ABOVE the head beam's top corners, not
 * through them. Through them is the honest joint and the wrong file: a vertex lying exactly on
 * a face is a vertex the geometry audit's ray test counts as inside one, and the beam came
 * back reported as 69 mm inside the roof deck. 4 mm keeps the contact (the audit's own
 * threshold is 25 mm) and removes the ambiguity.
 */
const ROOF_CLEARANCE = 0.004;
const EAVE_Y = RIDGE_Y - EAVE_X * ((RIDGE_Y - (HEAD_Y + HEAD_H + ROOF_CLEARANCE)) / HEAD_HALF);
const ROOF_ANGLE = Math.atan2(RIDGE_Y - EAVE_Y, EAVE_X);
const SLOPE_DIR = [Math.cos(ROOF_ANGLE), -Math.sin(ROOF_ANGLE)]; // ridge -> eave, in XY
const SLOPE_NORMAL = [Math.sin(ROOF_ANGLE), Math.cos(ROOF_ANGLE)]; // out of the roof plane
const SLOPE_LEN = Math.hypot(EAVE_X, RIDGE_Y - EAVE_Y);
const DECK_T = 0.05;
const ROOF_HALF_Z = 0.62;
const SHINGLE_COURSES = 4;

/** A point on the roof plane: `along` metres down-slope from the ridge, `out` clear of it. */
function roofPoint(along, out, side) {
  return [
    side * (SLOPE_DIR[0] * along + SLOPE_NORMAL[0] * out),
    RIDGE_Y + SLOPE_DIR[1] * along + SLOPE_NORMAL[1] * out,
  ];
}

export function createVillageWell(THREE) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, [
    "stoneLight",
    "stoneBody",
    "stoneShadow",
    "woodFrame",
    "woodPlank",
    "woodPale",
    "roofTile",
    "iron",
    "water",
  ]);

  const root = kit.group("village_well");
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "village-square",
    assetId: "village-square.well.m1",
    upAxis: "+Y",
    scaleMeters: 1,
    sockets: ["winch_pivot"],
    socketNotes: {
      winch_pivot: "Winch barrel axis at y = 1.600, running along X. Rotate about +X; one full turn winds the rope once. Zero is the shipped rest pose with the crank hanging down.",
    },
    clips: [
      {
        name: "winch-crank",
        koreanName: "두레박 손잡이 돌리기",
        node: "winch_pivot",
        axis: "x",
        loop: true,
        // Quarter turns, so LINEAR quaternion interpolation takes the short way round each
        // time instead of collapsing a 360-degree key pair into no motion at all.
        keys: [
          { time: 0, degrees: 0 },
          { time: 0.9, degrees: 90 },
          { time: 1.8, degrees: 180 },
          { time: 2.7, degrees: 270 },
          { time: 3.6, degrees: 360 },
        ],
      },
    ],
  };

  // --- Drum -------------------------------------------------------------------------------
  const drum = kit.group("drum");
  root.add(drum);

  /**
   * A ring of voussoirs. Wedges, not boxes: a box's sides are parallel and a ring's blocks'
   * are not, so a ring of boxes opens a gap at every outer joint. See village-kit.mjs.
   */
  const ring = (count, innerR, outerR, yFrom, yTo, seedBase, jitter = 0, turn = 0) =>
    kit.ringBlocks(count, innerR, outerR, yFrom, yTo, { turn, heightJitter: jitter, seed: seedBase });

  const buckets = { stoneLight: [], stoneBody: [], stoneShadow: [] };
  const fileRing = (entries) => {
    for (const item of entries) {
      const pick = Math.abs(Math.round(wobble(item.seed) * 1000)) % 10;
      const role = pick < 3 ? "stoneLight" : pick < 8 ? "stoneBody" : "stoneShadow";
      buckets[role].push(item.entry);
    }
  };

  fileRing(ring(APRON_BLOCKS, SHAFT_R, APRON_R, 0, APRON_H, 10));
  for (let course = 0; course < COURSES; course += 1) {
    const yFrom = APRON_H + course * COURSE_H;
    // Every other course is turned half a block, so the vertical joints never line up.
    const turn = course % 2 === 1 ? Math.PI / BLOCKS_PER_COURSE : 0;
    fileRing(ring(BLOCKS_PER_COURSE, SHAFT_R, DRUM_R, yFrom, yFrom + COURSE_H, 100 + course * 37, 0.012, turn));
  }
  for (const [role, entries] of Object.entries(buckets)) {
    if (entries.length) drum.add(kit.merged(`well_drum_${role}`, mat[role], entries));
  }
  drum.add(kit.merged("well_coping", mat.stoneLight, ring(APRON_BLOCKS, COPING_INNER, COPING_OUTER, DRUM_TOP, PARAPET, 900).map((item) => item.entry)));

  // --- Shaft and water --------------------------------------------------------------------
  // The plug is what makes the well readable from above without drawing back faces: it is
  // solid stone from the ground up to just under the waterline.
  const shaft = kit.group("shaft");
  root.add(shaft);
  shaft.add(kit.solo("well_shaft_fill", mat.stoneShadow, kit.cyl(FILL_R, FILL_R, WATER_TOP - WATER_T, 16), [
    0,
    (WATER_TOP - WATER_T) / 2,
    0,
  ]));
  shaft.add(kit.solo("well_water", mat.water, kit.cyl(WATER_R, WATER_R, WATER_T, 16), [
    0,
    WATER_TOP - WATER_T / 2,
    0,
  ]));

  // --- Frame ------------------------------------------------------------------------------
  const frame = kit.group("frame");
  root.add(frame);

  const posts = [];
  for (const side of [-1, 1]) {
    // `beam` extrudes along +Z, so a standing post is a quarter turn about X.
    posts.push(
      place(kit.beam(POST_SIDE, POST_SIDE, POST_TOP - PARAPET), [side * POST_X, PARAPET + (POST_TOP - PARAPET) / 2, 0], [
        Math.PI / 2,
        0,
        0,
      ]),
    );
  }
  // Head beam across both posts; the roof lands on its two top corners. A quarter turn about
  // Y lays the extrusion along X, so the chamfer runs the length of the beam as it should.
  posts.push(place(kit.beam(0.12, HEAD_H, HEAD_HALF * 2), [0, HEAD_Y + HEAD_H / 2, 0], [0, Math.PI / 2, 0]));
  frame.add(kit.merged("well_frame", mat.woodFrame, posts));
  // Knee braces, so the frame is not two sticks and a plank. Boxes rather than chamfered
  // prisms: a brace needs a compound rotation and a 70 mm stick's arris is not what carries it.
  frame.add(
    kit.merged("well_frame_braces", mat.woodFrame, [-1, 1].map((side) =>
      place(kit.box(0.31, 0.07, 0.07), [side * 0.41, HEAD_Y - 0.1, 0], [0, 0, -side * (Math.PI / 4)]),
    )),
  );

  // --- Winch ------------------------------------------------------------------------------
  // Everything that turns hangs off this node and nothing else does.
  const winch = kit.group("winch_pivot", [0, AXLE_Y, 0]);
  winch.userData = { socket: "winch_pivot", axis: "+X", restRadians: 0, windsPositive: true };
  frame.add(winch);

  // Two barrel ends with the rope band between them: the rope is not a sleeve over the
  // barrel, it is the part of the barrel's length the rope has taken over, so no part of
  // this winch is inside another part of it.
  winch.add(
    kit.merged("winch_barrel", mat.woodPlank, [
      place(kit.cyl(BARREL_R, BARREL_R, BARREL_HALF - ROPE_HALF, 12), [(BARREL_HALF + ROPE_HALF) / 2, 0, 0], [0, 0, Math.PI / 2]),
      place(kit.cyl(BARREL_R, BARREL_R, BARREL_HALF - ROPE_HALF, 12), [-(BARREL_HALF + ROPE_HALF) / 2, 0, 0], [0, 0, Math.PI / 2]),
      // The axle continues through the +X post to carry the crank.
      place(kit.cyl(0.03, 0.03, 0.3, 8), [BARREL_HALF + 0.14, 0, 0], [0, 0, Math.PI / 2]),
    ]),
  );
  winch.add(kit.solo("winch_rope", mat.woodPale, kit.cyl(ROPE_R, ROPE_R, ROPE_HALF * 2, 12), [0, 0, 0], [0, 0, Math.PI / 2]));
  winch.add(
    kit.merged("winch_crank", mat.iron, [
      place(kit.box(0.05, 0.26, 0.05), [BARREL_HALF + 0.26, -0.11, 0]),
      place(kit.cyl(0.022, 0.022, 0.13, 8), [BARREL_HALF + 0.325, -0.22, 0], [0, 0, Math.PI / 2]),
    ]),
  );

  // --- Roof --------------------------------------------------------------------------------
  const roof = kit.group("roof");
  root.add(roof);

  const decks = [];
  const shingles = [];
  const barge = [];
  for (const side of [-1, 1]) {
    const rot = [0, 0, -side * ROOF_ANGLE];
    const [dx, dy] = roofPoint(SLOPE_LEN / 2, DECK_T / 2, side);
    decks.push(place(kit.box(SLOPE_LEN + 0.02, DECK_T, ROOF_HALF_Z * 2), [dx, dy, 0], rot));

    // Shingle courses run eave to ridge and thicken as they climb, so each course's lower
    // edge steps proud of the one below and casts the line that reads as a shingled roof.
    const pitch = (SLOPE_LEN - 0.1) / SHINGLE_COURSES;
    for (let course = 0; course < SHINGLE_COURSES; course += 1) {
      const thickness = 0.028 + course * 0.018;
      const along = SLOPE_LEN - 0.08 - course * pitch;
      const [tx, ty] = roofPoint(along, DECK_T + thickness / 2, side);
      shingles.push(place(kit.box(pitch + 0.06, thickness, ROOF_HALF_Z * 2), [tx, ty, 0], rot));
    }

    const [bx, by] = roofPoint(SLOPE_LEN / 2, DECK_T / 2, side);
    for (const sz of [-1, 1]) {
      barge.push(place(kit.box(SLOPE_LEN + 0.04, 0.13, 0.04), [bx, by, sz * (ROOF_HALF_Z + 0.02)], rot));
    }
  }
  roof.add(kit.merged("roof_deck", mat.woodFrame, decks));
  roof.add(kit.merged("roof_shingles", mat.roofTile, shingles));
  roof.add(kit.merged("roof_barge_boards", mat.woodFrame, barge));
  const capOut = DECK_T + 0.03 + (SHINGLE_COURSES - 1) * 0.014 + 0.02;
  roof.add(
    kit.merged("roof_ridge_cap", mat.roofTile, [-1, 1].map((side) => {
      const [cx, cy] = roofPoint(0.09, capOut, side);
      return place(kit.box(0.2, 0.055, ROOF_HALF_Z * 2 + 0.03), [cx, cy, 0], [0, 0, -side * ROOF_ANGLE]);
    })),
  );

  // --- Bucket ------------------------------------------------------------------------------
  // Standing on the coping, not hanging from the rope: a bucket on a rope has to travel when
  // the winch turns, and a shipped model that cheats that reads as a bug the first time
  // somebody plays the clip.
  const bucketGroup = kit.group("bucket");
  root.add(bucketGroup);
  const BUCKET_R = 0.13;
  const BUCKET_H = 0.22;
  const BUCKET_Z = 0.56;
  bucketGroup.add(
    kit.merged("well_bucket", mat.woodPlank, [
      place(kit.cyl(BUCKET_R, BUCKET_R * 0.86, BUCKET_H, 10), [0, PARAPET + BUCKET_H / 2, BUCKET_Z]),
    ]),
  );
  bucketGroup.add(
    kit.merged("well_bucket_hardware", mat.iron, [
      place(kit.cyl(BUCKET_R + 0.008, BUCKET_R + 0.008, 0.022, 10), [0, PARAPET + BUCKET_H - 0.03, BUCKET_Z]),
      place(kit.cyl(BUCKET_R * 0.9, BUCKET_R * 0.9, 0.022, 10), [0, PARAPET + 0.04, BUCKET_Z]),
      // Bail handle: two uprights and a bar across, resting on the rim.
      place(kit.box(0.018, 0.16, 0.018), [BUCKET_R - 0.01, PARAPET + BUCKET_H + 0.06, BUCKET_Z]),
      place(kit.box(0.018, 0.16, 0.018), [-(BUCKET_R - 0.01), PARAPET + BUCKET_H + 0.06, BUCKET_Z]),
      place(kit.box(BUCKET_R * 2 - 0.02, 0.018, 0.018), [0, PARAPET + BUCKET_H + 0.14, BUCKET_Z]),
    ]),
  );

  root.userData.measured = summarize(THREE, root);
  return root;
}

export default createVillageWell;
