/**
 * Clunk-authored action clips for the Harvest Frontier farmhand.
 *
 * WHY THESE ARE AUTHORED AND NOT REPLAYED.
 *
 * Every other clip in this export replays Harvest Frontier's own controller and
 * invents nothing. `hoe`, `water` and `harvest` cannot: HF's `applyAction`
 * poses do not read as the actions they are named after, and an asset that a
 * buyer cannot recognise at a glance is not sellable. Reviewed on the exported
 * strips, HF's own poses give:
 *
 *   hoe      - the hoe is held HORIZONTALLY at shoulder height and pushed
 *              forward; the blade never touches the ground; one hand is on the
 *              shaft and the other floats in mid air beside it.
 *   water    - the can dangles at the hip and barely moves; the spout never
 *              points at anything.
 *   harvest  - the farmer stands still holding a basket; nothing is picked.
 *
 * So this module authors the three clips from the RIG's own measurements. It
 * takes no pose numbers from `applyAction`; what it does take from Harvest
 * Frontier is the geometry - bone lengths, socket offsets, tool dimensions -
 * all read off a live `createPlayerAvatar()` rather than copied as constants,
 * so a change on the HF side moves these clips with it.
 *
 * HOW A POSE IS BUILT (per frame):
 *
 *  1. BODY. A hip hinge and a knee bend, authored as periodic curves. The hinge
 *     rotates pelvis + spine as one rigid torso about the real hip joint
 *     (y = 0.83), so the jacket and the trousers stay welded. The knee bend
 *     drives `playerRig.position` so the BOOT SOLES never leave y = 0 and never
 *     slide: bending the knee by t raises the sole by 0.47*(1-cos t) and pushes
 *     it 0.47*sin t forward, and the root translation cancels exactly that.
 *
 *  2. SHOULDERS FOLLOW THE TORSO. In HF's rig the arm pivots are children of
 *     `playerRig`, NOT of `spine`, so leaning the spine leaves the arms behind
 *     in the air. Since the arms are the whole point of these three clips, the
 *     export drives `leftUpperArmPivot.position` / `rightUpperArmPivot.position`
 *     to the place the spine's own rotation would have carried them
 *     (spine + R_spine * (+-0.305, 0.36, 0)). glTF animates node translation, so
 *     this ships as an ordinary track; it is recorded in the manifest under
 *     `authoring.shoulderFollow`.
 *
 *  3. TOOL. The clip states where the TOOL is in world space - for the hoe, the
 *     blade point and the shaft angle - and the arm is solved to it, not the
 *     other way round. `toolAnchor` sits at (0, -0.08, -0.01) under `rightHand`
 *     and every tool group sits at the anchor's origin, so the anchor's world
 *     transform IS the tool's world transform.
 *
 *  4. ARMS. Two-link IK. The hand is not animated, so the forearm direction and
 *     the hand orientation are the same thing: hand = elbow + 0.40 * v with
 *     v = q_hand * (0,-1,0), which turns "reach this point" into one scalar
 *     equation, |D + 0.40 v| = 0.43 with D = shoulder - hand. Its solutions are
 *     a cone of directions around D; the solver takes the one closest to an
 *     authored hint (for a two-handed grip, the hint is the shaft itself), so
 *     the elbow lands where a person's would.
 *
 *  5. THE OFF HAND IS PUT ON THE SHAFT, NOT NEAR IT. The grip point is a point
 *     ON the tool - `A + s * d`, s in tool-local metres down the shaft - so the
 *     shaft passes through the glove by construction. This character's arm is
 *     0.83 m on a 2.28 m figure (36%; a human is ~44%), so the hands cannot
 *     always be as far apart as an animator would like. Rather than tear the
 *     arm off the shoulder, the solver SLIDES the off hand up the shaft until
 *     the grip is inside the arm's reach, and reports the separation it got.
 */
import { THREE, bakeClip, crossThree, type JointSample } from './lib.mjs';
import { createPlayerAvatar } from '../../../Harvest Frontier/src/engine/animation/playerMotion';

type V3 = THREE.Vector3;
const V = (x = 0, y = 0, z = 0): V3 => new THREE.Vector3(x, y, z);

// ── Rig measurements, read off a live avatar rather than copied ────────────

export interface RigMetrics {
  /** Shoulder -> elbow, elbow -> hand. */
  upperArm: number;
  foreArm: number;
  /** Arm pivot offset from the spine node, and the spine/pelvis offsets from the hip. */
  shoulderX: number;
  shoulderAboveSpine: number;
  spineAboveHip: number;
  pelvisAboveHip: number;
  hipY: number;
  /** Hip -> knee. */
  thigh: number;
  /** `toolAnchor.position` inside `rightHand`. */
  anchorInHand: V3;
  /** How far the export lifts the whole asset so the soles sit on y = 0. */
  groundLift: number;
}

