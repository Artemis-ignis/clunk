/**
 * Signed cookies for the self-hosted sign-in path.
 *
 * Clunk stores no password, so the only thing a session cookie has to prove is "the
 * server issued this". That is an HMAC over the payload with `CLUNK_SESSION_SECRET`,
 * verified through `crypto.subtle.verify` — the Web Crypto verify is the timing-safe
 * comparison, so no hand-rolled string equality is on the authentication path.
 *
 * The payload is deliberately thin: a user id, an issue time and an expiry. Display
 * name and email live in `clunk_users` and are read back per request, so a renamed or
 * deleted account cannot keep presenting stale identity from a cookie the browser
 * still holds. No access token from the upstream provider is ever written to a cookie.
 *
 * Without `CLUNK_SESSION_SECRET` every function here refuses to mint or accept a
 * session. That is the fail-closed default: a deployment missing the secret shows
 * visitors as signed out rather than accepting unsigned cookies.
 */
import { readAuthEnv } from "./auth-env";

export const SESSION_COOKIE = "clunk_session";
export const OAUTH_STATE_COOKIE = "clunk_oauth_state";

/** 7 days. Long enough to survive a work week, short enough that a stolen cookie expires. */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
/** An authorization round trip that takes longer than 10 minutes is abandoned, not resumed. */
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;

const SESSION_VERSION = 1;

export type SessionPayload = {
  v: number;
  /** Provider-qualified user id, e.g. `github:1234`. */
  sub: string;
  /** Issued at, seconds since epoch. */
  iat: number;
  /** Expires at, seconds since epoch. */
  exp: number;
};

export type OAuthStatePayload = {
  v: number;
  /** Random CSRF token echoed through the provider. */
  s: string;
  /** Sanitised relative path to land on after the callback. */
  r: string;
  exp: number;
};

export function getSessionSecret(): string | undefined {
  return readAuthEnv("CLUNK_SESSION_SECRET");
}

export function isSessionSigningAvailable(): boolean {
  return Boolean(getSessionSecret());
}

/* ------------------------------------------------------------------ encoding */

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      out[index] = binary.charCodeAt(index);
    }
    return out;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------------- hmac */

async function hmacKey(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

async function sign(secret: string, value: string): Promise<string> {
  const key = await hmacKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

/**
 * Timing-safe by construction: `crypto.subtle.verify` compares the MAC internally, so a
 * forged cookie cannot be refined byte by byte from response latency.
 */
async function verify(secret: string, value: string, signature: string): Promise<boolean> {
  const bytes = base64UrlDecode(signature);
  if (!bytes || bytes.length !== 32) return false;
  const key = await hmacKey(secret, ["verify"]);
  return crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(value));
}

/**
 * Constant-time equality for the OAuth state token. The MAC on the state cookie already
 * proves this server issued it; this comparison proves the value that came back from the
 * provider is the same one, without leaking a prefix match through timing.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }
  return diff === 0;
}

/* ------------------------------------------------------------ signed envelope */

async function seal(payload: unknown): Promise<string | null> {
  const secret = getSessionSecret();
  if (!secret) return null;
  const encoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  return `${encoded}.${await sign(secret, encoded)}`;
}

async function unseal(raw: string | null | undefined): Promise<unknown | null> {
  const secret = getSessionSecret();
  if (!secret || !raw) return null;
  const separator = raw.indexOf(".");
  if (separator <= 0) return null;
  const encoded = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  if (!(await verify(secret, encoded, signature))) return null;
  const bytes = base64UrlDecode(encoded);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------- session */

export async function createSessionCookieValue(
  userId: string,
  nowMs: number = Date.now(),
): Promise<string | null> {
  const issuedAt = Math.floor(nowMs / 1000);
  const payload: SessionPayload = {
    v: SESSION_VERSION,
    sub: userId,
    iat: issuedAt,
    exp: issuedAt + SESSION_TTL_SECONDS,
  };
  return seal(payload);
}

export async function readSessionCookieValue(
  raw: string | null | undefined,
  nowMs: number = Date.now(),
): Promise<SessionPayload | null> {
  const value = await unseal(raw);
  if (!isRecord(value)) return null;
  const { v, sub, iat, exp } = value;
  if (v !== SESSION_VERSION) return null;
  if (typeof sub !== "string" || !/^[a-zA-Z0-9:._-]{1,128}$/.test(sub)) return null;
  if (typeof iat !== "number" || typeof exp !== "number") return null;
  if (exp <= Math.floor(nowMs / 1000)) return null;
  return { v, sub, iat, exp };
}

/* ---------------------------------------------------------------- oauth state */

export function createStateToken(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

export async function createStateCookieValue(
  state: string,
  returnTo: string,
  nowMs: number = Date.now(),
): Promise<string | null> {
  const payload: OAuthStatePayload = {
    v: SESSION_VERSION,
    s: state,
    r: returnTo,
    exp: Math.floor(nowMs / 1000) + OAUTH_STATE_TTL_SECONDS,
  };
  return seal(payload);
}

export async function readStateCookieValue(
  raw: string | null | undefined,
  nowMs: number = Date.now(),
): Promise<OAuthStatePayload | null> {
  const value = await unseal(raw);
  if (!isRecord(value)) return null;
  const { v, s, r, exp } = value;
  if (v !== SESSION_VERSION) return null;
  if (typeof s !== "string" || typeof r !== "string" || typeof exp !== "number") return null;
  if (exp <= Math.floor(nowMs / 1000)) return null;
  return { v, s, r, exp };
}

/* -------------------------------------------------------------------- cookies */

export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const raw = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      // A malformed percent escape is a broken cookie, not a server error.
      return null;
    }
  }
  return null;
}

type CookieOptions = {
  maxAgeSeconds: number;
  secure: boolean;
  path?: string;
};

export function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path ?? "/"}`,
    `Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`,
    `Expires=${new Date(Date.now() + Math.max(0, options.maxAgeSeconds) * 1000).toUTCString()}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  // Secure would make the cookie unusable on a plain-http local dev origin, so it tracks
  // the scheme the request actually arrived on instead of being hardcoded either way.
  if (options.secure) attributes.push("Secure");
  return attributes.join("; ");
}

export function expireCookie(name: string, secure: boolean, path = "/"): string {
  return serializeCookie(name, "", { maxAgeSeconds: 0, secure, path });
}

/** https origins get Secure cookies; a loopback http dev origin would silently drop them. */
export function isSecureRequest(request: Request): boolean {
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return true;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
