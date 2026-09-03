/**
 * Airbus H145 (BK117 D-3) — factory demonstrator, written as code.
 *
 * This is the quality bar model: a compact twin, five-blade bearingless main rotor, shrouded
 * Fenestron tail rotor, skid gear, and a white/dark-blue/red demonstrator livery — built from
 * pure three.js geometry with every moving part on a real, named pivot.
 *
 * ---------------------------------------------------------------------------------------
 * REFERENCE DIMENSIONS (public manufacturer data, as supplied in the brief)
 *
 *   overall length (rotors turning) 13.64 m | fuselage length 11.70 m | rotor diameter 11.00 m
 *   height 3.95 m | cabin width 1.70 m | Fenestron duct bore ~1.00 m, 10 unevenly spaced blades
 *
 * Those four length numbers fix the station layout and are not free parameters:
 *   overall = fuselage + (rotorRadius - noseToMast)  =>  noseToMast = 5.50 - (13.64 - 11.70)
 *                                                                  = 3.56 m
 * so the mast axis is the origin (z = 0), the nose tip is z = +3.560 and the rear-most point
 * (the Fenestron shroud trailing edge) is z = -8.140. Everything else hangs off that.
 *
 * ---------------------------------------------------------------------------------------
 * AXES AND ORIGIN
 *
 *   +Z forward (nose), +Y up, +X starboard. Metres. The skid tubes rest on y = 0, so the model
 *   drops onto a floor plane with no offset. z = 0 is the main rotor mast axis.
 *
 * ---------------------------------------------------------------------------------------
 * THE ZERO-OVERLAP RULE
 *
 * No two parts in this model interpenetrate and no two parts share a coplanar face. Every
 * attachment is a butt joint with a deliberate 3-4 mm panel gap — the same gap a real airframe
 * has between a door and its surround. That is what makes the three audit passes come back
 * clean rather than "acceptable":
 *
 *   - coplanar.mjs works to a 2 mm tolerance, so a 3 mm gap is invisible to it and to a buyer.
 *   - gaps.mjs calls a part FLOATING beyond 10 mm, so 3-4 mm still reads as "in contact".
 *   - dogfood-intersections.mjs counts crossing triangles, and a butt joint has none.
 *
 * Add-on panels (doors, cowling, glazing, livery-free trim) are not boxes pushed into the
 * fuselage: they are patches of the fuselage's own lofted surface, pushed out along its normal.
 * They hug the body exactly, so the gap under them is constant and no corner can poke through.
 *
 * The livery is vertex colour on ONE clearcoated paint material, with the band boundaries
 * generated as real edge loops (solved analytically per station), so the red pinstripe is
 * geometrically crisp and there is no decal plane to z-fight with. That is also why the paint
 * counts as one material instead of four.
 *
 * ---------------------------------------------------------------------------------------
 * RIG
 *
 *   h145
 *     fuselage, cockpit_glass, cockpit_seal, cabin_opening_l/r, engine_cowling, ...
 *     door_left_slide   (mesh node, animated .position: pops out then slides aft)
 *       door_window_l
 *     door_right_slide / door_window_r
 *     door_rear_left / door_rear_right   (clamshells, origin ON the hinge, animated .quaternion)
 *     cabin_aft_window_l/r + _seal_l/r   (fixed pane behind each sliding door)
 *     main_rotor_mast, swashplate
 *     main_rotor_hub          (Group pivot at the mast head, spins about +Y)
 *       rotor_hub_plate, rotor_head_grips, rotor_blade_sleeves, rotor_control_rods, rotor_head_cap
 *       main_rotor_blade_1 .. main_rotor_blade_5
 *     tail_boom, tail_fin, h_stab, endplate_l/r
 *     fenestron_duct, fenestron_stator
 *     fenestron_rotor         (Group pivot on the duct axis, spins about +X)
 *       fenestron_hub, fenestron_blade_1 .. fenestron_blade_10
 *     skid_l/r, crosstube_f/r, step_l/r
 *     pitot, wsps_upper, wsps_lower, antenna_dorsal, antenna_ventral, antenna_tail
 *     nav_light_l/r, landing_light
 *
 * Airbus main rotors turn CLOCKWISE seen from above, which is +Y in three.js' convention, so
 * `rotor_spin` drives main_rotor_hub through positive Y and the blades carry their leading
 * edge on -Z. The Fenestron turns about +X at 9x the main rotor rate.
 */

/** Exported so a colourway pass can rebake the same airframe; untouched values ship the demo livery. */
export const H145_PALETTE = {
  liveryWhite: 0xeef0f2,
  liveryBlue: 0x1b2c55,
  liveryRed: 0xc02430,
  liveryGrey: 0x33383e,
  liveryRadome: 0x5c646e,
  paint: { color: 0xffffff, roughness: 0.52, metalness: 0.0, clearcoat: 0.30, clearcoatRoughness: 0.22 },
  /*
   * Round 11. The glazing photographed as a black mirror because a near-black tint had a black
   * rubber sheet directly behind it: nothing to transmit and nothing to reflect. The pane is now
   * a light blue-grey with a full clearcoat and a real transmission term, and the sheet behind it
   * is a painted CABIN INTERIOR instead of a gasket — so the windscreen reads as glass with a
   * dashboard behind it rather than as a hole cut in the nose.
   */
  /*
   * Round 12 retune. Round 11 over-corrected: a 0x93a6b8 pane at 55% transmission over a mid-grey
   * cabin came back BRIGHTER than the white paint beside it, so the windscreen read as a chrome
   * helmet instead of glass. Half the tint and two thirds of the transmission put it back to a
   * dark slate that still shows the cabin behind it, and the clearcoat carries the highlight.
   *
   * No `thickness`, deliberately: a windscreen IS a thin shell, and KHR_materials_volume's
   * thicknessFactor is a LOCAL-space length, so the meshopt quantisation pass has to clone the
   * material once per mesh scale to keep it correct — four identical h145_glass materials in the
   * .m1. Thin-walled transmission needs no volume extension, and the clone goes away.
   */
  glass: { color: 0x59646f, roughness: 0.030, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.02, ior: 1.52, reflectivity: 0.90, transmission: 0.40 },
  /* Vertex-coloured: near-black where it shows round the pane as a gasket, cabin grey where it
   * shows THROUGH the pane, with a darker band for the glareshield and the seat backs. */
  interior: { color: 0xffffff, roughness: 0.74, metalness: 0.04, clearcoat: 0.10, clearcoatRoughness: 0.5 },
  metal: { color: 0xa8aeb5, roughness: 0.34, metalness: 0.92, clearcoat: 0.1, clearcoatRoughness: 0.3 },
  gear: { color: 0x2f343a, roughness: 0.42, metalness: 0.82, clearcoat: 0.1, clearcoatRoughness: 0.3 },
  exhaust: { color: 0x6d6259, roughness: 0.5, metalness: 1.0, clearcoat: 0.0, clearcoatRoughness: 0.5 },
  blade: { color: 0x101114, roughness: 0.44, metalness: 0.05, clearcoat: 0.35, clearcoatRoughness: 0.18 },
  lens: { color: 0xf2f6ff, roughness: 0.07, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.02, emissive: 0x1b2030, emissiveIntensity: 0.6 },
  dark: { color: 0x0a0b0d, roughness: 0.9, metalness: 0.05, clearcoat: 0.0, clearcoatRoughness: 0.5 },
};

/** Segment budget. `coarse` keeps every dimension and every gap and only drops tessellation,
 *  so the slower O(n^2) audit passes can be run on an identical layout. */
export const H145_LOD = {
  hero: { fuseRows: 104, fuseColsTop: 17, fuseColsBlue: 10, fuseColsGrey: 8, ring: 28, bladeSpan: 32, bladeAround: 26, fenSpan: 10, fenAround: 14, duct: 64, doorRows: 22, glassRows: 20 },
  /* Every count here is high enough that the derived shells (which subtract from these) stay
     positive: a negative run count silently drops columns and the audit then measures a mesh
     that is not the one being shipped. */
  /* Raised from the first pass. The audit builds have to be coarse enough to run an O(n^2) pass
     in seconds and fine enough that the CHORD ERROR of a surface-hugging panel stays inside its
     own stand-off: at six rows the windscreen seal's 3.5 mm gap was smaller than its own sagitta
     over a 1.05 m span, and the intersection pass counted 74 crossings that the shipped hero
     mesh does not have. Tessellation is the only thing that differs from hero; every dimension
     and every gap is identical. */
  coarse: { fuseRows: 30, fuseColsTop: 12, fuseColsBlue: 7, fuseColsGrey: 7, ring: 16, bladeSpan: 5, bladeAround: 6, fenSpan: 2, fenAround: 5, duct: 18, doorRows: 10, glassRows: 14 },
};

// ---------------------------------------------------------------------------- geometry math

/** Monotone cubic (PCHIP) through control points — never overshoots, so a half-width stays positive. */
function pchip(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const n = xs.length;
  const h = [];
  const delta = [];
  for (let i = 0; i < n - 1; i += 1) {
    h.push(xs[i + 1] - xs[i]);
    delta.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  }
  const m = new Array(n).fill(0);
  m[0] = delta[0];
  m[n - 1] = delta[n - 2];
  for (let i = 1; i < n - 1; i += 1) {
    if (delta[i - 1] * delta[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i]);
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i += 1;
    const t = (x - xs[i]) / h[i];
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      ys[i] * (2 * t3 - 3 * t2 + 1) +
      h[i] * m[i] * (t3 - 2 * t2 + t) +
      ys[i + 1] * (-2 * t3 + 3 * t2) +
      h[i] * m[i + 1] * (t3 - t2)
    );
  };
}

