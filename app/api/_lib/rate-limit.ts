/**
 * Fixed-window request limiter for Clunk's write-heavy and auth endpoints.
 *
 * HONEST LIMITATIONS — read before relying on this for anything:
 *
 * 1. State lives in the memory of a single Worker isolate. Cloudflare runs many
 *    isolates across many colos, so the effective global limit is roughly
 *    `limit x active isolates`, not `limit`. This is a v1 defense line that
 *    raises the cost of naive scripted abuse; it is NOT a global quota and must
 *    not be described as one. A real global limiter needs Durable Objects,
 *    KV with a write-rate budget, or Cloudflare's own Rate Limiting rules.
 * 2. Isolates are evicted at will, which silently resets counters.
 * 3. Fixed windows allow a burst of up to `2 x limit` across a window boundary.
 * 4. Requests that resolve to neither a user id nor a client IP share a single
 *    `anonymous` bucket, which is deliberately pessimistic.
 *
 * Credit reservation and workspace scoping remain the authoritative controls on
 * expensive work; this only bounds request volume.
 */

import { AUTH_SESSION_COOKIE, decodeOAuthSession, parseCookieHeader } from "../../oauth";
import {
  UPSTREAM_IDENTITY_USER_ID_HEADER,
  trustsUpstreamIdentityHeaders,
} from "./identity-headers";

export const RATE_LIMIT_DISABLED_FLAG = "CLUNK_RATE_LIMIT_DISABLED";

const AUTH_SESSION_SECRET = "CLUNK_AUTH_SESSION_SECRET";
const DEFAULT_WINDOW_MS = 60_000;

/** Bounded so a hostile key-space cannot grow the isolate's heap without limit. */
const MAX_TRACKED_KEYS = 5_000;

export type RateLimitPolicy = {
  /** Stable bucket namespace so one route's traffic cannot exhaust another's. */
  id: string;
  limit: number;
  windowMs: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
};

type RateLimitBucket = { count: number; resetAt: number };

type RateLimitRoute = {
  id: string;
  /** `null` matches every method. */
  methods: readonly string[] | null;
  test: (pathname: string) => boolean;
  limit: number;
  windowMs?: number;
};

const RATE_LIMIT_ROUTES: readonly RateLimitRoute[] = [
  {
    id: "generation",
    methods: ["POST"],
    test: (pathname) => isPath(pathname, "/api/generation"),
    limit: 20,
  },
  {
    id: "assetops-inspect",
    methods: ["POST"],
    test: (pathname) => isPath(pathname, "/api/assetops/inspect"),
    limit: 10,
  },
  {
    id: "credits",
    methods: ["POST"],
    test: (pathname) => isPath(pathname, "/api/credits"),
    limit: 10,
  },
  {
    id: "marketplace-checkout",
    methods: ["POST"],
    test: (pathname) => isPath(pathname, "/api/marketplace/checkout"),
    limit: 10,
  },
  {
    id: "auth",
    methods: null,
    test: (pathname) => pathname === "/api/auth" || pathname.startsWith("/api/auth/"),
    limit: 30,
  },
  // 키 발급은 D1 에 행을 만드는 쓰기이고, 이 라우트에는 아무 상한이 없었다. 한 세션이
  // 반복해서 눌러 워크스페이스마다 수천 개의 키를 만들 수 있었다. 사람이 실제로 필요한
  // 횟수는 분당 한 자리이므로 5 로 잡는다. 폐기(DELETE)도 같은 통에 넣는다.
  {
    id: "mcp-keys",
    methods: ["POST", "DELETE"],
    test: (pathname) => pathname === "/api/mcp/keys" || pathname.startsWith("/api/mcp/keys/"),
    limit: 5,
  },
  // 키를 들고 오는 쪽. 키 자체는 256비트라 추측이 불가능하지만, 훔친 키 한 장으로
  // 무제한 호출이 가능한 상태였다. 도구 호출은 D1 과 R2 를 건드린다.
  {
    id: "mcp-rpc",
    methods: ["POST"],
    test: (pathname) => isPath(pathname, "/api/mcp"),
    limit: 120,
  },
];

const buckets = new Map<string, RateLimitBucket>();

export function isRateLimitDisabled(
  environment: Record<string, unknown> | undefined | null,
): boolean {
  return environment?.[RATE_LIMIT_DISABLED_FLAG] === "1";
}

