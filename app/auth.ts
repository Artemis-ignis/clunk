import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type AuthProvider = "chatgpt-sites" | "google" | "github" | (string & {});

export type AuthUser = {
  id: string;
  displayName: string;
  email: string;
  fullName: string | null;
  provider: AuthProvider;
};

export type AuthIdentity = {
  userId: string;
  provider: AuthProvider;
  providerAccountId: string;
  email: string;
};

const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";

/**
 * Resolve the authenticated principal from the hosting provider's server-side
 * identity headers. Browser-provided identity fields are never consulted.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
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
    displayName: fullName ?? email,
    email,
    fullName,
    provider: "chatgpt-sites",
  };
}

export async function requireUser(returnTo: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (user) return user;

  redirect(signInPath(returnTo));
}

export async function getCurrentIdentity(): Promise<AuthIdentity | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  return {
    userId: user.id,
    provider: user.provider,
    providerAccountId: user.id,
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
