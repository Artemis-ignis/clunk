/**
 * Character body construction — how a spec becomes a skinned surface.
 *
 * Read this top to bottom and you have the anatomy of every character in the pack:
 * torso, neck, head, ears, face, arms, sleeves, hands with a separated thumb and four
 * fingers, legs, trousers, boots, and whatever gear the spec asks for. Every one of these
 * is a swept profile from `mesh-kit.mjs` with a bone-weight recipe, which is why the
 * character bends at the elbow instead of snapping at it.
 *
 * Three meshes come out, sharing one skeleton and one material:
 *   body  — skin, garments, face
 *   hair  — the hair style, so a buyer can hide or swap it
 *   gear  — hat, apron, satchel, glasses, tools, so a buyer can strip the character back
 * Three draw calls, one material, vertex colour throughout.
 */
import * as THREE from "three";
import { SkinBuilder, skinChain, ellipsoid, slab, disc, ring, bridge, cap, dome, smoothstep } from "./mesh-kit.mjs";
import { layout, buildSkeleton, toolFrame, TOOL_ANCHORS, TOOL_BIND_SHRINK, TOOL_HIDDEN_SCALE } from "./rig.mjs";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const X = V(1, 0, 0);
const Y = V(0, 1, 0);
const Z = V(0, 0, 1);

/**
 * The pack palette. Deliberately the same warm-timber / sage / cream family as the Cozy Farm
 * Set that is already on the storefront, so a buyer can drop a farmer next to the market
 * stall and it looks like one product line rather than two.
 */
export const CHAR_PALETTE = {
  skinLight: 0xf3d3b3,
  skinMid: 0xe0b48d,
  skinTan: 0xc4936a,
  skinDeep: 0x9d7350,
  hairDark: 0x342620,
  hairBrown: 0x6b4630,
  hairAuburn: 0x8e4a2c,
  hairStraw: 0xc9a25e,
  hairGrey: 0xb3aca2,
  hairSilver: 0xd6d1c6,
  sage: 0x7d9a5e,
  sageDark: 0x5f7a45,
  olive: 0x636b3a,
  cream: 0xf0e5c8,
  creamDark: 0xd9cba4,
  rust: 0xc0603a,
  rustDark: 0x93452a,
  denim: 0x4a6d8c,
  denimDark: 0x36536d,
  plum: 0x8a5670,
  slate: 0x51606b,
  canvas: 0xc9a978,
  canvasDark: 0xa8825a,
  timber: 0x8a5c38,
  timberDark: 0x5d3d28,
  straw: 0xd9b96b,
  strawDark: 0xb5934f,
  leather: 0x7a5236,
  leatherDark: 0x4a3222,
  iron: 0x5b6369,
  ironDark: 0x3b4247,
  brass: 0xb98b3f,
  white: 0xf6f3ec,
  ink: 0x2a2622,
  blush: 0xd98f77,
  tomato: 0xc8402f,
  glass: 0xa9c6c4,
};
// --- small composite helpers built on the kit ------------------------------------------------

/** A closed band wrapping a body section: belts, cuffs, hems, collars, waist ties. */
function band(part, opts) {
  const { center, ax, az, rx, rz, height, thickness, segs = 10, weights, power = 2.4 } = opts;
  const up = new THREE.Vector3().crossVectors(ax, az).normalize().negate();
  const rows = [
    { y: -height / 2, r: 1 - thickness * 0.5 },
    { y: -height / 2.4, r: 1 },
    { y: height / 2.4, r: 1 },
    { y: height / 2, r: 1 - thickness * 0.5 },
  ].map((row) =>
    ring(part, new THREE.Vector3().copy(center).addScaledVector(up, row.y), ax, az, rx * row.r, rz * row.r, segs, weights, power),
  );
  for (let i = 0; i < rows.length - 1; i += 1) bridge(part, rows[i], rows[i + 1]);
  // Close the band back onto the body it wraps, so it is a solid ring rather than a tube.
  const inner = [-1, 1].map((sign) =>
    ring(
      part,
      new THREE.Vector3().copy(center).addScaledVector(up, (sign * height) / 2),
      ax,
      az,
      rx * (1 - thickness),
      rz * (1 - thickness),
      segs,
      weights,
      power,
    ),
  );
  bridge(part, rows[0], inner[0], true);
  bridge(part, rows[rows.length - 1], inner[1]);
  bridge(part, inner[0], inner[1], true);
  return rows;
}

/**
 * A double-walled shell over part of an ellipsoid: hair caps, hat crowns, hoods. The inner
 * wall exists so the open edge reads as a thickness instead of a paper cut.
 */
function shellBand(part, opts) {
  const { center, radius, weights, segs = 10, rings = 4, yMin, yMax, shape = null, thickness = 0.06 } = opts;
  const outer = ellipsoid(part, { center, radius, segs, rings, weights, shape, yMin, yMax });
  const innerRadius = radius.map((r) => r * (1 - thickness));
  // `invert` turns the inner wall inside out, so it faces into the cavity the way the inside
  // of a real hat brim does. Without it the shell is lit from the wrong side under culling.
  const inner = ellipsoid(part, { center, radius: innerRadius, segs, rings, weights, shape, yMin, yMax, invert: true });
  bridge(part, outer[outer.length - 1], inner[inner.length - 1], true);
  if (typeof yMax === "function" || yMax < 0.999) bridge(part, inner[0], outer[0], true);
  return { outer, inner };
}

/** A tapered tube through a list of points, all weighted to one bone. Straps, laces, stalks. */
function cord(part, points, radius, weights, segs = 6) {
  return skinChain(part, {
    joints: points,
    bones: new Array(points.length - 1).fill(weights[0][0]),
    radii: points.map((_, i) => {
      const r = typeof radius === "function" ? radius(i / (points.length - 1)) : radius;
      return [r, r];
    }),
    segs,
    ringsPerSegment: 1,
    blend: 0.45,
    extraWeights: weights.slice(1),
  });
}

// --- the character ---------------------------------------------------------------------------

