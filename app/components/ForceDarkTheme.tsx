"use client";

import { useEffect } from "react";

/**
 * Public cv4 pages are designed dark-only, but the legacy stylesheet keys
 * every color off html[data-theme] (light by default). Without this, generic
 * element rules like `h1 { color: var(--text-strong) }` resolve to the LIGHT
 * palette and paint near-black text onto the cv4 dark background — the exact
 * failure the 2026-08-31 live inspection caught. Forcing the attribute makes
 * the whole legacy variable set agree with the cv4 design.
 *
 * The inline <script> runs during HTML parse (before first paint) for
 * server-rendered loads; the effect re-asserts it after client-side
 * navigations, where React-inserted scripts are not guaranteed to execute.
 */
const FORCE_DARK = 'document.documentElement.dataset.theme="dark";';

export function ForceDarkTheme() {
  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
  }, []);
  return <script dangerouslySetInnerHTML={{ __html: FORCE_DARK }} />;
}
