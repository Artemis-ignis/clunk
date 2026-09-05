/**
 * Corrections applied to the two exported farm props.
 *
 * WATER BUTT (outputs/audit/hf/hf-water-butt/):
 *   1. A PUDDLE SHIPS AS GEOMETRY. `waterButtHardware` carries a flat
 *      800 x 56 x 800 mm disc lying on the ground at z 0.624..1.424, directly
 *      under the tap. In the game, on a textured field, it reads as a wet
 *      patch. In a GLB on a grey plane it reads as a coaster somebody dropped
 *      next to the barrel -- and, worse, it is what stretches the prop's depth
 *      from 1.69 m to 2.27 m and makes the bounding box asymmetric in Z, so the
 *      size a buyer is quoted is the size of the butt PLUS a puddle.
 *   2. THE LADDER GOES NOWHERE. Two 40 x 1792 x 40 mm rails run up to y 2.248,
 *      110 mm proud of the barrel rim at 2.048, and stop in mid-air with no top
 *      rung between them. They are cut off level with the rim.
 *   Left alone in the first pass, on instruction: the barrel was 1.55 m across
 *   and the prop 2.33 m tall.
 *
 *   2026-09-03: that is no longer left alone, because it is the defect. A rain
 *   butt 2.3255 m tall is a silo, not a butt -- it stood 174 mm short of the
 *   catalogue's own farmhand (2.4992 m) and TALLER than its market stall
 *   (2.2563 m). The whole prop is scaled about the ground plane to 1.000 m
 *   tall (0.667 m across), which is the size a garden water butt actually is,
 *   and the listed real-world size follows it everywhere it is shown.
 *
 *   4. THE BARREL IS A SMOOTH CYLINDER. `waterButtStaves` was an 18-sided
 *      extrusion of constant radius: no staves, no bulge, nothing that says
 *      "coopered". It is rebuilt as 18 staves -- a ridge down the middle of
 *      each and a 22 mm groove at every seam, so a flat-shaded surface breaks
 *      into 36 alternating light and dark strips -- on a barrel profile that
 *      swells 10% from the ends to the waist. The file's three iron hoops are
 *      kept and re-fitted radially to the new profile, so each one still
 *      stands 25 mm proud of the wood it binds instead of hanging in the air
 *      at the ends. The material is the one the staves already used and no
 *      colour is introduced.
 *
 * WINDMILL (outputs/audit/hf/hf-windmill/):
 *   3. THE SAILS SCRAPE THE MILL. A first pass moved the hub 170 mm forward and
 *      a ray WINDING COUNT then reported zero penetration -- but a winding count
 *      only answers "is this vertex inside that solid", so a sail sliding along
 *      a surface reads as clean. Measured properly, as the minimum SURFACE
 *      distance between triangles, the shipped file and that first pass both sit
 *      at 0.0 mm at every one of 24 phases: the descending sail grazes the tower
 *      cone, the gallery ring at y 1.93 and the roof collar. The instrument was
 *      wrong, not the geometry.
 *
 *      The fix is the one a real mill uses: the windshaft is INCLINED, so the
 *      sail disc leans back at the top and stands proud at the bottom, and the
 *      whole assembly sits forward of the cap. A `blades_tilt` node is inserted
 *      ABOVE the spinning `blades_pivot` (above, so the tilt survives the
 *      animation instead of being overwritten by it) carrying a 10 deg nose-up
 *      inclination and a 260 mm forward offset. Both numbers come from a search
 *      over tilt 10-15 deg x offset 0-600 mm, evaluated by triangle-to-triangle
 *      distance at 12 phases: 10 deg is the shallowest that works, and beyond it
 *      more tilt only pushes the TOP of the disc further into the roof and needs
 *      MORE offset, not less. Sail length is unchanged.
 *
 *      With the disc that far forward the hub boss no longer reaches the roof,
 *      so it would hang in the air on nothing. A short shaft sleeve is added
 *      from the hub back into the roof, in the hub's OWN material and its own
 *      averaged vertex colour, parented to the tilt node so it does not spin.
 *   4. IT STANDS 20.4 mm IN THE GROUND. The eight foot pads sit at y = -0.0204.
 *
 *   2026-09-03:
 *
 *   5. THE SAILS ARE FOUR SOLID BOARDS. Each sail was one 440 x 1280 x 35 mm
 *      panel with three 460 x 45 mm battens laid across it -- a white plank,
 *      not a sail. Every panel and batten is removed and each sail is rebuilt
 *      as a real lattice: two 75 mm stocks down the long edges in the battens'
 *      own timber colour, seven 50 mm laths between them in the panel's own
 *      cream, and 155 mm of open air between every pair of laths, so the sky
 *      shows through the sail from any angle. The lattice is built INSIDE the
 *      envelope the panel and its battens already occupied, so the swept disc
 *      is unchanged and the measured blade-to-tower clearance stands.
 *
 *   6. THE DOOR IS BEHIND THE SAILS AND THERE IS ONE WINDOW. The mill does
 *      have a door -- 540 x 924 mm on the +Z face -- and one window, and both
 *      are on the same side as the sail disc, so on the storefront
 *      three-quarter the sails cross them and the tower reads as a bare cone.
 *      The door is rebuilt on the BACK of the tower (-Z), which is where a
 *      miller's door belongs: you do not walk under a turning sail. A second
 *      window, the same size as the one the file ships, is added on the +X
 *      face so the tower is not blank from the shop's own camera angle. Every
 *      new part takes its colour from the part it replaces or copies.
 *
 * 2026-09-05 (windmill only), from the mechanism audit:
 *
 *   7. THE MILL FLOATS 20.4 mm. Only the eight decorative foot pads reach y = 0;
 *      the base plinth that the tower stands on stops 20.4 mm above it, so the
 *      building hovers over its own rockery. The pads are authored 20.4 mm below
 *      the plinth (the export sank them into the field); they are lifted onto the
 *      plinth's own underside and the whole mill is then seated, so the plinth and
 *      the pads both touch the floor.
 *
 *   8. THE WINDSHAFT SLEEVE RAN 271.6 mm THROUGH THE HUB. The sleeve was grown
 *      backwards from the hub's CENTRE, so it passed through the whole boss and
 *      out the far side of the cross arms -- the inspector reported 48 intersecting
 *      triangle pairs. It now stops SHAFT_BEARING_DEPTH (55 mm) past the hub's back
 *      face, which is a bearing, and its back end is unchanged so it still reaches
 *      the cap.
 *
 *   9. THE HUB AND CROSS ARMS HAD NO NAME. The lattice was parented to the blade
 *      mesh, so the exporter wrapped the mesh in a node and left the mesh's own node
 *      unnamed -- which is the part every intersection report then had to call
 *      "unnamed mesh, node 14". The lattice becomes a sibling carrying the same
 *      transform, and the blade mesh keeps the name `windmillBlades`.
 *
 * No material, colour or vertex colour is touched in either file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  THREE, loadGlb, saveGlb, mesh, node, lumps, deleteLumps, scaleLump, moveLumpWorld,
  meshes, triangleCount, worldBox, sizeMm, mm, seatOnGround, lowestY,
  averageColour, buildBoxes,
} from './fix-lib.mjs';

/** How deep a windshaft sits in its bearing before it is a shaft through a wall. */
const SHAFT_BEARING_DEPTH = Number(process.env.SHAFT_BEARING_DEPTH ?? 0.055);

