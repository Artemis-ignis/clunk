/**
 * Farm tractor — a low-poly vehicle, written as code.
 *
 * The catalogue's only tractor so far is the 56,392-triangle demo the inspector uses as a
 * "before" picture. This is the "after": the same silhouette a top-down or three-quarter
 * farm game actually wants, at a little over a thousand triangles, with the moving parts on
 * named pivots and two clips baked in, so a buyer gets the motion and not just the sockets.
 *
 *   tractor             whole vehicle — facing and bob
 *     wheel_fl_pivot / wheel_fr_pivot   front axle, one per wheel (steer + roll)
 *     wheel_rl_pivot / wheel_rr_pivot   rear axle
 *     wheel_steer                       the steering wheel, on the column's axis
 *
 * Each wheel pivot sits at the axle centre, so rotating it about X rolls the wheel in
 * place — same discipline as the fence gate's hinge and the farmhand's hips. Forward is
 * +Z, up is +Y, units are metres, and the lowest point (the tyres) rests on y=0 with the
 * origin centred between the axles, so it drops onto a tile without an offset.
 *
 * Read from a distance the tractor is five shapes: two big rear wheels, two small front
 * wheels, a long hood, a seat with a roll bar behind it, a stack. Everything here serves
 * one of those five; nothing is added that a 64 px sprite would swallow.
 *
 * Footprint 2.20 W x 2.05 H x 3.10 L including the rear tyres and the roll bar.
 *
 * Three things the 2026-09-05 mechanism audit measured and this file now answers:
 *
 *   - The axle beams stop at the tyres' inner faces (|x| = TRACK - W/2, by construction) and
 *     the wheel hubs used to be caps sitting outside the tyres, 196.0 mm (rear) and 127.4 mm
 *     (front) further out. Nothing carried the load across that gap. Each hub is now the shaft
 *     it should always have been: it starts on the axle beam's end face and runs out through
 *     the wheel to the same cap as before, so the outside of the model is unchanged and the
 *     axle-to-hub gap is 0.0 mm. The shaft turns with the wheel, the beam does not — a
 *     rotating shaft meeting a fixed housing, which is what the joint is.
 *   - The steering wheel was a bare torus floating 88.5 mm off the top of its column. It now
 *     has a hub boss and three spokes, and the node is seated on the column's axis so the
 *     boss caps the column end. Rotating `wheel_steer` about its own local +Z turns it.
 *   - The file shipped five moving nodes and no clips. `drive` and `steer` are below.
 */

/**
 * Exported so the template library can bake the same tractor in more than one colourway:
 * a caller assigns over these fields before calling the factory and restores them after.
 * The values are the originals, so an untouched call still writes the byte-identical GLB
 * the marketplace listing ships.
 */
export const TRACTOR_PALETTE = {
  paint: { color: 0x3f7f3a, roughness: 0.62, metalness: 0.08 },
  rubber: { color: 0x24262a, roughness: 0.95 },
  rim: { color: 0xd9b23a, roughness: 0.55, metalness: 0.15 },
  steel: { color: 0x8a9096, roughness: 0.5, metalness: 0.45 },
  seat: { color: 0x5c3f2a, roughness: 0.9 },
};

const PALETTE = TRACTOR_PALETTE;

// Metres.
const REAR_R = 0.66;
const REAR_W = 0.40;
const FRONT_R = 0.38;
const FRONT_W = 0.26;
const REAR_Z = -0.78;
const FRONT_Z = 0.98;
const TRACK_REAR = 0.90; // half-track: wheel centre x
const TRACK_FRONT = 0.72;
const CHASSIS_Y = 0.58;

/*
 * Half-length of each axle beam — where the fixed steel stops and the turning steel starts.
 *
 * The rear beam ends on the tyre's inner face. The front one cannot: the front wheels turn
 * about the vertical through their own centres, so a beam that reached their inner face at rest
 * would be swallowed by the tyre the moment the wheel was steered. A tyre of radius R and half
 * width h, yawed by t, has its inner face at (x - TRACK) cos t - (z - FRONT_Z) sin t = -h, so a
 * beam 0.10 deep in z stays outside it for every |t| <= STEER_DEGREES only while its end is
 * within TRACK - (h + 0.05 sin t) / cos t = 0.548 of the centreline. 0.545 keeps 7.5 mm of air
 * at full lock; the tapered stub axle below carries the last 45 mm into the wheel.
 */
