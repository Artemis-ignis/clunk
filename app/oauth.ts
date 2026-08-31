/**
 * Provider-neutral OAuth primitives for Clunk.
 *
 * This module deliberately contains no framework or database code. It owns the
 * cryptographic and provider-response contracts; route handlers own cookies,
 * redirects, and workspace provisioning. That makes the security boundary
 * testable without contacting Google or GitHub.
 */

// "qa" is not a real OAuth provider: it never appears in authorize/callback
// flows (getOAuthProviderStatus reports it unconfigured) and exists only so
// the QA sign-in route can mint the same signed first-party session that the
// PKCE callbacks mint. Sessions stay verifiable by one code path either way.
export type OAuthProvider = "google" | "github" | "qa";

export type OAuthEnvironment = Record<string, string | undefined>;

export type OAuthProfile = {
  id: string;
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  displayName: string;
  fullName: string | null;
};

export type OAuthProviderStatus = {
  provider: OAuthProvider;
  configured: boolean;
  missing: string[];
};

export type OAuthAuthorization = {
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
  provider: OAuthProvider;
  returnTo: string;
};

export type OAuthTransaction = {
  provider: OAuthProvider;
  returnTo: string;
  state: string;
  nonce: string;
  codeVerifier: string;
  issuedAt: number;
  expiresAt: number;
};

export const AUTH_SESSION_COOKIE = "clunk_auth_session";
export const OAUTH_TRANSACTION_COOKIE_PREFIX = "clunk_oauth_tx_";
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;
export const AUTH_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

const OAUTH_STATE_SECRET = "CLUNK_OAUTH_STATE_SECRET";
const AUTH_SESSION_SECRET = "CLUNK_AUTH_SESSION_SECRET";

const PROVIDER_KEYS: Record<Exclude<OAuthProvider, "qa">, {
  clientId: string[];
  clientSecret: string[];
  redirectUri: string[];
  authorizeUrl: string;
  tokenUrl: string;
}> = {
  google: {
    clientId: ["GOOGLE_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_ID"],
    clientSecret: ["GOOGLE_CLIENT_SECRET", "GOOGLE_OAUTH_CLIENT_SECRET"],
    redirectUri: ["GOOGLE_REDIRECT_URI", "GOOGLE_OAUTH_REDIRECT_URI"],
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
  },
  github: {
    clientId: ["GITHUB_CLIENT_ID", "GITHUB_OAUTH_CLIENT_ID"],
    clientSecret: ["GITHUB_CLIENT_SECRET", "GITHUB_OAUTH_CLIENT_SECRET"],
    redirectUri: ["GITHUB_REDIRECT_URI", "GITHUB_OAUTH_REDIRECT_URI"],
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
  },
};

export class OAuthConfigurationError extends Error {
  readonly code = "CONFIG_REQUIRED";

  constructor(message: string) {
    super(message);
    this.name = "OAuthConfigurationError";
  }
}

export class OAuthSecurityError extends Error {
  readonly code = "OAUTH_SECURITY_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "OAuthSecurityError";
  }
}

export class OAuthExchangeError extends Error {
  readonly code = "OAUTH_EXCHANGE_FAILED";

  constructor(message: string) {
    super(message);
    this.name = "OAuthExchangeError";
  }
}

/** Merge a route-provided runtime environment with process variables. */
export function getOAuthEnvironment(
  overrides: Record<string, unknown> = {},
): OAuthEnvironment {
  const environment: OAuthEnvironment = {};
  if (typeof process !== "undefined" && process.env) {
    for (const [name, value] of Object.entries(process.env)) {
      if (typeof value === "string") environment[name] = value;
    }
  }
  for (const [name, value] of Object.entries(overrides)) {
    if (typeof value === "string") environment[name] = value;
  }
  return environment;
}

export function isOAuthProvider(value: unknown): value is OAuthProvider {
  return value === "google" || value === "github" || value === "qa";
}

export function oauthTransactionCookieName(provider: OAuthProvider): string {
  return `${OAUTH_TRANSACTION_COOKIE_PREFIX}${provider}`;
}

export function getOAuthProviderStatus(
  provider: OAuthProvider,
  environment: OAuthEnvironment = getOAuthEnvironment(),
): OAuthProviderStatus {
  if (provider === "qa") {
    // QA sign-in is key-gated, not OAuth-configured: reporting it unconfigured
    // keeps it out of every authorize/callback surface that consults status.
    return { provider, configured: false, missing: ["QA_SIGNIN_IS_NOT_OAUTH"] };
  }
  const keys = PROVIDER_KEYS[provider];
  const missing: string[] = [];
  if (!firstValue(environment, keys.clientId)) missing.push(keys.clientId[0]);
  if (!firstValue(environment, keys.clientSecret)) missing.push(keys.clientSecret[0]);
  if (!firstValue(environment, keys.redirectUri)) missing.push(keys.redirectUri[0]);
  return { provider, configured: missing.length === 0, missing };
}

