/**
 * Harvest Frontier -> GLB export.
 *
 * Reads HF factories (read-only) and writes GLBs under
 * Clunk/examples/harvest-frontier/exports/. Nothing is written into HF.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THREE, bakeClip, cropAroundAnchor, crossThree, exportGlb, isolate, measureScene, resolveInstancing, type JointSample } from './lib.mjs';

import { createFarmNpcs, updateFarmNpcIdle } from '../../../Harvest Frontier/src/engine/assets/npcs';
import { createFarmBuildings } from '../../../Harvest Frontier/src/engine/assets/buildings';
import { createFarmProps, createFarmWindmill, windmillBladeAngle, ROUTE_CART_ANCHORS } from '../../../Harvest Frontier/src/engine/assets/props';
import { createCropField, setCropTileGrowth, setCropVegetationGrowth } from '../../../Harvest Frontier/src/engine/assets/crops';
import { CROP_DEFINITIONS } from '../../../Harvest Frontier/src/content/core/crops';
import { createPlayerAvatar, ACTION_DURATION_SECONDS } from '../../../Harvest Frontier/src/engine/animation/playerMotion';
import { gaitAngularVelocity, gaitIntensity, GAIT_SPEED_REFERENCE } from '../../../Harvest Frontier/src/engine/animation/gait';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../examples/harvest-frontier/exports');
const FPS = 30;

interface Target {
  group: 'npc' | 'building' | 'crop' | 'prop';
  slug: string;
  provenanceId: string | null;
  note: string;
  build: () => { root: THREE.Object3D; clips: THREE.AnimationClip[]; extra?: Record<string, unknown> };
}

// ── NPC residents ───────────────────────────────────────────────
// The only motion the engine gives a resident is updateFarmNpcIdle: a vertical
// bob on `body` at 1.6 rad/s and a roll at 0.72 rad/s. 1.6/0.72 = 20/9, so the
// authored pair only closes after 78.5 s. The roll is retuned to 0.8 rad/s
// (2:1 against the bob) so the clip loops seamlessly at 7.854 s. Amplitudes,
// axes and the per-resident idlePhase are untouched.
const NPC_IDLE_BOB_RATE = 1.6;
const NPC_IDLE_ROLL_RATE = 0.8;
const NPC_IDLE_DURATION = (2 * Math.PI) / NPC_IDLE_ROLL_RATE;

/**
 * Where each resident's carried kit belongs.
 *
 * In Harvest Frontier every one of these props is a DIRECT CHILD OF THE ROOT at
 * a fixed offset, so it does not inherit the idle bob and it does not touch the
 * figure. At the game's 19 m chase camera that is invisible; at storefront
 * framing the basket and the ledger hang in mid air, which is what makes the
 * export unsellable as authored.
 *
 * `hold` clusters are re-parented onto the resident's own hand node
 * (`handLeft` / `handRight`, the sockets characterKit's gloveParts fill) and
 * then translated as ONE cluster until the nearest face of their bounding box
 * meets the palm, so the pose the artist composed survives and only the gap
 * closes. `wear` clusters (satchel, strap, apron) go onto `body`: they are worn
 * against the torso and already sit correctly, they only needed to stop being
 * root-parented so the bob carries them. `drop` clusters are floor set
 * dressing, not carried kit (two of the crate slats even reach y = -0.06), so
 * they are removed rather than stuck to a hand they were never held in.
 */
interface NpcKitPlan {
  readonly hold: Readonly<Record<string, readonly string[]>>;
  readonly wear: readonly string[];
  readonly drop: readonly string[];
}