let cachedMetrics: RigMetrics | null = null;

export function rigMetrics(): RigMetrics {
  if (cachedMetrics) return cachedMetrics;
  const avatar = createPlayerAvatar();
  const root = crossThree<THREE.Object3D>(avatar.root);
  avatar.motion.update(0, false, 0);
  root.updateMatrixWorld(true);
  const node = (name: string): THREE.Object3D => {
    const found = root.getObjectByName(name);
    if (!found) throw new Error(`rigMetrics: ${name} is not in the player rig`);
    return crossThree<THREE.Object3D>(found);
  };
  const spine = node('spine');
  const pelvis = node('pelvis');
  const thigh = node('rightThighPivot');
  const shoulder = node('rightUpperArmPivot');
  // The export grounds the asset AFTER the tools have been scaled to 0, so the
  // lift is measured on the body alone. Left in, the hoe blade hangs to
  // y = -0.65 and every target authored against the floor lands 0.47 m low.
  for (const group of ['tool.hoe', 'tool.water', 'tool.harvest', 'tool.inspect', 'waterStream']) {
    root.getObjectByName(group)?.removeFromParent();
  }
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  cachedMetrics = {
    upperArm: Math.abs(node('rightLowerArmPivot').position.y),
    foreArm: Math.abs(node('rightHand').position.y),
    shoulderX: Math.abs(shoulder.position.x),
    shoulderAboveSpine: shoulder.position.y - spine.position.y,
    spineAboveHip: spine.position.y - thigh.position.y,
    pelvisAboveHip: pelvis.position.y - thigh.position.y,
    hipY: thigh.position.y,
    thigh: Math.abs(node('rightShinPivot').position.y),
    anchorInHand: node('toolAnchor').position.clone(),
    groundLift: -box.min.y,
  };
  return cachedMetrics;
}

// ── Periodic curves ───────────────────────────────────────────────────────

/**
 * A cubic Hermite through keys on the unit ring, tangents by wrapped central
 * difference. Exactly periodic: value(0) === value(1) and the slope matches
 * across the seam, which is what makes `loopGap` come out at 0 instead of at
 * "small enough".
 */
function periodic(keys: readonly (readonly [number, number])[]): (phase: number) => number {
  const t = keys.map((k) => k[0]);
  const v = keys.map((k) => k[1]);
  const n = keys.length;
  if (n === 1) return () => v[0]!;
  const slope: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const prevT = i === 0 ? t[n - 1]! - 1 : t[i - 1]!;
    const nextT = i === n - 1 ? t[0]! + 1 : t[i + 1]!;
    const prevV = i === 0 ? v[n - 1]! : v[i - 1]!;
    const nextV = i === n - 1 ? v[0]! : v[i + 1]!;
    slope.push((nextV - prevV) / (nextT - prevT));
  }
  return (phase: number): number => {
    const p = ((phase % 1) + 1) % 1;
    let i = n - 1;
    for (let k = 0; k < n - 1; k += 1) if (p >= t[k]! && p < t[k + 1]!) { i = k; break; }
    const t0 = t[i]!;
    const t1 = i === n - 1 ? t[0]! + 1 : t[i + 1]!;
    const p0 = i === n - 1 && p < t[0]! ? p + 1 : p;
    const h = t1 - t0;
    const s = h === 0 ? 0 : (p0 - t0) / h;
    const v0 = v[i]!;
    const v1 = i === n - 1 ? v[0]! : v[i + 1]!;
    const m0 = slope[i]! * h;
    const m1 = (i === n - 1 ? slope[0]! : slope[i + 1]!) * h;
    const s2 = s * s;
    const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * v0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * v1 + (s3 - s2) * m1;
  };
}

type Curve = (phase: number) => number;
type Keys = readonly (readonly [number, number])[];

function vecCurve(x: Keys, y: Keys, z: Keys): (phase: number) => V3 {
  const cx = periodic(x); const cy = periodic(y); const cz = periodic(z);
  return (p) => V(cx(p), cy(p), cz(p));
}

// ── Two-link arm IK ───────────────────────────────────────────────────────

export interface ArmSolution {
  upper: THREE.Quaternion;
  lower: THREE.Quaternion;
  hand: THREE.Quaternion;
  elbow: V3;
  /** shoulder -> hand distance as a fraction of full extension. */
  extension: number;
}

