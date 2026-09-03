"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Link from "./NativeLink";
import { Icon } from "./Icon";
import { EmbeddedGlbViewer, type MeasuredSpec } from "./review/EmbeddedGlbViewer";
import {
  cardSpec,
  factRows,
  hasMotion,
  kitLine,
  motionNote,
  reconcileMeasured,
  type ListingFacts,
} from "./listing-facts-rows";
import styles from "../marketplace/marketplace.module.css";
// 뽑기 화면과 같은 등급(S/A/B/C) — 같은 규칙, 같은 색. 가게 안의 진열대와 기계가 한 가게다.
import { gradeOf } from "./gacha/gacha-catalog";
import { useProductWebMcp } from "../webmcp/useProductWebMcp";

type Listing = {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  licenseStatus: string;
  status: string;
  assetId: string;
  entryFileName: string;
  format?: string;
  byteLength?: number;
  previewFileName?: string | null;
  /**
   * AI기본법 제31조② 표시 지원 — 표시 전용 필드. API 스키마 변경 없이,
   * 명시적으로 false가 오지 않는 한 1st-party(마스터 파이프라인) 상품으로 보고
   * 생성형 AI 라벨을 노출한다.
   */
  aiGenerated?: boolean;
  /**
   * The colours measured in this listing's own file, biggest share first. Served with the
   * catalogue so a card can show them without the visitor downloading the model.
   */
  palette?: Array<{ hex: string; share: number }> | null;
  /**
   * The slug of the 3D model this listing is a rendering of, or null when it is its own
   * product. A sprite sheet baked from a model on sale is a download option on that model's
   * page, so the grid folds it away instead of selling the same crate twice.
   */
  variantOf?: string | null;
  /** The sheets baked from this 3D model, offered on its page. */
  variants?: ListingVariant[];
  /**
   * Everything the page states as a number, measured by the pipeline and served with the
   * row. The page never reads a figure back out of the description.
   */
  facts?: ListingFacts | null;
};

/** A sprite sheet offered on the page of the 3D model it was baked from. */
type ListingVariant = {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  currency: string;
  assetId: string;
  entryFileName: string;
  byteLength: number;
  format: string;
};

/** A motion the sprite baker turned this model's pivots with, as the viewer replays it. */
type ListingClip = { name: string; label: string; fps: number; tracks: Array<{ node: string; axis: "x" | "y" | "z"; degrees: number[] }> };

/** A listing the shop found by comparing measured colour, not by matching a tag. */
type ColourMatch = { slug: string; title: string; distance: number; palette: Array<{ hex: string; share: number }> };

type CatalogFilter = "all" | "2d" | "3d" | "motion";
type CatalogSort = "newest" | "name" | "price-asc" | "price-desc" | "size-asc";
type CatalogState = "loading" | "ready" | "error";
type CheckoutState = { status?: string; configured?: boolean; provider?: string | null };
type CatalogPayload = { ok?: boolean; listings?: Listing[]; checkout?: CheckoutState };
type CheckoutResponse = {
  error?: string;
  status?: string;
  checkoutUrl?: string;
  creditsCharged?: number;
  creditsRequired?: number;
  balance?: number;
  entitlementId?: string;
};

/** Mirrors billing.ts: 1 credit = ₩100, internal units are won×100. */
function listingCreditPrice(priceCents: number, currency: string): number | null {
  if (currency !== "KRW" || priceCents <= 0 || priceCents % 10_000 !== 0) return null;
  return priceCents / 10_000;
}

const SNIPPET_TABS = [
  { id: "three" as const, label: "three.js" },
  { id: "r3f" as const, label: "React Three Fiber" },
  { id: "clunk" as const, label: "Clunk 검사" },
];

/** Copy-paste integration code for the exact file the buyer downloads. */
function buildSnippet(tab: "three" | "r3f" | "clunk", fileName: string): string {
  if (tab === "three") {
    return [
      `import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";`,
      ``,
      `new GLTFLoader().load("/assets/${fileName}", (gltf) => {`,
      `  scene.add(gltf.scene);`,
      `});`,
    ].join("\n");
  }
  if (tab === "r3f") {
    return [
      `import { useGLTF } from "@react-three/drei";`,
      ``,
      `export function Asset(props) {`,
      `  const { scene } = useGLTF("/assets/${fileName}");`,
      `  return <primitive object={scene} {...props} />;`,
      `}`,
    ].join("\n");
  }
  return [
    `# 받은 파일을 그대로 다시 검사합니다 (같은 계약, 같은 수치)`,
    `npm run clunk -- inspect ./${fileName} --profile web`,
    ``,
    `# 에이전트에서는 MCP 툴로 같은 검사를 호출합니다`,
    `clunk_asset_inspect { path: "./${fileName}", targetProfileId: "web" }`,
  ].join("\n");
}

/**
 * Start a same-origin file download the way the download buttons do, without waiting for
 * the buyer to find one. Same-origin, so the `download` attribute is honoured.
 */