const NPC_KIT: Readonly<Record<string, NpcKitPlan>> = {
  'npc.kang-taeho': {
    hold: { handLeft: ['harvestBasket', 'tomatoSample'] },
    wear: ['fieldSatchel', 'fieldSatchelStrap'],
    drop: [],
  },
  'npc.park-yuna': {
    hold: { handLeft: ['fieldClipboard', 'clipboardClip'], handRight: ['soilProbe', 'soilProbeTip'] },
    wear: [],
    drop: [],
  },
  'npc.choi-minseo': {
    hold: { handLeft: ['marketLedger', 'marketLedgerBand'], handRight: ['premiumPriceTag', 'premiumPriceTagLine'] },
    wear: [],
    drop: ['marketSampleCrate', 'marketCrateSlatLeft', 'marketCrateSlatRight', 'marketGrapeSample'],
  },
  'npc.han-seojun': {
    hold: { handLeft: ['cooperativeLedger', 'cooperativeLedgerClip'], handRight: ['qualitySampleRing'] },
    wear: ['sortingApron', 'sortingApronPocket'],
    drop: ['cooperativeSampleCrate', 'cooperativeCrateSlatLeft', 'cooperativeCrateSlatRight'],
  },
  'npc.lee-eunha': {
    hold: { handLeft: ['festivalLedger', 'festivalLedgerBinding'], handRight: ['festivalBannerPole', 'festivalBanner', 'festivalBannerMark'] },
    wear: [],
    drop: [],
  },
};

interface NpcKitResult {
  held: Record<string, string[]>;
  worn: string[];
  removed: string[];
  snapMetres: Record<string, number>;
  leftOnRoot: string[];
}

/**
 * Apply {@link NPC_KIT} to one resident. Returns what actually happened, so the
 * exporter records the outcome instead of asserting it.
 */
function resocketNpcKit(root: THREE.Object3D, id: string): NpcKitResult {
  const plan = NPC_KIT[id];
  if (!plan) throw new Error(`no kit plan for ${id}`);
  const result: NpcKitResult = { held: {}, worn: [], removed: [], snapMetres: {}, leftOnRoot: [] };
  root.updateMatrixWorld(true);

  for (const name of plan.drop) {
    const prop = root.getObjectByName(name);
    if (!prop) continue;
    prop.removeFromParent();
    result.removed.push(name);
  }

  const body = root.getObjectByName('body');
  if (body) {
    for (const name of plan.wear) {
      const prop = root.getObjectByName(name);
      if (!prop) continue;
      // attach() re-parents while preserving the world transform, so a worn item
      // stays exactly where it was authored and only changes what drives it.
      body.attach(prop);
      result.worn.push(name);
    }
  }

  for (const [handName, names] of Object.entries(plan.hold)) {
    const hand = root.getObjectByName(handName);
    if (!hand) continue;
    const slot = new THREE.Group();
    slot.name = `${handName}.carry`;
    hand.add(slot);
    hand.updateMatrixWorld(true);
    const attached: string[] = [];
    for (const name of names) {
      const prop = root.getObjectByName(name);
      if (!prop) continue;
      slot.attach(prop);
      attached.push(name);
    }
    if (attached.length === 0) {
      slot.removeFromParent();
      continue;
    }
    root.updateMatrixWorld(true);
    // Close the gap: move the whole cluster until the nearest point of its
    // bounding box lands on the palm. clampPoint returns the palm itself when
    // the palm is already inside the box, which makes this a no-op for kit that
    // was authored in the hand already.
    const box = new THREE.Box3().setFromObject(slot);
    const palm = hand.getWorldPosition(new THREE.Vector3());
    const nearest = box.clampPoint(palm, new THREE.Vector3());
    const deltaWorld = palm.clone().sub(nearest);
    const rotation = hand.getWorldQuaternion(new THREE.Quaternion()).invert();
    const scale = hand.getWorldScale(new THREE.Vector3());
    slot.position.copy(deltaWorld.clone().applyQuaternion(rotation).divide(scale));
    root.updateMatrixWorld(true);
    result.held[handName] = attached;
    result.snapMetres[handName] = Math.round(deltaWorld.length() * 1000) / 1000;
  }

  for (const child of root.children) {
    if (child.name !== 'body') result.leftOnRoot.push(child.name || child.type);
  }
  return result;
}

