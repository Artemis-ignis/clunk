"use client";

import { useEffect } from "react";

/**
 * Turns window scrolling into snap scrolling while a public product page is mounted.
 * The class lives on <html> because the window is the scroll container: putting a nested
 * scroller around the page would break the fixed nav's scrolled state and anchor links.
 *
 * Snap targets are authored by each page with [data-snap-section]. This component only
 * owns the document-level mode and keeps reduced-motion users on natural scrolling.
 */
export function SnapRoot({ mode = "site" }: { mode?: "site" | "workspace" }) {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const modeClass = `snap-${mode}`;

    const applyMode = () => {
      const reducedMotion = media.matches;
      root.classList.toggle("snap-y", mode === "site" && !reducedMotion);
      root.classList.add(modeClass);
      root.dataset.snapMode = mode;
      root.dataset.snapMotion = reducedMotion ? "reduced" : "full";
    };

    applyMode();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", applyMode);
    } else {
      media.addListener(applyMode);
    }

    return () => {
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", applyMode);
      } else {
        media.removeListener(applyMode);
      }
      root.classList.remove("snap-y", modeClass);
      if (root.dataset.snapMode === mode) delete root.dataset.snapMode;
      delete root.dataset.snapMotion;
    };
  }, [mode]);
  return null;
}
