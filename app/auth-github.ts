/**
 * GitHub OAuth provider.
 *
 * The audience is game developers, so a GitHub account is the one credential nearly all
 * of them already have. This is an authorization-code flow driven with plain `fetch`:
 * no OAuth library is installed, and no provider token is ever persisted or handed to
 * the browser — the access token lives only for the two API calls that read the profile.
 *
 * The provider is inert unless BOTH `CLUNK_GITHUB_CLIENT_ID` and
 * `CLUNK_GITHUB_CLIENT_SECRET` are set AND `CLUNK_SESSION_SECRET` can sign the resulting
 * session. Without a signing key an authorization round trip would end with nothing to
 * issue, so the button is hidden rather than leading to a dead end.
 */
import { readAuthEnv } from "./auth-env";
import { isSessionSigningAvailable } from "./auth-session";

const AUTHORIZE_ENDPOINT = "https://github.com/login/oauth/authorize";
const TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
const USER_ENDPOINT = "https://api.github.com/user";
const USER_EMAILS_ENDPOINT = "https://api.github.com/user/emails";

/** `read:user` for the profile, `user:email` so a private primary address is still reachable. */
export const GITHUB_SCOPE = "read:user user:email";

/** Provider prefix for `clunk_users.id`. Keeps GitHub ids from colliding with SIWC ids. */
export const GITHUB_USER_PREFIX = "github:";

export const GITHUB_CALLBACK_PATH = "/api/auth/github/callback";
export const GITHUB_START_PATH = "/api/auth/github/start";

export type GitHubConfig = { clientId: string; clientSecret: string };

export type GitHubIdentity = {
  userId: string;
  login: string;
  displayName: string;
  email: string;
  /** True when the address came from GitHub; false when it is the synthesised noreply alias. */
  emailVerified: boolean;
};

export function getGitHubConfig(): GitHubConfig | null {
  const clientId = readAuthEnv("CLUNK_GITHUB_CLIENT_ID");
  const clientSecret = readAuthEnv("CLUNK_GITHUB_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** Single source of truth for "show the GitHub button" and "let the start route run". */
export function isGitHubAuthEnabled(): boolean {
  return Boolean(getGitHubConfig()) && isSessionSigningAvailable();
}

/**
 * Why the provider is off, so the start route can answer with something actionable
 * instead of a generic 404.
 */
export function gitHubAuthDisabledReason(): "client_credentials_missing" | "session_secret_missing" | null {
  if (!getGitHubConfig()) return "client_credentials_missing";
  if (!isSessionSigningAvailable()) return "session_secret_missing";
  return null;
}

/**
 * The callback URL is derived from the origin the request actually arrived on rather than
 * from a configured canonical origin: the app is reachable on the Sites host, on its own
 * domain and on localhost, and GitHub matches the redirect against the app registration.
 */
export function gitHubRedirectUri(request: Request): string {
  return new URL(GITHUB_CALLBACK_PATH, new URL(request.url).origin).toString();
}

export function gitHubAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", GITHUB_SCOPE);
  url.searchParams.set("state", input.state);
  url.searchParams.set("allow_signup", "true");
  return url.toString();
}

/** Exchange the authorization code. Returns null on any provider-side failure. */
export async function exchangeGitHubCode(input: {
  config: GitHubConfig;
  code: string;
  redirectUri: string;
}): Promise<string | null> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "clunk-auth",
    },
    body: new URLSearchParams({
      client_id: input.config.clientId,
      client_secret: input.config.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
    }).toString(),
  });
  if (!response.ok) return null;
  const body = (await response.json().catch(() => null)) as
    | { access_token?: unknown; error?: unknown }
    | null;
  const token = body?.access_token;
  return typeof token === "string" && token.length > 0 ? token : null;
}

/**
 * Read the identity behind an access token.
 *
 * Email resolution, in order:
 *   1. the public profile email, when GitHub exposes one;
 *   2. `/user/emails`, preferring primary+verified, then any verified address;
 *   3. GitHub's own `<id>+<login>@users.noreply.github.com` alias.
 *
 * Step 3 exists because a GitHub account with every address private is a perfectly normal
 * account, and rejecting it would block exactly the privacy-conscious developers this is
 * meant to serve. `clunk_users.email` is NOT NULL, so the alias fills the column with a
 * value that is stable, unique per account, and honest about being unverified — Clunk
 * sends no mail, so nothing downstream treats it as a reachable inbox.
 */
export async function fetchGitHubIdentity(accessToken: string): Promise<GitHubIdentity | null> {
  const profileResponse = await fetch(USER_ENDPOINT, {
    headers: gitHubApiHeaders(accessToken),
  });
  if (!profileResponse.ok) return null;
  const profile = (await profileResponse.json().catch(() => null)) as {
    id?: unknown;
    login?: unknown;
    name?: unknown;
    email?: unknown;
  } | null;
  if (!profile) return null;

  const numericId = typeof profile.id === "number" ? profile.id : Number(profile.id);
  const login = typeof profile.login === "string" ? profile.login : "";
  if (!Number.isSafeInteger(numericId) || numericId <= 0 || !login) return null;

  let email = typeof profile.email === "string" && profile.email.includes("@") ? profile.email : null;
  let emailVerified = Boolean(email);

  if (!email) {
    const resolved = await fetchGitHubPrimaryEmail(accessToken);
    if (resolved) {
      email = resolved;
      emailVerified = true;
    }
  }
  if (!email) {
    email = `${numericId}+${login}@users.noreply.github.com`;
    emailVerified = false;
  }

  const name = typeof profile.name === "string" && profile.name.trim() !== "" ? profile.name.trim() : null;

  return {
    userId: `${GITHUB_USER_PREFIX}${numericId}`,
    login,
    displayName: name ?? login,
    email,
    emailVerified,
  };
}

async function fetchGitHubPrimaryEmail(accessToken: string): Promise<string | null> {
  const response = await fetch(USER_EMAILS_ENDPOINT, { headers: gitHubApiHeaders(accessToken) });
  // A token without the user:email scope answers 403 here; that is not fatal, the caller
  // falls back to the noreply alias.
  if (!response.ok) return null;
  const rows = (await response.json().catch(() => null)) as unknown;
  if (!Array.isArray(rows)) return null;
  const entries = rows.filter(
    (row): row is { email: string; primary?: boolean; verified?: boolean } =>
      Boolean(row) &&
      typeof row === "object" &&
      typeof (row as { email?: unknown }).email === "string" &&
      (row as { email: string }).email.includes("@"),
  );
  const primaryVerified = entries.find((row) => row.primary === true && row.verified === true);
  if (primaryVerified) return primaryVerified.email;
  const anyVerified = entries.find((row) => row.verified === true);
  return anyVerified?.email ?? null;
}

function gitHubApiHeaders(accessToken: string): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${accessToken}`,
    "x-github-api-version": "2022-11-28",
    // GitHub rejects API calls without a User-Agent.
    "user-agent": "clunk-auth",
  };
}
