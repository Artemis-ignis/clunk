#!/usr/bin/env -S node --import tsx
/**
 * Builds app/data/listing-facts.json — the one place the shop reads a listing's numbers from.
 *
 * Before this file existed, the catalogue card and the detail page recovered their figures by
 * running regular expressions over the Korean description ("잰 값으로 폴리곤 ([\d,]+)개, 그리기
 * (\d+)회"). That made the sentence the source of truth for the number, so rewording a listing
 * silently blanked its specification row, and a typo in a description became a wrong figure on
 * the card. Facts now come from the measurement the pipeline already made, keyed by slug, and
 * the description is free to be a description.
 *
 * Two sources feed it, because the shop's inventory has two homes:
 *
 *   1. outputs/market-launch/wave1/upload-manifest.json — every 3D model, bundle and texture,
 *      with `measured` written by the render-and-inspect pipeline.
 *   2. A saved /api/marketplace response (--listings), for the thirteen sprite sheets that
 *      exist only as D1 rows. Their grid comes from the sheet manifest the baker
 *      published beside the PNG (public/market/<slug>/*.sheet.json), never from the title.
 *
 * Usage:
 *   npm run asset:facts
 *   npm run asset:facts -- --listings tmp/listings-snapshot.json --out app/data/listing-facts.json
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** The three families whose members are meant to be bought together. */
export type KitId = "cozy-farm-set" | "harvest-frontier" | "grove-tree-pack";

export type ListingFact = {
  /** Triangles the file stores. Null for a listing whose product is not geometry. */
  triangles: number | null;
  materials: number | null;
  /** Real-world size in metres, measured from the assembled model. */
  boundsMetres: [number, number, number] | null;
  byteLength: number;
  /** The extension a buyer will see: "GLB", "PNG". */
  format: string;
  /** Parts the file names as turning — hinges, axles, joints, and animation clip targets. */
  animatedParts: string[];
  /** glTF animation clips inside the file, named and timed by the file. */
  animations: Array<{ name: string; seconds: number }>;
  kit: KitId | null;
  /** How many products carry the same kit. Zero when kit is null. */
  kitSize: number;
  /** Sprite-sheet grid, for a listing whose product is a sheet. */
  sheet: { cell: number; directions: number; frames: number | null; cuts: number | null } | null;
  /** Tile facts, for a listing whose product is a texture. */
  texture: { resolution: string; seamless: boolean } | null;
  /** How many files a bundle hands over, or null when the product is not a bundle. */
  members: number | null;
  /**
   * The angle the product photograph was taken from, so the in-page viewer opens on the same
   * side. Null keeps the catalogue's fixed three-quarter.
   */
  viewYawDegrees: number | null;
  /** What the inspector found, so the evidence card can say it instead of the description. */
  inspection: { webScore: number; mobileScore: number; hardBlockers: number; note: string | null } | null;
};

export type ListingFactsFile = {
  schema: "clunk.listing-facts.v1";
  generatedAt: string;
  sources: string[];
  facts: Record<string, ListingFact>;
};

const KIT_BY_GROUP: Readonly<Record<string, KitId>> = {
  "cozy-farm-set": "cozy-farm-set",
  "harvest-frontier": "harvest-frontier",
  "grove-tree-pack": "grove-tree-pack",
};

/** Buyer-facing kit names. Exported so the page and the tests share one spelling. */
export const KIT_NAMES: Readonly<Record<KitId, string>> = {
  "cozy-farm-set": "코지 팜 세트",
  "harvest-frontier": "하베스트 프론티어 세트",
  "grove-tree-pack": "그로브 트리 팩",
};

/**
 * What the format row says when neither the file name nor the content type states a format.
 * Named rather than spelled out at each site, so the places that have to recognise the shrug —
 * `underlayPrevious` below — compare against the same thing `formatLabelOf` returns.
 */
export const UNKNOWN_FORMAT_LABEL = "파일";

/** "GLB" / "PNG", from a file name or a content type. Never invented. */
export function formatLabelOf(fileName: string, contentType?: string | null): string {
  const extension = /\.([a-z0-9]+)$/i.exec(fileName)?.[1];
  if (extension) return extension.toUpperCase();
  if (contentType?.includes("gltf")) return "GLB";
  if (contentType?.includes("png")) return "PNG";
  return UNKNOWN_FORMAT_LABEL;
}

/** The part of a clunk.sprite-sheet-review manifest that states the grid. */
export type SheetManifest = {
  grid?: { frameWidth?: number };
  generation?: { views?: number; clip?: { frames?: number } | null };
};

