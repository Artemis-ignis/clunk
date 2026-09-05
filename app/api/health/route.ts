import { getOAuthEnvironment, getOAuthProviderStatuses } from "../../oauth";
import { getRuntimeEnvironment } from "../../runtime-environment";
import { getProviderEnvironment, getProviderRuntimeStatus } from "../../../packages/clunk-series/src/provider-runtime";
import { getBillingEnvironment, getBillingStatus } from "../marketplace/billing";
import { getRuntimeAssets, getRuntimeDb } from "../_lib/clunk";
import { getCurrentUser } from "../../auth";
import { requireMcpApiKey } from "../_lib/mcp-auth";

export const dynamic = "force-dynamic";

/**
 * Operational health.
 *
 * Two answers, not one. Anyone may ask whether the site is up; only a signed-in caller (or
 * one holding a Clunk API key) may read which integrations are configured.
 *
 * 2026-09-05 점검 C4: 이 주소가 인증 없이 결제·제공자·OAuth 가 요구하는 환경변수 이름과
 * 그중 어느 자리가 비어 있는지까지 그대로 내주고 있었다. 값이 새지는 않지만, 어떤 열쇠를
 * 쓰고 어느 구멍이 비었는지를 알려 주는 것은 그 자체가 정찰거리다. 공개 응답은 살아
 * 있는지만 답하고, 나머지는 작업공간과 같은 문 뒤로 옮겼다.
 */
export async function GET(request: Request): Promise<Response> {
  const dbConfigured = isConfigured(() => getRuntimeDb());
  const assetsConfigured = isConfigured(() => getRuntimeAssets());
  const ok = dbConfigured && assetsConfigured;
  const base = {
    ok,
    schema: "clunk.health.v1",
    status: ok ? "ok" : "degraded",
    checkedAt: new Date().toISOString(),
    // 살아 있는지에 딸린 두 칸. 어떤 환경변수를 쓰는지는 말하지 않고, 핵심 저장소 둘이
    // 붙어 있는지만 말한다 — 배포 직후 확인(scripts/health-smoke.ps1)이 읽는 값이다.
    runtime: {
      db: dbConfigured ? "configured" : "unavailable",
      assets: assetsConfigured ? "configured" : "unavailable",
    },
  };

  if (!(await isOperator(request))) {
    return Response.json(base, { headers: { "cache-control": "no-store" } });
  }

  const environment = getRuntimeEnvironment();
  const oauth = getOAuthProviderStatuses(getOAuthEnvironment(environment)).map((status) => ({
    provider: status.provider,
    configured: status.configured,
    missing: status.missing,
  }));
  const providers = getProviderRuntimeStatus(getProviderEnvironment(environment)).map((status) => ({
    id: status.id,
    status: status.status,
    requiredEnvironment: status.requiredEnvironment,
  }));
  const billing = getBillingStatus(getBillingEnvironment(environment));

  return Response.json({
    ...base,
    capabilities: {
      nativeSeries: "AVAILABLE",
      providers,
      oauth,
      billing: {
        provider: billing.provider,
        status: billing.status,
        configured: billing.configured,
        missing: billing.missing,
      },
    },
  }, {
    headers: { "cache-control": "private, no-store" },
  });
}

/**
 * Whether this caller may read the configuration detail: the same session the workspace
 * requires, or a Clunk API key. A failure here is never an error — it just means the caller
 * gets the public answer.
 */
async function isOperator(request: Request): Promise<boolean> {
  if (request.headers.get("authorization")) {
    try {
      await requireMcpApiKey(request);
      return true;
    } catch {
      return false;
    }
  }
  try {
    // The session the workspace itself reads. Nothing is created here — a health check must
    // not open a workspace as a side effect.
    return Boolean(await getCurrentUser());
  } catch {
    return false;
  }
}

function isConfigured(read: () => unknown): boolean {
  try {
    return Boolean(read());
  } catch {
    return false;
  }
}