const REAR_AXLE_HALF = TRACK_REAR - REAR_W / 2; // 0.70
const FRONT_AXLE_HALF = 0.545;

// --- Steering column --------------------------------------------------------------------
// One set of numbers for the column and for the wheel that sits on it. They used to be two
// independent guesses, which is how the wheel ended up 88.5 mm off the column's end.
const COLUMN_TILT = 0.55; // radians the column leans back toward the seat
const COLUMN_LEN = 0.46;
const COLUMN_R = 0.025;
const COLUMN_MID = [0, CHASSIS_Y + 0.76, -0.20];
/** Unit vector up the column, from the cowl toward the driver. */
const COLUMN_AXIS = [0, Math.cos(COLUMN_TILT), -Math.sin(COLUMN_TILT)];
/** The column's top end — the steering wheel's centre. */
const COLUMN_TOP = COLUMN_MID.map((value, axis) => value + COLUMN_AXIS[axis] * (COLUMN_LEN / 2));
const STEER_RIM_R = 0.15;
const STEER_TUBE_R = 0.022;
const STEER_HUB_R = 0.034; // wider than the column, so the boss caps it
/** How far the hub boss bites into the column's end: enough to be a joint, not a sleeve. */
const STEER_HUB_BITE = 0.002;
const STEER_HUB_LEN = 0.032;

// --- The two clips ----------------------------------------------------------------------
/**
 * `drive`: all four wheels roll forward, the steering wheel is still.
 *
 * Rolling without slipping ties one speed to two radii: omega = v / r, so the front wheel
 * turns REAR_R / FRONT_R = 0.66 / 0.38 = 33/19 times as fast as the rear. That ratio is what
 * decides how long the loop has to be. Every wheel here is built from cylinders of 16, 12 and
 * 8 segments, so a quarter turn (90 degrees, a whole number of segments of all three) puts a
 * wheel back on a vertex-for-vertex identical pose. The shortest cycle in which BOTH wheels
 * land on a quarter turn is 19 of them at the back and 33 at the front — after that the file
 * loops with no pop, and at any shorter loop the front wheel would jump.
 *
 * 8 seconds for those 19 rear quarter-turns is v = 0.66 * 19 * (pi/2) / 8 = 2.462 m/s, which
 * is 8.9 km/h — a working field speed for a tractor this size, not a road speed.
 */
const DRIVE_SECONDS = 8;
const DRIVE_REAR_QUARTERS = 19;
const DRIVE_FRONT_QUARTERS = 33; // = DRIVE_REAR_QUARTERS * REAR_R / FRONT_R
/** Metres per second the drive clip is baked at. Stated so a consumer can match ground speed. */
export const DRIVE_SPEED_MPS = (REAR_R * DRIVE_REAR_QUARTERS * (Math.PI / 2)) / DRIVE_SECONDS;

/**
 * `steer`: the front wheels yaw about the vertical through their own centres — the kingpin
 * axis, placed on the wheel centre plane so steering does not drag the wheel sideways — and
 * the steering wheel turns STEER_RATIO times as far, clockwise for a right turn, the way a
 * hand and a road wheel are geared to each other.
 */
const STEER_SECONDS = 4;
const STEER_DEGREES = 25;
const STEER_RATIO = 3;
/** Road-wheel angle at each key. Right, straight, left, straight — and back to the first key. */
const STEER_KEY_DEGREES = [0, STEER_DEGREES, 0, -STEER_DEGREES, 0];

