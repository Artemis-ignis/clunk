/**
 * The humanoid rig. One skeleton, six characters, six clips — that is the pack's actual
 * product: a buyer who bought a second character should not have to retarget anything.
 *
 * Bone names are the Mixamo / Unity-Humanoid set (Hips, Spine, Spine1, Spine2, Neck, Head,
 * <Side>Shoulder/Arm/ForeArm/Hand, <Side>UpLeg/Leg/Foot/ToeBase, and three phalanges per
 * digit). Two deliberate departures, stated plainly rather than hidden:
 *
 *   - Every bone's bind rotation is identity; only the translation differs. glTF allows this
 *     and Unity's Humanoid mapper and Blender's retargeters key off names plus bind pose, not
 *     bone roll, so retargeting works. It also means "rotate LeftArm about Z" means the same
 *     thing on all six characters, which is what lets one authored clip drive the whole pack.
 *   - The bind pose is an A-pose (arms ~42 degrees below horizontal). Linear blend skinning
 *     twists least when the bind pose is near the middle of a bone's working range, and the
 *     shoulders of these characters spend the whole pack somewhere between "at the side" and
 *     "raised to wave".
 *
 * Proportions are parameterised so the child and the elder are genuinely different builds on
 * the same bone list, not the adult scaled down.
 */
import * as THREE from "three";

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const BASE = {
  ankleY: 0.095,
  ankleZ: -0.025,
  kneeY: 0.465,
  kneeZ: 0.02,
  upLegY: 0.935,
  hipX: 0.098,
  hipsY: 1.0,
  spineY: 1.085,
  spine1Y: 1.205,
  spine2Y: 1.33,
  neckY: 1.48,
  headY: 1.545,
  headTopY: 1.828,
  shoulderX: 0.045,
  shoulderY: 1.43,
  armX: 0.19,
  armY: 1.4,
  upperArm: 0.29,
  foreArm: 0.255,
  palm: 0.085,
  toeZ: 0.108,
  toeEndZ: 0.185,
  toeY: 0.032,
};

/**
 * A build: how the same bone list is stretched for a given character. `heightScale` is a
 * uniform multiplier on everything; `headLift`, `legRatio` and `shoulderSpread` are the three
 * knobs that actually change a silhouette from across a room.
 */
export const DEFAULT_BUILD = {
  heightScale: 1,
  legRatio: 1,
  shoulderSpread: 1,
  hipSpread: 1,
  armLength: 1,
  headSize: 1,
  stoop: 0,
};

// Knuckle pitch, not decoration.
//
// The first pass put the four knuckles 20.7 mm apart and then modelled each finger 31 mm
// across, so the fingers overlapped by half their width and fused into one paddle — which is
// exactly what the close-up sheet showed. The span here is 80 mm across four knuckles (26.7 mm
// pitch) against a 23.6 mm finger, which leaves about 3 mm of daylight between neighbours at
// the knuckle and more further out, because `splay` keeps diverging along the length.
const DIGITS = [
  { name: "Index", spread: 0.04, len: 0.073, drop: 0.004, splay: 0.3 },
  { name: "Middle", spread: 0.0133, len: 0.081, drop: 0.0, splay: 0.1 },
  { name: "Ring", spread: -0.0133, len: 0.073, drop: 0.002, splay: -0.11 },
  { name: "Pinky", spread: -0.04, len: 0.058, drop: 0.007, splay: -0.32 },
];
const PHALANX = [0.42, 0.33, 0.25];

/**
 * Computes every bone's world-space bind position for a build. Geometry is authored directly
 * in this space, which is why the mesh kit never needs to know about bones except by name.
 */
