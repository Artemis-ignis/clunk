"use client";

import { useState } from "react";

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
            ? "데모 크레딧 100개 추가됨"
            : state === "error"
              ? "로그인 후 업그레이드"
              : "Builder 데모로 전환"}
    </button>
  );
}
