/**
 * Which listings are the same product.
 *
 * The shop published a sprite sheet baked from a 3D model as its own card, so a buyer
 * scrolling the grid met the wooden crate three times: the model, its sheet, and — for the
 * gate and the shed — the animated sheet as well. Fourteen of the thirty-three cards were
 * renders of eleven models that were already on sale one row above.
 *
 * A 3D model is one product. The sheets baked from it are download options on that
 * product's page, the way polyfork.dev/assets shows one asset with its formats underneath.
 * This file is the single place that says which sheet belongs to which model.
 *
 * It is an explicit table rather than a rule that strips "-sprites" off a slug, because two
 * of the pairings do not follow from the name (`cozy-fence-gate-swing-sprites` belongs to
 * `cozy-fence-gate`, not to a listing called `cozy-fence-gate-swing`) and one sheet has no
 * parent at all: the farmhand was authored for the sheet and has no 3D listing beside it,
 * so it stays its own product. A rule would have invented a parent for it.
 */

/** Sheet slug → the 3D listing it was rendered from. Every key is a published listing. */
const SPRITE_PARENT: Readonly<Record<string, string>> = {
  "cozy-crate-closed-sprites": "cozy-crate-closed",
  "cozy-crate-open-sprites": "cozy-crate-open",
  "cozy-crate-produce-sprites": "cozy-crate-produce",
  "cozy-farm-set-vol1-sprites": "cozy-farm-set-vol1",
  "cozy-fence-gate-sprites": "cozy-fence-gate",
  "cozy-fence-gate-swing-sprites": "cozy-fence-gate",
  "cozy-greenhouse-sprites": "cozy-greenhouse",
  "cozy-haystack-full-sprites": "cozy-haystack-full",
  "cozy-haystack-used-sprites": "cozy-haystack-used",
  "cozy-market-stall-sprites": "cozy-market-stall",
  "cozy-storage-shed-sprites": "cozy-storage-shed",
  "cozy-storage-shed-door-sprites": "cozy-storage-shed",
  "grove-tree-pack-vol1-sprites": "grove-tree-pack-vol1",
};

/**
 * The one sheet that is a product of its own: no 3D listing was ever published for the
 * farmhand, so hiding this card would remove the character from the shop entirely.
 */
export const STANDALONE_SPRITE_SLUGS: readonly string[] = ["farmhand-walk-sprites"];

const PARENT_VARIANTS: ReadonlyMap<string, readonly string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const [variant, parent] of Object.entries(SPRITE_PARENT)) {
    const list = map.get(parent) ?? [];
    list.push(variant);
    map.set(parent, list);
  }
  for (const list of map.values()) list.sort();
  return map;
})();

/** The 3D listing this slug is a rendering of, or null when the slug is its own product. */
export function parentSlugOf(slug: string): string | null {
  return SPRITE_PARENT[slug] ?? null;
}

/** The sheets baked from this 3D listing, sorted; empty for a listing with none. */
export function variantSlugsOf(parentSlug: string): readonly string[] {
  return PARENT_VARIANTS.get(parentSlug) ?? [];
}

/** True when the grid should hide this listing because it belongs on another product's page. */
export function isVariantSlug(slug: string): boolean {
  return slug in SPRITE_PARENT;
}

/**
 * The Korean name of a clip, matching CLIP_LABELS in scripts/seed-sprite-sheets.mjs so the
 * button on the model reads the same as the title of the sheet baked from it.
 */
export const CLIP_LABELS: Readonly<Record<string, string>> = {
  swing: "여닫기",
  open: "문 열기",
  walk: "걷기",
};

