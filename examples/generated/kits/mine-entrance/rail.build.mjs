/**
 * Mine Entrance Kit — the three track modules (straight, curve, stopper).
 *
 * These three exist to be BUTTED TOGETHER, so they are built by one file out of one section
 * and one set of numbers. What has to agree, and does, by construction:
 *
 *   gauge          SPEC.gauge = 0.600 m, rail head centre to rail head centre
 *   railhead top   SPEC.railTopY = 0.110 m above the ground plane on all three
 *   section        railSection() — the same twelve points swept on all three, so a straight
 *                  end face and a curve end face are literally the same polygon
 *   sleeper        110 x 50 x 860 mm, 400 mm pitch on the straight, so two butted modules
 *                  keep the pitch instead of showing a double sleeper at the joint
 *
 * Reference reality: British 2 ft (610 mm) narrow gauge is the mine-tub standard; colliery
 * sleepers ran 100-125 mm square in section; a mine's flat-bottom rail was 9-14 kg/m, about
 * 60-70 mm tall. Everything below is that, rounded to whole millimetres.
 *
 * WHERE THE MODULES CONNECT
 *   straight  ends at x = +-0.600, running along X. Two of them butt at a 400 mm sleeper pitch.
 *   curve     90 degrees, centreline radius 1.200 m, arc centre at (-0.600, +0.600). Its two
 *             connectors are at (-0.600, -0.600) heading +X and (+0.600, +0.600) heading +Z —
 *             symmetric about the module origin, which is why the piece can be dropped in
 *             rotated 90/180/270 degrees and still meet a straight.
 *   stopper   0.600 m long, connector at x = -0.300, buffer beam at the far end.
 *
 * ./build.mjs re-measures those connector points off the exported GLBs and fails if the
 * railhead heights or the gauge disagree between modules by more than 0.5 mm.
 */
import {
  SPEC,
  arcFrames,
  at,
  beam,
  flatPainter,
  ground,
  ironPainter,
  kitUserData,
  lump,
  meshOf,
  mineMaterial,
  painted,
  prism,
  railSection,
  restOn,
  stonePainter,
  straightFrames,
  sweepPath,
  timberPainter,
} from "./mine-kit.mjs";

const SECTION = railSection();
const SLEEPER_TOP = SPEC.sleeperHeight;
const HALF_GAUGE = SPEC.gauge / 2;

const sleeperPainter = timberPainter({
  role: "timberBody",
  grainAxis: "z",
  grainStep: 0.215,
  boardAxis: "x",
  boardStep: 0.4,
  seed: 23,
  wear: 0.35,
});
const railPainter = ironPainter({ seed: 29, polish: 1, rust: 0.3 });
const spikePainter = ironPainter({ seed: 37, polish: 0.1, rust: 0.5 });
const ballastPainter = stonePainter({ seed: 41, damp: 0.25 });
const bufferPainter = timberPainter({ role: "timberDark", grainAxis: "z", grainStep: 0.18, seed: 53 });

/**
 * A sleeper lying flat, its length across the track.
 *
 * Two transforms rather than one Euler: `beam()` extrudes along +Y, so the timber is first
 * laid down onto Z and only then yawed into place. Composing two calls is not laziness — a
 * single XYZ Euler applies its Z term first and its X term last, which is the opposite of the
 * order this needs, and the sleepers on the curve would fan the wrong way.
 */
function sleeper(THREE, x, z, yaw) {
  const laid = beam(THREE, [SPEC.sleeperWidth, SPEC.sleeperLength, SPEC.sleeperHeight], [0, 0, 0], [Math.PI / 2, 0, 0], 0.01);
  return at(THREE, laid, [x, SPEC.sleeperHeight / 2, z], [0, yaw, 0]);
}

/** The clout that holds a rail foot down. 22 mm across the head, 8 mm of shank showing. */
function spike(THREE, x, z, yaw) {
  const head = beam(THREE, [0.022, 0.026, 0.022], [0, 0, 0], [0, 0, 0], 0.004);
  return at(THREE, head, [x, SLEEPER_TOP + 0.009, z], [0, yaw, 0]);
}

