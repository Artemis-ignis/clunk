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
import { CapsuleMachine } from "./CapsuleMachine";
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
  const webgl = webglSupported && !sceneFailed;

  const hostRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const leverRef = useRef<HTMLButtonElement | null>(null);
  const capsuleRef = useRef<HTMLButtonElement | null>(null);
  const coinRef = useRef<HTMLSpanElement | null>(null);
  const sceneRef = useRef<GachaScene | null>(null);
  const timers = useRef<number[]>([]);
  const leverDrag = useRef({ active: false, startY: 0 });
  const stats = useRef({ frames: 0, totalMs: 0 });
  /** 캡슐을 이미 쏟아 부었는지. 카탈로그가 오는 그 한 번만 붓는다. */
  const poured = useRef(false);

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

  /** 돔에 채울 캡슐. 자리 수는 최대치이고, 장면이 기기에 맞게 앞에서부터 잘라 쓴다. */
  const capsuleSpecs = useMemo(
    () => domeCapsules(pool, 40).map((capsule) => ({ color: capsule.color, ring: capsule.ring })),
    [pool],
  );

  const creditLine = authenticated
    ? credits === null
      ? "크레딧을 확인하는 중입니다"
      : `크레딧 ${credits.toLocaleString("ko-KR")}개 · 베타 기간에는 차감되지 않습니다`
    : "베타 기간 무료 · 동전 필요 없음";

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

    void (async () => {
      try {
        const sceneModule = await import("./gacha-scene");
        if (disposed) return;
        const quality = window.matchMedia("(max-width: 720px)").matches
          ? sceneModule.MOBILE_QUALITY
          : sceneModule.DESKTOP_QUALITY;
        const scene = sceneModule.createGachaScene(host, { quality, reducedMotion });
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
          if (coinRef.current) {
            coinRef.current.style.left = `${points.coin.x}px`;
            coinRef.current.style.top = `${points.coin.y + points.coin.radius + 6}px`;
          }
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
          return true;
        };
        scope.__gachaPixels = () => scene.countDrawnPixels();
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
      } catch {
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
      delete scope.__gachaFrameStats;
      delete scope.__gachaResetStats;
      delete scope.__gachaResume;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // 장면은 한 번만 짓는다. 테마·단계·캡슐은 아래 훅들이 살아 있는 장면에 넣어 준다.
  }, [webgl, reducedMotion]);

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

  const onStageLeave = useCallback(() => { sceneRef.current?.setPointer(0, 0); }, []);

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
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [stage]);

  const onLeverMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = leverDrag.current;
    if (!drag.active || stage !== "idle") return;
    const pulled = event.clientY - drag.startY;
    sceneRef.current?.setLeverPull(Math.max(0, pulled) / LEVER_TRAVEL_PIXELS);
    if (pulled >= LEVER_TRIGGER_PIXELS) {
      drag.active = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      turn();
    }
  }, [stage, turn]);

  const onLeverUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    leverDrag.current.active = false;
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
      className="gc gc3"
      ref={rootRef}
      data-stage={stage}
      data-reduced={reducedMotion || undefined}
      style={{ "--gc-accent": accent, "--gc-prize": prizeColor, "--gc-grade": prizeRing } as CSSProperties}
    >
      <div className="gc3-row">
        <div
          className="gc3-stage"
          ref={stageRef}
          onPointerMove={onStageMove}
          onPointerLeave={onStageLeave}
          onPointerEnter={() => sceneRef.current?.setHovered(true)}
        >
          <div className="gc3-canvas" ref={hostRef} aria-hidden="true" />

          {/* 레버 손잡이 위에 투명하게 얹힌 진짜 단추 — 끌어내려도 되고 그냥 눌러도 된다. */}
          <button
            type="button"
            className="gc3-lever"
            ref={leverRef}
            onPointerDown={onLeverDown}
            onPointerMove={onLeverMove}
            onPointerUp={onLeverUp}
            onPointerCancel={onLeverUp}
            onFocus={() => sceneRef.current?.setHovered(true)}
            onBlur={() => sceneRef.current?.setHovered(false)}
            onMouseEnter={() => sceneRef.current?.setHovered(true)}
            onMouseLeave={() => sceneRef.current?.setHovered(false)}
            onClick={onLeverClick}
            disabled={stage !== "idle" || !stocked}
            aria-label="레버를 당겨 에셋 뽑기"
          />

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

          <span className="gc3-coin" ref={coinRef}>베타 무료</span>

          {stage === "idle" ? (
            <p className="gc3-hint" aria-hidden="true"><b>레버를 당기세요</b><i>↓</i></p>
          ) : null}
          {stage === "capsule" ? <p className="gc3-hint gc3-hint-low" aria-hidden="true"><b>눌러서 열기</b></p> : null}

          {clunked ? (
            <>
              <span className="gc-flash" aria-hidden="true" />
              <strong className="gc-impact" aria-hidden="true">Clunk!</strong>
            </>
          ) : null}
        </div>

        <div className="gc3-side">
          {stage === "result" && prize ? (
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
          ) : (
            <div className="gc3-panel">
              <p className="gc3-coin-line">{creditLine}</p>
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
          )}
        </div>
      </div>

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
