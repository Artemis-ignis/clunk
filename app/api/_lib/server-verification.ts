/*
 * Opt-in server verification: shared policy, key handling, and the passport builder.
 *
 * Why this exists. Clunk's default path inspects an asset in the visitor's own browser and the
 * workspace stores what that browser reported. The server can only re-check that the report is
 * internally consistent — the digest is computed from data the client also sent, so a client can
 * fabricate a perfect report and the server will store it. That record is reproducible evidence
 * for the owner, but it is worthless as a claim made to a third party, because the issuer and the
 * claimant are the same machine.
 *
 * This module backs the other mode. The user explicitly chooses to upload the bytes, Clunk's own
 * server runs `inspectAsset` on them, and Clunk signs the result. The recipient checks the
 * signature against a published key. Nobody has to trust the sender.
 *
 * Fail-closed: without CLUNK_VERIFY_PRIVATE_KEY there is no signing key, and the whole feature is
 * off — the endpoint answers 503 rather than issuing an unsigned document that looks official.
 */
import { readAuthEnv } from "../../auth-env";
import {
  buildUnsignedVerificationPassport,
  parseVerificationPrivateKey,
  signVerificationPassport,
  type VerificationKeyPair,
  type VerificationPassport,
} from "../../../packages/core/src/verification";
import type { InspectionReport } from "../../../packages/core/src/index";
import { ClunkHttpError } from "./clunk";

/**
 * Largest asset accepted for server verification.
 *
 * Set from measurement, not from the platform maximum. The measured table is in
 * docs/server-verification.ko.md; time is not what binds. A 31MB GLB verified end to end in
 * ~1.1s, which is nowhere near a Worker's CPU budget. Memory is the constraint: an isolate gets
 * 128MB, and a single upload is held about four times over on the way through — the request
 * body, `createAssetBundle`'s copy, `normalizeBundle`'s copy, and the GLB binary chunk copy. At
 * 32MB that peak sits on top of the limit. 16MB keeps the worst case near 64MB, roughly half the
 * isolate, while still being three times the largest asset in the reference corpus (4.9MB).
 * Anything larger is refused before a byte is read.
 */
export const MAX_VERIFICATION_UPLOAD_BYTES = 16 * 1024 * 1024;

/**
 * Credit cost of one server verification.
 *
 * A local inspection costs 1 credit and consumes no Clunk compute — the browser did the work and
 * the server only wrote a row. A server verification uploads the bytes, runs the full inspection
 * on Clunk's CPU, and produces a signed artifact whose value is that Clunk stands behind it.
 * Three credits keeps the ratio honest (measured server inspection is roughly an order of
 * magnitude more expensive per request than storing a report) without pricing the only
 * trustworthy mode out of reach.
 */
export const VERIFICATION_CREDIT_COST = 3;

export type VerificationKeyState =
  | { enabled: true; keys: VerificationKeyPair }
  | { enabled: false; reason: string };

let cachedRaw: string | null = null;
let cachedState: VerificationKeyState | null = null;

/**
 * Load the issuing key. Cached per isolate keyed on the raw value so a rotated secret is picked
 * up without a redeploy and a bad value is not re-parsed on every request.
 */
export function loadVerificationKeys(): VerificationKeyState {
  const raw = readAuthEnv("CLUNK_VERIFY_PRIVATE_KEY");
  if (!raw) {
    cachedRaw = null;
    cachedState = null;
    return {
      enabled: false,
      reason:
        "이 서버에는 서버 검증 서명키(CLUNK_VERIFY_PRIVATE_KEY)가 설정되어 있지 않아 서버 검증 기능이 꺼져 있습니다. 로컬 검사는 그대로 사용할 수 있습니다.",
    };
  }
  if (cachedRaw === raw && cachedState) return cachedState;
  try {
    const keys = parseVerificationPrivateKey(raw);
    cachedRaw = raw;
    cachedState = { enabled: true, keys };
  } catch (error) {
    cachedRaw = raw;
    cachedState = {
      enabled: false,
      reason: error instanceof Error ? error.message : "서명키를 읽지 못했습니다.",
    };
  }
  return cachedState;
}

export function requireVerificationKeys(): VerificationKeyPair {
  const state = loadVerificationKeys();
  if (!state.enabled) {
    throw new ClunkHttpError(state.reason, 503, "server_verification_disabled");
  }
  return state.keys;
}

/**
 * Build and sign the passport from a report the *server* produced.
 *
 * The input is an InspectionReport this process computed from bytes it read itself. Nothing a
 * client sent is copied into the document, so there is no field a caller can steer.
 */
export async function issueVerificationPassport(
  report: InspectionReport,
  keys: VerificationKeyPair,
  issuerOrigin: string,
  inspectedAt: string,
): Promise<VerificationPassport> {
  return signVerificationPassport(
    buildUnsignedVerificationPassport(report, issuerOrigin, inspectedAt),
    keys,
  );
}

/**
 * One decimal, trailing `.0` trimmed. A rejection that reads "16MB 이하만 받습니다. 이 요청은 약
 * 16MB입니다" tells the user nothing; "16.3MB" tells them how much to cut.
 */
export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")}MB`;
}
