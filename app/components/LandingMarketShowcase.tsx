"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "./NativeLink";
import { isVariantSlug } from "../api/_lib/listing-variants";
import { categoryOf, gradeOf, isFreeGrade, type CategoryId } from "./catalog-facts";
import type { ListingFacts } from "./listing-facts-rows";

/**
 * The landing used to carry a hand-written copy of the catalogue: twelve slugs,
 * names and triangle counts typed into page.tsx, every card linking to the market
 * index rather than to the asset it pictured. So clicking 활엽수 landed you on a
 * list of nineteen other things, the names on the landing ("시장 노점") disagreed
 * with the names in the shop ("코지 마켓 스톨"), and both drifted from the prices.
 *
 * It reads the live catalogue now. One source, so a card cannot show a name the
 * shop does not use or point at a page that is not the thing in the picture.
 *
 * 2026-09-04: this is the landing's first viewport again. The capsule machine that stood
 * here for two days was read as gambling by the card processor and is gone; a shelf shows
 * what it has and lets the visitor pick. The card says whether the asset is free-tier or
 * subscription-only, because that is what decides whether the visitor can take it — the
 * per-asset price it used to print is a number nobody charges any more.
 */

type Listing = {
  slug: string;
  title: string;
  description: string;
  currency: string;
  status: string;
  assetId: string;
  entryFileName: string;
  previewFileName?: string | null;
  /** 등급과 카드의 숫자를 정하는 측정값. 목록 응답이 factsFor(slug)로 실어 준다. */
  facts?: ListingFacts | null;
};

export type ShowcaseCategory = "all" | CategoryId;

const CATEGORIES: readonly { id: ShowcaseCategory; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "structure", label: "구조물" },
  { id: "tree", label: "수목" },
  { id: "prop", label: "소품" },
  { id: "texture", label: "텍스처" },
];

/* Categories come from the slug the shop already uses (catalog-facts.categoryOf) — the
   same rule the shop grid and the agent tools apply, not a second hand-kept list. */

/**
 * The measured head clause, or nothing. Never a guess.
 *
 * 2026-09-05: 이 함수는 설명 문장에서만 숫자를 읽었다. 그런데 D1 설명문에서 측정
 * 문장("잰 값으로 폴리곤 2,456개…")이 사라진 뒤로 어느 상품에서도 아무것도 읽지 못했고,
 * 첫 화면의 카드 열두 장이 전부 "GLB" 한 글자만 달고 서 있었다. 숫자는 마켓 카드와
 * 같은 자리 — 목록 응답이 실어 주는 측정값(listing.facts) — 에서 읽는다. 옛 문장 꼴은
 * 그 문장이 남아 있는 상품을 위해 뒤에 그대로 둔다.
 */
function trisOf(listing: Listing): string | null {
  const facts = listing.facts;
  if (typeof facts?.triangles === "number" && facts.triangles > 0) {
    return `폴리곤 ${facts.triangles.toLocaleString("ko-KR")}개`;
  }
  if (facts?.sheet) {
    return facts.sheet.cuts === null
      ? `스프라이트 시트 ${facts.sheet.cell}×${facts.sheet.cell} · ${facts.sheet.directions}방향`
      : `스프라이트 시트 ${facts.sheet.cell}×${facts.sheet.cell} · ${facts.sheet.cuts}컷`;
  }
  if (facts?.texture) return `${facts.texture.resolution} 이어붙는 타일`;
  const solid = listing.description.match(/잰 값으로 폴리곤 ([\d,]+)개/u);
  if (solid) return `폴리곤 ${solid[1]}개`;
  const bundle = listing.description.match(/합쳐 폴리곤 ([\d,]+)개/u);
  if (bundle) return `모두 합쳐 폴리곤 ${bundle[1]}개`;
  const perTemplate = listing.description.match(/한 그루에 폴리곤 ([\d,]+~[\d,]+)개/u);
  if (perTemplate) return `한 그루당 폴리곤 ${perTemplate[1]}개`;
  const sheet = listing.description.match(/(\d+)×(\d+) PNG (\d+)컷/u);
  if (sheet) return `스프라이트 시트 ${sheet[1]}×${sheet[2]} · ${sheet[3]}컷`;
  return null;
}

/**
 * 이 카드를 지금 받을 수 있는가.
 *
 * 낱개로 값을 매겨 파는 길이 없어졌으므로 값을 적을 자리도 없다. 남은 축은 등급 하나다 —
 * 무료 등급은 로그인만 하면 받고, 그 밖은 구독이 살아 있어야 받는다. 결제가 아직 열리지
 * 않은 동안에는 어느 쪽이든 로그인만으로 받으므로 전부 무료라고 적는다.
 */
