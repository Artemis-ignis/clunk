/**
 * The four machines' in-game motion, transcribed from Harvest Frontier's own
 * driver code, with the source line cited for every number.
 *
 * Nothing here is invented. Where a rate had to be nudged so a clip loops
 * seamlessly, the nudge is a per-channel factor computed by
 * {@link chooseLoopDuration} / {@link closureFactor} and reported in the
 * manifest, never folded silently into the constant.
 */

/**
 * Working speed. `IMPLEMENT_WORK_MAX_SPEED` is the cap `simulateVehicle`
 * applies while an implement is attached, i.e. the speed the tractor actually
 * cruises at when it is doing field work.
 * Source: src/game/simulation/mechanization.ts:201 (exported).
 */
export const WORK_SPEED = 6.6;

export type Axis = 'x' | 'y' | 'z';

export interface RotationSpec {
  /**
   * Node name exactly as it appears in the glTF file. The dots ARE preserved
   * there - it is three's GLTFLoader that strips them on load, because its
   * PropertyBinding splits track names on '.'. Addressing the file through
   * @gltf-transform therefore needs the authored, dotted name.
   */
  node: string;
  axis: Axis;
  /** Radians per second at {@link WORK_SPEED}. Sign included. */
  radPerSecond: number;
  /** Where this rate comes from. */
  source: string;
  /** Set when the rate is derived from a rolling radius, for the report. */
  radius?: number;
}

export interface ConstantSpec {
  node: string;
  axis: Axis;
  radians: number;
  source: string;
}

export interface OscillationSpec {
  node: string;
  axis: Axis;
  amplitude: number;
  /** Radians of phase per second at {@link WORK_SPEED}. */
  radPerSecond: number;
  phaseOffset: number;
  source: string;
}

export interface TranslationSpec {
  node: string;
  axis: Axis;
  metresPerSecond: number;
  /** Value at which the driver wraps, and how much it subtracts. */
  wrapAbove: number;
  wrapBy: number;
  source: string;
}

const rolling = (node: string, radius: number, source: string, speed = WORK_SPEED): RotationSpec => ({
  node, axis: 'z', radPerSecond: -(speed / radius), radius, source,
});

// ── Tractor ─────────────────────────────────────────────────────────────────
// simulateVehicle, src/app/gameSession.ts:5296-5299
//   const radius = Number(wheel.userData.radius ?? 0.65);
//   wheel.rotation.z -= (this.vehicleSpeed * dt) / radius;
// Radii from the wheel spec table, src/engine/assets/tractor.ts:377-382.
export const TRACTOR_WHEELS: RotationSpec[] = [
  rolling('wheelFrontLeft', 0.57, 'gameSession.ts:5296-5299 roll; radius 0.57 from tractor.ts:378'),
  rolling('wheelFrontRight', 0.57, 'gameSession.ts:5296-5299 roll; radius 0.57 from tractor.ts:379'),
  rolling('wheelRearLeft', 0.76, 'gameSession.ts:5296-5299 roll; radius 0.76 from tractor.ts:380'),
  rolling('wheelRearRight', 0.76, 'gameSession.ts:5296-5299 roll; radius 0.76 from tractor.ts:381'),
];

/**
 * Ackermann steering, transcribed from src/app/gameSession.ts:5256-5271.
 * `pivotZ` is the knuckle's authored z (negative = left), which is what the
 * driver tests to decide inner vs outer wheel.
 */
export const TRACTOR_STEERING = {
  limit: 0.38,
  slewRadPerSecond: 1.8,
  wheelbase: 2.25,
  track: 1.66,
  cabWheelRatio: 1.8,
  source: 'gameSession.ts:5256-5271 (targetSteering = steering * 0.38, moveTowards at 1.8 rad/s, wheelbase 2.25, track 1.66, steeringPivot.rotation.y = vehicleSteering * 1.8)',
} as const;

export function ackermannKnuckle(steering: number, pivotZ: number): number {
  const magnitude = Math.abs(steering);
  const sign = Math.sign(steering);
  if (magnitude <= 0.001) return 0;
  const turnRadius = TRACTOR_STEERING.wheelbase / Math.tan(magnitude);
  const inner = Math.atan(TRACTOR_STEERING.wheelbase / Math.max(0.1, turnRadius - TRACTOR_STEERING.track / 2));
  const outer = Math.atan(TRACTOR_STEERING.wheelbase / (turnRadius + TRACTOR_STEERING.track / 2));
  const isInside = sign > 0 ? pivotZ > 0 : pivotZ < 0;
  return sign * (isInside ? inner : outer);
}

