/**
 * Cozy Farm Set 01 — Market Stall.
 *
 * Timber-framed produce stall: four posts, a plank counter over a braced apron, a striped
 * canvas awning with a scalloped front edge, and four slatted crates whose contents are
 * modelled as distinguishable produce rather than coloured lumps.
 *
 * Measured footprint (metres): 2.30 W x 1.30 D x 2.23 H. Counter surface at y = 1.01.
 * Origin sits on the ground at the centre of the stall, +Z is the customer side, +Y is up.
 *
 * Silhouette contract — the parts that must survive at 10 m: the sloped striped awning with
 * its scallop fringe, the four crate mouths tilted toward the buyer, the counter line, the
 * X-braced apron, and the four feet. Everything else is a supporting read.
 */
import { createKit, place, selectMaterials, summarize } from "./farm-kit.mjs";

// --- Authored dimensions (metres) ------------------------------------------------------
const POST_FRONT_X = 1.02;
const POST_FRONT_Z = 0.44;
const POST_REAR_X = 1.06;
const POST_REAR_Z = -0.4;
const FOOT_TOP = 0.09;
const FRONT_RAIL_Y = 1.82;
const RIDGE_Y = 2.15;

// Awning plane: the canvas rests on the ridge beam top (2.20) and the front rail top (1.8625),
// then oversails 0.30 m past the rail. The pitch is shallow enough that a buyer standing at the
// counter still sees every crate mouth — a steeper roof looks better in isolation and hides the
// merchandise in use.
const AWNING_PITCH = 0.38156; // rad, ~21.9 degrees
const STRIPE_CENTER = [0, 2.02348, 0.08619];
const STRIPE_LENGTH = 1.16324;
const VALANCE_CENTER = [0, 1.78276, 0.68634]; // solid rim band closing the striped panels
const STRIPE_COUNT = 10;

// The canvas plane, as two unit vectors, so the fringe below is placed IN that plane's terms
// instead of by two hand-tuned world coordinates that cannot say what they mean.
const AWNING_UP = [0, Math.cos(AWNING_PITCH), Math.sin(AWNING_PITCH)]; // out of the canvas
const AWNING_FORWARD = [0, -Math.sin(AWNING_PITCH), Math.cos(AWNING_PITCH)]; // down the slope

/*
 * Where the fringe hangs.
 *
 * SCALLOP_DROP is the fix for the defect the storefront showed: the discs used to sit at
 * drop = 0, i.e. exactly IN the canvas plane, and both the disc and the rim band are 0.038 m
 * thick and centred on that plane. Their top faces and their bottom faces were therefore the
 * same two planes over 3,678 cm^2 (measured: 182 coplanar triangle pairs, 0.015 mm apart), so
 * the depth buffer had no winner and the garland flickered against the awning edge. Worse, it
 * was *readable from above*: the three-quarter top render showed ten green hexagons lying flat
 * on the roof with the cream rim band nowhere to be seen.
 *
 * A fringe hangs UNDER an awning. Dropping the discs 0.026 m along the canvas normal puts the
 * disc's top face 0.012 m below the band's top face — still 0.012 m of overlap holding it on,
 * so it is one joined object and not a floating decal, but with no shared plane anywhere and
 * nothing of it visible over the roof.
 */
const SCALLOP_ALONG = 0.051; // forward of the band centre, in-plane: keeps the tab hanging past the edge
const SCALLOP_DROP = 0.026; // below the canvas plane: 0.012 m of overlap, 0 mm of shared plane
const SCALLOP_CENTER = [
  0,
  VALANCE_CENTER[1] + AWNING_FORWARD[1] * SCALLOP_ALONG - AWNING_UP[1] * SCALLOP_DROP,
  VALANCE_CENTER[2] + AWNING_FORWARD[2] * SCALLOP_ALONG - AWNING_UP[2] * SCALLOP_DROP,
];
const STRIPE_PITCH = 0.242;
const STRIPE_WIDTH = 0.238;
const SCALLOP_RADIUS = 0.11; // < STRIPE_PITCH/2, so a notch stays open between neighbours

