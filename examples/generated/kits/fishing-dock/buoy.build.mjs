/**
 * Fishing Dock — the two mooring buoys.
 *
 * These are TWO SHAPES, not one shape in two colours. A kit that ships a red buoy and a white
 * buoy that differ only by a hex value is a kit with nine parts and a recolour, and this one
 * says it has ten:
 *
 *   red    a squat can buoy — a fat float with a flat top, a lifting eye and a chain shackle.
 *          0.52 m across, 0.58 m tall. What a small boat is moored to.
 *   white  a tall spar buoy — a slim float on a mast with a cross topmark, the mark that stands
 *          out of a chop. 0.36 m across the float, 1.26 m tall.
 *
 * Both FLOAT, and both sit on y = 0 in the file for the reason the rowboat does: whoever buys
 * them decides where the water is. Each publishes its own draft instead, so sinking the model
 * by that much puts the painted band exactly on the surface.
 *
 * Reference: a small-craft mooring buoy float is 0.40~0.60 m across; a spar buoy stands
 * 1.0~1.5 m out of the water.
 */
import { createKit, finalize, selectMaterials } from "./dock-kit.mjs";

export const BUOY_DRAFT = { red: 0.235, white: 0.2 };

export function buildBuoy(THREE, variant) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, ["buoyRed", "hullWhite", "hullBlue", "iron", "ropeHemp"]);
  const root = kit.group(`dock_buoy_${variant}`);
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "fishing-dock",
    assetId: `fishing-dock.buoy-${variant}.m1`,
    upAxis: "+Y",
    scaleMeters: 1,
    floats: true,
    draftMetres: BUOY_DRAFT[variant],
  };

  if (variant === "red") {
    // --- can buoy --------------------------------------------------------------------------
    // The hull is lathed in three pieces so the painted band is a real band of geometry rather
    // than a stripe fighting the hull for the same surface. Coplanar paint z-fights; this does
    // not, and it costs one extra ring of triangles.
    root.add(
      kit.solo("buoy_hull_lower", mat.buoyRed, kit.lathe([
        [0.05, 0],
        [0.14, 0.015],
        [0.225, 0.075],
        [0.26, 0.18],
        [0.26, 0.3],
      ], 12)),
    );
    // The band overlaps the two hull pieces by 5 mm and stands 3 mm proud of them. Butting it
    // flush would put two discs on the same plane, which is the z-fighting seam every painted
    // stripe on an untextured model produces if it is not given its own thickness.
    root.add(kit.solo("buoy_band", mat.hullWhite, kit.lathe([[0.263, 0.295], [0.263, 0.4]], 12)));
    root.add(
      kit.solo("buoy_hull_upper", mat.buoyRed, kit.lathe([
        [0.26, 0.395],
        [0.24, 0.47],
        [0.185, 0.53],
        [0.16, 0.545],
        [0, 0.552],
      ], 12)),
    );
    root.add(
      kit.merged("buoy_ironwork", mat.iron, [
        // Lifting eye on the crown.
        kit.place(kit.cyl(0.03, 0.03, 0.05, 6), [0, 0.575, 0]),
        kit.place(kit.torus(0.045, 0.012, 4, 10), [0, 0.63, 0], [0, Math.PI / 2, 0]),
        // Shackle and the first link of the mooring chain, under the float.
        kit.place(kit.torus(0.05, 0.013, 4, 10), [0, 0.02, 0], [0, Math.PI / 2, 0]),
      ]),
    );
    root.add(
      kit.merged("buoy_pennant", mat.ropeHemp, [
        kit.place(kit.cyl(0.017, 0.017, 0.2, 6), [0.045, 0.6, 0.075], [0.3, 0, 0.42]),
        kit.place(kit.torus(0.075, 0.017, 4, 10), [0.13, 0.52, 0.115], [1.2, 0.4, 0.3]),
      ]),
    );
  } else {
    // --- spar buoy -------------------------------------------------------------------------
    root.add(
      kit.solo("buoy_hull_lower", mat.hullWhite, kit.lathe([
        [0.04, 0],
        [0.1, 0.02],
        [0.165, 0.085],
        [0.18, 0.19],
        [0.18, 0.28],
      ], 12)),
    );
    root.add(kit.solo("buoy_band", mat.hullBlue, kit.lathe([[0.183, 0.275], [0.183, 0.36]], 12)));
    root.add(
      kit.solo("buoy_hull_upper", mat.hullWhite, kit.lathe([
        [0.18, 0.355],
        [0.15, 0.44],
        [0.09, 0.5],
        [0.055, 0.53],
        [0, 0.535],
      ], 12)),
    );
    // The mast and the cross topmark: the reason a spar buoy exists is to be seen over a chop,
    // and the topmark is the part that is seen.
    root.add(
      kit.merged("buoy_mast", mat.iron, [
        kit.place(kit.cyl(0.019, 0.026, 0.62, 6), [0, 0.83, 0]),
        kit.place(kit.box(0.3, 0.028, 0.028), [0, 1.11, 0]),
        kit.place(kit.box(0.028, 0.028, 0.3), [0, 1.11, 0]),
        kit.place(kit.cyl(0.03, 0.03, 0.03, 6), [0, 1.155, 0]),
        kit.place(kit.torus(0.05, 0.011, 4, 10), [0, 0.02, 0], [0, Math.PI / 2, 0]),
      ]),
    );
    root.add(
      kit.merged("buoy_topmark", mat.hullBlue, [
        kit.place(kit.chamferBox(0.15, 0.15, 0.02, 0.008), [0, 1.24, 0]),
        kit.place(kit.chamferBox(0.02, 0.15, 0.15, 0.008), [0, 1.24, 0]),
      ]),
    );
  }

  return finalize(THREE, root);
}
