import { getOAuthEnvironment, getOAuthProviderStatuses } from "../../oauth";
import { getRuntimeEnvironment } from "../../runtime-environment";
import { getProviderEnvironment, getProviderRuntimeStatus } from "../../../packages/clunk-series/src/provider-runtime";
import { getBillingEnvironment, getBillingStatus } from "../marketplace/billing";
import { getRuntimeAssets, getRuntimeDb } from "../_lib/clunk";

export const dynamic = "force-dynamic";

/**
 * Public, secret-free operational health surface. Optional integrations are
 * reported as capabilities; only the core D1/R2 runtime changes health from
 * `ok` to `degraded`.
 */
export async function GET(): Promise<Response> {
  const environment = getRuntimeEnvironment();
  const dbConfigured = isConfigured(() => getRuntimeDb());
  const assetsConfigured = isConfigured(() => getRuntimeAssets());
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
    ok: dbConfigured && assetsConfigured,
    schema: "clunk.health.v1",
    status: dbConfigured && assetsConfigured ? "ok" : "degraded",
    checkedAt: new Date().toISOString(),
    runtime: {
      db: dbConfigured ? "configured" : "unavailable",
      assets: assetsConfigured ? "configured" : "unavailable",
    },
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
    headers: { "cache-control": "no-store" },
  });
}

function isConfigured(read: () => unknown): boolean {
  try {
    return Boolean(read());
  } catch {
    return false;
  }
}
