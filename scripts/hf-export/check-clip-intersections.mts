/**
 * Does anything the farmhand is holding go THROUGH him?
 *
 * The check runs on the shipped file, not on an in-memory pose: the GLB is
 * loaded back, an AnimationMixer plays each clip, and at six phases every
 * distinct vertex of the "probe" meshes - the gloves and the three tool groups
 * - is tested for being genuinely INSIDE a body mesh.
 *
 * Inside is decided by a winding count, not by a bounding box. A ray is cast
 * from the vertex and each crossing of the body surface counts +1 leaving and
 * -1 entering; a positive total means the vertex is inside that many nested
 * solids. This matters because the body parts are merged unions of capsules and
 * rounded boxes: an oriented BOX around a thigh capsule reports the hand as
 * 108 mm "inside" in Harvest Frontier's own untouched idle, where the glove is
 * merely hanging beside the trouser leg. Depth is then the distance from the
 * vertex to the nearest triangle of that mesh, i.e. how far it would have to
 * move to come back out.
 *
 * Pairs that are meant to touch are skipped - a glove against its own forearm,
 * a tool against the arm gripping it, the hat against the head - and are listed
 * in the report so the exclusion is visible rather than silent. `idle`, `walk`
 * and `inspect` are measured too, unchanged, as the baseline the three
 * re-authored clips have to be read against.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../examples/harvest-frontier/exports');
const FILE = path.join(OUT, 'npc', 'player-farmhand.glb');
const PHASES = [0, 0.2, 0.4, 0.6, 0.8, 0.95];

const TOOL_GROUPS = ['toolHoe', 'toolWateringCan', 'toolHarvestBasket'];
const GLOVES = ['leftHandMesh', 'rightHandMesh'];
const BODY = [
  'trouserHips', 'denimJacketTorso', 'head', 'strawHat',
  'leftUpperArm', 'leftLowerArm', 'rightUpperArm', 'rightLowerArm',
  'leftThigh', 'leftShin', 'rightThigh', 'rightShin',
];

/** Contacts that are the point of the pose rather than a fault. */
const ALLOWED: readonly (readonly [RegExp, RegExp])[] = [
  [/^leftHandMesh$/, /^left(UpperArm|LowerArm)$/],
  [/^rightHandMesh$/, /^right(UpperArm|LowerArm)$/],
  // Every tool is gripped: it is supposed to be inside the gloves, and the
  // gloves sit on the ends of the arms.
  [/./, /^right(UpperArm|LowerArm)$/],
  [/^strawHat$/, /^head$/],
];

function allowed(probe: string, body: string): boolean {
  return ALLOWED.some(([p, b]) => p.test(probe) && b.test(body));
}

async function load(file: string): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  const buffer = fs.readFileSync(file);
  const array = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const loader = new GLTFLoader();
  return await new Promise((ok, fail) => loader.parse(array as ArrayBuffer, '', (g) => ok({ scene: g.scene, animations: g.animations }), fail));
}

const { scene, animations } = await load(FILE);

interface Part { name: string; mesh: THREE.Mesh }

function collect(): { probes: Part[]; bodies: Part[] } {
  const probes: Part[] = [];
  const bodies: Part[] = [];
  const inToolGroup = new Set<THREE.Object3D>();
  for (const group of TOOL_GROUPS) {
    scene.getObjectByName(group)?.traverse((n) => inToolGroup.add(n));
  }
  scene.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    if (inToolGroup.has(mesh) || GLOVES.includes(mesh.name)) probes.push({ name: mesh.name || '(tool part)', mesh });
    if (BODY.includes(mesh.name)) bodies.push({ name: mesh.name, mesh });
  });
  return { probes, bodies };
}

const { probes, bodies } = collect();

