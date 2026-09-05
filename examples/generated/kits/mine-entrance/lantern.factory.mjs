/**
 * Mine Entrance Kit — a hanging lantern on its own post, with a swing clip.
 *
 * Reference reality: a colliery safety lamp stood about 250 mm to the top of its bail and was
 * 110-130 mm across the gauze; hung at head height on a post beside the mouth. Below: a 230 mm
 * lamp on a 1.80 m post with a 400 mm bracket arm.
 *
 * THE LIGHT IS A VALUE, NOT A LIGHT.
 * The delivery contract for this kit is one material, no textures and no emissive maps, so a
 * "lit" lantern has to be carried by COLOR_0 alone. The four glass panes are painted from
 * MINE_PALETTE.oreGold mixed 42 % toward white — the palest value anywhere in the kit, sitting
 * directly against its darkest (#3b4044 iron) at a 10 mm frame. That contrast is what reads as
 * light at thumbnail size. It will not cast anything onto the scene; nothing in a GLB can.
 *
 * ANIMATION
 * `lantern_body` is a node at the hook, and the clip `lantern_swing` rotates it +-7 degrees
 * about Z over 2.4 s with a still moment at each end of the arc. Rotation channel only. The
 * post and the arm are baked flat and do not move, which is the point of hanging the lamp off
 * a separate node instead of animating the whole asset.
 */
import {
  beam,
  board,
  emberPainter,
  ironPainter,
  kitUserData,
  lathe,
  lowestY,
  meshOf,
  mineMaterial,
  painted,
  timberPainter,
  translateAll,
  tube,
} from "./mine-kit.mjs";

const POST_H = 1.8;
const POST = 0.12;
const ARM_LENGTH = 0.4;
const HOOK_X = 0.34;
const HOOK_Y = 1.72;
/** Top of the lamp's bail, measured down from the hook. Everything else hangs off this. */
const HANG = -0.06;

const postPainter = timberPainter({ role: "timberDark", grainAxis: "y", grainStep: 0.11, seed: 211 });
const basePainter = timberPainter({ role: "timberBody", grainAxis: "x", grainStep: 0.12, boardAxis: "z", boardStep: 0.3, seed: 223 });
const armPainter = ironPainter({ seed: 227, polish: 0.25, rust: 0.35 });
const lampPainter = ironPainter({ seed: 229, polish: 0.3, rust: 0.2 });

