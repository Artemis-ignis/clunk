/**
 * Does the exported player clip reproduce the pose the game actually plays?
 *
 * The exporter samples PlayerMotionController at 30 fps with its own stepping.
 * This checks the result INDEPENDENTLY: it drives a fresh controller at a
 * different timestep (1/240 s) to a given phase — the pose is a pure function of
 * phase, so the two must agree — and compares that against the exported GLB
 * evaluated by a real AnimationMixer at the same phase.
 *
 * Reported per joint: the angle between the two local quaternions, in degrees.
 * A sign error, a missed parent rotation or a left/right swap all show up here
 * as a large angle on a specific joint, which is what the strip images then
 * make visible.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as CT from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createPlayerAvatar, ACTION_DURATION_SECONDS } from '../../../Harvest Frontier/src/engine/animation/playerMotion';
import { GAIT_SPEED_REFERENCE, gaitAngularVelocity } from '../../../Harvest Frontier/src/engine/animation/gait';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../examples/harvest-frontier/exports');

export const PLAYER_JOINTS = [
  'playerRig', 'pelvis', 'spine', 'headPivot',
  'leftUpperArmPivot', 'leftLowerArmPivot', 'rightUpperArmPivot', 'rightLowerArmPivot',
  'leftThighPivot', 'leftShinPivot', 'rightThighPivot', 'rightShinPivot', 'toolAnchor',
] as const;

export type Quat = [number, number, number, number];
export type Vec3 = [number, number, number];
export interface Pose { quaternion: Record<string, Quat>; position: Record<string, Vec3> }

const FINE_STEP = 1 / 240;

/**
 * The joints the exporter mirrors on the four ACTION clips, because
 * `applyAction` drives them toward +Z while the rig is authored front = -Z.
 * See the AXIS FIX note in export-hf-assets.mts.
 */
const MIRRORED_TOOL_CHAIN = [
  'leftUpperArmPivot', 'leftLowerArmPivot', 'rightUpperArmPivot', 'rightLowerArmPivot', 'toolAnchor',
] as const;

/** Drive a real controller to `phase` of `clipName` and read its local TRS. */
export function gamePose(clipName: string, phase: number, mirrorToolChain = false): Pose {
  const avatar = createPlayerAvatar();
  if (clipName === 'idle' || clipName === 'walk') {
    const moving = clipName === 'walk';
    const speed = moving ? GAIT_SPEED_REFERENCE : 0;
    const duration = moving ? (2 * Math.PI) / gaitAngularVelocity(GAIT_SPEED_REFERENCE) : (2 * Math.PI) / 0.7;
    const target = duration * phase;
    let elapsed = 0;
    avatar.motion.update(0, moving, speed);
    while (elapsed + 1e-9 < target) {
      const step = Math.min(FINE_STEP, target - elapsed);
      avatar.motion.update(step, moving, speed);
      elapsed += step;
    }
  } else {
    const action = clipName as keyof typeof ACTION_DURATION_SECONDS;
    const duration = ACTION_DURATION_SECONDS[action];
    // Stay a hair inside the window: at elapsed >= duration the controller
    // retires the action and falls back to idle.
    const target = Math.min(duration * phase, duration - 1e-3);
    avatar.motion.setTool(action === 'hoe' ? 'hoe' : action === 'water' ? 'water' : action === 'harvest' ? 'harvest' : 'inspect');
    avatar.motion.trigger(action);
    avatar.motion.update(0, false, 0);
    let elapsed = 0;
    while (elapsed + 1e-9 < target) {
      const step = Math.min(FINE_STEP, target - elapsed);
      avatar.motion.update(step, false, 0);
      elapsed += step;
    }
  }
  if (mirrorToolChain) {
    for (const name of MIRRORED_TOOL_CHAIN) {
      const node = (avatar.root as unknown as CT.Object3D).getObjectByName(name);
      if (node) node.rotation.set(-node.rotation.x, -node.rotation.y, node.rotation.z);
    }
  }
  return readPose(avatar.root as unknown as CT.Object3D);
}