export function getOAuthProviderStatuses(
  environment: OAuthEnvironment = getOAuthEnvironment(),
): OAuthProviderStatus[] {
  return [
    getOAuthProviderStatus("google", environment),
    getOAuthProviderStatus("github", environment),
  ];
}

export async function createOAuthAuthorization(
  provider: OAuthProvider,
  input: {
    returnTo?: string;
    env?: OAuthEnvironment;
    now?: number;
    randomBytes?: (length: number) => Uint8Array;
    stateSecret?: string;
  },
): Promise<OAuthAuthorization> {
  const environment = input.env ?? getOAuthEnvironment();
  const config = getOAuthProviderConfig(provider, environment);
  if (!config) {
    const missing = getOAuthProviderStatus(provider, environment).missing.join(", ");
    throw new OAuthConfigurationError(`OAuth provider configuration is incomplete: ${missing}.`);
  }
  const stateSecret = input.stateSecret ?? environment[OAUTH_STATE_SECRET];
  requireSecret(stateSecret, OAUTH_STATE_SECRET);

  const now = toSeconds(input.now);
  const randomBytes = input.randomBytes ?? defaultRandomBytes;
  const nonce = randomToken(randomBytes, 32);
  const codeVerifier = randomToken(randomBytes, 32);
  const returnTo = safeOAuthReturnPath(input.returnTo ?? "/");
  const state = await signPayload({
    schema: "clunk.oauth-state.v1",
    provider,
    returnTo,
    nonce,
    issuedAt: now,
    expiresAt: now + OAUTH_STATE_TTL_SECONDS,
  }, stateSecret);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  if (provider === "google") {
    params.set("scope", "openid email profile");
    params.set("nonce", nonce);
    params.set("access_type", "offline");
    params.set("prompt", "select_account");
  } else {
    params.set("scope", "read:user user:email");
  }

  return {
    url: `${config.authorizeUrl}?${params.toString()}`,
    state,
    nonce,
    codeVerifier,
    provider,
    returnTo,
  };
}

