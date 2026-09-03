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
  /**
   * 더해 그리는 빛 판(글로우 스프라이트)을 몇 할이나 켤지. 모바일은 절반이다 —
   * 반투명 판을 겹쳐 칠하는 것이 작은 기기에서 가장 비싼 일이라서.
   */
  glow: number;
  /** LED 띠가 0.3 Hz 로 숨 쉬는지. 모바일은 켜 두기만 하고 숨은 쉬지 않는다. */
  ledBreath: boolean;
};

// 2026-09-02 밤: 진짜 투과(transmission)는 장면을 한 번 더 그리면서 돔 안의 캡슐 반구를
// 빈 조개껍데기처럼 찍었다(카메라가 돔에 다가간 장면에서 뚜렷). 투과 없이 옅은 유리 +
// 반사 + 하이라이트 두 점으로 그리면 알이 온전하게 보이고 그리기도 한 번 줄어든다.
export const DESKTOP_QUALITY: Quality = { capsules: 40, dpr: 2, shadowMap: 1024, transmission: false, dust: 34, glow: 1, ledBreath: true };
export const MOBILE_QUALITY: Quality = { capsules: 24, dpr: 1.5, shadowMap: 512, transmission: false, dust: 20, glow: 0.5, ledBreath: false };

export type SceneStage = "idle" | "pull" | "shake" | "impact" | "capsule" | "wobble" | "burst" | "result";

