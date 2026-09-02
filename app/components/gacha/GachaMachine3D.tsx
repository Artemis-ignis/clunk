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

import Image from "next/image";

import Link from "../NativeLink";
import { CapsuleMachine } from "./CapsuleMachine";
import { GachaPoster, POSTER_POINTS } from "./GachaPoster";
import { SCROLL_PULL } from "./gacha-scroll";
import { PrizeCard, type ClaimState } from "./PrizeCard";
import {
  GACHA_THEMES,
  GRADE_COLORS,
  GRADE_RULE,
  capsuleColorOf,
  domeCapsules,
  drawFrom,
  drawableListings,
  gradeOf,
  listingsForTheme,
  modelUrlOf,
  previewImageUrlOf,
  previewUrlOf,
  remainingInRound,
  themeById,
  themeCounts,
  type GachaListing,
  type ThemeId,
} from "./gacha-catalog";
import {
  isGachaSoundSupported,
  playBounce,
  playCapsuleTap,
  playClunk,
  playCrankRatchet,
  playLeverClick,
  playNeonBuzz,
  playOpenSparkle,
  playRumble,
  primeGachaSound,
  readGachaMuted,
  serverGachaMuted,
  soundCallCounts,
  subscribeGachaMute,
  toggleGachaMuted,
} from "./gacha-sound";
import type { GachaScene, SceneStage } from "./gacha-scene";

/**
 * 실시간 3D 가챠 머신 한 대.
 *
 * 그림이 아니라 장면이다 — 돔·몸통·레버·배출구는 three.js 로 지은 물건이고(gacha-scene.ts),
 * 돔 안의 캡슐은 대기 중에도 계속 움직인다. 옆면의 레버를 아래로 당기면 캡슐이 튀어 오르고,
 * 하나가 배출구로 떨어져 Clunk 소리를 내고, 누르면 갈라지면서 그 안에서 실제 판매 파일이
 * 나온다.
 *
 * 기계는 카탈로그를 기다리지 않는다. 첫 페인트에 빈 기계가 이미 서 있고, /api/marketplace
 * 가 도착하면 돔 위 투입구로 캡슐이 쏟아져 들어온다. 응답이 실패해도 기계는 그대로 있고
 * 옆 판에 안내 한 줄만 붙는다.
 *
 * 화면에 뜨는 값은 전부 /api/marketplace 응답에서 읽은 것이고(gacha-catalog.ts), 받기는
 * 상점이 이미 쓰는 흐름을 그대로 부른다. WebGL 이 없는 브라우저는 SVG 머신으로 되돌아간다.
 */

type CatalogPayload = { ok?: boolean; listings?: GachaListing[]; checkout?: { status?: string } };
type SessionPayload = { authenticated?: boolean };
type CreditsPayload = { ok?: boolean; credits?: number };
type CheckoutPayload = { ok?: boolean; status?: string; downloadUrl?: string; error?: string };

type LoadState = "loading" | "ready" | "failed";

/**
 * 연출 단계.
 *  idle    레버 대기 — 캡슐이 숨 쉬듯 미세하게 움직인다
 *  pull    레버가 끝까지 내려갔다 스프링처럼 튕겨 올라온다 (래칫 소리)
 *  shake   돔 안 캡슐 전체가 튀어 오르며 부딪힌다 (드르륵)
 *  impact  한 알이 구멍으로 빨려 내려가 배출구로 툭 (Clunk, 두 번 튕김)
 *  capsule 배출구의 캡슐이 빛나며 누르기를 기다린다
 *  wobble  누른 캡슐이 카메라 앞으로 떠오르며 세 번 흔들린다
 *  burst   빛과 파티클이 터지며 두 반구가 갈라진다
 *  result  실제 파일이 돌고, 옆에 스테이터스 카드
 */
type Stage = SceneStage;

const STAGES: readonly Stage[] = ["idle", "pull", "shake", "impact", "capsule", "wobble", "burst", "result"];

/**
 * 연출 시간표(밀리초, 손잡이를 돌린 순간 기준). gacha-scene.ts 의 STAGE_SECONDS 와 같은 값이다.
 * 움직임을 줄여 달라는 설정이면 단계만 즉시 넘어간다.
 */
const TIMING = {
  full: {
    shake: 750,
    rumbleSeconds: 1.2,
    impact: 1950,
    clunk: 2730,
    bounces: [2930, 3050],
    capsule: 3200,
    taps: [0, 300, 620],
    burst: 1100,
    result: 2000,
  },
  reduced: {
    shake: 40,
    rumbleSeconds: 0,
    impact: 80,
    clunk: 90,
    bounces: [] as number[],
    capsule: 130,
    taps: [] as number[],
    burst: 90,
    result: 180,
  },
} as const;

/**
 * 등장 연출의 시간표(밀리초). gacha-scene.ts 의 INTRO_SECONDS 와 같은 값이다 —
 * 장면 파일은 WebGL 이 있어야 불러올 수 있어서 여기에 같은 표를 둔다.
 * 소리는 이 순간에 얹고, 첫 제스처 전이면 브라우저가 막아 조용히 지나간다.
 */
const INTRO_MS = { spotlight: 180, land: 860, neon: 1020, pour: 1280, total: 2400 } as const;

const LOGIN_HREF = "/login?return_to=%2F";
const DRAWN_KEY = "clunk.gacha.drawn";
/** 등장 연출은 이 브라우저 세션에 한 번만 본다. */
const INTRO_KEY = "clunk.gacha.intro";
/** 레버를 이만큼(px) 아래로 끌면 발동한다. 엄지로 한 번 훑는 거리다. */
const LEVER_TRIGGER_PIXELS = 60;
/** 손잡이가 끝까지 내려가는 거리(px). 끌어내린 만큼 레버가 따라 내려간다. */
const LEVER_TRAVEL_PIXELS = 96;