export function layout(build = {}) {
  const b = { ...DEFAULT_BUILD, ...build };
  const s = b.heightScale;
  const leg = b.legRatio;
  const world = new Map();
  const set = (name, v) => world.set(name, v);

  // The legs are scaled independently of the torso: `legRatio` is what makes the elder
  // short-legged and the child's torso long relative to its stride.
  const scaleLeg = (y) => y * leg * s;
  const torsoBase = scaleLeg(BASE.upLegY);
  const torsoOf = (y) => torsoBase + (y - BASE.upLegY) * s;

  set("Hips", V(0, torsoOf(BASE.hipsY), 0));
  set("Spine", V(0, torsoOf(BASE.spineY), b.stoop * -0.004 * s));
  set("Spine1", V(0, torsoOf(BASE.spine1Y), b.stoop * -0.012 * s));
  set("Spine2", V(0, torsoOf(BASE.spine2Y), b.stoop * -0.028 * s));
  set("Neck", V(0, torsoOf(BASE.neckY) - b.stoop * 0.02 * s, -0.005 * s + b.stoop * 0.022 * s));
  set("Head", V(0, torsoOf(BASE.headY) - b.stoop * 0.024 * s, b.stoop * 0.036 * s));
  set("HeadTop_End", V(0, torsoOf(BASE.headY) + (BASE.headTopY - BASE.headY) * s * b.headSize - b.stoop * 0.024 * s, b.stoop * 0.036 * s));

  for (const side of ["Left", "Right"]) {
    const m = side === "Left" ? 1 : -1;
    const hx = m * BASE.hipX * s * b.hipSpread;
    set(`${side}UpLeg`, V(hx, scaleLeg(BASE.upLegY), 0));
    set(`${side}Leg`, V(hx * 1.02, scaleLeg(BASE.kneeY), BASE.kneeZ * s));
    set(`${side}Foot`, V(hx, scaleLeg(BASE.ankleY), BASE.ankleZ * s));
    set(`${side}ToeBase`, V(hx, BASE.toeY * s, BASE.toeZ * s));
    set(`${side}Toe_End`, V(hx, BASE.toeY * s * 0.7, BASE.toeEndZ * s));

    const sx = m * BASE.shoulderX * s * b.shoulderSpread;
    const ax = m * BASE.armX * s * b.shoulderSpread;
    set(`${side}Shoulder`, V(sx, torsoOf(BASE.shoulderY), 0));
    const armRoot = V(ax, torsoOf(BASE.armY), b.stoop * -0.012 * s);
    set(`${side}Arm`, armRoot);

    const dir1 = V(m * 0.735, -0.675, 0.055).normalize();
    const foreArm = armRoot.clone().addScaledVector(dir1, BASE.upperArm * s * b.armLength);
    set(`${side}ForeArm`, foreArm);
    const dir2 = V(m * 0.66, -0.748, 0.07).normalize();
    const hand = foreArm.clone().addScaledVector(dir2, BASE.foreArm * s * b.armLength);
    set(`${side}Hand`, hand);

    // Hand frame: u down the fingers, w across the knuckles, v out of the palm.
    const u = dir2.clone();
    const w = V(0, 0, 1).sub(u.clone().multiplyScalar(u.z)).normalize();
    const v = new THREE.Vector3().crossVectors(u, w).normalize().multiplyScalar(m);
    const palm = BASE.palm * s;

    for (const digit of DIGITS) {
      const base = hand
        .clone()
        .addScaledVector(u, palm - digit.drop * s)
        .addScaledVector(w, digit.spread * s)
        .addScaledVector(v, 0.004 * s);
      // Fingers diverge slightly and curl a few degrees toward the palm, so an open hand
      // reads as a relaxed hand rather than a starfish.
      const dir = u
        .clone()
        .addScaledVector(w, digit.splay * 0.55)
        .addScaledVector(v, -0.12)
        .normalize();
      let cursor = base.clone();
      for (let k = 0; k < 3; k += 1) {
        set(`${side}Hand${digit.name}${k + 1}`, cursor.clone());
        const step = dir
          .clone()
          .addScaledVector(v, -0.16 * k)
          .normalize()
          .multiplyScalar(digit.len * s * PHALANX[k]);
        cursor = cursor.add(step);
      }
      set(`${side}Hand${digit.name}4_End`, cursor.clone());
    }

    const thumbBase = hand
      .clone()
      .addScaledVector(u, palm * 0.32)
      .addScaledVector(w, 0.036 * s)
      .addScaledVector(v, 0.012 * s);
    const thumbDir = w.clone().multiplyScalar(0.62).addScaledVector(u, 0.62).addScaledVector(v, 0.18).normalize();
    let cursor = thumbBase.clone();
    for (let k = 0; k < 3; k += 1) {
      set(`${side}HandThumb${k + 1}`, cursor.clone());
      cursor = cursor.clone().addScaledVector(thumbDir, 0.064 * s * PHALANX[k]);
    }
    set(`${side}HandThumb4_End`, cursor.clone());

    world.set(`${side}__frame`, { u, w, v, m });
  }

  // Tool anchors.
  //
  // glTF has no visibility channel, so a pack that ships a hoe and a basket in one file has to
  // hide the one the current clip is not using some other way. The way that works in every
  // engine is a bone with a scale track: each tool is a rigid island weighted 100% to its own
  // anchor, the anchor sits exactly on the right wrist with an identity bind rotation, and
  // every clip carries a scale track for ALL THREE anchors — `TOOL_VISIBLE_SCALE` in the clip
  // that uses the tool, `TOOL_HIDDEN_SCALE` everywhere else, and the rest pose is parked at
  // `TOOL_HIDDEN_SCALE` as well, so a still of the file shows empty hands. See the note on
  // those constants for why the stored geometry is shrunk rather than the anchor alone.
  //
  // Identity bind rotation and zero offset means the anchor's inverse bind matrix is just
  // translate(-wrist), so a tool authored in bind-world coordinates lands at
  //   p' = wristPosed + Q_rightHand * (p - wristBind)
  // and the tool's world rotation IS the right hand's world rotation. The hoe shaft is
  // therefore authored along the hand's own "across the knuckles" axis, which is the axis a
  // fist closes around, and the grip is correct by construction in every pose.
  const wrist = world.get("RightHand");
  set("ToolHoe", wrist.clone());
  set("ToolBasket", wrist.clone());
  set("ToolCan", wrist.clone());
  return world;
}

