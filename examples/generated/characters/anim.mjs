/**
 * Clips. Six of them, shared by all six characters.
 *
 * Two decisions do most of the work here:
 *
 *  1. **Motion is written as a continuous periodic function of the cycle phase, not as a list
 *     of keyframes.** `pose(u)` for u in [0,1) is built from sines and eased ramps, then baked
 *     at 30 fps. That makes the loop exact by construction — frame 0 and frame N are the same
 *     pose because the function is periodic — and it removes the linear-interpolation
 *     stiffness that makes hand-keyed low-poly animation look like a wind-up toy.
 *
 *  2. **The legs are solved, not posed.** `legIk` takes the ankle where the walk cycle says it
 *     should be and produces hip/knee/ankle angles. The stance foot is therefore *defined* to
 *     travel backwards at a constant rate, which is what "no foot sliding" actually means for
 *     an in-place locomotion clip: the contact point moves at exactly the speed the game must
 *     translate the root. `outputs/characters/validate.mjs` measures that speed back out of the
 *     baked clip rather than taking this comment's word for it.
 *
 * Right-side bones are never authored. They are the mirror of the left pose through the YZ
 * plane, which in quaternion terms is (x, y, z, w) -> (x, -y, -z, w). A walk is the same
 * function evaluated half a cycle apart.
 */
import * as THREE from "three";
import { toolFrame, TOOL_ANCHORS, TOOL_HIDDEN_SCALE } from "./rig.mjs";

const TAU = Math.PI * 2;
const AX = new THREE.Vector3(1, 0, 0);
const AY = new THREE.Vector3(0, 1, 0);
const AZ = new THREE.Vector3(0, 0, 1);

/** Composition is fixed and explicit: R = Rx * Ry * Rz, i.e. roll first, then yaw, then pitch. */
function quat(e) {
  const q = new THREE.Quaternion().setFromAxisAngle(AX, e[0] ?? 0);
  q.multiply(new THREE.Quaternion().setFromAxisAngle(AY, e[1] ?? 0));
  q.multiply(new THREE.Quaternion().setFromAxisAngle(AZ, e[2] ?? 0));
  return q;
}

function mirrorQuat(q) {
  return new THREE.Quaternion(q.x, -q.y, -q.z, q.w);
}

const ease = (t) => t * t * (3 - 2 * t);
/** A periodic ramp that spends `hold` of the cycle at 1 and eases in and out of it. */
function pulse(u, start, length, softness = 0.35) {
  let t = (u - start) % 1;
  if (t < 0) t += 1;
  if (t > length) return 0;
  const p = t / length;
  const inRamp = ease(Math.min(1, p / softness));
  const outRamp = ease(Math.min(1, (1 - p) / softness));
  return inRamp * outRamp;
}

/**
 * Planar two-bone IK in the sagittal plane, with the knee constrained forward. Returns the
 * local X rotations for UpLeg, Leg and Foot that put the ankle exactly at (dy, dz) relative
 * to the hip joint and hold the sole at `footPitch`.
 */
function legIk(geom, dy, dz, footPitch, parentPitch = 0) {
  const { l1, l2, thighBias, shinBias, footBias } = geom;
  let d = Math.hypot(dy, dz);
  const reach = (l1 + l2) * 0.998;
  if (d > reach) d = reach;
  if (d < Math.abs(l1 - l2) + 1e-4) d = Math.abs(l1 - l2) + 1e-4;
  const phi = Math.atan2(dz, -dy); // direction hip -> ankle, measured from straight down
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const alpha = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const cosB = (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2);
  const beta = Math.acos(Math.max(-1, Math.min(1, cosB)));
  const thigh = phi + alpha; // knee carried forward, as a human knee is
  const shin = thigh - (Math.PI - beta);
  // Converting a world limb angle into a local bone rotation.
  //
  // Sign matters and is easy to get backwards: rotating (0, -cos a, sin a) about +X by t gives
  // (0, -cos(a - t), sin(a - t)), so a POSITIVE X rotation swings a downward-hanging limb
  // BACKWARDS. The first version of this function assumed the opposite and produced a walk
  // cycle that ran in reverse with the ankle never reaching the ground it was solved for.
  // Each local rotation is therefore the bind angle minus the target, less whatever the
  // parents have already contributed.
  const upLeg = thighBias - thigh - parentPitch;
  const leg = shinBias - shin - thighBias + thigh;
  const foot = footBias - footPitch - shinBias + shin;
  return { upLeg, leg, foot };
}

/** Measures the bind-pose leg triangle out of the rig so the IK matches whatever build it is. */
export function legGeometry(world, side = "Left") {
  const hip = world.get(`${side}UpLeg`);
  const knee = world.get(`${side}Leg`);
  const ankle = world.get(`${side}Foot`);
  const toe = world.get(`${side}ToeBase`);
  const l1 = Math.hypot(knee.y - hip.y, knee.z - hip.z);
  const l2 = Math.hypot(ankle.y - knee.y, ankle.z - knee.z);
  const thighBias = Math.atan2(knee.z - hip.z, -(knee.y - hip.y));
  const shinBias = Math.atan2(ankle.z - knee.z, -(ankle.y - knee.y));
  const footBias = Math.atan2(toe.z - ankle.z, -(toe.y - ankle.y));
  const end = world.get(`${side}Toe_End`);
  const toeReach = Math.hypot(end.y - ankle.y, end.z - ankle.z);
  return { l1, l2, thighBias, shinBias, footBias, toeReach, restDy: ankle.y - hip.y, restDz: ankle.z - hip.z, hipY: hip.y };
}

/** Finger curl, shared by every clip that needs a hand that is doing something. */
function handPose(grip, spread = 0) {
  const out = {};
  const curl = [-0.62, -0.78, -0.62].map((c) => c * grip);
  for (const digit of ["Index", "Middle", "Ring", "Pinky"]) {
    for (let k = 0; k < 3; k += 1) out[`Hand${digit}${k + 1}`] = [0, 0, curl[k] + (k === 0 ? spread : 0)];
  }
  out.HandThumb1 = [0, -0.34 * grip, -0.2 * grip];
  out.HandThumb2 = [0, -0.3 * grip, -0.18 * grip];
  out.HandThumb3 = [0, -0.22 * grip, -0.12 * grip];
  return out;
}

// Bringing the A-pose arm to the side of the body. Everything else is measured from here.
//
// How the three arm channels behave, because it is not obvious and getting it wrong produced
// a wave that looked like a salute and a carry that looked like sleepwalking. The composition
// is R = Rx * Ry * Rz, so Z is applied first, in the bone's own frame, and X last, in the
// parent's:
//   Z  raises and lowers the arm sideways, in the plane the A-pose already lies in.
//      ARM_DOWN brings it to the side of the body; positive lifts it out and up.
//   X  swings the arm forward and back — but only once Z has brought it down. On an arm held
//      out sideways, X barely moves it at all.
//   Z on the forearm bends the elbow, in the same plane as the upper arm's raise.
// So: anything reaching FORWARD keeps Z near ARM_DOWN and pitches with X; anything reaching
// UP AND OUT uses Z and bends the elbow with the forearm's Z.
const ARM_DOWN = -0.7;

