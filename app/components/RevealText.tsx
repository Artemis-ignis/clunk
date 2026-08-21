"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Ported from agentic-build-and-orchestrate-ai-agents-while-you-sleep/components/reveal-text.tsx.
 * Splits a heading into words and reveals each with a staggered opacity, blur and translateY,
 * driven by IntersectionObserver.
 *
 * Korean adjustment: the template splits on spaces only. Korean headings often have long
 * space free runs, so a `\n` in the source string is honoured as a hard line break and each
 * bracketed run reveals as one unit. Reduced motion renders the final state immediately.
 */
export function RevealText({
  children,
  className,
  as: Tag = "h2",
  stagger = 70,
  duration = 640,
  delay = 0,
  threshold = 0.2,
}: {
  children: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  stagger?: number;
  duration?: number;
  delay?: number;
  threshold?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [entered, setEntered] = useState(false);
  const visible = reduced || entered;

  useEffect(() => {
    const element = ref.current;
    if (!element || reduced) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setEntered(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, reduced]);

  const tokens: string[] = [];
  for (const part of children.split(/(\n)/g)) {
    if (part === "\n") {
      tokens.push("\n");
      continue;
    }
    const words = part.split(" ");
    words.forEach((word, index) => {
      if (word) tokens.push(index < words.length - 1 ? `${word} ` : word);
    });
  }

  let wordIndex = 0;

  return (
    <Tag ref={ref as never} className={className}>
      {tokens.map((token, index) => {
        if (token === "\n") return <br key={`br-${index}`} />;
        const wordDelay = delay + wordIndex * stagger;
        wordIndex += 1;
        return (
          <span
            key={index}
            className="reveal-word"
            style={{
              opacity: visible ? 1 : 0,
              filter: visible ? "blur(0px)" : "blur(8px)",
              transform: visible ? "translateY(0)" : "translateY(14px)",
              transition: visible
                ? `opacity ${duration}ms cubic-bezier(0.16,1,0.3,1) ${wordDelay}ms, filter ${duration}ms cubic-bezier(0.16,1,0.3,1) ${wordDelay}ms, transform ${duration}ms cubic-bezier(0.16,1,0.3,1) ${wordDelay}ms`
                : "none",
            }}
          >
            {token}
          </span>
        );
      })}
    </Tag>
  );
}
