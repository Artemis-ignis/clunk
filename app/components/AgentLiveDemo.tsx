"use client";

import { useEffect, useRef, useState } from "react";
import { EmbeddedGlbViewer } from "./review/EmbeddedGlbViewer";

/**
 * Landing section-03 live scene: when the section lands in view the conversation
 * types itself out, the tool steps check off, the model is revealed behind a
 * "making" veil, an inspection sweep passes over it, and the measured verdict lands.
 *
 * 2026-09-02: this used to be its own three.js renderer that streamed triangles in,
 * flashed wireframe at 9 Hz during the "scan", spun on its own, and restarted from
 * zero every thirteen seconds. The operator read that as a model that flickers and
 * cannot be touched. The stage is now the same interactive viewer the shop uses —
 * drag to turn, wheel to zoom, the shadow fixes included — and the timeline plays
 * once. What the agent made stays made.
 *
 * Every number below is this repository's own `npm run clunk -- inspect --profile web`
 * output for that exact file: 2,456 triangles, 31 draw calls, 214,584 bytes,
 * score 100, hard blockers 0. prefers-reduced-motion renders the finished state.
 */

const USER_TEXT = "농장 게임에 쓸 시장 노점 하나 만들어줘.";
const AGENT_TEXT = "게임에 넣어도 가벼운 크기로 만들고, 바로 검사까지 돌리겠습니다.";
const STEPS = [
  { tool: "clunk_asset_author", note: "시장 노점 만들기 · 폴리곤 2,456개" },
  { tool: "clunk_asset_inspect", note: "재질 11개 · 실제 크기 2.44 m · 문제 0건" },
  { tool: "clunk_optimize", note: "안전한 정리만, 원본은 그대로" },
  { tool: "clunk_passport", note: "만든 과정을 검사 증명서로 남김" },
] as const;

const GLB_URL = "/market/cozy-farm-set-vol1/market-stall.m1.clunk-optimized.glb";

// timeline (seconds), played once per visit
const T_USER = 0.4;
const USER_CPS = 17;
const T_AGENT = T_USER + USER_TEXT.length / USER_CPS + 0.5;
const AGENT_CPS = 20;
const T_STEP0 = T_AGENT + AGENT_TEXT.length / AGENT_CPS + 0.4;
const STEP_GAP = 2.3;
const BUILD_START = T_STEP0;
const BUILD_SECONDS = 3.4;
const SCAN_START = T_STEP0 + STEP_GAP;
const SCAN_SECONDS = 1.1;
const T_BADGE = T_STEP0 + STEP_GAP * 3 + 0.5;
const T_END = T_BADGE + 0.5;

type SceneState = {
  userChars: number;
  agentChars: number;
  checked: number;
  buildProgress: number;
  scanning: boolean;
  badge: boolean;
};

function stateAt(t: number): SceneState {
  return {
    userChars: Math.max(0, Math.min(USER_TEXT.length, Math.floor((t - T_USER) * USER_CPS))),
    agentChars: Math.max(0, Math.min(AGENT_TEXT.length, Math.floor((t - T_AGENT) * AGENT_CPS))),
    checked: Math.max(0, Math.min(STEPS.length, Math.floor((t - T_STEP0) / STEP_GAP) + (t >= T_STEP0 ? 1 : 0))),
    buildProgress: Math.max(0, Math.min(1, (t - BUILD_START) / BUILD_SECONDS)),
    scanning: t >= SCAN_START && t < SCAN_START + SCAN_SECONDS,
    badge: t >= T_BADGE,
  };
}

const FINISHED = stateAt(T_END + 1);

export function AgentLiveDemo() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [scene, setScene] = useState<SceneState>(stateAt(0));
  const [reduced, setReduced] = useState(false);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setReduced(true);
      setScene(FINISHED);
    }
    const root = rootRef.current;
    if (!root) return;

    let frameHandle = 0;
    let startedAt = 0;
    let played = false;

    function frame(now: number) {
      const t = (now - startedAt) / 1000;
      const next = t >= T_END ? FINISHED : stateAt(t);
      const previous = sceneRef.current;
      if (
        previous.userChars !== next.userChars ||
        previous.agentChars !== next.agentChars ||
        previous.checked !== next.checked ||
        previous.scanning !== next.scanning ||
        previous.badge !== next.badge ||
        Math.abs(previous.buildProgress - next.buildProgress) > 0.02
      ) {
        setScene(next);
      }
      if (t < T_END) frameHandle = requestAnimationFrame(frame);
    }

    // Plays once, the first time the section is in view. Scrolling away and back does
    // not rebuild the model — what the agent made stays made.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || played || prefersReduced) continue;
          played = true;
          startedAt = performance.now();
          frameHandle = requestAnimationFrame(frame);
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(root);

    // Hidden-pane QA hook: rAF never fires in an invisible pane, so automation steps
    // the timeline manually and reads the DOM.
    (window as unknown as Record<string, unknown>).__rvAgentStep = (t: number) => {
      const state = t >= T_END ? FINISHED : stateAt(t);
      setScene(state);
      return state;
    };

    return () => {
      cancelAnimationFrame(frameHandle);
      observer.disconnect();
      delete (window as unknown as Record<string, unknown>).__rvAgentStep;
    };
  }, []);

  const userDone = scene.userChars >= USER_TEXT.length;
  const showAgent = scene.agentChars > 0;
  const building = scene.buildProgress < 1;

  return (
    <div className="cv5-agent-live" ref={rootRef}>
      <div className="cv5-chat" aria-label="에이전트 대화 데모 — 실측값으로 자동 재생">
        <div className="cv5-msg cv5-msg-user">
          {USER_TEXT.slice(0, scene.userChars)}
          {!userDone && !reduced ? <span className="cv5-caret" aria-hidden="true" /> : null}
        </div>
        {showAgent ? (
          <div className="cv5-msg cv5-msg-bot">
            {AGENT_TEXT.slice(0, scene.agentChars)}
            {scene.agentChars < AGENT_TEXT.length && !reduced ? <span className="cv5-caret" aria-hidden="true" /> : null}
            <div className="cv5-steps">
              {STEPS.slice(0, scene.checked).map((step) => (
                <span key={step.tool} className="cv5-step-in"><b>✓</b><code>{step.tool}</code> — {step.note}</span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="cv5-agent-stage" aria-label="에이전트가 만든 시장 노점 — 드래그해서 돌려보세요" data-building={building ? "true" : undefined}>
        {/* The real file on sale, in the same viewer the shop uses. It is interactive from
            the first frame; the veil only says what the agent is doing. */}
        <EmbeddedGlbViewer
          src={GLB_URL}
          alt="에이전트가 만든 시장 노점 — 드래그해서 돌려보세요"
          hint="드래그 회전 · 휠 줌 · 실제 판매 파일"
        />
        <span className="cv5-agent-stage-tag">{building ? "지금 만드는 중 · market-stall.glb" : "만들어진 파일 · market-stall.glb"}</span>
        {building && scene.checked > 0 ? (
          <div className="cv5-agent-veil" aria-hidden="true">
            <span style={{ width: `${Math.round(scene.buildProgress * 100)}%` }} />
            <small>만드는 중 {Math.round(scene.buildProgress * 100)}%</small>
          </div>
        ) : null}
        {scene.scanning ? <span className="cv5-agent-scan">검사 중 · 17개 항목</span> : null}
        {scene.badge ? <span className="cv5-agent-badge">100점 · 막는 문제 0건</span> : null}
      </div>
    </div>
  );
}
