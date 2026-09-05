/**
 * Fishing Dock — the small harbour light at the end of the jetty.
 *
 * The one structure in the kit. A banded octagonal tower on a stone plinth, a railed gallery,
 * a glazed lantern room and a rotating beacon inside it.
 *
 * WHY IT IS THIS SMALL
 * --------------------
 * A real harbour-entrance light is 4~8 m to the gallery and stands on a breakwater. This one
 * is 3.24 m to the gallery and 4.30 m overall, with a 1.40 m plinth — small enough to stand on
 * a single 2 m deck module without hanging over the edge, which is the difference between a
 * lighthouse that belongs to this kit and one that has to be sold with a pier.
 *
 * WHY THE BANDS ARE GEOMETRY
 * --------------------------
 * The red and white bands are four separate lathed sections of tower, each overlapping the
 * next by 8 mm. Painting them as coplanar rings on one tower is what produces the z-fighting
 * stripe every untextured banded object gets. Eight rings of triangles is the price and it is
 * the whole reason this reads as a lighthouse in a thumbnail.
 *
 * MOTION
 * ------
 * One clip, `beacon-spin`: the lamp assembly under `beacon_pivot` turns a full circle in six
 * seconds, split into quarters so LINEAR quaternion interpolation takes the short way round
 * each time instead of collapsing a 0-to-360 key pair into no motion at all — the same trap
 * the windmill template documents.
 */
import { createKit, finalize, selectMaterials } from "./dock-kit.mjs";

const SEG = 8;
/** Plinth, tower and gallery heights, all measured from the base of the plinth. */
const PLINTH_TOP = 0.34;
const TOWER_TOP = 3.06;
const GALLERY_Y = 3.24;
const LANTERN_FLOOR = 3.32;
const LANTERN_TOP = 3.86;
const GALLERY_R = 0.72;

/** Radius of the tower at a height, so every section agrees on the taper. */
const taperAt = (y) => 0.6 - ((y - PLINTH_TOP) / (TOWER_TOP - PLINTH_TOP)) * 0.16;

/** One banded section of tower, with 8 mm of overlap onto the next so no two faces are coplanar. */
function band(kit, from, to) {
  return kit.lathe([[taperAt(from), from], [taperAt(to), to]], SEG);
}