/** Right-handed quaternion from three orthonormal world axes. */
function basisQuat(x: V3, y: V3, z: V3): THREE.Quaternion {
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

/** A unit vector perpendicular to `a`, biased toward `hint`. */
function perpendicular(a: V3, hint: V3): V3 {
  const projected = hint.clone().addScaledVector(a, -a.dot(hint));
  if (projected.lengthSq() > 1e-10) return projected.normalize();
  const fallback = Math.abs(a.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0);
  return fallback.addScaledVector(a, -a.dot(fallback)).normalize();
}

/**
 * Place a two-link arm so the HAND ORIGIN lands on `hand`.
 *
 * The hand carries no track of its own, so its orientation is the forearm's:
 * hand = elbow + foreArm * v with v = q_hand * (0,-1,0). Substituting the upper
 * arm's length constraint leaves one scalar equation in v,
 *
 *      | (shoulder - hand) + foreArm * v | = upperArm ,
 *
 * whose solution set is a cone about D = shoulder - hand. `forearmHint` picks
 * the point on that cone - i.e. where the elbow ends up. Returns null when the
 * target is outside the arm, so a caller can move the target instead of
 * shipping a torn shoulder.
 */
export function solveArm(
  shoulder: V3,
  hand: V3,
  forearmHint: V3,
  rollRef: V3,
  metrics: RigMetrics,
): ArmSolution | null {
  const { upperArm, foreArm } = metrics;
  const d = shoulder.clone().sub(hand);
  const dl = d.length();
  if (dl > (upperArm + foreArm) * 0.995 || dl < Math.abs(upperArm - foreArm) + 1e-3) return null;
  const cos = ((upperArm * upperArm - foreArm * foreArm - dl * dl) / (2 * foreArm)) / dl;
  if (!Number.isFinite(cos) || Math.abs(cos) > 1) return null;
  const axis = d.clone().divideScalar(dl);
  const perp = perpendicular(axis, forearmHint);
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
  const v = axis.clone().multiplyScalar(cos).addScaledVector(perp, sin).normalize();

  const elbow = hand.clone().addScaledVector(v, -foreArm);
  const u = elbow.clone().sub(shoulder).normalize();

  const handY = v.clone().negate();
  const handX = perpendicular(handY, rollRef);
  const handZ = handX.clone().cross(handY).normalize();
  const qHand = basisQuat(handX, handY, handZ);

  const upperY = u.clone().negate();
  const upperX = perpendicular(upperY, handX);
  const upperZ = upperX.clone().cross(upperY).normalize();
  const qUpper = basisQuat(upperX, upperY, upperZ);

  const qLower = qUpper.clone().invert().multiply(qHand);
  return { upper: qUpper, lower: qLower, hand: qHand, elbow, extension: dl / (upperArm + foreArm) };
}

/**
 * Place the tool hand so the TOOL lands at (anchor, orientation).
 *
 * `toolAnchor` hangs a fixed (0, -0.08, -0.01) under the hand, so the hand
 * origin depends on the hand's own orientation, which is what we are solving
 * for. Four passes settle it - the offset is 8 cm and the correction shrinks by
 * an order of magnitude a pass.
 */
export function solveToolArm(
  shoulder: V3,
  anchor: V3,
  toolQuat: THREE.Quaternion,
  metrics: RigMetrics,
  forearmHint: V3,
): (ArmSolution & { anchorLocal: THREE.Quaternion; handPos: V3 }) | null {
  const back = metrics.anchorInHand.clone().negate();
  let qHand = toolQuat.clone();
  let solution: ArmSolution | null = null;
  let handPos = anchor.clone();
  for (let pass = 0; pass < 5; pass += 1) {
    handPos = anchor.clone().add(back.clone().applyQuaternion(qHand));
    const roll = V(1, 0, 0).applyQuaternion(toolQuat);
    // The hint is passed in rather than taken from the hand we are solving for.
    // Feeding the previous pass's own answer back in is a fixed point: whatever
    // the first guess said, the elbow stayed there - which is how the basket arm
    // ended up with its elbow ABOVE the shoulder and the upper arm laid across
    // the chest.
    solution = solveArm(shoulder, handPos, forearmHint, roll, metrics);
    if (!solution) return null;
    qHand = solution.hand;
  }
  if (!solution) return null;
  return {
    ...solution,
    handPos,
    anchorLocal: solution.hand.clone().invert().multiply(toolQuat),
  };
}

// ── Body ──────────────────────────────────────────────────────────────────

export interface BodySpec {
  /** Hip hinge, radians. NEGATIVE leans the torso forward (front is -Z). */
  hinge: Curve;
  /** Knee bend, radians, positive. The root cancels it so the soles stay put. */
  knee: Curve;
  /** Spine yaw, radians. */
  twist: Curve;
  /** Head pitch in WORLD terms; negative looks down. */
  headPitch: Curve;
}

interface RigNodes {
  root: THREE.Object3D;
  playerRig: THREE.Object3D;
  pelvis: THREE.Object3D;
  spine: THREE.Object3D;
  head: THREE.Object3D;
  shoulder: { left: THREE.Object3D; right: THREE.Object3D };
  elbow: { left: THREE.Object3D; right: THREE.Object3D };
  thigh: { left: THREE.Object3D; right: THREE.Object3D };
  shin: { left: THREE.Object3D; right: THREE.Object3D };
  toolAnchor: THREE.Object3D;
}

function rigNodes(avatar: ReturnType<typeof createPlayerAvatar>): RigNodes {
  const root = crossThree<THREE.Object3D>(avatar.root);
  const pick = (name: string): THREE.Object3D => {
    const found = root.getObjectByName(name);
    if (!found) throw new Error(`player rig has no ${name}`);
    return crossThree<THREE.Object3D>(found);
  };
  return {
    root,
    playerRig: pick('playerRig'),
    pelvis: pick('pelvis'),
    spine: pick('spine'),
    head: pick('headPivot'),
    shoulder: { left: pick('leftUpperArmPivot'), right: pick('rightUpperArmPivot') },
    elbow: { left: pick('leftLowerArmPivot'), right: pick('rightLowerArmPivot') },
    thigh: { left: pick('leftThighPivot'), right: pick('rightThighPivot') },
    shin: { left: pick('leftShinPivot'), right: pick('rightShinPivot') },
    toolAnchor: pick('toolAnchor'),
  };
}

interface BodyFrame {
  /** Shoulder positions in FLOOR space (y = 0 at the soles). */
  shoulder: { left: V3; right: V3 };
  /** playerRig translation, so a caller can convert floor space to rig space. */
  rigOffset: V3;
  spineQuat: THREE.Quaternion;
}

/** Floor space -> `playerRig` local space. */
function toRigSpace(point: V3, frame: BodyFrame, metrics: RigMetrics): V3 {
  return point.clone().sub(frame.rigOffset).sub(V(0, metrics.groundLift, 0));
}

function applyBody(nodes: RigNodes, body: BodySpec, phase: number, metrics: RigMetrics): BodyFrame {
  const hinge = body.hinge(phase);
  const knee = body.knee(phase);
  const twist = body.twist(phase);

  // Knees: thigh forward by `knee`, shin back by the same, so the boot stays
  // vertical and flat. The root then cancels the sole's rise and its slide.
  for (const side of ['left', 'right'] as const) {
    nodes.thigh[side].rotation.set(knee, 0, 0);
    nodes.shin[side].rotation.set(-knee, 0, 0);
  }
  const rigOffset = V(0, -metrics.thigh * (1 - Math.cos(knee)), metrics.thigh * Math.sin(knee));
  nodes.playerRig.position.copy(rigOffset);
  nodes.playerRig.quaternion.identity();

  // Torso: one rigid hinge about the hip, yaw stacked on top of the lean.
  const lean = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), hinge);
  const yaw = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), twist);
  const spineQuat = yaw.clone().multiply(lean);
  const hip = V(0, metrics.hipY, 0);

  nodes.pelvis.quaternion.copy(lean);
  nodes.pelvis.position.copy(hip).add(V(0, metrics.pelvisAboveHip, 0).applyQuaternion(lean));
  nodes.spine.quaternion.copy(spineQuat);
  nodes.spine.position.copy(hip).add(V(0, metrics.spineAboveHip, 0).applyQuaternion(spineQuat));
  // The head is a child of the spine, so its track carries the difference
  // between where the lean puts it and where the clip wants it looking.
  nodes.head.rotation.set(body.headPitch(phase) - hinge, -twist * 0.35, 0);

  const shoulder: Record<'left' | 'right', V3> = { left: V(), right: V() };
  for (const side of ['left', 'right'] as const) {
    const sign = side === 'left' ? -1 : 1;
    const local = nodes.spine.position.clone()
      .add(V(sign * metrics.shoulderX, metrics.shoulderAboveSpine, 0).applyQuaternion(spineQuat));
    nodes.shoulder[side].position.copy(local);
    shoulder[side] = local.clone().add(rigOffset).add(V(0, metrics.groundLift, 0));
  }
  return { shoulder, rigOffset, spineQuat };
}