export default function createTractor(THREE, addons) {
  const { mergeGeometries } = addons;

  const mat = Object.fromEntries(
    Object.entries(PALETTE).map(([name, spec]) => [
      name,
      Object.assign(new THREE.MeshStandardMaterial(spec), { name: `tractor_${name}` }),
    ]),
  );

  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt, rb, h, seg, open = false, start = 0, len = Math.PI * 2) =>
    new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, start, len);
  const torus = (r, t, rs, ts) => new THREE.TorusGeometry(r, t, rs, ts);

  const place = (geometry, position = [0, 0, 0], rotation = [0, 0, 0]) => {
    const g = geometry.clone();
    g.rotateX(rotation[0]); g.rotateY(rotation[1]); g.rotateZ(rotation[2]);
    g.translate(position[0], position[1], position[2]);
    return g;
  };

  /** One named mesh per material group: silhouette keeps the detail, the runtime keeps the budget. */
  const merged = (name, material, parts) => {
    const mesh = new THREE.Mesh(mergeGeometries(parts, false), material);
    mesh.name = name;
    return mesh;
  };

  const pivot = (name, position) => {
    const group = new THREE.Group();
    group.name = name;
    group.position.set(...position);
    return group;
  };

  const root = pivot("root_pivot", [0, 0, 0]);
  root.name = "tractor";

  // --- Wheels. A wheel is a tyre, a rim disc and a hub shaft, all rotated so the cylinder
  //     axis runs along X. Each hangs under a pivot at the axle centre.
  const AXLE = Math.PI / 2;
  const wheel = (name, x, y, z, r, w, rimR, axleHalf) => {
    const p = pivot(`${name}_pivot`, [x, y, z]);
    const side = Math.sign(x) || 1;
    p.add(merged(`${name}_tyre`, mat.rubber, [
      place(cyl(r, r, w, 16), [0, 0, 0], [0, 0, AXLE]),
    ]));
    // Rim sits proud of the tyre on the outside face, so the yellow reads from the side.
    p.add(merged(`${name}_rim`, mat.rim, [
      place(cyl(rimR, rimR, w * 0.55, 12), [side * w * 0.26, 0, 0], [0, 0, AXLE]),
    ]));
    /*
     * The hub is a stub axle, not a cap. Its outboard end is where the cap always was — 0.61 w
     * out from the wheel centre, at the same radius, standing proud of the tyre so the joint
     * reads from outside — and it now tapers inboard to land on the axle beam's end face. That
     * is the 196.0 mm (rear) / 127.4 mm (front) of empty air the mechanism audit measured
     * between the beam and the hub, and it costs no triangles: it is the same one cylinder,
     * given two radii instead of one.
     *
     * The taper is not styling. On the steered front wheel the stub turns about the vertical
     * through the wheel centre while the beam does not, so its inboard face sweeps across the
     * beam's end; the width of that sweep is the stub's own radius there. At 0.15 rimR the
     * deepest the two ever share is about 2 mm, a seam. At 0.32 — one straight cylinder — it
     * was 6.2 mm, which the inspector reads as one part driven through another.
     *
     * `cyl` builds along +Y and AXLE turns +Y onto -X, so the FAT end is radiusTop on the left
     * of the tractor and radiusBottom on the right.
     */
    const hubOuter = w * 0.61;
    const hubInner = -(Math.abs(x) - axleHalf);
    const fat = rimR * 0.32;
    const thin = rimR * 0.15;
    p.add(merged(`${name}_hub`, mat.steel, [
      place(
        cyl(side > 0 ? thin : fat, side > 0 ? fat : thin, hubOuter - hubInner, 8),
        [side * (hubOuter + hubInner) / 2, 0, 0],
        [0, 0, AXLE],
      ),
    ]));
    return p;
  };
  root.add(wheel("wheel_rl", -TRACK_REAR, REAR_R, REAR_Z, REAR_R, REAR_W, REAR_R * 0.55, REAR_AXLE_HALF));
  root.add(wheel("wheel_rr", TRACK_REAR, REAR_R, REAR_Z, REAR_R, REAR_W, REAR_R * 0.55, REAR_AXLE_HALF));
  root.add(wheel("wheel_fl", -TRACK_FRONT, FRONT_R, FRONT_Z, FRONT_R, FRONT_W, FRONT_R * 0.5, FRONT_AXLE_HALF));
  root.add(wheel("wheel_fr", TRACK_FRONT, FRONT_R, FRONT_Z, FRONT_R, FRONT_W, FRONT_R * 0.5, FRONT_AXLE_HALF));

  // --- Axles and chassis: steel underneath, paint on top.
  root.add(merged("axles", mat.steel, [
    place(box(REAR_AXLE_HALF * 2, 0.14, 0.14), [0, REAR_R, REAR_Z]),
    place(box(FRONT_AXLE_HALF * 2, 0.10, 0.10), [0, FRONT_R, FRONT_Z]),
    // Drivetrain tube between the axles.
    place(box(0.18, 0.16, FRONT_Z - REAR_Z), [0, CHASSIS_Y - 0.08, (FRONT_Z + REAR_Z) / 2]),
  ]));

  // --- Body. Hood in two steps so the nose is lower than the cowl — that step is most of
  //     what makes it read as a tractor and not a box on wheels.
  root.add(merged("body", mat.paint, [
    // Cowl / rear of hood, tall.
    place(box(0.78, 0.62, 0.90), [0, CHASSIS_Y + 0.31, 0.15]),
    // Nose, slightly lower and narrower, over the front axle.
    place(box(0.70, 0.52, 0.85), [0, CHASSIS_Y + 0.26, 0.98]),
    // Operator floor and the rear housing the seat sits on.
    place(box(0.96, 0.16, 0.80), [0, CHASSIS_Y, -0.40]),
    place(box(0.62, 0.34, 0.50), [0, CHASSIS_Y + 0.17, -0.62]),
    // Rear fenders: half-cylinder shells arched over the big wheels, open so they cost
    // no end caps. Rotated so the arch opens downward and runs along Z.
    place(cyl(REAR_R + 0.09, REAR_R + 0.09, REAR_W + 0.06, 12, true, 0, Math.PI), [-TRACK_REAR, REAR_R, REAR_Z], [0, 0, AXLE]),
    place(cyl(REAR_R + 0.09, REAR_R + 0.09, REAR_W + 0.06, 12, true, 0, Math.PI), [TRACK_REAR, REAR_R, REAR_Z], [0, 0, AXLE]),
  ]));

  // --- Grille, lights, stack, roll bar, steering: steel and yellow accents.
  root.add(merged("grille", mat.steel, [
    place(box(0.56, 0.36, 0.04), [0, CHASSIS_Y + 0.24, 1.42]),
    // Exhaust stack, front-right of the cowl, with a cap.
    place(cyl(0.045, 0.045, 0.78, 8), [0.24, CHASSIS_Y + 0.62 + 0.39, 0.32]),
    place(cyl(0.07, 0.045, 0.06, 8), [0.24, CHASSIS_Y + 0.62 + 0.80, 0.32]),
    // Roll bar: two uprights and a crossbar behind the seat.
    place(box(0.07, 1.10, 0.07), [-0.40, CHASSIS_Y + 0.55, -0.70]),
    place(box(0.07, 1.10, 0.07), [0.40, CHASSIS_Y + 0.55, -0.70]),
    place(box(0.87, 0.07, 0.07), [0, CHASSIS_Y + 1.10, -0.70]),
    // Steering column, leaning back toward the seat.
    place(cyl(COLUMN_R, COLUMN_R, COLUMN_LEN, 6), COLUMN_MID, [-COLUMN_TILT, 0, 0]),
  ]));
  root.add(merged("lights", mat.rim, [
    place(box(0.10, 0.10, 0.03), [-0.20, CHASSIS_Y + 0.40, 1.44]),
    place(box(0.10, 0.10, 0.03), [0.20, CHASSIS_Y + 0.40, 1.44]),
  ]));

  /*
   * The steering wheel. Authored in its own frame — the wheel lies in local XY and its axis is
   * local +Z — so the node, not the vertices, carries the seating. That is what lets `steer`
   * turn it: a quaternion track about local +Z, on top of the rest pose below.
   *
   * The rest pose maps local +Z onto -COLUMN_AXIS, i.e. down the column away from the driver.
   * So a positive turn about local +Z is clockwise as the driver sees it, which is a right
   * turn — the same sign as a positive yaw of the front wheels.
   */
  const steerParts = [place(torus(STEER_RIM_R, STEER_TUBE_R, 6, 14))];
  // Hub boss: it reaches back toward the driver and bites STEER_HUB_BITE into the column end.
  steerParts.push(
    place(
      cyl(STEER_HUB_R, STEER_HUB_R, STEER_HUB_LEN, 8),
      [0, 0, STEER_HUB_BITE - STEER_HUB_LEN / 2],
      [Math.PI / 2, 0, 0],
    ),
  );
  // Three spokes, hub to rim. Without them the rim is a ring hanging in the air, which is
  // exactly what the audit found: 88.5 mm from anything, held up by nothing.
  const spokeInner = STEER_HUB_R - 0.004;
  const spokeOuter = STEER_RIM_R - STEER_TUBE_R + 0.004;
  for (const turn of [0, 1, 2]) {
    const angle = Math.PI / 2 + (turn * 2 * Math.PI) / 3;
    steerParts.push(
      place(
        box(spokeOuter - spokeInner, 0.02, 0.014),
        [Math.cos(angle) * (spokeOuter + spokeInner) / 2, Math.sin(angle) * (spokeOuter + spokeInner) / 2, 0],
        [0, 0, angle],
      ),
    );
  }
  const steerWheel = merged("wheel_steer", mat.rubber, steerParts);
  steerWheel.position.set(...COLUMN_TOP);
  steerWheel.rotation.set(Math.PI / 2 - COLUMN_TILT, 0, 0);
  const steerRest = steerWheel.quaternion.clone();
  root.add(steerWheel);

  // --- Seat: cushion and backrest, the one warm material on the machine.
  root.add(merged("seat", mat.seat, [
    place(box(0.42, 0.10, 0.40), [0, CHASSIS_Y + 0.34 + 0.05, -0.62]),
    place(box(0.42, 0.44, 0.08), [0, CHASSIS_Y + 0.34 + 0.32, -0.80]),
  ]));

  // --- Clips ----------------------------------------------------------------------------
  /**
   * Rolling forward is a positive turn about +X: the contact point at the bottom of the wheel
   * has to stand still while the centre moves toward +Z, and omega * R = v only comes out
   * with that sign.
   */
  const rollTrack = (node, quarters) => {
    const times = new Float32Array(quarters + 1);
    const values = new Float32Array((quarters + 1) * 4);
    for (let key = 0; key <= quarters; key += 1) {
      times[key] = (key * DRIVE_SECONDS) / quarters;
      // A quarter turn per key. Consecutive keys are 90 degrees apart, so LINEAR quaternion
      // interpolation always takes the short way round and the speed stays constant.
      const half = (key * Math.PI) / 4;
      values[key * 4] = Math.sin(half);
      values[key * 4 + 3] = Math.cos(half);
    }
    return new THREE.QuaternionKeyframeTrack(`${node}.quaternion`, times, values);
  };

  const drive = new THREE.AnimationClip("drive", DRIVE_SECONDS, [
    rollTrack("wheel_rl_pivot", DRIVE_REAR_QUARTERS),
    rollTrack("wheel_rr_pivot", DRIVE_REAR_QUARTERS),
    rollTrack("wheel_fl_pivot", DRIVE_FRONT_QUARTERS),
    rollTrack("wheel_fr_pivot", DRIVE_FRONT_QUARTERS),
  ]);

  const steerTimes = new Float32Array(STEER_KEY_DEGREES.map((_, key) => (key * STEER_SECONDS) / (STEER_KEY_DEGREES.length - 1)));
  const yaw = new Float32Array(STEER_KEY_DEGREES.flatMap((degrees) => {
    const half = (degrees * Math.PI) / 360;
    return [0, Math.sin(half), 0, Math.cos(half)];
  }));
  const rim = new Float32Array(STEER_KEY_DEGREES.flatMap((degrees) => {
    const turn = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      (degrees * STEER_RATIO * Math.PI) / 180,
    );
    const { x, y, z, w } = steerRest.clone().multiply(turn);
    return [x, y, z, w];
  }));
  const steer = new THREE.AnimationClip("steer", STEER_SECONDS, [
    new THREE.QuaternionKeyframeTrack("wheel_fl_pivot.quaternion", steerTimes, yaw),
    new THREE.QuaternionKeyframeTrack("wheel_fr_pivot.quaternion", steerTimes, yaw),
    new THREE.QuaternionKeyframeTrack("wheel_steer.quaternion", steerTimes, rim),
  ]);

  root.animations = [drive, steer];

  return root;
}
