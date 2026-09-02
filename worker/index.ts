/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { getRuntimeEnvironment, setRuntimeBindings } from "../app/runtime-environment";
import {
  stripUpstreamIdentityHeaders,
  trustsUpstreamIdentityHeaders,
} from "../app/api/_lib/identity-headers";
import { enforceRateLimit } from "../app/api/_lib/rate-limit";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  /** "1" only on a deployment sitting behind the ChatGPT Sites identity proxy. */
  CLUNK_TRUST_SIWC_HEADERS?: string;
  /** "1" disables the in-isolate request limiter (local dev and tests). */
  CLUNK_RATE_LIMIT_DISABLED?: string;
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

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    setRuntimeBindings(env as unknown as Record<string, unknown>);
    const runtimeEnvironment = getRuntimeEnvironment();

    // Defense in depth. Unless this deployment is explicitly behind the ChatGPT
    // Sites identity proxy, inbound `oai-authenticated-*` headers are supplied
    // by the caller and must never reach the auth boundary. Stripping happens
    // before anything else reads the request, rate limiting included.
    const inbound = trustsUpstreamIdentityHeaders(runtimeEnvironment)
      ? request
      : stripUpstreamIdentityHeaders(request);
    const url = new URL(inbound.url);

    // One host for cookies. The OAuth transaction cookie is set on whatever host the visitor
    // started on, and Google/GitHub always return them to https://clunk.games — so a login
    // begun on www., on plain http, or on the old workers.dev host ended in invalid_oauth_state.
    // Those origins redirect to the canonical one before anything else runs. The preview
    // worker (clunk-vending.*) and local hosts are not in this list on purpose.
    const CANONICAL_HOST = "clunk.games";
    const legacyHost = url.hostname === "www.clunk.games" || url.hostname === "clunk.artemis-clunk.workers.dev";
    const plainHttp = url.protocol === "http:" && url.hostname === CANONICAL_HOST;
    if (legacyHost || plainHttp) {
      const canonical = new URL(url.toString());
      canonical.protocol = "https:";
      canonical.hostname = CANONICAL_HOST;
      canonical.port = "";
      return withSecurityHeaders(Response.redirect(canonical.toString(), 301));
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return withSecurityHeaders(await handleImageOptimization(inbound, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, inbound.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths));
    }

    const limited = await enforceRateLimit(inbound, runtimeEnvironment);
    if (limited) return withSecurityHeaders(limited);

    return withSecurityHeaders(await handler.fetch(inbound, env, ctx));
  },
};

function withSecurityHeaders(response: Response): Response {
  const values: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https://accounts.google.com https://github.com; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com; connect-src 'self' https:; font-src 'self' data:",
  };
  try {
    for (const [name, value] of Object.entries(values)) response.headers.set(name, value);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(values)) headers.set(name, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
}

export default worker;
