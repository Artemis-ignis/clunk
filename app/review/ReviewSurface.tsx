"use client";

import { useEffect, useState } from "react";
import { GlbReviewer } from "../components/review/GlbReviewer";
import { SpriteReviewer } from "../components/review/SpriteReviewer";

type CatalogListing = { slug: string; title: string; entryFileName: string; previewFileName?: string | null };

/** Tabbed review surface: 3D GLB viewer + 2D sprite player + live inventory rail. */
export function ReviewSurface({ initialGlb }: { initialGlb: string | null }) {
  const [tab, setTab] = useState<"3d" | "2d">(initialGlb ? "3d" : "3d");
  const [inventory, setInventory] = useState<CatalogListing[]>([]);

  useEffect(() => {
    let active = true;
    void fetch("/api/marketplace", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { ok?: boolean; listings?: Array<CatalogListing & { status?: string }> };
        if (!active || payload.ok !== true || !Array.isArray(payload.listings)) return;
        setInventory(payload.listings.filter((listing) => /\.(glb|gltf)$/i.test(listing.entryFileName)).slice(0, 24));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  function loadInventoryGlb(listing: CatalogListing) {
    setTab("3d");
    // Bundled QA inventory is served from the Worker's own static assets.
    const url = `/market/${listing.slug}/${listing.entryFileName}`;
    window.dispatchEvent(new CustomEvent("clunk:review-load-glb", { detail: url }));
  }

  return (
    <div className="rv-surface">
      <div className="rv-tabs" role="tablist" aria-label="검수 대상 종류">
        <button type="button" role="tab" aria-selected={tab === "3d"} className={tab === "3d" ? "on" : ""} onClick={() => setTab("3d")}>3D · GLB</button>
        <button type="button" role="tab" aria-selected={tab === "2d"} className={tab === "2d" ? "on" : ""} onClick={() => setTab("2d")}>2D · Sprite</button>
      </div>

      <div hidden={tab !== "3d"}>
        <GlbReviewer initialUrl={initialGlb} />
        {inventory.length > 0 ? (
          <div className="rv-inventory" aria-label="게시된 실물 인벤토리 — 클릭하면 뷰어에 로드">
            <header className="rv-panel-head">PUBLISHED INVENTORY · 클릭해서 검수</header>
            <div className="rv-inventory-row">
              {inventory.map((listing) => (
                <button type="button" key={listing.slug} onClick={() => loadInventoryGlb(listing)}>
                  {listing.previewFileName ? (
                    <img src={`/market/${listing.slug}/${listing.previewFileName}`} alt="" width={72} height={72} loading="lazy" />
                  ) : null}
                  <span>{listing.title}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div hidden={tab !== "2d"}>
        <SpriteReviewer />
      </div>
    </div>
  );
}
