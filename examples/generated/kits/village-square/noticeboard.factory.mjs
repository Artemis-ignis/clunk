/**
 * Village Square 09 — Parish Notice Board, with notices pinned to it.
 *
 * Reference measurements: a parish notice board is 1.2-1.5 m wide and 0.8-1.0 m tall in the
 * glazed area, its bottom rail at about 0.9 m so a standing reader's eye is level with the
 * middle of it, and it carries a pent or gabled hood 100-200 mm deep over the top. This is cut
 * to a 1.150 m board 0.860 m tall, its bottom rail at 0.900 m, under a 250 mm hood.
 *
 * THE NOTICES ARE 6 MM THICK
 * --------------------------
 * Five sheets, each a solid 6 mm slab standing on the board's face, pinned at a slight angle.
 * The kit's floor for any sheet is 4 mm: a zero-thickness card disappears edge-on, gathers
 * z-fighting against whatever it lies on, and is the single most common reason a low-poly
 * prop looks wrong in an engine that was not the one it was authored in. 6 mm of paper is
 * more paper than paper is, and it is what makes each notice read as pinned ON the board.
 *
 * Each sheet's back face sits exactly ON the board's front face, so no sheet is inside the
 * board and no sheet is floating in front of it.
 */
import { createKit, place, selectMaterials, summarize, wobble } from "./village-kit.mjs";

const POST_SIDE = 0.09;
/*
 * The posts stop AT the hood, and the hood sits on the board's own top rail.
 *
 * The first cut ran the posts to 1.980 and hung the hood there, 170 mm clear of a frame that
 * topped out at 1.810 — the six-angle sheet showed a band of daylight between the roof and
 * the thing it was supposed to be keeping dry. A pent hood on a notice board is fixed to the
 * board, not floated above it.
 */
const POST_TOP = 1.82;
const POST_X = 0.62;
/*
 * 1.144, so the panel stops 3 mm short of each post's inner face rather than butting it.
 *
 * A flush butt joint is the right way to build this and the wrong way to ship it: two solids
 * that share a face put the panel's corner vertices exactly ON the posts' surface, and
 * scripts/asset-geometry-audit.mjs's ray test counts a vertex on a face as a vertex inside
 * it — it reported half the panel inside the posts, and then reported the panel BURIED in
 * them. A 3 mm reveal is a shadow line a joiner would cut anyway, and it is unambiguous.
 */
const BOARD_W = 1.144;
const BOARD_H = 0.86;
const BOARD_BOTTOM = 0.9;
const BOARD_TOP = BOARD_BOTTOM + BOARD_H; // 1.76
const BOARD_T = 0.05;
const BOARD_FACE = BOARD_T / 2; // z of the front face
const FRAME_T = 0.035;
const FRAME_W = 0.06;
const PAPER_T = 0.006;
const HOOD_DEPTH = 0.25;

