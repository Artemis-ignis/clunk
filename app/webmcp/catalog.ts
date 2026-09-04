"use client";

import {
  boundsOf,
  categoryOf,
  drawableListings,
  gradeBasisOf,
  gradeOf,
  licenseLabelOf,
  materialsOf,
  polygonCountOf,
  previewImageUrlOf,
  themeById,
  type CatalogListing,
} from "../components/catalog-facts";

/**
 * What the tools read.
 *
 * One source: GET /api/marketplace — the same response the shop renders. Grades follow
 * the shop's single published rule (catalog-facts.gradeOf) so a
 * tool and a card can never disagree, and polygons, materials, size and bytes come only
 * from the `facts` the pipeline measured. Nothing here computes a figure of its own.
 *
 * The agent reads English; the human screens read Korean. Every human-facing string is
 * therefore returned twice — the English field, and the same sentence as `<field>_ko`,
 * word for word what the page shows.
 */

/** The published grade rule, as the shop states it. Both languages, same rule. */
export const GRADE_RULE_EN =
  "Grade rule: S = motion included on a model of at least 1,500 polygons, or at least 4,000 polygons on its own · "
  + "A = motion included, or at least 1,500 polygons, or a bundle of several models · "
  + "B = everything else · B is free to any signed-in visitor, A and above need a subscription";

/** The dial's themes, in the shop's own ids. */
const THEME_EN: Readonly<Record<string, string>> = {
  all: "All",
  structure: "Farm structures",
  prop: "Farm props",
  tree: "Trees",
  texture: "Textures",
};

/** The Korean basis sentence the card prints, said in English. Same rule, same trigger. */
function gradeBasisEn(listing: CatalogListing): string | null {
  const grade = gradeOf(listing);
  if (grade.basis === "motion") return "motion included";
  if (grade.basis === "bundle") return "several models in one bundle";
  if (grade.basis === "polygons") {
    const polygons = polygonCountOf(listing);
    return polygons === null ? null : `${polygons.toLocaleString("en-US")} polygons`;
  }
  return null;
}

function licenseEn(status: string | null | undefined): string | null {
  if (!status) return null;
  return status.trim().toLowerCase() === "cleared" ? "commercial use allowed" : status;
}

export type AssetFacts = {
  slug: string;
  title: string;
  /** The theme this listing belongs to, in the shop's own id. */
  theme: string;
  themeLabel: string;
  themeLabel_ko: string;
  grade: "S" | "A" | "B";
  /** Why that grade — the rule that actually fired, not a summary. */
  gradeBasis: string | null;
  gradeBasis_ko: string | null;
  /** Measured triangle count. A listing the pipeline could not measure returns null. */
  polygons: number | null;
  /** Measured material count. */
  materials: number | null;
  materials_ko: string | null;
  /** Real-world size in metres, [x, y, z]. */
  sizeMetres: readonly number[] | null;
  sizeLabel: string | null;
  byteLength: number | null;
  format: string | null;
  /** Animations stored in the file. Empty when it carries none. */
  animations: string[];
  /** Named moving parts measured in this model. */
  animatedParts: string[];
  license: string | null;
  license_ko: string | null;
  priceWon: number;
  /** This listing's product page. */
  url: string;
  previewUrl: string | null;
  entryFileName: string;
  /** How many sprite sheets were baked from this model. */
  sheets: number;
  /** Where every figure above came from. */
  source: string;
};

type CatalogPayload = {
  ok?: boolean;
  listings?: CatalogListing[];
  checkout?: { status?: string };
  factsMeasuredAt?: string;
};

type Snapshot = { listings: CatalogListing[]; beta: boolean; measuredAt: string | null; at: number };

let cache: Snapshot | null = null;
let inFlight: Promise<Snapshot> | null = null;

/** Same cache life the screens use. */
const CACHE_MS = 30_000;

export async function loadCatalog(force = false): Promise<Snapshot> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const response = await fetch("/api/marketplace", { cache: "no-store" });
    const payload = await response.json() as CatalogPayload;
    if (!response.ok || payload.ok !== true || !Array.isArray(payload.listings)) {
      throw new Error("The marketplace catalogue could not be read.");
    }
    const snapshot: Snapshot = {
      listings: payload.listings,
      beta: payload.checkout?.status === "PAYMENT_PROVIDER_NOT_CONFIGURED",
      measuredAt: payload.factsMeasuredAt ?? null,
      at: Date.now(),
    };
    cache = snapshot;
    return snapshot;
  })().finally(() => { inFlight = null; });
  return inFlight;
}

