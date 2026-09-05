/**
 * Farmer v2 — a rigged low-poly farmhand, written as code.
 *
 * This replaces `public/market/hf-player-farmhand/player-farmhand.m1.glb`, which was taken off
 * the market. What was wrong with it is worth writing down, because every number below is an
 * answer to one of these:
 *
 *   - box hands with no thumb, and a wrist as thick as the forearm;
 *   - 3.9 heads tall, so it read as a mascot rather than a farmhand;
 *   - a straw hat floating over a bald skull it never touched, brim wider than the shoulders;
 *   - a face with no brow, no nose and no eyes — a blank at any distance;
 *   - shirt and trousers the same denim, so the silhouette carried no internal information;
 *   - twenty-odd separate meshes on pivots, which is why the inspector found eight pairs of
 *     parts driving through each other by up to 208 mm.
 *
 * The shape of the fix: ONE skinned surface on a twenty-bone humanoid, so a bending elbow
 * deforms a skin instead of sliding two boxes past each other; 6.9 heads at 1.75 m; hands with
 * four modelled fingers and an opposed thumb; a hat whose crown is an open shell sitting over
 * the skull with a measured 10-15 mm of air; and twelve flat colours out of the same warm range
 * the cozy-farm-set props use, carried on COLOR_0 so the whole character is one material.
 *
 * Measured (from the baked GLB, not from these constants): see `tmp/character/review.md`.
 *
 * Clip names are a contract with app/api/_lib/listing-variants.ts — idle, walk, inspect, water,
 * hoe, harvest — and their durations match the file this replaces so a consumer's state machine
 * does not have to change.
 *
 *   node scripts/threejs-to-glb.mjs examples/generated/characters/farmer-v2.factory.mjs out.glb
 */
import { createCharKit, ring, rectRing, clamp, smoothstep, DEG } from "./char-kit-v2.mjs";

// --- Palette ------------------------------------------------------------------------------
// Twelve flat colours, one material. The timber, terracotta and straw values are the cozy-farm
// -set range (farm-kit.mjs FARM_PALETTE) so this character stands in that shop's props without
// looking imported: hair is FARM woodFrame exactly, the shirt sits beside roofTile, the straw
// beside woodPale. Denim is the one value the prop set has no answer for; it is pulled toward
// the dock-rowboat hull navy rather than invented.
const C = {
  skin: 0xd8a273,
  hair: 0x6b4630, // = FARM_PALETTE.woodFrame
  shirt: 0xb0553c,
  shirtDark: 0x8a3f2c,
  denim: 0x46617f,
  denimDark: 0x33485f,
  boot: 0x5b3a26,
  bootSole: 0x33261d,
  straw: 0xd9b463,
  strawDark: 0xb0873c,
  eye: 0x2a2018,
  brass: 0xb98b3f, // = FARM_PALETTE.brass
};

// --- Skeleton heights (metres) ------------------------------------------------------------
// Leg is 51% of standing height and the head is 0.257 m chin-to-crown, which puts the figure at
// 6.9 heads — the range a readable adult character lives in. The hat crown, not the skull, is
// the top of the bounding box: 1.750 m total.
const ANKLE_Y = 0.082;
const KNEE_Y = 0.455;
const HIP_Y = 0.895;
const WAIST_Y = 1.01;
const CHEST_Y = 1.175;
const SHOULDER_Y = 1.37;
const NECK_Y = 1.415;
const HEAD_Y = 1.475;
const LEG_X = 0.095;
const ARM_X = 0.168;
const ARM_TILT = 8 * DEG; // A-pose lean: below the deltoid the arm hangs clear of the ribs.
const UPPER_ARM = 0.275;
const FOREARM = 0.25;

const ARM_DIR = [Math.sin(ARM_TILT), -Math.cos(ARM_TILT), 0];
const ELBOW = [ARM_X + UPPER_ARM * ARM_DIR[0], SHOULDER_Y + UPPER_ARM * ARM_DIR[1], 0];
const WRIST = [ELBOW[0] + FOREARM * ARM_DIR[0], ELBOW[1] + FOREARM * ARM_DIR[1], 0];
const HAND_END = [WRIST[0] + 0.13 * ARM_DIR[0], WRIST[1] + 0.13 * ARM_DIR[1], 0];

// --- Profiles -----------------------------------------------------------------------------
// A profile is a list of rest cross-sections. Two of them are consulted after the fact — the
// shirt's front surface places the bib and its straps, the skull's front surface places the
// brow, eyes and nose — so they are declared as data rather than buried in the emit calls.
const TORSO_SIDES = 14;
const TORSO_P = 0.78;
const TORSO = [
  { y: 0.955, rx: 0.134, rz: 0.088, rzBack: 0.086 },
  { y: 1.000, rx: 0.142, rz: 0.092, rzBack: 0.090 },
  { y: 1.070, rx: 0.148, rz: 0.100, rzBack: 0.094 },
  { y: 1.160, rx: 0.152, rz: 0.112, rzBack: 0.105 },
  { y: 1.250, rx: 0.156, rz: 0.116, rzBack: 0.108 },
  { y: 1.320, rx: 0.158, rz: 0.111, rzBack: 0.104 },
  { y: 1.362, rx: 0.154, rz: 0.101, rzBack: 0.096 },
  { y: 1.395, rx: 0.134, rz: 0.092, rzBack: 0.088 },
  { y: 1.412, rx: 0.100, rz: 0.079, rzBack: 0.076 },
  { y: 1.426, rx: 0.070, rz: 0.064, rzBack: 0.062 },
];

const HEAD_SIDES = 14;
const HEAD_P = 0.78;
const SKULL = [
  { y: 1.440, rx: 0.048, rz: 0.056, rzBack: 0.042 },
  { y: 1.468, rx: 0.078, rz: 0.086, rzBack: 0.074 },
  { y: 1.500, rx: 0.098, rz: 0.102, rzBack: 0.098 },
  { y: 1.535, rx: 0.109, rz: 0.111, rzBack: 0.111 },
  { y: 1.567, rx: 0.115, rz: 0.117, rzBack: 0.118 },
  { y: 1.596, rx: 0.117, rz: 0.119, rzBack: 0.120 },
  { y: 1.625, rx: 0.113, rz: 0.113, rzBack: 0.116 },
  { y: 1.660, rx: 0.096, rz: 0.095, rzBack: 0.100 },
  { y: 1.686, rx: 0.059, rz: 0.059, rzBack: 0.063 },
  { y: 1.697, rx: 0.020, rz: 0.020, rzBack: 0.022 },
];

