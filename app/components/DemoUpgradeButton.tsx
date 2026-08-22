"use client";

import { useState } from "react";

/**
 * 얼리 액세스 크레딧 지급 버튼.
 *
 * 예전 이름은 "Builder로 전환"이었다. 유료 플랜으로 올라가는 것처럼 읽히지만 실제로는
 * 크레딧 100개를 무료로 붙인다. 하는 일과 다른 이름을 달아 두면, 결제를 붙이는 날
 * 고객이 이미 산 줄 알았다고 말하게 된다. 하는 일을 그대로 적는다.
 */
export function DemoUpgradeButton({ disabled = false }: { disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  async function upgrade() {
    setState("busy");
    try {
      const response = await fetch("/api/credits", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "simulate-upgrade" }) });
      setState(response.ok ? "done" : "error");
      if (response.ok) window.setTimeout(() => window.location.reload(), 500);
    } catch { setState("error"); }
  }
  return (
    <button
      type="button"
      className="button button-quiet button-block button-sm"
      onClick={() => void upgrade()}
      disabled={disabled || state === "busy"}
    >
      {disabled
        ? "로그인 후 업그레이드"
        : state === "busy"
          ? "추가 중"
          : state === "done"
            ? "크레딧 100개 추가됨"
            : state === "error"
              ? "실패 · 다시 시도"
              : "크레딧 100개 받기"}
    </button>
  );
}
