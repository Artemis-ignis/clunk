/**
 * Cozy Farm Set 03 — Fence Gate.
 *
 * A braced field gate hung between two capped posts. The leaf is a real moving part: it lives
 * under a `gate_pivot` node placed exactly on the hinge line, so a consumer animates the gate by
 * rotating one named node — the same discipline the windmill demo uses for `blades_pivot`.
 *
 * Measured footprint (metres): 2.55 W x 1.71 H x 0.60 D. Posts 1.71 m to the cap apex, clear
 * opening 1.45 m between the post faces. Origin sits on the ground midway between the posts.
 *
 * Silhouette contract — what must survive at 10 m: two capped posts, the X-braced leaf reading
 * as a frame of voids rather than a panel, the stub rails that place this gate in a fence line,
 * and the strap hinges and latch that say which side opens.
 *
 * The gate is the one asset in the set with a genuinely functional joint, so the hardware is
 * modelled as a chain that actually closes: pin on the post, strap on the leaf, bar into keeper.
 *
 * The factory is the whole product. The file on sale used to be this bake plus a second pass
 * (scripts/add-pivot-clip.mjs, 2026-09-04) that thinned the hinge pins, moved the hinge line
 * onto the pins and appended the `swing` clip — three things a buyer receives that the factory
 * did not know about, so re-baking the factory no longer reproduced the shipped file and every
 * colourway the template library baked from it shipped the old pins with no clip. All three
 * live here now; scripts/threejs-to-glb.mjs writes `root.animations` into the GLB.
 */
import { createKit, place, selectMaterials, summarize } from "./farm-kit.mjs";

// --- Posts (metres) ---------------------------------------------------------------------
const POST_X = 0.8;
const POST_HALF = 0.075;
const CAP_COLLAR_TOP = 1.51;
const CAP_APEX = 1.71;

// --- Gate leaf --------------------------------------------------------------------------
const HINGE_X = -(POST_X - POST_HALF); // -0.725, the inner face of the hanging post
const GATE_BOTTOM = 0.22;
const GATE_LEN = 1.4;
const GATE_H = 1.02;
const RAIL_Y = [0.055, 0.51, 0.965]; // leaf-local rail centres
const STILE_X = [0.06, 0.71, 1.36]; // leaf-local stile centres: two ends and one middle
const HINGE_Y = [0.16, 0.86]; // leaf-local hinge centres
// The hinge LINE is the pin axis, not the leaf's mid-plane: the pins stand 48 mm toward +Z of
// the leaf centre, so the leaf turns about z = 0.048 and every leaf part steps back by that
// much to keep its world position. A leaf pivoting on its own mid-plane would drag its straps
// through the pintles as it opened.
const HINGE_Z = 0.048;
// 11.2 mm, not 16. A 16 mm pin's outer facet stood 1.14 mm inside the pintle's outer face,
// parallel to it and facing the same way — 32 cm² of same-facing coplanar overlap on the one
// hinge face a buyer sees, which flat shading renders as a flickering seam. 0.7 of it keeps
// the facet 5.3 mm inside the pintle, where nothing can see it.
const PIN_RADIUS = 0.0112;
// The published motion of the leaf: 8 frames at 8 fps, shut → 90° open → shut, plus the wrap
// key at 1.000 s so the cycle closes. The same keys the product page's viewer plays
// (app/api/_lib/listing-variants.ts LISTING_CLIPS) and the same ones the 8-frame sprite sheet
// was baked from — the buyer of the model and the buyer of the sheet get one motion.
const SWING_FPS = 8;
const SWING_DEGREES = [0, -22, -48, -74, -90, -74, -48, -22];