function accessOf(listing: Listing, beta: boolean): string {
  if (beta) return "무료";
  // 등급에서 바로 계산한다 — 저장해 둔 값은 등급과 어긋날 수 있다(MarketplaceCatalog.isFreeTier와 같은 규칙).
  const free = isFreeGrade(gradeOf({
    title: listing.title,
    description: listing.description ?? "",
    entryFileName: listing.entryFileName ?? "",
    variants: null,
    clips: null,
    facts: (listing.facts ?? null) as never,
  } as never).letter);
  return free ? "무료" : "구독";
}

function previewOf(listing: Listing): string | null {
  const file = listing.previewFileName;
  if (!file) return null;
  return `/api/marketplace/assets/${encodeURIComponent(listing.assetId)}?file=${encodeURIComponent(file)}&preview=1`;
}

export function LandingMarketShowcase({ limit = 12 }: { limit?: number }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [beta, setBeta] = useState(false);
  const [category, setCategory] = useState<ShowcaseCategory>("all");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/marketplace", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { ok?: boolean; listings?: Listing[]; checkout?: { status?: string } };
        if (!response.ok || payload.ok !== true || !Array.isArray(payload.listings)) throw new Error("catalogue unavailable");
        if (!active) return;
        // A sprite sheet baked from a 3D model is a download option on that model's page,
        // not a second card — the same rule the shop grid applies (listing-variants.ts).
        setListings(payload.listings.filter((row) => row.status === "PUBLISHED" && !isVariantSlug(row.slug)));
        setBeta(payload.checkout?.status === "PAYMENT_PROVIDER_NOT_CONFIGURED");
      })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  const counts = useMemo(() => {
    const table = new Map<ShowcaseCategory, number>([["all", listings.length]]);
    for (const listing of listings) {
      const key = categoryOf(listing);
      table.set(key, (table.get(key) ?? 0) + 1);
    }
    return table;
  }, [listings]);

  const shown = useMemo(() => {
    const matched = category === "all" ? listings : listings.filter((row) => categoryOf(row) === category);
    return matched.slice(0, limit);
  }, [category, limit, listings]);

  if (failed) {
    return (
      <p className="cv5-showcase-fallback" role="status">
        지금은 목록을 불러오지 못했습니다. <Link href="/marketplace" prefetch={false}>마켓에서 직접 확인하기</Link>
      </p>
    );
  }

  return (
    <div className="cv5-showcase-live">
      {/* Real controls, not a picture of controls: each one filters the grid
          below and each count is the number of listings actually in it. */}
      <div className="cv5-showcase-tabs" role="tablist" aria-label="에셋 분류">
        {CATEGORIES.map((option) => {
          const count = counts.get(option.id) ?? 0;
          if (option.id !== "all" && count === 0) return null;
          return (
            <button
              type="button"
              role="tab"
              key={option.id}
              aria-selected={category === option.id}
              className={`cv5-showcase-tab${category === option.id ? " is-on" : ""}`}
              onClick={() => setCategory(option.id)}
            >
              {option.label}
              {listings.length ? <i>{count}</i> : null}
            </button>
          );
        })}
      </div>

      <ul className="cv5-showcase-grid" aria-label="마켓 에셋 미리보기">
        {shown.map((listing) => {
          const preview = previewOf(listing);
          const tris = trisOf(listing);
          return (
            <li className="cv5-showcase-card" key={listing.slug}>
              <Link href={`/marketplace/${encodeURIComponent(listing.slug)}`} prefetch={false}>
                {preview ? (
                  <img src={preview} alt={`${listing.title} 미리보기`} width={560} height={560} loading="lazy" />
                ) : (
                  <span className="cv5-showcase-noart" aria-hidden="true" />
                )}
                <span className="cv5-showcase-meta">
                  <b>{listing.title}</b>
                  <span>{tris ?? listing.entryFileName.split(".").pop()?.toUpperCase()}</span>
                  <i>{accessOf(listing, beta)}</i>
                </span>
              </Link>
            </li>
          );
        })}
        {listings.length === 0
          ? Array.from({ length: limit }, (_, index) => (
              <li className="cv5-showcase-card is-loading" key={`skeleton-${index}`} aria-hidden="true" />
            ))
          : null}
      </ul>
    </div>
  );
}
