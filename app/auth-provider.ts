/**
 * The one place the app asks "who is this request?".
 *
 * Before this, every authenticated surface imported `requireChatGPTUser` directly, which
 * baked one specific mechanism — headers injected by the ChatGPT Sites host — into eight
 * call sites. Outside that host there was no way to sign in at all and no place to add
 * one. Identity now resolves through an ordered list of providers behind
 * `getCurrentUser()` / `requireUser()`, and adding a mechanism means adding a list entry
 * rather than editing pages.
 *
 * Provider order is deliberate. The SIWC headers win when present: inside the Sites host
 * they are the authoritative identity for that request, and the worker already strips
 * them on any host not declared in `CLUNK_TRUSTED_AUTH_HOSTS`. The signed session cookie
 * is the fallback, which is what makes the app usable on its own domain.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthDatabase, readAuthEnv } from "./auth-env";
import {
  getChatGPTUser,
  chatGPTSignInPath,
  chatGPTSignOutPath,
  safeReturnPath,
} from "./chatgpt-auth";
import { isGitHubAuthEnabled, GITHUB_START_PATH } from "./auth-github";
import { readCookie, readSessionCookieValue, SESSION_COOKIE } from "./auth-session";

export type AuthProviderId = "chatgpt" | "github";

export type AuthUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
  /** Which mechanism proved this identity for the current request. */
  provider: AuthProviderId;
};

type AuthProvider = {
  id: AuthProviderId;
  resolve: () => Promise<AuthUser | null>;
};

/** Ordered: host-injected identity first, signed cookie second. */
const PROVIDERS: AuthProvider[] = [
  {
    id: "chatgpt",
    resolve: async () => {
      const user = await getChatGPTUser();
      return user ? { ...user, provider: "chatgpt" } : null;
    },
  },
  {
    id: "github",
    resolve: resolveSessionUser,
  },
];

export async function getCurrentUser(): Promise<AuthUser | null> {
  for (const provider of PROVIDERS) {
    const user = await provider.resolve();
    if (user) return user;
  }
  return null;
}

export async function requireUser(returnTo: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (user) return user;
  redirect(signInPath(returnTo));
}

/**
 * Unchanged on purpose. `/signin-with-chatgpt` is the path the Sites host intercepts
 * before the app ever sees it, so redirecting anywhere else would break sign-in inside
 * the host. When the host does not intercept, that route now renders the same method
 * chooser as `/login` instead of a dead end.
 */
export function signInPath(returnTo: string): string {
  return chatGPTSignInPath(returnTo);
}

export function signOutPath(provider: AuthProviderId, returnTo = "/"): string {
  return provider === "chatgpt" ? chatGPTSignOutPath(returnTo) : SELF_SIGN_OUT_PATH;
}

export const SELF_SIGN_OUT_PATH = "/api/auth/signout";

export { safeReturnPath };

/* --------------------------------------------------------------- sign-in menu */

export type AuthMethod = {
  id: AuthProviderId;
  href: string;
};

/**
 * What the login screen is allowed to offer. A method that is not configured is not
 * listed — an unconfigured button is a broken promise, not a feature preview.
 */
export async function getAvailableAuthMethods(returnTo: string): Promise<AuthMethod[]> {
  const methods: AuthMethod[] = [];
  if (await isChatGPTHostAvailable()) {
    methods.push({ id: "chatgpt", href: chatGPTSignInPath(returnTo) });
  }
  if (isGitHubAuthEnabled()) {
    methods.push({
      id: "github",
      href: `${GITHUB_START_PATH}?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`,
    });
  }
  return methods;
}

/**
 * Mirrors the worker's trusted-host gate. Offering "continue with ChatGPT" on a host
 * whose `oai-*` headers the worker strips would send the visitor around a loop that can
 * never authenticate, so the option only appears where those headers are honoured.
 */
export async function isChatGPTHostAvailable(): Promise<boolean> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  if (!host) return false;
  const hostname = host.replace(/:\d+$/, "").toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") return true;
  const trusted = readAuthEnv("CLUNK_TRUSTED_AUTH_HOSTS");
  if (!trusted) return false;
  return trusted
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(hostname);
}

/* ------------------------------------------------------------ session provider */

async function resolveSessionUser(): Promise<AuthUser | null> {
  const requestHeaders = await headers();
  const raw = readCookie(requestHeaders.get("cookie"), SESSION_COOKIE);
  if (!raw) return null;
  const payload = await readSessionCookieValue(raw);
  if (!payload) return null;

  const db = getAuthDatabase();
  if (!db) return null;

  try {
    // Identity is read back from storage every request rather than carried in the cookie,
    // so erasing an account through /api/account actually signs it out.
    const row = await db
      .prepare(`SELECT id, email, display_name AS displayName FROM clunk_users WHERE id = ?`)
      .bind(payload.sub)
      .first<{ id: string; email: string; displayName: string }>();
    if (!row) return null;
    return {
      userId: row.id,
      displayName: row.displayName,
      email: row.email,
      fullName: row.displayName || null,
      provider: "github",
    };
  } catch (error) {
    // A missing table on a freshly provisioned database is a signed-out visitor, not a 500.
    console.error("[clunk:auth] session lookup failed", error);
    return null;
  }
}
