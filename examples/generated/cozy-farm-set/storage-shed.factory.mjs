/**
 * Cozy Farm Set 02 — Storage Shed.
 *
 * A gable-front timber shed on stone piers: lap-boarded walls whose every course is real
 * geometry, a stepped tile roof, a ledged-and-braced door on a `door_pivot` socket, a framed
 * window with a shed-water sill, and a louvered gable vent.
 *
 * Measured footprint (metres): 2.49 W x 2.09 D x 2.93 H. Walls 2.10 x 1.70, eaves at 2.16,
 * ridge at 2.76. Origin sits on the ground at the centre of the shed, +Z is the door side.
 *
 * Silhouette contract — what must survive at 10 m: the gable-front roof with its stepped tile
 * courses and barge boards, the plank door with its diagonal brace, the horizontal lap-siding
 * shadow lines, the windows, and the shed lifted clear of the ground on stone piers.
 *
 * Every elevation carries something. The rear gable used to be the exception — siding and
 * corner boards and nothing else — and since the storefront key light never touches a -Z face,
 * even the siding's own lap step went to 19/255 of contrast and the back rendered as one flat
 * sheet. It now carries a window, a louvered vent and a water table, all mirrored from members
 * this shed already had.
 *
 * Construction rules inherited from the series kit: no node ever carries scale, no part floats
 * (every element lands on the piers, the sill, the sheathing or the deck), and the interior is
 * a closed dark box so an opened door does not reveal a hollow shell.
 *
 * The door is a real moving part and the file carries its motion: `door_pivot` sits on the
 * hinge line and the factory bakes the `open` clip onto it, the same keys the template library
 * uses for this door, so a buyer gets the swing and not just a socket to guess at.
 */
import { createKit, place, selectMaterials, summarize } from "./farm-kit.mjs";

// --- Carcass (metres) -------------------------------------------------------------------
const HALF_W = 1.05; // outer face of the siding, X
const HALF_D = 0.85; // outer face of the siding, Z
/*
 * Structural shell the siding is nailed to.
 *
 * These two numbers have to keep the shell *behind* the tilted siding, and the first cut did
 * not. A board is 0.03 thick, 0.255 tall and leans out by BOARD_TILT, so its inner edge reaches
 * 0.015*cos(0.11) + 0.1275*sin(0.11) = 0.029 m in from its nominal plane at 0.835 — that is
 * 0.806 from the centre. The shell panels are 0.04 thick, so their outer face sat at 0.84 and
 * 1.04: a third of a centimetre *inside* every board. Two nearly parallel surfaces crossing at a
 * shallow angle is exactly what a depth buffer cannot resolve, and the rear wall came out
 * carrying a stack of black wedges, one per course. Measured before the fix by
 * scripts/dogfood-intersections.mjs: wall_sheathing and wall_lap_siding shared 55 crossing
 * triangles with 49.8% of one surface inside the other.
 *
 * 0.975 and 0.775 put the shell's outer face at 0.995 and 0.795, about 11 mm clear of the
 * boards. Everything else in the shell is derived from them so the clearance cannot be lost by
 * editing one number and not another.
 */
const SHEATH_W = 0.975;
const SHEATH_D = 0.775;
const SILL_TOP = 0.26; // siding and door start here; below is pier + sill + skirt
const PLATE_Y = 2.1; // top of the walls
/*
 * The two members that lap the doorway. The sill beam runs across the opening at the bottom
 * and the lintel across the top, and both used to bury the leaf's edge inside themselves —
 * 10 mm of the leaf's head in the lintel, 4.5 mm of its foot in the sill beam. A door that
 * turns about a vertical axis never changes height, so those laps are not clearance, they are
 * the door welded to its own frame. The leaf below stops short of both.
 */
const SILL_BEAM_Y = 0.22;
const SILL_BEAM_H = 0.12;
const SILL_BEAM_TOP = SILL_BEAM_Y + SILL_BEAM_H / 2; // 0.28
const LINTEL_Y = PLATE_Y + 0.01;
const LINTEL_H = 0.16;
const LINTEL_SOFFIT = LINTEL_Y - LINTEL_H / 2; // 2.03

