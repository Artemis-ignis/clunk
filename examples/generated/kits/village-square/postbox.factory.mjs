/**
 * Village Square 08 — Post-mounted Letter Box.
 *
 * Reference measurements: a rural lamp-box or pole box hangs with its aperture at 900-1200 mm
 * so it can be posted into without stooping; the box itself is 300-360 mm wide, 250-300 mm
 * deep and 380-450 mm tall; the aperture is 230-260 x 25-35 mm. This is cut to an aperture at
 * 1.310 m, a 340 x 260 x 400 mm box, and a 240 x 30 mm slot.
 *
 * THE SLOT IS A SLOT, NOT A HOLE
 * ------------------------------
 * The body is solid. A real aperture would need the box to be hollow, which at this triangle
 * count means either a five-sided shell whose interior is drawn only if back faces are (this
 * kit's rule says no) or a cavity nobody will ever see. Instead the slot is built the way a
 * pillar box actually presents one: a raised brass surround standing 20 mm proud of the face,
 * with a dark plate set inside its opening. The step casts the shadow, the dark plate is the
 * shadow's floor, and the box stays a closed solid.
 *
 * The two meshes are named `postbox_aperture_*`, never `*_slot_*`. "slot" is one of the words
 * the catalogue reads as a MOVING PART (app/components/catalog-facts.ts, via the animatedParts
 * list the hero renderer builds), and a letter slot named that way turned this postbox into a
 * grade-A listing with motion it does not have.
 */
import { createKit, place, selectMaterials, summarize } from "./village-kit.mjs";

const BASE = 0.26;
const BASE_H = 0.16;
const POST_SIDE = 0.11;
const BOX_BOTTOM = 1.1;
const BOX_W = 0.34;
const BOX_D = 0.26;
const BOX_H = 0.4;
const BOX_TOP = BOX_BOTTOM + BOX_H; // 1.50
const LID_H = 0.12;
const SLOT_Y = 1.31;
const BRACKET_H = 0.035;

