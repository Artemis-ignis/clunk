import { redirect } from "next/navigation";

import { requireUser } from "../auth";
import { ensureSchema, getRuntimeDb } from "../api/_lib/clunk";
import { safeOAuthReturnPath } from "../oauth";
import { SiteNav } from "../components/SiteNav";
import { SiteFooter } from "../components/SiteFooter";
import { ForceDarkTheme } from "../components/ForceDarkTheme";
import { createPageMetadata } from "../components/site-metadata";
import { ConsentForm } from "./ConsentForm";
import "../login/auth-v5.css";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "약관 동의",
  description: "Clunk를 시작하기 전에 이용약관과 개인정보 수집·이용에 동의합니다. 한 번만 묻습니다.",
  path: "/consent",
});

/**
 * The screen between OAuth and the first workspace page.
 *
 * It uses requireUser directly rather than requireChatGPTUser — the latter is the gate that
 * sends people here, and a gate on its own destination is a loop. Someone who has already
 * consented and lands here by an old link is simply sent on.
 */
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeOAuthReturnPath(params.return_to ?? "/dashboard");
  const user = await requireUser(`/consent?return_to=${encodeURIComponent(returnTo)}`);

  const db = getRuntimeDb();
  await ensureSchema(db);
  const row = await db
    .prepare(`SELECT consented_at AS consentedAt FROM clunk_users WHERE id = ? LIMIT 1`)
    .bind(user.id)
    .first<{ consentedAt: string | null }>();
  if (row?.consentedAt) redirect(returnTo);

  return (
    <div className="cv5 cv5-auth-shell">
      <ForceDarkTheme />
      <div className="cv5-stars" aria-hidden="true" />
      <a className="clunk-home-skip-link" href="#main-content">본문으로 건너뛰기</a>
      <SiteNav />

      <main id="main-content" className="cv5-auth">
        <div className="cv5-frame cv5-auth-grid">
          <div className="cv5-auth-intro">
            <span className="cv5-badge">✦ CLUNK <b>시작 전 한 번</b></span>
            <h1>
              무엇을 저장하는지
              <br />
              <em>먼저 말씀드립니다.</em>
            </h1>
            {/* 아래 세 줄은 개인정보처리방침의 문장을 그대로 옮긴 것입니다. 동의 화면과
                방침이 다른 말을 하면 어느 쪽도 믿을 수 없게 됩니다. */}
            <p className="cv5-auth-lede">
              {`${user.displayName}님, 반갑습니다. Clunk는 로그인 제공자가 준 이메일과 표시 이름, 그리고 여기서 만드는 에셋과 실행 기록만 보관합니다. 원본 파일은 브라우저에서 열리고 서버에 올라가지 않습니다. 비밀번호는 만들지도 보관하지도 않습니다.`}
            </p>
            <div className="cv5-auth-facts">
              <div className="cv5-auth-fact">
                <span>수집하는 것</span>
                <strong>이메일 · 표시 이름 · 로그인 제공자 식별자</strong>
              </div>
              <div className="cv5-auth-fact">
                <span>보관하는 곳</span>
                <strong>Cloudflare D1 · R2 (미국)</strong>
              </div>
              <div className="cv5-auth-fact">
                <span>지우고 싶을 때</span>
                <strong>계정 삭제 요청 시 30일 이내</strong>
              </div>
            </div>
          </div>

          <section className="cv5-auth-card" aria-labelledby="consent-title">
            <span className="cv5-auth-status" data-state="off">약관 동의</span>
            <h2 id="consent-title">동의하면<br />바로 시작합니다.</h2>
            <p className="cv5-auth-copy">
              필수 두 가지에 동의해야 작업공간이 열립니다. 이 화면은 이번 한 번만 나옵니다.
            </p>
            <ConsentForm returnTo={returnTo} />
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
