/**
 * HF Wave 2 — wood crate builder (shared by crate-closed, crate-open and crate-produce).
 *
 * The brief: Harvest Frontier's current crate is an "orange untextured cube". A cube is what
 * you get when a crate is modelled as its bounding box, so the fix is to model the CARPENTRY —
 * a crate is not a box, it is eleven boards and four corner posts with air between them, and
 * every one of those gaps is a shadow line the eye uses to read the object.
 *
 * What carries the read, in the order it survives being shrunk:
 *
 *   1. the four corner posts standing 3 mm proud of the boarding, which is what turns a box
 *      into a frame-and-panel object
 *   2. the three courses of boards per face with real 26 mm air gaps between them
 *   3. the diagonal brace across the front and the back
 *   4. the nail heads at every board end
 *   5. the grain: tone streaking ALONG each board, which is why every visible board face is
 *      subdivided along its own long axis — a board with one segment can only show two tones
 *
 * The wall boards are solid boxes, so an open crate shows real wall THICKNESS at the rim; that
 * is free here and impossible if the walls had been single quads.
 *
 * Palette: `crateBody` / `crateLight` / `crateShadow` / `crateFrame` / `iron` are the cozy farm
 * set's FARM_PALETTE hexes unchanged, so a wave-2 crate and a market-stall crate are the same
 * object from the same world. Hardware is vertex-coloured dark rather than given its own
 * metal material, because the delivery contract is one material per variant.
 *
 * Contract: Group "<id>" -> Mesh "crate_body", Mesh "hardware", and, for the variants that
 * carry one, Mesh "<lid|produce>". The open crate is empty and ships the two carcass meshes
 * only. ONE material, every transform baked, origin on the ground at the crate's centre.
 */
import {
  along,
  appleGeometry,
  applePainter,
  at,
  board,
  finish,
  flatPainter,
  grainBoard,
  lowestY,
  mergeParts,
  nailHead,
  paintFaces,
  strawBlade,
  summarize,
  translateAll,
  wave2Material,
  woodPainter,
} from "./wave2-kit.mjs";

// --- Authored dimensions (metres) --------------------------------------------------------
// 0.56 x 0.41 x 0.42 — a two-handed produce crate. Everything below is derived from these and
// from a 22 mm board thickness, so the numbers in the comments are the numbers in the mesh.
const HALF_X = 0.28;
const HALF_Z = 0.21;
const STILE = 0.056; // corner post section
const BOARD_T = 0.022;
const PLANK_FACE_Z = HALF_Z - BOARD_T * 0.5 - 0.003; // 3 mm inside the post face
const PLANK_FACE_X = HALF_X - BOARD_T * 0.5 - 0.003;
const COURSE_Y = [0.106, 0.232, 0.358]; // three courses, 26 mm of air between them
const COURSE_H = 0.1;
const FLOOR_TOP = 0.05;
const TOP_Y = 0.41;

const VARIANTS = {
  closed: { id: "hf_crate_closed", label: "crate, lidded", nailCourses: [0, 1, 2], extra: "lid" },
  open: { id: "hf_crate_open", label: "crate, open and empty", nailCourses: [0, 2], extra: null },
  produce: { id: "hf_crate_produce", label: "crate, open and full of apples", nailCourses: [0, 2], extra: "produce" },
};