/**
 * The grid a sprite-sheet listing has, read from the manifest the baker wrote beside the PNG.
 *
 * It used to be parsed back out of the listing title — "… — 스프라이트 시트 (64×64, 8방향)" —
 * which made the shop's *name* for a product the source of a measured number. Renaming the
 * products to plain nouns (2026-09-03) would then have silently blanked the specification row
 * on all thirteen sheets. The manifest states the same numbers, is written from the real
 * pixels, and cannot drift from them, so it is read instead. No manifest returns null, and the
 * row is left off rather than filled with a guess.
 */
export function sheetSpecFromManifests(manifests: readonly SheetManifest[]): ListingFact["sheet"] {
  const first = manifests[0];
  const cell = first?.grid?.frameWidth;
  const directions = first?.generation?.views;
  if (!cell || !directions) return null;
  const frames = first?.generation?.clip?.frames ?? null;
  return { cell, directions, frames, cuts: frames === null ? null : directions * frames };
}

/**
 * The sheet manifests published beside a listing's PNG (public/market/<slug>/*.sheet.json),
 * or an empty list for a listing that is not a sheet.
 */
export function sheetManifestsFor(slug: string, marketRoot: string): SheetManifest[] {
  const dir = resolve(marketRoot, slug);
  let names: string[];
  try {
    names = readdirSync(dir).filter((name) => name.endsWith(".sheet.json")).sort();
  } catch {
    return [];
  }
  const manifests: SheetManifest[] = [];
  for (const name of names) {
    try {
      manifests.push(JSON.parse(readFileSync(resolve(dir, name), "utf8")) as SheetManifest);
    } catch {
      // A manifest that will not parse states nothing; the row is left off, never guessed.
    }
  }
  return manifests;
}

type ManifestProduct = {
  slug: string;
  kind: string;
  bundleOf?: string[];
  title: string;
  configurationGroup?: string;
  files: Array<{ path: string; role: string; contentType: string; byteLength: number }>;
  measured?: Record<string, unknown>;
};

type ManifestFile = { products: ManifestProduct[] };

type ApiListing = { slug: string; title: string; entryFileName: string; format?: string; byteLength?: number };

const numberOrNull = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** Reads the note a buyer needs about the inspection result, or null when there is nothing to say. */
function inspectionNote(measured: Record<string, unknown> | undefined): string | null {
  const materials = numberOrNull(measured?.materialCount);
  const scores = measured?.gameReadyScore as { web?: { hardBlockerCount: number } } | undefined;
  // The one recurring caveat in this catalogue: Harvest Frontier's machines carry more
  // materials than the general web profile budgets for, and the inspector raises exactly one
  // finding for it. The description used to spell this out; it belongs beside the score.
  // Keyed on the finding rather than on the count alone, so the sentence cannot claim a
  // warning the inspection did not raise.
  if (materials !== null && materials > 12 && (scores?.web?.hardBlockerCount ?? 0) > 0) {
    return "재질이 일반 웹 기준 상한(12개)보다 많아 주의 1건이 있습니다. 게임 자체 기준(재질 64개까지)으로는 통과한 파일입니다.";
  }
  return null;
}

/**
 * A bundle states the sum of what is inside it. The bundles that record only a per-item
 * table (the tree pack) get their totals added up here rather than left blank.
 */
function sumOfPerItem(measured: Record<string, unknown> | undefined, key: string): number | null {
  const perItem = measured?.perItem as Record<string, Record<string, unknown>> | undefined;
  if (!perItem) return null;
  let total = 0;
  let found = false;
  for (const item of Object.values(perItem)) {
    const value = numberOrNull(item?.[key]);
    if (value === null) continue;
    total += value;
    found = true;
  }
  return found ? total : null;
}