export function buildCharacter(spec) {
  const world = layout(spec.build);
  const { skeleton, bones, names, root: hipsBone } = buildSkeleton(world);
  const s = spec.build.heightScale ?? 1;
  const P = spec.palette;
  const girth = { chest: 1, waist: 1, limb: 1, ...(spec.girth ?? {}) };

  const B = new SkinBuilder(names);
  const H = new SkinBuilder(names);
  const G = new SkinBuilder(names);
  const TL = new SkinBuilder(names);

  const w = (name) => world.get(name);
  // The chin sits above the neck joint, not on it. When the two coincide the shoulder dome
  // eats the jaw and the character looks like a thumb.
  const headBottom = w("Neck").y + 0.03 * s;
  const headTop = w("HeadTop_End").y;
  const hr = (headTop - headBottom) / 2;
  const headC = V(0, (headTop + headBottom) / 2, w("Head").z + 0.006 * s);
  const headR = [hr * 0.735, hr, hr * 0.785];

  // ---------------------------------------------------------------- torso and garment shell
  const torsoPart = B.part(P.top, "torsoPart");
  const hips = w("Hips");
  const spine2 = w("Spine2");
  const shoulderLineY = w("LeftShoulder").y - 0.012 * s;
  const trapeziusY = w("LeftShoulder").y + 0.05 * s;
  const T = (rx, rz) => [rx * s, rz * s];
  const torsoJoints = [
    V(0, hips.y - 0.118 * s, 0.006 * s),
    w("Spine").clone(),
    w("Spine1").clone(),
    spine2.clone(),
    V(spine2.x, shoulderLineY, spine2.z - 0.004 * s),
    V(spine2.x, trapeziusY, spine2.z + 0.004 * s),
  ];
  const torsoRadii = [
    T(0.126 * girth.waist, 0.096 * girth.waist),
    T(0.124 * girth.waist, 0.092 * girth.waist),
    T(0.14 * girth.chest, 0.099 * girth.chest),
    T(0.162 * girth.chest, 0.108 * girth.chest),
    T(0.147 * girth.chest, 0.099 * girth.chest),
    T(0.094, 0.09),
  ];
  const torsoRows = skinChain(torsoPart, {
    joints: torsoJoints,
    bones: ["Hips", "Spine", "Spine1", "Spine2", "Spine2"],
    radii: torsoRadii,
    segs: 10,
    ringsPerSegment: 2,
    blend: 0.34,
    power: 2.5,
    up: Z,
  });
  // Round the top of the shoulders and the bottom of the pelvis instead of leaving open tubes.
  const topRow = torsoRows[torsoRows.length - 1];
  dome(torsoPart, topRow.ids, topRow.center, topRow.ax, topRow.az, topRow.tangent, topRow.rx, topRow.rz, 0.012 * s, topRow.weights, 2);
  const bottomRow = torsoRows[0];
  dome(torsoPart, bottomRow.ids, bottomRow.center, bottomRow.ax, bottomRow.az, bottomRow.tangent.clone().negate(), bottomRow.rx, bottomRow.rz, 0.055 * s, bottomRow.weights, 2);

  // Trouser / skirt block over the pelvis, in the lower-garment colour, so the character reads
  // as two garments rather than one repainted cylinder.
  const seatPart = B.part(P.bottom, "seatPart");
  const seatTopY = hips.y + 0.055 * s;
  const seatJoints = [
    V(0, hips.y - 0.125 * s, 0.006 * s),
    V(0, hips.y - 0.02 * s, 0.004 * s),
    V(0, seatTopY, 0.002 * s),
  ];
  const seatRows = skinChain(seatPart, {
    joints: seatJoints,
    bones: ["Hips", "Hips"],
    radii: [T(0.131 * girth.waist, 0.101 * girth.waist), T(0.133 * girth.waist, 0.103 * girth.waist), T(0.127 * girth.waist, 0.096 * girth.waist)],
    segs: 10,
    ringsPerSegment: 2,
    blend: 0.4,
    power: 2.5,
    up: Z,
  });
  const seatBottom = seatRows[0];
  dome(seatPart, seatBottom.ids, seatBottom.center, seatBottom.ax, seatBottom.az, seatBottom.tangent.clone().negate(), seatBottom.rx, seatBottom.rz, 0.05 * s, seatBottom.weights, 2);

  // Belt at the waist: the single detail that most reliably makes a low-poly torso read as
  // dressed rather than painted.
  if (spec.belt !== false) {
    const beltPart = B.part(P.belt ?? CHAR_PALETTE.leatherDark, "beltPart");
    band(beltPart, {
      center: V(0, seatTopY - 0.006 * s, 0.001 * s),
      ax: X,
      az: Z,
      rx: 0.132 * s * girth.waist,
      rz: 0.101 * s * girth.waist,
      height: 0.05 * s,
      thickness: 0.16,
      segs: 10,
      weights: [["Hips", 0.65], ["Spine", 0.35]],
      power: 2.5,
    });
    const bucklePart = B.part(P.buckle ?? CHAR_PALETTE.brass, "bucklePart");
    slab(bucklePart, {
      from: V(-0.028 * s, seatTopY - 0.006 * s, 0.098 * s * girth.waist),
      to: V(0.028 * s, seatTopY - 0.006 * s, 0.098 * s * girth.waist),
      ax: Y,
      halfWidth: 0.026 * s,
      halfDepth: 0.012 * s,
      weights: [["Hips", 0.65], ["Spine", 0.35]],
      segs: 6,
      power: 3,
      steps: 2,
      round: 0.3,
    });
  }

  // Collar: a tilted ring at the neck opening. Cheap, and it is the difference between a
  // shirt and a painted-on torso from every camera angle.
  if (spec.collar !== false) {
    const collarPart = B.part(P.collar ?? P.top, "collarPart");
    band(collarPart, {
      center: V(0, trapeziusY + 0.004 * s, 0.004 * s),
      ax: X,
      az: Z,
      rx: 0.074 * s,
      rz: 0.072 * s,
      height: 0.03 * s,
      thickness: 0.16,
      segs: 10,
      weights: [["Spine2", 0.7], ["Neck", 0.3]],
      power: 2.2,
    });
  }

  // Front placket and buttons.
  if (spec.buttons !== false && !(spec.gear ?? []).includes("vest")) {
    const placket = B.part(P.placket ?? P.collar ?? CHAR_PALETTE.cream, "placket");
    for (let k = 0; k < 4; k += 1) {
      const t = k / 3;
      const y = w("Spine").y + 0.03 * s + t * (w("Spine2").y - w("Spine").y - 0.01 * s);
      const rz = (0.094 + 0.014 * t) * s * girth.chest;
      ellipsoid(placket, {
        center: V(0, y, rz + 0.006 * s),
        radius: [0.013 * s, 0.013 * s, 0.009 * s],
        segs: 6,
        rings: 4,
        weights: [["Spine", 1 - t], ["Spine1", t < 0.5 ? t : 1 - Math.abs(t - 0.5) * 2], ["Spine2", Math.max(0, t - 0.5) * 2]].filter(([, v]) => v > 0.01),
      });
    }
  }

  // ---------------------------------------------------------------- neck and head
  const skinPart = B.part(P.skin, "skinPart");
  const neckJoints = [
    V(0, w("Spine2").y + 0.07 * s, 0.004 * s),
    w("Neck").clone(),
    w("Head").clone(),
    V(headC.x, w("Head").y + 0.05 * s, headC.z),
  ];
  skinChain(skinPart, {
    joints: neckJoints,
    bones: ["Spine2", "Neck", "Head"],
    radii: [T(0.076, 0.073), T(0.056, 0.055), T(0.058, 0.058), T(0.062, 0.062)],
    segs: 8,
    ringsPerSegment: 2,
    blend: 0.36,
    up: Z,
  });

  const headWeights = [["Head", 1]];
  const headShape = (y, lon, cx, cz) => {
    // Jaw taper below the cheekbones, a flatter cranium at the back, and a chin that comes
    // forward. The taper saturates at y = -0.7 and holds, so the jaw narrows into a chin
    // rather than continuing all the way to a point.
    const jaw = 1 - 0.17 * smoothstep(0.02, -0.7, y);
    const crown = 1 - 0.1 * smoothstep(0.6, 1, y);
    const backFlat = cz < 0 ? 1 - 0.1 * Math.abs(cz) : 1;
    const chin = cz > 0 ? 1 + 0.11 * smoothstep(-0.15, -0.7, y) * cz : 1;
    const cheek = 1 + 0.05 * smoothstep(0.35, -0.05, y) * (1 - Math.abs(cz));
    return [jaw * crown * cheek, 1, jaw * crown * backFlat * chin];
  };
  // `arc` because the crown is the one place on this character where the rows have to be even:
  // walked in y, the ring below the pole lands at 0.75 and the skull comes to a point. Otto has
  // no hair to hide it.
  ellipsoid(skinPart, { center: headC, radius: headR, segs: 12, rings: 8, weights: headWeights, shape: headShape, arc: true });

  /**
   * A point on the shaped head surface, from a height (-1..1) and a longitude (PI/2 is dead
   * ahead). Face features are placed with this rather than at fractions of the head radius —
   * the first pass put the nose at 0.95 of headR[2], which on a shaped ellipsoid is *inside*
   * the head, and the character had no nose and no mouth at all.
   */
  const onHead = (v, lon) => {
    const c = Math.sqrt(Math.max(0, 1 - v * v));
    const u = Math.cos(lon) * c;
    const wz = Math.sin(lon) * c;
    const m = headShape(v, lon, u, wz);
    return V(headC.x + u * headR[0] * m[0], headC.y + v * headR[1] * m[1], headC.z + wz * headR[2] * m[2]);
  };
  const headOut = (p) => new THREE.Vector3(p.x - headC.x, (p.y - headC.y) * 0.55, p.z - headC.z).normalize();

  // Ears.
  for (const m of [1, -1]) {
    const ear = onHead(0.02, m > 0 ? 0.06 : Math.PI - 0.06);
    ellipsoid(skinPart, {
      center: V(ear.x * 0.96, ear.y, ear.z - hr * 0.06),
      radius: [hr * 0.055, hr * 0.16, hr * 0.115],
      segs: 6,
      rings: 4,
      weights: headWeights,
    });
  }

  // ---------------------------------------------------------------- face
  const EYE_V = 0.1;
  const EYE_LON = 0.44; // radians either side of dead ahead
  for (const m of [1, -1]) {
    const seat = onHead(EYE_V, Math.PI / 2 - m * EYE_LON);
    const out = headOut(seat);
    const whitePart = B.part(CHAR_PALETTE.white, "whitePart");
    ellipsoid(whitePart, {
      center: seat.clone().addScaledVector(out, -hr * 0.075),
      radius: [hr * 0.142, hr * 0.165, hr * 0.115],
      segs: 8,
      rings: 5,
      weights: headWeights,
    });
    const irisPart = B.part(P.eye ?? CHAR_PALETTE.ink, "irisPart");
    ellipsoid(irisPart, {
      center: seat.clone().addScaledVector(out, hr * 0.018),
      radius: [hr * 0.078, hr * 0.092, hr * 0.07],
      segs: 6,
      rings: 4,
      weights: headWeights,
    });
    // Brow: a short slab following the brow ridge, angled so the character has an expression
    // rather than a blank stare. `browTilt` is what separates a worried face from a stern one.
    const browPart = B.part(P.brow ?? P.hair, "browPart");
    const tilt = (spec.browTilt ?? 0) * m * 14;
    const inner = onHead(0.25 - tilt, Math.PI / 2 - m * (EYE_LON - 0.16));
    const outer = onHead(0.26 + tilt, Math.PI / 2 - m * (EYE_LON + 0.2));
    const browOut = headOut(inner);
    slab(browPart, {
      from: inner.addScaledVector(browOut, hr * 0.05),
      to: outer.addScaledVector(browOut, hr * 0.05),
      ax: Y,
      halfWidth: hr * 0.05,
      halfDepth: hr * 0.05,
      weights: headWeights,
      segs: 5,
      power: 3,
      steps: 2,
      round: 0.35,
    });
  }
  // Nose: a four-sided wedge growing out of the face. A sphere here reads as a clown.
  {
    const nosePart = B.part(P.skinShade ?? P.skin, "nosePart");
    const bridge = onHead(0.1, Math.PI / 2);
    const tip = onHead(-0.13, Math.PI / 2);
    const out = headOut(tip);
    slab(nosePart, {
      from: bridge.addScaledVector(headOut(bridge), -hr * 0.05),
      to: tip.addScaledVector(out, hr * 0.032),
      ax: X,
      halfWidth: hr * 0.062,
      halfDepth: hr * 0.05,
      weights: headWeights,
      segs: 6,
      power: 2.6,
      steps: 2,
      round: 0.45,
      widthFn: (t) => 0.5 + 0.5 * t,
    });
  }
  // Mouth.
  {
    const mouthPart = B.part(P.mouth ?? CHAR_PALETTE.blush, "mouthPart");
    const left = onHead(-0.42, Math.PI / 2 + 0.2);
    const right = onHead(-0.42, Math.PI / 2 - 0.2);
    const out = headOut(onHead(-0.42, Math.PI / 2));
    slab(mouthPart, {
      from: left.addScaledVector(out, -hr * 0.01),
      to: right.addScaledVector(out, -hr * 0.01),
      ax: Y,
      halfWidth: hr * 0.032,
      halfDepth: hr * 0.04,
      weights: headWeights,
      segs: 5,
      power: 3,
      steps: 3,
      round: 0.45,
      // Corners lower than the middle: a flat bar reads as a grimace.
      widthFn: (t) => 0.55 + 0.6 * Math.sin(t * Math.PI) ** 0.7,
    });
  }
  if (spec.beard) buildBeard(B, spec, headC, headR, hr, headWeights, P, onHead, headOut);

  // ---------------------------------------------------------------- arms, sleeves, hands
  for (const side of ["Left", "Right"]) {
    const m = side === "Left" ? 1 : -1;
    const arm = w(`${side}Arm`);
    const foreArm = w(`${side}ForeArm`);
    const hand = w(`${side}Hand`);
    const frame = world.get(`${side}__frame`);
    const dirDown = new THREE.Vector3().subVectors(hand, foreArm).normalize();
    // Two shoulder heights, not one. The skin arm starts low (`shoulderTop`); the garment
    // starts higher and wider (`sleeveTop`) so it closes over the deltoid. When both started
    // at the same point a bare triangle of skin showed on top of every shoulder.
    const upDir = V(-m * 0.35, 1, 0).normalize();
    const shoulderTop = arm.clone().addScaledVector(upDir, 0.034 * s);
    const sleeveTop = arm.clone().addScaledVector(upDir, 0.048 * s).addScaledVector(V(-m, 0, 0), 0.008 * s);
    const wristEnd = hand.clone().addScaledVector(dirDown, 0.024 * s);

    const armPart = B.part(P.skin, "armPart");
    const armRows = skinChain(armPart, {
      joints: [shoulderTop, arm.clone(), foreArm.clone(), hand.clone(), wristEnd],
      bones: [`${side}Shoulder`, `${side}Arm`, `${side}ForeArm`, `${side}Hand`],
      radii: [
        T(0.058 * girth.limb, 0.058 * girth.limb),
        T(0.056 * girth.limb, 0.056 * girth.limb),
        T(0.045 * girth.limb, 0.046 * girth.limb),
        T(0.034 * girth.limb, 0.04 * girth.limb),
        T(0.033 * girth.limb, 0.039 * girth.limb),
      ],
      segs: 8,
      ringsPerSegment: 2,
      blend: 0.32,
      // The deltoid: a bulge in the first fifth of the chain, and a bleed of chest weight so
      // the shoulder does not tear away from the torso when the arm swings.
      profileScale: (t) => {
        const bulge = 1 + 0.055 * Math.exp(-((t - 0.06) ** 2) / 0.008);
        return [bulge, bulge];
      },
      extraWeights: (t) => (t < 0.22 ? [["Spine2", 0.4 * (1 - t / 0.22)]] : []),
      up: Z,
    });
    const shoulderCap = armRows[0];
    dome(armPart, shoulderCap.ids, shoulderCap.center, shoulderCap.ax, shoulderCap.az, shoulderCap.tangent.clone().negate(), shoulderCap.rx, shoulderCap.rz, 0.045 * s, shoulderCap.weights, 3);

    // Sleeve: a slightly fatter tube over the top of the arm, ending where the garment ends.
    //
    // `sleeveEnd` is a fraction of the arm's ARC LENGTH, sampled with getPointAt. Catmull-Rom's
    // getPoint spends a third of its parameter on each control span regardless of how long the
    // span is, and the shoulder-to-armpit span is 6 cm out of a 60 cm arm — so a "42% sleeve"
    // sampled by parameter came out as a 13 cm epaulette with a bare shoulder under it.
    const sleeveEnd = spec.sleeve === "long" ? 0.95 : spec.sleeve === "none" ? 0 : 0.32;
    if (sleeveEnd > 0) {
      const sleevePart = B.part(P.top, "sleevePart");
      const chainPts = [sleeveTop, arm.clone(), foreArm.clone(), hand.clone()];
      const curve = new THREE.CatmullRomCurve3(chainPts, false, "centripetal", 0.5);
      const lengths = curve.getLengths(240);
      const total = lengths[lengths.length - 1];
      // Arc fractions at which the sleeve passes from one bone's span to the next.
      const armAt = sleeveTop.distanceTo(arm) / total;
      const elbowAt = (sleeveTop.distanceTo(arm) + arm.distanceTo(foreArm)) / total;
      const sleeveJoints = [];
      const steps = 4;
      for (let k = 0; k <= steps; k += 1) sleeveJoints.push(curve.getPointAt((k / steps) * sleeveEnd));
      const boneFor = (u) => (u < armAt ? `${side}Shoulder` : u < elbowAt ? `${side}Arm` : `${side}ForeArm`);
      const sleeveBones = [];
      for (let k = 0; k < steps; k += 1) sleeveBones.push(boneFor(((k + 0.5) / steps) * sleeveEnd));
      const sleeveRows = skinChain(sleevePart, {
        joints: sleeveJoints,
        bones: sleeveBones,
        // The sleeve is the arm's own radius plus 5.5 mm of cloth — the same 5.5 mm at the
        // shoulder as at the wrist.
        //
        // The previous version started the sleeve at 60 mm where the arm underneath is 58 mm
        // *before* its deltoid bulge, and added 5.8 mm on top of that, so a long sleeve was
        // 7 mm proud of the shoulder and read as a puffed period sleeve on all three of the
        // characters that wear one. The radii below are the arm chain's own radii resampled
        // into arc fraction, so the cloth is parallel to the limb from deltoid to cuff.
        radii: sleeveJoints.map((_, k) => {
          const u = (k / steps) * sleeveEnd;
          const armR =
            u < armAt
              ? 0.058 - 0.002 * (u / armAt)
              : u < elbowAt
                ? 0.056 - 0.011 * ((u - armAt) / (elbowAt - armAt))
                : 0.045 - 0.0105 * ((u - elbowAt) / (1 - elbowAt));
          const base = armR * girth.limb + 0.0055;
          return T(base, base);
        }),
        segs: 8,
        ringsPerSegment: 2,
        blend: 0.34,
        extraWeights: (t) => (t < 0.28 ? [["Spine2", 0.45 * (1 - t / 0.28)], [`${side}Shoulder`, 0.25 * (1 - t / 0.28)]] : []),
        up: Z,
      });
      const capRow = sleeveRows[0];
      dome(sleevePart, capRow.ids, capRow.center, capRow.ax, capRow.az, capRow.tangent.clone().negate(), capRow.rx, capRow.rz, 0.018 * s, capRow.weights, 3);
      const hemRow = sleeveRows[sleeveRows.length - 1];
      // A T-shirt has no cuff. Banding a short sleeve is what made the first pass read as a
      // puffed period costume rather than as work clothes.
      if (spec.sleeve === "long") {
      const cuffPart = B.part(P.cuff ?? P.collar ?? P.top, "cuffPart");
      band(cuffPart, {
        center: hemRow.center.clone().addScaledVector(hemRow.tangent, -0.012 * s),
        ax: hemRow.ax,
        az: hemRow.az,
        rx: hemRow.rx * 1.035,
        rz: hemRow.rz * 1.035,
        height: 0.03 * s,
        thickness: 0.12,
        segs: 8,
        weights: hemRow.weights,
      });
      }
    }

    // Hand: a palm slab plus five separately modelled digits.
    const handColor = spec.gloves ? (P.glove ?? CHAR_PALETTE.leather) : P.skin;
    const palmPart = B.part(handColor, "palmPart");
    const u = frame.u;
    const vAxis = frame.v;
    const wAxis = frame.w;
    // The palm: a wide, thin rounded block. A hand is about 100 x 29 mm across the knuckles,
    // and that one number is most of the difference between "hand" and "paddle" in a close-up.
    // Six sides round the section rather than ten: at the size a hand occupies on screen the
    // extra four are four triangles nobody can see, and this pack has a triangle budget.
    slab(palmPart, {
      from: hand.clone().addScaledVector(u, 0.004 * s),
      to: hand.clone().addScaledVector(u, 0.086 * s),
      ax: wAxis,
      halfWidth: 0.05 * s,
      halfDepth: 0.0145 * s,
      weights: [[`${side}Hand`, 1]],
      segs: 5,
      power: 2.8,
      steps: 2,
      round: 0.4,
      widthFn: (t) => 0.9 + 0.14 * Math.sin(t * Math.PI),
    });
    // Five block digits, thumb included and visibly opposed.
    //
    // Four sides to a finger and one ring per phalanx, closed with a flat cap. That is a
    // deliberate downgrade from the round, six-sided, tip-domed fingers of the first pass: those
    // cost 600 triangles a hand — a tenth of the whole character — to model detail that is under
    // ten pixels across in every shot a buyer will ever see, and they fused into a paddle at
    // that size anyway. A square section reads as a finger and holds a hard edge along its
    // length, which is what makes the fist read as a fist when it closes on a tool.
    for (const digit of ["Thumb", "Index", "Middle", "Ring", "Pinky"]) {
      const pts = [1, 2, 3].map((k) => w(`${side}Hand${digit}${k}`).clone());
      pts.push(w(`${side}Hand${digit}4_End`).clone());
      const base = digit === "Thumb" ? 0.0152 : 0.0124;
      const rows = skinChain(palmPart, {
        joints: pts,
        bones: [1, 2, 3].map((k) => `${side}Hand${digit}${k}`),
        radii: [
          T(base, base),
          T(base * 0.94, base * 0.94),
          T(base * 0.84, base * 0.84),
          T(base * 0.7, base * 0.7),
        ],
        segs: 4,
        ringsPerSegment: 1,
        blend: 0.45,
        extraWeights: (t) => (t < 0.2 ? [[`${side}Hand`, 0.4 * (1 - t / 0.2)]] : []),
        up: vAxis,
      });
      const tip = rows[rows.length - 1];
      cap(palmPart, tip.ids, tip.center.clone().addScaledVector(tip.tangent, base * 0.5 * s), tip.weights, false);
    }

    // ------------------------------------------------------------ legs, trousers, boots
    const upLeg = w(`${side}UpLeg`);
    const knee = w(`${side}Leg`);
    const ankle = w(`${side}Foot`);
    const toeBase = w(`${side}ToeBase`);
    const toeEnd = w(`${side}Toe_End`);
    // Fractions of the hip-to-ankle ARC, and the knee sits at 0.558 of it. 0.38 puts the
    // shorts hem two thirds of the way down the thigh, which is unambiguously above the knee
    // from every camera angle rather than "arguably above it" at 0.42.
    const hemT = spec.legWear === "shorts" ? 0.38 : spec.legWear === "capri" ? 0.72 : 1.0;

    const legPart = B.part(P.skin, "legPart");
    const legJoints = [upLeg.clone(), knee.clone(), ankle.clone(), ankle.clone().add(V(0, -0.03 * s, 0.006 * s))];
    const legRadii = [
      T(0.086 * girth.limb, 0.089 * girth.limb),
      T(0.06 * girth.limb, 0.063 * girth.limb),
      T(0.043 * girth.limb, 0.048 * girth.limb),
      T(0.042 * girth.limb, 0.047 * girth.limb),
    ];
    const legBones = [`${side}UpLeg`, `${side}Leg`, `${side}Foot`];
    skinChain(legPart, {
      joints: legJoints,
      bones: legBones,
      radii: legRadii,
      segs: 8,
      ringsPerSegment: 2,
      blend: 0.32,
      extraWeights: (t) => (t < 0.3 ? [["Hips", 0.42 * (1 - t / 0.3)]] : []),
      up: Z,
    });
    if (hemT > 0.02) {
      const trouserPart = B.part(P.bottom, "trouserPart");
      // Arc length again, for the same reason as the sleeve: `hemT` is "how far down the leg",
      // not "how far through the control points".
      const curve = new THREE.CatmullRomCurve3(legJoints.slice(0, 3), false, "centripetal", 0.5);
      const kneeAt = upLeg.distanceTo(knee) / (upLeg.distanceTo(knee) + knee.distanceTo(ankle));
      const steps = 4;
      const tJoints = [];
      for (let k = 0; k <= steps; k += 1) tJoints.push(curve.getPointAt((k / steps) * Math.min(1, hemT)));
      const tBones = [];
      for (let k = 0; k < steps; k += 1) {
        const u = ((k + 0.5) / steps) * Math.min(1, hemT);
        tBones.push(u < kneeAt ? `${side}UpLeg` : `${side}Leg`);
      }
      const rows = skinChain(trouserPart, {
        joints: tJoints,
        bones: tBones,
        radii: tJoints.map((_, k) => {
          const t = (k / steps) * Math.min(1, hemT);
          const base = 0.095 - 0.045 * t;
          return T(base * girth.limb, (base + 0.003) * girth.limb);
        }),
        segs: 8,
        ringsPerSegment: 2,
        blend: 0.34,
        extraWeights: (t) => (t < 0.28 ? [["Hips", 0.5 * (1 - t / 0.28)]] : []),
        up: Z,
      });
      const top = rows[0];
      dome(trouserPart, top.ids, top.center, top.ax, top.az, top.tangent.clone().negate(), top.rx, top.rz, 0.04 * s, top.weights, 2);
      const hem = rows[rows.length - 1];
      const hemPart = B.part(P.hem ?? P.bottom, "hemPart");
      band(hemPart, {
        center: hem.center.clone().addScaledVector(hem.tangent, -0.014 * s),
        ax: hem.ax,
        az: hem.az,
        rx: hem.rx * 1.07,
        rz: hem.rz * 1.07,
        height: 0.04 * s,
        thickness: 0.16,
        segs: 8,
        weights: hem.weights,
      });
    }

    // Boot: an ankle cuff plus a sole-and-upper slab that follows the foot to the toe.
    const bootPart = B.part(P.boot ?? CHAR_PALETTE.leatherDark, "bootPart");
    const bootTop = spec.bootHeight ?? 0.1;
    band(bootPart, {
      center: V(ankle.x, ankle.y + bootTop * s * 0.5, ankle.z + 0.004 * s),
      ax: X,
      az: Z,
      rx: 0.052 * s * girth.limb,
      rz: 0.056 * s * girth.limb,
      height: bootTop * s,
      thickness: 0.2,
      segs: 8,
      weights: [[`${side}Foot`, 0.75], [`${side}Leg`, 0.25]],
      power: 2.3,
    });
    slab(bootPart, {
      from: V(ankle.x, ankle.y - 0.03 * s, ankle.z - 0.028 * s),
      to: V(toeBase.x, toeBase.y + 0.014 * s, toeBase.z + 0.01 * s),
      ax: X,
      halfWidth: 0.05 * s,
      halfDepth: 0.048 * s,
      weights: [[`${side}Foot`, 1]],
      segs: 8,
      power: 3.2,
      steps: 2,
      round: 0.4,
    });
    slab(bootPart, {
      from: V(toeBase.x, toeBase.y + 0.012 * s, toeBase.z - 0.006 * s),
      to: V(toeEnd.x, toeEnd.y + 0.012 * s, toeEnd.z),
      ax: X,
      halfWidth: 0.048 * s,
      halfDepth: 0.034 * s,
      weights: [[`${side}ToeBase`, 0.8], [`${side}Foot`, 0.2]],
      segs: 8,
      power: 3.4,
      steps: 2,
      round: 0.5,
      widthFn: (t) => 1 - 0.16 * t,
    });
    const solePart = B.part(P.sole ?? CHAR_PALETTE.ink, "solePart");
    slab(solePart, {
      from: V(ankle.x, 0.012 * s, ankle.z - 0.03 * s),
      to: V(toeEnd.x, 0.012 * s, toeEnd.z + 0.006 * s),
      ax: X,
      halfWidth: 0.05 * s,
      halfDepth: 0.013 * s,
      weights: [[`${side}Foot`, 0.7], [`${side}ToeBase`, 0.3]],
      segs: 8,
      power: 3.6,
      steps: 2,
      round: 0.35,
    });
  }

  buildHair(H, spec, headC, headR, hr, s, P);
  buildGear(G, spec, world, headC, headR, hr, s, P, girth);
  const toolFrames = buildTools(TL, world, s, P);
  // The props were modelled at full size in bind-world coordinates, which is what makes the
  // grip correct by construction; they are STORED shrunk toward the wrist and the anchor's
  // scale track reads them back. See `TOOL_BIND_SHRINK` in rig.mjs for why the file may not
  // carry a full-size hoe lying across its bind pose.
  {
    const wrist = w("RightHand");
    for (const part of TL.parts) {
      for (let i = 0; i < part.pos.length; i += 3) {
        part.pos[i] = wrist.x + (part.pos[i] - wrist.x) * TOOL_BIND_SHRINK;
        part.pos[i + 1] = wrist.y + (part.pos[i + 1] - wrist.y) * TOOL_BIND_SHRINK;
        part.pos[i + 2] = wrist.z + (part.pos[i + 2] - wrist.z) * TOOL_BIND_SHRINK;
      }
    }
  }

  // ---------------------------------------------------------------- assemble
  const material = new THREE.MeshStandardMaterial({
    name: `${spec.slug}_atlas`,
    vertexColors: true,
    roughness: 0.86,
    metalness: 0,
  });
  const group = new THREE.Group();
  group.name = spec.slug;
  group.add(hipsBone);

  const meshes = [];
  // The tools are a fourth mesh rather than a fourth colour on the gear mesh, for two reasons
  // a buyer cares about: they can be deleted in one click, and every tool-aware measurement in
  // the review chain (ground penetration, the swept bounding box the camera fits to) can skip
  // them by name instead of by guessing.
  for (const [suffix, builder] of [["body", B], ["hair", H], ["gear", G], ["tools", TL]]) {
    const geometry = builder.build();
    if (geometry.getAttribute("position").count === 0) continue;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.name = `${spec.slug}_${suffix}`;
    mesh.frustumCulled = false;
    group.add(mesh);
    mesh.bind(skeleton);
    meshes.push(mesh);
  }

  // Empty hands in the rest pose.
  //
  // Every clip carries a scale track for all three anchors, so a file being played is correct.
  // A file being LOOKED AT is not: glTF's rest pose is whatever the nodes say, the anchors said
  // scale 1, and so the shop photograph was a farmer holding a hoe, a basket and a watering can
  // at the same time. The rest pose has to agree with the clips — nothing in hand until a clip
  // asks for something.
  //
  // This runs after the last `mesh.bind(skeleton)` on purpose. `bind()` with no explicit bind
  // matrix recomputes the skeleton's inverse bind matrices from the bones' CURRENT world
  // matrices, so hiding the anchors before the final bind would bake a 1e4 scale into the
  // inverse and a clip that scales back to 1 would hand the buyer a 12-kilometre hoe.
  for (const anchor of TOOL_ANCHORS) {
    bones.get(anchor.bone)?.scale.setScalar(TOOL_HIDDEN_SCALE);
  }
  group.updateMatrixWorld(true);

  return {
    group,
    skeleton,
    bones,
    names,
    world,
    meshes,
    material,
    headC,
    headR,
    hr,
    scale: s,
    toolFrames,
    builders: { body: B, hair: H, gear: G, tools: TL },
  };
}

