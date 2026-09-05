/**
 * Village Square 03 — Oil Lamp Post.
 *
 * Reference measurements: a Victorian oil street lamp stands 3.0-3.5 m overall on a 350-400 mm
 * square plinth; the column is 100-130 mm across at the base; the lantern is roughly 320 mm
 * square and 450 mm tall under its cap. This is cut to 3.006 m overall, a 380 mm plinth, a
 * column tapering 130 -> 90 mm, and a 300 mm lantern 400 mm tall.
 *
 * Silhouette contract — what must survive at 10 m: the square plinth, the single tapering
 * column, the ladder bar, and the lantern's four-sided cap with its finial.
 *
 * The panes are the palette's `woodPale`, not a glass value. There is no transparency
 * anywhere in this kit: a pane of flat cream against near-black ironwork reads as lit glass
 * at every distance, and it reads the same in an engine that ignores alpha as in one that
 * does not. `iron` and `brass` are the farm set's own hexes, so this lamp is the same
 * ironmongery as the farm gate's hinges.
 */
import { createKit, place, selectMaterials, summarize } from "./village-kit.mjs";

const PLINTH = 0.38;
const PLINTH_H = 0.22;
const PLINTH_CAP_H = 0.06;
const BASE_TOP = PLINTH_H + PLINTH_CAP_H; // 0.28
const SHOE_H = 0.24; // the flared iron shoe the column rises out of
const COLUMN_BOTTOM = BASE_TOP + SHOE_H; // 0.52
const COLUMN_TOP = 2.24;
const LANTERN_FLOOR = COLUMN_TOP;
const LANTERN_SIDE = 0.3;
const LANTERN_H = 0.4;
const CAP_H = 0.2;

export function createVillageLampPost(THREE) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, ["stoneBody", "stoneLight", "iron", "brass", "woodPale"]);

  const root = kit.group("village_lamp_post");
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "village-square",
    assetId: "village-square.lamp-post.m1",
    upAxis: "+Y",
    scaleMeters: 1,
    heightMetres: LANTERN_FLOOR + 0.04 + LANTERN_H + CAP_H + 0.13,
  };

  // --- Plinth -----------------------------------------------------------------------------
  const plinth = kit.group("plinth");
  root.add(plinth);
  plinth.add(kit.solo("lamp_plinth", mat.stoneBody, kit.box(PLINTH, PLINTH_H, PLINTH), [0, PLINTH_H / 2, 0]));
  plinth.add(
    kit.solo(
      "lamp_plinth_cap",
      mat.stoneLight,
      kit.prism(kit.chamferProfile(PLINTH - 0.05, PLINTH_CAP_H, 0.014), PLINTH - 0.05),
      [0, PLINTH_H + PLINTH_CAP_H / 2, 0],
    ),
  );

  // --- Column -----------------------------------------------------------------------------
  const column = kit.group("column");
  root.add(column);
  const iron = [];
  // Flared shoe, so the column grows out of the stone instead of being stuck into it.
  iron.push(place(kit.cyl(0.065, 0.15, SHOE_H, 8), [0, BASE_TOP + SHOE_H / 2, 0]));
  iron.push(place(kit.cyl(0.045, 0.065, COLUMN_TOP - COLUMN_BOTTOM, 8), [0, (COLUMN_TOP + COLUMN_BOTTOM) / 2, 0]));
  // Two collars break the column's length; without them a 1.7 m taper reads as a pipe.
  for (const y of [COLUMN_BOTTOM + 0.5, COLUMN_TOP - 0.22]) {
    iron.push(place(kit.cyl(0.062, 0.062, 0.05, 8), [0, y, 0]));
  }
  // The ladder bar a lamplighter rests a ladder against. It is the one asymmetric detail on
  // the whole post and it is what stops the silhouette being a stick with a box on it.
  iron.push(place(kit.cyl(0.016, 0.016, 0.4, 6), [0, COLUMN_TOP - 0.42, 0], [0, 0, Math.PI / 2]));
  for (const side of [-1, 1]) {
    iron.push(place(kit.box(0.03, 0.09, 0.03), [side * 0.19, COLUMN_TOP - 0.375, 0]));
  }
  column.add(kit.merged("lamp_column", mat.iron, iron));

  // --- Lantern ------------------------------------------------------------------------------
  const lantern = kit.group("lantern");
  root.add(lantern);

  const frame = [];
  frame.push(place(kit.box(LANTERN_SIDE + 0.04, 0.04, LANTERN_SIDE + 0.04), [0, LANTERN_FLOOR + 0.02, 0]));
  const half = LANTERN_SIDE / 2;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      frame.push(place(kit.box(0.028, LANTERN_H, 0.028), [sx * (half - 0.014), LANTERN_FLOOR + 0.04 + LANTERN_H / 2, sz * (half - 0.014)]));
    }
  }
  // Head ring the cap sits on.
  frame.push(place(kit.box(LANTERN_SIDE + 0.04, 0.04, LANTERN_SIDE + 0.04), [0, LANTERN_FLOOR + 0.04 + LANTERN_H + 0.02, 0]));
  lantern.add(kit.merged("lamp_lantern_frame", mat.iron, frame));

  /*
   * Four panes, 20 mm thick, standing on the lantern floor and stopping short of the corner
   * posts in both directions. Nothing in this kit is a zero-thickness card and nothing in it
   * depends on a back face being drawn: each pane is a solid slab with two visible faces.
   */
  const panes = [];
  const paneW = LANTERN_SIDE - 0.075;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const geometry = dx !== 0 ? kit.box(0.02, LANTERN_H - 0.05, paneW) : kit.box(paneW, LANTERN_H - 0.05, 0.02);
    panes.push(place(geometry, [dx * (half - 0.015), LANTERN_FLOOR + 0.04 + (LANTERN_H - 0.05) / 2, dz * (half - 0.015)]));
  }
  lantern.add(kit.merged("lamp_panes", mat.woodPale, panes));

  // Cap: a four-sided pyramid in two steps, so the roof has a course line rather than being
  // one smooth cone, and a brass finial on top.
  const capY = LANTERN_FLOOR + 0.04 + LANTERN_H + 0.04;
  lantern.add(
    kit.merged("lamp_cap", mat.iron, [
      // A four-segment cylinder puts its VERTICES on the axes, so a square cap that is to
      // face front has to be turned 45 degrees and its radius taken to the corner:
      // half-side * sqrt(2). Skip either half of that and the cap sits diagonally on a
      // lantern whose panes are square to the world.
      place(kit.cyl(0.1 * Math.SQRT2, 0.185 * Math.SQRT2, CAP_H * 0.55, 4), [0, capY + (CAP_H * 0.55) / 2, 0], [0, Math.PI / 4, 0]),
      place(kit.cyl(0.03 * Math.SQRT2, 0.1 * Math.SQRT2, CAP_H * 0.45, 4), [0, capY + CAP_H * 0.55 + (CAP_H * 0.45) / 2, 0], [0, Math.PI / 4, 0]),
    ]),
  );
  lantern.add(
    kit.merged("lamp_finial", mat.brass, [
      place(kit.cyl(0.014, 0.02, 0.07, 6), [0, capY + CAP_H + 0.035, 0]),
      place(kit.blob(0.045, 1, 1.1, 1), [0, capY + CAP_H + 0.1, 0]),
    ]),
  );

  root.userData.measured = summarize(THREE, root);
  return root;
}

export default createVillageLampPost;