function triggerDownload(href: string, fileName: string): void {
  if (typeof document === "undefined") return;
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/** 생성형 AI 표시 대상 여부 — 1st-party 상품은 항상 표시(보수적 기본값). */
function isAiGenerated(listing: Pick<Listing, "aiGenerated">): boolean {
  return listing.aiGenerated !== false;
}

/**
 * Korean shop names for the texture listings.
 *
 * Their stored titles are the words the pipeline was run with — "tilled soil (Harvest
 * Frontier 실수주) 심리스 텍스처 (1024x1024)" names an internal order and an English
 * material id, and a visitor is asked to buy it. The file, the size and the seamless verdict
 * are unchanged; only the name a person reads is. The stored titles should be renamed at the
 * source, and this table goes away when they are.
 */
const DISPLAY_TITLES: Readonly<Record<string, string>> = {
  "tex-soil-tilled-v2": "경작지 흙 · 이어붙는 텍스처",
  "tex-grass-meadow-v1": "초원 풀 · 이어붙는 텍스처",
  "tex-dirt-path-v1": "흙길 · 이어붙는 텍스처",
  "tex-stone-wall-v1": "돌담 · 이어붙는 텍스처",
  "tex-wood-planks-v1": "나무 판자 · 이어붙는 텍스처",
  "tex-roof-tiles-v2": "기와 지붕 · 이어붙는 텍스처",
  "tex-sand-dry-v1": "마른 모래 · 이어붙는 텍스처",
  "verified-seamless-textures-vol1": "이어붙는 텍스처 7종 묶음",
};

/** The name to show. Falls back to the stored title, so a new listing is never nameless. */
function displayTitle(slug: string, title: string): string {
  return DISPLAY_TITLES[slug] ?? title;
}

/** A 3D model rather than a picture — decides which numbers describe the file honestly. */
function isModelListing(listing: Pick<Listing, "entryFileName">): boolean {
  return /\.(glb|gltf)$/i.test(listing.entryFileName);
}

/**
 * The sheet's own numbers, read back out of the title the baker wrote.
 *
 * "코지 울타리 문 — 여닫기 애니메이션 (64×64, 8방향 × 8프레임)" is the whole source: nothing
 * here is recomputed, so a row cannot state a frame count the sheet does not have.
 */
function variantFacts(variant: ListingVariant): { kind: string; facts: string[] } {
  const kind = variant.title.match(/—\s*(.+?)\s*\(/u)?.[1]?.trim() ?? "스프라이트 시트";
  const grid = variant.title.match(/\((\d+)×(\d+),\s*(\d+)방향(?:\s*×\s*(\d+)프레임)?\)/u);
  const facts: string[] = [];
  if (grid) {
    facts.push(`한 칸 ${grid[1]}×${grid[2]}`, `${grid[3]}방향`);
    if (grid[4]) facts.push(`${grid[4]}프레임`);
  }
  facts.push(formatBytes(variant.byteLength));
  return { kind, facts };
}

type DetailListing = Listing & {
  format: string;
  byteLength: number;
  sellerName?: string | null;
  artifact: { entryFileName: string; previewFileName: string; assetId: string };
  artifacts: Array<{ fileName: string; role: string; contentType: string; byteLength: number; sha256: string }>;
  evidence: { static: string; visualRuntime: string; playerFacing: string; humanDecision: string };
  clips?: ListingClip[];
};
type DetailPayload = { ok?: boolean; error?: string; listing?: DetailListing; checkout?: CheckoutState; matchesByColour?: ColourMatch[] };

/** The sort ids the select offers; anything else in the URL falls back to newest. */
const CATALOG_SORTS = new Set<string>(["newest", "name", "price-asc", "price-desc", "size-asc"]);

const CATALOG_FILTERS: readonly { id: CatalogFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "2d", label: "2D 스프라이트" },
  { id: "3d", label: "3D 모델" },
  { id: "motion", label: "움직임 있음" },
];

export function MarketplaceCatalog() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [state, setState] = useState<CatalogState>("loading");
  const [catalogCheckout, setCatalogCheckout] = useState<CheckoutState | null>(null);
  // The chosen category, search and sort live in the URL rather than only in React state.
  // Three things were impossible while they did not: sending someone a link to "3D / GLB",
  // returning to the view you were on, and a crawler ever seeing a category page at all —
  // every filtered view was the same URL as the unfiltered one.
  const initial = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const [query, setQuery] = useState(initial.get("q") ?? "");
  const [filter, setFilter] = useState<CatalogFilter>(
    CATALOG_FILTERS.some((option) => option.id === initial.get("cat")) ? initial.get("cat") as CatalogFilter : "all",
  );
  const [sort, setSort] = useState<CatalogSort>(
    CATALOG_SORTS.has(initial.get("sort") ?? "") ? initial.get("sort") as CatalogSort : "newest",
  );
  // A hex, or empty for no colour filter. Shareable like the rest: a link to the browns is
  // a link someone can send.
  const [colour, setColour] = useState(() => {
    const value = initial.get("colour") ?? "";
    return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : "";
  });

  // replaceState, not push: a filter is a view of one page, and stacking every keystroke
  // in history turns the back button into an undo log for the search box.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const apply = (key: string, value: string, fallback: string) => {
      if (value === fallback) params.delete(key);
      else params.set(key, value);
    };
    apply("cat", filter, "all");
    apply("sort", sort, "newest");
    apply("q", query.trim(), "");
    apply("colour", colour, "");
    const search = params.toString();
    window.history.replaceState(
      null,
      "",
      search ? `?${search}${window.location.hash}` : `${window.location.pathname}${window.location.hash}`,
    );
  }, [filter, sort, query, colour]);

  useEffect(() => {
    let active = true;
    void fetch("/api/marketplace", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as CatalogPayload;
        if (!response.ok || payload.ok !== true || !Array.isArray(payload.listings)) {
          throw new Error("catalog unavailable");
        }
        if (active) {
          // One card per product. A sheet baked from a model on sale is not a second
          // product — it is a download option on that model's page, and it appears there.
          const publishedListings = payload.listings.filter((listing) => listing.status === "PUBLISHED")
            .filter((listing) => !listing.variantOf);
          setListings(publishedListings);
          setCatalogCheckout(payload.checkout ?? null);
          setState("ready");
        }
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredListings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matched = listings.filter((listing) => {
      const searchable = [listing.title, listing.description, listing.entryFileName, listing.format, listing.licenseStatus]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      return matchesQuery && (filter === "all" || listingFamily(listing) === filter);
    });
    // Picking a colour is itself a sort instruction — the asset carrying most of it should
    // lead — so it overrides whatever the sort select happens to say.
    if (colour) {
      return [...matched].sort((a, b) => (carriesColour(b, colour) ?? 0) - (carriesColour(a, colour) ?? 0));
    }
    // The API already returns newest-first, so "newest" keeps server order.
    if (sort === "newest") return matched;
    return [...matched].sort((a, b) => {
      if (sort === "name") return a.title.localeCompare(b.title, "ko-KR");
      if (sort === "price-asc") return a.priceCents - b.priceCents;
      if (sort === "price-desc") return b.priceCents - a.priceCents;
      return (a.byteLength ?? 0) - (b.byteLength ?? 0);
    });
  }, [colour, filter, listings, query, sort]);

  return (
    <div className={styles.catalog} data-testid="marketplace-catalog" data-snap-section="catalog-results">
      {state === "loading" ? <CatalogLoading /> : null}
      {state === "error" ? <CatalogError /> : null}
      {state === "ready" && catalogCheckout?.status === "PAYMENT_PROVIDER_NOT_CONFIGURED" ? <CheckoutNotice /> : null}
      {state === "ready" && listings.length === 0 ? <CatalogEmpty /> : null}
      {state === "ready" && listings.length > 0 ? (
        <>
          <div className={styles.controls} aria-label="공개 에셋 필터">
            <label className={styles.search}>
              <Icon name="search" size={16} />
              <span className="sr-only">에셋 검색</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름, 형식, 라이선스로 찾기" type="search" />
            </label>
            <ColourPicker value={colour} onChange={setColour} />
            <div className={styles.tabs} role="tablist" aria-label="에셋 패밀리">
              {CATALOG_FILTERS.map((option) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === option.id}
                  className={`${styles.tab}${filter === option.id ? ` ${styles.tabOn}` : ""}`}
                  key={option.id}
                  onClick={() => setFilter(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className={styles.sort}>
              <span className="sr-only">정렬 기준</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as CatalogSort)}>
                <option value="newest">최신순</option>
                <option value="name">이름순</option>
                <option value="price-asc">가격 낮은순</option>
                <option value="price-desc">가격 높은순</option>
                <option value="size-asc">파일 작은순</option>
              </select>
            </label>
            <span className={styles.count} aria-live="polite">에셋 {filteredListings.length}개</span>
          </div>
          {filteredListings.length === 0 ? <NoResults /> : null}
          <div className={styles.grid}>
            {filteredListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} colour={colour} beta={catalogCheckout?.status === "PAYMENT_PROVIDER_NOT_CONFIGURED"} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * The one fact a buyer scans a grid for.
 *
 * This used to be a stack of regular expressions run over the Korean description — the card
 * recovered "폴리곤 2,456개" by matching the sentence the pipeline had written, so rewording a
 * listing blanked its card and a typo in prose became a wrong number in the grid. The figure
 * now comes from the listing's measured facts (app/data/listing-facts.json, served by
 * /api/marketplace); a listing with no facts shows its format instead of a guess.
 */

function ListingCard({ listing, colour, beta }: { listing: Listing; colour?: string; beta?: boolean }) {
  const previewUrl = getPreviewUrl(listing);
  const price = formatPrice(listing.priceCents, listing.currency);
  const spec = cardSpec(listing.facts);
  const motion = motionNote(listing.facts);
  const colourShare = colour ? carriesColour(listing, colour) : null;

  // One card, one link. A grid is for choosing what to open, so the card carries
  // the picture, the name, the number that decides fit, and the price — the buy
  // decision belongs on the page the card opens.
  return (
    <Link className={styles.card} href={`/marketplace/${encodeURIComponent(listing.slug)}`}>
      <span className={styles.cardArt}>
        {previewUrl ? (
          <Image src={previewUrl} alt={`${displayTitle(listing.slug, listing.title)} 미리보기`} width={720} height={540} unoptimized />
        ) : (
          <PreviewUnavailable listing={listing} />
        )}
        <span className={styles.cardBadges} aria-hidden="true">
          {/* Why this card is where it is. Reordering a grid without saying what reordered
              it reads as the shop shuffling itself. */}
          {colourShare !== null ? (
            <span className={styles.colourBadge}>이 색 {Math.round(colourShare * 100)}%</span>
          ) : null}
          <span className={styles.gradeBadge} data-grade={cardGrade(listing)}>{cardGrade(listing)}</span>
          <span className={styles.formatBadge}>{formatLabel(listing)}</span>
          <span className={`${styles.priceBadge}${listing.priceCents === 0 || beta ? ` ${styles.priceBadgeFree}` : ""}`}>{beta && listing.priceCents > 0 ? <><s className={styles.priceStruck}>{price}</s> 베타 무료</> : price}</span>
        </span>
      </span>
      <span className={styles.cardBody}>
        <span className={styles.cardTitle}>{displayTitle(listing.slug, listing.title)}</span>
        <span className={styles.cardSpec}>
          {spec ?? formatLabel(listing)}
          {/* Only when the file itself carries a clip or a named hinge, and it says how many
              of each. Never read off a title, so a card cannot promise motion the download
              does not have.

              The generative-AI label used to sit here too. It is a legal disclosure, not a
              feature, and every card carrying it made the grid read as a row of stickers;
              it now appears once on the product page, under the facts. */}
          {motion ? <span className={styles.motionChip}>{motion}</span> : null}
        </span>
        {/* The 2D sheets baked from this model come with it. Saying so on the card is what
            makes the grid honest after the sheets stopped being cards of their own. */}
        {listing.variants?.length ? (
          <span className={styles.cardIncluded}>스프라이트 시트 {listing.variants.length}종 포함</span>
        ) : null}
        {/* The asset's own colours, in proportion. Scanning a grid for something that fits
            an existing scene is most of what browsing a shop is, and a thumbnail buried in
            a shadowed render does not answer it. */}
        {listing.palette?.length ? (
          <span className={styles.cardPalette} aria-hidden="true">
            {listing.palette.map((entry) => (
              <span key={entry.hex} style={{ background: entry.hex, flexGrow: Math.max(entry.share, 0.02) }} />
            ))}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export function MarketplaceListingDetail({ slug }: { slug: string }) {
  const [listing, setListing] = useState<DetailListing | null>(null);
  const [checkout, setCheckout] = useState<CheckoutState | null>(null);
  const [state, setState] = useState<CatalogState>("loading");
  const [message, setMessage] = useState("");
  const [withdrawalConsent, setWithdrawalConsent] = useState(false);
  // Every sheet on this page is a listing of its own, so "owned" is per listing id rather
  // than one flag: receiving the model must not unlock the sheet, or the file row would
  // offer a download the server will refuse.
  const [ownedIds, setOwnedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [buying, setBuying] = useState(false);
  const [measured, setMeasured] = useState<MeasuredSpec | null>(null);
  const [snippetTab, setSnippetTab] = useState<"three" | "r3f" | "clunk">("three");
  const [copied, setCopied] = useState(false);
  const [matches, setMatches] = useState<ColourMatch[]>([]);
  // Whether this visitor is signed in, asked once on mount. null while the answer is still
  // in flight.
  //
  // A signed-out visitor used to press "베타 기간 무료로 받기", wait for a checkout POST to
  // come back 401, read a sentence, and only then get moved to the login page. For the
  // length of that round trip the page looked like it had done nothing at all. Knowing the
  // answer before the click lets the button say what it will do and do it instantly.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/credits", { cache: "no-store" })
      .then((response) => {
        if (active) setSignedIn(response.status !== 401);
      })
      // A network failure is not proof of being signed out, so the button keeps its normal
      // wording and the 401 branch in startCheckout stays the safety net.
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void fetch(`/api/marketplace?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as DetailPayload;
        if (!response.ok || payload.ok !== true || !payload.listing || payload.listing.status !== "PUBLISHED") {
          throw new Error(payload.error ?? "Published listing not found.");
        }
        if (active) {
          setListing(payload.listing);
          setCheckout(payload.checkout ?? null);
          setMatches(payload.matchesByColour ?? []);
          setState("ready");
        }
      })
      .catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : "공개 상품을 불러오지 못했습니다.");
          setState("error");
        }
      });
    return () => {
      active = false;
    };
  }, [slug]);

  /** Straight to the login page, with the way back to this listing. No server round trip. */
  function goToLogin() {
    window.location.assign(
      `/signup?return_to=${encodeURIComponent(`${window.location.pathname}?intent=market`)}`,
    );
  }

  async function startCheckout(
    paymentMethod: "credits" | "card" | "beta",
    // Which listing is being bought. The sheets on this page are separate listings, so a row
    // has to hand the checkout its own id or the buyer receives the model again. The href is
    // the file itself: once the grant lands the download starts, instead of a button quietly
    // changing its label and leaving the buyer to notice.
    target?: { id: string; label: string; href: string; fileName: string },
  ) {
    if (!listing || buying) return;
    // Known to be signed out: go now. The checkout call could only answer 401.
    if (signedIn === false) {
      goToLogin();
      return;
    }
    const purchase = target ?? {
      id: listing.id,
      label: displayTitle(listing.slug, listing.title),
      href: `/api/marketplace/assets/${encodeURIComponent(listing.assetId)}?file=${encodeURIComponent(listing.entryFileName)}`,
      fileName: listing.entryFileName,
    };
    // Withdrawal-limit consent is a condition of a paid digital sale. The beta grant is not a
    // sale, and its panel does not show the checkbox — so this guard, left as it was, made
    // the beta button return silently on every click.
    if (paymentMethod !== "beta" && listing.priceCents > 0 && !withdrawalConsent) {
      setMessage("결제를 시작하려면 청약철회 제한 동의가 필요합니다.");
      return;
    }
    setBuying(true);
    setMessage(
      paymentMethod === "beta"
        ? "받는 중입니다…"
        : paymentMethod === "credits"
          ? "크레딧 결제를 처리하는 중입니다…"
          : "구매 연결 상태를 확인하는 중입니다…",
    );
    try {
      const response = await fetch("/api/marketplace/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": createIdempotencyKey(),
        },
        body: JSON.stringify({
          listingId: purchase.id,
          withdrawalConsent,
          ...(paymentMethod === "card" ? {} : { paymentMethod }),
        }),
      });
      const payload = await response.json() as CheckoutResponse;
      if (response.status === 401) {
        // Only reachable while the mount probe has not answered yet, or when it failed.
        setSignedIn(false);
        goToLogin();
        return;
      }
      if (payload.status === "PAID_WITH_CREDITS" || payload.status === "ALREADY_OWNED" || payload.status === "ALREADY_PAID" || payload.status === "BETA_GRANTED") {
        setOwnedIds((current) => new Set(current).add(purchase.id));
        setMessage(
          payload.status === "BETA_GRANTED"
              ? `${purchase.label} — 받았습니다. 베타 기간이라 결제 없이 드립니다. 내려받기가 시작됩니다. 시작되지 않으면 내려받기 버튼을 누르세요.`
              : payload.status === "PAID_WITH_CREDITS"
            ? `구매 완료 — ${payload.creditsCharged?.toLocaleString("ko-KR") ?? "?"} 크레딧 차감, 잔액 ${payload.balance?.toLocaleString("ko-KR") ?? "?"} 크레딧. 내려받기가 시작됩니다.`
            : `${purchase.label} — 이미 받은 상품입니다. 내려받기가 시작됩니다.`,
        );
        triggerDownload(purchase.href, purchase.fileName);
        return;
      }
      if (payload.status === "INSUFFICIENT_CREDITS") {
        setMessage(`${payload.error ?? "크레딧이 부족합니다."} 요금 페이지에서 크레딧을 충전해 주세요.`);
        return;
      }
      if (payload.checkoutUrl) {
        setMessage("결제 페이지로 이동합니다…");
        window.location.assign(payload.checkoutUrl);
        return;
      }
      setMessage(payload.error ?? payload.status ?? (response.ok ? "구매 요청을 시작했습니다." : "구매를 시작하지 못했습니다."));
    } catch {
      setMessage("구매 연결 상태를 확인하지 못했습니다.");
    } finally {
      setBuying(false);
    }
  }

  // 이 상품 화면이 떠 있는 동안만 걸리는 도구 — 받기 버튼이 쓰는 그 주소를 그대로 내준다.
  useProductWebMcp({
    active: state === "ready" && Boolean(listing),
    slug: listing?.slug ?? "",
    title: listing ? displayTitle(listing.slug, listing.title) : "",
    downloadHref: listing
      ? `/api/marketplace/assets/${encodeURIComponent(listing.assetId)}?file=${encodeURIComponent(listing.entryFileName)}`
      : "",
    entryFileName: listing?.entryFileName ?? "",
    byteLength: listing?.byteLength ?? 0,
    priceWon: Math.round((listing?.priceCents ?? 0) / 100),
    beta: checkout?.status === "PAYMENT_PROVIDER_NOT_CONFIGURED",
    signedIn,
    signupUrl: `/signup?return_to=${encodeURIComponent(`/marketplace/${listing?.slug ?? ""}?intent=market`)}`,
  });

  if (state === "loading") {
    return <div className={styles.detailState} role="status"><span className="spinner" /><strong>상품 근거를 불러오는 중입니다</strong><small>실제 파일 구성과 공개 상태를 확인합니다.</small></div>;
  }
  if (state === "error" || !listing) {
    return <div className={styles.detailState} role="alert"><strong>공개 상품을 열 수 없습니다.</strong><small>{message}</small><Link className={`${styles.btn} ${styles.btnGhost}`} href="/marketplace">마켓으로 돌아가기 <Icon name="arrowLeft" size={14} /></Link></div>;
  }

  const previewUrl = getPreviewUrl({ assetId: listing.artifact.assetId, previewFileName: listing.artifact.previewFileName });
  const paymentUnavailable = listing.priceCents > 0 && checkout?.status === "PAYMENT_PROVIDER_NOT_CONFIGURED";
  // Until sales open, the payment-provider gap is the beta: nothing is sold and every
  // signed-in visitor is granted the file.
  const beta = checkout?.status === "PAYMENT_PROVIDER_NOT_CONFIGURED";
  const downloadHref = `/api/marketplace/assets/${encodeURIComponent(listing.assetId)}?file=${encodeURIComponent(listing.entryFileName)}`;
  const creditPrice = listingCreditPrice(listing.priceCents, listing.currency);
  const owned = ownedIds.has(listing.id);
  const isModel = isModelListing(listing);
  const name = displayTitle(listing.slug, listing.title);
  const pictureSpec = describePicture(listing);
  const rows = listing.facts ? factRows(listing.facts) : [];
  const kit = listing.facts ? kitLine(listing.facts) : null;
  const reconciled = reconcileMeasured(
    listing.facts,
    measured ? { triangles: measured.triangles, materials: measured.materials, bytes: measured.bytes } : null,
  );

  return (
    <>
      <div className={styles.breadcrumb}><Link href="/marketplace">에셋 마켓</Link><Icon name="chevronRight" size={13} /><span>{name}</span></div>

      {/* The asset is what the page is for, so the words above it are one line of badges and
          one line of name. Everything that used to sit beside the picture — price, spec list,
          palette — now sits under it, where it does not compete with the thing being sold. */}
      <div className={styles.detailTopHead}>
        <div className={styles.detailBadges}>
          <span>{formatLabel(listing)}</span>
          <span>{formatBytes(listing.byteLength)}</span>
          <span>{licenseLabel(listing.licenseStatus)}</span>
        </div>
        <h1>{name}</h1>
      </div>

      {/* The bench. A 3D product gets the tool rails; a tile and a sheet get the bench their
          own format needs, because a texture has nothing to orbit and a sprite sheet is a
          grid of frames, not a model. */}
      <section className={styles.detailStage} data-snap-section="listing-stage">
        {isModel ? (
          <EmbeddedGlbViewer
            src={`/market/${listing.slug}/${listing.entryFileName}`}
            poster={previewUrl}
            alt={`${name} 실제 판매 파일`}
            onMeasured={setMeasured}
            // The motions the sprite baker turned this model's pivots with, so the door a
            // buyer sees opening on the sheet also opens on the model itself.
            clips={listing.clips ?? null}
            // Open on the side this product's photograph was taken from, so the live view
            // and the thumbnail are the same object seen the same way.
            yawDegrees={listing.facts?.viewYawDegrees ?? null}
            // The parts this listing's own measurement found, offered as pivot tests.
            pivots={listing.facts?.animatedParts ?? null}
            fileName={listing.entryFileName}
            scaleReference
            workbench
          />
        ) : listing.facts?.sheet && previewUrl ? (
          <SheetBench src={previewUrl} alt={`${name} 스프라이트 시트`} sheet={listing.facts.sheet} />
        ) : previewUrl ? (
          <TileBench src={previewUrl} alt={`${name} 타일 미리보기`} seamless={listing.facts?.texture?.seamless ?? false} />
        ) : (
          <PreviewUnavailable listing={listing} />
        )}
      </section>

      <section className={styles.detailUnder}>
        <div className={styles.detailFacts}>
          {/* Small, because the numbers underneath say more than the sentence can and the
              picture above says most of it already. */}
          <p className={styles.detailBlurb}>{shopDescription(listing, measured !== null)}</p>
          {/* A sheet is no longer a card in the grid, so its page says where it came from
              and takes the visitor to the product it belongs to. */}
          {listing.variantOf ? (
            <Link className={styles.textLink} href={`/marketplace/${encodeURIComponent(listing.variantOf)}`}>
              이 시트를 구운 3D 모델 보기 <Icon name="arrowRight" size={14} />
            </Link>
          ) : null}
          {/* The specification, in the order a buyer reads it: what it costs the engine, how
              big it is in the world, what the file is, what moves, and what they may do with
              it. Every figure comes from the listing's measured facts — the page does not
              read a number back out of the description beside it. */}
          {rows.length ? (
            <ul className={styles.specList} aria-label="이 상품의 사양">
              {rows.map((row) => (
                <li key={row.id}><b>{row.head}</b>{row.tail ? <> · {row.tail}</> : null}</li>
              ))}
            </ul>
          ) : pictureSpec ? (
            // A listing measured before the facts index existed still gets its picture facts.
            <ul className={styles.specList} aria-label="이 파일의 사양">
              {pictureSpec.map((item) => <li key={item.head}><b>{item.head}</b> · {item.tail}</li>)}
            </ul>
          ) : null}
          {/* Which set this belongs to, and how many pieces share its palette and its scale.
              A buyer furnishing a scene is choosing a family, not a file. */}
          {kit ? <p className={styles.kitLine}>{kit}</p> : null}
          {/* The viewer parses the very bytes on sale, so agreeing with the recorded facts is
              the normal case and gets one quiet line. Disagreeing means the file served is not
              the file that was measured, and a buyer is entitled to be told that. */}
          {reconciled ? <p className={styles.kitLine} role="status">{reconciled}</p> : null}
          {/* AI기본법 제31조② 생성물 표시. One sentence, once, where a buyer is already
              reading the facts — not a badge repeated on every card in the grid. */}
          {isAiGenerated(listing) ? (
            <p className={styles.kitLine}>이 {isModel ? "에셋" : "텍스처"}은 생성형 AI로 만들었습니다.</p>
          ) : null}
        </div>

        <div className={styles.detailBuy}>
          <div className={styles.priceRow}><strong>{beta && listing.priceCents > 0 ? <><s className={styles.priceStruck}>{formatPrice(listing.priceCents, listing.currency)}</s> 베타 무료</> : formatPrice(listing.priceCents, listing.currency)}</strong><small>{listing.sellerName ?? "Clunk"} · {formatBytes(listing.byteLength)} · {listing.entryFileName}</small></div>
          {listing.priceCents > 0 && paymentUnavailable ? (
            <p className={styles.payState} data-payment-state={checkout?.status ?? "UNKNOWN"} role="status">
              무료 베타 기간입니다. 로그인하면 이 에셋을 결제 없이 받을 수 있고, 표시된 가격은 유료 전환 후의 값입니다.
            </p>
          ) : null}
          {listing.priceCents > 0 && !beta ? (
            <label className={styles.consent}>
              <input
                type="checkbox"
                checked={withdrawalConsent}
                onChange={(event) => setWithdrawalConsent(event.target.checked)}
              />
              <span>
                이 에셋은 생성형 인공지능을 활용해 제작되었습니다. 결제 확인 즉시 다운로드
                권한이 부여되며, <b>제공 개시 시점부터 청약철회가 제한</b>됩니다.
                이에 동의합니다. <Link href="/refunds">환불정책 보기</Link>
              </span>
            </label>
          ) : null}
          <div className={styles.actions}>
            {listing.priceCents === 0 ? (
              <a className={`${styles.btn} ${styles.btnPrimary}`} href={downloadHref} download={listing.entryFileName}>무료 파일 받기 <Icon name="download" size={15} /></a>
            ) : owned ? (
              <a className={`${styles.btn} ${styles.btnPrimary}`} href={downloadHref} download={listing.entryFileName}>{beta ? "받은 파일 내려받기" : "구매한 파일 받기"} <Icon name="download" size={15} /></a>
            ) : beta ? (
              // The beta has one action. Consent to a withdrawal limit is a condition of a
              // paid sale, and a card button that can never work is a broken button.
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void startCheckout("beta")} disabled={buying}>
                {signedIn === false ? "로그인하고 받기" : buying ? "받는 중…" : "베타 기간 무료로 받기"} <Icon name={signedIn === false ? "arrowUpRight" : "download"} size={15} />
              </button>
            ) : (
              <>
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void startCheckout("credits")} disabled={buying || !withdrawalConsent || creditPrice === null}>
                  {creditPrice === null
                    ? "크레딧 결제 불가 가격"
                    : withdrawalConsent
                      ? `크레딧으로 구매 · ${creditPrice.toLocaleString("ko-KR")} 크레딧`
                      : "동의 후 구매 가능"} <Icon name="arrowUpRight" size={15} />
                </button>
                <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => void startCheckout("card")} disabled={buying || paymentUnavailable || !withdrawalConsent}>
                  {paymentUnavailable ? "카드 결제 준비 중" : "카드로 결제"}
                </button>
              </>
            )}
          </div>
          {message ? <p className={styles.message} role="status">{message}</p> : null}

          {/* The files, beside the button that unlocks them rather than a screen below it.
              A download link that answers 401 in JSON is not a link, it is a trap: until the
              visitor holds the entitlement the row says what will open it instead. */}
          <div className={styles.detailFilesHead}>{beta ? "받으면 열리는 파일" : "결제하면 열리는 파일"}</div>
          <div className={styles.files}>{listing.artifacts.filter((artifact) => !PAGE_IMAGE_ROLES.has(artifact.role.trim().toLowerCase())).map((artifact) => <article className={styles.fileRow} key={artifact.fileName}><div><Icon name={artifact.contentType === "image/png" ? "image" : artifact.contentType.includes("gltf") ? "box" : "fileJson"} size={17} /><strong>{artifact.fileName}</strong></div><span>{roleLabel(artifact.role)} · {formatBytes(artifact.byteLength)}</span><code>{artifact.sha256.slice(0, 16)}…</code>{owned || listing.priceCents === 0 ? <a href={`/api/marketplace/assets/${encodeURIComponent(listing.assetId)}?file=${encodeURIComponent(artifact.fileName)}`} download={artifact.fileName}>다운로드</a> : <span className={styles.fileLocked}>{beta ? "받기 버튼을 누르면 열립니다" : "결제 후 열립니다"}</span>}</article>)}</div>
        </div>
      </section>

      {/* The 2D sheets baked from this model. They used to be their own cards in the grid,
          which sold the same crate twice; here they are the formats of one product, each with
          its own button because each is still its own file. */}
      {listing.variants?.length ? (
        <section className={styles.variants} aria-labelledby="detail-variants-heading">
          <h2 id="detail-variants-heading" className={styles.variantsTitle}>이 모델로 만든 스프라이트 시트</h2>
          <p className={styles.variantsNote}>같은 모델을 Clunk 렌더러로 구운 PNG입니다. 2D 게임에 그대로 쓸 수 있습니다.</p>
          <ul className={styles.variantList}>
            {listing.variants.map((variant) => {
              const { kind, facts } = variantFacts(variant);
              const has = ownedIds.has(variant.id);
              const variantHref = `/api/marketplace/assets/${encodeURIComponent(variant.assetId)}?file=${encodeURIComponent(variant.entryFileName)}`;
              const variantTarget = { id: variant.id, label: kind, href: variantHref, fileName: variant.entryFileName };
              return (
                <li key={variant.id} className={styles.variantRow}>
                  <div className={styles.variantHead}>
                    <Icon name="image" size={16} />
                    <strong>{kind}</strong>
                  </div>
                  <span className={styles.variantFacts}>{facts.join(" · ")}</span>
                  {has || variant.priceCents === 0 ? (
                    <a
                      className={`${styles.btn} ${styles.btnGhost} ${styles.variantBtn}`}
                      href={variantHref}
                      download={variant.entryFileName}
                    >
                      내려받기 <Icon name="download" size={14} />
                    </a>
                  ) : beta ? (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnGhost} ${styles.variantBtn}`}
                      disabled={buying}
                      onClick={() => void startCheckout("beta", variantTarget)}
                    >
                      {signedIn === false ? "로그인하고 받기" : buying ? "받는 중…" : "베타 무료로 받기"} <Icon name={signedIn === false ? "arrowUpRight" : "download"} size={14} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnGhost} ${styles.variantBtn}`}
                      disabled={buying || !withdrawalConsent}
                      onClick={() => void startCheckout("credits", variantTarget)}
                    >
                      {formatPrice(variant.priceCents, variant.currency)} <Icon name="arrowUpRight" size={14} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* The file's own colours, area-weighted, so a buyer can tell before paying whether
          this asset sits in their game's palette — and can take the hex straight into their
          own material rather than eyedropping a screenshot. */}
      {measured?.palette.length ? <PaletteStrip palette={measured.palette} /> : null}
      {matches.length ? <ColourMatches matches={matches} /> : null}

      {/\.(glb|gltf)$/i.test(listing.entryFileName) ? (
        <section className={styles.detailSection} aria-labelledby="detail-integration-heading">
          <div className={styles.sectionHead}>
            <span className="cv5-eyebrow">바로 쓰기</span>
            <h2 id="detail-integration-heading">받은 파일을<br /><em>붙여넣기로 씁니다</em></h2>
            <p>구매한 GLB를 프로젝트에 넣고 아래 코드를 복사하면 끝입니다. 검사까지 같은 파일로 이어집니다.</p>
          </div>
          <div className={styles.snippetBox}>
            <div className={styles.snippetTabs} role="tablist" aria-label="연동 방식">
              {SNIPPET_TABS.map((tab) => (
                <button
                  type="button"
                  role="tab"
                  key={tab.id}
                  aria-selected={snippetTab === tab.id}
                  className={snippetTab === tab.id ? styles.snippetTabOn : undefined}
                  onClick={() => { setSnippetTab(tab.id); setCopied(false); }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className={styles.snippetBody}>
              <pre><code>{buildSnippet(snippetTab, listing.entryFileName)}</code></pre>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost} ${styles.snippetCopy}`}
                onClick={() => {
                  void navigator.clipboard.writeText(buildSnippet(snippetTab, listing.entryFileName)).then(
                    () => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); },
                    () => setCopied(false),
                  );
                }}
              >
                {copied ? "복사됨" : "코드 복사"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.detailSection} aria-labelledby="detail-evidence-heading">
        {/* A shop tells the buyer what was checked on the file they are about to
            pay for. The four internal review lanes are QA vocabulary and stay in
            the workspace; here we publish only what a buyer can act on. */}
        <div className={styles.sectionHead}><span className="cv5-eyebrow">판매 전 확인</span><h2 id="detail-evidence-heading">파일을 열어보고<br /><em>확인한 것</em></h2></div>
        {/* A PNG texture has no 면 and no 재질, and it was never put in a renderer. The card
            used to promise a buyer of a texture that we had counted its triangles and loaded
            it into three.js — neither of which happened.

            The draw-call count is gone from every buyer-facing surface: it is an engine word,
            and a shopper cannot act on it. The inspector still measures it. */}
        <div className={styles.evidenceGrid}><EvidenceCard label="파일 규격" value={listing.evidence.static} detail={isModel ? "면 개수·재질 수·크기·구조를 파일에서 직접 읽었습니다" : "해상도·이어짐·파일 크기를 파일에서 직접 읽었습니다"} pending="아직 파일을 읽어 재보지 않았습니다" /><EvidenceCard label={isModel ? "화면에서 확인" : "그림으로 확인"} value={listing.evidence.visualRuntime} detail={isModel ? "실제 게임 렌더러에 띄워 확인했습니다" : "실제 화면에 띄워 눈으로 확인했습니다"} pending={isModel ? "게임 렌더러에 올려 본 기록이 없습니다. 페이지 위의 미리보기는 지금 여러분 브라우저가 그린 것입니다" : "화면에 띄워 확인한 기록이 없습니다"} /><EvidenceCard label="판매자 검토" value={listing.evidence.humanDecision} detail="Clunk(아르테미스)가 직접 만들고 검토했습니다" pending="판매자가 아직 검토하지 않았습니다" /></div>
        {/* The one caveat the inspection raised, moved here out of the description. A listing
            whose file cleared every budget has nothing to add and shows nothing. */}
        {listing.facts?.inspection?.note ? (
          <p className={styles.kitLine}>{listing.facts.inspection.note}</p>
        ) : null}
      </section>

    </>
  );
}

type EvidenceStatus = "PASS" | "GAP" | "NOT_EVALUATED" | "NO_GO" | "PENDING" | "UNAVAILABLE";

function EvidenceCard({ label, value, detail, pending }: { label: string; value: string; detail: string; pending: string }) {
  const safeValue: EvidenceStatus = value === "PASS" || value === "GAP" || value === "NOT_EVALUATED" || value === "NO_GO" || value === "PENDING" || value === "UNAVAILABLE" ? value : "NOT_EVALUATED";
  const tone = safeValue === "PASS" ? styles.evidencePass : safeValue === "NO_GO" ? styles.evidenceFail : styles.evidencePending;
  // The lane names are ours; the buyer gets the verdict in their own words.
  const verdict = safeValue === "PASS" ? "확인함" : safeValue === "NO_GO" ? "판매 보류" : "확인 전";
  // The line under the verdict used to describe the check in the past tense whatever the
  // verdict said, so a texture that was never put in a renderer still read "we loaded it
  // into three.js and checked" under the words "not checked yet". A card that has not
  // passed says what has not happened.
  return <article className={`${styles.evidenceCard} ${tone}`}><span>{label}</span><strong>{verdict}</strong><small>{safeValue === "PASS" ? detail : pending}</small></article>;
}

function CatalogEmpty() {
  return (
    <section className={styles.emptyState} data-empty-state="marketplace" role="status" aria-live="polite">
      <Icon name="boxes" size={24} />
      <strong>현재 구매 가능한 공개 에셋이 없습니다.</strong>
      <p>검사를 통과해 공개된 에셋만 이 목록에 올라옵니다. 상품을 열면 3D 미리보기와 라이선스, 가격을 함께 확인할 수 있습니다.</p>
      <div className={styles.emptyActions}>
        <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/app">내 파일 검사하기 <Icon name="arrowUpRight" size={13} /></Link>
        <Link className={`${styles.btn} ${styles.btnGhost}`} href="/pricing">크레딧 확인하기 <Icon name="credit" size={13} /></Link>
      </div>
    </section>
  );
}

function CatalogLoading() {
  return (
    <section className={styles.emptyState} data-catalog-state="loading" role="status" aria-live="polite">
      <span className={styles.emptyEyebrow}>불러오는 중</span>
      <span className="spinner" />
      <strong>에셋 목록을 불러오고 있습니다.</strong>
      <p>잠시만 기다려 주세요.</p>
    </section>
  );
}

function CatalogError() {
  return (
    <section className={styles.emptyState} data-catalog-state="error" role="alert">
      <span className={styles.emptyEyebrow}>CATALOGUE · CONNECTION ERROR</span>
      <Icon name="circleAlert" size={24} />
      <strong>공개 카탈로그를 불러오지 못했습니다.</strong>
      <p>상품을 임의로 채우지 않았습니다. 잠시 후 다시 시도하거나 Clunk 제품 사용 안내를 확인해 주세요.</p>
      <div className={styles.emptyActions}>
        <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/app">Clunk 제품 사용하기 <Icon name="arrowUpRight" size={13} /></Link>
        <Link className={`${styles.btn} ${styles.btnGhost}`} href="/pricing">크레딧 확인하기 <Icon name="credit" size={13} /></Link>
      </div>
    </section>
  );
}

function CheckoutNotice() {
  return (
    <div className={styles.checkoutNotice} role="status">
      <Icon name="circleAlert" size={17} />
      <strong>무료 베타 — 결제 없이 받습니다</strong>
      <span>지금은 무료 베타 기간입니다. 로그인하면 모든 에셋을 결제 없이 받을 수 있고, 유료 전환 전에 이 자리와 이메일로 먼저 알립니다.</span>
    </div>
  );
}

function NoResults() {
  return (
    <section className={styles.emptyState} data-catalog-state="no-results" role="status">
      <Icon name="search" size={23} />
      <strong>조건에 맞는 에셋이 없습니다.</strong>
      <p>검색어 또는 패밀리 필터를 바꾸어 보세요. 이 화면에는 API가 반환한 listing만 표시됩니다.</p>
    </section>
  );
}

function PreviewUnavailable({ listing }: { listing: Listing }) {
  return (
    <div className={styles.previewUnavailable} role="img" aria-label={`${displayTitle(listing.slug, listing.title)} 미리보기 없음`}>
      {/* PREVIEW NOT PROVIDED — the listing carries no render, so the slot says
          so in Korean instead of leaving an unexplained empty frame. */}
      <span>미리보기 이미지 없음</span>
      <strong>{formatLabel(listing)}</strong>
      <small>{listing.entryFileName}</small>
    </div>
  );
}

function getPreviewUrl(listing: Pick<Listing, "assetId" | "previewFileName">): string | null {
  const fileName = listing.previewFileName?.trim();
  if (!fileName || !/\.(?:png|jpe?g|webp|avif|gif)$/iu.test(fileName)) return null;
  return `/api/marketplace/assets/${encodeURIComponent(listing.assetId)}?file=${encodeURIComponent(fileName)}&preview=1`;
}

/**
 * The badge names the file the way the person downloading it would — GLB, PNG —
 * not the way the HTTP layer does. "MODEL/GLTF-BINARY" is a content-type header
 * and nobody shops by content-type header.
 */
/** 카드 위 캡슐 칩의 등급. 뽑기 화면의 gradeOf 와 같은 규칙을 같은 사실(facts)로 돌린다. */
function cardGrade(listing: { title: string; description: string; entryFileName: string; variants?: unknown; facts?: unknown }): "S" | "A" | "B" | "C" {
  return gradeOf({
    title: listing.title,
    description: listing.description ?? "",
    entryFileName: listing.entryFileName ?? "",
    variants: (listing.variants ?? null) as never,
    clips: null,
    facts: (listing.facts ?? null) as never,
  } as never).letter;
}

function formatLabel(listing: Listing): string {
  const extension = listing.entryFileName.split(".").pop()?.toUpperCase();
  if (extension && extension.length <= 5) return extension;
  const format = listing.format?.trim().toUpperCase() ?? "";
  if (format.includes("GLTF-BINARY")) return "GLB";
  if (format.includes("GLTF")) return "GLTF";
  if (format.startsWith("IMAGE/")) return format.slice(6);
  return format.split("/").pop() || "FILE";
}

/**
 * The spec list below already shows the triangle count, the bounding box and the
 * file size, measured from the very bytes on sale. Repeating the same numbers in
 * the paragraph above it reads as a filing, not a description — so when the
 * viewer has measured the file, the paragraph drops its opening measurement
 * sentence and keeps what the numbers cannot say.
 */
function shopDescription(listing: Listing, measuredShown: boolean): string {
  if (!measuredShown) return listing.description;
  // Split on the sentence ending, not on ".", because every one of these
  // sentences carries decimal numbers ("2.44x2.26x1.35 m다").
  const [first, ...rest] = listing.description.split(/(?<=다\.)\s+/u);
  if (!rest.length) return listing.description;
  return /^(실측|합계)\s[\d,]+\s*tris/u.test(first) ? rest.join(" ") : listing.description;
}

/**
 * What to say about a listing that is a picture rather than a model.
 *
 * The page's measured spec list is written by the 3D viewer, so a texture page showed no
 * numbers at all and the evidence card underneath still spoke of triangles and draw calls.
 * A texture buyer needs three things: how many pixels, whether it tiles without a visible
 * seam, and how big the download is. Every one of them is read back out of the sentence the
 * audit already wrote into the listing — nothing here is measured again or guessed.
 */
function describePicture(listing: DetailListing): Array<{ head: string; tail: string }> | null {
  if (isModelListing(listing)) return null;
  const d = listing.description;
  const items: Array<{ head: string; tail: string }> = [];
  const tile = d.match(/(\d+)x(\d+) 심리스 타일/u);
  const pack = d.match(/(\d+)² 심리스 텍스처 (\d+)종/u);
  const sheet = d.match(/(\d+)×(\d+) RGBA PNG (\d+)컷/u);
  if (tile) items.push({ head: `${tile[1]}×${tile[2]} 픽셀`, tail: "이 텍스처의 해상도입니다" });
  else if (pack) items.push({ head: `${pack[1]}×${pack[1]} 픽셀 · ${pack[2]}장`, tail: "묶음에 들어 있는 텍스처입니다" });
  else if (sheet) items.push({ head: `한 칸 ${sheet[1]}×${sheet[2]} 픽셀 · ${sheet[3]}컷`, tail: "시트에 들어 있는 그림 수입니다" });
  const packVerdict = d.match(/SEAMLESS (\d+)종 · SOFT-SEAM (\d+)종/u);
  const verdict = d.match(/판정은 (SEAMLESS|SOFT-SEAM)/u);
  if (packVerdict) {
    items.push({ head: `자국 없이 이어짐 ${packVerdict[1]}종 · 살짝 티남 ${packVerdict[2]}종`, tail: "Clunk 텍스처 검사에서 잰 결과입니다" });
  } else if (verdict) {
    items.push({
      head: verdict[1] === "SEAMLESS" ? "이어붙여도 자국이 보이지 않습니다" : "이어붙이면 살짝 티가 납니다",
      tail: "Clunk 텍스처 검사에서 잰 결과입니다",
    });
  }
  items.push({ head: `${formatLabel(listing)} ${formatBytes(listing.byteLength)}`, tail: "내려받는 파일 크기입니다" });
  items.push({ head: licenseLabel(listing.licenseStatus), tail: "게임·앱·의뢰 작업에 쓸 수 있고, 원본 재판매만 제외됩니다" });
  return items;
}

/** The storage role of a file, said in the words of the person downloading it. */
// The hero and preview images are how the page shows a product, not what a buyer takes
// home; listing them as downloadable files made a six-tree pack look like eighteen files.
const PAGE_IMAGE_ROLES = new Set(["hero", "preview", "page"]);

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    entry: "본 파일",
    preview: "미리보기 이미지",
    page: "미리보기 이미지",
    hero: "대표 이미지",
    texture: "텍스처 이미지",
    metadata: "검사 기록",
    manifest: "구성 목록",
    // "passport" was our internal name for the certificate that travels with a file.
    passport: "검사 증명서",
  };
  return labels[role.trim().toLowerCase()] ?? role;
}

/** "cleared" is a column value. A buyer needs to know what they may do with it. */
function licenseLabel(status: string): string {
  return status.trim().toLowerCase() === "cleared" ? "상업적 이용 가능" : status;
}

function formatPrice(priceCents: number, currency: string): string {
  if (priceCents === 0) return "무료";
  const safeCurrency = /^[A-Z]{3}$/u.test(currency) ? currency : "KRW";
  try {
    return new Intl.NumberFormat("ko-KR", { style: "currency", currency: safeCurrency }).format(priceCents / 100);
  } catch {
    return `${(priceCents / 100).toLocaleString("ko-KR")} ${safeCurrency}`;
  }
}

function formatBytes(value: number): string {
  if (value < 1_000) return `${value} B`;
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)} KB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
}

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function listingFamily(listing: Listing): Exclude<CatalogFilter, "all"> {
  const value = `${listing.entryFileName} ${listing.format ?? ""}`.toLowerCase();
  // What makes a listing Motion is a clip or a named hinge in the file it sells, which the
  // measured facts carry. An animated sheet is a ".sheet.png" like any other, so for those
  // the frame count in the baker's own title is the evidence — the sheet's grid, not a word
  // someone typed.
  const animated = hasMotion(listing.facts) || (listing.facts?.sheet?.frames ?? null) !== null;
  if (animated || value.includes("motion") || value.includes("animation")) return "motion";
  if (value.includes("png") || value.includes("sprite") || value.includes("atlas") || value.includes("spine") || value.includes("2d")) return "2d";
  return "3d";
}