/**
 * The props: a hoe and a harvest basket, both authored in bind-world coordinates around the
 * right wrist and weighted 100% to their own anchor bone (see `TOOL_ANCHORS` in rig.mjs).
 *
 * The one idea that makes the grip correct without a single hand-tuned finger keyframe: a fist
 * closes around an axis that runs *across the knuckles*, and the rig already has that axis —
 * it is `w` in the hand frame. So the hoe shaft is authored along `w`, through a point in the
 * middle of the palm. Whatever the right hand's world rotation turns out to be, the shaft goes
 * through the fist, and the animation only has to decide where the shaft should point.
 *
 * Returns the frames the clips need to aim the tools, so `anim.mjs` never has to re-derive the
 * numbers this function modelled to.
 */
function buildTools(TL, world, s, P) {
  const f = toolFrame(world, s);
  buildHoe(TL, { grip: f.grip, shaft: f.shaft, fold: f.fold, side: f.side, ...f.hoe }, s, P);
  buildBasket(
    TL,
    {
      grip: f.grip,
      up: f.fold.clone().negate(),
      inward: f.side.clone(),
      axis: f.shaft.clone(),
      ...f.basket,
    },
    s,
    P,
  );
  buildCan(TL, { grip: f.grip, shaft: f.shaft, fold: f.fold, side: f.side, ...f.can }, s, P);
  return f;
}

