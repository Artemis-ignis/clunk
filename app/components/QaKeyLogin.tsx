"use client";

import { useState } from "react";

/**
 * QA sign-in form. Rendered only when the server says the deployment has a
 * QA key configured (pre-launch QA rail); posts the key and follows the
 * server-approved returnTo on success.
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
    <form onSubmit={submit} aria-label="QA 키 로그인" style={{ display: "grid", gap: 8, marginTop: 14 }}>
      <label style={{ display: "grid", gap: 6, fontSize: "0.78rem", opacity: 0.85 }}>
        QA 키 (운영자 전용)
        <input
          type="password"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          autoComplete="off"
          placeholder="CLUNK_QA_LOGIN_KEY"
          style={{
            height: 42,
            padding: "0 12px",
            borderRadius: 10,
            border: "1px solid rgba(127, 127, 127, 0.35)",
            background: "transparent",
            color: "inherit",
            font: "inherit",
          }}
        />
      </label>
      <button
        type="submit"
        disabled={pending || !key.trim()}
        style={{
          height: 42,
          borderRadius: 10,
          border: "1px solid rgba(127, 127, 127, 0.35)",
          background: "transparent",
          color: "inherit",
          font: "inherit",
          cursor: pending ? "wait" : "pointer",
          opacity: pending || !key.trim() ? 0.6 : 1,
        }}
      >
        {pending ? "확인 중…" : "QA 키로 로그인"}
      </button>
      {error ? (
        <p role="alert" style={{ margin: 0, fontSize: "0.78rem", color: "#e5484d" }}>{error}</p>
      ) : null}
      <p style={{ margin: 0, fontSize: "0.72rem", opacity: 0.6 }}>
        판매 개시 전 QA 전용 로그인입니다. 일반 사용자 로그인은 Google·GitHub OAuth 등록 후 열립니다.
      </p>
    </form>
  );
}
