"use client";

import Image from "next/image";
import Link from "./NativeLink";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type EvidenceStatus = "PASS" | "GAP" | "NOT_EVALUATED" | "NO_GO" | "PENDING" | "UNAVAILABLE";
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
  format: string;
  byteLength: number;
  sellerName?: string | null;
  artifact: { entryFileName: string; previewFileName: string; assetId: string };
  artifacts: Array<{ fileName: string; role: string; contentType: string; byteLength: number; sha256: string }>;
  evidence: { static: EvidenceStatus; visualRuntime: EvidenceStatus; playerFacing: EvidenceStatus; humanDecision: EvidenceStatus };
};

type DetailPayload = { ok?: boolean; error?: string; listing?: Listing };

export function MarketplaceDetail({ slug }: { slug: string }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(`/api/marketplace?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as DetailPayload;
        if (!response.ok || !payload.ok || !payload.listing) throw new Error(payload.error ?? "상품을 찾지 못했습니다.");
        if (active) { setListing(payload.listing); setState("ready"); }
      })
      .catch((error) => {
        if (active) { setMessage(error instanceof Error ? error.message : "상품을 불러오지 못했습니다."); setState("error"); }
      });
    return () => { active = false; };
  }, [slug]);

  async function checkCheckout() {
    if (!listing) return;
    setMessage("구매 연결 상태를 확인하는 중입니다…");
    try {
      const response = await fetch("/api/marketplace/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": createIdempotencyKey(),
        },
        body: JSON.stringify({ listingId: listing.id }),
      });
      const payload = await response.json() as { error?: string; status?: string; checkoutUrl?: string };
      if (payload.checkoutUrl) {
        setMessage("결제 페이지로 이동합니다…");
        window.location.assign(payload.checkoutUrl);
        return;
      }
      setMessage(payload.error ?? payload.status ?? (response.ok ? "구매 요청을 시작했습니다." : "구매를 시작하지 못했습니다."));
    } catch {
      setMessage("구매 연결 상태를 확인하지 못했습니다.");
    }
  }

  if (state === "loading") return <div className="marketplace-detail-state"><span className="spinner" /><strong>상품 근거를 불러오는 중입니다</strong><small>파일 구성과 공개 검수 상태를 확인합니다.</small></div>;
  if (state === "error" || !listing) return <div className="marketplace-detail-state marketplace-detail-state-error"><strong>공개 상품을 열 수 없습니다.</strong><small>{message}</small><Link className="button button-quiet button-sm" href="/marketplace">마켓으로 돌아가기 <Icon name="arrowLeft" size={14} /></Link></div>;

  const previewIsPng = listing.artifact.previewFileName.toLowerCase().endsWith(".png");
  const previewSrc = previewIsPng
    ? `/api/marketplace/assets/${listing.assetId}?file=${encodeURIComponent(listing.artifact.previewFileName)}&preview=1`
    : "/landing/tractor-hero.png";
  const downloadHref = `/api/marketplace/assets/${listing.assetId}?file=${encodeURIComponent(listing.entryFileName)}`;

  return (
    <>
      <div className="marketplace-detail-breadcrumb"><Link href="/marketplace">에셋 마켓</Link><Icon name="chevronRight" size={13} /><span>{listing.title}</span></div>
      <section className="marketplace-detail-hero">
        <div className="marketplace-detail-preview">
          <Image src={previewSrc} alt={`${listing.title} 공개 상품 미리보기`} width={900} height={620} priority />
          <span className="marketplace-detail-stamp">PUBLISHED · GATE COMPLETE</span>
        </div>
        <div className="marketplace-detail-copy">
          <div className="marketplace-card-meta"><span>PUBLISHED</span><span>{listing.format}</span><span>{listing.licenseStatus}</span></div>
          <span className="eyebrow">ASSET PRODUCT · EVIDENCE ATTACHED</span>
          <h1>{listing.title}</h1>
          <p>{listing.description}</p>
          <div className="marketplace-detail-price"><strong>{listing.priceCents === 0 ? "무료" : `${listing.priceCents.toLocaleString()} ${listing.currency}`}</strong><small>{listing.sellerName ?? "Clunk creator"} · {formatBytes(listing.byteLength)} entry</small></div>
          <div className="marketplace-detail-actions"><a className="button button-primary" href={downloadHref} download={listing.entryFileName}>파일 받기 <Icon name="download" size={15} /></a><button type="button" className="button button-quiet" onClick={() => void checkCheckout()}>구매 가능 여부 확인 <Icon name="arrowUpRight" size={15} /></button></div>
          {message ? <p className="marketplace-detail-message" role="status">{message}</p> : null}
        </div>
      </section>

      <section className="marketplace-detail-section" aria-labelledby="detail-evidence-heading">
        <div className="marketplace-detail-heading"><span className="eyebrow">PUBLIC EVIDENCE</span><h2 id="detail-evidence-heading">상품이 공개된 이유를<br /><em>상태별로 확인합니다.</em></h2><p>PUBLISHED는 한 점수의 별명이 아닙니다. 파일·라이선스·런타임·사람의 판단이 각각 기록되어야 합니다.</p></div>
        <div className="marketplace-detail-evidence"><EvidenceCard label="STATIC / BYTE" value={listing.evidence.static} detail="hash · parser · policy" /><EvidenceCard label="VISUAL RUNTIME" value={listing.evidence.visualRuntime} detail="shipped renderer capture" /><EvidenceCard label="PLAYER-FACING" value={listing.evidence.playerFacing} detail="실제 게임 화면" /><EvidenceCard label="HUMAN REVIEW" value={listing.evidence.humanDecision} detail="reviewer decision" /></div>
      </section>

      <section className="marketplace-detail-section marketplace-detail-package" aria-labelledby="detail-package-heading">
        <div className="marketplace-detail-heading"><span className="eyebrow">PACKAGE CONTENTS</span><h2 id="detail-package-heading">다운로드하는 파일과<br /><em>근거의 연결</em></h2></div>
        <div className="marketplace-detail-files">{listing.artifacts.map((artifact) => <article key={artifact.fileName}><div><Icon name={artifact.contentType === "image/png" ? "image" : artifact.contentType.includes("gltf") ? "box" : "fileJson"} size={17} /><strong>{artifact.fileName}</strong></div><span>{artifact.role} · {formatBytes(artifact.byteLength)}</span><code>{artifact.sha256.slice(0, 16)}…</code><a href={`/api/marketplace/assets/${listing.assetId}?file=${encodeURIComponent(artifact.fileName)}`} download={artifact.fileName}>다운로드</a></article>)}</div>
      </section>
      <div className="marketplace-detail-footer-actions"><Link className="button button-quiet" href="/studio">내 에셋도 만들기 <Icon name="arrowUpRight" size={14} /></Link><Link className="text-link" href="/docs/asset-studio">판매 전 체크리스트 보기 <Icon name="arrowRight" size={14} /></Link></div>
    </>
  );
}

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function EvidenceCard({ label, value, detail }: { label: string; value: EvidenceStatus; detail: string }) {
  const tone = value === "PASS" ? "pass" : value === "NO_GO" ? "fail" : "pending";
  return <article className={`marketplace-detail-evidence-card marketplace-detail-evidence-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function formatBytes(value: number): string {
  if (value < 1_000) return `${value} B`;
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)} KB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
}