// ── Clip specifications ───────────────────────────────────────────────────

export interface PhaseSample {
  phase: number;
  seconds: number;
  /** All in FLOOR space (y = 0 is the ground the soles stand on). */
  rightHand: V3;
  leftHand: V3;
  toolTip: V3;
  toolAnchor: V3;
  /** Where the off hand ended up on the shaft, tool-local metres (hoe only). */
  gripSeparation: number | null;
  extension: { left: number; right: number };
}

export interface AuthoredClip {
  clip: THREE.AnimationClip;
  samples: PhaseSample[];
  notes: string[];
}

/** Direction from the blade up the shaft, for a shaft tilted `deg` off vertical. */
function shaftDir(deg: number): V3 {
  const a = THREE.MathUtils.degToRad(deg);
  return V(0, Math.cos(a), Math.sin(a));
}

/** Tool orientation whose local +Y runs up the shaft and whose local X stays level. */
function toolQuatFromShaft(dir: V3): THREE.Quaternion {
  const y = dir.clone().normalize();
  const x = perpendicular(y, V(1, 0, 0));
  const z = x.clone().cross(y).normalize();
  return basisQuat(x, y, z);
}

interface ToolFrame { anchor: V3; quat: THREE.Quaternion }

interface ActionSpec {
  name: string;
  duration: number;
  body: BodySpec;
  /** Tool pose in floor space, per phase. */
  tool: (phase: number, frame: BodyFrame) => ToolFrame;
  /**
   * Where the TOOL arm's elbow goes, as the world direction elbow -> hand. The
   * solver takes the reachable direction closest to it.
   */
  toolElbow: (phase: number, tool: ToolFrame) => V3;
  /**
   * The off hand. `shaft` grips a point on the tool and slides up it when the
   * arm cannot reach; `free` reaches an authored world point.
   */
  offHand:
    | { kind: 'shaft'; at: Curve; hint: (dir: V3) => V3 }
    | { kind: 'free'; at: (phase: number, frame: BodyFrame, tool: ToolFrame) => V3; hint: (frame: BodyFrame) => V3 };
  /** Mesh reported as the tool tip, and the MESH-LOCAL direction the tip faces. */
  tip: { mesh: string; toward: V3 };
}