function npcTargets(): Target[] {
  return createFarmNpcs().map((npc) => ({
    group: 'npc' as const,
    slug: npc.id.replace('npc.', ''),
    provenanceId: 'farm.npcs.m2',
    note: 'idle clip replays updateFarmNpcIdle; roll rate 0.72 -> 0.8 rad/s so the loop closes at 7.854 s. Carried kit is re-socketed off the root onto the hand / body nodes (see kit) so it follows the idle instead of hanging in mid air.',
    build: () => {
      const fresh = createFarmNpcs().find((n) => n.id === npc.id)!;
      fresh.root.position.set(0, 0, 0);
      const root = crossThree<THREE.Object3D>(fresh.root);
      const kit = resocketNpcKit(root, npc.id);
      const body = root.getObjectByName('body')!;
      const phase = Number(root.userData.idlePhase ?? 0);
      const joints: JointSample[] = [{ node: body, position: true }];
      const clip = bakeClip('idle', NPC_IDLE_DURATION, FPS, joints, (t) => {
        updateFarmNpcIdle(fresh, t);
        body.position.y = Math.sin(t * NPC_IDLE_BOB_RATE + phase) * 0.018;
        body.rotation.z = Math.sin(t * NPC_IDLE_ROLL_RATE + phase) * 0.012;
      });
      body.position.y = 0;
      body.rotation.z = 0;
      return { root, clips: [clip], extra: { kit } };
    },
  }));
}

// ── Player farmhand (full rig: idle / walk / four tool swings) ──────────────
function playerTarget(): Target {
  return {
    group: 'npc',
    slug: 'player-farmhand',
    provenanceId: null,
    note: 'clips replay PlayerMotionController; walk spine-sway rate 3.1 -> gait omega so the stride loop closes',
    build: () => {
      const jointNames = [
        'playerRig', 'pelvis', 'spine', 'headPivot',
        'leftUpperArmPivot', 'leftLowerArmPivot', 'rightUpperArmPivot', 'rightLowerArmPivot',
        'leftThighPivot', 'leftShinPivot', 'rightThighPivot', 'rightShinPivot', 'toolAnchor',
      ];

      const sample = (duration: number, drive: (avatar: ReturnType<typeof createPlayerAvatar>, dt: number) => void, name: string): THREE.AnimationClip => {
        const avatar = createPlayerAvatar();
        const joints: JointSample[] = jointNames.map((n) => ({ node: crossThree<THREE.Object3D>(avatar.root.getObjectByName(n)), position: true }));
        const frames = Math.max(2, Math.round(duration * FPS) + 1);
        const dt = duration / (frames - 1);
        let first = true;
        return bakeClip(name, duration, FPS, joints, () => {
          drive(avatar, first ? 0 : dt);
          first = false;
        });
      };

      // idle: breath 2.1 rad/s, head sway 0.7 rad/s -> exactly 3:1, so the pair
      // closes on its own at 2*pi/0.7 = 8.976 s. Nothing retuned.
      const idle = sample(8.976, (a, dt) => a.motion.update(dt, false, 0), 'idle');

      // walk: one full stride cycle at the reference speed.
      const omega = gaitAngularVelocity(GAIT_SPEED_REFERENCE);
      const walkDuration = (2 * Math.PI) / omega;
      const intensity = gaitIntensity(GAIT_SPEED_REFERENCE);
      let walkTime = 0;
      const walk = sample(walkDuration, (a, dt) => {
        a.motion.update(dt, true, GAIT_SPEED_REFERENCE);
        walkTime += dt;
        const spine = a.root.getObjectByName('spine')!;
        spine.rotation.z = Math.sin(walkTime * omega) * 0.025 * intensity;
      }, 'walk');

      const actions = (Object.keys(ACTION_DURATION_SECONDS) as (keyof typeof ACTION_DURATION_SECONDS)[]).map((action) => {
        const duration = ACTION_DURATION_SECONDS[action];
        const frames = Math.round(duration * FPS) + 1;
        // The last sample must stay a hair inside the action window, or update()
        // retires the action and the final frame snaps back to the idle pose.
        const step = (duration - 1e-3) / (frames - 1);
        let started = false;
        return sample(duration, (a, dt) => {
          if (!started) {
            a.motion.setTool(action === 'hoe' ? 'hoe' : action === 'water' ? 'water' : action === 'harvest' ? 'harvest' : 'inspect');
            a.motion.trigger(action);
            a.motion.update(0, false, 0);
            started = true;
            return;
          }
          a.motion.update(dt > 0 ? step : 0, false, 0);
        }, action);
      });

      const avatar = createPlayerAvatar();
      avatar.motion.update(0, false, 0);
      // The controller parks itself on the root for the game session; it is a
      // cycle and GLTFExporter refuses to serialise the whole userData because
      // of it, which would also drop assetRole/collider.
      delete (avatar.root.userData as Record<string, unknown>).motionController;
      // The watering stream is a transient VFX cylinder that hangs below the
      // spout and below y=0; it is not part of the character and it inflates
      // the asset's bounding box by ~0.65 m.
      avatar.root.getObjectByName('waterStream')?.removeFromParent();
      // glTF has no visibility flag, so the four tool groups the rig carries
      // (only one of which is ever visible in game) would all render at once,
      // and the hoe shaft hangs through the ground in the rest pose. They ship
      // as their own asset (prop/farm-tool-kit) instead; the named `toolAnchor`
      // socket stays on the right hand so a tool can be re-parented back.
      for (const tool of TOOL_GROUP_NAMES) avatar.root.getObjectByName(tool)?.removeFromParent();
      // The authored rig origin sits at ankle height: the boot soles reach
      // y = -0.182. Ground the asset with a node translation on the un-animated
      // root (the clips drive `playerRig` and below, so nothing is disturbed).
      const root = crossThree<THREE.Object3D>(avatar.root);
      root.updateMatrixWorld(true);
      root.position.y = -new THREE.Box3().setFromObject(root).min.y;
      return { root, clips: [idle, walk, ...actions] };
    },
  };
}