/**
 * Watering can.
 *
 * Same trick as the hoe: the part the fist closes around is authored along `shaft`, the axis a
 * closed hand actually wraps. Here that is the apex of an arch handle, so the can hangs under
 * the fist by `drop` and the spout leaves the body along `side`, tipped towards `fold`. A clip
 * that aims (shaft, fold) at (across the body, straight down) therefore gets a can hanging
 * level with a spout pointing down and forward, which is the read the brief asks for, without
 * one hand-tuned number in the clip. About 200 triangles.
 */
function buildCan(TL, c, s, P) {
  const weights = [["ToolCan", 1]];
  const metal = TL.part(P.canBody ?? CHAR_PALETTE.iron, "canBody");
  const top = c.grip.clone().addScaledVector(c.fold, c.drop);
  const bottom = top.clone().addScaledVector(c.fold, c.bodyLen);
  const rows = skinChain(metal, {
    joints: [top, top.clone().addScaledVector(c.fold, c.bodyLen * 0.5), bottom],
    bones: ["ToolCan", "ToolCan"],
    // Slightly wider at the shoulder than at the base: a can, not a paint tin.
    radii: [
      [c.bodyR * 0.9, c.bodyR * 0.9],
      [c.bodyR, c.bodyR],
      [c.bodyR * 0.94, c.bodyR * 0.94],
    ],
    segs: 6,
    ringsPerSegment: 1,
    blend: 0.5,
    up: c.side,
  });
  const lid = rows[0];
  cap(metal, lid.ids, lid.center, lid.weights, true);
  const base = rows[rows.length - 1];
  cap(metal, base.ids, base.center, base.weights, false);

  // Arch handle: up off the shoulder of the can, across through the palm, back down. The apex
  // is exactly the grip point, and it runs along `shaft`.
  const handle = TL.part(P.canHandle ?? CHAR_PALETTE.ironDark, "canHandle");
  const shoulder = top.clone().addScaledVector(c.fold, 0.012 * s);
  skinChain(handle, {
    joints: [
      shoulder.clone().addScaledVector(c.shaft, c.bodyR * 0.72),
      c.grip.clone().addScaledVector(c.shaft, c.bodyR * 0.5),
      c.grip.clone().addScaledVector(c.shaft, -c.bodyR * 0.5),
      shoulder.clone().addScaledVector(c.shaft, -c.bodyR * 0.72),
    ],
    bones: ["ToolCan", "ToolCan", "ToolCan"],
    radii: new Array(4).fill([0.013 * s, 0.013 * s]),
    segs: 5,
    ringsPerSegment: 1,
    blend: 0.5,
    up: c.side,
  });

  // Spout: out along `side`, tipped down towards `fold`, with a rose on the end.
  const spoutDir = c.side.clone().multiplyScalar(1).addScaledVector(c.fold, c.spoutRise).normalize();
  const root = top
    .clone()
    .addScaledVector(c.fold, c.bodyLen * 0.62)
    .addScaledVector(c.side, c.bodyR * 0.55);
  const tip = root.clone().addScaledVector(spoutDir, c.spout);
  const spoutRows = skinChain(metal, {
    joints: [root, root.clone().addScaledVector(spoutDir, c.spout * 0.5), tip],
    bones: ["ToolCan", "ToolCan"],
    radii: [
      [c.spoutR * 1.5, c.spoutR * 1.5],
      [c.spoutR, c.spoutR],
      [c.spoutR * 0.85, c.spoutR * 0.85],
    ],
    segs: 5,
    ringsPerSegment: 1,
    blend: 0.5,
    up: c.shaft,
  });
  const nose = spoutRows[spoutRows.length - 1];
  // The rose: the flat sprinkler plate. It is what says "watering can" rather than "kettle".
  const rose = TL.part(P.canHandle ?? CHAR_PALETTE.ironDark, "canRose");
  band(rose, {
    center: tip.clone().addScaledVector(spoutDir, 0.012 * s),
    ax: c.shaft,
    az: new THREE.Vector3().crossVectors(spoutDir, c.shaft).normalize(),
    rx: c.roseR,
    rz: c.roseR,
    height: 0.022 * s,
    thickness: 0.5,
    segs: 5,
    weights,
    power: 2,
  });
  cap(metal, nose.ids, nose.center, nose.weights, false);
}