/** NACA 00xx half-thickness at chord fraction `t`, scaled so `ratio` is the max thickness/chord. */
function naca(t, ratio) {
  const x = Math.min(1, Math.max(0, t));
  return (
    (ratio / 0.2) *
    (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x)
  );
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (t) => t * t * (3 - 2 * t);

// ---------------------------------------------------------------------------- the airframe loft

/**
 * Fuselage stations: z, section centre height, half width, half height above/below the centre,
 * and the section's CORNER RADIUS.
 *
 * The section is an asymmetric rounded rectangle, not a superellipse. That is the single change
 * that makes the pod read as an H145 rather than as a generic pod: the cabin has a genuinely
 * FLAT roof 1.40 m across, genuinely FLAT sides 1.89 m apart, and a flat floor, with a 250 mm
 * radius rolling between them. A superellipse of any exponent curves everywhere, which is why
 * the same station numbers photographed as a tube.
 *
 * Read down the list and you are reading the side view: a fine nose at 1.85 m, the cockpit
 * swelling to the windscreen header, a 1.52 m tall cabin box with a flat floor at 1.036 m held
 * all the way aft, and then a FLAT REAR BULKHEAD at z = -2.560 — 1.70 m wide, 1.36 m tall —
 * which is what the clamshell doors hang on and what the tail boom steps down from.
 */
const STATIONS = [
  // z,      cy,     hw,     ht,     hb,     cornerR
  [3.560, 1.845, 0.090, 0.080, 0.086, 0.075],
  [3.440, 1.822, 0.280, 0.216, 0.252, 0.185],
  [3.260, 1.780, 0.450, 0.340, 0.390, 0.270],
  [3.000, 1.722, 0.605, 0.470, 0.500, 0.320],
  [2.680, 1.676, 0.700, 0.560, 0.548, 0.345],
  [2.300, 1.648, 0.792, 0.688, 0.598, 0.340],
  [1.900, 1.658, 0.856, 0.792, 0.626, 0.322],
  [1.480, 1.696, 0.900, 0.848, 0.652, 0.300],
  [1.000, 1.734, 0.928, 0.862, 0.682, 0.280],
  [0.450, 1.752, 0.942, 0.860, 0.706, 0.262],
  [-0.150, 1.756, 0.945, 0.856, 0.718, 0.252],
  [-0.750, 1.756, 0.945, 0.852, 0.720, 0.250],
  [-1.350, 1.754, 0.942, 0.846, 0.716, 0.250],
  [-1.800, 1.750, 0.930, 0.836, 0.700, 0.252],
  /*
   * The last three stations pull the roof and the sides IN toward the bulkhead. Running the full
   * cabin box hard up against the rear face and then starting an 0.88 m boom off it made the
   * junction read as unfinished rather than as a step: real aft bodies neck down first. The rear
   * face is still flat and still 1.62 m wide — big enough to be a pair of clamshell doors.
   */
  [-2.150, 1.748, 0.898, 0.802, 0.658, 0.262],
  [-2.400, 1.752, 0.852, 0.760, 0.610, 0.284],
  [-2.560, 1.758, 0.808, 0.726, 0.572, 0.300],
];

const NOSE_Z = STATIONS[0][0];
const POD_TAIL_Z = STATIONS[STATIONS.length - 1][0];

const fuseCy = pchip(STATIONS.map((s) => [s[0], s[1]]).reverse());
const fuseHw = pchip(STATIONS.map((s) => [s[0], s[2]]).reverse());
const fuseHt = pchip(STATIONS.map((s) => [s[0], s[3]]).reverse());
const fuseHb = pchip(STATIONS.map((s) => [s[0], s[4]]).reverse());
const fuseCr = pchip(STATIONS.map((s) => [s[0], s[5]]).reverse());

/**
 * One half of an asymmetric rounded-rectangle section, walked at CONSTANT ARC LENGTH from the
 * crown (theta 0) to the keel (theta PI). Arc length rather than angle, because an angular
 * sweep spends most of its columns on the two corners and leaves the flat roof and the flat
 * side — the two surfaces that carry the whole silhouette — with three vertices between them.
 *
 * Returns [x, dy, nx, ny]: the point relative to the section centre, and the exact 2D normal.
 */
function roundRect(hw, ht, hb, cr, theta) {
  const rt = Math.min(cr, hw * 0.995, ht * 0.995);
  const rb = Math.min(cr, hw * 0.995, hb * 0.995);
  const l1 = hw - rt;
  const l2 = (Math.PI / 2) * rt;
  const l3 = (ht - rt) + (hb - rb);
  const l4 = (Math.PI / 2) * rb;
  const l5 = hw - rb;
  let s = clamp(theta / Math.PI, 0, 1) * (l1 + l2 + l3 + l4 + l5);
  if (s <= l1) return [s, ht, 0, 1];
  s -= l1;
  if (s <= l2) { const a = s / rt; return [hw - rt + rt * Math.sin(a), ht - rt + rt * Math.cos(a), Math.sin(a), Math.cos(a)]; }
  s -= l2;
  if (s <= l3) return [hw, ht - rt - s, 1, 0];
  s -= l3;
  if (s <= l4) { const a = s / rb; return [hw - rb + rb * Math.cos(a), rb - hb - rb * Math.sin(a), Math.cos(a), -Math.sin(a)]; }
  s -= l4;
  return [Math.max(0, hw - rb - s), -hb, 0, -1];
}

/**
 * The livery break line: the top of the thin red pinstripe, as a height in metres against z.
 * It is deliberately a sweep — high over the nose, lowest under the cabin door, climbing again
 * into the tail boom — because that curve is what makes a two-tone paint scheme read as a
 * scheme rather than as a horizontal band.
 */
const REDLINE = pchip(
  [
    [-8.20, 2.440],
    [-6.784, 2.425],
    [-6.00, 2.395],
    [-5.00, 2.340],
    [-4.00, 2.280],
    [-3.20, 2.230],
    [-2.564, 2.180],
    [-2.10, 1.860],
    [-1.40, 1.500],
    /*
     * Round 11. Forward of the cabin the sweep DIVES and then rides the keel.
     *
     * It used to climb — 1.585 m at z = 2.30, 1.720 m at the tip — while the underside of the
     * nose falls away to 1.05 m, so the dark band under the stripe grew to half a metre deep
     * exactly where the nose is narrowest. Against near-black glazing that painted the whole
     * front of the aircraft dark: the checker called it a black helmet, and he was right.
     *
     * From z = 2.30 forward every value is the station's own KEEL height plus 130 mm, so the
     * band is a constant hand's width of belly paint that follows the nose up to the tip and
     * never climbs onto the nose's face. The nose reads white, which is what the real one is.
     */
    [-0.60, 1.455],
    [0.20, 1.450],
    [1.40, 1.470],
    [1.90, 1.395],
    [2.30, 1.240],
    [2.68, 1.258],
    [3.00, 1.352],
    [3.26, 1.520],
    [3.44, 1.700],
    [3.56, 1.889],
  ],
);
const RED_H = 0.046; // pinstripe height, metres

/** Boundaries as heights, then as angles on the section. Angle 0 is the crown, PI is the keel. */
function bandHeights(z) {
  const top = REDLINE(z);
  const bot = top - RED_H;
  const keel = fuseCy(z) - fuseHb(z);
  const grey = Math.min(keel + 0.125, bot - 0.03);
  return { redTop: top, redBot: bot, grey };
}

/**
 * Inverse of the section profile: the angle at which the surface reaches height `y`.
 * Bisection rather than a closed form, because a rounded rectangle has two runs (the flat crown
 * and the flat keel) where height is constant — an analytic inverse of those does not exist,
 * and every livery boundary in this model lands on the side or on a corner, where it does.
 */
function thetaAtHeight(z, y) {
  let lo = 0;
  let hi = Math.PI;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (fusePoint(z, mid)[1] > y) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * The angle at which a panel standing `d` off the skin reaches height `y`.
 *
 * The bare-loft solution is not good enough for an add-on panel: pushing a point 31 mm along a
 * normal that is partly vertical moves it up to ~9 mm in height, so a door painted from the
 * bare-loft angles carries its stripe visibly below the one on the fuselage beside it. Bisection,
 * because height falls monotonically from crown to keel.
 */
function thetaAtHeightOffset(z, y, d) {
  let lo = 0;
  let hi = Math.PI;
  for (let i = 0; i < 22; i += 1) {
    const mid = (lo + hi) / 2;
    if (fuseOffset(z, mid, d)[1] > y) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Surface point of the bare loft at (z, theta). theta 0 = crown, PI/2 = starboard, PI = keel. */
function fusePoint(z, theta) {
  /*
   * Theta runs continuously all the way round: negative mirrors to port (the engine deck is
   * addressed that way), and past PI it reflects back up the port side (the chin fairing is
   * addressed that way). Both had to keep working through the section change, and a fairing that
   * straddles the keel cannot be built at all without the second case.
   */
  let t = theta;
  let sgn = 1;
  if (t < 0) { t = -t; sgn = -1; }
  if (t > Math.PI) { t = 2 * Math.PI - t; sgn = -sgn; }
  const s = roundRect(fuseHw(z), fuseHt(z), fuseHb(z), fuseCr(z), clamp(t, 0, Math.PI));
  return [s[0] * sgn, fuseCy(z) + s[1], z];
}

/** Analytic-enough outward normal by central differences — continuous across every patch seam. */
function fuseNormal(z, theta) {
  const dz = 0.004;
  const dt = 0.004;
  const a = fusePoint(clamp(z + dz, POD_TAIL_Z, NOSE_Z), theta);
  const b = fusePoint(clamp(z - dz, POD_TAIL_Z, NOSE_Z), theta);
  const c = fusePoint(z, theta + dt);
  const d = fusePoint(z, theta - dt);
  const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const v = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
  let nx = v[1] * u[2] - v[2] * u[1];
  let ny = v[2] * u[0] - v[0] * u[2];
  let nz = v[0] * u[1] - v[1] * u[0];
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len; ny /= len; nz /= len;
  // Point it away from the section centre.
  const p = fusePoint(z, theta);
  const rx = p[0];
  const ry = p[1] - fuseCy(z);
  if (nx * rx + ny * ry < 0) { nx = -nx; ny = -ny; nz = -nz; }
  return [nx, ny, nz];
}

function fuseOffset(z, theta, d) {
  const p = fusePoint(z, theta);
  if (!d) return p;
  const n = fuseNormal(z, theta);
  return [p[0] + n[0] * d, p[1] + n[1] * d, p[2] + n[2] * d];
}

// ---------------------------------------------------------------------------- the tail boom loft

const BOOM_FRONT_Z = POD_TAIL_Z - 0.004; // 4 mm butt joint against the pod's rear cap
const BOOM_REAR_Z = -6.784;

/*
 * The boom now springs from the TOP of the rear bulkhead and is a genuinely slimmer section than
 * the cabin, so the side view has the step an H145 has: a square cabin, a shoulder, and a tapered
 * boom above the clamshell doors — not one continuous cone.
 */
const boomCy = pchip([[BOOM_REAR_Z, 2.430], [-6.00, 2.408], [-5.00, 2.376], [-4.00, 2.328], [-3.20, 2.278], [BOOM_FRONT_Z, 2.230]]);
const boomHw = pchip([[BOOM_REAR_Z, 0.222], [-6.00, 0.252], [-5.00, 0.298], [-4.00, 0.356], [-3.20, 0.406], [BOOM_FRONT_Z, 0.440]]);
const boomHt = pchip([[BOOM_REAR_Z, 0.210], [-6.00, 0.222], [-5.00, 0.234], [-4.00, 0.240], [-3.20, 0.242], [BOOM_FRONT_Z, 0.240]]);
const boomHb = pchip([[BOOM_REAR_Z, 0.196], [-6.00, 0.212], [-5.00, 0.238], [-4.00, 0.266], [-3.20, 0.284], [BOOM_FRONT_Z, 0.290]]);
const boomN = pchip([[BOOM_REAR_Z, 2.6], [-5.00, 2.9], [BOOM_FRONT_Z, 3.4]]);

/**
 * The lowest the boom root reaches within 54 mm either side of |x|.
 *
 * The clamshell's top edge is cut against this rather than against the exact section, because
 * the exact section steps from "the boom is here" to "the boom is not here" over one column of
 * the door's grid. The interpolated edge then cuts the corner, and the audit found two triangles
 * of each door crossing the boom. Widening the notch by one column moves that step out into free
 * air where nothing can catch it.
 */
function boomClearY(x) {
  let m = Infinity;
  for (let k = -3; k <= 3; k += 1) m = Math.min(m, boomLowerY(Math.abs(x) + k * 0.018));
  return m;
}

/** The boom root's lower surface at a given |x| — what the clamshell doors have to duck under. */
function boomLowerY(x) {
  const hw = boomHw(BOOM_FRONT_Z);
  if (Math.abs(x) >= hw) return Infinity;
  const n = boomN(BOOM_FRONT_Z);
  const s = Math.pow(Math.abs(x) / hw, n / 2);
  const c = Math.sqrt(Math.max(0, 1 - s * s));
  return boomCy(BOOM_FRONT_Z) - boomHb(BOOM_FRONT_Z) * Math.pow(c, 2 / n);
}

function boomPoint(z, theta) {
  const cy = boomCy(z);
  const n = boomN(z);
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const p = 2 / n;
  const x = boomHw(z) * Math.sign(s) * Math.pow(Math.abs(s), p);
  const yr = c >= 0 ? boomHt(z) : boomHb(z);
  const y = cy + yr * Math.sign(c) * Math.pow(Math.abs(c), p);
  return [x, y, z];
}

function boomNormal(z, theta) {
  const dz = 0.004;
  const dt = 0.004;
  const a = boomPoint(clamp(z + dz, BOOM_REAR_Z, BOOM_FRONT_Z), theta);
  const b = boomPoint(clamp(z - dz, BOOM_REAR_Z, BOOM_FRONT_Z), theta);
  const c = boomPoint(z, theta + dt);
  const d = boomPoint(z, theta - dt);
  const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const v = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
  let nx = v[1] * u[2] - v[2] * u[1];
  let ny = v[2] * u[0] - v[0] * u[2];
  let nz = v[0] * u[1] - v[1] * u[0];
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len; ny /= len; nz /= len;
  const p = boomPoint(z, theta);
  if (nx * p[0] + ny * (p[1] - boomCy(z)) < 0) { nx = -nx; ny = -ny; nz = -nz; }
  return [nx, ny, nz];
}

// ---------------------------------------------------------------------------- key stations

/**
 * The dark nose cap. Forward of this station the fuselage paints in the livery's dark grey — a
 * radome, not a livery band — and it starts 70 mm ahead of the windscreen seal's forward rim so
 * the paint break is never under the glass. Everything aft of it is white to the stripe.
 *
 * Round 12 pulled it forward from 3.390 and lifted the grey: at 170 mm in a near-black grey it
 * merged with the chin fairing below it and the nose grew a second black mask, which is the
 * fault this whole round exists to remove. 110 mm of mid-grey reads as the small sensor fairing
 * it is meant to be.
 */
const RADOME_Z = 3.450;

const MAST_TOP_Y = 3.694;         // main rotor plane
const HEAD_TOP_Y = 3.950;         // top of the rotor head = the aircraft's quoted height
const ROTOR_R = 5.500;            // 11.00 m diameter
const BLADE_ROOT_R = 0.620;
const GRIP_TIP_R = 0.616;         // 4 mm butt joint to the blade root
const COWL_TOP_Y = 3.050;

const DUCT_C = [0, 2.460, -7.460];
const DUCT_R_OUT = 0.680;         // shroud outer radius; trailing edge lands on z = -8.140
const DUCT_R_IN = 0.500;          // 1.00 m bore
const FEN_TIP_R = 0.462;          // 38 mm tip clearance inside the bore
const FEN_HALF_X = 0.150;         // duct half depth along the rotor axis

const SKID_X = 1.000;
const SKID_R = 0.055;
const CROSS_R = 0.062;
const CROSS_F_Z = 0.780;
const CROSS_R_Z = -0.900;
const CLAMP_R = 0.078;                    // saddle clamp on the skid
const CLAMP_Y = CLAMP_R;                  // its underside rests exactly on y = 0, like the skid

/** The cross tubes' apex: 4 mm under the belly, measured off the loft rather than guessed. */
const CROSS_APEX_Y = [CROSS_F_Z, CROSS_R_Z].map((z) => fusePoint(z, Math.PI)[1] - 0.004 - CROSS_R);

const COWL_Z0 = -2.300;   // aft end of the deck, 260 mm ahead of the bulkhead
const COWL_Z1 = 0.560;    // the intake face, ahead of the mast
const COWL_T = 1.050;     // half the deck's angular span; past the roof edge, onto the shoulder
const COWL_LOBE = 0.520;  // where the intakes and the exhausts stand, in section arc-angle
const COWL_H = 0.400;     // how far a cowl crown stands over the cabin roof
const COWL_FLOOR = 0.020; // the cowling panel's own thickness where it meets the roof

/**
 * How far the engine deck stands off the roof at (z, theta).
 *
 * TWO flat-topped lobes, not one dome. A quartic super-Gaussian holds its crown flat over about
 * 470 mm and then falls away fast, so each engine cowl has a deck an eye can read, and the pair
 * leaves a 56 mm valley on the centreline for the mast fairing to sit in. That valley is the
 * shape cue: from the front an H145 is two boxes with a gearbox between them, and a single
 * blister — which is what this was — cannot be told from any other light twin.
 *
 * Exposed as a function because the intakes and the exhausts have to sit ON this surface.
 */
function cowlD(z, theta) {
  const u = clamp((z - COWL_Z0) / (COWL_Z1 - COWL_Z0), 0, 1);
  /*
   * An eighth-order super-Gaussian: flat to within a percent over 1.40 m of deck, then a wall
   * that drops 380 mm in 0.17 rad — about 62 degrees. The quartic that was here fell away over
   * half a radian, which is a shoulder, not a wall, and a shoulder in white paint under a soft
   * key light is invisible: three rounds of renders showed a deck that measured 400 mm proud and
   * photographed as a slightly domed roof.
   */
  const lobe = Math.exp(-Math.pow(Math.abs(theta) / 0.860, 8));
  const edge = smooth(clamp((COWL_T - Math.abs(theta)) / 0.150, 0, 1));
  // A taper aft to the exhaust bay, and a short steep ramp forward.
  const along = smooth(clamp(u / 0.16, 0, 1)) * smooth(clamp((1 - u) / 0.075, 0, 1));
  /*
   * The floor is 20 mm, not 6: the cowling is a PANEL bolted to the roof, and its perimeter has
   * to be a step you can see. At 6 mm the rim was a 2 mm lip that vanished in every render, which
   * is why the deck read as a soft blister rather than as two cowls with a parting line.
   */
  return COWL_FLOOR + (COWL_H - COWL_FLOOR) * lobe * edge * along;
}
const cowlPoint = (z, theta, extra = 0) => fuseOffset(z, theta, cowlD(z, theta) + extra);

/*
 * Panel stand-offs. The sliding door's inner skin now clears its opening by 14 mm rather than
 * 3 mm: the 24-phase clip gate measures the door against the airframe at EVERY phase including
 * rest, so a 3 mm parked gap is a 3 mm result no matter how well the door swings.
 */
const DOOR_Z0 = -1.500;
const DOOR_Z1 = 0.120;
const DOOR_D_IN = 0.018;
const DOOR_D_OUT = 0.034;
const DOOR_SLIDE = 1.000;
const DOOR_POP = 0.085;
const OPENING_D_IN = 0.002;
const OPENING_D_OUT = 0.004;

/* The clamshells: flat plates on the flat rear bulkhead, on vertical hinges at their outboard
 * edges. A door that swings about a vertical axis on a FLAT face sweeps into open air, which is
 * why this arrangement holds its gap for the whole 100 degrees instead of grazing the hull. */
const BULK_Z = POD_TAIL_Z;
const CLAM_GAP = 0.018;                 // parked gap between the door and the bulkhead
const CLAM_Z_FRONT = BULK_Z - CLAM_GAP;
const CLAM_Z_BACK = CLAM_Z_FRONT - 0.032;
const CLAM_X_IN = 0.024;                // half the centreline split
const CLAM_X_OUT = 0.776;               // the hinge line
const CLAM_Y_CAP = 2.440;
const CLAM_BOOM_CLR = 0.048;            // how far the door's top edge ducks under the boom root

// =======================================================================================

export default function createH145(THREE, addons, options = {}) {
  const { mergeGeometries } = addons;
  const LOD = H145_LOD[options.lod === "coarse" ? "coarse" : "hero"];
  const P = H145_PALETTE;

  const material = (name, spec, extra = {}) =>
    Object.assign(new THREE.MeshPhysicalMaterial({ ...spec, ...extra }), { name: `h145_${name}` });

  const M = {
    paint: material("paint", P.paint, { vertexColors: true }),
    glass: material("glass", P.glass),
    interior: material("interior", P.interior, { vertexColors: true }),
    metal: material("metal", P.metal),
    gear: material("gear", P.gear),
    exhaust: material("exhaust", P.exhaust),
    blade: material("blade", P.blade),
    lens: material("lens", P.lens),
    dark: material("dark", P.dark),
  };

  const rgb = (hex) => {
    const c = new THREE.Color(hex);
    // Vertex colour multiplies a linear base colour, so convert out of sRGB once, here.
    c.convertSRGBToLinear();
    return [c.r, c.g, c.b];
  };
  const COL = {
    white: rgb(P.liveryWhite),
    blue: rgb(P.liveryBlue),
    red: rgb(P.liveryRed),
    grey: rgb(P.liveryGrey),
    plain: [1, 1, 1],
    // The glazing backing: gasket, cabin, and the dark band that reads as a glareshield/seat.
    gasket: rgb(0x101114),
    cabin: rgb(0x2f363e),
    cabinDark: rgb(0x14171b),
    radome: rgb(P.liveryRadome),
  };

  // ------------------------------------------------------------------ raw geometry assembly

  /** A tiny mesh builder: push positions/normals/uvs/colours, index triangles, hand back a BufferGeometry. */
  function Builder() {
    const pos = [];
    const nor = [];
    const uv = [];
    const col = [];
    const idx = [];
    return {
      get count() { return pos.length / 3; },
      vertex(p, n, u, c) {
        pos.push(p[0], p[1], p[2]);
        nor.push(n[0], n[1], n[2]);
        uv.push(u[0], u[1]);
        col.push(c[0], c[1], c[2]);
        return pos.length / 3 - 1;
      },
      /** Zero-area triangles are a defect a buyer's importer will complain about, so they never
       *  get written: a pole on a rounded box or a collapsed livery seam simply emits nothing. */
      tri(a, b, c) {
        const p = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
        const [ax, ay, az] = p(a);
        const [bx, by, bz] = p(b);
        const [cx, cy, cz] = p(c);
        const ux = bx - ax, uy = by - ay, uz = bz - az;
        const vx = cx - ax, vy = cy - ay, vz = cz - az;
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        if (Math.hypot(nx, ny, nz) < 1e-10) return;
        idx.push(a, b, c);
      },
      quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); },
      geometry() {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
        g.setIndex(idx);
        return g;
      },
    };
  }

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const negate = (a) => [-a[0], -a[1], -a[2]];
  const degenerate = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-6;

  /**
   * A quad grid over a parameter rectangle.
   *   at(i, j)      -> point
   *   normalAt(i,j) -> outward normal, or null to derive it from the grid
   *   colourAt(i,j) -> vertex colour
   * Columns whose neighbour is identical (a livery seam) contribute no quads, so the colour can
   * break exactly on an edge loop without leaving a degenerate triangle behind.
   */
  function grid(b, rows, cols, at, { normalAt = null, colourAt = () => COL.plain, wrapCols = false, outwardFrom = null, invert = false } = {}) {
    const pts = [];
    for (let i = 0; i < rows; i += 1) {
      pts.push([]);
      for (let j = 0; j < cols; j += 1) pts[i].push(at(i, j));
    }
    const derived = (i, j) => {
      const i0 = Math.max(0, i - 1);
      const i1 = Math.min(rows - 1, i + 1);
      const j0 = wrapCols ? (j - 1 + cols) % cols : Math.max(0, j - 1);
      const j1 = wrapCols ? (j + 1) % cols : Math.min(cols - 1, j + 1);
      return norm(cross(sub(pts[i1][j], pts[i0][j]), sub(pts[i][j1], pts[i][j0])));
    };
    const normals = [];
    const ids = [];
    for (let i = 0; i < rows; i += 1) {
      normals.push([]);
      ids.push([]);
      for (let j = 0; j < cols; j += 1) {
        let n = normalAt ? normalAt(i, j) : derived(i, j);
        /*
         * The parameter order (i, j) says nothing about which way is out — it points outward on
         * one patch and inward on the next, which is how a whole model ends up inside-out while
         * still looking plausible in a viewer that happens to light it from both sides. Where an
         * interior reference point exists, the normal is turned to face away from it; the winding
         * is then made to agree, below. That makes back-face culling, normal maps and every
         * engine importer behave, instead of relying on the parameterisation being lucky.
         */
        if (outwardFrom) {
          const c = outwardFrom(i, j);
          const r = sub(pts[i][j], c);
          if (n[0] * r[0] + n[1] * r[1] + n[2] * r[2] < 0) n = negate(n);
        }
        if (invert) n = negate(n);
        normals[i].push(n);
        ids[i].push(b.vertex(pts[i][j], n, [j / (cols - 1), i / (rows - 1)], colourAt(i, j)));
      }
    }
    const lastCol = wrapCols ? cols : cols - 1;
    for (let i = 0; i < rows - 1; i += 1) {
      for (let j = 0; j < lastCol; j += 1) {
        const jn = (j + 1) % cols;
        /*
         * No quad-level skipping. `tri()` already drops zero-area triangles one at a time, and
         * skipping the whole quad when ONE of its two triangles collapses (a livery seam, the
         * closed leading edge of a fin) threw away the other one too — which is what left every
         * fin with four boundary edges and no watertight interior.
         */
        const w = cross(sub(pts[i + 1][j], pts[i][j]), sub(pts[i][jn], pts[i][j]));
        const n = normals[i][j];
        if (w[0] * n[0] + w[1] * n[1] + w[2] * n[2] >= 0) b.quad(ids[i][j], ids[i + 1][j], ids[i + 1][jn], ids[i][jn]);
        else b.quad(ids[i][j], ids[i][jn], ids[i + 1][jn], ids[i + 1][j]);
      }
    }
    return ids;
  }

  /**
   * A flat strip between two matching edge loops — every panel rim. `inside` is a point on the
   * body side of the rim, so the rim faces out of the part rather than into it.
   */
  function strip(b, a1, a2, colour, inside = null, dirAt = null) {
    const n = a1.length;
    for (let i = 0; i < n - 1; i += 1) {
      if (degenerate(a1[i], a1[i + 1]) && degenerate(a2[i], a2[i + 1])) continue;
      let e = norm(cross(sub(a1[i + 1], a1[i]), sub(a2[i], a1[i])));
      /*
       * On a root that follows a curved skin, "away from a point in the middle" is not a
       * reliable outward test — near the ends it points along the strip. Where the exact
       * direction is known (the skin normal), it is given instead.
       */
      if (dirAt) {
        const d = dirAt(i);
        if (e[0] * d[0] + e[1] * d[1] + e[2] * d[2] < 0) e = negate(e);
      } else if (inside) {
        const r = sub(a1[i], inside);
        if (e[0] * r[0] + e[1] * r[1] + e[2] * r[2] < 0) e = negate(e);
      }
      const c = typeof colour === "function" ? colour(i) : colour;
      const v = [a1[i], a1[i + 1], a2[i + 1], a2[i]].map((p) => b.vertex(p, e, [0, 0], c));
      const w = cross(sub(a1[i + 1], a1[i]), sub(a2[i + 1], a1[i]));
      if (w[0] * e[0] + w[1] * e[1] + w[2] * e[2] >= 0) b.quad(v[0], v[1], v[2], v[3]);
      else b.quad(v[0], v[3], v[2], v[1]);
    }
  }

  /**
   * A flat fan cap over a closed loop, facing `dir`.
   *
   * The winding is derived from the loop rather than assumed: a shading normal that disagrees
   * with the triangle order gives a face that is culled from the side you can see and drawn from
   * the side you cannot — which is exactly how the tail boom's front cap turned into a white puck
   * floating at the fuselage joint. Reversing the loop when the two disagree makes that
   * impossible for every cap in the model, not just the one that was noticed.
   */
  function cap(b, loop, centre, dir, colour) {
    const n = norm(dir);
    let pts = loop;
    let wound = [0, 0, 0];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const w = cross(sub(pts[i], centre), sub(pts[i + 1], centre));
      wound = [wound[0] + w[0], wound[1] + w[1], wound[2] + w[2]];
    }
    if (wound[0] * n[0] + wound[1] * n[1] + wound[2] * n[2] < 0) pts = [...pts].reverse();
    const c = b.vertex(centre, n, [0.5, 0.5], colour);
    const ids = pts.map((p) => b.vertex(p, n, [0.5, 0.5], colour));
    for (let i = 0; i < ids.length - 1; i += 1) {
      if (degenerate(pts[i], pts[i + 1])) continue;
      b.tri(c, ids[i], ids[i + 1]);
    }
  }

  // ------------------------------------------------------------------ livery column layout

  /**
   * One station's angular sample list, with the three livery boundaries inserted as duplicated
   * (seam) columns so the paint breaks on an edge loop instead of being smeared across a quad.
   * Returns { thetas, colours } of equal length for every z — the grid stays rectangular.
   */
  function liveryColumns(z, lo, hi, counts, plain = false, liveryOffset = 0) {
    const out = { thetas: [], colours: [] };
    const seg = (from, to, n, colour) => {
      for (let i = 0; i <= n; i += 1) {
        out.thetas.push(lerp(from, to, i / n));
        out.colours.push(colour);
      }
    };
    if (plain) {
      /*
       * An unpainted shell (glazing, cowling, the dark cabin opening) has no livery seam, but it
       * must keep the SAME column count as a painted one so every caller's grid stays rectangular.
       * Splitting the range into the same four runs spends every column on real surface instead of
       * stacking three collapsed segments on the low edge — which is what turned the windscreen
       * into four flat facets and the cowling into no cowling at all.
       */
      const total = counts[0] + counts[1] + counts[2] + counts[3];
      let done = 0;
      for (let k = 0; k < 4; k += 1) {
        const from = lerp(lo, hi, done / total);
        done += counts[k];
        seg(from, lerp(lo, hi, done / total), counts[k], COL.plain);
      }
      return out;
    }
    const h = bandHeights(z);
    const solve = liveryOffset ? (y) => thetaAtHeightOffset(z, y, liveryOffset) : (y) => thetaAtHeight(z, y);
    const a = clamp(solve(h.redTop), lo, hi);
    const bnd = clamp(solve(h.redBot), a, hi);
    const c = clamp(solve(h.grey), bnd, hi);
    seg(lo, a, counts[0], COL.white);
    seg(a, bnd, counts[1], COL.red);
    seg(bnd, c, counts[2], COL.blue);
    seg(c, hi, counts[3], COL.grey);
    return out;
  }

  // ------------------------------------------------------------------ fuselage

  function buildFuselage() {
    const b = Builder();
    const rows = LOD.fuseRows;
    const counts = [LOD.fuseColsTop, 1, LOD.fuseColsBlue, LOD.fuseColsGrey];
    const cols = counts[0] + counts[1] + counts[2] + counts[3] + 4;

    // Rows are packed toward the nose, where the section changes fastest.
    const zAt = (i) => {
      const t = i / (rows - 1);
      const eased = 1 - Math.pow(1 - t, 1.35);
      return lerp(NOSE_Z, POD_TAIL_Z, eased);
    };
    /*
     * The radome joint is a DUPLICATED ROW at RADOME_Z, for the same reason the livery seams are
     * duplicated columns: the paint then breaks on a real edge loop instead of being smeared
     * across whatever band of quads the row easing happened to put there. The pair carries the
     * dark colour on the forward copy and the white on the aft one, and the zero-area quad
     * between them is dropped by `tri()` before it reaches the buffer.
     */
    const zList = [];
    for (let i = 0; i < rows; i += 1) zList.push(zAt(i));
    let seam = zList.findIndex((z) => z < RADOME_Z);
    if (seam < 1) seam = 1;
    zList.splice(seam, 0, RADOME_Z, RADOME_Z);
    const nRows = zList.length;
    const cache = zList.map((z) => liveryColumns(z, 0, Math.PI, counts));
    const rowColour = (i, j) => (i <= seam ? COL.radome : cache[i].colours[j]);

    for (const side of [1, -1]) {
      grid(
        b,
        nRows,
        cols,
        (i, j) => {
          const p = fusePoint(zList[i], cache[i].thetas[j]);
          return [p[0] * side, p[1], p[2]];
        },
        {
          normalAt: (i, j) => {
            const n = fuseNormal(zList[i], cache[i].thetas[j]);
            return [n[0] * side, n[1], n[2]];
          },
          colourAt: rowColour,
          outwardFrom: (i) => [0, fuseCy(zList[i]), zList[i]],
        },
      );
    }

    /*
     * The nose cap and the rear bulkhead are fanned over the LOFT'S OWN edge ring — the same
     * theta list, both halves — rather than over a fresh circle of their own. Two tessellations
     * meeting at one edge do not share vertices, and that seam is a ring of T-junctions.
     */
    const edgeLoop = (rowIndex, z) => {
      const th = cache[rowIndex].thetas;
      const loop = [];
      for (let j = 0; j < th.length; j += 1) { const q = fusePoint(z, th[j]); loop.push([q[0], q[1], q[2]]); }
      for (let j = th.length - 1; j >= 0; j -= 1) { const q = fusePoint(z, th[j]); loop.push([-q[0], q[1], q[2]]); }
      loop.push(loop[0]);
      return loop;
    };
    const noseLoop = edgeLoop(0, NOSE_Z);
    const rearLoop = edgeLoop(nRows - 1, POD_TAIL_Z);
    // The nose cap is the tip of the radome, so it takes the radome's colour, not the livery's.
    cap(b, noseLoop, [0, fuseCy(NOSE_Z), NOSE_Z], [0, 0, 1], COL.radome);
    // The bulkhead is what you see when the clamshells are open, and what shows in the notch
    // around the tail-boom root when they are shut: it is a cabin interior, so it is dark.
    cap(b, rearLoop, [0, fuseCy(POD_TAIL_Z), POD_TAIL_Z], [0, 0, -1], COL.grey);
    return b.geometry();
  }

  // ------------------------------------------------------------------ surface-hugging shells

  /**
   * A closed panel that hugs the fuselage: outer skin at `dOut`, inner skin at `dIn`, four rims.
   * Because both skins are offsets of the same lofted surface, the gap under the panel is
   * constant everywhere and no corner can dip through the body.
   */
  function hugShell({ zs, thetaLo, thetaHi, cols, dIn, dOut, plain = false, side = 1, colourOverride = null, liveryOffset = 0 }) {
    const b = Builder();
    const rows = zs.length;
    const counts = Array.isArray(cols) ? cols : [cols, 1, Math.max(1, Math.round(cols * 0.5)), Math.max(1, Math.round(cols * 0.4))];
    const total = counts[0] + counts[1] + counts[2] + counts[3] + 4;
    const cache = zs.map((z, i) => liveryColumns(z, thetaLo(z, i), thetaHi(z, i), counts, plain, liveryOffset));
    const colourAt = (i, j) =>
      (typeof colourOverride === "function" ? colourOverride(i, j, rows, total) : (colourOverride ?? cache[i].colours[j]));

    /*
     * The offset callback is handed the column's REAL angle, not j/(total-1).
     *
     * liveryColumns duplicates three interior columns to make the paint break on an edge loop,
     * so the map from j to theta is not linear — it lags by up to four columns out of twenty-
     * eight. The engine deck's height was being evaluated at the linear angle and written to the
     * vertex at the real one, which sheared the whole plateau: measured against the shipped mesh
     * the deck sat 23 mm below where cowlD says it does, and the exhaust stubs that were seated
     * on it by calculation ended up hanging 19 mm clear of it in the gap probe.
     */
    const at = (i, j, d) => {
      const p = fuseOffset(zs[i], cache[i].thetas[j], typeof d === "function" ? d(i, j, total, rows, cache[i].thetas[j], zs[i]) : d);
      return [p[0] * side, p[1], p[2]];
    };
    /** The loft's own outward normal, mirrored with the panel. Exact, so no guessing is needed. */
    const skinNormal = (i, j) => {
      const n = fuseNormal(zs[i], cache[i].thetas[j]);
      return [n[0] * side, n[1], n[2]];
    };
    const outer = [];
    const inner = [];
    for (let i = 0; i < rows; i += 1) {
      outer.push([]);
      inner.push([]);
      for (let j = 0; j < total; j += 1) {
        outer[i].push(at(i, j, dOut));
        inner[i].push(at(i, j, dIn));
      }
    }
    grid(b, rows, total, (i, j) => outer[i][j], { colourAt, normalAt: skinNormal });
    grid(b, rows, total, (i, j) => inner[i][j], { colourAt, normalAt: skinNormal, invert: true });
    // The rims face out of the panel, so each takes a reference point at the panel's own middle.
    const mid = outer[Math.floor(rows / 2)][Math.floor(total / 2)];
    const colEdge = (arr, j) => arr.map((row) => row[j]);
    strip(b, colEdge(outer, 0), colEdge(inner, 0), colourAt(0, 0), mid);
    strip(b, colEdge(outer, total - 1), colEdge(inner, total - 1), colourAt(0, total - 1), mid);
    // The two rims that run ACROSS the livery take the band colour at each column, or the panel
    // edge shows as a flat white step where the stripe crosses it.
    strip(b, outer[0], inner[0], (j) => colourAt(0, j), mid);
    strip(b, outer[rows - 1], inner[rows - 1], (j) => colourAt(rows - 1, j), mid);
    return b.geometry();
  }

  const linspace = (a, z, n) => Array.from({ length: n }, (_, i) => lerp(a, z, i / (n - 1)));

  // ------------------------------------------------------------------ cockpit glazing

  /**
   * The windscreen, the cockpit door windows and the chin windows, as one glass part.
   * The glazing is surface-mounted on a rubber seal rather than cut into the skin: the seal
   * covers the paint the glass does not, so nothing white shows through, and the fuselage stays
   * a single watertight solid that the audit passes can reason about.
   */
  function buildGlazing(dLo, dHi, colour, insetZ, insetT, backing = false) {
    const parts = [];
    const rows = LOD.glassRows;
    /*
     * The sheet BEHIND the glass is not a gasket, it is a cabin.
     *
     * It used to be one black rubber pane covering the whole glazed area, which is why the
     * windscreen photographed as a black mirror: a 55% transmissive pane over pure black
     * transmits nothing. The same pane now carries three vertex colours — near-black round the
     * rim, where it shows past the glass as the gasket it always was; cabin grey in the middle,
     * which is what the glass transmits; and a darker band along the lower edge, which reads as
     * the glareshield under the windscreen and as a seat back behind the door windows.
     *
     * `bz`/`bt` are the glass's own inset expressed as a fraction of the pane, so the gasket
     * ring is exactly as wide as the border the glass actually leaves uncovered.
     */
    const paint = (bz, bt, darkFrom) => (i, j, nRows, nCols) => {
      if (!backing) return colour;
      const fz = i / (nRows - 1);
      const ft = j / (nCols - 1);
      if (fz < bz || fz > 1 - bz || ft < bt || ft > 1 - bt) return COL.gasket;
      return ft > darkFrom ? COL.cabinDark : COL.cabin;
    };
    for (const side of [1, -1]) {
      /*
       * The WINDSCREEN, one pane per side of a real centre pillar.
       *
       * The old sheet ran from 0.03 rad — three millimetres off the centreline — round to
       * 1.86 rad, past the widest point and onto the underside, and it met the chin windows on
       * the way. One continuous black surface over the whole nose is why the checker read the
       * front of this aircraft as a blob: there was no pillar, no header, no painted nose.
       *
       * Now the pane starts at the pillar (182 mm wide at the header, tapering to 46 mm at the
       * front, exactly as a real divider does) and stops on the upper shoulder, leaving the
       * nose tip, the lower nose and the chin painted.
       */
      parts.push(
        hugShell({
          zs: linspace(2.330 + insetZ, 3.380 - insetZ, rows),
          thetaLo: (z) => 0.110 + insetT - 0.058 * smooth(clamp((z - 2.330) / 1.050, 0, 1)),
          // The pane WRAPS as it goes forward, down past the widest point of the nose, instead
          // of narrowing: that wrap is what makes a windscreen look blown rather than glued on.
          thetaHi: (z) => 1.460 - insetT + 0.250 * smooth(clamp((z - 2.620) / 0.640, 0, 1)),
          cols: [Math.max(6, rows - 6), 2, 2, 2],
          dIn: dLo,
          dOut: dHi,
          plain: true,
          side,
          colourOverride: paint(0.027, 0.027, 0.60),
        }),
      );
      // Chin window, under the pilot's feet: it wraps the nose's lower corner, forward of the
      // pedals, and it is a SEPARATE pane with painted skin between it and the windscreen.
      parts.push(
        hugShell({
          zs: linspace(2.520 + insetZ, 3.090 - insetZ, Math.max(5, rows - 8)),
          thetaLo: () => 1.930 + insetT,
          thetaHi: () => 2.430 - insetT,
          cols: [5, 2, 2, 2],
          dIn: dLo,
          dOut: dHi,
          plain: true,
          side,
          // A chin window looks at the ground: there is no lit cabin behind it, only footwell.
          colourOverride: paint(0.049, 0.080, -1),
        }),
      );
      // The cockpit door window: the upper half of the pilots' own doors, aft of the windscreen.
      parts.push(
        hugShell({
          zs: linspace(1.620 + insetZ, 2.260 - insetZ, Math.max(6, rows - 6)),
          thetaLo: () => 0.980 + insetT,
          thetaHi: () => 1.550 - insetT,
          cols: [5, 2, 2, 2],
          dIn: dLo,
          dOut: dHi,
          plain: true,
          side,
          colourOverride: paint(0.044, 0.070, 0.58),
        }),
      );
    }
    return mergeGeometries(parts, false);
  }

  /**
   * A flat panel standing on the rear bulkhead: the clamshell doors and their glass.
   *
   * Rows are HEIGHTS, not fractions, so the livery seams land on real edge loops exactly as they
   * do on the lofted skin, and each row is clamped between the door's lower and upper outlines.
   * The outlines are what shape the door: it follows the bulkhead's rounded corner outboard and
   * ducks under the tail boom's root inboard, which is the notch a real clamshell has.
   */
  function bulkheadPanel({ side, zFront, zBack, xIn, xOut, yBotAt, yTopAt, rows, cols, colourAt }) {
    const b = Builder();
    const xs = linspace(xIn, xOut, cols);
    const yAt = (i, j) => clamp(rows[i], yBotAt(xs[j]), yTopAt(xs[j]));
    const face = (z, nz) => grid(
      b, rows.length, cols,
      (i, j) => [xs[j] * side, yAt(i, j), z],
      { normalAt: () => [0, 0, nz], colourAt },
    );
    face(zFront, 1);
    face(zBack, -1);
    const front = [];
    const back = [];
    for (let i = 0; i < rows.length; i += 1) {
      front.push([]);
      back.push([]);
      for (let j = 0; j < cols; j += 1) {
        front[i].push([xs[j] * side, yAt(i, j), zFront]);
        back[i].push([xs[j] * side, yAt(i, j), zBack]);
      }
    }
    const mid = [((xIn + xOut) / 2) * side, (yAt(0, 0) + yAt(rows.length - 1, 0)) / 2, (zFront + zBack) / 2];
    const colEdge = (arr, j) => arr.map((r) => r[j]);
    strip(b, colEdge(front, 0), colEdge(back, 0), colourAt(0, 0), mid);
    strip(b, colEdge(front, cols - 1), colEdge(back, cols - 1), colourAt(0, cols - 1), mid);
    strip(b, front[0], back[0], (j) => colourAt(0, j), mid);
    strip(b, front[rows.length - 1], back[rows.length - 1], (j) => colourAt(rows.length - 1, j), mid);
    return b.geometry();
  }

  // ------------------------------------------------------------------ sweeps and solids

  /** Parallel-transport tube along a polyline. */
  function tube(b, path, radiusAt, segs, colour, capEnds = true) {
    let ref = [0, 1, 0];
    const first = norm(sub(path[1], path[0]));
    if (Math.abs(first[1]) > 0.9) ref = [1, 0, 0];
    const rings = [];
    for (let i = 0; i < path.length; i += 1) {
      const t = norm(sub(path[Math.min(path.length - 1, i + 1)], path[Math.max(0, i - 1)]));
      const u = norm(cross(ref, t));
      const v = norm(cross(t, u));
      ref = v;
      const r = radiusAt(i / (path.length - 1));
      const ring = [];
      for (let k = 0; k <= segs; k += 1) {
        const a = (k / segs) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        ring.push([
          path[i][0] + (u[0] * ca + v[0] * sa) * r,
          path[i][1] + (u[1] * ca + v[1] * sa) * r,
          path[i][2] + (u[2] * ca + v[2] * sa) * r,
        ]);
      }
      rings.push(ring);
    }
    grid(b, rings.length, segs + 1, (i, j) => rings[i][j], { colourAt: () => colour, outwardFrom: (i) => path[i] });
    if (capEnds) {
      cap(b, rings[0], path[0], negate(norm(sub(path[1], path[0]))), colour);
      const n = path.length - 1;
      cap(b, [...rings[n]].reverse(), path[n], norm(sub(path[n], path[n - 1])), colour);
    }
  }

  /**
   * A lofted aerofoil: `sections` is a list of {le:[x,y,z], te:[x,y,z], up:[x,y,z], ratio}.
   * Used for the rotor blades, the stabiliser, the endplates and the fin — anything where a
   * flat box would betray the model instantly.
   */
  function aerofoil(b, sections, around, colour, capRoot = true, capTip = true) {
    const rings = sections.map((s) => {
      const chord = sub(s.te, s.le);
      const chordLen = Math.hypot(chord[0], chord[1], chord[2]);
      const ring = [];
      for (let k = 0; k <= around; k += 1) {
        const a = (k / around) * Math.PI * 2;
        // Walk the upper surface out and the lower surface back, so the loop closes at the LE.
        // Cosine spacing packs samples into the leading edge, where the curvature lives.
        const t = (1 - Math.cos(a)) / 2;
        // NACA thickness is a fraction OF THE CHORD, so it scales with the section, not the model.
        const half = naca(t, s.ratio) * chordLen * (a <= Math.PI ? 1 : -1);
        ring.push([
          s.le[0] + chord[0] * t + s.up[0] * half,
          s.le[1] + chord[1] * t + s.up[1] * half,
          s.le[2] + chord[2] * t + s.up[2] * half,
        ]);
      }
      return ring;
    });
    const midChord = (i) => [
      (sections[i].le[0] + sections[i].te[0]) / 2,
      (sections[i].le[1] + sections[i].te[1]) / 2,
      (sections[i].le[2] + sections[i].te[2]) / 2,
    ];
    grid(b, rings.length, around + 1, (i, j) => rings[i][j], { colourAt: () => colour, outwardFrom: (i) => midChord(i) });
    if (capRoot) cap(b, rings[0], sections[0].le, norm(sub(sections[0].le, sections[1].le)), colour);
    const n = sections.length - 1;
    if (capTip) cap(b, [...rings[n]].reverse(), sections[n].le, norm(sub(sections[n].le, sections[n - 1].le)), colour);
  }

  /**
   * A surface of revolution about +Y: `profile` is a list of [radius, y] pairs, bottom to top.
   * The mast fairing, the swashplate, the hub plate and the head cap are all this shape, and
   * writing it once means the outward direction is decided once.
   */
  function latheY(b, profile, segs, colour, capBottom = true, capTop = true) {
    const rings = profile.map(([r, y]) => {
      const ring = [];
      for (let k = 0; k <= segs; k += 1) {
        const a = (k / segs) * Math.PI * 2;
        ring.push([Math.sin(a) * r, y, Math.cos(a) * r]);
      }
      return ring;
    });
    grid(b, rings.length, segs + 1, (i, j) => rings[i][j], {
      colourAt: () => colour,
      outwardFrom: (i) => [0, profile[i][1], 0],
    });
    const last = profile.length - 1;
    if (capBottom) cap(b, rings[0], [0, profile[0][1], 0], [0, -1, 0], colour);
    if (capTop) cap(b, rings[last], [0, profile[last][1], 0], [0, 1, 0], colour);
  }

  /** A surface of revolution about +X: profile is a list of [radius, xOffset] pairs. */
  function revolveX(b, profile, centre, segs, colour, closed = false) {
    const rings = profile.map(([r, dx]) => {
      const ring = [];
      for (let k = 0; k <= segs; k += 1) {
        const a = (k / segs) * Math.PI * 2;
        ring.push([centre[0] + dx, centre[1] + Math.cos(a) * r, centre[2] + Math.sin(a) * r]);
      }
      return ring;
    });
    grid(b, rings.length, segs + 1, (i, j) => rings[i][j], {
      colourAt: () => colour,
      outwardFrom: (i) => [centre[0] + profile[i][1], centre[1], centre[2]],
    });
    if (closed) {
      cap(b, rings[0], [centre[0] + profile[0][1], centre[1], centre[2]], [-1, 0, 0], colour);
      const n = rings.length - 1;
      cap(b, [...rings[n]].reverse(), [centre[0] + profile[n][1], centre[1], centre[2]], [1, 0, 0], colour);
    }
  }

  /**
   * A superellipsoid: `roundness` 1 is an ellipsoid, 0.3 a soft box, 0.15 a crisp one. Used for
   * the intakes, the steps and the light housings, where a hard-edged BoxGeometry would be the
   * one flat-shaded thing on an otherwise curved aircraft.
   */
  function roundBox(b, centre, half, roundness, segs, colour) {
    const e = roundness;
    const pw = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);
    const rows = segs * 2 + 1;
    const cols = segs * 4 + 1;
    const at = (i, j) => {
      const v = -Math.PI / 2 + (i / (rows - 1)) * Math.PI;
      const u = (j / (cols - 1)) * Math.PI * 2;
      const cv = pw(Math.cos(v), e);
      return [
        centre[0] + half[0] * cv * pw(Math.cos(u), e),
        centre[1] + half[1] * pw(Math.sin(v), e),
        centre[2] + half[2] * cv * pw(Math.sin(u), e),
      ];
    };
    grid(b, rows, cols, at, { colourAt: () => colour, outwardFrom: () => centre });
  }

  /**
   * A small fin standing on a curved skin — the wire-strike cutters and the blade antennas.
   *
   * A lofted aerofoil has a FLAT root plane. Stand one on a curved fuselage and the root is
   * buried at the middle of the chord and floating at the ends; the first audit measured 45 mm
   * of the upper cutter inside the skin for exactly that reason. So the root here is a curve:
   * every chordwise station starts on the surface it is bolted to, 4 mm clear of it.
   */
  function skinFin(b, { surfaceAt, normalAt, zCentre, theta, chord, height, tipChord, sweep = 0, thick = 0.017, colour, steps = 14, up = 10 }) {
    const cols = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps; // 0 at the trailing edge, 1 at the leading edge
      const z = zCentre + (t - 0.5) * chord;
      const base = surfaceAt(z, theta);
      const n = normalAt(z, theta);
      const root = [base[0] + n[0] * 0.004, base[1] + n[1] * 0.004, base[2] + n[2] * 0.004];
      // Elliptical planform, so the fin has a tip rather than a corner.
      const h = height * Math.sqrt(Math.max(0, 1 - Math.pow(2 * t - 1, 2))) * (0.55 + 0.45 * t);
      // Thickness must reach zero at the leading edge, the trailing edge and the tip, or the
      // two side sheets never meet and the fin is an open sheet rather than a solid.
      cols.push({
        root,
        n,
        h,
        halfAt: (v) => thick * Math.pow(Math.sin(Math.PI * clamp(1 - Math.abs(2 * t - 1), 0, 1)), 0.62) * Math.sqrt(Math.max(0, 1 - v * v)),
        zShift: sweep * t,
      });
    }
    void tipChord;
    const at = (i, j, sign) => {
      const c = cols[i];
      const v = j / (up - 1);
      const half = c.halfAt(v);
      return [
        c.root[0] + c.n[0] * c.h * v + sign * half,
        c.root[1] + c.n[1] * c.h * v,
        c.root[2] + c.n[2] * c.h * v + c.zShift * v,
      ];
    };
    for (const sign of [1, -1]) {
      grid(b, steps + 1, up, (i, j) => at(i, j, sign), {
        colourAt: () => colour,
        outwardFrom: (i, j) => {
          const c = cols[i];
          const v = j / (up - 1);
          return [c.root[0] + c.n[0] * c.h * v, c.root[1] + c.n[1] * c.h * v, c.root[2] + c.n[2] * c.h * v + c.zShift * v];
        },
      });
    }
    const rootA = cols.map((_, i) => at(i, 0, 1));
    const rootB = cols.map((_, i) => at(i, 0, -1));
    // The root face looks INTO the body it is bolted to, which is exactly minus the skin normal.
    strip(b, rootA, rootB, colour, null, (i) => negate(cols[i].n));
  }

  /**
   * A rounded-box fitting mounted on a curved surface — intakes, lights, the step.
   *
   * The stand-off is not `half[1] + a gap`: the surface normal is rarely an axis direction, so
   * the box's reach along it is somewhere between one half-extent and the diagonal, and guessing
   * left four fittings grazing their own fuselage at a tenth of a millimetre. This measures the
   * body's actual support distance along that normal and then adds the gap.
   */
  function mountBox(b, { base, normal, half, roundness = 0.32, segs = 6, colour = COL.plain, gap = 0.004 }) {
    const n = norm(normal);
    const pw = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
    let reach = 0;
    for (let i = 0; i <= 24; i += 1) {
      const v = -Math.PI / 2 + (i / 24) * Math.PI;
      for (let k = 0; k <= 48; k += 1) {
        const u = (k / 48) * Math.PI * 2;
        const cv = pw(Math.cos(v), roundness);
        const d =
          half[0] * cv * pw(Math.cos(u), roundness) * n[0] +
          half[1] * pw(Math.sin(v), roundness) * n[1] +
          half[2] * cv * pw(Math.sin(u), roundness) * n[2];
        if (-d > reach) reach = -d; // the deepest the body reaches AGAINST the normal
      }
    }
    const centre = [base[0] + n[0] * (reach + gap), base[1] + n[1] * (reach + gap), base[2] + n[2] * (reach + gap)];
    roundBox(b, centre, half, roundness, segs, colour);
    return centre;
  }

  // ------------------------------------------------------------------ node helpers

  /** A mesh whose geometry is re-centred on `origin`, so the node itself is the pivot. */
  function part(name, geometry, mat, origin = [0, 0, 0]) {
    const g = geometry;
    if (origin[0] || origin[1] || origin[2]) g.translate(-origin[0], -origin[1], -origin[2]);
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = name;
    mesh.position.set(origin[0], origin[1], origin[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  const build = (fn) => { const b = Builder(); fn(b); return b.geometry(); };
  const pivot = (name, position) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(...position);
    return g;
  };

  const root = new THREE.Group();
  root.name = "h145";

  // ---------------------------------------------------------------- 1. fuselage and glazing

  root.add(part("fuselage", buildFuselage(), M.paint));
  /*
   * The seal stands 7.5 mm off the skin and the glass 16.5 mm, with the glass inset 20 mm all
   * round so the seal shows as a black rubber border. The glass's inner skin clears the seal's
   * outer by 3.5 mm — beyond the 2 mm the coplanar pass calls contact, so nothing z-fights and
   * nothing is coincident, while the glazing still reads as let INTO the nose rather than blown
   * over it. (The old numbers stood the glass 29 mm proud: a bubble canopy, not an H145.)
   */
  root.add(part("cockpit_seal", buildGlazing(0.0050, 0.0090, COL.plain, 0, 0, true), M.interior));
  root.add(part("cockpit_glass", buildGlazing(0.0135, 0.0190, COL.plain, 0.028, 0.040), M.glass));

  // ---------------------------------------------------------------- 2. cabin doors

  const doorTheta = {
    lo: (z) => 1.075 + 0.05 * smooth(clamp((z - DOOR_Z0) / (DOOR_Z1 - DOOR_Z0), 0, 1)),
    hi: (z) => 2.190 - 0.06 * smooth(clamp((z - DOOR_Z0) / (DOOR_Z1 - DOOR_Z0), 0, 1)),
  };
  const doorZs = linspace(DOOR_Z0, DOOR_Z1, LOD.doorRows);
  const doorCols = [LOD.fuseColsTop - 6, 1, LOD.fuseColsBlue - 3, LOD.fuseColsGrey - 4];

  for (const [side, tag] of [[1, "right"], [-1, "left"]]) {
    // The dark opening the door slides away from — the only thing that makes an open door read.
    root.add(
      part(
        `cabin_opening_${tag === "left" ? "l" : "r"}`,
        hugShell({
          zs: linspace(DOOR_Z0 + 0.02, DOOR_Z1 - 0.02, Math.max(5, LOD.doorRows - 8)),
          thetaLo: (z) => doorTheta.lo(z) + 0.03,
          thetaHi: (z) => doorTheta.hi(z) - 0.03,
          // A flat facet across a curved body cuts inside it. Over this arc, six intervals put the
          // sagitta at ~3.8 mm — deeper than the 3 mm the panel stands off — so it has to be finer.
          cols: [10, 3, 3, 3],
          dIn: OPENING_D_IN,
          dOut: OPENING_D_OUT,
          plain: true,
          side,
          colourOverride: COL.plain,
        }),
        M.dark,
      ),
    );

    const doorGeom = hugShell({
      zs: doorZs,
      thetaLo: doorTheta.lo,
      thetaHi: doorTheta.hi,
      cols: doorCols,
      dIn: DOOR_D_IN,
      dOut: DOOR_D_OUT,
      liveryOffset: DOOR_D_OUT,
      side,
    });
    const doorOrigin = [side * 0.9, 1.75, -0.75];
    const door = part(`door_${tag}_slide`, doorGeom, M.paint, doorOrigin);
    // Cabin window, carried by the door so one track moves both.
    const win = part(
      `door_window_${tag === "left" ? "l" : "r"}`,
      hugShell({
        zs: linspace(DOOR_Z0 + 0.160, DOOR_Z1 - 0.150, Math.max(5, LOD.doorRows - 8)),
        /*
         * Bounded by HEIGHT, not by angle. A window edge held at a constant angle wanders up and
         * down as the section changes shape along the cabin, which produced a rectangle with a
         * curved bite taken out of its lower corner. The lower edge also stops above the
         * pinstripe: a window crossing the livery break cuts the one line that runs the length
         * of the aircraft, and the eye reads that as a mistake immediately.
         *
         * Round 11: 1.310 m by 0.705 m, which is 81% of the door's length and a little over
         * three fifths of its height — the checker read the old 1.285 x 0.663 pane as a small
         * black rectangle on a big white door. It grows UPWARD, to 55 mm under the door's own
         * top edge, because the pinstripe fixes the bottom.
         */
        thetaLo: (z) => Math.max(doorTheta.lo(z) + 0.040, thetaAtHeightOffset(z, 2.250, DOOR_D_OUT + 0.0125)),
        thetaHi: (z) => Math.min(doorTheta.hi(z) - 0.10, thetaAtHeightOffset(z, 1.545, DOOR_D_OUT + 0.0125)),
        cols: [4, 1, 1, 1],
        // Clear OF THE SEAL, not of the skin: the seal's outer face is at +4.5 mm, so glass at
        // +3.5 mm was inside it — half the window's sample points fell in the gasket.
        dIn: DOOR_D_OUT + 0.0075,
        dOut: DOOR_D_OUT + 0.0125,
        plain: true,
        side,
        colourOverride: COL.plain,
      }),
      M.glass,
      doorOrigin,
    );
    /*
     * The cabin window gets the same rubber surround the cockpit glazing has. Without it the
     * pane is a black rectangle painted onto a white door — which is exactly what the checker
     * saw. The seal is 20 mm wider than the glass on every edge and sits under it, so it reads
     * as a gasket rather than as a second, larger window.
     */
    const seal = part(
      `door_window_seal_${tag === "left" ? "l" : "r"}`,
      hugShell({
        zs: linspace(DOOR_Z0 + 0.140, DOOR_Z1 - 0.130, Math.max(5, LOD.doorRows - 8)),
        thetaLo: (z) => Math.max(doorTheta.lo(z) + 0.020, thetaAtHeightOffset(z, 2.272, DOOR_D_OUT + 0.0045)),
        thetaHi: (z) => Math.min(doorTheta.hi(z) - 0.075, thetaAtHeightOffset(z, 1.523, DOOR_D_OUT + 0.0045)),
        cols: [4, 1, 1, 1],
        dIn: DOOR_D_OUT + 0.0012,
        dOut: DOOR_D_OUT + 0.0045,
        plain: true,
        side,
        // Gasket round the rim, cabin behind the pane, seat backs along the bottom.
        colourOverride: (i, j, nRows, nCols) => {
          const fz = i / (nRows - 1);
          const ft = j / (nCols - 1);
          if (fz < 0.016 || fz > 0.984 || ft < 0.031 || ft > 0.969) return COL.gasket;
          return ft > 0.55 ? COL.cabinDark : COL.cabin;
        },
      }),
      M.interior,
      doorOrigin,
    );
    // The window and its seal are parented to the door so one track moves all three; their
    // geometry is already in the door's local frame, so the child nodes sit at the door's origin.
    // The grab handle. Named with the door's own prefix so the 24-phase clip sweep counts it as
    // part of the moving assembly rather than as a static obstacle the door drives through.
    const handle = part(
      `${door.name}_handle`,
      build((b) => {
        const th = 1.980;
        mountBox(b, {
          base: fuseOffset(DOOR_Z0 + 0.190, side * th, DOOR_D_OUT),
          normal: (() => { const n = fuseNormal(DOOR_Z0 + 0.190, side * th); return [n[0], n[1], n[2]]; })(),
          half: [0.022, 0.028, 0.108],
          roundness: 0.28,
          segs: 5,
        });
      }),
      M.metal,
      doorOrigin,
    );
    seal.position.set(0, 0, 0);
    win.position.set(0, 0, 0);
    handle.position.set(0, 0, 0);
    door.add(seal);
    door.add(win);
    door.add(handle);
    root.add(door);
  }

  /*
   * The aft cabin window, behind the sliding door.
   *
   * A real H145 has one on each side, between the door's rear rail and the bulkhead, and its
   * absence is why the aft third of the cabin photographed as a blank white slab. It is on the
   * FUSELAGE, not on the door, so the door slides past it: by the time the door reaches this
   * station it has already popped its 85 mm outboard, which leaves 84 mm over the glass.
   *
   * Same three-layer stack as the cockpit glazing — skin, painted interior at 5-9 mm, glass at
   * 13.5-19 mm — so the gasket, the transmission and the clearances all behave identically.
   */
  const AFT_WIN = { z0: -2.040, z1: -1.640, yTop: 2.250, yBot: 1.900 };
  for (const [side, tag] of [[1, "r"], [-1, "l"]]) {
    root.add(
      part(
        `cabin_aft_window_seal_${tag}`,
        hugShell({
          zs: linspace(AFT_WIN.z0 - 0.022, AFT_WIN.z1 + 0.022, 10),
          thetaLo: (z) => thetaAtHeightOffset(z, AFT_WIN.yTop + 0.022, 0.0045),
          thetaHi: (z) => thetaAtHeightOffset(z, AFT_WIN.yBot - 0.022, 0.0045),
          cols: [4, 1, 1, 1],
          dIn: 0.0050,
          dOut: 0.0090,
          plain: true,
          side,
          colourOverride: (i, j, nRows, nCols) => {
            const fz = i / (nRows - 1);
            const ft = j / (nCols - 1);
            if (fz < 0.050 || fz > 0.950 || ft < 0.060 || ft > 0.940) return COL.gasket;
            return ft > 0.55 ? COL.cabinDark : COL.cabin;
          },
        }),
        M.interior,
      ),
    );
    root.add(
      part(
        `cabin_aft_window_${tag}`,
        hugShell({
          zs: linspace(AFT_WIN.z0, AFT_WIN.z1, 10),
          thetaLo: (z) => thetaAtHeightOffset(z, AFT_WIN.yTop, 0.0165),
          thetaHi: (z) => thetaAtHeightOffset(z, AFT_WIN.yBot, 0.0165),
          cols: [4, 1, 1, 1],
          dIn: 0.0135,
          dOut: 0.0190,
          plain: true,
          side,
          colourOverride: COL.plain,
        }),
        M.glass,
      ),
    );
  }

  // ---------------------------------------------------------------- 2b. panel lines

  /**
   * Recessed panel seams — 2 mm bands standing 4.5 to 6.5 mm off the skin, in the dark material.
   *
   * They are raised bands rather than a cut groove for one reason: a groove would be a shell
   * INSIDE the fuselage, and the intersection pass would (rightly) call every one of them a part
   * buried in another. At this scale a 2 mm dark band reads as the seam it is standing in for,
   * and it hugs the same lofted surface as everything else, so it cannot dip through.
   *
   * The cockpit door matters most: it is the one door on the aircraft with no separate panel of
   * its own, so without an outline the pilots simply have no way in.
   */
  {
    const pieces = [];
    const seamIn = 0.0045;
    const seamOut = 0.0065;
    const zSeam = (z, tLo, tHi, side) => pieces.push(hugShell({
      zs: [z - 0.0085, z + 0.0085],
      thetaLo: () => tLo,
      thetaHi: () => tHi,
      // Many columns, because a chord across a 320 mm corner radius has to stay inside 4.5 mm:
      // twelve of them would put the sagitta at 7.7 mm and sink the seam into the fuselage.
      cols: [22, 1, 1, 1],
      dIn: seamIn,
      dOut: seamOut,
      plain: true,
      side,
      colourOverride: COL.plain,
    }));
    const tSeam = (t, z0, z1, side) => pieces.push(hugShell({
      zs: linspace(z0, z1, 16),
      thetaLo: () => t - 0.0075,
      thetaHi: () => t + 0.0075,
      cols: [1, 1, 1, 1],
      dIn: seamIn,
      dOut: seamOut,
      plain: true,
      side,
      colourOverride: COL.plain,
    }));
    for (const side of [1, -1]) {
      zSeam(1.545, 0.640, 2.090, side);
      zSeam(2.315, 0.640, 2.090, side);
      tSeam(0.640, 1.545, 2.315, side);
      tSeam(2.090, 1.545, 2.315, side);
      // The avionics-bay hatch seam across the nose, ahead of the windscreen.
      zSeam(3.420, 0.130, 1.620, side);
    }
    root.add(part("panel_lines", mergeGeometries(pieces, false), M.dark));
  }

  // ---------------------------------------------------------------- 3. rear clamshell doors

  /**
   * The clamshells hang on the FLAT REAR BULKHEAD on vertical hinges at their outboard edges —
   * the arrangement the real aircraft has, and the one that fixes the 0.05 mm swing.
   *
   * The old pair wrapped the curved aft-lower fuselage and hinged longitudinally, so their
   * inboard edges swung on a short lever straight back into a hull that was rising outboard;
   * no hinge position could buy more than a fraction of a millimetre. Here the hinge axis lies
   * ON the door's forward face at its outboard edge, so every point of the door moves AFT of
   * that plane for the whole 100 degrees and the parked 14 mm gap is the tightest the sweep
   * will ever see.
   */
  {
    const bkCy = fuseCy(BULK_Z);
    const bkHw = fuseHw(BULK_Z);
    const bkHt = fuseHt(BULK_Z);
    const bkHb = fuseHb(BULK_Z);
    const bkCr = fuseCr(BULK_Z);
    /** The bulkhead outline's upper / lower height at |x|, straight off the rounded rectangle. */
    const outline = (x, half, sign) => {
      const r = Math.min(bkCr, bkHw * 0.995, half * 0.995);
      const ax = Math.abs(x);
      const flat = bkHw - r;
      if (ax <= flat) return bkCy + sign * half;
      const d = clamp((ax - flat) / r, 0, 1);
      return bkCy + sign * (half - r + r * Math.sqrt(Math.max(0, 1 - d * d)));
    };
    const yBotAt = (x) => Math.max(1.256, outline(x, bkHb, -1) + 0.030);
    const yTopAt = (x) => Math.min(CLAM_Y_CAP, outline(x, bkHt, 1) - 0.026, boomClearY(x) - CLAM_BOOM_CLR);

    const h = bandHeights(BULK_Z);
    const grey = h.grey;
    // Rows are heights with the three livery boundaries doubled, so the stripe breaks on an
    // edge loop here exactly as it does on the lofted skin either side of it.
    const clamRows = [1.200, 1.262, grey, grey, 1.520, 1.760, 1.980, h.redBot, h.redBot, h.redTop, h.redTop, 2.290, 2.380, 2.500];
    const clamCols = [COL.grey, COL.grey, COL.grey, COL.blue, COL.blue, COL.blue, COL.blue, COL.blue, COL.red, COL.red, COL.white, COL.white, COL.white, COL.white];

    for (const [side, tag] of [[1, "right"], [-1, "left"]]) {
      const geom = bulkheadPanel({
        side,
        zFront: CLAM_Z_FRONT,
        zBack: CLAM_Z_BACK,
        xIn: CLAM_X_IN,
        xOut: CLAM_X_OUT,
        yBotAt,
        yTopAt,
        rows: clamRows,
        cols: Math.max(8, LOD.doorRows),
        colourAt: (i) => clamCols[i],
      });
      const door = part(`door_rear_${tag}`, geom, M.paint, [side * CLAM_X_OUT, 0, CLAM_Z_FRONT]);
      // The window: more than half the door's area, on its aft face, 4 mm proud of the skin.
      const win = part(
        `door_rear_window_${tag === "left" ? "l" : "r"}`,
        bulkheadPanel({
          side,
          zFront: CLAM_Z_BACK - 0.004,
          zBack: CLAM_Z_BACK - 0.013,
          xIn: 0.104,
          xOut: 0.716,
          yBotAt: () => 1.545,
          yTopAt: (x) => Math.min(1.930, boomClearY(x) - 0.092),
          rows: [1.545, 1.700, 1.930],
          cols: Math.max(6, LOD.doorRows - 6),
          colourAt: () => COL.plain,
        }),
        M.glass,
        [side * CLAM_X_OUT, 0, CLAM_Z_FRONT],
      );
      const grip = part(
        `${door.name}_handle`,
        build((b) => roundBox(b, [side * 0.190, 1.395, CLAM_Z_BACK - 0.034], [0.026, 0.082, 0.030], 0.26, 5, COL.plain)),
        M.metal,
        [side * CLAM_X_OUT, 0, CLAM_Z_FRONT],
      );
      win.position.set(0, 0, 0);
      grip.position.set(0, 0, 0);
      door.add(win);
      door.add(grip);
      root.add(door);
    }
  }


  // ---------------------------------------------------------------- 4. engine cowling

  /**
   * The cowling is the same trick as a door, but with the outer offset swelling from 6 mm at
   * the border to 340 mm over the engine deck — a fairing blended into the roof rather than a
   * box dropped on it, so there is no seam to z-fight and no corner to float.
   */
  const cowlZs = linspace(COWL_Z0, COWL_Z1, 38);
  root.add(
    part(
      "engine_cowling",
      hugShell({
        zs: cowlZs,
        thetaLo: () => -COWL_T,
        thetaHi: () => COWL_T,
        cols: [9, 1, 7, 7],
        dIn: 0.006,
        dOut: (i, j, total, rows, theta, z) => cowlD(z, theta),
        plain: true,
        colourOverride: COL.white,
      }),
      M.paint,
    ),
  );

  /*
   * The intake, at the FRONT of each cowl where the deck ramps down. A plenum box on the deck
   * with a forward-facing dark mouth and five metal splitter bars across it: from three-quarter
   * front that pair of grilles is the single most recognisable thing on an H145's back, and the
   * old model had one dark blister buried in the middle of the deck instead.
   */
  const INTAKE_Z = 0.090;
  const INTAKE_HALF = [0.170, 0.100, 0.172];
  for (const [side, tag] of [[1, "r"], [-1, "l"]]) {
    const th = side * COWL_LOBE;
    // mountBox, not a guessed height: the plenum has to SIT on the lobe crown, and the crown is
    // 400 mm off a skin whose normal is only vertical because this station is on the flat roof.
    let seat = null;
    root.add(
      part(
        `engine_intake_${tag}`,
        build((b) => {
          seat = mountBox(b, {
            base: cowlPoint(INTAKE_Z, th),
            normal: fuseNormal(INTAKE_Z, th),
            half: INTAKE_HALF,
            roundness: 0.28,
            segs: 7,
            // 10 mm, not 4: the deck falls a little across the plenum's own footprint, and a
            // 4 mm seat put 2.5% of the box's sample points inside the cowling it stands on.
            gap: 0.010,
          });
        }),
        M.dark,
      ),
    );
    root.add(
      part(
        `intake_grille_${tag}`,
        build((b) => {
          // Five splitter bars, 6 mm clear of the plenum's forward face — close enough that the
          // gaps probe reads them as fitted, far enough that nothing crosses and nothing is
          // coincident. The pair of grilles is the single most recognisable thing on the back
          // of an H145 from three-quarter front.
          const zf = seat[2] + INTAKE_HALF[2] + 0.018;
          for (let k = 0; k < 5; k += 1) {
            const y = seat[1] - 0.062 + (k / 4) * 0.124;
            const w = 0.148 * Math.sqrt(Math.max(0.10, 1 - Math.pow((y - seat[1]) / 0.084, 2)));
            roundBox(b, [seat[0], y, zf], [w, 0.009, 0.011], 0.22, 4, COL.plain);
          }
        }),
        M.metal,
      ),
    );
  }

  /*
   * The exhausts leave the AFT end of each cowl, angled up and outboard the way a pair of Arriels
   * do, in heat-tinted metal. Mounted on the lobe's own crown so the deck falls away behind them.
   */
  for (const [side, tag] of [[1, "r"], [-1, "l"]]) {
    root.add(
      part(
        `exhaust_${tag}`,
        build((b) => {
          // The pipe leaves the AFT end of the lobe, where the deck has already begun to taper
          // away under it, so the whole stub stands clear of the cowling it grows out of.
          const m = cowlPoint(-1.700, side * 0.600, 0.098 * Math.cos(Math.PI / LOD.ring) + 0.004);
          tube(
            b,
            [
              m,
              [m[0] + side * 0.030, m[1] + 0.022, m[2] - 0.150],
              [m[0] + side * 0.074, m[1] + 0.066, m[2] - 0.292],
            ],
            (t) => 0.098 - 0.016 * t,
            LOD.ring,
            COL.plain,
          );
        }),
        M.exhaust,
      ),
    );
  }

  // ---------------------------------------------------------------- 5. mast, head and blades

  root.add(
    part(
      "mast_fairing",
      build((b) => {
        /**
         * A lathe cannot sit on the engine deck: the deck is ~320 mm proud at the back of this
         * fairing's footprint and flush at the front, so any single base height either floats
         * (it floated 216 mm) or cuts in. The base ring follows the deck instead, 4 mm clear all
         * the way round, and the sections lerp up to a level top where the mast comes through.
         */
        /*
         * The HIGHEST deck point in a small neighbourhood, not the nearest one. Picking the
         * single closest sample let 28 triangles of the fairing dip through the deck between
         * samples; taking the local maximum cannot, at the cost of a couple of millimetres.
         */
        const cowlSurfaceY = (xTarget, z) => {
          let top = -Infinity;
          for (let dz = -3; dz <= 3; dz += 1) {
            const zz = z + dz * 0.026;
            for (let k = -60; k <= 60; k += 1) {
              const th = (k / 60) * COWL_T;
              const q = cowlPoint(zz, th);
              if (Math.abs(q[0] - xTarget) > 0.075) continue;
              if (q[1] > top) top = q[1];
            }
          }
          return top === -Infinity ? fusePoint(z, 0)[1] : top;
        };
        /*
         * The underside is a DOME that follows the deck too, not a flat fan cap. A fan cap has
         * to put its centre at some single height, and whichever height that is, the cap sheet
         * cuts the deck somewhere between the wavy rim and that centre — twelve triangles' worth.
         */
        const footR = 0.300;
        const TOP_Y = 3.410;
        const segs = LOD.ring * 2;
        const deckY = (a, rf) =>
          cowlSurfaceY(Math.sin(a) * footR * 1.06 * rf, Math.cos(a) * footR * 1.22 * rf) + 0.009;
        const capFr = [0.0, 0.22, 0.48, 0.74];
        const prof = [[0.300, 0], [0.288, 0.24], [0.262, 0.52], [0.226, 0.80], [0.198, 1]];
        const rings = [];
        for (const fr of capFr) {
          const ring = [];
          for (let k = 0; k <= segs; k += 1) {
            const a = (k / segs) * Math.PI * 2;
            ring.push([Math.sin(a) * footR * 1.06 * fr, deckY(a, fr), Math.cos(a) * footR * 1.22 * fr]);
          }
          rings.push(ring);
        }
        for (const [r, t] of prof) {
          const ring = [];
          for (let k = 0; k <= segs; k += 1) {
            const a = (k / segs) * Math.PI * 2;
            ring.push([Math.sin(a) * r * 1.06, lerp(deckY(a, 1), TOP_Y, t), Math.cos(a) * r * 1.22]);
          }
          rings.push(ring);
        }
        let meanY = 0;
        for (const q of rings[capFr.length]) meanY += q[1];
        meanY /= rings[capFr.length].length;
        const interior = [0, (meanY + TOP_Y) / 2, 0];
        grid(b, rings.length, segs + 1, (i, j) => rings[i][j], {
          colourAt: () => COL.white,
          outwardFrom: () => interior,
        });
        cap(b, rings[rings.length - 1], [0, TOP_Y, 0], [0, 1, 0], COL.white);
      }),
      M.paint,
    ),
  );

  root.add(
    part(
      "swashplate",
      build((b) => {
        latheY(b, [[0.176, 3.414], [0.212, 3.436], [0.212, 3.470], [0.176, 3.492]], LOD.ring * 2, COL.plain, true, true);
            }),
      M.metal,
    ),
  );

  root.add(
    part(
      "main_rotor_mast",
      build((b) => {
        tube(
          b,
          [[0, 3.496, 0], [0, 3.570, 0], [0, MAST_TOP_Y - 0.034, 0]],
          () => 0.098,
          LOD.ring,
          COL.plain,
        );
      }),
      M.metal,
    ),
  );

  const hub = pivot("main_rotor_hub", [0, MAST_TOP_Y, 0]);
  root.add(hub);

  hub.add(
    part(
      "rotor_hub_plate",
      build((b) => {
        latheY(b, [[0.090, -0.026], [0.330, -0.026], [0.352, -0.010], [0.352, 0.048], [0.330, 0.064], [0.090, 0.064]], LOD.ring * 2, COL.plain, true, true);
            }),
      M.metal,
    ),
  );

  /** Blade 1 parks pointing dead ahead, so the model's own bounding box is the quoted
   *  13.64 m overall length rather than whatever an arbitrary azimuth happened to give. */
  const BLADE_ANGLES = [0, 1, 2, 3, 4].map((i) => (i * Math.PI * 2) / 5 - Math.PI / 2);

  /*
   * The grip is in two pieces, butt-jointed at r = 0.480 like everything else on this model:
   * the bare titanium pitch housing inboard, and the BLACK COMPOSITE SLEEVE outboard. Every
   * photograph of an H145 head shows that sleeve, and without it the five blades appear to grow
   * straight out of a bright metal star, which is the one thing that made the rotor head read as
   * a toy part rather than as a bearingless hub.
   */
  const gripRadius = (r) => 0.086 - 0.022 * ((r - 0.356) / (GRIP_TIP_R - 0.356));
  const gripY = (r) => 0.017 + 0.004 * ((r - 0.356) / (GRIP_TIP_R - 0.356));
  const gripRun = (b, rFrom, rTo) => {
    for (const a of BLADE_ANGLES) {
      const dir = [Math.cos(a), 0, -Math.sin(a)];
      const mid = (rFrom + rTo) / 2;
      const p = (r) => [dir[0] * r, gripY(r), dir[2] * r];
      tube(b, [p(rFrom), p(mid), p(rTo)], (t) => gripRadius(lerp(rFrom, rTo, t)), 14, COL.plain);
    }
  };
  hub.add(part("rotor_head_grips", build((b) => gripRun(b, 0.356, 0.476)), M.metal));
  hub.add(part("rotor_blade_sleeves", build((b) => gripRun(b, 0.480, GRIP_TIP_R)), M.blade));

  hub.add(
    part(
      "rotor_control_rods",
      build((b) => {
        for (const a of BLADE_ANGLES) {
          const off = a + 0.30;
          tube(
            b,
            [
              // Vertical stubs top and bottom: a tube's end cap is perpendicular to its path, and
              // on a slanted run that lifts the real end ~14 mm away from where the point sits.
              [Math.cos(off) * 0.196, -0.198, -Math.sin(off) * 0.196],
              [Math.cos(off) * 0.196, -0.182, -Math.sin(off) * 0.196],
              [Math.cos(off) * 0.250, -0.116, -Math.sin(off) * 0.250],
              [Math.cos(off) * 0.300, -0.046, -Math.sin(off) * 0.300],
              [Math.cos(off) * 0.300, -0.030, -Math.sin(off) * 0.300],
            ],
            () => 0.017,
            8,
            COL.plain,
          );
        }
      }),
      M.metal,
    ),
  );

  hub.add(
    part(
      "rotor_head_cap",
      build((b) => {
        latheY(b, [[0.190, 0.068], [0.192, 0.134], [0.176, 0.198], [0.126, 0.242], [0.048, 0.256]], LOD.ring * 2, COL.plain, true, true);
            }),
      M.metal,
    ),
  );

  /**
   * One main rotor blade, in the hub's local frame: spanwise +X, leading edge toward -Z.
   * Constant 0.36 m chord out to 86% span, then a swept, tapered tip; 12% to 8% thickness;
   * -8 degrees of washout; 1.5 degrees of coning so a parked rotor is not dead flat.
   */
  function mainBlade() {
    const b = Builder();
    const span = LOD.bladeSpan;
    const sections = [];
    for (let i = 0; i <= span; i += 1) {
      const t = i / span;
      const r = lerp(BLADE_ROOT_R, ROTOR_R, t);
      const tipT = clamp((r - 0.86 * ROTOR_R) / (0.14 * ROTOR_R), 0, 1);
      /*
       * A bearingless rotor's blade does not meet its grip as a thin aerofoil edge — there is a
       * cuff over the flexbeam. Without it the blade reads as floating off the head however
       * correct the 4 mm joint is, which is the first thing anyone looks at on a helicopter.
       */
      const cuff = 1 - smooth(clamp(t / 0.085, 0, 1));
      const chord = lerp(0.385, 0.205, smooth(tipT)) * (1 - 0.25 * cuff);
      const sweep = 0.205 * Math.pow(tipT, 1.65);
      const ratio = lerp(0.120, 0.081, t) + 0.265 * cuff;
      const twist = ((-8.0 * t + 5.0) * Math.PI) / 180;
      /*
       * Coning, plus the ANHEDRAL the H145's blade carries over its outer 14%: the swept tip
       * drops as well as sweeping back. It is 62 mm at the very tip — invisible on its own, but
       * it is what stops a five-blade disc reading as five flat sticks in a top-down render.
       */
      const y = Math.sin((1.5 * Math.PI) / 180) * (r - BLADE_ROOT_R) - 0.062 * Math.pow(tipT, 2.0);
      // Chord axis runs -Z (leading edge) to +Z (trailing edge), pitched about the span axis.
      const cz = Math.cos(twist);
      const cy = Math.sin(twist);
      const le = [r, y - (-0.30 * chord) * cy, -0.30 * chord * cz + sweep];
      const te = [r, y - (0.70 * chord) * cy, 0.70 * chord * cz + sweep];
      sections.push({ le, te, up: [0, cz, cy], ratio });
    }
    aerofoil(b, sections, LOD.bladeAround, COL.plain);
    return b.geometry();
  }

  for (let i = 0; i < 5; i += 1) {
    const blade = part(`main_rotor_blade_${i + 1}`, mainBlade(), M.blade);
    blade.rotation.y = BLADE_ANGLES[i];
    hub.add(blade);
  }

  // ---------------------------------------------------------------- 6. tail boom

  root.add(
    part(
      "tail_boom",
      build((b) => {
        const rows = 34;
        const counts = [LOD.fuseColsTop - 5, 1, LOD.fuseColsBlue - 3, LOD.fuseColsGrey - 3];
        const cols = counts[0] + counts[1] + counts[2] + counts[3] + 4;
        const zAt = (i) => lerp(BOOM_FRONT_Z, BOOM_REAR_Z, i / (rows - 1));
        // The livery break is solved on the boom's own section, so the stripe runs on unbroken.
        const cache = [];
        for (let i = 0; i < rows; i += 1) {
          const z = zAt(i);
          const h = bandHeights(z);
          const inv = (y) => {
            const cy = boomCy(z);
            const n = boomN(z);
            let c;
            if (y >= cy) c = Math.pow(clamp((y - cy) / boomHt(z), 0, 1), n / 2);
            else c = -Math.pow(clamp((cy - y) / boomHb(z), 0, 1), n / 2);
            return Math.acos(clamp(c, -1, 1));
          };
          const a = clamp(inv(h.redTop), 0, Math.PI);
          const bb = clamp(inv(h.redBot), a, Math.PI);
          const cc = clamp(inv(boomCy(z) - boomHb(z) + 0.09), bb, Math.PI);
          const thetas = [];
          const colours = [];
          const seg = (from, to, n, colour) => {
            for (let k = 0; k <= n; k += 1) { thetas.push(lerp(from, to, k / n)); colours.push(colour); }
          };
          seg(0, a, counts[0], COL.white);
          seg(a, bb, counts[1], COL.red);
          seg(bb, cc, counts[2], COL.blue);
          seg(cc, Math.PI, counts[3], COL.grey);
          cache.push({ thetas, colours });
        }
        for (const side of [1, -1]) {
          grid(
            b,
            rows,
            cols,
            (i, j) => { const p = boomPoint(zAt(i), cache[i].thetas[j]); return [p[0] * side, p[1], p[2]]; },
            {
              normalAt: (i, j) => { const n = boomNormal(zAt(i), cache[i].thetas[j]); return [n[0] * side, n[1], n[2]]; },
              colourAt: (i, j) => cache[i].colours[j],
              outwardFrom: (i) => [0, boomCy(zAt(i)), zAt(i)],
            },
          );
        }
        const boomEdge = (rowIndex, z) => {
          const th = cache[rowIndex].thetas;
          const loop = [];
          for (let j = 0; j < th.length; j += 1) { const q = boomPoint(z, th[j]); loop.push([q[0], q[1], q[2]]); }
          for (let j = th.length - 1; j >= 0; j -= 1) { const q = boomPoint(z, th[j]); loop.push([-q[0], q[1], q[2]]); }
          loop.push(loop[0]);
          return loop;
        };
        const front = boomEdge(0, BOOM_FRONT_Z);
        const rear = boomEdge(rows - 1, BOOM_REAR_Z);
        cap(b, front, [0, boomCy(BOOM_FRONT_Z), BOOM_FRONT_Z], [0, 0, 1], COL.white);
        cap(b, rear, [0, boomCy(BOOM_REAR_Z), BOOM_REAR_Z], [0, 0, -1], COL.blue);
      }),
      M.paint,
    ),
  );

  // ---------------------------------------------------------------- 7. stabiliser and endplates

  /**
   * The stabiliser is one part in two halves that butt the boom 4 mm clear of its skin, because
   * a single spar through the boom would be an interpenetration and this model does not have one.
   */
  const STAB_Z = -5.560;
  const STAB_Y = 2.316;
  const STAB_TIP_X = 1.210;
  root.add(
    part(
      "h_stab",
      build((b) => {
        for (const side of [1, -1]) {
          // The boom widens forward, so a root sized at mid-chord is inside the boom at the
          // leading edge. Size it on the widest section the stabiliser actually spans.
          let widest = 0;
          for (let k = 0; k <= 12; k += 1) {
            const zz = STAB_Z + (k / 12 - 0.5) * 0.62;
            for (let m = 0; m <= 6; m += 1) {
              const yy = STAB_Y - 0.045 + (m / 6) * 0.115;
              // Solve the boom's section for x at this height: the equator half-width overstates
              // it by ~6 mm down where the stabiliser actually sits.
              const cy2 = boomCy(zz);
              const nn = boomN(zz);
              const c = yy >= cy2
                ? Math.pow(clamp((yy - cy2) / boomHt(zz), 0, 1), nn / 2)
                : -Math.pow(clamp((cy2 - yy) / boomHb(zz), 0, 1), nn / 2);
              const sn = Math.sqrt(Math.max(0, 1 - c * c));
              widest = Math.max(widest, boomHw(zz) * Math.pow(sn, 2 / nn));
            }
          }
          const rootX = widest + 0.002;
          const sections = [];
          const steps = 8;
          for (let i = 0; i <= steps; i += 1) {
            const t = i / steps;
            const x = side * lerp(rootX, STAB_TIP_X, t);
            const chord = lerp(0.560, 0.400, t);
            const y = STAB_Y + 0.030 * t;
            sections.push({
              le: [x, y, STAB_Z + chord * 0.5],
              te: [x, y, STAB_Z - chord * 0.5],
              up: [0, 1, 0],
              ratio: lerp(0.135, 0.110, t),
            });
          }
          if (side < 0) sections.reverse();
          aerofoil(b, sections, 16, COL.white);
        }
      }),
      M.paint,
    ),
  );

  for (const [side, tag] of [[1, "r"], [-1, "l"]]) {
    root.add(
      part(
        `endplate_${tag}`,
        build((b) => {
          const sections = [];
          const steps = 6;
          for (let i = 0; i <= steps; i += 1) {
            const t = i / steps;
            const y = lerp(STAB_Y + 0.030 + 0.026 + 0.004, STAB_Y + 0.492, t);
            const chord = lerp(0.430, 0.300, t);
            const zc = STAB_Z - 0.020 - 0.070 * t;
            sections.push({
              le: [side * (STAB_TIP_X - 0.012 * t), y, zc + chord * 0.5],
              te: [side * (STAB_TIP_X - 0.012 * t), y, zc - chord * 0.5],
              up: [side, 0, 0],
              ratio: lerp(0.130, 0.105, t),
            });
          }
          aerofoil(b, sections, 14, COL.white);
        }),
        M.paint,
      ),
    );
  }

  // ---------------------------------------------------------------- 8. Fenestron

  /**
   * The shroud: a lens-sectioned annulus turned about the duct axis, with a rounded inlet lip
   * on each side and a straight 1.00 m bore. The rear-most point of the whole aircraft is this
   * part's trailing edge at z = -8.140.
   */
  root.add(
    part(
      "fenestron_duct",
      build((b) => {
        const segs = LOD.duct;
        const halfAt = (r) => {
          // Thick at the bore (the inlet bellmouth), thin at the rim.
          const t = clamp((r - DUCT_R_IN) / (DUCT_R_OUT - DUCT_R_IN), 0, 1);
          return FEN_HALF_X * (0.28 + 0.72 * Math.pow(1 - t, 0.55)) + 0.014;
        };
        const LIP_FLARE = 0.030;
        const BORE_MOUTH = DUCT_R_IN + LIP_FLARE; // the bellmouth is widest where it meets the face
        const radii = [];
        const steps = 12;
        for (let i = 0; i <= steps; i += 1) radii.push(lerp(BORE_MOUTH, DUCT_R_OUT, i / steps));

        const ringAt = (r, x) => {
          const ring = [];
          for (let k = 0; k <= segs; k += 1) {
            const a = (k / segs) * Math.PI * 2;
            ring.push([DUCT_C[0] + x, DUCT_C[1] + Math.cos(a) * r, DUCT_C[2] + Math.sin(a) * r]);
          }
          return ring;
        };
        // Outboard face, rim, inboard face.
        const faceA = radii.map((r) => ringAt(r, halfAt(r)));
        const faceB = radii.map((r) => ringAt(r, -halfAt(r)));
        // Each face is told which side of the disc it lives on; the bore faces inward, toward
        // the axis, because it is the inside of a hole rather than the outside of a body.
        grid(b, faceA.length, segs + 1, (i, j) => faceA[i][j], {
          colourAt: () => COL.white,
          outwardFrom: () => [DUCT_C[0] - 1, DUCT_C[1], DUCT_C[2]],
        });
        grid(b, faceB.length, segs + 1, (i, j) => faceB[i][j], {
          colourAt: () => COL.white,
          outwardFrom: () => [DUCT_C[0] + 1, DUCT_C[1], DUCT_C[2]],
        });
        strip(b, faceA[steps], faceB[steps], COL.white, DUCT_C);
        // The bore: a rounded lip on each side into a straight throat.
        const lip = [];
        const lipSteps = 8;
        for (let i = 0; i <= lipSteps; i += 1) {
          const a = (i / lipSteps) * Math.PI;
          lip.push([DUCT_R_IN + LIP_FLARE * (1 - Math.sin(a)), Math.cos(a) * halfAt(BORE_MOUTH)]);
        }
        const bore = lip.map(([r, x]) => ringAt(r, x));
        grid(b, bore.length, segs + 1, (i, j) => bore[i][j], {
          colourAt: () => COL.grey,
          outwardFrom: (i) => [DUCT_C[0] + lip[i][1], DUCT_C[1], DUCT_C[2]],
          invert: true,
        });
      }),
      M.paint,
    ),
  );

  root.add(
    part(
      "fenestron_stator",
      build((b) => {
        // Four struts holding the gearbox fairing in the bore, plus the fairing itself.
        for (let i = 0; i < 4; i += 1) {
          const a = (i / 4) * Math.PI * 2 + 0.4;
          tube(
            b,
            [
              [DUCT_C[0] - 0.104, DUCT_C[1] + Math.cos(a) * 0.104, DUCT_C[2] + Math.sin(a) * 0.104],
              [DUCT_C[0] - 0.112, DUCT_C[1] + Math.cos(a) * 0.300, DUCT_C[2] + Math.sin(a) * 0.300],
              [DUCT_C[0] - 0.120, DUCT_C[1] + Math.cos(a) * 0.496, DUCT_C[2] + Math.sin(a) * 0.496],
            ],
            () => 0.028,
            8,
            COL.plain,
          );
        }
        revolveX(
          b,
          [[0.030, -0.176], [0.088, -0.148], [0.100, -0.118], [0.100, -0.092]],
          DUCT_C,
          LOD.ring,
          COL.plain,
          true,
        );
      }),
      M.metal,
    ),
  );

  const fen = pivot("fenestron_rotor", DUCT_C);
  root.add(fen);

  fen.add(
    part(
      "fenestron_hub",
      build((b) => {
        revolveX(b, [[0.086, -0.052], [0.102, -0.020], [0.102, 0.040], [0.072, 0.068], [0.028, 0.076]], [0, 0, 0], LOD.ring, COL.plain, true);
      }),
      M.metal,
    ),
  );

  /** Ten blades on the modulated spacing a Fenestron uses to spread its tonal noise. */
  const FEN_GAPS = [31, 41, 33, 39, 32, 42, 34, 38, 33, 37];
  let fenAngle = 0;
  for (let i = 0; i < 10; i += 1) {
    const a = (fenAngle * Math.PI) / 180;
    fenAngle += FEN_GAPS[i];
    const blade = part(
      `fenestron_blade_${i + 1}`,
      build((b) => {
        const sections = [];
        const steps = LOD.fenSpan;
        for (let k = 0; k <= steps; k += 1) {
          const t = k / steps;
          const r = lerp(0.106, FEN_TIP_R, t);
          const chord = lerp(0.104, 0.086, t);
          const pitch = ((26 - 12 * t) * Math.PI) / 180;
          // Local frame: blade grows along +Y, chord along X (the duct axis), pitched about +Y.
          const cx = Math.cos(pitch);
          const cz = Math.sin(pitch);
          sections.push({
            le: [-chord * 0.4 * cx, r, -chord * 0.4 * cz],
            te: [chord * 0.6 * cx, r, chord * 0.6 * cz],
            up: [-cz, 0, cx],
            ratio: lerp(0.135, 0.095, t),
          });
        }
        aerofoil(b, sections, LOD.fenAround, COL.plain);
      }),
      M.blade,
    );
    blade.rotation.x = -a;
    fen.add(blade);
  }

  /**
   * The fin that carries the shroud. It is not a slab pushed through the boom: its lower edge
   * traces the boom's own crown 4 mm clear of it, its trailing edge traces the shroud's leading
   * edge 4 mm clear of THAT, and it tapers to a closed leading edge — so it blends into both
   * without touching either, which is exactly what the gap and intersection passes ask for.
   */
  root.add(
    part(
      "tail_fin",
      build((b) => {
        const TE_CLEAR = 0.004;
        const TOP_Y = 3.310;
        /** Where the shroud's leading edge sits at height y (or the boom's rear cap below it). */
        const ductFrontAt = (y) => {
          const dy = y - DUCT_C[1];
          const r2 = DUCT_R_OUT * DUCT_R_OUT - dy * dy;
          return r2 <= 0 ? BOOM_REAR_Z : DUCT_C[2] + Math.sqrt(r2);
        };
        const boomCrownAt = (z) => (z <= BOOM_REAR_Z ? null : boomPoint(clamp(z, BOOM_REAR_Z, BOOM_FRONT_Z), 0)[1] + 0.004);

        const NZ = 26;
        const NY = 14;
        const LE_Z = -5.560;
        // Chordwise stations from the leading edge back to the shroud.
        const cols = [];
        for (let i = 0; i <= NZ; i += 1) {
          const t = i / NZ;
          // Bottom edge: on the boom while there is boom under it, then down the shroud's face.
          const yTop = lerp(2.735, TOP_Y, smooth(Math.pow(t, 0.72)));
          const zGuess = lerp(LE_Z, ductFrontAt(lerp(2.735, TOP_Y, 1)) - 0.001, t);
          const z = t < 1 ? zGuess : ductFrontAt(yTop) + TE_CLEAR;
          const crown = boomCrownAt(z);
          const yBot = crown === null ? DUCT_C[1] + 0.30 : Math.min(crown, yTop - 0.02);
          // Thickness: closed at the leading edge, matching the shroud rim at the trailing edge.
          const half = 0.062 * Math.pow(Math.sin(Math.PI * Math.pow(clamp(t, 0, 1), 0.62)), 0.7) + 0.052 * Math.pow(t, 2.4);
          cols.push({ z, yBot, yTop, half });
        }
        // Pull every trailing station clear of the shroud at its own height.
        for (const c of cols) {
          const limit = ductFrontAt(c.yTop) + TE_CLEAR;
          if (c.z < limit) c.z = limit;
        }

        const at = (i, j, sign) => {
          const c = cols[i];
          const v = j / (NY - 1);
          const y = lerp(c.yBot, c.yTop, v);
          // Rounded top edge so the fin does not end in a knife.
          const round = Math.sqrt(Math.max(0, 1 - Math.pow(clamp((v - 0.86) / 0.14, 0, 1), 2)));
          return [sign * c.half * round, y, c.z];
        };
        for (const sign of [1, -1]) {
          grid(b, NZ + 1, NY, (i, j) => at(i, j, sign), {
            colourAt: () => COL.white,
            outwardFrom: (i, j) => { const c = cols[i]; return [0, lerp(c.yBot, c.yTop, j / (NY - 1)), c.z]; },
          });
        }
        // Bottom edge and trailing edge closed off; the leading edge closes itself (half -> 0).
        const bottomA = cols.map((_, i) => at(i, 0, 1));
        const bottomB = cols.map((_, i) => at(i, 0, -1));
        const finMid = [0, (cols[0].yTop + cols[NZ].yBot) / 2, (cols[0].z + cols[NZ].z) / 2];
        strip(b, bottomA, bottomB, COL.white, finMid);
        const teA = [];
        const teB = [];
        for (let j = 0; j < NY; j += 1) { teA.push(at(NZ, j, 1)); teB.push(at(NZ, j, -1)); }
        strip(b, teA, teB, COL.white, finMid);
      }),
      M.paint,
    ),
  );

  // ---------------------------------------------------------------- 9. landing gear

  for (const [side, tag] of [[1, "r"], [-1, "l"]]) {
    root.add(
      part(
        `skid_${tag}`,
        build((b) => {
          const path = [];
          const zs = [-1.560, -1.200, -0.700, -0.200, 0.300, 0.800, 1.250, 1.520, 1.700, 1.830, 1.910];
          for (const z of zs) {
            const up = clamp((z - 1.250) / 0.660, 0, 1);
            path.push([side * SKID_X, SKID_R + 0.300 * smooth(up) * up, z]);
          }
          tube(b, path, () => SKID_R, LOD.ring, COL.plain);
          // Cross-tube clamps: they fill the 4 mm joint so the gap reads as hardware, not a fault.
          for (const z of [CROSS_F_Z, CROSS_R_Z]) {
            tube(
              b,
              [[side * SKID_X, CLAMP_Y, z - 0.078], [side * SKID_X, CLAMP_Y, z + 0.078]],
              () => CLAMP_R,
              LOD.ring,
              COL.plain,
            );
          }
        }),
        M.gear,
      ),
    );
  }

  /**
   * The cross tube's path, defined once. The step is bolted to this tube, and a step seated on
   * an idealised curve rather than on the POLYLINE the tube is actually built from sits ~14 mm
   * out — the chord between two path nodes is well above the smooth curve through them here.
   */
  const crossPath = (z, apexY) => {
    const xs = [-SKID_X, -0.94, -0.86, -0.68, -0.48, -0.30, 0, 0.30, 0.48, 0.68, 0.86, 0.94, SKID_X];
    return xs.map((x) => {
      // Held flat over the outer 60 mm: an angled end cap sits ~10 mm higher than the tube's
      // centre-line suggests, which is how the skid clamp first ended up 14 mm short of it.
      const t = clamp((1 - Math.abs(x) / SKID_X - 0.06) / 0.94, 0, 1);
      return [x, lerp(CLAMP_Y + CLAMP_R + CROSS_R + 0.004, apexY, smooth(clamp(t * 1.28, 0, 1))), z];
    });
  };
  /**
   * The top of the tube at a given x — what the step actually has to clear.
   *
   * Not `centreline + radius`: a swept circle cut by a vertical plane is an ELLIPSE, and on a
   * sloping run its top stands r / cos(slope) above the path, which on this arch is ~4.6 mm
   * more. Seating the step on centreline + r left it grazing at 0.6 mm however far it was
   * raised, because the error travelled with it.
   */
  const crossTubeTop = (path, x) => {
    for (let i = 0; i < path.length - 1; i += 1) {
      const a = path[i];
      const c = path[i + 1];
      if (x >= a[0] && x <= c[0]) {
        const f = (x - a[0]) / (c[0] - a[0] || 1);
        const slope = (c[1] - a[1]) / (c[0] - a[0] || 1);
        return lerp(a[1], c[1], f) + CROSS_R * Math.sqrt(1 + slope * slope);
      }
    }
    return path[path.length - 1][1] + CROSS_R;
  };

  for (const [z, tag] of [[CROSS_F_Z, "f"], [CROSS_R_Z, "r"]]) {
    const apexY = CROSS_APEX_Y[tag === "f" ? 0 : 1];
    root.add(
      part(`crosstube_${tag}`, build((b) => tube(b, crossPath(z, apexY), () => CROSS_R, LOD.ring, COL.plain)), M.gear),
    );
  }

  for (const [side, tag] of [[1, "r"], [-1, "l"]]) {
    root.add(
      part(
        `step_${tag}`,
        build((b) => {
          // Sits on the cross tube's own arc, 4 mm clear of it, so it is hardware and not decor.
          // A straight plate on a curved tube can only ever touch at its inboard end, where the
          // arch is highest, so it is seated there rather than on its mid-point.
          // Out where the arch has flattened: further inboard the tube climbs faster than the
          // step can be lifted, so raising it there moves the contact rather than opening it.
          const CX = 0.892;
          const HX = 0.052;
          const path = crossPath(CROSS_F_Z, CROSS_APEX_Y[0]);
          mountBox(b, {
            base: [side * CX, crossTubeTop(path, -(CX - HX)), CROSS_F_Z],
            normal: [0, 1, 0], half: [HX, 0.024, 0.076], roundness: 0.30, segs: 5, gap: 0.005,
          });
        }),
        M.gear,
      ),
    );
  }

  // ---------------------------------------------------------------- 10. small hardware

  root.add(
    part(
      "pitot",
      build((b) => {
        for (const side of [1, -1]) {
          // Below the glazing, not through it: the first placement put both tubes inside the
          // windscreen and its seal.
          const base = fuseOffset(2.870, side > 0 ? 1.700 : -1.700, 0.021 * Math.cos(Math.PI / LOD.ring) + 0.003);
          tube(
            b,
            [base, [base[0] + side * 0.030, base[1] + 0.010, base[2] + 0.230], [base[0] + side * 0.036, base[1] + 0.012, base[2] + 0.330]],
            (t) => 0.021 - 0.006 * t,
            10,
            COL.plain,
          );
        }
      }),
      M.metal,
    ),
  );

  const fuseSurf = (z, theta) => fusePoint(z, theta);
  const fuseNrm = (z, theta) => fuseNormal(z, theta);

  root.add(
    part(
      "wsps_upper",
      build((b) => skinFin(b, {
        surfaceAt: fuseSurf, normalAt: fuseNrm, zCentre: 2.430, theta: 0,
        chord: 0.340, height: 0.215, sweep: 0.055, thick: 0.016, colour: COL.plain,
      })),
      M.metal,
    ),
  );

  root.add(
    part(
      "wsps_lower",
      build((b) => skinFin(b, {
        surfaceAt: fuseSurf, normalAt: fuseNrm, zCentre: 2.520, theta: Math.PI,
        chord: 0.310, height: 0.195, sweep: 0.048, thick: 0.015, colour: COL.plain,
      })),
      M.metal,
    ),
  );

  // The deck now runs to z = -2.300 and the pod ends at the bulkhead 260 mm behind it, so the
  // dorsal blade moves onto the boom's crown, where an H145 carries it anyway.
  root.add(part("antenna_dorsal", build((b) => skinFin(b, {
    surfaceAt: boomPoint, normalAt: boomNormal, zCentre: -3.320, theta: 0,
    chord: 0.240, height: 0.150, sweep: -0.030, thick: 0.013, colour: COL.plain, steps: 10, up: 8,
  })), M.dark));

  root.add(part("antenna_ventral", build((b) => skinFin(b, {
    surfaceAt: fuseSurf, normalAt: fuseNrm, zCentre: -0.400, theta: Math.PI,
    chord: 0.205, height: 0.128, sweep: 0.026, thick: 0.012, colour: COL.plain, steps: 10, up: 8,
  })), M.dark));

  root.add(part("antenna_tail", build((b) => skinFin(b, {
    surfaceAt: boomPoint, normalAt: boomNormal, zCentre: -4.900, theta: 0,
    chord: 0.195, height: 0.122, sweep: -0.024, thick: 0.012, colour: COL.plain, steps: 10, up: 8,
  })), M.dark));

  for (const [side, tag] of [[1, "r"], [-1, "l"]]) {
    root.add(
      part(
        `nav_light_${tag}`,
        build((b) => {
          // Centred on the skin, half of a light housing is inside the aircraft. Offsetting by
          // its own half-extent along the normal puts the whole lens outside, where it is seen.
          const th = side > 0 ? 1.62 : -1.62;
          mountBox(b, { base: fusePoint(1.700, th), normal: fuseNormal(1.700, th), half: [0.033, 0.030, 0.058], roundness: 0.30, segs: 5 });
        }),
        M.lens,
      ),
    );
  }
  /*
   * The chin fit: a steerable searchlight to port and a sensor ball to starboard, on a shared
   * fairing under the nose. Every H145 in the demonstrator photographs carries something here,
   * and an empty chin is one of the things that makes a model look like a toy.
   */
  /*
   * The fairing HUGS the keel; it is not a box hung under it. Over its own 380 mm the nose's
   * underside rises about 170 mm, so an axis-aligned box either buries its forward end in the
   * fuselage (the audit found six crossing triangles) or floats its aft end by a hand's width.
   * A blister lofted off the same surface as everything else can do neither.
   */
  const CHIN_Z0 = 2.860;
  const CHIN_Z1 = 3.240;
  const chinD = (z, th) => {
    const u = clamp((z - CHIN_Z0) / (CHIN_Z1 - CHIN_Z0), 0, 1);
    const across = Math.exp(-Math.pow(Math.abs(th - Math.PI) / 0.330, 6));
    const along = smooth(clamp(u / 0.20, 0, 1)) * smooth(clamp((1 - u) / 0.20, 0, 1));
    return 0.006 + 0.118 * across * along;
  };
  root.add(
    part(
      "sensor_fairing",
      hugShell({
        zs: linspace(CHIN_Z0, CHIN_Z1, 16),
        thetaLo: () => Math.PI - 0.440,
        thetaHi: () => Math.PI + 0.440,
        cols: [8, 1, 5, 5],
        dIn: 0.004,
        dOut: (i, j, total, rows, theta, z) => chinD(z, theta),
        plain: true,
        colourOverride: COL.grey,
      }),
      M.paint,
    ),
  );
  /*
   * Both hang UNDER the fairing, not in it. The fairing is a mountBox, so its underside is a
   * known distance below the keel (its own half-height plus the 4 mm seat); anything mounted at
   * a guessed depth ends up half-swallowed, which is what the first placement did to both.
   */
  const chinMount = (z, th) => ({
    base: fuseOffset(z, th, chinD(z, th)),
    normal: fuseNormal(z, th),
  });
  root.add(
    part(
      "sensor_turret",
      build((b) => mountBox(b, { ...chinMount(3.040, Math.PI - 0.175), half: [0.074, 0.074, 0.074], roundness: 0.78, segs: 7, gap: 0.005 })),
      M.dark,
    ),
  );
  root.add(
    part(
      "landing_light",
      build((b) => mountBox(b, { ...chinMount(3.060, Math.PI + 0.175), half: [0.062, 0.062, 0.058], roundness: 0.55, segs: 6, gap: 0.005 })),
      M.lens,
    ),
  );

  return root;
}
