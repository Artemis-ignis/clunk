/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "./NativeLink";
import { Icon } from "./Icon";
import { CountUp } from "./CountUp";
import { IntroAnimation } from "./IntroAnimation";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Landing hero: a real production asset under inspection, annotated like a teardown.
 *
 * The model is Harvest Frontier's runtime GLB `tractor.compact.m1.glb`, rendered once from
 * the actual file (tmp/tractor-render.html → public/landing/tractor-hero.png). Every number
 * in the callouts is copied from a live `clunk_inspect` MCP response measured on 2026-08-21
 * with examples/profiles/harvest-frontier.example.json; nothing here is invented:
 * inputHash d92ae932…b3222c, 680,412 bytes, 30,188 tris / 83,090 verts, 48 materials,
 * 88 draw calls, 249 nodes / 0 empty, static policy score 100/100 (threshold 90,
 * hard blocker 0). This is not a shipped-scene or player-facing approval.
 */
const MEASURED = {
  file: "tractor.compact.m1.glb",
  source: "Harvest Frontier 런타임 에셋",
  hashShort: "d92ae932…b3222c",
  bytes: "680,412 B",
  ruleSet: "harvest-frontier-runtime-v1",
  score: 100,
  triangles: "30,188",
  vertices: "83,090",
  materials: "48",
  drawCalls: "88",
  nodes: "249",
  emptyNodes: "0",
} as const;

/**
 * stage-percent coordinates: [line x1, y1, x2(anchor), y2(anchor)].
 * Chips sit in the empty sky/ground corners around the model (hood left, cab centre,
 * implement right in the rendered angle) so nothing ever covers the silhouette.
 */
const CALLOUTS = [
  {
    key: "geometry",
    label: "GEOMETRY",
    strong: `삼각형 ${MEASURED.triangles}`,
    small: `정점 ${MEASURED.vertices}`,
    chip: { left: "1.5%", top: "7%" },
    line: [19, 17, 30, 43],
  },
  {
    key: "scene",
    label: "SCENE",
    strong: `노드 ${MEASURED.nodes}`,
    small: `빈 노드 ${MEASURED.emptyNodes}`,
    chip: { left: "33%", top: "2%" },
    line: [46, 12, 56, 24],
  },
  {
    key: "materials",
    label: "MATERIALS",
    strong: `머티리얼 ${MEASURED.materials}`,
    small: `드로우콜 ${MEASURED.drawCalls}`,
    chip: { right: "1.5%", bottom: "9%" },
    line: [88, 75, 84, 58],
  },
] as const;

export function HeroAutopsy() {
  const reduced = usePrefersReducedMotion();
  const [introDone, setIntroDone] = useState(false);
  const handleIntroDone = useCallback(() => setIntroDone(true), []);
  const [armed, setArmed] = useState(false);

  const ready = reduced || introDone;

  useEffect(() => {
    if (!ready) return;
    // Give the copy a beat before the teardown lights up.
    const t = window.setTimeout(() => setArmed(true), reduced ? 0 : 300);
    return () => window.clearTimeout(t);
  }, [ready, reduced]);

  const rise = (index: number) => ({
    opacity: ready ? 1 : 0,
    filter: ready ? "blur(0px)" : "blur(18px)",
    transform: ready ? "translateY(0)" : "translateY(26px)",
    transition: `opacity 900ms cubic-bezier(0.16,1,0.3,1) ${index * 90}ms, filter 900ms cubic-bezier(0.16,1,0.3,1) ${index * 90}ms, transform 900ms cubic-bezier(0.16,1,0.3,1) ${index * 90}ms`,
  });

  return (
    <section className="snap-sec hero3" id="hero">
      <IntroAnimation onDone={handleIntroDone} />
      <div className="hero3-bg" aria-hidden="true" />

      <div className="hero3-inner">
        <div className="hero3-copy">
          <span className="eyebrow" style={rise(0)}>
            GAME ASSETOPS · 3D 에셋 품질 게이트
          </span>
          <h1 style={rise(1)}>
            에이전트가 만든 에셋,
            <br />
            <em>그 자리에서 판정합니다.</em>
          </h1>
          <p style={rise(2)}>
            Claude Code, Codex 같은 에이전트가 쓴 GLB를 사람이 열어보기 전에 실제 바이트로
            검사하고 점수, 근거, Passport를 남깁니다.
          </p>
          <div className="hero-actions" style={rise(3)}>
            <Link className="button button-primary" href="/app" prefetch={false}>
              검사기 열기
              <Icon name="arrowUpRight" size={15} />
            </Link>
            <a className="button button-quiet" href="#playground">
              MCP로 붙이기
              <Icon name="arrowRight" size={15} />
            </a>
          </div>
          <p className="hero3-trust mono-label" style={rise(4)}>
            원본 무손실 · 로컬 우선 · 판정 근거 4겹
          </p>
        </div>

        <div className={`hero3-stage${armed ? " hero3-armed" : ""}`} aria-label="실측 검사 콜아웃이 달린 실제 게임 에셋">
          <div className="hero3-halo" aria-hidden="true" />
          <img
            className="hero3-model"
            src="/landing/tractor-hero.png"
            alt="Harvest Frontier 트랙터 GLB 렌더"
            width={1600}
            height={1200}
          />
          <div className="hero3-scan" aria-hidden="true" />

          <svg className="hero3-leads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {CALLOUTS.map((c, i) => (
              <g key={c.key} className="hero3-lead" style={{ transitionDelay: `${700 + i * 260}ms` }}>
                <line x1={c.line[0]} y1={c.line[1]} x2={c.line[2]} y2={c.line[3]} pathLength={1} />
                <circle cx={c.line[2]} cy={c.line[3]} r="0.7" />
              </g>
            ))}
          </svg>

          {CALLOUTS.map((c, i) => (
            <div
              key={c.key}
              className="hero3-callout"
              style={{ ...c.chip, transitionDelay: `${640 + i * 260}ms` }}
            >
              <span className="hero3-callout-label">{c.label}</span>
              <strong className="num">{c.strong}</strong>
              <small className="num">{c.small}</small>
            </div>
          ))}

          <div className="hero3-score" style={{ transitionDelay: "1150ms" }}>
            <span className="hero3-score-label">STATIC POLICY SCORE</span>
            <span className="hero3-score-value num">
              {armed ? <CountUp value={MEASURED.score} duration={1300} /> : 0}
              <small>/100</small>
            </span>
            <span className="status-pill status-conditional">
              <span className="status-dot" />
              STATIC PASS · 하드 블로커 0
            </span>
            <small className="hero3-score-boundary">visualRuntime GAP · playerFacing NOT_EVALUATED</small>
          </div>

          <div className="hero3-filestrip" style={{ transitionDelay: "1500ms" }}>
            <span className="hero3-file num">
              {MEASURED.file} · {MEASURED.bytes}
            </span>
            <span className="hero3-hash num">sha256 {MEASURED.hashShort}</span>
            <span className="hero3-proof">{MEASURED.source} · clunk_inspect 실측 응답</span>
          </div>
        </div>
      </div>

      <a className="hero3-scrollcue" href="#flow" aria-label="다음 섹션으로">
        <span />
      </a>
    </section>
  );
}