export async function verifyOAuthState(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<{ provider: OAuthProvider; returnTo: string; nonce: string }> {
  const payload = await readSignedPayload(token, secret);
  const current = toSeconds(now);
  if (
    !isRecord(payload) ||
    payload.schema !== "clunk.oauth-state.v1" ||
    !isOAuthProvider(payload.provider) ||
    typeof payload.returnTo !== "string" ||
    typeof payload.nonce !== "string" ||
    !isSafeInteger(payload.issuedAt) ||
    !isSafeInteger(payload.expiresAt) ||
    current >= payload.expiresAt ||
    payload.issuedAt > current + 60
  ) {
    throw new OAuthSecurityError("OAuth state is invalid or expired.");
  }
  return {
    provider: payload.provider,
    returnTo: safeOAuthReturnPath(payload.returnTo),
    nonce: payload.nonce,
  };
}

export async function encodeOAuthTransaction(
  authorization: OAuthAuthorization,
  secret: string,
  now = Date.now(),
): Promise<string> {
  requireSecret(secret, OAUTH_STATE_SECRET);
  const issuedAt = toSeconds(now);
  return signPayload({
    schema: "clunk.oauth-transaction.v1",
    provider: authorization.provider,
    returnTo: safeOAuthReturnPath(authorization.returnTo),
    state: authorization.state,
    nonce: authorization.nonce,
    codeVerifier: authorization.codeVerifier,
    issuedAt,
    expiresAt: issuedAt + OAUTH_STATE_TTL_SECONDS,
  }, secret);
}

export async function decodeOAuthTransaction(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<OAuthTransaction> {
  const payload = await readSignedPayload(token, secret);
  const current = toSeconds(now);
  if (
    !isRecord(payload) ||
    payload.schema !== "clunk.oauth-transaction.v1" ||
    !isOAuthProvider(payload.provider) ||
    typeof payload.returnTo !== "string" ||
    typeof payload.state !== "string" ||
    typeof payload.nonce !== "string" ||
    typeof payload.codeVerifier !== "string" ||
    !isSafeInteger(payload.issuedAt) ||
    !isSafeInteger(payload.expiresAt) ||
    current >= payload.expiresAt ||
    payload.issuedAt > current + 60
  ) {
    throw new OAuthSecurityError("OAuth transaction is invalid or expired.");
  }
  return {
    provider: payload.provider,
    returnTo: safeOAuthReturnPath(payload.returnTo),
    state: payload.state,
    nonce: payload.nonce,
    codeVerifier: payload.codeVerifier,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
}

export async function exchangeOAuthCode(
  provider: OAuthProvider,
  code: string,
  redirectUri: string,
  codeVerifier: string,
  fetchImpl: typeof fetch = fetch,
  environment: OAuthEnvironment = getOAuthEnvironment(),
): Promise<OAuthProfile> {
  if (!code.trim() || !codeVerifier.trim()) {
    throw new OAuthExchangeError("OAuth authorization code is missing.");
  }
  const config = getOAuthProviderConfig(provider, environment);
  if (!config) {
    const missing = getOAuthProviderStatus(provider, environment).missing.join(", ");
    throw new OAuthConfigurationError(`OAuth provider configuration is incomplete: ${missing}.`);
  }
  if (redirectUri !== config.redirectUri) {
    throw new OAuthSecurityError("OAuth redirect URI does not match deployment configuration.");
  }

  const tokenResponse = await fetchImpl(config.tokenUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });
  const tokenPayload = await readResponseJson(tokenResponse);
  if (!tokenResponse.ok || !isRecord(tokenPayload) || typeof tokenPayload.access_token !== "string") {
    throw new OAuthExchangeError("OAuth token exchange was rejected by the provider.");
  }
  const accessToken = tokenPayload.access_token;

  if (provider === "google") {
    const profileResponse = await fetchImpl("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
      },
    });
    const profile = await readResponseJson(profileResponse);
    if (
      !profileResponse.ok ||
      !isRecord(profile) ||
      typeof profile.sub !== "string" ||
      typeof profile.email !== "string" ||
      profile.email_verified !== true
    ) {
      throw new OAuthExchangeError("Google did not return a verified account profile.");
    }
    const fullName = optionalString(profile.name);
    const email = normalizeEmail(profile.email);
    return {
      id: `google:${profile.sub}`,
      provider: "google",
      providerAccountId: profile.sub,
      email,
      displayName: fullName ?? email,
      fullName,
    };
  }

  const profileResponse = await fetchImpl("https://api.github.com/user", {
    headers: githubHeaders(accessToken),
  });
  const profile = await readResponseJson(profileResponse);
  if (!profileResponse.ok || !isRecord(profile) || (typeof profile.id !== "number" && typeof profile.id !== "string")) {
    throw new OAuthExchangeError("GitHub did not return a valid account profile.");
  }
  let email = typeof profile.email === "string" ? profile.email : null;
  if (!email) {
    const emailsResponse = await fetchImpl("https://api.github.com/user/emails", {
      headers: githubHeaders(accessToken),
    });
    const emails = await readResponseJson(emailsResponse);
    if (emailsResponse.ok && Array.isArray(emails)) {
      const emailEntries: unknown[] = emails;
      const selected = emailEntries.find((entry) => {
        if (!isRecord(entry) || typeof entry.email !== "string") return false;
        return entry.primary === true && entry.verified === true;
      }) ?? emailEntries.find((entry) => isRecord(entry) && typeof entry.email === "string" && entry.verified === true);
      if (isRecord(selected) && typeof selected.email === "string") email = selected.email;
    }
  }
  if (!email) throw new OAuthExchangeError("GitHub did not return a verified email address.");
  const providerAccountId = String(profile.id);
  const fullName = optionalString(profile.name) ?? optionalString(profile.login);
  return {
    id: `github:${providerAccountId}`,
    provider: "github",
    providerAccountId,
    email: normalizeEmail(email),
    displayName: fullName ?? normalizeEmail(email),
    fullName,
  };
}

export async function encodeOAuthSession(
  profile: OAuthProfile,
  secret: string,
  now = Date.now(),
): Promise<string> {
  requireSecret(secret, AUTH_SESSION_SECRET);
  if (!isOAuthProvider(profile.provider) || !profile.providerAccountId || !profile.email || !profile.id) {
    throw new OAuthSecurityError("OAuth profile is incomplete.");
  }
  const issuedAt = toSeconds(now);
  return signPayload({
    schema: "clunk.auth-session.v1",
    id: profile.id,
    provider: profile.provider,
    providerAccountId: profile.providerAccountId,
    email: normalizeEmail(profile.email),
    displayName: profile.displayName,
    fullName: profile.fullName,
    issuedAt,
    expiresAt: issuedAt + AUTH_SESSION_TTL_SECONDS,
  }, secret);
}

