"use client";

import { useEffect } from "react";

/**
 * Turns window scrolling into snap scrolling while the landing page is mounted.
 * The class lives on <html> because the window is the scroll container: putting a nested
 * scroller around the page would break the fixed nav's scrolled state and anchor links.
 */
export function SnapRoot() {
  useEffect(() => {
    document.documentElement.classList.add("snap-y");
    return () => document.documentElement.classList.remove("snap-y");
  }, []);
  return null;
}