/**
 * The bench for a tile product.
 *
 * A texture has nothing to orbit, and the one question a buyer actually has about a
 * seamless tile is the one a single still cannot answer: does the join show when it is laid
 * next to itself? So the stage tiles the image, 1x1 / 2x2 / 3x3, and a magnifier lets the
 * seam be looked at closely instead of taken on trust.
 *
 * What is being tiled is the public preview — the watermarked 512 downscale — because that
 * is the only image the shop may show before payment. The note says so.
 */
function TileBench({ src, alt, seamless }: { src: string; alt: string; seamless: boolean }) {
  const [repeat, setRepeat] = useState(1);
  const [zoom, setZoom] = useState(1);
  return (
    <div className={styles.flatBench}>
      <div className={styles.flatStage}>
        <div
          className={styles.flatSurface}
          role="img"
          aria-label={`${alt} — ${repeat}×${repeat}로 이어붙인 미리보기`}
          style={{ backgroundImage: `url(${src})`, backgroundSize: `${((100 / repeat) * zoom).toFixed(2)}%` }}
        />
      </div>
      <div className={styles.flatBar}>
        <strong>이어붙임 미리보기</strong>
        {[1, 2, 3].map((count) => (
          <button
            key={count}
            type="button"
            className="cv5-bench-chip"
            aria-pressed={repeat === count}
            onClick={() => setRepeat(count)}
          >
            {count}×{count}
          </button>
        ))}
        <label>
          확대 {zoom.toFixed(1)}×
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.1}
            value={zoom}
            aria-label="확대 배율"
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
      </div>
      <p className={styles.flatNote}>
        {seamless
          ? "이어 붙인 경계를 재 봤을 때 자국이 남지 않았습니다. 위에서 직접 이어 붙여 확인해 보세요."
          : "이어 붙인 경계에 옅은 자국이 남는 것으로 재졌습니다."}
        {" 여기 보이는 그림은 결제 전 공개용 미리보기이고, 받는 파일은 원본 해상도입니다."}
      </p>
    </div>
  );
}

