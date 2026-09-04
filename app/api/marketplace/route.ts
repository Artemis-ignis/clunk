import { accessFor } from "../_lib/access";
import { FACTS_MEASURED_AT, factsFor } from "../_lib/listing-facts";
import { PALETTE_MEASURED_AT, matchesByColour, paletteFor } from "../_lib/listing-palettes";
import { clipsFor, parentSlugOf, variantSlugsOf } from "../_lib/listing-variants";
import {
  assertSameOrigin,
  ClunkHttpError,
  getRuntimeDb,
  ensureSchema,
  jsonError,
  isSafeRecordId,
  parseJson,
  privateJson,
  requireClunkContext,
  scopedStorageId,
} from "../_lib/clunk";
import {
  canPublishListing,
  isProductLicenseStatus,
  publicationReadiness,
  type ProductEvidenceStatus,
  type ProductLicenseStatus,
} from "../../../packages/core/src/product-contract";
import { getBillingEnvironment, getBillingStatus } from "./billing";
import { getRuntimeEnvironment } from "../../runtime-environment";

export const dynamic = "force-dynamic";

const LISTING_STATUSES = new Set(["DRAFT", "PENDING_REVIEW", "PUBLISHED"]);

export async function GET(request: Request) {
  try {
    const startedAt = Date.now();
    const db = getRuntimeDb();
    await ensureSchema(db);
    const schemaMs = Date.now() - startedAt;
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");
    if (slug) {
      if (!/^[a-z0-9가-힣][a-z0-9가-힣-]{0,95}$/i.test(slug)) {
        return Response.json({ ok: false, error: "A valid listing slug is required." }, { status: 400 });
      }
      const listing = await db.prepare(
        `SELECT l.id, l.slug, l.title, l.description,
          l.license_status AS licenseStatus, l.status, l.asset_id AS assetId,
          l.created_at AS createdAt, l.published_at AS publishedAt,
          a.file_name AS entryFileName, a.format, a.byte_length AS byteLength,
          u.display_name AS sellerName,
          (SELECT aa.file_name FROM clunk_asset_artifacts aa WHERE aa.asset_id = l.asset_id AND aa.role IN ('preview', 'page', 'texture') ORDER BY CASE aa.role WHEN 'preview' THEN 0 ELSE 1 END, aa.created_at ASC LIMIT 1) AS previewFileName
         FROM clunk_marketplace_listings l
         JOIN clunk_assets a ON a.id = l.asset_id
         LEFT JOIN clunk_users u ON u.id = (SELECT owner_user_id FROM clunk_workspaces WHERE id = l.workspace_id)
         WHERE l.status = 'PUBLISHED' AND l.slug = ? LIMIT 1`,
      ).bind(slug).first<{
        id: string; slug: string; title: string; description: string;
        licenseStatus: string; status: string; assetId: string; createdAt: string; publishedAt: string | null;
        entryFileName: string; format: string; byteLength: number; sellerName: string | null; previewFileName: string | null;
      }>();
      if (!listing) return Response.json({ ok: false, error: "Published listing not found." }, { status: 404 });
      // The four reads below do not depend on one another, only on the listing row; each is
      // one D1 round trip (~150 ms measured 2026-09-02), so they go out together rather
      // than one after the other.
      const [artifacts, review, variants, colourMatches] = await Promise.all([
        db.prepare(
          `SELECT file_name AS fileName, role, content_type AS contentType, byte_length AS byteLength, sha256
           FROM clunk_asset_artifacts WHERE asset_id = ? ORDER BY created_at ASC, file_name ASC`,
        ).bind(listing.assetId).all<{ fileName: string; role: string; contentType: string; byteLength: number; sha256: string }>(),
        db.prepare(
          `SELECT visual_runtime AS visualRuntime, player_facing AS playerFacing, human_decision AS humanDecision
           FROM clunk_asset_reviews WHERE asset_id = ? ORDER BY created_at DESC LIMIT 1`,
        ).bind(listing.assetId).first<{ visualRuntime?: string; playerFacing?: string; humanDecision?: string }>(),
        // The sheets baked from this model are download options on this page, not eleven extra
        // cards in the grid. Read from the listings table, so an unpublished sheet cannot be
        // offered and a row can never quote a size the asset does not have.
        readVariants(db, String(listing.slug)),
        matchesByColour(db, String(listing.slug)),
      ]);
      return Response.json({
        ok: true,
        schema: "clunk.marketplace-listing-detail.v1",
        listing: {
          ...listing,
          variantOf: parentSlugOf(String(listing.slug)),
          variants,
          // The clips the sprite baker turned this model's pivots with, so the viewer can
          // play the same motion the animated sheet shows. A model nobody baked a clip for
          // gets an empty array rather than an invented animation.
          clips: clipsFor(String(listing.slug)),
          artifact: { entryFileName: listing.entryFileName, previewFileName: listing.previewFileName ?? listing.entryFileName, assetId: listing.assetId },
          artifacts: artifacts.results.map(({ fileName, role, contentType, byteLength, sha256 }) => ({ fileName, role, contentType, byteLength, sha256 })),
          evidence: {
            static: "PASS",
            visualRuntime: normalizeEvidenceStatus(review?.visualRuntime),
            playerFacing: normalizeEvidenceStatus(review?.playerFacing),
            humanDecision: normalizeEvidenceStatus(review?.humanDecision),
          },
          license: listing.licenseStatus,
          aiGenerated: isGenerativeListing(String(listing.slug)),
          palette: paletteFor(String(listing.slug)) ?? null,
          // Every figure the page shows — polygons, materials, real size, file size, the
          // named moving parts — measured by the pipeline and served here, so the page never
          // has to read a number back out of the description it is also displaying.
          facts: factsFor(String(listing.slug)),
        },
        // "Goes with this" computed from measured colour rather than from a tag someone
        // typed. Titles come from the same query the catalogue uses, so a listing that was
        // unpublished cannot be recommended.
        matchesByColour: colourMatches,
        checkout: checkoutStatus(),
        access: accessFor({ authenticated: false }),
      }, { headers: { "cache-control": "public, max-age=30" } });
    }
    const rows = await db.prepare(
      `SELECT l.id, l.slug, l.title, l.description,
        l.license_status AS licenseStatus, l.status, l.asset_id AS assetId,
        l.created_at AS createdAt, l.published_at AS publishedAt,
        a.file_name AS entryFileName, a.format, a.byte_length AS byteLength,
        u.display_name AS sellerName,
        (SELECT aa.file_name FROM clunk_asset_artifacts aa WHERE aa.asset_id = l.asset_id AND aa.role IN ('preview', 'page', 'texture') ORDER BY CASE aa.role WHEN 'preview' THEN 0 ELSE 1 END, aa.created_at ASC LIMIT 1) AS previewFileName
       FROM clunk_marketplace_listings l
       JOIN clunk_assets a ON a.id = l.asset_id
       LEFT JOIN clunk_users u ON u.id = (SELECT owner_user_id FROM clunk_workspaces WHERE id = l.workspace_id)
       WHERE l.status = 'PUBLISHED' ORDER BY l.published_at DESC, l.created_at DESC LIMIT 50`,
    ).all();
    const queryMs = Date.now() - startedAt - schemaMs;
    // One product per 3D model. Every row still ships — a variant carries the slug of the
    // model it belongs to so a client can fold it into that product's page, and a model
    // carries the sheets baked from it so its card can say how many come with it.
    const bySlug = new Map(rows.results.map((row) => [String(row.slug), row]));
    const variantSummary = (parentSlug: string) => variantSlugsOf(parentSlug)
      .map((slug) => bySlug.get(slug))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        assetId: row.assetId,
        entryFileName: row.entryFileName,
        byteLength: row.byteLength,
        format: row.format,
        // The sheet's grid travels with the row. The product page used to recover it by
        // parsing the variant's title; the titles are plain nouns now, and a measured number
        // should never have come out of a name in the first place.
        facts: factsFor(String(row.slug)),
      }));
    return Response.json({
      ok: true,
      schema: "clunk.marketplace-catalog.v1",
      // Stamped once for the whole response rather than per listing: it is one snapshot,
      // and a reader needs to know how old it is, not to see the same date 33 times.
      paletteMeasuredAt: PALETTE_MEASURED_AT,
      factsMeasuredAt: FACTS_MEASURED_AT,
      listings: rows.results.map((row) => ({
        ...row,
        variantOf: parentSlugOf(String(row.slug)),
        variants: variantSummary(String(row.slug)),
        artifact: {
          entryFileName: row.entryFileName,
          previewFileName: row.previewFileName ?? row.entryFileName,
          assetId: row.assetId,
        },
        license: row.licenseStatus,
        aiGenerated: isGenerativeListing(String(row.slug)),
        palette: paletteFor(String(row.slug)) ?? null,
        facts: factsFor(String(row.slug)),
        // 2026-09-04: 목록에도 clips 를 싣는다. 등급이 접근권이 된 뒤로, 이걸 빼면
        // 카드는 움직임 없이 등급을 매기고 다운로드 문지기는 clipsFor 로 매겨 둘이
        // 갈라진다 — 카드에 "무료"라 적힌 상품이 403 으로 막히는 자리였다.
        clips: clipsFor(String(row.slug)),
      })),
      checkout: checkoutStatus(),
      access: accessFor({ authenticated: false }),
    }, {
      headers: {
        "cache-control": "public, max-age=30",
        // Where the time went, readable from curl -D -; the numbers are measured per request.
        "server-timing": `schema;dur=${schemaMs}, query;dur=${queryMs}, total;dur=${Date.now() - startedAt}`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { user, workspaceId } = await requireClunkContext();
    const payload = await parseJson<{
      assetId?: unknown;
      slug?: unknown;
      title?: unknown;
      description?: unknown;
      licenseStatus?: unknown;
      status?: unknown;
    }>(request, 128 * 1024);
    if (!isSafeRecordId(payload.assetId)) return privateJson({ ok: false, error: "A valid assetId is required." }, { status: 400 });
    const title = text(payload.title, "title", 120);
    const description = text(payload.description, "description", 2_000);
    const slug = slugify(typeof payload.slug === "string" ? payload.slug : title);
    // 에셋은 낱개로 팔지 않는다. 무료 등급은 로그인만 하면 받고, 그 위는 구독으로 열린다.
    // 값을 받는 입구가 있으면 언젠가 값이 들어오고, 그 값은 아무도 청구하지 않는 거짓이 된다.
    const priceCents = 0;
    const currency = "KRW";
    const licenseStatus = payload.licenseStatus;
    const status = typeof payload.status === "string" ? payload.status : "DRAFT";
    if (!slug || slug.length > 96) return privateJson({ ok: false, error: "A valid listing slug is required." }, { status: 400 });
    if (!isProductLicenseStatus(licenseStatus)) return privateJson({ ok: false, error: "A license status is required." }, { status: 400 });
    if (!LISTING_STATUSES.has(status)) return privateJson({ ok: false, error: "Unsupported listing status." }, { status: 400 });

    const db = getRuntimeDb();
    const asset = await db.prepare(
      `SELECT id, sha256 FROM clunk_assets WHERE id = ? AND workspace_id = ? LIMIT 1`,
    ).bind(payload.assetId, workspaceId).first<{ id: string; sha256: string }>();
    if (!asset) return privateJson({ ok: false, error: "The asset does not belong to this workspace." }, { status: 404 });
    const artifact = await db.prepare(
      `SELECT COUNT(*) AS count FROM clunk_asset_artifacts WHERE asset_id = ? AND workspace_id = ? AND object_key IS NOT NULL`,
    ).bind(asset.id, workspaceId).first<{ count: number | string }>();
    const generation = await db.prepare(
      `SELECT provenance_json AS provenanceJson, evidence_json AS evidenceJson FROM clunk_generation_jobs WHERE asset_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT 1`,
    ).bind(asset.id, workspaceId).first<{ provenanceJson?: string; evidenceJson?: string }>();
    const review = await db.prepare(
      `SELECT visual_runtime AS visualRuntime, player_facing AS playerFacing, human_decision AS humanDecision FROM clunk_asset_reviews WHERE asset_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT 1`,
    ).bind(asset.id, workspaceId).first<{ visualRuntime?: string; playerFacing?: string; humanDecision?: string }>();
    const evidence = parseJsonValue(generation?.evidenceJson);
    const provenance = parseJsonValue(generation?.provenanceJson);
    const staticStatus: ProductEvidenceStatus = evidence?.stages && typeof evidence.stages === "object"
      && (evidence.stages as Record<string, unknown>).structure && (evidence.stages as Record<string, unknown>).policy
      && (evidence.stages as Record<string, { status?: unknown }>).structure.status === "pass"
      && (evidence.stages as Record<string, { status?: unknown }>).policy.status === "pass"
      ? "PASS"
      : "GAP";
    const gate = {
      artifactStored: Number(artifact?.count ?? 0) > 0,
      provenanceComplete: Boolean(provenance?.promptHash && provenance?.provider),
      licenseStatus: licenseStatus as ProductLicenseStatus,
      staticStatus,
      visualRuntime: normalizeEvidenceStatus(review?.visualRuntime),
      playerFacing: normalizeEvidenceStatus(review?.playerFacing),
      humanDecision: normalizeEvidenceStatus(review?.humanDecision),
    };
    if (status === "PUBLISHED" && !canPublishListing(gate)) {
      return privateJson({ ok: false, error: "Listing cannot be published until artifact storage, provenance, license, runtime, player-facing, and human review gates are all PASS.", publicationGate: { ...gate, readiness: publicationReadiness(gate) } }, { status: 409 });
    }
    const listingId = scopedStorageId("listing", workspaceId, `${asset.id}:${slug}`);
    await db.prepare(
      `INSERT INTO clunk_marketplace_listings (id, workspace_id, asset_id, slug, title, description, price_cents, currency, license_status, status, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'PUBLISHED' THEN CURRENT_TIMESTAMP ELSE NULL END)`,
    ).bind(listingId, workspaceId, asset.id, slug, title, description, priceCents, currency, licenseStatus, status, status).run();
    return privateJson({
      ok: true,
      schema: "clunk.marketplace-listing.v1",
      listing: { id: listingId, assetId: asset.id, slug, title, description, licenseStatus, status, seller: user.displayName },
      publicationGate: { ...gate, readiness: publicationReadiness(gate), publishable: canPublishListing(gate) },
      checkout: checkoutStatus(),
      access: accessFor({ authenticated: false }),
    });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * The published sprite sheets baked from one 3D listing, in the order the table names them.
 *
 * A variant is a listing of its own — it has its own id, its own price and its own file — so
 * the row on the product page can hand the checkout that id and the buyer receives the sheet
 * rather than the model. Nothing here is computed: every number is the row's own column.
 */
async function readVariants(db: D1Database, parentSlug: string): Promise<Array<{
  id: string; slug: string; title: string;
  assetId: string; entryFileName: string; format: string; byteLength: number;
}>> {
  const slugs = variantSlugsOf(parentSlug);
  if (!slugs.length) return [];
  const placeholders = slugs.map(() => "?").join(", ");
  const rows = await db.prepare(
    `SELECT l.id, l.slug, l.title, l.asset_id AS assetId,
       a.file_name AS entryFileName, a.format, a.byte_length AS byteLength
     FROM clunk_marketplace_listings l
     JOIN clunk_assets a ON a.id = l.asset_id
     WHERE l.status = 'PUBLISHED' AND l.slug IN (${placeholders})`,
  ).bind(...slugs).all<{
    id: string; slug: string; title: string;
    assetId: string; entryFileName: string; format: string; byteLength: number;
  }>();
  const order = new Map(slugs.map((slug, index) => [slug, index]));
  return (rows.results ?? []).sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));
}

function text(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) throw new ClunkHttpError(`${name} is required and must be at most ${maxLength} characters.`, 400);
  return value.trim();
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96);
}

function parseJsonValue(value: string | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

function normalizeEvidenceStatus(value: unknown): ProductEvidenceStatus {
  return value === "PASS" || value === "GAP" || value === "NOT_EVALUATED" || value === "NO_GO" || value === "PENDING" || value === "UNAVAILABLE"
    ? value
    : "NOT_EVALUATED";
}

/**
 * Which listings were made by a generative model (the AI-basic-law label): the texture tiles
 * came out of an image model. The 3D models, their sheets and Harvest Frontier's machines are
 * code-authored geometry — labelling them 'generative AI' was false.
 */
const isGenerativeListing = (slug: string): boolean => /^tex-|seamless-textures/.test(slug);

function checkoutStatus(): { status: "AVAILABLE" | "PAYMENT_PROVIDER_NOT_CONFIGURED"; provider: "stripe" | null; configured: boolean } {
  const billing = getBillingStatus(getBillingEnvironment(getRuntimeEnvironment()));
  return {
    status: billing.status === "AVAILABLE" ? "AVAILABLE" : "PAYMENT_PROVIDER_NOT_CONFIGURED",
    provider: billing.provider,
    configured: billing.configured,
  };
}
