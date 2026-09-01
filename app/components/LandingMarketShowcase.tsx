"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "./NativeLink";

/**
 * The landing used to carry a hand-written copy of the catalogue: twelve slugs,
 * names and triangle counts typed into page.tsx, every card linking to the market
 * index rather than to the asset it pictured. So clicking 활엽수 landed you on a
 * list of nineteen other things, the names on the landing ("시장 노점") disagreed
 * with the names in the shop ("코지 마켓 스톨"), and both drifted from the prices.
 *
 * It reads the live catalogue now. One source, so a card cannot show a name the
 * shop does not use or point at a page that is not the thing in the picture.
 */

type Listing = {
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  status: string;
  assetId: string;
  entryFileName: string;
  previewFileName?: string | null;
};

export type ShowcaseCategory = "all" | "structure" | "tree" | "prop" | "texture";

const CATEGORIES: readonly { id: ShowcaseCategory; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "structure", label: "구조물" },
  { id: "tree", label: "수목" },
  { id: "prop", label: "소품" },
  { id: "texture", label: "텍스처" },
];

/** Categories come from the slug the shop already uses, not a second hand list. */
function categoryOf(listing: Listing): Exclude<ShowcaseCategory, "all"> {
  const s = listing.slug;
  if (s.startsWith("tex-") || s.includes("seamless-textures")) return "texture";
  if (s.includes("tree") || s.includes("grove")) return "tree";
  if (s.includes("stall") || s.includes("shed") || s.includes("greenhouse") || s.includes("gate") || s.includes("farm-set")) {
    return "structure";
  }
  return "prop";
}

/** The measured head clause the pipeline wrote, or nothing. Never a guess. */
function trisOf(listing: Listing): string | null {
  const solid = listing.description.match(/실측 ([\d,]+) tris/u);
  if (solid) return `${solid[1]} 삼각형`;
  const bundle = listing.description.match(/합계 ([\d,]+) tris/u);
  if (bundle) return `합계 ${bundle[1]} 삼각형`;
  const perTemplate = listing.description.match(/템플릿당 ([\d,]+~[\d,]+) tris/u);
  if (perTemplate) return `템플릿당 ${perTemplate[1]} 삼각형`;
  if (listing.description.includes("심리스")) return "1024² 심리스 타일";
  return null;
}

function priceOf(listing: Listing): string {
  if (listing.priceCents === 0) return "무료";
  try {
    return new Intl.NumberFormat("ko-KR", { style: "currency", currency: /^[A-Z]{3}$/u.test(listing.currency) ? listing.currency : "KRW" })
      .format(listing.priceCents / 100);
  } catch {
    return `${(listing.priceCents / 100).toLocaleString("ko-KR")}원`;
  }
}

function previewOf(listing: Listing): string | null {
  const file = listing.previewFileName;
  if (!file) return null;
  return `/api/marketplace/assets/${encodeURIComponent(listing.assetId)}?file=${encodeURIComponent(file)}&preview=1`;
}

export function LandingMarketShowcase({ limit = 12 }: { limit?: number }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [category, setCategory] = useState<ShowcaseCategory>("all");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/marketplace", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { ok?: boolean; listings?: Listing[] };
        if (!response.ok || payload.ok !== true || !Array.isArray(payload.listings)) throw new Error("catalogue unavailable");
        if (active) setListings(payload.listings.filter((row) => row.status === "PUBLISHED"));
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
                  <i>{priceOf(listing)}</i>
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
