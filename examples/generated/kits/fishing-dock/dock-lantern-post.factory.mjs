/**
 * Fishing Dock — lamp post with a hanging lantern.
 *
 * A squared timber post on a cleated base, a bracket arm out to one side, and a four-pane
 * lantern hanging from the arm on a hook. The lantern is on its own node, `lantern_pivot`,
 * placed exactly on the hook — so the one clip this product ships swings the lantern about the
 * point it actually hangs from, instead of pretending the whole post sways.
 *
 * Reference: a jetty lamp post is 2.2~2.8 m to the arm and a storm lantern is 0.28~0.36 m
 * tall over the body. Measured here: arm at 2.30 m, lantern body 0.30 m.
 */
import { DOCK, createKit, finalize, selectMaterials } from "./dock-kit.mjs";

const POST = 0.13;
const POST_TOP = 2.5;
const ARM_Y = 2.3;
const ARM_REACH = 0.62;
/** Where the lantern hangs — the pivot node goes exactly here. */
const HOOK = [ARM_REACH, ARM_Y - 0.06, 0];

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
      lantern_pivot: "The hook the lantern hangs from. The `sway` clip rotates it about +X and +Z. Rest pose hangs straight down.",
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

  // ---- the hanging lantern -------------------------------------------------------------------
  const pivot = kit.group("lantern_pivot", HOOK);
  root.add(pivot);

  // The hook and the cage, in iron. Local y = 0 is the hook itself, so everything below hangs.
  const ironwork = [];
  ironwork.push(kit.place(kit.torus(0.028, 0.008, 4, 8), [0, -0.012, 0], [0, Math.PI / 2, 0]));
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

  // The glazing: four panes, each a 10 mm slab standing between the uprights. Not a single
  // box — a lantern with one solid glass block in it has no inside, and the kit's rule against
  // zero-thickness cards does not mean everything has to be a lump.
  const glass = [];
  for (const [dx, dz, rot] of [[0.071, 0, 0], [-0.071, 0, 0], [0, 0.071, Math.PI / 2], [0, -0.071, Math.PI / 2]]) {
    glass.push(kit.place(kit.box(0.128, 0.29, 0.01), [dx, -0.285, dz], [0, rot, 0]));
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

/** The motion this product ships. Rotation channels only; the hook does not move. */
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
          [2.4, 0, 6.5],
          [0, 0, 0],
          [-2.4, 0, -6.5],
          [0, 0, 0],
        ],
      },
    ],
  },
];