const HOE: ActionSpec = {
  name: 'hoe',
  duration: 1.1,
  body: {
    // Phase 0 is the top of the raise, so the clip can be cut anywhere and the
    // strike still reads. 0.46-0.56 is the contact hold.
    hinge: periodic([[0, -0.10], [0.16, -0.05], [0.42, -0.44], [0.58, -1.00], [0.66, -1.02], [0.84, -0.40]]),
    knee: periodic([[0, 0.16], [0.16, 0.12], [0.42, 0.42], [0.58, 0.95], [0.66, 0.97], [0.84, 0.40]]),
    twist: periodic([[0, 0.10], [0.58, 0.0], [0.84, 0.05]]),
    headPitch: periodic([[0, -0.10], [0.42, -0.34], [0.58, -0.52], [0.66, -0.52], [0.84, -0.26]]),
  },
  tool: (() => {
    // Anchor = the top of the shaft, i.e. where the rear hand grips. The raise
    // holds the hoe up IN FRONT at ~45 deg rather than overhead behind the
    // head: on this rig an overhead blade drags both hands up to the face and
    // folds the arms to 40% of their reach, which reads as covering your eyes.
    const anchor = vecCurve(
      [[0, 0.13], [0.16, 0.13], [0.42, -0.02], [0.58, -0.16], [0.66, -0.16], [0.84, -0.02]],
      [[0, 1.06], [0.16, 1.10], [0.42, 0.99], [0.58, 0.80], [0.66, 0.80], [0.84, 0.96]],
      // The hands draw BACK as the shaft passes through horizontal and push out
      // again into the strike. Not a flourish: with the shaft level the grip
      // point is a metre in front, and unless the hands come in the front arm
      // cannot reach far enough down the shaft to clear the rear glove.
      [[0, -0.34], [0.16, -0.33], [0.42, -0.25], [0.58, -0.34], [0.66, -0.34], [0.84, -0.26]],
    );
    // Shaft angle off vertical. 200 deg = blade up and behind the head;
    // 26 deg = blade down and forward, on the soil.
    const angle = periodic([[0, 152], [0.16, 159], [0.42, 92], [0.58, 26], [0.66, 25], [0.84, 104]]);
    return (phase: number): ToolFrame => {
      const dir = shaftDir(angle(phase));
      return { anchor: anchor(phase), quat: toolQuatFromShaft(dir) };
    };
  })(),
  // Rear elbow rides the shaft but is pushed clear of the ribs.
  toolElbow: (_phase, tool) => V(0, -1, 0).applyQuaternion(tool.quat).add(V(0.30, 0, 0.10)),
  offHand: {
    // Mid-shaft. The solver slides it up when the arm is short.
    at: periodic([[0, -0.34], [0.58, -0.36], [0.84, -0.34]]),
    kind: 'shaft',
    // `hint` IS the elbow -> hand direction, so the elbow lands at
    // hand - 0.4 * hint. Pointing it down the shaft therefore parks the front
    // elbow exactly where the rear glove is; the dominant +x term swings that
    // elbow out to the left instead, which is where a two-handed grip puts it.
    hint: (dir) => dir.clone().negate().multiplyScalar(0.35).add(V(1.25, 0, -0.30)),
  },
  tip: { mesh: 'hoeBlade', toward: V(0, -1, 0) },
};

