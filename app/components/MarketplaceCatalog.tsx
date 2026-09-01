"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Link from "./NativeLink";
import { Icon } from "./Icon";
import { EmbeddedGlbViewer, type MeasuredSpec } from "./review/EmbeddedGlbViewer";
import styles from "../marketplace/marketplace.module.css";

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
};

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

/** 생성형 AI 표시 대상 여부 — 1st-party 상품은 항상 표시(보수적 기본값). */
function isAiGenerated(listing: Pick<Listing, "aiGenerated">): boolean {
  return listing.aiGenerated !== false;
}

type DetailListing = Listing & {
  format: string;
  byteLength: number;
  sellerName?: string | null;
  artifact: { entryFileName: string; previewFileName: string; assetId: string };
  artifacts: Array<{ fileName: string; role: string; contentType: string; byteLength: number; sha256: string }>;
  evidence: { static: string; visualRuntime: string; playerFacing: string; humanDecision: string };
};
type DetailPayload = { ok?: boolean; error?: string; listing?: DetailListing; checkout?: CheckoutState };

/** The sort ids the select offers; anything else in the URL falls back to newest. */
const CATALOG_SORTS = new Set<string>(["newest", "name", "price-asc", "price-desc", "size-asc"]);

const CATALOG_FILTERS: readonly { id: CatalogFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "2d", label: "2D / Sprite" },
  { id: "3d", label: "3D / GLB" },
  { id: "motion", label: "Motion" },
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
    const search = params.toString();
    window.history.replaceState(
      null,
      "",
      search ? `?${search}${window.location.hash}` : `${window.location.pathname}${window.location.hash}`,
    );
  }, [filter, sort, query]);

  useEffect(() => {
    let active = true;
    void fetch("/api/marketplace", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as CatalogPayload;
        if (!response.ok || payload.ok !== true || !Array.isArray(payload.listings)) {
          throw new Error("catalog unavailable");
        }
        if (active) {
          const publishedListings = payload.listings.filter((listing) => listing.status === "PUBLISHED");
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
    // The API already returns newest-first, so "newest" keeps server order.
    if (sort === "newest") return matched;
    return [...matched].sort((a, b) => {
      if (sort === "name") return a.title.localeCompare(b.title, "ko-KR");
      if (sort === "price-asc") return a.priceCents - b.priceCents;
      if (sort === "price-desc") return b.priceCents - a.priceCents;
      return (a.byteLength ?? 0) - (b.byteLength ?? 0);
    });
  }, [filter, listings, query, sort]);

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
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * The one fact a buyer scans a grid for. Every published description opens with
 * the measured head clause the pipeline wrote, so the card re-shows that clause
 * instead of the whole paragraph — and shows nothing at all when the sentence
 * does not match, rather than guessing a number.
 */
function cardSpec(listing: Listing): string | null {
  const d = listing.description;
  const solid = d.match(/실측 ([\d,]+) tris · 드로우콜 (\d+)/);
  if (solid) return `${solid[1]} 삼각형 · 드로우콜 ${solid[2]}`;
  const bundle = d.match(/합계 ([\d,]+) tris · 드로우콜 (\d+)/);
  if (bundle) return `합계 ${bundle[1]} 삼각형 · 드로우콜 ${bundle[2]}`;
  const perTemplate = d.match(/템플릿당 ([\d,]+~[\d,]+) tris/);
  if (perTemplate) return `템플릿당 ${perTemplate[1]} 삼각형`;
  const sheet = d.match(/(\d+)×(\d+) RGBA PNG (\d+)컷/u);
  if (sheet) return `${sheet[1]}×${sheet[2]} · ${sheet[3]}컷`;
  const tileSet = d.match(/심리스 판정은 SEAMLESS (\d+)종 · SOFT-SEAM (\d+)종/);
  if (tileSet) return `1024² · 심리스 ${tileSet[1]}종 · 소프트심 ${tileSet[2]}종`;
  const tile = d.match(/(\d+)x(\d+) 심리스 타일[\s\S]*?판정은 (SEAMLESS|SOFT-SEAM)/);
  if (tile) return `${tile[1]}×${tile[2]} · ${tile[3] === "SEAMLESS" ? "심리스" : "소프트심"}`;
  return null;
}

function ListingCard({ listing }: { listing: Listing }) {
  const previewUrl = getPreviewUrl(listing);
  const price = formatPrice(listing.priceCents, listing.currency);
  const spec = cardSpec(listing);

  // One card, one link. A grid is for choosing what to open, so the card carries
  // the picture, the name, the number that decides fit, and the price — the buy
  // decision belongs on the page the card opens.
  return (
    <Link className={styles.card} href={`/marketplace/${encodeURIComponent(listing.slug)}`}>
      <span className={styles.cardArt}>
        {previewUrl ? (
          <Image src={previewUrl} alt={`${listing.title} 미리보기`} width={720} height={540} unoptimized />
        ) : (
          <PreviewUnavailable listing={listing} />
        )}
        <span className={styles.cardBadges} aria-hidden="true">
          <span className={styles.formatBadge}>{formatLabel(listing)}</span>
          <span className={`${styles.priceBadge}${listing.priceCents === 0 ? ` ${styles.priceBadgeFree}` : ""}`}>{price}</span>
        </span>
      </span>
      <span className={styles.cardBody}>
        <span className={styles.cardTitle}>{listing.title}</span>
        <span className={styles.cardSpec}>
          {spec ?? formatLabel(listing)}
          {/* AI기본법 제31조② 표시 의무 — 생성형 AI 산출물임을 상품 카드에서 바로 알린다. */}
          {isAiGenerated(listing) ? <span className={styles.aiChipMini}>✦ AI 생성</span> : null}
        </span>
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
  const [owned, setOwned] = useState(false);
  const [buying, setBuying] = useState(false);
  const [measured, setMeasured] = useState<MeasuredSpec | null>(null);
  const [snippetTab, setSnippetTab] = useState<"three" | "r3f" | "clunk">("three");
  const [copied, setCopied] = useState(false);

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

  async function startCheckout(paymentMethod: "credits" | "card") {
    if (!listing || buying) return;
    if (listing.priceCents > 0 && !withdrawalConsent) {
      setMessage("결제를 시작하려면 청약철회 제한 동의가 필요합니다.");
      return;
    }
    setBuying(true);
    setMessage(paymentMethod === "credits" ? "크레딧 결제를 처리하는 중입니다…" : "구매 연결 상태를 확인하는 중입니다…");
    try {
      const response = await fetch("/api/marketplace/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": createIdempotencyKey(),
        },
        body: JSON.stringify({
          listingId: listing.id,
          withdrawalConsent,
          ...(paymentMethod === "credits" ? { paymentMethod: "credits" } : {}),
        }),
      });
      const payload = await response.json() as CheckoutResponse;
      if (response.status === 401) {
        setMessage("로그인이 필요합니다. 로그인 후 다시 시도해 주세요.");
        window.location.assign(`/login?return_to=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (payload.status === "PAID_WITH_CREDITS" || payload.status === "ALREADY_OWNED" || payload.status === "ALREADY_PAID") {
        setOwned(true);
        setMessage(
          payload.status === "PAID_WITH_CREDITS"
            ? `구매 완료 — ${payload.creditsCharged?.toLocaleString("ko-KR") ?? "?"} 크레딧 차감, 잔액 ${payload.balance?.toLocaleString("ko-KR") ?? "?"} 크레딧. 아래에서 파일을 받으세요.`
            : "이미 보유한 상품입니다. 아래에서 파일을 받으세요.",
        );
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

  if (state === "loading") {
    return <div className={styles.detailState} role="status"><span className="spinner" /><strong>상품 근거를 불러오는 중입니다</strong><small>실제 파일 구성과 공개 상태를 확인합니다.</small></div>;
  }
  if (state === "error" || !listing) {
    return <div className={styles.detailState} role="alert"><strong>공개 상품을 열 수 없습니다.</strong><small>{message}</small><Link className={`${styles.btn} ${styles.btnGhost}`} href="/marketplace">마켓으로 돌아가기 <Icon name="arrowLeft" size={14} /></Link></div>;
  }

  const previewUrl = getPreviewUrl({ assetId: listing.artifact.assetId, previewFileName: listing.artifact.previewFileName });
  const paymentUnavailable = listing.priceCents > 0 && checkout?.status === "PAYMENT_PROVIDER_NOT_CONFIGURED";
  const downloadHref = `/api/marketplace/assets/${encodeURIComponent(listing.assetId)}?file=${encodeURIComponent(listing.entryFileName)}`;
  const creditPrice = listingCreditPrice(listing.priceCents, listing.currency);

  return (
    <>
      <div className={styles.breadcrumb}><Link href="/marketplace">에셋 마켓</Link><Icon name="chevronRight" size={13} /><span>{listing.title}</span></div>
      <section className={styles.detailHero}>
        <div className={styles.preview}>
          {/* polyfork-style live product view: the shipped GLB itself, orbitable,
              with its animation playing — not a screenshot of it. */}
          {/\.(glb|gltf)$/i.test(listing.entryFileName) ? (
            <EmbeddedGlbViewer
              src={`/market/${listing.slug}/${listing.entryFileName}`}
              poster={previewUrl}
              alt={`${listing.title} 실제 판매 파일`}
              onMeasured={setMeasured}
            />
          ) : previewUrl ? (
            <Image src={previewUrl} alt={`${listing.title} 실제 공개 미리보기`} width={900} height={620} priority unoptimized />
          ) : (
            <PreviewUnavailable listing={listing} />
          )}
        </div>
        <div className={styles.buyPanel}>
          <div className={styles.metaRow}><span>{formatLabel(listing)}</span><span>{formatBytes(listing.byteLength)}</span><span>{licenseLabel(listing.licenseStatus)}</span></div>
          <h1>{listing.title}</h1>
          {/* AI기본법 제31조② 생성물 표시 — 1st-party 상품 상시 노출 라벨.
              This states the provenance of THIS file, not a feature the buyer
              gets: the store's inventory was authored with the operator's local
              Codex luna runner and the Clunk Three.js factory. Naming
              "luna 이미지 엔진" here read like a service the site runs for a
              visitor, and the site cannot run it. */}
          {isAiGenerated(listing) ? (
            <span className={styles.aiChip}><i>✦</i> 생성형 AI로 제작한 에셋입니다 · 제작 기록 보관</span>
          ) : null}
          <p>{shopDescription(listing, measured !== null)}</p>
          {/* Spec measured in this browser from the exact file on sale — the
              viewer parses it, nothing is restated from metadata. */}
          {measured ? (
            <ul className={styles.specList} aria-label="이 파일에서 방금 측정한 사양">
              <li><b>{measured.triangles.toLocaleString("ko-KR")} 삼각형</b> · 메시 {measured.meshes} · 머티리얼 {measured.materials}</li>
              <li><b>{measured.bounds.x.toFixed(2)} × {measured.bounds.y.toFixed(2)} × {measured.bounds.z.toFixed(2)} m</b> · 실제 스케일</li>
              {/* Only worth a line when it is not zero. A model that rests on the ground
                  needs no instruction; one that sinks needs the exact number. */}
              {Math.abs(measured.groundOffset) > 0.005 ? (
                <li>
                  <b>{measured.groundOffset > 0 ? "+" : ""}{measured.groundOffset.toFixed(2)} m</b>
                  {" · 지면 기준 원점 오프셋 — 바닥에 놓으려면 Y를 "}
                  <b>{(-measured.groundOffset).toFixed(2)} m</b>
                  {" 만큼 올리세요"}
                </li>
              ) : (
                <li><b>지면에 그대로</b> · 원점이 바닥이라 Y 보정 없이 놓으면 됩니다</li>
              )}
              <li><b>{formatLabel(listing)}</b> {formatBytes(measured.bytes)} · 이 페이지에서 파일을 직접 열어 잰 값입니다</li>
              <li><b>{licenseLabel(listing.licenseStatus)}</b> · 게임·앱·의뢰 작업에 쓸 수 있고, 원본 재판매만 제외됩니다</li>
            </ul>
          ) : null}
          {/* The file's own colours, area-weighted, so a buyer can tell before paying
              whether this asset sits in their game's palette — and can take the hex
              straight into their own material rather than eyedropping a screenshot. */}
          {measured?.palette.length ? <PaletteStrip palette={measured.palette} /> : null}
          <div className={styles.priceRow}><strong>{formatPrice(listing.priceCents, listing.currency)}</strong><small>{listing.sellerName ?? "Clunk creator"} · {formatBytes(listing.byteLength)} · {listing.entryFileName}</small></div>
          {listing.priceCents > 0 && paymentUnavailable ? (
            <p className={styles.payState} data-payment-state={checkout?.status ?? "UNKNOWN"} role="status">
              통신판매업 신고 절차가 끝나면 결제를 엽니다. 그때까지 이 상품은 담아두고 볼 수만 있습니다.
            </p>
          ) : null}
          {listing.priceCents > 0 ? (
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
              <a className={`${styles.btn} ${styles.btnPrimary}`} href={downloadHref} download={listing.entryFileName}>구매한 파일 받기 <Icon name="download" size={15} /></a>
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
            {/^\/market\//.test(`/market/${listing.slug}/`) && /\.(glb|gltf)$/i.test(listing.entryFileName) ? (
              <Link
                className={`${styles.btn} ${styles.btnGhost}`}
                href={`/review?glb=${encodeURIComponent(`/market/${listing.slug}/${listing.entryFileName}`)}`}
                prefetch={false}
              >
                3D 뷰어에서 검수 <Icon name="box" size={15} />
              </Link>
            ) : null}
          </div>
          {message ? <p className={styles.message} role="status">{message}</p> : null}
        </div>
      </section>

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
        <div className={styles.evidenceGrid}><EvidenceCard label="파일 규격" value={listing.evidence.static} detail="삼각형·드로우콜·구조를 파일에서 직접 읽었습니다" /><EvidenceCard label="렌더러 확인" value={listing.evidence.visualRuntime} detail="실제 three.js 렌더러에 띄워 확인했습니다" /><EvidenceCard label="판매자 검토" value={listing.evidence.humanDecision} detail="아르테미스 스토어가 직접 만들고 검토했습니다" /></div>
      </section>

      <section className={styles.detailSection} aria-labelledby="detail-package-heading">
        <div className={styles.sectionHead}><span className="cv5-eyebrow">받는 파일</span><h2 id="detail-package-heading">결제하면<br /><em>이 파일들을 받습니다</em></h2></div>
        <div className={styles.files}>{listing.artifacts.map((artifact) => <article className={styles.fileRow} key={artifact.fileName}><div><Icon name={artifact.contentType === "image/png" ? "image" : artifact.contentType.includes("gltf") ? "box" : "fileJson"} size={17} /><strong>{artifact.fileName}</strong></div><span>{artifact.role} · {formatBytes(artifact.byteLength)}</span><code>{artifact.sha256.slice(0, 16)}…</code><a href={`/api/marketplace/assets/${encodeURIComponent(listing.assetId)}?file=${encodeURIComponent(artifact.fileName)}`} download={artifact.fileName}>다운로드</a></article>)}</div>
      </section>
    </>
  );
}

type EvidenceStatus = "PASS" | "GAP" | "NOT_EVALUATED" | "NO_GO" | "PENDING" | "UNAVAILABLE";

function EvidenceCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  const safeValue: EvidenceStatus = value === "PASS" || value === "GAP" || value === "NOT_EVALUATED" || value === "NO_GO" || value === "PENDING" || value === "UNAVAILABLE" ? value : "NOT_EVALUATED";
  const tone = safeValue === "PASS" ? styles.evidencePass : safeValue === "NO_GO" ? styles.evidenceFail : styles.evidencePending;
  // The lane names are ours; the buyer gets the verdict in their own words.
  const verdict = safeValue === "PASS" ? "확인함" : safeValue === "NO_GO" ? "판매 보류" : "확인 전";
  return <article className={`${styles.evidenceCard} ${tone}`}><span>{label}</span><strong>{verdict}</strong><small>{detail}</small></article>;
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
      <strong>유료 에셋은 아직 결제할 수 없습니다</strong>
      <span>통신판매업 신고 절차가 끝나면 판매를 시작합니다. 그때까지 무료 에셋은 그대로 받을 수 있습니다.</span>
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
    <div className={styles.previewUnavailable} role="img" aria-label={`${listing.title} 미리보기 없음`}>
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
  if (value.includes("motion") || value.includes("animation")) return "motion";
  if (value.includes("png") || value.includes("sprite") || value.includes("atlas") || value.includes("spine") || value.includes("2d")) return "2d";
  return "3d";
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
