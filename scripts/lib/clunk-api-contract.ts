/**
 * Shared HTTP contract helpers for the Clunk API suites.
 *
 * `scripts/api-credit-smoke.ts` (the deep credit/idempotency smoke) and
 * `scripts/e2e-api-boundary.ts` (the fast boundary suite the `npm run e2e`
 * runner drives) both talk to the same server, so the SIWC header shape, the
 * JSON fetch wrapper and the `/api/runs` payload contract live here once.
 */
import assert from "node:assert/strict";
import type { InspectionReport } from "../../packages/core/src/index";

export type ApiBody = Record<string, unknown>;
export type ApiResult = { status: number; body: ApiBody };

/**
 * Sites forwards the signed-in ChatGPT identity as request headers; there is no
 * app-owned password to supply. `origin` must match the server origin or the
 * same-origin write guard rejects the request with 403.
 */
export function siwcHeaders(
  actor: string,
  origin: string,
  fullName = "Clunk%20API%20Smoke",
): Record<string, string> {
  return {
    "oai-authenticated-user-id": actor,
    "oai-authenticated-user-email": `${actor}@example.test`,
    "oai-authenticated-user-full-name": fullName,
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
    origin,
  };
}

export async function apiRequest(
  baseUrl: string,
  actor: string,
  path: string,
  init: RequestInit = {},
  fullName?: string,
): Promise<ApiResult> {
  const response = await fetch(new URL(path, baseUrl), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...siwcHeaders(actor, baseUrl, fullName),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: ApiBody = {};
  try {
    body = JSON.parse(text) as ApiBody;
  } catch {
    body = { raw: text };
  }
  return { status: response.status, body };
}

export function expectStatus(result: ApiResult, status: number, label: string): void {
  assert.equal(result.status, status, `${label}: ${JSON.stringify(result.body)}`);
}

/**
 * The server re-derives the result digest from these fields, so the payload has
 * to mirror the local Core report exactly.
 */
export function runPayloadFor(localReport: InspectionReport): Record<string, unknown> {
  return {
    analysisId: localReport.analysisId,
    fileName: localReport.fileName,
    format: localReport.format,
    byteLength: localReport.byteLength,
    inputHash: localReport.inputHash,
    profileId: localReport.profileId,
    ruleSetId: localReport.ruleSetId,
    score: localReport.score.score,
    hardBlockerCount: localReport.score.hardBlockerCount,
    findingCount: localReport.findings.length,
    report: localReport,
  };
}