const WATER: ActionSpec = {
  name: 'water',
  duration: 1.6,
  body: {
    hinge: periodic([[0, -0.18], [0.25, -0.22], [0.5, -0.26], [0.75, -0.22]]),
    knee: periodic([[0, 0.14], [0.25, 0.15], [0.5, 0.17], [0.75, 0.15]]),
    // The sweep: the torso turns, and the arm rides it.
    twist: periodic([[0, 0], [0.25, 0.28], [0.5, 0], [0.75, -0.28]]),
    headPitch: periodic([[0, -0.26], [0.5, -0.32]]),
  },
  tool: (() => {
    // Held out in front at arm's length; the sweep is applied about the body.
    const sweep = periodic([[0, 0], [0.25, 0.34], [0.5, 0], [0.75, -0.34]]);
    // Spout pitch: local -Z is the spout, so a negative X rotation aims it
    // forward and DOWN. It nods a little as the pour crosses the middle.
    const pitch = periodic([[0, -0.62], [0.25, -0.74], [0.5, -0.84], [0.75, -0.74]]);
    const height = periodic([[0, 1.26], [0.25, 1.24], [0.5, 1.22], [0.75, 1.24]]);
    const reach = periodic([[0, -0.64], [0.25, -0.67], [0.5, -0.70], [0.75, -0.67]]);
    return (phase: number): ToolFrame => {
      const yaw = sweep(phase);
      const anchor = V(0.26, height(phase), reach(phase)).applyAxisAngle(V(0, 1, 0), yaw);
      const quat = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw)
        .multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), pitch(phase)));
      return { anchor, quat };
    };
  })(),
  // Elbow drops behind the can, so the arm reads as held OUT rather than as
  // one more diagonal laid across the chest.
  toolElbow: () => V(0, -0.34, -1),
  offHand: {
    kind: 'free',
    // Relaxed at the side, with a slow counter-sway against the torso.
    at: (phase, frame) => frame.shoulder.left.clone().add(V(-0.10, -0.78, 0.04 + 0.05 * Math.sin(phase * Math.PI * 2))),
    hint: () => V(0, -1, 0.12),
  },
  tip: { mesh: 'wateringCanSpout', toward: V(0, -1, 0) },
};

const HARVEST: ActionSpec = {
  name: 'harvest',
  duration: 1.4,
  body: {
    // Depth comes from the KNEES, not from folding the back in half: at a
    // -1.24 hinge the hat met the knee and the pose read as a collapse.
    hinge: periodic([[0, -0.14], [0.20, -0.62], [0.34, -0.92], [0.44, -0.95], [0.66, -0.54], [0.84, -0.16]]),
    knee: periodic([[0, 0.16], [0.20, 0.62], [0.34, 1.06], [0.44, 1.10], [0.66, 0.56], [0.84, 0.20]]),
    twist: periodic([[0, 0.06], [0.34, -0.10], [0.66, 0], [0.84, 0.08]]),
    headPitch: periodic([[0, -0.20], [0.34, -0.62], [0.44, -0.66], [0.66, -0.40], [0.84, -0.22]]),
  },
  // The basket is carried, so it hangs off the SHOULDER rather than off a world
  // point: it lowers with the crouch instead of being left behind in the air,
  // and it stays upright the whole clip so the load never spills.
  tool: (phase, frame) => ({
    anchor: frame.shoulder.right.clone().add(V(0.07, -0.44, -0.32)),
    quat: new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -0.10),
  }),
  // Carrying elbow: tucked at the side and slightly behind the basket.
  toolElbow: () => V(0.10, -0.62, -1),
  offHand: {
    kind: 'free',
    at: (phase, frame, tool) => {
      const ground = vecCurve(
        [[0, 0.02], [0.20, -0.03], [0.34, -0.06], [0.44, -0.06], [0.66, 0.0], [0.84, 0.02]],
        [[0, 0.95], [0.20, 0.60], [0.34, 0.35], [0.44, 0.34], [0.66, 0.68], [0.84, 0.95]],
        [[0, -0.30], [0.20, -0.38], [0.34, -0.36], [0.44, -0.35], [0.66, -0.35], [0.84, -0.30]],
      )(phase);
      // Near the top of the clip the picking hand goes to the basket rim, so
      // "reach, close, carry to the basket" reads as one move.
      const toBasket = periodic([[0, 0.85], [0.20, 0], [0.44, 0], [0.66, 0.15], [0.84, 0.9]])(phase);
      // Hand comes down onto the rim from ABOVE, so the deposit does not read
      // as folded arms.
      const rim = tool.anchor.clone().add(V(-0.19, 0.10, -0.06));
      return ground.lerp(rim, THREE.MathUtils.clamp(toBasket, 0, 1));
    },
    hint: () => V(0.20, -0.85, -0.45),
  },
  tip: { mesh: 'harvestBasket', toward: V(0, -1, 0) },
};