export function factsFromManifest(manifest: ManifestFile): Record<string, ListingFact> {
  const kitSizes = new Map<KitId, number>();
  for (const product of manifest.products) {
    const kit = KIT_BY_GROUP[product.configurationGroup ?? ""];
    if (!kit || product.kind === "bundle") continue;
    kitSizes.set(kit, (kitSizes.get(kit) ?? 0) + 1);
  }

  const facts: Record<string, ListingFact> = {};
  for (const product of manifest.products) {
    const entry = product.files.find((file) => file.role === "entry");
    if (!entry) continue;
    const measured = product.measured ?? {};
    const kit = product.kind === "bundle" ? null : KIT_BY_GROUP[product.configurationGroup ?? ""] ?? null;
    const bounds = Array.isArray(measured.boundsMetres) && measured.boundsMetres.length === 3
      ? (measured.boundsMetres.map(Number) as [number, number, number])
      : null;
    const scores = measured.gameReadyScore as { web?: { score: number; hardBlockerCount: number }; mobile?: { score: number } } | undefined;
    facts[product.slug] = {
      triangles: numberOrNull(measured.triangleCount) ?? sumOfPerItem(measured, "triangleCount"),
      materials: numberOrNull(measured.materialCount) ?? sumOfPerItem(measured, "materialCount"),
      boundsMetres: bounds,
      // Every bundle's entry is its first member's file; the size row states that file, which
      // is the one the viewer loads.
      byteLength: entry.byteLength,
      format: formatLabelOf(entry.path, entry.contentType),
      animatedParts: Array.isArray(measured.animatedParts) ? (measured.animatedParts as string[]) : [],
      animations: Array.isArray(measured.animations)
        ? (measured.animations as Array<{ name: string; seconds: number }>).map((clip) => ({ name: clip.name, seconds: clip.seconds }))
        : [],
      kit,
      kitSize: kit ? kitSizes.get(kit) ?? 0 : 0,
      members: product.kind === "bundle" ? product.bundleOf?.length ?? null : null,
      viewYawDegrees: numberOrNull(measured.heroViewYawDegrees),
      sheet: null,
      texture: typeof measured.resolution === "string"
        ? { resolution: String(measured.resolution).replace("x", "×"), seamless: (measured.seam as { verdict?: string } | undefined)?.verdict === "SEAMLESS" }
        : null,
      inspection: scores?.web
        ? {
            webScore: scores.web.score,
            mobileScore: scores.mobile?.score ?? scores.web.score,
            hardBlockers: scores.web.hardBlockerCount,
            note: inspectionNote(measured),
          }
        : null,
    };
  }
  return facts;
}

/**
 * Facts for the listings that live only in D1 — the sprite sheets. Everything here is read
 * back from the row the shop already serves, so a sheet cannot claim a grid it does not have.
 */
export function factsFromListings(
  listings: ApiListing[],
  known: Record<string, ListingFact>,
  marketRoot: string,
): Record<string, ListingFact> {
  const facts: Record<string, ListingFact> = {};
  for (const listing of listings) {
    if (known[listing.slug]) continue;
    const sheet = sheetSpecFromManifests(sheetManifestsFor(listing.slug, marketRoot));
    facts[listing.slug] = {
      triangles: null,
      materials: null,
      boundsMetres: null,
      byteLength: listing.byteLength ?? 0,
      format: formatLabelOf(listing.entryFileName, listing.format),
      animatedParts: [],
      animations: [],
      kit: null,
      kitSize: 0,
      members: null,
      viewYawDegrees: null,
      sheet,
      texture: null,
      inspection: null,
    };
  }
  return facts;
}

/**
 * A snapshot-derived record laid over what the previous index already measured.
 *
 * /api/marketplace states a row's byte size and its file name, and the baker's manifest beside
 * the PNG states the grid. None of them states geometry. So `factsFromListings` mints an
 * all-null record for *every* listing the wave1 manifest does not carry — including listings
 * whose numbers were measured elsewhere and written straight into the index. On 2026-09-03 the
 * H145 helicopter was exactly that: a rebake replaced its 85,150 polygons, its bounds, its six
 * moving parts and its two clips with nulls, and the carry-forward in `main()` did not restore
 * them because it only fills slugs this run built *nothing* for — and this run had built the
 * empty record. The card lost its specification row without a single error.
 *
 * The rule that fixes it: on a snapshot-derived record, a null or an empty list is silence, not
 * a measurement of zero, and the previous index shows through it. What the row itself really
 * says — byteLength, format — still wins, so a re-uploaded file reports its new size.
 *
 * Those two are optional on an ApiListing, and their absence is minted as a 0 and as
 * UNKNOWN_FORMAT_LABEL, so they need the same reading: no product weighs nothing, and "파일" is
 * a shrug rather than a format. Both are silences, and the previous measurement shows through
 * them too. A row that states a size or a file name still overrides, as it should.
 *
 * A manifest record normally does not pass through here. There the pipeline re-measured the
 * file, so an empty `animations` means the model genuinely lost its clips; reviving a stale
 * value would make the shop promise motion the file no longer has.
 *
 * The one exception is `isShell`, from main: a run that finds the file but cannot read its
 * geometry still writes an entry, and that entry is all-null too. A 3D product always has
 * triangles, so a record with no triangles, no materials and no bounds is a failed read rather
 * than a measurement, and it must not overwrite the real numbers either. An empty list on a
 * record that did measure its geometry stays a real absence.
 */
export function isShell(fact: ListingFact): boolean {
  return fact.triangles == null && fact.materials == null && fact.boundsMetres == null;
}