/**
 * The bench for a sprite-sheet product.
 *
 * A sheet is a grid of frames, so the useful thing to do with it is play a row. That is only
 * honest when the image on screen really is the grid: the shop's public preview for some
 * sheets is a card-shaped contact image, not the sheet itself. The bench measures the image
 * it was given against the grid the listing states, and offers playback only when the two
 * agree — otherwise it shows the picture and says why the player is not there.
 */
function SheetBench({
  src,
  alt,
  sheet,
}: {
  src: string;
  alt: string;
  sheet: NonNullable<NonNullable<Listing["facts"]>["sheet"]>;
}) {
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(8);
  const [row, setRow] = useState(0);
  const [frame, setFrame] = useState(0);
  const [zoom, setZoom] = useState(6);

  useEffect(() => {
    let live = true;
    const image = new window.Image();
    image.onload = () => { if (live) setNatural({ width: image.naturalWidth, height: image.naturalHeight }); };
    image.src = src;
    return () => { live = false; };
  }, [src]);

  const frames = sheet.frames;
  // The public preview for these sheets is the grid with a strip of padding added on the
  // right — measured, not assumed: the sheet's pixels sit at (0, 0) of the card, identical.
  // So the rows must line up exactly and the image may be wider, and the frames played are
  // the real frames rather than a mock-up. An image that does not match the grid the listing
  // states gets no player at all.
  const playable = Boolean(
    frames && natural
      && natural.height === sheet.directions * sheet.cell
      && natural.width >= frames * sheet.cell,
  );

  useEffect(() => {
    if (!playing || !playable || !frames) return;
    const timer = window.setInterval(() => setFrame((value) => (value + 1) % frames), Math.round(1000 / fps));
    return () => window.clearInterval(timer);
  }, [playing, playable, frames, fps]);

  const cell = sheet.cell * zoom;
  return (
    <div className={styles.flatBench}>
      <div className={styles.flatStage}>
        {playing && playable && natural ? (
          <div
            className={`${styles.flatSurface} ${styles.flatSheet}`}
            role="img"
            aria-label={`${alt} — ${row + 1}번째 방향 재생 중`}
            style={{
              width: cell,
              height: cell,
              flex: "0 0 auto",
              backgroundImage: `url(${src})`,
              backgroundSize: `${natural.width * zoom}px ${natural.height * zoom}px`,
              backgroundPosition: `-${frame * cell}px -${row * cell}px`,
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.flatGrid} src={src} alt={alt} />
        )}
      </div>
      <div className={styles.flatBar}>
        <strong>프레임 재생</strong>
        <button
          type="button"
          className="cv5-bench-chip"
          aria-pressed={playing}
          disabled={!playable}
          onClick={() => setPlaying((value) => !value)}
        >
          {playing ? "■ 격자 보기" : "▶ 재생"}
        </button>
        {playable ? (
          <>
            <label>
              초당 {fps}장
              <input
                type="range"
                min={2}
                max={16}
                step={1}
                value={fps}
                aria-label="초당 프레임 수"
                onChange={(event) => setFps(Number(event.target.value))}
              />
            </label>
            <label>
              확대 {zoom}×
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={zoom}
                aria-label="확대 배율"
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
            <span className={styles.flatDirections} role="group" aria-label="방향 고르기">
              {Array.from({ length: sheet.directions }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  className="cv5-bench-chip cv5-bench-chip-tiny"
                  aria-pressed={row === index}
                  aria-label={`${index + 1}번째 방향`}
                  onClick={() => setRow(index)}
                >
                  {index + 1}
                </button>
              ))}
            </span>
          </>
        ) : null}
      </div>
      <p className={styles.flatNote}>
        {playable
          ? `한 칸 ${sheet.cell}×${sheet.cell}, ${sheet.directions}방향 × ${sheet.frames}프레임입니다. 방향 하나가 한 줄이라, 게임에서도 한 줄을 그대로 재생하면 됩니다. 위 재생은 이 시트의 실제 칸을 그대로 넘긴 것입니다.`
          : `한 칸 ${sheet.cell}×${sheet.cell}, ${sheet.directions}방향${sheet.frames ? ` × ${sheet.frames}프레임` : ""}입니다. 여기 보이는 그림은 결제 전 공개용 미리보기라 격자 그대로가 아니어서 재생은 받은 뒤에 확인할 수 있습니다.`}
      </p>
    </div>
  );
}