/** Distinct vertices of a probe mesh, in its own local space. */
const probePoints = new Map<THREE.Mesh, THREE.Vector3[]>();
for (const probe of probes) {
  const position = probe.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const seen = new Set<string>();
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < position.count; i += 1) {
    const key = `${position.getX(i).toFixed(4)},${position.getY(i).toFixed(4)},${position.getZ(i).toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    points.push(new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i)));
  }
  probePoints.set(probe.mesh, points);
}

/** World-space triangles of a body mesh at the pose it currently holds. */
function triangles(mesh: THREE.Mesh): THREE.Triangle[] {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const index = geometry.getIndex();
  const count = index ? index.count : position.count;
  const out: THREE.Triangle[] = [];
  for (let i = 0; i < count; i += 3) {
    const a = index ? index.getX(i) : i;
    const b = index ? index.getX(i + 1) : i + 1;
    const c = index ? index.getX(i + 2) : i + 2;
    out.push(new THREE.Triangle(
      new THREE.Vector3().fromBufferAttribute(position, a).applyMatrix4(mesh.matrixWorld),
      new THREE.Vector3().fromBufferAttribute(position, b).applyMatrix4(mesh.matrixWorld),
      new THREE.Vector3().fromBufferAttribute(position, c).applyMatrix4(mesh.matrixWorld),
    ));
  }
  return out;
}

// An irrational-looking direction, so the ray misses the shared edges where two
// merged primitives meet and the crossing count stays honest.
const RAY = new THREE.Vector3(0.5773, 0.5574, 0.5968).normalize();

/** How many closed solids of a merged mesh contain `point`. */
function windingCount(point: THREE.Vector3, tris: readonly THREE.Triangle[]): number {
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const h = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const q = new THREE.Vector3();
  let winding = 0;
  for (const tri of tris) {
    edge1.subVectors(tri.b, tri.a);
    edge2.subVectors(tri.c, tri.a);
    h.crossVectors(RAY, edge2);
    const det = edge1.dot(h);
    if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det;
    sv.subVectors(point, tri.a);
    const u = sv.dot(h) * inv;
    if (u < 0 || u > 1) continue;
    q.crossVectors(sv, edge1);
    const v = RAY.dot(q) * inv;
    if (v < 0 || u + v > 1) continue;
    if (edge2.dot(q) * inv <= 1e-9) continue;
    // det = edge1 . (RAY x edge2) = -RAY . N, so det > 0 means the ray runs
    // AGAINST the face normal: it is entering the solid, not leaving it.
    winding += det > 0 ? -1 : 1;
  }
  return winding;
}

/** Distance from an inside point to the nearest triangle - how deep it is. */
function depthToSurface(point: THREE.Vector3, tris: readonly THREE.Triangle[]): number {
  const closest = new THREE.Vector3();
  let best = Infinity;
  for (const tri of tris) {
    tri.closestPointToPoint(point, closest);
    const distance = closest.distanceTo(point);
    if (distance < best) best = distance;
  }
  return best;
}

// Self-test: the centre of a solid must read as inside it. Without this the
// sign convention above is one character away from reporting a clean bill of
// health for every pose there is.
for (const body of bodies) {
  scene.updateMatrixWorld(true);
  const tris = triangles(body.mesh);
  const centre = new THREE.Box3().setFromObject(body.mesh).getCenter(new THREE.Vector3());
  if (windingCount(centre, tris) < 1) {
    throw new Error(`inside-test is broken: the centre of ${body.name} does not read as inside it`);
  }
}

interface Row {
  clip: string;
  phase: number;
  worst: { probe: string; body: string; depthMm: number } | null;
  belowGroundMm: number;
  contacts: number;
}

const rows: Row[] = [];
const world = new THREE.Vector3();
const probeBox = new THREE.Box3();
const bodyBox = new THREE.Box3();

for (const clip of animations) {
  const mixer = new THREE.AnimationMixer(scene);
  const action = mixer.clipAction(clip);
  action.play();
  for (const phase of PHASES) {
    mixer.setTime(0);
    mixer.setTime(clip.duration * Math.min(phase, 1 - 1e-6));
    scene.updateMatrixWorld(true);

    // Only the body parts a probe's world box actually reaches get triangulated.
    const soup = new Map<THREE.Mesh, THREE.Triangle[]>();
    const bodyBoxes = new Map<THREE.Mesh, THREE.Box3>();
    for (const body of bodies) bodyBoxes.set(body.mesh, new THREE.Box3().setFromObject(body.mesh));

    let worst: Row['worst'] = null;
    let contacts = 0;
    let lowest = Infinity;
    for (const probe of probes) {
      // A tool this clip does not use is scaled to 0 and is not on screen.
      if (new THREE.Vector3().setFromMatrixScale(probe.mesh.matrixWorld).x < 1e-4) continue;
      const points = probePoints.get(probe.mesh)!;
      probeBox.makeEmpty();
      const worldPoints = points.map((p) => {
        const w = p.clone().applyMatrix4(probe.mesh.matrixWorld);
        probeBox.expandByPoint(w);
        lowest = Math.min(lowest, w.y);
        return w;
      });
      for (const body of bodies) {
        if (body.mesh === probe.mesh || allowed(probe.name, body.name)) continue;
        bodyBox.copy(bodyBoxes.get(body.mesh)!);
        if (!bodyBox.intersectsBox(probeBox)) continue;
        let tris = soup.get(body.mesh);
        if (!tris) { tris = triangles(body.mesh); soup.set(body.mesh, tris); }
        for (const point of worldPoints) {
          if (!bodyBox.containsPoint(point)) continue;
          if (windingCount(point, tris) < 1) continue;
          contacts += 1;
          const depth = depthToSurface(point, tris) * 1000;
          if (!worst || depth > worst.depthMm) {
            worst = { probe: probe.name, body: body.name, depthMm: Math.round(depth * 10) / 10 };
          }
        }
      }
    }
    // The soles, too: the whole asset should stay on top of its own ground.
    let soles = Infinity;
    for (const body of bodies) {
      if (!/Shin$/.test(body.name)) continue;
      const position = body.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < position.count; i += 1) {
        soles = Math.min(soles, world.fromBufferAttribute(position, i).applyMatrix4(body.mesh.matrixWorld).y);
      }
    }
    rows.push({
      clip: clip.name,
      phase,
      worst,
      belowGroundMm: Math.round(Math.min(0, Math.min(lowest, soles)) * -10000) / 10,
      contacts,
    });
  }
  action.stop();
  mixer.uncacheClip(clip);
}

const header = 'clip      phase  deepest overlap                                   depth  belowGround  vertices';
process.stdout.write(`${header}\n${'-'.repeat(header.length)}\n`);
for (const row of rows) {
  const pair = row.worst ? `${row.worst.probe} into ${row.worst.body}` : 'none';
  process.stdout.write(
    `${row.clip.padEnd(9)} ${row.phase.toFixed(2)}  ${pair.padEnd(44)} ${(row.worst ? `${row.worst.depthMm.toFixed(1)}mm` : '-').padStart(8)}  ${row.belowGroundMm.toFixed(1).padStart(6)}mm  ${row.contacts}\n`,
  );
}

const out = path.join(OUT, 'clip-intersections.json');
fs.writeFileSync(out, JSON.stringify({
  checkedAt: new Date().toISOString(),
  file: path.relative(OUT, FILE).replace(/\\/g, '/'),
  method: 'GLTFLoader -> AnimationMixer.setTime at 6 phases -> every distinct vertex of the gloves and the three tool groups tested against each body mesh by RAY WINDING COUNT (inside = the ray leaves more surfaces than it enters); depth is the distance from an inside vertex to the nearest triangle of that mesh. Bounding boxes are used only to skip pairs that cannot touch.',
  phases: PHASES,
  probes: probes.map((p) => p.name),
  bodies: bodies.map((b) => b.name),
  allowedContacts: [
    'a glove against its own forearm / upper arm',
    'any tool against the right arm that grips it',
    'the straw hat against the head',
  ],
  rows,
}, null, 2));
process.stdout.write(`\nwrote ${out}\n`);