/**
 * Hoe: a tapered shaft, an iron ferrule, and a blade set back about 70 degrees from the shaft,
 * which is the angle that makes a hoe a hoe rather than a spear. Under 300 triangles.
 */
function buildHoe(TL, h, s, P) {
  const wood = TL.part(P.toolWood ?? CHAR_PALETTE.timber, "hoeShaft");
  const at = (d) => h.grip.clone().addScaledVector(h.shaft, d);
  const shaftJoints = [at(-h.butt), at(-h.butt * 0.1), at(h.head * 0.45), at(h.head)];
  const rows = skinChain(wood, {
    joints: shaftJoints,
    bones: ["ToolHoe", "ToolHoe", "ToolHoe"],
    radii: [[0.0175 * s, 0.0175 * s], [0.0165 * s, 0.0165 * s], [0.0152 * s, 0.0152 * s], [0.0145 * s, 0.0145 * s]],
    segs: 6,
    ringsPerSegment: 1,
    blend: 0.45,
    up: h.fold,
  });
  const butt = rows[0];
  dome(wood, butt.ids, butt.center, butt.ax, butt.az, butt.tangent.clone().negate(), butt.rx, butt.rz, 0.016 * s, butt.weights, 2);
  const tip = rows[rows.length - 1];
  dome(wood, tip.ids, tip.center, tip.ax, tip.az, tip.tangent, tip.rx, tip.rz, 0.012 * s, tip.weights, 2);

  const weights = [["ToolHoe", 1]];
  const iron = TL.part(P.toolIron ?? CHAR_PALETTE.iron, "hoeHead");
  // Ferrule: the collar that ties the blade to the shaft. Without it the blade reads as a
  // paddle glued to a stick.
  band(iron, {
    center: at(h.head * 0.82),
    ax: h.fold,
    az: h.side,
    rx: 0.0215 * s,
    rz: 0.0215 * s,
    height: 0.05 * s,
    thickness: 0.22,
    segs: 6,
    weights,
    power: 2.2,
  });
  // Blade: 70 degrees off the shaft, edge across the swing so it reads as a cutting edge and
  // not as a hammer.
  const bladeDir = h.shaft
    .clone()
    .multiplyScalar(Math.cos(h.bladeAngle))
    .addScaledVector(h.fold, Math.sin(h.bladeAngle))
    .normalize();
  const bladeRoot = at(h.head * 0.86);
  slab(iron, {
    from: bladeRoot,
    to: bladeRoot.clone().addScaledVector(bladeDir, h.blade),
    ax: h.side,
    halfWidth: 0.072 * s,
    halfDepth: 0.011 * s,
    weights,
    segs: 6,
    power: 3.6,
    steps: 2,
    round: 0.34,
    widthFn: (t) => 0.62 + 0.5 * t,
  });
}

/**
 * Harvest basket: a flared woven body with a thicker rim, hanging off the point in the right
 * palm that grips it, so the right hand holds the rim and the animation puts the left hand on
 * the far side of the same rim. Under 400 triangles.
 */
function buildBasket(TL, b, s, P) {
  const weights = [["ToolBasket", 1]];
  const weave = TL.part(P.basket ?? CHAR_PALETTE.straw, "basketBody");
  // The right hand is on the rim, so the rim centre is one radius inboard of the grip and a
  // little below it — a carried basket hangs from the fingers, it does not balance on them.
  const rimCenter = b.grip
    .clone()
    .addScaledVector(b.inward, b.rimRadius)
    .addScaledVector(b.up, -0.03 * s);
  const segs = 8;
  const steps = 2;
  const outer = [];
  const inner = [];
  for (let k = 0; k <= steps; k += 1) {
    const t = k / steps;
    // Flared: the rim is wider than the base, which is what stops a basket reading as a bucket.
    const r = b.rimRadius * (1 - 0.26 * t * t - 0.06 * t);
    const c = rimCenter.clone().addScaledVector(b.up, -b.depth * t);
    outer.push(ring(weave, c, b.axis, b.inward, r, r, segs, weights, 2.3));
    inner.push(ring(weave, c, b.axis, b.inward, r * 0.9, r * 0.9, segs, weights, 2.3));
  }
  // `ring` builds on (ax, az) and its outward-facing convention is "advance along ax x az with
  // flip". Here ax x az is +up and the rows march DOWN the basket, so the flip is inverted on
  // every bridge — the outer wall is the false case, not the true one.
  for (let k = 0; k < steps; k += 1) {
    bridge(weave, outer[k], outer[k + 1], false);
    bridge(weave, inner[k], inner[k + 1], true);
  }
  bridge(weave, outer[0], inner[0], true);
  cap(weave, inner[steps], rimCenter.clone().addScaledVector(b.up, -b.depth - 0.012 * s), weights, true);
  cap(weave, outer[steps], rimCenter.clone().addScaledVector(b.up, -b.depth - 0.02 * s), weights, false);

  const rim = TL.part(P.basketRim ?? CHAR_PALETTE.strawDark, "basketRim");
  band(rim, {
    center: rimCenter.clone().addScaledVector(b.up, -0.014 * s),
    ax: b.axis,
    az: b.inward,
    rx: b.rimRadius * 1.045,
    rz: b.rimRadius * 1.045,
    height: 0.036 * s,
    thickness: 0.14,
    segs: segs,
    weights,
    power: 2.3,
  });
}