const TOOL_GROUP_NAMES = ['tool.hoe', 'tool.water', 'tool.harvest', 'tool.inspect'] as const;

/** The four hand tools the player rig carries, laid out side by side at the origin. */
function toolKitTarget(): Target {
  return {
    group: 'prop', slug: 'farm-tool-kit', provenanceId: null,
    note: 'the four tool groups lifted off the player rig (hoe / watering can / harvest basket / field journal), re-seated in a row; each keeps its authored node name',
    build: () => {
      const avatar = createPlayerAvatar();
      avatar.motion.update(0, false, 0);
      avatar.root.getObjectByName('waterStream')?.removeFromParent();
      const kit = new THREE.Group();
      kit.name = 'farm-tool-kit';
      TOOL_GROUP_NAMES.forEach((name, index) => {
        const tool = crossThree<THREE.Object3D | undefined>(avatar.root.getObjectByName(name));
        if (!tool) return;
        tool.removeFromParent();
        tool.visible = true;
        tool.position.set(0, 0, 0);
        tool.quaternion.identity();
        const slot = new THREE.Group();
        slot.name = `${name}.slot`;
        slot.add(tool);
        kit.add(slot);
        slot.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(slot);
        slot.position.set(index * 0.6 - 0.9, -box.min.y, 0);
      });
      return { root: kit, clips: [] };
    },
  };
}

// ── Buildings ───────────────────────────────────────────────────────────────
function buildingTargets(): Target[] {
  return [
    {
      group: 'building', slug: 'farmhouse', provenanceId: 'processing.barn.open-front.m2',
      note: 'world copy, after createFarmBuildings runs mergeStaticParts. The ledger entry quoted is the one whose runtimeDerivative is src/engine/assets/buildings.ts, the file that authors both buildings; the visual references are ledgered separately as reference.farm-corner.generated.2026-08-19 / reference.processing-barn.generated.2026-08-19 and are not shipped geometry.',
      build: () => ({ root: isolate(crossThree<THREE.Object3D>(createFarmBuildings().farmhouse), 'farmhouse'), clips: [] }),
    },
    {
      group: 'building', slug: 'barn', provenanceId: 'processing.barn.open-front.m2',
      note: 'processing line child removed; HF already ships it as processing.line.m1.glb',
      build: () => {
        const barn = crossThree<THREE.Object3D>(createFarmBuildings().barn);
        barn.getObjectByName('processing-root')?.removeFromParent();
        return { root: isolate(barn, 'barn'), clips: [] };
      },
    },
  ];
}

