/**
 * Corrections applied to the exported farmhand, AFTER Harvest Frontier's own
 * export and WITHOUT touching the Harvest Frontier checkout.
 *
 * Every fix below answers a defect that was measured on the file that is on
 * sale (numbers in outputs/audit/hf/hf-player-farmhand/):
 *
 *   1. HANDS THROUGH THE THIGHS. `leftUpperArmPivot` carries rotation.z = +6.6
 *      deg and `rightUpperArmPivot` -6.6 deg, i.e. both arms hang angled INWARD.
 *      The arm chain is 0.830 m from shoulder to hand, so 6.6 deg puts the hand
 *      centre 95 mm closer to the midline than the shoulder, which lands it on
 *      the thigh's centreline. Measured on the shipped file: leftHandMesh 97.7
 *      mm inside leftThigh (108 vertices), rightHandMesh 93.1 mm inside
 *      rightThigh (109 vertices), at EVERY phase of idle and at the
 *      pass-through phases of walk. Fix: pre-multiply the shoulder rotation --
 *      the rest pose AND every quaternion key of every clip -- by a roll about
 *      Z that swings the arm OUTWARD. Rolling the KEYS is the whole point:
 *      every clip animates these two pivots, so a rest-pose-only change would
 *      be overwritten the moment a clip plays.
 *
 *   2. THE GLOVE IS TOO BIG. leftHandMesh measures 311 x 345 x 238 mm against a
 *      head of 537 x 586 x 577 mm -- 58% of the head's width, where a hand of
 *      this build reads at about 40%. The glove is scaled about its wrist so the
 *      forearm still meets it.
 *
 *   3. THE BOOT STANDS ON TWO BOARDS. Inside each shin mesh sit two flat boxes
 *      -- a near-black 406 x 232 x 46 mm at y 8..54 mm and a tan 412 x 238 x 26
 *      mm at y 39..65 mm -- while the boot solid is only 286 mm long. They
 *      overhang the boot by 15 mm on each side, so from every angle the farmhand
 *      looks like he is standing on two wooden pallets. They are squeezed in X
 *      and Z until they finish inside the boot's own silhouette. Their height is
 *      deliberately untouched: seating them on the ground would make their
 *      underside coplanar with the toe block's, which is a z-fight.
 *
 *   4. THE FACE DECAL Z-FIGHTS. Four triangle pairs on the front of the head sit
 *      0.56-0.73 mm apart, parallel, and overlapping in projection: the classic
 *      shimmering-face artefact. The decal is pushed out along its own radius.
 *
 *   5. THE WALK NEVER PLANTS A FOOT. Lowest boot vertex during `walk` at the
 *      eight audit phases: -0.1, 13.3, 43.8, 13.3, 5.9, 13.3, 43.8, 13.3 mm,
 *      with the swing foot up to 109.2 mm -- the character glides. The root is
 *      dropped per key so the lower boot touches y = 0.
 *
 *   6. THE TOOL HANDLES ARE HALF-BURIED HOOKS. `wateringCanHandle` sits 90.1 mm
 *      inside `wateringCanBody` and `basketHandle` 107.6 mm inside
 *      `harvestBasket`, at EVERY phase of `water` and `harvest`. Rendered on
 *      their own, both read the same way: a semicircular bail lying on its side,
 *      one leg sunk into the vessel and the other end stopping in mid-air. Both
 *      carry rotation.z = 90 deg; at rotation.z = 0 the same arc stands upright
 *      as the bail handle it was modelled to be. Each is rolled back to 0,
 *      centred over its vessel and seated so BOTH legs enter the lid.
 *
 * Nothing else is touched: no mesh is added or removed, no material, colour or
 * vertex colour changes, and the clip list, durations and key times are the
 * same. The watering can's spout was ALSO suspected of being detached from the
 * body, from a 170-px-wide strip frame; rendered on its own at full size it is
 * not -- it overlaps the body by 45 mm in Z and 80 mm in Y. That suspicion is
 * withdrawn rather than "fixed".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THREE, exportGlb } from './lib.mjs';
import { GLTFLoader } from '../../../Harvest Frontier/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../../../Harvest Frontier/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const IN = process.argv[2] ?? path.join(REPO, 'examples/harvest-frontier/exports/npc/player-farmhand.glb');
const OUT = process.argv[3] ?? path.join(REPO, 'examples/harvest-frontier/exports/npc/player-farmhand.fixed.glb');

/** How far the shoulders roll OUTWARD, in degrees, on top of whatever a clip asks for. */
const SHOULDER_SPLAY_DEG = Number(process.env.SPLAY_DEG ?? 15);
/** Glove size as a fraction of the authored size, shrunk about the wrist. */
const HAND_SCALE = Number(process.env.HAND_SCALE ?? 0.78);
/** How far a bail handle's feet sink into the lid it stands on. */
const HANDLE_BITE = Number(process.env.HANDLE_BITE ?? 0.02);
/** How far the face decal is pushed out of the skull, in metres. */
const DECAL_PUSH = Number(process.env.DECAL_PUSH ?? 0.004);