// --- hair, beard, gear ------------------------------------------------------------------------

/**
 * Beard.
 *
 * A beard is a *shell that follows the head's own jaw*, not a second sphere near it. The first
 * pass used its own taper, which was gentler than the head's, so below the cheekbones the
 * beard was wider than the face it sat on and the character wore a black balaclava. Here the
 * band is generated from `onHead`, so every vertex starts on the skin and is pushed out by a
 * fixed few millimetres of hair.
 */
function buildBeard(B, spec, headC, headR, hr, headWeights, P, onHead, headOut) {
  const part = B.part(P.beard ?? P.hair, "beardPart");
  const style = spec.beard;
  // Where the beard starts: along the jaw at the sides, lower under the mouth at the front,
  // with a small ripple so the edge is not a machined horizontal line. Any higher and it
  // climbs the cheeks, and a flat shell on the cheeks reads as a surgical mask, not hair.
  const ripple = (lon) => 0.03 * Math.sin(5 * lon + 0.7);
  // Where the beard's top edge runs, and why it is not a constant height.
  //
  // Two wrong answers came before this one. At a constant -0.36 the edge crossed the
  // cheekbones and, on a pale beard, read as a surgical mask — which is what Otto looked like.
  // At a constant -0.60 the edge cleared the cheeks but then ran as a straight pale strap from
  // one ear to the other with bare skin above it: still a mask, worn lower.
  //
  // A beard's top edge is not level. It is high at the ear, where it meets the hair as a
  // sideburn, and it dips at the front, under the mouth. Following that shape is what makes the
  // hair on the sides continuous with the hair on the head, and a continuous edge cannot read
  // as a strap. So the height is a function of `front`: -0.36 at the side and the back (the
  // bald horseshoe's own lower edge is about -0.27 there, so the gap left is a sideburn's
  // width), falling to -0.70 straight ahead, which is under the mouth.
  const topAt =
    style === "full"
      ? (lon) => -0.36 - 0.34 * Math.max(0, Math.sin(lon)) ** 0.9 + ripple(lon)
      : (lon) => -0.46 - 0.12 * Math.max(0, Math.sin(lon)) + ripple(lon) * 0.5;
  // Thickness ramps from nothing at the sideburn to a real mass at the chin, and the last
  // rows hang below the jaw. A constant offset makes the beard read as paint on the skin.
  const thickAt = style === "full" ? (t) => 0.012 + 0.115 * t ** 1.25 : (t) => 0.01 + 0.018 * t;
  const hangAt = style === "full" ? (t) => 0.24 * smoothstep(0.5, 1, t) : () => 0;
  const rows = [];
  const inner = [];
  const segs = 10;
  const steps = 3;
  for (let k = 0; k <= steps; k += 1) {
    const t = k / steps;
    const outRow = [];
    const inRow = [];
    for (let j = 0; j < segs; j += 1) {
      const lon = (j / segs) * Math.PI * 2;
      // The beard sits on the sides and under the chin, and stops short of the mouth in front.
      const v = topAt(lon) + (-0.94 - topAt(lon)) * t;
      const skin = onHead(v, lon);
      const out = headOut(skin);
      const front = Math.max(0, Math.sin(lon));
      const outer = skin
        .clone()
        .addScaledVector(out, hr * thickAt(t))
        .add(V(0, -hr * hangAt(t), hr * hangAt(t) * 0.28 * front));
      // Pulled in across the cheeks: a beard as wide as the skull reads as a mask at any
      // distance where the face is only a dozen pixels across.
      outer.x *= 0.84;
      outRow.push(part.vert(outer, headWeights));
      inRow.push(part.vert(skin.clone().addScaledVector(out, hr * 0.004), headWeights));
    }
    rows.push(outRow);
    inner.push(inRow);
  }
  for (let k = 0; k < steps; k += 1) {
    bridge(part, rows[k], rows[k + 1], true);
    bridge(part, inner[k], inner[k + 1], false);
  }
  bridge(part, rows[0], inner[0], false);
  bridge(part, rows[steps], inner[steps], true);

  if (style === "full") {
    // Moustache, sitting on the skin between the nose and the mouth.
    const left = onHead(-0.3, Math.PI / 2 + 0.26);
    const right = onHead(-0.3, Math.PI / 2 - 0.26);
    const out = headOut(onHead(-0.3, Math.PI / 2));
    slab(part, {
      from: left.addScaledVector(out, hr * 0.035),
      to: right.addScaledVector(out, hr * 0.035),
      ax: Y,
      halfWidth: hr * 0.085,
      halfDepth: hr * 0.075,
      weights: headWeights,
      segs: 6,
      power: 2.8,
      steps: 3,
      round: 0.4,
      widthFn: (t) => 0.7 + 0.5 * Math.sin(t * Math.PI),
    });
  }
}

function buildHair(H, spec, headC, headR, hr, s, P) {
  const style = spec.hair ?? "crop";
  if (style === "none") return;
  const weights = [["Head", 1]];
  const part = H.part(P.hair, "part");
  const capRadius = [headR[0] * 1.055, headR[1] * 1.04, headR[2] * 1.055];

  // front(lon) is 1 straight ahead of the face and 0 straight behind it.
  const front = (lon) => (Math.sin(lon) + 1) / 2;

  // Per style: [brow height, nape height, side adjustment]. A negative side value lifts the
  // line clear of the ear, which is what stops a short style reading as a swimming cap.
  const LINE = {
    crop: [0.42, -0.3, -0.03],
    ponytail: [0.4, -0.34, -0.05],
    bun: [0.42, -0.28, -0.03],
    braids: [0.38, -0.36, 0.05],
    curls: [0.46, -0.24, -0.02],
    wispy: [0.6, -0.14, -0.02],
    bald: null,
  };

  if (style === "bald") {
    // A horseshoe: gone on top, still there round the sides and the back, and *absent* at the
    // front. The top and bottom edges are made to meet as they come forward, which collapses
    // the band to nothing over the brow. Without that clamp the band simply carried on across
    // the face and the character wore a mask.
    //
    // KNOWN LIMIT, and why no character in the pack uses this style: "collapses to nothing" is
    // not quite true. `shellBand` draws an outer and an inner ellipsoid `thickness` apart and
    // bridges their rims, so where the two edges meet the band still has a rim a few
    // millimetres wide. On a skull that rim traces a line from the temple down across the cheek
    // — a pale strap on a silver-haired head, which is the mask this clamp was written to
    // prevent, drawn thinner. Fixing it properly needs a per-longitude thickness in
    // `shellBand`, which no other caller wants.
    //
    // How early they meet is the whole of it. The first curves closed only at dead ahead, so at
    // 30 degrees off the nose the band was still a few centimetres tall — a pale silver strap
    // running across Otto's cheek beside his eye, which is exactly the mask this clamp exists
    // to prevent, just narrower. Squaring the falloff and steepening both edges closes the band
    // about 65 degrees before the front, which is where a bald man's hair actually stops: at
    // the temple, behind the eye.
    const top = (lon) => 0.3 - 0.7 * front(lon) ** 1.8;
    shellBand(part, {
      center: headC,
      radius: capRadius,
      segs: 12,
      rings: 3,
      weights,
      yMax: top,
      yMin: (lon) => Math.min(top(lon), -0.4 + 0.62 * front(lon) ** 1.8),
      thickness: 0.07,
    });
    return;
  }

  const [brow, nape, ear] = LINE[style] ?? LINE.crop;
  const hairline = (lon) => {
    const f = front(lon);
    const side = 1 - Math.abs(Math.sin(lon));
    return nape + (brow - nape) * f ** 1.45 - ear * side;
  };

  shellBand(part, {
    center: headC,
    radius: capRadius,
    segs: 12,
    rings: 5,
    weights,
    yMin: hairline,
    yMax: 1,
    thickness: 0.075,
    // A little extra volume above the brow and at the back of the crown, so the hair sits on
    // the head rather than being shrink-wrapped to it.
    shape: (y, lon) => {
      const f = front(lon);
      const lift = 1 + 0.09 * Math.max(0, y) * (0.4 + 0.6 * f) + 0.05 * (1 - f) * Math.max(0, y);
      return [lift, 1 + 0.05 * Math.max(0, y), lift];
    },
  });

  if (style === "ponytail") {
    const tail = H.part(P.hair, "tail");
    const start = V(headC.x, headC.y + hr * 0.26, headC.z - headR[2] * 0.98);
    const pts = [
      start,
      start.clone().add(V(0, -hr * 0.3, -hr * 0.16)),
      start.clone().add(V(0, -hr * 0.78, -hr * 0.12)),
      start.clone().add(V(0, -hr * 1.18, hr * 0.04)),
    ];
    skinChain(tail, {
      joints: pts,
      bones: ["Head", "Head", "Head"],
      radii: [[hr * 0.15, hr * 0.13], [hr * 0.18, hr * 0.16], [hr * 0.13, hr * 0.12], [hr * 0.05, hr * 0.05]],
      segs: 8,
      ringsPerSegment: 2,
      blend: 0.45,
      up: X,
    });
    const tiePart = H.part(P.hairTie ?? CHAR_PALETTE.rust, "tiePart");
    band(tiePart, {
      center: pts[1].clone(),
      ax: X,
      az: Z,
      rx: hr * 0.19,
      rz: hr * 0.18,
      height: hr * 0.11,
      thickness: 0.2,
      segs: 8,
      weights,
    });
  } else if (style === "bun") {
    const bun = H.part(P.hair, "bun");
    ellipsoid(bun, {
      center: V(headC.x, headC.y + hr * 0.66, headC.z - headR[2] * 0.66),
      radius: [hr * 0.32, hr * 0.3, hr * 0.32],
      segs: 8,
      rings: 6,
      weights,
    });
  } else if (style === "braids") {
    for (const m of [1, -1]) {
      const braid = H.part(P.hair, "braid");
      const start = V(m * headR[0] * 0.92, headC.y - hr * 0.12, headC.z - hr * 0.1);
      const pts = [
        start,
        start.clone().add(V(m * 0.012 * s, -hr * 0.45, 0)),
        start.clone().add(V(m * 0.02 * s, -hr * 0.95, hr * 0.05)),
        start.clone().add(V(m * 0.02 * s, -hr * 1.32, hr * 0.1)),
      ];
      skinChain(braid, {
        joints: pts,
        bones: ["Head", "Head", "Head"],
        radii: [[hr * 0.14, hr * 0.13], [hr * 0.13, hr * 0.12], [hr * 0.1, hr * 0.1], [hr * 0.045, hr * 0.045]],
        segs: 6,
        ringsPerSegment: 2,
        blend: 0.45,
        up: Z,
      });
    }
  } else if (style === "curls") {
    // Overlapping lobes around the crown. Cheap, and at any distance it reads as thick hair
    // rather than as a helmet, which is what a child needs to not look like a small adult.
    for (let k = 0; k < 11; k += 1) {
      const lon = (k / 11) * Math.PI * 2 + 0.3;
      const f = front(lon);
      const curl = H.part(P.hair, "curl");
      ellipsoid(curl, {
        center: V(
          headC.x + Math.cos(lon) * headR[0] * (0.78 - 0.1 * f),
          headC.y + hr * (0.24 + 0.12 * Math.sin(k * 2.3) - 0.1 * f),
          headC.z + Math.sin(lon) * headR[2] * (0.78 - 0.1 * f),
        ),
        radius: [hr * 0.22, hr * 0.2, hr * 0.22],
        segs: 6,
        rings: 4,
        weights,
      });
    }
  } else if (style === "wispy") {
    for (const m of [1, -1]) {
      const tuft = H.part(P.hair, "tuft");
      ellipsoid(tuft, {
        center: V(m * headR[0] * 0.9, headC.y + hr * 0.06, headC.z - hr * 0.14),
        radius: [hr * 0.17, hr * 0.28, hr * 0.26],
        segs: 6,
        rings: 4,
        weights,
      });
    }
  }
}


