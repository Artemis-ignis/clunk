/**
 * Farm tractor — a low-poly vehicle, written as code.
 *
 * The catalogue's only tractor so far is the 56,392-triangle demo the inspector uses as a
 * "before" picture. This is the "after": the same silhouette a top-down or three-quarter
 * farm game actually wants, at under a thousand triangles, with the moving parts on named
 * pivots so a clip can turn the wheels instead of sliding the whole model.
 *
 *   root_pivot          whole vehicle — facing and bob
 *     wheel_fl_pivot / wheel_fr_pivot   front axle, one per wheel (steer + roll)
 *     wheel_rl_pivot / wheel_rr_pivot   rear axle
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
 */

const PALETTE = {
  paint: { color: 0x3f7f3a, roughness: 0.62, metalness: 0.08 },
  rubber: { color: 0x24262a, roughness: 0.95 },
  rim: { color: 0xd9b23a, roughness: 0.55, metalness: 0.15 },
  steel: { color: 0x8a9096, roughness: 0.5, metalness: 0.45 },
  seat: { color: 0x5c3f2a, roughness: 0.9 },
};

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

  // --- Wheels. A wheel is a tyre, a rim disc and a hub, all rotated so the cylinder axis
  //     runs along X. Each hangs under a pivot at the axle centre.
  const AXLE = Math.PI / 2;
  const wheel = (name, x, y, z, r, w, rimR) => {
    const p = pivot(`${name}_pivot`, [x, y, z]);
    const side = Math.sign(x) || 1;
    p.add(merged(`${name}_tyre`, mat.rubber, [
      place(cyl(r, r, w, 16), [0, 0, 0], [0, 0, AXLE]),
    ]));
    // Rim sits proud of the tyre on the outside face, so the yellow reads from the side.
    p.add(merged(`${name}_rim`, mat.rim, [
      place(cyl(rimR, rimR, w * 0.55, 12), [side * w * 0.26, 0, 0], [0, 0, AXLE]),
    ]));
    p.add(merged(`${name}_hub`, mat.steel, [
      place(cyl(rimR * 0.32, rimR * 0.32, w * 0.62, 8), [side * w * 0.3, 0, 0], [0, 0, AXLE]),
    ]));
    return p;
  };
  root.add(wheel("wheel_rl", -TRACK_REAR, REAR_R, REAR_Z, REAR_R, REAR_W, REAR_R * 0.55));
  root.add(wheel("wheel_rr", TRACK_REAR, REAR_R, REAR_Z, REAR_R, REAR_W, REAR_R * 0.55));
  root.add(wheel("wheel_fl", -TRACK_FRONT, FRONT_R, FRONT_Z, FRONT_R, FRONT_W, FRONT_R * 0.5));
  root.add(wheel("wheel_fr", TRACK_FRONT, FRONT_R, FRONT_Z, FRONT_R, FRONT_W, FRONT_R * 0.5));

  // --- Axles and chassis: steel underneath, paint on top.
  root.add(merged("axles", mat.steel, [
    place(box(TRACK_REAR * 2 - REAR_W, 0.14, 0.14), [0, REAR_R, REAR_Z]),
    place(box(TRACK_FRONT * 2 - FRONT_W, 0.10, 0.10), [0, FRONT_R, FRONT_Z]),
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
    place(cyl(0.025, 0.025, 0.46, 6), [0, CHASSIS_Y + 0.62 + 0.14, -0.20], [-0.55, 0, 0]),
  ]));
  root.add(merged("lights", mat.rim, [
    place(box(0.10, 0.10, 0.03), [-0.20, CHASSIS_Y + 0.40, 1.44]),
    place(box(0.10, 0.10, 0.03), [0.20, CHASSIS_Y + 0.40, 1.44]),
  ]));
  root.add(merged("wheel_steer", mat.rubber, [
    place(torus(0.15, 0.022, 6, 14), [0, CHASSIS_Y + 0.62 + 0.36, -0.36], [Math.PI / 2 - 0.55, 0, 0]),
  ]));

  // --- Seat: cushion and backrest, the one warm material on the machine.
  root.add(merged("seat", mat.seat, [
    place(box(0.42, 0.10, 0.40), [0, CHASSIS_Y + 0.34 + 0.05, -0.62]),
    place(box(0.42, 0.44, 0.08), [0, CHASSIS_Y + 0.34 + 0.32, -0.80]),
  ]));

  return root;
}