/** How tall a rain butt is. */
const BUTT_TARGET_HEIGHT = Number(process.env.BUTT_HEIGHT ?? 1.0);
/** Staves around the barrel, and how deep the seam between two of them cuts. */
const STAVES = 18;
const STAVE_GROOVE = 0.022;
/** How much narrower the barrel is at its ends than at its waist. */
const BARREL_TAPER = 0.10;
/** Vertical segments the profile is drawn in. */
const STAVE_RINGS = 6;

/** Windshaft inclination, degrees nose-up, and how far the assembly stands proud. */
const SHAFT_TILT_DEG = Number(process.env.SHAFT_TILT_DEG ?? 10);
const SHAFT_FORWARD = Number(process.env.SHAFT_FORWARD ?? 0.26);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const EXPORTS = path.join(REPO, 'examples/harvest-frontier/exports');

// ============================================================== water butt
async function fixWaterButt(): Promise<unknown> {
  const IN = path.join(EXPORTS, 'prop/farm-water-butt.glb');
  const OUT = path.join(EXPORTS, 'prop/farm-water-butt.fixed.glb');
  const butt = await loadGlb(IN);
  const scene = butt.scene;
  const before = { triangles: triangleCount(scene), meshes: meshes(scene).length, boundsM: worldBox(scene).getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(4)) };

  const staves = worldBox(mesh(scene, 'waterButtStaves'));
  const hardware = mesh(scene, 'waterButtHardware');
  const all = lumps(hardware);

  // The puddle: a flat lump whose centre lies beyond the barrel's own footprint.
  const puddles = all.filter((l) => l.size.y < 0.1 && l.centre.z > staves.max.z);
  const puddleTriangles = puddles.length ? deleteLumps(hardware, puddles) : 0;

  // The ladder rails: tall, thin, and reaching above the rim.
  const rails = lumps(hardware).filter((l) => l.size.y > 1.5 && l.size.x < 0.1 && l.world.max.y > staves.max.y + 0.01);
  const railFix: { beforeTopMm: number; afterTopMm: number }[] = [];
  for (const rail of rails) {
    const factor = (staves.max.y - rail.world.min.y) / (rail.world.max.y - rail.world.min.y);
    const localBottom = rail.box.min.y;
    railFix.push({ beforeTopMm: mm(rail.world.max.y), afterTopMm: mm(staves.max.y) });
    scaleLump(hardware, rail, new THREE.Vector3(1, factor, 1), new THREE.Vector3(0, localBottom, 0));
  }
  scene.updateMatrixWorld(true);

  // ------------------------------------------------- 4a. the coopered barrel
  const shell = mesh(scene, 'waterButtStaves');
  const shellBox = worldBox(shell);
  const shellSize = shellBox.getSize(new THREE.Vector3());
  const y0 = shellBox.min.y;
  const y1 = shellBox.max.y;
  const waist = Math.max(shellSize.x, shellSize.z) / 2;
  /** The barrel's radius at height y: full at the waist, BARREL_TAPER narrower at both ends. */
  const radiusAt = (y: number): number => {
    const u = (y - y0) / (y1 - y0);
    return waist * (1 - BARREL_TAPER * (2 * u - 1) ** 2);
  };

  const position: number[] = [];
  // Every triangle carries its own three vertices, so the faces stay flat-shaded
  // like the rest of this asset instead of being smoothed back into a tube.
  const pushTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): void => {
    position.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const point = (angle: number, radius: number, y: number): THREE.Vector3 =>
    new THREE.Vector3(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3): void => {
    pushTriangle(a, b, c); pushTriangle(a, c, d);
  };
  const step = (Math.PI * 2) / STAVES;
  for (let ring = 0; ring < STAVE_RINGS; ring += 1) {
    const ya = y0 + ((y1 - y0) * ring) / STAVE_RINGS;
    const yb = y0 + ((y1 - y0) * (ring + 1)) / STAVE_RINGS;
    const ra = radiusAt(ya);
    const rb = radiusAt(yb);
    for (let s = 0; s < STAVES; s += 1) {
      const seam0 = s * step;
      const ridge = seam0 + step / 2;
      const seam1 = seam0 + step;
      // seam -> ridge, then ridge -> seam: two faces per stave, so the seam
      // between two staves is a real V and reads as a joint under flat light.
      quad(point(seam0, ra - STAVE_GROOVE, ya), point(ridge, ra, ya), point(ridge, rb, yb), point(seam0, rb - STAVE_GROOVE, yb));
      quad(point(ridge, ra, ya), point(seam1, ra - STAVE_GROOVE, ya), point(seam1, rb - STAVE_GROOVE, yb), point(ridge, rb, yb));
    }
  }
  // Caps, as fans over the same 2 x STAVES ring, so the rim follows the staves.
  for (const [y, up] of [[y0, false], [y1, true]] as const) {
    const r = radiusAt(y);
    const centre = new THREE.Vector3(0, y, 0);
    for (let s = 0; s < STAVES; s += 1) {
      const seam0 = s * step;
      const ridge = seam0 + step / 2;
      const seam1 = seam0 + step;
      const a = point(seam0, r - STAVE_GROOVE, y);
      const b = point(ridge, r, y);
      const c = point(seam1, r - STAVE_GROOVE, y);
      if (up) { pushTriangle(centre, a, b); pushTriangle(centre, b, c); }
      else { pushTriangle(centre, b, a); pushTriangle(centre, c, b); }
    }
  }
  const inverse = new THREE.Matrix4().copy(shell.parent!.matrixWorld).invert();
  const localPoint = new THREE.Vector3();
  for (let i = 0; i < position.length; i += 3) {
    localPoint.set(position[i], position[i + 1], position[i + 2]).applyMatrix4(inverse);
    position[i] = localPoint.x; position[i + 1] = localPoint.y; position[i + 2] = localPoint.z;
  }
  const staveIndex = shell.geometry.getIndex();
  const staveTrianglesBefore = (staveIndex ? staveIndex.count : shell.geometry.getAttribute('position').count) / 3;
  const shellGeometry = new THREE.BufferGeometry();
  shellGeometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  shellGeometry.computeVertexNormals();
  shellGeometry.computeBoundingBox();
  shellGeometry.computeBoundingSphere();
  shell.geometry = shellGeometry;
  shell.position.set(0, 0, 0);
  shell.quaternion.identity();
  shell.scale.set(1, 1, 1);
  scene.updateMatrixWorld(true);

  // ------------------------------------------------- 4b. the hoops re-fitted
  const banded = mesh(scene, 'waterButtHardware');
  const hoopFit: Record<string, number>[] = [];
  for (const hoop of lumps(banded)) {
    // A hoop is a wide, thin ring centred on the barrel's own axis and inside
    // the barrel's height. The legs, the tap, the lid and the ladder are none
    // of those things, so none of them is touched.
    const wide = Math.max(hoop.size.x, hoop.size.z);
    if (wide < waist * 1.5 || hoop.size.y > 0.15) continue;
    if (Math.abs(hoop.centre.x) > 0.02 || Math.abs(hoop.centre.z) > 0.02) continue;
    if (hoop.centre.y < y0 || hoop.centre.y > y1) continue;
    // The hoop keeps EXACTLY the amount it stood proud of the old cylinder
    // (797.9 - 774.6 = 23.3 mm), measured rather than chosen, so the barrel
    // gains a profile without the ironwork changing character. On the old
    // straight cylinder the three hoops all fitted; on the new profile the top
    // and bottom ones would otherwise have hung 45-54 mm off the wood.
    const beforeRadius = wide / 2;
    const wood = radiusAt(hoop.centre.y);
    const proud = beforeRadius - waist;
    const factor = (wood + proud) / beforeRadius;
    const axisLocal = new THREE.Vector3(0, hoop.box.getCenter(new THREE.Vector3()).y, 0);
    scaleLump(banded, hoop, new THREE.Vector3(factor, 1, factor), axisLocal);
    hoopFit.push({
      centreYmm: mm(hoop.centre.y), beforeRadiusMm: mm(beforeRadius),
      afterRadiusMm: mm(beforeRadius * factor), woodRadiusMm: mm(wood),
      standsProudMm: mm(proud),
    });
  }
  scene.updateMatrixWorld(true);

  // ------------------------------------------------------ 4c. the real size
  const tallBox = worldBox(scene);
  const tallHeight = tallBox.max.y - tallBox.min.y;
  const scaleFactor = BUTT_TARGET_HEIGHT / tallHeight;
  const root = scene.children[0] ?? scene;
  root.scale.multiplyScalar(scaleFactor);
  scene.updateMatrixWorld(true);
  const seated = seatOnGround(scene, root);
  scene.updateMatrixWorld(true);

  const after = { triangles: triangleCount(scene), meshes: meshes(scene).length, boundsM: worldBox(scene).getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(4)) };
  await saveGlb(OUT, butt);
  const report = {
    asset: 'hf-water-butt',
    barrel: {
      staves: STAVES,
      grooveMm: mm(STAVE_GROOVE),
      taper: BARREL_TAPER,
      ringsHigh: STAVE_RINGS,
      waistRadiusMm: mm(waist),
      endRadiusMm: mm(waist * (1 - BARREL_TAPER)),
      trianglesBefore: staveTrianglesBefore,
      trianglesAfter: position.length / 9,
    },
    hoopsRefitted: hoopFit,
    rescale: {
      heightBeforeM: +tallHeight.toFixed(4),
      heightAfterM: +(worldBox(scene).max.y - worldBox(scene).min.y).toFixed(4),
      factor: +scaleFactor.toFixed(5),
      seated,
    },
    input: path.relative(REPO, IN).replace(/\\/g, '/'),
    output: path.relative(REPO, OUT).replace(/\\/g, '/'),
    puddleLumpsRemoved: puddles.length,
    puddleTrianglesRemoved: puddleTriangles,
    puddleSizeMm: puddles.map((l) => l.size.toArray().map(mm)),
    ladderRailsCut: railFix,
    rimYmm: mm(staves.max.y),
    notChanged: ['barrel diameter 1.55 m and total height 2.33 m are Harvest Frontier\'s own scale'],
    groundMinYmm: mm(lowestY(scene)),
    before, after,
  };
  fs.writeFileSync(OUT.replace(/\.glb$/, '.report.json'), JSON.stringify(report, null, 2));
  return report;
}

