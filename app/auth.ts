import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  AUTH_SESSION_COOKIE,
  decodeOAuthSession,
  getOAuthEnvironment,
} from "./oauth";
import { getRuntimeEnvironment } from "./runtime-environment";
import {
  UPSTREAM_IDENTITY_FULL_NAME_ENCODING_HEADER,
  UPSTREAM_IDENTITY_FULL_NAME_HEADER,
  UPSTREAM_IDENTITY_USER_EMAIL_HEADER,
  UPSTREAM_IDENTITY_USER_ID_HEADER,
  trustsUpstreamIdentityHeaders,
} from "./api/_lib/identity-headers";

export type AuthProvider = "chatgpt-sites" | "google" | "github" | (string & {});

export type AuthUser = {
  id: string;
  displayName: string;
  email: string;
  fullName: string | null;
  provider: AuthProvider;
  /** Stable provider subject; never derive account identity from a mutable email. */
  providerAccountId?: string;
};

export type AuthIdentity = {
  userId: string;
  provider: AuthProvider;
  providerAccountId: string;
  email: string;
};

// The literals stay spelled out here so the header contract is readable at the
// auth boundary, while the `typeof` annotations make any drift away from the
// shared definition in `api/_lib/identity-headers` a compile error.
const USER_ID_HEADER: typeof UPSTREAM_IDENTITY_USER_ID_HEADER =
  "oai-authenticated-user-id";
const USER_EMAIL_HEADER: typeof UPSTREAM_IDENTITY_USER_EMAIL_HEADER =
  "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER: typeof UPSTREAM_IDENTITY_FULL_NAME_HEADER =
  "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER: typeof UPSTREAM_IDENTITY_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
// 2026-08-31: the Sites-host gateway is gone; /login is the only sign-in door.
const SIGN_IN_PATH = "/login";
// 2026-09-03: a visitor stopped by a guard has never been here — the door that
// matches them is /signup. /login stays for the person who says "로그인".
const SIGN_UP_PATH = "/signup";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";

/**
 * Resolve the authenticated principal. Browser-provided identity fields are
 * never consulted.
 *
 * Trust model, in priority order:
 *
 * 1. The HMAC-signed local OAuth session cookie. It is verified here, so it is
 *    checked FIRST — an upstream identity header can never displace a real
 *    signed session, even on a deployment that trusts those headers.
 * 2. The host's `oai-authenticated-user-*` headers, and only when the runtime
 *    sets `CLUNK_TRUST_SIWC_HEADERS="1"`. Without that flag the headers are not
 *    read at all, because on any deployment that is not behind the ChatGPT
 *    Sites identity proxy they are attacker-controlled request headers.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const environment = getOAuthEnvironment(getRuntimeEnvironment());

  const session = await readSignedSessionUser(environment);
  if (session) return session;

  if (!trustsUpstreamIdentityHeaders(environment)) return null;
  return await readUpstreamIdentityUser();
}

/** Verified, self-owned session. Never inferred from an unsigned value. */
async function readSignedSessionUser(
  environment: Record<string, string | undefined>,
): Promise<AuthUser | null> {
  try {
    const sessionSecret = environment.CLUNK_AUTH_SESSION_SECRET;
    const session = (await cookies()).get(AUTH_SESSION_COOKIE)?.value;
    if (!session || !sessionSecret) return null;
    return await decodeOAuthSession(session, sessionSecret);
  } catch {
    return null;
  }
}

/**
 * Host-injected identity. Only reached when the trust flag is on; the parsing
 * itself (including percent-encoded full names) is unchanged.
 */
async function readUpstreamIdentityUser(): Promise<AuthUser | null> {
  try {
    const requestHeaders = await headers();
    const id = requestHeaders.get(USER_ID_HEADER)?.trim() ?? "";
    const email = requestHeaders.get(USER_EMAIL_HEADER)?.trim() ?? "";
    if (!id || !email) return null;

    const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
    const fullName =
      encodedFullName &&
      requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
        ? safeDecodeURIComponent(encodedFullName)
        : null;

    return {
      id,
      providerAccountId: id,
      displayName: fullName ?? email,
      email,
      fullName,
      provider: "chatgpt-sites",
    };
  } catch {
    return null;
  }
}

/**
 * A guard never knows the visitor, so it must not assume they already have an account.
 * Everyone stopped here goes to /signup, which carries the same return path (intent and
 * all) and links to /login in one line for the people who do have an account.
 */
export async function requireUser(returnTo: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (user) return user;

  redirect(signUpPath(returnTo));
}

export async function getCurrentIdentity(): Promise<AuthIdentity | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  return {
    userId: user.id,
    provider: user.provider,
    providerAccountId: user.providerAccountId ?? user.id,
    email: user.email,
  };
}

/**
 * Return the configured provider's safe sign-out route. The actual provider
 * owns the session termination; Clunk does not manufacture a local session.
 */
export function signOut(returnTo = "/"): string {
  return signOutPath(returnTo);
}

export function signInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

/** The first-run door. Same validated return path, different words on the other side. */
export function signUpPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_UP_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function signOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignInPath(returnTo: string): string {
  return signInPath(returnTo);
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  return signOutPath(returnTo);
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_UP_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value) || null;
  } catch {
    return null;
  }
}
