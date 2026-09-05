/**
 * Fishing Dock — the fish crate, in its two states.
 *
 * A slatted box, not a solid one. The slats are the whole point: a fish crate is built with
 * air gaps so the catch drains and the ice melts through, and a closed box painted with slat
 * lines is the exact tell of an asset that was modelled from a photograph of a crate rather
 * than from a crate.
 *
 * Reference: a stacking fish box is 0.60~0.75 m long, 0.40~0.45 m wide and 0.28~0.34 m deep,
 * with 60~90 mm slats. Measured here at 0.66 x 0.42 x 0.31 m outside the corner posts.
 *
 * Two variants share every dimension, so the open one drops into the closed one's footprint:
 *   closed  boarded lid with two cleats
 *   open    no lid, five fish and a scoop of ice inside
 */
import { DOCK, createKit, finalize, hashSigned, selectMaterials } from "./dock-kit.mjs";

const LENGTH = 0.66;
const WIDTH = 0.42;
const HEIGHT = 0.31;
/** Corner post section. Everything else is hung on these four. */
const POST = 0.05;
const SLAT_H = 0.072;
const SLAT_T = 0.019;
/** Three slats a side, spread over the height with real gaps between them. */
const SLAT_Y = [0.045, 0.15, 0.255];

export function buildFishCrate(THREE, variant) {
  const kit = createKit(THREE);
  const roles = ["dockPlankPale", "dockPlank", "iron"];
  if (variant === "open") roles.push("fishSilver", "hullWhite", "hullBlue");
  const mat = selectMaterials(THREE, roles);
  const root = kit.group(`dock_fish_crate_${variant}`);
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "fishing-dock",
    assetId: `fishing-dock.fish-crate-${variant}.m1`,
    upAxis: "+Y",
    scaleMeters: 1,
    outsideMetres: [LENGTH, HEIGHT, WIDTH],
  };

  // ---- corner posts and floor -------------------------------------------------------------
  const frame = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      frame.push(
        kit.place(kit.bar(POST, HEIGHT, POST, DOCK.CHAMFER, 1), [
          sx * (LENGTH / 2 - POST / 2),
          HEIGHT / 2,
          sz * (WIDTH / 2 - POST / 2),
        ]),
      );
    }
  }
  // Floor boards, laid across the short way and inset so they sit between the posts.
  for (let i = 0; i < 4; i += 1) {
    const x = -LENGTH / 2 + POST + 0.045 + i * 0.14;
    frame.push(kit.place(kit.bar(0.115, 0.022, WIDTH - POST * 2 + 0.02, DOCK.CHAMFER, 2), [x, 0.033, 0]));
  }
  root.add(kit.merged("crate_frame", mat.dockPlank, frame));

  // ---- slats ------------------------------------------------------------------------------
  const slats = [];
  for (const y of SLAT_Y) {
    for (const sz of [-1, 1]) {
      slats.push(kit.place(kit.bar(LENGTH - POST * 2 + 0.006, SLAT_H, SLAT_T, DOCK.CHAMFER, 0), [0, y, sz * (WIDTH / 2 - SLAT_T / 2)]));
    }
    for (const sx of [-1, 1]) {
      slats.push(kit.place(kit.bar(SLAT_T, SLAT_H, WIDTH - POST * 2 + 0.006, DOCK.CHAMFER, 2), [sx * (LENGTH / 2 - SLAT_T / 2), y, 0]));
    }
  }
  root.add(kit.merged("crate_slats", mat.dockPlankPale, slats));

  // ---- corner straps ----------------------------------------------------------------------
  const iron = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      iron.push(kit.place(kit.box(POST + 0.014, 0.03, POST + 0.014), [sx * (LENGTH / 2 - POST / 2), 0.02, sz * (WIDTH / 2 - POST / 2)]));
    }
  }
  root.add(kit.merged("crate_straps", mat.iron, iron));

  if (variant === "closed") {
    // ---- lid ------------------------------------------------------------------------------
    const lid = [];
    for (let i = 0; i < 4; i += 1) {
      const z = -WIDTH / 2 + 0.06 + i * 0.1;
      lid.push(kit.place(kit.bar(LENGTH + 0.02, 0.024, 0.088, DOCK.CHAMFER, 0), [0, HEIGHT + 0.012, z]));
    }
    for (const sx of [-1, 1]) {
      lid.push(kit.place(kit.bar(0.05, 0.028, WIDTH - 0.02, DOCK.CHAMFER, 2), [sx * (LENGTH / 2 - 0.08), HEIGHT + 0.038, 0]));
    }
    root.add(kit.merged("crate_lid", mat.dockPlank, lid));
  } else {
    // ---- catch ----------------------------------------------------------------------------
    //
    // Five fish, each a faceted body with a tail and a dorsal fin — 4 mm is the kit's floor for
    // a thickness and the fins are 9 mm, so nothing here is a card. They lie across the crate
    // the way a landed catch does, not stacked in a grid.
    const fish = [];
    const layout = [
      [-0.19, 0.075, -0.09, 0.5],
      [-0.05, 0.072, 0.08, -0.35],
      [0.11, 0.078, -0.06, 0.22],
      [0.22, 0.07, 0.09, -0.6],
      [-0.02, 0.115, -0.02, 1.05],
    ];
    for (const [x, y, z, yaw] of layout) {
      const wobble = 0.9 + 0.14 * hashSigned(x, y, z, 29);
      fish.push(kit.place(kit.blob(0.072 * wobble, 1.65, 0.62, 0.78, 0), [x, y, z], [0, yaw, 0.08]));
      fish.push(kit.place(kit.chamferBox(0.075, 0.062, 0.009, 0.004), [x - Math.cos(yaw) * 0.13 * wobble, y + 0.006, z + Math.sin(yaw) * 0.13 * wobble], [0, yaw, 0.25]));
      fish.push(kit.place(kit.chamferBox(0.062, 0.032, 0.009, 0.004), [x, y + 0.042 * wobble, z], [0, yaw, 0]));
    }
    root.add(kit.merged("crate_fish", mat.fishSilver, fish));

    // Crushed ice under the catch. Six faceted lumps, so the crate does not read as five fish
    // hovering over a wooden floor.
    const ice = [];
    for (let i = 0; i < 6; i += 1) {
      const x = -0.24 + i * 0.096;
      const z = 0.09 * hashSigned(i, 3, 0, 37);
      ice.push(kit.place(kit.blob(0.055 + 0.012 * hashSigned(i, 5, 0, 43), 1.3, 0.5, 1.15, 0), [x, 0.052, z], [0, i * 0.7, 0]));
    }
    root.add(kit.merged("crate_ice", mat.hullWhite, ice));
  }

  return finalize(THREE, root);
}
