"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Link from "./NativeLink";
import { Icon } from "./Icon";
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
  const [checkoutState, setCheckoutState] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CatalogFilter>("all");

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
    return listings.filter((listing) => {
      const searchable = [listing.title, listing.description, listing.entryFileName, listing.format, listing.licenseStatus]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      return matchesQuery && (filter === "all" || listingFamily(listing) === filter);
    });
  }, [filter, listings, query]);

  async function startCheckout(listingId: string) {
    if (checkoutState[listingId]?.includes("확인하는 중")) return;
    setCheckoutState((current) => ({ ...current, [listingId]: "구매 연결을 확인하는 중…" }));
    try {
      const response = await fetch("/api/marketplace/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": createIdempotencyKey(),
        },
        body: JSON.stringify({ listingId }),
      });
      const payload = await response.json() as CheckoutResponse;
      if (payload.checkoutUrl) {
        setCheckoutState((current) => ({ ...current, [listingId]: "결제 페이지로 이동합니다…" }));
        window.location.assign(payload.checkoutUrl);
        return;
      }
      setCheckoutState((current) => ({
        ...current,
        [listingId]: payload.error ?? payload.status ?? (response.ok ? "구매 요청을 시작했습니다." : "구매를 시작하지 못했습니다."),
      }));
    } catch {
      setCheckoutState((current) => ({ ...current, [listingId]: "구매 연결 상태를 확인하지 못했습니다." }));
    }
  }

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
            <span className={styles.count} aria-live="polite">{filteredListings.length}개 공개 LISTING</span>
          </div>
          {filteredListings.length === 0 ? <NoResults /> : null}
          <div className={styles.grid}>
            {filteredListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                checkoutAvailability={catalogCheckout}
                checkoutMessage={checkoutState[listing.id]}
                onCheckout={() => void startCheckout(listing.id)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ListingCard({
  listing,
  checkoutAvailability,
  checkoutMessage,
  onCheckout,
}: {
  listing: Listing;
  checkoutAvailability: CheckoutState | null;
  checkoutMessage?: string;
  onCheckout: () => void;
}) {
  const previewUrl = getPreviewUrl(listing);
  const price = formatPrice(listing.priceCents, listing.currency);
  const detailHref = `/marketplace/${encodeURIComponent(listing.slug)}`;
  const checkoutUnavailable = listing.priceCents > 0 && checkoutAvailability?.status === "PAYMENT_PROVIDER_NOT_CONFIGURED";

  return (
    <article className={styles.card}>
      <Link className={styles.cardArt} href={detailHref} aria-label={`${listing.title} 상세 보기`}>
        {previewUrl ? (
          <Image src={previewUrl} alt={`${listing.title} 실제 미리보기`} width={720} height={540} unoptimized />
        ) : (
          <PreviewUnavailable listing={listing} />
        )}
        <span className={styles.cardBadges} aria-hidden="true">
          <span className={styles.formatBadge}>{formatLabel(listing)}</span>
          <span className={`${styles.priceBadge}${listing.priceCents === 0 ? ` ${styles.priceBadgeFree}` : ""}`}>{price}</span>
        </span>
      </Link>
      <div className={styles.cardBody}>
        <h3>{listing.title}</h3>
        <p>{listing.description}</p>
        <div className={styles.cardMeta}>
          {isAiGenerated(listing) ? <span className={styles.aiChipMini}>✦ AI 생성</span> : null}
          <span>LICENSE · {listing.licenseStatus}</span>
          <span>{listing.entryFileName}{typeof listing.byteLength === "number" ? ` · ${formatBytes(listing.byteLength)}` : ""}</span>
        </div>
        <div className={styles.cardActions}>
          <Link className={`${styles.btn} ${styles.btnGhost}`} href={detailHref}>
            상세 보기 <Icon name="arrowRight" size={13} />
          </Link>
          {listing.priceCents > 0 ? (
            <Link className={`${styles.btn} ${styles.btnPrimary}`} href={detailHref}>
              구매하기
              <Icon name="arrowUpRight" size={13} />
            </Link>
          ) : (
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onCheckout}>
              {checkoutUnavailable ? "결제 상태 확인" : "다운로드 상태"}
              <Icon name="arrowUpRight" size={13} />
            </button>
          )}
        </div>
        {checkoutMessage ? <p className={styles.statusLine} role="status">{checkoutMessage}</p> : null}
      </div>
    </article>
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
  const paymentStatus = paymentUnavailable ? "결제 미설정" : checkout?.status ?? "결제 상태 확인 필요";
  const downloadHref = `/api/marketplace/assets/${encodeURIComponent(listing.assetId)}?file=${encodeURIComponent(listing.entryFileName)}`;
  const creditPrice = listingCreditPrice(listing.priceCents, listing.currency);

  return (
    <>
      <div className={styles.breadcrumb}><Link href="/marketplace">에셋 마켓</Link><Icon name="chevronRight" size={13} /><span>{listing.title}</span></div>
      <section className={styles.detailHero}>
        <div className={styles.preview}>
          {previewUrl ? <Image src={previewUrl} alt={`${listing.title} 실제 공개 미리보기`} width={900} height={620} priority unoptimized /> : <PreviewUnavailable listing={listing} />}
          <span className={styles.stamp}>PUBLISHED · API VERIFIED</span>
        </div>
        <div className={styles.buyPanel}>
          <span className="cv5-eyebrow">ASSET PRODUCT · FILE BACKED</span>
          <div className={styles.metaRow}><span>{listing.status}</span><span>{listing.format}</span><span>LICENSE · {listing.licenseStatus}</span></div>
          <h1>{listing.title}</h1>
          {/* AI기본법 제31조② 생성물 표시 — 1st-party 상품 상시 노출 라벨 */}
          {isAiGenerated(listing) ? (
            <span className={styles.aiChip}><i>✦</i> 생성형 AI 활용 제작 — luna 이미지 엔진 · Three.js 팩토리</span>
          ) : null}
          <p>{listing.description}</p>
          <div className={styles.priceRow}><strong>{formatPrice(listing.priceCents, listing.currency)}</strong><small>{listing.sellerName ?? "Clunk creator"} · {formatBytes(listing.byteLength)} · {listing.entryFileName}</small></div>
          <div className={styles.payState} data-payment-state={checkout?.status ?? "UNKNOWN"} role="status"><span>CHECKOUT STATUS</span><strong>{paymentStatus}</strong><small>결제 제공자 상태를 API 응답 그대로 표시합니다.</small></div>
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

      <section className={styles.detailSection} aria-labelledby="detail-evidence-heading">
        <div className={styles.sectionHead}><span className="cv5-eyebrow">PUBLIC EVIDENCE</span><h2 id="detail-evidence-heading">상품이 공개된 이유를<br /><em>상태별로 확인합니다</em></h2><p>PUBLISHED는 한 점수의 별명이 아닙니다. 파일·라이선스·런타임·사람의 판단이 각각 기록되어야 합니다.</p></div>
        <div className={styles.evidenceGrid}><EvidenceCard label="STATIC / BYTE" value={listing.evidence.static} detail="hash · parser · policy" /><EvidenceCard label="VISUAL RUNTIME" value={listing.evidence.visualRuntime} detail="shipped renderer capture" /><EvidenceCard label="PLAYER-FACING" value={listing.evidence.playerFacing} detail="실제 게임 화면" /><EvidenceCard label="HUMAN REVIEW" value={listing.evidence.humanDecision} detail="reviewer decision" /></div>
      </section>

      <section className={styles.detailSection} aria-labelledby="detail-package-heading">
        <div className={styles.sectionHead}><span className="cv5-eyebrow">PACKAGE CONTENTS</span><h2 id="detail-package-heading">다운로드하는 파일과<br /><em>근거의 연결</em></h2></div>
        <div className={styles.files}>{listing.artifacts.map((artifact) => <article className={styles.fileRow} key={artifact.fileName}><div><Icon name={artifact.contentType === "image/png" ? "image" : artifact.contentType.includes("gltf") ? "box" : "fileJson"} size={17} /><strong>{artifact.fileName}</strong></div><span>{artifact.role} · {formatBytes(artifact.byteLength)}</span><code>{artifact.sha256.slice(0, 16)}…</code><a href={`/api/marketplace/assets/${encodeURIComponent(listing.assetId)}?file=${encodeURIComponent(artifact.fileName)}`} download={artifact.fileName}>다운로드</a></article>)}</div>
      </section>
    </>
  );
}

type EvidenceStatus = "PASS" | "GAP" | "NOT_EVALUATED" | "NO_GO" | "PENDING" | "UNAVAILABLE";

function EvidenceCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  const safeValue: EvidenceStatus = value === "PASS" || value === "GAP" || value === "NOT_EVALUATED" || value === "NO_GO" || value === "PENDING" || value === "UNAVAILABLE" ? value : "NOT_EVALUATED";
  const tone = safeValue === "PASS" ? styles.evidencePass : safeValue === "NO_GO" ? styles.evidenceFail : styles.evidencePending;
  return <article className={`${styles.evidenceCard} ${tone}`}><span>{label}</span><strong>{safeValue}</strong><small>{detail}</small></article>;
}

function CatalogEmpty() {
  return (
    <section className={styles.emptyState} data-empty-state="marketplace" role="status" aria-live="polite">
      <span className={styles.emptyEyebrow}>CATALOGUE · OPERATIONS PREP / REGISTRATION PENDING</span>
      <Icon name="boxes" size={24} />
      <strong>현재 구매 가능한 공개 에셋이 없습니다.</strong>
      <p>마스터가 제작·업로드한 에셋 중 공개 조건을 충족한 listing만 이 카탈로그에 표시됩니다. 등록된 실상품이 연결되면 파일 미리보기, 라이선스, 가격과 구매 상태를 이곳에서 확인할 수 있습니다.</p>
      <div className={styles.emptyActions}>
        <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/app">Clunk 제품 사용하기 <Icon name="arrowUpRight" size={13} /></Link>
        <Link className={`${styles.btn} ${styles.btnGhost}`} href="/pricing">크레딧 확인하기 <Icon name="credit" size={13} /></Link>
      </div>
    </section>
  );
}

function CatalogLoading() {
  return (
    <section className={styles.emptyState} data-catalog-state="loading" role="status" aria-live="polite">
      <span className={styles.emptyEyebrow}>CATALOGUE · LIVE DATA</span>
      <span className="spinner" />
      <strong>공개 listing을 확인하는 중입니다.</strong>
      <p>마스터가 공개한 실제 파일만 불러옵니다.</p>
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
      <strong>PAYMENT_PROVIDER_NOT_CONFIGURED</strong>
      <span>유료 listing이 있어도 운영 환경의 결제 제공자가 연결되기 전에는 구매를 시작할 수 없습니다.</span>
    </div>
  );
}

function NoResults() {
  return (
    <section className={styles.emptyState} data-catalog-state="no-results" role="status">
      <Icon name="search" size={23} />
      <strong>조건에 맞는 공개 listing이 없습니다.</strong>
      <p>검색어 또는 패밀리 필터를 바꾸어 보세요. 이 화면에는 API가 반환한 listing만 표시됩니다.</p>
    </section>
  );
}

function PreviewUnavailable({ listing }: { listing: Listing }) {
  return (
    <div className={styles.previewUnavailable} role="img" aria-label={`${listing.title} 미리보기 없음`}>
      <span>PREVIEW NOT PROVIDED</span>
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

function formatLabel(listing: Listing): string {
  const format = listing.format?.trim();
  if (format) return format.toUpperCase();
  const extension = listing.entryFileName.split(".").pop();
  return extension ? extension.toUpperCase() : "FILE";
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