// ── Crops ───────────────────────────────────────────────────────────────────
// createCropPlant() is the croplab preview path: it adds ONE stem, ONE leaf and
// ONE fruit template, because the world multiplies those templates per plant
// through createInstancedPlantField. Exporting it gives a plant with a single
// leaf lying on the ground. What is exported instead is a real one-plant field
// (rows 1 x 1) at full growth, with the instances baked into geometry.
//
// HF has no per-stage crop geometry at all: growth is a uniform runtime scale
// (setCropVegetationGrowth / setCropTileGrowth), so every earlier stage is the
// same mesh scaled down. Variants would be identical files.
function cropTargets(): Target[] {
  return CROP_DEFINITIONS.map((crop) => ({
    group: 'crop' as const,
    slug: crop.id.replace('crop.', ''),
    provenanceId: null,
    note: `silhouette ${crop.visual.silhouette}; mature plant from a 1x1 createCropField at growth 1.0 (growth is a uniform runtime scale, not distinct geometry)`,
    build: () => {
      const field = createCropField({ crop, rows: 1, plantsPerRow: 1, rowSpacing: 1, plantSpacing: 1, seed: 17, useInstanceColors: false });
      setCropTileGrowth(field.userData.vegetation, [1]);
      setCropVegetationGrowth(field.userData.vegetation, 1);
      const vegetation = crossThree<THREE.Object3D>(field.userData.vegetation);
      vegetation.removeFromParent();
      resolveInstancing(vegetation, 'bake');
      // The plant is seated on the ridge crest the field surface sampled, so it
      // arrives a few centimetres above y = 0. Ground it.
      vegetation.updateMatrixWorld(true);
      vegetation.position.y -= new THREE.Box3().setFromObject(vegetation).min.y;
      return { root: isolate(vegetation, `crop.${crop.id.replace('crop.', '')}`), clips: [] };
    },
  }));
}

// ── Props ───────────────────────────────────────────────────────────────────
const WINDMILL_CLIP_SECONDS = 8;

