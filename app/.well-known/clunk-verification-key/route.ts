/*
 * GET /.well-known/clunk-verification-key
 *
 * The public half of the server-verification signing key. A signature is only worth something if
 * the recipient can check it without asking the sender for permission, so this is deliberately
 * unauthenticated, cacheable, and stable: a publisher can fetch it once, commit the JSON next to
 * their build scripts, and verify Clunk passports offline forever after.
 *
 * Only the public key is served. The private half never leaves the environment variable.
 */
import {
  VERIFICATION_CANONICALIZATION,
  VERIFICATION_DOCUMENT_TYPE,
} from "../../../packages/core/src/verification";
import { loadVerificationKeys } from "../../api/_lib/server-verification";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const state = loadVerificationKeys();
  if (!state.enabled) {
    return Response.json(
      {
        ok: false,
        enabled: false,
        error: state.reason,
        code: "server_verification_disabled",
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  const { keys } = state;
  return Response.json(
    {
      schemaVersion: "1.0",
      ok: true,
      enabled: true,
      issuer: new URL(request.url).origin,
      documentType: VERIFICATION_DOCUMENT_TYPE,
      algorithm: keys.algorithm,
      keyId: keys.keyId,
      keyFormat: "jwk",
      publicKey: keys.publicKey,
      canonicalization: VERIFICATION_CANONICALIZATION,
      signatureEncoding: "base64",
      signedFields: "`signature`를 제외한 Passport 문서 전체 (키 이름 사전순 정렬 JSON, UTF-8)",
      howToVerify: {
        cli: "npm run clunk -- verify <passport.json> [--asset <파일>] [--key <이 JSON을 저장한 파일>]",
        offline:
          "이 응답을 파일로 저장해 두면 이후에는 네트워크 없이 --key 옵션으로 검증할 수 있습니다.",
      },
    },
    {
      // Public, non-secret, and slow-changing: a short shared cache keeps a busy CI from
      // hammering the origin while a key rotation still propagates within the hour.
      headers: { "cache-control": "public, max-age=300, s-maxage=3600" },
    },
  );
}
