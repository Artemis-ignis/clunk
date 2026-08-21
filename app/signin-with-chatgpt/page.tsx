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
  description: "Clunk 워크스페이스에 들어갈 로그인 방법을 고릅니다.",
};

/**
 * /signin-with-chatgpt is the Sites host's sign-in interception path: in production the
 * host handles it before the app and returns the user with oai-* headers. This page only
 * renders when no host interception happened — the app's own domain, or a deployment the
 * host does not front.
 *
 * It used to answer that case by telling the visitor to open a development proxy on port
 * 3005, which is an instruction only the person who built the app can act on. It now
 * offers the sign-in methods this deployment really has, and when there are none it says
 * so instead of handing out a port number.
 */
export default async function SignInGatewayPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const returnTo = safeReturnPath(params.return_to ?? "/app");

  if (user) {
    const { redirect } = await import("next/navigation");
    redirect(returnTo);
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
          <BrandLockup gradientId="clunk-signin" />
        </Link>
        <span className="login-topbar-end">
          <span className="mono-label">로그인</span>
          <ThemeToggle />
        </span>
      </header>

      <section className="login-card" aria-labelledby="signin-title">
        <span className="login-card-chip">
          <Icon name="shield" size={13} />
          비밀번호 없는 로그인
        </span>

        <h1 id="signin-title">
          로그인 방법을
          <br />
          <em>고르세요.</em>
        </h1>
        <p className="login-lead">
          로그인하면 <code>{returnTo}</code>로 돌아갑니다. 계정을 확인하는 즉시 비공개 워크스페이스가
          준비됩니다.
        </p>

        {/* The gateway must not offer a link back to itself. */}
        <LoginMethods returnTo={returnTo} exclude={["chatgpt"]} />

        <ul className="login-facts">
          <li>
            <Icon name="fingerprint" size={15} />
            <div>
              <strong>비밀번호는 없습니다</strong>
              <span>
                Clunk는 자체 비밀번호를 만들지 않습니다. 로그인한 계정 제공자가 확인해 준 신원만
                사용합니다.
              </span>
            </div>
          </li>
          <li>
            <Icon name="shield" size={15} />
            <div>
              <strong>워크스페이스는 계정별로 분리됩니다</strong>
              <span>검사 이력과 크레딧, Passport는 로그인한 계정에만 연결됩니다.</span>
            </div>
          </li>
        </ul>

        <Link className="login-back" href="/">
          <Icon name="arrowRight" size={14} />
          홈으로 돌아가기
        </Link>
      </section>
    </main>
  );
}