const buffer = fs.readFileSync(IN);
const array = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
const gltf = await new Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] }>((ok, fail) => {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.parse(array as ArrayBuffer, '', ok as never, fail);
});
const scene = gltf.scene;
const clips = gltf.animations;
function node(name: string): THREE.Object3D {
  const found = scene.getObjectByName(name);
  if (!found) throw new Error(`node ${name} is not in ${IN}`);
  return found;
}

/** Welded connected components of one geometry, as vertex-index lists. */
function components(geometry: THREE.BufferGeometry): number[][] {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const parent = new Int32Array(position.count);
  for (let i = 0; i < position.count; i += 1) parent[i] = i;
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a: number, b: number): void => { const ra = find(a); const rb = find(b); if (ra !== rb) parent[rb] = ra; };
  const seen = new Map<string, number>();
  for (let i = 0; i < position.count; i += 1) {
    const key = `${position.getX(i).toFixed(4)},${position.getY(i).toFixed(4)},${position.getZ(i).toFixed(4)}`;
    const first = seen.get(key);
    if (first === undefined) seen.set(key, i); else union(first, i);
  }
  const count = index ? index.count : position.count;
  for (let i = 0; i < count; i += 3) {
    const a = index ? index.getX(i) : i;
    const b = index ? index.getX(i + 1) : i + 1;
    const c = index ? index.getX(i + 2) : i + 2;
    union(a, b); union(b, c);
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < position.count; i += 1) {
    const root = find(i);
    const list = groups.get(root);
    if (list) list.push(i); else groups.set(root, [i]);
  }
  return [...groups.values()];
}

// ---------------------------------------------------------------- 1. shoulders
/*
 * The roll is decided PER KEY, not once for the file. A constant roll fixes the
 * hands in idle and walk but ruins `harvest`, where the free hand is posed on
 * the basket and a fixed 15 deg swings it out to the side. So each shoulder
 * quaternion key is asked one question -- is any glove or forearm vertex inside
 * the thigh's oriented box at this key? -- and given the SMALLEST outward roll,
 * in 1 deg steps up to the cap, that answers no. A key whose hand is already
 * clear gets 0 and is written back untouched. The resulting angle sequence is
 * then smoothed across neighbouring keys so the arm eases out rather than pops.
 *
 * The thigh's ORIENTED BOX is deliberately conservative -- the thigh is a
 * rounded capsule inside it -- so a key that clears the box certainly clears the
 * mesh, and the roll asked for is an upper bound, never an underestimate.
 */
const MAX_SPLAY = (SHOULDER_SPLAY_DEG * Math.PI) / 180;
const SIDES = [
  { pivot: 'leftUpperArmPivot', thigh: 'leftThigh', probes: ['leftHandMesh', 'leftLowerArm'], sign: -1 },
  { pivot: 'rightUpperArmPivot', thigh: 'rightThigh', probes: ['rightHandMesh', 'rightLowerArm'], sign: 1 },
] as const;
const AXIS_Z = new THREE.Vector3(0, 0, 1);
/** How far outside the thigh box a glove vertex has to end up, in metres. */
const CLEARANCE = 0.01;

