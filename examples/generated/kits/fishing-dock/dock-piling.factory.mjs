/**
 * Fishing Dock — standalone mooring pile.
 *
 * The one part of the kit that exists to be scattered rather than assembled: a single timber
 * driven into the lake bed, standing clear of the deck, with a rope turn still on it. Placed
 * in ones and twos off the end of a jetty it is what makes a dock look like it was built over
 * time instead of stamped out in one piece.
 *
 * Reference: a driven square timber pile for a small jetty is 150~250 mm across and stands
 * 0.6~1.2 m proud of the deck. This one is 200 mm and 1.75 m tall overall, so it reads a hand
 * taller than the deck modules' own piles (1.195 m) and does not look like one that fell off.
 *
 * Grounded at y = 0 like everything else in the kit. A pile is driven, not floated, so the
 * bottom of the file is where the lake bed is.
 */
import { DOCK, createKit, finalize, selectMaterials } from "./dock-kit.mjs";

const SIDE = 0.2;
const HEIGHT = 1.75;
/** Where the iron band sits, and where the rope is turned above it. */
const BAND_Y = 1.28;
const ROPE_Y = 1.5;

export default function createDockPiling(THREE) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, ["pileTimber", "iron", "ropeHemp"]);
  const root = kit.group("dock_piling");
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "fishing-dock",
    assetId: "fishing-dock.piling.m1",
    upAxis: "+Y",
    scaleMeters: 1,
    heightMetres: HEIGHT,
  };

  root.add(
    kit.merged("piling_timber", mat.pileTimber, [
      kit.place(kit.bar(SIDE, HEIGHT, SIDE, DOCK.CHAMFER, 1), [0, HEIGHT / 2, 0]),
      // The head is cut back on all four sides. A pile that has been in the water for years
      // is never a sharp sawn square on top, and the extra facet is where the light lands.
      kit.place(kit.chamferBox(SIDE + 0.035, 0.045, SIDE + 0.035, 0.018), [0, HEIGHT + 0.0225, 0]),
    ]),
  );

  // Iron band: four straps, not one box, because a band is a hoop with the timber showing
  // through it. A solid box here would bury 200 mm of the pile a buyer paid triangles for.
  const straps = [];
  for (const [dx, dz, w, d] of [
    [SIDE / 2 + 0.008, 0, 0.016, SIDE + 0.016],
    [-(SIDE / 2 + 0.008), 0, 0.016, SIDE + 0.016],
    [0, SIDE / 2 + 0.008, SIDE - 0.016, 0.016],
    [0, -(SIDE / 2 + 0.008), SIDE - 0.016, 0.016],
  ]) {
    straps.push(kit.place(kit.box(w, 0.075, d), [dx, BAND_Y, dz]));
  }
  root.add(kit.merged("piling_band", mat.iron, straps));

  // Two turns of rope, left where the last boat let go.
  //
  // A square loop of four lengths, not a torus. A rope turned round a SQUARE pile is a rounded
  // square, and a circle big enough to clear the timber's corners stands 77 mm off the middle
  // of each face — it reads as a hoop floating around the pile, not as rope on it. Four bars
  // lie on the four faces the way the rope actually does, and cost less than the torus did.
  const rope = [];
  const reach = SIDE / 2 + 0.024;
  const run = SIDE + 0.052;
  for (const [y, lift] of [[ROPE_Y, 0.014], [ROPE_Y + 0.058, -0.012]]) {
    rope.push(kit.place(kit.box(0.052, 0.052, run), [reach, y + lift, 0]));
    rope.push(kit.place(kit.box(0.052, 0.052, run), [-reach, y - lift, 0]));
    rope.push(kit.place(kit.box(run, 0.052, 0.052), [0, y + lift * 0.4, reach]));
    rope.push(kit.place(kit.box(run, 0.052, 0.052), [0, y - lift * 0.4, -reach]));
  }
  root.add(kit.merged("piling_rope", mat.ropeHemp, rope));

  return finalize(THREE, root);
}
