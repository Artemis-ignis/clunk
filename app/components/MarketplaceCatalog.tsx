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
  memberCount,
  motionNote,
  reconcileMeasured,
  type ListingFacts,
} from "./listing-facts-rows";
import { engineSteps, engineBasis } from "./engine-fit-rows";
import styles from "../marketplace/marketplace.module.css";
// 등급(S/A/B/C)은 마켓의 단일 규칙이다(catalog-facts.GRADE_RULE). 값이 아니라 크기와
// 동작을 보고 매기므로 판매와 무관하고, 무엇을 받을 수 있는지는 등급이 아니라
// 접근권(무료 등급 / 구독)이 정한다.
import {
  gradeOf,
  isFreeGrade,
  isKitProduct,
  kitOfPart,
  kitOfProduct,
  kitsFrom,
  type Kit,
} from "./catalog-facts";
import { useProductWebMcp } from "../webmcp/useProductWebMcp";

type Listing = {
  id: string;
  slug: string;
  title: string;
  /** 같은 상품의 영어 이름. 아직 붙이지 않은 상품은 null. */
  titleEn?: string | null;
  description: string;

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
  assetId: string;
  entryFileName: string;
  byteLength: number;
  format: string;
  /** The sheet's measured grid, served with the row so its facts survive a rename. */
  facts?: ListingFacts | null;
};

/** A motion the sprite baker turned this model's pivots with, as the viewer replays it. */
type ListingClip = { name: string; label: string; fps: number; tracks: Array<{ node: string; axis: "x" | "y" | "z"; degrees: number[] }> };

/** A listing the shop found by comparing measured colour, not by matching a tag. */
type ColourMatch = { slug: string; title: string; distance: number; palette: Array<{ hex: string; share: number }> };

type CatalogFilter = "all" | "kit" | "2d" | "3d" | "motion";
type CatalogSort = "newest" | "name" | "size-asc";
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

/**
 * 이 상품을 지금 받을 수 있는가.
 *
 * 낱개로 값을 매겨 크레딧으로 팔던 구조가 결제대행 심사에서 환금성으로 걸려
 * 없어졌다. 남은 축은 등급 하나다 — 무료 등급은 로그인만 하면 받고, 그 밖은
 * 구독이 살아 있어야 받는다. 값을 보여 줄 자리가 아니라 받을 수 있는지를
 * 보여 줄 자리다.
 */
/**
 * 이 상품을 로그인만으로 받을 수 있는가.
 *
 * 저장해 둔 컬럼(access_tier)이 아니라 등급에서 바로 계산한다. 컬럼은 등급과 어긋날 수
 * 있고, 어긋난 순간 카드는 "무료"라고 적는데 문은 잠기거나 그 반대가 된다. 다운로드
 * 문지기(app/api/marketplace/assets/[assetId]/route.ts)도 같은 두 함수를 부른다.
 */