export const AUTHORED_ACTIONS: Readonly<Record<string, ActionSpec>> = { hoe: HOE, water: WATER, harvest: HARVEST };

// ── Baking ────────────────────────────────────────────────────────────────

/**
 * The CENTRE of a mesh's extreme face along a mesh-local direction.
 *
 * A single extreme vertex is a corner, and which corner wins flips as the tool
 * turns - the reported "tip" would jump 0.3 m across a basket between two
 * frames that look identical. Averaging every vertex on the extreme face gives
 * the blade's cutting edge, the spout's mouth and the basket's floor, and it
 * moves continuously.
 */
function extremeFaceCentre(mesh: THREE.Mesh, localToward: V3): V3 {
  const position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const dir = localToward.clone().normalize().transformDirection(mesh.matrixWorld);
  const point = V();
  const points: V3[] = [];
  let best = -Infinity;
  for (let i = 0; i < position.count; i += 1) {
    point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    const dot = point.dot(dir);
    if (dot > best + 1e-4) { best = dot; points.length = 0; points.push(point.clone()); }
    else if (dot > best - 1e-4) points.push(point.clone());
  }
  const centre = V();
  for (const p of points) centre.add(p);
  return points.length > 0 ? centre.divideScalar(points.length) : centre;
}

const TOOL_FOR_ACTION: Readonly<Record<string, string>> = {
  hoe: 'tool.hoe', water: 'tool.water', harvest: 'tool.harvest',
};

/**
 * Pose one avatar at one phase. Shared by the baker, the strip builder and the
 * intersection check, so all three look at exactly the same pose.
 */
export function poseAuthoredAction(
  avatar: ReturnType<typeof createPlayerAvatar>,
  spec: ActionSpec,
  phase: number,
  metrics: RigMetrics,
): PhaseSample & { unreachable: string[] } {
  const nodes = rigNodes(avatar);
  const unreachable: string[] = [];
  const frame = applyBody(nodes, spec.body, phase, metrics);
  const tool = spec.tool(phase, frame);

  // Tool hand (right): solved so the TOOL lands where the clip asked.
  const right = solveToolArm(frame.shoulder.right, tool.anchor, tool.quat, metrics, spec.toolElbow(phase, tool).normalize());
  if (right) {
    nodes.shoulder.right.quaternion.copy(right.upper);
    nodes.elbow.right.quaternion.copy(right.lower);
    nodes.toolAnchor.quaternion.copy(right.anchorLocal);
  } else {
    unreachable.push('right');
  }

  // Off hand.
  let left: ArmSolution | null = null;
  let gripSeparation: number | null = null;
  let leftTarget = frame.shoulder.left.clone().add(V(0, -0.7, 0));
  if (spec.offHand.kind === 'shaft') {
    const dir = V(0, 1, 0).applyQuaternion(tool.quat);
    const hint = spec.offHand.hint(dir);
    const wanted = spec.offHand.at(phase);
    // Slide up the shaft (toward the rear hand) until the grip is inside reach
    // AND the arm still has a bend left in it. A straight arm is not just ugly:
    // at full extension the elbow's circle of freedom collapses, the `hint` stops
    // being able to push the elbow anywhere, and the front forearm ends up laid
    // through the rear glove. ELBOW_ROOM is the extension above which that
    // happens on this rig, measured on the intersection check.
    const ELBOW_ROOM = 0.93;
    const roll = V(1, 0, 0).applyQuaternion(tool.quat);
    let fallback: { arm: ArmSolution; point: V3; s: number } | null = null;
    for (let s = wanted; s <= -0.02; s += 0.01) {
      const point = tool.anchor.clone().addScaledVector(dir, s);
      const candidate = solveArm(frame.shoulder.left, point, hint, roll, metrics);
      if (!candidate) continue;
      fallback ??= { arm: candidate, point, s };
      if (candidate.extension <= ELBOW_ROOM) { left = candidate; leftTarget = point; gripSeparation = -s; break; }
    }
    if (!left && fallback) { left = fallback.arm; leftTarget = fallback.point; gripSeparation = -fallback.s; }
    if (!left) unreachable.push('left');
  } else {
    leftTarget = spec.offHand.at(phase, frame, tool);
    const hint = spec.offHand.hint(frame);
    left = solveArm(frame.shoulder.left, leftTarget, hint, V(1, 0, 0), metrics);
    if (!left) {
      // Pull the target in toward the shoulder rather than tear the arm off.
      const toward = leftTarget.clone().sub(frame.shoulder.left);
      const max = (metrics.upperArm + metrics.foreArm) * 0.97;
      if (toward.length() > max) {
        leftTarget = frame.shoulder.left.clone().addScaledVector(toward.normalize(), max);
        left = solveArm(frame.shoulder.left, leftTarget, hint, V(1, 0, 0), metrics);
      }
      if (!left) unreachable.push('left');
    }
  }
  if (left) {
    nodes.shoulder.left.quaternion.copy(left.upper);
    nodes.elbow.left.quaternion.copy(left.lower);
  }

  nodes.root.updateMatrixWorld(true);
  const floor = V(0, metrics.groundLift, 0);
  const worldOf = (name: string): V3 => {
    const found = nodes.root.getObjectByName(name);
    const out = V();
    if (found) crossThree<THREE.Object3D>(found).getWorldPosition(out);
    return out.add(floor);
  };
  const tipMesh = nodes.root.getObjectByName(spec.tip.mesh);
  const toolTip = tipMesh
    ? extremeFaceCentre(crossThree<THREE.Mesh>(tipMesh), spec.tip.toward).add(floor)
    : V();

  return {
    phase,
    seconds: phase * spec.duration,
    rightHand: worldOf('rightHand'),
    leftHand: worldOf('leftHand'),
    toolTip,
    toolAnchor: worldOf('toolAnchor'),
    gripSeparation,
    extension: { left: left?.extension ?? NaN, right: right?.extension ?? NaN },
    unreachable,
  };
}

