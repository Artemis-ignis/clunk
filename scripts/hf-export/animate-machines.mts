/**
 * Bake Harvest Frontier's in-game machine motion into glTF clips.
 *
 * The four machines already ship as GLBs; the game turns their pivots from code
 * every frame, so the files themselves look dead. This reads the SHIPPED file,
 * adds animation samplers/channels to the very same document - no geometry, no
 * material and no node transform is touched - and writes a sibling copy under
 * `runtime-animated/`. Source files and the Harvest Frontier checkout are left
 * exactly as they are.
 *
 * The files are EXT_meshopt_compression, so the pass is decode -> edit ->
 * re-encode, the same NodeIO + meshopt round trip Harvest Frontier's own
 * tools/assets/optimize-*-glb.ts performs. `measure-machines.mts` then proves
 * triangles, materials and bounds survived it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Accessor, NodeIO, type Animation, type Document, type Node } from '@gltf-transform/core';
import {
  EXTMeshGPUInstancing,
  EXTMeshoptCompression,
  KHRMaterialsClearcoat,
  KHRMaterialsEmissiveStrength,
  KHRMaterialsIOR,
  KHRMaterialsSpecular,
  KHRMaterialsTransmission,
  KHRMaterialsUnlit,
  KHRMaterialsVolume,
  KHRMeshQuantization,
} from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { Euler, Quaternion } from 'three';
import {
  BELT_LOOP_SECONDS, CULTIVATOR_LINKS, CULTIVATOR_TINES, CULTIVATOR_WHEELS,
  PROCESSING_BELT, PROCESSING_ROTATIONS, SEEDER_LINKS, SEEDER_METER_SHAFTS, SEEDER_WHEELS,
  TRACTOR_STEERING, TRACTOR_WHEELS, WORK_SPEED,
  ackermannKnuckle, chooseLoopDuration, closureFactor, slewSteering,
  type Axis, type ConstantSpec, type OscillationSpec, type RotationSpec, type TranslationSpec,
} from './machine-motion.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.resolve(HERE, '../../examples/harvest-frontier/runtime');
const TARGET = path.resolve(HERE, '../../examples/harvest-frontier/runtime-animated');
const FPS = 30;
/** No slerp segment may exceed a quarter turn, or a fast wheel reads as jitter. */
const MAX_SEGMENT_RADIANS = Math.PI / 2;

const io = new NodeIO()
  .registerExtensions([
    EXTMeshGPUInstancing, EXTMeshoptCompression,
    KHRMaterialsEmissiveStrength, KHRMaterialsClearcoat, KHRMaterialsIOR, KHRMaterialsSpecular,
    KHRMaterialsTransmission, KHRMaterialsUnlit, KHRMaterialsVolume, KHRMeshQuantization,
  ])
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;

// ── channel plumbing ────────────────────────────────────────────────────────

interface Ctx { document: Document; animation: Animation; nodes: Map<string, Node>; report: ChannelReport[] }
interface ChannelReport {
  node: string; path: 'rotation' | 'translation'; axis: Axis;
  radPerSecond?: number; metresPerSecond?: number; radians?: number;
  loopClosureFactor?: number; keys: number; source: string;
}

function nodeMap(document: Document): Map<string, Node> {
  const map = new Map<string, Node>();
  for (const node of document.getRoot().listNodes()) {
    const name = node.getName();
    if (name && !map.has(name)) map.set(name, node);
  }
  return map;
}

/** The node's authored rotation, as the Euler three would read from it. */
function baseEuler(node: Node): Euler {
  const [x, y, z, w] = node.getRotation();
  return new Euler().setFromQuaternion(new Quaternion(x, y, z, w), 'XYZ');
}

function quaternionsFor(base: Euler, axis: Axis, angles: readonly number[]): Float32Array {
  const out = new Float32Array(angles.length * 4);
  const euler = new Euler(base.x, base.y, base.z, 'XYZ');
  const quaternion = new Quaternion();
  angles.forEach((angle, index) => {
    euler.set(
      axis === 'x' ? base.x + angle : base.x,
      axis === 'y' ? base.y + angle : base.y,
      axis === 'z' ? base.z + angle : base.z,
      'XYZ',
    );
    quaternion.setFromEuler(euler);
    out.set([quaternion.x, quaternion.y, quaternion.z, quaternion.w], index * 4);
  });
  return out;
}

function addSampler(ctx: Ctx, node: Node, targetPath: 'rotation' | 'translation', times: Float32Array, values: Float32Array, componentType: 'VEC3' | 'VEC4'): void {
  const buffer = ctx.document.getRoot().listBuffers()[0]!;
  const input = ctx.document.createAccessor().setArray(times).setType(Accessor.Type.SCALAR).setBuffer(buffer);
  const output = ctx.document.createAccessor().setArray(values).setType(componentType).setBuffer(buffer);
  const sampler = ctx.document.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');
  const channel = ctx.document.createAnimationChannel().setTargetNode(node).setTargetPath(targetPath).setSampler(sampler);
  ctx.animation.addSampler(sampler).addChannel(channel);
}