// --- Lap siding -------------------------------------------------------------------------
// Eight courses of real boards. Each board is tilted so its lower edge stands proud of the
// course below: that is what casts the horizontal shadow lines this asset uses instead of a
// normal map. Board height exceeds the pitch, so the laps never open into gaps.
const COURSES = 8;
const COURSE_PITCH = 0.23;
const BOARD_H = 0.255;
const BOARD_T = 0.03;
// Each board leans out by this much at its lower edge, which is what turns the courses into a
// real 0.028 m lap step. Tuned by looking: 0.07 rad flattens out under the elevated farm camera
// the style bible specifies, and 0.13 rad drives the shaded undersides into hard wedges.
const BOARD_TILT = 0.11;

// --- Doorway ----------------------------------------------------------------------------
const DOOR_HALF = 0.45; // opening half-width
const DOOR_W = 0.88;
const DOOR_H = PLATE_Y - SILL_TOP; // 1.84 m clear opening
const JAMB_X = 0.485;
/*
 * The leaf and its hinge line.
 *
 * The 2026-09-05 mechanism audit measured two things here. The hinge node sat on z = 0.845,
 * the leaf's INNER face, so opening the door drove the leaf's outer 35.5 mm through the frame
 * instead of swinging it clear; and the leaf's hinge edge stood 10 mm off the jamb, which is
 * a slot, not a joint. An outward-opening door hung on strap hinges turns about the line where
 * the leaf's OUTER face meets the jamb — that is where the straps and their knuckles are, at
 * z 0.8625..0.926 — so that is where door_pivot goes.
 *
 * Everything under the pivot is still authored in the frame the leaf was drawn in (x from the
 * jamb's inner face, z from the leaf's inner face) and stepped back by these two numbers at the
 * end, exactly as the fence gate does. World positions do not move; the axis does.
 */
const DOOR_LEAF_GAP = 0.005; // leaf hinge edge to jamb face
const DOOR_LEAF_T = 0.035;
const DOOR_LEAF_Z = 0.018; // leaf-local z of the planks' mid-plane
const HINGE_DX = DOOR_LEAF_GAP;
const HINGE_DZ = DOOR_LEAF_Z + DOOR_LEAF_T / 2;
/*
 * Four planks and three 9 mm shadow gaps, filling a DOOR_W leaf that starts DOOR_LEAF_GAP off
 * the hinge jamb and ends where it always did (leaf-local 0.885, 15 mm off the latch jamb).
 * The planks grew 1.25 mm each to close the hinge slot; nothing else about the leaf moved.
 */
const DOOR_PLANK_COUNT = 4;
const DOOR_PLANK_GAP = 0.009;
const DOOR_PLANK_W = (DOOR_W - (DOOR_PLANK_COUNT - 1) * DOOR_PLANK_GAP) / DOOR_PLANK_COUNT;
const DOOR_PLANK_PITCH = DOOR_PLANK_W + DOOR_PLANK_GAP;
/*
 * 3 mm of air at head and foot. The leaf now runs from just above the sill beam to just under
 * the lintel soffit instead of into both, and neither opening it leaves is a hole: the sill
 * beam still closes the foot from y 0.28 down and the lintel still closes the head from 2.03
 * up, both across the full z of the wall. Leaf-local, so y = 0 is SILL_TOP.
 */
const DOOR_LEAF_SWING_GAP = 0.003;
const DOOR_LEAF_Y0 = SILL_BEAM_TOP + DOOR_LEAF_SWING_GAP - SILL_TOP;
const DOOR_LEAF_H = LINTEL_SOFFIT - DOOR_LEAF_SWING_GAP - (SILL_BEAM_TOP + DOOR_LEAF_SWING_GAP);
/*
 * The published motion of the leaf: shut, 105 degrees open, held, shut again in 3.6 s. These
 * are the very keys scripts/template-library/templates.mjs bakes for `storage-shed-door`, so
 * the model on sale and every colourway the library bakes from this factory move the same way.
 * The name is the one the product page already publishes for this slug
 * (app/api/_lib/listing-variants.ts LISTING_CLIPS: "open").
 */
const DOOR_CLIP_NAME = "open";
const DOOR_CLIP_KEYS = [
  { time: 0, degrees: 0 },
  { time: 1.4, degrees: -105 },
  { time: 2.2, degrees: -105 },
  { time: 3.6, degrees: 0 },
];

