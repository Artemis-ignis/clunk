"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import Link from "../NativeLink";
import { PrizeCard, type ClaimState } from "./PrizeCard";
import {
  GACHA_THEMES,
  capsuleColorOf,
  domeCapsules,
  drawFrom,
  drawableListings,
  listingsForTheme,
  themeById,
  themeCounts,
  type GachaListing,
  type ThemeId,
} from "./gacha-catalog";
import {
  isGachaSoundSupported,
  playCapsuleTap,
  playClunk,
  playLeverClick,
  playOpenSparkle,
  playRumble,
  primeGachaSound,
  readGachaMuted,
  serverGachaMuted,
  soundCallCounts,
  subscribeGachaMute,
  toggleGachaMuted,
} from "./gacha-sound";

/**
 * 캡슐 머신 한 대.
 *
 * 돔 안의 캡슐 색은 그 상품에서 실제로 잰 색이고, 다이얼 옆의 수는 실제 상품 수이고,
 * 떨어진 캡슐 안에 든 것은 마켓에 올라와 있는 그 상품이다. 받기는 상점이 이미 쓰는
 * 흐름(POST /api/marketplace/checkout, paymentMethod "beta")을 그대로 부르므로,
 * 여기서 받은 파일은 상점에서 받은 파일과 같은 파일이다.
 *
 * 로그아웃 상태에서도 뽑기·연출·카드까지 전부 된다. 로그인이 필요한 것은 받기뿐이다.
 */

type CatalogPayload = { ok?: boolean; listings?: GachaListing[]; checkout?: { status?: string } };
type SessionPayload = { authenticated?: boolean };
type CreditsPayload = { ok?: boolean; credits?: number };
type CheckoutPayload = { ok?: boolean; status?: string; downloadUrl?: string; error?: string };

type LoadState = "loading" | "ready" | "failed";

/**
 * 연출 단계.
 *  idle    레버 대기
 *  shake   레버가 돌아가고 머신이 흔들리며 캡슐이 구른다 (0 ~ 1.4초)
 *  impact  캡슐이 배출구에 떨어지고 화면에 Clunk! 이 뜬다 (1.4 ~ 2.2초)
 *  capsule 배출구의 캡슐이 빛나며 누르기를 기다린다
 *  wobble  누른 캡슐이 좌우로 세 번 흔들리다 멈칫한다
 *  burst   빛과 파티클이 터지며 캡슐이 갈라진다
 *  result  스테이터스 카드
 */
type Stage = "idle" | "shake" | "impact" | "capsule" | "wobble" | "burst" | "result";

const STAGES: readonly Stage[] = ["idle", "shake", "impact", "capsule", "wobble", "burst", "result"];

/** 연출 시간표(밀리초). 움직임을 줄여 달라는 설정이면 짧은 쪽을 쓴다. */
const TIMING = {
  full: { rumble: 200, rumbleSeconds: 1.2, impact: 1400, capsule: 2200, taps: [0, 260, 560], burst: 1100, result: 1800 },
  reduced: { rumble: 0, rumbleSeconds: 0, impact: 120, capsule: 260, taps: [], burst: 110, result: 260 },
} as const;

const LOGIN_HREF = "/login?return_to=%2F";
const DRAWN_KEY = "clunk.gacha.drawn";

/** 돔의 원과 캡슐 자리. 그림이 정한 값이고 상품 수와는 상관없다. */
const DOME = { cx: 150, cy: 112, r: 96, floor: 190 };
const CAPSULE_ROWS = [
  { y: 182, count: 4, gap: 24 },
  { y: 158, count: 5, gap: 27 },
  { y: 132, count: 6, gap: 28 },
  { y: 106, count: 6, gap: 28 },
  { y: 80, count: 5, gap: 29 },
] as const;

