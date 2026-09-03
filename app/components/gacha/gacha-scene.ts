/**
 * 가챠 머신의 3D 장면 — 어두운 뽑기 가게 한 칸.
 *
 * 외부 모델 파일 없이 three.js 기본 도형만으로 기계 한 대를 짓는다 — 투과 유리 돔,
 * 모서리를 깎은 두 톤 몸통, 크롬 기둥과 리벳, 음각 동전 투입구, 경첩이 달린 배출구 문,
 * 브러시드 메탈 받침, 그리고 네온관으로 켜지는 CLUNK 사인. 기계 둘레에는 타일 바닥,
 * 뒷벽의 네온 글로우와 전구 줄, 위에서 내리꽂는 스포트라이트 원뿔, 발치의 빛 웅덩이,
 * 떠다니는 먼지가 있다. 돔 안의 캡슐은 아주 단순한 스프링·중력·구 밀어내기로 움직인다
 * (물리 엔진 없음).
 *
 * 2026-09-02: 운영자가 "위화감 없이 인터랙티브하고 리액트하게" 를 요구했다. 그래서 이
 * 장면은 레버를 찾기 전부터 손끝에 반응한다 — 카메라와 기계가 마우스를 따라 아주 조금
 * 돌고, 돔에 손을 올리면 캡슐 더미가 흔들리고, 레버에 손을 올리면 손잡이가 달아오르고,
 * 가만히 두면 6~9초마다 빛이 돔을 훑고 캡슐 한 알이 자리를 고쳐 눕는다.
 *
 * 캡슐은 처음에 하나도 없다. 카탈로그가 도착하면 돔 위 투입구에서 쏟아져 들어온다 —
 * 그래야 API 를 기다리는 동안에도 기계가 먼저 서 있을 수 있다. 마흔 알은 인스턴싱으로
 * 그린다(위 반구·아래 반구·이음 링 세 번). 알마다 메시를 두면 그리기 횟수가 120회를
 * 넘어 예산(90회)을 깨뜨린다.
 *
 * 리액트는 이 파일을 화면 없이 부를 수 없다(WebGL 이 필요하다). 그래서 컴포넌트가
 * 동적으로 불러오고, 실패하면 SVG 머신으로 되돌아간다.
 *
 * 시간은 밖에서 넣어 준다 — frame(dtMs) 한 번이 한 프레임이다. 헤드리스 검증이
 * requestAnimationFrame 없이도 장면을 진행시킬 수 있어야 하기 때문이다.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/** 기기마다 다른 씀씀이. 데스크톱과 모바일 두 벌뿐이다. */
export type Quality = {
  /** 돔 안 캡슐 수. */
  capsules: number;
  /** 픽셀 비율 상한. */
  dpr: number;
  /** 그림자 맵 한 변. */
  shadowMap: number;
  /** 유리 돔에 진짜 투과를 쓸지. 모바일은 반투명으로 대신한다. */
  transmission: boolean;
  /** 가게 안을 떠다니는 먼지 알갱이 수. 착지 먼지(24개)와 합쳐 60개를 넘지 않는다. */
  dust: number;
};

// 2026-09-02 밤: 진짜 투과(transmission)는 장면을 한 번 더 그리면서 돔 안의 캡슐 반구를
// 빈 조개껍데기처럼 찍었다(카메라가 돔에 다가간 장면에서 뚜렷). 투과 없이 옅은 유리 +
// 반사 + 하이라이트 두 점으로 그리면 알이 온전하게 보이고 그리기도 한 번 줄어든다.
export const DESKTOP_QUALITY: Quality = { capsules: 40, dpr: 2, shadowMap: 1024, transmission: false, dust: 34 };
export const MOBILE_QUALITY: Quality = { capsules: 24, dpr: 1.5, shadowMap: 512, transmission: false, dust: 20 };

export type SceneStage = "idle" | "pull" | "shake" | "impact" | "capsule" | "wobble" | "burst" | "result";

export type CapsuleSpec = {
  /** 상품에서 잰 색. 등급 색에 이만큼 섞여 알마다 제 물건의 기색이 남는다. */
  color: string;
  /** 등급 색. 위 반구의 바탕이고 이음 링은 그 색을 어둡게 쓴다. */
  ring: string;
};

/** 화면 위 자리(CSS 픽셀). HTML 오버레이 단추를 그 위에 얹을 때 쓴다. */
export type ScreenPoint = { x: number; y: number; radius: number; visible: boolean };

/** 지금 화면에 그려지는 양. 예산(삼각형 70k, 그리기 90회)을 검증이 직접 읽는다. */
export type SceneStats = { triangles: number; calls: number };

export type GachaScene = {
  /**
   * 돔에 들어갈 캡슐. pour 가 참이면 자리에 놓지 않고 돔 위 투입구에서 쏟아 붓는다 —
   * 카탈로그가 도착하는 순간이 그 순간이다.
   */
  setCapsules(specs: readonly CapsuleSpec[], options?: { pour?: boolean }): void;
  setPrizeCapsule(spec: CapsuleSpec): void;
  setAccent(hex: string): void;
  setStage(stage: SceneStage): void;
  /** 마우스 자리(-1~1). 카메라와 기계가 아주 조금 기운다. */
  setPointer(x: number, y: number): void;
  /**
   * 스크롤 진행도(0~1). 이 페이지는 스크롤이 카메라를 움직이는 한 편의 짧은 영상이다 —
   * 가게 문 앞(0)에서 유리 돔 앞(0.3), 레버 옆(0.5), 배출구(0.7)를 지나 공개 무대(0.86~)로
   * 돌아온다. 값은 즉시 반영되지 않고 프레임마다 부드럽게 따라간다.
   */
  setScroll(progress: number): void;
  scroll(): number;
  setHovered(hovered: boolean): void;
  /** 레버 위에 손이 올라왔는지. 손잡이가 달아오르고 축이 4° 앞으로 기운다. */
  setLeverHover(hovered: boolean): void;
  /** 레버를 잡고 끄는 중인지. 몸통이 1° 기운다. */
  setLeverDragging(dragging: boolean): void;
  /** 돔 위에 손이 올라왔는지. 캡슐 더미가 잘게 흔들린다. */
  setDomeHover(hovered: boolean): void;
  /** 돔을 눌렀다. 더 세게 흔들리고 한 알이 튀어 오른다. */
  tapDome(): void;
  /** 손으로 끌어내린 정도(0 = 올라가 있음, 1 = 끝까지 내려감). */
  setLeverPull(fraction: number): void;
  leverPull(): number;
  /** 등장 연출 — 세션당 한 번. 움직임을 줄여 달라는 설정이면 그 자리에서 끝난 상태가 된다. */
  startIntro(): void;
  /** 누르거나 키를 치면 남은 연출을 건너뛰고 완성 상태로 간다. */
  skipIntro(): void;
  introRunning(): boolean;
  /** 상품 3D 파일을 미리 열어 둔다. 캡슐이 갈라질 때 기다리지 않게. */
  loadModel(url: string): Promise<boolean>;
  /** 텍스처·시트 상품이 대신 띄우는 그림 카드. */
  loadCard(url: string): Promise<boolean>;
  clearPrizeArt(): void;
  /** 한 프레임 진행하고 한 번 그린다. */
  frame(dtMs: number): void;
  resize(): void;
  /** 레버 손잡이·배출구 캡슐·유리 돔의 화면 자리. */
  points(): { lever: ScreenPoint; capsule: ScreenPoint; dome: ScreenPoint };
  /** 실제로 색이 칠해진 픽셀 수(검증용). 지금 그려진 화면을 그대로 읽는다. */
  countDrawnPixels(): number;
  /** 검증용 — 지금 카메라 자리. */
  cameraPosition(): [number, number, number];
  /** 마지막 프레임의 삼각형 수와 그리기 횟수. */
  stats(): SceneStats;
  dispose(): void;
};

/* ---------------------------------------------------------------------------
   치수 — 한 단위가 대략 30 cm 쯤 되는 기계 한 대.
   ------------------------------------------------------------------------- */

const DOME_CENTER = new THREE.Vector3(0, 2.62, 0);
const DOME_RADIUS = 0.74;
/** 캡슐이 실제로 굴러다니는 안쪽 반지름(유리 두께와 캡슐 반지름을 뺀 값). */
const DOME_INNER = 0.63;
/**
 * 돔 바닥. 여기 가운데에 캡슐이 빠지는 구멍이 있다.
 * 유리공의 배(적도)보다 아래에 두어야 쌓인 캡슐이 유리 안에 들어와 보인다.
 */
const DOME_FLOOR = 2.12;
/**
 * 캡슐 한 알의 반지름. 유리공 지름의 약 6분의 1 — 실제 뽑기 기계의 비율이다.
 *
 * 2026-09-02: 0.088 에서는 서른 알이 통 바닥에 얇게 한 겹 깔려 통이 비어 보였고,
 * 0.105 에서도 마흔 알이 유리공 부피의 3분의 1밖에 채우지 못했다(알 하나가
 * 0.0049, 통이 1.05). 0.125 면 같은 마흔 알로 배(적도)까지 차 오른다.
 */
const CAPSULE_RADIUS = 0.125;
/** 배출구 안에 캡슐이 눕는 자리. */
const TRAY = new THREE.Vector3(0, 0.87, 0.53);
/**
 * 캡슐이 카메라 앞으로 떠오르는 자리 — 결과 상품도 같은 자리에 선다.
 * 카메라에서 2.3 만큼 떨어져 있어, 기계를 한 대 통째로 담느라 물러난 카메라에서도
 * 상품은 예전과 같은 크기로 보인다. 높이는 그 깊이에서의 화면 한가운데다.
 */
const STAGE_FRONT = new THREE.Vector3(0, 2.1, 4.5);

/**
 * 카메라 자리. 받침이 바닥에 닿는 자리부터 투입구 꼭대기까지가 한 화면에 들어와야 한다.
 *
 * 2026-09-02: 5.9 에서는 몸통 앞면이 카메라에 너무 가까워 받침 아래가 화면 밖으로
 * 잘렸다 — 기계가 바닥에 닿는 곳이 안 보이면 떠 있는 그림처럼 읽힌다. 그래서 6.8 까지
 * 물러났는데, 이번에는 무대가 기계보다 훨씬 넓어져 기계가 어둠 한가운데 작게 놓였다.
 *
 * 그래서 두 가지를 같이 고쳤다. 무대 상자는 5:4 로 잡아(gacha.css) 좌우의 빈 어둠을
 * 없앴고, 카메라는 6.4 로 한 걸음 다가와 세로로 -0.28 ~ 3.64 를 담는다 — 기계(0 ~ 3.53)가
 * 화면 높이의 90%를 차지하고, 받침이 바닥에 닿는 자리는 아래 테두리에서 7% 안쪽에 남는다.
 */
const CAMERA_HEIGHT = 2.35;
const CAMERA_DISTANCE = 6.4;
const CAMERA_TARGET = 1.68;

/**
 * 손끝을 따라 움직이는 양. 크게 두면 멀미가 나고, 없으면 화면이 죽은 그림이 된다.
 * 운영자의 요구는 "딱 들어가자마자" 살아 있다고 느껴지는 정도다.
 */
const PARALLAX = {
  /** 카메라가 옆으로 미끄러지는 거리(m). */
  cameraX: 0.28,
  cameraY: 0.18,
  /** 카메라가 보는 지점이 흔들리는 거리(m). */
  target: 0.05,
  /** 기계가 손끝 쪽으로 도는 각(라디안). 5°. */
  yaw: 0.087,
  /** 스포트라이트가 같이 기우는 각. 6.4 m 높이에서 2° 는 0.16 m. */
  spot: 0.16,
} as const;

/**
 * 스크롤이 지나가는 카메라 자리 다섯 곳. 사이는 부드럽게(smoothstep) 잇는다.
 *
 * 2026-09-02 밤: 운영자의 기준은 "들어가자마자 살아 있는 화면" — 스크롤이 곧 연출인
 * 웹필름 방식이다. 한 화면에 기계가 서 있고, 내리면 카메라가 유리 돔으로 다가가고,
 * 레버 옆으로 돌아 들어가 스크롤 자체가 레버를 당기며, 배출구로 내려가 캡슐이 떨어지는
 * 것을 보고, 공개 무대로 물러난다. 위치는 기계 치수에서 바로 나온 값이다(돔 중심 2.62,
 * 레버 손잡이 (0.98, 2.26), 배출구 (0, 0.87, 0.53)).
 */
type Shot = { at: number; position: [number, number, number]; target: [number, number, number] };
export const SHOTS: readonly Shot[] = [
  { at: 0.0, position: [0, CAMERA_HEIGHT, CAMERA_DISTANCE], target: [0, CAMERA_TARGET, 0] },
  { at: 0.3, position: [0.35, 2.8, 3.2], target: [0, 2.52, 0] },
  { at: 0.52, position: [2.35, 2.15, 2.75], target: [0.85, 1.85, 0.1] },
  // 레버 자리에서 배출구로는 크게 돌지 않고 조금 내려다볼 뿐이다 — 카메라가 휙 도는 것이 어지럽다.
  { at: 0.7, position: [1.7, 1.75, 3.0], target: [0.35, 1.05, 0.4] },
  { at: 0.86, position: [0, CAMERA_HEIGHT, CAMERA_DISTANCE], target: [0, CAMERA_TARGET, 0] },
];
export { SCROLL_PULL } from "./gacha-scroll";

