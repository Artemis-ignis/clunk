import type {
  AssetKind,
  TargetProfile,
} from "./assetops-contract";

/*
 * 예산값의 출처.
 *
 * 2026-09-05 이전에는 unity / godot-4 / unreal / web-three-mobile 이 `inspectionPolicy`
 * 를 하나도 선언하지 않았다. 그래서 assetops-pipeline 의 legacyPolicy() 가 platform 과
 * 프로파일 id 의 문자열을 보고 packages/core/src/index.ts 의 PROFILE_DEFAULTS
 * (web / mobile / pc) 가운데 하나를 골라 썼다 — 예산이 코드 두 곳에 흩어져 있었고,
 * 응답 어디에도 "이 프로파일이 무엇을 예산으로 쓰는가"가 적히지 않았다.
 *
 * 아래 숫자는 새로 지어낸 것이 아니라 **오늘 그렇게 풀리고 있는 값을 그대로 적은 것**이다:
 *   - maxTriangles / maxMaterials / maxTextureMemoryBytes → PROFILE_DEFAULTS 의
 *     pc(250,000 · 24 · 512 MiB) 또는 mobile(25,000 · 6 · 64 MiB)
 *   - maxTextureDimension → 각 프로파일이 이미 선언하고 있던 texturePolicy.maxDimension
 * 즉 이 커밋은 판정을 바꾸지 않고 예산을 프로파일에 드러내 놓기만 한다. 값을 바꾸려면
 * 근거를 여기 적고 바꿔야 한다.
 */
const PC_BUDGET = {
  maxTriangles: 250_000,
  maxMaterials: 24,
  maxTextureMemoryBytes: 512 * 1024 * 1024,
} as const;
const MOBILE_BUDGET = {
  maxTriangles: 25_000,
  maxMaterials: 6,
  maxTextureMemoryBytes: 64 * 1024 * 1024,
} as const;

const MODEL_KINDS: readonly AssetKind[] = ["3d-model", "animation-clip"];
const TWO_D_KINDS: readonly AssetKind[] = ["2d-image", "sprite-atlas", "spine-project"];
const ALL_KINDS: readonly AssetKind[] = [...MODEL_KINDS, ...TWO_D_KINDS];

