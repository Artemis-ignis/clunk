"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "./useInView";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Tabular-num count up that arms when it scrolls into view. The final value is rendered for
 * SSR and reduced motion; the animation only ever moves toward the real number, so the page
 * never shows an invented value.
 */
export function CountUp({
  value,
  duration = 1100,
  suffix = "",
  className,
}: {
  value: number;
  duration?: number;
  suffix?: string;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLSpanElement>({ threshold: 0.4 });
  const [shown, setShown] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!inView || started.current) return;
    started.current = true;
    if (reduced) {
      const id = window.setTimeout(() => setShown(value), 0);
      return () => window.clearTimeout(id);
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(value * eased));
      if (p < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [inView, reduced, value, duration]);

  const display = inView ? shown : reduced ? value : 0;
  return (
    <span ref={ref} className={className ? `num ${className}` : "num"}>
      {display.toLocaleString("ko-KR")}
      {suffix}
    </span>
  );
}