function smoothstep(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** 진행도에 해당하는 카메라 자리와 바라보는 점. */
export function shotAt(progress: number, position: THREE.Vector3, target: THREE.Vector3): void {
  const p = Math.min(1, Math.max(0, progress));
  let a = SHOTS[0];
  let b = SHOTS[SHOTS.length - 1];
  for (let index = 0; index < SHOTS.length - 1; index += 1) {
    if (p >= SHOTS[index].at && p <= SHOTS[index + 1].at) { a = SHOTS[index]; b = SHOTS[index + 1]; break; }
  }
  const span = Math.max(1e-6, b.at - a.at);
  const k = a === b ? 0 : smoothstep((p - a.at) / span);
  position.set(
    a.position[0] + (b.position[0] - a.position[0]) * k,
    a.position[1] + (b.position[1] - a.position[1]) * k,
    a.position[2] + (b.position[2] - a.position[2]) * k,
  );
  target.set(
    a.target[0] + (b.target[0] - a.target[0]) * k,
    a.target[1] + (b.target[1] - a.target[1]) * k,
    a.target[2] + (b.target[2] - a.target[2]) * k,
  );
}

/**
 * 돔 꼭대기에 뚫린 투입구. 유리공을 이 각도부터 그려 가운데를 비우고, 그 위에 깔때기를 얹는다.
 * 구멍 지름(0.32)이 캡슐 지름(0.21)보다 넓어야 쏟아 붓는 것이 통과해 보인다.
 */
const HATCH_PHI = 0.22;
const HATCH_Y = DOME_CENTER.y + Math.cos(HATCH_PHI) * DOME_RADIUS;
const HATCH_RADIUS = Math.sin(HATCH_PHI) * DOME_RADIUS;

/** 각 단계가 몇 초짜리인지. 리액트의 시간표와 같은 값을 쓴다. */
export const STAGE_SECONDS = {
  pull: 0.6,
  shake: 1.2,
  impact: 1.1,
  wobble: 1.1,
  burst: 1.1,
} as const;

/**
 * 등장 연출의 시간표(초). 전체가 2.4초 안에 끝난다.
 * 리액트가 같은 값으로 소리를 얹으므로 여기서 내보낸다.
 */
export const INTRO_SECONDS = {
  /** 어둠 속에서 스포트라이트가 딸깍 켜진다. */
  spotlight: 0.18,
  /** 기계가 위에서 내려와 쿵 착지한다(먼지 + 카메라 흔들림). */
  land: 0.86,
  /** CLUNK 네온 사인이 지직거리다 켜진다. */
  neon: 1.02,
  /** 돔 위 투입구에서 캡슐이 쏟아진다. */
  pour: 1.28,
  /** 레버 손잡이가 한 번 반짝인다. */
  lever: 2.02,
  total: 2.4,
} as const;

/**
 * 목표값으로 부드럽게 다가가되, 충분히 가까워지면 딱 붙인다.
 * 끝없이 수렴만 하면 움직임을 줄여 달라는 설정에서도 화면이 영원히 아주 조금씩 바뀐다.
 */
function approach(current: number, target: number, rate: number): number {
  const next = current + (target - current) * Math.min(1, rate);
  return Math.abs(target - next) < 1e-4 ? target : next;
}

function toColor(hex: string, fallback = "#a855f7"): THREE.Color {
  try {
    return new THREE.Color(hex);
  } catch {
    return new THREE.Color(fallback);
  }
}

/** 자리마다 정해진 흔들림 — 무작위가 아니라 번호에서 나온 값이라 새로 고쳐도 같다. */
function seeded(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/** 가운데가 짙고 가장자리가 비는 둥근 무늬. 상품을 띄울 때 기계를 덮는 막에 쓴다. */
function makeSoftDiscTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.58, "rgba(255,255,255,0.94)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
  }
  return new THREE.CanvasTexture(canvas);
}

/**
 * 가운데만 하얗고 빠르게 사라지는 둥근 무늬. 유리에 맺히는 반사와 발치의 빛 웅덩이처럼
 * "가운데가 아주 밝고 테두리는 거의 없는" 자리에 쓴다.
 */
function makeGlowTexture(hardness: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(hardness, "rgba(255,255,255,0.55)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
}

/** 가운데가 비고 가장자리로 갈수록 짙어지는 무늬. 바닥의 끝을 어둠으로 지울 때 쓴다. */
function makeEdgeFadeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.44, "rgba(255,255,255,0)");
    gradient.addColorStop(1, "rgba(255,255,255,1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
  }
  return new THREE.CanvasTexture(canvas);
}

/** 위가 밝고 아래로 갈수록 사라지는 세로 무늬. 스포트라이트의 빛기둥에 씌운다. */
function makeBeamTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // 원뿔은 꼭짓점이 위다. 전등 쪽이 밝고 바닥에 닿기 전에 사라져야 기둥으로 읽힌다.
    const gradient = ctx.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.2, "rgba(255,255,255,0.85)");
    gradient.addColorStop(0.78, "rgba(255,255,255,0.16)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 8, 128);
  }
  return new THREE.CanvasTexture(canvas);
}

/**
 * 유리를 훑고 지나가는 빛 한 줄. 가로로 길고 세로로 부드럽게 사라진다.
 * 대기 중 6~9초마다 이 판이 돔을 가로지른다.
 */
function makeStreakTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const across = ctx.createLinearGradient(0, 0, 128, 0);
    across.addColorStop(0, "rgba(255,255,255,0)");
    across.addColorStop(0.5, "rgba(255,255,255,1)");
    across.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = across;
    ctx.fillRect(0, 0, 128, 128);
    // 세로로도 사라지게 깎아 낸다 — 그러지 않으면 띠가 아니라 사각형이 지나간다.
    ctx.globalCompositeOperation = "destination-in";
    const down = ctx.createLinearGradient(0, 0, 0, 128);
    down.addColorStop(0, "rgba(255,255,255,0)");
    down.addColorStop(0.5, "rgba(255,255,255,1)");
    down.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = down;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
}

/**
 * 받침의 브러시드 메탈 결. 가로로 그은 잔줄 한 장을 거칠기 지도로 쓴다 —
 * 색이 아니라 반사가 흩어지는 방향이 금속을 금속으로 보이게 한다.
 */
function makeBrushedTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#6a6a6a";
    ctx.fillRect(0, 0, 256, 64);
    for (let line = 0; line < 220; line += 1) {
      const y = seeded(line, 211) * 64;
      const shade = Math.round(70 + seeded(line, 223) * 90);
      ctx.strokeStyle = `rgb(${shade},${shade},${shade})`;
      ctx.lineWidth = 0.6 + seeded(line, 227) * 1.1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y + (seeded(line, 229) - 0.5) * 1.2);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 1);
  return texture;
}

/**
 * 몸통 앞면의 CLUNK 사인 — 유리관 네온처럼 그린다.
 *
 * 글자 하나를 세 번 겹쳐 칠한다: 넓게 번지는 후광, 좁고 진한 관, 그리고 한가운데의
 * 흰 심지. 이 세 겹이 발광 지도로 들어가면 평평한 흰 글씨가 아니라 불이 켜진 유리관이
 * 된다. 외부 폰트 파일은 쓰지 않는다.
 */
function makeSignTexture(tube: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#05070f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "800 92px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const x = canvas.width / 2;
    const y = canvas.height / 2 + 4;

    // 1) 넓은 후광 — 관 둘레의 공기가 물드는 부분.
    ctx.shadowColor = tube;
    ctx.shadowBlur = 46;
    ctx.lineWidth = 15;
    ctx.strokeStyle = tube;
    ctx.strokeText("CLUNK", x, y);
    ctx.strokeText("CLUNK", x, y);

    // 2) 관 자체 — 좁고 진하다.
    ctx.shadowBlur = 16;
    ctx.lineWidth = 9;
    ctx.strokeText("CLUNK", x, y);

    // 3) 심지 — 관 한가운데의 흰 선.
    ctx.shadowBlur = 6;
    ctx.shadowColor = "#ffffff";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("CLUNK", x, y);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * 뒷벽 한 장. 어두운 방 가운데에 네온이 번져 있다.
 *
 * 이 판만 빛을 받지 않는 재질(MeshBasicMaterial)이다. three 의 투과 패스는 불투명한
 * 물체만 담아 두기 때문에, 더해 그리는 빛 판은 돔 뒤에서 아예 보이지 않는다 — 유리가
 * 비출 것은 반드시 불투명한 물건이어야 하고, 그 역할이 이 벽이다. 이것이 없으면
 * 돔이 새까만 구슬로 나온다.
 *
 * 번짐은 가운데만 밝다. 벽 전체가 밝으면 어두운 뽑기 가게가 아니라 보랏빛 안개가 된다.
 */
function makeWallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 288;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#070a16";
    ctx.fillRect(0, 0, 512, 288);
    const halo = ctx.createRadialGradient(256, 150, 8, 256, 150, 168);
    halo.addColorStop(0, "rgba(186,160,255,0.92)");
    halo.addColorStop(0.34, "rgba(112,84,214,0.40)");
    halo.addColorStop(0.72, "rgba(48,36,104,0.14)");
    halo.addColorStop(1, "rgba(7,10,22,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, 512, 288);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * 가게 바닥의 격자 타일. 이음선만 그린 정사각형 한 장을 되풀이해 깐다.
 * 선이 옅으면 스포트라이트 아래에서 통째로 회색 판이 된다 — 타일로 읽힐 만큼은 진하게.
 */
function makeFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#070a14";
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "rgba(158,182,255,0.62)";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 124, 124);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(9, 9);
  texture.colorSpace = THREE.SRGBColorSpace;
  // 비스듬히 누워 있는 면이라 이방성 필터가 없으면 이음선이 뭉개져 사라진다.
  texture.anisotropy = 8;
  return texture;
}

/**
 * 돔 안에 쌓이는 캡슐 한 알. 메시가 아니라 숫자 묶음이다 — 실제로 그리는 것은
 * 인스턴스 메시 세 개(위 반구·아래 반구·이음 링)이고, 이 값들이 그 행렬로 들어간다.
 */
type Capsule = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  /** 지금 각도. 인스턴스 행렬을 만들 때 쿼터니언으로 바뀐다. */
  rotation: THREE.Euler;
  /** 알 크기(세 가지) × 안쪽으로 갈수록 작아지는 값. */
  scale: number;
  /** 투입구에서 떨어지는 중 — 돔 안으로 들어오기 전까지는 유리 벽에 걸리지 않는다. */
  entering: boolean;
};

/**
 * 캡슐이 쌓이는 층. 위로 갈수록 좁아져 봉긋한 더미가 된다 — 한 겹으로 깔리면
 * 통이 비어 보이고, 원기둥처럼 쌓이면 상자에 담긴 것처럼 보인다.
 */
const PILE_LAYERS = [
  { count: 13, inner: 0.22, outer: 0.46 },
  { count: 11, inner: 0.15, outer: 0.42 },
  { count: 9, inner: 0.08, outer: 0.34 },
  { count: 7, inner: 0.0, outer: 0.22 },
] as const;

