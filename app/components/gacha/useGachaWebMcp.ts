"use client";

import { useEffect, useRef, type RefObject } from "react";

import { GRADE_RULE_EN, factsOf } from "../../webmcp/catalog";
import {
  asRecord,
  enumProp,
  objectSchema,
  registerTools,
  waitFor,
  type WebMcpTool,
} from "../../webmcp/register";
import {
  GACHA_THEMES,
  GRADE_RULE,
  themeById,
  type GachaListing,
  type ThemeId,
} from "./gacha-catalog";
import { SCROLL_PULL } from "./gacha-scroll";
import type { ClaimState } from "./PrizeCard";

/**
 * 사람과 에이전트가 같은 기계를 쓴다.
 *
 * 여기 등록되는 도구들은 새 API를 부르지 않는다 — 화면이 이미 가지고 있는 손잡이
 * (turn·openCapsule·again·chooseTheme·collect)를 그대로 부른다. 그래서 에이전트가
 * 레버를 당기면 사람이 보고 있는 그 기계가 돌아가고, 화면은 그 장면 앞으로 스스로
 * 스크롤한다. 도구가 돌려주는 값은 전부 카탈로그가 잰 값이다.
 */

/** 화면이 훅에게 넘겨주는 지금 상태와 손잡이. 매 렌더 갱신되고, 도구는 ref 로만 읽는다. */
export type GachaWebMcpInput = {
  /** 스크롤 연출의 트랙. 도구가 화면을 그 장면 앞으로 옮길 때 쓴다. */
  trackRef: RefObject<HTMLDivElement | null>;
  stage: string;
  theme: ThemeId;
  prize: GachaListing | null;
  pool: readonly GachaListing[];
  counts: Record<ThemeId, number>;
  remaining: number;
  authenticated: boolean;
  claim: ClaimState;
  beta: boolean;
  loginHref: string;
  turn: () => void;
  openCapsule: () => void;
  again: () => void;
  chooseTheme: (next: ThemeId) => void;
  collect: () => Promise<void>;
};

const THEME_IDS: readonly ThemeId[] = GACHA_THEMES.map((theme) => theme.id);

/** 레버가 화면 한가운데 서는 자리. 스크롤이 레버를 당기기 시작하는 지점 바로 앞이다. */
const LEVER_SHOT = (SCROLL_PULL.from + SCROLL_PULL.to) / 2 - 0.03;