const CRATE_TILT = 0.2; // rad, tips each crate mouth toward the customer
const CRATE_Y = 1.1796; // places the tilted front-bottom edge exactly on the counter
const CRATE_Z = -0.02;
const CRATE_X = [-0.885, -0.295, 0.295, 0.885];

export function createMarketStall(THREE) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, [
    "woodFrame",
    "woodPlank",
    "woodCrate",
    "canvasCream",
    "canvasGreen",
    "iron",
    "carrot",
    "leaf",
    "tomato",
    "cabbage",
    "potato",
  ]);

  const root = kit.group("market_stall");
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "cozy-farm-set",
    assetId: "cozy-farm.market-stall.m1",
    upAxis: "+Y",
    scaleMeters: 1,
    // Crate slots are addressable groups, not empty markers: swap the produce child to
    // restock the stall without touching the frame.
    sockets: [
      "crate_slot_carrots",
      "crate_slot_cabbages",
      "crate_slot_tomatoes",
      "crate_slot_potatoes",
    ],
  };

  // --- Timber frame -------------------------------------------------------------------
  const frame = kit.group("stall_frame");
  root.add(frame);

  const timber = [];
  for (const side of [-1, 1]) {
    // Feet first: broad blocks so the stall sits on the ground instead of hovering on posts.
    timber.push(place(kit.box(0.2, FOOT_TOP, 0.2), [side * POST_FRONT_X, FOOT_TOP / 2, POST_FRONT_Z]));
    timber.push(place(kit.box(0.22, FOOT_TOP, 0.22), [side * POST_REAR_X, FOOT_TOP / 2, POST_REAR_Z]));
    // Front posts stop at the awning front rail; rear posts carry the ridge.
    timber.push(place(kit.box(0.11, 1.7725, 0.11), [side * POST_FRONT_X, 0.97625, POST_FRONT_Z]));
    timber.push(place(kit.box(0.13, 2.11, 0.13), [side * POST_REAR_X, 1.145, POST_REAR_Z]));
    // Knee braces — the joint detail that makes the awning read as carpentry, not a floating lid.
    timber.push(place(kit.box(0.456, 0.07, 0.07), [side * 0.84, 1.64, POST_FRONT_Z], [0, 0, side * -0.66104]));
    timber.push(place(kit.box(0.456, 0.07, 0.07), [side * 0.88, 1.96, POST_REAR_Z], [0, 0, side * -0.66104]));
    // Side stretcher down at ankle height, tying front post to rear post.
    timber.push(place(kit.box(0.075, 0.075, 0.8), [side * POST_FRONT_X, 0.22, 0.02]));
  }
  timber.push(place(kit.box(2.44, 0.1, 0.1), [0, RIDGE_Y, POST_REAR_Z])); // ridge beam
  timber.push(place(kit.box(2.34, 0.085, 0.085), [0, FRONT_RAIL_Y, POST_FRONT_Z])); // awning front rail
  timber.push(place(kit.box(2.08, 0.075, 0.075), [0, 0.22, POST_REAR_Z])); // rear stretcher
  frame.add(kit.merged("frame_timber", mat.woodFrame, timber));

  // --- Counter ------------------------------------------------------------------------
  const counter = kit.group("counter");
  root.add(counter);

  /*
   * COUNTER_FACE is where the counter's front stops, and it is 4 mm BEHIND the front posts'
   * front face (POST_FRONT_Z + 0.055 = 0.495).
   *
   * It used to be 0.495 exactly. The post, the counter's front rail and the front deck board
   * all presented an outward face on that one plane, and where they overlap on screen — 121 cm^2
   * of post against light `woodPlank` deck, 220 cm^2 of post against dark `woodFrame` rail — the
   * depth buffer had two equally valid answers for the same pixel. Two of those three parts are
   * different colours, so the tie is not academic: it is a band that changes tone as the camera
   * moves, at the counter edge, at eye height, on the face of the model the storefront shows.
   *
   * Four millimetres is enough to settle every one of those ties, and it reads better besides:
   * a post should stand a little proud of the counter it carries.
   */
  const COUNTER_FACE = POST_FRONT_Z + 0.055 - 0.004;

  const rails = [
    // - 0.045, so the rail's own face lands 5 mm BEHIND the deck edge rather than flush with it:
    // the two parts overlap for the 2.5 mm the deck board sits on the rail, and flush there was
    // 55 cm^2 of dark rail tied with mid deck along the whole 2.2 m counter edge. A deck
    // oversails the frame it rests on anyway.
    place(kit.box(2.2, 0.1, 0.08), [0, 0.91, COUNTER_FACE - 0.045]),
    place(kit.box(2.24, 0.1, 0.08), [0, 0.91, -0.415]),
    place(kit.box(0.08, 0.1, 0.88), [-POST_FRONT_X, 0.91, 0.02]),
    place(kit.box(0.08, 0.1, 0.88), [POST_FRONT_X, 0.91, 0.02]),
  ];
  counter.add(kit.merged("counter_frame_rails", mat.woodFrame, rails));

  // Six loose boards with real gaps between them — the plank line is geometry, not a texture.
  // The run is laid out from the FRONT board back, so the deck edge is tied to COUNTER_FACE
  // and cannot drift onto the post plane again.
  const deck = [];
  for (let index = 0; index < 6; index += 1) {
    deck.push(place(kit.box(2.3, 0.055, 0.15), [0, 0.985, COUNTER_FACE - 0.075 - index * 0.168]));
  }
  counter.add(kit.merged("counter_deck_planks", mat.woodPlank, deck));

  // The apron is nine upright boards with real seams between them, not one painted panel.
  // A thin backing closes the gaps so the seams read as shadow lines instead of holes.
  const apron = [place(kit.box(2.08, 0.6, 0.018), [0, 0.57, 0.425])];
  for (let index = 0; index < 9; index += 1) {
    apron.push(place(kit.box(0.222, 0.6, 0.04), [-0.92 + index * 0.23, 0.57, 0.448]));
  }
  apron.push(place(kit.box(0.09, 0.6, 0.045), [0, 0.57, 0.472])); // centre stile
  apron.push(place(kit.box(2.08, 0.07, 0.05), [0, 0.885, 0.468])); // top rail
  apron.push(place(kit.box(2.08, 0.07, 0.05), [0, 0.27, 0.468])); // bottom rail
  counter.add(kit.merged("counter_front_apron", mat.woodPlank, apron));

  // z 0.469, not 0.472. At 0.472 the braces' front face sat 1 mm behind the apron's top and
  // bottom rails — same-facing, 131 cm^2 of overlap where the braces run under the rails, and
  // dark `woodFrame` against mid `woodPlank`, so the tie showed as a changing tone. 3 mm back
  // settles it; the braces still stand 21 mm proud of the boarding.
  const braces = [];
  for (const bay of [-0.505, 0.505]) {
    braces.push(place(kit.box(1.06, 0.08, 0.04), [bay, 0.57, 0.469], [0, 0, 0.5471]));
    braces.push(place(kit.box(1.06, 0.08, 0.04), [bay, 0.57, 0.469], [0, 0, -0.5471]));
  }
  counter.add(kit.merged("counter_x_braces", mat.woodFrame, braces));

  counter.add(
    kit.merged("counter_side_panels", mat.woodPlank, [
      place(kit.box(0.04, 0.6, 0.82), [-1.045, 0.57, 0.02]),
      place(kit.box(0.04, 0.6, 0.82), [1.045, 0.57, 0.02]),
    ]),
  );

  // Wrought straps folded around each post corner where the counter frame lands. Two faces per
  // front post so the bracket reads as a wrap rather than a black sticker; the rear posts, which
  // a buyer never stands beside, carry the cheap single-face version.
  const straps = [];
  for (const side of [-1, 1]) {
    straps.push(place(kit.box(0.13, 0.14, 0.022), [side * POST_FRONT_X, 0.84, 0.5055]));
    straps.push(place(kit.box(0.022, 0.14, 0.13), [side * 1.086, 0.84, POST_FRONT_Z]));
    straps.push(place(kit.box(0.15, 0.14, 0.022), [side * POST_REAR_X, 0.84, -0.4765]));
  }
  counter.add(kit.merged("frame_iron_straps", mat.iron, straps));

  // --- Awning -------------------------------------------------------------------------
  const awning = kit.group("awning");
  root.add(awning);

  const stripeGeometry = kit.box(STRIPE_WIDTH, 0.035, STRIPE_LENGTH);
  // Six radial segments, not eight: the valance band swallows everything inside a 0.018 m
  // radius of the disc centre, so the two extra facets would have been spent entirely on the
  // buried half. The hanging tab keeps the same three-facet arc and the asset lands inside
  // the 1,200-2,500 triangle budget.
  const scallopGeometry = kit.cyl(SCALLOP_RADIUS, SCALLOP_RADIUS, 0.038, 6);
  const stripes = { cream: [], green: [] };
  const scallops = [];
  for (let index = 0; index < STRIPE_COUNT; index += 1) {
    const x = -((STRIPE_COUNT - 1) / 2) * STRIPE_PITCH + index * STRIPE_PITCH;
    const tone = index % 2 === 0 ? "cream" : "green";
    stripes[tone].push(place(stripeGeometry, [x, STRIPE_CENTER[1], STRIPE_CENTER[2]], [AWNING_PITCH, 0, 0]));
    // One disc per stripe, hanging UNDER the rim band (see SCALLOP_DROP) and parallel to the
    // canvas. Its upper half is swallowed by the band, so only a clean semicircular tab shows —
    // a scalloped fringe built from geometry, readable in silhouette from any angle, and never
    // visible over the top of the roof.
    scallops.push(place(scallopGeometry, [x, SCALLOP_CENTER[1], SCALLOP_CENTER[2]], [AWNING_PITCH, 0, 0]));
  }
  awning.add(kit.merged("awning_canvas_cream", mat.canvasCream, stripes.cream));
  awning.add(kit.merged("awning_canvas_green", mat.canvasGreen, stripes.green));
  // The rim band is the trick that makes the stripes read as one awning instead of ten planks:
  // it closes every stripe end on a single straight line, and the fringe hangs off that line.
  awning.add(
    kit.merged("awning_valance_band", mat.canvasCream, [
      place(kit.box(2.42, 0.038, 0.13), [0, VALANCE_CENTER[1], VALANCE_CENTER[2]], [AWNING_PITCH, 0, 0]),
    ]),
  );
  awning.add(kit.merged("awning_scallop_fringe", mat.canvasGreen, scallops));

  // --- Hanging signboard ---------------------------------------------------------------
  const sign = kit.group("signboard");
  root.add(sign);
  sign.add(
    kit.merged("sign_hanger_rods", mat.iron, [
      place(kit.box(0.03, 0.19, 0.03), [-0.27, 1.6875, POST_FRONT_Z]),
      place(kit.box(0.03, 0.19, 0.03), [0.27, 1.6875, POST_FRONT_Z]),
    ]),
  );
  sign.add(kit.solo("sign_board", mat.woodPlank, kit.box(0.76, 0.24, 0.05), [0, 1.49, POST_FRONT_Z]));
  sign.add(kit.solo("sign_face", mat.canvasCream, kit.box(0.64, 0.155, 0.014), [0, 1.49, 0.472]));
  const lettering = [];
  for (const x of [-0.18, 0, 0.18]) {
    lettering.push(place(kit.box(0.1, 0.05, 0.012), [x, 1.492, 0.484]));
  }
  sign.add(kit.merged("sign_lettering", mat.leaf, lettering));

  // --- Produce display -----------------------------------------------------------------
  const display = kit.group("produce_display");
  root.add(display);

  const risers = [];
  for (const x of CRATE_X) {
    risers.push(place(kit.box(0.44, 0.082, 0.115), [x, 1.0535, -0.2418]));
  }
  display.add(kit.merged("crate_risers", mat.woodFrame, risers));

  const crateShell = () => [
    // corner stiles
    place(kit.box(0.042, 0.26, 0.042), [-0.229, 0, -0.179]),
    place(kit.box(0.042, 0.26, 0.042), [0.229, 0, -0.179]),
    place(kit.box(0.042, 0.26, 0.042), [-0.229, 0, 0.179]),
    place(kit.box(0.042, 0.26, 0.042), [0.229, 0, 0.179]),
    // front and back slats with an open gap between them
    place(kit.box(0.5, 0.075, 0.026), [0, -0.082, 0.186]),
    place(kit.box(0.5, 0.075, 0.026), [0, 0.078, 0.186]),
    place(kit.box(0.5, 0.075, 0.026), [0, -0.082, -0.186]),
    place(kit.box(0.5, 0.075, 0.026), [0, 0.078, -0.186]),
    // side slats
    place(kit.box(0.024, 0.075, 0.4), [-0.238, -0.002, 0]),
    place(kit.box(0.024, 0.075, 0.4), [0.238, -0.002, 0]),
    // floor
    place(kit.box(0.46, 0.024, 0.36), [0, -0.118, 0]),
  ];

  const crateSlot = (name, index) => {
    const slot = kit.group(name, [CRATE_X[index], CRATE_Y, CRATE_Z], [CRATE_TILT, 0, 0]);
    slot.userData = { socket: name, accepts: "produce", tiltRadians: CRATE_TILT };
    slot.add(kit.merged(`${name}_shell`, mat.woodCrate, crateShell()));
    // Chalked price board wedged INTO the upper front slat — the small human sign that a crate
    // is stock for sale rather than a prop box. It used to sit at z = 0.207, and the slat face
    // is at z = 0.199: the board hung 2 mm off the crate with daylight behind it. At 0.199 it
    // bites 6 mm into the slat, which is what "wedged" was always supposed to mean.
    slot.add(kit.solo(`${name}_price_tag`, mat.canvasCream, kit.box(0.12, 0.075, 0.012), [0.14, 0.09, 0.199], [0, 0, 0.07]));
    display.add(slot);
    return slot;
  };

  // Every crate is filled ABOVE its rim. A crate whose contents sit below the slats reads as an
  // empty box with something at the bottom; heaping the produce over the edge is what makes the
  // stall look stocked from across the street.
  //
  // Carrots — tapered cones laid tip-to-back so the shoulders and greens face the buyer.
  const carrotSlot = crateSlot("crate_slot_carrots", 0);
  const carrotGeometry = kit.cone(0.04, 0.185, 6);
  const carrotTopGeometry = kit.cone(0.028, 0.09, 5);
  const carrots = [];
  const carrotTops = [];
  const carrotLayout = [
    [-0.19, -0.04, 0.02, -0.12], [-0.114, -0.04, -0.01, 0.1], [-0.038, -0.04, 0.03, -0.08],
    [0.038, -0.04, -0.02, 0.14], [0.114, -0.04, 0.02, -0.1], [0.19, -0.04, -0.01, 0.12],
    [-0.076, 0.045, 0.0, 0.18], [0.076, 0.045, 0.01, -0.16],
  ];
  for (const [x, y, z, roll] of carrotLayout) {
    carrots.push(place(carrotGeometry, [x, y, z], [-1.3, 0, roll]));
    carrotTops.push(place(carrotTopGeometry, [x, y + 0.012, z + 0.115], [1.0, 0, roll * 1.6]));
  }
  carrotSlot.add(kit.merged("produce_carrots", mat.carrot, carrots));
  carrotSlot.add(kit.merged("produce_carrot_tops", mat.leaf, carrotTops));

  // Cabbages — squat spheres, big enough that the crate reads as full at a distance. Four in the
  // base course and one riding on the pile, which is what makes it a heap and not a grid.
  const cabbageSlot = crateSlot("crate_slot_cabbages", 1);
  const cabbageGeometry = kit.blob(0.098, 1, 0.86, 1);
  const cabbages = [];
  for (const [x, z] of [[-0.105, -0.092], [0.105, -0.092], [-0.105, 0.092], [0.105, 0.092]]) {
    cabbages.push(place(cabbageGeometry, [x, 0.02, z], [0, x * 3, 0]));
  }
  cabbages.push(place(cabbageGeometry, [0.0, 0.105, 0.0], [0.12, 0.9, 0]));
  cabbageSlot.add(kit.merged("produce_cabbages", mat.cabbage, cabbages));
  cabbageSlot.add(
    kit.merged("produce_cabbage_leaves", mat.leaf, [
      place(kit.blob(0.055, 1.5, 0.38, 1.5), [-0.055, -0.04, 0.095], [0, 0.5, 0.1]),
      place(kit.blob(0.055, 1.5, 0.38, 1.5), [0.06, -0.04, -0.085], [0, -0.7, -0.1]),
      place(kit.blob(0.05, 1.5, 0.38, 1.5), [0.0, 0.055, 0.118], [0.2, 0.2, 0]),
    ]),
  );

  // Tomatoes — smaller and rounder than the cabbages, stacked into a second course.
  const tomatoSlot = crateSlot("crate_slot_tomatoes", 2);
  const tomatoGeometry = kit.blob(0.057);
  const tomatoes = [];
  const tomatoStems = [];
  for (const [x, z] of [
    [-0.15, -0.09], [-0.05, -0.09], [0.05, -0.09], [0.15, -0.09],
    [-0.15, 0.09], [-0.05, 0.09], [0.05, 0.09], [0.15, 0.09],
  ]) {
    tomatoes.push(place(tomatoGeometry, [x, -0.03, z], [0, x * 5, 0]));
  }
  const tomatoCrown = [[-0.1, 0.0], [0.02, -0.02], [0.13, 0.03]];
  for (const [x, z] of tomatoCrown) {
    tomatoes.push(place(tomatoGeometry, [x, 0.075, z], [0, x * 7, 0]));
    tomatoStems.push(place(kit.box(0.02, 0.018, 0.02), [x, 0.128, z]));
  }
  tomatoSlot.add(kit.merged("produce_tomatoes", mat.tomato, tomatoes));
  tomatoSlot.add(kit.merged("produce_tomato_stems", mat.leaf, tomatoStems));

  // Potatoes — the only elongated produce in the set, so the fourth crate never reads as
  // a repeat of the tomato crate. The ellipsoid is baked into geometry, never node scale.
  const potatoSlot = crateSlot("crate_slot_potatoes", 3);
  const potatoGeometry = kit.blob(0.066, 1.3, 0.85, 0.95);
  const potatoes = [];
  const potatoLayout = [
    [-0.17, -0.02, -0.09, 0.3], [-0.06, -0.02, -0.1, -0.4], [0.06, -0.02, -0.085, 0.8],
    [0.17, -0.02, -0.095, 1.1], [-0.13, -0.02, 0.085, 0.1], [0.0, -0.02, 0.095, -0.7],
    [-0.05, 0.075, 0.0, 1.4], [0.11, 0.075, 0.02, -1.0],
  ];
  for (const [x, y, z, spin] of potatoLayout) {
    potatoes.push(place(potatoGeometry, [x, y, z], [0.12, spin, 0.1]));
  }
  potatoSlot.add(kit.merged("produce_potatoes", mat.potato, potatoes));

  root.userData.measured = summarize(THREE, root);
  return root;
}

export default createMarketStall;