// ---------------------------------------------------------------------------------------------
// Holding a tool.
//
// Everything below exists because of one review note: "it is meant to be hoeing, there is no
// hoe, and the hands go the wrong way." A prop the hands are not actually on is worse than no
// prop, so the arms in the two tool clips are not posed at all — they are *solved* to grip
// points on the tool, and the tool is what gets animated.
//
// The chain is:
//   1. the clip decides where the tool should be in the world at phase u;
//   2. that fixes the right hand's world rotation exactly, because the tool is a rigid island
//      hanging off the right wrist (see `toolFrame` in rig.mjs), and therefore also fixes the
//      right wrist's world position;
//   3. both arms are solved with a two-bone IK to their grip points;
//   4. the resulting world rotations are converted back into the local bone rotations the
//      glTF track wants.
// Step 3 is the only place a target can be missed, so `solveGrip` reports how far each hand
// ended up from the point it was aiming at and `outputs/characters/validate.mjs` prints it.
// ---------------------------------------------------------------------------------------------

const IDENTITY = new THREE.Quaternion();
/** The chain the tool clips need forward kinematics through. */
const FK_PARENT = {
  Hips: null,
  Spine: "Hips",
  Spine1: "Spine",
  Spine2: "Spine1",
  LeftShoulder: "Spine2",
  RightShoulder: "Spine2",
};

/** Local rotation per bone for a pose object, right side mirrored exactly as `bakeClip` does. */
function localRotations(pose) {
  const map = new Map();
  for (const [bone, e] of Object.entries(pose.center ?? {})) map.set(bone, quat(e));
  for (const [name, e] of Object.entries(pose.left ?? {})) map.set(`Left${name}`, quat(e));
  for (const [name, e] of Object.entries(pose.right ?? {})) map.set(`Right${name}`, mirrorQuat(quat(e)));
  return map;
}

/**
 * World transform of every bone in FK_PARENT.
 *
 * Bind rotations are identity across this rig (see rig.mjs), which is what makes this six
 * lines instead of a matrix stack: a bone's local translation IS its bind offset, so
 *   worldRot(child)  = worldRot(parent) * localRot(child)
 *   worldPos(child)  = worldPos(parent) + worldRot(parent) * (bind(child) - bind(parent))
 */
function forwardKinematics(world, rotations, hipsOffset) {
  const out = new Map();
  for (const [name, parent] of Object.entries(FK_PARENT)) {
    const local = rotations.get(name) ?? IDENTITY;
    if (!parent) {
      out.set(name, { p: world.get(name).clone().add(hipsOffset), q: local.clone() });
      continue;
    }
    const par = out.get(parent);
    const offset = world.get(name).clone().sub(world.get(parent)).applyQuaternion(par.q);
    out.set(name, { p: par.p.clone().add(offset), q: par.q.clone().multiply(local) });
  }
  return out;
}

