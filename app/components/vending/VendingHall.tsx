"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "../NativeLink";
import { isClunkSoundSupported, playClunk, primeClunkSound } from "./clunk-sound";
import { VendingMachine, type DispenseOutcome } from "./VendingMachine";
import { buildMachines, type VendingListing, type VendingSlot } from "./vending-catalog";

/**
 * 자판기 홀.
 *
 * 카탈로그는 /api/marketplace 가 주는 그대로다. 어느 자판기에 들어가는지, 슬롯에 적히는
 * 폴리곤 수와 가격은 vending-catalog.ts 가 그 응답만 보고 정한다. 뽑기는 상점이 이미 쓰는
 * 흐름(POST /api/marketplace/checkout, paymentMethod "beta")을 그대로 부르므로, 여기서
 * 파일이 떨어지면 상점에서 받은 것과 같은 파일이다.
 *
 * 로그아웃 상태에서는 아무것도 떨어뜨리지 않는다 — 뽑히는 시늉만 하는 자판기는 거짓말이다.
 */

type CatalogPayload = { ok?: boolean; listings?: VendingListing[]; checkout?: { status?: string } };
type SessionPayload = { authenticated?: boolean; displayName?: string };
type CreditsPayload = { ok?: boolean; credits?: number };
type CheckoutPayload = { ok?: boolean; status?: string; downloadUrl?: string; error?: string };

type LoadState = "loading" | "ready" | "failed";