const probePoints = new Map<string, THREE.Vector3[]>();
for (const side of SIDES) {
  for (const name of side.probes) {
    const mesh = node(name) as THREE.Mesh;
    const position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const seen = new Set<string>();
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < position.count; i += 1) {
      const key = `${position.getX(i).toFixed(3)},${position.getY(i).toFixed(3)},${position.getZ(i).toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      points.push(new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i)));
    }
    probePoints.set(name, points);
  }
}

const inverseThigh = new THREE.Matrix4();
const probe = new THREE.Vector3();
/** Does any glove / forearm vertex sit inside this side's thigh box right now? */
function armIsInsideThigh(side: (typeof SIDES)[number]): boolean {
  const thigh = node(side.thigh) as THREE.Mesh;
  thigh.geometry.computeBoundingBox();
  const box = thigh.geometry.boundingBox!.clone();
  const scale = thigh.getWorldScale(new THREE.Vector3()).x || 1;
  box.expandByScalar(CLEARANCE / scale);
  inverseThigh.copy(thigh.matrixWorld).invert();
  for (const name of side.probes) {
    const mesh = node(name);
    for (const point of probePoints.get(name)!) {
      probe.copy(point).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverseThigh);
      if (box.containsPoint(probe)) return true;
    }
  }
  return false;
}
/** The smallest outward roll, in 1 deg steps, that gets this arm out of the leg. */
function neededSplay(side: (typeof SIDES)[number], base: THREE.Quaternion): number {
  const pivot = node(side.pivot);
  const steps = Math.round((MAX_SPLAY * 180) / Math.PI);
  for (let degrees = 0; degrees <= steps; degrees += 1) {
    pivot.quaternion.copy(base);
    if (degrees > 0) {
      pivot.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Z, side.sign * (degrees * Math.PI) / 180));
    }
    scene.updateMatrixWorld(true);
    if (!armIsInsideThigh(side)) return (degrees * Math.PI) / 180;
  }
  return MAX_SPLAY;
}
/** Moving average, so a roll that only one key needs still eases in and out. */
function smooth(angles: readonly number[], radius: number): number[] {
  return angles.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const j = i + k;
      if (j < 0 || j >= angles.length) continue;
      sum += angles[j];
      n += 1;
    }
    return sum / n;
  });
}

scene.updateMatrixWorld(true);
const restSplay: Record<string, number> = {};
for (const side of SIDES) {
  const pivot = node(side.pivot);
  const base = pivot.quaternion.clone();
  const angle = neededSplay(side, base);
  restSplay[side.pivot] = +((angle * 180) / Math.PI).toFixed(1);
  pivot.quaternion.copy(base).premultiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Z, side.sign * angle));
}
scene.updateMatrixWorld(true);

const scratch = new THREE.Quaternion();
const rollReport: { clip: string; pivot: string; keys: number; rolledKeys: number; maxDeg: number }[] = [];
let keysRolled = 0;
for (const clip of clips) {
  const mixer = new THREE.AnimationMixer(scene);
  const action = mixer.clipAction(clip);
  action.play();
  for (const side of SIDES) {
    const track = clip.tracks.find((t) => t.name === `${side.pivot}.quaternion`);
    if (!track) continue;
    const values = track.values as unknown as Float32Array;
    const pivot = node(side.pivot);
    const angles: number[] = [];
    for (let k = 0; k < track.times.length; k += 1) {
      mixer.setTime(0);
      mixer.setTime(track.times[k]);
      scene.updateMatrixWorld(true);
      const base = new THREE.Quaternion(values[k * 4], values[k * 4 + 1], values[k * 4 + 2], values[k * 4 + 3]);
      angles.push(neededSplay(side, base));
    }
    action.stop();
    const eased = smooth(angles, 2);
    for (let k = 0; k < eased.length; k += 1) {
      if (eased[k] <= 1e-6) continue;
      scratch
        .set(values[k * 4], values[k * 4 + 1], values[k * 4 + 2], values[k * 4 + 3])
        .premultiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Z, side.sign * eased[k]));
      values[k * 4] = scratch.x; values[k * 4 + 1] = scratch.y; values[k * 4 + 2] = scratch.z; values[k * 4 + 3] = scratch.w;
      keysRolled += 1;
    }
    rollReport.push({
      clip: clip.name,
      pivot: side.pivot,
      keys: eased.length,
      rolledKeys: eased.filter((a) => a > 1e-6).length,
      maxDeg: +((Math.max(...eased) * 180) / Math.PI).toFixed(1),
    });
    action.play();
    pivot.quaternion.set(values[0], values[1], values[2], values[3]);
  }
  action.stop();
  mixer.uncacheClip(clip);
}
scene.updateMatrixWorld(true);

// --------------------------------------------------------------- 2. hand scale
for (const side of ['left', 'right'] as const) {
  const mesh = node(`${side}HandMesh`);
  mesh.scale.multiplyScalar(HAND_SCALE);
  // The mesh's own offset from the wrist scales with it, so the glove stays
  // welded to the cuff instead of drifting down the arm.
  mesh.position.multiplyScalar(HAND_SCALE);
}

// ------------------------------------------------------------- 3. boot boards
interface BoardFix {
  mesh: string;
  beforeSizeMm: number[];
  afterSizeMm: number[];
  beforeMinYmm: number;
  afterMinYmm: number;
}
const boardFixes: BoardFix[] = [];
for (const side of ['left', 'right'] as const) {
  const shin = node(`${side}Shin`) as THREE.Mesh;
  const position = shin.geometry.getAttribute('position') as THREE.BufferAttribute;
  const localScale = shin.scale.x;
  const groups = components(shin.geometry);
  const point = new THREE.Vector3();
  const boxes = groups.map((list) => {
    const box = new THREE.Box3();
    for (const i of list) box.expandByPoint(point.fromBufferAttribute(position, i));
    return box;
  });
  const meshBox = new THREE.Box3();
  for (const box of boxes) meshBox.union(box);
  const meshHeight = meshBox.getSize(new THREE.Vector3()).y;
  const isFlat = (size: THREE.Vector3) => size.y < 0.25 * Math.max(size.x, size.z);

  // The boot's own footprint: the union of the SOLID lumps in the bottom third
  // of the mesh -- the toe block and the ankle block. The two slabs are measured
  // against this, so nothing here depends on a hand-typed millimetre.
  const footprint = new THREE.Box3();
  const slabs: number[] = [];
  for (let gi = 0; gi < groups.length; gi += 1) {
    const box = boxes[gi];
    const size = box.getSize(new THREE.Vector3());
    if (box.min.y > meshBox.min.y + meshHeight / 3) continue;
    // A sole slab runs the length and width of the boot; a buckle or a strap
    // does not, and must not be dragged down to the ground with the soles.
    const meshSize = meshBox.getSize(new THREE.Vector3());
    const spansTheFoot = size.x > 0.5 * meshSize.x && size.z > 0.5 * meshSize.z;
    if (isFlat(size) && spansTheFoot) slabs.push(gi); else if (!isFlat(size)) footprint.union(box);
  }
  if (footprint.isEmpty() || slabs.length === 0) throw new Error(`no boot / sole split found in ${side}Shin`);
  const footSize = footprint.getSize(new THREE.Vector3());
  const footCentre = footprint.getCenter(new THREE.Vector3());
  // Squeeze the two slabs in X and Z until they finish just INSIDE the boot's
  // own silhouette. Their Y is deliberately left alone: they already interlock
  // by 15 mm, which is invisible once they are inside the boot, and seating them
  // on y = 0 would put their underside exactly coplanar with the toe block's --
  // 0 mm apart, parallel, overlapping, i.e. the very artefact this pass removes.
  // Each slab gets its OWN inset. Squeezing both to the same footprint would put
  // their four side faces exactly on top of one another -- 0 mm apart, parallel,
  // overlapping -- which is the artefact this pass exists to remove.
  const INSET = [0.94, 0.88];
  slabs.sort((a, b) => boxes[a].min.y - boxes[b].min.y);
  for (const [slot, gi] of slabs.entries()) {
    const box = boxes[gi];
    const size = box.getSize(new THREE.Vector3());
    const inset = INSET[Math.min(slot, INSET.length - 1)];
    const sx = Math.min(1, (footSize.x * inset) / size.x);
    const sz = Math.min(1, (footSize.z * inset) / size.z);
    for (const i of groups[gi]) {
      point.fromBufferAttribute(position, i);
      point.x = footCentre.x + (point.x - footCentre.x) * sx;
      point.z = footCentre.z + (point.z - footCentre.z) * sz;
      position.setXYZ(i, point.x, point.y, point.z);
    }
    boardFixes.push({
      mesh: `${side}Shin`,
      beforeSizeMm: [size.x, size.y, size.z].map((v) => +(v * localScale * 1000).toFixed(1)),
      afterSizeMm: [size.x * sx, size.y, size.z * sz].map((v) => +(v * localScale * 1000).toFixed(1)),
      beforeMinYmm: +((box.min.y - meshBox.min.y) * localScale * 1000).toFixed(1),
      afterMinYmm: +((box.min.y - meshBox.min.y) * localScale * 1000).toFixed(1),
    });
  }
  position.needsUpdate = true;
  shin.geometry.computeBoundingBox();
  shin.geometry.computeBoundingSphere();
}

// ------------------------------------------------------------ 4. face z-fight
let decalVertices = 0;
{
  scene.updateMatrixWorld(true);
  const head = node('head') as THREE.Mesh;
  const position = head.geometry.getAttribute('position') as THREE.BufferAttribute;
  const scale = head.getWorldScale(new THREE.Vector3()).x;
  const point = new THREE.Vector3();
  // The measured pairs sit at world (+-0.085, 2.04, -0.26): the white catch-light
  // against the dark eyeball, 0.56-0.73 mm apart. Both are their own welded
  // component, so the small one in front of the other is the one to push out.
  const headBox = new THREE.Box3().setFromObject(head);
  const headCentre = headBox.getCenter(new THREE.Vector3());
  for (const list of components(head.geometry)) {
    if (list.length > 200) continue; // the skull and the eyeballs themselves
    const box = new THREE.Box3();
    for (const i of list) box.expandByPoint(point.fromBufferAttribute(position, i).applyMatrix4(head.matrixWorld));
    const centre = box.getCenter(new THREE.Vector3());
    // only the catch-lights: tiny, on the front of the head, at eye height
    if (centre.z > headCentre.z - 0.1 || centre.y < 1.95 || centre.y > 2.15) continue;
    const direction = centre.clone().sub(headCentre).normalize();
    for (const i of list) {
      point.fromBufferAttribute(position, i).addScaledVector(direction, DECAL_PUSH / scale);
      position.setXYZ(i, point.x, point.y, point.z);
      decalVertices += 1;
    }
  }
  position.needsUpdate = true;
  head.geometry.computeBoundingBox();
  head.geometry.computeBoundingSphere();
}

// ------------------------------------------------------- 6. tool handles
interface HandleFix {
  handle: string;
  vessel: string;
  rotationZBeforeDeg: number;
  rotationZAfterDeg: number;
  centredByMm: number[];
  seatedByMm: number;
}
const handleFixes: HandleFix[] = [];
for (const [groupName, handleName, vesselName] of [
  ['toolWateringCan', 'wateringCanHandle', 'wateringCanBody'],
  ['toolHarvestBasket', 'basketHandle', 'harvestBasket'],
] as const) {
  const group = node(groupName);
  // Every tool is scaled to 0 in the rest pose, so it has to be opened up to be
  // measured, then put back exactly as it was found.
  const parked = group.scale.clone();
  group.scale.set(1, 1, 1);
  scene.updateMatrixWorld(true);

  const handle = node(handleName);
  const vessel = node(vesselName) as THREE.Mesh;
  const rotationBefore = handle.rotation.z;
  handle.rotation.z = 0;
  scene.updateMatrixWorld(true);

  const boxOf = (o: THREE.Object3D): THREE.Box3 => new THREE.Box3().setFromObject(o);
  const vesselBox = boxOf(vessel);
  let handleBox = boxOf(handle);
  const centreDelta = vesselBox.getCenter(new THREE.Vector3()).sub(handleBox.getCenter(new THREE.Vector3()));
  handle.position.x += centreDelta.x;
  handle.position.z += centreDelta.z;
  scene.updateMatrixWorld(true);

  // The arc's two legs end at different heights. Seating by the LOWER one would
  // leave the higher leg hanging in the air, so the HIGHER one is what has to
  // reach the lid; the other simply goes further in, where nothing sees it.
  const position = (handle as THREE.Mesh).geometry.getAttribute('position') as THREE.BufferAttribute;
  handleBox = boxOf(handle);
  const midX = handleBox.getCenter(new THREE.Vector3()).x;
  let leftTip = Infinity;
  let rightTip = Infinity;
  const point = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    point.fromBufferAttribute(position, i).applyMatrix4((handle as THREE.Mesh).matrixWorld);
    if (point.x < midX) leftTip = Math.min(leftTip, point.y); else rightTip = Math.min(rightTip, point.y);
  }
  const highestFoot = Math.max(leftTip, rightTip);
  const seatDelta = vesselBox.max.y - HANDLE_BITE - highestFoot;
  handle.position.y += seatDelta / (handle.parent ? handle.parent.getWorldScale(new THREE.Vector3()).y || 1 : 1);
  scene.updateMatrixWorld(true);

  handleFixes.push({
    handle: handleName,
    vessel: vesselName,
    rotationZBeforeDeg: +((rotationBefore * 180) / Math.PI).toFixed(1),
    rotationZAfterDeg: 0,
    centredByMm: [centreDelta.x, centreDelta.z].map((v) => +(v * 1000).toFixed(1)),
    seatedByMm: +(seatDelta * 1000).toFixed(1),
  });

  group.scale.copy(parked);
  scene.updateMatrixWorld(true);
}

// -------------------------------------------------------- 5. plant the walk
const shins = ['leftShin', 'rightShin'].map((name) => node(name) as THREE.Mesh);
function lowestBootY(): number {
  scene.updateMatrixWorld(true);
  let low = Infinity;
  const point = new THREE.Vector3();
  for (const shin of shins) {
    const position = shin.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i += 1) {
      low = Math.min(low, point.fromBufferAttribute(position, i).applyMatrix4(shin.matrixWorld).y);
    }
  }
  return low;
}
// `walk` is fully re-seated: its stance foot has to land on y = 0. `idle` and
// `inspect` are only CLAMPED -- lifted when a boot is under the floor, never
// pushed down -- because idle's bob IS root translation, and snapping it would
// delete the breathing the clip exists for.
const PLANT = new Set((process.env.PLANT_CLIPS ?? 'walk').split(',').filter(Boolean));
const CLAMP = new Set((process.env.CLAMP_CLIPS ?? 'idle,inspect').split(',').filter(Boolean));
const plantLifts: { clip: string; liftedMm: number[] }[] = [];
for (const clip of clips) {
  const clamped = CLAMP.has(clip.name);
  if (!PLANT.has(clip.name) && !clamped) continue;
  const rigPosition = clip.tracks.find((t) => t.name === 'playerRig.position');
  if (!rigPosition) throw new Error(`${clip.name} has no playerRig.position track to plant`);
  const mixer = new THREE.AnimationMixer(scene);
  const action = mixer.clipAction(clip);
  action.play();
  const values = rigPosition.values as unknown as Float32Array;
  const lifts: { clip: string; liftedMm: number[] } = { clip: clip.name, liftedMm: [] };
  plantLifts.push(lifts);
  for (let k = 0; k < rigPosition.times.length; k += 1) {
    mixer.setTime(0);
    mixer.setTime(rigPosition.times[k]);
    const low = lowestBootY();
    values[k * 3 + 1] -= clamped ? Math.min(0, low) : low;
    lifts.liftedMm.push(+(low * 1000).toFixed(1));
  }
  action.stop();
  mixer.uncacheClip(clip);
}

scene.updateMatrixWorld(true);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, await exportGlb(scene, clips));

const report = {
  builtAt: new Date().toISOString(),
  input: path.relative(REPO, IN).replace(/\\/g, '/'),
  output: path.relative(REPO, OUT).replace(/\\/g, '/'),
  shoulderSplayCapDeg: SHOULDER_SPLAY_DEG,
  restPoseSplayDeg: restSplay,
  quaternionKeysRolled: keysRolled,
  perClipRoll: rollReport,
  handScale: HAND_SCALE,
  boardFixes,
  faceDecal: { verticesPushed: decalVertices, byMm: DECAL_PUSH * 1000 },
  toolHandles: handleFixes,
  plantedClips: [...PLANT],
  clampedClips: [...CLAMP],
  plantLifts,
};
fs.writeFileSync(OUT.replace(/\.glb$/, '.report.json'), JSON.stringify(report, null, 2));
process.stdout.write(`${JSON.stringify(report, null, 2)}\nwrote ${OUT}\n`);