/** `moveTowards(current, target, 1.8 * dt)` from gameSession.ts:5257. */
export function slewSteering(current: number, target: number, dt: number): number {
  const step = TRACTOR_STEERING.slewRadPerSecond * dt;
  if (Math.abs(target - current) <= step) return target;
  return current + Math.sign(target - current) * step;
}

// ── Field cultivator ────────────────────────────────────────────────────────
// updateFieldCultivatorMotion, src/engine/assets/implements.ts:598-630.
export const CULTIVATOR_WHEELS: RotationSpec[] = [
  rolling('gaugeWheelLeft', 0.22, 'implements.ts:605-610 roll; radius 0.22 from implements.ts:443'),
  rolling('gaugeWheelRight', 0.22, 'implements.ts:605-610 roll; radius 0.22 from implements.ts:451'),
];

/**
 * Tine compliance flex, implements.ts:617-622:
 *   const flex = working ? Math.sin(binding.phase * 8 + index * 0.82) * 0.028 : 0;
 * `binding.phase` is METRES TRAVELLED (implements.ts:603), so 8 is a spatial
 * frequency in rad/m and becomes 8 * speed rad/s at a given speed.
 */
export const CULTIVATOR_TINES: OscillationSpec[] = Array.from({ length: 7 }, (_, index) => ({
  node: `pivot.tine${String(index + 1).padStart(2, '0')}`,
  axis: 'z' as Axis,
  amplitude: 0.028,
  radPerSecond: 8 * WORK_SPEED,
  phaseOffset: index * 0.82,
  source: 'implements.ts:617-622 (sin(phase * 8 + index * 0.82) * 0.028; phase is metres, implements.ts:603)',
}));

/** Working-state link angles, implements.ts:612-615 (the values the lag converges to). */
export const CULTIVATOR_LINKS: ConstantSpec[] = [
  { node: 'pivot.hitchLowerLeft', axis: 'z', radians: -0.29, source: 'implements.ts:612 working target' },
  { node: 'pivot.hitchLowerRight', axis: 'z', radians: 0.29, source: 'implements.ts:613 working target' },
  { node: 'pivot.hitchTopLink', axis: 'z', radians: -0.19, source: 'implements.ts:614 working target' },
  { node: 'pivot.depthAdjust', axis: 'z', radians: -0.24, source: 'implements.ts:615 working target' },
];

// ── Precision seeder ────────────────────────────────────────────────────────
// updatePrecisionSeederMotion, src/engine/assets/seeder.ts:1395-1421.
const STATIONS = ['01', '02', '03', '04'] as const;

export const SEEDER_WHEELS: RotationSpec[] = STATIONS.flatMap((station) => [
  rolling(`openerDisc${station}Left`, 0.255, `seeder.ts:1412-1415 roll; radius 0.255 from seeder.ts:879-885 userData.radius`),
  rolling(`openerDisc${station}Right`, 0.255, `seeder.ts:1412-1415 roll; radius 0.255 from seeder.ts:879-885 userData.radius`),
  rolling(`gaugeWheel${station}`, 0.21, `seeder.ts:1412-1415 roll; radius 0.21 from seeder.ts:896-903 userData.radius`),
  rolling(`closingWheel${station}Left`, 0.18, `seeder.ts:1412-1415 roll; radius 0.18 from seeder.ts:914-924 userData.radius`),
  rolling(`closingWheel${station}Right`, 0.18, `seeder.ts:1412-1415 roll; radius 0.18 from seeder.ts:914-924 userData.radius`),
]);

/**
 * Seed-meter shafts, seeder.ts:1417-1420:
 *   pivot.rotation.z -= speed * dt * driveRatio;
 * driveRatio = userData.driveRatioRadPerMeter = 1.6 (seeder.ts:576) for all four.
 */
export const SEEDER_METER_SHAFTS: RotationSpec[] = STATIONS.map((station) => ({
  node: `pivot.seedMeterShaft${station}`,
  axis: 'z' as Axis,
  radPerSecond: -(WORK_SPEED * 1.6),
  source: 'seeder.ts:1417-1420; driveRatioRadPerMeter 1.6 from seeder.ts:576 userData',
}));