function isFreeTier(listing: { title: string; description: string; entryFileName: string; variants?: unknown; clips?: unknown; facts?: unknown }): boolean {
  return isFreeGrade(cardGrade(listing));
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
 * The name to show — the stored title, and nothing else.
 *
 * This used to be a lookup table that renamed the eight texture listings on their way to the
 * screen, because their stored titles were the words the pipeline was run with ("tilled soil
 * (Harvest Frontier 실수주) 심리스 텍스처 (1024x1024)"). Every one of those rows has since been
 * renamed at the source in D1, so the table now only had the power to overrule a rename made
 * there and show a name the shop no longer uses. It is gone: the row is the name.
 */
function displayTitle(_slug: string, title: string): string {
  return title;
}

/** A 3D model rather than a picture — decides which numbers describe the file honestly. */
function isModelListing(listing: Pick<Listing, "entryFileName">): boolean {
  return /\.(glb|gltf)$/i.test(listing.entryFileName);
}

/**
 * The sheet's own numbers, served with the row.
 *
 * The grid used to be parsed back out of the title ("… (64×64, 8방향 × 8프레임)"), which made
 * the product's name the source of a measured number: renaming the sheets to plain nouns on
 * 2026-09-03 would have emptied this row on all thirteen. The figures now come from
 * app/data/listing-facts.json, which the baker's sheet manifest wrote, so nothing here is
 * recomputed and a row cannot state a frame count the sheet does not have. Only the kind of
 * sheet — "스프라이트 시트", "여닫기 애니메이션 시트" — is still the title's last clause,
 * because that is a name rather than a measurement.
 */
function variantFacts(variant: ListingVariant): { kind: string; facts: string[] } {
  const kind = variant.title.match(/·\s*([^·]+?)\s*$/u)?.[1] ?? "스프라이트 시트";
  const sheet = variant.facts?.sheet ?? null;
  const facts: string[] = [];
  if (sheet) {
    facts.push(`한 칸 ${sheet.cell}×${sheet.cell}`, `${sheet.directions}방향`);
    if (sheet.frames !== null) facts.push(`${sheet.frames}프레임`);
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
const CATALOG_SORTS = new Set<string>(["newest", "name", "size-asc"]);

/**
 * 목록을 거르는 탭.
 *
 * "키트"는 다른 셋과 성격이 다르다 — 나머지는 상품을 거르지만 키트 탭은 상품 대신
 * 키트를 세운다(docs/kits.md). 그래서 카드 격자 자체가 바뀐다.
 */
const CATALOG_FILTERS: readonly { id: CatalogFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "kit", label: "키트" },
  { id: "3d", label: "3D 모델" },
  { id: "2d", label: "2D 스프라이트" },
  { id: "motion", label: "움직임 있음" },
];

/**
 * `salesOpen` 은 서버가 알려 준다(app/api/_lib/sales-lock.areSalesOpen). 지금은 판매가
 * 닫혀 있어 로그인만 하면 무엇이든 받는데, 카드는 유료 등급에 "구독자 전용" 이라고만
 * 적고 있었다 — 2026-09-04 마스터: "지금 구독자 전용이라고 표시해놓고 무료로 다운받게
 * 해놨으니깐 문제임". 지금 되는 일과 나중에 될 일을 둘 다 적는다.
 */
export function MarketplaceCatalog({ salesOpen = false }: { salesOpen?: boolean }) {
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
  // 한 키트만 펼쳐 보는 자리. 합쳐 파는 상품이 있는 키트는 그 상품 페이지가 키트 화면이
  // 되지만, 부품만 파는 키트(하베스트 프론티어)는 열어 볼 상품 페이지가 없다 — 없는
  // 페이지를 만들지 않고 목록을 그 키트로 좁힌다(docs/kits.md 7절).
  const [kitFocus, setKitFocus] = useState(() => {
    const value = initial.get("kit") ?? "";
    return /^[a-z0-9][a-z0-9-]{0,95}$/i.test(value) ? value : "";
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
    apply("kit", kitFocus, "");
    const search = params.toString();
    window.history.replaceState(
      null,
      "",
      search ? `?${search}${window.location.hash}` : `${window.location.pathname}${window.location.hash}`,
    );
  }, [filter, sort, query, colour, kitFocus]);

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

  // 목록에서 키트를 세운다. 근거는 상품이 스스로 적어 둔 사실(facts.kit / facts.members)
  // 하나뿐이라, 키트가 새로 들어오면 이 화면은 고치지 않아도 선다(docs/kits.md).
  const kits = useMemo(() => kitsFrom(listings), [listings]);
  const focusedKit = useMemo(
    () => (kitFocus ? kits.find((kit) => kit.id === kitFocus) ?? null : null),
    [kitFocus, kits],
  );

  const filteredKits = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return kits;
    return kits.filter((kit) => `${kit.name} ${kit.themeName}`.toLowerCase().includes(normalizedQuery));
  }, [kits, query]);

  const filteredListings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    // 키트 하나를 펼친 동안에는 그 키트의 부품만 선다. 부품이 아닌 것을 함께 보여 주면
    // "이 키트의 부품 9개"라고 적어 놓고 열 몇 장을 깔게 된다.
    const pool = focusedKit ? focusedKit.parts : listings;
    const matched = pool.filter((listing) => {
      const searchable = [listing.title, listing.description, listing.entryFileName, listing.format, listing.licenseStatus]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      return matchesQuery && (focusedKit || filter === "all" || filter === "kit" || listingFamily(listing) === filter);
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

      return (a.byteLength ?? 0) - (b.byteLength ?? 0);
    });
  }, [colour, filter, focusedKit, listings, query, sort]);

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
              {CATALOG_FILTERS
                // 키트가 하나도 서지 않으면 키트 탭도 걸지 않는다. 눌러도 빈 화면이
                // 나오는 탭은 상점이 스스로에 대해 하는 거짓말이다.
                .filter((option) => option.id !== "kit" || kits.length > 0)
                .map((option) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={!focusedKit && filter === option.id}
                    className={`${styles.tab}${!focusedKit && filter === option.id ? ` ${styles.tabOn}` : ""}`}
                    key={option.id}
                    onClick={() => { setFilter(option.id); setKitFocus(""); }}
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
                <option value="size-asc">파일 작은순</option>
              </select>
            </label>
            <span className={styles.count} aria-live="polite">
              {focusedKit
                ? `부품 ${filteredListings.length}개`
                : filter === "kit"
                  ? `키트 ${filteredKits.length}개`
                  : `에셋 ${filteredListings.length}개`}
            </span>
          </div>
          {/* 키트 하나를 펼친 화면의 머리글. 어느 키트인지, 무엇이 몇 개 들어 있는지,
              그리고 여기서 나가는 길이 한 자리에 있어야 한다. */}
          {focusedKit ? <KitFocusHead kit={focusedKit} onClear={() => setKitFocus("")} /> : null}
          {(focusedKit || filter !== "kit") && filteredListings.length === 0 ? (
            <NoResults query={query} onReset={() => { setQuery(""); setFilter("all"); setColour(""); setKitFocus(""); }} />
          ) : null}
          {!focusedKit && filter === "kit" && filteredKits.length === 0 ? (
            <NoResults query={query} onReset={() => { setQuery(""); setFilter("all"); setColour(""); setKitFocus(""); }} />
          ) : null}
          {/* 베타(결제 미설정) 상태는 카드에 칠하지 않는다. 예전에는 베타면 모든 카드의
              접근권 칩이 "무료" 색으로 칠해져, 글자는 "구독자 전용"인데 색은 무료인
              칩이 스물몇 장 깔렸다 — 두 상태를 색으로 구분할 수 없던 진짜 까닭이다.
              지금 무엇이 열려 있는지는 위의 CheckoutNotice 가 한 번만 말한다. */}
          <div className={styles.grid}>
            {!focusedKit && filter === "kit"
              ? filteredKits.map((kit) => <KitCard key={kit.id} kit={kit} salesOpen={salesOpen} />)
              : filteredListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} colour={colour} salesOpen={salesOpen} />
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

function ListingCard({ listing, colour, salesOpen = false }: { listing: Listing; colour?: string; salesOpen?: boolean }) {
  const previewUrl = getPreviewUrl(listing);
  const cardFree = isFreeTier(listing);
  const grade = cardGrade(listing);
  const spec = cardSpec(listing.facts);
  const motion = motionNote(listing.facts);
  const colourShare = colour ? carriesColour(listing, colour) : null;
  // 부품 슬러그를 적어 둔 키트 상품이거나, 개수만 적힌 옛 묶음일 때의 그 개수.
  const kitMembers = memberCount(listing.facts?.members ?? null);

  // One card, one link. A grid is for choosing what to open, so the card carries
  // the picture, the name, the number that decides fit, and whether it can be had —
  // the buy decision belongs on the page the card opens.
  return (
    <Link className={styles.card} href={`/marketplace/${encodeURIComponent(listing.slug)}`}>
      <span className={styles.cardArt}>
        {previewUrl ? (
          <Image src={previewUrl} alt={`${displayTitle(listing.slug, listing.title)} 미리보기`} width={720} height={540} unoptimized />
        ) : (
          <PreviewUnavailable listing={listing} />
        )}
        {/* 그림 위에 뜨는 것은 접근권 하나다.
            2026-09-04 마스터: "무료랑 구독자 전용은 버튼형태로 만들던가 해야지 색감 저따구로
            하면 어케 보라고 … 그리고 PNG 애들은 뭐냐". 재 보니 맞는 말이었다 —
            public/market 의 히어로 PNG 30장에서 칩이 앉는 띠(위 5~20%)를 픽셀째 읽어 WCAG
            대비를 계산했더니, 옛 무료 칩(16% 민트 위의 #34d399 글자)은 밝은 미리보기 위에서
            1.21:1 이었다. 글자와 배경을 구분할 수 있는 값이 아니다. 지금은 불투명하게 칠해
            무료 9.76:1 / 구독자 전용 8.24:1 이고, 뒤에 어떤 그림이 오든 그 값이 유지된다.
            등급과 형식은 카드 본문의 사실줄로 내렸다 — 그림 위에 홀로 뜬 "PNG" 는 무엇을
            가리키는지 말해 주지 않지만, "PNG · 1024×1024 · 이어붙는 타일" 은 스스로 말한다. */}
        <span className={styles.cardBadges} aria-hidden="true">
          {/* Why this card is where it is. Reordering a grid without saying what reordered
              it reads as the shop shuffling itself. Only here while a colour is picked. */}
          {colourShare !== null ? (
            <span className={styles.colourBadge}>이 색 {Math.round(colourShare * 100)}%</span>
          ) : null}
          {/* 판매가 열리기 전에는 유료 등급도 로그인만 하면 받는다. 그 사실을 숨기고
              "구독자 전용" 이라고만 적으면, 눌러서 받아지는 순간 라벨이 거짓이 된다. */}
          <span className={`${styles.accessBadge} ${cardFree || !salesOpen ? styles.accessFree : styles.accessSub}`}>
            {cardFree ? "무료" : salesOpen ? "구독자 전용" : "베타 무료"}
          </span>
        </span>
      </span>
      <span className={styles.cardBody}>
        <span className={styles.cardTitle}>{displayTitle(listing.slug, listing.title)}</span>
        <span className={styles.cardSpec}>
          {/* 등급은 값이 아니라 크기와 동작을 보고 매기는 분류다(catalog-facts.GRADE_RULE).
              그림 위에 홀로 뜬 낱글자 "S" 는 무엇의 S 인지 말하지 않아 여기서 "S 등급" 으로
              적는다. 카드 본문은 불투명해서 대비가 그림에 좌우되지 않는다 — 가장 나쁜
              등급색(A, #c084fc)이 6.01:1(돌고 있는 화면에서 다시 측정하면 6.03:1)이고,
              그림 위에서는 밝은 미리보기를 만나면 3.15:1 까지 떨어졌다. */}
          <span className={styles.gradeBadge} data-grade={grade}>{grade} 등급</span>
          {/* 형식과 측정값은 한 줄이다. "PNG" 만 따로 떠 있으면 무엇을 가리키는 말인지 알 수
              없지만, 측정값 앞에 붙으면 그 값이 무엇의 값인지를 형식이 말해 준다. */}
          <span>{spec ? `${formatLabel(listing)} · ${spec}` : formatLabel(listing)}</span>
          {/* Only when the file itself carries a clip or a named hinge, and it says how many
              of each. Never read off a title, so a card cannot promise motion the download
              does not have.

              The generative-AI label used to sit here too. It is a legal disclosure, not a
              feature, and every card carrying it made the grid read as a row of stickers;
              it now appears once on the product page, under the facts. */}
          {motion ? <span className={styles.motionChip}>{motion}</span> : null}
        </span>
        {/* 이 상품이 키트라면 몇 개가 들어 있는지가 카드에서 가장 먼저 읽혀야 하는
            사실이다 — 낱개와 값이 같은 자리에 놓이기 때문이다(docs/kits.md). */}
        {kitMembers ? <span className={styles.cardIncluded}>부품 {kitMembers}개 묶음</span> : null}
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

/**
 * 키트 한 장. 상품 카드와 같은 틀을 쓰되 읽히는 사실이 다르다 — 낱개는 "이 파일이
 * 얼마나 무거운가"를 묻고, 키트는 "무엇이 몇 개 들어 있고 서로 어울리는가"를 묻는다.
 *
 * 등급은 합친 파일의 등급이 아니라 가장 높은 부품의 등급이다(docs/kits.md 5절). 부품
 * 여섯 개가 전부 B 인 키트를 S 로 적으면 사는 사람이 S 급 물건을 기대하게 된다.
 */
function KitCard({ kit, salesOpen = false }: { kit: Kit<Listing>; salesOpen?: boolean }) {
  return (
    <Link className={styles.card} href={kit.href} data-kit={kit.id}>
      <span className={styles.cardArt}>
        {kit.heroUrl ? (
          <Image src={kit.heroUrl} alt={`${kit.name} 미리보기`} width={720} height={540} unoptimized />
        ) : (
          <span className={styles.previewUnavailable} role="img" aria-label={`${kit.name} 미리보기 없음`}>
            <span>미리보기 이미지 없음</span>
            <strong>{kit.name}</strong>
          </span>
        )}
        <span className={styles.cardBadges} aria-hidden="true">
          <span className={styles.kitBadge}>키트</span>
          <span className={`${styles.accessBadge} ${kit.free || !salesOpen ? styles.accessFree : styles.accessSub}`}>
            {kit.free ? "무료" : salesOpen ? "구독자 전용" : "베타 무료"}
          </span>
        </span>
      </span>
      <span className={styles.cardBody}>
        <span className={styles.cardTitle}>{kit.name}</span>
        <span className={styles.cardSpec}>
          <span className={styles.gradeBadge} data-grade={kit.grade}>{kit.grade} 등급</span>
          <span>{kit.themeName} · 부품 {kit.parts.length}개</span>
        </span>
        {kit.triangles !== null ? (
          <span className={styles.cardIncluded}>
            부품 합계 폴리곤 {kit.triangles.toLocaleString("ko-KR")}개
            {kit.byteLength ? ` · ${formatBytes(kit.byteLength)}` : ""}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/**
 * 한 키트를 펼쳐 볼 때 목록 위에 놓이는 머리글.
 *
 * 합쳐 파는 상품이 있는 키트는 그 상품 페이지가 키트 화면이므로 여기까지 오지 않는다.
 * 여기 서는 것은 부품만 파는 키트다 — 그래도 사는 사람에게는 하나의 물건이라, 이름과
 * 합계와 나가는 길을 한 자리에 둔다.
 */
function KitFocusHead({ kit, onClear }: { kit: Kit<Listing>; onClear: () => void }) {
  return (
    <section className={styles.kitHead} aria-label={`${kit.name} 키트`} data-kit-head={kit.id}>
      <div className={styles.kitHeadText}>
        <span className={styles.kitHeadEyebrow}>키트 · {kit.themeName}</span>
        <strong>{kit.name}</strong>
        <span className={styles.kitHeadGrade}>
          <span className={styles.gradeBadge} data-grade={kit.grade}>{kit.grade} 등급</span>
          <small>부품 중 가장 높은 등급입니다</small>
          <small>{licenseLabel(kit.licenseStatus ?? "cleared")}</small>
        </span>
        <p>
          같은 팔레트, 같은 축척으로 만든 부품 {kit.parts.length}개입니다.
          {kit.triangles !== null
            ? ` 모두 합치면 폴리곤 ${kit.triangles.toLocaleString("ko-KR")}개${kit.byteLength ? `, ${formatBytes(kit.byteLength)}` : ""}입니다.`
            : ""}
          {" 부품은 하나씩 따로 받습니다."}
        </p>
      </div>
      <div className={styles.kitHeadActions}>
        {kit.product ? (
          <Link className={`${styles.btn} ${styles.btnPrimary}`} href={`/marketplace/${encodeURIComponent(kit.product.slug)}`}>
            한 파일로 받기 <Icon name="arrowRight" size={14} />
          </Link>
        ) : null}
        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onClear}>
          전체 목록으로 <Icon name="arrowLeft" size={14} />
        </button>
      </div>
    </section>
  );
}

/**
 * 키트의 부품 격자. 키트 상품 페이지와 부품 페이지가 같은 것을 쓴다 — 한쪽은 "이 키트에
 * 들어 있는 것", 다른 한쪽은 "같은 키트의 나머지"라서 제목만 다르다.
 */
function KitParts({ title, note, parts }: { title: string; note?: string | null; parts: readonly Listing[] }) {
  if (!parts.length) return null;
  return (
    <section className={styles.kitParts} aria-labelledby="kit-parts-heading">
      <h2 id="kit-parts-heading" className={styles.variantsTitle}>{title}</h2>
      {note ? <p className={styles.variantsNote}>{note}</p> : null}
      <ul className={styles.kitPartList}>
        {parts.map((part) => {
          const preview = getPreviewUrl(part);
          const spec = cardSpec(part.facts);
          return (
            <li key={part.slug}>
              <Link href={`/marketplace/${encodeURIComponent(part.slug)}`}>
                <span className={styles.kitPartArt}>
                  {preview ? (
                    <Image src={preview} alt="" width={200} height={150} unoptimized />
                  ) : (
                    <span className={styles.kitPartNoArt} aria-hidden="true" />
                  )}
                </span>
                <span className={styles.kitPartName}>{displayTitle(part.slug, part.title)}</span>
                {spec ? <span className={styles.kitPartSpec}>{spec}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
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
  // 목록도 함께 읽는다. 이 상품이 어느 키트의 부품인지, 그 키트에 지금 공개된 부품이
  // 몇 개인지는 이 상품 한 행만 봐서는 알 수 없다 — facts 의 kitSize 는 빌드 매니페스트가
  // 센 값이라 공개를 내린 부품까지 세고 있다(docs/kits.md 3절). 목록 응답은 30초 캐시가
  // 걸려 있어 같은 방문에서 두 번 나가지 않는다.
  const [catalog, setCatalog] = useState<Listing[]>([]);
  // Whether this visitor is signed in, asked once on mount. null while the answer is still
  // in flight.
  //
  // A signed-out visitor used to press "무료로 받기", wait for a checkout POST to
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

  useEffect(() => {
    let active = true;
    void fetch("/api/marketplace", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as CatalogPayload;
        if (!response.ok || payload.ok !== true || !Array.isArray(payload.listings)) return;
        // 키트를 못 읽는 것은 이 화면이 서지 못할 까닭이 아니다. 실패하면 키트 줄만 빠진다.
        if (active) setCatalog(payload.listings.filter((row) => row.status === "PUBLISHED"));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const kits = useMemo(() => kitsFrom(catalog), [catalog]);

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
    if (paymentMethod !== "beta" && !freeTier && !withdrawalConsent) {
      setMessage("결제를 시작하려면 청약철회 제한 동의가 필요합니다.");
      return;
    }
    setBuying(true);
    setMessage(
      paymentMethod === "beta"
        ? "받는 중입니다…"
        : paymentMethod === "credits"
          ? "결제를 처리하는 중입니다…"
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
              ? `${purchase.label} — 받았습니다. 내려받기가 시작됩니다. 시작되지 않으면 내려받기 버튼을 누르세요.`
              : `${purchase.label} — 이미 받은 상품입니다. 내려받기가 시작됩니다.`,
        );
        triggerDownload(purchase.href, purchase.fileName);
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

  const freeTier = isFreeTier(listing);
  const previewUrl = getPreviewUrl({ assetId: listing.artifact.assetId, previewFileName: listing.artifact.previewFileName });
  const paymentUnavailable = !freeTier && checkout?.status === "PAYMENT_PROVIDER_NOT_CONFIGURED";
  // Until sales open, the payment-provider gap is the beta: nothing is sold and every
  // signed-in visitor is granted the file.
  const beta = checkout?.status === "PAYMENT_PROVIDER_NOT_CONFIGURED";
  const downloadHref = `/api/marketplace/assets/${encodeURIComponent(listing.assetId)}?file=${encodeURIComponent(listing.entryFileName)}`;
  const owned = ownedIds.has(listing.id);
  const isModel = isModelListing(listing);
  const name = displayTitle(listing.slug, listing.title);
  const pictureSpec = describePicture(listing);
  const rows = listing.facts ? factRows(listing.facts) : [];
  const engines = engineSteps(listing.facts?.engine);
  const engineWhy = engineBasis(listing.facts?.engine);
  // 이 상품이 어느 키트의 부품인지, 혹은 이 상품 자체가 키트인지. 둘 다 목록에서
  // 실제로 찾아낸 공개 부품만 보고 정한다(docs/kits.md).
  const partKit = kitOfPart(listing, kits);
  const ownKit = kitOfProduct(listing, kits);
  const kit = listing.facts
    ? kitLine(listing.facts, partKit ? { name: partKit.name, count: partKit.parts.length } : null)
    : null;
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
        {/* 영어 이름. 한국인은 한국어로, 그 밖은 영어로 이 물건을 찾는다. 같은 물건에
            두 이름이 붙어 있어야 어느 쪽으로 와도 같은 자리에 닿는다. */}
        {listing.titleEn ? <p className={styles.detailTitleEn} lang="en">{listing.titleEn}</p> : null}
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
          <TileBench src={previewUrl} alt={`${name} 타일 미리보기`} texture={listing.facts?.texture ?? null} />
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
          {/* 어디서 열리는지. 사는 사람이 가장 먼저 알고 싶어 하는 것이고, 판정의 근거는
              전부 파일 안에 있다 — glTF 파일은 자기가 필요로 하는 확장을 스스로 적어
              두므로, 그 목록이 비어 있으면 glTF 를 읽는 프로그램이면 무엇이든 연다.
              엔진마다 다른 것은 무엇으로 여느냐뿐이라 임포터 이름을 함께 적는다. */}
          {engines.length ? (
            <div className={styles.engineFit}>
              <p className={styles.engineHead}>받아서 엔진에 넣기</p>
              <ul className={styles.engineList} aria-label="엔진별로 이 파일을 넣는 방법">
                {engines.map((row) => (
                  <li key={row.id} data-opens={row.opens ? "yes" : "check"}>
                    <Icon name={row.opens ? "check" : "info"} size={14} />
                    <b>{row.engine}</b>
                    <small>{row.how}</small>
                    {row.caution ? <em>{row.caution}</em> : null}
                  </li>
                ))}
              </ul>
              {engineWhy.map((line) => (
                <p key={line} className={styles.engineNote}>{line}</p>
              ))}
            </div>
          ) : null}
          {/* Which set this belongs to, and how many pieces share its palette and its scale.
              A buyer furnishing a scene is choosing a family, not a file.

              키트를 목록에서 찾아냈으면 돌아가는 길까지 함께 준다 — 부품 한 장을 보고
              "나머지는 어디 있나" 를 묻게 두면 그 사람은 나머지를 못 찾는다. 목록을
              아직 못 읽었으면 문장만 남는다. */}
          {partKit ? (
            <p className={styles.kitBand}>
              <span className={styles.kitBandTag}>이 키트의 일부</span>
              <span className={styles.kitBandText}>{kit}</span>
              <Link className={styles.textLink} href={partKit.href}>
                키트로 돌아가기 <Icon name="arrowRight" size={14} />
              </Link>
            </p>
          ) : kit ? (
            <p className={styles.kitLine}>{kit}</p>
          ) : null}
          {/* 이 상품 자체가 키트일 때. 무엇이 몇 개 들어 있는지는 아래 격자가 보여 주고,
              여기서는 그 격자가 무엇인지 한 줄로 말한다. */}
          {ownKit ? (
            <p className={styles.kitBand}>
              <span className={styles.kitBandTag}>키트</span>
              {/* 키트의 등급은 합친 파일의 등급이 아니라 가장 높은 부품의 등급이다
                  (docs/kits.md 5절). 그 말을 옆에 함께 적지 않으면, 부품이 전부 B 인
                  키트에 S 가 붙은 것처럼 읽힌다. */}
              <span className={styles.gradeBadge} data-grade={ownKit.grade}>{ownKit.grade} 등급</span>
              <span className={styles.kitBandText}>
                부품 {ownKit.parts.length}개를 한 파일에 담았습니다. 등급은 그중 가장 높은 부품의 등급입니다.
                {ownKit.triangles !== null
                  ? ` 부품을 낱개로 모두 받으면 폴리곤 ${ownKit.triangles.toLocaleString("ko-KR")}개${ownKit.byteLength ? `, ${formatBytes(ownKit.byteLength)}` : ""}입니다.`
                  : ""}
              </span>
            </p>
          ) : null}
          {/* "실제 게임에 들어간 파일"은 그 게임을 열어 볼 수 없으면 증거가 아니라 주장이다.
              하베스트 프론티어는 브라우저에서 그대로 돌아가므로, 이 줄이 그 말을 확인할 수
              있는 자리로 데려간다. */}
          {listing.facts?.kit === "harvest-frontier" ? (
            <p className={styles.playLine}>
              이 에셋이 서 있는 게임을 브라우저에서 바로 해 볼 수 있습니다.{" "}
              <a href="https://play.clunk.games" target="_blank" rel="noreferrer">
                하베스트 프론티어 열기 <Icon name="arrowUpRight" size={13} />
              </a>
            </p>
          ) : null}
          {/* The viewer parses the very bytes on sale, so agreeing with the recorded facts is
              the normal case and gets one quiet line. Disagreeing means the file served is not
              the file that was measured, and a buyer is entitled to be told that. */}
          {reconciled ? <p className={styles.kitLine} role="status">{reconciled}</p> : null}
          {/* AI기본법 제31조② 생성물 표시. One sentence, once, where a buyer is already
              reading the facts — not a badge repeated on every card in the grid. */}
          {isAiGenerated(listing) ? (
            <p className={styles.kitLine}>이 {isModel ? "에셋은" : "텍스처는"} 생성형 AI로 만들었습니다.</p>
          ) : null}
        </div>

        <div className={styles.detailBuy}>
          {/* 상세도 카드와 같은 알약을 쓴다. 이 자리의 글자는 브랜드 그라디언트를 글자에
              클립해 그린 것이라 칠이 곧 대비였고, 재 보니 그라디언트 세 정거장 모두
              3.76~4.24:1 로 4.5:1 아래였다. 무엇보다 무료와 구독자 전용이 같은 보라로
              나와, 두 상태를 색으로는 가릴 수 없었다. */}
          {/* 지금 되는 일을 먼저 적는다. 판매가 열리기 전에는 유료 등급도 로그인만 하면
              받는데 "구독자 전용" 이라고만 적혀 있었고, 눌러 보면 그대로 받아졌다 —
              2026-09-04 마스터가 그 모순을 짚었다. 나중에 무엇이 달라지는지는 아래 줄이 말한다. */}
          <div className={styles.priceRow}><strong className={`${styles.accessBadge} ${styles.accessLarge} ${freeTier || beta ? styles.accessFree : styles.accessSub}`}>{freeTier ? "무료" : beta ? "베타 무료" : "구독자 전용"}</strong><small>{listing.sellerName ?? "Clunk"} · {formatBytes(listing.byteLength)} · {listing.entryFileName}</small></div>
          {!freeTier && paymentUnavailable ? (
            <p className={styles.payState} data-payment-state={checkout?.status ?? "UNKNOWN"} role="status">
              지금은 로그인만 하면 이 에셋을 받습니다. 구독이 시작되면 이 에셋은 구독자 전용이 되고, 구독하면 마켓의 모든 에셋과 앞으로 올라오는 것까지 함께 열립니다.
            </p>
          ) : null}
          {!freeTier && !beta ? (
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
            {freeTier ? (
              <a className={`${styles.btn} ${styles.btnPrimary}`} href={downloadHref} download={listing.entryFileName}>무료 파일 받기 <Icon name="download" size={15} /></a>
            ) : owned ? (
              <a className={`${styles.btn} ${styles.btnPrimary}`} href={downloadHref} download={listing.entryFileName}>파일 받기 <Icon name="download" size={15} /></a>
            ) : beta ? (
              // 결제가 아직 열리지 않은 동안에는 구독 전용도 그대로 받는다. 살 수 없는
              // 버튼을 그려 두는 것보다 지금 되는 일 하나를 그리는 편이 정직하다.
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void startCheckout("beta")} disabled={buying}>
                {signedIn === false ? "로그인하고 받기" : buying ? "받는 중…" : "받기"} <Icon name={signedIn === false ? "arrowUpRight" : "download"} size={15} />
              </button>
            ) : (
              // 낱개로 사는 길은 없앴다. 구독 전용 상품의 문은 구독으로만 열린다.
              <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/pricing">
                구독하고 전체 받기 <Icon name="arrowUpRight" size={15} />
              </Link>
            )}
          </div>
          {message ? <p className={styles.message} role="status">{message}</p> : null}

          {/* The files, beside the button that unlocks them rather than a screen below it.
              A download link that answers 401 in JSON is not a link, it is a trap: until the
              visitor holds the entitlement the row says what will open it instead. */}
          <div className={styles.detailFilesHead}>{beta ? "받으면 열리는 파일" : "구독하면 열리는 파일"}</div>
          <div className={styles.files}>{listing.artifacts.filter((artifact) => !PAGE_IMAGE_ROLES.has(artifact.role.trim().toLowerCase())).map((artifact) => <article className={styles.fileRow} key={artifact.fileName}><div><Icon name={artifact.contentType === "image/png" ? "image" : artifact.contentType.includes("gltf") ? "box" : "fileJson"} size={17} /><strong>{artifact.fileName}</strong></div><span>{roleLabel(artifact.role)} · {formatBytes(artifact.byteLength)}</span><code>{artifact.sha256.slice(0, 16)}…</code>{owned || freeTier ? <a href={`/api/marketplace/assets/${encodeURIComponent(listing.assetId)}?file=${encodeURIComponent(artifact.fileName)}`} download={artifact.fileName}>다운로드</a> : <span className={styles.fileLocked}>{beta ? "받기 버튼을 누르면 열립니다" : "구독하면 열립니다"}</span>}</article>)}</div>
        </div>
      </section>

      {/* 키트의 부품 격자. 키트 상품 페이지에서는 "들어 있는 것", 부품 페이지에서는
          "같은 키트의 나머지"다. 어느 쪽이든 눌러서 그 부품의 상세로 간다. */}
      {ownKit ? (
        <KitParts
          title="이 키트에 들어 있는 부품"
          note="부품은 낱개로도 받을 수 있습니다. 같은 팔레트, 같은 축척으로 만들어 한 장면에 그대로 섞입니다."
          parts={ownKit.parts}
        />
      ) : partKit ? (
        <KitParts
          title="같은 키트의 다른 부품"
          note={`${partKit.name}의 부품입니다. 같은 팔레트, 같은 축척으로 만들었습니다.`}
          parts={partKit.parts.filter((part) => part.slug !== listing.slug)}
        />
      ) : null}

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
                  {has || isFreeTier({ ...variant, description: "" }) ? (
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
                      {signedIn === false ? "로그인하고 받기" : buying ? "받는 중…" : "무료로 받기"} <Icon name={signedIn === false ? "arrowUpRight" : "download"} size={14} />
                    </button>
                  ) : (
                    <Link className={`${styles.btn} ${styles.btnGhost} ${styles.variantBtn}`} href="/pricing">
                      구독하고 받기 <Icon name="arrowUpRight" size={14} />
                    </Link>
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
      <strong>지금 받을 수 있는 에셋이 없습니다.</strong>
      <p>검사를 통과한 파일만 이 목록에 올라옵니다. 새 에셋이 올라오면 이 자리에 바로 나타납니다. 그동안 갖고 계신 파일을 Clunk로 검사해 보실 수 있습니다.</p>
      <div className={styles.emptyActions}>
        <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/app">내 파일 검사하기 <Icon name="arrowUpRight" size={13} /></Link>
        <Link className={`${styles.btn} ${styles.btnGhost}`} href="/pricing">요금 보기 <Icon name="credit" size={13} /></Link>
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
        <Link className={`${styles.btn} ${styles.btnGhost}`} href="/pricing">요금 보기 <Icon name="credit" size={13} /></Link>
      </div>
    </section>
  );
}

function CheckoutNotice() {
  return (
    <div className={styles.checkoutNotice} role="status">
      <Icon name="circleAlert" size={17} />
      <strong>지금은 로그인만 하면 됩니다</strong>
      <span>모든 에셋과 기능이 열려 있습니다. 이 자리와 이메일로 먼저 알린 뒤에 바뀝니다.</span>
    </div>
  );
}

/**
 * 찾는 것이 없을 때.
 *
 * 예전 문장은 "검색어 또는 패밀리 필터를 바꾸어 보세요. 이 화면에는 API가 반환한
 * listing만 표시됩니다." 였다. 뒷문장은 우리 사정이고, 앞문장은 무엇을 어떻게 바꾸라는
 * 말이 없다. 여기서 사는 사람이 할 수 있는 행동은 하나뿐이라, 그 하나를 누를 수 있는
 * 버튼으로 놓는다.
 */
function NoResults({ query, onReset }: { query: string; onReset: () => void }) {
  const typed = query.trim();
  return (
    <section className={styles.emptyState} data-catalog-state="no-results" role="status">
      <Icon name="search" size={23} />
      <strong>{typed ? `“${typed}”에 맞는 에셋이 없습니다.` : "고른 조건에 맞는 에셋이 없습니다."}</strong>
      <p>
        낱말을 줄여서 다시 찾아 보시거나(예: “나무 텍스처” 대신 “나무”), 아래 버튼으로 조건을 지우면
        지금 받을 수 있는 에셋이 모두 나옵니다.
      </p>
      <div className={styles.emptyActions}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onReset}>
          조건 지우고 전체 보기 <Icon name="arrowRight" size={13} />
        </button>
      </div>
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
/** 카드 위 등급 칩. 마켓의 단 하나의 규칙(catalog-facts.gradeOf)을 같은 사실(facts)로 돌린다. */
function cardGrade(listing: { title: string; description: string; entryFileName: string; variants?: unknown; clips?: unknown; facts?: unknown }): "S" | "A" | "B" {
  return gradeOf({
    title: listing.title,
    description: listing.description ?? "",
    entryFileName: listing.entryFileName ?? "",
    variants: (listing.variants ?? null) as never,
    clips: (listing.clips ?? null) as never,
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
    items.push({ head: `자국 없이 이어짐 ${packVerdict[1]}종 · 살짝 티남 ${packVerdict[2]}종`, tail: "Clunk 텍스처 검사에서 측정한 결과입니다" });
  } else if (verdict) {
    items.push({
      head: verdict[1] === "SEAMLESS" ? "이어붙여도 자국이 보이지 않습니다" : "이어붙이면 살짝 티가 납니다",
      tail: "Clunk 텍스처 검사에서 측정한 결과입니다",
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
function TileBench({ src, alt, texture }: { src: string; alt: string; texture: ListingFacts["texture"] }) {
  const seamless = texture?.seamless ?? false;
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
        {texture?.seamLeftRight !== undefined && texture.seamTopBottom !== undefined
          ? `이은 자리를 재 봤습니다 — 좌우 ×${texture.seamLeftRight.toFixed(2)}, 상하 ×${texture.seamTopBottom.toFixed(2)}. 타일 안쪽 인접 픽셀차 대비 배율이고 1.0이면 이은 자리를 내부와 구분할 수 없습니다. 위에서 직접 이어 붙여 확인해 보세요.`
          : seamless
            ? "이어 붙인 경계를 재 봤을 때 자국이 남지 않았습니다. 위에서 직접 이어 붙여 확인해 보세요."
            : "이어 붙인 경계에 옅은 자국이 남는 것으로 재졌습니다."}
        {/* Two of the tiles ship as three mixable variants, and their preview is the 2x2
            those variants make — otherwise this bench would repeat one variant and show
            exactly the grid the variants exist to break. */}
        {texture?.colourVariants && texture.colourVariants > 1
          ? ` 여기 보이는 그림은 섞어 깔 수 있는 변형 ${texture.colourVariants}장을 2×2로 배치한 공개용 미리보기이고, 받는 파일은 변형 ${texture.colourVariants}장이 각각 원본 해상도입니다.`
          : " 여기 보이는 그림은 공개용 미리보기이고, 받는 파일은 원본 해상도입니다."}
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
          : `한 칸 ${sheet.cell}×${sheet.cell}, ${sheet.directions}방향${sheet.frames ? ` × ${sheet.frames}프레임` : ""}입니다. 여기 보이는 그림은 공개용 미리보기라 격자 그대로가 아니어서 재생은 받은 뒤에 확인할 수 있습니다.`}
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
        태그가 아니라 파일에서 측정한 색으로 고른 것입니다. 숫자는 색 거리이고, 0에 가까울수록 같은 팔레트입니다.
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
