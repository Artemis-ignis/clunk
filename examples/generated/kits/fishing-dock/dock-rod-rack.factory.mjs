/**
 * Fishing Dock — rod rack with three rods laid in it.
 *
 * Two timber trestles 1.24 m apart, each with a saddled cross rail, and a shelf board between
 * them for the tackle box. The rods lie ALONG the rack across both saddles, which is the only
 * arrangement that actually holds a rod up: a single rail is a pivot, not a rest, and the
 * first pass of this part had the rods balanced on one.
 *
 * The rods are part of the product. A rack photographed empty is a picture of two trestles.
 *
 * Reference: a lake rod is 1.8~2.7 m; a bank rack stands 0.8~1.1 m to the rail. Measured here:
 * 2.05 m rods on saddles 0.95 m up, the whole product inside one 2 m deck module in width.
 */
import { DOCK, createKit, finalize, selectMaterials } from "./dock-kit.mjs";

const SADDLE_Y = 0.95;
/** The two trestles, and how far each leg splays out at the foot. */
const TRESTLE_X = [-0.62, 0.62];
const SPLAY = 0.16;
const WIDTH = 0.8;
const SHELF_Y = 0.3;
const ROD_LENGTH = 2.05;
/** Where the three rods lie across the saddles. */
const ROD_Z = [-0.24, 0.0, 0.24];
const ROD_TILT = 0.045;

