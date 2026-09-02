/**
 * The template registry — the single list the builder, the uploader and the runtime agree on.
 *
 * Every entry points at a factory that already exists in this repository and that already
 * produced a file the marketplace lists. Nothing here is new art: the library's whole job is
 * to make those seventeen models reachable from /studio in four colourways and at any scale,
 * instead of handing a user the 1.2 KB placeholder box the procedural lane writes.
 *
 * `paletteTargets` names the exported palette objects the builder temporarily shifts before
 * calling the factory (see ./palette.mjs). `keywords` is what the runtime falls back to when a
 * request arrives with a prompt but no templateId.
 *
 * Paths are repository-relative and are resolved against the repo root by the builder.
 */

const WAVE2_PALETTE = { module: "examples/generated/hf-wave2/wave2-kit.mjs", export: "WAVE2_PALETTE" };
const FARM_PALETTE = { module: "examples/generated/cozy-farm-set/farm-kit.mjs", export: "FARM_PALETTE" };
const GREENHOUSE_PALETTE = { module: "examples/generated/hf-greenhouse/greenhouse-kit.mjs", export: "GREENHOUSE_PALETTE" };
const TRACTOR_PALETTE = { module: "examples/generated/vehicles/tractor.factory.mjs", export: "TRACTOR_PALETTE" };
const WINDMILL_PALETTE = { module: "examples/generated/windmill.factory.mjs", export: "WINDMILL_PALETTE" };

/** A tree colourway is applied to that species' own bark and leaf ramps. */
function treePalette(key) {
  return { module: "examples/generated/harvest-frontier-trees/tree-kit.mjs", export: "TREE_TEMPLATES", path: [key] };
}

/**
 * Scale steps offered for every template. The runtime multiplies the root node by the factor,
 * so the geometry is untouched and the model stays exactly as authored — only bigger or smaller.
 */
export const SIZES = [
  { id: "s", name: "작게", scale: 0.6 },
  { id: "m", name: "기본", scale: 1 },
  { id: "l", name: "크게", scale: 1.6 },
];

export const DEFAULT_SIZE_ID = "m";
export const MIN_SCALE = 0.5;
export const MAX_SCALE = 2;

/**
 * 3D model templates. `sheet: true` means the builder also bakes an 8-direction sprite sheet
 * from the `original` colourway, which is what the sprite-atlas lane serves.
 */
