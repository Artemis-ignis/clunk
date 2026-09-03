/**
 * 캡슐 머신의 소리 — 전부 그 자리에서 합성한다.
 *
 * 음원 파일을 하나도 받지 않는다. 브라우저의 WebAudio 로 다섯 가지를 만든다:
 *  1. 레버 딸깍 — 아주 짧은 밴드패스 노이즈 두 번 + 높은 사각파 한 점
 *  2. 드르륵 — 낮게 깔리는 노이즈 위에 캡슐이 부딪히는 짧은 틱을 랜덤 간격으로
 *  3. Clunk — 낮은 충격음 + 부딪히는 탁 + 금속 잔향(옛 자판기의 뼈대를 그대로 이어받음)
 *  4. 톡톡 — 캡슐이 걸렸다 흔들릴 때의 마른 소리
 *  5. 반짝 — 캡슐이 열릴 때 올라가는 아르페지오
 *
 * 브라우저는 사용자가 무언가를 누르기 전에는 소리를 내주지 않으므로, 이 함수들은
 * 반드시 클릭·키 입력 처리 안에서 처음 불려야 한다(레버가 그 지점이다).
 *
 * 헤드리스 브라우저에서는 소리를 들을 수 없으므로 어느 소리가 몇 번 불렸는지만
 * soundCallCounts() 로 세어 둔다 — 검증은 "합성 함수가 불린다" 까지만 할 수 있다.
 */

type AudioContextConstructor = typeof AudioContext;

let context: AudioContext | null = null;

/** 음소거 상태는 이 브라우저에 남는다. 서버에는 없는 값이라 첫 그림은 언제나 "소리 켜짐" 이다. */
const MUTE_KEY = "clunk.gacha.muted";
let muted = false;
let mutedLoaded = false;
const muteListeners = new Set<() => void>();

function loadMuted(): void {
  if (mutedLoaded) return;
  mutedLoaded = true;
  try { muted = localStorage.getItem(MUTE_KEY) === "1"; } catch { muted = false; }
}

export function subscribeGachaMute(onChange: () => void): () => void {
  muteListeners.add(onChange);
  return () => { muteListeners.delete(onChange); };
}

/** 지금 음소거인지. 브라우저에 저장된 값을 처음 읽을 때 한 번만 불러온다. */
export function readGachaMuted(): boolean {
  loadMuted();
  return muted;
}

/** 서버에서 그릴 때의 값. 저장소가 없으므로 언제나 소리 켜짐이다. */
export function serverGachaMuted(): boolean {
  return false;
}

export function toggleGachaMuted(): void {
  loadMuted();
  muted = !muted;
  try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch { /* 저장 실패는 소리와 상관없다. */ }
  for (const listener of muteListeners) listener();
}

export type SoundName = "lever" | "ratchet" | "rumble" | "clunk" | "bounce" | "tap" | "sparkle" | "neon"
  | "coin";

const counts: Record<SoundName, number> = {
  lever: 0, ratchet: 0, rumble: 0, clunk: 0, bounce: 0, tap: 0, sparkle: 0, neon: 0, coin: 0,
};

/** 어느 합성 함수가 몇 번 불렸는지. 소리를 들을 수 없는 환경의 유일한 증거다. */
export function soundCallCounts(): Record<SoundName, number> {
  return { ...counts };
}

function audioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const scoped = window as Window & { webkitAudioContext?: AudioContextConstructor };
  return window.AudioContext ?? scoped.webkitAudioContext ?? null;
}

/** 이 브라우저에서 소리를 낼 수 있는지. 없으면 음소거 토글도 띄우지 않는다. */
export function isGachaSoundSupported(): boolean {
  return audioContextConstructor() !== null;
}

/** 한 번 만든 오디오 문맥을 계속 쓴다. 탭마다 여러 개를 만들면 브라우저가 막는다. */
function ensureContext(): AudioContext | null {
  if (context) return context;
  const Constructor = audioContextConstructor();
  if (!Constructor) return null;
  try {
    context = new Constructor();
  } catch {
    context = null;
  }
  return context;
}

/**
 * 첫 제스처에서 오디오 문맥을 깨워 둔다. 소리는 몇 초 뒤에 나는데 그때는 이미
 * '사용자가 누른 직후' 가 아니라서 브라우저가 재생을 막는 경우가 있다.
 */
