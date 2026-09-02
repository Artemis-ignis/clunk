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
