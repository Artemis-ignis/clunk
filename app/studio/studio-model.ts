import type { AssetKind } from "../../packages/core/src/assetops-contract";

export type StudioCapabilityStatus = "AVAILABLE" | "ADAPTER_REQUIRED" | "ENVIRONMENT_UNAVAILABLE";

export type StudioSeriesId = "asset-forge" | "sprite-lab" | "material-lab" | "motion-lab";

export type StudioSeriesOption = {
  id: StudioSeriesId;
  label: string;
  assetKind: AssetKind;
  description: string;
};

export type StudioAssetCard = {
  id: AssetKind;
  family: "2D" | "3D";
  label: string;
  shortLabel: string;
  description: string;
  createStatus: StudioCapabilityStatus;
  inspectStatus: StudioCapabilityStatus;
  attachStatus: StudioCapabilityStatus;
  recipeId: string;
  formats: string;
  limitation: string;
};

export type StudioEngineTarget = {
  id: string;
  label: string;
  profileId: string;
  runtimeStatus: StudioCapabilityStatus;
  detail: string;
};

export const STUDIO_SERIES_OPTIONS: readonly StudioSeriesOption[] = [
  {
    id: "asset-forge",
    label: "Clunk Asset Forge",
    assetKind: "3d-model",
    description: "3D reference·prompt authoring과 GLB handoff",
  },
  {
    id: "sprite-lab",
    label: "Clunk Sprite Lab",
    assetKind: "sprite-atlas",
    description: "2D sprite·Atlas·Spine bundle",
  },
  {
    id: "material-lab",
    label: "Clunk Material Lab",
    assetKind: "2d-image",
    description: "PBR map과 material graph",
  },
  {
    id: "motion-lab",
    label: "Clunk Motion Lab",
    assetKind: "animation-clip",
    description: "Animation clip과 loop evidence",
  },
] as const;

export const STUDIO_ASSET_CARDS: readonly StudioAssetCard[] = [
  {
    id: "2d-image",
    family: "2D",
    label: "2D Sprite",
    shortLabel: "Sprite / Frame",
    description: "단일 PNG 스프라이트와 프레임 이미지를 만들고 실제 픽셀·메모리 정책을 검사합니다.",
    createStatus: "AVAILABLE",
    inspectStatus: "AVAILABLE",
    attachStatus: "AVAILABLE",
    recipeId: "sprite-sheet-factory-v1",
    formats: "PNG · JPG · WebP",
    limitation: "이 레시피는 규격에 맞는 스프라이트를 코드로 그립니다. 프롬프트대로 그림을 그려 주는 이미지 생성은 아직 이 화면에 없습니다.",
  },
  {
    id: "sprite-atlas",
    family: "2D",
    label: "Sprite Atlas",
    shortLabel: "Atlas + Regions",
    description: "Atlas page와 region bounds, 중복 이름, trim 관계를 한 bundle로 관리합니다.",
    createStatus: "AVAILABLE",
    inspectStatus: "AVAILABLE",
    attachStatus: "AVAILABLE",
    recipeId: "sprite-atlas-factory-v1",
    formats: ".atlas + PNG",
    limitation: "엔진별 atlas importer/runtime 재생은 실제 runner가 제공된 경우에만 PASS입니다.",
  },
  {
    id: "spine-project",
    family: "2D",
    label: "Spine Rig",
    shortLabel: "Bones / Slots / Clips",
    description: "Spine JSON, atlas, texture를 관계가 끊기지 않는 multi-file bundle로 만들고 점검합니다.",
    createStatus: "AVAILABLE",
    inspectStatus: "AVAILABLE",
    attachStatus: "AVAILABLE",
    recipeId: "spine-json-factory-v1",
    formats: "JSON · .atlas · PNG",
    limitation: "바이너리 .skel 파서는 아직 미지원이며 Spine/엔진 playback은 runtime evidence가 필요합니다.",
  },
  {
    id: "animation-clip",
    family: "3D",
    label: "Animation Clip",
    shortLabel: "Motion / Loop",
    description: "glTF animation clip의 sampler, target node, duration, root motion을 검사합니다.",
    createStatus: "AVAILABLE",
    inspectStatus: "AVAILABLE",
    attachStatus: "AVAILABLE",
    recipeId: "threejs-animation-factory-v1",
    formats: "GLB · glTF",
    limitation: "정적 clip PASS는 실제 renderer playback·loop continuity PASS가 아닙니다.",
  },
  {
    id: "3d-model",
    family: "3D",
    label: "3D Model",
    shortLabel: "Mesh / Material / Rig",
    description: "Three.js factory 또는 실제 GLB/GLTF의 mesh, material, bounds, animation을 파이프라인에 넣습니다.",
    createStatus: "AVAILABLE",
    inspectStatus: "AVAILABLE",
    attachStatus: "AVAILABLE",
    recipeId: "threejs-factory-v1",
    formats: "GLB · glTF",
    limitation: "구조 score=100은 shipped player-facing visual approval로 자동 승격되지 않습니다.",
  },
] as const;