/** Loose ballast beside the sleepers: the same rock the boulders are cut from, chipped small. */
function ballast(THREE, points) {
  // restOn, not arithmetic: an icosahedron chip has no vertex at its analytic bottom, so a
  // chip placed by its centre height sinks below y = 0 and drags the whole module down when
  // ground() runs — taking the railhead off SPEC.railTopY with it. Measured, then seated.
  return points.map(([x, y, z], index) =>
    restOn(
      THREE,
      at(THREE, lump(THREE, { radius: 0.045 + 0.02 * ((index % 3) / 3), detail: 0, jitter: 0.34, scale: [1.2, 0.55, 1.1], seed: 300 + index }), [x, y, z], [0, index * 1.1, 0]),
      0,
    ),
  );
}

export function buildRail(THREE, variant) {
  const timberParts = [];
  const ironParts = [];
  const stoneParts = [];
  const bufferStrapParts = [];
  const paintTimber = (geometry, painter = sleeperPainter) => timberParts.push(painted(THREE, geometry, painter));
  const paintIron = (geometry, painter = railPainter) => ironParts.push(painted(THREE, geometry, painter));

  let id;
  let label;
  let connectors;

  if (variant === "straight") {
    id = "mine_rail_straight";
    label = "rail, straight 1.2 m module";
    connectors = [
      { at: [-SPEC.module / 2, SPEC.railTopY, 0], heading: [-1, 0, 0] },
      { at: [SPEC.module / 2, SPEC.railTopY, 0], heading: [1, 0, 0] },
    ];
    for (const x of SPEC.sleeperStations) paintTimber(sleeper(THREE, x, 0, 0));
    for (const side of [-1, 1]) {
      paintIron(sweepPath(THREE, SECTION, straightFrames(side * HALF_GAUGE, -SPEC.module / 2, SPEC.module / 2, SLEEPER_TOP)));
      for (const x of SPEC.sleeperStations) {
        for (const offset of [-0.035, 0.035]) {
          ironParts.push(painted(THREE, spike(THREE, x, side * HALF_GAUGE + offset, 0), spikePainter));
        }
      }
    }
    for (const geometry of ballast(THREE, [
      [-0.53, 0, 0.5], [0.06, 0, -0.5], [0.5, 0, 0.47], [-0.2, 0, -0.52],
    ])) stoneParts.push(painted(THREE, geometry, ballastPainter));
  } else if (variant === "curve") {
    id = "mine_rail_curve";
    label = "rail, 90 degree curve, 0.6 m centreline radius";
    // Arc centre chosen so the two connectors land on the module's own diagonal at
    // (-0.600, -0.600) and (+0.600, +0.600). That symmetry is what makes the piece
    // orientation-agnostic on the grid.
    const centre = [-0.6, 0.6];
    const a0 = -Math.PI / 2;
    const a1 = 0;
    connectors = [
      { at: [-0.6, SPEC.railTopY, -0.6], heading: [-1, 0, 0] },
      { at: [0.6, SPEC.railTopY, 0.6], heading: [0, 0, 1] },
    ];
    // Five sleepers on the arc. Tenths of the sweep puts them 377 mm apart along the
    // centreline — near the straight's 400 mm, which is what a real curve does — and leaves
    // the joints clear at both ends.
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const a = a0 + (a1 - a0) * t;
      paintTimber(sleeper(THREE, centre[0] + SPEC.curveRadius * Math.cos(a), centre[1] + SPEC.curveRadius * Math.sin(a), Math.PI / 2 - a));
    }
    for (const side of [-1, 1]) {
      const radius = SPEC.curveRadius + side * HALF_GAUGE;
      paintIron(sweepPath(THREE, SECTION, arcFrames(centre, radius, a0, a1, SPEC.curveSteps, SLEEPER_TOP)));
      for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const a = a0 + (a1 - a0) * t;
        for (const offset of [-0.035, 0.035]) {
          const r = radius + offset;
          ironParts.push(
            painted(
              THREE,
              spike(THREE, centre[0] + r * Math.cos(a), centre[1] + r * Math.sin(a), Math.PI / 2 - a),
              spikePainter,
            ),
          );
        }
      }
    }
    for (const geometry of ballast(THREE, [
      [-0.88, 0, -0.3], [0.3, 0, -0.72], [0.7, 0, -0.12],
    ])) stoneParts.push(painted(THREE, geometry, ballastPainter));
  } else if (variant === "stop") {
    id = "mine_rail_stop";
    label = "rail, stop block, 0.6 m half module";
    connectors = [{ at: [-0.3, SPEC.railTopY, 0], heading: [-1, 0, 0] }];
    for (const x of [-0.2, 0.08]) paintTimber(sleeper(THREE, x, 0, 0));
    // The rails stop at x = 0.200 and the buffer beam's face is at x = 0.210, so there is
    // 10 mm of air at the end of the track: the cart's buffer block meets timber, and the
    // wheel flange never reaches the beam. That is how a stop block actually works.
    for (const side of [-1, 1]) {
      paintIron(sweepPath(THREE, SECTION, straightFrames(side * HALF_GAUGE, -0.3, 0.2, SLEEPER_TOP)));
      for (const x of [-0.2, 0.08]) {
        for (const offset of [-0.035, 0.035]) {
          ironParts.push(painted(THREE, spike(THREE, x, side * HALF_GAUGE + offset, 0), spikePainter));
        }
      }
    }
    // Two stub posts driven beside the track and one cross beam at buffer height. The beam's
    // face sits at x = 0.243, which is 43 mm past the rail ends: the cart meets timber first.
    for (const side of [-1, 1]) {
      paintTimber(beam(THREE, [0.11, 0.42, 0.13], [0.29, 0.21, side * 0.34], [0, 0, 0], 0.014), bufferPainter);
    }
    paintTimber(beam(THREE, [0.16, 0.9, 0.16], [0.29, 0.28, 0], [Math.PI / 2, 0, 0], 0.016), bufferPainter);
    // Iron straps tying the beam to the posts. Their own mesh, not part of `rails`: the build's
    // interlock check reads the railhead height off the `rails` mesh, and a 0.40 m strap filed
    // in with the rails made this module report a railhead 290 mm higher than the other two.
    for (const side of [-1, 1]) {
      bufferStrapParts.push(
        painted(THREE, prism(THREE, [[-0.09, -0.008], [0.09, -0.008], [0.09, 0.008], [-0.09, 0.008]], 0.2, [0.29, 0.3, side * 0.34], [0, 0, 0]), spikePainter),
      );
    }
    for (const geometry of ballast(THREE, [
      [-0.28, 0, 0.5], [0.12, 0, -0.5],
    ])) stoneParts.push(painted(THREE, geometry, ballastPainter));
  } else {
    throw new Error(`Unknown rail variant: ${variant}`);
  }

  ground(THREE, [...timberParts, ...ironParts, ...stoneParts, ...bufferStrapParts]);

  const material = mineMaterial(THREE, 0.88);
  const root = new THREE.Group();
  root.name = id;
  root.add(meshOf(THREE, "sleepers", material, timberParts));
  root.add(meshOf(THREE, "rails", material, ironParts));
  if (bufferStrapParts.length) root.add(meshOf(THREE, "buffer_ironwork", material, bufferStrapParts));
  if (stoneParts.length) root.add(meshOf(THREE, "ballast", material, stoneParts));

  return kitUserData(THREE, root, {
    assetId: `mine-entrance.rail-${variant}.m1`,
    variant: label,
    gaugeMetres: SPEC.gauge,
    railTopYMetres: SPEC.railTopY,
    connectors,
    surfaceLanguage: [
      "twelve-point rail section with a waisted web, swept — not a grey plank",
      "rail heads lifted toward a polished grey the rest of the kit never uses",
      "sleepers chamfered on every long edge, grain streaked across the track",
      "two spikes per rail per sleeper, standing 9 mm proud",
      "loose ballast chips cut from the same rock as the boulders",
    ],
    parts: root.children.map((child) => child.name),
  });
}