/** The catalogue this page last read, or null. */
export function cachedCatalog(): Snapshot | null {
  return cache;
}

/** One listing's measured facts. A field the pipeline could not measure stays null. */
export function factsOf(listing: CatalogListing): AssetFacts {
  const grade = gradeOf(listing);
  const facts = listing.facts ?? null;
  const bounds = facts?.boundsMetres ?? null;
  return {
    slug: listing.slug,
    title: listing.title,
    theme: categoryOf(listing),
    themeLabel: THEME_EN[categoryOf(listing)] ?? categoryOf(listing),
    themeLabel_ko: themeById(categoryOf(listing)).name,
    grade: grade.letter,
    gradeBasis: gradeBasisEn(listing),
    gradeBasis_ko: gradeBasisOf(listing),
    polygons: polygonCountOf(listing),
    materials: typeof facts?.materials === "number" ? facts.materials : null,
    materials_ko: materialsOf(listing),
    sizeMetres: bounds && bounds.length === 3 ? [...bounds] : null,
    sizeLabel: boundsOf(listing),
    byteLength: facts?.byteLength ?? listing.byteLength ?? null,
    format: facts?.format ?? null,
    animations: (facts?.animations ?? []).map((clip) => clip.name),
    animatedParts: [...(facts?.animatedParts ?? [])],
    license: licenseEn(listing.licenseStatus),
    license_ko: licenseLabelOf(listing.licenseStatus),
    priceWon: Math.round(listing.priceCents / 100),
    url: `/marketplace/${encodeURIComponent(listing.slug)}`,
    previewUrl: previewImageUrlOf(listing),
    entryFileName: listing.entryFileName,
    sheets: listing.variants?.length ?? 0,
    source: "GET /api/marketplace, measured by the pipeline into app/data/listing-facts.json",
  };
}

/** Find one listing by slug. Sprite sheets can be looked up by their own slug too. */
export async function findListing(slug: string): Promise<CatalogListing | null> {
  const { listings } = await loadCatalog();
  return listings.find((row) => row.slug === slug) ?? null;
}

export type SearchInput = {
  query?: string;
  theme?: string;
  grade?: string;
  limit?: number;
  maxPolygons?: number;
  minPolygons?: number;
  hasAnimation?: boolean;
};

/** The listings the machine actually draws from: published, and not a sheet baked from a model. */
export async function searchAssets(input: SearchInput): Promise<AssetFacts[]> {
  const { listings } = await loadCatalog();
  const query = typeof input.query === "string" ? input.query.trim().toLowerCase() : "";
  const theme = typeof input.theme === "string" ? input.theme.trim() : "";
  const grade = typeof input.grade === "string" ? input.grade.trim().toUpperCase() : "";
  const limit = Number.isFinite(input.limit) ? Math.max(1, Math.min(50, Number(input.limit))) : 12;
  let rows = drawableListings(listings);
  if (theme && theme !== "all" && theme !== "All") {
    rows = rows.filter((row) => categoryOf(row) === theme || THEME_EN[categoryOf(row)] === theme);
  }
  if (grade) rows = rows.filter((row) => gradeOf(row).letter === grade);
  if (query) {
    rows = rows.filter((row) => `${row.slug} ${row.title} ${row.description}`.toLowerCase().includes(query));
  }
  if (typeof input.maxPolygons === "number" && Number.isFinite(input.maxPolygons)) {
    // A listing with no measured polygon count is left out rather than assumed to be small.
    rows = rows.filter((row) => {
      const polygons = polygonCountOf(row);
      return polygons !== null && polygons <= (input.maxPolygons as number);
    });
  }
  if (typeof input.minPolygons === "number" && Number.isFinite(input.minPolygons)) {
    rows = rows.filter((row) => {
      const polygons = polygonCountOf(row);
      return polygons !== null && polygons >= (input.minPolygons as number);
    });
  }
  if (input.hasAnimation === true) {
    rows = rows.filter((row) => (row.facts?.animations?.length ?? 0) > 0 || (row.facts?.animatedParts?.length ?? 0) > 0);
  }
  return rows.slice(0, limit).map(factsOf);
}
