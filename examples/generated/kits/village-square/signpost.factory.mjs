/**
 * Village Square 04 — Direction Fingerpost (three fingers).
 *
 * Reference measurements: a fingerpost's post stands 2.0-2.4 m above ground and is 100-125 mm
 * square; a finger is 600-900 mm long, 140-160 mm deep and 30-40 mm thick, and the lowest one
 * clears head height at about 2.0 m on a road and rather less on a footpath. This is cut to a
 * 2.100 m post, 110 mm square, with three 700 x 160 x 35 mm fingers at 1.400, 1.640 and 1.880 m.
 *
 * A finger is a pointed board, and the point is the whole read: a rectangle nailed to a post
 * is a shelf, and only the tip turns it into a direction. The point is authored as a
 * five-sided profile extruded 35 mm, so the tip has real thickness and the board has no
 * back-face-dependent geometry in it.
 *
 * The fingers are set at 0, 126 and 229 degrees about the post, which is far enough apart
 * that no two of them ever line up in a storefront three-quarter view.
 */
import { createKit, place, selectMaterials, summarize } from "./village-kit.mjs";

const POST_SIDE = 0.11;
const POST_TOP = 2.1;
const COLLAR_R_INNER = 0.09;
const COLLAR_R_OUTER = 0.26;
const COLLAR_H = 0.13;
const COLLAR_BLOCKS = 8;
const FINGER_LEN = 0.7;
const FINGER_H = 0.16;
const FINGER_T = 0.035;
const FINGER_TIP = 0.09; // how far back from the tip the taper starts
/** How far the finger's inner end is buried in the post. A fingerpost's finger is bolted in. */
const FINGER_EMBED = 0.02;
const FINGERS = [
  { y: 1.4, yaw: 0 },
  { y: 1.64, yaw: 2.2 },
  { y: 1.88, yaw: 4.0 },
];

export function createVillageSignpost(THREE) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, ["stoneBody", "stoneShadow", "woodFrame", "woodPale", "iron"]);

  const root = kit.group("village_signpost");
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "village-square",
    assetId: "village-square.signpost.m1",
    upAxis: "+Y",
    scaleMeters: 1,
    fingers: FINGERS.length,
  };

  // --- Stone collar --------------------------------------------------------------------
  // A post driven straight into the ground has nothing holding it. The collar is what the
  // post stands in, and it is also what stops the base of the model being a bare stick.
  const base = kit.group("base");
  root.add(base);
  // Wedges, not boxes: a ring of boxes opens a gap at every outer joint. See village-kit.mjs.
  const collar = kit
    .ringBlocks(COLLAR_BLOCKS, COLLAR_R_INNER, COLLAR_R_OUTER, 0, COLLAR_H, { heightJitter: 0.018, seed: 700 })
    .map((item) => item.entry);
  base.add(kit.merged("signpost_collar", mat.stoneBody, collar));
  base.add(kit.solo("signpost_collar_fill", mat.stoneShadow, kit.cyl(COLLAR_R_INNER, COLLAR_R_INNER, 0.1, 8), [0, 0.05, 0]));

  // --- Post --------------------------------------------------------------------------
  const postGroup = kit.group("post");
  root.add(postGroup);
  postGroup.add(
    kit.solo("signpost_post", mat.woodFrame, kit.beam(POST_SIDE, POST_SIDE, POST_TOP), [0, POST_TOP / 2, 0], [Math.PI / 2, 0, 0]),
  );
  // Cap: a four-sided pyramid, so rain runs off and the top of the post is not a flat square.
  postGroup.add(
    kit.merged("signpost_cap", mat.woodFrame, [
      place(kit.cyl(0.075 * Math.SQRT2, 0.075 * Math.SQRT2, 0.03, 4), [0, POST_TOP + 0.015, 0], [0, Math.PI / 4, 0]),
      place(kit.cone(0.07 * Math.SQRT2, 0.11, 4), [0, POST_TOP + 0.085, 0], [0, Math.PI / 4, 0]),
    ]),
  );

  // --- Fingers ---------------------------------------------------------------------------
  const fingerGroup = kit.group("fingers");
  root.add(fingerGroup);

  /** Pointed board profile in XY: a rectangle whose +X end tapers to a tip. */
  const fingerProfile = () => {
    const halfLen = FINGER_LEN / 2;
    const halfH = FINGER_H / 2;
    return [
      [-halfLen, -halfH],
      [halfLen - FINGER_TIP, -halfH],
      [halfLen, 0],
      [halfLen - FINGER_TIP, halfH],
      [-halfLen, halfH],
    ];
  };

  const boards = [];
  const borders = [];
  const bolts = [];
  const reach = POST_SIDE / 2 + FINGER_LEN / 2 - FINGER_EMBED;
  for (const finger of FINGERS) {
    // The board's own axes in world space. Rotating about +Y by `yaw` sends +X to `axis`
    // (the way the finger points) and +Z to `face` (through the board's thickness).
    const axis = [Math.cos(finger.yaw), 0, -Math.sin(finger.yaw)];
    const face = [Math.sin(finger.yaw), 0, Math.cos(finger.yaw)];
    const at = (along, up, across) => [
      axis[0] * along + face[0] * across,
      finger.y + up,
      axis[2] * along + face[2] * across,
    ];
    const rotation = [0, finger.yaw, 0];
    boards.push(place(kit.prism(fingerProfile(), FINGER_T), at(reach, 0, 0), rotation));
    // A raised border on both faces: the ridge a painted fingerpost's lettering sits inside,
    // and the reason the board still reads as a sign at storefront-card size.
    for (const side of [-1, 1]) {
      for (const edge of [-1, 1]) {
        borders.push(
          place(
            // Stops 55 mm clear of the post. At its first length the border's inner end sat
            // 20 mm inside the post, which the MCP inspector reported as an 80 mm intersection.
            kit.box(FINGER_LEN - FINGER_TIP - 0.1, 0.018, 0.008),
            at(reach - 0.02, edge * (FINGER_H / 2 - 0.016), side * (FINGER_T / 2 + 0.004)),
            rotation,
          ),
        );
      }
    }
    // Bolt through the finger's root and on into the post.
    bolts.push(place(kit.box(0.026, 0.026, POST_SIDE + 0.06), at(POST_SIDE / 2 + 0.03, 0, 0), rotation));
  }
  fingerGroup.add(kit.merged("signpost_fingers", mat.woodPale, boards));
  fingerGroup.add(kit.merged("signpost_finger_borders", mat.woodFrame, borders));
  fingerGroup.add(kit.merged("signpost_bolts", mat.iron, bolts));

  // Iron bands where the post is weakest — at the collar and under the lowest finger.
  root.add(
    kit.merged("signpost_bands", mat.iron, [
      place(kit.box(POST_SIDE + 0.014, 0.05, POST_SIDE + 0.014), [0, 0.2, 0]),
      place(kit.box(POST_SIDE + 0.014, 0.05, POST_SIDE + 0.014), [0, FINGERS[0].y - 0.14, 0]),
      place(kit.box(POST_SIDE + 0.014, 0.05, POST_SIDE + 0.014), [0, FINGERS[2].y + 0.14, 0]),
    ]),
  );

  root.userData.measured = summarize(THREE, root);
  return root;
}

export default createVillageSignpost;