// --- Roof -------------------------------------------------------------------------------
const RIDGE_Y = 2.76;
const EAVE_Y = 2.16;
const EAVE_X = 1.24; // 0.19 m overhang past the wall
const ROOF_HALF_Z = 1.02; // 0.17 m overhang past the gable walls
const RISE = RIDGE_Y - EAVE_Y;
const ROOF_ANGLE = Math.atan2(RISE, EAVE_X);
const SLOPE_DIR = [Math.cos(ROOF_ANGLE), -Math.sin(ROOF_ANGLE)]; // ridge -> eave, in XY
const SLOPE_NORMAL = [Math.sin(ROOF_ANGLE), Math.cos(ROOF_ANGLE)]; // out of the roof plane
const DECK_T = 0.06;
const TILE_COURSES = 5;
const TILE_PITCH = 0.2755;
const TILE_LEN = 0.34;
const TILE_BASE_T = 0.042;
const TILE_STEP = 0.02; // each course up-slope is this much thicker, so the steps read

// Vertical drop of the roof underside per metre of X, plus the deck's own vertical thickness.
const UNDERSIDE_SLOPE = RISE / EAVE_X;
const UNDERSIDE_AT_RIDGE = RIDGE_Y - DECK_T / Math.cos(ROOF_ANGLE);

/** Point on the roof plane: `along` metres down-slope from the ridge, `out` metres clear of it. */
function roofPoint(along, out, side) {
  return [
    side * (SLOPE_DIR[0] * along + SLOPE_NORMAL[0] * out),
    RIDGE_Y + SLOPE_DIR[1] * along + SLOPE_NORMAL[1] * out,
  ];
}

