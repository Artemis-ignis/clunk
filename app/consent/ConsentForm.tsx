"use client";

import { useState } from "react";
import Link from "../components/NativeLink";

/**
 * The one screen between OAuth and the workspace.
 *
 * Two boxes are required and say what they are for; the third is optional and separate,
 * because a marketing consent folded into the required ones does not count as consent.
 * The button stays off until both required boxes are ticked, and the answer is written to
 * the server before the visitor moves on — this is the record, not the sentence under the
 * login buttons that used to stand in for one.
 */
export function ConsentForm({ returnTo }: { returnTo: string }) {
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!terms || !privacy || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ terms, privacy, marketing }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "동의를 저장하지 못했습니다. 다시 시도해 주세요.");
        setBusy(false);
        return;
      }
      window.location.assign(returnTo);
    } catch {
      setError("동의를 저장하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  return (
    <form
      className="cv5-consent"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <ul className="cv5-consent-list">
        <li>
          <label>
            <input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} required />
            <span>
              <b>(필수)</b> <Link href="/terms" target="_blank" rel="noreferrer">이용약관</Link>에 동의합니다.
            </span>
          </label>
        </li>
        <li>
          <label>
            <input type="checkbox" checked={privacy} onChange={(event) => setPrivacy(event.target.checked)} required />
            <span>
              <b>(필수)</b> <Link href="/privacy" target="_blank" rel="noreferrer">개인정보처리방침</Link>에 따라 이메일·표시 이름·로그인 제공자 식별자를
              수집·이용하는 데 동의합니다. 계정 운영과 크레딧 기록에만 씁니다.
            </span>
          </label>
        </li>
        <li>
          <label>
            <input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} />
            <span>
              <b>(선택)</b> 새 에셋·기능 소식과 유료 전환 안내를 이메일로 받겠습니다. 체크하지 않아도
              서비스 이용에는 아무 영향이 없고, 나중에{" "}
              <Link href="/settings" target="_blank" rel="noreferrer">설정 화면</Link>에서 켜고 끌 수 있습니다.
            </span>
          </label>
        </li>
      </ul>
      {error ? <p className="cv5-auth-alert" role="alert">{error}</p> : null}
      <button type="submit" className="cv5-auth-primary" disabled={!terms || !privacy || busy}>
        {busy ? "저장하는 중…" : "동의하고 시작하기"}
        <span aria-hidden="true">↗</span>
      </button>
      <p className="cv5-auth-switch">
        동의하지 않으면 계정을 만들지 않습니다. 이미 만들어진 로그인 세션은{" "}
        <Link href="/signout-with-chatgpt">여기서 끝낼 수</Link> 있습니다.
      </p>
    </form>
  );
}