export function createFenceGate(THREE) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, ["woodFrame", "woodPlank", "woodCrate", "stone", "iron", "brass"]);

  const root = kit.group("fence_gate");
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "cozy-farm-set",
    assetId: "cozy-farm.fence-gate.m1",
    upAxis: "+Y",
    scaleMeters: 1,
    sockets: ["gate_pivot"],
    socketNotes: {
      gate_pivot: "Hinge node on the pin axis of the -X post (x -0.725, z 0.048). Rotate about +Y; negative angles swing the leaf toward +Z. Zero is shut and latched; the swing clip plays shut → 90° open → shut in 1 s.",
    },
    clips: ["swing"],
    clearOpeningMeters: (POST_X - POST_HALF) * 2,
  };

  // --- Posts ----------------------------------------------------------------------------
  const posts = kit.group("posts");
  root.add(posts);

  const timbers = [];
  const stubs = [];
  const stones = [];
  for (const side of [-1, 1]) {
    timbers.push(place(kit.box(0.15, 1.4, 0.15), [side * POST_X, 0.75, 0]));
    // Stub rails carrying on outward: without them a pair of posts reads as two lone stakes
    // instead of a gate cut into a fence line.
    stubs.push(place(kit.box(0.36, 0.09, 0.05), [side * 1.02, 1.1, 0]));
    stubs.push(place(kit.box(0.36, 0.09, 0.05), [side * 1.02, 0.62, 0]));
    // Three packing stones per post, different sizes, sunk so each one meets the post.
    stones.push(place(kit.box(0.22, 0.14, 0.2), [side * POST_X, 0.07, 0.16]));
    stones.push(place(kit.box(0.2, 0.12, 0.18), [side * POST_X, 0.06, -0.17]));
    stones.push(place(kit.box(0.16, 0.11, 0.24), [side * (POST_X + 0.09), 0.055, 0]));
  }
  posts.add(kit.merged("post_timbers", mat.woodFrame, timbers));
  posts.add(kit.merged("fence_stub_rails", mat.woodFrame, stubs));
  posts.add(kit.merged("post_base_stones", mat.stone, stones));

  // Weathering cap: a chamfer collar and a four-sided pyramid, turned 45 degrees so the
  // pyramid's edges sit over the post's faces instead of over its corners.
  const caps = [];
  for (const side of [-1, 1]) {
    caps.push(place(kit.box(0.23, 0.06, 0.23), [side * POST_X, CAP_COLLAR_TOP - 0.03, 0]));
    caps.push(
      place(kit.cone(0.165, CAP_APEX - CAP_COLLAR_TOP, 4), [side * POST_X, (CAP_APEX + CAP_COLLAR_TOP) / 2, 0], [0, Math.PI / 4, 0]),
    );
  }
  posts.add(kit.merged("post_caps", mat.woodCrate, caps));

  // --- Post-side hardware (stationary) --------------------------------------------------
  const hardware = kit.group("post_hardware");
  root.add(hardware);

  const pintles = [];
  const pins = [];
  for (const y of HINGE_Y) {
    pintles.push(place(kit.box(0.07, 0.1, 0.06), [HINGE_X - 0.02, GATE_BOTTOM + y, 0.05]));
    pins.push(place(kit.cyl(PIN_RADIUS, PIN_RADIUS, 0.12, 6), [HINGE_X, GATE_BOTTOM + y, HINGE_Z]));
  }
  hardware.add(kit.merged("post_hinge_pintles", mat.iron, pintles));
  hardware.add(kit.merged("post_hinge_pins", mat.iron, pins));

  // The keeper is a U on the closing post: the latch bar drops between its two jaws.
  hardware.add(
    kit.merged("post_latch_keeper", mat.iron, [
      place(kit.box(0.05, 0.035, 0.07), [0.7, GATE_BOTTOM + 0.74, 0.06]),
      place(kit.box(0.05, 0.035, 0.07), [0.7, GATE_BOTTOM + 0.63, 0.06]),
    ]),
  );

  // --- Gate leaf (the moving part) ------------------------------------------------------
  // Everything below hangs off gate_pivot, so rotating that one node swings the whole leaf,
  // hardware included, and nothing is left behind on the post.
  const gatePivot = kit.group("gate_pivot", [HINGE_X, GATE_BOTTOM, HINGE_Z]);
  gatePivot.userData = { socket: "gate_pivot", axis: "+Y", closedRadians: 0, opensNegative: true };
  root.add(gatePivot);

  const frame = [];
  for (const y of RAIL_Y) frame.push(place(kit.box(GATE_LEN, 0.09, 0.045), [GATE_LEN / 2 + 0.01, y, 0]));
  frame.push(place(kit.box(0.08, GATE_H, 0.055), [STILE_X[0], GATE_H / 2, 0]));
  frame.push(place(kit.box(0.06, GATE_H, 0.045), [STILE_X[1], GATE_H / 2, 0]));
  frame.push(place(kit.box(0.08, GATE_H, 0.055), [STILE_X[2], GATE_H / 2, 0]));
  gatePivot.add(kit.merged("gate_frame", mat.woodPlank, frame));

  // X bracing on the back face: the two diagonals are what keep the leaf from reading as a
  // solid slab, and they are the reason a real gate of this span does not sag.
  const braceRun = STILE_X[2] - STILE_X[0];
  const braceRise = RAIL_Y[2] - RAIL_Y[0];
  const braceLength = Math.hypot(braceRun, braceRise);
  const braceAngle = Math.atan2(braceRise, braceRun);
  // Braces sit 3 mm proud of the stiles' back faces rather than exactly on them: coplanar
  // faces between two different materials are what produce z-fighting seams in an engine.
  const braces = [];
  for (const sign of [-1, 1]) {
    braces.push(place(kit.box(braceLength, 0.07, 0.035), [GATE_LEN / 2 + 0.01, GATE_H / 2, -0.042], [0, 0, sign * braceAngle]));
  }
  gatePivot.add(kit.merged("gate_x_braces", mat.woodCrate, braces));

  // Carriage bolts where the rails meet the end stiles — turned 45 degrees so the small square
  // heads read as forged hardware rather than as pixels of noise.
  const bolts = [];
  for (const x of [STILE_X[0], STILE_X[2]]) {
    for (const y of RAIL_Y) bolts.push(place(kit.box(0.05, 0.05, 0.02), [x, y, 0.03], [0, 0, Math.PI / 4]));
  }
  gatePivot.add(kit.merged("gate_bolts", mat.iron, bolts));

  // Strap hinges: each strap runs from the hinge line out across the hanging stile, so the load
  // path is visible. The strap starts at local x = 0, which is exactly where the post pin sits.
  const straps = [];
  for (const y of HINGE_Y) straps.push(place(kit.box(0.34, 0.06, 0.018), [0.17, y, 0.032]));
  gatePivot.add(kit.merged("gate_hinge_straps", mat.iron, straps));

  // Gravity latch. The bar is bolted through the closing stile and tilts down across the gap so
  // its tip lands between the keeper's two jaws — the closed position is a real fit, not a pose:
  // tip at world (0.723, 0.905), keeper jaws at 0.8675 and 0.9425.
  gatePivot.add(
    kit.merged("gate_latch_bar", mat.iron, [
      place(kit.box(0.2, 0.05, 0.022), [1.37, 0.7, 0.052], [0, 0, -0.15]),
      place(kit.cyl(0.02, 0.02, 0.055, 6), [1.36, 0.7015, 0.05], [Math.PI / 2, 0, 0]),
    ]),
  );
  // Lift tab, kept inboard of the keeper so a hand could actually reach it.
  gatePivot.add(kit.solo("gate_latch_grip", mat.brass, kit.box(0.045, 0.08, 0.04), [1.3, 0.755, 0.052]));

  // The leaf parts above are authored with z = 0 on the leaf's mid-plane. The pivot sits on the
  // pin axis, so each part steps back by HINGE_Z: world positions are unchanged, the axis is not.
  for (const part of gatePivot.children) part.position.z -= HINGE_Z;

  // The swing, keyed on the pivot's quaternion about +Y (negative opens toward +Z).
  const frames = [...SWING_DEGREES, SWING_DEGREES[0]];
  const times = new Float32Array(frames.map((_, index) => index / SWING_FPS));
  const values = new Float32Array(frames.flatMap((degrees) => {
    const half = (degrees * Math.PI) / 360;
    return [0, Math.sin(half), 0, Math.cos(half)];
  }));
  const swing = new THREE.AnimationClip("swing", frames.length ? (frames.length - 1) / SWING_FPS : 0, [
    new THREE.QuaternionKeyframeTrack("gate_pivot.quaternion", times, values),
  ]);
  root.animations = [swing];

  root.userData.measured = summarize(THREE, root);
  return root;
}

export default createFenceGate;