export const TEMPLATES = [
  // --- HF Wave 2: crates and hay ----------------------------------------------------------
  {
    id: "crate-closed",
    name: "나무 궤짝 (닫힘)",
    kind: "3d-model",
    factory: "examples/generated/hf-wave2/crate-closed.factory.mjs",
    reference: "examples/generated/hf-wave2/crate-closed.glb",
    paletteTargets: [WAVE2_PALETTE],
    keywords: ["궤짝", "상자", "박스", "나무상자", "crate", "box", "chest"],
    sheet: true,
  },
  {
    id: "crate-open",
    name: "나무 궤짝 (열림)",
    kind: "3d-model",
    factory: "examples/generated/hf-wave2/crate-open.factory.mjs",
    reference: "examples/generated/hf-wave2/crate-open.glb",
    paletteTargets: [WAVE2_PALETTE],
    keywords: ["열린 궤짝", "열린 상자", "open crate", "open box"],
    sheet: true,
  },
  {
    id: "crate-produce",
    name: "나무 궤짝 (수확물 적재)",
    kind: "3d-model",
    factory: "examples/generated/hf-wave2/crate-produce.factory.mjs",
    reference: "examples/generated/hf-wave2/crate-produce.glb",
    paletteTargets: [WAVE2_PALETTE],
    keywords: ["사과", "과일", "수확물", "produce", "apple crate", "fruit"],
    sheet: true,
  },
  {
    id: "haystack-full",
    name: "건초 롤 (온전한 것)",
    kind: "3d-model",
    factory: "examples/generated/hf-wave2/haystack-full.factory.mjs",
    reference: "examples/generated/hf-wave2/haystack-full.glb",
    paletteTargets: [WAVE2_PALETTE],
    keywords: ["건초", "짚", "볏짚", "hay", "haystack", "straw", "bale"],
    sheet: true,
  },
  {
    id: "haystack-used",
    name: "건초 롤 (헐린 것)",
    kind: "3d-model",
    factory: "examples/generated/hf-wave2/haystack-used.factory.mjs",
    reference: "examples/generated/hf-wave2/haystack-used.glb",
    paletteTargets: [WAVE2_PALETTE],
    keywords: ["헐린 건초", "먹다 남은 건초", "used hay", "eaten bale"],
    sheet: true,
  },

  // --- Grove tree pack --------------------------------------------------------------------
  {
    id: "tree-broadleaf-round-full",
    name: "활엽수 (둥근 수관)",
    kind: "3d-model",
    factory: "examples/generated/harvest-frontier-trees/broadleaf-round-full.factory.mjs",
    reference: "examples/generated/harvest-frontier-trees/broadleaf-round-full.glb",
    paletteTargets: [treePalette("broadleaf-round-full")],
    keywords: ["나무", "활엽수", "느티나무", "tree", "broadleaf", "oak"],
    sheet: true,
  },
  {
    id: "tree-broadleaf-round-forked",
    name: "활엽수 (갈라진 둥근 수관)",
    kind: "3d-model",
    factory: "examples/generated/harvest-frontier-trees/broadleaf-round-forked.factory.mjs",
    reference: "examples/generated/harvest-frontier-trees/broadleaf-round-forked.glb",
    paletteTargets: [treePalette("broadleaf-round-forked")],
    keywords: ["갈라진 나무", "쌍둥이 나무", "forked tree"],
    sheet: true,
  },
  {
    id: "tree-broadleaf-column-tiered",
    name: "활엽수 (층진 기둥형)",
    kind: "3d-model",
    factory: "examples/generated/harvest-frontier-trees/broadleaf-column-tiered.factory.mjs",
    reference: "examples/generated/harvest-frontier-trees/broadleaf-column-tiered.glb",
    paletteTargets: [treePalette("broadleaf-column-tiered")],
    keywords: ["기둥 나무", "층진 나무", "포플러", "column tree", "poplar"],
    sheet: true,
  },
  {
    id: "tree-broadleaf-column-flame",
    name: "활엽수 (불꽃형 기둥)",
    kind: "3d-model",
    factory: "examples/generated/harvest-frontier-trees/broadleaf-column-flame.factory.mjs",
    reference: "examples/generated/harvest-frontier-trees/broadleaf-column-flame.glb",
    paletteTargets: [treePalette("broadleaf-column-flame")],
    keywords: ["불꽃 나무", "사이프러스", "flame tree", "cypress"],
    sheet: true,
  },
  {
    id: "tree-conifer-spire",
    name: "침엽수 (뾰족한 것)",
    kind: "3d-model",
    factory: "examples/generated/harvest-frontier-trees/conifer-spire.factory.mjs",
    reference: "examples/generated/harvest-frontier-trees/conifer-spire.glb",
    paletteTargets: [treePalette("conifer-spire")],
    keywords: ["침엽수", "전나무", "소나무", "conifer", "pine", "fir", "spruce"],
    sheet: true,
  },
  {
    id: "tree-conifer-umbrella",
    name: "침엽수 (우산형)",
    kind: "3d-model",
    factory: "examples/generated/harvest-frontier-trees/conifer-umbrella.factory.mjs",
    reference: "examples/generated/harvest-frontier-trees/conifer-umbrella.glb",
    paletteTargets: [treePalette("conifer-umbrella")],
    keywords: ["우산 소나무", "곰솔", "umbrella pine"],
    sheet: true,
  },

  // --- Cozy Farm Set ----------------------------------------------------------------------
  {
    id: "market-stall",
    name: "코지 마켓 스톨",
    kind: "3d-model",
    factory: "examples/generated/cozy-farm-set/market-stall.factory.mjs",
    reference: "examples/generated/cozy-farm-set/market-stall.m1.glb",
    paletteTargets: [FARM_PALETTE],
    keywords: ["노점", "가판대", "시장", "상점", "stall", "market", "shop"],
    sheet: true,
  },
  {
    id: "storage-shed",
    name: "코지 창고 헛간",
    kind: "3d-model",
    factory: "examples/generated/cozy-farm-set/storage-shed.factory.mjs",
    reference: "examples/generated/cozy-farm-set/storage-shed.m1.glb",
    paletteTargets: [FARM_PALETTE],
    keywords: ["헛간", "창고", "오두막", "shed", "barn", "hut"],
    sheet: true,
  },
  {
    id: "fence-gate",
    name: "코지 울타리 문",
    kind: "3d-model",
    factory: "examples/generated/cozy-farm-set/fence-gate.factory.mjs",
    reference: "examples/generated/cozy-farm-set/fence-gate.m1.glb",
    paletteTargets: [FARM_PALETTE],
    keywords: ["울타리", "문", "대문", "펜스", "fence", "gate"],
    sheet: true,
  },
  {
    id: "greenhouse",
    name: "코지 온실",
    kind: "3d-model",
    factory: "examples/generated/hf-greenhouse/greenhouse.factory.mjs",
    reference: "examples/generated/hf-greenhouse/greenhouse.m1.glb",
    paletteTargets: [GREENHOUSE_PALETTE],
    keywords: ["온실", "비닐하우스", "유리집", "greenhouse", "glasshouse"],
    sheet: true,
  },

  // --- Vehicles and machines --------------------------------------------------------------
  {
    id: "tractor",
    name: "농장 트랙터",
    kind: "3d-model",
    factory: "examples/generated/vehicles/tractor.factory.mjs",
    reference: "examples/generated/vehicles/tractor.glb",
    paletteTargets: [TRACTOR_PALETTE],
    keywords: ["트랙터", "경운기", "농기계", "차", "tractor", "vehicle"],
    sheet: true,
  },
  {
    id: "windmill",
    name: "농장 풍차",
    kind: "3d-model",
    factory: "examples/generated/windmill.factory.mjs",
    reference: "examples/generated/farm-windmill.m1.glb",
    paletteTargets: [WINDMILL_PALETTE],
    keywords: ["풍차", "물레방아", "방앗간", "windmill", "mill"],
    sheet: true,
  },
];