function buildGear(G, spec, world, headC, headR, hr, s, P, girth) {
  const gear = spec.gear ?? [];
  const w = (n) => world.get(n);
  const headWeights = [["Head", 1]];

  if (gear.includes("strawhat")) {
    const part = G.part(P.hat ?? CHAR_PALETTE.straw, "part");
    const brimY = headC.y + hr * 0.62;
    shellBand(part, {
      center: V(headC.x, brimY - hr * 0.06, headC.z),
      radius: [headR[0] * 1.17, hr * 0.72, headR[2] * 1.17],
      segs: 12,
      rings: 4,
      weights: headWeights,
      yMin: -0.05,
      yMax: 1,
      thickness: 0.07,
    });
    disc(part, {
      center: V(headC.x, brimY - hr * 0.02, headC.z),
      ax: X,
      az: Z,
      inner: [headR[0] * 1.15, headR[2] * 1.15],
      outer: [headR[0] * 2.05, headR[2] * 1.95],
      thickness: 0.016 * s,
      segs: 12,
      weights: headWeights,
      // A brim that droops at the sides and lifts at the front reads as straw. A flat disc
      // reads as a frisbee.
      tilt: (t) => -0.026 * s * Math.cos(t) ** 2 + 0.012 * s * Math.sin(t),
    });
    const bandPart = G.part(P.hatBand ?? CHAR_PALETTE.rust, "bandPart");
    band(bandPart, {
      center: V(headC.x, brimY + hr * 0.14, headC.z),
      ax: X,
      az: Z,
      rx: headR[0] * 1.13,
      rz: headR[2] * 1.13,
      height: hr * 0.17,
      thickness: 0.09,
      segs: 12,
      weights: headWeights,
    });
  }

  if (gear.includes("cap")) {
    const part = G.part(P.hat ?? CHAR_PALETTE.sageDark, "part");
    shellBand(part, {
      center: V(headC.x, headC.y + hr * 0.1, headC.z),
      radius: [headR[0] * 1.17, headR[1] * 1.06, headR[2] * 1.17],
      segs: 10,
      rings: 4,
      weights: headWeights,
      yMin: (lon) => 0.4 + 0.05 * Math.sin(lon),
      yMax: 1,
      thickness: 0.07,
    });
    // Peak.
    //
    // Height matters more than shape here. The first pass sloped the peak from 0.44 of the head
    // radius down to 0.32, and the eyes sit at 0.10 with the brow at 0.25 — so from the
    // three-quarter camera the storefront shoots from, which looks DOWN at the face, the peak
    // covered both of Pim's eyes and one of Benno's. A cap over the eyes costs a character its
    // face at every size. The peak now starts at 0.52 and falls only to 0.47, which clears the
    // brow from above as well as from straight on.
    const peak = G.part(P.hat ?? CHAR_PALETTE.sageDark, "peak");
    const rows = [];
    const segs = 8;
    for (let k = 0; k <= 3; k += 1) {
      const t = k / 3;
      const ids = [];
      for (let j = 0; j < segs; j += 1) {
        const a = (j / segs) * Math.PI * 2;
        const cx = Math.cos(a);
        const cz = Math.sin(a);
        const reach = 1 + t * 0.62 * Math.max(0, cz) ** 1.4;
        ids.push(
          peak.vert(
            V(
              headC.x + cx * headR[0] * 1.16 * (1 + t * 0.05),
              headC.y + hr * 0.52 - t * hr * 0.05 - (t * 0.012 * s * Math.max(0, cz)),
              headC.z + cz * headR[2] * 1.16 * reach,
            ),
            headWeights,
          ),
        );
      }
      rows.push(ids);
    }
    const under = rows.map((row) =>
      row.map((id) => {
        const p = V(peak.pos[id * 3], peak.pos[id * 3 + 1] - 0.014 * s, peak.pos[id * 3 + 2]);
        return peak.vert(p, headWeights);
      }),
    );
    for (let k = 0; k < rows.length - 1; k += 1) bridge(peak, rows[k], rows[k + 1]);
    for (let k = 0; k < under.length - 1; k += 1) bridge(peak, under[k], under[k + 1], true);
    bridge(peak, rows[rows.length - 1], under[under.length - 1], true);
  }

  if (gear.includes("headscarf")) {
    const part = G.part(P.hat ?? CHAR_PALETTE.rust, "part");
    shellBand(part, {
      center: V(headC.x, headC.y + hr * 0.04, headC.z),
      radius: [headR[0] * 1.09, headR[1] * 1.06, headR[2] * 1.09],
      segs: 10,
      rings: 4,
      weights: headWeights,
      yMin: -0.32,
      yMax: 1,
      thickness: 0.05,
    });
    const knot = G.part(P.hat ?? CHAR_PALETTE.rust, "knot");
    ellipsoid(knot, {
      center: V(headC.x, headC.y - hr * 0.18, headC.z - headR[2] * 1.06),
      radius: [hr * 0.18, hr * 0.16, hr * 0.18],
      segs: 6,
      rings: 4,
      weights: headWeights,
    });
  }

  if (gear.includes("glasses")) {
    const part = G.part(P.frame ?? CHAR_PALETTE.ironDark, "part");
    const eyeY = headC.y + hr * 0.09;
    const eyeX = headR[0] * 0.44;
    const eyeZ = headR[2] * 0.9;
    for (const m of [1, -1]) {
      disc(part, {
        center: V(m * eyeX, eyeY, eyeZ + 0.006 * s),
        ax: X,
        az: Y,
        inner: [hr * 0.19, hr * 0.19],
        outer: [hr * 0.25, hr * 0.25],
        thickness: 0.008 * s,
        segs: 8,
        weights: headWeights,
      });
      // Temple arm back to the ear.
      cord(
        part,
        [
          V(m * (eyeX + hr * 0.24), eyeY, eyeZ),
          V(m * headR[0] * 1.0, eyeY + hr * 0.02, headC.z),
          V(m * headR[0] * 0.95, eyeY - hr * 0.02, headC.z - headR[2] * 0.75),
        ],
        0.006 * s,
        headWeights,
        5,
      );
    }
    cord(part, [V(-eyeX + hr * 0.19, eyeY + hr * 0.02, eyeZ + 0.004 * s), V(0, eyeY + hr * 0.06, eyeZ + 0.006 * s), V(eyeX - hr * 0.19, eyeY + hr * 0.02, eyeZ + 0.004 * s)], 0.005 * s, headWeights, 5);
  }

  // The torso is not a vertical cylinder on every character: the elder's spine leans back at
  // the hips and forward at the shoulders. Panels centred on x=0, z=0 sink into his back.
  const spineZ = (y) => {
    const lo = w("Hips");
    const hi = w("Spine2");
    const t = Math.max(0, Math.min(1, (y - lo.y) / (hi.y - lo.y)));
    return lo.z + (hi.z - lo.z) * t;
  };

  if (gear.includes("apron")) {
    const part = G.part(P.apron ?? CHAR_PALETTE.cream, "part");
    const top = w("Spine1").y + 0.015 * s;
    const bottom = w("Hips").y - 0.38 * s;
    const rows = [];
    const inner = [];
    const segs = 11;
    const steps = 4;
    // An apron is a narrow bib that widens into a skirt. Widening it by *arc* rather than by
    // radius is what keeps every row outside the torso it hangs on; the first version scaled
    // the radius down at the top and buried the whole bib inside the shirt.
    const arcAt = (t) => Math.PI * (0.6 + 0.62 * t * t + 0.16 * t);
    for (let k = 0; k <= steps; k += 1) {
      const t = k / steps;
      const y = top + (bottom - top) * t;
      // A bib that stays bib-width all the way down is a tabard. An apron flares.
      const widen = 1.0 + 0.34 * t * t + 0.06 * t;
      const arc = arcAt(t);
      const outerIds = [];
      const innerIds = [];
      for (let j = 0; j < segs; j += 1) {
        const a = -arc / 2 + (j / (segs - 1)) * arc;
        const rx = 0.152 * s * girth.waist * widen;
        const rz = 0.118 * s * girth.waist * widen;
        const px = Math.sin(a) * rx;
        const pz = Math.cos(a) * rz;
        const cz = spineZ(y);
        outerIds.push(part.vert(V(px, y, cz + pz), apronWeights(t)));
        innerIds.push(part.vert(V(px * 0.94, y, cz + pz * 0.94), apronWeights(t)));
      }
      rows.push(outerIds);
      inner.push(innerIds);
    }
    for (let k = 0; k < steps; k += 1) {
      for (let j = 0; j < segs - 1; j += 1) {
        part.quad(rows[k][j], rows[k + 1][j], rows[k + 1][j + 1], rows[k][j + 1]);
        part.quad(inner[k][j + 1], inner[k + 1][j + 1], inner[k + 1][j], inner[k][j]);
      }
      part.quad(rows[k][0], inner[k][0], inner[k + 1][0], rows[k + 1][0]);
      part.quad(rows[k + 1][segs - 1], inner[k + 1][segs - 1], inner[k][segs - 1], rows[k][segs - 1]);
    }
    for (let j = 0; j < segs - 1; j += 1) {
      part.quad(rows[0][j + 1], inner[0][j + 1], inner[0][j], rows[0][j]);
      part.quad(rows[steps][j], inner[steps][j], inner[steps][j + 1], rows[steps][j + 1]);
    }
    // Neck strap and waist tie.
    const strapColor = P.apronStrap ?? P.apron ?? CHAR_PALETTE.creamDark;
    const strap = G.part(strapColor, "strap");
    for (const m of [1, -1]) {
      cord(
        strap,
        [
          V(m * 0.07 * s, top - 0.01 * s, 0.115 * s * girth.waist),
          V(m * 0.075 * s, w("Spine2").y + 0.03 * s, 0.07 * s),
          V(m * 0.05 * s, w("Neck").y - 0.02 * s, -0.03 * s),
        ],
        0.014 * s,
        [["Spine1", 0.4], ["Spine2", 0.6]],
        6,
      );
    }
    const tie = G.part(strapColor, "tie");
    band(tie, {
      center: V(0, w("Hips").y + 0.03 * s, 0),
      ax: X,
      az: Z,
      rx: 0.14 * s * girth.waist,
      rz: 0.109 * s * girth.waist,
      height: 0.03 * s,
      thickness: 0.1,
      segs: 10,
      weights: [["Hips", 0.6], ["Spine", 0.4]],
    });
  }

  if (gear.includes("satchel")) {
    const part = G.part(P.bag ?? CHAR_PALETTE.leather, "part");
    const bagCenter = V(0.135 * s, w("Hips").y - 0.04 * s, -0.06 * s);
    slab(part, {
      from: bagCenter.clone().add(V(0, -0.075 * s, 0)),
      to: bagCenter.clone().add(V(0, 0.075 * s, 0)),
      ax: X,
      halfWidth: 0.062 * s,
      halfDepth: 0.036 * s,
      weights: [["Hips", 0.7], ["Spine", 0.3]],
      segs: 8,
      power: 3.2,
      steps: 2,
      round: 0.3,
    });
    const flap = G.part(P.bagFlap ?? CHAR_PALETTE.leatherDark, "flap");
    slab(flap, {
      from: bagCenter.clone().add(V(0, 0.052 * s, 0)),
      to: bagCenter.clone().add(V(0, 0.082 * s, 0)),
      ax: X,
      halfWidth: 0.066 * s,
      halfDepth: 0.04 * s,
      weights: [["Hips", 0.7], ["Spine", 0.3]],
      segs: 8,
      power: 3.2,
      steps: 2,
      round: 0.25,
    });
    const strapPart = G.part(P.bagStrap ?? CHAR_PALETTE.leatherDark, "strapPart");
    cord(
      strapPart,
      [
        V(0.145 * s, w("Hips").y + 0.03 * s, -0.03 * s),
        V(0.15 * s, w("Spine1").y, 0.02 * s),
        V(0.05 * s, w("Spine2").y + 0.06 * s, 0.03 * s),
        V(-0.06 * s, w("Spine2").y + 0.03 * s, -0.06 * s),
      ],
      0.012 * s,
      [["Spine1", 0.5], ["Spine2", 0.5]],
      6,
    );
  }

  if (gear.includes("backpack")) {
    const part = G.part(P.bag ?? CHAR_PALETTE.sageDark, "part");
    const c = V(0, w("Spine1").y + 0.02 * s, -0.15 * s);
    slab(part, {
      from: c.clone().add(V(0, -0.11 * s, 0)),
      to: c.clone().add(V(0, 0.11 * s, 0)),
      ax: X,
      halfWidth: 0.095 * s,
      halfDepth: 0.055 * s,
      weights: [["Spine1", 0.6], ["Spine2", 0.4]],
      segs: 8,
      power: 3,
      steps: 3,
      round: 0.28,
    });
    const strapPart = G.part(P.bagStrap ?? CHAR_PALETTE.leatherDark, "strapPart");
    for (const m of [1, -1]) {
      cord(
        strapPart,
        // Over the shoulder and all the way down to the waist buckle, and kept clear of the
        // chest surface. Ending the strap at chest depth left it half-buried, which read as a
        // scatter of dark specks on the shirt rather than as a strap.
        [
          V(m * 0.075 * s, w("Spine1").y - 0.06 * s, -0.12 * s),
          V(m * 0.088 * s, w("Spine2").y + 0.05 * s, -0.02 * s),
          V(m * 0.075 * s, w("Spine1").y + 0.02 * s, 0.126 * s),
          V(m * 0.07 * s, w("Spine").y - 0.02 * s, 0.122 * s),
        ],
        0.014 * s,
        [["Spine2", 0.7], ["Spine1", 0.3]],
        5,
      );
    }
  }

  if (gear.includes("vest")) {
    const part = G.part(P.vest ?? CHAR_PALETTE.olive, "part");
    const top = w("Spine2").y + 0.045 * s;
    const bottom = w("Hips").y + 0.02 * s;
    for (const m of [1, -1]) {
      const rows = [];
      const inner = [];
      const segs = 10;
      const steps = 4;
      for (let k = 0; k <= steps; k += 1) {
        const t = k / steps;
        const y = top + (bottom - top) * t;
        const o = [];
        const i2 = [];
        for (let j = 0; j < segs; j += 1) {
          // Wraps from a small opening at the centre front all the way round to the spine, so
          // the garment has a back. Two panels stopping at the ribs read as a bib, not a vest.
          const a = m * (0.14 + (j / (segs - 1)) * 2.92);
          const rx = 0.171 * s * girth.chest * (1 - 0.06 * t);
          const rz = 0.116 * s * girth.chest * (1 - 0.04 * t);
          const cz = spineZ(y);
          o.push(part.vert(V(Math.sin(a) * rx, y, cz + Math.cos(a) * rz), vestWeights(t)));
          i2.push(part.vert(V(Math.sin(a) * rx * 0.95, y, cz + Math.cos(a) * rz * 0.95), vestWeights(t)));
        }
        rows.push(o);
        inner.push(i2);
      }
      for (let k = 0; k < steps; k += 1) {
        for (let j = 0; j < segs - 1; j += 1) {
          if (m > 0) {
            part.quad(rows[k][j], rows[k + 1][j], rows[k + 1][j + 1], rows[k][j + 1]);
            part.quad(inner[k][j + 1], inner[k + 1][j + 1], inner[k + 1][j], inner[k][j]);
          } else {
            part.quad(rows[k][j + 1], rows[k + 1][j + 1], rows[k + 1][j], rows[k][j]);
            part.quad(inner[k][j], inner[k + 1][j], inner[k + 1][j + 1], inner[k][j + 1]);
          }
        }
        part.quad(rows[k][0], inner[k][0], inner[k + 1][0], rows[k + 1][0]);
        part.quad(rows[k + 1][segs - 1], inner[k + 1][segs - 1], inner[k][segs - 1], rows[k][segs - 1]);
      }
      for (let j = 0; j < segs - 1; j += 1) {
        part.quad(rows[0][j + 1], inner[0][j + 1], inner[0][j], rows[0][j]);
        part.quad(rows[steps][j], inner[steps][j], inner[steps][j + 1], rows[steps][j + 1]);
      }
    }
  }

  if (gear.includes("scarf")) {
    const part = G.part(P.scarf ?? CHAR_PALETTE.rust, "part");
    band(part, {
      center: V(0, w("Neck").y + 0.01 * s, 0.004 * s),
      ax: X,
      az: Z,
      rx: 0.078 * s,
      rz: 0.075 * s,
      height: 0.07 * s,
      thickness: 0.16,
      segs: 10,
      weights: [["Neck", 0.7], ["Spine2", 0.3]],
    });
    cord(
      part,
      [
        V(0.045 * s, w("Neck").y - 0.02 * s, 0.062 * s),
        V(0.062 * s, w("Spine2").y - 0.01 * s, 0.088 * s),
        V(0.068 * s, w("Spine2").y - 0.07 * s, 0.095 * s),
      ],
      0.02 * s,
      [["Spine2", 0.6], ["Neck", 0.4]],
      6,
    );
  }

  function apronWeights(t) {
    if (t < 0.3) return [["Spine1", 0.7], ["Spine2", 0.3]];
    if (t < 0.62) return [["Spine", 0.6], ["Spine1", 0.4]];
    return [["Hips", 0.85], ["Spine", 0.15]];
  }
  function vestWeights(t) {
    if (t < 0.35) return [["Spine2", 0.8], ["Spine1", 0.2]];
    if (t < 0.7) return [["Spine1", 0.7], ["Spine", 0.3]];
    return [["Spine", 0.6], ["Hips", 0.4]];
  }
}

export { band, shellBand, cord };