/** A constant-rate spin, sampled densely enough that slerp stays on the short arc. */
function addSpin(ctx: Ctx, spec: RotationSpec, duration: number): void {
  const node = ctx.nodes.get(spec.node);
  if (!node) throw new Error(`node not found: ${spec.node}`);
  const factor = closureFactor(spec.radPerSecond, duration);
  const rate = spec.radPerSecond * factor;
  const steps = Math.max(
    Math.ceil(duration * FPS),
    Math.ceil((Math.abs(rate) * duration) / MAX_SEGMENT_RADIANS),
  );
  const times = new Float32Array(steps + 1);
  const angles: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * duration;
    times[i] = t;
    angles.push(rate * t);
  }
  addSampler(ctx, node, 'rotation', times, quaternionsFor(baseEuler(node), spec.axis, angles), 'VEC4');
  ctx.report.push({ node: spec.node, path: 'rotation', axis: spec.axis, radPerSecond: spec.radPerSecond, loopClosureFactor: Math.round(factor * 100000) / 100000, keys: steps + 1, source: spec.source });
}

/** A sine wobble (the cultivator's tine compliance flex). */
function addOscillation(ctx: Ctx, spec: OscillationSpec, duration: number): void {
  const node = ctx.nodes.get(spec.node);
  if (!node) throw new Error(`node not found: ${spec.node}`);
  const factor = closureFactor(spec.radPerSecond, duration);
  const rate = spec.radPerSecond * factor;
  const steps = Math.max(Math.ceil(duration * FPS), Math.ceil((rate * duration) / (Math.PI / 6)));
  const times = new Float32Array(steps + 1);
  const angles: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * duration;
    times[i] = t;
    angles.push(Math.sin(t * rate + spec.phaseOffset) * spec.amplitude);
  }
  addSampler(ctx, node, 'rotation', times, quaternionsFor(baseEuler(node), spec.axis, angles), 'VEC4');
  ctx.report.push({ node: spec.node, path: 'rotation', axis: spec.axis, radPerSecond: spec.radPerSecond, loopClosureFactor: Math.round(factor * 100000) / 100000, keys: steps + 1, source: spec.source });
}

/** A link held at its working angle for the whole clip: two keys, same value. */
function addHold(ctx: Ctx, spec: ConstantSpec, duration: number): void {
  const node = ctx.nodes.get(spec.node);
  if (!node) throw new Error(`node not found: ${spec.node}`);
  const times = new Float32Array([0, duration]);
  addSampler(ctx, node, 'rotation', times, quaternionsFor(baseEuler(node), spec.axis, [spec.radians, spec.radians]), 'VEC4');
  ctx.report.push({ node: spec.node, path: 'rotation', axis: spec.axis, radians: spec.radians, keys: 2, source: spec.source });
}

/**
 * A belt stripe: linear travel with an instantaneous wrap. The wrap is written
 * as two keys 0.1 ms apart so LINEAR interpolation cannot smear the teleport
 * across a frame and make the stripe visibly slide backwards.
 */
function addBeltStripe(ctx: Ctx, spec: TranslationSpec, duration: number): void {
  const node = ctx.nodes.get(spec.node);
  if (!node) throw new Error(`node not found: ${spec.node}`);
  const base = node.getTranslation();
  const axisIndex = spec.axis === 'x' ? 0 : spec.axis === 'y' ? 1 : 2;
  const start = base[axisIndex]!;
  const period = spec.wrapBy / spec.metresPerSecond;
  const epsilon = 1e-4;
  const times: number[] = [0];
  const offsets: number[] = [0];
  let wraps = 0;
  let wrapTime = (spec.wrapAbove - start) / spec.metresPerSecond;
  while (wrapTime < duration - epsilon) {
    if (wrapTime > epsilon) {
      times.push(wrapTime - epsilon, wrapTime);
      offsets.push(-spec.wrapBy * wraps, -spec.wrapBy * (wraps + 1));
    }
    wraps += 1;
    wrapTime += period;
  }
  times.push(duration);
  offsets.push(-spec.wrapBy * wraps);

  const values = new Float32Array(times.length * 3);
  times.forEach((t, index) => {
    const value = [...base];
    value[axisIndex] = start + spec.metresPerSecond * t + offsets[index]!;
    values.set(value, index * 3);
  });
  addSampler(ctx, node, 'translation', new Float32Array(times), values, 'VEC3');
  ctx.report.push({ node: spec.node, path: 'translation', axis: spec.axis, metresPerSecond: spec.metresPerSecond, keys: times.length, source: spec.source });
}