export function createStorageShed(THREE) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, [
    "woodFrame",
    "woodPlank",
    "woodCrate",
    "roofTile",
    "roofTileDark",
    "stone",
    "iron",
    "brass",
    "glass",
  ]);

  const root = kit.group("storage_shed");
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "cozy-farm-set",
    assetId: "cozy-farm.storage-shed.m1",
    upAxis: "+Y",
    scaleMeters: 1,
    sockets: ["door_pivot"],
    socketNotes: {
      door_pivot:
        "Hinge node on the hinge line of the left jamb — the leaf's outer face, x -0.445, z 0.8805. Rotate about +Y; negative angles swing the leaf outward (+Z). Zero is shut and latched; the open clip plays shut → 105° open → held → shut in 3.6 s.",
    },
    clips: [DOOR_CLIP_NAME],
  };

  // --- Piers and sill -------------------------------------------------------------------
  // The shed stands on stone, not on the dirt. Six piers, a dark skirt closing the crawl
  // space so the gap never reads as a hole, and a sill beam tying it all together.
  const foundation = kit.group("foundation");
  root.add(foundation);

  const piers = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      piers.push(place(kit.box(0.3, 0.22, 0.3), [sx * 0.92, 0.11, sz * 0.72]));
    }
    /*
     * 0.252 x 0.196, not 0.26 x 0.2, and 4 mm lower. Both numbers are clearance, not styling:
     *   - the old top face landed on y = 0.200, which is EXACTLY the base skirt's top face, and
     *     both point up: 336 cm^2 of stone tied with wood at 0.000 mm;
     *   - the old outer face landed on x = +-1.05, which is EXACTLY the sill beam's outer face,
     *     and both point outward: a further 224 cm^2.
     * Stone against timber is a colour change, so either tie shows as a band that flips tone as
     * the camera moves. 4 mm of clearance on each settles both and the pier is still buried
     * 130 mm inside the skirt.
     */
    piers.push(place(kit.box(0.252, 0.196, 0.28), [sx * 0.92, 0.098, 0]));
  }
  // Doorstep: the one stone a player actually walks on, so it is wider and lower.
  piers.push(place(kit.box(1.1, 0.14, 0.36), [0, 0.07, 0.98]));
  foundation.add(kit.merged("foundation_piers", mat.stone, piers));

  foundation.add(
    kit.merged("base_skirt", mat.woodFrame, [
      place(kit.box(1.98, 0.16, 0.06), [0, 0.12, 0.78]),
      place(kit.box(1.98, 0.16, 0.06), [0, 0.12, -0.78]),
      place(kit.box(0.06, 0.16, 1.52), [0.96, 0.12, 0]),
      place(kit.box(0.06, 0.16, 1.52), [-0.96, 0.12, 0]),
    ]),
  );

  foundation.add(
    kit.merged("sill_beam", mat.woodFrame, [
      place(kit.box(2.1, SILL_BEAM_H, 0.1), [0, SILL_BEAM_Y, 0.8]),
      place(kit.box(2.1, SILL_BEAM_H, 0.1), [0, SILL_BEAM_Y, -0.8]),
      place(kit.box(0.1, SILL_BEAM_H, 1.6), [1.0, SILL_BEAM_Y, 0]),
      place(kit.box(0.1, SILL_BEAM_H, 1.6), [-1.0, SILL_BEAM_Y, 0]),
    ]),
  );

  // --- Structural shell -----------------------------------------------------------------
  // Solid sheathing behind the siding. It is what makes the shed a closed volume: open the
  // door and you see a dark boarded interior, not the inside of a paper cutout.
  const carcass = kit.group("carcass");
  root.add(carcass);

  const shell = [
    place(kit.box(SHEATH_W * 2, 0.04, SHEATH_D * 2), [0, 0.24, 0]), // floor
    place(kit.box(SHEATH_W * 2, PLATE_Y - SILL_TOP, 0.04), [0, (PLATE_Y + SILL_TOP) / 2, -SHEATH_D]),
    place(kit.box(0.04, PLATE_Y - SILL_TOP, SHEATH_D * 2), [SHEATH_W, (PLATE_Y + SILL_TOP) / 2, 0]),
    place(kit.box(0.04, PLATE_Y - SILL_TOP, SHEATH_D * 2), [-SHEATH_W, (PLATE_Y + SILL_TOP) / 2, 0]),
  ];
  // The front wall is interrupted by the doorway, so it is two strips rather than one panel.
  for (const side of [-1, 1]) {
    shell.push(
      place(kit.box(SHEATH_W - DOOR_HALF, PLATE_Y - SILL_TOP, 0.04), [
        side * ((SHEATH_W + DOOR_HALF) / 2),
        (PLATE_Y + SILL_TOP) / 2,
        SHEATH_D,
      ]),
    );
  }
  carcass.add(kit.merged("wall_sheathing", mat.woodFrame, shell));

  // Lap siding. Forty boards, one merged mesh: the courses are the shed's dominant surface
  // read, and paying forty draw calls for them would be the wrong trade.
  const siding = [];
  for (let course = 0; course < COURSES; course += 1) {
    const y = SILL_TOP + course * COURSE_PITCH + BOARD_H / 2;
    siding.push(place(kit.box(2.1, BOARD_H, BOARD_T), [0, y, -(HALF_D - BOARD_T / 2)], [BOARD_TILT, 0, 0]));
    for (const side of [-1, 1]) {
      siding.push(
        place(kit.box(BOARD_T, BOARD_H, 1.7), [side * (HALF_W - BOARD_T / 2), y, 0], [0, 0, side * BOARD_TILT]),
      );
      siding.push(
        place(kit.box(HALF_W - JAMB_X, BOARD_H, BOARD_T), [
          side * ((HALF_W + JAMB_X) / 2),
          y,
          HALF_D - BOARD_T / 2,
        ], [-BOARD_TILT, 0, 0]),
      );
    }
  }
  carcass.add(kit.merged("wall_lap_siding", mat.woodPlank, siding));

  // Corner boards cover the four places where two courses of siding butt into each other.
  const corners = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      corners.push(place(kit.box(0.1, 1.86, 0.1), [sx * 1.03, SILL_TOP + 0.93, sz * 0.83]));
    }
  }
  // Frieze board along each eave, closing the wedge between the wall top and the roof underside.
  // Its top edge is sized to bury itself INSIDE the deck at both of its own X edges: any taller
  // and it punches out through the tiles, any shorter and daylight shows over the wall.
  for (const side of [-1, 1]) {
    corners.push(place(kit.box(0.075, 0.13, 1.72), [side * 1.045, 2.15, 0]));
  }
  /*
   * Water table across the REAR gable, where the siding stops and the gable boarding starts.
   *
   * The other three elevations already carry a member on that line — the two eaves have the
   * frieze board above, the front has the door lintel at 2.11 — and the back had nothing, so
   * the top course of siding ran straight into the first gable board with no joint. It also
   * had nothing that could catch the storefront key at all: the key sits at (0.52, 0.74, 0.42),
   * so no -Z surface receives any of it and the 28 mm lap step on the rear boards renders at
   * 53/255 against 34/255 — present in the geometry, invisible in the picture. A board with a
   * horizontal TOP face fixes that: an up-facing normal takes 0.61 of the key where the wall
   * behind it takes none, which is the bright line the rear elevation was missing.
   *
   * 1.96 long so it lands between the corner boards' inner faces (+-0.98) instead of standing
   * proud of them, 25 mm clear of the siding, and its top at 2.135 stays under the roof
   * underside (2.219 at |x| = 0.98).
   */
  corners.push(place(kit.box(1.96, 0.09, 0.06), [0, 2.09, -0.875]));
  carcass.add(kit.merged("corner_and_frieze_boards", mat.woodFrame, corners));

  // --- Gable ends -----------------------------------------------------------------------
  /*
   * Courses of boarding, each MITRE-CUT to the rake so it stops underneath the roof.
   *
   * The first cut made every course a square-ended box as wide as the gable opening at its own
   * BOTTOM edge. That leaves no daylight — a board is always slightly too wide for the opening
   * higher up — but it pays for it by driving the two top corners 90 mm (81 mm perpendicular)
   * into a roof that is only 60 mm of deck: every course punched through the sheathing and came
   * to rest inside the tile courses. None of it shows, because the roof hides it, which is
   * exactly what makes it worth removing — the buyer carries geometry no camera can ever reach.
   * scripts/asset-geometry-audit.mjs measured it: 96 of 384 gable-board vertices (25%) inside
   * roof_tile_courses, 72 (19%) inside roof_deck.
   *
   * Cutting the ends at the rake angle instead of leaving them square settles both sides of it.
   * Each course is a trapezoid whose two ends lie on the roof underside — offset 6 mm clear of
   * it, so nothing is buried — and the courses still meet the rake along its whole length
   * instead of stepping away from it. Same eight courses, same 12 triangles a box cost.
   */
  const gable = kit.group("gable");
  root.add(gable);

  /** Perpendicular gap held between a cut board end and the roof underside. */
  const GABLE_CLEAR = 0.006;
  /** The line the ends are cut to: the roof underside, dropped by that clearance. */
  const GABLE_LINE = UNDERSIDE_AT_RIDGE - GABLE_CLEAR / Math.cos(ROOF_ANGLE);
  /** Half-width of the gable opening at height `y`, measured to the cut line. */
  const gableHalfWidth = (y) => Math.min(SHEATH_W, Math.max(0, (GABLE_LINE - y) / UNDERSIDE_SLOPE));

  /**
   * One mitre-cut board: the trapezoid between two heights, extruded BOARD_T thick and centred
   * on z = 0 so `place` can seat it on either gable like any box from the kit. The top edge
   * collapses to a point at the ridge, where the trapezoid becomes the apex triangle.
   */
  const gableBoard = (bottom, top) => {
    const halfBottom = gableHalfWidth(bottom);
    const halfTop = gableHalfWidth(top);
    const shape = new THREE.Shape();
    shape.moveTo(-halfBottom, bottom);
    shape.lineTo(halfBottom, bottom);
    if (halfTop > 0.001) shape.lineTo(halfTop, top);
    shape.lineTo(-halfTop, top);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: BOARD_T, bevelEnabled: false, steps: 1 });
    geometry.translate(0, 0, -BOARD_T / 2);
    return geometry;
  };

  const gableBoards = [];
  const GABLE_BASE = 2.06;
  const GABLE_PITCH = 0.08;
  const GABLE_BOARD_H = 0.09;
  for (let step = 0; step < 12; step += 1) {
    const bottom = GABLE_BASE + step * GABLE_PITCH;
    if (gableHalfWidth(bottom) <= 0.05) break;
    // Courses lap by 10 mm, and the last one is trimmed at the ridge rather than run past it.
    const top = Math.min(bottom + GABLE_BOARD_H, GABLE_LINE);
    for (const sz of [-1, 1]) {
      gableBoards.push(place(gableBoard(bottom, top), [0, 0, sz * (HALF_D - BOARD_T / 2)]));
    }
  }
  gable.add(kit.merged("gable_boards", mat.woodCrate, gableBoards));

  // Louvered vent — the detail that says "this building breathes" rather than "this is a box".
  // One in EACH gable, not just the front: a shed with a single vent cannot cross-ventilate,
  // and the rear elevation was the one that shipped with nothing on it at all. The rear pair
  // is the front pair mirrored, tilt included, so the two ends read as one building.
  gable.add(
    kit.merged(
      "gable_vent_frame",
      mat.woodFrame,
      [1, -1].map((sz) => place(kit.box(0.42, 0.34, 0.04), [0, 2.34, sz * (HALF_D + 0.005)])),
    ),
  );
  const louvers = [];
  for (const sz of [1, -1]) {
    for (let slat = 0; slat < 3; slat += 1) {
      louvers.push(place(kit.box(0.32, 0.055, 0.05), [0, 2.25 + slat * 0.09, sz * (HALF_D + 0.03)], [-sz * 0.38, 0, 0]));
    }
  }
  gable.add(kit.merged("gable_vent_louvers", mat.iron, louvers));

  // --- Roof ---------------------------------------------------------------------------
  const roof = kit.group("roof");
  root.add(roof);

  const decks = [];
  const tiles = [];
  const caps = [];
  const barge = [];
  const fascia = [];
  for (const side of [-1, 1]) {
    const rot = [0, 0, -side * ROOF_ANGLE];
    const slopeLength = Math.hypot(EAVE_X, RISE);

    const [dx, dy] = roofPoint(slopeLength / 2, -DECK_T / 2, side);
    decks.push(place(kit.box(slopeLength + 0.03, DECK_T, ROOF_HALF_Z * 2), [dx, dy, 0], rot));

    // Tile courses run eave-to-ridge and get thicker as they climb, so every course keeps its
    // underside flat on the deck while its lower edge steps proud of the course below.
    for (let course = 0; course < TILE_COURSES; course += 1) {
      const thickness = TILE_BASE_T + course * TILE_STEP;
      const along = slopeLength - (0.17 + course * TILE_PITCH);
      const [tx, ty] = roofPoint(along, thickness / 2, side);
      tiles.push(place(kit.box(TILE_LEN, thickness, ROOF_HALF_Z * 2), [tx, ty, 0], rot));
    }

    const capOut = TILE_BASE_T + (TILE_COURSES - 1) * TILE_STEP + 0.03;
    const [cx, cy] = roofPoint(0.1, capOut, side);
    caps.push(place(kit.box(0.24, 0.06, ROOF_HALF_Z * 2 + 0.04), [cx, cy, 0], rot));

    const [bx, by] = roofPoint(slopeLength / 2, -0.015, side);
    for (const sz of [-1, 1]) {
      barge.push(place(kit.box(slopeLength + 0.06, 0.17, 0.05), [bx, by, sz * (ROOF_HALF_Z + 0.025)], rot));
    }

    fascia.push(place(kit.box(0.05, 0.17, ROOF_HALF_Z * 2 + 0.04), [side * 1.268, 2.1, 0]));
  }
  roof.add(kit.merged("roof_deck", mat.roofTileDark, decks));
  roof.add(kit.merged("roof_tile_courses", mat.roofTile, tiles));
  roof.add(kit.merged("roof_ridge_cap", mat.roofTileDark, caps));
  roof.add(kit.merged("roof_barge_boards", mat.woodFrame, barge));
  roof.add(kit.merged("roof_eave_fascia", mat.woodFrame, fascia));

  // --- Doorway ------------------------------------------------------------------------
  const doorway = kit.group("doorway");
  root.add(doorway);

  doorway.add(
    kit.merged("door_frame", mat.woodFrame, [
      place(kit.box(0.07, DOOR_H + 0.08, 0.11), [-JAMB_X, SILL_TOP + DOOR_H / 2, HALF_D - 0.015]),
      place(kit.box(0.07, DOOR_H + 0.08, 0.11), [JAMB_X, SILL_TOP + DOOR_H / 2, HALF_D - 0.015]),
      // The lintel reaches BELOW the head of the opening so it laps the top of the leaf.
      // Sized flush, the 0.06 m head gap became a lit slot straight into the shed.
      place(kit.box(1.05, LINTEL_H, 0.11), [0, LINTEL_Y, HALF_D - 0.015]),
    ]),
  );
  // The keeper stays on the frame, not on the leaf — it is what the latch closes against.
  doorway.add(kit.solo("door_latch_keeper", mat.iron, kit.box(0.05, 0.11, 0.05), [JAMB_X - 0.02, 1.46, HALF_D + 0.05]));

  // Animation socket. The origin is the hinge line: the leaf's outer face where it meets the
  // left jamb. The leaf lives on +X and is authored in the frame described at HINGE_DX above,
  // then stepped back onto this axis at the end of the block.
  const doorPivot = kit.group("door_pivot", [-DOOR_HALF + HINGE_DX, SILL_TOP, HALF_D - 0.005 + HINGE_DZ]);
  doorPivot.userData = { socket: "door_pivot", axis: "+Y", closedRadians: 0, opensNegative: true };
  doorway.add(doorPivot);

  const leafX = 0.01 + DOOR_W / 2;
  const planks = [];
  for (let plank = 0; plank < DOOR_PLANK_COUNT; plank += 1) {
    planks.push(
      place(kit.box(DOOR_PLANK_W, DOOR_LEAF_H, DOOR_LEAF_T), [
        DOOR_LEAF_GAP + DOOR_PLANK_W / 2 + plank * DOOR_PLANK_PITCH,
        DOOR_LEAF_Y0 + DOOR_LEAF_H / 2,
        DOOR_LEAF_Z,
      ]),
    );
  }
  doorPivot.add(kit.merged("door_planks", mat.woodCrate, planks));

  /*
   * Ledged and braced: two ledges and one diagonal, mounted on the outer face where they can
   * actually be seen. The brace is what stops the door reading as a flat rectangle.
   *
   * These stay exactly where they were, and the swing sampling says what that costs: the leaf's
   * planks clear the jamb by 3.0 mm the whole way, but the ledge stands 29.5 mm proud of the
   * hinge line and the door opens PAST square, so at the 105 degree extreme the ledge's
   * hinge-side corner reaches 2.6 mm into the jamb's corner. Letting the ledge into the planks
   * to clear it would leave the strap hinge — which is seated flush ON the ledge's outer face,
   * both at y 0.28 and y 1.5 — floating over it, and the strap's own knuckle is 25 mm inside
   * that jamb at rest anyway, because that is what a strap hinge's knuckle is for. 2.6 mm is a
   * seam, below the 5 mm the inspector itself calls a seam; a floating hinge would not be.
   */
  const braceRise = 1.5 - 0.28;
  doorPivot.add(
    kit.merged("door_ledges_and_brace", mat.woodFrame, [
      place(kit.box(0.86, 0.1, 0.03), [leafX, 0.28, 0.05]),
      place(kit.box(0.86, 0.1, 0.03), [leafX, 1.5, 0.05]),
      place(kit.box(Math.hypot(0.8, braceRise) - 0.06, 0.09, 0.028), [leafX, 0.89, 0.048], [0, 0, Math.atan2(braceRise, 0.8)]),
    ]),
  );

  const hinges = [];
  for (const y of [0.28, 1.5]) {
    hinges.push(place(kit.box(0.3, 0.065, 0.016), [0.17, y, 0.073]));
    hinges.push(place(kit.box(0.06, 0.1, 0.055), [0.005, y, 0.045]));
  }
  doorPivot.add(kit.merged("door_strap_hinges", mat.iron, hinges));

  doorPivot.add(
    kit.merged("door_handle", mat.brass, [
      place(kit.cyl(0.018, 0.018, 0.22, 6), [0.79, 0.95, 0.092]),
      place(kit.box(0.04, 0.04, 0.062), [0.79, 0.86, 0.062]),
      place(kit.box(0.04, 0.04, 0.062), [0.79, 1.04, 0.062]),
    ]),
  );
  doorPivot.add(kit.solo("door_latch_bar", mat.iron, kit.box(0.22, 0.05, 0.025), [0.8, 1.2, 0.058], [0, 0, 0.42]));

  // The leaf above is authored on the old frame — x from the jamb face, z on the leaf's inner
  // face. The pivot now sits on the hinge line, so every leaf part steps back by the same two
  // numbers: world positions are unchanged, the axis is not.
  for (const part of doorPivot.children) {
    part.position.x -= HINGE_DX;
    part.position.z -= HINGE_DZ;
  }

  // --- Window -------------------------------------------------------------------------
  const windowGroup = kit.group("window");
  root.add(windowGroup);

  /*
   * TWO windows, not one: the +X side wall and the REAR gable.
   *
   * The rear elevation shipped as a single unbroken sheet — no opening, no applied trim, no
   * member of any kind between the corner boards — so from behind the shed did not read as
   * the same object the storefront photograph shows. It is the same window, mirrored onto the
   * back wall plane, at the same 1.34 centre height: the head, cill and stiles keep their
   * 0.80 / 0.58 / 0.06 sections, and the pane keeps the same 20 mm standoff that was measured
   * out for the side window (the rear boards reach z = -0.864 with their lean taken into
   * account, so the glass sits at -0.888..-0.868 and the mullions at -0.898..-0.878 — clear of
   * the boards, still inside the frame). Merged into the same three meshes as the side window,
   * so a second window costs geometry but not a draw call.
   */
  windowGroup.add(
    kit.merged("window_frame", mat.woodFrame, [
      // Head and cill boards run the full 0.80 so they close on the stile ends instead of
      // leaving a 10 mm notch at each of the four corners.
      place(kit.box(0.06, 0.08, 0.8), [1.07, 1.67, 0.05]),
      place(kit.box(0.06, 0.08, 0.8), [1.07, 1.01, 0.05]),
      place(kit.box(0.06, 0.58, 0.08), [1.07, 1.34, -0.31]),
      place(kit.box(0.06, 0.58, 0.08), [1.07, 1.34, 0.41]),
      // The sill sheds water outward along +X, so it tilts about Z, not about X.
      place(kit.box(0.13, 0.05, 0.9), [1.1, 0.985, 0.05], [0, 0, -0.12]),
      // Rear window, on the -Z gable. Same sections, axes swapped for the wall it sits on.
      place(kit.box(0.8, 0.08, 0.06), [0, 1.67, -0.87]),
      place(kit.box(0.8, 0.08, 0.06), [0, 1.01, -0.87]),
      place(kit.box(0.08, 0.58, 0.06), [-0.36, 1.34, -0.87]),
      place(kit.box(0.08, 0.58, 0.06), [0.36, 1.34, -0.87]),
      // This sill sheds outward along -Z, so it tilts about X and the sign flips with it.
      place(kit.box(0.9, 0.05, 0.13), [0, 0.985, -0.9], [-0.12, 0, 0]),
    ]),
  );
  /*
   * The pane and its mullions have to sit outboard of the siding, not in it.
   *
   * The wall boards reach 1.064 from the centre once their lean is taken into account, and the
   * glass used to sit at 1.038-1.058 — behind that. The board edges therefore drew *through* the
   * pane and the window came out with brown bars across the glass from every side angle. The
   * frame's stiles run 1.04 to 1.10, so there is room to put the glass at 1.068-1.088 and the
   * mullions at 1.078-1.098: clear of the boards, still inside the frame.
   */
  windowGroup.add(
    kit.merged("window_glass", mat.glass, [
      place(kit.box(0.02, 0.6, 0.68), [1.078, 1.34, 0.05]),
      place(kit.box(0.68, 0.6, 0.02), [0, 1.34, -0.878]),
    ]),
  );
  windowGroup.add(
    kit.merged("window_mullions", mat.woodFrame, [
      place(kit.box(0.02, 0.6, 0.05), [1.088, 1.34, 0.05]),
      place(kit.box(0.02, 0.05, 0.68), [1.088, 1.34, 0.05]),
      place(kit.box(0.05, 0.6, 0.02), [0, 1.34, -0.888]),
      place(kit.box(0.68, 0.05, 0.02), [0, 1.34, -0.888]),
    ]),
  );

  // The swing, keyed on the pivot's quaternion about +Y (negative opens toward +Z).
  const doorTimes = new Float32Array(DOOR_CLIP_KEYS.map((key) => key.time));
  const doorValues = new Float32Array(
    DOOR_CLIP_KEYS.flatMap(({ degrees }) => {
      const half = (degrees * Math.PI) / 360;
      return [0, Math.sin(half), 0, Math.cos(half)];
    }),
  );
  root.animations = [
    new THREE.AnimationClip(DOOR_CLIP_NAME, DOOR_CLIP_KEYS[DOOR_CLIP_KEYS.length - 1].time, [
      new THREE.QuaternionKeyframeTrack("door_pivot.quaternion", doorTimes, doorValues),
    ]),
  ];

  root.userData.measured = summarize(THREE, root);
  return root;
}

export default createStorageShed;
