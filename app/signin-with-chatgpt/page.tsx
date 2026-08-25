import type { Metadata } from "next";
import Link from "../components/NativeLink";
import { getChatGPTUser } from "../chatgpt-auth";
import { BrandLockup } from "../components/BrandMark";
import { Icon } from "../components/Icon";
import { ThemeToggle } from "../components/ThemeToggle";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "ChatGPT 로그인",
  description: "ChatGPT SIWC 인증 게이트웨이 경로입니다.",
};

/**
 * /signin-with-chatgpt is the Sites host's sign-in interception path: in production the host
 * handles it before the app and returns the user with oai-* headers. This page only renders
 * when no host interception happened (local dev, or a misconfigured deployment), so instead
 * of a 404 it explains the boundary and offers real ways forward. It never fakes an identity.
 */
export default async function SignInGatewayPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  const user = await getChatGPTUser();
  const params = await searchParams;
  const returnTo = params.return_to?.startsWith("/") && !params.return_to.startsWith("//")
    ? params.return_to
    : "/app";

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
          <span className="mono-label">SIWC 게이트웨이</span>
          <ThemeToggle />
        </span>
      </header>

      <section className="login-card" aria-labelledby="signin-title">
        <span className="login-card-chip">
          <Icon name="shield" size={13} />
          ChatGPT SIWC
        </span>

        <h1 id="signin-title">
          호스트 인증이
          <br />
          <em>필요한 경로입니다.</em>
        </h1>
        <p className="login-lead">
          운영 환경에서는 이 주소에서 Sites 호스트가 ChatGPT 로그인을 처리한 뒤{" "}
          <code>{returnTo}</code>로 돌려보냅니다. 지금은 호스트 인증 밖에서 열렸기 때문에 로그인을
          진행할 수 없습니다.
        </p>

        <ul className="login-facts">
          <li>
            <Icon name="fingerprint" size={15} />
            <div>
              <strong>로컬 데모로 보시려면</strong>
              <span>
                데모 프록시 주소(포트 3005)로 접속하면 로그인 없이 인증된 워크스페이스를 그대로
                볼 수 있습니다.
              </span>
            </div>
          </li>
          <li>
            <Icon name="shield" size={15} />
            <div>
              <strong>비밀번호는 없습니다</strong>
              <span>Clunk는 자체 계정과 비밀번호를 만들지 않고 ChatGPT가 전달한 인증 헤더만 신뢰합니다.</span>
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
