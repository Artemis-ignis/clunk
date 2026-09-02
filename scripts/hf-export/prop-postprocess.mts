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
 *   Left alone on instruction: the barrel is 1.55 m across and the prop 2.33 m
 *   tall. That is Harvest Frontier's own scale and it is reported, not changed.
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
 * No material, colour or vertex colour is touched in either file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  THREE, loadGlb, saveGlb, mesh, node, lumps, deleteLumps, scaleLump,
  meshes, triangleCount, worldBox, sizeMm, mm, seatOnGround, lowestY,
} from './fix-lib.mjs';

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

  const after = { triangles: triangleCount(scene), meshes: meshes(scene).length, boundsM: worldBox(scene).getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(4)) };
  await saveGlb(OUT, butt);
  const report = {
    asset: 'hf-water-butt',
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
    const length = SHAFT_FORWARD + 0.35;
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 12, 1, false);
    geometry.rotateX(Math.PI / 2);          // cylinder axis Y -> Z
    geometry.translate(0, 0, -length / 2);  // grow backwards from the hub
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
      colour: colourAttribute ? `#${[srgb(cr), srgb(cg), srgb(cb)].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}` : null,
    };
  }
  scene.updateMatrixWorld(true);

  const ground = seatOnGround(scene, scene.children[0] ?? scene);
  scene.updateMatrixWorld(true);

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
    clearanceNote: 'verified separately by tmp/audit-hf/mindist.mjs at 24 phases; the hub boss and the sleeve are allowed to meet the roof, which is what a windshaft does',
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
