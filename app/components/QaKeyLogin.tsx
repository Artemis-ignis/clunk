"use client";

import { useState } from "react";

/**
 * QA sign-in form. Rendered only when the server says the deployment has a
 * QA key configured (pre-launch QA rail); posts the key and follows the
 * server-approved returnTo on success.
 *
 * Styling lives in app/login/auth-v5.css (.cv5-qa-*) so the form reads as
 * part of the cv5 auth card; the submit/fetch behavior is unchanged.
 */
export function QaKeyLogin({ returnTo }: { returnTo: string }) {
  const [key, setKey] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !key.trim()) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/qa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: key.trim(), returnTo }),
      });
      const body: { ok?: boolean; returnTo?: string; error?: string } = await response.json();
      if (response.ok && body.ok) {
        window.location.assign(typeof body.returnTo === "string" ? body.returnTo : returnTo);
        return;
      }
      setError(body.error ?? "QA 로그인에 실패했습니다.");
    } catch {
      setError("네트워크 오류로 QA 로그인을 완료하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} aria-label="QA 키 로그인" className="cv5-qa-login">
      <label className="cv5-qa-label">
        QA 키 (운영자 전용)
        <input
          type="password"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          autoComplete="off"
          placeholder="CLUNK_QA_LOGIN_KEY"
          className="cv5-qa-input"
        />
      </label>
      <button
        type="submit"
        disabled={pending || !key.trim()}
        data-pending={pending ? "true" : "false"}
        className="cv5-qa-submit"
      >
        {pending ? "확인 중…" : "QA 키로 로그인"}
      </button>
      {error ? (
        <p role="alert" className="cv5-qa-error">{error}</p>
      ) : null}
      <p className="cv5-qa-note">
        판매 개시 전 QA 전용 로그인입니다. 일반 사용자 로그인은 Google·GitHub OAuth 등록 후 열립니다.
      </p>
    </form>
  );
}