const LOGIN_HREF = "/login?return_to=%2F";

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `vending-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 브라우저 설정을 그대로 읽는다. 서버에서는 언제나 false — 켜진 애니메이션이 기본이다. */
function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 소리를 낼 수 있는지는 이 브라우저에서 변하지 않으므로 구독할 것이 없다. */
function subscribeNothing(): () => void {
  return () => {};
}

export function VendingHall() {
  const [listings, setListings] = useState<VendingListing[]>([]);
  const [beta, setBeta] = useState(false);
  const [state, setState] = useState<LoadState>("loading");
  const [authenticated, setAuthenticated] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const soundSupported = useSyncExternalStore(subscribeNothing, isClunkSoundSupported, () => false);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false);

  useEffect(() => {
    let alive = true;
    void fetch("/api/marketplace", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as CatalogPayload;
        if (!response.ok || payload.ok !== true || !Array.isArray(payload.listings)) throw new Error("catalogue unavailable");
        if (!alive) return;
        setListings(payload.listings);
        setBeta(payload.checkout?.status === "PAYMENT_PROVIDER_NOT_CONFIGURED");
        setState("ready");
      })
      .catch(() => { if (alive) setState("failed"); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    void fetch("/api/session", { cache: "no-store" })
      .then((response) => response.json() as Promise<SessionPayload>)
      .then(async (session) => {
        if (!alive || session.authenticated !== true) return;
        setAuthenticated(true);
        // 잔액은 로그인한 사람에게만 물어본다. 로그아웃 상태의 /api/credits 는 401 이라
        // 콘솔에 빨간 줄만 남기고 알려 주는 것이 없다.
        const response = await fetch("/api/credits", { cache: "no-store" });
        if (!response.ok || !alive) return;
        const payload = await response.json() as CreditsPayload;
        if (typeof payload.credits === "number") setCredits(payload.credits);
      })
      .catch(() => { /* 로그인 상태를 못 읽으면 로그아웃으로 본다 — 잘못 뽑는 것보다 낫다. */ });
    return () => { alive = false; };
  }, []);

  const machines = useMemo(() => buildMachines(listings, beta), [listings, beta]);
  // 자판기 수가 줄면 고른 자리가 사라질 수 있다. 상태를 고쳐 쓰는 대신 읽을 때 맞춘다.
  const shownIndex = machines.length ? Math.min(activeIndex, machines.length - 1) : 0;

  const creditLine = authenticated
    ? credits === null
      ? "잔액을 확인하는 중입니다"
      : `크레딧 ${credits.toLocaleString("ko-KR")}개 · 베타 기간에는 차감되지 않습니다`
    : "베타 기간 무료 · 로그인하면 바로 뽑기";

  const dispense = useCallback(async (slot: VendingSlot): Promise<DispenseOutcome> => {
    // 소리는 상품이 닿을 때 나지만, 브라우저가 재생을 허락하는 것은 누른 그 순간이다.
    if (!muted && !reducedMotion) primeClunkSound();
    if (!authenticated) {
      return { ok: false, message: "로그인하면 뽑을 수 있어요. 베타 기간이라 값은 0원입니다.", loginHref: LOGIN_HREF };
    }
    try {
      const response = await fetch("/api/marketplace/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": createIdempotencyKey() },
        body: JSON.stringify({ listingId: slot.listing.id, paymentMethod: "beta" }),
      });
      if (response.status === 401) {
        return { ok: false, message: "로그인하면 뽑을 수 있어요.", loginHref: LOGIN_HREF };
      }
      const payload = await response.json() as CheckoutPayload;
      if (payload.status === "BETA_GRANTED" || payload.status === "FREE_DOWNLOAD" || payload.status === "ALREADY_OWNED" || payload.status === "PAID_WITH_CREDITS") {
        return {
          ok: true,
          title: slot.listing.title,
          slug: slot.listing.slug,
          downloadUrl: payload.downloadUrl ?? null,
          note: payload.status === "ALREADY_OWNED"
            ? "이미 받아 둔 것입니다. 배출구에서 다시 받으세요."
            : "떨어졌습니다. 배출구에서 파일을 받으세요.",
        };
      }
      return { ok: false, message: payload.error ?? "지금은 뽑지 못했습니다. 잠시 뒤에 다시 눌러 주세요." };
    } catch {
      return { ok: false, message: "연결이 끊겨 뽑지 못했습니다. 잠시 뒤에 다시 눌러 주세요." };
    }
  }, [authenticated, muted, reducedMotion]);

  const onLanded = useCallback(() => {
    if (muted || reducedMotion) return;
    playClunk();
  }, [muted, reducedMotion]);

  if (state === "failed") {
    return (
      <p className="vh-empty" role="status">
        지금은 자판기 안을 불러오지 못했습니다. <Link href="/marketplace" prefetch={false}>마켓에서 직접 확인하기</Link>
      </p>
    );
  }

  if (state === "loading") {
    return (
      <p className="vh-empty" role="status">자판기 안을 불러오는 중입니다…</p>
    );
  }

  if (machines.length === 0) {
    return (
      <p className="vh-empty" role="status">
        지금 자판기에 들어 있는 상품이 없습니다. <Link href="/marketplace" prefetch={false}>마켓에서 직접 확인하기</Link>
      </p>
    );
  }

  return (
    <div className="vh">
      <div className="vh-bar">
        <div className="vh-tabs" role="tablist" aria-label="자판기 고르기">
          {machines.map((machine, index) => (
            <button
              type="button"
              role="tab"
              key={machine.theme.id}
              aria-selected={index === shownIndex}
              className={`vh-tab${index === shownIndex ? " is-on" : ""}`}
              style={{ "--vm-accent": machine.theme.accent } as React.CSSProperties}
              onClick={() => setActiveIndex(index)}
            >
              {machine.theme.name}<i>{machine.slots.length}</i>
            </button>
          ))}
        </div>
        {soundSupported ? (
          <button type="button" className="vh-mute" aria-pressed={muted} onClick={() => setMuted((value) => !value)}>
            {muted ? "소리 켜기" : "소리 끄기"}
          </button>
        ) : null}
      </div>

      <div className="vh-row">
        {machines.map((machine, index) => (
          <VendingMachine
            key={machine.theme.id}
            machine={machine}
            active={index === shownIndex}
            creditLine={creditLine}
            reducedMotion={reducedMotion}
            onDispense={dispense}
            onLanded={onLanded}
          />
        ))}
      </div>
    </div>
  );
}
