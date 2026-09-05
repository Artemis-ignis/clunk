/**
 * Mine Entrance Kit — a timber support set, the module that repeats down the drift.
 *
 * Reference reality: a "three-piece set" is two legs and a cap, sat on foot blocks, with
 * lagging boards behind the cap holding the roof back. Colliery sets were placed on 1.0-1.5 m
 * centres; 220 mm squared timber carried a 1.8 m span comfortably. Below: 220 mm legs on
 * 1.800 m centres (SPEC.supportSpan), a 2.16 m cap, and SPEC.supportPitch = 1.200 m as the
 * repeat — which is also exactly one straight rail module, so a run of track and a run of
 * timbering line up without anyone having to measure.
 *
 * The set is deliberately NARROWER and lighter than the portal (220 mm legs against 300 mm,
 * 2.10 m clear against 2.60 m). A tunnel that keeps the mouth's dimensions all the way in
 * reads as a corridor; stepping down once at the first set is what makes it read as going
 * underground.
 */
import {
  SPEC,
  beam,
  board,
  ground,
  ironPainter,
  kitUserData,
  meshOf,
  mineMaterial,
  painted,
  stonePainter,
  timberPainter,
} from "./mine-kit.mjs";

const LEG = 0.22;
const LEG_X = SPEC.supportSpan / 2; // 0.90
const LEG_H = 2.1;
const CAP_H = 0.24;
const DEPTH = 0.26;
const FOOT_H = 0.12;
/** Height of the driven wedges between each leg head and the cap. */
const WEDGE_H = 0.05;
const CAP_Y = LEG_H + WEDGE_H; // 2.15, underside of the cap
const CAP_TOP = CAP_Y + CAP_H; // 2.39

const legPainter = timberPainter({ role: "timberDark", grainAxis: "y", grainStep: 0.16, boardAxis: "x", boardStep: 1.8, seed: 151 });
const capPainter = timberPainter({ role: "timberBody", grainAxis: "x", grainStep: 0.22, boardAxis: "y", boardStep: 0.24, seed: 157, wear: 0.45 });
const laggingPainter = timberPainter({ role: "timberBody", grainAxis: "x", grainStep: 0.17, boardAxis: "z", boardStep: 0.14, seed: 163, wear: 0.25 });
const wedgePainter = timberPainter({ role: "timberLight", grainAxis: "x", grainStep: 0.1, seed: 167 });
const footPainter = stonePainter({ seed: 173, damp: 0.35 });
const spikePainter = ironPainter({ seed: 179, polish: 0.1, rust: 0.5 });

export default function createMineSupport(THREE) {
  const timberParts = [];
  const stoneParts = [];
  const iron = [];

  // ---- foot blocks --------------------------------------------------------------------------
  for (const sx of [-1, 1]) {
    stoneParts.push(painted(THREE, beam(THREE, [0.38, FOOT_H, 0.38], [sx * LEG_X, FOOT_H / 2, 0], [0, 0, 0], 0.03), footPainter));
  }

  // ---- legs ----------------------------------------------------------------------------------
  for (const sx of [-1, 1]) {
    timberParts.push(
      painted(THREE, beam(THREE, [LEG, LEG_H - FOOT_H, DEPTH], [sx * LEG_X, FOOT_H + (LEG_H - FOOT_H) / 2, 0], [0, 0, 0], 0.02), legPainter),
    );
  }

  // ---- wedges -----------------------------------------------------------------------------------
  // The pair of driven wedges between each leg head and the cap. They are what the cap actually
  // sits on, and the first pass buried them inside the joint where nothing could see them — the
  // render then showed two posts and a beam and read as a goalpost. They now carry the cap's
  // 50 mm of lift and stand 40 mm proud of the timber on both faces.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      timberParts.push(
        painted(THREE, board(THREE, [0.25, WEDGE_H, 0.17], [sx * LEG_X, LEG_H + WEDGE_H / 2, sz * 0.085], [0, 0, sz * 0.05]), wedgePainter),
      );
    }
  }

  // ---- cap ------------------------------------------------------------------------------------
  timberParts.push(painted(THREE, beam(THREE, [CAP_H, 2.16, DEPTH], [0, CAP_Y + CAP_H / 2, 0], [0, 0, Math.PI / 2], 0.02), capPainter));

  // ---- knee braces ---------------------------------------------------------------------------------
  // Four of them, same joint the portal uses. Without braces the set is two hinges and a beam;
  // with them it is a frame, and the diagonals are most of what the eye reads as "built".
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      timberParts.push(
        painted(THREE, beam(THREE, [0.09, 0.56, 0.09], [sx * (LEG_X - 0.2), CAP_Y - 0.19, sz * 0.075], [0, 0, sx * 0.79], 0.01), wedgePainter),
      );
    }
  }

  // ---- lagging over the cap -------------------------------------------------------------------
  // Four boards laid ALONG the drift, running back off the cap: lagging spans set to set, so on
  // a single set it has to be seen leaving. 660 mm each, bedded 20 mm INTO the cap rather than
  // balanced on its top face, because a board resting on an exactly coplanar surface is a large
  // z-fight on the one horizontal surface a low camera looks straight along. Put the next set
  // at SPEC.supportPitch and its own cap picks these up.
  for (const x of [-0.72, -0.24, 0.24, 0.72]) {
    timberParts.push(
      painted(THREE, board(THREE, [0.17, 0.07, 0.66], [x, CAP_TOP + 0.015, -0.19], [0, 0, 0], 4, "y"), laggingPainter),
    );
  }

  // ---- ironwork ------------------------------------------------------------------------------------
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      iron.push(painted(THREE, board(THREE, [0.2, 0.4, 0.018], [sx * LEG_X, CAP_Y + 0.02, sz * (DEPTH / 2 + 0.006)]), spikePainter));
      iron.push(painted(THREE, board(THREE, [0.045, 0.045, 0.016], [sx * LEG_X, LEG_H - 0.12, sz * (DEPTH / 2 + 0.021)]), spikePainter));
    }
  }

  ground(THREE, [...timberParts, ...iron, ...stoneParts]);

  const material = mineMaterial(THREE, 0.92);
  const root = new THREE.Group();
  root.name = "mine_support";
  root.add(meshOf(THREE, "set_timber", material, timberParts));
  root.add(meshOf(THREE, "ironwork", material, iron));
  root.add(meshOf(THREE, "foot_blocks", material, stoneParts));

  return kitUserData(THREE, root, {
    assetId: "mine-entrance.support.m1",
    variant: "three-piece timber support set",
    spanMetres: SPEC.supportSpan,
    repeatPitchMetres: SPEC.supportPitch,
    clearHeightMetres: LEG_H,
    capUndersideMetres: CAP_Y,
    surfaceLanguage: [
      "220 mm legs on stone foot blocks, 1.800 m between leg centres",
      "cap oversailing 180 mm each side, chamfered on every arris",
      "four lagging boards running back off the cap, 660 mm each",
      "driven wedges carrying the cap's 50 mm of lift, standing proud on both faces",
      "four knee braces, the same joint the portal uses",
      "iron strap and clout over each joint, standing 6 mm proud of the timber",
      "repeats at 1.200 m — the same pitch as one straight rail module",
    ],
    parts: root.children.map((child) => child.name),
  });
}
