"use client";

import { useEffect, useState } from "react";
import Link from "../components/NativeLink";
import { Icon } from "../components/Icon";

/**
 * 마케팅 이메일을 받을지 말지 고르는 스위치.
 *
 * /api/consent 는 필수 동의(이용약관·개인정보)와 선택 동의(마케팅)를 한 번에 받습니다.
 * 그래서 여기서는 이미 필수 동의를 한 사람에게만 스위치를 보여 줍니다. 아직 동의한
 * 적이 없는 사람에게 이 스위치를 눌러 주면, 누른 적 없는 필수 동의까지 기록되기
 * 때문입니다. 그런 사람에게는 동의 화면 링크만 보여 줍니다.
 */
type Phase = "loading" | "ready" | "saving" | "consent-missing" | "error";

export function MarketingConsentToggle() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [optIn, setOptIn] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/consent", { cache: "no-store" });
        if (cancelled) return;
        if (!response.ok) {
          setPhase("error");
          setMessage("지금은 수신 설정을 불러오지 못했습니다. 잠시 뒤 새로고침해 주세요.");
          return;
        }
        const body = (await response.json()) as { consentedAt?: string | null; marketingOptIn?: boolean };
        if (cancelled) return;
        if (!body.consentedAt) {
          setPhase("consent-missing");
          return;
        }
        setOptIn(body.marketingOptIn === true);
        setPhase("ready");
      } catch {
        if (cancelled) return;
        setPhase("error");
        setMessage("지금은 수신 설정을 불러오지 못했습니다. 잠시 뒤 새로고침해 주세요.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    if (phase !== "ready") return;
    const next = !optIn;
    setPhase("saving");
    setMessage("");
    try {
      const response = await fetch("/api/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ terms: true, privacy: true, marketing: next }),
      });
      if (!response.ok) {
        setPhase("ready");
        setMessage("저장하지 못했습니다. 다시 눌러 주세요.");
        return;
      }
      setOptIn(next);
      setPhase("ready");
      setMessage(next ? "새 소식 메일을 받도록 저장했습니다." : "새 소식 메일을 받지 않도록 저장했습니다.");
    } catch {
      setPhase("ready");
      setMessage("저장하지 못했습니다. 다시 눌러 주세요.");
    }
  }

  return (
    <div className="settings-toggle">
      <div className="settings-toggle-copy">
        <strong>마케팅 이메일 수신</strong>
        <small>
          새 기능과 무료 베타 소식만 가끔 보냅니다. 받지 않아도 Clunk를 쓰는 데에는 아무 차이가
          없고, 언제든 여기서 다시 끌 수 있습니다.
        </small>
      </div>
      {phase === "consent-missing" ? (
        <Link className="button button-quiet button-sm" href="/consent?return_to=%2Fsettings">
          동의 화면 열기
          <Icon name="arrowRight" size={13} />
        </Link>
      ) : (
        <button
          type="button"
          className={`settings-switch${optIn ? " settings-switch-on" : ""}`}
          role="switch"
          aria-checked={optIn}
          aria-label="마케팅 이메일 수신"
          disabled={phase !== "ready"}
          onClick={() => void toggle()}
        >
          <span className="settings-switch-track">
            <span className="settings-switch-knob" />
          </span>
          <span className="settings-switch-text">
            {phase === "loading" ? "확인 중" : phase === "saving" ? "저장 중" : optIn ? "받는 중" : "받지 않음"}
          </span>
        </button>
      )}
      {message ? (
        <p className="settings-toggle-note" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  );
}
