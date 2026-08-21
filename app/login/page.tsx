import type { Metadata } from "next";
import Link from "next/link";
import { getChatGPTUser, chatGPTSignInPath } from "../chatgpt-auth";
import { BrandLockup } from "../components/BrandMark";
import { Icon } from "../components/Icon";
import { ThemeToggle } from "../components/ThemeToggle";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "로그인",
  description: "ChatGPT 계정으로 Clunk 비공개 워크스페이스에 입장합니다. 별도 회원가입 절차는 없습니다.",
};

/**
 * Ported from liquid-glass-login-page/app/page.tsx:
 * the staged gradient still fills the viewport, three pulsing glass orbs float behind the
 * content, and a single frosted card sits centred with a heavy inner highlight.
 *
 * The template's email, password and three social buttons are removed. Clunk stores no
 * password of its own, so the card offers exactly one route in.
 */
export default async function LoginPage() {
  const user = await getChatGPTUser();
  if (user) {
    const { redirect } = await import("next/navigation");
    redirect("/app");
  }

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
          ChatGPT SIWC
        </span>

        <h1 id="login-title">
          워크스페이스로
          <br />
          <em>들어갑니다.</em>
        </h1>
        <p className="login-lead">
          ChatGPT 계정으로 로그인하면 곧 회원가입입니다. 따로 가입 절차를 밟지 않아도 워크스페이스가 만들어집니다.
        </p>

        <Link className="button button-primary button-block login-cta" href={chatGPTSignInPath("/app")}>
          ChatGPT 계정으로 시작하기
          <Icon name="arrowUpRight" size={16} />
        </Link>

        <ul className="login-facts">
          <li>
            <Icon name="fingerprint" size={15} />
            <span>
              <strong>비밀번호를 보관하지 않습니다</strong>
              Clunk는 자체 이메일과 비밀번호 데이터베이스를 만들지 않습니다.
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

        <p className="login-boundary">
          비공개 파일럿에서는 ChatGPT 로그인만 사용합니다. Google, Apple, 이메일 계정은 받지 않습니다.
        </p>

        <Link className="login-back" href="/">
          <Icon name="arrowRight" size={14} />
          홈으로 돌아가기
        </Link>
      </section>

      <footer className="login-footer">
        <span>Clunk, 3D 에셋 품질 게이트</span>
        <span className="demo-marker">DEMO MODE · 실제 결제 아님</span>
      </footer>
    </main>
  );
}