/**
 * Where the props live, in bind-world coordinates, and how they are oriented.
 *
 * Both `body.mjs` (which models the tools) and `anim.mjs` (which aims them) need exactly the
 * same numbers, and a hoe modelled along one axis and animated along another is a hoe pointing
 * out of the back of the character's hand. So the frame is defined once, here.
 *
 *   grip   the point in the middle of the right palm that the tool passes through
 *   shaft  the axis a closed fist wraps around — "across the knuckles", index side positive
 *   fold   down the fingers; the hoe blade folds this way and the basket hangs the other way
 *   side   completes a right-handed frame
 */
export function toolFrame(world, scale = 1) {
  const f = world.get("Right__frame");
  const wrist = world.get("RightHand");
  const grip = wrist.clone().addScaledVector(f.u, 0.048 * scale).addScaledVector(f.v, 0.006 * scale);
  const shaft = f.w.clone().normalize();
  const fold = f.u.clone().normalize();
  const side = new THREE.Vector3().crossVectors(shaft, fold).normalize();
  return {
    wrist: wrist.clone(),
    grip,
    shaft,
    fold,
    side,
    // A 1.31 m handle and a 20 cm blade, at full character height. It has to be this long: the
    // grip ends up at about chest height when a worker is bent over a stroke, and a shaft that
    // cannot put its blade in the soil from there is a walking stick.
    hoe: { butt: 0.17 * scale, head: 1.05 * scale, blade: 0.2 * scale, bladeAngle: 1.22 },
    basket: { rimRadius: 0.15 * scale, drop: 0.028 * scale, depth: 0.175 * scale },
    // Watering can. Held by a bar handle that lies along `shaft`, exactly like the hoe's
    // handle, so the same closed fist grips it. The body hangs a hand's width along `fold`
    // (down the fingers) and the spout leaves the body along `side`, angled down. Aiming the
    // clip's (shaft, fold) at (across, down) therefore puts the spout forward and pointing at
    // the soil without a single hand-tuned number in the clip.
    can: {
      drop: 0.10 * scale, // handle bar to the top of the body
      bodyR: 0.082 * scale,
      bodyLen: 0.22 * scale,
      spout: 0.32 * scale,
      spoutR: 0.02 * scale,
      roseR: 0.046 * scale,
      spoutRise: 0.9, // how far the spout tips down from the body's own axis
    },
  };
}