export function readPose(root: CT.Object3D): Pose {
  const pose: Pose = { quaternion: {}, position: {} };
  for (const name of PLAYER_JOINTS) {
    const node = root.getObjectByName(name);
    if (!node) continue;
    pose.quaternion[name] = [node.quaternion.x, node.quaternion.y, node.quaternion.z, node.quaternion.w];
    pose.position[name] = [node.position.x, node.position.y, node.position.z];
  }
  return pose;
}

export async function loadGlb(file: string): Promise<{ scene: CT.Group; animations: CT.AnimationClip[] }> {
  const buffer = fs.readFileSync(file);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const loader = new GLTFLoader();
  return await new Promise((ok, fail) => loader.parse(arrayBuffer as ArrayBuffer, '', (g) => ok({ scene: g.scene, animations: g.animations }), fail));
}

/** Angle between two unit quaternions, in degrees, sign-insensitive (q and -q are the same rotation). */
export function quatAngleDegrees(a: Quat, b: Quat): number {
  const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return (2 * Math.acos(Math.min(1, dot)) * 180) / Math.PI;
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  const file = path.join(OUT, 'npc', 'player-farmhand.glb');
  const { scene, animations } = await loadGlb(file);
  const phases = [0, 0.25, 0.5, 0.75, 1];
  const rows: Record<string, unknown>[] = [];
  let worst = 0;
  let worstLabel = '';

  for (const clip of animations) {
    const mixer = new CT.AnimationMixer(scene);
    const action = mixer.clipAction(clip);
    action.play();
    for (const phase of phases) {
      mixer.setTime(0);
      mixer.setTime(clip.duration * Math.min(phase, 1 - 1e-6));
      const clipPose = readPose(scene);
      // The four action clips ship mirrored; idle and walk ship verbatim.
      const mirrored = clip.name !== 'idle' && clip.name !== 'walk';
      const reference = gamePose(clip.name, phase, mirrored);
      const rawGame = mirrored ? gamePose(clip.name, phase, false) : reference;
      const measure = (against: Pose) => PLAYER_JOINTS.map((joint) => ({
        joint,
        deg: quatAngleDegrees(against.quaternion[joint] ?? [0, 0, 0, 1], clipPose.quaternion[joint] ?? [0, 0, 0, 1]),
        posDelta: Math.max(...(against.position[joint] ?? [0, 0, 0]).map((v, i) => Math.abs(v - (clipPose.position[joint]?.[i] ?? 0)))),
      }));
      const diffs = measure(reference);
      const top = [...diffs].sort((a, b) => b.deg - a.deg)[0]!;
      const vsRaw = Math.max(...measure(rawGame).map((d) => d.deg));
      if (top.deg > worst) { worst = top.deg; worstLabel = `${clip.name}@${phase} ${top.joint}`; }
      rows.push({
        clip: clip.name,
        phase,
        referenceIsMirrored: mirrored,
        maxDegVsReference: Math.round(top.deg * 100) / 100,
        worstJoint: top.joint,
        maxPosVsReference: Math.round(Math.max(...diffs.map((d) => d.posDelta)) * 10000) / 10000,
        maxDegVsUnmirroredGame: Math.round(vsRaw * 100) / 100,
      });
      process.stdout.write(`${clip.name.padEnd(9)} phase ${String(phase).padEnd(5)} vs ${(mirrored ? 'mirrored ref' : 'game verbatim')} ${top.deg.toFixed(2).padStart(6)} deg (${top.joint})   vs unmirrored game ${vsRaw.toFixed(1).padStart(6)} deg\n`);
    }
    action.stop();
    mixer.uncacheClip(clip);
  }
  fs.writeFileSync(path.join(OUT, 'clip-vs-game.json'), JSON.stringify({
    checkedAt: new Date().toISOString(),
    method: 'PlayerMotionController driven at 1/240 s to each phase, against the exported GLB evaluated by AnimationMixer at the same phase. idle/walk compare against the controller verbatim; the four action clips compare against the controller PLUS the documented axis mirror, and also report how far they sit from the unmirrored game pose.',
    mirroredNodes: [...MIRRORED_TOOL_CHAIN],
    worstDegrees: Math.round(worst * 100) / 100,
    worstAt: worstLabel,
    rows,
  }, null, 2));
  process.stdout.write(`\nworst disagreement: ${worst.toFixed(2)} deg at ${worstLabel}\n`);
}