/** An arbitrary per-frame angle function (the steering sweep). */
function addAngleTrack(ctx: Ctx, nodeName: string, axis: Axis, duration: number, steps: number, angleAt: (t: number) => number, source: string): void {
  const node = ctx.nodes.get(nodeName);
  if (!node) throw new Error(`node not found: ${nodeName}`);
  const times = new Float32Array(steps + 1);
  const angles: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * duration;
    times[i] = t;
    angles.push(angleAt(t));
  }
  addSampler(ctx, node, 'rotation', times, quaternionsFor(baseEuler(node), axis, angles), 'VEC4');
  ctx.report.push({ node: nodeName, path: 'rotation', axis, keys: steps + 1, source });
}

// ── clip definitions ────────────────────────────────────────────────────────

interface ClipPlan { name: string; build: (ctx: Ctx) => number; note: string }

const TRACTOR_ATTACHED_CULTIVATOR = 'the tractor derivative ships with its cultivator attached (tractor.ts:410-422), so the implement works while the tractor drives';

const MACHINES: { file: string; label: string; clips: ClipPlan[] }[] = [
  {
    file: 'tractor.compact.m1.glb',
    label: 'tractor',
    clips: [
      {
        name: 'drive',
        note: `straight cruise at ${WORK_SPEED} m/s (IMPLEMENT_WORK_MAX_SPEED). ${TRACTOR_ATTACHED_CULTIVATOR}. No hitch motion: nothing in the game ever writes to socket.attach.implement.`,
        build: (ctx) => {
          // The two tractor wheel radii are 4:3 (0.57 : 0.76), so 4 front turns
          // and 3 rear turns land together: d = 2*pi*0.57*4 = 14.3257 m.
          const duration = (2 * Math.PI * 0.57 * 4) / WORK_SPEED;
          for (const wheel of TRACTOR_WHEELS) addSpin(ctx, wheel, duration);
          for (const wheel of CULTIVATOR_WHEELS) if (ctx.nodes.has(wheel.node)) addSpin(ctx, wheel, duration);
          for (const tine of CULTIVATOR_TINES) if (ctx.nodes.has(tine.node)) addOscillation(ctx, tine, duration);
          for (const link of CULTIVATOR_LINKS) if (ctx.nodes.has(link.node)) addHold(ctx, link, duration);
          return duration;
        },
      },
      {
        name: 'steer',
        note: `the same cruise with the wheel held hard over each way: target steering alternates between +-${TRACTOR_STEERING.limit} rad and the column slews at ${TRACTOR_STEERING.slewRadPerSecond} rad/s, exactly as holding a turn does in game.`,
        build: (ctx) => {
          const duration = ((2 * Math.PI * 0.57 * 4) / WORK_SPEED) * 2;
          for (const wheel of TRACTOR_WHEELS) addSpin(ctx, wheel, duration);
          for (const wheel of CULTIVATOR_WHEELS) if (ctx.nodes.has(wheel.node)) addSpin(ctx, wheel, duration);

          // Replay moveTowards() at 240 Hz, then read the curve back.
          const sub = 1 / 240;
          const samples: number[] = [];
          let steering = 0;
          for (let t = 0; t <= duration + sub; t += sub) {
            samples.push(steering);
            steering = slewSteering(steering, t < duration / 2 ? TRACTOR_STEERING.limit : -TRACTOR_STEERING.limit, sub);
          }
          const steeringAt = (t: number): number => samples[Math.min(samples.length - 1, Math.round(t / sub))] ?? 0;
          const steps = Math.ceil(duration * FPS);
          for (const knuckle of ['steeringPivot.wheelFrontLeft', 'steeringPivot.wheelFrontRight']) {
            const pivotZ = ctx.nodes.get(knuckle)!.getTranslation()[2]!;
            addAngleTrack(ctx, knuckle, 'y', duration, steps, (t) => ackermannKnuckle(steeringAt(t), pivotZ), TRACTOR_STEERING.source);
          }
          addAngleTrack(ctx, 'steeringWheel', 'y', duration, steps, (t) => steeringAt(t) * TRACTOR_STEERING.cabWheelRatio, 'gameSession.ts:5271 (steeringPivot.rotation.y = vehicleSteering * 1.8; addPart registers the node as steeringWheel, tractor.ts:311)');
          return duration;
        },
      },
    ],
  },
  {
    file: 'cultivator.compact.m1.glb',
    label: 'cultivator',
    clips: [{
      name: 'work',
      note: `working pass at ${WORK_SPEED} m/s: gauge wheels roll, the seven tines flex on their compliance pivots, and the three-point links and depth link sit at their working angles.`,
      build: (ctx) => {
        const rates = [...CULTIVATOR_WHEELS.map((w) => w.radPerSecond), ...CULTIVATOR_TINES.map((t) => t.radPerSecond)];
        const { duration } = chooseLoopDuration(rates, 1.6, 3.2, { tolerance: 0.03 });
        for (const wheel of CULTIVATOR_WHEELS) addSpin(ctx, wheel, duration);
        for (const tine of CULTIVATOR_TINES) addOscillation(ctx, tine, duration);
        for (const link of CULTIVATOR_LINKS) addHold(ctx, link, duration);
        return duration;
      },
    }],
  },
  {
    file: 'seeder.compact.m1.glb',
    label: 'seeder',
    clips: [{
      name: 'sow',
      note: `sowing pass at ${WORK_SPEED} m/s: opener discs, gauge wheels and closing wheels roll on their own radii, the four seed-meter shafts turn on their ground drive, and the row units and depth link sit at their working angles. The hopper lids do NOT move: seeder.ts authors openAngle -0.72 on pivot.hopperLidNN as metadata and no runtime code ever writes to them.`,
      build: (ctx) => {
        const rates = [...SEEDER_WHEELS.map((w) => w.radPerSecond), ...SEEDER_METER_SHAFTS.map((m) => m.radPerSecond)];
        const { duration } = chooseLoopDuration(rates, 1.6, 4.0, { tolerance: 0.03 });
        for (const wheel of SEEDER_WHEELS) addSpin(ctx, wheel, duration);
        for (const shaft of SEEDER_METER_SHAFTS) addSpin(ctx, shaft, duration);
        for (const link of SEEDER_LINKS) addHold(ctx, link, duration);
        return duration;
      },
    }],
  },
  {
    file: 'processing.line.m1.glb',
    label: 'processing-line',
    clips: [{
      name: 'run',
      note: `the line processing a job: mixer, pump and both conveyor rollers turn and the seven belt stripes travel and wrap. The status lamps are NOT animated - setProcessingMachineActive switches their emissive in one hard step and Harvest Frontier has no blink period to copy, so any pulse would be invented.`,
      build: (ctx) => {
        // The belt's wrap gives it an exact period; the clip must be a whole
        // number of those or the stripes jump. Everything else is nudged to fit.
        const { duration } = chooseLoopDuration(PROCESSING_ROTATIONS.map((r) => r.radPerSecond), BELT_LOOP_SECONDS, BELT_LOOP_SECONDS * 12, { mustDivide: BELT_LOOP_SECONDS, tolerance: 0.06 });
        for (const spin of PROCESSING_ROTATIONS) addSpin(ctx, spin, duration);
        for (const stripe of PROCESSING_BELT) addBeltStripe(ctx, stripe, duration);
        return duration;
      },
    }],
  },
];

