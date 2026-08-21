/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { HERO_REVEAL_MS, IntroAnimation } from "./IntroAnimation";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Hero composition ported from
 * agentic-build-and-orchestrate-ai-agents-while-you-sleep/app/page.tsx:
 * full bleed background image, progressive blur and colour ramp rising from the bottom edge,
 * copy anchored to the bottom left, and a slow scale in on the backdrop that starts a beat
 * before the intro curtain finishes. The template's stock video is replaced with the staged
 * template still, and the invented metrics row is not part of the hero.
 */
export function LandingHero() {
  const reduced = usePrefersReducedMotion();
  const [introDone, setIntroDone] = useState(false);
  const [backdropScaled, setBackdropScaled] = useState(false);
  const handleIntroDone = useCallback(() => setIntroDone(true), []);

  const heroReady = reduced || introDone;
  const backdropReady = reduced || backdropScaled;

  useEffect(() => {
    if (reduced) return;
    const timer = window.setTimeout(() => setBackdropScaled(true), HERO_REVEAL_MS - 400);
    return () => window.clearTimeout(timer);
  }, [reduced]);

  const rise = (index: number) => ({
    opacity: heroReady ? 1 : 0,
    filter: heroReady ? "blur(0px)" : "blur(18px)",
    transform: heroReady ? "translateY(0)" : "translateY(26px)",
    transition: `opacity 900ms cubic-bezier(0.16,1,0.3,1) ${index * 90}ms, filter 900ms cubic-bezier(0.16,1,0.3,1) ${index * 90}ms, transform 900ms cubic-bezier(0.16,1,0.3,1) ${index * 90}ms`,
  });

  return (
    <section className="hero">
      <IntroAnimation onDone={handleIntroDone} />

      <div className="hero-backdrop" aria-hidden="true">
        <img
          src="/template-assets/agentic-arc.png"
          alt=""
          width={1200}
          height={700}
          style={{ transform: backdropReady ? "scale(1.04)" : "scale(0.88)" }}
        />
      </div>
      <div className="hero-veil hero-veil-1" aria-hidden="true" />
      <div className="hero-veil hero-veil-2" aria-hidden="true" />
      <div className="hero-veil hero-veil-3" aria-hidden="true" />
      <div className="hero-ramp" aria-hidden="true" />

      <div className="hero-copy">
        <span className="eyebrow" style={rise(0)}>
          3D 에셋 품질 게이트
        </span>
        <h1 style={rise(1)}>
          에이전트가 만든 에셋,
          <br />
          <em>그 자리에서 판정합니다.</em>
        </h1>
        <p style={rise(2)}>
          생성 직후 clunk_inspect를 호출하면 실제 바이트에서 계산한 점수와 finding, Passport가 남습니다.
        </p>
        <div className="hero-actions" style={rise(3)}>
          <Link className="button button-primary" href="/app">
            검사기 열기
            <Icon name="arrowUpRight" size={15} />
          </Link>
          <Link className="button button-quiet" href="/docs">
            연동 방법 보기
            <Icon name="arrowRight" size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}