export default function createDockRodRack(THREE) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, ["pileTimber", "dockPlank", "dockPlankPale", "iron", "ropeHemp", "hullBlue"]);
  const root = kit.group("dock_rod_rack");
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "fishing-dock",
    assetId: "fishing-dock.rod-rack.m1",
    upAxis: "+Y",
    scaleMeters: 1,
    rodCount: ROD_Z.length,
  };

  // ---- trestles ---------------------------------------------------------------------------
  const frame = [];
  const legLength = Math.hypot(SADDLE_Y, SPLAY + WIDTH / 2 - 0.06);
  const lean = Math.atan2(SPLAY, SADDLE_Y);
  for (const x of TRESTLE_X) {
    for (const sz of [-1, 1]) {
      const foot = sz * (WIDTH / 2 - 0.03 + SPLAY);
      const head = sz * (WIDTH / 2 - 0.03);
      frame.push(
        kit.place(kit.bar(0.06, Math.hypot(SADDLE_Y, foot - head), 0.06, DOCK.CHAMFER, 1), [
          x,
          SADDLE_Y / 2,
          (foot + head) / 2,
        // Minus, not plus. Rotating +Y about +X by a positive angle tilts the top toward +Z,
        // which splayed the trestle the wrong way up: wide at the rail, narrow on the deck.
        ], [-sz * lean, 0, 0]),
      );
    }
    // A foot pad under each pair, so the trestle stands on soles instead of on sawn ends.
    frame.push(kit.place(kit.bar(0.11, 0.045, WIDTH + SPLAY * 2, DOCK.CHAMFER, 2), [x, 0.0225, 0]));
    // A cross brace, which is what stops a trestle folding sideways.
    frame.push(kit.place(kit.bar(0.055, 0.04, WIDTH + SPLAY * 0.25, DOCK.CHAMFER, 2), [x, 0.56, 0]));
  }
  root.add(kit.merged("rack_trestles", mat.pileTimber, frame));
  void legLength;

  // ---- saddles and shelf -------------------------------------------------------------------
  //
  // The saddle rail is cut into three by a pair of blocks per rod, rather than being a plain
  // bar. A rod on a plain rail rolls off; the blocks are what make this a rack.
  const rails = [];
  for (const x of TRESTLE_X) {
    rails.push(kit.place(kit.bar(0.09, 0.055, WIDTH + 0.06, DOCK.CHAMFER, 2), [x, SADDLE_Y - 0.0275, 0]));
    for (const z of ROD_Z) {
      for (const sz of [-1, 1]) {
        rails.push(kit.place(kit.bar(0.09, 0.05, 0.026, DOCK.CHAMFER, 0), [x, SADDLE_Y + 0.025, z + sz * 0.038]));
      }
    }
  }
  for (let i = 0; i < 4; i += 1) {
    const z = -0.27 + i * 0.18;
    rails.push(kit.place(kit.bar(TRESTLE_X[1] - TRESTLE_X[0] + 0.12, 0.024, 0.15, DOCK.CHAMFER, 0), [0, SHELF_Y, z]));
  }
  root.add(kit.merged("rack_rails", mat.dockPlank, rails));

  // ---- rods --------------------------------------------------------------------------------
  //
  // Each rod is a butt section and a tip section on ONE line through both saddles, joined at
  // the ferrule where a real rod is joined. The tip finishes at 12 mm across — a solid round,
  // not a card, so it survives from every angle.
  const rods = [];
  const direction = [Math.cos(ROD_TILT), Math.sin(ROD_TILT)];
  const restY = SADDLE_Y + 0.014;
  const along = (t) => [direction[0] * t, restY + direction[1] * t];
  for (const z of ROD_Z) {
    const buttLength = ROD_LENGTH * 0.4;
    const tipLength = ROD_LENGTH * 0.6;
    const buttCentre = along(-ROD_LENGTH / 2 + buttLength / 2);
    const tipCentre = along(-ROD_LENGTH / 2 + buttLength + tipLength / 2);
    const gripCentre = along(-ROD_LENGTH / 2 + 0.075);
    // 2026-09-05: the first pass drew the rods at 7~21 mm and the storefront render showed
    // three hairlines. A rod thick enough to read at thumbnail size is what is sold here, so
    // the sections are 12~28 mm and the tip still tapers.
    rods.push(kit.place(kit.cyl(0.021, 0.028, buttLength, 6), [buttCentre[0], buttCentre[1], z], [0, 0, Math.PI / 2 - ROD_TILT]));
    rods.push(kit.place(kit.cyl(0.006, 0.021, tipLength, 6), [tipCentre[0], tipCentre[1], z], [0, 0, Math.PI / 2 - ROD_TILT]));
    rods.push(kit.place(kit.cyl(0.033, 0.033, 0.15, 6), [gripCentre[0], gripCentre[1], z], [0, 0, Math.PI / 2 - ROD_TILT]));
  }
  root.add(kit.merged("rack_rods", mat.dockPlankPale, rods));

  // Reels on the two outer rods: a spool, a foot and a handle.
  const reels = [];
  for (const z of [ROD_Z[0], ROD_Z[2]]) {
    const seat = along(-ROD_LENGTH / 2 + 0.22);
    // The foot runs from the rod's own centreline down to the spool. Hung 40 mm under the rod
    // instead, the whole reel measured 5.5 mm clear of everything — a reel floating below a rod
    // it is supposed to be clamped to.
    reels.push(kit.place(kit.cyl(0.075, 0.075, 0.048, 8), [seat[0], seat[1] - 0.09, z], [Math.PI / 2, 0, 0]));
    reels.push(kit.place(kit.box(0.034, 0.1, 0.034), [seat[0], seat[1] - 0.045, z]));
    reels.push(kit.place(kit.cyl(0.015, 0.015, 0.07, 6), [seat[0], seat[1] - 0.09, z + 0.055], [0, 0, Math.PI / 2]));
  }
  root.add(kit.merged("rack_reels", mat.iron, reels));

  // Tackle box on the shelf, and a hank of line hung off the near saddle.
  root.add(
    kit.merged("rack_tackle_box", mat.hullBlue, [
      kit.place(kit.chamferBox(0.32, 0.135, 0.22, 0.012), [-0.03, SHELF_Y + 0.08, 0.05]),
      kit.place(kit.chamferBox(0.33, 0.03, 0.23, 0.01), [-0.03, SHELF_Y + 0.162, 0.05]),
      kit.place(kit.box(0.05, 0.022, 0.03), [-0.03, SHELF_Y + 0.115, 0.17]),
    ]),
  );
  const line = [];
  for (let i = 0; i < 2; i += 1) {
    line.push(
      kit.place(kit.torus(0.085 - i * 0.012, 0.019, 4, 10), [TRESTLE_X[0], SADDLE_Y - 0.15 + i * 0.028, -WIDTH / 2 - 0.02], [0, Math.PI / 2, 0.3 + i * 0.4]),
    );
  }
  root.add(kit.merged("rack_line", mat.ropeHemp, line));

  return finalize(THREE, root);
}