export type CapsuleSpec = {
  /** 상품에서 잰 색. 등급 색에 이만큼 섞여 알마다 제 물건의 기색이 남는다. */
  color: string;
  /** 등급 색. 아래 반구의 바탕이고 이음 링은 그 색을 밝게 쓴다. */
  ring: string;
  /**
   * 그 상품의 미리보기 그림 주소(previewImageUrlOf). 알 안에 실제 물건이 서 있게 하는
   * 유일한 재료다 — 지어낸 아이콘은 쓰지 않는다. 없으면 알만 굴러다닌다.
   */
  preview?: string | null;
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
// 2026-09-03 10라운드: 0.63 이면 알 겉면이 0.762 까지 나가 유리(0.74)를 뚫고 나갔다.
// 유리 안쪽에서 알 반지름과 두께 1 cm 를 빼면 이 값이다.
const DOME_INNER = 0.59;
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
// 2026-09-03 10라운드: 마흔 알이 돔 높이의 절반에서 멈춰 "덜 찬 기계" 로 읽혔다.
// 알 수는 계약(quality.capsules 40)에 묶여 있으므로 반지름을 9.1% 키워(0.132 → 0.144)
// 부피를 32% 늘리고, 동시에 통 안쪽 반지름을 유리에 맞게 좁힌다. 둘을 합치면 마흔 알이
// 유리공 높이의 3분의 2까지 찬다.
const CAPSULE_RADIUS = 0.144;
/**
 * 쏟아져 들어오는 알이 "통 안" 으로 넘어가는 높이(돔 중심 위 0.42 m).
 *
 * 2026-09-03 11라운드: 예전에는 돔 중심에서 0.446 m 안에 들어와야 통에 들어온 것으로
 * 쳤다. 그런데 쏟아지는 동안 겹침 밀어내기가 알을 옆으로 밀어(반지름 0.51~0.57) 그
 * 작은 공을 아예 스치지 못하는 알이 마흔 중 여섯이나 나왔다. 그 알들은 유리 벽도
 * 바닥도 없는 채로 영원히 떨어져 몸통을 통째로 지나갔고, 알 겉면(중심 반지름 0.57 +
 * 0.176)이 앞판(z 0.628)보다 앞으로 나와 보라 도장 위에 떠 있는 것으로 찍혔다
 * (라이브 첫 화면, 영상 프레임 둘 다). 그래서 판정을 높이로 바꾼다 — 높이는 떨어지는
 * 동안 단조롭게 줄어들므로 이 문턱은 어떤 프레임 간격에서도 반드시 넘어간다.
 * 유리공 안쪽 꼭대기(2.62 + 0.59 = 3.21)보다 조금 낮게 두어, 옆으로 밀린 알이 잡힐 때
 * 벽으로 끌려 들어가는 거리가 6 cm 를 넘지 않는다.
 */
const DOME_ENTRY_Y = DOME_CENTER.y + 0.42;
/**
 * 배출구 안에 캡슐이 눕는 자리.
 * 2026-09-03: 배출구를 몸통 아래쪽(크롬 테 안쪽 y 0.58~0.98)으로 옮기면서 같이 내려왔다.
 * 알 반지름이 0.194 이므로 0.78 이면 위아래가 테 안에 딱 들어온다.
 */
const TRAY = new THREE.Vector3(0, 0.77, 0.53);
/**
 * 캡슐이 카메라 앞으로 떠오르는 자리 — 결과 상품도 같은 자리에 선다.
 * 카메라에서 2.3 만큼 떨어져 있어, 기계를 한 대 통째로 담느라 물러난 카메라에서도
 * 상품은 예전과 같은 크기로 보인다. 높이는 그 깊이에서의 화면 한가운데다.
 */
const STAGE_FRONT = new THREE.Vector3(0, 2.1, 4.5);

/** 공개 무대에서 상품이 서는, 카메라로부터의 거리(m). */
const PRIZE_DISTANCE = 1.9;
/**
 * 공개 무대에서 상품이 차지하는 화면 세로 비율.
 *
 * 2026-09-03 11라운드: 운영자가 "상품이 너무 크다 — 텍스처 판이 화면을 다 덮는다" 고
 * 했다. 그전에는 3D 모델의 가장 긴 변을 0.78 m, 카드를 1.05 m 로 못박아 두었는데,
 * 카메라 앞 1.9 m 에서 화면 세로가 담는 길이가 1.162 m(세로 화각 34°)이므로 카드는
 * 화면 세로의 90%, 모서리로 선 모델은 100%를 넘었다. 크기를 길이가 아니라 화면 비율로
 * 정하면 가로·세로 어느 화면에서도(390 포함) 같은 크기로 보인다 — 세로 화각은 화면
 * 비율과 무관하고, 상품은 늘 카메라에서 같은 거리에 서기 때문이다.
 * 모델은 바운딩 구 지름이, 카드는 판 높이가 이 비율이다.
 */
const PRIZE_SCREEN = { model: 0.45, card: 0.32 } as const;
/** 상품을 손으로 돌리는 감도(라디안/픽셀)와 위아래로 젖힐 수 있는 한계(35°). */
const PRIZE_DRAG = {
  yaw: 0.0075,
  pitch: 0.005,
  pitchLimit: (35 * Math.PI) / 180,
  /** 손을 뗀 순간 남는 속도의 몫과 그 속도가 잦아드는 빠르기. 미끄러짐은 20° 안쪽이다. */
  glide: 0.3,
  decay: 9,
} as const;

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
  { at: 0.7, position: [1.6, 1.62, 3.0], target: [0.3, 0.92, 0.4] },
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

const UI_FONT = "system-ui, -apple-system, 'Segoe UI', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";

/**
 * 사인판 위의 글자 — 흰 네온 CLUNK 와 그 아래 작은 보라색 부제 "에셋 뽑기 기계".
 *
 * 글자 하나를 세 번 겹쳐 칠한다: 넓게 번지는 후광, 좁고 진한 관, 그리고 한가운데의
 * 흰 심지. 이 세 겹이 발광 지도로 들어가면 평평한 흰 글씨가 아니라 불이 켜진 유리관이
 * 된다. 바탕은 투명이다 — 판(유광 검정)은 3D 로 따로 서 있고 글자만 그 위에 뜬다.
 * 외부 폰트 파일은 쓰지 않는다.
 */
function makeSignTexture(tube: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 176;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const x = canvas.width / 2;
    const y = 74;

    // 1) 넓은 후광 — 관 둘레의 공기가 물드는 부분. 흰 관이라도 번지는 빛은 보랏빛이다.
    ctx.font = `800 84px ${UI_FONT}`;
    ctx.shadowColor = tube;
    ctx.shadowBlur = 44;
    ctx.lineWidth = 16;
    ctx.strokeStyle = tube;
    ctx.strokeText("CLUNK", x, y);
    ctx.strokeText("CLUNK", x, y);

    // 2) 관 자체 — 좁고 흰데 아직 보랏빛 그림자를 달고 있다.
    ctx.shadowBlur = 15;
    ctx.lineWidth = 9;
    ctx.strokeStyle = "#f2ecff";
    ctx.strokeText("CLUNK", x, y);

    // 3) 심지 — 관 한가운데의 흰 선.
    ctx.shadowBlur = 7;
    ctx.shadowColor = "#ffffff";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("CLUNK", x, y);

    // 부제는 두지 않는다 — 간판은 CLUNK 하나가 시그니처다(운영자 결정 2026-09-03).
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * LED 띠 둘레에 번지는 빛 한 장 — 직사각형 테를 크게 흐린 것.
 *
 * 2026-09-03: 처음에는 둥근 번짐 판 한 장을 앞판 위에 통째로 얹었는데, 그것이 앞판
 * 전체에 보라색을 더해 짙은 보라 도장이 밝은 자홍으로 떠올랐다(운영자가 지적한
 * "저퀄리티 느낌" 의 절반이 이것이었다). 번지는 것은 띠 둘레뿐이어야 한다.
 */
function makeFrameGlowTexture(ratio: number, inset: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = Math.max(16, Math.round(256 * ratio));
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const w = canvas.width;
    const h = canvas.height;
    const m = Math.min(w, h) * inset;
    ctx.strokeStyle = "#ffffff";
    ctx.shadowColor = "#ffffff";
    for (const [blur, width, alpha] of [[26, 4, 0.5], [12, 3, 0.7], [4, 2, 1]] as const) {
      ctx.shadowBlur = blur;
      ctx.lineWidth = width;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.roundRect(m, m, w - m * 2, h - m * 2, Math.min(w, h) * 0.08);
      ctx.stroke();
    }
  }
  return new THREE.CanvasTexture(canvas);
}

/** 기계에 적히는 작은 글줄 한 장(투명 바탕). 동전판 안내와 받침의 이름판이 쓴다. */
function makeLabelTexture(text: string, color: string, weight: number, size: number, width = 1024): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.font = `${weight} ${size}px ${UI_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // 어두운 판 위의 밝은 글자 — 뒤에 어두운 후광을 한 겹 깔아 대비를 세운다.
    ctx.shadowColor = "#05030c";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#05030c";
    ctx.strokeText(text, width / 2, 50);
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.fillText(text, width / 2, 50);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * 모서리를 깎은 직사각형 테 하나. LED 띠와 배출구 크롬 테가 이것으로 만들어진다.
 *
 * 막대 넷을 세워 테를 만들면 모서리에서 네 번 겹친다(겹친 삼각형이 그대로 남는다).
 * 구멍 뚫린 도형 하나면 겹치는 자리가 아예 생기지 않고 그리기도 한 번이다.
 */
function ringShape(outerW: number, outerH: number, outerR: number, innerW: number, innerH: number, innerR: number): THREE.Shape {
  const rect = (w: number, h: number, r: number) => {
    const path = new THREE.Shape();
    const x = w / 2;
    const y = h / 2;
    const k = Math.min(r, x, y);
    path.moveTo(-x + k, -y);
    path.lineTo(x - k, -y);
    path.quadraticCurveTo(x, -y, x, -y + k);
    path.lineTo(x, y - k);
    path.quadraticCurveTo(x, y, x - k, y);
    path.lineTo(-x + k, y);
    path.quadraticCurveTo(-x, y, -x, y - k);
    path.lineTo(-x, -y + k);
    path.quadraticCurveTo(-x, -y, -x + k, -y);
    path.closePath();
    return path;
  };
  const shape = rect(outerW, outerH, outerR);
  shape.holes.push(rect(innerW, innerH, innerR) as unknown as THREE.Path);
  return shape;
}

/** 모서리를 깎은 직사각형 판 하나(구멍은 나중에 넣는다). */
function plateShape(w: number, h: number, r: number, cx = 0, cy = 0): THREE.Shape {
  const shape = new THREE.Shape();
  const x = w / 2;
  const y = h / 2;
  const k = Math.min(r, x, y);
  shape.moveTo(cx - x + k, cy - y);
  shape.lineTo(cx + x - k, cy - y);
  shape.quadraticCurveTo(cx + x, cy - y, cx + x, cy - y + k);
  shape.lineTo(cx + x, cy + y - k);
  shape.quadraticCurveTo(cx + x, cy + y, cx + x - k, cy + y);
  shape.lineTo(cx - x + k, cy + y);
  shape.quadraticCurveTo(cx - x, cy + y, cx - x, cy + y - k);
  shape.lineTo(cx - x, cy - y + k);
  shape.quadraticCurveTo(cx - x, cy - y, cx - x + k, cy - y);
  shape.closePath();
  return shape;
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

/* ---------------------------------------------------------------------------
   캡슐 안에 든 진짜 물건 — 상점의 미리보기 그림을 한 장짜리 아틀라스로 굽는다.
   ------------------------------------------------------------------------- */

/** 아틀라스 한 변의 칸 수와 칸 하나의 픽셀. 8×8 = 예순네 칸이면 마흔 알에 넉넉하다. */
const ATLAS_GRID = 8;
const ATLAS_CELL = 128;
/** 칸 테두리에 두는 빈 자리. 옆 칸 색이 번져 오는 것을 막는다. */
const ATLAS_PAD = 6;

/**
 * 밝고 고른 바탕을 지운다. 상점의 3D 미리보기는 거의 흰 바탕에 물건 하나가 놓인
 * 사진이라, 그대로 캡슐에 넣으면 유리알 안에 흰 카드가 든 것처럼 보인다. 네 귀퉁이가
 * 서로 같은 밝은 색일 때만 그 색을 투명으로 바꾼다 — 텍스처 상품처럼 화면 전체가
 * 무늬인 그림은 손대지 않는다(귀퉁이가 어둡거나 서로 다르다).
 */
function keyOutBackdrop(source: HTMLImageElement, size: number): HTMLCanvasElement | null {
  const work = document.createElement("canvas");
  work.width = size;
  work.height = size;
  const ctx = work.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, size, size);
  /**
   * 바탕을 지우지 못한 그림(텍스처처럼 화면 전체가 무늬인 것)은 둥글게 오려 낸다.
   * 알 안에 네모난 카드가 서 있으면 유리알이 아니라 액자로 읽힌다.
   */
  const roundOff = () => {
    ctx.globalCompositeOperation = "destination-in";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.47, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    return work;
  };
  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, size, size);
  } catch {
    // 다른 출처의 그림이면 읽을 수 없다. 지우지 않고 둥글게만 오린다.
    return roundOff();
  }
  const px = data.data;
  const at = (x: number, y: number) => {
    const index = (y * size + x) * 4;
    return [px[index], px[index + 1], px[index + 2]] as const;
  };
  const corners = [at(1, 1), at(size - 2, 1), at(1, size - 2), at(size - 2, size - 2)];
  const mean = [0, 1, 2].map((channel) => corners.reduce((sum, one) => sum + one[channel], 0) / 4);
  const luma = (mean[0] * 0.299 + mean[1] * 0.587 + mean[2] * 0.114) / 255;
  const spread = Math.max(...corners.map((one) => Math.hypot(one[0] - mean[0], one[1] - mean[1], one[2] - mean[2])));
  if (luma < 0.76 || spread > 24) return roundOff();
  const near = 30;
  const far = 52;
  for (let index = 0; index < px.length; index += 4) {
    const distance = Math.hypot(px[index] - mean[0], px[index + 1] - mean[1], px[index + 2] - mean[2]);
    if (distance <= near) px[index + 3] = 0;
    else if (distance < far) px[index + 3] = Math.round(px[index + 3] * ((distance - near) / (far - near)));
  }
  ctx.putImageData(data, 0, 0);
  return work;
}

type PreviewAtlas = {
  texture: THREE.CanvasTexture;
  /** 이 주소의 칸 번호. 처음 보는 주소면 그림을 받아 굽기 시작하고 번호를 미리 준다. */
  slot(url: string | null | undefined): number;
  /** 칸 번호 → 아틀라스 안의 (u, v, du, dv). */
  tile(slot: number, out: Float32Array, offset: number): void;
  dispose(): void;
};

function createPreviewAtlas(): PreviewAtlas {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_GRID * ATLAS_CELL;
  canvas.height = ATLAS_GRID * ATLAS_CELL;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // 밉맵을 만들면 멀리서 칸끼리 섞여 알 안이 잿빛 죽이 된다. 대신 선형 확대만 쓴다.
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const slots = new Map<string, number>();
  const pending = new Set<HTMLImageElement>();
  let next = 0;

  return {
    texture,
    slot(url) {
      if (!url) return -1;
      const known = slots.get(url);
      if (known !== undefined) return known;
      if (next >= ATLAS_GRID * ATLAS_GRID) return -1;
      const index = next;
      next += 1;
      slots.set(url, index);
      if (!ctx) return index;
      // fetch 를 쓰지 않는다 — 이 파일이 받아 오는 파일은 상품 GLB 하나뿐이라는 계약이 있다.
      const image = new Image();
      image.decoding = "async";
      pending.add(image);
      image.onload = () => {
        pending.delete(image);
        const inner = ATLAS_CELL - ATLAS_PAD * 2;
        const baked = keyOutBackdrop(image, inner);
        const x = (index % ATLAS_GRID) * ATLAS_CELL;
        const y = Math.floor(index / ATLAS_GRID) * ATLAS_CELL;
        ctx.clearRect(x, y, ATLAS_CELL, ATLAS_CELL);
        if (baked) ctx.drawImage(baked, x + ATLAS_PAD, y + ATLAS_PAD);
        texture.needsUpdate = true;
      };
      image.onerror = () => { pending.delete(image); };
      image.src = url;
      return index;
    },
    tile(slot, out, offset) {
      if (slot < 0) { out[offset] = 0; out[offset + 1] = 0; out[offset + 2] = 0; out[offset + 3] = 0; return; }
      const step = 1 / ATLAS_GRID;
      out[offset] = (slot % ATLAS_GRID) * step;
      // 캔버스는 위에서 아래로, UV 는 아래에서 위로 센다.
      out[offset + 1] = 1 - (Math.floor(slot / ATLAS_GRID) + 1) * step;
      out[offset + 2] = step;
      out[offset + 3] = step;
    },
    dispose() {
      for (const image of pending) image.src = "";
      pending.clear();
      texture.dispose();
    },
  };
}

/**
 * 유리에 테두리를 넣는다 — 스치듯 보이는 각도일수록 색이 짙어지고 불투명해진다(프레넬).
 *
 * 진짜 투과(transmission)는 장면을 한 번 더 그리면서 인스턴스 캡슐을 빈 껍데기로 찍었다.
 * 투과 없이 유리를 유리로 읽히게 하는 것은 결국 이 테두리 한 줄이다 — 가운데는 비어
 * 있고 가장자리만 빛나는 것이 유리공의 전부다.
 */
function addFresnelRim(
  material: THREE.MeshPhysicalMaterial,
  color: THREE.Color,
  strength: number,
  alphaLift: number,
  key: string,
  /**
   * 테두리가 얼마나 좁은지. 크면 실루엣에만 얇게 걸리고(유리공), 작으면 면 전체에
   * 넓게 퍼진다(알 뚜껑 — 뚜껑은 있다는 것이 보여야 해서 넓게 쓴다).
   */
  falloff = 4.5,
): { color: THREE.Color } {
  const uColor = { value: color };
  const uStrength = { value: strength };
  const uAlpha = { value: alphaLift };
  const uFalloff = { value: falloff };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = uColor;
    shader.uniforms.uRimStrength = uStrength;
    shader.uniforms.uRimAlpha = uAlpha;
    shader.uniforms.uRimFalloff = uFalloff;
    shader.fragmentShader = "uniform vec3 uRimColor;\nuniform float uRimStrength;\nuniform float uRimAlpha;\nuniform float uRimFalloff;\n"
      + shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n"
        + "  float gRim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), uRimFalloff);\n"
        + "  totalEmissiveRadiance += uRimColor * gRim * uRimStrength;\n"
        + "  diffuseColor.a = min(1.0, diffuseColor.a + gRim * uRimAlpha);",
      );
  };
  material.customProgramCacheKey = () => key;
  return { color: uColor.value };
}

/**
 * 돔 안에 쌓이는 캡슐 한 알. 메시가 아니라 숫자 묶음이다 — 실제로 그리는 것은
 * 인스턴스 메시 네 개(위 반구·아래 반구·이음 링·안에 든 물건)이고, 이 값들이 그
 * 행렬로 들어간다.
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
  { count: 11, inner: 0.24, outer: 0.44 },
  { count: 9, inner: 0.18, outer: 0.40 },
  { count: 8, inner: 0.12, outer: 0.34 },
  { count: 6, inner: 0.06, outer: 0.26 },
  { count: 4, inner: 0.0, outer: 0.17 },
  { count: 2, inner: 0.0, outer: 0.09 },
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
  scene.environmentIntensity = 0.3;

  /* 조명 — 키/필/림 두 점과 바닥 그림자 ------------------------------------ */
  // 하늘빛은 차갑고 바닥빛은 짙은 보라. 아무것도 안 비추는 자리가 회색이 아니라
  // 보랏빛 어둠이어야 무대 전체가 한 색으로 읽힌다.
  const ambient = new THREE.HemisphereLight(0xd6d0ff, 0x1a1030, 0.34);
  scene.add(ambient);

  // 키 라이트는 왼쪽 위에서 온다(운영자 참고 이미지). 오른쪽에서 오던 것을 옮겼다 —
  // 레버가 달린 오른쪽은 보라 림라이트가 맡고, 앞판의 밝은 면이 왼쪽 위에 생긴다.
  const key = new THREE.DirectionalLight(0xfff4e2, 1.6);
  key.position.set(-2.8, 7.6, 3.9);
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

  const fill = new THREE.DirectionalLight(0x9d8fd8, 0.72);
  fill.position.set(3.6, 2.2, 3.4);
  scene.add(fill);

  // 뒤 왼쪽의 보라 림라이트. 검정 모서리 기둥의 왼쪽 날을 어둠에서 떼어 놓는다.
  const rim = new THREE.DirectionalLight(0xa855f7, 2.4);
  rim.position.set(-3.4, 3.3, -4.2);
  scene.add(rim);

  // 뒤 오른쪽의 보라 림라이트. 레버 쪽 모서리와 크롬이 여기서 반짝인다.
  const rimWarm = new THREE.DirectionalLight(0xc084fc, 1.9);
  rimWarm.position.set(3.6, 2.7, -3.6);
  scene.add(rimWarm);

  // 돔 위를 천천히 도는 반짝임 한 점.
  const sweep = new THREE.PointLight(0xffffff, 1.9, 4.2, 2);
  sweep.position.set(0.7, 3.3, 0.7);
  scene.add(sweep);

  // 유리공 안을 밝히는 한 점. 어두운 가게에서는 이것이 없으면 캡슐이 유리에 묻힌다.
  const domeLight = new THREE.PointLight(0xfff3df, 3.4, 2.1, 2);
  domeLight.position.copy(DOME_CENTER);
  scene.add(domeLight);

  // 배출구의 캡슐을 은은하게 비추는 빛. 캡슐이 떨어진 뒤에만 켜진다.
  const trayLight = new THREE.PointLight(0xffffff, 0, 1.5, 2);
  trayLight.position.set(0, 0.82, 1.05);
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
   * 받침 밑에서 앞으로 새어 나오는 보라 띠. 기계가 바닥에 빛을 흘리고 있어야
   * 바닥에 놓인 물건으로 읽힌다(참고 이미지의 언더글로).
   */
  const underGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xa855f7,
    map: makeGlowTexture(0.22),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const underGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.5).rotateX(-Math.PI / 2), underGlowMaterial);
  underGlow.position.set(0, 0.03, 0.55);
  shop.add(underGlow);

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

  /* 색 한 벌 — 운영자가 보낸 참고 이미지의 값이다.
     짙은 보라 앞판(#3b1e6e)·더 짙은 옆면·검정 모서리 기둥·크롬·보라 LED. */
  // 2026-09-03 2라운드: #3b1e6e 를 그대로 칠했더니 스포트라이트와 림라이트를 지나 화면에서는
  // 밝은 자홍이 되었다. 참고 이미지의 값은 "화면에 나온 색" 이므로, 칠하는 색은 그보다 한참
  // 어두워야 한다 — 여기 값은 톤매핑을 통과한 뒤 #3b1e6e 근처에 도착하도록 고른 것이다.
  const PANEL_PURPLE = 0x1d0f38;
  const SIDE_PURPLE = 0x120825;
  const WELL_PURPLE = 0x0d0619;
  const CABINET_BLACK = 0x0a0a11;
  const LED_PURPLE = 0xa855f7;

  /**
   * 재질 — 몸통은 두 톤이다. 옆면은 거의 검정에 가까운 보라, 앞판은 한 단계 밝은
   * 짙은 보라이고 그 둘 사이를 검정 모서리 기둥이 가른다. 한 가지 색으로 칠한 상자는
   * 무슨 짓을 해도 장난감으로 읽힌다.
   *
   * 2026-09-03: 앞 판을 밝은 자홍으로 두었더니 운영자가 "저퀄리티 느낌" 이라고 했다.
   * 밝은 채도는 빛과 그림자가 실릴 자리를 남기지 않는다 — 짙게 깔고 clearcoat 한 겹의
   * 반사와 LED 로 밝기를 만든다.
   */
  const bodyPaint = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(SIDE_PURPLE),
    roughness: 0.38,
    metalness: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    envMapIntensity: 0.55,
  });
  // 앞판 — 참고 이미지의 #3b1e6e. 자동차 도장처럼 clearcoat 한 겹을 덮는다.
  const panelPaint = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(PANEL_PURPLE),
    roughness: 0.18,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.035,
    envMapIntensity: 0.8,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x090c17, roughness: 0.85, metalness: 0.1 });
  /** 모서리 기둥·사인판·동전판이 쓰는 유광 검정. 빛을 한 줄로 되쏘아야 검정이 산다. */
  const glossBlack = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(CABINET_BLACK),
    roughness: 0.22,
    metalness: 0.35,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 0.9,
  });
  /** 배출구 안쪽의 짙은 보라. 빛이 들어가 거의 안 나오는 자리. */
  /**
   * 2026-09-03 5라운드: 빛을 받는 재질로 두었더니 안쪽 벽이 조명을 그대로 받아
   * 회색 상자가 되었다(운영자가 싫어할 "빈 창문"). 우묵한 자리는 빛을 안 받아야 우묵하다 —
   * 빛 계산 없이 정해진 어두운 색만 칠한다.
   */
  const wellPurple = new THREE.MeshBasicMaterial({
    color: new THREE.Color(WELL_PURPLE),
    side: THREE.BackSide,
  });
  /**
   * LED 띠 — 재질 하나를 여러 띠가 나눠 쓴다. 밝기를 한 곳에서 올리고 내리기 위해서다.
   * 자체 발광이므로 빛을 받지 않는다(MeshBasicMaterial): 어두운 가게에서 LED 가
   * 조명에 따라 어두워지면 LED 가 아니다.
   */
  const ledMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(LED_PURPLE), toneMapped: false });
  /** LED 의 바탕색. 밝기는 이 색에 배수를 곱해 만든다(테마 색이 바뀌면 여기가 바뀐다). */
  const ledBase = new THREE.Color(LED_PURPLE);
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
    // 거칠수록 회색 플라스틱에 가까워진다. 크롬은 한 줄기 빛을 또렷하게 되쏘아야 크롬이다.
    roughness: 0.1,
    metalness: 1,
    envMapIntensity: 1.15,
  });
  const brushedTexture = makeBrushedTexture();
  const plinthMaterial = new THREE.MeshStandardMaterial({
    // 2026-09-03: 참고 이미지의 받침은 무광 검정이다. 브러시드 결은 거칠기 지도로만 남겨
    // 빛이 한 방향으로 흩어지게 한다 — 완전히 고른 검정은 플라스틱으로 읽힌다.
    color: 0x0d0d13,
    roughness: 0.72,
    roughnessMap: brushedTexture,
    metalness: 0.35,
    envMapIntensity: 0.5,
  });

  /** LED 띠 둘레에 번지는 빛. 띠 모양 그대로 번진다(가운데는 비어 있다). 모바일은 절반만 켠다. */
  const ledGlows: THREE.Mesh[] = [];
  /**
   * 띠 하나의 번짐. `frame` 이면 직사각형 테 모양으로, 아니면 부드러운 막대 하나로 번진다 —
   * 옆으로 누운 띠(받침·뚜껑)는 앞에서 보면 선 한 줄이므로 테 모양이면 허공에 네모가 뜬다.
   */
  function addLedGlow(width: number, height: number, x: number, y: number, z: number, frame: boolean, inset = 0.1): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(LED_PURPLE),
        map: frame ? makeFrameGlowTexture(height / width, inset) : makeGlowTexture(0.2),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    mesh.position.set(x, y, z);
    mesh.name = `glow-led-${ledGlows.length}`;
    mesh.renderOrder = 1;
    machine.add(mesh);
    ledGlows.push(mesh);
    return mesh;
  }

  /* 받침 — 무광 검정 굽, 크롬 테, 둘레를 도는 보라 LED, 그리고 이름판 --------- */
  const base = new THREE.Mesh(new RoundedBoxGeometry(1.88, 0.40, 1.32, 3, 0.05), plinthMaterial);
  base.position.set(0, 0.20, 0);
  base.name = "plinth";
  base.castShadow = true;
  base.receiveShadow = true;
  machine.add(base);
  /**
   * 굽 위의 크롬 테. 판이 아니라 테다 —
   * 2026-09-03 4라운드: 판으로 두었더니 몸통(1.66 폭)보다 훨씬 넓은 회색 접시가 되어
   * 기계가 그 위에 얹힌 장난감으로 보였다. 윗면은 무광 검정으로 두고 가장자리만 크롬이다.
   */
  const baseLip = new THREE.Mesh(
    new THREE.ExtrudeGeometry(ringShape(1.94, 1.38, 0.06, 1.84, 1.28, 0.05), { depth: 0.026, bevelEnabled: false, curveSegments: 3 })
      .rotateX(-Math.PI / 2),
    chromeMaterial,
  );
  baseLip.position.set(0, 0.402, 0);
  baseLip.name = "plinth-lip";
  baseLip.castShadow = true;
  machine.add(baseLip);
  // 받침 테를 한 바퀴 도는 LED. 막대 넷이 아니라 구멍 뚫린 테 하나라 모서리가 겹치지 않는다.
  const baseLed = new THREE.Mesh(
    new THREE.ExtrudeGeometry(ringShape(1.96, 1.40, 0.06, 1.92, 1.36, 0.05), { depth: 0.035, bevelEnabled: false, curveSegments: 3 })
      .rotateX(-Math.PI / 2),
    ledMaterial,
  );
  baseLed.position.set(0, 0.30, 0);
  baseLed.name = "led-base";
  machine.add(baseLed);
  addLedGlow(2.32, 0.32, 0, 0.318, 0.80, false);

  // 이름판 — 굽 앞면에 붙은 크롬 조각과 그 위에 새긴 CLUNK.
  const namePlate = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.095, 0.018, 2, 0.008), plinthMaterial);
  namePlate.position.set(0, 0.20, 0.678);
  namePlate.name = "nameplate";
  machine.add(namePlate);
  const nameTexture = makeLabelTexture("C L U N K", "#cfd6e6", 700, 44, 514);
  const nameLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.086),
    new THREE.MeshBasicMaterial({ map: nameTexture, transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false }),
  );
  nameLabel.position.set(0, 0.20, 0.690);
  nameLabel.name = "nameplate-text";
  machine.add(nameLabel);

  /* 몸통 — 배출구 구멍이 뚫린 상자 하나. 구멍이 도형에 들어 있어야 안이 실제로 비어 있다. */
  // 구멍은 배출되는 알(반지름 0.205)이 위아래로 여유 있게 지나가야 한다 — 0.48 은
  // 모따기를 빼고 나면 알 지름과 정확히 같아져서 알이 테두리를 스쳤다(2026-09-03 검사).
  const bodyShape = plateShape(1.59, 1.55, 0.13, 0, 1.25);
  bodyShape.holes.push(plateShape(0.84, 0.60, 0.04, 0, 0.77) as unknown as THREE.Path);
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(bodyShape, {
      depth: 1.09, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 1, curveSegments: 4, steps: 1,
    }),
    bodyPaint,
  );
  body.position.set(0, 0, -0.545);
  body.name = "cabinet";
  body.castShadow = true;
  body.receiveShadow = true;
  machine.add(body);

  // 네 모서리의 검정 팔각 기둥 — 참고 이미지의 "모서리를 깎은 검정 기둥".
  // 앞의 두 개가 보라 앞판을 액자처럼 가둔다.
  for (const [x, z] of [[-0.80, 0.545], [0.80, 0.545], [-0.80, -0.545], [0.80, -0.545]] as const) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 1.54, 8), glossBlack);
    post.rotation.y = Math.PI / 8;
    post.position.set(x, 1.25, z);
    post.name = `corner-post-${x > 0 ? "r" : "l"}${z > 0 ? "f" : "b"}`;
    post.castShadow = true;
    machine.add(post);
  }

  /* 앞판 — 짙은 보라 도장 한 겹. 배출구 자리는 뚫려 있다. */
  const frontPanel = new THREE.Mesh(
    new THREE.ExtrudeGeometry(plateShape(1.44, 0.88, 0.06, 0, 1.50), { depth: 0.042, bevelEnabled: false, curveSegments: 4 }),
    panelPaint,
  );
  frontPanel.position.set(0, 0, 0.586);
  frontPanel.name = "front-panel";
  frontPanel.castShadow = true;
  machine.add(frontPanel);

  // 앞판을 한 바퀴 도는 보라 LED 띠(두께 없는 테 하나)와 그 둘레의 번짐.
  const panelLed = new THREE.Mesh(
    new THREE.ShapeGeometry(ringShape(1.40, 0.84, 0.05, 1.345, 0.785, 0.045), 4),
    ledMaterial,
  );
  panelLed.position.set(0, 1.50, 0.631);
  panelLed.name = "led-panel";
  machine.add(panelLed);
  addLedGlow(1.60, 1.04, 0, 1.50, 0.634, true, 0.055);

  // 리벳 여섯 — 앞판 좌우에 세 쌍. 빛을 한 점씩 되쏜다.
  for (const [x, y] of [[-0.60, 1.84], [0.60, 1.84], [-0.60, 1.50], [0.60, 1.50], [-0.60, 1.16], [0.60, 1.16]] as const) {
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), chromeMaterial);
    rivet.rotation.x = Math.PI / 2;
    rivet.position.set(x, y, 0.629);
    rivet.name = `rivet-${x > 0 ? "r" : "l"}-${y.toFixed(2)}`;
    machine.add(rivet);
  }

  /* CLUNK 네온 사인 ---------------------------------------------------------
     유광 검정 판 위에 흰 네온관 글자가 뜨고 그 밑에 작은 보라색 부제가 붙는다.
     판보다 앞, 글자보다 뒤에서 같은 색 후광이 더해진다. */
  const signTexture = makeSignTexture("#b78bff");
  const signMaterial = new THREE.MeshBasicMaterial({
    map: signTexture,
    transparent: true,
    // 네온은 빛이다 — 더해 그려야 검정 판 위에서 관이 타오른다.
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const signFrame = new THREE.Mesh(new RoundedBoxGeometry(1.10, 0.30, 0.028, 2, 0.025), glossBlack);
  signFrame.position.set(0, 1.77, 0.648);
  signFrame.name = "sign-plate";
  machine.add(signFrame);
  // 관 둘레에 번지는 빛. 판보다 앞, 글자보다 뒤에 더해 그린다.
  const signGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xa06bff,
    map: makeGlowTexture(0.28),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  // 0.62 로 두면 아래 테두리가 크레딧 링(y 1.494)과 0.9 mm 로 맞물려 z 싸움 위험이 된다.
  const signGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 0.48), signGlowMaterial);
  signGlow.position.set(0, 1.77, 0.672);
  signGlow.name = "glow-sign";
  signGlow.renderOrder = 2;
  machine.add(signGlow);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 0.26), signMaterial);
  sign.position.set(0, 1.77, 0.677);
  sign.name = "sign-text";
  sign.renderOrder = 3;
  machine.add(sign);

  /* 동전판 — 유광 검정판에 진짜 뚫린 가로 홈과 둥근 단추 ------------------- */
  // 홈 뒤에 깔리는 어두운 바닥. 앞판보다 앞, 뚫린 판보다 뒤에 있어 홈이 깊어 보인다.
  const coinBack = new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.20, 0.020, 2, 0.015), recessMaterial);
  coinBack.position.set(0, 1.42, 0.643);
  coinBack.name = "coin-recess";
  machine.add(coinBack);
  // 판 자체에 홈과 단추 구멍이 뚫려 있다 — 앞에 덧붙인 검은 막대가 아니라 진짜 구멍이다.
  const coinShape = plateShape(0.86, 0.20, 0.03);
  coinShape.holes.push(plateShape(0.30, 0.036, 0.014, -0.16, 0) as unknown as THREE.Path);
  const buttonHole = new THREE.Path();
  buttonHole.absarc(0.24, 0, 0.078, 0, Math.PI * 2, true);
  coinShape.holes.push(buttonHole);
  const coinPlate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(coinShape, { depth: 0.022, bevelEnabled: false, curveSegments: 6 }),
    glossBlack,
  );
  coinPlate.position.set(0, 1.42, 0.658);
  coinPlate.name = "coin-plate";
  coinPlate.castShadow = true;
  machine.add(coinPlate);
  // 구멍 안에 앉은 크롬 단추.
  const coinButton = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.026, 20), chromeMaterial);
  coinButton.rotation.x = Math.PI / 2;
  coinButton.position.set(0.24, 1.42, 0.669);
  coinButton.name = "coin-button";
  machine.add(coinButton);
  /**
   * 크레딧 자리를 알리는 보라 발광 링. 2026-09-03 10라운드: 밑에 적은 글줄은 첫 화면
   * (기계가 화면 높이의 90%)에서 5 px 밖에 안 되어 어떤 크기로 키워도 뭉갠다 — 글자
   * 대신 빛나는 고리 하나가 "여기에 넣는다" 를 말한다. 글줄은 다가갔을 때 읽히는 보조다.
   */
  const coinRing = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.008, 6, 24), ledMaterial);
  coinRing.position.set(0.24, 1.42, 0.666);
  coinRing.name = "coin-ring";
  machine.add(coinRing);
  addLedGlow(0.34, 0.34, 0.24, 1.42, 0.672, false);
  // 안내 한 줄. 기계에 적힌 글자는 작아야 기계가 커 보인다.
  // 캔버스와 판의 가로세로가 어긋나면 글자가 옆으로 늘어나 뭉갠다. 둘 다 10.6:1 로 맞추고
  // 글자를 1.6배로 키운다(34 → 54 px, 판 높이 0.045 → 0.072).
  // 동전판 글줄은 두지 않는다 — 슬롯과 크레딧 링만으로 읽힌다(운영자 결정 2026-09-03).

  /* 당기는 레버 — 기계 오른쪽 옆면 -----------------------------------------
     받침(옆면에 붙는 원판) + 축(세로 막대) + 둥근 손잡이. 손잡이를 아래로 당기면
     축이 앞쪽 아래로 넘어갔다가 스프링처럼 튕겨 올라온다. 돌리는 것이 아니라
     당기는 것이다. */
  const leverMount = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.155, 0.085, 20), glossBlack);
  leverMount.rotation.z = Math.PI / 2;
  leverMount.position.set(0.9, 1.6, 0.02);
  leverMount.name = "lever-mount";
  leverMount.castShadow = true;
  machine.add(leverMount);
  const leverBoss = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.12, 16), chromeMaterial);
  leverBoss.rotation.z = Math.PI / 2;
  leverBoss.position.set(1.005, 1.6, 0.02);
  leverBoss.name = "lever-boss";
  leverBoss.castShadow = true;
  machine.add(leverBoss);

  // 축이 도는 자리. rotation.x 를 키우면 손잡이가 앞쪽 아래로 내려온다.
  const lever = new THREE.Group();
  // 2026-09-03 4라운드: 축이 1.13 에 서 있어 옆에서 보면 팔이 허브 옆 허공에서 시작했다.
  // 팔은 허브 안에서 나와야 한 물건이다.
  lever.position.set(1.055, 1.6, 0.02);
  lever.name = "lever";
  machine.add(lever);
  // 검정 팔 + 크롬 축 + 빛나는 보라 공. 한 가지 재질로 된 막대는 젓가락으로 읽힌다.
  const leverArm = new THREE.Mesh(new THREE.CylinderGeometry(0.050, 0.062, 0.34, 14), glossBlack);
  leverArm.position.y = 0.17;
  leverArm.name = "lever-arm";
  leverArm.castShadow = true;
  lever.add(leverArm);
  // 2026-09-03 1라운드: 축이 0.48 에서 끝나고 공이 0.54 에서 시작해 공이 허공에 떠 있었다.
  // 축은 공 안까지 들어가 있어야 하나의 물건이 된다.
  const leverShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.34, 12), chromeMaterial);
  leverShaft.position.y = 0.44;
  leverShaft.name = "lever-shaft";
  leverShaft.castShadow = true;
  lever.add(leverShaft);
  const leverKnobMaterial = new THREE.MeshPhysicalMaterial({
    color: accent.clone(),
    roughness: 0.12,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    // 방 반사를 그대로 받으면 공에 흰 얼룩이 점점이 박혀 때 탄 플라스틱이 된다.
    envMapIntensity: 0.35,
    emissive: accent.clone(),
    emissiveIntensity: 0.7,
  });
  const leverKnob = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 12), leverKnobMaterial);
  leverKnob.position.y = 0.665;
  leverKnob.name = "lever-knob";
  leverKnob.castShadow = true;
  lever.add(leverKnob);
  // 손잡이 둘레의 빛. 늘 카메라를 향한다(프레임마다 방향을 고쳐 준다).
  const knobGlowMaterial = new THREE.MeshBasicMaterial({
    color: accent.clone(),
    map: makeGlowTexture(0.3),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const knobGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), knobGlowMaterial);
  knobGlow.name = "glow-lever-knob";
  knobGlow.position.y = 0.665;
  knobGlow.renderOrder = 2;
  lever.add(knobGlow);

  /* 배출구 — 크롬 테, 짙은 보라 우묵한 통, 바닥에 어린 보라빛, 경첩 문 ------- */
  // 통은 안쪽 면만 그린다(BackSide). 앞이 뚫린 상자가 되어 몸통의 구멍을 그대로 잇는다.
  // 통은 구멍보다 커야 한다 — 작으면 구멍의 밝은 안쪽 벽이 테두리로 드러나 회색 상자가 된다.
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.70, 0.36), wellPurple);
  mouth.position.set(0, 0.77, 0.38);
  mouth.name = "tray-well";
  machine.add(mouth);
  // 통 바닥에 어린 옅은 보라. 캡슐이 없어도 배출구가 죽은 구멍으로 보이지 않는다.
  const trayGlowMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(LED_PURPLE),
    map: makeGlowTexture(0.4),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const trayGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.30).rotateX(-Math.PI / 2), trayGlowMaterial);
  trayGlow.name = "glow-tray-floor";
  trayGlow.position.set(0, 0.428, 0.36);
  machine.add(trayGlow);

  const flapHinge = new THREE.Group();
  flapHinge.position.set(0, 1.00, 0.60);
  machine.add(flapHinge);
  // 문 자체가 창이다 — 안이 비쳐야 캡슐이 떨어지는 것이 보인다.
  const flap = new THREE.Mesh(
    new RoundedBoxGeometry(0.70, 0.44, 0.026, 2, 0.015),
    new THREE.MeshPhysicalMaterial({
      color: 0x9a86d8,
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      // 2026-09-03 3라운드: 0.22 는 배출구를 회색 유리판으로 덮어 안이 안 보였다.
      opacity: 0.09,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 0.7,
      depthWrite: false,
    }),
  );
  flap.position.set(0, -0.21, 0);
  flap.name = "tray-flap";
  flapHinge.add(flap);
  // 창을 두른 크롬 테 — 막대 넷이 아니라 구멍 뚫린 테 하나다(모서리가 겹치지 않는다).
  const trayFrame = new THREE.Mesh(
    // 2026-09-03 10라운드: 폭을 15% 줄이고 테 두께를 절반(가로 27.5 mm, 세로 30 mm)으로.
    // 앞면을 가로지르던 큰 회색 사각형이 배출구 크기의 테가 된다.
    new THREE.ExtrudeGeometry(ringShape(0.82, 0.585, 0.03, 0.765, 0.525, 0.022), {
      depth: 0.022, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1, curveSegments: 3,
    }),
    chromeMaterial,
  );
  // 0.639 는 모따기가 시작하는 자리가 앞판 LED 띠(z 0.631)와 정확히 같은 면이 되어
  // z 싸움 위험으로 잡혔다(2026-09-03 검사). 7 mm 앞으로 뺀다.
  trayFrame.position.set(0, 0.77, 0.646);
  trayFrame.name = "tray-frame";
  trayFrame.castShadow = true;
  machine.add(trayFrame);

  // 목 — 돔이 앉는 검정 고리. 몸통 위에서 좁아지며 유리공을 받는다.
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.545, 0.63, 0.20, 26), bodyPaint);
  collar.position.set(0, 2.11, 0);
  collar.name = "collar";
  collar.castShadow = true;
  machine.add(collar);
  // 유리공이 앉는 크롬 립. 목보다 굵으면 접시 위의 구슬로 읽힌다 — 딱 목 끝에 두른다.
  // 2026-09-03 검사: 0.563 반지름으로 목 끝에 두었더니 링이 유리공 안쪽(그 높이의 유리
  // 반지름 0.617)에 통째로 잠겼다 — 유리 너머로 비치는 띠가 되었다. 유리 테두리 바로
  // 위, 목보다 조금 바깥에 두른다.
  const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.632, 0.021, 6, 28), chromeMaterial);
  collarRing.rotation.x = Math.PI / 2;
  collarRing.position.set(0, 2.09, 0);
  collarRing.name = "collar-ring";
  collarRing.castShadow = true;
  machine.add(collarRing);
  // 돔 바닥과 캡슐이 빠지는 구멍
  // 구멍은 배출되는 알(반지름 0.205)보다 넓어야 한다 — 좁으면 알이 접시를 뚫고 내려간다.
  const domeFloor = new THREE.Mesh(new THREE.RingGeometry(0.27, 0.66, 32).rotateX(-Math.PI / 2), recessMaterial);
  domeFloor.position.set(0, DOME_FLOOR, 0);
  domeFloor.name = "dome-floor";
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
      // 아주 옅은 보랏빛 유리. 파랗게 두면 보라 기계 위에 얹힌 다른 물건으로 읽힌다.
      color: 0xd8ccff,
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      // 옅은 유리. 너무 옅으면 유리공이 아예 안 보이고, 짙게 두면 안의 캡슐이 우유에 잠긴다.
      // 2026-09-03: 0.3 은 돔을 우윳빛 덩어리로 만들었다 — 안에 든 물건이 상품인데 그것이
      // 안 보이면 이 화면은 아무 말도 하지 않는다. 옅게 깔고 테두리(프레넬)로 형태를 세운다.
      opacity: 0.06,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 0.6,
      side: THREE.FrontSide,
      depthWrite: false,
    });
  /**
   * 유리 테두리(프레넬) — 스치듯 보이는 각도일수록 보랏빛이 짙어진다.
   * 진짜 투과 없이 유리를 유리로 읽히게 하는 것은 이 한 줄의 테두리다.
   */
  const glassRim = addFresnelRim(glassMaterial, new THREE.Color(0x9b6bff), 1.05, 0.42, "gacha-glass-rim");
  // 적도보다 조금 더 내려온 유리공. 바닥(구멍이 뚫린 접시)이 그 안에 들어가고,
  // 꼭대기는 캡슐을 붓는 투입구만큼 비어 있다.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(DOME_RADIUS, 40, 24, 0, Math.PI * 2, HATCH_PHI, Math.PI * 0.76 - HATCH_PHI),
    glassMaterial,
  );
  dome.position.copy(DOME_CENTER);
  dome.name = "dome-glass";
  dome.renderOrder = 2;
  machine.add(dome);

  // 투입구 — 유리공 꼭대기에 얹힌 크롬 뚜껑, 그 테를 도는 보라 LED, 작은 손잡이.
  // 캡슐은 이 뚜껑 아래 구멍으로 들어온다.
  const hatchRing = new THREE.Mesh(new THREE.TorusGeometry(HATCH_RADIUS + 0.015, 0.028, 8, 26), chromeMaterial);
  hatchRing.rotation.x = Math.PI / 2;
  hatchRing.position.set(0, HATCH_Y, 0);
  hatchRing.name = "hatch-ring";
  machine.add(hatchRing);
  const funnel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, HATCH_RADIUS + 0.024, 0.13, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x9aa4bc, roughness: 0.18, metalness: 1, envMapIntensity: 1.2, side: THREE.DoubleSide }),
  );
  funnel.position.set(0, HATCH_Y + 0.065, 0);
  funnel.name = "cap";
  machine.add(funnel);
  const capLed = new THREE.Mesh(new THREE.TorusGeometry(0.325, 0.018, 6, 26), ledMaterial);
  capLed.rotation.x = Math.PI / 2;
  capLed.position.set(0, HATCH_Y + 0.158, 0);
  capLed.name = "led-cap";
  machine.add(capLed);
  addLedGlow(0.88, 0.26, 0, HATCH_Y + 0.158, 0.05, false);
  const lidStem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 10), chromeMaterial);
  lidStem.position.set(0, HATCH_Y + 0.08, 0);
  lidStem.name = "lid-stem";
  machine.add(lidStem);
  const lidKnob = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 10), chromeMaterial);
  lidKnob.position.set(0, HATCH_Y + 0.21, 0);
  lidKnob.name = "lid-knob";
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
  const highlightSoft = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.36), highlightSoftMaterial);
  highlightSoft.name = "glow-dome-soft";
  highlight.add(highlightSoft);
  const highlightHardMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: makeGlowTexture(0.72),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const highlightHard = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.13), highlightHardMaterial);
  highlightHard.name = "glow-dome-hard";
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
  glint.name = "glow-dome-streak";
  glint.rotation.z = 0.42;
  highlight.add(glint);

  /* 캡슐 -------------------------------------------------------------------
     알마다 메시 세 개를 두면 마흔 알에 그리기가 120회다. 인스턴스 메시 세 개로
     묶어 세 번에 그린다. 링은 기하를 미리 눕혀 두어 세 벌이 같은 행렬을 쓴다. */
  // 알을 키운 만큼 면은 줄인다 — 화면에서 알 하나는 지름 40~90 px 이라 세로 일곱 줄이면
  // 실루엣이 이미 둥글다. 위 반구만 조금 더 촘촘하다(빛이 여기서 맺힌다).
  const capsuleGeometryTop = new THREE.SphereGeometry(CAPSULE_RADIUS, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
  const capsuleGeometryBottom = new THREE.SphereGeometry(CAPSULE_RADIUS, 14, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const capsuleGeometryRing = new THREE.TorusGeometry(CAPSULE_RADIUS * 0.985, CAPSULE_RADIUS * 0.085, 4, 12)
    .rotateX(Math.PI / 2);
  // 반구는 양면으로 그린다 — 투과 패스가 절반 해상도로 다시 그릴 때 한 면만 있는
  // 반구는 안쪽이 뚫린 조개껍데기처럼 찍혔다(2026-09-02 밤, 카메라가 돔에 다가간 장면).
  /** 아래 반구 — 등급 색으로 칠한 불투명 플라스틱. 통을 보면 등급이 한눈에 읽힌다. */
  const creamMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.2,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 0.75,
    side: THREE.DoubleSide,
  });
  /**
   * 위 반구 — 맑은 유리 뚜껑. 안에 든 물건이 보여야 이 화면이 말이 된다.
   *
   * 2026-09-03 1라운드: 옅게(0.3) 깔고 깊이를 끄자 알이 "뚜껑 없는 그릇" 이 되었다 —
   * 아래 반구의 안쪽이 그대로 보였다. 깊이를 쓰고(같은 인스턴스 안에서도 깊이 검사는
   * 제대로 돈다) 테두리를 세우니 비로소 닫힌 유리알이 된다.
   */
  const capsuleTopMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd9ceff,
    roughness: 0.02,
    metalness: 0,
    transparent: true,
    // 2026-09-03 10라운드: 0.24 + 좁은 테두리(지수 4.5)로는 윗반구가 거의 안 보여
    // 알이 "스티커 붙은 그릇" 으로 읽혔다. 조금 짙게 깔고 테두리를 넓게 쓴다.
    opacity: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.015,
    // 방 반사가 뚜껑 위쪽에 밝은 점 하나로 맺힌다 — 유리는 이 한 점으로 유리가 된다.
    envMapIntensity: 1.5,
    side: THREE.FrontSide,
  });
  addFresnelRim(capsuleTopMaterial, new THREE.Color(0xc4aeff), 0.85, 0.4, "gacha-capsule-glass", 2.2);
  // 이음 링은 크롬 — 회색 고무줄이 아니라 빛을 되쏘는 금속 띠여야 알이 알로 읽힌다.
  const capsuleRingMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.18,
    metalness: 0.95,
    envMapIntensity: 1.2,
  });

  const MAX_CAPSULES = Math.max(1, quality.capsules);
  const pile = new THREE.Group();
  pile.name = "capsule-pile";
  machine.add(pile);

  /* 알 안에 선 진짜 상품 -----------------------------------------------------
     상점의 미리보기 그림을 한 장짜리 아틀라스에 굽고, 알마다 제 칸을 본다.
     알마다 스프라이트를 하나씩 두면 그리기가 마흔 번 는다 — 인스턴스 하나로 묶어
     한 번에 그리고, 칸 번호만 알마다 다른 속성으로 넣는다. */
  const atlas = createPreviewAtlas();
  const artGeometry = new THREE.PlaneGeometry(1, 1);
  const artTiles = new Float32Array(MAX_CAPSULES * 4);
  artGeometry.setAttribute("aTile", new THREE.InstancedBufferAttribute(artTiles, 4));
  const capsuleArtMaterial = new THREE.MeshBasicMaterial({
    map: atlas.texture,
    // 잘라 내기(알파 컷) — 반투명이 아니라 있고 없고다. 정렬 문제가 생기지 않는다.
    alphaTest: 0.42,
    side: THREE.DoubleSide,
  });
  capsuleArtMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = "attribute vec4 aTile;\nvarying vec2 vTile;\n" + shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n  vTile = aTile.xy + uv * aTile.zw;",
    );
    shader.fragmentShader = "varying vec2 vTile;\n" + shader.fragmentShader.replace(
      "#include <map_fragment>",
      "  diffuseColor *= texture2D( map, vTile );",
    );
  };
  capsuleArtMaterial.customProgramCacheKey = () => "gacha-capsule-art";

  const capsuleTops = new THREE.InstancedMesh(capsuleGeometryTop, capsuleTopMaterial, MAX_CAPSULES);
  const capsuleBottoms = new THREE.InstancedMesh(capsuleGeometryBottom, creamMaterial, MAX_CAPSULES);
  const capsuleRings = new THREE.InstancedMesh(capsuleGeometryRing, capsuleRingMaterial, MAX_CAPSULES);
  const capsuleArt = new THREE.InstancedMesh(artGeometry, capsuleArtMaterial, MAX_CAPSULES);
  for (const mesh of [capsuleTops, capsuleBottoms, capsuleRings, capsuleArt]) {
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    pile.add(mesh);
  }
  capsuleBottoms.castShadow = true;
  capsuleRings.castShadow = true;
  // 유리와 그림은 그림자를 만들지 않는다 — 알 하나에 그림자가 세 겹이면 더미가 검게 죽는다.
  capsuleTops.renderOrder = 5;

  const capsules: Capsule[] = Array.from({ length: MAX_CAPSULES }, (_unused, index) => ({
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    spin: new THREE.Vector3(seeded(index, 7) - 0.5, seeded(index, 11) - 0.5, seeded(index, 13) - 0.5),
    // 맑은 뚜껑이 위를 보게 앉힌다. 좌우로만 자유롭게 돌고 앞뒤로는 조금만 기운다 —
    // 아무렇게나 굴려 두면 절반이 색깔 반구를 카메라에 보여 주고, 그러면 통 안에 무엇이
    // 들었는지 읽히지 않는다(2026-09-03 3라운드에 실제로 그렇게 나왔다).
    rotation: new THREE.Euler((seeded(index, 17) - 0.5) * 0.7, seeded(index, 19) * 6.28, (seeded(index, 23) - 0.5) * 0.7),
    // 세 가지 크기. 한 가지 크기로 채운 통은 알갱이가 아니라 거품처럼 보인다.
    scale: [0.86, 1, 1.15][Math.floor(seeded(index, 31) * 3) % 3],
    entering: false,
  }));
  /** 지금 몇 알이 통에 들어 있는지. 인스턴스는 앞에서부터 차례로 쓴다. */
  let capsuleCount = 0;

  const matrixScratch = new THREE.Matrix4();
  const quaternionScratch = new THREE.Quaternion();
  const billboardScratch = new THREE.Quaternion();
  const scaleScratch = new THREE.Vector3();
  /** 알을 유리 안으로 도로 넣을 때 쓰는 임시 벡터. 매 프레임 마흔 번 도니 새로 만들지 않는다. */
  const confineScratch = new THREE.Vector3();

  function ensureCapsules(count: number): void {
    capsuleCount = Math.max(0, Math.min(MAX_CAPSULES, count));
    capsuleTops.count = capsuleCount;
    capsuleBottoms.count = capsuleCount;
    capsuleRings.count = capsuleCount;
    capsuleArt.count = capsuleCount;
  }

  /** 알 안의 그림 크기 — 알 지름의 7할. 그보다 크면 유리에 닿아 붙은 스티커로 읽힌다. */
  const ART_SIZE = CAPSULE_RADIUS * 2 * 0.7;
  /**
   * 그림을 알 가운데보다 조금 위에 세운다.
   * 2026-09-03 2라운드: 가운데에 두었더니 아래 반구(불투명)가 그림의 아랫도리를 가려
   * 물건이 허리부터 잘려 보였다. 맑은 뚜껑 쪽으로 올려야 물건 하나가 통째로 선다.
   */
  const ART_LIFT = CAPSULE_RADIUS * 0.26;
  const artMatrix = new THREE.Matrix4();
  const artScale = new THREE.Vector3();
  const artLift = new THREE.Vector3();

  /**
   * 지금 값들을 인스턴스 행렬에 옮겨 적는다. 한 프레임에 한 번.
   * 알 안의 그림만 알과 같이 구르지 않고 늘 카메라를 마주 본다 — 어느 각도에서 봐도
   * 무엇이 들었는지 읽혀야 하기 때문이다.
   */
  function writeCapsuleInstances(): void {
    for (let index = 0; index < capsuleCount; index += 1) {
      const capsule = capsules[index];
      quaternionScratch.setFromEuler(capsule.rotation);
      scaleScratch.setScalar(capsule.scale);
      matrixScratch.compose(capsule.position, quaternionScratch, scaleScratch);
      capsuleTops.setMatrixAt(index, matrixScratch);
      capsuleBottoms.setMatrixAt(index, matrixScratch);
      capsuleRings.setMatrixAt(index, matrixScratch);
      artScale.setScalar(ART_SIZE * capsule.scale);
      artLift.set(capsule.position.x, capsule.position.y + ART_LIFT * capsule.scale, capsule.position.z);
      artMatrix.compose(artLift, camera.quaternion, artScale);
      capsuleArt.setMatrixAt(index, artMatrix);
    }
    capsuleTops.instanceMatrix.needsUpdate = true;
    capsuleBottoms.instanceMatrix.needsUpdate = true;
    capsuleRings.instanceMatrix.needsUpdate = true;
    capsuleArt.instanceMatrix.needsUpdate = true;
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
    capsule.rotation.set((seeded(index, 17) - 0.5) * 0.7, seeded(index, 19) * 6.28, (seeded(index, 23) - 0.5) * 0.7);
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
   * 알마다 색을 칠하고 안에 세울 물건을 정한다.
   *
   * 2026-09-03: 위 반구를 맑은 유리로 바꾸면서 등급 색이 아래 반구로 내려왔다 —
   * 통을 보면 어떤 등급이 얼마나 들었는지는 그대로 읽히고, 그 위로 상품이 보인다.
   * 아래 반구에는 그 상품에서 잰 색이 조금 섞여 알마다 제 물건의 기색이 남는다.
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

    // 아래 반구가 등급 색이다. C 등급의 잿빛도 채도를 조금 올려야 회색 덩어리로 죽지 않는다.
    const shell = grade.clone().lerp(measured, 0.2);
    const hsl = { h: 0, s: 0, l: 0 };
    shell.getHSL(hsl);
    // 2026-09-03 3라운드: 채도를 올렸더니 노랑·파랑·자홍 사탕이 되었다. 등급은 읽히되
    // 한 벌로 보여야 한다 — 채도를 오히려 눌러 짙은 플라스틱 색으로 내린다.
    shell.setHSL(hsl.h, Math.min(0.78, hsl.s * 0.9 + 0.08), Math.min(0.4, Math.max(0.2, hsl.l * 0.58)));
    capsuleBottoms.setColorAt(index, shell.multiplyScalar(0.7 + shade * 0.3));
    // 유리 뚜껑은 알마다 같다 — 아주 옅게 뒤쪽 알만 어둡게 둔다.
    capsuleTops.setColorAt(index, new THREE.Color(0xd9ceff).multiplyScalar(0.78 + shade * 0.22));
    capsuleRings.setColorAt(index, new THREE.Color(0xc8d0e0).multiplyScalar(0.66 + shade * 0.34));

    // 알 안에 설 물건 — 그 상품의 미리보기 그림 그대로다.
    atlas.tile(atlas.slot(spec.preview), artTiles, index * 4);
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
    color: 0xd9ceff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.42,
    clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.1,
  });
  addFresnelRim(prizeTopMaterial, new THREE.Color(0xbba0ff), 0.9, 0.5, "gacha-prize-glass");
  /** 배출된 알의 아래 반구 — 통 안의 알과 같은 등급 색이어야 같은 물건으로 읽힌다. */
  const prizeBottomMaterial = creamMaterial.clone();
  const prizeRingMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.5, emissive: 0x000000 });
  const prize = { group: new THREE.Group(), top: prizeTopMaterial, ring: prizeRingMaterial };
  const prizeTopMesh = new THREE.Mesh(capsuleGeometryTop, prizeTopMaterial);
  const prizeBottomMesh = new THREE.Mesh(capsuleGeometryBottom, prizeBottomMaterial);
  const prizeRingMesh = new THREE.Mesh(capsuleGeometryRing, prizeRingMaterial);
  prizeTopMesh.castShadow = true;
  prizeBottomMesh.castShadow = true;
  prize.group.add(prizeTopMesh, prizeBottomMesh, prizeRingMesh);
  prize.group.name = "prize-capsule";
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

  /**
   * 카메라 앞 PRIZE_DISTANCE 에서 화면 세로의 fraction 만큼이 되는 실제 길이(m).
   * 세로 화각은 화면 비율과 무관하므로 1440 에서도 390 에서도 같은 값이 나온다.
   */
  function prizeSpan(fraction: number): number {
    return 2 * PRIZE_DISTANCE * Math.tan((camera.fov * Math.PI) / 360) * fraction;
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

  /* 손으로 돌려 보는 상품 ---------------------------------------------------
     2026-09-03 11라운드: 운영자가 "상품이 제멋대로 도는 게 싫다" 고 했다. 저 혼자 도는
     회전을 없애고, 끄는 대로 따라오게 한다 — 가로로 끌면 yaw, 세로로 끌면 pitch(±35°),
     놓으면 아주 짧게 미끄러지다 완전히 선다. 손이 없으면 그림은 한 픽셀도 바뀌지 않는다.
     휠은 받지 않는다(스크롤이 곧 카메라라서 확대와 싸운다). */
  let prizeYaw = 0;
  let prizePitch = 0;
  let prizeYawRate = 0;
  let prizePitchRate = 0;
  let prizeDragging = false;
  let prizePointerId = -1;
  let prizeLastX = 0;
  let prizeLastY = 0;
  /** 무대가 손을 받는 중인지. 공개 무대에서만 켠다 — 그 밖에는 캔버스가 손을 통과시킨다. */
  let prizeGrabbable = false;

  function resetPrizeSpin(): void {
    prizeYaw = 0;
    prizePitch = 0;
    prizeYawRate = 0;
    prizePitchRate = 0;
  }

  const canvas = renderer.domElement;
  const onPrizeDown = (event: PointerEvent): void => {
    if (!prizeGrabbable || event.button !== 0) return;
    prizeDragging = true;
    prizePointerId = event.pointerId;
    prizeLastX = event.clientX;
    prizeLastY = event.clientY;
    prizeYawRate = 0;
    prizePitchRate = 0;
    // 무대 안에서만 처리한다 — 손가락이 화면 밖으로 나가도 필름이 따라 스크롤되지 않는다.
    try { canvas.setPointerCapture(event.pointerId); } catch { /* 캡처를 못 해도 끌기는 된다 */ }
    event.preventDefault();
  };
  const onPrizeMove = (event: PointerEvent): void => {
    if (!prizeDragging || event.pointerId !== prizePointerId) return;
    const dx = event.clientX - prizeLastX;
    const dy = event.clientY - prizeLastY;
    prizeLastX = event.clientX;
    prizeLastY = event.clientY;
    prizeYaw += dx * PRIZE_DRAG.yaw;
    prizePitch = Math.max(-PRIZE_DRAG.pitchLimit, Math.min(PRIZE_DRAG.pitchLimit, prizePitch + dy * PRIZE_DRAG.pitch));
    // 놓았을 때 미끄러질 만큼의 속도. 한 번의 움직임을 1/60 초로 본다.
    prizeYawRate = dx * PRIZE_DRAG.yaw * 60;
    prizePitchRate = dy * PRIZE_DRAG.pitch * 60;
    event.preventDefault();
  };
  const onPrizeUp = (event: PointerEvent): void => {
    if (event.pointerId !== prizePointerId) return;
    prizeDragging = false;
    prizePointerId = -1;
    // 손을 뗀 뒤에는 아주 조금만 미끄러진다 — 던져 놓은 팽이가 되면 "제멋대로 도는" 그것이다.
    prizeYawRate *= PRIZE_DRAG.glide;
    prizePitchRate *= PRIZE_DRAG.glide;
    try { canvas.releasePointerCapture(event.pointerId); } catch { /* 이미 놓였으면 그만 */ }
  };
  canvas.addEventListener("pointerdown", onPrizeDown);
  canvas.addEventListener("pointermove", onPrizeMove);
  canvas.addEventListener("pointerup", onPrizeUp);
  canvas.addEventListener("pointercancel", onPrizeUp);

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
      // 새 상품은 늘 정면으로 선다 — 앞 사람이 돌려 놓은 각도가 남아 있으면 안 된다.
      resetPrizeSpin();
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
      resetPrizeSpin();
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
        // 통 안에 들어섰는지. 유리 안쪽에 들어오면 그 순간이고, 옆으로 밀려 그 공을
        // 스치지 못했더라도 목 아래로 내려왔으면 무조건 통 안이다 — 높이는 떨어지는
        // 동안 반드시 줄어드니 이 문턱은 절대로 건너뛰어지지 않는다.
        if (
          capsule.position.distanceTo(DOME_CENTER) < DOME_INNER
          || capsule.position.y <= DOME_ENTRY_Y
        ) {
          capsule.entering = false;
        }
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
      const floorY = DOME_FLOOR + CAPSULE_RADIUS * capsule.scale;
      if (capsule.position.y < floorY) {
        capsule.position.y = floorY;
        capsule.velocity.y = Math.abs(capsule.velocity.y) * (agitated ? 0.52 : 0.12);
      }
      // 돔 안쪽 벽
      const offset = capsule.position.clone().sub(DOME_CENTER);
      const distance = offset.length();
      // 큰 알일수록 벽에서 더 일찍 멈춘다. 한 값으로 두면 1.22배 알이 유리를 뚫는다.
      const wall = DOME_INNER - CAPSULE_RADIUS * (capsule.scale - 1);
      if (distance > wall) {
        offset.multiplyScalar(wall / distance);
        capsule.position.copy(DOME_CENTER).add(offset);
        const normal = offset.normalize();
        capsule.velocity.addScaledVector(normal, -2 * capsule.velocity.dot(normal) * 0.55);
      }
    }

    /**
     * 겹침 방지 — 구 대 구를 몇 번 밀어낸다.
     *
     * 2026-09-03 10라운드: 통을 3분의 2까지 채우면서 알이 조밀해졌다. 한 번만 밀어내던
     * 것으로는 뒤에 처리한 쌍이 앞의 결과를 되돌려, 가만히 있는 더미에서도 알이 최대
     * 8 cm 서로 파고들었다. 여섯 번 돌리고 조금 세게(0.6) 밀면 정지 상태에서 겹침이 사라진다.
     */
    const passes = 6;
    /**
     * 알 껍데기끼리 2 mm 는 떨어져 있어야 한다 — 딱 붙으면 두 알이 한 덩어리로 뭉개진다.
     *
     * 2026-09-03 10라운드: 여기서 반지름을 한 값으로 고정해 두었더니 큰 알(1.22배)끼리는
     * 필요한 거리의 4분의 3만 벌어져 최대 12 cm 를 서로 파고들었다. 알마다 크기가 다르므로
     * 최소 거리도 알마다 다르다.
     */
    // 2 mm 를 목표로 두면 대기 중 숨결에 밀려 순간적으로 1.3 mm 까지 좁아졌다. 3.5 mm 로
    // 잡아 두면 흔들리는 동안에도 2 mm 밑으로 내려가지 않는다.
    const gap = 0.0035;
    for (let pass = 0; pass < passes; pass += 1) {
      for (let a = 0; a < capsuleCount; a += 1) {
        for (let b = a + 1; b < capsuleCount; b += 1) {
          const first = capsules[a].position;
          const second = capsules[b].position;
          const minimum = CAPSULE_RADIUS * (capsules[a].scale + capsules[b].scale) + gap;
          const dx = second.x - first.x;
          const dy = second.y - first.y;
          const dz = second.z - first.z;
          const squared = dx * dx + dy * dy + dz * dz;
          if (squared >= minimum * minimum || squared < 1e-9) continue;
          const distance = Math.sqrt(squared);
          const push = (minimum - distance) * 0.6;
          const nx = dx / distance;
          const ny = dy / distance;
          const nz = dz / distance;
          first.x -= nx * push; first.y -= ny * push; first.z -= nz * push;
          second.x += nx * push; second.y += ny * push; second.z += nz * push;
        }
      }
    }

    /**
     * 밀어낸 뒤에 유리 벽과 바닥에 한 번 더 도로 넣는다.
     *
     * 2026-09-03 11라운드: 벽에 넣는 일이 밀어내기보다 먼저였다. 밀어내기는 속도가 아니라
     * 자리를 직접 옮기므로, 먼저 벽에 넣어 봐야 그 다음 여섯 번의 밀어냄이 알을 유리 밖으로
     * 그대로 내보냈다 — 가만히 있을 때도 겉면이 중심에서 0.80 까지(유리 0.74) 나갔고,
     * 레버를 당겨 흔드는 순간에는 0.97 까지 튀어 앞판 위에 757 px 로 찍혔다.
     * 여기서는 자리만 고친다(속도는 위에서 이미 튕겼다).
     */
    for (let index = 0; index < capsuleCount; index += 1) {
      const capsule = capsules[index];
      if (capsule.entering) continue;
      const floorY = DOME_FLOOR + CAPSULE_RADIUS * capsule.scale;
      if (capsule.position.y < floorY) capsule.position.y = floorY;
      confineScratch.copy(capsule.position).sub(DOME_CENTER);
      const distance = confineScratch.length();
      const wall = DOME_INNER - CAPSULE_RADIUS * (capsule.scale - 1);
      if (distance > wall) {
        capsule.position.copy(DOME_CENTER).addScaledVector(confineScratch, wall / distance);
      }
    }

    // 흔들 때는 마구 구르고, 가만히 있을 때는 좌우로만 아주 천천히 돈다 —
    // 대기 중에 앞뒤로 계속 구르면 맑은 뚜껑이 아래로 넘어가 물건이 사라진다.
    const spinRate = agitated ? 3.2 : 0.32;
    for (let index = 0; index < capsuleCount; index += 1) {
      const capsule = capsules[index];
      capsule.rotation.y += capsule.spin.y * dt * spinRate;
      if (agitated) {
        capsule.rotation.x += capsule.spin.x * dt * spinRate;
        capsule.rotation.z += capsule.spin.z * dt * spinRate;
      } else {
        // 기울기는 스스로 0 으로 돌아온다. 흔들림이 끝나면 알이 다시 뚜껑을 위로 세운다.
        capsule.rotation.x = approach(capsule.rotation.x, 0, dt * 0.9);
        capsule.rotation.z = approach(capsule.rotation.z, 0, dt * 0.9);
      }
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
        y = 1.30 - (1.30 - restY) * k * k;
      } else if (t < drop + first) {
        const k = (t - drop) / first;
        y = restY + Math.sin(k * Math.PI) * 0.2;
      } else if (t < drop + first + second) {
        const k = (t - drop - first) / second;
        y = restY + Math.sin(k * Math.PI) * 0.075;
      }
      // 떨어지는 동안에는 몸통 안쪽(z 0.34)에 있다 — 앞판 앞으로 나와 떨어지면 알이
      // 보라 도장을 뚫고 지나간다. 바닥에 닿은 뒤에 배출구 앞자리로 굴러 나온다.
      const forward = Math.min(1, Math.max(0, (t - drop) / 0.24));
      prize.group.position.set(0, y, 0.34 + (TRAY.z - 0.34) * forward);
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
    const place = (mesh: THREE.Mesh, across: number, up: number, depth = 0.42) => {
      mesh.position.copy(DOME_CENTER)
        .addScaledVector(cameraRight, across * DOME_RADIUS)
        .addScaledVector(cameraUp, up * DOME_RADIUS)
        .addScaledVector(cameraForward, face * depth);
      mesh.quaternion.copy(camera.quaternion);
    };
    // 왼쪽 위의 넓은 반사와, 그 오른쪽에 맺힌 작고 단단한 점.
    place(highlightSoft, -0.44, 0.34, 0.42);
    // 두 점이 같은 면에 있으면 겹치는 자리에서 서로를 갉는다 — 깊이를 갈라 둔다.
    place(highlightHard, -0.2, 0.6, 0.52);

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
        place(glint, -1.1 + k * 2.2, 0.12, 0.32);
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
    ambient.intensity = 0.34 * dim;
    key.intensity = 1.6 * dim;
    fill.intensity = 0.72 * dim;
    rim.intensity = 1.9 * dim;
    rimWarm.intensity = 1.05 * dim;
    sweep.intensity = 1.9 * dim;
    domeLight.intensity = 3.4 * dim;
    // 2026-09-03: 뒤판을 밝게 두면 얇은 유리를 통해 돔 안이 통째로 라벤더색 안개가 된다.
    // 돔 안은 어둡고 캡슐만 밝아야 "안에 물건이 들었다" 로 읽힌다.
    backLightMaterial.opacity = lit * 0.05;
    wallMaterial.color.setScalar(0.16 + 0.84 * lit);
    spot.intensity = lit * 12;
    coneMaterial.opacity = lit * 0.028 * quality.glow;
    bulbMaterial.opacity = lit * 0.6;
    wallGlowMaterial.opacity = lit * 0.075;
    dustMaterial.opacity = lit * 0.26;
    // 발치의 빛 웅덩이는 세게 — 참고 이미지의 바닥은 기계 색으로 젖어 있다.
    poolMaterial.opacity = lit * 0.46 * quality.glow;
    underGlowMaterial.opacity = lit * 0.4 * quality.glow;
    contactMaterial.opacity = lit * 0.66;
    highlightSoftMaterial.opacity = lit * 0.14 * quality.glow;
    highlightHardMaterial.opacity = lit * 0.32;

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
    signMaterial.opacity = 0.15 + 0.85 * gate;
    signGlowMaterial.opacity = 0.34 * gate;
    // LED 띠도 같은 순간에 들어온다 — 사인만 켜지고 몸통이 어두우면 반쪽만 살아난다.
    setLed(gate);
  }

  /** LED 띠 한 벌의 밝기(0~1). 재질 하나와 번짐 판들이 같이 오르내린다. */
  function setLed(level: number): void {
    const value = Math.max(0, level);
    ledMaterial.color.copy(ledBase).multiplyScalar(0.35 + value * 0.85);
    for (const mesh of ledGlows) {
      (mesh.material as THREE.MeshBasicMaterial).opacity = value * 0.42 * quality.glow;
    }
    trayGlowMaterial.opacity = value * 0.62 * quality.glow;
    knobGlowMaterial.opacity = value * 0.5 * quality.glow;
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
    // 충분히 가까워지면 딱 붙인다. 끝없이 수렴만 하면 손을 뗀 화면이 영원히 아주 조금씩
    // 바뀌어(2026-09-03 11라운드: 공개 무대에서 5초 사이 81 px), 가만히 둔 화면이 서지 않는다.
    if (Math.abs(pointerEased.x - pointer.x) < 1e-4 && Math.abs(pointerEased.y - pointer.y) < 1e-4) {
      pointerEased.copy(pointer);
    }
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
    // 돔 위를 도는 반짝임. 공개 무대에서는 멈춘다 — 기계가 사라진 화면에서 이 빛만
    // 계속 돌면 가만히 둔 상품 위에서 하이라이트가 혼자 기어다닌다(운영자: 완전히 정지).
    if (!reduced && stage !== "result") sweep.position.set(Math.cos(clock * 0.6) * 1.15, 3.35, Math.sin(clock * 0.6) * 1.15);
    stepHighlights(dt);
    // 더해 그리는 빛 판들은 늘 카메라를 마주 본다. 비스듬히 서면 빛이 아니라 판으로 읽힌다.
    // 기계가 손끝을 따라 돌기 때문에, 카메라 방향을 부모의 회전으로 한 번 되돌려 준다.
    machine.getWorldQuaternion(billboardScratch).invert().multiply(camera.quaternion);
    for (const mesh of ledGlows) mesh.quaternion.copy(billboardScratch);
    lever.getWorldQuaternion(billboardScratch).invert().multiply(camera.quaternion);
    knobGlow.quaternion.copy(billboardScratch);

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
      signMaterial.opacity = approach(signMaterial.opacity, 1, dt * 6);
      signGlowMaterial.opacity = approach(signGlowMaterial.opacity, hovered ? 0.62 : 0.46 + breath * 0.6, dt * 6);
      // LED 띠는 0.3 Hz 로 숨 쉰다. 모바일은 숨을 쉬지 않고 켜져만 있다 —
      // 더해 그리는 판을 매 프레임 바꾸는 것이 작은 기기에서 제일 비싸다.
      const pulse = reduced || !quality.ledBreath ? 0 : Math.sin(clock * Math.PI * 0.6) * 0.22;
      setLed((hovered ? 1.15 : 1) + pulse);
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
    // 손을 올리면 공이 1.6배로 부푼다 — 여기가 잡는 자리라는 가장 큰 몸짓이다.
    const knobScale = 1 + leverHoverEase * 0.6;
    leverKnob.scale.setScalar(knobScale);
    knobGlow.scale.setScalar(knobScale);

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
    highlightSoftMaterial.opacity = approach(highlightSoftMaterial.opacity, (domeHover ? 0.26 : 0.14) * quality.glow, dt * 6);

    // 배출구 문 — 캡슐이 나올 때만 안쪽으로 열린다.
    const flapOpen = stage === "impact" && stageTime > 0.4 && stageTime < 0.95 ? -1.05 : 0;
    flapHinge.rotation.x = approach(flapHinge.rotation.x, flapOpen, dt * 9);

    // 배출구 조명
    const wantedTray = stage === "capsule" ? 3.2 : stage === "impact" && stageTime > 0.6 ? 1.8 : 0;
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

    /* 손으로 돌리는 상품 — 공개 무대에서만 캔버스가 손을 받는다. */
    const grabbable = stage === "result" && prizeArtLoaded;
    if (grabbable !== prizeGrabbable) {
      prizeGrabbable = grabbable;
      // 평소에는 캔버스가 손을 통과시켜야 한다 — 레버·돔 단추와 세로 스크롤이 그 위에 있다.
      canvas.style.pointerEvents = grabbable ? "auto" : "";
      // pan-y 로 둔다: 옆으로 시작한 손짓은 통째로 우리 것이 되어(포인터 캡처) 위아래
      // 성분까지 따라오고, 위아래로 시작한 손짓은 브라우저의 세로 스크롤로 남는다.
      // none 으로 막으면 세로 화면에서 상품을 본 사람이 페이지 밖으로 나갈 길이 없어진다.
      canvas.style.touchAction = grabbable ? "pan-y" : "";
      canvas.style.cursor = grabbable ? "grab" : "";
      if (!grabbable) prizeDragging = false;
    }
    if (prizeDragging) {
      canvas.style.cursor = "grabbing";
    } else if (grabbable) {
      canvas.style.cursor = "grab";
      // 놓은 뒤의 짧은 미끄러짐. 느려지면 딱 멈춘다 — 가만히 둔 화면은 완전히 정지한다.
      if (reduced) {
        prizeYawRate = 0;
        prizePitchRate = 0;
      } else if (Math.abs(prizeYawRate) > 0.02 || Math.abs(prizePitchRate) > 0.02) {
        prizeYaw += prizeYawRate * dt;
        prizePitch = Math.max(-PRIZE_DRAG.pitchLimit, Math.min(PRIZE_DRAG.pitchLimit, prizePitch + prizePitchRate * dt));
        const decay = Math.exp(-PRIZE_DRAG.decay * dt);
        prizeYawRate *= decay;
        prizePitchRate *= decay;
        if (Math.abs(prizeYawRate) <= 0.02) prizeYawRate = 0;
        if (Math.abs(prizePitchRate) <= 0.02) prizePitchRate = 0;
      } else {
        prizeYawRate = 0;
        prizePitchRate = 0;
      }
    }

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
          .addScaledVector(prizeForward, PRIZE_DISTANCE)
          .addScaledVector(prizeRight, wide ? -0.3 : 0)
          .addScaledVector(prizeUp, wide ? -0.05 : 0.34);
        prizeArt.scale.setScalar(1);
        // 손이 돌린 만큼만 돈다. 저 혼자 도는 회전은 없앴다(운영자 지시 2026-09-03).
        prizeArt.rotation.set(prizePitch, prizeYaw, 0);
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

  /**
   * 검증용 손잡이. 주소에 ?audit=1 이 있을 때만 걸린다 — 겹치는 면(coplanar)·꿰뚫는
   * 삼각형·레버 스윙 여유를 재는 스크립트가 기계 하나를 통째로 내보내야 하기 때문이다.
   * 보통 방문에서는 아무 일도 일어나지 않는다.
   */
  if (typeof window !== "undefined" && /[?&]audit=1/.test(window.location.search)) {
    (window as unknown as { __gachaAudit?: unknown }).__gachaAudit = {
      THREE, scene, machine, lever, camera, capsules, renderer, pile, prize: prize.group, prizeArt,
      dome: { centre: DOME_CENTER, radius: DOME_RADIUS, floor: DOME_FLOOR, capsuleRadius: CAPSULE_RADIUS },
      // 11라운드: "알이 몸통을 뚫고 보이는가" 를 픽셀로 세려면 알을 껐다 켠 두 장을
      // 같은 프레임에서 그려 비교해야 한다. 그래서 렌더러와 알 무리를 함께 내보낸다.
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
        artGeometry.getAttribute("aTile").needsUpdate = true;
      }
      // 움직임을 줄여 달라는 설정에서는 캡슐 물리가 아예 돌지 않는다 — 쏟아 붓는 대신
      // 채워진 통을 그대로 보여 준다.
      if (options?.pour && !reduced && count > 0) {
        pourPending = true;
      }
    },
    setPrizeCapsule(spec) {
      const grade = toColor(spec.ring);
      const shell = grade.clone().lerp(toColor(spec.color), 0.2);
      const hsl = { h: 0, s: 0, l: 0 };
      shell.getHSL(hsl);
      shell.setHSL(hsl.h, Math.min(0.72, hsl.s * 0.82 + 0.06), Math.min(0.36, Math.max(0.18, hsl.l * 0.52)));
      prizeBottomMaterial.color.copy(shell);
      prize.top.color.copy(new THREE.Color(0xd9ceff));
      prize.ring.color.copy(grade.clone().multiplyScalar(0.5));
      prize.ring.emissive.copy(grade).multiplyScalar(0.4);
      sparkMaterial.color.copy(grade);
      glowMaterial.color.copy(grade.clone().lerp(new THREE.Color(0xffffff), 0.45));
      trayLight.color.copy(grade.clone().lerp(new THREE.Color(0xffffff), 0.55));
    },
    setAccent(hex) {
      const color = toColor(hex);
      // 2026-09-03: 기계 자체는 어느 테마에서도 짙은 보라 캐비닛이다(운영자 참고 이미지).
      // 테마 색은 도장에 아주 조금만 섞이고, 실제로 바뀌는 것은 빛 — LED·손잡이·웅덩이다.
      bodyPaint.color.copy(new THREE.Color(SIDE_PURPLE)).lerp(color, 0.1);
      panelPaint.color.copy(new THREE.Color(PANEL_PURPLE)).lerp(color, 0.14);
      ledBase.copy(color).lerp(new THREE.Color(0xffffff), 0.12);
      trayGlowMaterial.color.copy(ledBase);
      knobGlowMaterial.color.copy(ledBase);
      glassRim.color.copy(color).lerp(new THREE.Color(0x2a1650), 0.34);
      for (const mesh of ledGlows) (mesh.material as THREE.MeshBasicMaterial).color.copy(ledBase);
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
        // 바운딩 "구" 로 맞춘다. 상자의 가장 긴 변으로 맞추면 모서리를 카메라로 돌렸을 때
        // 대각선(√3배)이 그만큼 커져 화면을 넘긴다 — 어느 각도로 돌려도 크기가 같아야 한다.
        const sphere = bounds.getBoundingSphere(new THREE.Sphere());
        model.position.set(-sphere.center.x, -sphere.center.y, -sphere.center.z);
        const wrapper = new THREE.Group();
        wrapper.add(model);
        wrapper.scale.setScalar(prizeSpan(PRIZE_SCREEN.model) / Math.max(2 * sphere.radius, 1e-4));
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
        // 판 높이를 화면 세로의 32% 로 잡는다. 두께와 모서리는 그 크기에 비례한다.
        const side = prizeSpan(PRIZE_SCREEN.card);
        const card = new THREE.Mesh(
          new RoundedBoxGeometry(side, side, side * 0.043, 3, side * 0.029),
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
      canvas.removeEventListener("pointerdown", onPrizeDown);
      canvas.removeEventListener("pointermove", onPrizeMove);
      canvas.removeEventListener("pointerup", onPrizeUp);
      canvas.removeEventListener("pointercancel", onPrizeUp);
      emptyPrizeArt();
      atlas.dispose();
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
