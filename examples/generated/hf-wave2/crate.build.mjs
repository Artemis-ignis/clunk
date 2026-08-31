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
 * Contract: Group "<id>" -> Mesh "crate_body", Mesh "hardware", Mesh "<lid|packing|produce>".
 * Three nodes under one root, ONE material, every transform baked, origin on the ground at the
 * crate's centre.
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
  loosePainter,
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
  open: { id: "hf_crate_open", label: "crate, open and empty", nailCourses: [0, 2], extra: "packing" },
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
    bodyParts.push(painted(board(THREE, [0.06, 0.028, 0.4], [side * 0.215, 0.014, 0]), skidPainter));
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

  // One diagonal brace per long face. Not an X — a single sloped batten is what a real crate
  // carries, and it costs 12 triangles to say "this thing was built, not extruded".
  const bracePainter = woodPainter({ role: "crateFrame", grainAxis: "x", grainStep: 0.11, boardAxis: "z", boardStep: 0.42, seed: 53 });
  for (const sz of [-1, 1]) {
    bodyParts.push(
      painted(
        board(THREE, [0.44, 0.034, 0.012], [0, 0.232, sz * (PLANK_FACE_Z + BOARD_T * 0.5 + 0.006)], [0, 0, sz * 0.63]),
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

  if (variant.extra === "packing") {
    extraName = "packing_straw";
    // Four blades of packing straw left in the bottom. Cheap, and it is the one detail that
    // ties the crate product to the haystack product as one delivery.
    const strawPainter = loosePainter({ seed: 55 });
    const layout = [
      [-0.13, 0.062, 0.07, 0.9, 0.25, 0.3],
      [0.09, 0.06, -0.05, -0.4, 0.3, 0.85],
      [0.17, 0.064, 0.1, 0.6, 0.2, -0.7],
      [-0.05, 0.058, -0.12, -0.8, 0.25, -0.5],
    ];
    for (let i = 0; i < layout.length; i += 1) {
      const [x, y, z, dx, dy, dz] = layout[i];
      const blade = strawBlade(THREE, { length: 0.15, width: 0.011, bend: 0.35, droop: 0.15, seed: 500 + i });
      extraParts.push(painted(along(THREE, blade, [x, y, z], [dx, dy, dz], i * 1.1), strawPainter));
    }
  }

  if (variant.extra === "produce") {
    extraName = "produce";
    // The fill plate. Only the top layer of fruit is modelled, so without a dark plate under it
    // the camera sees straight through to the floor boards and the crate reads as almost empty —
    // the same trick the market stall uses when it heaps produce above the crate rim.
    extraParts.push(painted(board(THREE, [0.44, 0.02, 0.33], [0, 0.336, 0]), flatPainter("voidFill", 87, 0.22)));

    const fruitPainter = applePainter(91);
    const stemPainter = flatPainter("stem", 93, 0.4);
    const leafPainter = flatPainter("leaf", 95, 0.6);
    // Seven across the base and three riding on the pile. A single ring of five left the plate
    // showing through at the corners and the crate read as almost empty; the base course has to
    // reach the walls before the crown means anything. A grid would read as a tray of beads, so
    // the two courses are offset and every fruit is spun to a different yaw.
    const base = [
      [-0.175, 0.386, -0.09],
      [-0.06, 0.383, 0.085],
      [0.06, 0.386, -0.085],
      [0.175, 0.383, 0.082],
      [0.0, 0.384, -0.006],
      [-0.135, 0.382, 0.09],
      [0.145, 0.384, -0.095],
    ];
    const crown = [
      [-0.09, 0.452, 0.012],
      [0.055, 0.456, -0.028],
      [0.135, 0.45, 0.062],
    ];
    let index = 0;
    for (const [x, y, z] of [...base, ...crown]) {
      const apple = appleGeometry(THREE, { radius: 0.045, seed: 7 + index });
      extraParts.push(painted(at(THREE, apple, [x, y, z], [0.1, index * 1.7, 0.06]), fruitPainter));
      index += 1;
    }
    for (let i = 0; i < crown.length; i += 1) {
      const [x, y, z] = crown[i];
      extraParts.push(painted(board(THREE, [0.012, 0.022, 0.012], [x, y + 0.043, z], [0.16, 0, 0.22]), stemPainter));
    }
    for (const [x, y, z, dx, dy, dz] of [
      [-0.075, 0.462, 0.028, -0.55, 0.62, 0.56],
      [0.1, 0.458, -0.055, 0.7, 0.55, -0.45],
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
  const extraMesh = new THREE.Mesh(mergeParts(THREE, extraParts), material);
  extraMesh.name = extraName;
  root.add(bodyMesh, hardwareMesh, extraMesh);

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
      "diagonal brace per long face, nail heads at the board ends",
      "solid boards, so the open variants show real wall thickness at the rim",
    ],
    parts: ["crate_body", "hardware", extraName],
    swapNote: `replace the "${extraName}" mesh to restock or re-lid without touching the carcass`,
  };
  root.userData.measured = summarize(THREE, root);
  return root;
}
