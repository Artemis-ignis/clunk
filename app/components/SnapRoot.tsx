"use client";

import { useEffect } from "react";

/**
 * Turns window scrolling into snap scrolling while a product page is mounted.
 * The class lives on <html> because the window is the scroll container: putting a nested
 * scroller around the page would break the fixed nav's scrolled state and anchor links.
 */
export function SnapRoot({ mode = "site" }: { mode?: "site" | "workspace" }) {
  useEffect(() => {
    const shouldSnap = mode === "site";
    if (shouldSnap) document.documentElement.classList.add("snap-y");
    document.documentElement.classList.add(`snap-${mode}`);
    return () => {
      if (shouldSnap) document.documentElement.classList.remove("snap-y");
      document.documentElement.classList.remove(`snap-${mode}`);
    };
  }, [mode]);
  return null;
}
