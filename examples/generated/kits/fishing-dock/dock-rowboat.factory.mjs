/**
 * Fishing Dock — clinker rowing dinghy with two oars, tied up alongside.
 *
 * Reference: a two-person lake dinghy is 3.0~3.6 m long, 1.2~1.4 m in the beam, 0.40~0.50 m
 * deep amidships and floats on a 0.18~0.22 m draft. This one measures 3.10 x 1.28 x 0.55 m and
 * its documented draft is 0.190 m.
 *
 * THE FILE SITS ON y = 0, NOT ON THE WATER
 * ----------------------------------------
 * A floating asset has no honest place to put its own origin: whoever buys it decides where
 * the water is. So the keel sits on y = 0 like every other part of the kit — drop it on a
 * floor and it stands on its keel — and the draft is published instead. Sink the model
 * 0.190 m and the painted waterline is exactly at the surface.
 *
 * WHY THE HULL IS A SHELL AND NOT A SOLID
 * ---------------------------------------
 * A boat is the one part of this kit a buyer looks INTO. A lofted solid hull is 108 triangles
 * and looks right from every angle except the one that matters — from the dock, above it,
 * where it reads as a boat-shaped brick. So the hull is built twice: an outer skin, an inner
 * skin 32 mm inside it, joined by a gunwale strip along both sheers and by a face across the
 * transom and the stem. That is 4x the triangles of the solid and it is the difference between
 * a boat and a decoy.
 *
 * MOTION
 * ------
 * One clip, `bob`: the hull rolls 2.2 degrees each way about its length and lifts 18 mm, on a
 * 4-second cycle. Rotation and translation only — no scale channel anywhere in this kit. The
 * pivot `boat_pivot` sits on the waterline at the middle of the boat, which is where a real
 * hull actually pivots, so the roll does not swing the bow through the air.
 */
import { DOCK, createKit, finalize, selectMaterials } from "./dock-kit.mjs";

const LENGTH = 3.1;
const HALF_LENGTH = LENGTH / 2;
/** Published draft. Nothing in the file is modelled at this height; it is the number to sink by. */
export const DRAFT_METRES = 0.19;
/** Plank thickness between the outer and inner skins. */
const SKIN = 0.032;

/**
 * Half-sections, keel first, sheer last. `z` is the half-beam, `y` the height over the keel.
 * The other half is mirrored by the builder, so the boat cannot come out lopsided.
 */
const SECTION = [
  [0.0, 0.0],
  [0.055, 0.3],
  [0.17, 0.52],
  [0.33, 0.615],
  [0.455, 0.64],
];

/**
 * Stations along the boat. `beam` scales the half-section, `rocker` lifts the keel and `sheer`
 * lifts the gunwale — the two together are what give a boat its curve instead of leaving it a
 * bathtub with pointed ends.
 */
const STATIONS = [
  { x: -HALF_LENGTH, beam: 0.6, rocker: 0.13, sheer: 0.055 },
  { x: -1.15, beam: 0.86, rocker: 0.055, sheer: 0.022 },
  { x: -0.6, beam: 0.98, rocker: 0.012, sheer: 0.004 },
  { x: 0.0, beam: 1.0, rocker: 0.0, sheer: 0.0 },
  { x: 0.6, beam: 0.96, rocker: 0.015, sheer: 0.006 },
  { x: 1.15, beam: 0.72, rocker: 0.075, sheer: 0.032 },
  { x: HALF_LENGTH, beam: 0.16, rocker: 0.2, sheer: 0.095 },
];

/** One station's cross-section as a polyline running port sheer -> keel -> starboard sheer. */
function polyline(station, inset) {
  const half = SECTION.map(([y, z], index) => {
    const t = index / (SECTION.length - 1);
    const width = Math.max(0, z * station.beam - inset);
    const height = y + station.rocker * (1 - t) + station.sheer * t + inset * (1 - t) * 0.9;
    return [station.x, height, width];
  });
  const line = [];
  for (let i = half.length - 1; i >= 1; i -= 1) line.push([half[i][0], half[i][1], -half[i][2]]);
  for (let i = 0; i < half.length; i += 1) line.push(half[i]);
  return line;
}