export function createGachaScene(
  host: HTMLElement,
  options: { quality: Quality; reducedMotion: boolean },
): GachaScene {
  const quality = options.quality;
  const reduced = options.reducedMotion;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.dpr));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  // 유리 돔의 투과는 장면을 한 번 더 그린다. 그 한 번은 절반 크기로도 충분하다 —
  // 돔 뒤에 비치는 것은 캡슐 더미뿐이라 해상도를 알아볼 수 없다.
  renderer.transmissionResolutionScale = 0.5;
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);

  // 방 하나를 코드로 지어 반사에 쓴다. 유리 돔과 캡슐 광택이 비칠 것이 없으면
  // 플라스틱이 아니라 색칠한 종이처럼 보인다.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environment.texture;
  // 반사를 반쯤 눌러 둔다. 그대로 두면 유리 돔이 우유처럼 하얘져 안이 안 보인다.
  scene.environmentIntensity = 0.45;

  /* 조명 — 키/필/림 두 점과 바닥 그림자 ------------------------------------ */
  const ambient = new THREE.HemisphereLight(0xdfe8ff, 0x1a1c2a, 0.5);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xfff4e2, 2.5);
  key.position.set(2.6, 7.6, 3.8);
  key.castShadow = true;
  key.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
  key.shadow.bias = 0;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 3;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 16;
  // 2026-09-02: 그림자 카메라가 기계보다 훨씬 넓으면 1024 짜리 지도가 발치에
  // 몇 픽셀밖에 못 쓴다 — 접지 그림자가 번진 얼룩으로 나온 까닭이다. 기계 폭에 맞춘다.
  key.shadow.camera.left = -1.8;
  key.shadow.camera.right = 1.8;
  key.shadow.camera.top = 4.0;
  key.shadow.camera.bottom = -0.4;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9fb6ff, 0.62);
  fill.position.set(-4.2, 2.4, 3.2);
  scene.add(fill);

  // 뒤 왼쪽에서 오는 찬 빛. 기계의 왼쪽 윤곽을 배경에서 떼어 놓는다.
  const rim = new THREE.DirectionalLight(0xbfd6ff, 1.9);
  rim.position.set(-3.0, 3.3, -4.4);
  scene.add(rim);

  // 뒤 오른쪽에서 오는 따뜻한 빛. 레버가 달린 쪽 모서리와 크롬 기둥이 여기서 반짝인다.
  const rimWarm = new THREE.DirectionalLight(0xffd6a8, 1.05);
  rimWarm.position.set(3.4, 2.6, -3.6);
  scene.add(rimWarm);

  // 돔 위를 천천히 도는 반짝임 한 점.
  const sweep = new THREE.PointLight(0xffffff, 2.6, 4.2, 2);
  sweep.position.set(0.7, 3.3, 0.7);
  scene.add(sweep);

  // 유리공 안을 밝히는 한 점. 어두운 가게에서는 이것이 없으면 캡슐이 유리에 묻힌다.
  const domeLight = new THREE.PointLight(0xfff3df, 2.4, 1.9, 2);
  domeLight.position.copy(DOME_CENTER);
  scene.add(domeLight);

  // 배출구의 캡슐을 은은하게 비추는 빛. 캡슐이 떨어진 뒤에만 켜진다.
  const trayLight = new THREE.PointLight(0xffffff, 0, 2.2, 2);
  trayLight.position.set(0, 1.1, 1.35);
  scene.add(trayLight);

  // 기계 한 대만 비추는 스포트라이트. 그림자는 키 라이트가 이미 만들고 있어 끄고 쓴다.
  // 세게 두면 바닥이 통째로 밝은 회색 판이 되어 어두운 가게가 사라진다 — 가장자리를
  // 넓게 흐려 기계 발치에만 빛 웅덩이가 남게 한다.
  const spot = new THREE.SpotLight(0xfff2d8, 0, 12, 0.4, 0.78, 1.6);
  spot.position.set(0, 6.4, 1.6);
  spot.target.position.set(0, 1.4, 0);
  scene.add(spot);
  scene.add(spot.target);

  /* 가게 — 바닥, 뒷벽, 전구 줄, 스포트라이트 원뿔, 먼지 ---------------------- */
  const shop = new THREE.Group();
  scene.add(shop);

  // 바닥 — 격자 타일 한 장을 되풀이해 깔고, 가장자리는 어둠으로 지운다.
  const floorTexture = makeFloorTexture();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      // 스치듯 보는 바닥은 색이 아니라 반사가 밝기를 정한다(프레넬). 거칠기를 올려
      // 번들거림을 흩고, 환경 반사를 눌러야 어두운 가게 바닥이 된다.
      color: 0x080c18,
      map: floorTexture,
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 0.1,
    }),
  );
  floor.receiveShadow = true;
  shop.add(floor);
  // 타일이 끝없이 이어져 보이지 않도록 가장자리만 어둠으로 덮는다(가운데는 그대로 둔다).
  const floorFadeMaterial = new THREE.MeshBasicMaterial({
    color: 0x04060e,
    map: makeEdgeFadeTexture(),
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
  });
  const floorFade = new THREE.Mesh(new THREE.PlaneGeometry(15.6, 15.6).rotateX(-Math.PI / 2), floorFadeMaterial);
  floorFade.position.y = 0.02;
  shop.add(floorFade);

  /**
   * 발치의 빛 웅덩이. 스포트라이트가 젖은 바닥에 만드는 반사인데, 진짜 반사 패스를
   * 한 번 더 돌리는 대신 기계 색으로 물든 둥근 무늬 한 장을 깔아 흉내 낸다.
   */
  const poolMaterial = new THREE.MeshBasicMaterial({
    color: 0xa855f7,
    map: makeGlowTexture(0.34),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.2).rotateX(-Math.PI / 2), poolMaterial);
  pool.position.y = 0.026;
  shop.add(pool);

  /**
   * 접지 그림자. 그림자 지도만으로는 받침이 바닥에 닿는 자리가 흐릿하게 번진다 —
   * 받침 바로 밑에 짙은 무늬 한 장을 더 깔아 기계가 바닥을 누르고 있게 한다.
   */
  const contactMaterial = new THREE.MeshBasicMaterial({
    color: 0x02030a,
    map: makeGlowTexture(0.5),
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.1).rotateX(-Math.PI / 2), contactMaterial);
  contact.position.y = 0.034;
  shop.add(contact);

  // 뒷벽과 그 위에 번지는 네온 자국.
  const wallMaterial = new THREE.MeshBasicMaterial({ map: makeWallTexture() });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), wallMaterial);
  wall.position.set(0, 4.2, -3.6);
  shop.add(wall);
  const wallGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0x7c5dfa,
    map: makeSoftDiscTexture(),
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const wallGlow = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 6.6), wallGlowMaterial);
  wallGlow.position.set(0, 2.7, -3.52);
  shop.add(wallGlow);
  // 기계 바로 뒤의 밝은 판. 유리 돔은 뒤를 그대로 비추므로 뒤가 어두우면 돔이 새까매진다.
  const backLightMaterial = new THREE.MeshBasicMaterial({
    color: 0xd7c9ff,
    map: makeSoftDiscTexture(),
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const backLight = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 5.2), backLightMaterial);
  backLight.position.set(0, 2.55, -2.3);
  shop.add(backLight);

  // 전구 줄 — 뒷벽에 매달린 작은 알 열두 개. 점 하나짜리라 그리는 값이 거의 들지 않는다.
  const BULB_COUNT = 12;
  const bulbGeometry = new THREE.BufferGeometry();
  const bulbPositions = new Float32Array(BULB_COUNT * 3);
  for (let index = 0; index < BULB_COUNT; index += 1) {
    const k = index / (BULB_COUNT - 1);
    bulbPositions[index * 3] = -4.4 + k * 8.8;
    // 줄이 가운데로 처진다.
    bulbPositions[index * 3 + 1] = 4.15 - Math.sin(k * Math.PI) * 0.5;
    bulbPositions[index * 3 + 2] = -3.3;
  }
  bulbGeometry.setAttribute("position", new THREE.BufferAttribute(bulbPositions, 3));
  const bulbMaterial = new THREE.PointsMaterial({
    color: 0xffd9a0,
    map: makeSoftDiscTexture(),
    size: 0.2,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  shop.add(new THREE.Points(bulbGeometry, bulbMaterial));

  // 스포트라이트의 빛기둥. 실제 빛이 아니라 더해 그리는 원뿔 한 개다.
  const coneMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff0d2,
    map: makeBeamTexture(),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.6, 28, 1, true), coneMaterial);
  cone.position.set(0, 3.9, -0.1);
  cone.renderOrder = 1;
  shop.add(cone);

  // 떠다니는 먼지. 자리마다 정해진 값에서 나오므로 새로 고쳐도 같은 자리에서 시작한다.
  const DUST_COUNT = Math.max(0, quality.dust);
  const dustGeometry = new THREE.BufferGeometry();
  const dustPositions = new Float32Array(DUST_COUNT * 3);
  const dustSeeds: Array<{ x: number; z: number; base: number; speed: number; sway: number }> = [];
  for (let index = 0; index < DUST_COUNT; index += 1) {
    const seed = {
      x: (seeded(index, 61) - 0.5) * 4.2,
      z: (seeded(index, 67) - 0.5) * 3.2,
      base: 0.35 + seeded(index, 71) * 3.4,
      speed: 0.05 + seeded(index, 73) * 0.09,
      sway: seeded(index, 79) * 6.28,
    };
    dustSeeds.push(seed);
    dustPositions[index * 3] = seed.x;
    dustPositions[index * 3 + 1] = seed.base;
    dustPositions[index * 3 + 2] = seed.z;
  }
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
  const dustMaterial = new THREE.PointsMaterial({
    color: 0xd9e4ff,
    map: makeSoftDiscTexture(),
    size: 0.045,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  shop.add(new THREE.Points(dustGeometry, dustMaterial));

  // 착지하며 바닥에서 튀는 먼지. 등장 연출 때 한 번만 쓰고 그 뒤로는 그리지 않는다.
  const PUFF_COUNT = 24;
  const puffGeometry = new THREE.BufferGeometry();
  const puffPositions = new Float32Array(PUFF_COUNT * 3);
  const puffDirections = Array.from({ length: PUFF_COUNT }, (_unused, index) => {
    const angle = (index / PUFF_COUNT) * Math.PI * 2 + seeded(index, 83);
    const reach = 0.9 + seeded(index, 89) * 1.5;
    return { x: Math.cos(angle) * reach, z: Math.sin(angle) * reach, lift: 0.5 + seeded(index, 97) * 0.9 };
  });
  puffGeometry.setAttribute("position", new THREE.BufferAttribute(puffPositions, 3));
  const puffMaterial = new THREE.PointsMaterial({
    color: 0xbfcbe8,
    map: makeSoftDiscTexture(),
    size: 0.26,
    transparent: true,
    opacity: 0,
    blending: THREE.NormalBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const puff = new THREE.Points(puffGeometry, puffMaterial);
  puff.visible = false;
  shop.add(puff);

  /* 기계 ------------------------------------------------------------------- */
  const machine = new THREE.Group();
  scene.add(machine);

  const accent = toColor("#a855f7");

  /**
   * 재질 — 몸통은 두 톤이다. 짙은 가지색 본체에 한 겹 밝은 앞판이 박혀 있고,
   * 그 둘 사이를 얇은 크롬 테가 가른다. 한 가지 색으로 칠한 상자는 무슨 짓을 해도
   * 장난감으로 읽힌다.
   */
  const bodyPaint = new THREE.MeshPhysicalMaterial({
    color: accent.clone().lerp(new THREE.Color(0x180f26), 0.66),
    roughness: 0.34,
    metalness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    envMapIntensity: 0.7,
  });
  // 앞판은 "조금" 밝다. 크게 벌리면 두 톤이 아니라 서로 다른 두 기계가 붙어 있게 된다.
  const panelPaint = new THREE.MeshPhysicalMaterial({
    color: accent.clone().lerp(new THREE.Color(0x1d1230), 0.56),
    roughness: 0.24,
    metalness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 0.8,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x090c17, roughness: 0.85, metalness: 0.1 });
  /** 깊은 음각. 동전 구멍과 배출구 안쪽처럼 "빛이 들어가 안 나오는" 자리. */
  const recessMaterial = new THREE.MeshStandardMaterial({ color: 0x02030a, roughness: 1, metalness: 0 });
  /**
   * 크롬. 2026-09-02: 처음에는 밝은 은색(0xdfe6f5, 반사 1.55)으로 두었더니 어두운
   * 가게에서 테두리가 통째로 하얀 판이 되어 기계가 흰 뼈대처럼 보였다. 금속은 제 색이
   * 밝아서가 아니라 한 줄기 빛을 되쏘아서 금속이다 — 바탕은 어두운 강철로 낮추고
   * 거칠기만 낮게 둔다.
   */
  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: 0x8d97ad,
    roughness: 0.2,
    metalness: 1,
    envMapIntensity: 0.95,
  });
  const brushedTexture = makeBrushedTexture();
  const plinthMaterial = new THREE.MeshStandardMaterial({
    // 2026-09-02 밤: 0x1b2030 은 무대 바닥과 한 덩어리로 묻혀 받침이 검은 구멍으로 보였다.
    color: 0x2c3448,
    roughness: 0.36,
    roughnessMap: brushedTexture,
    metalness: 0.82,
    envMapIntensity: 0.9,
  });

  // 받침 — 브러시드 메탈 굽에 크롬 테를 두른다.
  const base = new THREE.Mesh(new RoundedBoxGeometry(2.02, 0.56, 1.44, 3, 0.05), plinthMaterial);
  base.position.set(0, 0.28, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  machine.add(base);
  // 굽 위의 크롬 테. 얇아야 테다 — 두꺼우면 기계가 흰 접시 위에 얹힌 것처럼 보인다.
  const baseLip = new THREE.Mesh(new RoundedBoxGeometry(2.08, 0.045, 1.50, 2, 0.02), chromeMaterial);
  baseLip.position.set(0, 0.59, 0);
  baseLip.castShadow = true;
  machine.add(baseLip);

  // 몸통 — 모서리를 넉넉히 깎은 상자. 각이 살아 있으면 종이 상자로 읽힌다.
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.66, 1.40, 1.16, 4, 0.17), bodyPaint);
  body.position.set(0, 1.36, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  machine.add(body);

  // 앞판 — 한 겹 밝은 색으로 박혀 있고, 그 둘레로 얇은 크롬 테가 3 mm 만 삐져나온다.
  const frontBezel = new THREE.Mesh(new RoundedBoxGeometry(1.36, 1.14, 0.045, 2, 0.055), chromeMaterial);
  frontBezel.position.set(0, 1.34, 0.588);
  machine.add(frontBezel);
  const frontPanel = new THREE.Mesh(new RoundedBoxGeometry(1.30, 1.08, 0.055, 2, 0.05), panelPaint);
  frontPanel.position.set(0, 1.34, 0.6);
  frontPanel.castShadow = true;
  machine.add(frontPanel);

  // 네 모서리를 세로로 훑는 가는 크롬 기둥. 몸통의 높이를 읽게 해 주는 선이라
  // 굵으면 선이 아니라 기둥이 되어 기계를 우리처럼 가둔다.
  for (const [x, z] of [[-0.808, 0.53], [0.808, 0.53], [-0.808, -0.53], [0.808, -0.53]] as const) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 1.24, 10), chromeMaterial);
    rail.position.set(x, 1.36, z);
    rail.castShadow = true;
    machine.add(rail);
  }

  // 리벳 넷 — 앞판 모서리에 박힌 반구. 빛을 한 점씩 되쏜다.
  for (const [x, y] of [[-0.60, 1.79], [0.60, 1.79], [-0.60, 0.89], [0.60, 0.89]] as const) {
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), chromeMaterial);
    rivet.rotation.x = Math.PI / 2;
    rivet.position.set(x, y, 0.632);
    machine.add(rivet);
  }

  /* CLUNK 네온 사인 ---------------------------------------------------------
     어두운 판 위에 유리관 글자가 붙고, 그 뒤에서 같은 색 후광이 더해진다. */
  const signTexture = makeSignTexture("#c9a4ff");
  const signMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b1020,
    map: signTexture,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: signTexture,
    emissiveIntensity: 1.1,
    roughness: 0.5,
  });
  const signFrame = new THREE.Mesh(new RoundedBoxGeometry(1.20, 0.44, 0.07, 2, 0.04), darkMaterial);
  signFrame.position.set(0, 1.80, 0.59);
  machine.add(signFrame);
  // 관 둘레에 번지는 빛. 판보다 앞, 글자보다 뒤에 더해 그린다.
  const signGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xa06bff,
    map: makeGlowTexture(0.28),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const signGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.78), signGlowMaterial);
  signGlow.position.set(0, 1.80, 0.626);
  machine.add(signGlow);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.325), signMaterial);
  sign.position.set(0, 1.80, 0.632);
  machine.add(sign);

  /* 동전 투입구 — 크롬판에 진짜 홈이 파여 있다 --------------------------- */
  const coinPlate = new THREE.Mesh(new RoundedBoxGeometry(0.40, 0.48, 0.045, 2, 0.035), chromeMaterial);
  coinPlate.position.set(-0.44, 1.32, 0.635);
  coinPlate.castShadow = true;
  machine.add(coinPlate);
  // 홈은 판보다 뒤로 들어가 있어야 홈이다 — 판 앞에 붙이면 그냥 검은 막대다.
  const coinSlot = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.045, 0.07), recessMaterial);
  coinSlot.position.set(-0.44, 1.44, 0.626);
  machine.add(coinSlot);
  const coinReturn = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.07, 18), recessMaterial);
  coinReturn.rotation.x = Math.PI / 2;
  coinReturn.position.set(-0.44, 1.21, 0.626);
  machine.add(coinReturn);
  const coinRing = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.011, 8, 22), chromeMaterial);
  coinRing.position.set(-0.44, 1.21, 0.652);
  machine.add(coinRing);

  /* 당기는 레버 — 기계 오른쪽 옆면 -----------------------------------------
     받침(옆면에 붙는 원판) + 축(세로 막대) + 둥근 손잡이. 손잡이를 아래로 당기면
     축이 앞쪽 아래로 넘어갔다가 스프링처럼 튕겨 올라온다. 돌리는 것이 아니라
     당기는 것이다. */
  const leverMount = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.12, 24), darkMaterial);
  leverMount.rotation.z = Math.PI / 2;
  leverMount.position.set(0.86, 1.6, 0.02);
  leverMount.castShadow = true;
  machine.add(leverMount);
  const leverBoss = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.2, 20), chromeMaterial);
  leverBoss.rotation.z = Math.PI / 2;
  leverBoss.position.set(0.93, 1.6, 0.02);
  leverBoss.castShadow = true;
  machine.add(leverBoss);

  // 축이 도는 자리. rotation.x 를 키우면 손잡이가 앞쪽 아래로 내려온다.
  const lever = new THREE.Group();
  lever.position.set(0.98, 1.6, 0.02);
  machine.add(lever);
  const leverArm = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.044, 0.62, 16), chromeMaterial);
  leverArm.position.y = 0.31;
  leverArm.castShadow = true;
  lever.add(leverArm);
  const leverKnobMaterial = new THREE.MeshPhysicalMaterial({
    color: accent.clone(),
    roughness: 0.16,
    metalness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    emissive: accent.clone(),
    emissiveIntensity: 0,
  });
  const leverKnob = new THREE.Mesh(new THREE.SphereGeometry(0.135, 22, 16), leverKnobMaterial);
  leverKnob.position.y = 0.66;
  leverKnob.castShadow = true;
  lever.add(leverKnob);

  /* 배출구 — 경첩이 위에 달려 안쪽으로 열리는 문 ------------------------- */
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.48, 0.34), recessMaterial);
  mouth.position.set(0, 0.96, 0.42);
  machine.add(mouth);
  // 경첩 선 — 문 위쪽을 가로지르는 가는 크롬 봉.
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.78, 10), chromeMaterial);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, 1.20, 0.62);
  machine.add(hinge);
  const flapHinge = new THREE.Group();
  flapHinge.position.set(0, 1.18, 0.6);
  machine.add(flapHinge);
  // 문 자체가 창이다 — 안이 비쳐야 캡슐이 떨어지는 것이 보인다.
  const flap = new THREE.Mesh(
    new RoundedBoxGeometry(0.72, 0.42, 0.035, 2, 0.02),
    new THREE.MeshPhysicalMaterial({
      color: 0x8fb4e8,
      roughness: 0.06,
      metalness: 0,
      transparent: true,
      opacity: 0.24,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.2,
    }),
  );
  flap.position.set(0, -0.2, 0);
  flapHinge.add(flap);
  // 창을 두른 크롬 테. 판 넷을 둘러 창틀로 읽히게 한다.
  for (const [x, y, w, h] of [[0, 1.235, 0.9, 0.045], [0, 0.705, 0.9, 0.045], [-0.43, 0.97, 0.045, 0.575], [0.43, 0.97, 0.045, 0.575]] as const) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.055), chromeMaterial);
    bar.position.set(x, y, 0.615);
    bar.castShadow = true;
    machine.add(bar);
  }

  // 캡슐이 눕는 바닥
  const trayFloor = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.04, 0.34), darkMaterial);
  trayFloor.position.set(0, 0.74, 0.5);
  trayFloor.receiveShadow = true;
  machine.add(trayFloor);

  // 목 — 돔이 앉는 고리
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.82, 0.26, 36), bodyPaint);
  collar.position.set(0, 2.03, 0);
  collar.castShadow = true;
  machine.add(collar);
  const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.625, 0.045, 12, 44), chromeMaterial);
  collarRing.rotation.x = Math.PI / 2;
  collarRing.position.set(0, 2.15, 0);
  collarRing.castShadow = true;
  machine.add(collarRing);
  // 돔 바닥과 캡슐이 빠지는 구멍
  const domeFloor = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.66, 40).rotateX(-Math.PI / 2), darkMaterial);
  domeFloor.position.set(0, DOME_FLOOR, 0);
  domeFloor.receiveShadow = true;
  machine.add(domeFloor);

  /* 유리 돔 ---------------------------------------------------------------- */
  const glassMaterial = quality.transmission
    ? new THREE.MeshPhysicalMaterial({
      // 아주 옅은 푸른 기. 완전히 무색인 유리는 화면에서 사라져 버린다.
      color: 0xeef4ff,
      roughness: 0.02,
      metalness: 0,
      transmission: 1,
      // 진짜 유리의 두께와 굴절률. 얇게 두면 비닐처럼 보이고, 이만큼 있어야 뒤가
      // 살짝 휘어 유리로 읽힌다.
      thickness: 0.18,
      ior: 1.5,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      transparent: true,
      opacity: 1,
      envMapIntensity: 0.55,
      side: THREE.FrontSide,
    })
    : new THREE.MeshPhysicalMaterial({
      color: 0xdce9ff,
      roughness: 0.05,
      metalness: 0,
      transparent: true,
      // 옅은 유리. 너무 옅으면 유리공이 아예 안 보이고, 짙게 두면 안의 캡슐이 우유에 잠긴다.
      // 반사를 세게 두어 둥근 모양이 읽히게 한다.
      opacity: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.5,
      side: THREE.FrontSide,
      depthWrite: false,
    });
  // 적도보다 조금 더 내려온 유리공. 바닥(구멍이 뚫린 접시)이 그 안에 들어가고,
  // 꼭대기는 캡슐을 붓는 투입구만큼 비어 있다.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(DOME_RADIUS, 44, 30, 0, Math.PI * 2, HATCH_PHI, Math.PI * 0.76 - HATCH_PHI),
    glassMaterial,
  );
  dome.position.copy(DOME_CENTER);
  dome.renderOrder = 2;
  machine.add(dome);

  // 투입구 — 유리공 꼭대기에 얹힌 금속 깔때기와 뚜껑 손잡이. 캡슐은 여기로 들어온다.
  const hatchRing = new THREE.Mesh(new THREE.TorusGeometry(HATCH_RADIUS + 0.015, 0.028, 10, 32), chromeMaterial);
  hatchRing.rotation.x = Math.PI / 2;
  hatchRing.position.set(0, HATCH_Y, 0);
  machine.add(hatchRing);
  const funnel = new THREE.Mesh(
    new THREE.CylinderGeometry(HATCH_RADIUS + 0.11, HATCH_RADIUS + 0.01, 0.16, 28, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xb6c0d8, roughness: 0.3, metalness: 0.9, envMapIntensity: 1.3, side: THREE.DoubleSide }),
  );
  funnel.position.set(0, HATCH_Y + 0.06, 0);
  machine.add(funnel);
  const lidKnob = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 12), chromeMaterial);
  lidKnob.position.set(0, HATCH_Y + 0.17, 0);
  lidKnob.castShadow = true;
  machine.add(lidKnob);

  /**
   * 유리에 맺히는 반사 두 점 — 넓고 부드러운 것 하나, 좁고 단단한 것 하나.
   *
   * 환경 반사에만 맡기면 어두운 가게에서는 비칠 것이 없어 돔이 잿빛 구슬로 나온다.
   * 이 두 판은 늘 카메라를 향하고 돔 위 정해진 자리에 붙어 있어, 어느 각도에서 봐도
   * "유리 위의 빛" 으로 읽힌다.
   */
  const highlight = new THREE.Group();
  machine.add(highlight);
  const highlightSoftMaterial = new THREE.MeshBasicMaterial({
    color: 0xdce8ff,
    map: makeGlowTexture(0.42),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const highlightSoft = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.5), highlightSoftMaterial);
  highlight.add(highlightSoft);
  const highlightHardMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: makeGlowTexture(0.72),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const highlightHard = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), highlightHardMaterial);
  highlight.add(highlightHard);
  // 대기 중 6~9초마다 돔을 훑고 지나가는 빛 한 줄.
  const glintMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: makeStreakTexture(),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glint = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.5), glintMaterial);
  glint.rotation.z = 0.42;
  highlight.add(glint);

  /* 캡슐 -------------------------------------------------------------------
     알마다 메시 세 개를 두면 마흔 알에 그리기가 120회다. 인스턴스 메시 세 개로
     묶어 세 번에 그린다. 링은 기하를 미리 눕혀 두어 세 벌이 같은 행렬을 쓴다. */
  const capsuleGeometryTop = new THREE.SphereGeometry(CAPSULE_RADIUS, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const capsuleGeometryBottom = new THREE.SphereGeometry(CAPSULE_RADIUS, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const capsuleGeometryRing = new THREE.TorusGeometry(CAPSULE_RADIUS * 0.99, CAPSULE_RADIUS * 0.13, 6, 18)
    .rotateX(Math.PI / 2);
  // 반구는 양면으로 그린다 — 투과 패스가 절반 해상도로 다시 그릴 때 한 면만 있는
  // 반구는 안쪽이 뚫린 조개껍데기처럼 찍혔다(2026-09-02 밤, 카메라가 돔에 다가간 장면).
  const creamMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.22,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    side: THREE.DoubleSide,
  });
  const capsuleTopMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.12,
    metalness: 0.02,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.2,
    side: THREE.DoubleSide,
  });
  // 이음 링은 크롬 — 회색 고무줄이 아니라 빛을 되쏘는 금속 띠여야 알이 알로 읽힌다.
  const capsuleRingMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.22,
    metalness: 0.9,
    envMapIntensity: 1.1,
  });

  const MAX_CAPSULES = Math.max(1, quality.capsules);
  const pile = new THREE.Group();
  machine.add(pile);
  const capsuleTops = new THREE.InstancedMesh(capsuleGeometryTop, capsuleTopMaterial, MAX_CAPSULES);
  const capsuleBottoms = new THREE.InstancedMesh(capsuleGeometryBottom, creamMaterial, MAX_CAPSULES);
  const capsuleRings = new THREE.InstancedMesh(capsuleGeometryRing, capsuleRingMaterial, MAX_CAPSULES);
  for (const mesh of [capsuleTops, capsuleBottoms, capsuleRings]) {
    mesh.castShadow = true;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    pile.add(mesh);
  }

  const capsules: Capsule[] = Array.from({ length: MAX_CAPSULES }, (_unused, index) => ({
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    spin: new THREE.Vector3(seeded(index, 7) - 0.5, seeded(index, 11) - 0.5, seeded(index, 13) - 0.5),
    rotation: new THREE.Euler(seeded(index, 17) * 6.28, seeded(index, 19) * 6.28, 0),
    // 세 가지 크기. 한 가지 크기로 채운 통은 알갱이가 아니라 거품처럼 보인다.
    scale: [0.86, 1, 1.15][Math.floor(seeded(index, 31) * 3) % 3],
    entering: false,
  }));
  /** 지금 몇 알이 통에 들어 있는지. 인스턴스는 앞에서부터 차례로 쓴다. */
  let capsuleCount = 0;

  const matrixScratch = new THREE.Matrix4();
  const quaternionScratch = new THREE.Quaternion();
  const scaleScratch = new THREE.Vector3();

  function ensureCapsules(count: number): void {
    capsuleCount = Math.max(0, Math.min(MAX_CAPSULES, count));
    capsuleTops.count = capsuleCount;
    capsuleBottoms.count = capsuleCount;
    capsuleRings.count = capsuleCount;
  }

  /** 지금 값들을 인스턴스 행렬에 옮겨 적는다. 한 프레임에 한 번. */
  function writeCapsuleInstances(): void {
    for (let index = 0; index < capsuleCount; index += 1) {
      const capsule = capsules[index];
      quaternionScratch.setFromEuler(capsule.rotation);
      scaleScratch.setScalar(capsule.scale);
      matrixScratch.compose(capsule.position, quaternionScratch, scaleScratch);
      capsuleTops.setMatrixAt(index, matrixScratch);
      capsuleBottoms.setMatrixAt(index, matrixScratch);
      capsuleRings.setMatrixAt(index, matrixScratch);
    }
    capsuleTops.instanceMatrix.needsUpdate = true;
    capsuleBottoms.instanceMatrix.needsUpdate = true;
    capsuleRings.instanceMatrix.needsUpdate = true;
  }

  /**
   * 돔 안에 쌓인 첫 자리. 아래 넓은 층부터 좁혀 올라가 봉긋한 더미가 된다.
   * 뒤쪽(카메라에서 먼 쪽) 알은 조금 작고 조금 어둡다 — 더미에 깊이가 생긴다.
   */
  function seatCapsule(capsule: Capsule, index: number): void {
    let layer = 0;
    let within = index;
    while (layer < PILE_LAYERS.length - 1 && within >= PILE_LAYERS[layer].count) {
      within -= PILE_LAYERS[layer].count;
      layer += 1;
    }
    const shell = PILE_LAYERS[layer];
    const radius = shell.inner + (shell.outer - shell.inner) * seeded(index, 3);
    const angle = (within / shell.count) * Math.PI * 2 + layer * 0.9;
    capsule.position.set(
      Math.cos(angle) * radius,
      DOME_FLOOR + CAPSULE_RADIUS + layer * CAPSULE_RADIUS * 1.58 + seeded(index, 5) * 0.02,
      Math.sin(angle) * radius,
    );
    capsule.velocity.set(0, 0, 0);
    capsule.entering = false;
    capsule.rotation.set(seeded(index, 17) * 6.28, seeded(index, 19) * 6.28, 0);
  }

  /**
   * 투입구 위에 줄 세운 첫 자리. 번호가 클수록 높이 올라가 있어, 떨어지면서
   * 한 알씩 차례로 들어간다 — 이것이 "우르르" 의 전부다.
   */
  function stackAboveHatch(capsule: Capsule, index: number): void {
    capsule.position.set(
      (seeded(index, 101) - 0.5) * HATCH_RADIUS * 0.9,
      HATCH_Y + 0.3 + index * 0.055 + seeded(index, 103) * 0.04,
      (seeded(index, 107) - 0.5) * HATCH_RADIUS * 0.9,
    );
    capsule.velocity.set(0, -1.6 - seeded(index, 109) * 0.5, 0);
    capsule.entering = true;
  }

  /**
   * 알마다 색을 칠한다. 위 반구는 등급 색이 바탕이고 거기에 그 상품에서 잰 색이
   * 조금 섞인다 — 통을 보면 어떤 등급이 얼마나 들었는지 먼저 읽히고, 알마다 제
   * 물건의 기색이 남는다. 이음 링은 같은 등급 색을 어둡게 쓴 그림자 선이다.
   */
  function paintCapsule(index: number, spec: CapsuleSpec): void {
    const grade = toColor(spec.ring);
    const measured = toColor(spec.color);
    const capsule = capsules[index];
    // 뒤쪽에 앉은 알은 어둡고 작다. 자리에 앉히기 전의 정해진 값이라 매 프레임 다시
    // 칠할 필요가 없다.
    seatCapsule(capsule, index);
    const depth = Math.min(1, Math.max(0, (capsule.position.z + 0.62) / 1.24));
    const shade = 0.56 + depth * 0.44;
    capsule.scale = capsule.scale * (0.9 + depth * 0.16);

    // 위 반구는 등급 색을 그대로 — 통을 보면 무슨 등급이 얼마나 들었는지 한눈에 읽혀야 한다.
    // C(크림)도 흰색이 아니라 따뜻한 상아색이어야 회색 덩어리로 죽지 않는다.
    const top = grade.clone().lerp(measured, 0.16);
    const hsl = { h: 0, s: 0, l: 0 };
    top.getHSL(hsl);
    top.setHSL(hsl.h, Math.min(1, hsl.s * 1.25 + 0.05), Math.min(0.72, Math.max(0.42, hsl.l)));
    capsuleTops.setColorAt(index, top.multiplyScalar(0.7 + shade * 0.3));
    capsuleBottoms.setColorAt(index, new THREE.Color(0xfff4dc).multiplyScalar(0.72 + shade * 0.28));
    capsuleRings.setColorAt(index, new THREE.Color(0xe8edf8).multiplyScalar(0.75 + shade * 0.25));
  }

  /**
   * 공개 장면 — 배출된 캡슐, 빛 터짐, 상품 파일.
   *
   * 기계의 자식이 아니다. 상품이 앞으로 나오는 동안 기계는 통째로 숨는데(운영자가
   * 상품 뒤로 비치는 몸통을 지적했다), 이것들이 기계 밑에 달려 있으면 같이 사라진다.
   * 기계가 원점에 그대로 서 있으므로 좌표는 기계 안에 있을 때와 같은 값을 쓴다.
   */
  const reveal = new THREE.Group();
  scene.add(reveal);

  /** 배출되는 캡슐 — 쌓인 무리와 따로 움직인다(반구가 갈라져야 해서 인스턴스가 아니다). */
  const prizeTopMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.14, metalness: 0.02, clearcoat: 1, clearcoatRoughness: 0.04,
  });
  const prizeRingMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.5, emissive: 0x000000 });
  const prize = { group: new THREE.Group(), top: prizeTopMaterial, ring: prizeRingMaterial };
  const prizeTopMesh = new THREE.Mesh(capsuleGeometryTop, prizeTopMaterial);
  const prizeBottomMesh = new THREE.Mesh(capsuleGeometryBottom, creamMaterial);
  const prizeRingMesh = new THREE.Mesh(capsuleGeometryRing, prizeRingMaterial);
  prizeTopMesh.castShadow = true;
  prizeBottomMesh.castShadow = true;
  prize.group.add(prizeTopMesh, prizeBottomMesh, prizeRingMesh);
  prize.group.visible = false;
  prize.group.scale.setScalar(1.55);
  reveal.add(prize.group);

  /**
   * 상품이 앞으로 나올 때 기계 위에 덮이는 어두운 막.
   * 이것이 없으면 유리 돔과 상품이 겹쳐 무엇을 보라는 것인지 알 수 없다.
   */
  const backdropMaterial = new THREE.MeshBasicMaterial({
    color: 0x05070f,
    map: makeSoftDiscTexture(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 4.8), backdropMaterial);
  // 상품(z 3.6)보다 뒤, 기계보다 앞.
  backdrop.position.set(0, 1.9, 2.6);
  backdrop.renderOrder = 3;
  backdrop.visible = false;
  scene.add(backdrop);

  /* 빛 터짐 --------------------------------------------------------------- */
  const burstGroup = new THREE.Group();
  // 막보다 나중에 그려야 빛줄기가 막에 먹히지 않는다.
  burstGroup.renderOrder = 4;
  burstGroup.visible = false;
  reveal.add(burstGroup);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    // 무늬 없이 두면 네모난 흰 판이 화면을 통째로 덮는다. 가운데만 밝은 둥근 무늬를 씌운다.
    map: makeSoftDiscTexture(),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), glowMaterial);
  burstGroup.add(glow);

  const SPARK_COUNT = 40;
  const sparkGeometry = new THREE.BufferGeometry();
  const sparkPositions = new Float32Array(SPARK_COUNT * 3);
  sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
  const sparkDirections: THREE.Vector3[] = Array.from({ length: SPARK_COUNT }, (_unused, index) => {
    const theta = seeded(index, 23) * Math.PI * 2;
    const phi = Math.acos(2 * seeded(index, 29) - 1);
    return new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.abs(Math.cos(phi)) * 0.8 + 0.25,
      Math.sin(phi) * Math.sin(theta),
    ).multiplyScalar(0.7 + seeded(index, 31) * 0.9);
  });
  const sparkMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    map: makeSoftDiscTexture(),
    size: 0.14,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
  burstGroup.add(sparks);

  /* 상품 —— GLB 또는 그림 카드 -------------------------------------------- */
  const prizeArt = new THREE.Group();
  prizeArt.visible = false;
  reveal.add(prizeArt);
  let prizeArtLoaded = false;
  const disposables: Array<{ dispose: () => void }> = [];

  function emptyPrizeArt(): void {
    for (const child of [...prizeArt.children]) {
      prizeArt.remove(child);
      child.traverse?.((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const material = mesh.material as THREE.Material | THREE.Material[];
          if (Array.isArray(material)) for (const one of material) one.dispose();
          else material?.dispose();
        }
      });
    }
    prizeArtLoaded = false;
  }

  /* 상태 ------------------------------------------------------------------- */
  let stage: SceneStage = "idle";
  let stageTime = 0;
  let clock = 0;
  let hovered = false;
  const pointer = new THREE.Vector2(0, 0);
  const pointerEased = new THREE.Vector2(0, 0);
  /** 손이 끌어내린 정도(0~1)와 실제로 그려지는 값. 놓으면 그려지는 값이 0 으로 돌아간다. */
  let leverHeld = 0;
  let leverValue = 0;
  /** 스크롤 진행도 — 요청값과 프레임마다 따라가는 값. 공개 무대에서는 첫 자리로 돌아간다. */
  let scrollTarget = 0;
  let scrollEased = 0;
  const shotPosition = new THREE.Vector3();
  const shotTarget = new THREE.Vector3();
  const prizeForward = new THREE.Vector3();
  const prizeRight = new THREE.Vector3();
  const prizeUp = new THREE.Vector3();
  let cameraShake = 0;
  let width = 1;
  let height = 1;

  /* 손끝에 반응하는 값들 ----------------------------------------------------- */
  /** 레버 위에 손이 올라와 있는지, 그리고 그 상태가 부드럽게 따라오는 값. */
  let leverHover = false;
  let leverHoverEase = 0;
  /** 레버를 잡고 끄는 중인지. 몸통이 1° 기운다. */
  let leverDragging = false;
  let leverDragEase = 0;
  /** 돔 위에 손이 올라와 있는지. 캡슐 더미가 잘게 흔들린다. */
  let domeHover = false;
  /** 더미를 흔드는 힘. 손을 올리면 조금, 누르면 많이 찬다. */
  let jostle = 0;
  /** 레버를 놓은 순간 몸통이 눌렸다 펴지는 정도. */
  let squash = 0;
  /** 다음 빛줄기까지 남은 시간(초)과 지금 훑고 있는 진행도. */
  let glintWait = 4 + seeded(1, 131) * 3;
  let glintTime = -1;
  /** 다음으로 자리를 고쳐 눕는 캡슐까지 남은 시간. 분당 예닐곱 알. */
  let settleWait = 5 + seeded(2, 137) * 4;

  /* 등장 연출의 상태 -------------------------------------------------------- */
  /** -1 이면 아직 시작하지 않았다. 끝나면 total 에 머문다. */
  let introTime = -1;
  let introOn = false;
  /** 카탈로그가 도착했지만 아직 붓지 않은 캡슐. 등장 연출이 부을 때를 정한다. */
  let pourPending = false;
  /** 다시 돌린 등장 연출에서, 부을 차례가 올 때까지 통을 비워 둔다. */
  let pileHeld = false;
  let puffTime = -1;
  let knobGlint = -1;

  function setStage(next: SceneStage): void {
    stage = next;
    stageTime = 0;
    if (next === "pull") {
      // 레버를 끝까지 당긴 순간 기계가 한 번 눌렸다 펴진다(2%).
      squash = 1;
    }
    if (next === "shake") {
      // 캡슐 전체에 위로 튀는 힘을 준다. 물리 엔진 대신 이 한 줄이 '드르륵' 이다.
      for (let index = 0; index < capsuleCount; index += 1) {
        capsules[index].velocity.set(
          (seeded(index, 41) - 0.5) * 2.2,
          1.6 + seeded(index, 43) * 2.4,
          (seeded(index, 47) - 0.5) * 2.2,
        );
      }
    }
    if (next === "impact") {
      prize.group.visible = true;
      prize.group.scale.setScalar(1.55);
      prizeTopMesh.position.set(0, 0, 0);
      prizeBottomMesh.position.set(0, 0, 0);
      prizeTopMesh.rotation.set(0, 0, 0);
      prizeBottomMesh.rotation.set(0, 0, 0);
      prizeRingMesh.visible = true;
      prizeArt.visible = false;
      burstGroup.visible = false;
      glowMaterial.opacity = 0;
      sparkMaterial.opacity = 0;
    }
    if (next === "idle") {
      prize.group.visible = false;
      prizeArt.visible = false;
      burstGroup.visible = false;
      trayLight.intensity = 0;
      leverHeld = 0;
    }
    if (next === "burst") {
      burstGroup.visible = true;
      burstGroup.position.copy(STAGE_FRONT);
    }
    if (next === "result") {
      prize.group.visible = false;
      burstGroup.visible = false;
      prizeArt.visible = prizeArtLoaded;
      prizeArt.position.copy(STAGE_FRONT);
    }
  }

  /* 캡슐 물리 — 스프링·중력·구 밀어내기 ------------------------------------ */
  function stepCapsules(dt: number, agitated: boolean): void {
    const gravity = agitated ? -7.4 : -2.6;
    const damping = agitated ? 0.995 : 0.9;
    for (let index = 0; index < capsuleCount; index += 1) {
      const capsule = capsules[index];
      if (capsule.entering) {
        // 투입구에서 떨어지는 중 — 유리 벽도 바닥도 아직 없다. 돔 안에 들어서면 그때부터
        // 보통 캡슐이 된다.
        capsule.velocity.y += -7.2 * dt;
        capsule.position.addScaledVector(capsule.velocity, dt);
        capsule.rotation.x += capsule.spin.x * dt * 2.4;
        capsule.rotation.z += capsule.spin.z * dt * 2.4;
        if (capsule.position.distanceTo(DOME_CENTER) < DOME_INNER - CAPSULE_RADIUS) capsule.entering = false;
        continue;
      }
      if (!agitated) {
        // 대기 중에도 아주 미세하게 숨 쉬듯 — 자리마다 다른 위상의 작은 힘.
        const breath = Math.sin(clock * 1.15 + index * 0.7) * 0.055;
        capsule.velocity.y += breath * dt;
        // 손이 유리 위에 올라와 있으면 더미가 잘게 들썩인다.
        if (jostle > 0.001) {
          capsule.velocity.x += (seeded(index, Math.floor(clock * 9) + 151) - 0.5) * jostle * 2.4 * dt;
          capsule.velocity.y += seeded(index, Math.floor(clock * 9) + 157) * jostle * 3.1 * dt;
          capsule.velocity.z += (seeded(index, Math.floor(clock * 9) + 163) - 0.5) * jostle * 2.4 * dt;
        }
      }
      capsule.velocity.y += gravity * dt;
      capsule.velocity.multiplyScalar(damping);
      capsule.position.addScaledVector(capsule.velocity, dt);

      // 바닥
      const floorY = DOME_FLOOR + CAPSULE_RADIUS;
      if (capsule.position.y < floorY) {
        capsule.position.y = floorY;
        capsule.velocity.y = Math.abs(capsule.velocity.y) * (agitated ? 0.52 : 0.12);
      }
      // 돔 안쪽 벽
      const offset = capsule.position.clone().sub(DOME_CENTER);
      const distance = offset.length();
      if (distance > DOME_INNER) {
        offset.multiplyScalar(DOME_INNER / distance);
        capsule.position.copy(DOME_CENTER).add(offset);
        const normal = offset.normalize();
        capsule.velocity.addScaledVector(normal, -2 * capsule.velocity.dot(normal) * 0.55);
      }
    }

    // 겹침 방지 — 구 대 구를 몇 번 밀어낸다. 정확할 필요가 없고 겹쳐 보이지만 않으면 된다.
    const passes = agitated ? 3 : 1;
    const minimum = CAPSULE_RADIUS * 2;
    for (let pass = 0; pass < passes; pass += 1) {
      for (let a = 0; a < capsuleCount; a += 1) {
        for (let b = a + 1; b < capsuleCount; b += 1) {
          const first = capsules[a].position;
          const second = capsules[b].position;
          const dx = second.x - first.x;
          const dy = second.y - first.y;
          const dz = second.z - first.z;
          const squared = dx * dx + dy * dy + dz * dz;
          if (squared >= minimum * minimum || squared < 1e-9) continue;
          const distance = Math.sqrt(squared);
          const push = (minimum - distance) / 2;
          const nx = dx / distance;
          const ny = dy / distance;
          const nz = dz / distance;
          first.x -= nx * push; first.y -= ny * push; first.z -= nz * push;
          second.x += nx * push; second.y += ny * push; second.z += nz * push;
        }
      }
    }

    const spinRate = agitated ? 3.2 : 0.32;
    for (let index = 0; index < capsuleCount; index += 1) {
      const capsule = capsules[index];
      capsule.rotation.x += capsule.spin.x * dt * spinRate;
      capsule.rotation.y += capsule.spin.y * dt * spinRate;
      capsule.rotation.z += capsule.spin.z * dt * spinRate;
    }
  }

  /* 배출 — 돔 구멍 → 몸통 안(안 보임) → 배출구로 툭 --------------------- */
  function stepDispense(time: number): void {
    const hole = new THREE.Vector3(0, DOME_FLOOR + CAPSULE_RADIUS, 0);
    if (time < 0.3) {
      // 구멍으로 빨려 내려간다.
      const k = time / 0.3;
      prize.group.visible = true;
      prize.group.position.set(0, hole.y - k * 0.42, 0);
      prize.group.scale.setScalar(1.55 * (1 - k * 0.3));
      prize.group.rotation.y += 0.22;
    } else if (time < 0.45) {
      // 몸통 안 통로 — 보이지 않는다.
      prize.group.visible = false;
    } else {
      prize.group.visible = true;
      prize.group.scale.setScalar(1.55);
      const t = time - 0.45;
      // 떨어짐과 두 번의 튕김. 값은 눈으로 맞춘 것이고 실제 중력식은 아니다.
      const drop = 0.34;
      const first = 0.19;
      const second = 0.12;
      const restY = TRAY.y;
      let y = restY;
      if (t < drop) {
        const k = t / drop;
        y = 1.34 - (1.34 - restY) * k * k;
      } else if (t < drop + first) {
        const k = (t - drop) / first;
        y = restY + Math.sin(k * Math.PI) * 0.2;
      } else if (t < drop + first + second) {
        const k = (t - drop - first) / second;
        y = restY + Math.sin(k * Math.PI) * 0.075;
      }
      prize.group.position.set(0, y, TRAY.z);
      prize.group.rotation.x += 0.14;
      prize.group.rotation.z += 0.05;
    }
  }

  /* 캡슐 열기 — 떠오름 → 흔들림 세 번 → 멈칫 ----------------------------- */
  function stepWobble(time: number): void {
    const total = STAGE_SECONDS.wobble;
    const rise = Math.min(1, time / 0.42);
    const eased = 1 - (1 - rise) ** 3;
    prize.group.visible = true;
    prize.group.position.lerpVectors(new THREE.Vector3(0, TRAY.y, TRAY.z), STAGE_FRONT, eased);
    prize.group.scale.setScalar(1.55 + eased * 0.5);
    // 세 번, 갈수록 크게. 마지막에 멈칫한다.
    const shakePhase = Math.min(1, time / (total * 0.86));
    const amplitude = reduced ? 0 : 0.06 + shakePhase * 0.16;
    const settle = time > total * 0.86 ? 0 : 1;
    prize.group.rotation.set(0, 0, Math.sin(time * 17) * amplitude * settle);
    prize.group.position.x += Math.sin(time * 17) * amplitude * 0.55 * settle;
  }

  /* 갈라짐 ---------------------------------------------------------------- */
  function stepBurst(time: number): void {
    const k = Math.min(1, time / 0.55);
    prize.group.visible = true;
    prize.group.position.copy(STAGE_FRONT);
    prize.group.rotation.set(0, 0, 0);
    prizeTopMesh.position.set(-k * 0.5, k * 0.42, k * 0.2);
    prizeTopMesh.rotation.set(k * 1.6, 0, k * 2.1);
    prizeBottomMesh.position.set(k * 0.5, -k * 0.3, -k * 0.15);
    prizeBottomMesh.rotation.set(-k * 1.2, 0, -k * 1.9);
    prizeRingMesh.visible = k < 0.4;

    burstGroup.visible = true;
    burstGroup.position.copy(STAGE_FRONT);
    const flash = Math.max(0, 1 - time / 0.55);
    glowMaterial.opacity = reduced ? 0 : flash * 0.55;
    glow.scale.setScalar(0.3 + k * 0.9);
    glow.quaternion.copy(camera.quaternion);
    sparkMaterial.opacity = reduced ? 0 : Math.max(0, 1 - time / 0.95);
    for (let index = 0; index < SPARK_COUNT; index += 1) {
      const direction = sparkDirections[index];
      const travel = time * 2.1;
      sparkPositions[index * 3] = direction.x * travel;
      sparkPositions[index * 3 + 1] = direction.y * travel - travel * travel * 0.7;
      sparkPositions[index * 3 + 2] = direction.z * travel;
    }
    sparkGeometry.attributes.position.needsUpdate = true;

    // 상품은 갈라짐이 반쯤 지났을 때부터 자란다.
    if (prizeArtLoaded) {
      const grow = Math.max(0, Math.min(1, (time - 0.45) / 0.5));
      prizeArt.visible = grow > 0;
      prizeArt.position.copy(STAGE_FRONT);
      prizeArt.scale.setScalar(0.2 + grow * 0.8);
    }
  }

  /* 가게의 잔움직임 — 먼지와 착지 먼지 -------------------------------------- */
  function stepDust(dt: number): void {
    // 움직임을 줄여 달라는 설정에서는 먼지도 떠다니지 않는다 — 대기 화면이 완전히 멈춘다.
    if (reduced || DUST_COUNT === 0 || dustMaterial.opacity <= 0.01) return;
    for (let index = 0; index < DUST_COUNT; index += 1) {
      const seed = dustSeeds[index];
      let y = dustPositions[index * 3 + 1] + seed.speed * dt;
      if (y > 4.1) y = 0.2;
      dustPositions[index * 3] = seed.x + Math.sin(clock * 0.4 + seed.sway) * 0.16;
      dustPositions[index * 3 + 1] = y;
      dustPositions[index * 3 + 2] = seed.z + Math.cos(clock * 0.33 + seed.sway) * 0.12;
    }
    dustGeometry.attributes.position.needsUpdate = true;
  }

  function stepPuff(dt: number): void {
    if (puffTime < 0) return;
    puffTime += dt;
    const k = puffTime / 0.85;
    if (k >= 1) {
      puffTime = -1;
      puff.visible = false;
      puffMaterial.opacity = 0;
      return;
    }
    puff.visible = true;
    puffMaterial.opacity = (1 - k) * 0.34;
    puffMaterial.size = 0.26 + k * 0.44;
    const spread = k ** 0.6;
    for (let index = 0; index < PUFF_COUNT; index += 1) {
      const direction = puffDirections[index];
      puffPositions[index * 3] = direction.x * spread;
      puffPositions[index * 3 + 1] = 0.06 + direction.lift * Math.sin(k * Math.PI) * 0.42;
      puffPositions[index * 3 + 2] = direction.z * spread;
    }
    puffGeometry.attributes.position.needsUpdate = true;
  }

  /**
   * 유리 위의 빛 — 늘 카메라를 향하는 반사 두 점과, 이따금 훑고 지나가는 한 줄.
   * 돔 위 "화면에서 본 자리" 에 붙어 있어야 해서 카메라의 좌우·위 방향을 그때그때 읽는다.
   */
  const cameraRight = new THREE.Vector3();
  const cameraUp = new THREE.Vector3();
  const cameraForward = new THREE.Vector3();

  function stepHighlights(dt: number): void {
    camera.matrixWorld.extractBasis(cameraRight, cameraUp, cameraForward);
    const face = DOME_RADIUS * 0.99;
    const place = (mesh: THREE.Mesh, across: number, up: number) => {
      mesh.position.copy(DOME_CENTER)
        .addScaledVector(cameraRight, across * DOME_RADIUS)
        .addScaledVector(cameraUp, up * DOME_RADIUS)
        .addScaledVector(cameraForward, face * 0.42);
      mesh.quaternion.copy(camera.quaternion);
    };
    // 왼쪽 위의 넓은 반사와, 그 오른쪽에 맺힌 작고 단단한 점.
    place(highlightSoft, -0.42, 0.44);
    place(highlightHard, 0.2, 0.56);

    if (glintTime >= 0) {
      glintTime += dt;
      const k = glintTime / 1.15;
      if (k >= 1) {
        glintTime = -1;
        glintMaterial.opacity = 0;
        glint.visible = false;
      } else {
        glint.visible = true;
        glintMaterial.opacity = Math.sin(k * Math.PI) * 0.5;
        place(glint, -1.1 + k * 2.2, 0.12);
        glint.rotation.z = 0.42;
      }
    } else {
      glint.visible = false;
    }
  }

  /* 등장 연출 ---------------------------------------------------------------
     어둠 → 스포트라이트 딸깍 → 기계가 내려와 쿵 → 네온 지직 → 캡슐 우르르 →
     레버 반짝. 전부 2.4초 안이고, 아무 데나 누르면 그 자리에서 완성 상태가 된다. */

  /** 네온이 켜지는 동안의 깜빡임. 켜짐 1, 꺼짐 0.05. */
  function neonGate(t: number): number {
    if (t < INTRO_SECONDS.neon) return 0;
    const k = t - INTRO_SECONDS.neon;
    if (k >= 0.3) return 1;
    return k < 0.05 || (k >= 0.11 && k < 0.15) ? 1 : 0.05;
  }

  function applyIntro(t: number): void {
    // 스포트라이트 — 이 순간까지는 가게가 거의 깜깜하다.
    const lit = t < INTRO_SECONDS.spotlight ? 0 : Math.min(1, (t - INTRO_SECONDS.spotlight) / 0.2);
    const dim = 0.1 + 0.9 * lit;
    ambient.intensity = 0.5 * dim;
    key.intensity = 2.5 * dim;
    fill.intensity = 0.62 * dim;
    rim.intensity = 1.9 * dim;
    rimWarm.intensity = 1.05 * dim;
    sweep.intensity = 2.6 * dim;
    domeLight.intensity = 2.4 * dim;
    backLightMaterial.opacity = lit * 0.22;
    wallMaterial.color.setScalar(0.16 + 0.84 * lit);
    spot.intensity = lit * 22;
    coneMaterial.opacity = lit * 0.07;
    bulbMaterial.opacity = lit * 0.75;
    wallGlowMaterial.opacity = lit * 0.18;
    dustMaterial.opacity = lit * 0.3;
    poolMaterial.opacity = lit * 0.17;
    contactMaterial.opacity = lit * 0.62;
    highlightSoftMaterial.opacity = lit * 0.3;
    highlightHardMaterial.opacity = lit * 0.62;

    // 기계가 위에서 내려와 착지한다.
    const fallSpan = INTRO_SECONDS.land - INTRO_SECONDS.spotlight;
    const fall = t < INTRO_SECONDS.spotlight ? 0 : Math.min(1, (t - INTRO_SECONDS.spotlight) / fallSpan);
    if (t < INTRO_SECONDS.land) {
      machine.position.y = 4.6 * (1 - fall * fall);
    } else {
      // 착지 뒤 아주 짧게 눌렸다 펴진다.
      const settle = Math.min(1, (t - INTRO_SECONDS.land) / 0.26);
      machine.position.y = -0.075 * Math.sin(settle * Math.PI) * (1 - settle);
    }

    // 네온 사인 — 관과 그 둘레의 후광이 같이 지직거린다.
    const gate = neonGate(t);
    signMaterial.emissiveIntensity = 1.05 * gate;
    signGlowMaterial.opacity = 0.34 * gate;
  }

  /** 연출을 끝난 자리에 그대로 세운다. 건너뛰기와 움직임 최소화가 같이 쓴다. */
  function finishIntro(): void {
    introOn = false;
    introTime = INTRO_SECONDS.total;
    applyIntro(INTRO_SECONDS.total);
    machine.position.y = 0;
    puffTime = -1;
    puff.visible = false;
    puffMaterial.opacity = 0;
    knobGlint = -1;
    leverKnobMaterial.emissiveIntensity = 0;
    if (pourPending) {
      pourPending = false;
      pileHeld = false;
      // 건너뛴 사람에게는 이미 채워진 통을 보여 준다.
      for (let index = 0; index < capsuleCount; index += 1) seatCapsule(capsules[index], index);
    }
  }

  function startPour(): void {
    pourPending = false;
    pileHeld = false;
    for (let index = 0; index < capsuleCount; index += 1) stackAboveHatch(capsules[index], index);
  }

  function stepIntro(dt: number): void {
    if (!introOn) return;
    introTime += dt;
    applyIntro(introTime);
    // 착지하는 프레임에 먼지와 카메라 흔들림을 한 번만 낸다.
    if (introTime >= INTRO_SECONDS.land && introTime - dt < INTRO_SECONDS.land) {
      puffTime = 0;
      cameraShake = 0.03;
    }
    if (introTime >= INTRO_SECONDS.lever && introTime - dt < INTRO_SECONDS.lever) knobGlint = 0;
    if (introTime >= INTRO_SECONDS.total) {
      introOn = false;
      introTime = INTRO_SECONDS.total;
    }
  }

  /* 프레임 ----------------------------------------------------------------- */
  function frame(dtMs: number): void {
    const dt = Math.min(0.05, Math.max(0.001, dtMs / 1000));
    clock += dt;
    stageTime += dt;

    stepIntro(dt);
    stepPuff(dt);
    stepDust(dt);
    // 카탈로그가 도착해 있으면 붓는다. 등장 연출 중이면 그 차례가 올 때까지 기다린다.
    if (pourPending && (!introOn || introTime >= INTRO_SECONDS.pour)) startPour();

    /* 손끝을 따라 — 카메라가 미끄러지고, 기계가 조금 돌고, 조명이 같이 기운다.
       움직임을 줄여 달라는 설정에서는 이 전부가 0 이다(색이 바뀌는 반응만 남는다). */
    const sway = reduced ? 0 : 1;
    pointerEased.lerp(pointer, reduced ? 1 : Math.min(1, dt * 4));
    const shake = cameraShake > 0 ? cameraShake : 0;
    // 스크롤 자리 — 공개 무대(캡슐이 갈라지는 순간부터)에서는 상품이 카메라 앞 정해진
    // 자리에 서므로 첫 자리로 돌아간다.
    const revealing = stage === "wobble" || stage === "burst" || stage === "result";
    // 2026-09-03: 공개 무대에서 카메라를 첫 자리로 되돌리던 것을 없앴다 — 뽑을 때마다 기계가
    // 멀어졌다 다시 다가와 어지러웠다(운영자 영상). 상품은 카메라 기준으로 놓이므로 카메라는
    // 스크롤 자리에 그대로 머문다.
    void revealing;
    scrollEased = approach(scrollEased, scrollTarget, reduced ? 1 : Math.min(1, dt * 3.5));
    shotAt(scrollEased, shotPosition, shotTarget);
    // 세로 화면에서는 같은 자리에서 기계가 좌우로 잘린다 — 화면 비율만큼 물러선다.
    // 390×844(비율 0.46)에서 1.35배: 첫 자리 6.4 m 가 8.6 m 가 되어 기계 폭 2.1 m 가 들어온다.
    const portrait = Math.max(1, 0.62 / Math.max(0.3, camera.aspect));
    if (portrait > 1) {
      shotPosition.sub(shotTarget).multiplyScalar(portrait).add(shotTarget);
    }
    // 가까이 갈수록 손끝 반응을 줄인다 — 코앞에서 카메라가 흔들리면 멀미가 난다.
    const near = Math.min(1, Math.max(0.35, shotPosition.z / CAMERA_DISTANCE));
    camera.position.set(
      shotPosition.x + pointerEased.x * PARALLAX.cameraX * sway * near + (shake ? (Math.random() - 0.5) * shake : 0),
      shotPosition.y + pointerEased.y * PARALLAX.cameraY * sway * near + (shake ? (Math.random() - 0.5) * shake : 0),
      shotPosition.z,
    );
    camera.lookAt(
      shotTarget.x + pointerEased.x * PARALLAX.target * sway * near,
      shotTarget.y + pointerEased.y * PARALLAX.target * sway * near,
      shotTarget.z,
    );
    if (cameraShake > 0) cameraShake = Math.max(0, cameraShake - dt * 0.9);
    spot.target.position.set(pointerEased.x * PARALLAX.spot * sway, 1.4, 0);
    cone.rotation.z = -pointerEased.x * 0.035 * sway;

    // 기계가 손끝 쪽으로 5° 돌아본다. 레버를 잡고 끄는 동안에는 몸통이 1° 기운다.
    leverDragEase = approach(leverDragEase, leverDragging ? 1 : 0, dt * 7);
    machine.rotation.y = pointerEased.x * PARALLAX.yaw * sway;
    machine.rotation.z = -leverValue * 0.008 * sway - leverDragEase * 0.003 * sway;
    // 레버를 놓은 순간의 눌림 — 2% 안에서 눌렸다 펴진다.
    if (squash > 0.001) {
      squash = Math.max(0, squash - dt * 1.7);
      const amount = reduced ? 0 : Math.sin(squash * Math.PI * 3) * squash * 0.02;
      machine.scale.set(1 + amount, 1 - amount, 1 + amount);
    } else if (machine.scale.y !== 1) {
      machine.scale.set(1, 1, 1);
    }

    // 돔 위를 도는 반짝임과 유리에 맺힌 반사.
    if (!reduced) sweep.position.set(Math.cos(clock * 0.6) * 1.15, 3.35, Math.sin(clock * 0.6) * 1.15);
    stepHighlights(dt);

    /* 가만히 두어도 살아 있다 — 6~9초마다 빛이 돔을 훑고, 캡슐 한 알이 자리를 고친다. */
    if (!reduced && stage === "idle" && !introOn) {
      glintWait -= dt;
      if (glintWait <= 0 && glintTime < 0) {
        glintTime = 0;
        glintWait = 6 + seeded(Math.floor(clock), 139) * 3;
      }
      settleWait -= dt;
      if (settleWait <= 0 && capsuleCount > 0) {
        // 분당 예닐곱 알. 한 알만 아주 조금 들썩인다.
        const index = Math.floor(seeded(Math.floor(clock * 3), 149) * capsuleCount) % capsuleCount;
        capsules[index].velocity.y += 0.9;
        capsules[index].velocity.x += (seeded(index, 167) - 0.5) * 0.4;
        settleWait = 8 + seeded(Math.floor(clock), 173) * 2;
      }
    }

    // 사인 발광 — 0.5 Hz 로 아주 조금 숨 쉬고, 마우스를 올리면 세진다.
    // 켜지는 중에는 등장 연출이 직접 잡는다.
    if (!introOn || introTime >= INTRO_SECONDS.neon + 0.3) {
      const breath = reduced ? 0 : Math.sin(clock * Math.PI) * 0.1;
      // 멀리서(첫 화면) 1.05 는 꺼진 간판으로 읽혔다. 네온은 켜져 있어야 네온이다.
      const wantedSign = hovered ? 2.8 : 1.9 + breath * 2;
      signMaterial.emissiveIntensity = approach(signMaterial.emissiveIntensity, wantedSign, dt * 6);
      signGlowMaterial.opacity = approach(signGlowMaterial.opacity, hovered ? 0.62 : 0.46 + breath * 0.6, dt * 6);
    }

    /* 레버 — 당기면 끝까지 내려갔다 스프링처럼 튕겨 올라온다. */
    if (stage === "pull") {
      const k = Math.min(1, stageTime / STAGE_SECONDS.pull);
      if (k < 0.3) {
        // 끝까지 내려간다.
        leverValue = Math.max(leverValue, k / 0.3);
      } else {
        // 튕겨 올라오며 한 번 넘어갔다 제자리.
        const spring = (k - 0.3) / 0.7;
        leverValue = Math.max(0, Math.cos(spring * 7.4) * (1 - spring) ** 1.6);
      }
    } else if (stage === "idle") {
      leverValue = approach(leverValue, leverHeld, reduced ? 1 : Math.min(1, dt * 16));
    } else {
      leverValue = approach(leverValue, 0, reduced ? 1 : Math.min(1, dt * 8));
    }
    // 0 = 손잡이가 서 있음, 1 = 앞쪽 아래로 완전히 내려감(약 72°).
    lever.rotation.x = leverValue * 1.26;
    // 손을 올리면 축이 4° 만큼 앞으로 기운다 — 잡으라는 몸짓이다.
    leverHoverEase = approach(leverHoverEase, leverHover && stage === "idle" ? 1 : 0, dt * 8);
    lever.rotation.x += leverHoverEase * 0.07;

    // 손잡이의 발광 — 손을 올렸을 때와 등장 연출의 마지막 반짝임.
    if (knobGlint >= 0) {
      knobGlint += dt;
      const k = knobGlint / 0.7;
      if (k >= 1) knobGlint = -1;
      leverKnobMaterial.emissiveIntensity = k >= 1 ? 0 : Math.sin(k * Math.PI) * 1.4;
    } else {
      // 색이 바뀌는 반응은 움직임을 줄여 달라는 설정에서도 남는다.
      const wantedKnob = (leverHover || hovered) && stage === "idle" ? 0.95 : 0;
      leverKnobMaterial.emissiveIntensity = approach(leverKnobMaterial.emissiveIntensity, wantedKnob, dt * 6);
    }

    // 유리 위에 손이 올라오면 더미가 잘게 들썩인다. 힘은 스스로 잦아든다.
    const wantedJostle = domeHover && stage === "idle" ? 0.35 : 0;
    jostle = Math.max(wantedJostle, jostle - dt * 1.6);
    // 손을 올린 동안에는 유리의 반사도 조금 밝아진다(움직임을 줄여 달라도 남는 반응).
    highlightSoftMaterial.opacity = approach(highlightSoftMaterial.opacity, domeHover ? 0.46 : 0.3, dt * 6);

    // 배출구 문 — 캡슐이 나올 때만 안쪽으로 열린다.
    const flapOpen = stage === "impact" && stageTime > 0.4 && stageTime < 0.95 ? -1.05 : 0;
    flapHinge.rotation.x = approach(flapHinge.rotation.x, flapOpen, dt * 9);

    // 배출구 조명
    const wantedTray = stage === "capsule" ? 5.5 : stage === "impact" && stageTime > 0.6 ? 3.2 : 0;
    trayLight.intensity = approach(trayLight.intensity, wantedTray, dt * 5);

    // 상품이 앞으로 나오는 동안에만 기계를 덮는다.
    // The reveal is its own scene: fully opaque, and the machine is not drawn at all —
    // the operator saw the cabinet ghosting through the prize.
    const wantedBackdrop = stage === "wobble" ? 0.7 : stage === "burst" || stage === "result" ? 1 : 0;
    const machineHidden = stage === "result" || (stage === "burst" && stageTime > 0.45);
    machine.visible = !machineHidden;
    pile.visible = !machineHidden && !pileHeld;
    // 가게도 같이 물러난다 — 상품이 뜨는 동안 바닥 타일과 뒷벽이 뒤에 남으면
    // 무엇을 보라는 것인지 다시 흐려진다.
    shop.visible = !machineHidden;
    backdropMaterial.opacity = approach(backdropMaterial.opacity, wantedBackdrop, dt * 5);
    backdrop.visible = backdropMaterial.opacity > 0.01;
    if (backdrop.visible) {
      camera.getWorldDirection(prizeForward);
      backdrop.position.copy(camera.position).addScaledVector(prizeForward, 2.3);
      backdrop.quaternion.copy(camera.quaternion);
    }

    if (!reduced) stepCapsules(dt, stage === "shake" || stage === "pull");
    writeCapsuleInstances();

    if (stage === "impact") {
      stepDispense(stageTime);
      // 충격 순간의 카메라 흔들림은 없앴다 — 몸통 눌림(squash)만 남는다.
    } else if (stage === "capsule") {
      prize.group.visible = true;
      prize.group.position.set(0, TRAY.y + (reduced ? 0 : Math.sin(clock * 2.2) * 0.012), TRAY.z);
      prize.group.rotation.y += reduced ? 0 : dt * 0.5;
    } else if (stage === "wobble") {
      stepWobble(stageTime);
    } else if (stage === "burst") {
      stepBurst(stageTime);
    } else if (stage === "result") {
      prize.group.visible = false;
      burstGroup.visible = false;
      if (prizeArtLoaded) {
        prizeArt.visible = true;
        // 넓은 화면에서는 카드가 오른쪽에 뜨므로 상품이 조금 왼쪽에 선다. 세로 화면은 카드가
        // 아래에 뜨니 가운데 그대로, 조금 위로.
        // 상품은 카메라 앞 1.9 m 에 선다 — 세로 화면에서 카메라가 물러서도 크기가 같다.
        // 넓은 화면은 카드가 오른쪽이라 왼쪽으로, 세로 화면은 카드가 아래라 위로 비킨다.
        const wide = camera.aspect >= 0.9;
        camera.getWorldDirection(prizeForward);
        prizeRight.crossVectors(prizeForward, camera.up).normalize();
        prizeUp.crossVectors(prizeRight, prizeForward).normalize();
        prizeArt.position.copy(camera.position)
          .addScaledVector(prizeForward, 1.9)
          .addScaledVector(prizeRight, wide ? -0.3 : 0)
          .addScaledVector(prizeUp, wide ? -0.05 : 0.34);
        prizeArt.scale.setScalar(1);
        if (!reduced) prizeArt.rotation.y += dt * 0.55;
      }
    }

    renderer.render(scene, camera);
  }

  function resize(): void {
    const box = host.getBoundingClientRect();
    width = Math.max(1, Math.round(box.width));
    height = Math.max(1, Math.round(box.height));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.dpr));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();

  /* 화면 자리 — HTML 오버레이 단추가 얹힐 곳 ------------------------------ */
  function project(world: THREE.Vector3, worldRadius: number): ScreenPoint {
    const point = world.clone().project(camera);
    const edge = world.clone().add(new THREE.Vector3(worldRadius, 0, 0)).project(camera);
    return {
      x: ((point.x + 1) / 2) * width,
      y: ((1 - point.y) / 2) * height,
      radius: Math.abs(edge.x - point.x) * width * 0.5,
      visible: point.z < 1,
    };
  }

  // 통은 비어 있는 채로 선다. 카탈로그가 도착하면 setCapsules 가 쏟아 붓는다.
  ensureCapsules(0);
  // 아직 startIntro 를 부르지 않았어도 첫 프레임부터 가게가 켜져 있어야 한다.
  applyIntro(INTRO_SECONDS.total);
  machine.position.y = 0;

  return {
    setCapsules(specs, options) {
      const count = Math.min(quality.capsules, Math.max(0, specs.length));
      ensureCapsules(count);
      for (let index = 0; index < count; index += 1) paintCapsule(index, specs[index]);
      if (count > 0) {
        if (capsuleTops.instanceColor) capsuleTops.instanceColor.needsUpdate = true;
        if (capsuleBottoms.instanceColor) capsuleBottoms.instanceColor.needsUpdate = true;
        if (capsuleRings.instanceColor) capsuleRings.instanceColor.needsUpdate = true;
      }
      // 움직임을 줄여 달라는 설정에서는 캡슐 물리가 아예 돌지 않는다 — 쏟아 붓는 대신
      // 채워진 통을 그대로 보여 준다.
      if (options?.pour && !reduced && count > 0) {
        pourPending = true;
      }
    },
    setPrizeCapsule(spec) {
      const grade = toColor(spec.ring);
      prize.top.color.copy(grade.clone().lerp(toColor(spec.color), 0.24));
      prize.ring.color.copy(grade.clone().multiplyScalar(0.5));
      prize.ring.emissive.copy(grade).multiplyScalar(0.4);
      sparkMaterial.color.copy(grade);
      glowMaterial.color.copy(grade.clone().lerp(new THREE.Color(0xffffff), 0.45));
      trayLight.color.copy(grade.clone().lerp(new THREE.Color(0xffffff), 0.55));
    },
    setAccent(hex) {
      const color = toColor(hex);
      bodyPaint.color.copy(color).lerp(new THREE.Color(0x180f26), 0.66);
      panelPaint.color.copy(color).lerp(new THREE.Color(0x241536), 0.4);
      leverKnobMaterial.color.copy(color);
      leverKnobMaterial.emissive.copy(color);
      // 발치의 빛 웅덩이는 기계 색이 바닥에 번진 것이다.
      poolMaterial.color.copy(color).lerp(new THREE.Color(0xffffff), 0.2);
      signGlowMaterial.color.copy(color).lerp(new THREE.Color(0xffffff), 0.3);
    },
    setStage,
    setPointer(x, y) { pointer.set(x, y); },
    setScroll(progress) { scrollTarget = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0)); },
    scroll() { return scrollEased; },
    setHovered(next) { hovered = next; },
    setLeverHover(next) { leverHover = next; },
    setLeverDragging(next) { leverDragging = next; },
    setDomeHover(next) {
      if (next && !domeHover) jostle = Math.max(jostle, 0.45);
      domeHover = next;
    },
    tapDome() {
      jostle = Math.max(jostle, 1.25);
      // 한 알이 눈에 띄게 튀어 오른다 — 눌렀다는 대답이다.
      if (capsuleCount > 0) {
        const index = Math.floor(seeded(Math.floor(clock * 7), 181) * capsuleCount) % capsuleCount;
        capsules[index].velocity.y += 3.4;
        capsules[index].velocity.x += (seeded(index, 191) - 0.5) * 1.4;
      }
    },
    setLeverPull(fraction) { leverHeld = Math.max(0, Math.min(1, fraction)); },
    leverPull() { return leverValue; },
    startIntro() {
      if (reduced) { finishIntro(); return; }
      introTime = 0;
      introOn = true;
      applyIntro(0);
      // 이미 캡슐이 들어 있는 채로 연출을 다시 돌리면(검증이 네 프레임을 찍을 때)
      // 통을 한 번 비우고 투입구에서 다시 붓는다 — 등장 연출은 붓는 장면까지가 한 벌이다.
      if (capsuleCount > 0) {
        pourPending = true;
        pileHeld = true;
      }
    },
    skipIntro() { finishIntro(); },
    introRunning() { return introOn; },
    async loadModel(url) {
      emptyPrizeArt();
      try {
        const response = await fetch(url);
        if (!response.ok) return false;
        const buffer = await response.arrayBuffer();
        const loader = new GLTFLoader();
        // 우리 최적화가 EXT_meshopt_compression 을 쓰므로 디코더를 먼저 물려야 한다.
        loader.setMeshoptDecoder(MeshoptDecoder);
        const gltf = await loader.parseAsync(buffer, "");
        const model = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const longest = Math.max(size.x, size.y, size.z, 1e-4);
        model.position.set(-center.x, -center.y, -center.z);
        const wrapper = new THREE.Group();
        wrapper.add(model);
        // 무대가 화면 전체가 된 뒤로 카메라 앞 1.9 m 에서 보이는 높이는 1.16 m 다. 가장 긴
        // 변을 0.78 m 로 맞추면 상품이 잘리지 않고, 오른쪽 카드 옆에 선다.
        wrapper.scale.setScalar(0.78 / longest);
        model.traverse((node) => {
          const mesh = node as THREE.Mesh;
          if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = false; }
        });
        prizeArt.add(wrapper);
        prizeArtLoaded = true;
        return true;
      } catch {
        prizeArtLoaded = false;
        return false;
      }
    },
    async loadCard(url) {
      emptyPrizeArt();
      try {
        const texture = await new THREE.TextureLoader().loadAsync(url);
        texture.colorSpace = THREE.SRGBColorSpace;
        disposables.push(texture);
        const card = new THREE.Mesh(
          new RoundedBoxGeometry(1.05, 1.05, 0.045, 3, 0.03),
          [
            new THREE.MeshStandardMaterial({ color: 0x2a3050, roughness: 0.6 }),
            new THREE.MeshStandardMaterial({ color: 0x2a3050, roughness: 0.6 }),
            new THREE.MeshStandardMaterial({ color: 0x2a3050, roughness: 0.6 }),
            new THREE.MeshStandardMaterial({ color: 0x2a3050, roughness: 0.6 }),
            new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55 }),
            new THREE.MeshStandardMaterial({ color: 0x1b2038, roughness: 0.7 }),
          ],
        );
        card.castShadow = true;
        prizeArt.add(card);
        prizeArtLoaded = true;
        return true;
      } catch {
        prizeArtLoaded = false;
        return false;
      }
    },
    clearPrizeArt: emptyPrizeArt,
    frame,
    resize,
    points() {
      const leverWorld = leverKnob.getWorldPosition(new THREE.Vector3());
      const capsuleWorld = prize.group.getWorldPosition(new THREE.Vector3());
      const domeWorld = dome.getWorldPosition(new THREE.Vector3());
      return {
        lever: project(leverWorld, 0.19),
        capsule: project(capsuleWorld, CAPSULE_RADIUS * 1.9),
        dome: project(domeWorld, DOME_RADIUS),
      };
    },
    countDrawnPixels() {
      // 방금 그린 백버퍼를 그대로 읽는다. 같은 작업 단위 안이라 아직 지워지지 않았다.
      renderer.render(scene, camera);
      const gl = renderer.getContext();
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      // 화면 한가운데 한 조각만 읽는다. 큰 화면을 통째로 읽어 내리면 소프트웨어 렌더에서
      // 그리기가 몇 백 밀리초씩 멈추고, 그러다 그래픽 문맥이 통째로 날아간 적이 있다.
      const sampleWidth = Math.min(w, 384);
      const sampleHeight = Math.min(h, 384);
      const x = Math.max(0, Math.floor((w - sampleWidth) / 2));
      const y = Math.max(0, Math.floor((h - sampleHeight) / 2));
      const buffer = new Uint8Array(sampleWidth * sampleHeight * 4);
      gl.readPixels(x, y, sampleWidth, sampleHeight, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
      let drawn = 0;
      for (let index = 3; index < buffer.length; index += 4) {
        if (buffer[index] > 8) drawn += 1;
      }
      // 읽은 조각의 비율을 화면 전체로 되돌린다.
      return Math.round((drawn / (sampleWidth * sampleHeight)) * w * h);
    },
    cameraPosition() { return [camera.position.x, camera.position.y, camera.position.z] as [number, number, number]; },
    stats() {
      return { triangles: renderer.info.render.triangles, calls: renderer.info.render.calls };
    },
    dispose() {
      emptyPrizeArt();
      for (const item of disposables) item.dispose();
      environment.texture.dispose();
      pmrem.dispose();
      scene.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(material)) for (const one of material) one.dispose();
        else material?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