export default function createMineLantern(THREE) {
  const timberParts = [];
  const ironParts = [];

  // ---- post and base ------------------------------------------------------------------------
  timberParts.push(painted(THREE, beam(THREE, [POST, POST_H, POST], [0, POST_H / 2, 0], [0, 0, 0], 0.012), postPainter));
  // Two crossed foot timbers. A post pushed into the ground with nothing at its foot is the
  // other half of the "assembled downward" tell the portal's footings answer.
  timberParts.push(painted(THREE, board(THREE, [0.62, 0.09, 0.16], [0, 0.045, 0]), basePainter));
  timberParts.push(painted(THREE, board(THREE, [0.16, 0.09, 0.62], [0, 0.045, 0]), basePainter));
  // Two braces from the foot up to the post.
  for (const sx of [-1, 1]) {
    timberParts.push(painted(THREE, beam(THREE, [0.06, 0.34, 0.06], [sx * 0.13, 0.2, 0], [0, 0, sx * 0.72], 0.008), basePainter));
  }

  // ---- bracket arm ----------------------------------------------------------------------------
  // 40 x 16 mm strap iron out of the post head, with a diagonal stay under it and a hook.
  ironParts.push(painted(THREE, board(THREE, [ARM_LENGTH, 0.04, 0.016], [ARM_LENGTH / 2 - 0.03, HOOK_Y + 0.05, 0]), armPainter));
  ironParts.push(painted(THREE, board(THREE, [0.3, 0.03, 0.014], [0.14, HOOK_Y - 0.09, 0], [0, 0, 0.64]), armPainter));
  // The hook itself: a short down-turn at the arm's end.
  ironParts.push(painted(THREE, board(THREE, [0.016, 0.075, 0.016], [HOOK_X, HOOK_Y + 0.015, 0]), armPainter));

  // Drop the standing part onto y = 0 and carry the hook down with it. The shift is read off
  // the geometry rather than assumed to be zero, so the lamp cannot end up hanging in the wrong
  // place if the foot timbers are ever re-cut.
  const standing = [...timberParts, ...ironParts];
  const shift = -lowestY(standing);
  translateAll(THREE, standing, shift);
  const hookY = HOOK_Y + shift;

  // ---- the lamp, authored about the hook -------------------------------------------------------
  // Built in its own local frame with y = 0 at the pivot, so the node can simply be placed at
  // the hook and rotated. Nothing here is grounded — it is meant to hang.
  const lampParts = [];
  const glassParts = [];
  // Bail: two uprights and a cross bar, so the handle is a loop and not a decal.
  for (const sz of [-1, 1]) {
    lampParts.push(painted(THREE, board(THREE, [0.012, 0.075, 0.01], [0, HANG - 0.038, sz * 0.05]), lampPainter));
  }
  lampParts.push(painted(THREE, board(THREE, [0.012, 0.012, 0.112], [0, HANG - 0.002, 0]), lampPainter));
  // Top cap: a six-sided cone, with a chimney above it.
  lampParts.push(painted(THREE, lathe(THREE, [[0.075, HANG - 0.1], [0.062, HANG - 0.082], [0.022, HANG - 0.066]], 6, [0, 0, 0]), lampPainter));
  lampParts.push(painted(THREE, tube(THREE, 0.016, 0.03, 6, [0, HANG - 0.05, 0]), lampPainter));
  // Four corner posts of the lamp body, 10 mm square, standing in front of the glass.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      lampParts.push(painted(THREE, board(THREE, [0.01, 0.12, 0.01], [sx * 0.052, HANG - 0.163, sz * 0.052]), lampPainter));
    }
  }
  // Base pan.
  lampParts.push(painted(THREE, lathe(THREE, [[0.07, HANG - 0.235], [0.078, HANG - 0.222], [0.07, HANG - 0.212]], 6, [0, 0, 0]), lampPainter));
  // The glass. 6 mm of real thickness — the thinnest solid in the kit, and still a solid.
  for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    glassParts.push(
      painted(
        THREE,
        board(THREE, sx ? [0.006, 0.108, 0.088] : [0.088, 0.108, 0.006], [sx * 0.05, HANG - 0.163, sz * 0.05]),
        emberPainter(233),
      ),
    );
  }

  const material = mineMaterial(THREE, 0.86);
  const root = new THREE.Group();
  root.name = "mine_lantern";
  root.add(meshOf(THREE, "post", material, timberParts));
  root.add(meshOf(THREE, "bracket", material, ironParts));

  const pivot = new THREE.Group();
  pivot.name = "lantern_body";
  pivot.position.set(HOOK_X, hookY, 0);
  pivot.add(meshOf(THREE, "lamp", material, lampParts));
  pivot.add(meshOf(THREE, "lamp_glass", material, glassParts));
  root.add(pivot);

  // +-7 degrees, 2.4 s, with the lamp passing through vertical at 0.6 and 1.8 s. Five keys: the
  // two middles are what stop a two-key swing from reading as a metronome tick.
  const s = Math.sin(0.061);
  const c = Math.cos(0.061);
  const clip = new THREE.AnimationClip("lantern_swing", 2.4, [
    new THREE.QuaternionKeyframeTrack(
      "lantern_body.quaternion",
      [0, 0.6, 1.2, 1.8, 2.4],
      [0, 0, s, c, 0, 0, 0, 1, 0, 0, -s, c, 0, 0, 0, 1, 0, 0, s, c],
    ),
  ]);
  root.animations = [clip];

  return kitUserData(THREE, root, {
    assetId: "mine-entrance.lantern.m1",
    variant: "hanging pit lamp on a bracket post",
    lampBaseHeightMetres: Number((hookY + HANG - 0.235).toFixed(3)),
    animatedNodes: ["lantern_body"],
    clips: [{ name: "lantern_swing", seconds: 2.4, channels: "rotation only" }],
    surfaceLanguage: [
      "the lamp hangs off its own node, so the post stays still while the lamp swings",
      "four 6 mm glass panes at the palest value in the kit, framed by its darkest",
      "a bail you can see through: two uprights and a cross bar, not a painted loop",
      "post braced and footed on crossed timbers rather than pushed into the ground",
    ],
    parts: ["post", "bracket", "lantern_body/lamp", "lantern_body/lamp_glass"],
  });
}