export function createVillagePostbox(THREE) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, ["stoneBody", "stoneShadow", "woodFrame", "iron", "brass", "roofTile"]);

  const root = kit.group("village_postbox");
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "village-square",
    assetId: "village-square.postbox.m1",
    upAxis: "+Y",
    scaleMeters: 1,
    apertureHeightMetres: SLOT_Y,
    facing: "+Z",
  };

  // --- Base and post -------------------------------------------------------------------
  const base = kit.group("base");
  root.add(base);
  base.add(kit.solo("postbox_base", mat.stoneBody, kit.prism(kit.chamferProfile(BASE, BASE_H, 0.016), BASE), [0, BASE_H / 2, 0]));
  /*
   * The post stops AT the box's underside and a bracket plate carries the box off it.
   *
   * The first build ran the post 80 mm up inside the body, and the geometry audit reported
   * exactly that: half the post's vertices inside the box. Eighty millimetres of timber nobody
   * will ever see, and a defect on any report a buyer runs. A lamp box on a pole is carried by
   * a plate, so it is carried by a plate.
   */
  base.add(
    kit.solo("postbox_post", mat.woodFrame, kit.beam(POST_SIDE, POST_SIDE, BOX_BOTTOM - BRACKET_H - BASE_H), [
      0,
      (BOX_BOTTOM - BRACKET_H + BASE_H) / 2,
      0,
    ], [Math.PI / 2, 0, 0]),
  );
  base.add(
    kit.solo("postbox_bracket", mat.iron, kit.box(0.22, BRACKET_H, 0.2), [0, BOX_BOTTOM - BRACKET_H / 2, 0]),
  );

  // --- Body -----------------------------------------------------------------------------
  const body = kit.group("body");
  root.add(body);
  body.add(kit.solo("postbox_body", mat.iron, kit.prism(kit.chamferProfile(BOX_W, BOX_H, 0.014), BOX_D), [0, BOX_BOTTOM + BOX_H / 2, 0]));

  // Rivets down both front corners: the one detail that says sheet steel folded and joined.
  const rivets = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i += 1) {
      rivets.push(
        place(kit.cyl(0.009, 0.009, 0.012, 6), [side * (BOX_W / 2 - 0.022), BOX_BOTTOM + 0.06 + i * 0.093, BOX_D / 2], [Math.PI / 2, 0, 0]),
      );
    }
  }
  body.add(kit.merged("postbox_rivets", mat.iron, rivets));

  // --- Aperture ---------------------------------------------------------------------------
  const aperture = kit.group("aperture");
  root.add(aperture);
  const SLOT_W = 0.24;
  const SLOT_H = 0.03;
  const SURROUND_T = 0.02;
  aperture.add(
    kit.merged("postbox_aperture_surround", mat.brass, [
      place(kit.box(SLOT_W + 0.06, 0.026, SURROUND_T), [0, SLOT_Y + SLOT_H / 2 + 0.013, BOX_D / 2 + SURROUND_T / 2]),
      place(kit.box(SLOT_W + 0.06, 0.026, SURROUND_T), [0, SLOT_Y - SLOT_H / 2 - 0.013, BOX_D / 2 + SURROUND_T / 2]),
      place(kit.box(0.026, SLOT_H + 0.052, SURROUND_T), [SLOT_W / 2 + 0.017, SLOT_Y, BOX_D / 2 + SURROUND_T / 2]),
      place(kit.box(0.026, SLOT_H + 0.052, SURROUND_T), [-(SLOT_W / 2 + 0.017), SLOT_Y, BOX_D / 2 + SURROUND_T / 2]),
      // The hood over the slot, which is what keeps rain out of a real one.
      place(kit.box(SLOT_W + 0.09, 0.018, 0.045), [0, SLOT_Y + 0.045, BOX_D / 2 + 0.022], [0.28, 0, 0]),
    ]),
  );
  // The dark plate inside the surround's opening: the slot's floor, standing on the body face.
  aperture.add(
    kit.solo("postbox_aperture_plate", mat.stoneShadow, kit.box(SLOT_W, SLOT_H, 0.012), [0, SLOT_Y, BOX_D / 2 + 0.006]),
  );

  // Collection plate below the slot — a real box always carries one and it balances the face.
  aperture.add(kit.solo("postbox_plate", mat.brass, kit.box(0.19, 0.075, 0.01), [0, BOX_BOTTOM + 0.13, BOX_D / 2 + 0.005]));

  // --- Lid ------------------------------------------------------------------------------
  // A gabled lid rather than a flat one, in the kit's roof-tile value, so the postbox belongs
  // to the same street as the well's roof and the notice board's.
  const lid = kit.group("lid");
  root.add(lid);
  const lidHalf = BOX_W / 2 + 0.03;
  const eaveHalfZ = BOX_D / 2 + 0.03;
  const RISE = LID_H - 0.03;
  const pitch = Math.atan2(RISE, eaveHalfZ);
  const slopeLen = Math.hypot(RISE, eaveHalfZ);
  lid.add(
    kit.merged("postbox_lid", mat.roofTile, [
      place(kit.box(lidHalf * 2, 0.03, eaveHalfZ * 2), [0, BOX_TOP + 0.015, 0]),
      // A gable, not a pyramid: the box is rectangular, and a square pyramid on a rectangle
      // overhangs one pair of faces and not the other.
      ...[-1, 1].map((side) =>
        place(kit.box(lidHalf * 2, 0.032, slopeLen), [0, BOX_TOP + 0.03 + RISE / 2, side * (eaveHalfZ / 2)], [side * pitch, 0, 0]),
      ),
      place(kit.box(lidHalf * 2 + 0.02, 0.03, 0.05), [0, BOX_TOP + 0.03 + RISE, 0]),
    ]),
  );
  lid.add(kit.merged("postbox_finial", mat.brass, [
    place(kit.cyl(0.012, 0.016, 0.05, 6), [0, BOX_TOP + 0.03 + RISE + 0.04, 0]),
  ]));

  root.userData.measured = summarize(THREE, root);
  return root;
}

export default createVillagePostbox;
