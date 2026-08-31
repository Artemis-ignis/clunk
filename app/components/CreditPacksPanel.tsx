"use client";

import { useEffect, useState } from "react";
import Link from "./NativeLink";
import styles from "../pricing/pricing.module.css";

/**
 * Credit-pack purchase panel. Everything rendered here is the live API state:
 * DRAFT packs show an explicit "price undecided" state instead of a number,
 * ACTIVE packs render their real price and a consent-gated checkout button.
 * No pack, no price, no availability is ever invented client-side.
 * cv5 restyle 2026-08-31: the Studio pack carries the gradient highlight —
 * a composition recommendation only, never an invented price.
 */

type Pack = {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  currency: string;
  status: string;
  purchasable: boolean;
};

type PacksResponse = { ok?: boolean; packs?: Pack[] };
type CheckoutResponse = { ok?: boolean; status?: string; checkoutUrl?: string; error?: string };

/** The pack the pricing surface visually recommends (composition only). */
const FEATURED_PACK_ID = "pack-studio";

function formatPackPrice(pack: Pack): string {
  const amount = pack.priceCents / 100;
  try {
    return new Intl.NumberFormat("ko-KR", { style: "currency", currency: pack.currency }).format(amount);
  } catch {
    return `${amount.toLocaleString("ko-KR")} ${pack.currency}`;
  }
}

function createIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function CreditPacksPanel() {
  const [packs, setPacks] = useState<Pack[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/credits/packs", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as PacksResponse;
        if (!response.ok || payload.ok !== true || !Array.isArray(payload.packs)) throw new Error("packs unavailable");
        if (active) {
          setPacks(payload.packs);
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

  async function buy(pack: Pack) {
    if (!consent) {
      setMessage("결제를 시작하려면 청약철회 제한 동의가 필요합니다.");
      return;
    }
    setMessage(`${pack.name} 결제 연결을 확인하는 중…`);
    try {
      const response = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": createIdempotencyKey() },
        body: JSON.stringify({ packId: pack.id, withdrawalConsent: consent }),
      });
      const payload = await response.json() as CheckoutResponse;
      if (payload.checkoutUrl) {
        setMessage("결제 페이지로 이동합니다…");
        window.location.assign(payload.checkoutUrl);
        return;
      }
      if (response.status === 401) {
        setMessage("로그인 후 구매할 수 있습니다.");
        return;
      }
      setMessage(payload.error ?? payload.status ?? "결제를 시작하지 못했습니다.");
    } catch {
      setMessage("결제 연결 상태를 확인하지 못했습니다.");
    }
  }

  if (state === "loading") {
    return <p className={styles.packsState} role="status">크레딧 팩 상태를 불러오는 중입니다…</p>;
  }
  if (state === "error" || !packs) {
    return <p className={styles.packsState} role="alert">크레딧 팩 상태를 불러오지 못했습니다. API 응답이 없으면 아무 가격도 표시하지 않습니다.</p>;
  }

  const anyPurchasable = packs.some((pack) => pack.purchasable);

  return (
    <div className={styles.packs} data-testid="credit-packs-panel">
      <div className={styles.packsGrid}>
        {packs.map((pack) => {
          const featured = pack.id === FEATURED_PACK_ID;
          return (
            <article
              className={`${styles.packCard}${featured ? ` ${styles.packFeatured}` : ""}`}
              key={pack.id}
              data-status={pack.status}
              data-featured={featured ? "true" : undefined}
            >
              {featured ? <span className={styles.packBadge}>RECOMMENDED</span> : null}
              <span className={styles.packName}>{pack.name}</span>
              <strong className={styles.packCredits}>{pack.credits.toLocaleString("ko-KR")} 크레딧</strong>
              {pack.purchasable ? (
                <>
                  <span className={styles.packPrice}>{formatPackPrice(pack)}</span>
                  <button type="button" className={styles.packBtn} onClick={() => void buy(pack)} disabled={!consent}>
                    {consent ? "구매하기" : "동의 후 구매 가능"}
                  </button>
                </>
              ) : (
                <span className={styles.packPending}>가격 확정 전 — 아직 구매할 수 없습니다</span>
              )}
            </article>
          );
        })}
      </div>
      {anyPurchasable ? (
        <label className={styles.packsConsent}>
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>
            크레딧은 결제 확인 즉시 제공이 개시되어 <b>청약철회가 제한</b>됩니다. 이에 동의합니다.{" "}
            <Link href="/refunds">환불정책 보기</Link>
          </span>
        </label>
      ) : (
        <p className={styles.packsState}>
          팩 구성은 확정되어 있고, 판매 가격은 운영자가 확정하는 즉시 이 자리에서 실값으로 열립니다.
        </p>
      )}
      {message ? <p className={styles.packsState} role="status">{message}</p> : null}
    </div>
  );
}
