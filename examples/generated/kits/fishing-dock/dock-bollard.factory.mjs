/**
 * Fishing Dock — cast-iron mooring bollard, bolted through the deck.
 *
 * A mushroom-head bollard on a flanged base with four countersunk bolts, and one turn of rope
 * belayed round the neck. The head is what does the work: a rope over a straight post lifts off,
 * a rope under a flared head does not, and the flare is the shape a buyer recognises.
 *
 * Reference: a small-pier bollard is 0.35~0.60 m tall with a 0.20~0.30 m head. Measured here:
 * 0.47 m tall, 0.30 m across the head, on a 0.32 m base flange.
 */
import { createKit, finalize, selectMaterials } from "./dock-kit.mjs";

export default function createDockBollard(THREE) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, ["iron", "ropeHemp"]);
  const root = kit.group("dock_bollard");
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "fishing-dock",
    assetId: "fishing-dock.bollard.m1",
    upAxis: "+Y",
    scaleMeters: 1,
  };

  root.add(
    kit.solo("bollard_body", mat.iron, kit.lathe([
      [0.16, 0],
      [0.16, 0.035],
      [0.125, 0.06],
      [0.105, 0.1],
      [0.098, 0.29],
      [0.13, 0.35],
      [0.15, 0.405],
      [0.115, 0.445],
      [0.06, 0.468],
      [0, 0.47],
    ], 12)),
  );

  // Four bolts through the flange. They stand 12 mm proud, so the flange reads as fixed down
  // rather than as a disc resting on the boards.
  const bolts = [];
  for (let i = 0; i < 4; i += 1) {
    const angle = Math.PI / 4 + (i * Math.PI) / 2;
    bolts.push(kit.place(kit.cyl(0.021, 0.021, 0.024, 6), [Math.cos(angle) * 0.128, 0.041, Math.sin(angle) * 0.128]));
  }
  root.add(kit.merged("bollard_bolts", mat.iron, bolts));

  // One turn of rope in the waist, under the head where it belongs. The torus sits at radius
  // 0.126 against a 0.098 neck, so the rope lies on the iron with 2 mm of it biting in — a
  // rope drawn at a clear distance from the post reads as a hoop hanging in the air.
  root.add(
    kit.merged("bollard_rope", mat.ropeHemp, [
      kit.place(kit.torus(0.126, 0.028, 4, 12), [0, 0.235, 0], [Math.PI / 2, 0, 0]),
      kit.place(kit.torus(0.126, 0.028, 4, 12), [0.004, 0.29, 0], [Math.PI / 2 + 0.05, 0, 0]),
      // The standing part: off the turn, down the side of the post and away across the boards,
      // so the rope has somewhere to have come from. The last length lies ON y = 0 — the flange
      // is bolted straight to the deck, so the model's ground plane IS the deck surface and a
      // rope drawn above it would be a rope hovering over the boards.
      kit.place(kit.cyl(0.028, 0.028, 0.24, 6), [0.2, 0.16, -0.05], [0, 0.2, 2.05]),
      kit.place(kit.cyl(0.028, 0.028, 0.34, 6), [0.42, 0.028, -0.1], [0, 0.24, Math.PI / 2]),
    ]),
  );

  return finalize(THREE, root);
}
