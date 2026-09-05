/**
 * The template registry — the single list the builder, the uploader and the runtime agree on.
 *
 * Every entry points at a factory that already exists in this repository and that already
 * produced a file the marketplace lists. Nothing here is new art: the library's whole job is
 * to make those sixty-three models reachable from /studio in six colourways and at any scale,
 * instead of handing a user the 1.2 KB placeholder box the procedural lane writes.
 *
 * The three kits (Village Square, Fishing Dock, Mine Entrance) are the exception to one habit
 * above: their `reference` names the file public/market/<slug>/<slug>.glb that the marketplace
 * actually ships, because those factories leave no intermediate export under examples/. That
 * shipped file is NOT a plain factory bake — the village and mine kits pass it through
 * glTF-Transform and all three export with `onlyVisible: false` / `trs: true` plus their own
 * clips — so none of them belongs in scripts/template-library/verify-factories.mjs's PAIRS,
 * which asserts a byte-for-byte match against a plain `{ binary: true }` re-bake.
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
const VILLAGE_PALETTE = { module: "examples/generated/kits/village-square/village-kit.mjs", export: "VILLAGE_PALETTE" };
const DOCK_PALETTE = { module: "examples/generated/kits/fishing-dock/dock-kit.mjs", export: "DOCK_PALETTE" };
const MINE_PALETTE = { module: "examples/generated/kits/mine-entrance/mine-kit.mjs", export: "MINE_PALETTE" };

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

  // --- Village Square kit -----------------------------------------------------------------
  {
    id: "village-well",
    name: "마을 돌우물",
    kind: "3d-model",
    factory: "examples/generated/kits/village-square/well.factory.mjs",
    reference: "public/market/village-well/village-well.glb",
    paletteTargets: [VILLAGE_PALETTE],
    keywords: ["우물", "두레박", "도르래", "샘", "well", "draw well", "bucket"],
    sheet: true,
  },
  {
    id: "village-bench",
    name: "마을 나무 벤치",
    kind: "3d-model",
    factory: "examples/generated/kits/village-square/bench.factory.mjs",
    reference: "public/market/village-bench/village-bench.glb",
    paletteTargets: [VILLAGE_PALETTE],
    keywords: ["벤치", "의자", "긴 의자", "공원 의자", "bench", "seat"],
    sheet: true,
  },
  {
    id: "village-lamp-post",
    name: "마을 가로등",
    kind: "3d-model",
    factory: "examples/generated/kits/village-square/lamp-post.factory.mjs",
    reference: "public/market/village-lamp-post/village-lamp-post.glb",
    paletteTargets: [VILLAGE_PALETTE],
    keywords: ["가로등", "등불", "기름등", "가로등주", "lamp", "lamp post", "street light", "lantern"],
    sheet: true,
  },
  {
    id: "village-signpost",
    name: "마을 방향 표지목",
    kind: "3d-model",
    factory: "examples/generated/kits/village-square/signpost.factory.mjs",
    reference: "public/market/village-signpost/village-signpost.glb",
    paletteTargets: [VILLAGE_PALETTE],
    keywords: ["표지판", "이정표", "팻말", "방향", "signpost", "fingerpost", "sign"],
    sheet: true,
  },
  {
    id: "village-fountain",
    name: "마을 돌 분수",
    kind: "3d-model",
    factory: "examples/generated/kits/village-square/fountain.factory.mjs",
    reference: "public/market/village-fountain/village-fountain.glb",
    paletteTargets: [VILLAGE_PALETTE],
    keywords: ["분수", "물", "수반", "샘터", "fountain", "water"],
    sheet: true,
  },
  {
    id: "village-planter-box",
    name: "나무 화분 통",
    kind: "3d-model",
    factory: "examples/generated/kits/village-square/planter-box.factory.mjs",
    reference: "public/market/village-planter-box/village-planter-box.glb",
    paletteTargets: [VILLAGE_PALETTE],
    keywords: ["화분", "꽃", "화단", "나무 화분", "planter", "flower box"],
    sheet: true,
  },
  {
    id: "village-planter-urn",
    name: "돌 항아리 화분",
    kind: "3d-model",
    factory: "examples/generated/kits/village-square/planter-urn.factory.mjs",
    reference: "public/market/village-planter-urn/village-planter-urn.glb",
    paletteTargets: [VILLAGE_PALETTE],
    keywords: ["항아리", "돌 화분", "꽃 항아리", "urn", "stone planter"],
    sheet: true,
  },
  {
    id: "village-postbox",
    name: "마을 우편함",
    kind: "3d-model",
    factory: "examples/generated/kits/village-square/postbox.factory.mjs",
    reference: "public/market/village-postbox/village-postbox.glb",
    paletteTargets: [VILLAGE_PALETTE],
    keywords: ["우편함", "편지함", "우체통", "postbox", "mailbox", "letter box"],
    sheet: true,
  },
  {
    id: "village-noticeboard",
    name: "마을 게시판",
    kind: "3d-model",
    factory: "examples/generated/kits/village-square/noticeboard.factory.mjs",
    reference: "public/market/village-noticeboard/village-noticeboard.glb",
    paletteTargets: [VILLAGE_PALETTE],
    keywords: ["게시판", "공고", "벽보", "알림판", "notice board", "bulletin board"],
    sheet: true,
  },
  {
    id: "village-path-straight",
    name: "돌길 타일 (직선)",
    kind: "3d-model",
    factory: "examples/generated/kits/village-square/path-straight.factory.mjs",
    reference: "public/market/village-path-straight/village-path-straight.glb",
    paletteTargets: [VILLAGE_PALETTE],
    keywords: ["돌길", "포장", "바닥", "타일", "길", "path", "cobble", "paving", "road"],
    sheet: true,
  },
  {
    id: "village-path-corner",
    name: "돌길 타일 (모서리)",
    kind: "3d-model",
    factory: "examples/generated/kits/village-square/path-corner.factory.mjs",
    reference: "public/market/village-path-corner/village-path-corner.glb",
    paletteTargets: [VILLAGE_PALETTE],
    keywords: ["돌길 모서리", "길 꺾임", "코너", "path corner", "cobble corner"],
    sheet: true,
  },
  {
    id: "village-path-crossing",
    name: "돌길 타일 (교차로)",
    kind: "3d-model",
    factory: "examples/generated/kits/village-square/path-crossing.factory.mjs",
    reference: "public/market/village-path-crossing/village-path-crossing.glb",
    paletteTargets: [VILLAGE_PALETTE],
    keywords: ["교차로", "네거리", "길 교차", "crossing", "crossroads", "path junction"],
    sheet: true,
  },
  {
    id: "village-wall-straight",
    name: "낮은 돌담 (직선)",
    kind: "3d-model",
    factory: "examples/generated/kits/village-square/wall-straight.factory.mjs",
    reference: "public/market/village-wall-straight/village-wall-straight.glb",
    paletteTargets: [VILLAGE_PALETTE],
    keywords: ["돌담", "담장", "낮은 담", "석축", "stone wall", "low wall"],
    sheet: true,
  },
  {
    id: "village-wall-corner",
    name: "낮은 돌담 (모서리)",
    kind: "3d-model",
    factory: "examples/generated/kits/village-square/wall-corner.factory.mjs",
    reference: "public/market/village-wall-corner/village-wall-corner.glb",
    paletteTargets: [VILLAGE_PALETTE],
    keywords: ["돌담 모서리", "담 코너", "stone wall corner"],
    sheet: true,
  },
  {
    id: "village-bell-tower",
    name: "마을 종탑",
    kind: "3d-model",
    factory: "examples/generated/kits/village-square/bell-tower.factory.mjs",
    reference: "public/market/village-bell-tower/village-bell-tower.glb",
    paletteTargets: [VILLAGE_PALETTE],
    keywords: ["종탑", "종", "종각", "bell", "bell tower", "belfry"],
    sheet: true,
  },

  // --- Fishing Dock Kit: deck -------------------------------------------------------------
  {
    id: "dock-plank-straight",
    name: "부두 판자 모듈 (곧은 것)",
    kind: "3d-model",
    factory: "examples/generated/kits/fishing-dock/dock-plank-straight.factory.mjs",
    reference: "public/market/dock-plank-straight/dock-plank-straight.glb",
    paletteTargets: [DOCK_PALETTE],
    keywords: ["부두", "잔교", "선착장", "갑판", "판자", "dock", "pier", "jetty", "deck", "plank"],
    sheet: true,
  },
  {
    id: "dock-plank-corner",
    name: "부두 판자 모듈 (모서리)",
    kind: "3d-model",
    factory: "examples/generated/kits/fishing-dock/dock-plank-corner.factory.mjs",
    reference: "public/market/dock-plank-corner/dock-plank-corner.glb",
    paletteTargets: [DOCK_PALETTE],
    keywords: ["부두 모서리", "꺾인 부두", "코너", "dock corner", "pier corner"],
    sheet: true,
  },
  {
    id: "dock-plank-end",
    name: "부두 판자 모듈 (끝)",
    kind: "3d-model",
    factory: "examples/generated/kits/fishing-dock/dock-plank-end.factory.mjs",
    reference: "public/market/dock-plank-end/dock-plank-end.glb",
    paletteTargets: [DOCK_PALETTE],
    keywords: ["부두 끝", "잔교 끝", "dock end", "pier end"],
    sheet: true,
  },
  {
    id: "dock-piling",
    name: "계선 말뚝",
    kind: "3d-model",
    factory: "examples/generated/kits/fishing-dock/dock-piling.factory.mjs",
    reference: "public/market/dock-piling/dock-piling.glb",
    paletteTargets: [DOCK_PALETTE],
    keywords: ["말뚝", "기둥", "파일", "piling", "pile", "post"],
    sheet: true,
  },
  {
    id: "dock-bollard",
    name: "주철 계선주",
    kind: "3d-model",
    factory: "examples/generated/kits/fishing-dock/dock-bollard.factory.mjs",
    reference: "public/market/dock-bollard/dock-bollard.glb",
    paletteTargets: [DOCK_PALETTE],
    keywords: ["계선주", "볼라드", "밧줄 걸이", "bollard", "mooring"],
    sheet: true,
  },

  // --- Fishing Dock Kit: what stands on the deck ------------------------------------------
  {
    id: "dock-lantern-post",
    name: "등불 기둥",
    kind: "3d-model",
    factory: "examples/generated/kits/fishing-dock/dock-lantern-post.factory.mjs",
    reference: "public/market/dock-lantern-post/dock-lantern-post.glb",
    paletteTargets: [DOCK_PALETTE],
    keywords: ["등불", "가로등", "랜턴", "등", "lantern", "lamp post", "light"],
    sheet: true,
  },
  {
    id: "dock-rod-rack",
    name: "낚싯대 거치대",
    kind: "3d-model",
    factory: "examples/generated/kits/fishing-dock/dock-rod-rack.factory.mjs",
    reference: "public/market/dock-rod-rack/dock-rod-rack.glb",
    paletteTargets: [DOCK_PALETTE],
    keywords: ["낚싯대", "낚시", "거치대", "받침대", "fishing rod", "rod rack"],
    sheet: true,
  },
  {
    id: "dock-fish-crate-closed",
    name: "생선 상자 (닫힘)",
    kind: "3d-model",
    factory: "examples/generated/kits/fishing-dock/dock-fish-crate-closed.factory.mjs",
    reference: "public/market/dock-fish-crate-closed/dock-fish-crate-closed.glb",
    paletteTargets: [DOCK_PALETTE],
    keywords: ["생선 상자", "어상자", "살대 상자", "fish crate", "fish box"],
    sheet: true,
  },
  {
    id: "dock-fish-crate-open",
    name: "생선 상자 (열림·생선 담김)",
    kind: "3d-model",
    factory: "examples/generated/kits/fishing-dock/dock-fish-crate-open.factory.mjs",
    reference: "public/market/dock-fish-crate-open/dock-fish-crate-open.glb",
    paletteTargets: [DOCK_PALETTE],
    keywords: ["생선", "물고기", "잡은 것", "열린 상자", "fish", "catch", "open crate"],
    sheet: true,
  },
  {
    id: "dock-net-pile",
    name: "그물 더미",
    kind: "3d-model",
    factory: "examples/generated/kits/fishing-dock/dock-net-pile.factory.mjs",
    reference: "public/market/dock-net-pile/dock-net-pile.glb",
    paletteTargets: [DOCK_PALETTE],
    keywords: ["그물", "어망", "net", "fishing net"],
    sheet: true,
  },
  {
    id: "dock-rope-coil",
    name: "밧줄 사리",
    kind: "3d-model",
    factory: "examples/generated/kits/fishing-dock/dock-rope-coil.factory.mjs",
    reference: "public/market/dock-rope-coil/dock-rope-coil.glb",
    paletteTargets: [DOCK_PALETTE],
    keywords: ["밧줄", "로프", "사리", "rope", "coil"],
    sheet: true,
  },

  // --- Fishing Dock Kit: on the water -----------------------------------------------------
  {
    id: "dock-buoy-red",
    name: "붉은 원통 부표",
    kind: "3d-model",
    factory: "examples/generated/kits/fishing-dock/dock-buoy-red.factory.mjs",
    reference: "public/market/dock-buoy-red/dock-buoy-red.glb",
    paletteTargets: [DOCK_PALETTE],
    keywords: ["부표", "붉은 부표", "buoy", "can buoy"],
    sheet: true,
  },
  {
    id: "dock-buoy-white",
    name: "흰 장대 부표",
    kind: "3d-model",
    factory: "examples/generated/kits/fishing-dock/dock-buoy-white.factory.mjs",
    reference: "public/market/dock-buoy-white/dock-buoy-white.glb",
    paletteTargets: [DOCK_PALETTE],
    keywords: ["장대 부표", "톱마크", "spar buoy", "topmark"],
    sheet: true,
  },
  {
    id: "dock-rowboat",
    name: "나룻배 (노 두 자루)",
    kind: "3d-model",
    factory: "examples/generated/kits/fishing-dock/dock-rowboat.factory.mjs",
    reference: "public/market/dock-rowboat/dock-rowboat.glb",
    paletteTargets: [DOCK_PALETTE],
    keywords: ["나룻배", "보트", "배", "노", "rowboat", "boat", "dinghy", "oar"],
    sheet: true,
  },
  {
    id: "dock-lighthouse",
    name: "작은 등대",
    kind: "3d-model",
    factory: "examples/generated/kits/fishing-dock/dock-lighthouse.factory.mjs",
    reference: "public/market/dock-lighthouse/dock-lighthouse.glb",
    paletteTargets: [DOCK_PALETTE],
    keywords: ["등대", "빛", "타워", "lighthouse", "beacon", "tower"],
    sheet: true,
  },

  // --- 광산 입구 키트 ----------------------------------------------------------------------
  {
    id: "mine-portal",
    name: "갱도 입구 목재 프레임",
    kind: "3d-model",
    factory: "examples/generated/kits/mine-entrance/portal.factory.mjs",
    reference: "public/market/mine-portal/mine-portal.glb",
    paletteTargets: [MINE_PALETTE],
    keywords: ["갱도", "광산", "입구", "굴", "동굴 입구", "mine", "adit", "portal", "entrance"],
    sheet: true,
  },
  {
    id: "mine-support",
    name: "갱도 목재 지지대 세트",
    kind: "3d-model",
    factory: "examples/generated/kits/mine-entrance/support.factory.mjs",
    reference: "public/market/mine-support/mine-support.glb",
    paletteTargets: [MINE_PALETTE],
    keywords: ["지지대", "갱목", "버팀목", "터널", "mine support", "timbering", "tunnel frame"],
    sheet: true,
  },
  {
    id: "mine-cart",
    name: "빈 광차",
    kind: "3d-model",
    factory: "examples/generated/kits/mine-entrance/cart.factory.mjs",
    reference: "public/market/mine-cart/mine-cart.glb",
    paletteTargets: [MINE_PALETTE],
    keywords: ["광차", "수레", "탄차", "mine cart", "tub", "trolley"],
    sheet: true,
  },
  {
    id: "mine-cart-ore",
    name: "광석 실은 광차",
    kind: "3d-model",
    factory: "examples/generated/kits/mine-entrance/cart-ore.factory.mjs",
    reference: "public/market/mine-cart-ore/mine-cart-ore.glb",
    paletteTargets: [MINE_PALETTE],
    keywords: ["광석 광차", "실은 수레", "loaded cart", "ore cart"],
    sheet: true,
  },
  {
    id: "mine-tool-rack",
    name: "곡괭이·삽 거치대",
    kind: "3d-model",
    factory: "examples/generated/kits/mine-entrance/tool-rack.factory.mjs",
    reference: "public/market/mine-tool-rack/mine-tool-rack.glb",
    paletteTargets: [MINE_PALETTE],
    keywords: ["곡괭이", "삽", "연장", "거치대", "pickaxe", "shovel", "tool rack"],
    sheet: true,
  },
  {
    id: "mine-rail-straight",
    name: "직선 레일 (1.2 m)",
    kind: "3d-model",
    factory: "examples/generated/kits/mine-entrance/rail-straight.factory.mjs",
    reference: "public/market/mine-rail-straight/mine-rail-straight.glb",
    paletteTargets: [MINE_PALETTE],
    keywords: ["레일", "선로", "철길", "침목", "rail", "track", "sleeper"],
    sheet: true,
  },
  {
    id: "mine-rail-curve",
    name: "곡선 레일 (90도)",
    kind: "3d-model",
    factory: "examples/generated/kits/mine-entrance/rail-curve.factory.mjs",
    reference: "public/market/mine-rail-curve/mine-rail-curve.glb",
    paletteTargets: [MINE_PALETTE],
    keywords: ["곡선 레일", "굽은 선로", "curved rail", "curve track"],
    sheet: true,
  },
  {
    id: "mine-rail-stop",
    name: "레일 끝막이",
    kind: "3d-model",
    factory: "examples/generated/kits/mine-entrance/rail-stop.factory.mjs",
    reference: "public/market/mine-rail-stop/mine-rail-stop.glb",
    paletteTargets: [MINE_PALETTE],
    keywords: ["끝막이", "차막이", "버퍼", "buffer stop", "rail end"],
    sheet: true,
  },
  {
    id: "mine-ladder",
    name: "갱도 나무 사다리",
    kind: "3d-model",
    factory: "examples/generated/kits/mine-entrance/ladder.factory.mjs",
    reference: "public/market/mine-ladder/mine-ladder.glb",
    paletteTargets: [MINE_PALETTE],
    keywords: ["사다리", "나무 사다리", "ladder", "pit ladder"],
    sheet: true,
  },
  {
    id: "mine-lantern",
    name: "기둥에 건 광부 랜턴",
    kind: "3d-model",
    factory: "examples/generated/kits/mine-entrance/lantern.factory.mjs",
    reference: "public/market/mine-lantern/mine-lantern.glb",
    paletteTargets: [MINE_PALETTE],
    keywords: ["랜턴", "등", "호롱", "광부 등", "lantern", "lamp", "pit lamp"],
    sheet: true,
  },
  {
    id: "mine-powder-keg",
    name: "화약통",
    kind: "3d-model",
    factory: "examples/generated/kits/mine-entrance/powder-keg.factory.mjs",
    reference: "public/market/mine-powder-keg/mine-powder-keg.glb",
    paletteTargets: [MINE_PALETTE],
    keywords: ["화약통", "화약", "통", "배럴", "powder keg", "barrel", "explosive"],
    sheet: true,
  },
  {
    id: "mine-rock-large",
    name: "바위 (1.2 m)",
    kind: "3d-model",
    factory: "examples/generated/kits/mine-entrance/rock-large.factory.mjs",
    reference: "public/market/mine-rock-large/mine-rock-large.glb",
    paletteTargets: [MINE_PALETTE],
    keywords: ["바위", "큰 바위", "돌", "boulder", "rock"],
    sheet: true,
  },
  {
    id: "mine-rock-small",
    name: "바위 (0.6 m)",
    kind: "3d-model",
    factory: "examples/generated/kits/mine-entrance/rock-small.factory.mjs",
    reference: "public/market/mine-rock-small/mine-rock-small.glb",
    paletteTargets: [MINE_PALETTE],
    keywords: ["작은 바위", "돌덩이", "small rock", "stone"],
    sheet: true,
  },
  {
    id: "mine-ore-copper",
    name: "구리 광석 덩이",
    kind: "3d-model",
    factory: "examples/generated/kits/mine-entrance/ore-copper.factory.mjs",
    reference: "public/market/mine-ore-copper/mine-ore-copper.glb",
    paletteTargets: [MINE_PALETTE],
    keywords: ["구리", "광석", "구리 광석", "copper", "ore"],
    sheet: true,
  },
  {
    id: "mine-ore-iron",
    name: "철 광석 덩이",
    kind: "3d-model",
    factory: "examples/generated/kits/mine-entrance/ore-iron.factory.mjs",
    reference: "public/market/mine-ore-iron/mine-ore-iron.glb",
    paletteTargets: [MINE_PALETTE],
    keywords: ["철", "철광석", "iron", "iron ore"],
    sheet: true,
  },
  {
    id: "mine-ore-gold",
    name: "금 광석 덩이",
    kind: "3d-model",
    factory: "examples/generated/kits/mine-entrance/ore-gold.factory.mjs",
    reference: "public/market/mine-ore-gold/mine-ore-gold.glb",
    paletteTargets: [MINE_PALETTE],
    keywords: ["금", "금광석", "황금", "gold", "gold ore"],
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

  // --- Village Square kit -----------------------------------------------------------------
  {
    id: "village-well-winch",
    name: "우물 도르래 돌리기",
    kind: "animation-clip",
    mode: "pivotClip",
    factory: "examples/generated/kits/village-square/well.factory.mjs",
    paletteTargets: [VILLAGE_PALETTE],
    keywords: ["두레박", "도르래", "우물 손잡이", "winch", "crank", "well"],
    clip: {
      name: "winch-crank",
      koreanName: "두레박 손잡이 돌리기",
      node: "winch_pivot",
      axis: "x",
      loop: true,
      // 한 바퀴를 넷으로 쪼갭니다. 0도와 360도를 한 쌍으로 두면 쿼터니언 선형 보간이
      // 짧은 쪽을 골라 아무 데도 안 도는 결과가 나옵니다.
      keys: [
        { time: 0, degrees: 0 },
        { time: 0.9, degrees: 90 },
        { time: 1.8, degrees: 180 },
        { time: 2.7, degrees: 270 },
        { time: 3.6, degrees: 360 },
      ],
    },
  },
  {
    id: "village-bell-swing",
    name: "종탑 종 흔들기",
    kind: "animation-clip",
    mode: "pivotClip",
    factory: "examples/generated/kits/village-square/bell-tower.factory.mjs",
    paletteTargets: [VILLAGE_PALETTE],
    keywords: ["종", "종 치기", "흔들림", "bell", "swing", "ring"],
    clip: {
      name: "bell-swing",
      koreanName: "종 흔들리기",
      node: "bell_pivot",
      axis: "x",
      loop: true,
      // ±16도. 그 이상은 종 아가리가 기둥 안쪽 면에 닿습니다 — 팩토리 머리말에 계산이 있습니다.
      keys: [
        { time: 0, degrees: 0 },
        { time: 0.45, degrees: 16 },
        { time: 1.35, degrees: -16 },
        { time: 2.25, degrees: 16 },
        { time: 2.7, degrees: 0 },
      ],
    },
  },

  // --- Fishing Dock Kit -------------------------------------------------------------------
  {
    id: "dock-rowboat-bob",
    name: "나룻배 흔들리기",
    kind: "animation-clip",
    mode: "pivotClip",
    factory: "examples/generated/kits/fishing-dock/dock-rowboat.factory.mjs",
    paletteTargets: [DOCK_PALETTE],
    keywords: ["배 흔들림", "물결", "나룻배", "boat bob", "rocking"],
    clip: {
      name: "bob",
      koreanName: "물결에 흔들리기",
      // The factory documents: boat_pivot sits on the waterline at midships, rest pose level.
      node: "boat_pivot",
      axis: "z",
      loop: true,
      keys: [
        { time: 0, degrees: 0 },
        { time: 1, degrees: 2.2 },
        { time: 2, degrees: 0 },
        { time: 3, degrees: -2.2 },
        { time: 4, degrees: 0 },
      ],
    },
  },
  {
    id: "dock-lantern-sway",
    name: "등불 흔들리기",
    kind: "animation-clip",
    mode: "pivotClip",
    factory: "examples/generated/kits/fishing-dock/dock-lantern-post.factory.mjs",
    paletteTargets: [DOCK_PALETTE],
    keywords: ["등불 흔들림", "랜턴", "바람", "lantern sway", "swing"],
    clip: {
      name: "sway",
      koreanName: "등불 흔들림",
      // The factory documents: lantern_pivot is the hook, rest pose hangs straight down.
      node: "lantern_pivot",
      axis: "z",
      loop: true,
      keys: [
        { time: 0, degrees: 0 },
        { time: 0.8, degrees: 6.5 },
        { time: 1.6, degrees: 0 },
        { time: 2.4, degrees: -6.5 },
        { time: 3.2, degrees: 0 },
      ],
    },
  },
  {
    id: "dock-lighthouse-beacon",
    name: "등대 등 돌기",
    kind: "animation-clip",
    mode: "pivotClip",
    factory: "examples/generated/kits/fishing-dock/dock-lighthouse.factory.mjs",
    paletteTargets: [DOCK_PALETTE],
    keywords: ["등대", "회전", "등", "beacon", "rotate", "lighthouse light"],
    clip: {
      name: "beacon-spin",
      koreanName: "등 회전",
      node: "beacon_pivot",
      axis: "y",
      loop: true,
      // Quartered on purpose: LINEAR quaternion interpolation takes the short way round each
      // key pair, and a single 0-to-360 pair collapses into no motion at all.
      keys: [
        { time: 0, degrees: 0 },
        { time: 1.5, degrees: 90 },
        { time: 3, degrees: 180 },
        { time: 4.5, degrees: 270 },
        { time: 6, degrees: 360 },
      ],
    },
  },
];

/** Every template the library knows about, whatever its kind. */
export function allTemplates() {
  return [...TEMPLATES, ...ANIMATION_TEMPLATES];
}
