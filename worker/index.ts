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

const CSP_BASE = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none';"
  + " form-action 'self' https://accounts.google.com https://github.com;"
  + " img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:;"
  + " connect-src 'self' https://cloudflareinsights.com";

const ENFORCED_CSP = `${CSP_BASE}; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com`;
const REPORT_ONLY_CSP = `${CSP_BASE}; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com`;

function withSecurityHeaders(response: Response): Response {
  const values: Record<string, string> = {
    // Without HSTS the first visit to clunk.games can still be answered over plain
    // http and stripped before the redirect ever runs. One year, subdomains included,
    // and preload-eligible.
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    // CSP. 두 벌을 함께 보냅니다 — 지금 강제하는 것과, 다음에 강제할 것을 미리 재는 것.
    //
    // connect-src 는 'https:' 였습니다. 스크립트가 한 번 주입되면 아무 https 주소로나
    // 데이터를 실어 보낼 수 있다는 뜻입니다. 브라우저가 실제로 붙는 곳은 자기 자신뿐이고
    // (marketplace 를 열어 resource timing 으로 확인), OAuth 토큰 교환처럼 바깥으로 나가는
    // 호출은 전부 워커 안에서 일어나 connect-src 의 대상이 아닙니다. 남긴 하나는 Cloudflare
    // 웹 분석 비콘으로, 대시보드에서 켜면 그때부터 보고를 보냅니다.
    "Content-Security-Policy": ENFORCED_CSP,
    // script-src 에서 'unsafe-eval' 을 뺀 판. 소스에는 eval 도 new Function 도 WebAssembly
    // 도 없지만, 번들러가 런타임에 무엇을 넣는지는 실제 빌드를 돌려 봐야 압니다. 먼저
    // 보고만 받아 위반이 0 인 것을 확인한 뒤 위쪽으로 옮깁니다.
    //
    // 'unsafe-inline' 은 여기서도 못 뺍니다. vinext 가 RSC 청크마다 인라인 스크립트를
    // 뿜어 첫 화면 한 장에 939 개가 실리고, 내용이 매번 달라 해시로 고정할 수 없습니다.
    // 길은 nonce 뿐인데(vinext 가 options.scriptNonce 를 받습니다) 요청마다 값을 만들어
    // SSR 진입점과 이 헤더에 함께 넣어야 하므로 따로 다룹니다.
    "Content-Security-Policy-Report-Only": REPORT_ONLY_CSP,
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
