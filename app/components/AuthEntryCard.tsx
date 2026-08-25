import Link from "./NativeLink";
import { chatGPTSignInPath, chatGPTSignOutPath, type ChatGPTUser } from "../chatgpt-auth";
import { BrandLockup } from "./BrandMark";
import { Icon } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";

export function AuthEntryCard({
  mode,
  user,
  returnTo,
}: {
  mode: "login" | "signup";
  user: ChatGPTUser | null;
  returnTo: string;
}) {
  const isSignup = mode === "signup";

  return (
    <main className="login-page">
      <div className="login-orbs" aria-hidden="true">
        <span className="login-orb login-orb-1" />
        <span className="login-orb login-orb-2" />
        <span className="login-orb login-orb-3" />
      </div>

      <header className="login-topbar">
        <Link className="brand" href="/" prefetch={false} aria-label="Clunk 홈">
          <BrandLockup gradientId={isSignup ? "clunk-signup" : "clunk-login"} />
        </Link>
        <span className="login-topbar-end">
          <span className="mono-label">비공개 파일럿</span>
          <ThemeToggle />
        </span>
      </header>

      <section className="login-card" aria-labelledby="auth-entry-title">
        <span className="login-card-chip">
          <Icon name={user ? "circleCheck" : "shield"} size={13} />
          {user ? "SIWC 연결됨" : "ChatGPT SIWC"}
        </span>

        {user ? (
          <>
            <h1 id="auth-entry-title">
              이미 Clunk에
              <br />
              <em>연결되어 있습니다.</em>
            </h1>
            <p className="login-lead">
              {user.displayName}님, 현재 ChatGPT 계정으로 인증된 워크스페이스를 사용 중입니다. 로그인과 회원가입은
              같은 SIWC 흐름이며 별도 비밀번호는 없습니다.
            </p>

            <div className="login-session-actions">
              <Link className="button button-primary button-block" href={isSignup ? "/dashboard" : "/app"} prefetch={false}>
                {isSignup ? "대시보드 열기" : "검사기 열기"}
                <Icon name="arrowUpRight" size={16} />
              </Link>
              <Link className="button button-quiet button-block" href={isSignup ? "/app" : "/dashboard"} prefetch={false}>
                {isSignup ? "검사기 열기" : "대시보드 열기"}
                <Icon name="arrowRight" size={15} />
              </Link>
            </div>

            <p className="login-session-note">
              현재 계정: <strong>{user.email}</strong>
            </p>
            <Link className="login-back" href={chatGPTSignOutPath(returnTo)} prefetch={false}>
              <Icon name="reset" size={14} />
              다른 ChatGPT 계정으로 전환
            </Link>
          </>
        ) : (
          <>
            <h1 id="auth-entry-title">
              {isSignup ? "워크스페이스를" : "워크스페이스로"}
              <br />
              <em>{isSignup ? "만듭니다." : "들어갑니다."}</em>
            </h1>
            <p className="login-lead">
              ChatGPT 계정으로 {isSignup ? "시작하면 워크스페이스가 만들어집니다" : "로그인하면 곧 회원가입입니다"}. 따로 가입
              절차를 밟지 않아도 됩니다.
            </p>

            <Link className="button button-primary button-block login-cta" href={chatGPTSignInPath(returnTo)} prefetch={false}>
              ChatGPT 계정으로 {isSignup ? "회원가입하기" : "시작하기"}
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

            <p className="login-account-switch">
              {isSignup ? "이미 시작했다면" : "처음이라면"}{" "}
              <Link href={isSignup ? "/login" : "/signup"} prefetch={false}>
                {isSignup ? "로그인 화면으로" : "회원가입 화면으로"}
              </Link>
            </p>
          </>
        )}

        <Link className="login-back" href="/" prefetch={false}>
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