export const STUDIO_ENGINE_TARGETS: readonly StudioEngineTarget[] = [
  {
    id: "web-three",
    label: "Web / Three.js",
    profileId: "harvest-frontier-web-three",
    runtimeStatus: "AVAILABLE",
    detail: "구조 contract와 WebGL/WebGPU frame evidence를 연결할 수 있습니다.",
  },
  {
    id: "godot",
    label: "Godot 4",
    profileId: "godot-4",
    runtimeStatus: "ENVIRONMENT_UNAVAILABLE",
    detail: "Godot executable/project runner가 제출될 때까지 import/runtime은 미판정입니다.",
  },
  {
    id: "unity",
    label: "Unity",
    profileId: "unity",
    runtimeStatus: "ENVIRONMENT_UNAVAILABLE",
    detail: "Unity Asset Database/editor smoke runner가 연결될 때까지 환경 미제공입니다.",
  },
  {
    id: "unreal",
    label: "Unreal",
    profileId: "unreal",
    runtimeStatus: "ENVIRONMENT_UNAVAILABLE",
    detail: "Unreal importer/commandlet runner가 없으면 runtime PASS를 만들지 않습니다.",
  },
  {
    id: "mobile",
    label: "Mobile",
    profileId: "android",
    runtimeStatus: "ENVIRONMENT_UNAVAILABLE",
    detail: "Android/iOS 기기·렌더러 evidence가 없으면 device gate는 unavailable입니다.",
  },
] as const;

export const STUDIO_WORKFLOW_STEPS = [
  { index: "01", label: "CREATE", detail: "authoring adapter" },
  { index: "02", label: "INSPECT", detail: "bytes + structure" },
  { index: "03", label: "ATTACH", detail: "engine target" },
  { index: "04", label: "REVIEW", detail: "runtime + human" },
] as const;

export function studioAsset(id: AssetKind): StudioAssetCard {
  return STUDIO_ASSET_CARDS.find((item) => item.id === id) ?? STUDIO_ASSET_CARDS[0];
}

export function studioSeries(id: StudioSeriesId): StudioSeriesOption {
  return STUDIO_SERIES_OPTIONS.find((item) => item.id === id) ?? STUDIO_SERIES_OPTIONS[0];
}

export function seriesForAssetKind(id: AssetKind): StudioSeriesId {
  if (id === "animation-clip") return "motion-lab";
  if (id === "3d-model") return "asset-forge";
  if (id === "2d-image") return "sprite-lab";
  return "sprite-lab";
}

export function studioEngine(id: string): StudioEngineTarget {
  return STUDIO_ENGINE_TARGETS.find((item) => item.id === id) ?? STUDIO_ENGINE_TARGETS[0];
}

export function buildStudioCommand(assetKind: AssetKind, profileId: string): string {
  const card = studioAsset(assetKind);
  if (assetKind === "3d-model") {
    return `npm.cmd run asset:generate -- --factory examples/generated/windmill.factory.mjs --target-profile ${profileId} --recipe-id ${card.recipeId} --recipe-version 1.0.0 --output-directory output/generated`;
  }
  return `npm.cmd run asset:author -- --asset-kind ${assetKind} --target-profile ${profileId} --recipe-id ${card.recipeId} --recipe-version 1.0.0 --output-directory output/generated`;
}
