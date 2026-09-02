import index from "../../data/listing-facts.json";

/**
 * The measured facts of every published listing, keyed by slug.
 *
 * Written by `npm run asset:facts` (scripts/listing-facts-cli.ts) out of the pipeline's own
 * upload-manifest plus, for the sprite sheets that exist only as D1 rows, the grid stated in
 * their own titles. Served with the catalogue exactly as the palette index is, so a card can
 * state a polygon count without the visitor downloading the model to find it out.
 *
 * Why it exists: the card and the product page used to recover their numbers by running
 * regular expressions over the Korean description. The sentence was therefore the source of
 * truth for the figure, so rewriting a listing blanked its specification row and a typo in
 * prose became a wrong number on a card. A listing with no entry here shows no figures,
 * which is the right failure — better than a figure describing some other file.
 */
export type ListingFacts = {
  triangles: number | null;
  materials: number | null;
  boundsMetres: [number, number, number] | null;
  byteLength: number;
  format: string;
  animatedParts: string[];
  animations: Array<{ name: string; seconds: number }>;
  kit: string | null;
  kitSize: number;
  members: number | null;
  viewYawDegrees: number | null;
  sheet: { cell: number; directions: number; frames: number | null; cuts: number | null } | null;
  texture: { resolution: string; seamless: boolean } | null;
  inspection: { webScore: number; mobileScore: number; hardBlockers: number; note: string | null } | null;
};

const FACTS = index.facts as unknown as Record<string, ListingFacts>;

/** When these numbers were measured. A listing published later simply has no entry. */
export const FACTS_MEASURED_AT: string = index.generatedAt;

export function factsFor(slug: string): ListingFacts | null {
  return FACTS[slug] ?? null;
}
