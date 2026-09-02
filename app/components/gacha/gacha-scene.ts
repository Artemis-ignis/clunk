/**
 * 가챠 머신의 3D 장면.
 *
 * 외부 모델 파일 없이 three.js 기본 도형만으로 기계 한 대를 짓는다 — 투명 돔, 둥근 몸통,
 * 발광 사인, 동전 투입구, 원형 크랭크 손잡이, 안쪽으로 열리는 배출구 문, 받침대.
 * 돔 안의 캡슐은 아주 단순한 스프링·중력·구 밀어내기로 움직인다(물리 엔진 없음).
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
};

export const DESKTOP_QUALITY: Quality = { capsules: 30, dpr: 2, shadowMap: 1024, transmission: true };
export const MOBILE_QUALITY: Quality = { capsules: 18, dpr: 1.5, shadowMap: 512, transmission: false };

export type SceneStage = "idle" | "crank" | "shake" | "impact" | "capsule" | "wobble" | "burst" | "result";

export type CapsuleSpec = {
  /** 위 반구 — 상품에서 잰 색. */
  color: string;
  /** 이음 링 — 등급 색. */
  ring: string;
};

/** 화면 위 자리(CSS 픽셀). HTML 오버레이 단추를 그 위에 얹을 때 쓴다. */
export type ScreenPoint = { x: number; y: number; radius: number; visible: boolean };