export async function decodeOAuthSession(
  value: string,
  secret: string,
  now = Date.now(),
): Promise<{
  id: string;
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  displayName: string;
  fullName: string | null;
} | null> {
  try {
    const payload = await readSignedPayload(value, secret);
    const current = toSeconds(now);
    if (
      !isRecord(payload) ||
      payload.schema !== "clunk.auth-session.v1" ||
      typeof payload.id !== "string" ||
      !isOAuthProvider(payload.provider) ||
      typeof payload.providerAccountId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.displayName !== "string" ||
      (payload.fullName !== null && typeof payload.fullName !== "string") ||
    !isSafeInteger(payload.issuedAt) ||
    !isSafeInteger(payload.expiresAt) ||
      current >= payload.expiresAt
    ) return null;
    return {
      id: payload.id,
      provider: payload.provider,
      providerAccountId: payload.providerAccountId,
      email: normalizeEmail(payload.email),
      displayName: payload.displayName,
      fullName: payload.fullName,
    };
  } catch {
    return null;
  }
}

export function parseCookieHeader(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of (header ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();
    if (!name || !rawValue) continue;
    try {
      cookies.set(name, decodeURIComponent(rawValue));
    } catch {
      // Ignore malformed cookies rather than allowing them into auth logic.
    }
  }
  return cookies;
}

export function serializeOAuthCookie(
  name: string,
  value: string,
  options: {
    maxAge: number;
    path?: string;
    secure: boolean;
    httpOnly?: boolean;
    sameSite?: "Lax" | "Strict";
  },
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path ?? "/"}`, `Max-Age=${Math.max(0, Math.floor(options.maxAge))}`, `SameSite=${options.sameSite ?? "Lax"}`];
  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export function safeOAuthReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  try {
    const url = new URL(value, "https://clunk.local");
    if (url.origin !== "https://clunk.local" || isReservedAuthPath(url.pathname)) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

function getOAuthProviderConfig(provider: OAuthProvider, environment: OAuthEnvironment): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
} | null {
  if (provider === "qa") return null; // key-gated sign-in, not an OAuth provider
  const keys = PROVIDER_KEYS[provider];
  const clientId = firstValue(environment, keys.clientId);
  const clientSecret = firstValue(environment, keys.clientSecret);
  const redirectUri = firstValue(environment, keys.redirectUri);
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri, authorizeUrl: keys.authorizeUrl, tokenUrl: keys.tokenUrl };
}

function firstValue(environment: OAuthEnvironment, names: string[]): string | undefined {
  for (const name of names) {
    const value = environment[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function requireSecret(value: string | undefined, name: string): asserts value is string {
  if (!value || value.length < 16) throw new OAuthConfigurationError(`${name} is not configured with sufficient entropy.`);
}

function toSeconds(now?: number): number {
  const value = now ?? Date.now();
  if (!Number.isFinite(value)) throw new OAuthSecurityError("OAuth clock value is invalid.");
  return Math.floor(value > 10_000_000_000 ? value / 1000 : value);
}

function defaultRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function randomToken(randomBytes: (length: number) => Uint8Array, length: number): string {
  const bytes = randomBytes(length);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== length) {
    throw new OAuthSecurityError("OAuth random source returned an invalid value.");
  }
  return base64UrlEncode(bytes);
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(digest));
}

async function signPayload(payload: Record<string, unknown>, secret: string): Promise<string> {
  requireSecret(secret, "OAuth signing secret");
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload));
  return `${encodedPayload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function readSignedPayload(value: string, secret: string): Promise<unknown> {
  requireSecret(secret, "OAuth signing secret");
  const parts = value.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new OAuthSecurityError("Signed OAuth value is malformed.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  let signature: Uint8Array;
  try {
    signature = base64UrlDecode(parts[1]);
  } catch {
    throw new OAuthSecurityError("Signed OAuth value is malformed.");
  }
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signature.buffer as ArrayBuffer,
    new TextEncoder().encode(parts[0]),
  );
  if (!valid) throw new OAuthSecurityError("Signed OAuth value failed verification.");
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
  } catch {
    throw new OAuthSecurityError("Signed OAuth payload is malformed.");
  }
}

async function readResponseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function githubHeaders(accessToken: string): HeadersInit {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${accessToken}`,
    "user-agent": "Clunk",
    "x-github-api-version": "2022-11-28",
  };
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.byteLength; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid base64url value.");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function isReservedAuthPath(pathname: string): boolean {
  return pathname === "/signin-with-chatgpt" || pathname === "/signout-with-chatgpt" || pathname === "/callback" || pathname.startsWith("/api/auth/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}