/** Parent of every bone. The single source of truth for the hierarchy. */
export function parentMap() {
  const parents = {
    Hips: null,
    Spine: "Hips",
    Spine1: "Spine",
    Spine2: "Spine1",
    Neck: "Spine2",
    Head: "Neck",
    HeadTop_End: "Head",
  };
  for (const side of ["Left", "Right"]) {
    parents[`${side}Shoulder`] = "Spine2";
    parents[`${side}Arm`] = `${side}Shoulder`;
    parents[`${side}ForeArm`] = `${side}Arm`;
    parents[`${side}Hand`] = `${side}ForeArm`;
    parents[`${side}UpLeg`] = "Hips";
    parents[`${side}Leg`] = `${side}UpLeg`;
    parents[`${side}Foot`] = `${side}Leg`;
    parents[`${side}ToeBase`] = `${side}Foot`;
    parents[`${side}Toe_End`] = `${side}ToeBase`;
    for (const digit of [...DIGITS.map((d) => d.name), "Thumb"]) {
      parents[`${side}Hand${digit}1`] = `${side}Hand`;
      parents[`${side}Hand${digit}2`] = `${side}Hand${digit}1`;
      parents[`${side}Hand${digit}3`] = `${side}Hand${digit}2`;
      parents[`${side}Hand${digit}4_End`] = `${side}Hand${digit}3`;
    }
  }
  parents.ToolHoe = "RightHand";
  parents.ToolBasket = "RightHand";
  parents.ToolCan = "RightHand";
  return parents;
}

/**
 * The bones that exist only to carry a prop, and the clips each one is visible in.
 *
 * The basket appears in two clips: `carry_idle` holds it on the rim with both hands, `harvest`
 * holds the same rim with the right hand alone while the left one picks. One basket, two clips,
 * no second copy of 400 triangles in the file.
 */
export const TOOL_ANCHORS = [
  { bone: "ToolHoe", clips: ["hoe"] },
  { bone: "ToolBasket", clips: ["carry_idle", "harvest"] },
  { bone: "ToolCan", clips: ["water"] },
];
/**
 * How small the tool geometry is STORED, and the two anchor scales that read it back.
 *
 * The props are authored in bind-world coordinates around the right wrist, which used to mean
 * a 1.19 m hoe lay across the file's bind pose whether or not anything was holding it. Skinning
 * hid it — but the shop's size measurement does not skin. `measureBoundsMetres` (and every
 * other reader that walks node matrices over POSITION) put the hoe and the basket in the box
 * and printed a 1.87 m farmer as 1.58 × 1.87 × 1.33 m: a man a metre and a third deep. The
 * listing would have been quoting the reach of a tool nobody can see.
 *
 * So the stored geometry is shrunk 1000× toward the wrist and the anchor scales it back:
 *
 *   stored     p' = wrist + 1e-3 · (p − wrist)          a 1.2 mm speck inside the fist
 *   visible    anchor scale 1000                        p' → p exactly
 *   hidden     anchor scale 0.1                         0.12 mm, a hundredth of a pixel
 *
 * The inverse bind matrix is captured with the anchor at scale 1 (identity rotation, zero
 * offset), so the anchor's bone matrix is exactly scale-about-the-wrist and the reconstruction
 * is a single multiply. Stored coordinates sit at metre magnitude, so float32 gives about
 * 0.1 mm of jitter on a reconstructed tool — a tenth of the modelling tolerance.
 *
 * Neither scale is zero: a zero-scale bone gives a singular normal matrix and some engines turn
 * that into NaN lighting on the collapsed triangles.
 */
export const TOOL_BIND_SHRINK = 1e-3;
/** Anchor scale in the clip that uses the tool. Undoes `TOOL_BIND_SHRINK` exactly. */
export const TOOL_VISIBLE_SCALE = 1 / TOOL_BIND_SHRINK;
/** Anchor scale everywhere else, including the rest pose the shop photographs. */
export const TOOL_HIDDEN_SCALE = TOOL_VISIBLE_SCALE * 1e-4;

/** Builds the actual THREE.Bone tree in bind pose. */
export function buildSkeleton(world) {
  const parents = parentMap();
  const names = Object.keys(parents);
  const bones = new Map();
  for (const name of names) {
    const bone = new THREE.Bone();
    bone.name = name;
    bones.set(name, bone);
  }
  for (const name of names) {
    const parent = parents[name];
    const p = world.get(name);
    if (!p) throw new Error(`no bind position for bone ${name}`);
    const bone = bones.get(name);
    if (parent) {
      const pp = world.get(parent);
      bone.position.set(p.x - pp.x, p.y - pp.y, p.z - pp.z);
      bones.get(parent).add(bone);
    } else {
      bone.position.copy(p);
    }
  }
  const root = bones.get("Hips");
  root.updateMatrixWorld(true);
  const ordered = names.map((n) => bones.get(n));
  const skeleton = new THREE.Skeleton(ordered);
  return { skeleton, bones, names, root };
}

export { DIGITS, PHALANX };
