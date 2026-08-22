/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  /** Comma-separated hostnames allowed to carry ChatGPT identity headers. Unset = loopback only. */
  CLUNK_TRUSTED_AUTH_HOSTS?: string;
  /**
   * Self-hosted sign-in, read through app/auth-env.ts. All three are optional and all
   * three fail closed: without the session secret no cookie can be signed, and without
   * the GitHub pair that provider is never offered.
   */
  CLUNK_SESSION_SECRET?: string;
  CLUNK_GITHUB_CLIENT_ID?: string;
  CLUNK_GITHUB_CLIENT_SECRET?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };


/**
 * Response hardening. The app shipped with no security headers at all, which left an XSS
 * with no containment and let any page frame the authenticated surfaces (a click inside an
 * iframe is same-origin, so the CSRF origin check does not catch clickjacking).
 *
 * The CSP allows inline styles and inline scripts because the framework streams RSC payloads
 * and the theme bootstrap runs inline before paint; it still blocks foreign script origins,
 * object/embed, and framing.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "cross-origin-opener-policy": "same-origin",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "content-security-policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    // wasm-unsafe-eval: the GLB preview instantiates the meshopt decoder as WebAssembly.
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
    // blob:은 업로드한 GLB를 로더에 넘기는 유일한 경로다. 파일은 브라우저 밖으로
    // 나가지 않으므로 자기 자신이 만든 blob을 다시 읽는 것뿐이고, 외부 출처는 늘지
    // 않는다. 이걸 빼 두었더니 텍스처가 있는 에셋은 미리보기가 통째로 비었다.
    "connect-src 'self' blob:",
    "worker-src 'self' blob:",
  ].join("; "),
};

function harden(response: Response): Response {
  // A 101/204/304 must not be rewritten: constructing a Response from them throws.
  if (response.status === 101 || response.status === 204 || response.status === 304) {
    return response;
  }
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Identity headers are only trustworthy on the host that injects them.
 *
 * The app authenticates purely from `oai-authenticated-user-*` request headers, and the
 * workspace id is derived from the user id. Nothing verified that a request actually came
 * through the host that sets those headers, so any origin reachable directly — the default
 * workers.dev name, a preview deployment, a custom domain wired straight to the worker —
 * accepted a hand-written header as a complete login for any account.
 *
 * The gate strips those headers unless the request arrived on a host declared as trusted.
 * Stripping rather than rejecting keeps public pages working everywhere; the authenticated
 * surfaces simply see a signed-out visitor.
 *
 * Fail closed: with CLUNK_TRUSTED_AUTH_HOSTS unset only loopback is trusted. A deployment
 * that forgets to set it shows everyone as signed out — visible and recoverable, unlike
 * silent impersonation.
 */
const IDENTITY_HEADERS = [
  "oai-authenticated-user-id",
  "oai-authenticated-user-email",
  "oai-authenticated-user-full-name",
  "oai-authenticated-user-full-name-encoding",
];

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isTrustedAuthHost(hostname: string, trustedList: string | undefined): boolean {
  if (LOOPBACK_HOSTS.has(hostname)) return true;
  if (!trustedList) return false;
  return trustedList
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(hostname.toLowerCase());
}

function withVerifiedIdentity(request: Request, trustedList: string | undefined): Request {
  if (isTrustedAuthHost(new URL(request.url).hostname, trustedList)) return request;
  if (!IDENTITY_HEADERS.some((header) => request.headers.has(header))) return request;
  const headers = new Headers(request.headers);
  for (const header of IDENTITY_HEADERS) headers.delete(header);
  return new Request(request, { headers });
}
const worker = {
  async fetch(incoming: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Publish the bindings for modules that must stay loadable outside workerd (see
    // app/auth-env.ts). Same value, no virtual-module import in the render path.
    (globalThis as typeof globalThis & { __clunkRuntimeEnv?: unknown }).__clunkRuntimeEnv = env ?? {};
    // `env` is undefined under the plain Node production server, which has no Cloudflare
    // bindings at all. Reading through it unguarded turned every request into a 500.
    const request = withVerifiedIdentity(incoming, env?.CLUNK_TRUSTED_AUTH_HOSTS);
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths).then(harden);
    }

    return harden(await handler.fetch(request, env, ctx));
  },
};

export default worker;
