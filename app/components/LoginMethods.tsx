import Link from "next/link";
import { Icon } from "./Icon";
import { getAvailableAuthMethods, type AuthProviderId } from "../auth-provider";

/**
 * The sign-in chooser, shared by /login and the /signin-with-chatgpt gateway.
 *
 * It renders only methods that are actually configured on this deployment. A button that
 * leads to an unconfigured provider is worse than no button — the visitor spends a round
 * trip to find out the product cannot let them in. When nothing is available it says so
 * plainly instead of pointing at a developer-only workaround.
 */
export async function LoginMethods({
  returnTo,
  exclude = [],
}: {
  returnTo: string;
  /** Methods to leave out — the gateway page must not link back to itself. */
  exclude?: AuthProviderId[];
}) {
  const methods = (await getAvailableAuthMethods(returnTo)).filter(
    (method) => !exclude.includes(method.id),
  );

  if (methods.length === 0) {
    return (
      <p className="login-boundary">
        지금은 ChatGPT 호스트 안에서만 로그인할 수 있습니다. 이 주소에서는 사용할 수 있는 로그인
        방법이 없습니다. ChatGPT 앱에서 Clunk를 열어 로그인해 주세요.
      </p>
    );
  }

  return (
    <div className="login-methods">
      {methods.map((method, index) => (
        <Link
          key={method.id}
          className={`button ${index === 0 ? "button-primary login-cta" : "button-quiet"} button-block`}
          href={method.href}
          prefetch={false}
        >
          {method.id === "github" ? <GitHubMark /> : <Icon name="shield" size={16} />}
          {method.id === "github" ? "GitHub 계정으로 계속하기" : "ChatGPT 계정으로 계속하기"}
          <Icon name="arrowUpRight" size={16} />
        </Link>
      ))}
    </div>
  );
}

/** lucide-react 1.x dropped brand marks, so the Octicon path is inlined rather than added to Icon. */
function GitHubMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