export function buildCrate(THREE, variantName) {
  const variant = VARIANTS[variantName];
  if (!variant) throw new Error(`Unknown crate variant: ${variantName}`);

  const painted = (geometry, painter) => {
    const done = finish(geometry);
    paintFaces(THREE, done, painter);
    return done;
  };

  // ---- body ------------------------------------------------------------------------------
  const bodyParts = [];

  // Skids. A crate that sits flat on its floor boards looks moulded; two runners lift it and
  // give the bottom edge a shadow.
  const skidPainter = woodPainter({ role: "crateFrame", grainAxis: "z", grainStep: 0.2, boardAxis: "x", boardStep: 0.43, seed: 12 });
  for (const side of [-1, 1]) {
    // 0.032 tall, not 0.028. The floor boards' undersides are at y = 0.028, so a 0.028 skid put
    // its top face on EXACTLY that plane: 450 cm^2 of coplanar face pairs, 0.000 mm apart, seen
    // through the 10 mm gaps between the floor boards. Four extra millimetres make it a joint
    // instead of a tie. The skid is buried in the boards for those 4 mm, so the foot a buyer
    // sees is still the 28 mm under the floor, the crate still stands on y = 0, and it is
    // exactly as tall as before.
    bodyParts.push(painted(board(THREE, [0.06, 0.032, 0.4], [side * 0.215, 0.016, 0]), skidPainter));
  }

  // Floor boards, seen only through the open top and the gaps, so they get the shadow tone.
  const floorPainter = woodPainter({ role: "crateShadow", grainAxis: "x", grainStep: 0.17, boardAxis: "z", boardStep: 0.135, seed: 23 });
  // 0.53 wide, not 0.51: the boards have to tuck 10 mm INTO the side walls. Ending them exactly
  // on the wall's inner face left a hairline of daylight down each side, which the top-down
  // render found immediately.
  for (const z of [-0.135, 0, 0.135]) {
    bodyParts.push(painted(board(THREE, [0.53, 0.022, 0.125], [0, 0.039, z]), floorPainter));
  }

  // Corner posts. Deliberately 3 mm proud of the boarding on both faces: that tiny offset is
  // the whole difference between "frame and panel" and "printed box".
  const stilePainter = woodPainter({ role: "crateFrame", grainAxis: "y", grainStep: 0.06, boardAxis: "x", boardStep: 0.45, seed: 31 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      bodyParts.push(
        painted(
          board(
            THREE,
            [STILE, TOP_Y - FLOOR_TOP, STILE],
            [sx * (HALF_X - STILE / 2), (TOP_Y + FLOOR_TOP) / 2, sz * (HALF_Z - STILE / 2)],
          ),
          stilePainter,
        ),
      );
    }
  }

  // Wall boards. Three segments along each board's own long axis, so the grain painter has
  // somewhere to put a streak; one segment per face would cap the board at two tones and the
  // whole crate would go back to reading as flat panels.
  // grainStep is one authored segment, and it must match the segment count below exactly: the
  // painter snaps its noise lookup to that pitch so both triangles of a strip share one tone.
  const FRONT_SEGS = 5;
  // 3, not 4. At 4 the produce variant measured 806 triangles — over the 800 budget by six —
  // and the short faces are the cheapest place to give a band back. Note this still beats the
  // BoxGeometry version it replaced: 3 bands for the 20 triangles that used to buy 2.
  const SIDE_SEGS = 3;
  const frontPainter = woodPainter({
    role: "crateBody",
    grainAxis: "x",
    grainStep: 0.448 / FRONT_SEGS,
    boardAxis: "y",
    boardStep: 0.126,
    seed: 41,
    wear: 0.5,
  });
  const sidePainter = woodPainter({
    role: "crateBody",
    grainAxis: "z",
    grainStep: 0.308 / SIDE_SEGS,
    boardAxis: "y",
    boardStep: 0.126,
    seed: 47,
    wear: 0.5,
  });
  for (const y of COURSE_Y) {
    for (const sz of [-1, 1]) {
      bodyParts.push(
        painted(
          grainBoard(THREE, [0.448, COURSE_H, BOARD_T], [0, y, sz * PLANK_FACE_Z], [0, 0, 0], FRONT_SEGS, "z"),
          frontPainter,
        ),
      );
    }
    for (const sx of [-1, 1]) {
      bodyParts.push(
        painted(
          grainBoard(THREE, [BOARD_T, COURSE_H, 0.308], [sx * PLANK_FACE_X, y, 0], [0, 0, 0], SIDE_SEGS, "x"),
          sidePainter,
        ),
      );
    }
  }

  /*
   * One diagonal brace per long face. Not an X — a single sloped batten is what a real crate
   * carries, and it is the one part of this crate that says "built, not extruded".
   *
   * 2026-09-05. It was not being seen. In the storefront hero — the three-quarter, the one
   * image a buyer actually looks at — the middle of the batten was drawn BEHIND the boarding
   * and only its two ends came through. Measured off the shipped file: 12,337 of a projected
   * 17,300 px, so 29 % of the batten was missing from the picture the crate is sold with.
   *
   * It was not a modelling gap. The batten's outer face measured z = 0.2170 against the wall
   * boards' 0.2070 — 10.0 mm proud, exactly as authored. The batten was losing the DEPTH TEST.
   * Our own rasteriser (outputs/market-launch/wave1/tools/hero-render.mjs, and the review
   * previews it came from) interpolates view depth with screen-space barycentrics, which is
   * not perspective-correct, so a long triangle's interior reads FARTHER than it is by
   * (Δz)² / 2(z₀+z₁). This batten is one 440 mm quad; at the hero camera its two ends sit
   * 307 mm apart in depth at a mean 1.29 m, which is an 18.4 mm error at its middle — nearly
   * twice the 10 mm it stood proud. The wall boards behind it are split into five segments and
   * carry 0.5 mm of the same error, so the boards won.
   *
   * Two changes, both measured:
   *
   *   1. `segs = 4`. The error falls with the square of the segment's own depth spread, so
   *      quartering the batten's faces takes 18.4 mm to 1.15 mm. It also gives the batten four
   *      grain bands instead of the two a single quad can carry, which is the same reason every
   *      other visible board on this crate is subdivided.
   *   2. 18 mm thick, not 12. Still biting 2 mm into the boarding — nailed on, not balanced on —
   *      so the outer face lands at z = 0.223: 16.0 mm proud of the boards and 13.0 mm proud of
   *      the corner posts, against a worst-case 2.4 mm of depth error at any camera angle.
   *
   * 36 triangles each, up from 12, so 48 per variant. Measured on the hero frame: the batten
   * went from two fragments totalling 12,337 px to one unbroken 20,215 px shape.
   */
  const BRACE_T = 0.018;
  const BRACE_SEGS = 4;
  const bracePainter = woodPainter({ role: "crateFrame", grainAxis: "x", grainStep: 0.11, boardAxis: "z", boardStep: 0.42, seed: 53 });
  for (const sz of [-1, 1]) {
    bodyParts.push(
      painted(
        board(
          THREE,
          [0.44, 0.034, BRACE_T],
          [0, 0.232, sz * (PLANK_FACE_Z + BOARD_T * 0.5 + BRACE_T * 0.5 - 0.002)],
          [0, 0, sz * 0.63],
          BRACE_SEGS,
          "x",
        ),
        bracePainter,
      ),
    );
  }

  // ---- hardware --------------------------------------------------------------------------
  const hardwarePainter = flatPainter("iron", 81, 0.5);
  const hardwareParts = [];
  for (const courseIndex of variant.nailCourses) {
    const y = COURSE_Y[courseIndex];
    for (const sz of [-1, 1]) {
      for (const sx of [-1, 1]) {
        hardwareParts.push(
          painted(
            nailHead(THREE, [sx * 0.195, y, sz * (PLANK_FACE_Z + BOARD_T * 0.5 + 0.004)], "z"),
            hardwarePainter,
          ),
        );
      }
    }
  }

  // ---- variant payload --------------------------------------------------------------------
  const extraParts = [];
  let extraName = "lid";

  if (variant.extra === "lid") {
    extraName = "lid";
    const LID_SEGS = 5;
    const lidPainter = woodPainter({
      role: "crateBody",
      grainAxis: "x",
      grainStep: 0.57 / LID_SEGS,
      boardAxis: "z",
      boardStep: 0.098,
      seed: 61,
      wear: 0.9,
    });
    const cleatPainter = woodPainter({ role: "crateFrame", grainAxis: "z", grainStep: 0.2, boardAxis: "x", boardStep: 0.38, seed: 67 });
    // Four boards with 6 mm slits, oversailing the body by 5 mm on every side so the lid reads
    // as a separate part rather than as the top face of the box.
    for (const z of [-0.147, -0.049, 0.049, 0.147]) {
      extraParts.push(
        painted(grainBoard(THREE, [0.57, 0.024, 0.092], [0, TOP_Y + 0.012, z], [0, 0, 0], LID_SEGS, "y"), lidPainter),
      );
    }
    for (const x of [-0.19, 0.19]) {
      extraParts.push(painted(board(THREE, [0.05, 0.018, 0.4], [x, TOP_Y - 0.009, 0]), cleatPainter));
    }
  }

  /*
   * The "open" variant used to leave four blades of packing straw in the bottom. They are gone.
   *
   * They never worked. `along()` plants a blade at the point it is given, the four authored
   * points sat at y = 0.058-0.064, and the floor boards top out at FLOOR_TOP = 0.050 — so every
   * blade hovered 8-14 mm over the floor. Worse than the gap was the read: a 150 mm bleached
   * prism (hayDust #c9b489) lying nearly flat on a 560 mm floor is a pale, sharp sliver, and two
   * separate audits looked at the top-down render and logged it as an unexplained "pale wedge"
   * before anyone identified it as the straw. Planting it on the boards fixed the geometry and
   * did not fix the read.
   *
   * An empty crate should look empty. Removing them costs 36 triangles and removes the only
   * thing in this variant a buyer could mistake for a modelling error.
   */

  if (variant.extra === "produce") {
    extraName = "produce";
    // The fill plate. Only the top layer of fruit is modelled, so without a dark plate under it
    // the camera sees straight through to the floor boards and the crate reads as almost empty —
    // the same trick the market stall uses when it heaps produce above the crate rim.
    // 0.50 x 0.36, not 0.44 x 0.33. The walls' inner faces are at x = +-0.255 and z = +-0.185,
    // so the old plate stopped 35 mm short on each side and 20 mm short front and back — and the
    // top-down render looked straight past its edge into the empty crate below, which is the
    // opposite of what a fill plate is for. It now reaches to within 5 mm of the boarding and
    // buries its corners in the corner posts. Same 12 triangles.
    extraParts.push(painted(board(THREE, [0.5, 0.02, 0.36], [0, 0.336, 0]), flatPainter("voidFill", 87, 0.22)));

    const fruitPainter = applePainter(91);
    const stemPainter = flatPainter("stem", 93, 0.4);
    const leafPainter = flatPainter("leaf", 95, 0.6);
    /*
     * Twelve across the base and three riding on the pile.
     *
     * Seven was not enough. The seven sat inside |x| <= 0.175 and |z| <= 0.09 while the crate's
     * interior runs to |x| = 0.255 and |z| = 0.185, so a 9 cm band of bare voidFill plate ran
     * along the front and the back and the listing's "full of apples" read as half empty from
     * directly above — the angle a top-down game camera actually uses.
     *
     * The base is now three offset rows that reach the walls. An apple's widest point is at its
     * own centre height, below the 0.41 rim, so a base centre may go no further out than
     * 0.255 - 0.047 = 0.208 in x and 0.185 - 0.047 = 0.138 in z; every row below respects that.
     * The rows are staggered and each fruit takes a different yaw, so twelve reads as a heap
     * rather than as a tray of beads. Five more apples is 100 triangles.
     */
    const base = [
      [-0.197, 0.386, -0.126],
      [-0.066, 0.383, -0.121],
      [0.066, 0.386, -0.127],
      [0.197, 0.384, -0.122],
      [-0.132, 0.384, -0.002],
      [-0.001, 0.382, 0.004],
      [0.132, 0.385, -0.004],
      [0.197, 0.383, 0.06],
      [-0.197, 0.385, 0.06],
      [-0.099, 0.384, 0.126],
      [0.033, 0.386, 0.121],
      [0.165, 0.383, 0.127],
    ];
    // Placed over the three widest holes the base course leaves, not scattered.
    const crown = [
      [-0.088, 0.462, -0.062],
      [0.06, 0.466, 0.064],
      [0.155, 0.46, -0.066],
    ];
    /*
     * radius 0.055, not 0.045. This is the one lever that closes the gaps between the fruit for
     * FREE: an icosahedron is 20 triangles at any size. At 0.045 the twelve base apples were
     * 90 mm across on a 131 mm pitch, so 40 mm of dark plate showed between every neighbour and
     * the crate still read as a tray with some apples on it. At 0.055 they are 114 mm across and
     * very nearly touch. The widest point of a base apple is at its own centre, below the 0.41
     * rim, so the layout above keeps every base centre inside 0.255 - 0.057 = 0.198 in x and
     * 0.185 - 0.057 = 0.128 in z and nothing pushes through the boarding.
     */
    let index = 0;
    for (const [x, y, z] of [...base, ...crown]) {
      const apple = appleGeometry(THREE, { radius: 0.055, seed: 7 + index });
      extraParts.push(painted(at(THREE, apple, [x, y, z], [0.1, index * 1.7, 0.06]), fruitPainter));
      index += 1;
    }
    for (let i = 0; i < crown.length; i += 1) {
      const [x, y, z] = crown[i];
      extraParts.push(painted(board(THREE, [0.012, 0.022, 0.012], [x, y + 0.052, z], [0.16, 0, 0.22]), stemPainter));
    }
    for (const [x, y, z, dx, dy, dz] of [
      [-0.072, 0.474, -0.046, -0.55, 0.62, 0.56],
      [0.105, 0.47, 0.08, 0.7, 0.55, -0.45],
    ]) {
      const leaf = strawBlade(THREE, { length: 0.06, width: 0.017, bend: 0.5, droop: 0.4, seed: 610 });
      extraParts.push(painted(along(THREE, leaf, [x, y, z], [dx, dy, dz], 0.6), leafPainter));
    }
  }

  // ---- ground it and export ---------------------------------------------------------------
  const all = [...bodyParts, ...hardwareParts, ...extraParts];
  translateAll(THREE, all, -lowestY(all));

  const material = wave2Material(THREE, "hf_wave2_crate", 0.88);
  const root = new THREE.Group();
  root.name = variant.id;

  const bodyMesh = new THREE.Mesh(mergeParts(THREE, bodyParts), material);
  bodyMesh.name = "crate_body";
  const hardwareMesh = new THREE.Mesh(mergeParts(THREE, hardwareParts), material);
  hardwareMesh.name = "hardware";
  root.add(bodyMesh, hardwareMesh);
  // `open` has no payload mesh at all now, and an empty merged geometry would be an empty node
  // (SCENE-EMPTY-NODES). Two meshes is the honest contract for an empty crate.
  if (extraParts.length) {
    const extraMesh = new THREE.Mesh(mergeParts(THREE, extraParts), material);
    extraMesh.name = extraName;
    root.add(extraMesh);
  }

  root.userData = {
    generator: "clunk-generate-pipeline",
    kit: "hf-wave2-v1",
    series: "hf-wave2",
    assetId: `hf-wave2.crate-${variantName}.m1`,
    variant: variant.label,
    upAxis: "+Y",
    originAtGroundCentre: true,
    scaleMeters: 1,
    materials: 1,
    colorSource: "COLOR_0",
    palette: "cozy-farm-set/farm-kit.mjs FARM_PALETTE (crate roles verbatim)",
    surfaceLanguage: [
      "eleven separate boards with real 26 mm air gaps, not one panelled box",
      "corner posts standing 3 mm proud of the boarding on both faces",
      "grain streaks painted along each board's own long axis, faces segmented to carry them",
      "board undersides darkened, so every gap reads as a shadow line",
      "diagonal brace per long face, an 18 mm batten standing 16 mm proud of the boarding",
      "nail heads at the board ends",
      "solid boards, so the open variants show real wall thickness at the rim",
    ],
    parts: extraParts.length ? ["crate_body", "hardware", extraName] : ["crate_body", "hardware"],
    swapNote: extraParts.length
      ? `replace the "${extraName}" mesh to restock or re-lid without touching the carcass`
      : "an empty carcass: add a third mesh under this root to fill or lid it without touching the carcass",
  };
  root.userData.measured = summarize(THREE, root);
  return root;
}