export type GachaScene = {
  setCapsules(specs: readonly CapsuleSpec[]): void;
  setPrizeCapsule(spec: CapsuleSpec): void;
  setAccent(hex: string): void;
  setStage(stage: SceneStage): void;
  /** 마우스 자리(-1~1). 카메라가 아주 조금 기운다. */
  setPointer(x: number, y: number): void;
  setHovered(hovered: boolean): void;
  /** 끌어서 돌리는 동안의 크랭크 각도(도). */
  setCrankAngle(degrees: number): void;
  crankAngle(): number;
  /** 상품 3D 파일을 미리 열어 둔다. 캡슐이 갈라질 때 기다리지 않게. */
  loadModel(url: string): Promise<boolean>;
  /** 텍스처·시트 상품이 대신 띄우는 그림 카드. */
  loadCard(url: string): Promise<boolean>;
  clearPrizeArt(): void;
  /** 한 프레임 진행하고 한 번 그린다. */
  frame(dtMs: number): void;
  resize(): void;
  /** 크랭크와 배출구 캡슐의 화면 자리. */
  points(): { crank: ScreenPoint; capsule: ScreenPoint; coin: ScreenPoint };
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
const CAPSULE_RADIUS = 0.088;
/** 배출구 안에 캡슐이 눕는 자리. */
const TRAY = new THREE.Vector3(0, 0.87, 0.53);
/** 캡슐이 카메라 앞으로 떠오르는 자리 — 결과 상품도 같은 자리에 선다. */
const STAGE_FRONT = new THREE.Vector3(0, 2.0, 2.55);

/** 각 단계가 몇 초짜리인지. 리액트의 시간표와 같은 값을 쓴다. */
export const STAGE_SECONDS = {
  crank: 0.75,
  shake: 1.2,
  impact: 1.1,
  wobble: 1.1,
  burst: 1.1,
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

type Capsule = {
  group: THREE.Group;
  top: THREE.MeshPhysicalMaterial;
  ring: THREE.MeshStandardMaterial;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
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
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1c2a, 0.55));

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

  // 배출구의 캡슐을 은은하게 비추는 빛. 캡슐이 떨어진 뒤에만 켜진다.
  const trayLight = new THREE.PointLight(0xffffff, 0, 2.2, 2);
  trayLight.position.set(0, 1.1, 1.35);
  scene.add(trayLight);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(6, 48).rotateX(-Math.PI / 2),
    new THREE.ShadowMaterial({ opacity: 0.22 }),
  );
  ground.position.y = 0.001;
  ground.receiveShadow = true;
  scene.add(ground);

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

  // 원형 크랭크 손잡이 — 원판 + 손잡이 바 + 잡는 혹
  const crank = new THREE.Group();
  crank.position.set(0.42, 1.28, 0.6);
  machine.add(crank);
  const crankPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 28), darkMaterial);
  crankPlate.rotation.x = Math.PI / 2;
  crankPlate.position.z = -0.03;
  crank.add(crankPlate);
  const crankDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 28), metalMaterial);
  crankDisc.rotation.x = Math.PI / 2;
  crankDisc.castShadow = true;
  crank.add(crankDisc);
  const crankFace = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.075, 24), paintMaterial);
  crankFace.rotation.x = Math.PI / 2;
  crank.add(crankFace);
  const crankBar = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.07, 0.07, 2, 0.03), metalMaterial);
  crankBar.position.set(0.0, 0, 0.06);
  crankBar.castShadow = true;
  crank.add(crankBar);
  const crankKnob = new THREE.Mesh(new THREE.SphereGeometry(0.062, 18, 14), paintMaterial);
  crankKnob.position.set(0.17, 0, 0.11);
  crankKnob.castShadow = true;
  crank.add(crankKnob);

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
      envMapIntensity: 0.3,
      side: THREE.FrontSide,
    })
    : new THREE.MeshPhysicalMaterial({
      color: 0xdce9ff,
      roughness: 0.1,
      metalness: 0,
      transparent: true,
      // 투과를 못 쓰는 기기에서는 유리를 아주 옅게 둔다. 짙게 두면 안이 안 보인다.
      opacity: 0.12,
      clearcoat: 1,
      envMapIntensity: 0.3,
      side: THREE.FrontSide,
      depthWrite: false,
    });
  // 적도보다 조금 더 내려온 유리공. 바닥(구멍이 뚫린 접시)이 그 안에 들어간다.
  const dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_RADIUS, 48, 34, 0, Math.PI * 2, 0, Math.PI * 0.76), glassMaterial);
  dome.position.copy(DOME_CENTER);
  dome.renderOrder = 2;
  machine.add(dome);
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
    capsule.group.position.copy(capsule.position);
    capsule.group.rotation.set(seeded(index, 17) * 6.28, seeded(index, 19) * 6.28, 0);
  }

  /** 배출되는 캡슐 — 쌓인 무리와 따로 움직인다. */
  const prize = buildCapsule();
  prize.group.visible = false;
  prize.group.scale.setScalar(1.55);
  machine.add(prize.group);
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
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8), backdropMaterial);
  backdrop.position.set(0, 2.0, 1.9);
  backdrop.renderOrder = 3;
  backdrop.visible = false;
  scene.add(backdrop);

  /* 빛 터짐 --------------------------------------------------------------- */
  const burstGroup = new THREE.Group();
  // 막보다 나중에 그려야 빛줄기가 막에 먹히지 않는다.
  burstGroup.renderOrder = 4;
  burstGroup.visible = false;
  machine.add(burstGroup);
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
  machine.add(prizeArt);
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
  let crankAngleDeg = 0;
  let crankAutoFrom = 0;
  let cameraShake = 0;
  let width = 1;
  let height = 1;

  function setStage(next: SceneStage): void {
    stage = next;
    stageTime = 0;
    if (next === "crank") {
      crankAutoFrom = crankAngleDeg;
    }
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
      crankAngleDeg = 0;
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

  /* 프레임 ----------------------------------------------------------------- */
  function frame(dtMs: number): void {
    const dt = Math.min(0.05, Math.max(0.001, dtMs / 1000));
    clock += dt;
    stageTime += dt;

    // 카메라 패럴랙스 — 손끝을 따라 아주 조금.
    pointerEased.lerp(pointer, reduced ? 1 : Math.min(1, dt * 4));
    const shake = cameraShake > 0 ? cameraShake : 0;
    camera.position.set(
      pointerEased.x * 0.55 + (shake ? (Math.random() - 0.5) * shake : 0),
      2.05 + pointerEased.y * 0.35 + (shake ? (Math.random() - 0.5) * shake : 0),
      4.85,
    );
    camera.lookAt(0, 1.9 + pointerEased.y * 0.1, 0);
    if (cameraShake > 0) cameraShake = Math.max(0, cameraShake - dt * 0.9);

    // 돔 위를 도는 반짝임과 하이라이트 링.
    if (!reduced) {
      sweep.position.set(Math.cos(clock * 0.6) * 1.15, 3.35, Math.sin(clock * 0.6) * 1.15);
      highlight.rotation.z = clock * 0.35;
    }

    // 사인 발광 — 마우스를 올리면 세진다.
    const wantedSign = hovered ? 2.4 : 1.05 + (reduced ? 0 : Math.sin(clock * 1.6) * 0.12);
    signMaterial.emissiveIntensity = approach(signMaterial.emissiveIntensity, wantedSign, dt * 6);

    // 크랭크
    if (stage === "crank") {
      const k = Math.min(1, stageTime / STAGE_SECONDS.crank);
      const eased = 1 - (1 - k) ** 2;
      crankAngleDeg = crankAutoFrom + eased * 360;
    } else if (stage === "idle" && !reduced) {
      // "돌려 달라" 는 듯 까딱임. 손을 올렸을 때만 크게.
      const nudge = hovered ? 9 : 2.4;
      crankAngleDeg = approach(crankAngleDeg, Math.sin(clock * 2.4) * nudge, dt * 3);
    }
    crank.rotation.z = -(crankAngleDeg * Math.PI) / 180;

    // 배출구 문 — 캡슐이 나올 때만 안쪽으로 열린다.
    const flapOpen = stage === "impact" && stageTime > 0.4 && stageTime < 0.95 ? -1.05 : 0;
    flapHinge.rotation.x = approach(flapHinge.rotation.x, flapOpen, dt * 9);

    // 배출구 조명
    const wantedTray = stage === "capsule" ? 5.5 : stage === "impact" && stageTime > 0.6 ? 3.2 : 0;
    trayLight.intensity = approach(trayLight.intensity, wantedTray, dt * 5);

    // 상품이 앞으로 나오는 동안에만 기계를 덮는다.
    const wantedBackdrop = stage === "wobble" ? 0.55 : stage === "burst" || stage === "result" ? 0.78 : 0;
    backdropMaterial.opacity = approach(backdropMaterial.opacity, wantedBackdrop, dt * 5);
    backdrop.visible = backdropMaterial.opacity > 0.01;

    if (!reduced) stepCapsules(dt, stage === "shake" || stage === "crank");

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

  ensureCapsules(quality.capsules);
  for (let index = 0; index < capsules.length; index += 1) seatCapsule(capsules[index], index);

  return {
    setCapsules(specs) {
      const count = Math.min(quality.capsules, Math.max(0, specs.length));
      ensureCapsules(count);
      for (let index = 0; index < count; index += 1) {
        const spec = specs[index];
        capsules[index].top.color.copy(toColor(spec.color));
        capsules[index].ring.color.copy(toColor(spec.ring));
        capsules[index].ring.emissive.copy(toColor(spec.ring)).multiplyScalar(0.28);
        seatCapsule(capsules[index], index);
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
    setCrankAngle(degrees) { crankAngleDeg = degrees; },
    crankAngle() { return crankAngleDeg; },
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
      const crankWorld = crank.getWorldPosition(new THREE.Vector3());
      const capsuleWorld = prize.group.getWorldPosition(new THREE.Vector3());
      const coinWorld = coinPlate.getWorldPosition(new THREE.Vector3());
      return {
        crank: project(crankWorld, 0.3),
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
      const buffer = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
      let drawn = 0;
      // 네 픽셀마다 하나씩 세고 되돌려 곱한다 — 큰 화면에서도 한 프레임 안에 끝난다.
      for (let index = 3; index < buffer.length; index += 16) {
        if (buffer[index] > 8) drawn += 1;
      }
      return drawn * 4;
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
