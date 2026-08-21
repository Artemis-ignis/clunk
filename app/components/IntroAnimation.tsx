"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Ported from agentic-build-and-orchestrate-ai-agents-while-you-sleep/components/intro-animation.tsx.
 * Same two-phase choreography (letters blur in, letters blur out, curtain retracts upward),
 * retimed for a five letter wordmark and wired to Clunk's dark palette.
 *
 * Differences from the template, all deliberate:
 * - plays once per browser session, so navigating back to the landing page does not replay it
 * - `prefers-reduced-motion: reduce` removes the overlay on the first frame
 * - a `<noscript>` rule hides the overlay entirely when scripting is off
 */

const LETTERS = ["C", "L", "U", "N", "K"];

const LETTER_IN_STAGGER = 70;
const LETTER_IN_DUR = 560;
const HOLD_DURATION = 200;
const LETTERS_IN_TOTAL = LETTER_IN_STAGGER * (LETTERS.length - 1) + LETTER_IN_DUR + HOLD_DURATION;

const LETTER_OUT_STAGGER = 45;
const LETTER_OUT_DUR = 360;
const LETTERS_OUT_TOTAL = LETTER_OUT_STAGGER * (LETTERS.length - 1) + LETTER_OUT_DUR;

const CURTAIN_DELAY = LETTERS_IN_TOTAL + 80;
const CURTAIN_DURATION = 1000;
const ANIM_TOTAL = CURTAIN_DELAY + LETTERS_OUT_TOTAL + 900;

export const HERO_REVEAL_MS = CURTAIN_DELAY + CURTAIN_DURATION - 150;

const SESSION_KEY = "clunk:intro-played";

type Phase = "idle" | "in" | "out" | "done";

export function IntroAnimation({ onDone }: { onDone: () => void }) {
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const [curtainUp, setCurtainUp] = useState(false);

  useEffect(() => {
    let alreadyPlayed = false;
    try {
      alreadyPlayed = window.sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      alreadyPlayed = false;
    }

    if (reduced || alreadyPlayed) {
      const skip = window.setTimeout(() => {
        setPhase("done");
        onDone();
      }, 0);
      return () => window.clearTimeout(skip);
    }

    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Private mode blocks writes. The intro simply replays next visit.
    }

    const timers = [
      window.setTimeout(() => setPhase("in"), 60),
      window.setTimeout(() => setPhase("out"), LETTERS_IN_TOTAL),
      window.setTimeout(() => setCurtainUp(true), CURTAIN_DELAY),
      window.setTimeout(() => onDone(), HERO_REVEAL_MS),
      window.setTimeout(() => setPhase("done"), ANIM_TOTAL),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [onDone, reduced]);

  if (reduced || phase === "done") return null;

  return (
    <div className="intro-overlay" aria-hidden="true">
      <noscript>
        <style>{".intro-overlay{display:none}"}</style>
      </noscript>
      <div
        className="intro-curtain"
        style={{
          bottom: curtainUp ? "100%" : "0%",
          transition: curtainUp ? `bottom ${CURTAIN_DURATION}ms cubic-bezier(0.76, 0, 0.24, 1)` : "none",
        }}
      />
      <div className="intro-letters">
        {LETTERS.map((letter, index) => {
          const isIdle = phase === "idle";
          const isIn = phase === "in";
          const isOut = phase === "out";
          const inDelay = index * LETTER_IN_STAGGER;
          const outDelay = index * LETTER_OUT_STAGGER;

          const transition = isOut
            ? `opacity ${LETTER_OUT_DUR}ms cubic-bezier(0.4,0,1,1) ${outDelay}ms, filter ${LETTER_OUT_DUR}ms cubic-bezier(0.4,0,1,1) ${outDelay}ms, transform ${LETTER_OUT_DUR}ms cubic-bezier(0.4,0,1,1) ${outDelay}ms`
            : isIn
              ? `opacity ${LETTER_IN_DUR}ms cubic-bezier(0.16,1,0.3,1) ${inDelay}ms, filter ${LETTER_IN_DUR}ms cubic-bezier(0.16,1,0.3,1) ${inDelay}ms, transform ${LETTER_IN_DUR}ms cubic-bezier(0.16,1,0.3,1) ${inDelay}ms`
              : "none";

          return (
            <span
              key={letter}
              className="intro-letter"
              style={{
                opacity: isIdle ? 0 : isIn ? 1 : 0,
                filter: `blur(${isIdle ? 32 : isIn ? 0 : 20}px)`,
                transform: `translateY(${isIdle ? 40 : isIn ? 0 : -18}px)`,
                transition,
              }}
            >
              {letter}
            </span>
          );
        })}
      </div>
    </div>
  );
}