/**
 * Animation templates.
 *
 * Two kinds, and the difference is stated in the library rather than hidden:
 *
 *   - `pivotClip`: the factory already ships a named hinge node with a documented axis and a
 *     documented closed position (fence gate `gate_pivot`, shed `door_pivot`, windmill
 *     `blades_pivot`). The builder authors a real glTF animation on that node and bakes it in
 *     every colourway. The motion is a keyframed rotation of the socket the author published,
 *     not a guess about the geometry.
 *   - `passthrough`: a rigged Harvest Frontier export that already carries its own clips. It is
 *     copied byte-for-byte into the library — one colourway, `original`, because a skinned
 *     rig's colour lives in material data the palette transform above does not own.
 */
export const ANIMATION_TEMPLATES = [
  {
    id: "fence-gate-swing",
    name: "울타리 문 여닫기",
    kind: "animation-clip",
    mode: "pivotClip",
    factory: "examples/generated/cozy-farm-set/fence-gate.factory.mjs",
    paletteTargets: [FARM_PALETTE],
    keywords: ["문 열기", "여닫기", "울타리 문", "gate", "open gate", "swing"],
    clip: {
      name: "swing",
      koreanName: "여닫기",
      node: "gate_pivot",
      axis: "y",
      // The factory documents: rotate about +Y, negative opens, zero is shut and latched.
      keys: [
        { time: 0, degrees: 0 },
        { time: 1.2, degrees: -95 },
        { time: 1.8, degrees: -95 },
        { time: 3, degrees: 0 },
      ],
    },
  },
  {
    id: "storage-shed-door",
    name: "헛간 문 열기",
    kind: "animation-clip",
    mode: "pivotClip",
    factory: "examples/generated/cozy-farm-set/storage-shed.factory.mjs",
    paletteTargets: [FARM_PALETTE],
    keywords: ["헛간 문", "창고 문", "문 열기", "shed door", "barn door"],
    clip: {
      name: "door",
      koreanName: "문 열기",
      node: "door_pivot",
      axis: "y",
      keys: [
        { time: 0, degrees: 0 },
        { time: 1.4, degrees: -105 },
        { time: 2.2, degrees: -105 },
        { time: 3.6, degrees: 0 },
      ],
    },
  },
  {
    id: "windmill-spin",
    name: "풍차 날개 돌기",
    kind: "animation-clip",
    mode: "pivotClip",
    factory: "examples/generated/windmill.factory.mjs",
    paletteTargets: [WINDMILL_PALETTE],
    keywords: ["풍차", "도는", "회전", "날개", "windmill", "spin", "rotate"],
    clip: {
      name: "blades-spin",
      koreanName: "날개 회전",
      node: "blades_pivot",
      axis: "z",
      loop: true,
      // A full turn split into quarters so LINEAR quaternion interpolation takes the short way
      // round each time instead of collapsing a 360-degree key pair into no motion at all.
      keys: [
        { time: 0, degrees: 0 },
        { time: 1, degrees: 90 },
        { time: 2, degrees: 180 },
        { time: 3, degrees: 270 },
        { time: 4, degrees: 360 },
      ],
    },
  },
  {
    id: "farmhand",
    name: "팜핸드 (밀짚모자 농부)",
    kind: "animation-clip",
    mode: "passthrough",
    source: "examples/harvest-frontier/exports/npc/player-farmhand.m1.glb",
    keywords: ["농부", "캐릭터", "사람", "일꾼", "farmer", "farmhand", "character", "walk"],
  },
];

/** Every template the library knows about, whatever its kind. */
export function allTemplates() {
  return [...TEMPLATES, ...ANIMATION_TEMPLATES];
}
