/**
 * Village Square 06 — Timber Planter Box.
 *
 * Reference measurements: a public timber planter is 500-700 mm square and 400-500 mm tall,
 * built from 25-32 mm boards on 60-70 mm corner posts, with a capping rail wide enough to
 * rest a hand on and the soil sitting 60-80 mm below the rim. This is cut to 600 mm square,
 * 460 mm to the top of the cap rail, 25 mm boards, 60 mm posts and soil 70 mm down.
 *
 * The two flower containers in this kit are deliberately different objects rather than one
 * object twice: this is a joiner's box in FARM timber, and `planter-urn` is a mason's urn in
 * the kit's stone. A square full of the same container is what a set looks like when the
 * second variant was made by scaling the first.
 *
 * Every board is a chamfered prism. A 600 mm box is close enough to the camera in an
 * elevated farm view that a square arris on the cap rail reads as a hard black line.
 */
import { createKit, place, selectMaterials, summarize } from "./village-kit.mjs";
import { planting } from "./planting.build.mjs";

const SIDE = 0.6;
const POST = 0.06;
const BOARD_T = 0.025;
const BOARDS = 3;
const BODY_H = 0.4; // top of the top board
const BOARD_GAP = 0.012; // the shadow line between courses; the soil behind shows through it
const BOARD_H = (BODY_H - BOARD_GAP * (BOARDS - 1)) / BOARDS;
const CAP_H = 0.06;
const CAP_OVER = 0.03; // cap rail overhangs the posts on both faces
const TOP = BODY_H + CAP_H; // 0.46
const SOIL_TOP = TOP - 0.07;

export function createVillagePlanterBox(THREE) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, ["woodFrame", "woodPlank", "woodPale", "stoneShadow", "leaf", "bloom", "iron"]);

  const root = kit.group("village_planter_box");
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "village-square",
    assetId: "village-square.planter-box.m1",
    upAxis: "+Y",
    scaleMeters: 1,
    soilTopMetres: SOIL_TOP,
  };

  // --- Carcass ----------------------------------------------------------------------------
  const carcass = kit.group("carcass");
  root.add(carcass);

  const posts = [];
  const half = SIDE / 2;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      posts.push(
        place(kit.beam(POST, POST, BODY_H), [sx * (half - POST / 2), BODY_H / 2, sz * (half - POST / 2)], [Math.PI / 2, 0, 0]),
      );
    }
  }
  carcass.add(kit.merged("planter_posts", mat.woodFrame, posts));

  // Boards. Each course is four boards, one to a side, set BETWEEN the posts and 35 mm
  // behind their outer face — so the four posts stand proud and the box reads as a framed
  // joiner's box rather than as a solid cube with lines drawn on it.
  const boards = [];
  const boardLen = SIDE - POST * 2 + 0.004;
  const boardPlane = half - POST + BOARD_T / 2;
  for (let course = 0; course < BOARDS; course += 1) {
    const y = course * (BOARD_H + BOARD_GAP) + BOARD_H / 2;
    for (const side of [-1, 1]) {
      // Along X, at both Z faces.
      boards.push(place(kit.beam(BOARD_T, BOARD_H, boardLen), [0, y, side * boardPlane], [0, Math.PI / 2, 0]));
      // Along Z, at both X faces.
      boards.push(place(kit.beam(BOARD_T, BOARD_H, boardLen), [side * boardPlane, y, 0], [0, 0, 0]));
    }
  }
  carcass.add(kit.merged("planter_boards", mat.woodPlank, boards));

  // Cap rail: four lengths mitred round the top, overhanging the boards on both faces.
  const cap = [];
  const capOuter = half + CAP_OVER;
  const capW = POST + CAP_OVER * 2;
  for (const side of [-1, 1]) {
    cap.push(place(kit.beam(capW, CAP_H, capOuter * 2), [0, BODY_H + CAP_H / 2, side * (capOuter - capW / 2)], [0, Math.PI / 2, 0]));
    cap.push(
      place(kit.beam(capW, CAP_H, capOuter * 2 - capW * 2), [side * (capOuter - capW / 2), BODY_H + CAP_H / 2, 0], [0, 0, 0]),
    );
  }
  carcass.add(kit.merged("planter_cap_rail", mat.woodPale, cap));

  // --- Soil and planting -------------------------------------------------------------------
  const bed = kit.group("bed");
  root.add(bed);
  const soilHalf = half - POST - 0.004;
  // The box is FULL of soil, from the ground up. A 90 mm crust floating inside a container
  // is 12 triangles cheaper and shows itself the moment the camera drops below the rim, and
  // the gaps between board courses are exactly where it would be seen.
  bed.add(kit.solo("planter_soil", mat.stoneShadow, kit.box(soilHalf * 2, SOIL_TOP, soilHalf * 2), [0, SOIL_TOP / 2, 0]));

    // The planting radius is the cap rail's OPENING, not the soil's edge. At the soil's edge the
  // outer leaves pushed 60 mm into the rail — found by scripts/asset-geometry-audit.mjs, and
  // visible as foliage growing through solid timber from any low angle.
  const { leaves, stems, flowers } = planting(kit, { soilTop: SOIL_TOP, radius: capOuter - capW - 0.045, blooms: 6, seed: 4100 });
  bed.add(kit.merged("planter_foliage", mat.leaf, leaves));
  bed.add(kit.merged("planter_stems", mat.leaf, stems));
  bed.add(kit.merged("planter_blooms", mat.bloom, flowers));

  // --- Hardware ------------------------------------------------------------------------------
  // Two bolt heads per post face. Small, and the only thing on the model that is not timber.
  const bolts = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (const y of [0.11, 0.3]) {
        bolts.push(place(kit.cyl(0.011, 0.011, 0.016, 6), [sx * (half - POST / 2), y, sz * (half - 0.002)], [Math.PI / 2, 0, 0]));
        bolts.push(place(kit.cyl(0.011, 0.011, 0.016, 6), [sx * (half - 0.002), y, sz * (half - POST / 2)], [0, 0, Math.PI / 2]));
      }
    }
  }
  root.add(kit.merged("planter_bolts", mat.iron, bolts));

  root.userData.measured = summarize(THREE, root);
  return root;
}

export default createVillagePlanterBox;
