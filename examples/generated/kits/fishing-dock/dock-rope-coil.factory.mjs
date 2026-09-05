/**
 * Fishing Dock — a coil of mooring rope flaked down on the boards.
 *
 * Five turns laid one on the next, each one a little smaller and each rotated on from the last
 * so the coil spirals instead of stacking into a doughnut, plus a tail running out of it to the
 * bight where the last hand let go.
 *
 * Reference: 24 mm three-strand mooring line coiled by hand makes a heap 0.55~0.70 m across and
 * 0.12~0.18 m high. Measured here: see the report — the numbers are read off the file.
 */
import { createKit, finalize, hashSigned, selectMaterials } from "./dock-kit.mjs";

const TUBE = 0.026;
const TURNS = 5;

export default function createDockRopeCoil(THREE) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, ["ropeHemp", "dockPlank"]);
  const root = kit.group("dock_rope_coil");
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "fishing-dock",
    assetId: "fishing-dock.rope-coil.m1",
    upAxis: "+Y",
    scaleMeters: 1,
    ropeDiameterMetres: TUBE * 2,
  };

  const coil = [];
  for (let i = 0; i < TURNS; i += 1) {
    const radius = 0.28 - i * 0.026;
    const y = TUBE + i * TUBE * 1.55;
    // A hand-flaked coil is never flat: each turn is tipped a degree or two off the last.
    const tipX = 0.05 * hashSigned(i, 1, 0, 17);
    const tipZ = 0.05 * hashSigned(i, 2, 0, 23);
    // The spin goes in the Z channel, not the Y one. A torus is authored in the XY plane, and
    // three.js applies Z first and X last: putting the spin in Y turned every ring on its edge
    // and stood the coil up like a wheel. Z spins the ring inside its own plane, which is what a
    // flaked coil does, and X is what lays it flat.
    coil.push(kit.place(kit.torus(radius, TUBE, 4, 14), [tipX * 0.4, y, tipZ * 0.4], [Math.PI / 2 + tipX, tipZ, i * 0.9]));
  }
  root.add(kit.merged("rope_coil", mat.ropeHemp, coil));

  // The tail: four straight lengths that leave the coil, swing round and finish in a loose
  // bight. Straight segments rather than a curve because a low-poly rope IS straight segments,
  // and pretending otherwise costs triangles that do not show.
  const tail = [];
  const path = [
    [0.27, TUBE, 0.05],
    [0.44, TUBE, -0.06],
    [0.58, TUBE, -0.24],
    [0.49, TUBE, -0.42],
    [0.3, TUBE, -0.4],
  ];
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i];
    const b = path[i + 1];
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const yaw = Math.atan2(-(b[2] - a[2]), b[0] - a[0]);
    tail.push(
      kit.place(kit.cyl(TUBE, TUBE, length + TUBE, 6), [(a[0] + b[0]) / 2, TUBE, (a[2] + b[2]) / 2], [0, yaw, Math.PI / 2]),
    );
  }
  root.add(kit.merged("rope_tail", mat.ropeHemp, tail));

  // A whipped end: two turns of tarred twine at the cut end, in the darker timber value so it
  // reads as a detail rather than as more rope.
  root.add(
    kit.merged("rope_whipping", mat.dockPlank, [
      kit.place(kit.cyl(TUBE + 0.004, TUBE + 0.004, 0.032, 6), [0.3, TUBE, -0.4], [0, 0, Math.PI / 2]),
    ]),
  );

  return finalize(THREE, root);
}
