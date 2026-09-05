"use client";

import { useEffect, useState } from "react";

/**
 * 화면 테마 세 벌을 고르는 조작부 — 기본 · 화이트 · 블랙.
 *
 * 2026-09-05 오전에 뺐던 라이트/다크 토글의 자리를 대신한다. 그때는 눌러도
 * 요소 435개 중 19개(4.4%)만 색이 바뀌어서 거짓말하는 버튼이었다. 배색을
 * app/theme.css 한 곳으로 모은 뒤라 이제는 화면이 따라온다.
 *
 * 고른 값은 localStorage["clunk.theme"] 에 남고, 다음 방문의 첫 칠 전에
 * app/layout.tsx 의 인라인 스크립트가 <html data-theme> 로 얹는다. 여기 있는
 * useEffect 는 하이드레이션 뒤에 그 값을 한 번 더 못 박는 안전장치다 —
 * 서버가 내보낸 HTML 은 언제나 data-theme="default" 이기 때문이다.
 */

export const THEME_STORAGE_KEY = "clunk.theme";

export const THEME_OPTIONS = [
  { value: "default", label: "기본" },
  { value: "light", label: "화이트" },
  { value: "dark", label: "블랙" },
] as const;

export type ThemeName = (typeof THEME_OPTIONS)[number]["value"];

function isTheme(value: string | null): value is ThemeName {
  return value === "default" || value === "light" || value === "dark";
}

function readStoredTheme(): ThemeName {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // 사생활 보호 모드에서는 localStorage 읽기 자체가 던진다. 기본값으로 간다.
  }
  return "default";
}

export function ThemeSwitch({ variant = "bar" }: { variant?: "bar" | "drawer" }) {
  const [theme, setTheme] = useState<ThemeName>("default");

  useEffect(() => {
    const stored = readStoredTheme();
    setTheme(stored);
    document.documentElement.setAttribute("data-theme", stored);
  }, []);

  const choose = (next: ThemeName) => {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // 저장이 막혀 있어도 이번 방문 동안은 고른 대로 보인다.
    }
  };

  return (
    <div
      className={`theme-switch theme-switch-${variant}`}
      role="radiogroup"
      aria-label="화면 테마"
    >
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={theme === option.value}
          className={`theme-switch-option${theme === option.value ? " is-on" : ""}`}
          data-theme-option={option.value}
          onClick={() => choose(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