export function underlayPrevious(fresh: ListingFact, previous: ListingFact | undefined): ListingFact {
  if (!previous) return fresh;
  return {
    ...fresh,
    byteLength: fresh.byteLength > 0 ? fresh.byteLength : previous.byteLength,
    format: fresh.format === UNKNOWN_FORMAT_LABEL ? previous.format : fresh.format,
    triangles: fresh.triangles ?? previous.triangles,
    materials: fresh.materials ?? previous.materials,
    boundsMetres: fresh.boundsMetres ?? previous.boundsMetres,
    animatedParts: fresh.animatedParts.length > 0 ? fresh.animatedParts : previous.animatedParts,
    animations: fresh.animations.length > 0 ? fresh.animations : previous.animations,
    // The kit and its size are one sentence: a count with no set named is a number about
    // nothing, so they are carried together or not at all.
    kit: fresh.kit ?? previous.kit,
    kitSize: fresh.kit ? fresh.kitSize : previous.kit ? previous.kitSize : fresh.kitSize,
    members: fresh.members ?? previous.members,
    viewYawDegrees: fresh.viewYawDegrees ?? previous.viewYawDegrees,
    // The grid is read off disk, not off the API: a checkout without public/market states no
    // grid rather than a wrong one, and must not blank the thirteen sheets on its way past.
    sheet: fresh.sheet ?? previous.sheet,
    texture: fresh.texture ?? previous.texture,
    inspection: fresh.inspection ?? previous.inspection,
  };
}

export function buildFacts(
  manifest: ManifestFile,
  listings: ApiListing[],
  sources: string[],
  marketRoot: string,
  previous: Record<string, ListingFact> = {},
): ListingFactsFile {
  const fromManifest = factsFromManifest(manifest);
  const facts: Record<string, ListingFact> = {};
  // A manifest record speaks for itself unless it measured nothing at all — see `isShell`.
  for (const [slug, fact] of Object.entries(fromManifest)) {
    facts[slug] = isShell(fact) ? underlayPrevious(fact, previous[slug]) : fact;
  }
  for (const [slug, fact] of Object.entries(factsFromListings(listings, fromManifest, marketRoot))) {
    facts[slug] = underlayPrevious(fact, previous[slug]);
  }

  // The sprite sheets live only in D1, so a run without a snapshot of it would delete their
  // entries and blank fourteen cards. Anything the previous index knew that neither source
  // mentions at all is kept whole; the manifest and the snapshot always win where they speak.
  let carried = 0;
  for (const [slug, fact] of Object.entries(previous)) {
    if (facts[slug]) continue;
    facts[slug] = fact;
    carried += 1;
  }

  return {
    schema: "clunk.listing-facts.v1",
    generatedAt: new Date().toISOString(),
    sources: carried ? [...sources, `이전 판에서 유지한 항목 ${carried}건`] : sources,
    facts: Object.fromEntries(Object.entries(facts).sort(([a], [b]) => a.localeCompare(b))),
  };
}

function main() {
  const argv = process.argv.slice(2);
  const flag = (name: string, fallback: string) => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
  };
  const root = resolve(import.meta.dirname, "..");
  const manifestPath = flag("manifest", resolve(root, "outputs/market-launch/wave1/upload-manifest.json"));
  const listingsPath = flag("listings", resolve(root, "tmp/listings-snapshot.json"));
  const outPath = flag("out", resolve(root, "app/data/listing-facts.json"));

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestFile;
  const sources = [manifestPath.replace(`${root}\\`, "").replace(`${root}/`, "")];
  let listings: ApiListing[] = [];
  try {
    const payload = JSON.parse(readFileSync(listingsPath, "utf8")) as { listings?: ApiListing[] };
    listings = payload.listings ?? [];
    sources.push(listingsPath.replace(`${root}\\`, "").replace(`${root}/`, ""));
  } catch {
    process.stderr.write(`no listings snapshot at ${listingsPath} — keeping what the previous run knew about D1-only listings\n`);
  }

  // The previous index is an input, not a patch applied afterwards: reading it here keeps the
  // merge itself a pure function the tests can drive without touching the filesystem.
  let previous: Record<string, ListingFact> = {};
  try {
    previous = (JSON.parse(readFileSync(outPath, "utf8")) as ListingFactsFile).facts ?? {};
  } catch {
    // No previous index to carry anything from.
  }

  const built = buildFacts(manifest, listings, sources, resolve(root, "public/market"), previous);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(built, null, 2)}\n`, "utf8");
  const withParts = Object.values(built.facts).filter((fact) => fact.animatedParts.length > 0).length;
  process.stdout.write(`${Object.keys(built.facts).length} listings -> ${outPath} (움직이는 부품 있는 상품 ${withParts}개)\n`);
}

// Run only when invoked as a command. Importing this module (the tests do) must not write files.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