/**
 * The palette the viewer measured, as swatches you can copy.
 *
 * Meshy and polyfork both show an asset's colours; for us it is not decoration but the
 * same kind of evidence as the triangle count — read out of the file on sale, with the
 * share of surface each colour covers, so the ordering is the one the eye sees rather
 * than the one the material list happens to be in.
 */
function PaletteStrip({ palette }: { palette: Array<{ hex: string; share: number }> }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (hex: string) => {
    // Clipboard access is refused in some embeddings; falling back to a select-all
    // textarea would be worse than simply not confirming.
    void navigator.clipboard?.writeText(hex).then(
      () => {
        setCopied(hex);
        window.setTimeout(() => setCopied((current) => (current === hex ? null : current)), 1400);
      },
      () => undefined,
    );
  };
  return (
    <div className={styles.palette}>
      <span className={styles.paletteLabel}>파일 안의 색 {palette.length}가지 · 면적 비율</span>
      <ul className={styles.paletteRow}>
        {palette.map((entry) => (
          <li key={entry.hex}>
            <button
              type="button"
              className={styles.swatch}
              style={{ background: entry.hex }}
              onClick={() => copy(entry.hex)}
              title={`${entry.hex} · 표면의 ${(entry.share * 100).toFixed(1)}%`}
              aria-label={`${entry.hex}, 표면의 ${(entry.share * 100).toFixed(1)} 퍼센트. 눌러서 복사`}
            >
              <span className={styles.swatchHex}>{copied === entry.hex ? "복사됨" : entry.hex}</span>
              {/* The bar is the share, drawn to the same number the tooltip states. */}
              <span className={styles.swatchShare} style={{ width: `${Math.max(entry.share * 100, 3)}%` }} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Other listings whose measured colours sit closest to this one.
 *
 * Every shop has a "goes with this" rail and almost all of them run on tags someone typed.
 * Ours is measured: the colours come out of the files, so this is the one recommendation on
 * the site that is a number rather than an opinion. It also crosses kinds without anyone
 * declaring a relationship — a sprite sheet baked from a model reliably lands next to the
 * model it came from, which is the shop checking its own claim that the two match.
 *
 * The distance is shown, because a recommendation a buyer cannot audit is just a banner.
 */
function ColourMatches({ matches }: { matches: ColourMatch[] }) {
  return (
    <section className={styles.matches}>
      <h3 className={styles.matchesTitle}>색이 맞는 에셋</h3>
      <p className={styles.matchesNote}>
        태그가 아니라 파일에서 잰 색으로 고른 것입니다. 숫자는 색 거리이고, 0에 가까울수록 같은 팔레트입니다.
      </p>
      <ul className={styles.matchesList}>
        {matches.map((match) => (
          <li key={match.slug}>
            <Link href={`/marketplace/${encodeURIComponent(match.slug)}`}>
              <span className={styles.matchBar} aria-hidden="true">
                {match.palette.map((entry) => (
                  <span key={entry.hex} style={{ background: entry.hex, flexGrow: Math.max(entry.share, 0.02) }} />
                ))}
              </span>
              <span className={styles.matchName}>{displayTitle(match.slug, match.title)}</span>
              <span className={styles.matchScore}>색 거리 {match.distance.toFixed(3)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** #rrggbb to 0..1 components. Palette hexes are written by us, so no parsing guard. */
function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

/**
 * How much of a listing's surface is within reach of this colour, or null if none is.
 *
 * Reach rather than equality: two greens a few percent apart are the same colour to anyone
 * choosing assets for a scene, and demanding an exact hex would return nothing for almost
 * every pick. The shares of every colour inside the radius are added, so an asset that is
 * mostly this colour outranks one that only has a trim of it.
 */
const COLOUR_REACH = 0.2;
function carriesColour(listing: Listing, hex: string): number | null {
  if (!listing.palette?.length) return null;
  const [r, g, b] = hexToRgb(hex);
  let share = 0;
  for (const entry of listing.palette) {
    const [r2, g2, b2] = hexToRgb(entry.hex);
    if (Math.hypot(r - r2, g - g2, b - b2) <= COLOUR_REACH) share += entry.share;
  }
  return share > 0 ? share : null;
}

/**
 * Match the catalogue against a colour you already have.
 *
 * The question a game developer actually arrives with is whether a thing will sit next to
 * what is already in their scene, and no keyword answers it. Because the palettes are
 * measured, this can: pick the colour, and the grid leads with whatever carries most of it.
 *
 * It sorts rather than filters. This catalogue is largely browns and tans, so a filter would
 * hide two thirds of the shop to answer "is there anything green" — putting the green first
 * and saying how green it is answers the same question without throwing the rest away.
 */
function ColourPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <div className={styles.colourRow}>
      <label className={styles.colourPick}>
        <span className={styles.colourLabel}>내 게임 색으로 맞추기</span>
        <input
          type="color"
          value={value || "#8a6a44"}
          onChange={(event) => onChange(event.target.value.toLowerCase())}
          aria-label="맞출 색 고르기"
        />
      </label>
      {value ? (
        <>
          <code className={styles.colourValue}>{value}</code>
          <button type="button" className={styles.colourClear} onClick={() => onChange("")}>
            해제
          </button>
        </>
      ) : null}
    </div>
  );
}