// ── run ─────────────────────────────────────────────────────────────────────

fs.mkdirSync(TARGET, { recursive: true });
const manifest: Record<string, unknown>[] = [];

for (const machine of MACHINES) {
  const inputPath = path.join(SOURCE, machine.file);
  const document = await io.read(inputPath);
  const nodes = nodeMap(document);
  const clips: Record<string, unknown>[] = [];

  for (const plan of machine.clips) {
    const animation = document.createAnimation(plan.name);
    const ctx: Ctx = { document, animation, nodes, report: [] };
    const duration = plan.build(ctx);
    const worstClosure = Math.max(0, ...ctx.report.map((c) => Math.abs((c.loopClosureFactor ?? 1) - 1)));
    clips.push({
      name: plan.name,
      seconds: Math.round(duration * 100000) / 100000,
      channels: ctx.report.length,
      worstLoopClosureAdjustment: `${(worstClosure * 100).toFixed(2)}%`,
      note: plan.note,
      tracks: ctx.report,
    });
    process.stdout.write(`${machine.label}/${plan.name}: ${duration.toFixed(4)} s, ${ctx.report.length} channels, worst loop nudge ${(worstClosure * 100).toFixed(2)}%\n`);
  }

  await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  const outputPath = path.join(TARGET, machine.file);
  await io.write(outputPath, document);
  manifest.push({
    machine: machine.label,
    file: machine.file,
    source: `examples/harvest-frontier/runtime/${machine.file}`,
    bytes: { source: fs.statSync(inputPath).size, animated: fs.statSync(outputPath).size },
    workSpeedMetresPerSecond: WORK_SPEED,
    clips,
  });
}

fs.writeFileSync(path.join(TARGET, 'clips.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: 'Harvest Frontier (read-only) driver code; every rate cites its file and line',
  method: 'read the shipped GLB with @gltf-transform (EXT_meshopt_compression decoded), add animation samplers/channels only, re-encode with meshopt - no geometry, material or node transform is edited',
  machines: manifest,
}, null, 2));
process.stdout.write(`\nwrote ${TARGET}\n`);