export function primeGachaSound(): void {
  const ctx = ensureContext();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

/** 소리를 낼 준비. 음소거이거나 문맥이 없으면 null 을 돌려 조용히 넘어간다. */
function begin(name: SoundName, level: number): { ctx: AudioContext; master: GainNode; at: number } | null {
  counts[name] += 1;
  if (readGachaMuted()) return null;
  const ctx = ensureContext();
  if (!ctx) return null;
  if (ctx.state === "suspended") void ctx.resume();
  const master = ctx.createGain();
  master.gain.value = level;
  master.connect(ctx.destination);
  return { ctx, master, at: ctx.currentTime + 0.01 };
}

/** 밴드패스를 통과한 아주 짧은 화이트 노이즈 — 무언가에 부딪히는 '탁'. */
function scheduleNoise(
  ctx: AudioContext,
  destination: AudioNode,
  at: number,
  { length = 0.09, frequency = 1850, q = 0.9, level = 0.28 } = {},
): void {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * length));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < frames; index += 1) {
    // 뒤로 갈수록 잦아들게 미리 곱해 둔다 — 노이즈 자체에 감쇠를 넣는 편이
    // 게인 곡선 하나로 누르는 것보다 부딪히는 소리에 가깝다.
    channel[index] = (Math.random() * 2 - 1) * (1 - index / frames) ** 2;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  source.connect(filter).connect(gain).connect(destination);
  source.start(at);
  source.stop(at + length + 0.01);
}

/** 낮은 충격음. 주파수를 아래로 훑어 내리는 것이 '쿵' 의 정체다. */
function scheduleThud(ctx: AudioContext, destination: AudioNode, at: number): void {
  const oscillator = ctx.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(120, at);
  oscillator.frequency.exponentialRampToValueAtTime(42, at + 0.18);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.5, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.24);
  oscillator.connect(gain).connect(destination);
  oscillator.start(at);
  oscillator.stop(at + 0.26);
}

/** 금속 잔향. 두 음을 살짝 어긋나게 두어 통 안에서 울린 것처럼 들리게 한다. */
function scheduleRing(ctx: AudioContext, destination: AudioNode, at: number): void {
  for (const [frequency, level] of [[523, 0.09], [781, 0.055]] as const) {
    const oscillator = ctx.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.92, at + 0.34);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
    oscillator.connect(gain).connect(destination);
    oscillator.start(at);
    oscillator.stop(at + 0.36);
  }
}

/** 짧은 음 하나. 딸깍·톡·반짝이 전부 이 하나로 만들어진다. */
function scheduleBlip(
  ctx: AudioContext,
  destination: AudioNode,
  at: number,
  { type = "square" as OscillatorType, frequency = 900, to, level = 0.1, length = 0.06 }: {
    type?: OscillatorType; frequency?: number; to?: number; level?: number; length?: number;
  },
): void {
  const target = to ?? frequency;
  const oscillator = ctx.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, at);
  if (target !== frequency) oscillator.frequency.exponentialRampToValueAtTime(target, at + length);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  oscillator.connect(gain).connect(destination);
  oscillator.start(at);
  oscillator.stop(at + length + 0.01);
}

/** 레버가 끝까지 돌아갈 때의 딸깍. */
export function playLeverClick(): void {
  const started = begin("lever", 0.85);
  if (!started) return;
  const { ctx, master, at } = started;
  scheduleNoise(ctx, master, at, { length: 0.035, frequency: 2600, q: 2.4, level: 0.3 });
  scheduleBlip(ctx, master, at + 0.004, { type: "square", frequency: 1180, to: 620, level: 0.1, length: 0.05 });
  scheduleNoise(ctx, master, at + 0.07, { length: 0.05, frequency: 1500, q: 1.6, level: 0.2 });
}

/**
 * 드르륵 — 캡슐들이 통 안에서 굴러다니는 소리.
 * 낮게 깔리는 노이즈 한 겹 위에, 캡슐이 서로 부딪히는 짧은 틱을 랜덤 간격으로 얹는다.
 */
export function playRumble(seconds: number): void {
  const started = begin("rumble", 0.8);
  if (!started) return;
  const { ctx, master, at } = started;
  const bed = ctx.createGain();
  bed.gain.setValueAtTime(0.0001, at);
  bed.gain.exponentialRampToValueAtTime(0.16, at + 0.12);
  bed.gain.setValueAtTime(0.16, at + seconds * 0.72);
  bed.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  bed.connect(master);
  scheduleNoise(ctx, bed, at, { length: seconds, frequency: 320, q: 0.6, level: 0.9 });

  let cursor = at + 0.04;
  while (cursor < at + seconds) {
    scheduleNoise(ctx, master, cursor, {
      length: 0.03 + Math.random() * 0.02,
      frequency: 1200 + Math.random() * 1600,
      q: 1.8,
      level: 0.1 + Math.random() * 0.12,
    });
    cursor += 0.035 + Math.random() * 0.075;
  }
}

/** 캡슐이 배출구에 떨어지는 순간 — 이 소리가 Clunk 다. */
export function playClunk(): void {
  const started = begin("clunk", 0.95);
  if (!started) return;
  const { ctx, master, at } = started;
  scheduleThud(ctx, master, at);
  scheduleNoise(ctx, master, at + 0.004);
  scheduleRing(ctx, master, at + 0.03);
}

/** 캡슐이 흔들리다 걸리는 톡. */
export function playCapsuleTap(strength = 1): void {
  const started = begin("tap", 0.7);
  if (!started) return;
  const { ctx, master, at } = started;
  scheduleNoise(ctx, master, at, { length: 0.045, frequency: 900 + 220 * strength, q: 2.2, level: 0.16 * strength });
  scheduleBlip(ctx, master, at, { type: "triangle", frequency: 320 * strength, to: 220, level: 0.07 * strength, length: 0.08 });
}

