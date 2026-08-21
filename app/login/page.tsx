import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser, safeReturnPath } from "../auth-provider";
import { BrandLockup } from "../components/BrandMark";
import { Icon } from "../components/Icon";
import { LoginMethods } from "../components/LoginMethods";
import { ThemeToggle } from "../components/ThemeToggle";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "로그인",
  // 이 문구는 정적 메타데이터라 제공자 설정 여부를 알 수 없다. 켜지지 않았을 수도 있는
  // 로그인 방법을 약속하지 않도록 방법 이름을 빼고 적는다.
  description: "Clunk 비공개 워크스페이스에 입장합니다. 지원되는 로그인 방법은 화면에 표시됩니다.",
};

/**
 * Ported from liquid-glass-login-page/app/page.tsx:
 * the staged gradient still fills the viewport, three pulsing glass orbs float behind the
 * content, and a single frosted card sits centred with a heavy inner highlight.
 *
 * The template's email and password fields stay removed — Clunk stores no password of its
 * own. What the card offers is whatever sign-in method this deployment actually has
 * configured, resolved at request time by LoginMethods.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    const { redirect } = await import("next/navigation");
    redirect("/app");
  }

  const params = await searchParams;
  const returnTo = safeReturnPath(params.return_to ?? "/app");

  return (
    <main className="login-page">
      <div className="login-orbs" aria-hidden="true">
        <span className="login-orb login-orb-1" />
        <span className="login-orb login-orb-2" />
        <span className="login-orb login-orb-3" />
      </div>

      <header className="login-topbar">
        <Link className="brand" href="/" aria-label="Clunk 홈">
          <BrandLockup gradientId="clunk-login" />
        </Link>
        <span className="login-topbar-end">
          <span className="mono-label">비공개 파일럿</span>
          <ThemeToggle />
        </span>
      </header>

      <section className="login-card" aria-labelledby="login-title">
        <span className="login-card-chip">
          <Icon name="shield" size={13} />
          비밀번호 없는 로그인
        </span>

        <h1 id="login-title">
          워크스페이스로
          <br />
          <em>들어갑니다.</em>
        </h1>
        <p className="login-lead">
          가지고 계신 계정으로 로그인하면 곧 회원가입입니다. 따로 가입 절차를 밟지 않아도
          워크스페이스가 만들어집니다.
        </p>

        <LoginMethods returnTo={returnTo} />

        <ul className="login-facts">
          <li>
            <Icon name="fingerprint" size={15} />
            <span>
              <strong>비밀번호를 보관하지 않습니다</strong>
              Clunk는 자체 비밀번호 데이터베이스를 만들지 않고, 로그인한 계정 제공자만 신뢰합니다.
            </span>
          </li>
          <li>
            <Icon name="boxes" size={15} />
            <span>
              <strong>계정마다 워크스페이스가 분리됩니다</strong>
              검사 이력, 크레딧 원장, Passport가 사용자별로 나뉩니다.
            </span>
          </li>
          <li>
            <Icon name="shield" size={15} />
            <span>
              <strong>원본 에셋은 올라가지 않습니다</strong>
              브라우저에서 분석하고 메타데이터와 해시, 결과만 저장합니다.
            </span>
          </li>
        </ul>

        <Link className="login-back" href="/">
          <Icon name="arrowRight" size={14} />
          홈으로 돌아가기
        </Link>
      </section>

      <footer className="login-footer">
        <span>Clunk, 3D 에셋 품질 게이트</span>
      </footer>
    </main>
  );
}