export function useGachaWebMcp(input: GachaWebMcpInput): void {
  const live = useRef(input);
  // Refreshed after every commit rather than during render: the tools read this ref from
  // event handlers, which always run after the commit that set it.
  useEffect(() => { live.current = input; });

  useEffect(() => {
    const controller = new AbortController();

    /** 무대가 그 장면 앞에 서도록 화면을 옮긴다. 사람이 에이전트가 한 일을 본다. */
    const scrollToShot = (p: number) => {
      const track = live.current.trackRef.current;
      if (!track || typeof window === "undefined") return null;
      const box = track.getBoundingClientRect();
      const top = box.top + window.scrollY;
      const travel = Math.max(1, box.height - window.innerHeight);
      const y = top + p * travel;
      window.scrollTo({ top: y, behavior: "smooth" });
      return Math.round(y);
    };

    const prizeReport = (listing: GachaListing | null) => {
      if (!listing) return null;
      const facts = factsOf(listing);
      return {
        ...facts,
        gradeRule: GRADE_RULE_EN,
        gradeRule_ko: GRADE_RULE,
        priceLabel: live.current.beta && facts.priceWon > 0
          ? "free during the open beta"
          : facts.priceWon === 0 ? "free" : `${facts.priceWon.toLocaleString("en-US")} KRW`,
        priceLabel_ko: live.current.beta && facts.priceWon > 0
          ? "베타 무료"
          : facts.priceWon === 0 ? "무료" : `${facts.priceWon.toLocaleString("ko-KR")}원`,
      };
    };

    const state = () => {
      const now = live.current;
      return {
        ok: true as const,
        stage: now.stage,
        theme: now.theme,
        themeName_ko: themeById(now.theme).name,
        inMachine: now.pool.length,
        remainingThisRound: now.remaining,
        signedIn: now.authenticated,
        beta: now.beta,
        prize: prizeReport(now.prize),
        claim: now.claim.kind,
        gradeRule: GRADE_RULE_EN,
        gradeRule_ko: GRADE_RULE,
      };
    };

    const tools: WebMcpTool[] = [
      {
        name: "gacha_state",
        description:
          "Read the gacha machine on this page: which stage the animation is in, which theme the dial is set to, how many assets are left in this round, and the drawn prize's measured facts when there is one.",
        inputSchema: objectSchema(),
        execute: () => state(),
      },
      {
        name: "gacha_list_themes",
        description:
          "List the dial's themes and how many published assets each one actually holds. The counts are the length of the catalogue list, not a claim.",
        inputSchema: objectSchema(),
        execute: () => ({
          ok: true,
          current: live.current.theme,
          themes: GACHA_THEMES.map((theme) => ({
            id: theme.id,
            name_ko: theme.name,
            count: live.current.counts[theme.id] ?? 0,
          })),
        }),
      },
      {
        name: "gacha_set_theme",
        description: "Turn the dial to one theme. The machine resets to idle and refills with that theme's assets.",
        inputSchema: objectSchema({ theme: enumProp("Which theme the dial should point at.", THEME_IDS) }, ["theme"]),
        execute: async (raw) => {
          const wanted = String(asRecord(raw).theme ?? "");
          if (!THEME_IDS.includes(wanted as ThemeId)) {
            return {
              ok: false,
              error: `theme must be one of ${THEME_IDS.join(", ")}.`,
              error_ko: `theme 은 ${THEME_IDS.join(", ")} 중 하나여야 합니다.`,
            };
          }
          live.current.chooseTheme(wanted as ThemeId);
          await waitFor(() => live.current.theme === wanted, 3_000);
          return {
            ok: true,
            theme: wanted,
            themeName_ko: themeById(wanted as ThemeId).name,
            count: live.current.counts[wanted as ThemeId] ?? 0,
          };
        },
      },
      {
        name: "gacha_pull",
        description:
          "Pull the lever. The page scrolls to the lever shot first so the human watches it happen, then the machine shakes and a capsule drops. Returns the drawn asset's measured facts, its grade, and the rule that produced the grade.",
        inputSchema: objectSchema(),
        execute: async () => {
          const now = live.current;
          if (now.pool.length === 0) {
            return {
              ok: false,
              error: "There is nothing in the machine on this theme.",
              error_ko: "지금 이 다이얼에 들어 있는 에셋이 없습니다.",
            };
          }
          if (now.stage !== "idle") {
            return {
              ok: false,
              error: `The machine is still in the '${now.stage}' stage. Call gacha_again first, then pull.`,
              error_ko: `기계가 아직 '${now.stage}' 단계입니다. gacha_again 으로 되돌린 뒤 당기세요.`,
            };
          }
          const scrolledTo = scrollToShot(LEVER_SHOT);
          await new Promise((resolve) => setTimeout(resolve, 450));
          live.current.turn();
          const dropped = await waitFor(() => live.current.stage === "capsule", 12_000);
          return {
            ok: dropped,
            stage: live.current.stage,
            scrolledTo,
            shot: `scrolled the film to ${LEVER_SHOT.toFixed(2)} — the frame where the lever fills the screen`,
            prize: prizeReport(live.current.prize),
            ...(dropped
              ? { next: "Call gacha_open to crack the capsule." }
              : {
                error: "No capsule landed within 12 seconds. Call gacha_state to see which stage the machine is in.",
                error_ko: "12초 안에 캡슐이 떨어지지 않았습니다. gacha_state 로 단계를 확인하세요.",
              }),
          };
        },
      },
      {
        name: "gacha_open",
        description: "Open the capsule that dropped into the tray. Waits until the prize card is on screen, then returns what came out.",
        inputSchema: objectSchema(),
        execute: async () => {
          if (live.current.stage !== "capsule") {
            return {
              ok: false,
              error: `There is no capsule to open. The machine is in the '${live.current.stage}' stage.`,
              error_ko: `열 수 있는 캡슐이 없습니다. 지금 단계는 '${live.current.stage}' 입니다.`,
            };
          }
          live.current.openCapsule();
          const opened = await waitFor(() => live.current.stage === "result", 12_000);
          return {
            ok: opened,
            stage: live.current.stage,
            prize: prizeReport(live.current.prize),
            ...(opened ? {} : {
              error: "The capsule is still opening. Call gacha_state again in a moment.",
              error_ko: "캡슐이 열리는 중입니다. gacha_state 로 다시 확인하세요.",
            }),
          };
        },
      },
      {
        name: "gacha_again",
        description: "Reset the machine to idle so the lever can be pulled again.",
        inputSchema: objectSchema(),
        execute: async () => {
          live.current.again();
          await waitFor(() => live.current.stage === "idle", 3_000);
          return { ok: true, stage: live.current.stage, remainingThisRound: live.current.remaining };
        },
      },
      {
        name: "gacha_claim",
        description:
          "Receive the drawn file. Signed in, this runs the same checkout the page's receive button runs and the browser starts the download. Signed out, it returns the sign-up URL — an agent never signs in for the human.",
        inputSchema: objectSchema(),
        execute: async () => {
          const now = live.current;
          if (!now.prize) return { ok: false, error: "Nothing has been drawn yet.", error_ko: "아직 뽑은 것이 없습니다." };
          const facts = factsOf(now.prize);
          if (!now.authenticated) {
            return {
              ok: false,
              needsSignIn: true,
              signupUrl: new URL(now.loginHref, window.location.origin).toString(),
              asset: facts,
              message: "Sign in to receive the file. It costs nothing during the open beta.",
              message_ko: "로그인하면 받을 수 있습니다. 베타 기간이라 값은 0원입니다.",
            };
          }
          await now.collect();
          await waitFor(() => live.current.claim.kind === "done" || live.current.claim.kind === "failed", 20_000);
          const claim = live.current.claim;
          return {
            ok: claim.kind === "done",
            outcome: claim.kind,
            message: claim.kind === "done"
              ? "The download has started in the human's browser."
              : "The file could not be received; the sentence the screen shows is in message_ko.",
            message_ko: "message" in claim ? claim.message : "받기를 시작했습니다.",
            asset: facts,
          };
        },
      },
    ];

    void registerTools(tools, controller.signal, "capsule machine");
    return () => controller.abort();
  }, []);
}