/** Rotation matrix whose first two columns are `a` and the part of `b` perpendicular to it. */
function basis(a, b) {
  const x = a.clone().normalize();
  const y = b.clone().addScaledVector(x, -b.dot(x)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Matrix4().makeBasis(x, y, z);
}

/** The rotation that takes the frame (fromA, fromB) onto the frame (toA, toB). */
function frameQuaternion(fromA, fromB, toA, toB) {
  const from = basis(fromA, fromB);
  const to = basis(toA, toB);
  const m = new THREE.Matrix4().multiplyMatrices(to, from.clone().transpose());
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

/**
 * Two-bone IK for one arm.
 *
 * `pole` is the direction the elbow is pushed towards, which is the whole difference between an
 * arm and a chicken wing; every caller here points it outwards and behind, because that is
 * where a human elbow goes and because it keeps the forearm out of the ribs.
 *
 * Returns the two world rotations plus `miss`, the distance by which the target was out of
 * reach. `miss` is never silently absorbed: it is measured, reported, and the clips are
 * designed so that it stays at zero.
 */
function armIk(world, parentFrame, side, target, pole) {
  const armBind = world.get(`${side}Arm`);
  const foreBind = world.get(`${side}ForeArm`);
  const handBind = world.get(`${side}Hand`);
  const shoulderBind = world.get(`${side}Shoulder`);
  const armPos = parentFrame.p.clone().add(armBind.clone().sub(shoulderBind).applyQuaternion(parentFrame.q));
  const d1 = foreBind.clone().sub(armBind);
  const d2 = handBind.clone().sub(foreBind);
  const l1 = d1.length();
  const l2 = d2.length();

  const delta = target.clone().sub(armPos);
  const distance = delta.length();
  const reach = (l1 + l2) * 0.999;
  const closest = Math.abs(l1 - l2) + 1e-4;
  const d = Math.min(reach, Math.max(closest, distance));
  const e1 = delta.clone().normalize();
  let e2 = pole.clone().addScaledVector(e1, -pole.dot(e1));
  if (e2.lengthSq() < 1e-8) e2 = new THREE.Vector3(0, 1, 0).addScaledVector(e1, -e1.y);
  e2.normalize();
  const cosAlpha = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const alpha = Math.acos(Math.max(-1, Math.min(1, cosAlpha)));
  const u1 = e1.clone().multiplyScalar(Math.cos(alpha)).addScaledVector(e2, Math.sin(alpha));
  const elbow = armPos.clone().addScaledVector(u1, l1);
  const wrist = armPos.clone().addScaledVector(e1, d);
  const u2 = wrist.clone().sub(elbow).normalize();

  const qArm = new THREE.Quaternion().setFromUnitVectors(d1.clone().normalize(), u1);
  const swung = d2.clone().normalize().applyQuaternion(qArm);
  const qFore = new THREE.Quaternion().setFromUnitVectors(swung, u2).multiply(qArm);
  return { qArm, qFore, wrist, elbow, armPos, reach, distance, miss: Math.max(0, distance - reach) };
}

/**
 * Puts both hands on a tool.
 *
 * `aim` gives the tool's world rotation and the world point its bind-space grip should land on.
 * Because the tool hangs rigidly off the right wrist, the tool's world rotation IS the right
 * hand's world rotation, and the right wrist position falls straight out of it — no search, no
 * iteration. The left hand is then aimed at a second point that is defined *on the tool*, so
 * it cannot drift off the shaft however the tool moves.
 *
 * If a target turns out to be beyond an arm's reach the whole tool is translated towards the
 * shoulders until it is not. Both hands move with it, so the grip stays exact; what changes is
 * how far in front of the body the character works. The shift is reported, in metres.
 */
function solveGrip(world, pose, tool, aim) {
  const rotations = localRotations(pose);
  const fk = forwardKinematics(world, rotations, new THREE.Vector3(...(pose.hips ?? [0, 0, 0])));
  const handBind = { Left: world.get("LeftHand"), Right: world.get("RightHand") };

  // Right hand: rotation is the tool's, position follows from where the grip has to land.
  const qRight = aim.rotation;
  const gripOffset = tool.grip.clone().sub(handBind.Right).applyQuaternion(qRight);
  // Left hand: same fist, but wrapped the other way round the shaft, which is what two hands on
  // one handle actually do — the thumbs point at each other.
  const qLeft = aim.leftRotation;
  const leftOffset = aim.leftGrip.clone().sub(handBind.Left).applyQuaternion(qLeft);

  let shift = new THREE.Vector3();
  let solved = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const rightTarget = aim.gripPoint.clone().add(shift).sub(gripOffset);
    const leftTarget = aim.leftPoint.clone().add(shift).sub(leftOffset);
    const right = armIk(world, fk.get("RightShoulder"), "Right", rightTarget, aim.rightPole);
    const left = armIk(world, fk.get("LeftShoulder"), "Left", leftTarget, aim.leftPole);
    solved = { left, right, rightTarget, leftTarget };
    const worst = Math.max(left.miss, right.miss);
    if (worst < 1e-4) break;
    // Pull the tool towards the midpoint of the two shoulders by the amount it is out of reach.
    const shoulders = fk.get("LeftShoulder").p.clone().add(fk.get("RightShoulder").p).multiplyScalar(0.5);
    const hands = rightTarget.clone().add(leftTarget).multiplyScalar(0.5);
    shift.addScaledVector(shoulders.clone().sub(hands).normalize(), worst * 1.05);
  }

  const quats = {};
  const write = (side, ik, qHand) => {
    const parent = fk.get(`${side}Shoulder`).q;
    quats[`${side}Arm`] = parent.clone().invert().multiply(ik.qArm);
    quats[`${side}ForeArm`] = ik.qArm.clone().invert().multiply(ik.qFore);
    quats[`${side}Hand`] = ik.qFore.clone().invert().multiply(qHand);
  };
  write("Right", solved.right, qRight);
  write("Left", solved.left, qLeft);
  return {
    quats,
    shiftMetres: shift.length(),
    miss: Math.max(solved.left.miss, solved.right.miss),
    // How hard each arm is working, as a fraction of full extension. Above ~0.99 an arm is
    // locked straight and the pose stops looking alive.
    extension: {
      left: solved.left.distance / solved.left.reach,
      right: solved.right.distance / solved.right.reach,
    },
    hands: { Right: solved.right.wrist, Left: solved.left.wrist },
  };
}

/**
 * The one-handed case: each hand is aimed independently at its own world point.
 *
 * The two-handed `solveGrip` above cannot express "the right hand carries a basket while the
 * left one picks off the ground", because there the two hands are not on one rigid object and
 * must not be shifted together when one of them is out of reach. So this solves each arm on its
 * own and reports each one's miss. A miss here is a design error, not something to absorb
 * quietly: the clips below keep every target inside about 92% of full extension and
 * `outputs/characters/pose-probe.mjs` prints the number back out of the baked file.
 *
 * Each request is `{ side, rotation, gripLocal, gripPoint, pole }`, where `gripLocal` is the
 * point in BIND-world coordinates that has to end up on `gripPoint` — for a tool that is the
 * palm point the prop was modelled around, so the prop lands exactly where the clip asked.
 */
function solveHands(world, pose, requests) {
  const fk = forwardKinematics(world, localRotations(pose), new THREE.Vector3(...(pose.hips ?? [0, 0, 0])));
  const quats = {};
  const extension = { left: 0, right: 0 };
  const hands = {};
  let miss = 0;
  for (const req of requests) {
    const side = req.side;
    const handBind = world.get(`${side}Hand`);
    const offset = req.gripLocal.clone().sub(handBind).applyQuaternion(req.rotation);
    const target = req.gripPoint.clone().sub(offset);
    const ik = armIk(world, fk.get(`${side}Shoulder`), side, target, req.pole);
    const parent = fk.get(`${side}Shoulder`).q;
    quats[`${side}Arm`] = parent.clone().invert().multiply(ik.qArm);
    quats[`${side}ForeArm`] = ik.qArm.clone().invert().multiply(ik.qFore);
    quats[`${side}Hand`] = ik.qFore.clone().invert().multiply(req.rotation);
    extension[side === "Left" ? "left" : "right"] = ik.distance / ik.reach;
    hands[side] = ik.wrist;
    miss = Math.max(miss, ik.miss);
  }
  return { quats, shiftMetres: 0, miss, extension, hands };
}

/**
 * The clip library. Each entry returns, for a phase u in [0,1), a pose object:
 *   center: bone name -> euler triple
 *   left:   short name -> euler triple, authored in the left frame
 *   right:  short name -> euler triple, also authored in the left frame, mirrored on bake
 *   hips:   [x, y, z] translation offset in units of the character's hip height
 */
export function clipLibrary(world, spec) {
  const geom = legGeometry(world);
  const hipHeight = geom.hipY;
  const s = spec.build?.heightScale ?? 1;
  const stride = 0.6 * s * (spec.build?.legRatio ?? 1);
  const runStride = 0.8 * s * (spec.build?.legRatio ?? 1);

  /** Walk/run leg solve for one side at phase p. Stance occupies `duty` of the cycle. */
  const locomotionLeg = (p, { strideLen, duty, lift, hipDrop, bobBase, pelvisPitch = 0 }) => {
    let t = p % 1;
    if (t < 0) t += 1;
    let z;
    let y;
    let pitch;
    if (t < duty) {
      // Contact: the foot is planted, so it travels backwards at a constant rate. This is the
      // whole no-slip guarantee, and it is one line.
      const k = t / duty;
      z = strideLen / 2 - strideLen * k;
      // Heel strike rolls into toe-off. Both ends of that roll pivot the foot about a contact
      // point that is not the ankle, so the ankle has to rise by exactly the amount the far
      // end of the foot would otherwise have driven through the floor. Without this the toe
      // buried itself 3 cm into the ground at push-off.
      const heel = 1 - ease(Math.min(1, k / 0.25));
      const toeOff = ease(Math.max(0, (k - 0.72) / 0.28));
      pitch = geom.footBias + 0.2 * heel - 0.42 * toeOff;
      y = geom.toeReach * Math.sin(0.42 * toeOff) + geom.toeReach * 0.3 * Math.sin(0.2 * heel);
    } else {
      const k = (t - duty) / (1 - duty);
      const e = ease(k);
      z = -strideLen / 2 + strideLen * e;
      y = lift * Math.sin(Math.PI * k) ** 0.85;
      pitch = geom.footBias + 0.34 * Math.sin(Math.PI * k) - 0.12 * ease(Math.max(0, (k - 0.6) / 0.4));
    }
    const dy = geom.restDy + y - (bobBase + hipDrop);
    const dz = geom.restDz + z;
    return { ...legIk(geom, dy, dz, pitch, pelvisPitch), contact: t < duty, footZ: z, footY: y };
  };

  // Arms off the hips.
  //
  // The relaxed clips hang the arms in the bind pose's own A-plane, which is fine until a build
  // is wider at the hip than at the shoulder. The child is, by 2.7 cm — short arms on a chunky
  // little body — and `outputs/characters/intersect-check.mjs` caught his knuckles 18 mm inside
  // his own shorts for the whole idle. This is the extra outward swing that build needs, read
  // out of its own hip width and arm length rather than typed in character by character, and it
  // comes out at 3 degrees for the adults and 8 for the child.
  // The torso's own half-width at the waist, the same number body.mjs sweeps the torso with.
  // Everything that has to pass beside the body — the hoe's swing plane, the carried basket —
  // is placed off this rather than off the character's height, because the trader is 22% wider
  // at the waist than the farmhand on almost the same shoulder span.
  const torsoHalf = 0.126 * (spec.girth?.waist ?? 1) * s;
  // A wave has to clear the head, and the child's head is 46% oversized on a body two thirds
  // the height — his cap brim reaches where an adult's temple is. This holds the waving arm
  // further out for exactly that much extra head.
  const headClear = Math.max(0, (spec.build?.headSize ?? 1) - 1);
  const hipOuter = Math.abs(world.get("RightUpLeg").x) + 0.095 * (spec.girth?.limb ?? 1) * s;
  const armLength = world.get("RightHand").distanceTo(world.get("RightArm"));
  const armClear = Math.min(
    0.3,
    Math.max(0, (hipOuter + 0.03 * s - Math.abs(world.get("RightArm").x)) / Math.max(1e-3, armLength)),
  );

  const clips = {};

  // ------------------------------------------------------------------ idle
  clips.idle = {
    name: "idle",
    duration: 3.6,
    pose(u) {
      const breath = Math.sin(u * TAU);
      const sway = Math.sin(u * TAU - 0.7);
      const micro = Math.sin(u * TAU * 2 + 1.1);
      return {
        hips: [sway * 0.006, 0.004 * breath, 0],
        center: {
          Hips: [0.01 * breath, sway * 0.035, 0],
          Spine: [0.012 * breath + 0.02, -sway * 0.02, 0],
          Spine1: [0.014 * breath, -sway * 0.016, sway * 0.008],
          Spine2: [0.016 * breath - 0.01, -sway * 0.012, 0],
          Neck: [-0.02 * breath, sway * 0.03, 0],
          Head: [-0.03 * breath + 0.02, sway * 0.06 + micro * 0.015, -sway * 0.02],
        },
        left: {
          Shoulder: [0, 0, -0.02 * breath],
          Arm: [0.05 * breath + 0.04 * sway, 0.04, ARM_DOWN + 0.05 + armClear - 0.03 * breath],
          ForeArm: [0.12 + 0.05 * breath, 0.1, -0.06],
          Hand: [0, 0.05, -0.05 * sway],
          UpLeg: [0.02, 0.01, 0.012],
          Leg: [0.05, 0, 0],
          Foot: [-0.07, 0.02, 0],
          ...handPose(0.32),
        },
        right: {
          Shoulder: [0, 0, -0.02 * breath],
          Arm: [0.05 * breath - 0.04 * sway, 0.04, ARM_DOWN + 0.05 + armClear - 0.03 * breath],
          ForeArm: [0.12 + 0.04 * breath, 0.1, -0.06],
          Hand: [0, 0.05, 0.05 * sway],
          UpLeg: [0.02, 0.01, 0.012],
          Leg: [0.05, 0, 0],
          Foot: [-0.07, 0.02, 0],
          ...handPose(0.3),
        },
      };
    },
  };

  // ------------------------------------------------------------------ walk
  // The pelvis carries pitch and lift only. Its sway and counter-rotation are authored on the
  // spine instead: a yaw or roll on Hips rotates the hip sockets out of the sagittal plane the
  // leg solver works in, and the planted foot then slides by a couple of centimetres a frame.
  const WALK_PELVIS_PITCH = -0.03; // negative X pitches the pelvis forward
  const walkParams = { strideLen: stride, duty: 0.62, lift: 0.075 * s, bobBase: 0, pelvisPitch: WALK_PELVIS_PITCH };
  clips.walk = {
    name: "walk",
    duration: 0.92,
    pose(u) {
      const bob = -0.016 * s * (1 - Math.cos(u * TAU * 2)) * 0.5 - 0.004 * s;
      const L = locomotionLeg(u, { ...walkParams, hipDrop: bob });
      const R = locomotionLeg(u + 0.5, { ...walkParams, hipDrop: bob });
      // Arms and legs in phase, not a quarter of a cycle apart.
      //
      // `locomotionLeg` puts the stance foot half a stride FORWARD at u = 0, so u = 0 is the
      // contact pose — the moment the arms are at their furthest fore and aft. Driving the arm
      // swing with sin(u) put the arms at neutral exactly when the legs were at full stride and
      // at full swing when the legs were passing under the body, which is what made this walk
      // read as a wind-up toy from the side. -cos(u) is the same wave a quarter turn earlier,
      // which is the phase the body actually uses.
      const swing = -Math.cos(u * TAU);
      const roll = -Math.cos(u * TAU);
      return {
        hips: [0, bob, 0],
        center: {
          Hips: [WALK_PELVIS_PITCH, 0, 0],
          Spine: [0.03, -roll * 0.09, roll * 0.05],
          Spine1: [0.02, roll * 0.05, -roll * 0.012],
          Spine2: [0.01, roll * 0.05, -roll * 0.01],
          Neck: [-0.03, -roll * 0.03, 0],
          Head: [-0.02, -roll * 0.04, 0],
        },
        left: {
          Shoulder: [0, 0, -0.02],
          Arm: [-swing * 0.52, 0.05, ARM_DOWN + 0.02 + armClear],
          // The elbow folds on the way FORWARD. It was folding on the backswing, which is the
          // one thing a walking arm never does.
          ForeArm: [0.28 + Math.max(0, swing) * 0.42, 0.12, -0.05],
          Hand: [0.05, 0.04, 0],
          UpLeg: [L.upLeg, 0, 0],
          Leg: [L.leg, 0, 0],
          Foot: [L.foot, 0, 0],
          ToeBase: [Math.max(0, -0.5 * L.foot), 0, 0],
          ...handPose(0.48),
        },
        right: {
          Shoulder: [0, 0, -0.02],
          Arm: [swing * 0.52, 0.05, ARM_DOWN + 0.02 + armClear],
          ForeArm: [0.28 + Math.max(0, -swing) * 0.42, 0.12, -0.05],
          Hand: [0.05, 0.04, 0],
          UpLeg: [R.upLeg, 0, 0],
          Leg: [R.leg, 0, 0],
          Foot: [R.foot, 0, 0],
          ToeBase: [Math.max(0, -0.5 * R.foot), 0, 0],
          ...handPose(0.48),
        },
        meta: { L, R, strideLen: stride, duty: 0.62 },
      };
    },
  };

  // ------------------------------------------------------------------ run
  const RUN_PELVIS_PITCH = -0.14;
  const runParams = { strideLen: runStride, duty: 0.42, lift: 0.16 * s, bobBase: 0.02 * s, pelvisPitch: RUN_PELVIS_PITCH };
  clips.run = {
    name: "run",
    duration: 0.7,
    pose(u) {
      const bob = -0.045 * s * (1 - Math.cos(u * TAU * 2)) * 0.5;
      const L = locomotionLeg(u, { ...runParams, hipDrop: bob });
      const R = locomotionLeg(u + 0.5, { ...runParams, hipDrop: bob });
      // Same phase correction as the walk, and for the same reason.
      const swing = -Math.cos(u * TAU);
      const roll = -Math.cos(u * TAU);
      return {
        hips: [0, bob + 0.02 * s, 0],
        center: {
          Hips: [RUN_PELVIS_PITCH, 0, 0],
          Spine: [0.1, -roll * 0.16, roll * 0.06],
          Spine1: [0.07, roll * 0.12, -roll * 0.02],
          Spine2: [0.05, roll * 0.1, -roll * 0.01],
          Neck: [-0.16, -roll * 0.05, 0],
          Head: [-0.1, -roll * 0.05, 0],
        },
        left: {
          Shoulder: [0, 0, -0.06],
          Arm: [-swing * 0.95 - 0.15, 0.12, ARM_DOWN + 0.22 + armClear * 0.6],
          ForeArm: [1.15 + Math.max(0, swing) * 0.5, 0.2, -0.1],
          Hand: [0.1, 0.05, 0],
          UpLeg: [L.upLeg, 0, 0],
          Leg: [L.leg, 0, 0],
          Foot: [L.foot, 0, 0],
          ToeBase: [Math.max(0, -0.6 * L.foot), 0, 0],
          ...handPose(0.92),
        },
        right: {
          Shoulder: [0, 0, -0.06],
          Arm: [swing * 0.95 - 0.15, 0.12, ARM_DOWN + 0.22 + armClear * 0.6],
          ForeArm: [1.15 + Math.max(0, -swing) * 0.5, 0.2, -0.1],
          Hand: [0.1, 0.05, 0],
          UpLeg: [R.upLeg, 0, 0],
          Leg: [R.leg, 0, 0],
          Foot: [R.foot, 0, 0],
          ToeBase: [Math.max(0, -0.6 * R.foot), 0, 0],
          ...handPose(0.92),
        },
        meta: { L, R, strideLen: runStride, duty: 0.38 },
      };
    },
  };

  // ------------------------------------------------------------------ wave
  clips.wave = {
    name: "wave",
    duration: 2.4,
    pose(u) {
      // Raise, wave four times, drop. `pulse` keeps the ends of the ramp flat so the loop
      // rejoins the idle stance without a jerk. The ramp is 14% of the cycle rather than 24%
      // because the arm passes through a straight-out-sideways pose on the way up, and the less
      // time a wave spends looking like a traffic signal the better.
      const raise = pulse(u, 0.06, 0.82, 0.14);
      const fold = ease(Math.min(1, raise * 1.6));
      const flap = Math.sin(u * TAU * 4) * raise;
      const breath = Math.sin(u * TAU + 0.4);
      const shift = raise * 0.5;
      return {
        hips: [-0.01 * shift, 0.004 * breath, 0],
        center: {
          Hips: [0.01, -0.05 * shift, -0.03 * shift],
          Spine: [0.02, 0.04 * shift, 0.02 * shift],
          Spine1: [0.01 * breath, 0.05 * shift, 0.02 * shift],
          Spine2: [-0.01, 0.05 * shift, 0.01 * shift],
          Neck: [-0.02, -0.05 * shift, -0.02 * shift],
          Head: [0.02 - 0.03 * breath, -0.12 * shift, -0.06 * shift],
        },
        left: {
          Shoulder: [0, 0, -0.02 * breath],
          Arm: [0.04 * breath, 0.04, ARM_DOWN + 0.04 + armClear * 1.5],
          ForeArm: [0.14, 0.1, -0.05],
          Hand: [0, 0.05, 0],
          UpLeg: [0.02, 0.01, 0.012],
          Leg: [0.05, 0, 0],
          Foot: [-0.07, 0.02, 0],
          ...handPose(0.3),
        },
        right: {
          // Upper arm out to just below horizontal, elbow folded to ~100 degrees so the hand
          // sits beside the head, and the wave itself is the forearm rocking in that plane.
          //
          // The elbow folds 60% faster than the shoulder raises (`fold`), and that is the whole
          // difference between a wave and a traffic-police signal: with both on the same ramp
          // the arm passes through a fully extended horizontal point-to-the-side halfway up,
          // which is what the review strip caught. Folding first takes the hand up past the
          // chest instead, which is how an arm is actually raised.
          Shoulder: [0, -0.1 * raise, 0.24 * raise],
          Arm: [-0.22 * raise, 0.08, ARM_DOWN + 0.04 + armClear + 1.28 * raise],
          ForeArm: [0.12, 0.05, (1.78 - 0.62 * headClear) * fold + flap * 0.26],
          Hand: [0, 0.12 * flap, -0.08 + flap * 0.34],
          UpLeg: [0.02, 0.01, 0.012],
          Leg: [0.05, 0, 0],
          Foot: [-0.07, 0.02, 0],
          ...handPose(0.05 * (1 - raise)),
        },
      };
    },
  };

  // ------------------------------------------------------------------ the two tool clips
  const tool = toolFrame(world, s);
  const leftFrame = world.get("Left__frame");
  // Anchors for both tool poses: the character's own shoulder height, arm reach and leg length,
  // not its overall scale. See the note on HOE below for why that distinction is load-bearing.
  const armReach =
    world.get("RightForeArm").distanceTo(world.get("RightArm")) + world.get("RightHand").distanceTo(world.get("RightForeArm"));
  const shoulderY = world.get("RightArm").y;
  const legLen = geom.l1 + geom.l2;
  // The left hand's own grip point, mirrored from the right's so both fists hold a shaft the
  // same distance into the palm.
  const leftGrip = world
    .get("LeftHand")
    .clone()
    .addScaledVector(leftFrame.u, 0.048 * s)
    .addScaledVector(leftFrame.v, 0.006 * s);

  /**
   * Plants one foot at a fixed spot on the ground instead of solving a gait for it.
   *
   * `dz` is where the ankle sits fore/aft of its bind position and `heel` lifts the heel by
   * pitching the foot, which is what a back foot does when a worker's weight is forward. The
   * pelvis-pitch term is not cosmetic: rotating the Hips swings the hip socket itself through
   * an arc 6.5 cm below the root, and without putting that back the "planted" foot slides
   * three centimetres every time the character bends over.
   */
  const plantLeg = ({ dz, heel = 0, hipDrop = 0, hipsZ = 0, pelvisPitch = 0 }) => {
    const socket = (geom.hipY - world.get("Hips").y) * Math.sin(pelvisPitch);
    const pitch = geom.footBias - heel;
    const lift = geom.toeReach * Math.sin(heel);
    return legIk(geom, geom.restDy + lift - hipDrop, geom.restDz + dz - hipsZ - socket, pitch, pelvisPitch);
  };

  // ------------------------------------------------------------------ carry idle
  //
  // A basket, held on its rim by both hands, in front of the belly. The whole pose is defined
  // by where the basket is; the arms are whatever it takes to hold it there.
  const CARRY = { y: shoulderY - 0.7 * armReach, z: 0.55 * armReach };
  clips.carry_idle = {
    name: "carry_idle",
    duration: 3.2,
    tool: "carry_idle",
    pose(u) {
      const breath = Math.sin(u * TAU);
      const sway = Math.sin(u * TAU + 0.9);
      const hipDrop = -0.004 * s + 0.0025 * s * breath;
      const pelvis = -0.04;
      const L = plantLeg({ dz: 0.014 * legLen, hipDrop, pelvisPitch: pelvis });
      const R = plantLeg({ dz: -0.014 * legLen, hipDrop, pelvisPitch: pelvis });
      const pose = {
        hips: [sway * 0.004, hipDrop, -0.014 * s],
        center: {
          // Leaned back a few degrees against the load. A carry that does not argue with the
          // weight in front of it reads as sleepwalking.
          Hips: [pelvis, sway * 0.018, 0],
          Spine: [-0.05 + 0.01 * breath, -sway * 0.012, 0],
          Spine1: [-0.02 + 0.012 * breath, -sway * 0.01, 0],
          Spine2: [0.02 + 0.012 * breath, -sway * 0.008, 0],
          Neck: [0.05, sway * 0.02, 0],
          Head: [0.03 - 0.02 * breath, sway * 0.035, 0],
        },
        left: {
          Shoulder: [-0.06, 0.03, 0.05],
          UpLeg: [L.upLeg, 0.01, 0.016],
          Leg: [L.leg, 0, 0],
          Foot: [L.foot, 0.02, 0],
          ...handPose(0.95),
        },
        right: {
          Shoulder: [-0.06, 0.03, 0.05],
          UpLeg: [R.upLeg, 0.01, 0.016],
          Leg: [R.leg, 0, 0],
          Foot: [R.foot, 0.02, 0],
          ...handPose(0.95),
        },
      };
      // The basket breathes with the character rather than hanging in space.
      const centre = new THREE.Vector3(0, CARRY.y + 0.004 * s * breath, CARRY.z + 0.002 * s * sway);
      const up = new THREE.Vector3(0, 1, 0);
      const inward = new THREE.Vector3(1, 0, 0);
      const tangent = new THREE.Vector3(0, 0, 1);
      // Both fists close around the rim tangent, which at the two ends of the rim's X diameter
      // is the Z axis; the fingers point down over the rim, so `fold` maps to -Y.
      const grip = solveGrip(world, pose, tool, {
        rotation: frameQuaternion(tool.shaft, tool.fold, tangent, up.clone().negate()),
        gripPoint: centre.clone().addScaledVector(inward, -tool.basket.rimRadius).addScaledVector(up, tool.basket.drop),
        leftRotation: frameQuaternion(leftFrame.w, leftFrame.u, tangent, up.clone().negate()),
        leftGrip,
        leftPoint: centre.clone().addScaledVector(inward, tool.basket.rimRadius).addScaledVector(up, tool.basket.drop),
        rightPole: new THREE.Vector3(-0.85, -0.3, -0.44),
        leftPole: new THREE.Vector3(0.85, -0.3, -0.44),
      });
      pose.quat = grip.quats;
      pose.grip = grip;
      return pose;
    },
  };

  // ------------------------------------------------------------------ hoe (work action)
  //
  // The stroke is written the way a buyer reads it: as the path of the BLADE, plus where the
  // hands are while the blade travels. Both ends of that path are stated as facts —
  //
  //   contact  blade tip in the soil (y at about 2 cm), well in front of the feet
  //   top      blade tip at head height, behind the right shoulder
  //
  // — and the shaft, the butt and the two grip points are then derived from them, so the pose
  // cannot quietly drift off the ground or through the character's head the way a hand-typed
  // set of Euler angles does. `outputs/characters/pose-probe.mjs` prints the blade tip and both
  // wrists back out of the shipped GLB at six phases per clip; those numbers are the contract.
  //
  // Everything is anchored to the character's own shoulder height and arm reach rather than to
  // its overall scale. That is not tidiness: Mira's legs are 5% longer than the default, which
  // puts her shoulders 5 cm higher over a hoe that is the same length, and a design written in
  // absolute metres put her hands 6 cm past what her arms could reach. Written this way the
  // same numbers give every one of the six an arm that is working at 80-95% of full extension.
  //
  // The shaft angle `phi` is measured from straight up, positive towards the character's back:
  //   phi = -pi/2   shaft horizontal, blade forward
  //   phi = 0       shaft straight up
  //   phi = +1      shaft leaned back over the right shoulder
  // With the blade folded along `fold`, the blade tip is
  //   grip + shaft * A + fold * B,   A = 0.86*head + blade*cos(bend),  B = blade*sin(bend)
  // which is the one equation the whole clip is built on.
  const HOE = {
    // The swing plane, just outside the right hip. A hoe swung in the sagittal plane goes
    // through the character's own head on the way over; this is what buys the clearance.
    planeX: -Math.max(0.86 * Math.abs(world.get("RightArm").x), torsoHalf + 0.058 * s),
    // The hands barely travel — about 15 cm — because in a hoe stroke the hands are the pivot
    // and the tool head does the work. That is also what lets the blade cross two metres in a
    // seventh of a second without the arms leaving their comfortable range.
    gripLowY: shoulderY - 0.9 * armReach,
    gripLowZ: 0.4 * armReach,
    gripHighY: shoulderY - 0.56 * armReach,
    gripHighZ: 0.3 * armReach,
    phiLow: -2.5,
    phiHigh: 0.95,
    // How far the blade leans out to the character's right at the top. Applied as lean*sw^2 so
    // it arrives only where it is needed, at the top of the arc where the blade passes the head.
    lean: -0.5,
    // Distance from the lower (right) hand up the shaft to the upper (left) hand.
    // The upper hand sits this far down the shaft from the lower one, towards the butt. It is
    // 13 cm and not 20 because the upper hand is the one that has to cross the body: at the top
    // of the wind-up it ends up on the character's right at chest height, and every extra
    // centimetre of span is a centimetre further across. At 20 cm that arm locked dead straight
    // on all six characters and the solver had to drag the whole hoe 10 cm towards the chest to
    // keep the grip; at 13 cm it works at 95% of reach and the tool is not moved at all.
    span: 0.1 * s,
  };
  const HOE_A = 0.86 * tool.hoe.head + tool.hoe.blade * Math.cos(tool.hoe.bladeAngle);
  const HOE_B = tool.hoe.blade * Math.sin(tool.hoe.bladeAngle);

  clips.hoe = {
    name: "hoe",
    duration: 1.1,
    tool: "hoe",
    pose(u) {
      // 0.07 s of settle, 0.54 s of wind-up, 0.14 s of strike, 0.14 s held on the blade in the
      // soil, then a short drag back through it. The strike is four times faster than the
      // wind-up, because equal timing is what makes a work loop read as a metronome instead of
      // as work, and the hold is what makes the contact land instead of bounce.
      const windStart = 0.06;
      const windEnd = 0.52;
      const strikeEnd = 0.7;
      const holdEnd = 0.83;
      const sw =
        u < windStart
          ? 0
          : u < windEnd
            ? ease((u - windStart) / (windEnd - windStart))
            : u < strikeEnd
              ? 1 - ease((u - windEnd) / (strikeEnd - windEnd))
              : 0;
      // The blade stops dead in the soil and the body keeps going for a moment. That single
      // damped overshoot is the difference between a swing and a strike.
      const jolt =
        u >= strikeEnd && u < strikeEnd + 0.14
          ? Math.sin(((u - strikeEnd) / 0.14) * Math.PI) * Math.exp(-((u - strikeEnd) / 0.14) * 2.1)
          : 0;
      // A short drag back through the soil after the hold, so the recovery is not dead air.
      // Periodic by construction, so the loop still closes.
      const drag = pulse(u, holdEnd, 0.19, 0.5);

      // The hands lead the rotation on both halves of the stroke: the hands get where they are
      // going first and the tool head whips round to catch up. That lag is the whole reason a
      // strike looks like a strike rather than like a windscreen wiper.
      const lead =
        u < windStart
          ? 0
          : u < windEnd
            ? ease(Math.min(1, ((u - windStart) / (windEnd - windStart)) * 1.3))
            : u < strikeEnd
              // 1.12 and not 1.3 on the way down. At 1.3 the hands had already dropped to the
              // contact position while the shaft was still half-way up, which put the upper hand
              // low and across the body at exactly 100% of that arm's reach — one locked frame,
              // visible as a hitch, on three of the six characters.
              ? 1 - ease(Math.min(1, ((u - windEnd) / (strikeEnd - windEnd)) * 1.12))
              : 0;

      // Body. Bent and knees loaded at contact, tall at the top of the wind-up: the lean and
      // the knee bend therefore INCREASE into the strike, which is the read the brief asks for.
      const bend = 0.66 - 0.46 * sw + 0.12 * jolt;
      const twist = -0.62 * sw;
      const pelvis = 0.17 - 0.06 * sw + 0.03 * jolt;
      const hipDrop = -0.075 * s * (1 - sw) - 0.02 * s * jolt;
      const hipsZ = 0.03 * s * (1 - sw);
      // Left foot forward, right foot back with the heel off the ground: the stagger is what
      // says "this person is bracing against something".
      const L = plantLeg({ dz: 0.2 * legLen, hipDrop, hipsZ, pelvisPitch: pelvis });
      const R = plantLeg({ dz: -0.178 * legLen, heel: 0.3, hipDrop, hipsZ, pelvisPitch: pelvis });

      const pose = {
        hips: [0, hipDrop, hipsZ],
        center: {
          Hips: [pelvis, twist * 0.25, 0],
          Spine: [bend * 0.4, twist * 0.3, twist * 0.1],
          Spine1: [bend * 0.34, twist * 0.26, twist * 0.08],
          Spine2: [bend * 0.26, twist * 0.19, twist * 0.05],
          // The head keeps looking at the spot the blade is going to land on, which means the
          // neck has to give back most of what the spine took.
          Neck: [-bend * 0.42 + 0.04 * jolt, -twist * 0.45, 0],
          Head: [-bend * 0.3 + 0.06 * jolt, -twist * 0.3, 0],
        },
        left: {
          Shoulder: [-0.05 - 0.06 * sw, 0.03, 0.05],
          UpLeg: [L.upLeg, 0.02, 0.02],
          Leg: [L.leg, 0, 0],
          Foot: [L.foot, 0.02, 0],
          ...handPose(1),
        },
        right: {
          Shoulder: [-0.04 - 0.1 * sw, 0.03, 0.05],
          UpLeg: [R.upLeg, 0.02, 0.02],
          Leg: [R.leg, 0, 0],
          Foot: [R.foot, 0.02, 0],
          ToeBase: [Math.max(0, -0.5 * R.foot), 0, 0],
          ...handPose(1),
        },
      };

      const phi = HOE.phiLow + (HOE.phiHigh - HOE.phiLow) * sw;
      const shaft = new THREE.Vector3(HOE.lean * sw * sw, Math.cos(phi), -Math.sin(phi)).normalize();
      // The perpendicular the blade folds along, in the swing plane. `frameQuaternion`
      // re-orthogonalises the second vector against the first, so this only has to point the
      // right way, not be exact.
      const fold = new THREE.Vector3(0, Math.sin(phi), Math.cos(phi));
      const grip = new THREE.Vector3(
        HOE.planeX,
        HOE.gripLowY + (HOE.gripHighY - HOE.gripLowY) * lead - 0.02 * s * jolt,
        HOE.gripLowZ + (HOE.gripHighZ - HOE.gripLowZ) * lead - 0.05 * s * drag,
      );

      const solved = solveGrip(world, pose, tool, {
        rotation: frameQuaternion(tool.shaft, tool.fold, shaft, fold),
        gripPoint: grip,
        // The upper hand is the same fist wrapped the other way round the shaft.
        leftRotation: frameQuaternion(leftFrame.w, leftFrame.u, shaft.clone().negate(), fold),
        leftGrip,
        leftPoint: grip.clone().addScaledVector(shaft, -HOE.span),
        // Elbows out to the sides, not tucked behind. A pole pointing backwards is what put
        // the left elbow 8 cm inside the ribcage on the cross-body reach.
        rightPole: new THREE.Vector3(-0.88, -0.4, -0.26),
        leftPole: new THREE.Vector3(0.92, -0.4, 0.16),
      });
      pose.quat = solved.quats;
      pose.grip = solved;
      pose.mark = { blade: grip.clone().addScaledVector(shaft, HOE_A).addScaledVector(fold, HOE_B) };
      return pose;
    },
  };

  // ------------------------------------------------------------------ water (work action)
  //
  // One hand only. The can hangs off an arch handle whose apex is the palm grip point, so
  // aiming the tool frame's (shaft, fold) at (across the body, down and slightly forward) puts
  // the can level under the fist with the spout out in front and pointing at the soil. The
  // sweep is a yaw of that whole frame plus the hand travelling with it, which is what makes
  // the water land along a row rather than in one spot.
  const WATER = {
    handY: shoulderY - 0.42 * armReach,
    handZ: 0.78 * armReach,
    handX: -0.5 * Math.abs(world.get("RightArm").x),
    sweep: 0.3 * armReach,
    yaw: 0.34,
    // How far the can is tipped towards the pour, as a tangent of the frame's forward lean.
    tip: 0.62,
  };
  clips.water = {
    name: "water",
    duration: 1.6,
    tool: "water",
    pose(u) {
      const swing = Math.sin(u * TAU);
      const breath = Math.sin(u * TAU * 2 + 0.6);
      // The tip is heaviest in the middle of each pass and eases off at the ends, so the can
      // reads as being poured rather than as being carried in a circle.
      const tip = WATER.tip * (0.72 + 0.28 * Math.cos(u * TAU * 2));
      const hipDrop = -0.012 * s + 0.004 * s * breath;
      const pelvis = 0.06;
      const L = plantLeg({ dz: 0.06 * legLen, hipDrop, pelvisPitch: pelvis });
      const R = plantLeg({ dz: -0.06 * legLen, hipDrop, pelvisPitch: pelvis });
      const bend = 0.2;
      const pose = {
        hips: [swing * 0.008 * s, hipDrop, 0.01 * s],
        center: {
          Hips: [pelvis, swing * 0.05, 0],
          Spine: [bend * 0.34, -swing * 0.06, 0],
          Spine1: [bend * 0.3, -swing * 0.05, 0],
          Spine2: [bend * 0.24, -swing * 0.04, 0],
          // Watching the spout, not the horizon.
          Neck: [-bend * 0.34, -swing * 0.1, 0],
          Head: [-bend * 0.42, -swing * 0.16, 0],
        },
        left: {
          // The free arm hangs and swings a few degrees against the sweep. A perfectly still
          // arm on a moving body is the clearest tell there is of a rig-driven pose.
          Shoulder: [0, 0, -0.02],
          Arm: [0.06 - swing * 0.07, 0.05, ARM_DOWN + 0.06 + armClear],
          ForeArm: [0.2 + 0.06 * breath, 0.12, -0.06],
          Hand: [0.03, 0.05, -0.04 * swing],
          UpLeg: [L.upLeg, 0.01, 0.014],
          Leg: [L.leg, 0, 0],
          Foot: [L.foot, 0.02, 0],
          ...handPose(0.34),
        },
        right: {
          Shoulder: [-0.06, 0.03, 0.06],
          UpLeg: [R.upLeg, 0.01, 0.014],
          Leg: [R.leg, 0, 0],
          Foot: [R.foot, 0.02, 0],
          ...handPose(1),
        },
      };

      const yaw = swing * WATER.yaw;
      // `across` is where the handle bar ends up; `down` is where the body of the can hangs.
      // The spout is their cross product by construction (see `can` in rig.mjs), so tipping
      // `down` towards +Z tips the spout down and forward — it cannot end up pointing at the
      // character's own boots or backwards.
      const across = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
      const down = new THREE.Vector3(0, -1, tip).normalize();
      down.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const hand = new THREE.Vector3(
        WATER.handX + swing * WATER.sweep,
        WATER.handY + 0.012 * s * breath,
        WATER.handZ - Math.abs(swing) * 0.05 * armReach,
      );
      const solved = solveHands(world, pose, [
        {
          side: "Right",
          rotation: frameQuaternion(tool.shaft, tool.fold, across, down),
          gripLocal: tool.grip,
          gripPoint: hand,
          pole: new THREE.Vector3(-0.9, -0.32, -0.3),
        },
      ]);
      pose.quat = solved.quats;
      pose.grip = solved;
      return pose;
    },
  };

  // ------------------------------------------------------------------ harvest (work action)
  //
  // The basket rides on the right hand for the whole clip — the same basket the carry pose
  // holds, on the same rim, so the pack ships one basket and not two. The left hand does the
  // work: down to the soil, close, up, and open over the basket. Both arms are solved
  // independently, because they are not on one rigid object and must not be shifted together.
  const HARVEST = {
    // The basket is carried well out to the character's right and forward, not tucked against
    // the belly. At the first set of numbers it sat 11 cm off centre and the deep pick bent the
    // chest straight down onto it: `outputs/characters/intersect-check.mjs` measured the rim
    // 101 mm inside the ribcage. Carrying it out here, and swinging it further out and forward
    // as the body folds, is what clears it.
    basketX: -(0.4 * armReach + 0.35 * torsoHalf),
    basketY: shoulderY - 0.76 * armReach,
    basketZ: 0.48 * armReach,
    pickX: 0.42 * Math.abs(world.get("LeftArm").x),
    pickY: 0.3 * s,
    pickZ: 0.7 * armReach,
  };
  clips.harvest = {
    name: "harvest",
    duration: 1.4,
    tool: "harvest",
    pose(u) {
      // 0 at the basket, 1 with the hand on the ground.
      const k = u < 0.28 ? ease(u / 0.28) : u < 0.4 ? 1 : u < 0.72 ? 1 - ease((u - 0.4) / 0.32) : 0;
      // The fist closes on the ground and opens again over the basket. It closes AFTER the hand
      // has arrived and opens AFTER it is back, which is the whole difference between picking
      // something up and waving at it.
      const grasp =
        u < 0.28
          ? 0.12
          : u < 0.4
            ? 0.12 + 0.88 * ease((u - 0.28) / 0.12)
            : u < 0.74
              ? 1
              : u < 0.88
                ? 1 - 0.88 * ease((u - 0.74) / 0.14)
                : 0.12;
      const breath = Math.sin(u * TAU);
      const bend = 0.12 + 0.94 * k;
      const pelvis = 0.06 + 0.44 * k;
      const hipDrop = -0.012 * s - 0.34 * s * k;
      const hipsZ = -0.09 * s * k;
      const L = plantLeg({ dz: 0.1 * legLen, hipDrop, hipsZ, pelvisPitch: pelvis });
      const R = plantLeg({ dz: -0.1 * legLen, heel: 0.12 * k, hipDrop, hipsZ, pelvisPitch: pelvis });
      const pose = {
        hips: [0, hipDrop, hipsZ],
        center: {
          Hips: [pelvis, -0.05 * k, 0],
          Spine: [bend * 0.36, -0.08 * k, 0.04 * k],
          Spine1: [bend * 0.32, -0.07 * k, 0.03 * k],
          Spine2: [bend * 0.26, -0.05 * k, 0.02 * k],
          Neck: [-bend * 0.4 + 0.02 * breath, 0.06 * k, 0],
          Head: [-bend * 0.34, 0.1 * k, 0],
        },
        left: {
          Shoulder: [-0.04 - 0.08 * k, 0.03, -0.05],
          UpLeg: [L.upLeg, 0.01, 0.016],
          Leg: [L.leg, 0, 0],
          Foot: [L.foot, 0.02, 0],
          ...handPose(grasp),
        },
        right: {
          Shoulder: [-0.06, 0.03, 0.05],
          UpLeg: [R.upLeg, 0.01, 0.016],
          Leg: [R.leg, 0, 0],
          Foot: [R.foot, 0.02, 0],
          ...handPose(0.95),
        },
      };

      // The basket travels with the body it is being carried against: it drops as the character
      // bends, so the pick hand always has somewhere near to bring the crop back to.
      const basket = new THREE.Vector3(
        HARVEST.basketX - 0.26 * armReach * k,
        HARVEST.basketY - 0.05 * armReach * k + 0.006 * s * breath,
        HARVEST.basketZ + 0.22 * armReach * k,
      );
      const up = new THREE.Vector3(0, 1, 0);
      const tangent = new THREE.Vector3(0, 0, 1);
      // Where the left hand is: on the soil at k = 1, over the middle of the basket at k = 0.
      const pick = new THREE.Vector3(HARVEST.pickX, HARVEST.pickY, HARVEST.pickZ);
      // Over the basket's INBOARD rim, not its centre. Reaching across to the far side of a
      // basket carried out at the right hip is 107% of the left arm's reach — the arm locks and
      // the shoulder tears out of the torso. The near rim is a real place to drop a crop into
      // and it costs that arm 15 cm of reach.
      const over = basket
        .clone()
        .addScaledVector(up, 0.12 * armReach)
        .addScaledVector(new THREE.Vector3(1, 0, 0), tool.basket.rimRadius * 0.85);
      const leftPoint = over.clone().lerp(pick, k);
      // Fingers point at the soil on the way down and into the basket on the way back.
      const leftFold = new THREE.Vector3(-0.42, -0.9, 0.06)
        .normalize()
        .lerp(new THREE.Vector3(0, -0.94, 0.34).normalize(), k)
        .normalize();

      const solved = solveHands(world, pose, [
        {
          side: "Right",
          // Same fist on the same rim as the carry pose: fingers down over the rim, the fist
          // closed round the rim's tangent.
          rotation: frameQuaternion(tool.shaft, tool.fold, tangent, up.clone().negate()),
          gripLocal: tool.grip,
          gripPoint: basket
            .clone()
            .addScaledVector(new THREE.Vector3(1, 0, 0), -tool.basket.rimRadius)
            .addScaledVector(up, tool.basket.drop),
          pole: new THREE.Vector3(-0.9, -0.3, -0.4),
        },
        {
          side: "Left",
          rotation: frameQuaternion(leftFrame.w, leftFrame.u, tangent, leftFold),
          gripLocal: leftGrip,
          gripPoint: leftPoint,
          pole: new THREE.Vector3(0.9, -0.25, -0.3),
        },
      ]);
      pose.quat = solved.quats;
      pose.grip = solved;
      pose.mark = { pick: leftPoint, basket };
      return pose;
    },
  };
  return { clips, geom, hipHeight, tool };
}

/** Bakes a `pose(u)` function into a glTF-ready AnimationClip at a fixed sample rate. */
export function bakeClip(clip, world, fps = 30) {
  const frames = Math.max(2, Math.round(clip.duration * fps));
  const times = [];
  for (let i = 0; i <= frames; i += 1) times.push((i / frames) * clip.duration);

  const rotationOf = new Map();
  const hipsPos = [];
  const hipsBind = world.get("Hips");
  const grip = [];

  for (const time of times) {
    const u = (time / clip.duration) % 1;
    const pose = clip.pose(u);
    const record = (bone, q) => {
      if (!rotationOf.has(bone)) rotationOf.set(bone, []);
      rotationOf.get(bone).push(q.x, q.y, q.z, q.w);
    };
    for (const [bone, e] of Object.entries(pose.center ?? {})) record(bone, quat(e));
    for (const [shortName, e] of Object.entries(pose.left ?? {})) record(`Left${shortName}`, quat(e));
    for (const [shortName, e] of Object.entries(pose.right ?? {})) record(`Right${shortName}`, mirrorQuat(quat(e)));
    // Bones the pose solved rather than authored, already in local space and already sided.
    for (const [bone, q] of Object.entries(pose.quat ?? {})) record(bone, q);
    const h = pose.hips ?? [0, 0, 0];
    hipsPos.push(hipsBind.x + h[0], hipsBind.y + h[1], hipsBind.z + h[2]);
    if (pose.grip) grip.push(pose.grip);
  }

  const tracks = [];
  for (const [bone, values] of rotationOf) {
    if (values.length !== times.length * 4) {
      throw new Error(`clip ${clip.name}: bone ${bone} is posed on only some frames`);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
  }
  tracks.push(new THREE.VectorKeyframeTrack("Hips.position", times, hipsPos));

  // Prop visibility. Every clip carries a scale track for every tool anchor, including the
  // clips that use no tool at all — a clip that simply omits the track leaves whatever the
  // previously played clip set, and the buyer gets a farmer waving a hoe about.
  for (const anchor of TOOL_ANCHORS) {
    const size = anchor.clips.includes(clip.tool) ? 1 : TOOL_HIDDEN_SCALE;
    const values = [];
    for (let i = 0; i < times.length; i += 1) values.push(size, size, size);
    tracks.push(new THREE.VectorKeyframeTrack(`${anchor.bone}.scale`, times, values));
  }

  const baked = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  baked.userData = {
    fps,
    frames,
    tool: clip.tool ?? null,
    grip: grip.length
      ? {
          worstMissMetres: Number(Math.max(...grip.map((g) => g.miss)).toFixed(6)),
          worstToolShiftMetres: Number(Math.max(...grip.map((g) => g.shiftMetres)).toFixed(5)),
          maxArmExtension: Number(Math.max(...grip.map((g) => Math.max(g.extension.left, g.extension.right))).toFixed(4)),
        }
      : null,
  };
  return baked;
}

export { quat, mirrorQuat, legIk, handPose, ARM_DOWN };