const CAPSULE_SLOTS: { x: number; y: number }[] = CAPSULE_ROWS.flatMap((row) =>
  Array.from({ length: row.count }, (_unused, index) => ({
    x: DOME.cx + (index - (row.count - 1) / 2) * row.gap,
    y: row.y,
  })),
);

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `gacha-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

function readDrawn(theme: ThemeId): string[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(`${DRAWN_KEY}.${theme}`);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function writeDrawn(theme: ThemeId, ids: readonly string[]): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(`${DRAWN_KEY}.${theme}`, JSON.stringify(ids));
  } catch {
    /* 저장이 막힌 브라우저에서도 뽑기는 되어야 한다 — 중복만 다시 나올 수 있다. */
  }
}

export function CapsuleMachine() {
  const [listings, setListings] = useState<GachaListing[]>([]);
  const [beta, setBeta] = useState(false);
  const [load, setLoad] = useState<LoadState>("loading");
  const [authenticated, setAuthenticated] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [theme, setTheme] = useState<ThemeId>("all");
  const [stage, setStage] = useState<Stage>("idle");
  const [prize, setPrize] = useState<GachaListing | null>(null);
  const [claim, setClaim] = useState<ClaimState>({ kind: "idle" });
  const [leverAngle, setLeverAngle] = useState(0);

  const soundSupported = useSyncExternalStore(subscribeNothing, isGachaSoundSupported, () => false);
  // 음소거는 브라우저에 남는 값이라 리액트 밖의 저장소에서 읽는다.
  const muted = useSyncExternalStore(subscribeGachaMute, readGachaMuted, serverGachaMuted);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false);

  const timers = useRef<number[]>([]);
  const leverRef = useRef<HTMLDivElement | null>(null);
  const draggedRef = useRef(false);

  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  const later = useCallback((delay: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, delay));
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  /* 카탈로그 ---------------------------------------------------------------- */
  useEffect(() => {
    let alive = true;
    void fetch("/api/marketplace", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as CatalogPayload;
        if (!response.ok || payload.ok !== true || !Array.isArray(payload.listings)) throw new Error("catalogue unavailable");
        if (!alive) return;
        setListings(payload.listings);
        setBeta(payload.checkout?.status === "PAYMENT_PROVIDER_NOT_CONFIGURED");
        setLoad("ready");
      })
      .catch(() => { if (alive) setLoad("failed"); });
    return () => { alive = false; };
  }, []);

  /* 로그인과 잔액 ----------------------------------------------------------- */
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
      .catch(() => { /* 로그인 상태를 못 읽으면 로그아웃으로 본다. */ });
    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => themeCounts(listings), [listings]);
  const pool = useMemo(() => listingsForTheme(listings, theme), [listings, theme]);
  const capsules = useMemo(() => domeCapsules(pool, CAPSULE_SLOTS.length), [pool]);
  const accent = themeById(theme).accent;
  const prizeColor = prize ? capsuleColorOf(prize) : accent;

  const creditLine = authenticated
    ? credits === null
      ? "크레딧을 확인하는 중입니다"
      : `크레딧 ${credits.toLocaleString("ko-KR")}개 · 베타 기간에는 차감되지 않습니다`
    : "베타 기간 무료 · 동전 필요 없음";

  /* 연출 -------------------------------------------------------------------- */

  const pickPrize = useCallback((slug?: string): GachaListing | null => {
    if (slug) {
      const wanted = drawableListings(listings).find((row) => row.slug === slug);
      if (wanted) return wanted;
    }
    const result = drawFrom(pool, readDrawn(theme));
    if (!result) return null;
    writeDrawn(theme, result.drawn);
    return result.listing;
  }, [listings, pool, theme]);

  const pull = useCallback(() => {
    if (stage !== "idle" || pool.length === 0) return;
    // 브라우저가 소리를 허락하는 것은 누른 그 순간이다. 소리는 나중에 나지만 여기서 깨운다.
    if (!muted && !reducedMotion) primeGachaSound();
    const drawnPrize = pickPrize();
    if (!drawnPrize) return;
    clearTimers();
    setPrize(drawnPrize);
    setClaim({ kind: "idle" });
    setStage("shake");
    setLeverAngle(90);
    const t = reducedMotion ? TIMING.reduced : TIMING.full;
    if (!reducedMotion) {
      playLeverClick();
      later(t.rumble, () => playRumble(t.rumbleSeconds));
    }
    later(t.impact, () => { setStage("impact"); if (!reducedMotion) playClunk(); });
    later(t.capsule, () => { setStage("capsule"); setLeverAngle(0); });
  }, [clearTimers, later, muted, pickPrize, pool.length, reducedMotion, stage]);

  const openCapsule = useCallback(() => {
    if (stage !== "capsule") return;
    clearTimers();
    setStage("wobble");
    const t = reducedMotion ? TIMING.reduced : TIMING.full;
    t.taps.forEach((delay, index) => later(delay, () => playCapsuleTap(1 + index * 0.35)));
    later(t.burst, () => { setStage("burst"); if (!reducedMotion) playOpenSparkle(); });
    later(t.result, () => setStage("result"));
  }, [clearTimers, later, reducedMotion, stage]);

  const again = useCallback(() => {
    clearTimers();
    setStage("idle");
    setPrize(null);
    setClaim({ kind: "idle" });
    setLeverAngle(0);
  }, [clearTimers]);

  // 다이얼을 돌리면 통이 바뀌므로 진행 중이던 연출은 접는다.
  const chooseTheme = useCallback((next: ThemeId) => {
    clearTimers();
    setTheme(next);
    setStage("idle");
    setPrize(null);
    setClaim({ kind: "idle" });
    setLeverAngle(0);
  }, [clearTimers]);

  const spinDial = useCallback(() => {
    const index = GACHA_THEMES.findIndex((row) => row.id === theme);
    chooseTheme(GACHA_THEMES[(index + 1) % GACHA_THEMES.length].id);
  }, [chooseTheme, theme]);

  /* 받기 -------------------------------------------------------------------- */
  const collect = useCallback(async () => {
    if (!prize) return;
    setClaim({ kind: "working" });
    try {
      const response = await fetch("/api/marketplace/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": createIdempotencyKey() },
        body: JSON.stringify({ listingId: prize.id, paymentMethod: "beta" }),
      });
      if (response.status === 401) {
        setClaim({ kind: "failed", message: "로그인하면 받을 수 있어요. 베타 기간이라 값은 0원입니다." });
        return;
      }
      const payload = await response.json() as CheckoutPayload;
      const granted = payload.status === "BETA_GRANTED"
        || payload.status === "FREE_DOWNLOAD"
        || payload.status === "ALREADY_OWNED"
        || payload.status === "PAID_WITH_CREDITS";
      if (!granted) {
        setClaim({ kind: "failed", message: payload.error ?? "지금은 받지 못했습니다. 잠시 뒤에 다시 눌러 주세요." });
        return;
      }
      if (payload.downloadUrl) {
        // 같은 출처의 주소라 링크 한 번으로 곧장 내려받기가 시작된다.
        const anchor = document.createElement("a");
        anchor.href = payload.downloadUrl;
        anchor.download = prize.entryFileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
      setClaim({
        kind: "done",
        message: payload.status === "ALREADY_OWNED"
          ? "이미 받아 둔 것입니다. 내려받기를 다시 시작했습니다."
          : "내려받기를 시작했습니다.",
      });
    } catch {
      setClaim({ kind: "failed", message: "연결이 끊겨 받지 못했습니다. 잠시 뒤에 다시 눌러 주세요." });
    }
  }, [prize]);

  /* 레버 끌기 --------------------------------------------------------------- */
  const onLeverDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (stage !== "idle") return;
    draggedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [stage]);

  const onLeverMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (stage !== "idle" || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const box = leverRef.current?.getBoundingClientRect();
    if (!box) return;
    // 레버 밑동(그림의 회전축)에서 손끝까지의 각도. 위를 0°, 오른쪽을 90° 로 읽는다.
    const pivotX = box.left + box.width * 0.443;
    const pivotY = box.top + box.height * 0.747;
    const angle = Math.atan2(event.clientX - pivotX, pivotY - event.clientY) * (180 / Math.PI);
    const clamped = Math.max(0, Math.min(96, angle));
    if (clamped > 6) draggedRef.current = true;
    setLeverAngle(clamped);
    if (clamped >= 90) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      pull();
    }
  }, [pull, stage]);

  const onLeverUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (stage === "idle") setLeverAngle(0);
  }, [stage]);

  const onLeverClick = useCallback(() => {
    // 끌어서 돌린 경우에는 이미 발동했다. 같은 동작으로 두 번 뽑지 않는다.
    if (draggedRef.current) { draggedRef.current = false; return; }
    pull();
  }, [pull]);

  /* 화면 없이 단계를 넘기는 손잡이 ------------------------------------------
     헤드리스 브라우저에서는 requestAnimationFrame 이 돌지 않아 시간표가 흐르지 않는다.
     시각 검증 스크립트가 각 단계를 직접 세울 수 있도록 창에 함수를 하나 걸어 둔다. */
  useEffect(() => {
    const scope = window as unknown as Record<string, unknown>;
    scope.__gachaStep = (next: string, slug?: string) => {
      if (!STAGES.includes(next as Stage)) return false;
      clearTimers();
      const wanted = next as Stage;
      if (wanted === "idle") {
        setPrize(null);
        setStage("idle");
        setLeverAngle(0);
        return true;
      }
      setPrize((current) => current && !slug ? current : pickPrize(slug));
      setLeverAngle(wanted === "shake" || wanted === "impact" ? 90 : 0);
      setStage(wanted);
      return true;
    };
    scope.__gachaSoundCounts = () => soundCallCounts();
    return () => {
      delete scope.__gachaStep;
      delete scope.__gachaSoundCounts;
    };
  }, [clearTimers, pickPrize]);

  /* 그리기 ------------------------------------------------------------------ */

  if (load === "failed") {
    return (
      <p className="gc-empty" role="status">
        지금은 머신 안을 불러오지 못했습니다. <Link href="/marketplace" prefetch={false}>마켓에서 직접 확인하기</Link>
      </p>
    );
  }
  if (load === "loading") {
    return <p className="gc-empty" role="status">머신에 캡슐을 채우는 중입니다…</p>;
  }
  if (drawableListings(listings).length === 0) {
    return (
      <p className="gc-empty" role="status">
        지금 머신에 들어 있는 에셋이 없습니다. <Link href="/marketplace" prefetch={false}>마켓에서 직접 확인하기</Link>
      </p>
    );
  }

  const shaking = stage === "shake";
  const dialIndex = GACHA_THEMES.findIndex((row) => row.id === theme);

  return (
    <div
      className="gc"
      data-stage={stage}
      data-reduced={reducedMotion || undefined}
      style={{ "--gc-accent": accent, "--gc-prize": prizeColor } as CSSProperties}
    >
      <div className="gc-machine-wrap">
        <div className="gc-machine" data-shaking={shaking || undefined}>
          {/* 돔 --------------------------------------------------------- */}
          <svg className="gc-dome" viewBox="0 0 300 210" role="img" aria-label={`돔 안에 ${themeById(theme).name} 에셋 ${counts[theme]}개가 캡슐로 들어 있습니다`}>
            <defs>
              <radialGradient id="gc-glass" cx="36%" cy="26%" r="78%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.42" />
                <stop offset="46%" stopColor="#cfe3ff" stopOpacity="0.10" />
                <stop offset="100%" stopColor="#0b0e1a" stopOpacity="0.30" />
              </radialGradient>
              <linearGradient id="gc-collar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3a4160" />
                <stop offset="100%" stopColor="#1b2038" />
              </linearGradient>
              <clipPath id="gc-dome-clip">
                <path d={`M 94 ${DOME.floor} A ${DOME.r} ${DOME.r} 0 1 1 206 ${DOME.floor} Z`} />
              </clipPath>
            </defs>
            <rect x="86" y="184" width="128" height="24" rx="9" fill="url(#gc-collar)" />
            <g clipPath="url(#gc-dome-clip)">
              <rect x="0" y="0" width="300" height="210" fill="#0a0d18" />
              {capsules.map((capsule, index) => {
                const slot = CAPSULE_SLOTS[index];
                if (!slot) return null;
                // 흔들릴 때 캡슐마다 조금씩 다르게 튀도록, 자리 번호에서 뽑은 고정된
                // 지연·회전값을 준다(무작위가 아니라 자리마다 정해진 값이라 서버와 화면이 같다).
                const delay = ((index * 37) % 23) / 100;
                const spin = index % 4 === 0 ? 1 : 0;
                return (
                  <g
                    key={capsule.key}
                    className="gc-cap"
                    data-spin={spin ? "1" : undefined}
                    style={{ "--gc-cap-delay": `${delay}s` } as CSSProperties}
                  >
                    <circle cx={slot.x} cy={slot.y} r="13" fill={capsule.color} />
                    <path d={`M ${slot.x - 13} ${slot.y} a 13 13 0 0 1 26 0 Z`} fill="#f6f8ff" opacity="0.82" />
                    <circle cx={slot.x - 4.4} cy={slot.y - 5} r="3.1" fill="#ffffff" opacity="0.6" />
                  </g>
                );
              })}
            </g>
            <path
              className="gc-glass"
              d={`M 94 ${DOME.floor} A ${DOME.r} ${DOME.r} 0 1 1 206 ${DOME.floor} Z`}
              fill="url(#gc-glass)"
              stroke="rgba(226,236,255,0.42)"
              strokeWidth="2.5"
            />
          </svg>

          {/* 몸통 ------------------------------------------------------- */}
          <div className="gc-body">
            <div className="gc-logo" aria-hidden="true">CLUNK</div>

            <div className="gc-coin">
              <svg viewBox="0 0 46 46" aria-hidden="true">
                <rect x="3" y="3" width="40" height="40" rx="10" fill="#20263f" stroke="rgba(255,255,255,0.14)" />
                <rect x="14" y="12" width="18" height="6" rx="3" fill="#0a0d18" />
                <circle cx="23" cy="30" r="8" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
              </svg>
              <div>
                <span className="gc-coin-label">동전 투입구</span>
                <p>{creditLine}</p>
              </div>
            </div>

            <div className="gc-dial">
              <button
                type="button"
                className="gc-dial-knob"
                onClick={spinDial}
                aria-label={`테마 다이얼 — 지금 ${themeById(theme).name}, 누르면 다음 테마로 돌아갑니다`}
              >
                <svg viewBox="0 0 64 64" aria-hidden="true">
                  <circle cx="32" cy="32" r="28" fill="#161b30" stroke="rgba(255,255,255,0.16)" strokeWidth="2" />
                  <circle cx="32" cy="32" r="21" fill="#0d1120" />
                  <g style={{ transform: `rotate(${dialIndex * 72 - 144}deg)`, transformOrigin: "32px 32px", transition: "transform 260ms cubic-bezier(.2,1.4,.4,1)" }}>
                    <rect x="29.5" y="10" width="5" height="20" rx="2.5" fill="var(--gc-accent)" />
                  </g>
                  <circle cx="32" cy="32" r="5" fill="var(--gc-accent)" />
                </svg>
              </button>
              <div className="gc-dial-options" role="group" aria-label="테마 다이얼">
                {GACHA_THEMES.map((row) => (
                  <button
                    type="button"
                    key={row.id}
                    className="gc-dial-option"
                    aria-pressed={row.id === theme}
                    onClick={() => chooseTheme(row.id)}
                    style={{ "--gc-accent": row.accent } as CSSProperties}
                  >
                    {row.name}<i>{counts[row.id]}</i>
                  </button>
                ))}
              </div>
            </div>

            {/* 배출구와 레버 ------------------------------------------- */}
            <div className="gc-lower">
              <div className="gc-tray">
                <svg viewBox="0 0 170 98" aria-hidden="true">
                  <rect x="6" y="6" width="158" height="86" rx="12" fill="#0a0d18" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
                  <rect x="16" y="13" width="138" height="38" rx="9" fill="rgba(180,205,255,0.10)" stroke="rgba(226,236,255,0.22)" />
                  <rect x="60" y="15" width="50" height="4" rx="2" fill="rgba(255,255,255,0.22)" />
                </svg>
                {stage === "impact" || stage === "capsule" || stage === "wobble" || stage === "burst" ? (
                  <button
                    type="button"
                    className="gc-tray-capsule"
                    onClick={openCapsule}
                    disabled={stage !== "capsule"}
                    aria-label={stage === "capsule" ? "떨어진 캡슐 — 눌러서 열기" : "캡슐이 열리는 중입니다"}
                  >
                    <svg viewBox="0 0 68 68" aria-hidden="true">
                      <g className="gc-capsule-top">
                        <path d="M 5 34 a 29 29 0 0 1 58 0 Z" fill="#f6f8ff" />
                      </g>
                      <g className="gc-capsule-bottom">
                        <path d="M 5 34 a 29 29 0 0 0 58 0 Z" fill="var(--gc-prize)" />
                      </g>
                      <circle cx="24" cy="22" r="6" fill="#ffffff" opacity="0.55" />
                    </svg>
                    <span className="gc-tray-hint">눌러서 열기</span>
                  </button>
                ) : null}
              </div>

              <div className="gc-lever" ref={leverRef}>
                <svg viewBox="0 0 140 150" aria-hidden="true">
                  <circle cx="62" cy="112" r="30" fill="#20263f" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
                  <circle cx="62" cy="112" r="9" fill="#0a0d18" />
                  <g
                    className="gc-lever-arm"
                    style={{ transform: `rotate(${leverAngle}deg)`, transformOrigin: "62px 112px" }}
                  >
                    <rect x="54" y="38" width="16" height="76" rx="8" fill="#8e9ab8" />
                    <circle cx="62" cy="34" r="20" fill="var(--gc-accent)" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                    <circle cx="56" cy="28" r="5.5" fill="#ffffff" opacity="0.45" />
                  </g>
                </svg>
                <button
                  type="button"
                  className="gc-lever-grip"
                  onPointerDown={onLeverDown}
                  onPointerMove={onLeverMove}
                  onPointerUp={onLeverUp}
                  onPointerCancel={onLeverUp}
                  onClick={onLeverClick}
                  disabled={stage !== "idle"}
                  aria-label="레버를 당겨 에셋 뽑기"
                />
                {stage === "idle" ? (
                  <span className="gc-lever-hint" aria-hidden="true"><b>레버를 당기세요</b><i>→</i></span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="gc-base" aria-hidden="true" />

          {/* 돔에서 배출구로 굴러 내려오는 캡슐. 머신 전체를 기준으로 움직이므로
              화면 크기가 달라져도 같은 자리에 떨어진다. */}
          {stage === "shake" ? <span className="gc-drop" aria-hidden="true" /> : null}
        </div>

        {/* 빛 터짐 ------------------------------------------------------ */}
        {stage === "burst" ? (
          <span className="gc-burst" aria-hidden="true">
            <i className="gc-burst-glow" />
            {Array.from({ length: 28 }, (_unused, index) => (
              <i
                key={index}
                className="gc-spark"
                style={{ "--gc-angle": `${index * (360 / 28)}deg`, "--gc-spark-delay": `${(index % 7) * 0.018}s` } as CSSProperties}
              />
            ))}
          </span>
        ) : null}

        {/* 결과 카드 ---------------------------------------------------- */}
        {stage === "result" && prize ? (
          <PrizeCard
            listing={prize}
            beta={beta}
            authenticated={authenticated}
            claim={claim}
            loginHref={LOGIN_HREF}
            onClaim={() => { void collect(); }}
            onAgain={again}
          />
        ) : null}
      </div>

      {/* Clunk! 임팩트 — 머신이 아니라 화면 가운데에 크게 뜬다. ---------- */}
      {stage === "impact" ? (
        <>
          <span className="gc-flash" aria-hidden="true" />
          <strong className="gc-impact" aria-hidden="true">Clunk!</strong>
        </>
      ) : null}

      <p className="gc-foot">
        떨어질 때 나는 소리, 그게 Clunk 입니다.
        {soundSupported ? (
          <button type="button" className="gc-mute" aria-pressed={muted} onClick={toggleGachaMuted}>
            {muted ? "소리 켜기" : "소리 끄기"}
          </button>
        ) : null}
        <Link className="gc-foot-link" href="/marketplace" prefetch={false}>마켓 전체 목록</Link>
      </p>
    </div>
  );
}