export default function createDockRowboat(THREE) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, ["hullWhite", "hullBlue", "dockPlank", "dockPlankPale", "iron", "ropeHemp"]);
  const root = kit.group("dock_rowboat");
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "fishing-dock",
    assetId: "fishing-dock.rowboat.m1",
    upAxis: "+Y",
    scaleMeters: 1,
    floats: true,
    draftMetres: DRAFT_METRES,
    sockets: ["boat_pivot"],
    socketNotes: {
      boat_pivot: "Hull pivot on the waterline at midships. The `bob` clip rolls it about +X and lifts it along +Y. Rest pose is level.",
    },
  };

  // Everything hangs off the pivot, so the whole boat moves as one and nothing is left behind
  // floating in the rest position.
  const pivot = kit.group("boat_pivot", [0, DRAFT_METRES, 0]);
  root.add(pivot);
  const local = (y) => y - DRAFT_METRES;

  const outer = STATIONS.map((station) => polyline(station, 0));
  const inner = STATIONS.map((station) => polyline(station, SKIN));
  const lift = (line) => line.map(([x, y, z]) => [x, local(y), z]);
  const outerLocal = outer.map(lift);
  const innerLocal = inner.map(lift);

  const centreOf = (a, b, c, d) => [
    (a[0] + b[0] + c[0] + d[0]) / 4,
    (a[1] + b[1] + c[1] + d[1]) / 4,
    (a[2] + b[2] + c[2] + d[2]) / 4,
  ];

  const hull = [];
  const strake = [];
  const count = outerLocal[0].length;
  for (let s = 0; s < outerLocal.length - 1; s += 1) {
    for (let i = 0; i < count - 1; i += 1) {
      const a = outerLocal[s][i];
      const b = outerLocal[s][i + 1];
      const c = outerLocal[s + 1][i + 1];
      const d = outerLocal[s + 1][i];
      const mid = centreOf(a, b, c, d);
      // The top strake of each side goes to its own mesh and its own colour. Splitting the
      // shell by material is the only way to paint a band on an untextured hull without either
      // a coplanar decal that z-fights or a separate strip of boxes that cannot follow the
      // curve — the first pass of this part did the second and left blue tabs sticking out of
      // the sheer at every station.
      kit.pushFace(i === 0 || i === count - 2 ? strake : hull, [a, b, c, d], [0, mid[1] - local(0.28), mid[2]]);
      const ia = innerLocal[s][i];
      const ib = innerLocal[s][i + 1];
      const ic = innerLocal[s + 1][i + 1];
      const id = innerLocal[s + 1][i];
      const imid = centreOf(ia, ib, ic, id);
      // The inner skin faces the other way: into the boat.
      kit.pushFace(hull, [ia, ib, ic, id], [0, local(0.28) - imid[1], -imid[2]]);
    }
    // Gunwale strip, both sheers.
    for (const edge of [0, count - 1]) {
      kit.pushFace(
        hull,
        [outerLocal[s][edge], innerLocal[s][edge], innerLocal[s + 1][edge], outerLocal[s + 1][edge]],
        [0, 1, 0],
      );
    }
  }
  // Transom and stem: a face joining the outer skin to the inner one, so the shell is closed.
  for (const [index, outward] of [[0, [-1, 0, 0]], [outerLocal.length - 1, [1, 0, 0]]]) {
    for (let i = 0; i < count - 1; i += 1) {
      kit.pushFace(
        hull,
        [outerLocal[index][i], outerLocal[index][i + 1], innerLocal[index][i + 1], innerLocal[index][i]],
        outward,
      );
    }
  }
  const hullMesh = new THREE.Mesh(kit.fromTriangles(hull), mat.hullWhite);
  hullMesh.geometry.computeVertexNormals();
  hullMesh.name = "boat_hull";
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  pivot.add(hullMesh);

  const strakeMesh = new THREE.Mesh(kit.fromTriangles(strake), mat.hullBlue);
  strakeMesh.geometry.computeVertexNormals();
  strakeMesh.name = "boat_sheer_strake";
  strakeMesh.castShadow = true;
  strakeMesh.receiveShadow = true;
  pivot.add(strakeMesh);

  // Two thwarts and a stern bench, on real risers. The oars rest on these, which is why they
  // are modelled at all: without them the oars would be floating in the hull.
  const seats = [];
  for (const [x, width] of [[-1.02, 0.9], [-0.15, 1.16], [0.75, 0.98]]) {
    seats.push(kit.place(kit.bar(0.2, 0.035, width, DOCK.CHAMFER, 2), [x, local(0.4), 0]));
    seats.push(kit.place(kit.box(0.06, 0.09, width * 0.86), [x, local(0.34), 0]));
  }
  // Floorboards: four boards on the bottom, which is what stops the inside reading as a bowl.
  for (let i = 0; i < 4; i += 1) {
    const z = -0.24 + i * 0.16;
    seats.push(kit.place(kit.bar(2.0, 0.026, 0.13, DOCK.CHAMFER, 0), [-0.2, local(0.115), z]));
  }
  pivot.add(kit.merged("boat_seats", mat.dockPlank, seats));

  /**
   * A point on the gunwale, interpolated between the two stations that bracket `x`.
   *
   * The oarlocks and the painter ring are bolted to the sheer, and the sheer is a curve. The
   * first pass put them at hand-picked heights and clunk_asset_inspect measured the result:
   * `boat_ironwork` touching nothing, 65.9 mm clear of the hull. Reading the position off the
   * same station table the hull is lofted from is what makes the fitting land on the timber.
   */
  const sheerAt = (x) => {
    let index = 0;
    while (index < STATIONS.length - 2 && STATIONS[index + 1].x < x) index += 1;
    const a = outer[index][count - 1];
    const b = outer[index + 1][count - 1];
    const span = STATIONS[index + 1].x - STATIONS[index].x;
    const t = Math.min(1, Math.max(0, (x - STATIONS[index].x) / span));
    return [x, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  };

  // Oarlocks and the painter's ring, in iron. Each socket straddles the gunwale it is bolted
  // through, so half of it is above the sheer and half below.
  const ironwork = [];
  const lockX = -0.15;
  const lock = sheerAt(lockX);
  for (const side of [-1, 1]) {
    ironwork.push(kit.place(kit.cyl(0.022, 0.022, 0.11, 6), [lockX, local(lock[1] + 0.015), side * lock[2]]));
    ironwork.push(kit.place(kit.torus(0.035, 0.011, 4, 8), [lockX, local(lock[1] + 0.1), side * lock[2]], [0, Math.PI / 2, 0]));
  }
  const stem = sheerAt(1.46);
  ironwork.push(kit.place(kit.torus(0.05, 0.012, 4, 10), [1.46, local(stem[1] - 0.008), 0], [0, Math.PI / 2, 0]));
  pivot.add(kit.merged("boat_ironwork", mat.iron, ironwork));

  // Two oars stowed fore and aft along the boat, resting on the thwarts. Stowed rather than
  // shipped in the locks: an oar sticking 2 m out of the hull turns the product photograph
  // into a picture of a stick, and a stowed oar cannot be floating in mid-air.
  const oars = [];
  for (const side of [-1, 1]) {
    const z = side * 0.34;
    const tilt = side * 0.045;
    oars.push(kit.place(kit.cyl(0.024, 0.031, 1.62, 6), [-0.28, local(0.435), z], [tilt, 0, Math.PI / 2]));
    oars.push(kit.place(kit.chamferBox(0.46, 0.019, 0.135, 0.006), [0.66, local(0.435), z + tilt * 0.5], [0, 0, 0.02]));
    oars.push(kit.place(kit.cyl(0.028, 0.028, 0.13, 6), [-1.14, local(0.435), z - tilt * 0.4], [tilt, 0, Math.PI / 2]));
  }
  pivot.add(kit.merged("boat_oars", mat.dockPlankPale, oars));

  // A coil of painter line in the bow, so the boat looks tied up rather than parked.
  const line = [];
  for (let i = 0; i < 3; i += 1) {
    line.push(kit.place(kit.torus(0.1 - i * 0.014, 0.018, 4, 10), [1.16, local(0.14 + i * 0.03), 0], [Math.PI / 2, 0, i * 0.4]));
  }
  pivot.add(kit.merged("boat_painter", mat.ropeHemp, line));

  return finalize(THREE, root);
}

/**
 * The motion this product ships. Read by ./build.mjs, which turns it into a real glTF
 * animation on the named node. Rotation and translation channels only.
 */
export const CLIPS = [
  {
    name: "bob",
    koreanName: "물결에 흔들리기",
    seconds: 4,
    tracks: [
      {
        node: "boat_pivot",
        times: [0, 1, 2, 3, 4],
        rotationDegrees: [
          [0, 0, 0],
          [0.9, 0, 2.2],
          [0, 0, 0],
          [-0.9, 0, -2.2],
          [0, 0, 0],
        ],
        positionOffsets: [
          [0, 0, 0],
          [0, 0.018, 0],
          [0, 0, 0],
          [0, -0.018, 0],
          [0, 0, 0],
        ],
      },
    ],
  },
];