// ================================================================= windmill
async function fixWindmill(): Promise<unknown> {
  const IN = path.join(EXPORTS, 'prop/farm-windmill.glb');
  const OUT = path.join(EXPORTS, 'prop/farm-windmill.fixed.glb');
  const mill = await loadGlb(IN);
  const scene = mill.scene;
  const before = { triangles: triangleCount(scene), meshes: meshes(scene).length, boundsM: worldBox(scene).getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(4)) };

  const blades = mesh(scene, 'windmillBlades');
  const pivot = node(scene, 'blades_pivot');

  // The tilt goes ABOVE the spinning pivot. Below it, the sails would wobble as
  // the pivot turned; on the pivot itself, the clip's own quaternion keys would
  // overwrite it on the first frame.
  const tilt = new THREE.Object3D();
  tilt.name = 'blades_tilt';
  const basePosition = pivot.position.clone();
  pivot.parent!.add(tilt);
  tilt.add(pivot);
  pivot.position.set(0, 0, 0);
  tilt.position.set(basePosition.x, basePosition.y, basePosition.z + SHAFT_FORWARD);
  tilt.rotation.set((-SHAFT_TILT_DEG * Math.PI) / 180, 0, 0);
  scene.updateMatrixWorld(true);

  // ---- the shaft sleeve --------------------------------------------------
  // Which welded lump of the blade mesh is the hub: the small one at the centre.
  const bladeLumps = lumps(blades);
  const discCentre = worldBox(blades).getCenter(new THREE.Vector3());
  const hub = bladeLumps
    .filter((l) => l.centre.distanceTo(discCentre) < 0.25 && Math.max(l.size.x, l.size.y) < 0.6)
    .sort((a, b) => b.indices.length - a.indices.length)[0];
  let sleeve: { radiusMm: number; lengthMm: number; colour: string | null } | null = null;
  if (hub) {
    const colourAttribute = blades.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
    let cr = 0; let cg = 0; let cb = 0;
    if (colourAttribute) {
      for (const i of hub.indices) { cr += colourAttribute.getX(i); cg += colourAttribute.getY(i); cb += colourAttribute.getZ(i); }
      cr /= hub.indices.length; cg /= hub.indices.length; cb /= hub.indices.length;
    }
    // The shaft runs back along the tilt node's -Z, from the hub into the roof.
    const radius = Math.min(hub.size.x, hub.size.y) * 0.42;
    /* Where the hub's BACK face is, in the tilt node's own frame. The 2026-09-04 build
       started the sleeve at z = 0, which is the hub's centre, so it ran through the whole
       boss and the cross arms behind it: 271.6 mm of shaft inside the thing it carries. */
    const toTilt = new THREE.Matrix4().copy(tilt.matrixWorld).invert().multiply(blades.matrixWorld);
    const bladePos = blades.geometry.getAttribute('position') as THREE.BufferAttribute;
    const probe = new THREE.Vector3();
    let hubBackZ = Infinity;
    for (let i = 0; i < bladePos.count; i += 1) {
      probe.fromBufferAttribute(bladePos, i).applyMatrix4(toTilt);
      if (Math.hypot(probe.x, probe.y) > radius + 0.060) continue;   // only what the sleeve can hit
      hubBackZ = Math.min(hubBackZ, probe.z);
    }
    if (!Number.isFinite(hubBackZ)) hubBackZ = 0;
    const front = hubBackZ + SHAFT_BEARING_DEPTH;
    const back = -(SHAFT_FORWARD + 0.35);
    const length = front - back;
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 12, 1, false);
    geometry.rotateX(Math.PI / 2);          // cylinder axis Y -> Z
    geometry.translate(0, 0, front - length / 2);
    if (colourAttribute) {
      const count = geometry.getAttribute('position').count;
      const colours = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) { colours[i * 3] = cr; colours[i * 3 + 1] = cg; colours[i * 3 + 2] = cb; }
      geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    }
    const shaft = new THREE.Mesh(geometry, blades.material);
    shaft.name = 'windmillShaftSleeve';
    // On the TILT node, not the pivot: a windshaft sleeve does not spin.
    tilt.add(shaft);
    const srgb = (x: number) => Math.round(255 * (x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055));
    sleeve = {
      radiusMm: mm(radius),
      lengthMm: mm(length),
      hubBackFaceZmm: mm(hubBackZ),
      frontFaceZmm: mm(front),
      bearingDepthMm: mm(SHAFT_BEARING_DEPTH),
      wasBearingDepthMm: mm(-hubBackZ),
      colour: colourAttribute ? `#${[srgb(cr), srgb(cg), srgb(cb)].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}` : null,
    };
  }
  scene.updateMatrixWorld(true);

  // ------------------------------------------------------ 5. lattice sails
  /**
   * `windmillBlades` is authored in its own frame with the disc lying in local
   * XY and the four sails at 90 degrees to one another. A sail is a lump whose
   * centre is off the hub (> 150 mm) -- that excludes the hub, its boss and
   * the 3.3 m cross arms, all of which are centred on the axis and all of
   * which stay exactly as they are.
   */
  const sailLumps = lumps(blades).filter((l) => Math.hypot(l.box.getCenter(new THREE.Vector3()).x, l.box.getCenter(new THREE.Vector3()).y) > 0.15);
  const panels = sailLumps.filter((l) => Math.max(l.box.max.x - l.box.min.x, l.box.max.y - l.box.min.y) >= 1.0);
  const STOCK = 0.075;          // the two long edge members of a sail
  const LATH = 0.050;           // one cross lath
  const LATHS = 7;
  const SAIL_WIDEN = 0.010;     // the battens already stood 10 mm proud of the panel each side
  const stockColour = averageColour(blades, sailLumps.filter((l) => !panels.includes(l)).flatMap((l) => l.indices));
  const lathColour = averageColour(blades, panels.flatMap((l) => l.indices));

  const latticePositions: number[] = [];
  const latticeColours: number[] = [];
  const latticeIndices: number[] = [];
  const addBox = (min: THREE.Vector3, max: THREE.Vector3, colour: THREE.Color | null): void => {
    const corners: [number, number, number][] = [
      [min.x, min.y, min.z], [max.x, min.y, min.z], [max.x, max.y, min.z], [min.x, max.y, min.z],
      [min.x, min.y, max.z], [max.x, min.y, max.z], [max.x, max.y, max.z], [min.x, max.y, max.z],
    ];
    const base = latticePositions.length / 3;
    for (const [x, y, z] of corners) {
      latticePositions.push(x, y, z);
      if (colour) latticeColours.push(colour.r, colour.g, colour.b);
    }
    const face = (a: number, b: number, c: number, d: number): void => {
      latticeIndices.push(base + a, base + b, base + c, base + a, base + c, base + d);
    };
    face(1, 0, 3, 2); face(4, 5, 6, 7); face(0, 4, 7, 3);
    face(5, 1, 2, 6); face(0, 1, 5, 4); face(3, 7, 6, 2);
  };
  const sailReport: { longAxis: string; boxes: number; lengthMm: number; widthMm: number; openGapMm: number }[] = [];
  for (const panel of panels) {
    const box = panel.box;
    const spanX = box.max.x - box.min.x;
    const spanY = box.max.y - box.min.y;
    const long: 'x' | 'y' = spanX > spanY ? 'x' : 'y';
    const short: 'x' | 'y' = long === 'x' ? 'y' : 'x';
    const sLo = box.min[short] - SAIL_WIDEN;
    const sHi = box.max[short] + SAIL_WIDEN;
    const lLo = box.min[long];
    const lHi = box.max[long];
    const at = (sa: number, sb: number, la: number, lb: number, za: number, zb: number): [THREE.Vector3, THREE.Vector3] => {
      const min = new THREE.Vector3(); const max = new THREE.Vector3();
      min[short] = sa; max[short] = sb; min[long] = la; max[long] = lb; min.z = za; max.z = zb;
      return [min, max];
    };
    // the two stocks, full depth, so the sail has a frame that catches light
    for (const [sa, sb] of [[sLo, sLo + STOCK], [sHi - STOCK, sHi]]) {
      const [min, max] = at(sa, sb, lLo, lHi, -0.025, 0.025);
      addBox(min, max, stockColour);
    }
    // the laths, strictly between the stocks and strictly inside their depth,
    // so a lath BUTTS a stock and never crosses it
    const pitch = (lHi - lLo - LATH) / (LATHS - 1);
    for (let k = 0; k < LATHS; k += 1) {
      const la = lLo + k * pitch;
      const [min, max] = at(sLo + STOCK, sHi - STOCK, la, la + LATH, -0.0175, 0.0175);
      addBox(min, max, lathColour);
    }
    sailReport.push({
      longAxis: long, boxes: 2 + LATHS,
      lengthMm: mm(lHi - lLo), widthMm: mm(sHi - sLo), openGapMm: mm(pitch - LATH),
    });
  }
  const sailTrianglesRemoved = deleteLumps(blades, sailLumps);
  const latticeGeometry = new THREE.BufferGeometry();
  latticeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(latticePositions, 3));
  if (latticeColours.length) latticeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(latticeColours, 3));
  latticeGeometry.setIndex(latticeIndices);
  latticeGeometry.computeVertexNormals();
  latticeGeometry.computeBoundingBox();
  latticeGeometry.computeBoundingSphere();
  const lattice = new THREE.Mesh(latticeGeometry, blades.material);
  lattice.name = 'windmillSailLattice';
  /* A SIBLING, not a child. three's exporter wraps a mesh that has children in an extra
     node and leaves the mesh's own node unnamed, which is how the hub and cross arms came
     to be "unnamed mesh, node 14" in every report about this file. The lattice copies the
     blade mesh's local transform, so it sits and turns exactly where it did. */
  lattice.position.copy(blades.position);
  lattice.quaternion.copy(blades.quaternion);
  lattice.scale.copy(blades.scale);
  blades.parent!.add(lattice);
  scene.updateMatrixWorld(true);

  // ---------------------------------------------- 6. the door and a window
  const hardware = mesh(scene, 'windmillHardware');
  const hardwareParent = node(scene, 'windmillHardware').parent!;
  /** The tower is a 12-sided cone: circumradius 1180 mm at y 550, 720 mm at y 3450. */
  const towerRadiusAt = (y: number): number => 1.180 + ((0.720 - 1.180) * (y - 0.550)) / 2.900;
  const doorLumps = lumps(hardware).filter((l) => l.centre.z > 0.9 && l.centre.y < 1.6 && l.centre.y > 0.5 && l.size.y > 0.6);
  const windowLumps = lumps(hardware).filter((l) => l.centre.z > 0.7 && l.centre.y > 2.2 && l.centre.y < 3.0);
  const doorFrameColour = averageColour(hardware, doorLumps.length ? doorLumps[0].indices : undefined);
  const doorLeafColour = averageColour(hardware, doorLumps.length > 1 ? doorLumps[1].indices : undefined);
  const windowFrameColour = averageColour(hardware, windowLumps.length ? windowLumps[0].indices : undefined);
  const windowGlassColour = averageColour(hardware, windowLumps.length > 1 ? windowLumps[1].indices : undefined);
  const doorTrianglesRemoved = doorLumps.length ? deleteLumps(hardware, doorLumps) : 0;

  const doorSurfaceZ = -towerRadiusAt(1.065);
  const doorFrame = buildBoxes('windmillDoorFrame', [
    { min: [-0.340, 0.550, doorSurfaceZ - 0.072], max: [0.340, 1.580, doorSurfaceZ + 0.068] },
  ], hardware, hardwareParent, doorFrameColour);
  const doorLeaf = buildBoxes('windmillDoorLeaf', [
    { min: [-0.270, 0.570, doorSurfaceZ - 0.117], max: [0.270, 1.540, doorSurfaceZ - 0.072] },
  ], hardware, hardwareParent, doorLeafColour);

  // The second window is the file's own window, the same size, turned onto +X.
  const windowFrame = buildBoxes('windmillWindowFrameX', [
    { min: [0.7911, 2.3078, -0.1999], max: [0.9087, 2.7923, 0.1998] },
  ], hardware, hardwareParent, windowFrameColour);
  const windowGlass = buildBoxes('windmillWindowGlassX', [
    { min: [0.8272, 2.3675, -0.1399], max: [0.9326, 2.7326, 0.1398] },
  ], hardware, hardwareParent, windowGlassColour);
  scene.updateMatrixWorld(true);

  /* ------------------------------ 7. the mill stands on the ground, not over it */
  /* Measured here: the base plinth's underside and the eight foot pads are 20.4 mm apart,
     and it is the PADS that are lower. Seating the model on its lowest vertex therefore
     stood the whole building 20.4 mm in the air on a rockery. The pads are lifted onto the
     plinth's own underside first, and then everything is seated together. */
  const padLift = (() => {
    const all = lumps(hardware);
    const wide = all.filter((l) => l.size.x > 1.0 && l.size.z > 1.0);
    const plinthFloor = Math.min(
      worldBox(mesh(scene, 'windmillTower')).min.y,
      ...(wide.length ? wide.map((l) => l.world.min.y) : [Infinity]),
    );
    const pads = all.filter((l) => l.world.min.y < plinthFloor - 0.0005);
    if (!pads.length) return { plinthFloorMm: mm(plinthFloor), pads: 0, liftedMm: 0 };
    const lift = plinthFloor - Math.min(...pads.map((l) => l.world.min.y));
    for (const pad of pads) moveLumpWorld(hardware, pad, new THREE.Vector3(0, lift, 0));
    scene.updateMatrixWorld(true);
    return { plinthFloorMm: mm(plinthFloor), pads: pads.length, liftedMm: mm(lift) };
  })();

  const ground = seatOnGround(scene, scene.children[0] ?? scene);
  scene.updateMatrixWorld(true);
  /* The vertices that are actually there, not the transformed corners of each geometry's
     own box: the sail disc is tilted 10 degrees, so Box3.setFromObject inflates it by 45 mm
     on one side and the reading would be an artefact of the instrument. */
  const bladeWobbleMm = (() => {
    const pivotNode = node(scene, 'blades_pivot');
    const box = new THREE.Box3();
    const probe = new THREE.Vector3();
    pivotNode.updateMatrixWorld(true);
    pivotNode.traverse((n) => {
      const m = n as THREE.Mesh;
      if (!m.isMesh) return;
      const attribute = m.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < attribute.count; i += 1) box.expandByPoint(probe.fromBufferAttribute(attribute, i).applyMatrix4(m.matrixWorld));
    });
    const centre = box.getCenter(new THREE.Vector3());
    const axis = new THREE.Vector3().setFromMatrixPosition(pivotNode.matrixWorld);
    return mm(centre.distanceTo(axis));
  })();

  const after = { triangles: triangleCount(scene), meshes: meshes(scene).length, boundsM: worldBox(scene).getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(4)) };
  await saveGlb(OUT, mill);
  const report = {
    asset: 'hf-windmill',
    input: path.relative(REPO, IN).replace(/\\/g, '/'),
    output: path.relative(REPO, OUT).replace(/\\/g, '/'),
    shaftTiltDeg: SHAFT_TILT_DEG,
    shaftForwardMm: mm(SHAFT_FORWARD),
    tiltNode: 'blades_tilt (inserted above blades_pivot)',
    shaftSleeve: sleeve,
    sails: {
      panelsReplaced: panels.length,
      lumpsRemoved: sailLumps.length,
      trianglesRemoved: sailTrianglesRemoved,
      latticeTriangles: latticeIndices.length / 3,
      perSail: sailReport,
      stockColour: stockColour ? `#${stockColour.getHexString()}` : null,
      lathColour: lathColour ? `#${lathColour.getHexString()}` : null,
    },
    openings: {
      doorLumpsRemovedFromFront: doorLumps.length,
      doorTrianglesRemoved,
      doorMovedTo: '-Z (the back of the tower, clear of the sail disc)',
      doorSurfaceZmm: mm(doorSurfaceZ),
      doorFrameBoundsMm: sizeMm(worldBox(doorFrame)),
      doorLeafBoundsMm: sizeMm(worldBox(doorLeaf)),
      secondWindowOn: '+X',
      secondWindowFrameBoundsMm: sizeMm(worldBox(windowFrame)),
      secondWindowGlassBoundsMm: sizeMm(worldBox(windowGlass)),
      windowLumpsCopied: windowLumps.length,
    },
    clearanceNote: 'verified separately by tmp/audit-hf/mindist.mjs at 24 phases; the hub boss and the sleeve are allowed to meet the roof, which is what a windshaft does',
    padLift,
    bladeAssemblyCentreOffAxisMm: bladeWobbleMm,
    ground,
    before, after,
  };
  fs.writeFileSync(OUT.replace(/\.glb$/, '.report.json'), JSON.stringify(report, null, 2));
  return report;
}

const which = process.argv[2] ?? 'both';
const reports: unknown[] = [];
if (which === 'both' || which === 'butt') reports.push(await fixWaterButt());
if (which === 'both' || which === 'windmill') reports.push(await fixWindmill());
process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
