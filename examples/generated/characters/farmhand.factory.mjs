/**
 * Farmhand — a rigged low-poly character, written as code.
 *
 * Every other model in this catalogue is furniture: it has at most one hinge, so it can
 * be sold as a still or as a door opening. A character is the thing a top-down game
 * actually needs, and it needs a rig — limbs on named pivots that a clip can rotate, so
 * one mesh produces a walk cycle instead of sixteen unrelated drawings.
 *
 * The pivot names are the interface, and they are placed where the joint is, not at the
 * limb's centre: rotating `leg_l_pivot` swings the leg from the hip, because the pivot
 * sits on the hip line and the geometry hangs below it. Same discipline as the fence
 * gate's `gate_pivot` sitting on the hinge.
 *
 *   root_pivot   whole body — used for the bob, and for facing if a consumer wants it
 *     torso_pivot   lean
 *       arm_l_pivot / arm_r_pivot   shoulder
 *       head_pivot                  neck
 *     leg_l_pivot  / leg_r_pivot    hip
 *
 * Proportions are deliberately chunky rather than realistic: at 64 px a naturalistic
 * figure loses its head and hands to the grid, so the head is a third of the height and
 * the limbs are thick enough to survive two pixels of shading.
 *
 * Footprint 0.62 W x 1.62 H x 0.34 D, origin on the ground between the feet — the same
 * contact convention the rest of the catalogue uses, so a sprite baked from this drops
 * onto a tile without an offset.
 */

const PALETTE = {
  skin: { color: 0xe8b48c, roughness: 0.86 },
  hair: { color: 0x6b4a2f, roughness: 0.9 },
  shirt: { color: 0xc7643f, roughness: 0.88 },
  denim: { color: 0x3f5d80, roughness: 0.9 },
  boot: { color: 0x4a3526, roughness: 0.9 },
  straw: { color: 0xd8b567, roughness: 0.92 },
};

// Metres. The head is deliberately large: at 64 px it has to survive the grid.
const LEG_TOP = 0.62;
const HIP_W = 0.13;
const TORSO_TOP = 1.16;
const SHOULDER_W = 0.19;
const HEAD_R = 0.19;

export default function createFarmhand(THREE, addons) {
  const { mergeGeometries } = addons;

  const mat = Object.fromEntries(
    Object.entries(PALETTE).map(([name, spec]) => [
      name,
      Object.assign(new THREE.MeshStandardMaterial(spec), { name: `farmhand_${name}` }),
    ]),
  );

  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt, rb, h, seg) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const sphere = (r, w, h) => new THREE.SphereGeometry(r, w, h);

  const place = (geometry, position = [0, 0, 0], rotation = [0, 0, 0]) => {
    const g = geometry.clone();
    g.rotateX(rotation[0]); g.rotateY(rotation[1]); g.rotateZ(rotation[2]);
    g.translate(position[0], position[1], position[2]);
    return g;
  };

  /** One named mesh per material group: the silhouette keeps the detail, the runtime keeps the budget. */
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
  root.name = "farmhand";

  // --- Legs. Each hangs under a pivot placed on the hip line, so a rotation swings the
  //     whole leg from the hip rather than shearing it about its middle.
  for (const side of [-1, 1]) {
    const leg = pivot(side < 0 ? "leg_l_pivot" : "leg_r_pivot", [side * HIP_W, LEG_TOP, 0]);
    leg.add(merged(side < 0 ? "leg_l" : "leg_r", mat.denim, [
      place(box(0.15, LEG_TOP - 0.12, 0.16), [0, -(LEG_TOP - 0.12) / 2, 0]),
    ]));
    leg.add(merged(side < 0 ? "boot_l" : "boot_r", mat.boot, [
      place(box(0.17, 0.12, 0.24), [0, -LEG_TOP + 0.06, 0.03]),
    ]));
    root.add(leg);
  }

  // --- Torso and everything it carries.
  const torso = pivot("torso_pivot", [0, LEG_TOP, 0]);
  torso.add(merged("torso", mat.shirt, [
    place(box(0.42, TORSO_TOP - LEG_TOP, 0.24), [0, (TORSO_TOP - LEG_TOP) / 2, 0]),
  ]));
  // Dungaree bib and straps, so the shirt and the denim read as two garments at 64 px
  // rather than one block that changes colour halfway up.
  torso.add(merged("bib", mat.denim, [
    place(box(0.26, 0.26, 0.02), [0, 0.30, 0.125]),
    place(box(0.06, 0.30, 0.02), [-0.10, 0.44, 0.125]),
    place(box(0.06, 0.30, 0.02), [0.10, 0.44, 0.125]),
  ]));

  for (const side of [-1, 1]) {
    const arm = pivot(side < 0 ? "arm_l_pivot" : "arm_r_pivot", [side * SHOULDER_W, TORSO_TOP - LEG_TOP - 0.06, 0]);
    arm.add(merged(side < 0 ? "arm_l" : "arm_r", mat.shirt, [
      place(box(0.11, 0.30, 0.12), [0, -0.15, 0]),
    ]));
    arm.add(merged(side < 0 ? "hand_l" : "hand_r", mat.skin, [
      place(box(0.11, 0.11, 0.12), [0, -0.36, 0]),
    ]));
    torso.add(arm);
  }

  const head = pivot("head_pivot", [0, TORSO_TOP - LEG_TOP + 0.02, 0]);
  head.add(merged("head", mat.skin, [
    place(sphere(HEAD_R, 10, 8), [0, HEAD_R * 0.9, 0]),
  ]));
  head.add(merged("hair", mat.hair, [
    place(sphere(HEAD_R * 1.02, 10, 6), [0, HEAD_R * 1.05, -0.01]),
  ]));
  // Straw hat: a shallow cone on a wide brim. It is what makes the silhouette read as a
  // farmhand from behind, where the face is not visible at all.
  head.add(merged("hat", mat.straw, [
    // Brim radius is the one number that decides whether this reads as a person in a hat
    // or as a hat with legs: from the three-quarter camera a 0.30 m brim covered the
    // shoulders entirely. 0.21 still says straw hat and leaves the body visible.
    place(cyl(0.21, 0.21, 0.022, 12), [0, HEAD_R * 1.42, 0]),
    place(cyl(0.095, 0.15, 0.10, 12), [0, HEAD_R * 1.42 + 0.06, 0]),
  ]));
  torso.add(head);

  root.add(torso);
  return root;
}