export function createVillageNoticeboard(THREE) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, ["woodFrame", "woodPlank", "woodPale", "roofTile", "iron", "stoneBody"]);

  const root = kit.group("village_noticeboard");
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "village-square",
    assetId: "village-square.noticeboard.m1",
    upAxis: "+Y",
    scaleMeters: 1,
    facing: "+Z",
    noticeThicknessMetres: PAPER_T,
  };

  // --- Posts and footings -------------------------------------------------------------
  const structure = kit.group("structure");
  root.add(structure);
  const footings = [];
  const posts = [];
  for (const side of [-1, 1]) {
    footings.push(place(kit.box(0.2, 0.1, 0.2), [side * POST_X, 0.05, 0]));
    posts.push(place(kit.beam(POST_SIDE, POST_SIDE, POST_TOP - 0.1), [side * POST_X, 0.1 + (POST_TOP - 0.1) / 2, 0], [Math.PI / 2, 0, 0]));
  }
  structure.add(kit.merged("noticeboard_footings", mat.stoneBody, footings));
  structure.add(kit.merged("noticeboard_posts", mat.woodFrame, posts));

  // --- Board -----------------------------------------------------------------------------
  // The panel spans between the posts and touches both of them, so it is carried rather than
  // suspended. It is deliberately the darker plank value: cream notices on a dark board is
  // the contrast that makes this object legible at storefront-card size.
  const boardGroup = kit.group("board");
  root.add(boardGroup);
  boardGroup.add(kit.solo("noticeboard_panel", mat.woodPlank, kit.box(BOARD_W, BOARD_H, BOARD_T), [0, BOARD_BOTTOM + BOARD_H / 2, 0]));

  /*
   * The frame is fixed to the BOARD and stays inside the posts' inner faces at +-0.575.
   *
   * The first cut ran the rails to +-0.605 and the stiles to +-0.597, both of which cross the
   * posts. The AABB geometry audit passed it; the MCP inspector's triangle-level check
   * reported a 20 mm intersection between `noticeboard_frame` and `noticeboard_posts`.
   */
  const frame = [];
  const frameZ = BOARD_FACE + FRAME_T / 2;
  const stileX = BOARD_W / 2 - FRAME_W / 2 - 0.003;
  frame.push(place(kit.beam(FRAME_T, FRAME_W, BOARD_W), [0, BOARD_TOP - FRAME_W / 2, frameZ], [0, Math.PI / 2, 0]));
  frame.push(place(kit.beam(FRAME_T, FRAME_W, BOARD_W), [0, BOARD_BOTTOM + FRAME_W / 2, frameZ], [0, Math.PI / 2, 0]));
  for (const side of [-1, 1]) {
    frame.push(
      place(kit.beam(FRAME_W, BOARD_H - FRAME_W * 2, FRAME_T), [side * stileX, BOARD_BOTTOM + BOARD_H / 2, frameZ]),
    );
  }
  boardGroup.add(kit.merged("noticeboard_frame", mat.woodFrame, frame));

  // --- Notices ----------------------------------------------------------------------------
  const notices = kit.group("notices");
  root.add(notices);
  const sheets = [];
  const pins = [];
  const LAYOUT = [
    { x: -0.36, y: 1.42, w: 0.26, h: 0.34 },
    { x: -0.03, y: 1.46, w: 0.22, h: 0.28 },
    { x: 0.33, y: 1.4, w: 0.28, h: 0.3 },
    { x: -0.25, y: 1.1, w: 0.24, h: 0.22 },
    { x: 0.22, y: 1.07, w: 0.3, h: 0.2 },
  ];
  for (const [index, sheet] of LAYOUT.entries()) {
    // A pinned notice is never square to its board. The tilt is a hash of the index, so the
    // same five notices hang the same way in every rebuild.
    const tilt = wobble(6100 + index * 13) * 0.055;
    // 1 mm proud of the board rather than flush against it, for the same reason the panel
    // stops short of the posts: a shared face reads as an intersection to a ray test.
    sheets.push(place(kit.box(sheet.w, sheet.h, PAPER_T), [sheet.x, sheet.y, BOARD_FACE + 0.001 + PAPER_T / 2], [0, 0, tilt]));
    pins.push(place(kit.cyl(0.008, 0.008, 0.014, 6), [sheet.x, sheet.y + sheet.h / 2 - 0.022, BOARD_FACE + 0.001 + PAPER_T + 0.006], [Math.PI / 2, 0, 0]));
  }
  notices.add(kit.merged("noticeboard_notices", mat.woodPale, sheets));
  notices.add(kit.merged("noticeboard_pins", mat.iron, pins));

  // --- Hood --------------------------------------------------------------------------------
  // A pent roof sloping forward over the notices, standing on the two posts.
  const hood = kit.group("hood");
  root.add(hood);
  /*
   * The hood's UNDERSIDE lands on the post tops; its thickness is added outward from there.
   *
   * Sizing the deck about its centre-plane instead buried half of it in the posts and in the
   * board's frame — the MCP inspector measured 82 mm into the posts and 35 mm into the frame,
   * and the AABB audit saw none of it.
   */
  const DECK_T = 0.04;
  // The slope is referenced to the posts FRONT face, not their back one. Referenced to the
  // back, the deck drops below the post top by the time it crosses to z = +0.045 and cuts
  // 30 mm into it — measured, after the first attempt at this fix, as a 75 mm intersection.
  const HOOD_BACK_Y = POST_TOP + (POST_SIDE / 2 + 0.03) * (0.1 / HOOD_DEPTH) + 0.002;
  const HOOD_FRONT_Y = HOOD_BACK_Y - 0.1;
  const hoodPitch = Math.atan2(HOOD_BACK_Y - HOOD_FRONT_Y, HOOD_DEPTH);
  const hoodLen = Math.hypot(HOOD_DEPTH, HOOD_BACK_Y - HOOD_FRONT_Y);
  const hoodW = POST_X * 2 + POST_SIDE + 0.06;
  const outward = [0, Math.cos(hoodPitch), Math.sin(hoodPitch)];
  const deckCentre = [
    0,
    (HOOD_BACK_Y + HOOD_FRONT_Y) / 2 + outward[1] * (DECK_T / 2),
    HOOD_DEPTH / 2 - 0.03 + outward[2] * (DECK_T / 2),
  ];
  hood.add(
    kit.merged("noticeboard_hood_deck", mat.woodFrame, [
      place(kit.box(hoodW, DECK_T, hoodLen), deckCentre, [hoodPitch, 0, 0]),
    ]),
  );
  /*
   * Two shingle courses lying on the deck. `s` runs 0 at the back edge to 1 at the front, and
   * every course is placed by walking that far down the deck's own axis and then stepping out
   * along the deck's own normal — the same way the well's roof is laid. Working in the deck's
   * axes rather than in world Y and Z is what keeps a course flat on the slope instead of
   * hovering over its lower half.
   */
  const downSlope = [0, -Math.sin(hoodPitch), Math.cos(hoodPitch)];
  const shingles = [];
  for (let course = 0; course < 2; course += 1) {
    // The up-slope course is the thicker one, so its lower edge steps proud of the course
    // below it and casts the line that says "shingles" rather than "one sloping board".
    const t = 0.028 + course * 0.016;
    const s = course === 0 ? 0.75 : 0.25;
    const along = (s - 0.5) * hoodLen;
    const out = DECK_T / 2 + t / 2;
    shingles.push(
      place(kit.box(hoodW, t, hoodLen / 2 + 0.03), [
        deckCentre[0],
        deckCentre[1] + downSlope[1] * along + outward[1] * out,
        deckCentre[2] + downSlope[2] * along + outward[2] * out,
      ], [hoodPitch, 0, 0]),
    );
  }
  hood.add(kit.merged("noticeboard_hood_shingles", mat.roofTile, shingles));

  root.userData.measured = summarize(THREE, root);
  return root;
}

export default createVillageNoticeboard;
