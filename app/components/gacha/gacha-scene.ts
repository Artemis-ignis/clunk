/**
 * 가챠 머신의 3D 장면 — 어두운 뽑기 가게 한 칸.
 *
 * 외부 모델 파일 없이 three.js 기본 도형만으로 기계 한 대를 짓는다 — 투명 돔, 둥근 몸통,
 * 발광 사인, 동전 투입구, 옆면에 달린 당기는 레버, 안쪽으로 열리는 배출구 문, 받침대.
 * 기계 둘레에는 타일 바닥, 뒷벽의 네온 글로우와 전구 줄, 위에서 내리꽂는 스포트라이트
 * 원뿔, 떠다니는 먼지가 있다. 돔 안의 캡슐은 아주 단순한 스프링·중력·구 밀어내기로
 * 움직인다(물리 엔진 없음).
 *
 * 캡슐은 처음에 하나도 없다. 카탈로그가 도착하면 돔 위 투입구에서 쏟아져 들어온다 —
 * 그래야 API 를 기다리는 동안에도 기계가 먼저 서 있을 수 있다.
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

export const DESKTOP_QUALITY: Quality = { capsules: 40, dpr: 2, shadowMap: 1024, transmission: true, dust: 34 };
export const MOBILE_QUALITY: Quality = { capsules: 24, dpr: 1.5, shadowMap: 512, transmission: false, dust: 20 };

export type SceneStage = "idle" | "pull" | "shake" | "impact" | "capsule" | "wobble" | "burst" | "result";

export type CapsuleSpec = {
  /** 위 반구 — 상품에서 잰 색. */
  color: string;
  /** 이음 링 — 등급 색. */
  ring: string;
};

/** 화면 위 자리(CSS 픽셀). HTML 오버레이 단추를 그 위에 얹을 때 쓴다. */
export type ScreenPoint = { x: number; y: number; radius: number; visible: boolean };

