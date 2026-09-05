/**
 * Fishing Dock — lamp post with a hanging lantern.
 *
 * A squared timber post on a cleated base, a bracket arm out to one side, and a four-pane
 * lantern hanging from the arm on a shackle pin. The lantern is on its own node,
 * `lantern_pivot`, placed exactly on that pin — so the one clip this product ships swings the
 * lantern about the point it actually hangs from, instead of pretending the whole post sways.
 *
 * Reference: a jetty lamp post is 2.2~2.8 m to the arm and a storm lantern is 0.28~0.36 m
 * tall over the body. Measured here: arm at 2.30 m, lantern body 0.30 m.
 *
 * WHAT THE 2026-09-05 MECHANISM AUDIT FOUND, AND WHAT ANSWERS IT
 * -------------------------------------------------------------
 *   - The four glass panes were not four sides of a lantern. They were a "+" through the
 *     middle of it: each pane lay in the XY plane and was pushed out along its own axis, so it
 *     stood 35 mm proud of the base plate and 52 mm proud of the frame at all four corners.
 *     They are now four SIDES, each 166 x 300 x 10 mm on the face its two uprights define, so
 *     the widest thing in the lantern is the base plate, as it should be.
 *   - The sway axis was 90 degrees out. The ring the lantern hangs by has its axis along X, so
 *     X is the only axis it can turn about; the clip's main component was +-6.5 degrees about
 *     Z. It is now +-6.5 about X with +-1 about Z, which is the ring's own axis.
 *   - The pivot sat at y = 2.240, 17.5 mm under the arm's soffit with nothing there. There was
 *     also nothing for the ring to hang ON — it was pressed against the underside of the arm.
 *     Both are answered by a real shackle: two straps down from the arm at x = 0.590 and
 *     0.650, and an 36 mm pin across them at y = 2.2175 with the ring around it. The pivot is
 *     that pin's axis, which is solid iron rather than air.
 */
import { DOCK, createKit, finalize, selectMaterials } from "./dock-kit.mjs";

const POST = 0.13;
const POST_TOP = 2.5;
const ARM_Y = 2.3;
const ARM_REACH = 0.62;
/** The shackle pin's axis. It runs along X, which is what makes X the swing axis. */
const PIN_Y = 2.2175;
const PIN_R = 0.018;
/** Where the lantern hangs — the pivot node goes exactly on the pin. */
const HOOK = [ARM_REACH, PIN_Y, 0];

