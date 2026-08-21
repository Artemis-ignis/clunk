"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fires once when the element first crosses the viewport threshold, and stays fired.
 * Used to arm the landing page's live interactions (count ups, terminal replays, step
 * ignition) at the moment a scroll snap section lands rather than on mount.
 */
export function useInView<T extends HTMLElement>(options?: {
  threshold?: number;
  rootMargin?: string;
  /** Skip the observer entirely and report visible immediately. */
  immediate?: boolean;
}): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const immediate = options?.immediate ?? false;
  const threshold = options?.threshold ?? 0.3;
  const rootMargin = options?.rootMargin ?? "0px";
  const [inView, setInView] = useState(immediate);

  useEffect(() => {
    if (inView) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver !== "function") {
      // Deferred a tick: a synchronous set here would loop the effect under the compiler lint.
      const fallback = window.setTimeout(() => setInView(true), 0);
      return () => window.clearTimeout(fallback);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView, threshold, rootMargin]);

  return [ref, inView];
}
