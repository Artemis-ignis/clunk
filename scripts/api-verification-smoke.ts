/*
 * End-to-end smoke for the opt-in server-verification path.
 *
 * The claims this endpoint makes are the ones a buyer pays for, so they are exercised against a
 * running server rather than asserted in a unit test: a real GLB is uploaded, the server inspects
 * it and signs the result, the signature verifies against the key published at the well-known
 * endpoint, a hand-edited copy of that document fails, a document paired with the wrong file
 * fails, the size cap rejects before reading, and re-verifying the same bytes does not charge
 * twice.
 *
 *   npm run api:verify-smoke
 *   CLUNK_SMOKE_BASE_URL=http://localhost:3025 npm run api:verify-smoke
 *
 * Requires the server to have CLUNK_VERIFY_PRIVATE_KEY set. Without it the endpoint is off by
 * design, and this script says so and exits 0 rather than pretending to have tested something.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAssetBundle, inspectAsset, sha256Hex } from "../packages/core/src/index";
import {
  parseVerificationPublicKey,
  recomputeInspectionDigest,
  verifyVerificationPassport,
  type VerificationPassport,
} from "../packages/core/src/verification";

const baseUrl = process.env.CLUNK_SMOKE_BASE_URL ?? "http://localhost:3025";
const userId = process.env.CLUNK_SMOKE_USER_ID ?? `clunk-verify-smoke-${Date.now()}`;

function identityHeaders(): Record<string, string> {
  return {
    "oai-authenticated-user-id": userId,
    "oai-authenticated-user-email": `${userId}@example.test`,
    "oai-authenticated-user-full-name": "Clunk%20Verify%20Smoke",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
    origin: baseUrl,
  };
}

async function upload(fileName: string, bytes: Uint8Array, profileId = "pc") {
  const response = await fetch(new URL("/api/verifications", baseUrl), {
    method: "POST",
    headers: {
      ...identityHeaders(),
      "content-type": "application/octet-stream",
      "x-clunk-file-name": encodeURIComponent(fileName),
      "x-clunk-profile-id": profileId,
    },
    body: bytes as unknown as BodyInit,
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, body };
}

const checks: string[] = [];

const policyResponse = await fetch(new URL("/api/verifications", baseUrl), { headers: identityHeaders() });
const policy = (await policyResponse.json()) as Record<string, unknown>;
if (policyResponse.status === 503) {
  process.stdout.write(
    `${JSON.stringify({ ok: true, skipped: true, reason: policy.code, message: policy.error })}\n`,
  );
  process.exit(0);
}
assert.equal(policyResponse.status, 200, "policy endpoint must answer 200 when the key is configured");
assert.equal(policy.bytesRetained, false, "the policy must state that bytes are not retained");
const maxUploadBytes = Number(policy.maxUploadBytes);
const creditCost = Number(policy.creditCost);
assert.ok(maxUploadBytes > 0 && creditCost > 0, "policy must publish a size cap and a credit cost");
checks.push("policy published (cap, cost, no retention)");

const keyResponse = await fetch(new URL("/.well-known/clunk-verification-key", baseUrl));
assert.equal(keyResponse.status, 200, "the public key must be served without authentication");
const publicKey = parseVerificationPublicKey(await keyResponse.json());
checks.push("public key published at the well-known path");

const fileName = "clunk-ready-sample.glb";
const bytes = new Uint8Array(await readFile(`public/samples/${fileName}`));
const localReport = inspectAsset(createAssetBundle(fileName, bytes), { profileId: "pc" });

const startingCredits = Number(
  ((await fetch(new URL("/api/me", baseUrl), { headers: identityHeaders() }).then((r) => r.json())) as {
    credits?: number;
  }).credits ?? 0,
);

const first = await upload(fileName, bytes);
assert.equal(first.status, 200, `server verification failed: ${JSON.stringify(first.body)}`);
assert.equal(first.body.verificationMode, "server-verified");
assert.equal(first.body.bytesRetained, false);
const passport = first.body.passport as VerificationPassport;
assert.equal(passport.asset.sha256, sha256Hex(bytes), "the passport must carry the real file hash");
assert.equal(
  passport.resultDigest,
  localReport.resultDigest,
  "the server's own inspection must reproduce the local digest for the same bytes and rules",
);
assert.equal(recomputeInspectionDigest(passport), passport.resultDigest);
checks.push("server inspected the uploaded bytes and reproduced the local digest");

const genuine = await verifyVerificationPassport(passport, publicKey);
assert.equal(genuine.ok, true, `a freshly issued passport must verify: ${JSON.stringify(genuine)}`);
checks.push("issued passport verifies against the published key");

// Credits are checked here, before any further upload moves the balance.
const creditsAfterFirst = Number(first.body.credits);
assert.equal(
  creditsAfterFirst,
  startingCredits - creditCost,
  `server verification must debit exactly ${creditCost} credits`,
);
const second = await upload(fileName, bytes);
assert.equal(second.status, 200);
assert.equal(second.body.idempotent, true, "re-verifying the same bytes must be idempotent");
assert.equal(
  Number(second.body.credits),
  creditsAfterFirst,
  "a repeat verification must not debit again",
);
checks.push("credit debit is exact and idempotent");

// The sample used above already scores 100, so a "raise the score" forgery has to be built on a
// document that does not. The messy sample is blocked, which is exactly what a forger would want
// to paper over.
const messyName = "clunk-messy-sample.glb";
const messyBytes = new Uint8Array(await readFile(`public/samples/${messyName}`));
const messyResult = await upload(messyName, messyBytes);
assert.equal(messyResult.status, 200, `blocked-asset verification failed: ${JSON.stringify(messyResult.body)}`);
const blockedPassport = messyResult.body.passport as VerificationPassport;
assert.equal(blockedPassport.score.ready, false, "the messy sample must not be reported as ready");
assert.equal((await verifyVerificationPassport(blockedPassport, publicKey)).ok, true);

const forged = JSON.parse(JSON.stringify(blockedPassport)) as VerificationPassport;
forged.score.score = 100;
forged.score.ready = true;
forged.score.hardBlockerCount = 0;
assert.equal(
  (await verifyVerificationPassport(forged, publicKey)).ok,
  false,
  "a hand-raised score must break the signature",
);

const forgedFindings = JSON.parse(JSON.stringify(blockedPassport)) as VerificationPassport;
forgedFindings.findings = [];
assert.equal(
  (await verifyVerificationPassport(forgedFindings, publicKey)).ok,
  false,
  "deleting findings must break the signature",
);

const forgedHash = JSON.parse(JSON.stringify(passport)) as VerificationPassport;
forgedHash.asset.sha256 = sha256Hex(messyBytes);
assert.equal(
  (await verifyVerificationPassport(forgedHash, publicKey)).ok,
  false,
  "repointing a passport at another file must break the signature",
);
checks.push("hand-edited passport rejected (score, findings, asset hash)");

assert.notEqual(
  sha256Hex(messyBytes),
  passport.asset.sha256,
  "the two sample assets must hash differently for the --asset comparison to mean anything",
);
checks.push("hash comparison distinguishes a different file");

const credits = Number(messyResult.body.credits);

// One byte over the published cap, rejected on content-length before the body is read.
const oversized = new Uint8Array(maxUploadBytes + 1);
oversized.set(bytes);
const tooLarge = await upload(fileName, oversized);
assert.equal(tooLarge.status, 413, "an oversized upload must be refused");
assert.equal(tooLarge.body.code, "verification_upload_too_large");
assert.equal(
  Number(
    ((await fetch(new URL("/api/me", baseUrl), { headers: identityHeaders() }).then((r) => r.json())) as {
      credits?: number;
    }).credits ?? -1,
  ),
  credits,
  "a refused upload must not touch credits",
);
checks.push("oversized upload refused without charging");

const badProfile = await fetch(new URL("/api/verifications", baseUrl), {
  method: "POST",
  headers: {
    ...identityHeaders(),
    "content-type": "application/octet-stream",
    "x-clunk-file-name": encodeURIComponent(fileName),
    "x-clunk-profile-id": "console",
  },
  body: bytes as unknown as BodyInit,
});
assert.equal(badProfile.status, 400, "an unknown profile must be refused");

const notAnAsset = await upload("notes.txt", bytes);
assert.equal(notAnAsset.status, 400, "a non-GLB file name must be refused");
checks.push("input validation refuses unknown profiles and file types");

const unparseable = await upload("broken.glb", new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
assert.equal(unparseable.status, 422, "an unreadable file must not produce a signed passport");
assert.equal(unparseable.body.code, "verification_unparseable");
checks.push("unreadable file is refused, not signed");

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      userId,
      algorithm: policy.algorithm,
      keyId: policy.keyId,
      maxUploadBytes,
      creditCost,
      passportId: passport.passportId,
      checks,
    },
    null,
    2,
  )}\n`,
);