/**
 * Build one authored clip. Only the tool this clip uses stays in the tree while
 * the poses are measured, so the reported tip is that tool's.
 */
export function bakeAuthoredAction(
  action: keyof typeof AUTHORED_ACTIONS | string,
  jointNames: readonly string[],
  fps: number,
  reportPhases: readonly number[] = [0, 0.2, 0.4, 0.6, 0.8, 0.95],
): AuthoredClip {
  const spec = AUTHORED_ACTIONS[action];
  if (!spec) throw new Error(`no authored clip named ${action}`);
  const metrics = rigMetrics();
  const avatar = createPlayerAvatar();
  const root = crossThree<THREE.Object3D>(avatar.root);
  avatar.motion.update(0, false, 0);
  root.getObjectByName('waterStream')?.removeFromParent();
  const joints: JointSample[] = jointNames.map((n) => ({
    node: crossThree<THREE.Object3D>(root.getObjectByName(n)),
    position: true,
  }));

  const notes: string[] = [];
  const unreachable = new Set<string>();
  const clip = bakeClip(spec.name, spec.duration, fps, joints, (t) => {
    const sample = poseAuthoredAction(avatar, spec, t / spec.duration, metrics);
    for (const arm of sample.unreachable) unreachable.add(arm);
  });
  if (unreachable.size > 0) notes.push(`arm targets clamped: ${[...unreachable].join(', ')}`);

  // Measure the reported phases on an avatar carrying only this clip's tool, so
  // the tip is the tool a buyer sees.
  const probe = createPlayerAvatar();
  const probeRoot = crossThree<THREE.Object3D>(probe.root);
  probe.motion.update(0, false, 0);
  probeRoot.getObjectByName('waterStream')?.removeFromParent();
  for (const [other, group] of Object.entries(TOOL_FOR_ACTION)) {
    if (other !== spec.name) probeRoot.getObjectByName(group)?.removeFromParent();
  }
  probeRoot.getObjectByName('tool.inspect')?.removeFromParent();
  const samples = reportPhases.map((p) => {
    const { unreachable: _skip, ...rest } = poseAuthoredAction(probe, spec, p, metrics);
    return rest;
  });

  return { clip, samples, notes };
}

/** Pose a fresh avatar for the strip builder / the intersection check. */
export function authoredActionPose(action: string, phase: number): THREE.Object3D {
  const spec = AUTHORED_ACTIONS[action];
  if (!spec) throw new Error(`no authored clip named ${action}`);
  const metrics = rigMetrics();
  const avatar = createPlayerAvatar();
  const root = crossThree<THREE.Object3D>(avatar.root);
  avatar.motion.update(0, false, 0);
  root.getObjectByName('waterStream')?.removeFromParent();
  root.getObjectByName('tool.inspect')?.removeFromParent();
  for (const [other, group] of Object.entries(TOOL_FOR_ACTION)) {
    if (other !== spec.name) root.getObjectByName(group)?.removeFromParent();
  }
  poseAuthoredAction(avatar, spec, phase, metrics);
  delete (root.userData as Record<string, unknown>).motionController;
  root.updateMatrixWorld(true);
  root.position.y = metrics.groundLift;
  return root;
}

export const AUTHORING_NOTE =
  "Clunk-authored action clips; HF's own action poses were not saleable.";