/** 캡슐이 열리며 빛이 터질 때 올라가는 아르페지오. */
/**
 * 동전이 투입구로 들어가는 소리 — 테두리에 한 번 닿고 안으로 떨어진다.
 * 2026-09-04: 레버가 당겨지기 전에 이 소리가 먼저 난다(운영자 요청).
 */
export function playCoinInsert(): void {
  const started = begin("coin", 0.8);
  if (!started) return;
  const { ctx, master, at } = started;
  scheduleBlip(ctx, master, at, { type: "triangle", frequency: 1860, to: 1340, level: 0.10, length: 0.1 });
  scheduleBlip(ctx, master, at + 0.085, { type: "triangle", frequency: 1420, to: 980, level: 0.075, length: 0.12 });
  scheduleNoise(ctx, master, at + 0.17, { length: 0.07, frequency: 1200, q: 3.2, level: 0.06 });
}

export function playOpenSparkle(): void {
  const started = begin("sparkle", 0.75);
  if (!started) return;
  const { ctx, master, at } = started;
  const notes = [523, 659, 784, 988, 1319];
  notes.forEach((frequency, index) => {
    scheduleBlip(ctx, master, at + index * 0.055, {
      type: "triangle",
      frequency,
      to: frequency,
      level: 0.11,
      length: 0.3,
    });
  });
  scheduleNoise(ctx, master, at + 0.02, { length: 0.5, frequency: 5200, q: 0.7, level: 0.06 });
}

/**
 * 크랭크 래칫 — 손잡이를 돌릴 때 나는 짧은 딸깍의 연속.
 *
 * 반다이 가샤폰의 손잡이는 한 바퀴 도는 동안 톱니를 계속 넘어간다. 그래서 한 번의
 * 소리가 아니라 ticks 번의 짧은 클릭을 점점 촘촘하게(마지막이 가장 빠르게) 늘어놓는다.
 */
export function playCrankRatchet(ticks = 9, seconds = 0.75): void {
  const started = begin("ratchet", 0.8);
  if (!started) return;
  const { ctx, master, at } = started;
  const steps = Math.max(2, Math.min(24, Math.round(ticks)));
  for (let index = 0; index < steps; index += 1) {
    // 앞은 성기고 뒤로 갈수록 촘촘해지도록 제곱으로 자리를 잡는다.
    const position = (index / steps) ** 1.35;
    const when = at + position * seconds;
    scheduleNoise(ctx, master, when, {
      length: 0.024,
      frequency: 2400 + index * 55,
      q: 3.2,
      level: 0.1 + (index / steps) * 0.12,
    });
    scheduleBlip(ctx, master, when + 0.002, {
      type: "square",
      frequency: 1500 + index * 40,
      to: 780,
      level: 0.045,
      length: 0.026,
    });
  }
}

/**
 * 네온 사인이 켜지는 지직. 형광등처럼 몇 번 튀었다 붙는다.
 *
 * 짧은 잡음 세 번(관이 튀는 소리)에, 붙고 나서 낮게 깔리는 60 Hz 톱니 허밍을 얹는다.
 * 켜지는 순간의 시간표는 장면의 등장 연출(INTRO_SECONDS.neon)과 같은 자리다.
 */
export function playNeonBuzz(): void {
  const started = begin("neon", 0.55);
  if (!started) return;
  const { ctx, master, at } = started;
  for (const [offset, level] of [[0, 0.2], [0.11, 0.16], [0.26, 0.24]] as const) {
    scheduleNoise(ctx, master, at + offset, { length: 0.05, frequency: 3200, q: 0.8, level });
    scheduleBlip(ctx, master, at + offset, { type: "sawtooth", frequency: 240, to: 120, level: 0.06, length: 0.05 });
  }
  const hum = ctx.createOscillator();
  hum.type = "sawtooth";
  hum.frequency.setValueAtTime(60, at + 0.3);
  const humGain = ctx.createGain();
  humGain.gain.setValueAtTime(0.0001, at + 0.3);
  humGain.gain.exponentialRampToValueAtTime(0.045, at + 0.36);
  humGain.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
  hum.connect(humGain).connect(master);
  hum.start(at + 0.3);
  hum.stop(at + 1.15);
}

/** 캡슐이 배출구 바닥에서 다시 튀어 오르는 소리. Clunk 다음에 두 번 난다. */
export function playBounce(strength = 1): void {
  const started = begin("bounce", 0.8);
  if (!started) return;
  const { ctx, master, at } = started;
  const level = Math.max(0.05, Math.min(1, strength));
  scheduleNoise(ctx, master, at, { length: 0.05, frequency: 1250, q: 1.4, level: 0.16 * level });
  scheduleBlip(ctx, master, at, { type: "sine", frequency: 190 * level, to: 96, level: 0.13 * level, length: 0.1 });
}