function propTargets(): Target[] {
  const fromProps = (childName: string, slug: string, mode: 'bake' | 'single', provenanceId: string | null, note: string): Target => ({
    group: 'prop', slug, provenanceId, note,
    build: () => {
      const props = createFarmProps(true).root;
      const found = crossThree<THREE.Object3D | undefined>(props.getObjectByName(childName));
      if (!found) throw new Error(`prop node not found: ${childName}`);
      resolveInstancing(found, mode);
      return { root: isolate(found, slug), clips: [] };
    },
  });

  return [
    {
      group: 'prop', slug: 'farm-windmill', provenanceId: 'windmill.landmark.m1',
      note: 'blades_pivot spin baked from windmillBladeAngle; 8 s loop is an arbitrary window on a continuously advancing angle',
      build: () => {
        const build = createFarmWindmill();
        const pivot = build.bladesPivot;
        const base = windmillBladeAngle(0);
        const end = windmillBladeAngle(WINDMILL_CLIP_SECONDS);
        const turns = Math.round((end - base) / (2 * Math.PI));
        const clip = bakeClip('blades-spin', WINDMILL_CLIP_SECONDS, FPS, [{ node: crossThree<THREE.Object3D>(pivot), position: false }], (t) => {
          // Snap the window onto a whole number of turns so the loop closes.
          pivot.rotation.z = base + ((windmillBladeAngle(t) - base) * ((turns * 2 * Math.PI) / (end - base)));
        });
        pivot.rotation.z = base;
        return { root: isolate(crossThree<THREE.Object3D>(build.group), 'farm-windmill'), clips: [clip] };
      },
    },
    fromProps('farmWaterButt', 'farm-water-butt', 'bake', null, 'project-original props.ts createWaterButt (butt + pump stand)'),
    // fenceLines / meadowDetail are authored as world-spanning scatter, so the
    // whole group is a 74 m x 64 m object. What is worth shipping is the
    // MODULE each instance repeats, which is what 'single' keeps.
    fromProps('fenceLines', 'fence-kit', 'single', 'texture.wood-planks-weathered.runtime.2026-08-21', 'one post + one rail module out of the 77/140 instanced run; the wood albedo map is NOT embedded (Node build has no texture loader, applyAlbedoMap no-ops)'),
    fromProps('meadowDetail', 'meadow-kit', 'single', null, 'one grass tuft + three wildflower modules out of the instanced meadow scatter'),
    fromProps('farmsteadClutter', 'farmstead-clutter', 'bake', null, 'water butt + banner sign + yard clutter as authored, world layout preserved'),
    {
      group: 'prop', slug: 'hand-cart', provenanceId: null,
      note: 'props.ts pushHandCart is not exported and every cart is merged into ONE world-space mesh, so one cart is cropped out around ROUTE_CART_ANCHORS[0] and re-seated at the origin',
      build: () => {
        const props = createFarmProps(true).root;
        const found = crossThree<THREE.Mesh | undefined>(props.getObjectByName('routeHandCarts'));
        if (!found) throw new Error('prop node not found: routeHandCarts');
        // ROUTE_CART_ANCHORS entries are [x, z, yaw].
        const [x, z] = ROUTE_CART_ANCHORS[0]!;
        const cart = cropAroundAnchor(found, x, z, 1.6);
        return { root: isolate(cart, 'hand-cart'), clips: [] };
      },
    },
  ];
}

// ── Run ─────────────────────────────────────────────────────────────────────
const PROVENANCE = JSON.parse(fs.readFileSync(
  path.resolve(HERE, '../../../Harvest Frontier/public/assets/provenance.json'), 'utf8',
)) as { entries: { assetId: string; license: string; source?: string }[] };

function licenseFor(id: string | null): { assetId: string | null; license: string } {
  if (!id) return { assetId: null, license: '장부에 없음' };
  const entry = PROVENANCE.entries.find((e) => e.assetId === id);
  if (!entry) return { assetId: id, license: '장부에 없음' };
  return { assetId: id, license: entry.license };
}

const only = process.argv.slice(2);
const targets = [...npcTargets(), playerTarget(), ...buildingTargets(), ...cropTargets(), ...propTargets(), toolKitTarget()]
  .filter((t) => only.length === 0 || only.includes(t.group) || only.includes(t.slug));

const manifest: Record<string, unknown>[] = [];

for (const target of targets) {
  const { root, clips, extra } = target.build();
  const measurement = measureScene(root);
  const buffer = await exportGlb(root, clips);
  const dir = path.join(OUT, target.group);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${target.slug}.glb`);
  fs.writeFileSync(file, buffer);
  const provenance = licenseFor(target.provenanceId);
  manifest.push({
    group: target.group,
    slug: target.slug,
    file: path.relative(OUT, file).replace(/\\/g, '/'),
    bytes: buffer.byteLength,
    ...measurement,
    clips: clips.map((c) => ({ name: c.name, seconds: Math.round(c.duration * 1000) / 1000, tracks: c.tracks.length })),
    provenanceAssetId: provenance.assetId,
    license: provenance.license,
    note: target.note,
    ...(extra ?? {}),
  });
  process.stdout.write(`${target.group}/${target.slug}.glb  ${measurement.triangles} tris  ${measurement.drawCalls} draws  ${measurement.materials} mats  ${buffer.byteLength} B  clips=${clips.map((c) => c.name).join('/') || '-'}\n`);
}

fs.mkdirSync(OUT, { recursive: true });
const manifestPath = path.join(OUT, 'manifest.raw.json');
fs.writeFileSync(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), source: 'Harvest Frontier (read-only)', assets: manifest }, null, 2));
process.stdout.write(`\nwrote ${manifestPath}\n`);