function sampleProfile(profile, y) {
  if (y <= profile[0].y) return profile[0];
  if (y >= profile[profile.length - 1].y) return profile[profile.length - 1];
  for (let i = 0; i < profile.length - 1; i += 1) {
    const a = profile[i];
    const b = profile[i + 1];
    if (y >= a.y && y <= b.y) {
      const t = (y - a.y) / (b.y - a.y);
      return {
        y,
        rx: a.rx + (b.rx - a.rx) * t,
        rz: a.rz + (b.rz - a.rz) * t,
        rzBack: (a.rzBack ?? a.rz) + ((b.rzBack ?? b.rz) - (a.rzBack ?? a.rz)) * t,
      };
    }
  }
  return profile[profile.length - 1];
}

/** The polygon the mesh actually has at height y — not the analytic curve it was cut from. */
function ringAt(profile, y, sides, p) {
  const s = sampleProfile(profile, y);
  return ring(sides, s.rx, s.rz, { p, rzBack: s.rzBack, phase: Math.PI / sides });
}

/**
 * Where the surface really is, at height y and lateral position x, on the front of the body.
 * Placing a bib or an eye on the analytic ellipse leaves it hanging in air over a flat facet;
 * this walks the actual polygon so a feature offset of 1 mm means 1 mm.
 */
function surfaceZ(profile, y, x, sides, p, sign = 1) {
  const pts = ringAt(profile, y, sides, p);
  let best = null;
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (a[1] * sign < 0 && b[1] * sign < 0) continue;
    const lo = Math.min(a[0], b[0]);
    const hi = Math.max(a[0], b[0]);
    if (x < lo - 1e-9 || x > hi + 1e-9) continue;
    const t = Math.abs(b[0] - a[0]) < 1e-9 ? 0 : (x - a[0]) / (b[0] - a[0]);
    const z = a[1] + (b[1] - a[1]) * t;
    if (best === null || z * sign > best * sign) best = z;
  }
  return best ?? 0;
}
const frontZ = (profile, y, x, sides, p) => surfaceZ(profile, y, x, sides, p, 1);
/** The widest |x| the mesh actually reaches at height y — where a strap has to cross over. */
function maxRingX(profile, y, sides, p) {
  return Math.max(...ringAt(profile, y, sides, p).map(([x]) => Math.abs(x)));
}

/**
 * The line an overall strap takes across the shirt, in the plane x = +-value: up the chest,
 * over the point of the shoulder (found by walking up until the cross-section is narrower than
 * the strap), and down the back. Returns [y, z] stations in path order.
 */
function strapPath(x) {
  const front = [];
  const back = [];
  let apex = 1.42;
  for (let y = 1.296; y <= 1.446; y += 0.004) {
    if (maxRingX(TORSO, y, TORSO_SIDES, TORSO_P) <= x + 0.0015) { apex = y; break; }
    front.push([y, surfaceZ(TORSO, y, x, TORSO_SIDES, TORSO_P, 1)]);
    back.push([y, surfaceZ(TORSO, y, x, TORSO_SIDES, TORSO_P, -1)]);
  }
  const thin = (list) => {
    const step = Math.max(1, Math.floor(list.length / 5));
    const out = list.filter((_, i) => i % step === 0);
    if (out[out.length - 1] !== list[list.length - 1]) out.push(list[list.length - 1]);
    return out;
  };
  const up = thin(front);
  const down = thin(back).reverse();
  return [...up, [apex, 0], ...down, [1.262, back[0][1] * 1.02]];
}

/** The hand cross-section: four rounded finger lobes, grooved on both faces so the fingers read
 *  as fingers from the back of the hand and from the palm, not only in a three-quarter view. */
function handProfile(halfX, halfZ, notch) {
  const pts = [];
  const lobe = (halfZ * 2) / 4;
  // Palm side: local +X, swept from -Z to +Z. Five points, essentially flat.
  for (let f = 0; f < 4; f += 1) {
    const centre = -halfZ + lobe * (f + 0.5);
    if (f > 0) pts.push([halfX - notch * 0.55, centre - lobe * 0.5]);
    pts.push([halfX * 0.97, centre]);
  }
  pts.unshift([halfX * 0.80, -halfZ]);
  pts.push([halfX * 0.80, halfZ]);
  // Back side: local -X, swept from +Z back to -Z, four rounded finger lobes and three grooves.
  for (let f = 3; f >= 0; f -= 1) {
    const centre = -halfZ + lobe * (f + 0.5);
    pts.push([-halfX * 0.86, centre + lobe * 0.40]);
    pts.push([-halfX, centre]);
    pts.push([-halfX * 0.86, centre - lobe * 0.40]);
    if (f > 0) pts.push([-halfX + notch, centre - lobe * 0.5]);
  }
  return pts;
}

