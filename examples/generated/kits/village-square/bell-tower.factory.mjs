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
 * `bell_pivot` is the headstock's axis at y = 2.300, running along X. Rotating it about +X
 * swings the bell toward +Z and -Z. The swing in the shipped clip is +-16 degrees, and that
 * number is not a taste decision: the mouth hangs 0.672 m below the axis and is 0.220 m in
 * radius, so at 16 degrees its furthest point reaches 0.672*sin16 + 0.220*cos16 = 0.397 m,
 * against posts whose inner faces are at 0.405 m. Any more swing and the bell passes through
 * the frame it hangs in, which is the kind of defect a buyer finds by pressing play once.
 *
 * The rope is coiled on the plinth rather than tied to the bell. A rope modelled as a solid
 * from the bell to a cleat would have to stretch every frame of the clip, and a rope hanging
 * from the headstock alone would end in mid-air. Neither is something to ship.
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
    sockets: ["bell_pivot"],
    socketNotes: {
      bell_pivot: "Headstock axis at y = 2.300, running along X. Rotate about +X; zero is the shipped rest pose with the bell hanging plumb. Beyond +-20 degrees the mouth reaches the posts.",
    },
    clips: [
      {
        name: "bell-swing",
        koreanName: "종 흔들리기",
        node: "bell_pivot",
        axis: "x",
        loop: true,
        keys: [
          { time: 0, degrees: 0 },
          { time: 0.45, degrees: SWING_DEGREES },
          { time: 1.35, degrees: -SWING_DEGREES },
          { time: 2.25, degrees: SWING_DEGREES },
          { time: 2.7, degrees: 0 },
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
  // Two rings of rails: one low enough to be a rail and one carrying the roof plate.
  for (const railY of [RAIL_LOW_Y, POST_TOP - 0.07]) {
    for (const side of [-1, 1]) {
      timbers.push(place(kit.beam(POST_SIDE * 0.8, 0.1, POST_X * 2), [0, railY, side * POST_X], [0, Math.PI / 2, 0]));
      timbers.push(place(kit.beam(POST_SIDE * 0.8, 0.1, POST_X * 2 - POST_SIDE * 1.6), [side * POST_X, railY, 0], [0, 0, 0]));
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

  // --- Bell ----------------------------------------------------------------------------------
  // Everything that swings hangs off this node and nothing else does.
  const pivot = kit.group("bell_pivot", [0, HEAD_Y, 0]);
  pivot.userData = { socket: "bell_pivot", axis: "+X", restRadians: 0, maxSwingDegrees: SWING_DEGREES };
  frame.add(pivot);

  pivot.add(
    kit.merged("bell_yoke", mat.woodFrame, [
      place(kit.box(0.38, 0.09, 0.15), [0, -0.055, 0]),
      place(kit.box(0.07, 0.14, 0.09), [0, -0.15, 0]),
    ]),
  );
  // The bell itself: four twelve-sided frustums, each standing on the one above it, so the
  // waist and the flare are real geometry rather than a cone with a name.
  pivot.add(
    kit.merged("bell_body", mat.brass, [
      // A bell's profile is a narrow shoulder, a long slow waist and a hard flare at the
      // sound bow. A single even taper is a cone, and a cone is what the first cut shipped.
      place(kit.cyl(0.055, 0.088, 0.1, 12), [0, -0.27, 0]),
      place(kit.cyl(0.088, 0.118, 0.16, 12), [0, -0.4, 0]),
      place(kit.cyl(0.118, 0.185, 0.11, 12), [0, -0.535, 0]),
      place(kit.cyl(0.185, BELL_MOUTH_R, 0.055, 12), [0, -0.6175, 0]),
      place(kit.cyl(BELL_MOUTH_R, BELL_MOUTH_R * 0.97, 0.027, 12), [0, -0.6585, 0]),
    ]),
  );
  // Gudgeon straps: the ironwork that actually holds a bell to its headstock.
  pivot.add(
    kit.merged("bell_straps", mat.iron, [
      place(kit.box(0.05, 0.13, 0.11), [0.14, -0.055, 0]),
      place(kit.box(0.05, 0.13, 0.11), [-0.14, -0.055, 0]),
      place(kit.cyl(0.028, 0.028, POST_X * 2 + 0.14, 8), [0, 0, 0], [0, 0, Math.PI / 2]),
    ]),
  );

  // --- Rope --------------------------------------------------------------------------------
  // Coiled on the plinth: not attached to the bell, and honest about it. See the file header.
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
