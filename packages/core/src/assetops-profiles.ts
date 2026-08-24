import type {
  AssetKind,
  TargetProfile,
} from "./assetops-contract";

const MODEL_KINDS: readonly AssetKind[] = ["3d-model", "animation-clip"];
const TWO_D_KINDS: readonly AssetKind[] = ["2d-image", "sprite-atlas", "spine-project"];
const ALL_KINDS: readonly AssetKind[] = [...MODEL_KINDS, ...TWO_D_KINDS];

const PROFILES: readonly TargetProfile[] = [
  {
    id: "harvest-frontier-web-three",
    label: "Harvest Frontier Web / Three.js",
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
    inspectionPolicy: { maxTriangles: 40000, maxMaterials: 64, maxTextureMemoryBytes: 0, maxTextureDimension: 0 },
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
