"use client";

import { useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

/**
 * The document's data-theme attribute is the single source of truth: the inline script in the
 * root layout sets it before paint, and every toggle instance (site nav, workspace toolbar)
 * observes the same attribute, so they stay in sync without a context provider.
 */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next: Theme = getSnapshot() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem("clunk-theme", next);
    } catch {
      // Private mode: the choice just does not persist across visits.
    }
  }, []);

  return (
    <button
      type="button"
      className={className ? `icon-button theme-toggle ${className}` : "icon-button theme-toggle"}
      onClick={toggle}
      aria-label={theme === "dark" ? "라이트 테마로 전환" : "다크 테마로 전환"}
      title={theme === "dark" ? "라이트 테마로 전환" : "다크 테마로 전환"}
    >
      {theme === "dark" ? (
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4.4" />
          <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.55 1.55M17.05 17.05l1.55 1.55M18.6 5.4l-1.55 1.55M6.95 17.05L5.4 18.6" />
        </svg>
      ) : (
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20.4 14.2A8.6 8.6 0 0 1 9.8 3.6a8.6 8.6 0 1 0 10.6 10.6Z" />
        </svg>
      )}
    </button>
  );
}