/**
 * 하베스트 포크 캐릭터 여섯의 동작 이름.
 *
 * 위의 `CLIP_LABELS` 와 쓰임이 다릅니다. 저것은 스프라이트 굽는 쪽이 모델의 축을 돌려 만든
 * 동작의 이름이고, 이것은 **파일이 스스로 들고 있는** glTF 클립의 이름입니다. 여섯 캐릭터는
 * 68개짜리 뼈대와 클립 여덟 개를 GLB 안에 넣어 팔기 때문에, 뷰어는 아래 `LISTING_CLIPS` 가
 * 아니라 파일에서 클립을 읽습니다 — 그래서 여섯 슬러그는 `LISTING_CLIPS` 에 항목이 없고,
 * 여기에는 그 이름의 한국어 표기만 적어 둡니다. 상품 설명(examples/generated/kits/
 * harvest-folk/characters.mjs 의 `CLIP_KO`)과 같은 낱말을 씁니다.
 *
 * `run` 이 하나 어긋나 있습니다. 화면이 실제로 읽는 표
 * (app/components/review/gltf-clip-labels.ts 의 `GLTF_CLIP_LABELS`)에는 `run` 이 하베스트
 * 프론티어 기계의 "가동" 으로 적혀 있고, `wave` 와 `carry_idle` 은 아예 없습니다. 그 파일은
 * 이 작업의 소관이 아니어서 손대지 않았고,
 * examples/generated/kits/harvest-folk/product-gaps.md 에 적어 두었습니다.
 */
export const CHARACTER_CLIP_LABELS: Readonly<Record<string, string>> = {
  idle: "대기",
  walk: "걷기",
  run: "달리기",
  wave: "손 흔들기",
  carry_idle: "바구니 들고 대기",
  hoe: "괭이질",
  water: "물주기",
  harvest: "수확",
};

/** 하베스트 포크 키트의 상품 슬러그. 부품 여섯과 합본 하나. */
export const HARVEST_FOLK_SLUGS: readonly string[] = [
  "kit-harvest-folk",
  "folk-farmer-tomas",
  "folk-farmer-ida",
  "folk-elder-otto",
  "folk-botanist-mira",
  "folk-merchant-benno",
  "folk-kid-pim",
];

export type ClipAxis = "x" | "y" | "z";
export type ClipTrack = {
  /** The glTF node this track turns. The viewer disables the clip when the file has no such node. */
  node: string;
  axis: ClipAxis;
  /** One angle per frame, in degrees, added to the node's rest rotation. */
  degrees: number[];
};
export type ListingClip = { name: string; label: string; fps: number; tracks: ClipTrack[] };

/**
 * The clips the sprite baker used, copied verbatim from the files it was run with
 * (tmp/clips/gate-swing.json and tmp/clips/door-open.json — the same numbers, node names and
 * frame rates that produced the animated sheets on sale).
 *
 * Only two models carry one. tmp/clips/walk.json turns the farmhand's legs, and the farmhand
 * has no 3D listing, so no listing here claims it. A model with no clip gets an empty array
 * and the viewer shows no playback bar rather than an animation nobody baked.
 */
const LISTING_CLIPS: Readonly<Record<string, readonly ListingClip[]>> = {
  "cozy-fence-gate": [
    {
      name: "swing",
      label: CLIP_LABELS.swing,
      fps: 8,
      tracks: [{ node: "gate_pivot", axis: "y", degrees: [0, -22, -48, -74, -90, -74, -48, -22] }],
    },
  ],
  "cozy-storage-shed": [
    {
      name: "open",
      label: CLIP_LABELS.open,
      fps: 10,
      tracks: [{ node: "door_pivot", axis: "y", degrees: [0, -14, -34, -56, -74, -85, -90, -90] }],
    },
  ],
  // 하베스트 포크 여섯(`HARVEST_FOLK_SLUGS`)은 여기에 없고, 없는 것이 맞습니다. 저 파일들은
  // 68개짜리 뼈대와 클립 여덟 개를 GLB 안에 들고 있어서 뷰어가 파일에서 바로 읽습니다. 여기에
  // 항목을 만들면 뷰어 막대에 같은 동작이 두 번 걸리고, 그중 하나는 뼈 하나를 몇 도 돌리는
  // 지어낸 동작이 됩니다 — 이 표는 구운 적 있는 동작만 적는 자리입니다.
  // 한국어 이름은 위의 `CHARACTER_CLIP_LABELS` 에 있습니다.
};

/** The clips baked for this listing, or an empty array. Never a clip invented for a model. */
export function clipsFor(slug: string): ListingClip[] {
  const clips = LISTING_CLIPS[slug];
  if (!clips) return [];
  // Deep-copied so a caller serialising the response cannot hand the next request a mutated
  // track. The arrays are tiny and this runs once per detail view.
  return clips.map((clip) => ({
    name: clip.name,
    label: clip.label,
    fps: clip.fps,
    tracks: clip.tracks.map((track) => ({ node: track.node, axis: track.axis, degrees: [...track.degrees] })),
  }));
}
