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
 * shadow lines, the window, and the shed lifted clear of the ground on stone piers.
 *
 * Construction rules inherited from the series kit: no node ever carries scale, no part floats
 * (every element lands on the piers, the sill, the sheathing or the deck), and the interior is
 * a closed dark box so an opened door does not reveal a hollow shell.
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
      door_pivot: "Hinge node on the left jamb. Rotate about +Y; negative angles swing the door outward (+Z). Zero is shut.",
    },
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
      place(kit.box(2.1, 0.12, 0.1), [0, 0.22, 0.8]),
      place(kit.box(2.1, 0.12, 0.1), [0, 0.22, -0.8]),
      place(kit.box(0.1, 0.12, 1.6), [1.0, 0.22, 0]),
      place(kit.box(0.1, 0.12, 1.6), [-1.0, 0.22, 0]),
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
  carcass.add(kit.merged("corner_and_frieze_boards", mat.woodFrame, corners));

  // --- Gable ends -----------------------------------------------------------------------
  // Stepped courses per end, each cut to the roof underside at its own BOTTOM edge. Cutting at
  // the bottom means every board is slightly too wide for the opening higher up, so the
  // staircase is always buried in the roof rather than leaving sawtooth slots of daylight.
  //
  // That only works if a board is shorter than the roof is thick, otherwise its top corners
  // punch straight back out through the tiles. The roof is thinnest at the eave — 0.067 m of
  // deck plus the 0.047 m first tile course, measured vertically — so the course height is held
  // to 0.09 and the pitch to 0.08, which keeps a 0.02 m margin at the worst corner and still
  // laps every seam.
  const gable = kit.group("gable");
  root.add(gable);

  const gableBoards = [];
  const GABLE_BASE = 2.06;
  const GABLE_PITCH = 0.08;
  const GABLE_BOARD_H = 0.09;
  for (let step = 0; step < 10; step += 1) {
    const bottom = GABLE_BASE + step * GABLE_PITCH;
    const halfWidth = Math.min(SHEATH_W, (UNDERSIDE_AT_RIDGE - bottom) / UNDERSIDE_SLOPE);
    if (halfWidth <= 0.05) continue;
    for (const sz of [-1, 1]) {
      gableBoards.push(
        place(kit.box(halfWidth * 2, GABLE_BOARD_H, BOARD_T), [0, bottom + GABLE_BOARD_H / 2, sz * (HALF_D - BOARD_T / 2)]),
      );
    }
  }
  gable.add(kit.merged("gable_boards", mat.woodCrate, gableBoards));

  // Louvered vent — the detail that says "this building breathes" rather than "this is a box".
  gable.add(
    kit.merged("gable_vent_frame", mat.woodFrame, [
      place(kit.box(0.42, 0.34, 0.04), [0, 2.34, HALF_D + 0.005]),
    ]),
  );
  const louvers = [];
  for (let slat = 0; slat < 3; slat += 1) {
    louvers.push(place(kit.box(0.32, 0.055, 0.05), [0, 2.25 + slat * 0.09, HALF_D + 0.03], [-0.38, 0, 0]));
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
      place(kit.box(1.05, 0.16, 0.11), [0, PLATE_Y + 0.01, HALF_D - 0.015]),
    ]),
  );
  // The keeper stays on the frame, not on the leaf — it is what the latch closes against.
  doorway.add(kit.solo("door_latch_keeper", mat.iron, kit.box(0.05, 0.11, 0.05), [JAMB_X - 0.02, 1.46, HALF_D + 0.05]));

  // Animation socket. Local origin is the hinge line at the left jamb; the leaf lives on +X.
  const doorPivot = kit.group("door_pivot", [-DOOR_HALF, SILL_TOP, HALF_D - 0.005]);
  doorPivot.userData = { socket: "door_pivot", axis: "+Y", closedRadians: 0, opensNegative: true };
  doorway.add(doorPivot);

  const leafX = 0.01 + DOOR_W / 2;
  const planks = [];
  for (let plank = 0; plank < 4; plank += 1) {
    planks.push(place(kit.box(0.212, DOOR_H - 0.06, 0.035), [0.01 + 0.106 + plank * 0.221, (DOOR_H - 0.06) / 2, 0.018]));
  }
  doorPivot.add(kit.merged("door_planks", mat.woodCrate, planks));

  // Ledged and braced: two ledges and one diagonal, mounted on the outer face where they can
  // actually be seen. The brace is what stops the door reading as a flat rectangle.
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

  // --- Window -------------------------------------------------------------------------
  const windowGroup = kit.group("window");
  root.add(windowGroup);

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
  windowGroup.add(kit.solo("window_glass", mat.glass, kit.box(0.02, 0.6, 0.68), [1.078, 1.34, 0.05]));
  windowGroup.add(
    kit.merged("window_mullions", mat.woodFrame, [
      place(kit.box(0.02, 0.6, 0.05), [1.088, 1.34, 0.05]),
      place(kit.box(0.02, 0.05, 0.68), [1.088, 1.34, 0.05]),
    ]),
  );

  root.userData.measured = summarize(THREE, root);
  return root;
}

export default createStorageShed;
