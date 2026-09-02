/**
 * 자판기에서 물건이 떨어질 때 나는 소리 — Clunk.
 *
 * 외부 음원 파일을 받지 않고 브라우저의 WebAudio 로 그 자리에서 합성한다. 세 겹이다:
 *  1. 낮은 충격음 — 사인파를 120Hz 에서 42Hz 로 떨어뜨려 '쿵'
 *  2. 짧은 잡음 한 번 — 밴드패스를 통과시킨 화이트 노이즈로 '탁'
 *  3. 금속 잔향 — 서로 어긋난 두 삼각파가 짧게 울리고 사라진다
 *
 * 브라우저는 사용자가 무언가를 누르기 전에는 소리를 내주지 않으므로, 이 함수는
 * 반드시 클릭·키 입력 처리 안에서 불려야 한다(뽑기 버튼이 그 지점이다).
 */

type AudioContextConstructor = typeof AudioContext;

let context: AudioContext | null = null;

function audioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const scoped = window as Window & { webkitAudioContext?: AudioContextConstructor };
  return window.AudioContext ?? scoped.webkitAudioContext ?? null;
}

/** 이 브라우저에서 소리를 낼 수 있는지. 없으면 음소거 토글도 띄우지 않는다. */
export function isClunkSoundSupported(): boolean {
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

/** 밴드패스를 통과한 아주 짧은 화이트 노이즈 — 금속에 부딪히는 '탁'. */
function scheduleNoise(ctx: AudioContext, destination: AudioNode, at: number): void {
  const frames = Math.floor(ctx.sampleRate * 0.09);
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
  filter.frequency.value = 1850;
  filter.Q.value = 0.9;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.28, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
  source.connect(filter).connect(gain).connect(destination);
  source.start(at);
  source.stop(at + 0.1);
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

/**
 * 버튼을 누른 그 순간 오디오 문맥을 깨워 둔다.
 *
 * 소리는 상품이 다 떨어진 뒤에 나는데, 그때는 이미 서버 응답을 기다린 다음이라
 * 브라우저가 '사용자가 누른 직후'로 쳐 주지 않는 경우가 있다. 누름과 같은 순간에
 * 한 번 깨워 두면 나중에 재생이 막히지 않는다.
 */
export function primeClunkSound(): void {
  const ctx = ensureContext();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

/**
 * Clunk 한 번. 소리를 낼 수 없는 환경이면 조용히 아무 것도 하지 않는다 —
 * 소리가 안 난다고 해서 뽑기가 실패한 것은 아니기 때문이다.
 */
export function playClunk(): void {
  const ctx = ensureContext();
  if (!ctx) return;
  // 첫 제스처 전에 만들어진 문맥은 suspended 로 시작한다. 뽑기 버튼 안에서
  // 불리므로 여기서 깨우는 것이 허용된다.
  if (ctx.state === "suspended") void ctx.resume();
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  const at = ctx.currentTime + 0.01;
  scheduleThud(ctx, master, at);
  scheduleNoise(ctx, master, at + 0.004);
  scheduleRing(ctx, master, at + 0.03);
}