export default function createFarmerV2(THREE) {
  const kit = createCharKit(THREE);
  const { Builder, Rig, bakeClip, frameFromAxes, V } = kit;

  // --- Skeleton ---------------------------------------------------------------------------
  // Every bone's rest rotation is identity: the bind pose is decided by positions alone, and a
  // bone's direction is (pos -> tail). That is what lets `aim` and the IK solver be a single
  // minimal rotation instead of a per-bone convention nobody can keep straight.
  const side = { R: -1, L: 1 }; // the figure faces +Z, so its right hand is at -X
  const bones = [
    { name: "Hips", parent: null, pos: [0, HIP_Y, 0], tail: [0, WAIST_Y, 0] },
    { name: "Spine", parent: "Hips", pos: [0, WAIST_Y, 0], tail: [0, CHEST_Y, 0] },
    { name: "Chest", parent: "Spine", pos: [0, CHEST_Y, 0], tail: [0, NECK_Y, 0] },
    { name: "Neck", parent: "Chest", pos: [0, NECK_Y, 0], tail: [0, HEAD_Y, 0] },
    { name: "Head", parent: "Neck", pos: [0, HEAD_Y, 0], tail: [0, 1.66, 0] },
    { name: "Hat", parent: "Head", pos: [0, 1.60, 0], tail: [0, 1.75, 0] },
  ];
  for (const [tag, sx] of Object.entries(side)) {
    bones.push(
      { name: `Shoulder_${tag}`, parent: "Chest", pos: [sx * 0.045, 1.352, 0], tail: [sx * ARM_X, SHOULDER_Y, 0] },
      { name: `UpperArm_${tag}`, parent: `Shoulder_${tag}`, pos: [sx * ARM_X, SHOULDER_Y, 0], tail: [sx * ELBOW[0], ELBOW[1], 0] },
      { name: `Forearm_${tag}`, parent: `UpperArm_${tag}`, pos: [sx * ELBOW[0], ELBOW[1], 0], tail: [sx * WRIST[0], WRIST[1], 0] },
      { name: `Hand_${tag}`, parent: `Forearm_${tag}`, pos: [sx * WRIST[0], WRIST[1], 0], tail: [sx * HAND_END[0], HAND_END[1], 0] },
      { name: `UpperLeg_${tag}`, parent: "Hips", pos: [sx * LEG_X, HIP_Y, 0], tail: [sx * LEG_X, KNEE_Y, 0] },
      { name: `LowerLeg_${tag}`, parent: `UpperLeg_${tag}`, pos: [sx * LEG_X, KNEE_Y, 0], tail: [sx * LEG_X, ANKLE_Y, 0] },
      { name: `Foot_${tag}`, parent: `LowerLeg_${tag}`, pos: [sx * LEG_X, ANKLE_Y, 0], tail: [sx * LEG_X, 0.030, 0.125] },
    );
  }
  const rig = new Rig(bones, { falloff: 3.2 });

  const B = new Builder();
  const M4 = () => new THREE.Matrix4();
  const IDENT = M4();

  // Bone sets each part may be weighted to. A right hand vertex is 12 cm from the right thigh
  // at rest; without this list the distance painter would hand it to the leg.
  const SET = {
    shirt: ["Chest", "Spine", "Neck", "Hips"],
    shirtR: ["UpperArm_R", "Shoulder_R", "Chest", "Spine"],
    shirtL: ["UpperArm_L", "Shoulder_L", "Chest", "Spine"],
    pelvis: ["Hips", "Spine", "UpperLeg_R", "UpperLeg_L"],
    neck: ["Neck", "Head", "Chest"],
    head: ["Head"],
    hat: ["Hat"],
  };
  const armSet = (t) => [`UpperArm_${t}`, `Forearm_${t}`, "Chest", `Shoulder_${t}`];
  const foreSet = (t) => [`Forearm_${t}`, `Hand_${t}`, `UpperArm_${t}`];
  const handSet = (t) => [`Hand_${t}`, `Forearm_${t}`];
  const legSet = (t) => ["Hips", `UpperLeg_${t}`, `LowerLeg_${t}`, `Foot_${t}`];
  const bootSet = (t) => [`LowerLeg_${t}`, `Foot_${t}`];

  const sec = (y, pts, extra = {}) => ({ y, pts, ...extra });
  const torsoRing = (y) => ringAt(TORSO, y, TORSO_SIDES, TORSO_P);
  const shirtFrontZ = (y, x) => frontZ(TORSO, y, x, TORSO_SIDES, TORSO_P);
  const skullFrontZ = (y, x) => frontZ(SKULL, y, x, HEAD_SIDES, HEAD_P);

  // --- Torso: the shirt, and the deltoid caps that belong to it -----------------------------
  B.part("shirt", SET.shirt).colour(C.shirt);
  B.loft(TORSO.map((s) => sec(s.y, torsoRing(s.y))), { capStart: true, capEnd: true });

  // Collar: modelled, not painted. A band standing 6 mm off the neck, with its inner disc left
  // in so a camera looking down sees a collar and not the inside of the shirt.
  B.part("collar", SET.neck).colour(C.shirtDark);
  B.loft(
    [
      sec(1.408, ring(TORSO_SIDES, 0.079, 0.073, { p: TORSO_P, rzBack: 0.071, phase: Math.PI / TORSO_SIDES })),
      sec(1.428, ring(TORSO_SIDES, 0.074, 0.069, { p: TORSO_P, rzBack: 0.067, phase: Math.PI / TORSO_SIDES })),
      sec(1.450, ring(TORSO_SIDES, 0.068, 0.064, { p: TORSO_P, rzBack: 0.062, phase: Math.PI / TORSO_SIDES })),
    ],
    { capStart: true, capEnd: true },
  );

  B.part("neck", SET.neck).colour(C.skin);
  B.loft(
    [
      sec(1.378, ring(10, 0.070, 0.066)),
      sec(1.418, ring(10, 0.061, 0.058)),
      sec(1.455, ring(10, 0.056, 0.055)),
      sec(1.482, ring(10, 0.054, 0.054)),
    ],
    { capStart: true, capEnd: true },
  );

  // --- Overalls: bib, pocket, straps, buttons, seat, legs -----------------------------------
  // Real thickness, following the shirt's actual surface. A bib drawn as a flat slab across a
  // curved chest either floats at the edges or sinks in the middle.
  const bibRows = [1.045, 1.105, 1.165, 1.225, 1.285, 1.320];
  const bibCols = [-0.078, -0.052, -0.026, 0, 0.026, 0.052, 0.078];
  const bibOuter = bibRows.map((y) => bibCols.map((x) => [x, y, shirtFrontZ(y, x) + 0.011]));
  const bibInner = bibRows.map((y) => bibCols.map((x) => [x, y, shirtFrontZ(y, x) - 0.004]));
  B.part("bib", SET.shirt).colour(C.denim);
  B.panel(bibOuter, bibInner);

  const pocketRows = [1.112, 1.150, 1.186];
  const pocketCols = [-0.046, -0.023, 0, 0.023, 0.046];
  B.part("pocket", SET.shirt).colour(C.denimDark);
  B.panel(
    pocketRows.map((y) => pocketCols.map((x) => [x, y, shirtFrontZ(y, x) + 0.018])),
    pocketRows.map((y) => pocketCols.map((x) => [x, y, shirtFrontZ(y, x) + 0.009])),
  );

  for (const [tag, sx] of Object.entries(side)) {
    // Up the chest, over the point of the shoulder and down the back. Stations are found by
    // walking the shirt's own cross-section at a fixed x, so the strap lies ON the body: the
    // first cut of this used a straight chord over the shoulder, the strap vanished inside the
    // shirt, and all that reached the render were two blue horns at the top of the bib.
    const path = strapPath(0.085);
    const outer = [];
    const inner = [];
    for (let i = 0; i < path.length; i += 1) {
      const prev = path[Math.max(0, i - 1)];
      const next = path[Math.min(path.length - 1, i + 1)];
      let ty = next[0] - prev[0];
      let tz = next[1] - prev[1];
      const tl = Math.hypot(ty, tz) || 1;
      ty /= tl;
      tz /= tl;
      const n = [0, -tz, ty]; // the surface tangent turned a quarter turn: outward
      const push = (k, t) => [sx * (0.085 + t * 0.021), path[i][0] + n[1] * k, path[i][1] + n[2] * k];
      outer.push([push(0.009, -1), push(0.009, 0), push(0.009, 1)]);
      inner.push([push(-0.006, -1), push(-0.006, 0), push(-0.006, 1)]);
    }
    B.part(`strap_${tag}`, SET.shirt).colour(C.denim);
    B.panel(outer, inner);

    const bz = shirtFrontZ(1.308, 0.062) + 0.014;
    B.part(`button_${tag}`, SET.shirt).colour(C.brass);
    B.loft(
      [sec(0, ring(8, 0.011, 0.011)), sec(0.008, ring(8, 0.0095, 0.0095))],
      { frame: frameFromAxes([sx * 0.062, 1.308, bz], [1, 0, 0], [0, 0, 1]) },
    );
  }

  B.part("pelvis", SET.pelvis).colour(C.denim);
  B.loft(
    [
      sec(0.858, ring(TORSO_SIDES, 0.163, 0.112, { p: TORSO_P, phase: Math.PI / TORSO_SIDES })),
      sec(0.895, ring(TORSO_SIDES, 0.169, 0.115, { p: TORSO_P, phase: Math.PI / TORSO_SIDES })),
      sec(0.960, ring(TORSO_SIDES, 0.163, 0.111, { p: TORSO_P, rzBack: 0.108, phase: Math.PI / TORSO_SIDES })),
      sec(1.045, ring(TORSO_SIDES, 0.149, 0.102, { p: TORSO_P, rzBack: 0.097, phase: Math.PI / TORSO_SIDES })),
    ],
    { capStart: true, capEnd: true },
  );

  // --- Legs and boots -----------------------------------------------------------------------
  for (const [tag, sx] of Object.entries(side)) {
    const leg = (y, rx, rz, cx) => sec(y, ring(10, rx, rz, { p: 0.85 }), { cx: sx * cx });
    B.part(`trouser_${tag}`, legSet(tag)).colour(C.denim);
    B.loft(
      [
        leg(0.230, 0.061, 0.066, 0.095),
        leg(0.330, 0.063, 0.068, 0.095),
        leg(0.455, 0.066, 0.071, 0.096),
        leg(0.620, 0.073, 0.078, 0.097),
        leg(0.800, 0.082, 0.088, 0.099),
        leg(0.900, 0.087, 0.093, 0.101),
      ],
      { capStart: false, capEnd: true },
    );
    B.part(`cuff_${tag}`, bootSet(tag)).colour(C.denimDark);
    B.loft([leg(0.194, 0.0645, 0.0695, 0.095), leg(0.232, 0.0635, 0.0685, 0.095)], { capStart: false, capEnd: false });

    B.part(`boot_${tag}`, bootSet(tag)).colour(C.boot);
    B.loft(
      [
        leg(0.100, 0.060, 0.075, 0.095),
        leg(0.150, 0.061, 0.071, 0.095),
        leg(0.215, 0.062, 0.067, 0.095),
      ],
      { capStart: false, capEnd: true },
    );
    B.part(`shoe_${tag}`, [`Foot_${tag}`]).colour(C.boot);

    // The foot is lofted along +Z from the heel to the toe, so it gets a real last: a wide
    // instep, a narrowing toe and a flat sole plane at y = 0.028 that the sole slab meets.
    const footFrame = frameFromAxes([sx * 0.095, 0.028, -0.080], [-1, 0, 0], [0, 0, 1]);
    const shoe = (along, halfX, top) => sec(along, rectRing(halfX, top / 2, Math.min(0.012, halfX * 0.4), 2).map(([x, z]) => [x, z + top / 2]));
    B.loft(
      [shoe(0.0, 0.043, 0.078), shoe(0.030, 0.053, 0.094), shoe(0.080, 0.056, 0.086), shoe(0.140, 0.054, 0.062), shoe(0.190, 0.047, 0.041), shoe(0.215, 0.034, 0.027)],
      { frame: footFrame, capStart: true, capEnd: true },
    );

    B.part(`sole_${tag}`, [`Foot_${tag}`]).colour(C.bootSole);
    const soleFrame = frameFromAxes([sx * 0.095, 0.0, -0.086], [-1, 0, 0], [0, 0, 1]);
    const sole = (along, halfX, top) => sec(along, rectRing(halfX, top / 2, Math.min(0.010, halfX * 0.4), 2).map(([x, z]) => [x, z + top / 2]));
    B.loft(
      [sole(0.0, 0.045, 0.032), sole(0.036, 0.056, 0.030), sole(0.086, 0.059, 0.026), sole(0.146, 0.057, 0.026), sole(0.196, 0.050, 0.026), sole(0.227, 0.036, 0.024)],
      { frame: soleFrame, capStart: true, capEnd: true },
    );
  }

  // --- Arms ---------------------------------------------------------------------------------
  // One frame from shoulder to fingertip, built from explicit axes rather than a shortest-arc
  // rotation, so "local +X is the palm side" stays true on both arms and the wrist rings of the
  // forearm and the hand are cut in the same plane.
  for (const [tag, sx] of Object.entries(side)) {
    const dir = [sx * ARM_DIR[0], ARM_DIR[1], 0];
    const armFrame = frameFromAxes([sx * ARM_X, SHOULDER_Y, 0], [-sx, 0, 0], dir);
    const fz = sx; // local +Z maps to world +Z * fz
    const a = (along, rx, rz, extra = {}) => sec(along, ring(10, rx, rz, { p: extra.p ?? 1 }), extra);

    B.part(`deltoid_${tag}`, tag === "R" ? SET.shirtR : SET.shirtL).colour(C.shirt);
    B.loft(
      [a(-0.004, 0.034, 0.033), a(0.012, 0.0500, 0.0480), a(0.060, 0.0524, 0.0498), a(0.140, 0.0524, 0.0500), a(0.210, 0.0516, 0.0494), a(0.270, 0.0505, 0.0484)],
      { frame: armFrame, capStart: true, capEnd: false },
    );

    B.part(`sleeve_${tag}`, armSet(tag));
    B.loft(
      [a(0.270, 0.0505, 0.0484), a(0.288, 0.0498, 0.0478), a(0.298, 0.0566, 0.0546), a(0.318, 0.0560, 0.0540), a(0.326, 0.0450, 0.0435)],
      { frame: armFrame, capStart: false, capEnd: false, colours: [C.shirt, C.shirtDark, C.shirtDark, C.shirtDark] },
    );

    B.part(`forearm_${tag}`, foreSet(tag)).colour(C.skin);
    B.loft(
      [a(0.326, 0.0450, 0.0435), a(0.360, 0.0428, 0.0414), a(0.410, 0.0392, 0.0380), a(0.462, 0.0348, 0.0338), a(0.492, 0.0305, 0.0298), a(0.518, 0.0286, 0.0280)],
      { frame: armFrame, capStart: false, capEnd: true },
    );

    // Hand. Sixteen points per section: five across a flat palm, eleven around four finger
    // lobes on the back. The grooves open as the block leaves the knuckles, and the section
    // centres walk toward the palm so the fingers rest curled instead of splayed.
    const hand = (along, halfX, halfZ, notch, cx = 0) => sec(along, handProfile(halfX, halfZ, notch), { cx });
    B.part(`hand_${tag}`, handSet(tag)).colour(C.skin);
    B.loft(
      [
        hand(0.498, 0.0250, 0.0244, 0),
        hand(0.522, 0.0232, 0.0268, 0),
        hand(0.548, 0.0212, 0.0356, 0),
        hand(0.578, 0.0202, 0.0424, 0.0024),
        hand(0.606, 0.0198, 0.0432, 0.0078, 0.0012),
        hand(0.634, 0.0190, 0.0422, 0.0092, 0.0060),
        hand(0.660, 0.0174, 0.0400, 0.0094, 0.0128),
        hand(0.680, 0.0136, 0.0348, 0.0080, 0.0196),
      ],
      { frame: armFrame, capStart: true, capEnd: true },
    );

    // Opposed thumb: it leaves the palm's front edge and crosses toward the fingers, which is
    // the whole difference between a hand and a mitten.
    const thumbDir = V(0.42, 0.80, fz * 0.43).normalize();
    const thumbLocal = M4().compose(
      V(0.012, 0.572, fz * 0.028),
      new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), thumbDir),
      V(1, 1, 1),
    );
    B.part(`thumb_${tag}`, handSet(tag)).colour(C.skin);
    B.loft(
      [sec(0, ring(6, 0.0145, 0.0135)), sec(0.022, ring(6, 0.0140, 0.0130)), sec(0.042, ring(6, 0.0125, 0.0118)), sec(0.058, ring(6, 0.0100, 0.0095))],
      { frame: armFrame.clone().multiply(thumbLocal), capStart: true, capEnd: true },
    );
  }

  // --- Head ---------------------------------------------------------------------------------
  B.part("skull", SET.head).colour(C.skin);
  B.loft(SKULL.map((s) => sec(s.y, ringAt(SKULL, s.y, HEAD_SIDES, HEAD_P))), { capStart: true, capEnd: true });

  // Brow shelf: a curved panel standing 11 mm off the forehead. It is what puts the eyes in
  // shadow at a distance, and it is the single feature the old head was missing most.
  const browRows = [1.576, 1.588, 1.600];
  const browCols = [-0.086, -0.058, -0.030, 0, 0.030, 0.058, 0.086];
  B.part("brow", SET.head).colour(C.skin);
  B.panel(
    browRows.map((y) => browCols.map((x) => [x, y, skullFrontZ(y, x) + (y > 1.594 ? 0.004 : 0.008)])),
    browRows.map((y) => browCols.map((x) => [x, y, skullFrontZ(y, x) - 0.004])),
  );

  for (const sx of [-1, 1]) {
    // Eye: an eight-sided disc sitting flush in the shelf's shadow, plus a lid that overhangs
    // it by 4 mm. Geometry, not a texture and not a painted dot.
    const ex = sx * 0.045;
    const ey = 1.5655;
    const ez = skullFrontZ(ey, Math.abs(ex));
    B.part(`eye_${sx < 0 ? "R" : "L"}`, SET.head).colour(C.eye);
    B.loft(
      [sec(0, ring(8, 0.0185, 0.0105)), sec(0.008, ring(8, 0.0168, 0.0092))],
      { frame: frameFromAxes([ex, ey, ez - 0.006], [1, 0, 0], [0, 0, 1]), capStart: true, capEnd: true },
    );
    B.part(`lid_${sx < 0 ? "R" : "L"}`, SET.head).colour(C.skin);
    B.box([ex, 1.5740, ez + 0.0030], [0.042, 0.005, 0.010]);
    B.part(`brow_hair_${sx < 0 ? "R" : "L"}`, SET.head).colour(C.hair);
    B.box([ex, 1.5870, skullFrontZ(1.5870, Math.abs(ex)) + 0.0135], [0.052, 0.011, 0.011]);

    B.part(`ear_${sx < 0 ? "R" : "L"}`, SET.head).colour(C.skin);
    B.loft(
      [sec(0, ring(6, 0.016, 0.011)), sec(0.010, ring(6, 0.017, 0.012)), sec(0.020, ring(6, 0.013, 0.009))],
      { frame: frameFromAxes([sx * 0.104, 1.548, -0.004], [0, 1, 0], [sx, 0, 0]), capStart: true, capEnd: true },
    );
  }

  // Nose: a four-section taper that leaves the face at the nostrils and merges back into it
  // under the brow. In profile it is the difference between a head and a potato.
  B.part("nose", SET.head).colour(C.skin);
  B.loft(
    [
      sec(1.514, ring(6, 0.019, 0.009), { cz: skullFrontZ(1.514, 0) - 0.002 }),
      sec(1.532, ring(6, 0.018, 0.013), { cz: skullFrontZ(1.532, 0) + 0.008 }),
      sec(1.548, ring(6, 0.014, 0.011), { cz: skullFrontZ(1.548, 0) + 0.010 }),
      sec(1.570, ring(6, 0.011, 0.007), { cz: skullFrontZ(1.570, 0) + 0.003 }),
      sec(1.590, ring(6, 0.009, 0.005), { cz: skullFrontZ(1.590, 0) - 0.004 }),
    ],
    { capStart: true, capEnd: true },
  );

  B.part("mouth", SET.head).colour(C.hair);
  B.box([0, 1.4955, skullFrontZ(1.4955, 0) + 0.001], [0.040, 0.008, 0.010]);

  // Hair, as a shell 6 mm off the skull, in two panels: the back and sides down to the nape,
  // and a fringe across the forehead that stops under the hat's brim line.
  const hairPoint = (y, deg, offset) => {
    const s = sampleProfile(SKULL, y);
    const t = deg * DEG;
    const c = Math.cos(t);
    const sn = Math.sin(t);
    const depth = sn >= 0 ? s.rz : s.rzBack;
    const x = s.rx * Math.sign(c) * Math.abs(c) ** HEAD_P;
    const z = depth * Math.sign(sn) * Math.abs(sn) ** HEAD_P;
    const len = Math.hypot(x, z) || 1;
    return [x + (x / len) * offset, y, z + (z / len) * offset];
  };
  // The top row is tipped by the same 5 degrees as the hat, so the hair meets the brim all the way
  // round instead of poking through it at the back and leaving bare skull at the front.
  const hairGrid = (rows, thetas, offset) =>
    rows.map((row) => thetas.map((deg) => {
      const sn = Math.sin(deg * DEG);
      const y = row.base + (row.tilt ?? 0) * sn + (row.nape ?? 0) * Math.max(0, -sn) + (row.temple ?? 0) * Math.max(0, sn);
      return hairPoint(y, deg, offset);
    }));
  const backThetas = [];
  for (let i = 0; i <= 12; i += 1) backThetas.push(125 + (i / 12) * 290);
  const backRows = [
    { base: 1.520, nape: -0.052, temple: 0.030 },
    { base: 1.552, nape: -0.030, temple: 0.020 },
    { base: 1.577, nape: -0.014, temple: 0.010 },
    { base: 1.5905, tilt: 0.0105 },
  ];
  B.part("hair_back", SET.head).colour(C.hair);
  B.panel(hairGrid(backRows, backThetas, 0.005), hairGrid(backRows, backThetas, -0.001));
  const frontThetas = [];
  for (let i = 0; i <= 6; i += 1) frontThetas.push(125 - (i / 6) * 70);
  const frontRows = [{ base: 1.5885 }, { base: 1.5950 }, { base: 1.5905, tilt: 0.0105 }];
  B.part("hair_front", SET.head).colour(C.hair);
  B.panel(hairGrid(frontRows, frontThetas, 0.006), hairGrid(frontRows, frontThetas, -0.001));

  // --- Straw hat ----------------------------------------------------------------------------
  // The crown is an open shell, not a solid cone: it surrounds the skull with air between them
  // rather than sharing space with it, and the whole hat is tipped 5 degrees back off the brow
  // so the face stays visible from a three-quarter camera.
  const hatFrame = M4().compose(V(0, 1.60, 0), new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -5 * DEG), V(1, 1, 1));
  const HAT_SIDES = 16;
  const hatRing = (r, y) => ring(HAT_SIDES, r, r, { phase: Math.PI / HAT_SIDES }).map(([x, z]) => [x, y, z]);
  const at = (x, y, z) => B.at(hatFrame, x, y, z);
  const brimRing = (r, y) => hatRing(r, y).map(([x, yy, z]) => at(x, yy, z));
  const IT = brimRing(0.136, 0.012);
  const OT = brimRing(0.200, -0.010);
  const OB = brimRing(0.200, -0.022);
  const IB = brimRing(0.136, 0.000);
  B.part("hat_brim", SET.hat).colour(C.straw);
  for (let i = 0; i < HAT_SIDES; i += 1) {
    const j = (i + 1) % HAT_SIDES;
    B.colour(C.straw).quad(IT[i], IT[j], OT[j], OT[i]);
    B.colour(C.straw).quad(OT[i], OT[j], OB[j], OB[i]);
    B.colour(C.strawDark).quad(OB[i], OB[j], IB[j], IB[i]);
    B.colour(C.strawDark).quad(IB[i], IB[j], IT[j], IT[i]);
  }

  B.part("hat_crown", SET.hat).colour(C.straw);
  B.loft(
    [sec(0.012, hatRing(0.136, 0).map(([x, , z]) => [x, z])), sec(0.058, hatRing(0.133, 0).map(([x, , z]) => [x, z])), sec(0.100, hatRing(0.120, 0).map(([x, , z]) => [x, z])), sec(0.132, hatRing(0.092, 0).map(([x, , z]) => [x, z])), sec(0.148, hatRing(0.053, 0).map(([x, , z]) => [x, z]))],
    { frame: hatFrame, capStart: false, capEnd: true },
  );

  B.part("hat_band", SET.hat).colour(C.boot);
  B.loft(
    [
      sec(0.014, hatRing(0.1358, 0).map(([x, , z]) => [x, z])),
      sec(0.018, hatRing(0.1412, 0).map(([x, , z]) => [x, z])),
      sec(0.040, hatRing(0.1400, 0).map(([x, , z]) => [x, z])),
      sec(0.044, hatRing(0.1340, 0).map(([x, , z]) => [x, z])),
    ],
    { frame: hatFrame, capStart: false, capEnd: false },
  );

  // --- Bind ----------------------------------------------------------------------------------
  const geometry = B.finalize(rig);
  const material = new THREE.MeshStandardMaterial({
    name: "farmer_v2",
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.88,
    metalness: 0,
  });
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = "farmer_body";

  const root = new THREE.Group();
  root.name = "farmer_v2";
  root.add(rig.rootBone);
  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(rig.skeleton, new THREE.Matrix4());

  // --- Clips -----------------------------------------------------------------------------------
  // Feet are planted by IK in every clip, which is the only way "the sole stays on y = 0" is a
  // guarantee rather than a hope: the pose function moves the hips and the spine, and the legs
  // are then solved back down to whatever the feet were told to do.
  const ANKLE_R = [-LEG_X, ANKLE_Y, 0];
  const ANKLE_L = [LEG_X, ANKLE_Y, 0];

  function plant(r, targetR, targetL, pitchR = 0, pitchL = 0) {
    for (const [tag, target, pitch] of [["R", targetR, pitchR], ["L", targetL, pitchL]]) {
      const hip = r.worldPos(`UpperLeg_${tag}`);
      void hip;
      r.ik(`UpperLeg_${tag}`, `LowerLeg_${tag}`, `Foot_${tag}`, target, [0, 0, 1]);
      const rest = V(0, 0.030 - ANKLE_Y, 0.125).normalize();
      const dir = rest.clone().applyAxisAngle(V(1, 0, 0), pitch * DEG);
      r.aim(`Foot_${tag}`, [dir.x, dir.y, dir.z]);
    }
  }

  const TAU = Math.PI * 2;
  /** 0 -> 1 -> 0 with zero slope at both ends, so a one-shot clip still loops without a jolt. */
  const swell = (u) => 0.5 - 0.5 * Math.cos(TAU * u);

  function idle(r, t, d) {
    const breath = Math.sin((TAU * t) / (d / 2));
    const shift = Math.sin((TAU * t) / d);
    r.hips([0.010 * shift, 0.005 * breath - 0.004, 0]);
    r.euler("Hips", 0, 2.0 * shift, 1.6 * shift);
    r.euler("Spine", 1.0 * breath, -1.0 * shift, -0.8 * shift);
    r.euler("Chest", -1.7 * breath, -0.6 * shift, -0.6 * shift);
    r.euler("Neck", 0.7 * breath, 0, 0);
    r.euler("Head", -1.4 * breath, 7 * Math.sin((TAU * t) / d + 0.9), -1.5 * shift);
    for (const [tag, sx] of Object.entries(side)) {
      r.euler(`UpperArm_${tag}`, 2.2 * breath + 1.5 * shift * sx, 0, sx * (2.0 + 1.0 * breath));
      r.euler(`Forearm_${tag}`, -7 - 2.5 * breath, 0, 0);
      r.euler(`Hand_${tag}`, -3, 0, sx * 3);
    }
    plant(r, ANKLE_R, ANKLE_L);
  }

  // Walk. The stance foot travels backwards at exactly stride / period and never leaves y = 0.082
  // until toe-off, so an engine that drives the root forward at 0.80 m/s gets a foot that is
  // still on the ground. Nothing is translated here: the clip is in place, and the contract is
  // the constant stance velocity, which tools/render.mjs measures.
  const WALK_T = 0.83;
  const DUTY = 0.6;
  const HALF_STEP = 0.20;
  const WALK_SPEED = (2 * HALF_STEP) / (DUTY * WALK_T);
  function footAt(phase) {
    const ph = ((phase % 1) + 1) % 1;
    if (ph < DUTY) {
      return { z: HALF_STEP - 2 * HALF_STEP * (ph / DUTY), y: ANKLE_Y, pitch: 0, contact: true };
    }
    const u = (ph - DUTY) / (1 - DUTY);
    const a = -1.6665;
    const g = u + (a * Math.sin(TAU * u)) / TAU;
    return {
      z: -HALF_STEP + 2 * HALF_STEP * g,
      y: ANKLE_Y + 0.086 * Math.sin(Math.PI * u),
      pitch: -16 * Math.sin(Math.PI * u) + 10 * Math.sin(TAU * u),
      contact: false,
    };
  }
  function walk(r, t, d) {
    const p = t / d;
    const bob = Math.cos(2 * TAU * p);
    r.hips([0.012 * Math.sin(TAU * p), -0.020 + 0.020 * bob, 0]);
    r.euler("Hips", 2, -5 * Math.sin(TAU * p), 2.5 * Math.sin(TAU * p));
    r.euler("Spine", 1.5, 3 * Math.sin(TAU * p), -1.2 * Math.sin(TAU * p));
    r.euler("Chest", 1.0, 4 * Math.sin(TAU * p), 0);
    r.euler("Neck", -2, 0, 0);
    r.euler("Head", -2.5 - 1.5 * bob, -2 * Math.sin(TAU * p), 0);
    for (const [tag, sx] of Object.entries(side)) {
      const s = tag === "R" ? Math.cos(TAU * p) : -Math.cos(TAU * p);
      r.euler(`UpperArm_${tag}`, 24 * s, 0, sx * 2.5);
      r.euler(`Forearm_${tag}`, -18 - 14 * Math.max(0, -s), 0, 0);
      r.euler(`Hand_${tag}`, -6, 0, sx * 4);
    }
    const fr = footAt(p);
    const fl = footAt(p + 0.5);
    plant(r, [-LEG_X, fr.y, fr.z], [LEG_X, fl.y, fl.z], fr.pitch, fl.pitch);
  }

  function inspect(r, t, d) {
    const a = swell(t / d);
    r.hips([0, -0.030 * a, -0.012 * a]);
    r.euler("Hips", -4 * a, 0, 0);
    r.euler("Spine", 13 * a, -5 * a, 0);
    r.euler("Chest", 9 * a, -4 * a, 0);
    r.euler("Neck", 7 * a, 0, 0);
    r.euler("Head", 16 * a, -3 * a, 0);
    r.euler("UpperArm_R", -42 * a, -11 * a, 5 * a);
    r.euler("Forearm_R", -48 * a, 0, -8 * a);
    r.euler("Hand_R", -14 * a, 0, 8 * a);
    r.euler("UpperArm_L", -8 * a, 0, 2 * a);
    r.euler("Forearm_L", -12 * a, 0, 0);
    plant(r, ANKLE_R, ANKLE_L);
  }

  function water(r, t, d) {
    const u = t / d;
    const lift = u < 0.22 ? smoothstep(u / 0.22) : u < 0.76 ? 1 : 1 - smoothstep((u - 0.76) / 0.24);
    const pour = u > 0.3 && u < 0.7 ? smoothstep(clamp((u - 0.3) / 0.12, 0, 1)) * (1 - smoothstep(clamp((u - 0.58) / 0.12, 0, 1))) : 0;
    r.hips([0, -0.010 * lift, 0.004 * lift]);
    r.euler("Hips", -2 * lift, -6 * lift, 0);
    r.euler("Spine", 7 * lift, 6 * lift, 0);
    r.euler("Chest", 5 * lift, 5 * lift, 0);
    r.euler("Neck", 4 * lift, 0, 0);
    r.euler("Head", 12 * lift + 4 * pour, -4 * lift, 0);
    r.euler("UpperArm_R", -46 * lift - 6 * pour, -14 * lift, 9 * lift);
    r.euler("Forearm_R", -46 * lift, 0, -10 * lift);
    r.euler("Hand_R", -18 * pour, 0, -58 * pour + 6 * lift);
    r.euler("UpperArm_L", -16 * lift, 0, 4 * lift);
    r.euler("Forearm_L", -18 * lift, 0, 0);
    r.euler("Hand_L", -6 * lift, 0, 0);
    plant(r, ANKLE_R, ANKLE_L);
  }

  // Hoe. One scalar runs the whole swing: -1 is the hoe up in front, +1 is the blade in the dirt.
  // Both arms are driven off it with the same numbers plus a small offset, which is what keeps
  // the two hands on one imaginary shaft through the arc.
  function hoe(r, t, d) {
    const u = t / d;
    let s;
    if (u < 0.34) s = -smoothstep(u / 0.34);
    else if (u < 0.58) s = -1 + 2 * smoothstep((u - 0.34) / 0.24);
    else s = 1 - smoothstep((u - 0.58) / 0.42);
    const down = Math.max(0, s);
    const back = Math.max(0, -s);
    r.hips([0, -0.028 * down, -0.020 * down + 0.010 * back]);
    r.euler("Hips", -6 * back + 6 * down, 0, 0);
    r.euler("Spine", -8 * back + 20 * down, -8, 0);
    r.euler("Chest", -5 * back + 13 * down, -6, 0);
    r.euler("Neck", 3 * back + 4 * down, 4, 0);
    r.euler("Head", 4 * back + 10 * down, 6, 0);
    for (const [tag, sx] of Object.entries(side)) {
      const lead = tag === "R" ? 0 : -16; // the left hand rides further up the shaft
      r.euler(`UpperArm_${tag}`, -54 + 29 * s + lead * 0.8, sx * -6, -sx * (6 + 12 * back));
      r.euler(`Forearm_${tag}`, -48 + 33 * s - lead * 0.5, 0, -sx * (3 + 6 * back));
      r.euler(`Hand_${tag}`, -12, 0, sx * 6);
    }
    plant(r, [-LEG_X, ANKLE_Y, -0.045], [LEG_X, ANKLE_Y, 0.055]);
  }

  function harvest(r, t, d) {
    const u = t / d;
    const a = swell(u);
    const grab = u > 0.38 && u < 0.62 ? smoothstep((u - 0.38) / 0.1) * (1 - smoothstep((u - 0.52) / 0.1)) : 0;
    r.hips([0, -0.150 * a, -0.075 * a]);
    r.euler("Hips", -10 * a, 0, 0);
    r.euler("Spine", 26 * a, 0, 0);
    r.euler("Chest", 14 * a, 0, 0);
    r.euler("Neck", 6 * a, 0, 0);
    r.euler("Head", 12 * a, 0, 0);
    for (const [tag, sx] of Object.entries(side)) {
      const reach = tag === "R" ? 1 : 0.72;
      r.euler(`UpperArm_${tag}`, -46 * a * reach, sx * -4 * a, -sx * 2 * a);
      r.euler(`Forearm_${tag}`, -38 * a * reach - 14 * grab, 0, -sx * 6 * a);
      r.euler(`Hand_${tag}`, -10 * a - 16 * grab, 0, sx * 4);
    }
    plant(r, ANKLE_R, ANKLE_L);
  }

  const clips = [
    { name: "idle", duration: 4.0, fps: 15, pose: idle },
    { name: "walk", duration: WALK_T, fps: 60, pose: walk },
    { name: "inspect", duration: 0.78, fps: 30, pose: inspect },
    { name: "water", duration: 1.6, fps: 24, pose: water },
    { name: "hoe", duration: 1.1, fps: 30, pose: hoe },
    { name: "harvest", duration: 1.4, fps: 24, pose: harvest },
  ].map((spec) => bakeClip(rig, spec));
  rig.reset();
  root.updateMatrixWorld(true);

  root.animations = clips;
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "harvest-folk",
    assetId: "farmer.v2.m1",
    upAxis: "+Y",
    scaleMeters: 1,
    heightMetres: 1.75,
    headCount: 6.9,
    bones: bones.map((b) => b.name),
    clips: clips.map((c) => c.name),
    clipSeconds: Object.fromEntries(clips.map((c) => [c.name, Number(c.duration.toFixed(3))])),
    walkSpeedMetresPerSecond: Number(WALK_SPEED.toFixed(3)),
    walkStrideMetres: Number((WALK_SPEED * WALK_T).toFixed(3)),
    palette: Object.fromEntries(Object.entries(C).map(([k, v]) => [k, `#${v.toString(16).padStart(6, "0")}`])),
    colourCarrier: "COLOR_0",
    partRanges: geometry.userData.partRanges,
  };
  return root;
}