export type GachaScene = {
  /**
   * 돔에 들어갈 캡슐. pour 가 참이면 자리에 놓지 않고 돔 위 투입구에서 쏟아 붓는다 —
   * 카탈로그가 도착하는 순간이 그 순간이다.
   */
  setCapsules(specs: readonly CapsuleSpec[], options?: { pour?: boolean }): void;
  setPrizeCapsule(spec: CapsuleSpec): void;
  setAccent(hex: string): void;
  setStage(stage: SceneStage): void;
  /** 마우스 자리(-1~1). 카메라가 아주 조금 기운다. */
  setPointer(x: number, y: number): void;
  setHovered(hovered: boolean): void;
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
  /** 레버 손잡이와 배출구 캡슐의 화면 자리. */
  points(): { lever: ScreenPoint; capsule: ScreenPoint; coin: ScreenPoint };
  /** 실제로 색이 칠해진 픽셀 수(검증용). 지금 그려진 화면을 그대로 읽는다. */
  countDrawnPixels(): number;
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
 * 캡슐 한 알의 반지름. 유리공 지름의 약 7분의 1 — 실제 뽑기 기계의 비율이다.
 * 2026-09-02: 0.088 에서는 서른 알이 통 바닥에 얇게 한 겹 깔려 통이 비어 보였다.
 */
const CAPSULE_RADIUS = 0.105;
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
 * 2026-09-02: 5.9 에서는 몸통 앞면(z 0.71)이 카메라에 너무 가까워 받침 아래가 화면
 * 밖으로 잘렸다 — 기계가 바닥에 닿는 곳이 안 보이면 떠 있는 그림처럼 읽힌다.
 * 한 걸음 물러나 세로로 -0.18 ~ 3.54 를 담는다(기계는 0 ~ 3.48).
 */
const CAMERA_HEIGHT = 2.35;
const CAMERA_DISTANCE = 6.8;
const CAMERA_TARGET = 1.6;

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

/** 몸통 앞면에 붙는 CLUNK 사인. 글자를 캔버스에 그려 발광 무늬로 쓴다(외부 파일 없음). */
function makeSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#05070f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "800 96px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("CLUNK", canvas.width / 2, canvas.height / 2 + 4);
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

type Capsule = {
  group: THREE.Group;
  top: THREE.MeshPhysicalMaterial;
  ring: THREE.MeshStandardMaterial;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  /** 투입구에서 떨어지는 중 — 돔 안으로 들어오기 전까지는 유리 벽에 걸리지 않는다. */
  entering: boolean;
};

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

  /* 조명 — 키/필/림 세 점과 바닥 그림자 ------------------------------------ */
  const ambient = new THREE.HemisphereLight(0xdfe8ff, 0x1a1c2a, 0.55);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xfff4e2, 2.5);
  key.position.set(2.6, 7.6, 3.8);
  key.castShadow = true;
  key.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
  key.shadow.bias = 0;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 20;
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -1;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9fb6ff, 0.7);
  fill.position.set(-4.2, 2.4, 3.2);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xbfd6ff, 1.25);
  rim.position.set(-2.6, 3.4, -4.6);
  scene.add(rim);

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

  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x2a3050,
    roughness: 0.42,
    metalness: 0.18,
    clearcoat: 0.55,
    clearcoatRoughness: 0.3,
  });
  const paintMaterial = new THREE.MeshPhysicalMaterial({
    color: accent.clone().lerp(new THREE.Color(0x141a2e), 0.6),
    roughness: 0.3,
    metalness: 0.1,
    clearcoat: 0.9,
    clearcoatRoughness: 0.15,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x090c17, roughness: 0.85, metalness: 0.1 });
  const metalMaterial = new THREE.MeshStandardMaterial({ color: 0xb9c3dc, roughness: 0.28, metalness: 0.92 });

  // 받침대
  const base = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.6, 1.42, 4, 0.09), shellMaterial);
  base.position.set(0, 0.3, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  machine.add(base);

  // 몸통 — 테마 색으로 칠한 둥근 모서리 상자
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.66, 1.42, 1.16, 5, 0.13), paintMaterial);
  body.position.set(0, 1.31, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  machine.add(body);

  // 이음선 두 줄과 나사 네 개 — 기계로 읽히게 하는 최소한의 디테일
  for (const y of [1.94, 0.63]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.035, 1.2), metalMaterial);
    seam.position.set(0, y, 0);
    seam.castShadow = true;
    machine.add(seam);
  }
  for (const [x, y] of [[-0.72, 1.86], [0.72, 1.86], [-0.72, 0.72], [0.72, 0.72]] as const) {
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 10), metalMaterial);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(x, y, 0.585);
    machine.add(screw);
  }

  // 앞면 발광 사인
  const signTexture = makeSignTexture();
  const signMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b1020,
    map: signTexture,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: signTexture,
    emissiveIntensity: 1.1,
    roughness: 0.5,
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.3), signMaterial);
  sign.position.set(0, 1.76, 0.622);
  machine.add(sign);
  // 테두리는 글자보다 뒤에 있어야 한다 — 앞에 두면 발광 글자를 통째로 가린다.
  const signFrame = new THREE.Mesh(new RoundedBoxGeometry(1.12, 0.42, 0.07, 3, 0.03), darkMaterial);
  signFrame.position.set(0, 1.76, 0.578);
  machine.add(signFrame);

  // 동전 투입구 — 음각 슬롯 + 동그란 반환구
  const coinPlate = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.46, 0.06, 3, 0.04), darkMaterial);
  coinPlate.position.set(-0.42, 1.28, 0.575);
  machine.add(coinPlate);
  const coinSlot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1 }));
  coinSlot.position.set(-0.42, 1.4, 0.6);
  machine.add(coinSlot);
  const coinReturn = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 20), metalMaterial);
  coinReturn.rotation.x = Math.PI / 2;
  coinReturn.position.set(-0.42, 1.18, 0.6);
  machine.add(coinReturn);

  /* 당기는 레버 — 기계 오른쪽 옆면 -----------------------------------------
     받침(옆면에 붙는 원판) + 축(세로 막대) + 둥근 손잡이. 손잡이를 아래로 당기면
     축이 앞쪽 아래로 넘어갔다가 스프링처럼 튕겨 올라온다. 돌리는 것이 아니라
     당기는 것이다. */
  const leverMount = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.12, 24), darkMaterial);
  leverMount.rotation.z = Math.PI / 2;
  leverMount.position.set(0.86, 1.6, 0.02);
  leverMount.castShadow = true;
  machine.add(leverMount);
  const leverBoss = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.2, 20), metalMaterial);
  leverBoss.rotation.z = Math.PI / 2;
  leverBoss.position.set(0.93, 1.6, 0.02);
  leverBoss.castShadow = true;
  machine.add(leverBoss);

  // 축이 도는 자리. rotation.x 를 키우면 손잡이가 앞쪽 아래로 내려온다.
  const lever = new THREE.Group();
  lever.position.set(0.98, 1.6, 0.02);
  machine.add(lever);
  const leverArm = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.044, 0.62, 16), metalMaterial);
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

  // 배출구 — 안쪽으로 열리는 문
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.44, 0.34), new THREE.MeshStandardMaterial({ color: 0x04060d, roughness: 1 }));
  mouth.position.set(0, 0.94, 0.42);
  machine.add(mouth);
  const flapHinge = new THREE.Group();
  flapHinge.position.set(0, 1.15, 0.585);
  machine.add(flapHinge);
  const flap = new THREE.Mesh(
    new RoundedBoxGeometry(0.7, 0.4, 0.04, 2, 0.02),
    new THREE.MeshPhysicalMaterial({ color: 0x6d90c6, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.22, clearcoat: 1 }),
  );
  flap.position.set(0, -0.19, 0);
  flapHinge.add(flap);
  // 배출구 테두리 — 가는 막대 넷을 둘러 창처럼 읽히게 한다.
  for (const [x, y, w, h] of [[0, 1.17, 0.86, 0.05], [0, 0.71, 0.86, 0.05], [-0.4, 0.94, 0.05, 0.51], [0.4, 0.94, 0.05, 0.51]] as const) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), metalMaterial);
    bar.position.set(x, y, 0.585);
    bar.castShadow = true;
    machine.add(bar);
  }

  // 캡슐이 눕는 바닥
  const trayFloor = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.04, 0.34), darkMaterial);
  trayFloor.position.set(0, 0.74, 0.5);
  trayFloor.receiveShadow = true;
  machine.add(trayFloor);

  // 목 — 돔이 앉는 고리
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.82, 0.26, 36), shellMaterial);
  collar.position.set(0, 2.03, 0);
  collar.castShadow = true;
  machine.add(collar);
  const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.615, 0.04, 12, 44), metalMaterial);
  collarRing.rotation.x = Math.PI / 2;
  collarRing.position.set(0, 2.14, 0);
  machine.add(collarRing);
  // 돔 바닥과 캡슐이 빠지는 구멍
  const domeFloor = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.66, 40).rotateX(-Math.PI / 2), darkMaterial);
  domeFloor.position.set(0, DOME_FLOOR, 0);
  domeFloor.receiveShadow = true;
  machine.add(domeFloor);

  // 유리 돔
  const glassMaterial = quality.transmission
    ? new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.03,
      metalness: 0,
      transmission: 1,
      // 얇게 잡아야 안이 뿌예지지 않는다. 두껍게 두면 캡슐이 유리에 먹힌다.
      thickness: 0.05,
      ior: 1.16,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      transparent: true,
      opacity: 1,
      // 반사를 더 눌러 둔다. 유리에 방이 통째로 비치면 안쪽 캡슐이 하얀 김에 묻힌다.
      envMapIntensity: 0.42,
      side: THREE.FrontSide,
    })
    : new THREE.MeshPhysicalMaterial({
      color: 0xdce9ff,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      // 투과를 못 쓰는 기기에서는 유리를 옅게 둔다. 너무 옅으면 유리공이 아예 안 보이고,
      // 짙게 두면 안의 캡슐이 안 보인다. 반사를 세게 두어 모양이 읽히게 한다.
      opacity: 0.42,
      clearcoat: 1,
      envMapIntensity: 1.3,
      side: THREE.FrontSide,
      depthWrite: false,
    });
  // 적도보다 조금 더 내려온 유리공. 바닥(구멍이 뚫린 접시)이 그 안에 들어가고,
  // 꼭대기는 캡슐을 붓는 투입구만큼 비어 있다.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(DOME_RADIUS, 48, 34, 0, Math.PI * 2, HATCH_PHI, Math.PI * 0.76 - HATCH_PHI),
    glassMaterial,
  );
  dome.position.copy(DOME_CENTER);
  dome.renderOrder = 2;
  machine.add(dome);

  // 투입구 — 유리공 꼭대기에 얹힌 금속 깔때기. 캡슐은 여기로 들어온다.
  const hatchRing = new THREE.Mesh(new THREE.TorusGeometry(HATCH_RADIUS + 0.015, 0.028, 10, 32), metalMaterial);
  hatchRing.rotation.x = Math.PI / 2;
  hatchRing.position.set(0, HATCH_Y, 0);
  machine.add(hatchRing);
  const funnel = new THREE.Mesh(
    new THREE.CylinderGeometry(HATCH_RADIUS + 0.11, HATCH_RADIUS + 0.01, 0.16, 28, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x9fabc8, roughness: 0.35, metalness: 0.85, side: THREE.DoubleSide }),
  );
  funnel.position.set(0, HATCH_Y + 0.06, 0);
  machine.add(funnel);
  // 하이라이트 링 — 유리 위를 도는 빛의 자국
  const highlight = new THREE.Mesh(
    new THREE.TorusGeometry(DOME_RADIUS * 0.72, 0.012, 8, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  highlight.position.copy(DOME_CENTER);
  highlight.rotation.x = 1.05;
  machine.add(highlight);

  /* 캡슐 ------------------------------------------------------------------- */
  const capsuleGeometryTop = new THREE.SphereGeometry(CAPSULE_RADIUS, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const capsuleGeometryBottom = new THREE.SphereGeometry(CAPSULE_RADIUS, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const capsuleGeometryRing = new THREE.TorusGeometry(CAPSULE_RADIUS * 0.99, CAPSULE_RADIUS * 0.115, 8, 22);
  const creamMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xf6f1e2,
    roughness: 0.22,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
  });

  function buildCapsule(): Capsule {
    const group = new THREE.Group();
    const top = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.18,
      metalness: 0.02,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    });
    const ring = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.5, emissive: 0x000000 });
    const topMesh = new THREE.Mesh(capsuleGeometryTop, top);
    topMesh.castShadow = true;
    const bottomMesh = new THREE.Mesh(capsuleGeometryBottom, creamMaterial);
    bottomMesh.castShadow = true;
    const ringMesh = new THREE.Mesh(capsuleGeometryRing, ring);
    ringMesh.rotation.x = Math.PI / 2;
    group.add(topMesh, bottomMesh, ringMesh);
    return {
      group,
      top,
      ring,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      spin: new THREE.Vector3(),
      entering: false,
    };
  }

  const capsules: Capsule[] = [];
  const pile = new THREE.Group();
  machine.add(pile);

  function ensureCapsules(count: number): void {
    while (capsules.length < count) {
      const capsule = buildCapsule();
      pile.add(capsule.group);
      capsules.push(capsule);
    }
    for (let index = 0; index < capsules.length; index += 1) {
      capsules[index].group.visible = index < count;
    }
  }

  /** 돔 안에 쌓인 첫 자리. 아래부터 고리 모양으로 채운다. */
  function seatCapsule(capsule: Capsule, index: number): void {
    const layer = Math.floor(index / 9);
    const withinLayer = index % 9;
    const radius = DOME_INNER * (0.24 + 0.66 * seeded(index, 3));
    const angle = (withinLayer / 9) * Math.PI * 2 + layer * 0.9;
    capsule.position.set(
      Math.cos(angle) * radius,
      DOME_FLOOR + CAPSULE_RADIUS + layer * CAPSULE_RADIUS * 1.75 + seeded(index, 5) * 0.02,
      Math.sin(angle) * radius,
    );
    capsule.velocity.set(0, 0, 0);
    capsule.spin.set(seeded(index, 7) - 0.5, seeded(index, 11) - 0.5, seeded(index, 13) - 0.5);
    capsule.entering = false;
    capsule.group.position.copy(capsule.position);
    capsule.group.rotation.set(seeded(index, 17) * 6.28, seeded(index, 19) * 6.28, 0);
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
    capsule.spin.set(seeded(index, 7) - 0.5, seeded(index, 11) - 0.5, seeded(index, 13) - 0.5);
    capsule.entering = true;
    capsule.group.position.copy(capsule.position);
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

  /** 배출되는 캡슐 — 쌓인 무리와 따로 움직인다. */
  const prize = buildCapsule();
  prize.group.visible = false;
  prize.group.scale.setScalar(1.55);
  reveal.add(prize.group);
  const prizeTopMesh = prize.group.children[0] as THREE.Mesh;
  const prizeBottomMesh = prize.group.children[1] as THREE.Mesh;
  const prizeRingMesh = prize.group.children[2] as THREE.Mesh;
  // 갈라질 때 두 반구가 서로 다른 쪽으로 날아가야 해서 따로 잡아 둔다.

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
  let cameraShake = 0;
  let width = 1;
  let height = 1;

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
    if (next === "shake") {
      // 캡슐 전체에 위로 튀는 힘을 준다. 물리 엔진 대신 이 한 줄이 '드르륵' 이다.
      for (let index = 0; index < capsules.length; index += 1) {
        const capsule = capsules[index];
        capsule.velocity.set(
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
    for (let index = 0; index < capsules.length; index += 1) {
      const capsule = capsules[index];
      if (!capsule.group.visible) continue;
      if (capsule.entering) {
        // 투입구에서 떨어지는 중 — 유리 벽도 바닥도 아직 없다. 돔 안에 들어서면 그때부터
        // 보통 캡슐이 된다.
        capsule.velocity.y += -7.2 * dt;
        capsule.position.addScaledVector(capsule.velocity, dt);
        capsule.group.position.copy(capsule.position);
        capsule.group.rotation.x += capsule.spin.x * dt * 2.4;
        capsule.group.rotation.z += capsule.spin.z * dt * 2.4;
        if (capsule.position.distanceTo(DOME_CENTER) < DOME_INNER - CAPSULE_RADIUS) capsule.entering = false;
        continue;
      }
      if (!agitated) {
        // 대기 중에도 아주 미세하게 숨 쉬듯 — 자리마다 다른 위상의 작은 힘.
        const breath = Math.sin(clock * 1.15 + index * 0.7) * 0.055;
        capsule.velocity.y += breath * dt;
        // 가끔 하나가 살짝 구른다.
        if (seeded(index, Math.floor(clock * 0.5)) > 0.985) {
          capsule.velocity.x += (seeded(index, 53) - 0.5) * 0.5;
          capsule.velocity.z += (seeded(index, 59) - 0.5) * 0.5;
        }
      }
      capsule.velocity.y += gravity * dt;
      capsule.velocity.multiplyScalar(damping);
      capsule.position.addScaledVector(capsule.velocity, dt);

      // 바닥
      const floor = DOME_FLOOR + CAPSULE_RADIUS;
      if (capsule.position.y < floor) {
        capsule.position.y = floor;
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
      for (let a = 0; a < capsules.length; a += 1) {
        if (!capsules[a].group.visible) continue;
        for (let b = a + 1; b < capsules.length; b += 1) {
          if (!capsules[b].group.visible) continue;
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

    for (let index = 0; index < capsules.length; index += 1) {
      const capsule = capsules[index];
      if (!capsule.group.visible) continue;
      capsule.group.position.copy(capsule.position);
      const spinRate = agitated ? 3.2 : 0.32;
      capsule.group.rotation.x += capsule.spin.x * dt * spinRate;
      capsule.group.rotation.y += capsule.spin.y * dt * spinRate;
      capsule.group.rotation.z += capsule.spin.z * dt * spinRate;
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
    ambient.intensity = 0.55 * dim;
    key.intensity = 2.5 * dim;
    fill.intensity = 0.7 * dim;
    rim.intensity = 1.25 * dim;
    sweep.intensity = 2.6 * dim;
    domeLight.intensity = 2.4 * dim;
    backLightMaterial.opacity = lit * 0.22;
    wallMaterial.color.setScalar(0.16 + 0.84 * lit);
    spot.intensity = lit * 22;
    coneMaterial.opacity = lit * 0.07;
    bulbMaterial.opacity = lit * 0.75;
    wallGlowMaterial.opacity = lit * 0.18;
    dustMaterial.opacity = lit * 0.3;

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

    // 네온 사인.
    signMaterial.emissiveIntensity = 1.05 * neonGate(t);
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
      for (let index = 0; index < capsules.length; index += 1) {
        if (capsules[index].group.visible) seatCapsule(capsules[index], index);
      }
    }
  }

  function startPour(): void {
    pourPending = false;
    pileHeld = false;
    for (let index = 0; index < capsules.length; index += 1) {
      if (capsules[index].group.visible) stackAboveHatch(capsules[index], index);
    }
  }

  function stepIntro(dt: number): void {
    if (!introOn) return;
    introTime += dt;
    applyIntro(introTime);
    // 착지하는 프레임에 먼지와 카메라 흔들림을 한 번만 낸다.
    if (introTime >= INTRO_SECONDS.land && introTime - dt < INTRO_SECONDS.land) {
      puffTime = 0;
      cameraShake = 0.13;
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

    // 카메라 패럴랙스 — 손끝을 따라 아주 조금.
    pointerEased.lerp(pointer, reduced ? 1 : Math.min(1, dt * 4));
    const shake = cameraShake > 0 ? cameraShake : 0;
    camera.position.set(
      pointerEased.x * 0.55 + (shake ? (Math.random() - 0.5) * shake : 0),
      CAMERA_HEIGHT + pointerEased.y * 0.35 + (shake ? (Math.random() - 0.5) * shake : 0),
      CAMERA_DISTANCE,
    );
    camera.lookAt(0, CAMERA_TARGET + pointerEased.y * 0.1, 0);
    if (cameraShake > 0) cameraShake = Math.max(0, cameraShake - dt * 0.9);

    // 돔 위를 도는 반짝임과 하이라이트 링.
    if (!reduced) {
      sweep.position.set(Math.cos(clock * 0.6) * 1.15, 3.35, Math.sin(clock * 0.6) * 1.15);
      highlight.rotation.z = clock * 0.35;
    }

    // 사인 발광 — 마우스를 올리면 세진다. 켜지는 중에는 등장 연출이 직접 잡는다.
    if (!introOn || introTime >= INTRO_SECONDS.neon + 0.3) {
      const wantedSign = hovered ? 2.4 : 1.05 + (reduced ? 0 : Math.sin(clock * 1.6) * 0.12);
      signMaterial.emissiveIntensity = approach(signMaterial.emissiveIntensity, wantedSign, dt * 6);
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

    // 손잡이의 발광 — 손을 올렸을 때와 등장 연출의 마지막 반짝임.
    if (knobGlint >= 0) {
      knobGlint += dt;
      const k = knobGlint / 0.7;
      if (k >= 1) knobGlint = -1;
      leverKnobMaterial.emissiveIntensity = k >= 1 ? 0 : Math.sin(k * Math.PI) * 1.4;
    } else {
      const wantedKnob = hovered && stage === "idle" ? 0.5 : 0;
      leverKnobMaterial.emissiveIntensity = approach(leverKnobMaterial.emissiveIntensity, wantedKnob, dt * 6);
    }

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

    if (!reduced) stepCapsules(dt, stage === "shake" || stage === "pull");

    if (stage === "impact") {
      stepDispense(stageTime);
      if (stageTime > 0.78 && stageTime - dt <= 0.78 && !reduced) cameraShake = 0.06;
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
        prizeArt.position.copy(STAGE_FRONT);
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
      for (let index = 0; index < count; index += 1) {
        const spec = specs[index];
        capsules[index].top.color.copy(toColor(spec.color));
        capsules[index].ring.color.copy(toColor(spec.ring));
        capsules[index].ring.emissive.copy(toColor(spec.ring)).multiplyScalar(0.28);
        seatCapsule(capsules[index], index);
      }
      // 움직임을 줄여 달라는 설정에서는 캡슐 물리가 아예 돌지 않는다 — 쏟아 붓는 대신
      // 채워진 통을 그대로 보여 준다.
      if (options?.pour && !reduced && count > 0) {
        pourPending = true;
      }
    },
    setPrizeCapsule(spec) {
      prize.top.color.copy(toColor(spec.color));
      prize.ring.color.copy(toColor(spec.ring));
      prize.ring.emissive.copy(toColor(spec.ring)).multiplyScalar(0.4);
      sparkMaterial.color.copy(toColor(spec.ring));
      glowMaterial.color.copy(toColor(spec.ring)).lerp(new THREE.Color(0xffffff), 0.45);
      trayLight.color.copy(toColor(spec.ring)).lerp(new THREE.Color(0xffffff), 0.55);
    },
    setAccent(hex) {
      const color = toColor(hex);
      paintMaterial.color.copy(color).lerp(new THREE.Color(0x141a2e), 0.6);
    },
    setStage,
    setPointer(x, y) { pointer.set(x, y); },
    setHovered(next) { hovered = next; },
    setLeverPull(fraction) { leverHeld = Math.max(0, Math.min(1, fraction)); },
    leverPull() { return leverValue; },
    startIntro() {
      if (reduced) { finishIntro(); return; }
      introTime = 0;
      introOn = true;
      applyIntro(0);
      // 이미 캡슐이 들어 있는 채로 연출을 다시 돌리면(검증이 네 프레임을 찍을 때)
      // 통을 한 번 비우고 투입구에서 다시 붓는다 — 등장 연출은 붓는 장면까지가 한 벌이다.
      if (capsules.some((capsule) => capsule.group.visible)) {
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
        wrapper.scale.setScalar(1.15 / longest);
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
      const coinWorld = coinPlate.getWorldPosition(new THREE.Vector3());
      return {
        lever: project(leverWorld, 0.19),
        capsule: project(capsuleWorld, CAPSULE_RADIUS * 1.9),
        coin: project(coinWorld, 0.22),
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
