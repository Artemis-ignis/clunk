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
  /**
   * Tile facts, for a listing whose product is a texture.
   *
   * `seamless` is not a word taken from the title: it is the measurement below passing
   * the shop's bar. `seamLeftRight` / `seamTopBottom` are the wrap-edge pixel difference
   * divided by the same measure inside the tile, so 1.0 means the join cannot be told
   * from the interior and anything at or under 1.15 is what the shop calls seamless.
   * `sharpness` is the mean |Laplacian| over the tile. Measured by
   * scripts/texture-seam-cli.mjs into app/data/texture-seam-measurements.json.
   */
  texture: {
    resolution: string;
    seamless: boolean;
    seamLeftRight?: number;
    seamTopBottom?: number;
    sharpness?: number;
    /** Colour tiles in this listing. More than one means variants that share a border and may be mixed. */
    colourVariants?: number;
    /** The extra map kinds that ship beside each colour tile. */
    maps?: string[];
    /** Every file the buyer receives, and what they weigh together. */
    files?: number;
    totalBytes?: number;
  } | null;
  /**
   * 이 파일을 여는 프로그램에게 무엇을 요구하는지. 모델이 아닌 상품은 null.
   *
   * `requires` 는 glTF 의 `extensionsRequired` 그대로다 — 이름이 하나라도 있으면 그것을
   * 모르는 프로그램은 파일을 열 수 없다. `uses` 는 몰라도 열리는 나머지. `colour` 는 색이
   * 어디에 들어 있는지로, 기본 재질에서 색이 나오는지를 가른다.
   */
  engine: {
    requires: string[];
    uses: string[];
    colour: "texture" | "material" | "vertex";
    modes: number[];
    imageTypes: string[];
  } | null;
  inspection: { webScore: number; mobileScore: number; hardBlockers: number; note: string | null } | null;
};

const FACTS = index.facts as unknown as Record<string, ListingFacts>;

/** When these numbers were measured. A listing published later simply has no entry. */
export const FACTS_MEASURED_AT: string = index.generatedAt;

export function factsFor(slug: string): ListingFacts | null {
  return FACTS[slug] ?? null;
}
