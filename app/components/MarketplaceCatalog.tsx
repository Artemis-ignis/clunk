"use client";

import Image from "next/image";
import Link from "./NativeLink";
import { Icon } from "./Icon";
import { useEffect, useState } from "react";

type Listing = {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  licenseStatus: string;
  assetId: string;
  entryFileName: string;
  previewFileName?: string | null;
  sellerName?: string | null;
};

export function MarketplaceCatalog() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [checkoutState, setCheckoutState] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    void fetch("/api/marketplace")
      .then(async (response) => {
        const payload = await response.json() as { listings?: Listing[] };
        if (!response.ok) throw new Error("catalog unavailable");
        if (active) { setListings(payload.listings ?? []); setState("ready"); }
      })
      .catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, []);

  async function startCheckout(listingId: string) {
    setCheckoutState((current) => ({ ...current, [listingId]: "결제 연결을 확인하는 중…" }));
    try {
      const response = await fetch("/api/marketplace/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      const payload = await response.json() as { error?: string; status?: string };
      setCheckoutState((current) => ({ ...current, [listingId]: payload.error ?? payload.status ?? (response.ok ? "구매 요청을 시작했습니다." : "결제를 시작하지 못했습니다.") }));
    } catch {
      setCheckoutState((current) => ({ ...current, [listingId]: "결제 상태를 확인하지 못했습니다." }));
    }
  }

  return (
    <div className="marketplace-catalog" data-testid="marketplace-catalog">
      <article className="marketplace-sample-card">
        <div className="marketplace-card-art"><Image src="/landing/tractor-hero.png" alt="Clunk Core 3D 샘플" width={640} height={420} /></div>
        <div className="marketplace-card-body"><div className="marketplace-card-meta"><span>CONTRACT_FIXTURE</span><span>GLB</span></div><h3>Clunk Core tractor</h3><p>실제 GLB 바이트로 검사 흐름을 보여 주는 공개 샘플입니다. 판매 상품이 아니며 결과를 제품 승인으로 해석하지 않습니다.</p><div className="marketplace-card-status"><strong>STATIC PASS</strong><span>RUNTIME GAP · HUMAN NOT_EVALUATED</span></div><Link className="text-link" href="/connect#sample">샘플 흐름 보기 <Icon name="arrowRight" size={13} /></Link></div>
      </article>
      <article className="marketplace-sample-card marketplace-sample-card-2d">
        <div className="marketplace-card-art marketplace-card-art-2d"><Image src="/samples/product-sprite/clunk-sprite-sample.png" alt="Clunk 절차적 2D sprite 샘플" width={640} height={420} /></div>
        <div className="marketplace-card-body"><div className="marketplace-card-meta"><span>PROCEDURAL_AUTHORED</span><span>SPRITE / ATLAS</span></div><h3>Clunk sprite starter</h3><p>실제 RGBA PNG와 Atlas 파일로 시작하는 authoring 샘플입니다. prompt provenance와 검수 경계를 함께 확인합니다.</p><div className="marketplace-card-status"><strong>STATIC CONTRACT</strong><span>RUNTIME UNAVAILABLE · NOT FOR SALE</span></div><Link className="text-link" href="/studio">이 타입 직접 만들기 <Icon name="arrowRight" size={13} /></Link></div>
      </article>
      {state === "loading" ? <div className="marketplace-empty"><span className="spinner" /><strong>공개 판매 상품을 불러오는 중</strong><small>검수된 listing만 노출합니다.</small></div> : null}
      {state === "error" ? <div className="marketplace-empty marketplace-empty-error"><strong>카탈로그를 불러오지 못했습니다.</strong><small>공개 샘플은 위에서 계속 확인할 수 있습니다.</small></div> : null}
      {state === "ready" && listings.length === 0 ? <div className="marketplace-empty"><Icon name="boxes" size={23} /><strong>아직 공개 판매 상품이 없습니다.</strong><small>Studio에서 만든 결과는 먼저 Draft로 저장되고, 모든 검수 gate를 통과한 뒤 이곳에 나타납니다.</small><Link className="button button-quiet button-sm" href="/studio">첫 상품 만들기 <Icon name="arrowRight" size={13} /></Link></div> : null}
      {listings.map((listing) => <article className="marketplace-listing-card" key={listing.id}><div className="marketplace-listing-art"><Image src={listing.previewFileName?.toLowerCase().endsWith(".png") ? `/api/marketplace/assets/${listing.assetId}?file=${encodeURIComponent(listing.previewFileName)}` : "/landing/tractor-hero.png"} alt={`${listing.title} 미리보기`} width={480} height={320} /></div><div className="marketplace-listing-body"><div className="marketplace-card-meta"><span>PUBLISHED</span><span>{listing.entryFileName}</span></div><h3>{listing.title}</h3><p>{listing.description}</p><div className="marketplace-listing-footer"><strong>{listing.priceCents === 0 ? "무료" : `${listing.priceCents.toLocaleString()} ${listing.currency}`}</strong><span>{listing.sellerName ?? "Clunk creator"} · {listing.licenseStatus}</span></div><div className="marketplace-listing-actions"><Link className="button button-quiet button-sm" href={`/marketplace/${encodeURIComponent(listing.slug)}`}>상품 상세 <Icon name="arrowRight" size={13} /></Link><button type="button" className="button button-quiet button-sm" onClick={() => void startCheckout(listing.id)}>{checkoutState[listing.id] ? "상태 확인됨" : "구매 가능 여부 확인"}</button></div>{checkoutState[listing.id] ? <p className="marketplace-checkout-status" role="status">{checkoutState[listing.id]}</p> : null}</div></article>)}
    </div>
  );
}
