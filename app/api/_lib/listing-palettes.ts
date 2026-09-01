import index from "../../data/listing-palettes.json";

/**
 * The measured palette of every published listing, keyed by slug.
 *
 * Baked in at build time by `npm run asset:palette:index`, which downloads each listing's
 * real file from the live origin and measures it with the same reader the product page runs
 * in the buyer's browser. Serving it from the catalogue response means a card can show the
 * asset's colours without every visitor downloading eighteen models to find them out, and
 * two listings can be compared by colour without either being loaded at all.
 *
 * It is a snapshot, so it carries the date it was taken. A listing published after that
 * date simply has no entry and shows no swatches — better than swatches that describe some
 * earlier file.
 */
export type ListingPalette = Array<{ hex: string; share: number }>;

const PALETTES = index.palettes as Record<string, ListingPalette>;

export const PALETTE_MEASURED_AT: string = index.measuredAt;

export function paletteFor(slug: string): ListingPalette | undefined {
  return PALETTES[slug];
}

/**
 * How far apart two palettes are, 0 for identical.
 *
 * Every colour on each side is matched to its nearest counterpart on the other and the
 * distance is weighted by how much surface it covers, so a shared background dominates and
 * a 1% accent barely registers — which is how a person judges whether two assets belong in
 * the same scene. It runs both directions and takes the larger, so a listing whose colours
 * are all present in a much richer palette is not scored as a perfect match for it.
 */
export function paletteDistance(a: ListingPalette, b: ListingPalette): number {
  if (!a.length || !b.length) return Number.POSITIVE_INFINITY;
  const rgb = (hex: string) => [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
  const oneWay = (from: ListingPalette, to: ListingPalette) => {
    let total = 0;
    let weight = 0;
    for (const entry of from) {
      const [r, g, bl] = rgb(entry.hex);
      let nearest = Number.POSITIVE_INFINITY;
      for (const other of to) {
        const [r2, g2, b2] = rgb(other.hex);
        nearest = Math.min(nearest, Math.hypot(r - r2, g - g2, bl - b2));
      }
      total += nearest * entry.share;
      weight += entry.share;
    }
    return weight > 0 ? total / weight : Number.POSITIVE_INFINITY;
  };
  return Math.max(oneWay(a, b), oneWay(b, a));
}

/**
 * The published listings whose measured colours sit closest to this one.
 *
 * Every shop shows "you might also like"; almost all of them compute it from tags typed by
 * whoever uploaded the file. Ours is the one thing we can compute honestly — the colours
 * are read out of the files themselves, so "these go together" is a measurement rather than
 * a claim, and it works across kinds: a sprite sheet baked from a model lands next to the
 * model it came from without anyone having said they are related.
 *
 * Titles are read from the same table the catalogue is, so an unpublished listing can never
 * be recommended by a stale index.
 */
export async function matchesByColour(
  db: D1Database,
  slug: string,
  limit = 4,
): Promise<Array<{ slug: string; title: string; palette: ListingPalette; distance: number }>> {
  const source = paletteFor(slug);
  if (!source) return [];
  const scored = Object.entries(PALETTES)
    .filter(([other]) => other !== slug)
    .map(([other, palette]) => ({ slug: other, palette, distance: paletteDistance(source, palette) }))
    .filter((entry) => Number.isFinite(entry.distance))
    .sort((a, b) => a.distance - b.distance)
    // A wide gap means the shop simply has nothing in this colour family, and saying so by
    // showing nothing is better than presenting the least-unlike thing as a match.
    .filter((entry) => entry.distance <= 0.22)
    .slice(0, limit);
  if (scored.length === 0) return [];

  const placeholders = scored.map(() => "?").join(", ");
  const rows = await db
    .prepare(
      `SELECT slug, title FROM clunk_marketplace_listings WHERE status = 'PUBLISHED' AND slug IN (${placeholders})`,
    )
    .bind(...scored.map((entry) => entry.slug))
    .all<{ slug: string; title: string }>();
  const titles = new Map((rows.results ?? []).map((row) => [row.slug, row.title]));
  return scored
    .filter((entry) => titles.has(entry.slug))
    .map((entry) => ({ ...entry, title: titles.get(entry.slug) as string }));
}
