/**
 * Harvest Frontier -> GLB export.
 *
 * Reads HF factories (read-only) and writes GLBs under
 * Clunk/examples/harvest-frontier/exports/. Nothing is written into HF.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THREE, bakeClip, cropAroundAnchor, exportGlb, isolate, measureScene, resolveInstancing, type JointSample } from './lib.mts';

import { createFarmNpcs, updateFarmNpcIdle } from '../../../Harvest Frontier/src/engine/assets/npcs';
import { createFarmBuildings } from '../../../Harvest Frontier/src/engine/assets/buildings';
import { createFarmProps, createFarmWindmill, windmillBladeAngle, ROUTE_CART_ANCHORS } from '../../../Harvest Frontier/src/engine/assets/props';
import { createCropPlant } from '../../../Harvest Frontier/src/engine/assets/crops';
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
  build: () => { root: THREE.Object3D; clips: THREE.AnimationClip[] };
}

// ── NPC residents ───────────────────────────────────────────────────────────
// The only motion the engine gives a resident is updateFarmNpcIdle: a vertical
// bob on `body` at 1.6 rad/s and a roll at 0.72 rad/s. 1.6/0.72 = 20/9, so the
// authored pair only closes after 78.5 s. The roll is retuned to 0.8 rad/s
// (2:1 against the bob) so the clip loops seamlessly at 7.854 s. Amplitudes,
// axes and the per-resident idlePhase are untouched.
const NPC_IDLE_BOB_RATE = 1.6;
const NPC_IDLE_ROLL_RATE = 0.8;
const NPC_IDLE_DURATION = (2 * Math.PI) / NPC_IDLE_ROLL_RATE;

function npcTargets(): Target[] {
  return createFarmNpcs().map((npc) => ({
    group: 'npc' as const,
    slug: npc.id.replace('npc.', ''),
    provenanceId: 'farm.npcs.m2',
    note: 'idle clip replays updateFarmNpcIdle; roll rate 0.72 -> 0.8 rad/s so the loop closes at 7.854 s',
    build: () => {
      const fresh = createFarmNpcs().find((n) => n.id === npc.id)!;
      const root = fresh.root;
      root.position.set(0, 0, 0);
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
      return { root, clips: [clip] };
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
        const joints: JointSample[] = jointNames.map((n) => ({ node: avatar.root.getObjectByName(n)!, position: true }));
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
      return { root: avatar.root, clips: [idle, walk, ...actions] };
    },
  };
}

// ── Buildings ───────────────────────────────────────────────────────────────
function buildingTargets(): Target[] {
  return [
    {
      group: 'building', slug: 'farmhouse', provenanceId: 'reference.farm-corner.generated.2026-08-19',
      note: 'world copy, after createFarmBuildings runs mergeStaticParts',
      build: () => ({ root: isolate(createFarmBuildings().farmhouse, 'farmhouse'), clips: [] }),
    },
    {
      group: 'building', slug: 'barn', provenanceId: 'processing.barn.open-front.m2',
      note: 'processing line child removed; HF already ships it as processing.line.m1.glb',
      build: () => {
        const barn = createFarmBuildings().barn;
        barn.getObjectByName('processing-root')?.removeFromParent();
        return { root: isolate(barn, 'barn'), clips: [] };
      },
    },
  ];
}

// ── Crops ───────────────────────────────────────────────────────────────────
// HF has no per-stage crop geometry: growth is a uniform scale applied at
// runtime (setCropVegetationGrowth), so every stage is the same mesh. What is
// exported is the mature plant, which is the only authored form.
function cropTargets(): Target[] {
  return CROP_DEFINITIONS.map((crop) => ({
    group: 'crop' as const,
    slug: crop.id.replace('crop.', ''),
    provenanceId: null,
    note: `silhouette ${crop.visual.silhouette}; mature form (growth is a uniform runtime scale, not distinct geometry)`,
    build: () => ({ root: isolate(createCropPlant(crop, 17), `crop.${crop.id.replace('crop.', '')}`), clips: [] }),
  }));
}

// ── Props ───────────────────────────────────────────────────────────────────
const WINDMILL_CLIP_SECONDS = 8;

function propTargets(): Target[] {
  const fromProps = (childName: string, slug: string, mode: 'bake' | 'single', provenanceId: string | null, note: string): Target => ({
    group: 'prop', slug, provenanceId, note,
    build: () => {
      const props = createFarmProps(true).root;
      let found: THREE.Object3D | null = null;
      props.traverse((n) => { if (!found && n.name === childName) found = n; });
      if (!found) throw new Error(`prop node not found: ${childName}`);
      const node = found as THREE.Object3D;
      resolveInstancing(node, mode);
      return { root: isolate(node, slug), clips: [] };
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
        const clip = bakeClip('blades-spin', WINDMILL_CLIP_SECONDS, FPS, [{ node: pivot, position: false }], (t) => {
          // Snap the window onto a whole number of turns so the loop closes.
          pivot.rotation.z = base + ((windmillBladeAngle(t) - base) * ((turns * 2 * Math.PI) / (end - base)));
        });
        pivot.rotation.z = base;
        return { root: isolate(build.group, 'farm-windmill'), clips: [clip] };
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
        let found: THREE.Object3D | null = null;
        props.traverse((n) => { if (!found && n.name === 'routeHandCarts') found = n; });
        // ROUTE_CART_ANCHORS entries are [x, z, yaw].
        const [x, z] = ROUTE_CART_ANCHORS[0]!;
        const cart = cropAroundAnchor(found as THREE.Mesh, x, z, 1.6);
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
const targets = [...npcTargets(), playerTarget(), ...buildingTargets(), ...cropTargets(), ...propTargets()]
  .filter((t) => only.length === 0 || only.includes(t.group) || only.includes(t.slug));

const manifest: Record<string, unknown>[] = [];

for (const target of targets) {
  const { root, clips } = target.build();
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
  });
  process.stdout.write(`${target.group}/${target.slug}.glb  ${measurement.triangles} tris  ${measurement.drawCalls} draws  ${measurement.materials} mats  ${buffer.byteLength} B  clips=${clips.map((c) => c.name).join('/') || '-'}\n`);
}

fs.mkdirSync(OUT, { recursive: true });
const manifestPath = path.join(OUT, 'manifest.raw.json');
fs.writeFileSync(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), source: 'Harvest Frontier (read-only)', assets: manifest }, null, 2));
process.stdout.write(`\nwrote ${manifestPath}\n`);