export function findRateLimitPolicy(method: string, pathname: string): RateLimitPolicy | null {
  const normalizedMethod = method.toUpperCase();
  for (const route of RATE_LIMIT_ROUTES) {
    if (route.methods && !route.methods.includes(normalizedMethod)) continue;
    if (!route.test(pathname)) continue;
    return {
      id: route.id,
      limit: route.limit,
      windowMs: route.windowMs ?? DEFAULT_WINDOW_MS,
    };
  }
  return null;
}

export function consumeRateLimit(
  key: string,
  policy: RateLimitPolicy,
  now = Date.now(),
): RateLimitDecision {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_TRACKED_KEYS) evictExpired(now);
    const resetAt = now + policy.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      limit: policy.limit,
      remaining: Math.max(0, policy.limit - 1),
      retryAfterSeconds: 0,
      resetAt,
    };
  }

  existing.count += 1;
  const allowed = existing.count <= policy.limit;
  return {
    allowed,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - existing.count),
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    resetAt: existing.resetAt,
  };
}

/**
 * Key on the authenticated principal when one can be established without
 * trusting the caller, and fall back to the edge-observed client IP.
 */
export async function resolveRateLimitKey(
  request: Request,
  environment: Record<string, unknown> | undefined | null,
  policy: RateLimitPolicy,
): Promise<string> {
  return `${policy.id}:${await resolveRateLimitIdentity(request, environment)}`;
}

export function rateLimitResponse(decision: RateLimitDecision): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: "RATE_LIMITED",
      message: "Too many requests. Retry after the window resets.",
      retryAfterSeconds: decision.retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "retry-after": String(decision.retryAfterSeconds),
        "x-ratelimit-limit": String(decision.limit),
        "x-ratelimit-remaining": String(decision.remaining),
        "x-ratelimit-reset": String(Math.ceil(decision.resetAt / 1000)),
      },
    },
  );
}

/**
 * Single choke point used by the Worker entry: returns a 429 response when the
 * request must be rejected, or `null` when it should continue to the handler.
 */
export async function enforceRateLimit(
  request: Request,
  environment: Record<string, unknown> | undefined | null,
): Promise<Response | null> {
  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return null;
  }
  const policy = findRateLimitPolicy(request.method, pathname);
  if (!policy) return null;
  if (isRateLimitDisabled(environment)) return null;

  const key = await resolveRateLimitKey(request, environment, policy);
  const decision = consumeRateLimit(key, policy);
  if (decision.allowed) return null;
  return rateLimitResponse(decision);
}

/** Test-only escape hatch so contract tests can start from a clean window. */
export function resetRateLimitState(): void {
  buckets.clear();
}

async function resolveRateLimitIdentity(
  request: Request,
  environment: Record<string, unknown> | undefined | null,
): Promise<string> {
  if (trustsUpstreamIdentityHeaders(environment)) {
    const headerUserId = request.headers.get(UPSTREAM_IDENTITY_USER_ID_HEADER)?.trim();
    if (headerUserId) return `user:${headerUserId}`;
  }

  const sessionUserId = await readSessionUserId(request, environment);
  if (sessionUserId) return `user:${sessionUserId}`;

  const clientIp = readClientIp(request);
  return clientIp ? `ip:${clientIp}` : "anonymous";
}

/**
 * Only a signature-verified session may key a bucket. An unverified cookie
 * value would let a caller mint a fresh bucket per request.
 */
async function readSessionUserId(
  request: Request,
  environment: Record<string, unknown> | undefined | null,
): Promise<string | null> {
  const secret = environment?.[AUTH_SESSION_SECRET];
  if (typeof secret !== "string" || !secret) return null;
  const cookie = parseCookieHeader(request.headers.get("cookie")).get(AUTH_SESSION_COOKIE);
  if (!cookie) return null;
  try {
    const session = await decodeOAuthSession(cookie, secret);
    return session?.id ?? null;
  } catch {
    return null;
  }
}

function readClientIp(request: Request): string | null {
  const direct = request.headers.get("cf-connecting-ip")?.trim();
  if (direct) return direct;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || null;
}

function evictExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still saturated: drop everything rather than let the isolate grow. This
  // briefly forgives in-flight offenders, which is the safer failure mode.
  if (buckets.size >= MAX_TRACKED_KEYS) buckets.clear();
}

function isPath(pathname: string, route: string): boolean {
  return pathname === route || pathname === `${route}/`;
}