export default function createDockLanternPost(THREE) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, ["pileTimber", "dockPlankPale", "iron", "lampGlass", "brass"]);
  const root = kit.group("dock_lantern_post");
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "fishing-dock",
    assetId: "fishing-dock.lantern-post.m1",
    upAxis: "+Y",
    scaleMeters: 1,
    sockets: ["lantern_pivot"],
    socketNotes: {
      lantern_pivot: "The shackle pin the lantern's ring turns on, at x = 0.620, y = 2.2175, axis +X. The `sway` clip rotates it about +X, which is the only axis the ring can turn about; the +-1 degree about Z is the rope-free wobble a hanging lamp has, not the hinge. Rest pose hangs straight down.",
    },
  };

  // ---- post and base ------------------------------------------------------------------------
  const timber = [];
  timber.push(kit.place(kit.bar(POST, POST_TOP, POST, DOCK.CHAMFER, 1), [0, POST_TOP / 2, 0]));
  // Base cleats: two boards crossing under the post, which is how a post stands on a deck it
  // is not driven through.
  timber.push(kit.place(kit.bar(0.52, 0.07, 0.16, DOCK.CHAMFER, 0), [0, 0.035, 0]));
  timber.push(kit.place(kit.bar(0.16, 0.07, 0.52, DOCK.CHAMFER, 2), [0, 0.035, 0]));
  // Four knee braces off the cleats, so the post is held up rather than balanced.
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const angle = Math.PI / 4;
    const length = 0.34;
    timber.push(
      kit.place(kit.bar(0.05, length, 0.05, DOCK.CHAMFER, 1), [dx * 0.115, 0.19, dz * 0.115], [dz * angle, 0, -dx * angle]),
    );
  }
  // The arm and its brace.
  timber.push(kit.place(kit.bar(ARM_REACH + POST, 0.085, 0.075, DOCK.CHAMFER, 0), [(ARM_REACH - POST) / 2 + POST / 2, ARM_Y, 0]));
  const braceLength = Math.hypot(0.42, 0.42);
  timber.push(kit.place(kit.bar(0.05, braceLength, 0.05, DOCK.CHAMFER, 1), [0.21 + POST / 2, ARM_Y - 0.25, 0], [0, 0, -Math.PI / 4]));
  root.add(kit.merged("post_timber", mat.pileTimber, timber));

  // A cap over the post head, so rain does not sit on the end grain.
  root.add(
    kit.merged("post_cap", mat.dockPlankPale, [
      kit.place(kit.chamferBox(POST + 0.06, 0.04, POST + 0.06, 0.016), [0, POST_TOP + 0.02, 0]),
      kit.place(kit.cone(0.055, 0.07, 6), [0, POST_TOP + 0.075, 0]),
    ]),
  );

  // ---- the shackle the lantern hangs on --------------------------------------------------------
  // Two straps down from the arm and a pin across them. The pin runs along X and fills the
  // ring's bore to within 2 mm, so the ring turns on it rather than resting against a soffit.
  root.add(
    kit.merged("lantern_shackle", mat.iron, [
      kit.place(kit.box(0.012, 0.055, 0.05), [ARM_REACH - 0.03, PIN_Y + 0.0175, 0]),
      kit.place(kit.box(0.012, 0.055, 0.05), [ARM_REACH + 0.03, PIN_Y + 0.0175, 0]),
      kit.place(kit.cyl(PIN_R, PIN_R, 0.07, 8), [ARM_REACH, PIN_Y, 0], [0, 0, Math.PI / 2]),
    ]),
  );

  // ---- the hanging lantern -------------------------------------------------------------------
  const pivot = kit.group("lantern_pivot", HOOK);
  root.add(pivot);

  // The ring and the cage, in iron. Local y = 0 is the pin itself, so the ring is around it and
  // everything below hangs off it.
  const ironwork = [];
  ironwork.push(kit.place(kit.torus(0.028, 0.008, 4, 8), [0, 0, 0], [0, Math.PI / 2, 0]));
  ironwork.push(kit.place(kit.cyl(0.009, 0.009, 0.075, 6), [0, -0.072, 0]));
  ironwork.push(kit.place(kit.torus(0.055, 0.009, 4, 10), [0, -0.115, 0], [Math.PI / 2, 0, 0]));
  // Four uprights of the cage, standing on the base plate and carrying the roof.
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    ironwork.push(kit.place(kit.box(0.016, 0.3, 0.016), [sx * 0.075, -0.285, sz * 0.075]));
  }
  ironwork.push(kit.place(kit.chamferBox(0.2, 0.022, 0.2, 0.008), [0, -0.446, 0]));
  ironwork.push(kit.place(kit.cone(0.155, 0.085, 4), [0, -0.16, 0], [0, Math.PI / 4, 0]));
  ironwork.push(kit.place(kit.chamferBox(0.185, 0.016, 0.185, 0.006), [0, -0.14, 0]));
  pivot.add(kit.merged("lantern_frame", mat.iron, ironwork));

  /*
   * The glazing: four panes, each a 10 mm slab filling one SIDE of the cage.
   *
   * The first cut placed them across the middle instead of on the faces — a "+" seen from
   * above, sticking 52 mm out past the frame at every corner. Each pane is now 166 x 300 mm on
   * the face its two uprights define: 0.075 is the uprights' own centre line, and 0.166 is
   * wide enough to run 8 mm into the upright on either side, so the glazing is held rather
   * than floated. 300 mm of height puts 3 mm into the base plate and 10 mm into the roof
   * plate. Nothing in the lantern now reaches past the base plate at +-0.100.
   */
  const glass = [];
  for (const [dx, dz, rot] of [[0.075, 0, Math.PI / 2], [-0.075, 0, Math.PI / 2], [0, 0.075, 0], [0, -0.075, 0]]) {
    glass.push(kit.place(kit.box(0.166, 0.3, 0.01), [dx, -0.288, dz], [0, rot, 0]));
  }
  pivot.add(kit.merged("lantern_glass", mat.lampGlass, glass));

  // The burner inside, in brass. It is what makes the lantern read as lit rather than as an
  // empty box with yellow sides.
  pivot.add(
    kit.merged("lantern_burner", mat.brass, [
      kit.place(kit.cyl(0.032, 0.042, 0.075, 8), [0, -0.395, 0]),
      kit.place(kit.blob(0.03, 0.7, 1.5, 0.7, 0), [0, -0.325, 0]),
    ]),
  );

  return finalize(THREE, root);
}

/**
 * The motion this product ships. Rotation channels only; the shackle does not move.
 *
 * X is the ring's own axis, so X carries the swing: +-6.5 degrees, which walks the lantern's
 * base +-51.7 mm along Z. The +-1 degree about Z is the small twist a lamp on a ring has and
 * is deliberately the minor component — the first cut had these two the other way round, which
 * asked a ring threaded on an X pin to turn about Z.
 */
export const CLIPS = [
  {
    name: "sway",
    koreanName: "등불 흔들림",
    seconds: 3.2,
    tracks: [
      {
        node: "lantern_pivot",
        times: [0, 0.8, 1.6, 2.4, 3.2],
        rotationDegrees: [
          [0, 0, 0],
          [6.5, 0, 1],
          [0, 0, 0],
          [-6.5, 0, -1],
          [0, 0, 0],
        ],
      },
    ],
  },
];