/**
 * 선반에 걸린 상품 한 칸.
 *
 * 그림도 이름도 등급도 전부 /api/marketplace 응답에서 온 것이다. 손끝 쪽으로 살짝
 * 기울어 만질 수 있는 물건처럼 굴고, 누르면 그 상품의 상세 화면으로 간다.
 */
function ShelfCard({ listing }: { listing: GachaListing }) {
  const preview = previewImageUrlOf(listing);
  const grade = gradeOf(listing);

  const onMove = useCallback((event: ReactPointerEvent<HTMLAnchorElement>) => {
    const node = event.currentTarget;
    const box = node.getBoundingClientRect();
    if (box.width === 0) return;
    // 가운데를 0 으로 두고 -1~1. 카드 반대쪽이 들리도록 세로는 부호를 뒤집는다.
    const x = ((event.clientX - box.left) / box.width) * 2 - 1;
    const y = ((event.clientY - box.top) / box.height) * 2 - 1;
    node.style.setProperty("--gc-tilt-x", `${(-y * 6).toFixed(2)}deg`);
    node.style.setProperty("--gc-tilt-y", `${(x * 8).toFixed(2)}deg`);
  }, []);

  const onLeave = useCallback((event: ReactPointerEvent<HTMLAnchorElement>) => {
    event.currentTarget.style.setProperty("--gc-tilt-x", "0deg");
    event.currentTarget.style.setProperty("--gc-tilt-y", "0deg");
  }, []);

  return (
    <Link
      className="gc3-shelf-card"
      href={`/marketplace/${listing.slug}`}
      prefetch={false}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ "--gc-grade": GRADE_COLORS[grade.letter] } as CSSProperties}
    >
      <span className="gc3-shelf-art">
        {preview ? (
          // 상점 목록과 같은 주소·같은 규칙(unoptimized) — 이미 작게 구워 둔 그림이다.
          <Image src={preview} alt="" width={220} height={165} unoptimized loading="lazy" decoding="async" />
        ) : (
          <i aria-hidden="true" />
        )}
        <b>{grade.letter}</b>
      </span>
      <span className="gc3-shelf-name">{listing.title}</span>
    </Link>
  );
}

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `gacha-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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

/** 이 세션에 등장 연출을 이미 봤는지. 저장이 막힌 브라우저에서는 늘 새로 본다. */
function introAlreadySeen(): boolean {
  try {
    return sessionStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
}

function markIntroSeen(): void {
  try {
    sessionStorage.setItem(INTRO_KEY, "1");
  } catch {
    /* 저장이 막혀도 연출은 이미 지나갔다. */
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

/** 이 브라우저가 WebGL 을 그릴 수 있는지. 못 그리면 SVG 머신으로 간다. */
function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function GachaMachine3D() {
  const [listings, setListings] = useState<GachaListing[]>([]);
  const [beta, setBeta] = useState(false);
  const [load, setLoad] = useState<LoadState>("loading");
  const [authenticated, setAuthenticated] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [theme, setTheme] = useState<ThemeId>("all");
  const [stage, setStage] = useState<Stage>("idle");
  const [prize, setPrize] = useState<GachaListing | null>(null);
  const [claim, setClaim] = useState<ClaimState>({ kind: "idle" });
  const [clunked, setClunked] = useState(false);
  // 이번 바퀴에 이미 나온 것들. 이 브라우저의 세션에만 남는다.
  const [drawn, setDrawn] = useState<string[]>(() => readDrawn("all"));
  /** 장면을 짓다 실패하면 SVG 머신으로 간다. */
  const [sceneFailed, setSceneFailed] = useState(false);
  /**
   * 등장 연출이 도는 동안에는 안내 한 줄과 라벨을 띄우지 않는다.
   *
   * 이것만은 리액트 상태가 아니라 뿌리 요소의 data-intro 속성을 직접 켰다 끈다 —
   * 연출은 화면을 다시 그릴 일이 없는 순수한 표시이고, 효과 안에서 상태를 세우면
   * 렌더가 한 번 더 도는 데다 서버가 그린 첫 화면과 어긋난다.
   */
  const rootRef = useRef<HTMLDivElement | null>(null);
  /** 스크롤 연출의 트랙(긴 구간)과 장면마다 뜨는 글줄. */
  const trackRef = useRef<HTMLDivElement | null>(null);
  const beatHeadRef = useRef<HTMLDivElement | null>(null);
  const beatScrollRef = useRef<HTMLParagraphElement | null>(null);
  const beatInsideRef = useRef<HTMLDivElement | null>(null);
  const beatLeverRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef(0);
  /** 이번에 내려가면서 레버가 이미 당겨졌는지. 다시 올라가면 풀린다. */
  const scrollFired = useRef(false);
  const stageLive = useRef<Stage>("idle");
  const turnLive = useRef<() => void>(() => {});
  /** 스크롤 계산을 한 번 더 돌리는 손잡이 — 단계가 바뀌면 글줄도 바로 따라 바뀐다. */
  const refreshFilm = useRef<() => void>(() => {});
  /** 3D 가 첫 프레임을 냈는지. 그 전에는 포스터 위에 단추를 놓는다. */
  const liveRef = useRef(false);
  /** ?diag=1 — 실기기에서 무엇이 언제 됐는지 화면 구석에 적는다. */
  const [diag, setDiag] = useState<string[] | null>(null);
  const diagStart = useRef(0);
  const diagOn = useRef(false);
  const diagLines = useRef<string[]>([]);
  const note = useCallback((line: string) => {
    // 언제나 적어 두고, 진단이 켜져 있을 때만 화면에 흘린다(켜기 전 줄도 남는다).
    const stamp = diagStart.current ? `${((performance.now() - diagStart.current) / 1000).toFixed(2)}s ` : "";
    diagLines.current.push(`${stamp}${line}`);
    if (diagOn.current) setDiag([...diagLines.current]);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined" || !/[?&]diag=1/.test(window.location.search)) return;
    diagStart.current = performance.now();
    const gl = (() => { try { const c = document.createElement("canvas"); return Boolean(c.getContext("webgl2") ?? c.getContext("webgl")); } catch { return false; } })();
    // 서버가 그린 첫 화면과 어긋나지 않도록 한 틱 뒤에 켠다.
    diagLines.current.unshift(`ua ${navigator.userAgent.slice(0, 90)}`, `webgl ${gl} · dpr ${window.devicePixelRatio} · ${window.innerWidth}×${window.innerHeight}`);
    const boot = window.setTimeout(() => { diagOn.current = true; setDiag([...diagLines.current]); }, 0);
    const onError = (event: ErrorEvent) => note(`ERROR ${String(event.message).slice(0, 160)}`);
    const onReject = (event: PromiseRejectionEvent) => note(`REJECT ${String(event.reason).slice(0, 160)}`);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    return () => { window.clearTimeout(boot); window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onReject); };
  }, [note]);
  const markIntroChrome = useCallback((playing: boolean) => {
    const node = rootRef.current;
    if (!node) return;
    if (playing) node.dataset.intro = "1";
    else delete node.dataset.intro;
  }, []);
  /** 장면이 설 때마다 오르는 수. 아래의 "값 넣기" 훅들이 이것을 보고 한 번 더 돈다. */
  const [sceneReady, setSceneReady] = useState(0);

  const soundSupported = useSyncExternalStore(subscribeNothing, isGachaSoundSupported, () => false);
  const muted = useSyncExternalStore(subscribeGachaMute, readGachaMuted, serverGachaMuted);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false);
  // WebGL 이 되는지는 이 브라우저에서 변하지 않으므로 구독할 것이 없다. 서버에서는
  // 언제나 "된다" 로 두어, 서버가 그리는 첫 화면과 브라우저의 첫 화면이 같게 한다.
  const webglSupported = useSyncExternalStore(subscribeNothing, canUseWebGL, () => true);
  // 장면이 실패해도 옛 SVG 기계로 갈아타지 않는다 — 포스터가 그대로 서 있고, 그 위의 단추로
  // 뽑기는 계속 된다(2026-09-03). 옛 SVG 는 WebGL 자체가 없는 브라우저에만 남는다.
  const webgl = webglSupported;
  void sceneFailed;

  const hostRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const leverRef = useRef<HTMLButtonElement | null>(null);
  const capsuleRef = useRef<HTMLButtonElement | null>(null);
  const domeRef = useRef<HTMLDivElement | null>(null);
  const hintRef = useRef<HTMLParagraphElement | null>(null);
  const sceneRef = useRef<GachaScene | null>(null);
  const timers = useRef<number[]>([]);
  const leverDrag = useRef({ active: false, startY: 0 });
  const stats = useRef({ frames: 0, totalMs: 0 });
  /** 캡슐을 이미 쏟아 부었는지. 카탈로그가 오는 그 한 번만 붓는다. */
  const poured = useRef(false);
  /** 유리를 두드리는 소리는 손이 올라온 한 번만 난다. 훑고 지나갈 때마다 울리면 시끄럽다. */
  const lastGlassTap = useRef(0);

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
  const accent = themeById(theme).accent;
  const remaining = useMemo(() => remainingInRound(pool, drawn), [pool, drawn]);
  const prizeGrade = prize ? gradeOf(prize) : null;
  const prizeRing = prizeGrade ? GRADE_COLORS[prizeGrade.letter] : accent;
  const prizeColor = prize ? capsuleColorOf(prize) : accent;

  /**
   * 선반에 거는 목록 — 지금 다이얼에 걸린 상품 가운데 미리보기 그림이 있는 것들.
   * 스물이 넘어가면 가로 줄이 끝없이 길어지므로 거기서 끊는다.
   */
  const shelf = useMemo(
    () => pool.filter((listing) => Boolean(listing.previewFileName)).slice(0, 20),
    [pool],
  );

  /** 돔에 채울 캡슐. 자리 수는 최대치이고, 장면이 기기에 맞게 앞에서부터 잘라 쓴다. */
  const capsuleSpecs = useMemo(
    () => domeCapsules(pool, 40).map((capsule) => ({ color: capsule.color, ring: capsule.ring })),
    [pool],
  );

  /**
   * 로그인한 사람에게만 잔액 한 줄. 값이나 베타 이야기는 무대에도, 이 판에도 적지
   * 않는다 — 뽑고 나서 카드에서 한 번에 읽는 편이 낫다(운영자 지시 2026-09-02).
   */
  const creditLine = !authenticated
    ? null
    : credits === null
      ? "크레딧을 확인하는 중입니다"
      : `내 크레딧 ${credits.toLocaleString("ko-KR")}개`;

  /* 장면 만들기 -------------------------------------------------------------
     카탈로그를 기다리지 않는다. 캔버스와 기계가 먼저 서고, 캡슐은 나중에 들어온다. */
  useEffect(() => {
    if (!webgl) return;
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let raf = 0;
    let previous = 0;
    let onScreen = true;
    // 검증 스크립트가 프레임을 직접 돌리기 시작하면 rAF 루프는 물러난다. 두 시계가
    // 같이 흐르면 "이 순간" 을 찍을 수 없기 때문이다.
    let manual = false;
    let observer: IntersectionObserver | null = null;
    let onResize: (() => void) | null = null;

    note("scene module loading");
    void (async () => {
      try {
        const sceneModule = await import("./gacha-scene");
        note("scene module loaded");
        if (disposed) return;
        const quality = window.matchMedia("(max-width: 720px)").matches
          ? sceneModule.MOBILE_QUALITY
          : sceneModule.DESKTOP_QUALITY;
        const scene = sceneModule.createGachaScene(host, { quality, reducedMotion });
        note(`scene created · ${quality === sceneModule.MOBILE_QUALITY ? "mobile" : "desktop"} quality`);
        if (disposed) { scene.dispose(); return; }
        sceneRef.current = scene;

        // 그래픽 문맥이 날아가면(기기가 메모리를 회수하거나 드라이버가 멈추면) 캔버스는
        // 흰 사각형으로 남는다. 그럴 때는 SVG 머신으로 갈아탄다 — 빈 상자를 보여 주지 않는다.
        host.querySelector("canvas")?.addEventListener(
          "webglcontextlost",
          () => { if (!disposed) setSceneFailed(true); },
          { once: true },
        );

        const placeOverlays = () => {
          const points = scene.points();
          const put = (node: HTMLElement | null, point: { x: number; y: number; radius: number }, minimum: number) => {
            if (!node) return;
            const size = Math.max(minimum, point.radius * 2);
            node.style.left = `${point.x - size / 2}px`;
            node.style.top = `${point.y - size / 2}px`;
            node.style.width = `${size}px`;
            node.style.height = `${size}px`;
          };
          put(leverRef.current, points.lever, 56);
          put(capsuleRef.current, points.capsule, 48);
          // 유리 돔 위의 손 닿는 자리 — 눈에 보이지 않고 캡슐을 흔들기만 한다.
          put(domeRef.current, points.dome, 80);
          // "잡고 아래로" 알약은 손잡이 왼쪽에 선다. 오른쪽에 두면 무대 밖으로 밀려난다.
          if (hintRef.current) {
            hintRef.current.style.left = `${points.lever.x - points.lever.radius - 10}px`;
            hintRef.current.style.top = `${points.lever.y}px`;
          }
        };

        /** 첫 프레임이 실제로 그려진 뒤에야 캔버스를 켠다 — 그 전까지는 서버가 그린 포스터다. */
        let painted = false;
        const markPainted = () => {
          if (painted) return;
          painted = true;
          liveRef.current = true;
          note("first frame painted");
          rootRef.current?.setAttribute("data-live", "1");
        };

        const tick = (now: number) => {
          raf = window.requestAnimationFrame(tick);
          if (manual || !onScreen || document.visibilityState === "hidden") { previous = now; return; }
          const delta = previous ? now - previous : 16;
          previous = now;
          const started = performance.now();
          scene.frame(delta);
          stats.current.frames += 1;
          stats.current.totalMs += performance.now() - started;
          placeOverlays();
          markPainted();
        };
        raf = window.requestAnimationFrame(tick);

        // 화면 밖으로 스크롤되면 렌더 루프를 멈춘다. 랜딩 아래쪽을 읽는 동안
        // GPU 를 계속 돌릴 이유가 없다.
        observer = new IntersectionObserver(
          (entries) => { onScreen = entries.some((entry) => entry.isIntersecting); },
          { threshold: 0.01 },
        );
        observer.observe(host);

        onResize = () => { scene.resize(); placeOverlays(); };
        window.addEventListener("resize", onResize);

        // 검증용 손잡이 — rAF 없이도 한 프레임씩 진행시킨다.
        const scope = window as unknown as Record<string, unknown>;
        scope.__gachaFrame = (dtMs?: number) => {
          manual = true;
          const started = performance.now();
          scene.frame(typeof dtMs === "number" ? dtMs : 16);
          stats.current.frames += 1;
          stats.current.totalMs += performance.now() - started;
          placeOverlays();
          markPainted();
          return true;
        };
        scope.__gachaPixels = () => scene.countDrawnPixels();
        // 예산 검증용 — 마지막 프레임의 삼각형 수와 그리기 횟수.
        scope.__gachaInfo = () => scene.stats();
        scope.__gachaResetStats = () => { stats.current = { frames: 0, totalMs: 0 }; return true; };
        scope.__gachaResume = () => { manual = false; return true; };
        scope.__gachaFrameStats = () => ({
          frames: stats.current.frames,
          averageMs: stats.current.frames > 0 ? stats.current.totalMs / stats.current.frames : 0,
        });

        // 방금 만든 장면이라 지금 상태를 한 번 실어 준다.
        scene.resize();
        placeOverlays();
        // 장면이 섰다고 알린다. 아래의 "값 넣기" 훅들이 이 신호에 한 번 더 돌아,
        // 장면을 불러오는 동안 이미 정해져 있던 캡슐 색·단계가 빠짐없이 들어간다.
        setSceneReady((count) => count + 1);
      } catch (error) {
        note(`scene FAILED ${String(error).slice(0, 160)}`);
        if (!disposed) setSceneFailed(true);
      }
    })();

    return () => {
      disposed = true;
      poured.current = false;
      window.cancelAnimationFrame(raf);
      observer?.disconnect();
      if (onResize) window.removeEventListener("resize", onResize);
      const scope = window as unknown as Record<string, unknown>;
      delete scope.__gachaFrame;
      delete scope.__gachaPixels;
      delete scope.__gachaInfo;
      delete scope.__gachaFrameStats;
      delete scope.__gachaResetStats;
      delete scope.__gachaResume;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // 장면은 한 번만 짓는다. 테마·단계·캡슐은 아래 훅들이 살아 있는 장면에 넣어 준다.
  }, [webgl, reducedMotion, note]);

  /* 등장 연출 — 세션당 한 번 ------------------------------------------------
     어두운 가게에 스포트라이트가 딸깍 켜지고, 기계가 내려와 쿵 착지하고, 네온이
     지직거리며 붙고, 캡슐이 쏟아지고, 레버가 반짝인다. 아무 데나 누르거나 아무 키나
     치면 그 자리에서 완성 상태가 된다. */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || sceneReady === 0) return;
    if (reducedMotion || introAlreadySeen()) {
      // 이미 본 사람과 움직임을 줄여 달라는 설정에는 연출을 돌리지 않는다 — 완성된
      // 기계가 그 자리에 선다. data-intro 는 처음부터 없어 건드릴 것이 없다.
      scene.skipIntro();
      return;
    }
    markIntroSeen();
    scene.startIntro();
    markIntroChrome(true);

    const ids: number[] = [];
    const at = (delay: number, run: () => void) => { ids.push(window.setTimeout(run, delay)); };
    at(INTRO_MS.spotlight, () => playLeverClick());
    at(INTRO_MS.land, () => playClunk());
    at(INTRO_MS.neon, () => playNeonBuzz());
    at(INTRO_MS.pour, () => playRumble(0.9));
    at(INTRO_MS.total, () => markIntroChrome(false));

    const skip = () => {
      for (const id of ids) window.clearTimeout(id);
      ids.length = 0;
      scene.skipIntro();
      markIntroChrome(false);
    };
    window.addEventListener("pointerdown", skip, true);
    window.addEventListener("keydown", skip, true);
    return () => {
      for (const id of ids) window.clearTimeout(id);
      window.removeEventListener("pointerdown", skip, true);
      window.removeEventListener("keydown", skip, true);
    };
  }, [markIntroChrome, reducedMotion, sceneReady]);

  /* 살아 있는 장면에 지금 값 넣기 -------------------------------------------
     캡슐이 처음 들어오는 순간만 쏟아 붓는다. 테마를 바꾼 뒤에는 통을 그냥 바꿔 끼운다. */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const pour = capsuleSpecs.length > 0 && !poured.current;
    if (pour) poured.current = true;
    scene.setCapsules(capsuleSpecs, { pour });
  }, [capsuleSpecs, sceneReady]);
  useEffect(() => { sceneRef.current?.setAccent(accent); }, [accent, sceneReady]);
  useEffect(() => { sceneRef.current?.setPrizeCapsule({ color: prizeColor, ring: prizeRing }); }, [prizeColor, prizeRing, sceneReady]);
  useEffect(() => { sceneRef.current?.setStage(stage); }, [stage, sceneReady]);

  /* 뽑힌 상품의 파일을 배출 직후부터 미리 연다 ------------------------------ */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !prize) return;
    const model = modelUrlOf(prize);
    const preview = previewUrlOf(prize);
    if (model) void scene.loadModel(model);
    else if (preview) void scene.loadCard(preview);
    else scene.clearPrizeArt();
  }, [prize, sceneReady]);

  /* 마우스를 따라 아주 조금 기우는 카메라 ----------------------------------- */
  const onStageMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const box = stageRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    sceneRef.current?.setPointer(
      ((event.clientX - box.left) / box.width) * 2 - 1,
      ((event.clientY - box.top) / box.height) * 2 - 1,
    );
  }, []);

  const onStageLeave = useCallback(() => {
    sceneRef.current?.setPointer(0, 0);
    sceneRef.current?.setHovered(false);
  }, []);

  /**
   * 손가락으로 보는 화면에는 마우스가 없다. 기기를 기울이면 그만큼 기계가 돈다 —
   * 이미 허락된 경우에만이다. 허락을 새로 묻는 창은 띄우지 않는다(운영자가 누른 적
   * 없는 권한 창이 첫 화면에 뜨는 것이 더 큰 위화감이다).
   */
  useEffect(() => {
    if (reducedMotion || typeof window === "undefined") return;
    const orientation = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: unknown } }).DeviceOrientationEvent;
    // requestPermission 이 있는 기기(iOS)는 사용자가 직접 허락해야 한다 — 묻지 않고 지나간다.
    if (!orientation || typeof orientation.requestPermission === "function") return;
    const onTilt = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || event.beta === null) return;
      // gamma 는 좌우(-90~90), beta 는 앞뒤. 스무 도쯤이면 끝까지 기운 것으로 본다.
      sceneRef.current?.setPointer(
        Math.max(-1, Math.min(1, event.gamma / 20)),
        Math.max(-1, Math.min(1, (event.beta - 50) / 25)),
      );
    };
    window.addEventListener("deviceorientation", onTilt);
    return () => window.removeEventListener("deviceorientation", onTilt);
  }, [reducedMotion]);

  /* 유리 돔 — 손을 올리면 더미가 들썩이고, 두드리면 한 알이 튄다 ------------- */
  const onDomeEnter = useCallback(() => {
    sceneRef.current?.setDomeHover(true);
    // 유리를 손끝으로 스치는 소리. 지나갈 때마다 울리지 않도록 사이를 둔다.
    const now = Date.now();
    if (!reducedMotion && now - lastGlassTap.current > 1200) {
      lastGlassTap.current = now;
      playCapsuleTap(0.55);
    }
  }, [reducedMotion]);

  const onDomeLeave = useCallback(() => { sceneRef.current?.setDomeHover(false); }, []);

  const onDomeTap = useCallback(() => {
    sceneRef.current?.tapDome();
    if (!reducedMotion) playCapsuleTap(1.1);
  }, [reducedMotion]);

  /* 레버 — 손이 올라오면 손잡이가 달아오르고 "잡고 아래로" 가 뜬다 ----------- */
  const setLeverHover = useCallback((hovered: boolean) => {
    sceneRef.current?.setLeverHover(hovered);
    sceneRef.current?.setHovered(hovered);
    const node = rootRef.current;
    if (!node) return;
    if (hovered) node.dataset.lever = "1";
    else delete node.dataset.lever;
  }, []);

  /* 연출 -------------------------------------------------------------------- */
  const pickPrize = useCallback((slug?: string): GachaListing | null => {
    if (slug) {
      const wanted = drawableListings(listings).find((row) => row.slug === slug);
      if (wanted) return wanted;
    }
    const result = drawFrom(pool, readDrawn(theme));
    if (!result) return null;
    writeDrawn(theme, result.drawn);
    setDrawn(result.drawn);
    return result.listing;
  }, [listings, pool, theme]);

  const turn = useCallback(() => {
    if (stage !== "idle" || pool.length === 0) return;
    if (!muted && !reducedMotion) primeGachaSound();
    const drawnPrize = pickPrize();
    if (!drawnPrize) return;
    clearTimers();
    setPrize(drawnPrize);
    setClaim({ kind: "idle" });
    setClunked(false);
    setStage("pull");
    const t = reducedMotion ? TIMING.reduced : TIMING.full;
    // 레버가 내려갔다 튕겨 올라오는 동안의 래칫.
    if (!reducedMotion) playCrankRatchet(10, 0.62);
    later(t.shake, () => { setStage("shake"); if (!reducedMotion) playRumble(t.rumbleSeconds); });
    later(t.impact, () => setStage("impact"));
    later(t.clunk, () => { setClunked(true); if (!reducedMotion) playClunk(); });
    t.bounces.forEach((delay, index) => later(delay, () => { if (!reducedMotion) playBounce(index === 0 ? 0.8 : 0.45); }));
    later(t.capsule, () => { setStage("capsule"); setClunked(false); });
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
    setClunked(false);
    sceneRef.current?.setLeverPull(0);
    leverDrag.current = { active: false, startY: 0 };
    scrollFired.current = progressRef.current >= SCROLL_PULL.to;
  }, [clearTimers]);

  const chooseTheme = useCallback((next: ThemeId) => {
    clearTimers();
    setTheme(next);
    setDrawn(readDrawn(next));
    setStage("idle");
    setPrize(null);
    setClaim({ kind: "idle" });
    setClunked(false);
    sceneRef.current?.setLeverPull(0);
  }, [clearTimers]);

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

  /* 레버 당기기 -------------------------------------------------------------
     아래로 끌면 손잡이가 손을 따라 내려오고, 60px 을 넘기는 순간 발동한다.
     그냥 누르거나 엔터·스페이스를 쳐도 같은 것이 일어난다. */
  const onLeverDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (stage !== "idle") return;
    leverDrag.current = { active: true, startY: event.clientY };
    sceneRef.current?.setLeverDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [stage]);

  const onLeverMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = leverDrag.current;
    if (!drag.active || stage !== "idle") return;
    const pulled = event.clientY - drag.startY;
    sceneRef.current?.setLeverPull(Math.max(0, pulled) / LEVER_TRAVEL_PIXELS);
    if (pulled >= LEVER_TRIGGER_PIXELS) {
      drag.active = false;
      sceneRef.current?.setLeverDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      turn();
    }
  }, [stage, turn]);

  const onLeverUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    leverDrag.current.active = false;
    sceneRef.current?.setLeverDragging(false);
    // 끝까지 당기지 못했으면 손잡이가 스스로 올라간다.
    if (stage === "idle") sceneRef.current?.setLeverPull(0);
  }, [stage]);

  // 끌어서 당겨 이미 발동했으면 단계가 "pull" 이라 turn 이 스스로 물러난다 —
  // 같은 동작으로 두 번 뽑히지 않는다. 끝까지 못 당기고 놓은 뒤의 클릭은 그냥 뽑기다.
  const onLeverClick = useCallback(() => { turn(); }, [turn]);

  /* 화면 없이 단계를 넘기는 손잡이 ------------------------------------------ */
  useEffect(() => {
    const scope = window as unknown as Record<string, unknown>;
    scope.__gachaStep = (next: string, slug?: string) => {
      if (!STAGES.includes(next as Stage)) return false;
      clearTimers();
      const wanted = next as Stage;
      if (wanted === "idle") {
        setPrize(null);
        setStage("idle");
        setClunked(false);
        sceneRef.current?.setLeverPull(0);
        return true;
      }
      setPrize((current) => (current && !slug ? current : pickPrize(slug)));
      setClunked(wanted === "impact");
      setStage(wanted);
      return true;
    };
    scope.__gachaSoundCounts = () => soundCallCounts();
    // 등장 연출을 처음부터 다시. 검증이 그 네 프레임을 찍으려면 시작점을 잡을 수 있어야 한다.
    scope.__gachaIntro = () => {
      const scene = sceneRef.current;
      if (!scene) return false;
      scene.startIntro();
      markIntroChrome(scene.introRunning());
      // 다시 돌린 연출도 제 시간에 끝나야 안내 한 줄이 원래처럼 돌아온다.
      window.setTimeout(() => markIntroChrome(false), INTRO_MS.total);
      return true;
    };
    return () => {
      delete scope.__gachaStep;
      delete scope.__gachaSoundCounts;
      delete scope.__gachaIntro;
    };
  }, [clearTimers, markIntroChrome, pickPrize]);

  /* 3D 가 오기 전의 단추 자리 --------------------------------------------------
     포스터(SVG)는 viewBox 를 세로에 맞춰(meet) 가운데 선다. 그 규칙을 그대로 계산해
     레버·캡슐·돔 단추를 포스터의 손잡이 위에 놓는다. 첫 프레임이 그려지면 장면의
     placeOverlays 가 이어받는다. */
  useEffect(() => {
    if (!webgl) return;
    const place = () => {
      if (liveRef.current) return;
      const stage = stageRef.current;
      // 가로·세로 포스터 중 지금 보이는 쪽.
      const poster = stage
        ? Array.from(stage.querySelectorAll<SVGSVGElement>(".gc3-poster")).find((node) => node.getClientRects().length > 0)
        : undefined;
      if (!stage || !poster) return;
      const [vbX, vbY, vbW, vbH] = (poster.dataset.viewbox ?? "0 12 660 646").split(" ").map(Number);
      const box = poster.getBoundingClientRect();
      const stageBox = stage.getBoundingClientRect();
      const scale = Math.min(box.width / vbW, box.height / vbH);
      const offsetX = box.left - stageBox.left + (box.width - vbW * scale) / 2;
      const offsetY = box.top - stageBox.top + (box.height - vbH * scale) / 2;
      const put = (node: HTMLElement | null, point: { x: number; y: number; radius: number }, minimum: number) => {
        if (!node) return;
        const size = Math.max(minimum, point.radius * 2 * scale);
        const x = offsetX + (point.x - vbX) * scale;
        const y = offsetY + (point.y - vbY) * scale;
        node.style.left = `${x - size / 2}px`;
        node.style.top = `${y - size / 2}px`;
        node.style.width = `${size}px`;
        node.style.height = `${size}px`;
      };
      put(leverRef.current, POSTER_POINTS.lever, 56);
      put(capsuleRef.current, POSTER_POINTS.capsule, 48);
      put(domeRef.current, POSTER_POINTS.dome, 80);
      if (hintRef.current) {
        hintRef.current.style.left = `${offsetX + (POSTER_POINTS.lever.x - vbX) * scale - POSTER_POINTS.lever.radius * scale - 10}px`;
        hintRef.current.style.top = `${offsetY + (POSTER_POINTS.lever.y - vbY) * scale}px`;
      }
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [webgl]);

  /* 스크롤이 곧 연출이다 -----------------------------------------------------
     긴 트랙을 내려가는 동안 무대는 화면에 붙어 있고, 진행도(0~1)가 카메라를 옮긴다.
     0.5~0.6 사이에서는 스크롤이 레버를 당기고 끝에 닿으면 뽑힌다. 글줄은 장면마다
     제 구간에서만 떠오른다. 값은 매 프레임이 아니라 스크롤 이벤트마다 한 번 계산한다. */
  useEffect(() => {
    stageLive.current = stage;
    turnLive.current = turn;
    refreshFilm.current();
  }, [stage, turn]);
  useEffect(() => {
    if (!webgl) return;
    let raf = 0;
    const ramp = (p: number, a: number, b: number, c: number, d: number) => {
      if (p <= a || p >= d) return 0;
      if (p < b) return (p - a) / Math.max(1e-6, b - a);
      if (p <= c) return 1;
      return 1 - (p - c) / Math.max(1e-6, d - c);
    };
    const show = (node: HTMLElement | null, amount: number, rise = 18) => {
      if (!node) return;
      const k = Math.min(1, Math.max(0, amount));
      node.style.opacity = k.toFixed(3);
      node.style.transform = `translate(var(--gc-beat-x, 0px), ${((1 - k) * rise).toFixed(1)}px)`;
      node.style.visibility = k > 0.01 ? "visible" : "hidden";
    };
    const update = () => {
      raf = 0;
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const total = Math.max(1, rect.height - window.innerHeight);
      const p = Math.min(1, Math.max(0, -rect.top / total));
      progressRef.current = p;
      rootRef.current?.style.setProperty("--gc-p", p.toFixed(4));
      const scene = sceneRef.current;
      if (scene) {
        scene.setScroll(p);
        // 내리기 시작했으면 등장 연출은 그 자리에서 끝난다 — 두 연출이 겹치지 않는다.
        if (p > 0.02 && scene.introRunning()) { scene.skipIntro(); markIntroChrome(false); }
      }
      show(beatHeadRef.current, ramp(p, -1, 0, 0.06, 0.16));
      show(beatScrollRef.current, 1 - p / 0.05, 0);
      show(beatInsideRef.current, ramp(p, 0.17, 0.25, 0.4, 0.47));
      const idle = stageLive.current === "idle";
      show(beatLeverRef.current, idle ? ramp(p, 0.43, 0.5, 0.6, 0.66) : 0);
      // 스크롤로 당기는 레버.
      if (p < SCROLL_PULL.from) {
        if (scrollFired.current) scrollFired.current = false;
        if (idle && scene && scene.leverPull() > 0 && !leverDrag.current.active) scene.setLeverPull(0);
      } else if (idle && !scrollFired.current && !leverDrag.current.active) {
        const k = (p - SCROLL_PULL.from) / (SCROLL_PULL.to - SCROLL_PULL.from);
        if (k >= 1) {
          scrollFired.current = true;
          scene?.setLeverPull(1);
          turnLive.current();
        } else {
          scene?.setLeverPull(k);
        }
      }
    };
    const onScroll = () => { if (!raf) raf = window.requestAnimationFrame(update); };
    refreshFilm.current = onScroll;
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      refreshFilm.current = () => {};
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
    // 장면이 서면 한 번 더 돌아 지금 스크롤 자리를 실어 준다.
  }, [webgl, sceneReady, markIntroChrome]);

  /* 그리기 ------------------------------------------------------------------ */

  if (!webgl) return <CapsuleMachine />;

  // 기계는 언제나 서 있다. 카탈로그가 아직이거나 실패했으면 옆 판에 한 줄만 붙는다.
  const stocked = drawableListings(listings).length > 0;
  const notice = load === "failed"
    ? "지금은 머신 안을 불러오지 못했습니다."
    : load === "ready" && !stocked
      ? "지금 머신에 들어 있는 에셋이 없습니다."
      : null;

  const canOpen = stage === "capsule";
  const capsuleShown = stage === "impact" || stage === "capsule" || stage === "wobble" || stage === "burst";

  return (
    <div
      className="gc gc3 gc-film"
      ref={rootRef}
      data-stage={stage}
      data-reduced={reducedMotion || undefined}
      style={{ "--gc-accent": accent, "--gc-prize": prizeColor, "--gc-grade": prizeRing } as CSSProperties}
    >
      {/* 긴 트랙. 내려가는 동안 무대는 화면에 붙어 있고 스크롤이 카메라를 옮긴다. */}
      <div className="gc-film-track" ref={trackRef}>
        <div className="gc-film-sticky">
          <div
            className="gc3-stage"
            ref={stageRef}
            onPointerMove={onStageMove}
            onPointerLeave={onStageLeave}
          >
            {/* 서버가 그려 둔 기계. 3D 가 첫 프레임을 낸 뒤 그 위로 캔버스가 겹쳐 켜지고,
                WebGL 이 실패하면 이 그림이 그대로 남는다. */}
            <GachaPoster />
            <GachaPoster tall />
            <div className="gc3-canvas" ref={hostRef} aria-hidden="true" />

            {/* 유리 돔 위의 손 닿는 자리. 보이지 않고, 눌러도 뽑히지 않는다. */}
            <div
              className="gc3-dome"
              ref={domeRef}
              aria-hidden="true"
              onPointerEnter={onDomeEnter}
              onPointerLeave={onDomeLeave}
              onPointerDown={onDomeTap}
            />

            {/* 레버 손잡이 위에 투명하게 얹힌 진짜 단추 — 끌어내려도 되고 그냥 눌러도 된다. */}
            <button
              type="button"
              className="gc3-lever"
              ref={leverRef}
              onPointerDown={onLeverDown}
              onPointerMove={onLeverMove}
              onPointerUp={onLeverUp}
              onPointerCancel={onLeverUp}
              onFocus={() => setLeverHover(true)}
              onBlur={() => setLeverHover(false)}
              onMouseEnter={() => setLeverHover(true)}
              onMouseLeave={() => setLeverHover(false)}
              onClick={onLeverClick}
              disabled={stage !== "idle" || !stocked}
              aria-label="레버를 당겨 에셋 뽑기"
            />
            <p className="gc3-grip" ref={hintRef} aria-hidden="true">잡고 아래로</p>

            {/* 배출구에 떨어진 캡슐 — 눌러서 연다. */}
            <button
              type="button"
              className="gc3-capsule"
              ref={capsuleRef}
              onClick={openCapsule}
              disabled={!canOpen}
              hidden={!capsuleShown}
              aria-label={canOpen ? "떨어진 캡슐 — 눌러서 열기" : "캡슐이 나오는 중입니다"}
            />
            {stage === "capsule" ? <p className="gc3-hint gc3-hint-low" aria-hidden="true"><b>눌러서 열기</b></p> : null}

            {clunked ? (
              <>
                <span className="gc-flash" aria-hidden="true" />
                <strong className="gc-impact" aria-hidden="true">Clunk!</strong>
              </>
            ) : null}

            {/* 장면마다 떠오르는 글줄. 자리는 스크롤 진행도가 정한다. */}
            <div className="gc-beat gc-beat-head" ref={beatHeadRef}>
              <span className="cv5-badge">✦ 게임 제작을 위한 <b>단 하나의 AI 슈퍼앱</b></span>
              <h1 id="home-heading">게임 에셋 <em>뽑기</em></h1>
              <p>레버를 당기면 마켓의 에셋이 캡슐로 떨어집니다</p>
            </div>
            <p className="gc-beat gc-beat-scroll" ref={beatScrollRef} aria-hidden="true">내려서 시작<i>↓</i></p>
            <div className="gc-beat gc-beat-inside" ref={beatInsideRef} aria-hidden="true">
              <b>{stocked ? `${drawableListings(listings).length}개` : "실제"}</b>
              <span>마켓에 올라온 에셋이 그대로 들어 있습니다</span>
              <small>3D 모델 · 스프라이트 시트 · 이어붙는 텍스처</small>
            </div>
            <div className="gc-beat gc-beat-lever" ref={beatLeverRef} aria-hidden="true">
              <b>레버를 당기세요</b>
              <small>계속 내리면 당겨집니다 · 손으로 끌어도 됩니다</small>
            </div>

            {stage === "result" && prize ? (
              <div className="gc-film-prize">
                <PrizeCard
                  listing={prize}
                  beta={beta}
                  authenticated={authenticated}
                  claim={claim}
                  loginHref={LOGIN_HREF}
                  remaining={remaining}
                  showArt={false}
                  onClaim={() => { void collect(); }}
                  onAgain={again}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {diag ? <pre className="gc-diag" aria-hidden="true">{diag.join("\n")}</pre> : null}

      <div className="gc3-below">
        <div className="gc3-side">
          <div className="gc3-panel">
            {creditLine ? <p className="gc3-coin-line">{creditLine}</p> : null}
            {notice ? (
              <p className="gc3-notice" role="status">
                {notice} <Link href="/marketplace" prefetch={false}>마켓에서 직접 확인하기</Link>
              </p>
            ) : null}
            {stocked ? (
              <>
                <div className="gc3-dial" role="group" aria-label="테마 다이얼">
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
                <p className="gc3-remaining">이번 바퀴 남은 개수 <b>{remaining}</b></p>
              </>
            ) : null}
            <ul className="gc3-legend">
              {(["S", "A", "B", "C"] as const).map((letter) => (
                <li key={letter}><i style={{ background: GRADE_COLORS[letter] }} />{letter}</li>
              ))}
            </ul>
            <p className="gc3-rule">{GRADE_RULE}</p>
          </div>
        </div>

        {/* 이 기계에 실제로 들어 있는 것들. 지어낸 최근 뽑기 기록이 아니라, 지금 다이얼에
            걸린 상품 목록 그대로다. */}
        {shelf.length > 0 ? (
          <section className="gc3-shelf" aria-labelledby="gc3-shelf-heading">
            <h3 id="gc3-shelf-heading">이 기계에 든 것</h3>
            <div className="gc3-shelf-rail">
              {shelf.map((listing) => <ShelfCard key={listing.id} listing={listing} />)}
            </div>
          </section>
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
    </div>
  );
}