const PROFILES: readonly TargetProfile[] = [
  {
    id: "yeongheo-pixi-2d",
    label: "영허검가 PixiJS 2D",
    engine: "pixi-js",
    engineVersion: "8.x",
    platform: "web",
    renderer: "WebGL2",
    importer: { id: "pixi.Texture.from" },
    plugins: [],
    acceptedFormats: ["png", "jpg", "jpeg", "webp", "json", "atlas"],
    assetKinds: ["2d-image", "sprite-atlas", "spine-project"],
    coordinateSystem: { up: "y", forward: "z", unitMeters: 1 },
    texturePolicy: {
      maxDimension: 4096,
      formats: ["png", "jpeg", "webp"],
      memoryBudgetBytes: 128 * 1024 * 1024,
      compression: ["webgl-compatible"],
    },
    animationPolicy: { rootMotion: "forbidden" },
    semanticRules: ["pixi-sprite-atlas-v1"],
  },
  /*
   * 하베스트 프론티어 납품 계약.
   *
   * 이 프로파일의 semanticRules(harvest-frontier-runtime-v1)는 HF 런타임이 요구하는
   * 노드 이름 규약(HF-ROOT-NODE / HF-ATTACHMENT-SOCKET / HF-COLLIDER / HF-PIVOT)과
   * EXT_meshopt_compression(HF-MESHOPT)을 ERROR 로 요구한다. 그것은 그 게임에 파일을
   * 넘기는 계약이지 일반 3D 파일의 품질 기준이 아니다 — 우리가 마켓에 파는 GLB 는
   * 일부러 압축하지 않고 extensionsRequired 를 비워 두므로 이 프로파일에서는 언제나
   * BLOCKED 가 된다.
   *
   * 일반 검사에는 web-three-mobile(웹/모바일) 이나 unity / godot-4 / unreal 을 쓰라.
   */
  {
    id: "harvest-frontier-web-three",
    label: "Harvest Frontier Web / Three.js (HF 납품 전용)",
    engine: "web-three",
    engineVersion: "detected",
    platform: "web",
    renderer: "WebGL2",
    importer: { id: "three.GLTFLoader" },
    plugins: [],
    acceptedFormats: ["glb", "gltf", "png", "jpg", "jpeg", "webp", "json", "atlas", "skel"],
    assetKinds: ALL_KINDS,
    coordinateSystem: { up: "y", forward: "z", unitMeters: 1 },
    texturePolicy: {
      maxDimension: 4096,
      formats: ["png", "jpeg", "webp"],
      memoryBudgetBytes: 128 * 1024 * 1024,
      compression: ["webgl-compatible"],
    },
    // resolvePolicy reads these with `?? base`, so a literal 0 is a real budget
    // of zero, not "unset" — any GLB carrying a texture was auto-BLOCKED under
    // the profile named after the game whose textures we were meant to check.
    // The two texture numbers are the ones texturePolicy above already declares.
    inspectionPolicy: { maxTriangles: 40000, maxMaterials: 64, maxTextureMemoryBytes: 128 * 1024 * 1024, maxTextureDimension: 4096 },
    animationPolicy: { rootMotion: "any" },
    semanticRules: ["harvest-frontier-runtime-v1"],
  },
  {
    id: "godot-4",
    label: "Godot 4",
    engine: "godot",
    engineVersion: "4.x",
    platform: "desktop",
    importer: { id: "godot.import" },
    plugins: [],
    acceptedFormats: ["glb", "gltf", "png", "jpg", "jpeg", "webp", "tscn"],
    assetKinds: ALL_KINDS,
    coordinateSystem: { up: "y", forward: "z", unitMeters: 1 },
    texturePolicy: { maxDimension: 4096, formats: ["png", "jpg", "webp"] },
    // 데스크톱 타깃이라 오늘도 PROFILE_DEFAULTS.pc 로 풀린다. 그 값을 그대로 적는다.
    inspectionPolicy: { ...PC_BUDGET, maxTextureDimension: 4096 },
    animationPolicy: { rootMotion: "any" },
  },
  {
    id: "unity",
    label: "Unity Editor",
    engine: "unity",
    engineVersion: "detected",
    platform: "desktop",
    importer: { id: "unity.asset-database" },
    plugins: [],
    acceptedFormats: ["fbx", "glb", "gltf", "png", "jpg", "jpeg", "webp"],
    assetKinds: ALL_KINDS,
    coordinateSystem: { up: "y", forward: "z", unitMeters: 1 },
    texturePolicy: { maxDimension: 4096, formats: ["png", "jpg", "webp"] },
    // 데스크톱 타깃이라 오늘도 PROFILE_DEFAULTS.pc 로 풀린다. 그 값을 그대로 적는다.
    inspectionPolicy: { ...PC_BUDGET, maxTextureDimension: 4096 },
    animationPolicy: { rootMotion: "any" },
  },
  {
    id: "unreal",
    label: "Unreal Engine",
    engine: "unreal",
    engineVersion: "detected",
    platform: "desktop",
    importer: { id: "unreal.importer" },
    plugins: [],
    acceptedFormats: ["fbx", "gltf", "glb", "png", "jpg", "jpeg", "exr"],
    assetKinds: ALL_KINDS,
    coordinateSystem: { up: "z", forward: "x", unitMeters: 0.01 },
    texturePolicy: { maxDimension: 8192, formats: ["png", "jpg", "exr"] },
    // 데스크톱 타깃이라 오늘도 PROFILE_DEFAULTS.pc 로 풀린다. 텍스처 상한만 이 프로파일이
    // 이미 선언하고 있던 8192 를 쓴다.
    inspectionPolicy: { ...PC_BUDGET, maxTextureDimension: 8192 },
    animationPolicy: { rootMotion: "any" },
  },
  {
    id: "web-three-mobile",
    label: "Web / Three.js Mobile",
    engine: "web-three",
    engineVersion: "detected",
    platform: "web",
    renderer: "WebGL2",
    importer: { id: "three.GLTFLoader" },
    plugins: [],
    acceptedFormats: ["glb", "gltf", "png", "jpg", "jpeg", "webp", "json", "atlas", "skel"],
    assetKinds: ALL_KINDS,
    coordinateSystem: { up: "y", forward: "z", unitMeters: 1 },
    texturePolicy: {
      maxDimension: 2048,
      formats: ["png", "jpeg", "webp"],
      memoryBudgetBytes: 64 * 1024 * 1024,
      compression: ["webgl-compatible", "basisu-optional"],
    },
    // id 에 "mobile" 이 들어 있어 오늘도 PROFILE_DEFAULTS.mobile 로 풀린다 — 문자열
    // 일치에 기대던 것을 값으로 적는다. 텍스처 두 값은 위 texturePolicy 가 이미 선언한 것.
    inspectionPolicy: { ...MOBILE_BUDGET, maxTextureDimension: 2048 },
    animationPolicy: { rootMotion: "any" },
  },
  {
    id: "android",
    label: "Android Game Target",
    engine: "unity",
    engineVersion: "detected",
    platform: "android",
    importer: { id: "engine-project-import" },
    plugins: [],
    acceptedFormats: ["fbx", "glb", "gltf", "png", "jpg", "jpeg", "webp"],
    assetKinds: ALL_KINDS,
    coordinateSystem: { up: "y", forward: "z", unitMeters: 1 },
    texturePolicy: {
      maxDimension: 2048,
      formats: ["png", "jpg", "webp", "astc", "etc2"],
      memoryBudgetBytes: 64 * 1024 * 1024,
      compression: ["astc", "etc2"],
    },
    // platform "android" 라 오늘도 PROFILE_DEFAULTS.mobile 로 풀린다.
    inspectionPolicy: { ...MOBILE_BUDGET, maxTextureDimension: 2048 },
    animationPolicy: { rootMotion: "any" },
    requiresDeviceGate: true,
  },
  {
    id: "ios",
    label: "iOS Game Target",
    engine: "unity",
    engineVersion: "detected",
    platform: "ios",
    importer: { id: "engine-project-import" },
    plugins: [],
    acceptedFormats: ["fbx", "glb", "gltf", "png", "jpg", "jpeg", "webp"],
    assetKinds: ALL_KINDS,
    coordinateSystem: { up: "y", forward: "z", unitMeters: 1 },
    texturePolicy: {
      maxDimension: 2048,
      formats: ["png", "jpg", "webp", "astc"],
      memoryBudgetBytes: 64 * 1024 * 1024,
      compression: ["astc"],
    },
    // platform "ios" 라 오늘도 PROFILE_DEFAULTS.mobile 로 풀린다.
    inspectionPolicy: { ...MOBILE_BUDGET, maxTextureDimension: 2048 },
    animationPolicy: { rootMotion: "any" },
    requiresDeviceGate: true,
  },
];

export function getBuiltInTargetProfiles(): readonly TargetProfile[] {
  return PROFILES;
}

export function getBuiltInTargetProfile(id: string): TargetProfile | undefined {
  return PROFILES.find((profile) => profile.id === id);
}