/** Working-state angles the lag converges to, seeder.ts:1402-1403. */
export const SEEDER_LINKS: ConstantSpec[] = [
  ...STATIONS.map((station) => ({
    node: `pivot.rowUnit${station}`,
    axis: 'z' as Axis,
    radians: -0.055,
    source: 'seeder.ts:1402 targetRowAngle (also userData.workingAngle, seeder.ts:615)',
  })),
  { node: 'pivot.depthAdjust', axis: 'z', radians: -0.12, source: 'seeder.ts:1403 targetDepthAngle' },
];

// ── Processing line ─────────────────────────────────────────────────────────
// updateProcessingMachine, src/engine/assets/processingMachine.ts:536-547.
export const PROCESSING_ROTATIONS: RotationSpec[] = [
  { node: 'mixerPivot', axis: 'y', radPerSecond: 2.4, source: 'processingMachine.ts:540 (rotation.y += dt * 2.4)' },
  { node: 'pumpPivot', axis: 'x', radPerSecond: 4.6, source: 'processingMachine.ts:541 (rotation.x += dt * 4.6)' },
  { node: 'conveyorRollerA', axis: 'x', radPerSecond: -3.8, source: 'processingMachine.ts:542 (rotation.x -= dt * 3.8)' },
  { node: 'conveyorRollerB', axis: 'x', radPerSecond: -3.8, source: 'processingMachine.ts:543 (rotation.x -= dt * 3.8)' },
];

/**
 * The belt is seven translating stripe MESHES, not a UV scroll and not a
 * texture offset - `conveyorBelt` itself never moves and the rollers carry no
 * texture. processingMachine.ts:544-546:
 *   stripe.position.z += dt * 1.35;
 *   if (stripe.position.z > 1.34) stripe.position.z -= 2.8;
 * so the belt's own loop period is exactly 2.8 / 1.35 s.
 */
export const PROCESSING_BELT: TranslationSpec[] = Array.from({ length: 7 }, (_, index) => ({
  node: `beltMark${index + 1}`,
  axis: 'z' as Axis,
  metresPerSecond: 1.35,
  wrapAbove: 1.34,
  wrapBy: 2.8,
  source: 'processingMachine.ts:544-546',
}));

export const BELT_LOOP_SECONDS = 2.8 / 1.35;

// ── Loop closure ────────────────────────────────────────────────────────────

/**
 * How much a constant rate has to be scaled so it completes a WHOLE number of
 * turns in `duration`. Returns 1 when it already does.
 */
export function closureFactor(radPerSecond: number, duration: number): number {
  const turns = (Math.abs(radPerSecond) * duration) / (2 * Math.PI);
  if (turns < 1e-9) return 1;
  const target = Math.max(1, Math.round(turns));
  return target / turns;
}

/**
 * Pick the clip length. A shorter loop is worth more on a storefront than a
 * marginally smaller rate nudge, so this returns the SHORTEST length in
 * `[lo, hi]` whose worst per-channel nudge stays inside `tolerance`, and falls
 * back to the least-nudge length if nothing qualifies.
 *
 * `mustDivide`, when given, restricts the search to whole multiples of that
 * period: the conveyor belt wraps at an exact distance and stretching it would
 * make every stripe jump.
 */
export function chooseLoopDuration(
  rates: readonly number[],
  lo: number,
  hi: number,
  options: { mustDivide?: number; tolerance?: number } = {},
): { duration: number; worstFactor: number } {
  const tolerance = options.tolerance ?? 0.03;
  const candidates: number[] = [];
  if (options.mustDivide) {
    for (let n = 1; n * options.mustDivide <= hi + 1e-9; n += 1) {
      if (n * options.mustDivide >= lo - 1e-9) candidates.push(n * options.mustDivide);
    }
  } else {
    for (let t = lo; t <= hi; t += 0.0005) candidates.push(t);
  }
  let fallback = { duration: hi, worstFactor: Infinity };
  for (const duration of candidates) {
    let worst = 0;
    for (const rate of rates) worst = Math.max(worst, Math.abs(closureFactor(rate, duration) - 1));
    if (worst < fallback.worstFactor) fallback = { duration, worstFactor: worst };
    if (worst <= tolerance) return { duration, worstFactor: worst };
  }
  return fallback;
}