export default function createDockLighthouse(THREE) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, ["hullWhite", "buoyRed", "iron", "lampGlass", "brass", "pileTimber", "dockPlankPale"]);
  const root = kit.group("dock_lighthouse");
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "fishing-dock",
    assetId: "fishing-dock.lighthouse.m1",
    upAxis: "+Y",
    scaleMeters: 1,
    galleryHeightMetres: GALLERY_Y,
    sockets: ["beacon_pivot"],
    socketNotes: {
      beacon_pivot: "The lamp carriage inside the lantern room. The `beacon-spin` clip turns it about +Y. Rest pose points at +X.",
    },
  };

  // ---- plinth -------------------------------------------------------------------------------
  root.add(
    kit.solo("light_plinth", mat.pileTimber, kit.lathe([
      [0.7, 0],
      [0.7, 0.12],
      [0.66, 0.2],
      [0.63, PLINTH_TOP],
    ], SEG)),
  );

  // ---- tower, four bands --------------------------------------------------------------------
  const cuts = [PLINTH_TOP, 1.02, 1.7, 2.38, TOWER_TOP];
  for (let i = 0; i < cuts.length - 1; i += 1) {
    const from = i === 0 ? cuts[i] : cuts[i] - 0.008;
    const to = cuts[i + 1];
    root.add(kit.solo(`light_band_${i + 1}`, i % 2 === 0 ? mat.hullWhite : mat.buoyRed, band(kit, from, to)));
  }

  // ---- door and windows ----------------------------------------------------------------------
  //
  // Set 20 mm proud of the tower wall rather than cut into it: a low-poly lathe has no wall
  // thickness to cut a hole in, and a recess drawn on the same surface is the coplanar seam this
  // kit refuses to ship. A framed door standing on the wall is what a real one looks like anyway.
  const joinery = [];
  joinery.push(kit.place(kit.chamferBox(0.06, 0.86, 0.42, 0.014), [taperAt(0.77) + 0.012, 0.77, 0]));
  for (const [y, angle] of [[1.42, 0.7], [2.1, -0.9], [2.72, 2.4]]) {
    const radius = taperAt(y) + 0.012;
    joinery.push(
      kit.place(kit.chamferBox(0.055, 0.32, 0.24, 0.01), [Math.cos(angle) * radius, y, Math.sin(angle) * radius], [0, -angle, 0]),
    );
  }
  root.add(kit.merged("light_joinery", mat.dockPlankPale, joinery));

  const glazing = [];
  for (const [y, angle] of [[1.42, 0.7], [2.1, -0.9], [2.72, 2.4]]) {
    // Inside the frame, not in front of it. Set at +0.044 the pane stood 10 mm proud of its own
    // architrave and the window read as a plate stuck on the wall.
    const radius = taperAt(y) + 0.02;
    glazing.push(kit.place(kit.box(0.012, 0.22, 0.16), [Math.cos(angle) * radius, y, Math.sin(angle) * radius], [0, -angle, 0]));
  }

  // ---- gallery -------------------------------------------------------------------------------
  root.add(
    kit.solo("light_gallery", mat.iron, kit.lathe([
      [taperAt(TOWER_TOP) + 0.02, TOWER_TOP - 0.06],
      [GALLERY_R, GALLERY_Y - 0.09],
      [GALLERY_R, GALLERY_Y],
      [GALLERY_R - 0.08, GALLERY_Y + 0.01],
    ], 12)),
  );

  // Railing: twelve stanchions and two rails. The rails are lathed rings rather than tori so
  // they share the gallery's own twelve-sided plan and do not read as a different object.
  const railing = [];
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    railing.push(kit.place(kit.box(0.028, 0.42, 0.028), [Math.cos(angle) * (GALLERY_R - 0.05), GALLERY_Y + 0.21, Math.sin(angle) * (GALLERY_R - 0.05)], [0, -angle, 0]));
  }
  railing.push(kit.place(kit.torus(GALLERY_R - 0.05, 0.019, 4, 12), [0, GALLERY_Y + 0.4, 0], [Math.PI / 2, 0, 0]));
  railing.push(kit.place(kit.torus(GALLERY_R - 0.05, 0.014, 4, 12), [0, GALLERY_Y + 0.21, 0], [Math.PI / 2, 0, 0]));
  root.add(kit.merged("light_railing", mat.iron, railing));

  // ---- lantern room ---------------------------------------------------------------------------
  const room = [];
  room.push(kit.place(kit.lathe([[0.44, LANTERN_FLOOR - 0.06], [0.44, LANTERN_FLOOR]], SEG)));
  for (let i = 0; i < SEG; i += 1) {
    const angle = (i / SEG) * Math.PI * 2 + Math.PI / SEG;
    room.push(
      kit.place(kit.box(0.05, LANTERN_TOP - LANTERN_FLOOR, 0.05), [
        Math.cos(angle) * 0.4,
        (LANTERN_FLOOR + LANTERN_TOP) / 2,
        Math.sin(angle) * 0.4,
      ], [0, -angle, 0]),
    );
  }
  room.push(kit.place(kit.lathe([[0.46, LANTERN_TOP - 0.05], [0.46, LANTERN_TOP]], SEG)));
  root.add(kit.merged("light_lantern_room", mat.iron, room));

  // Glazing in the lantern room: eight panes standing between the astragals, 14 mm thick.
  for (let i = 0; i < SEG; i += 1) {
    const angle = (i / SEG) * Math.PI * 2;
    glazing.push(
      kit.place(kit.box(0.014, LANTERN_TOP - LANTERN_FLOOR - 0.08, 0.3), [
        Math.cos(angle) * 0.385,
        (LANTERN_FLOOR + LANTERN_TOP) / 2,
        Math.sin(angle) * 0.385,
      ], [0, -angle, 0]),
    );
  }
  root.add(kit.merged("light_glazing", mat.lampGlass, glazing));

  // ---- roof and finial -------------------------------------------------------------------------
  root.add(
    kit.merged("light_roof", mat.buoyRed, [
      kit.place(kit.cone(0.52, 0.34, SEG), [0, LANTERN_TOP + 0.17, 0]),
      kit.place(kit.cyl(0.05, 0.05, 0.1, 6), [0, LANTERN_TOP + 0.38, 0]),
      kit.place(kit.blob(0.055, 1, 1.2, 1, 0), [0, LANTERN_TOP + 0.45, 0]),
    ]),
  );

  // ---- the beacon ------------------------------------------------------------------------------
  // 0.228, and the value is exact for a reason.
  //
  // At 0.26 the lamp carriage hung 32.5 mm over the lantern-room floor and clunk_asset_inspect
  // reported it as touching nothing at all. Seating it 4 mm INTO the floor instead put 40 of
  // the base plate's 228 vertices inside the floor slab, and both the geometry audit and the
  // inspector then read the lamp as a part driven through the room.
  //
  // 0.228 leaves the base plate 0.5 mm clear of the floor: under every contact tolerance in
  // the two checkers, so it counts as seated, and above the floor, so no vertex is inside it.
  const pivot = kit.group("beacon_pivot", [0, LANTERN_FLOOR + 0.228, 0]);
  root.add(pivot);
  pivot.add(
    kit.merged("beacon_lamp", mat.brass, [
      kit.place(kit.cyl(0.075, 0.09, 0.055, 8), [0, -0.2, 0]),
      kit.place(kit.cyl(0.03, 0.03, 0.32, 6), [0, -0.06, 0]),
      kit.place(kit.blob(0.07, 1, 1.25, 1, 0), [0, 0.02, 0]),
    ]),
  );
  // The reflector: two curved plates behind the lamp, which is what makes the turn readable.
  // A bare bulb spinning inside a glass drum has no orientation and the clip would be invisible.
  const reflector = [];
  for (const [angle, width] of [[0, 0.26], [0.55, 0.2], [-0.55, 0.2]]) {
    reflector.push(
      kit.place(kit.chamferBox(0.022, 0.24, width, 0.006), [Math.cos(angle) * -0.13, 0.02, Math.sin(angle) * -0.13], [0, -angle, 0]),
    );
    // A bracket back to the lamp column. Without it the plates stand 49 mm clear of the lamp
    // in mid-air, which is what clunk_asset_inspect reported on the first pass.
    reflector.push(
      kit.place(kit.box(0.11, 0.018, 0.018), [Math.cos(angle) * -0.075, 0.02, Math.sin(angle) * -0.075], [0, -angle, 0]),
    );
  }
  pivot.add(kit.merged("beacon_reflector", mat.hullWhite, reflector));

  return finalize(THREE, root);
}

/** The motion this product ships. A rotation channel only; nothing translates and nothing scales. */
export const CLIPS = [
  {
    name: "beacon-spin",
    koreanName: "등 회전",
    seconds: 6,
    tracks: [
      {
        node: "beacon_pivot",
        times: [0, 1.5, 3, 4.5, 6],
        rotationDegrees: [
          [0, 0, 0],
          [0, 90, 0],
          [0, 180, 0],
          [0, 270, 0],
          [0, 360, 0],
        ],
      },
    ],
  },
];
