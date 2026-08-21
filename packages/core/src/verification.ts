/*
 * Server-verification signing primitives.
 *
 * Clunk's default inspection runs in the user's own browser and the workspace only stores what
 * that browser reported. That record is reproducible, but it is not evidence: whoever produced
 * the report also chose its numbers. This module is the other half — the one where Clunk's own
 * server inspects the bytes and signs the result, so a publisher who receives the document can
 * check it against a public key instead of trusting the sender.
 *
 * Nothing here touches asset bytes. It signs and verifies a JSON document.
 *
 * Portability: only Web Crypto (`crypto.subtle`) and `TextEncoder` are used, both of which exist
 * in Cloudflare Workers, Node 20+, and browsers. No Node builtins, no `Buffer`, no `atob`.
 */
import {
  sha256Hex,
  stableStringify,
  type AssetFormat,
  type AssetMetrics,
  type Finding,
  type InspectionReport,
  type ProfileId,
  type ScoreReport,
} from "./index";

/** Document type stamped into every server-signed passport. */
export const VERIFICATION_DOCUMENT_TYPE = "clunk-verification-passport" as const;

/** How the signed byte string is derived from the document. Bumped only on a breaking change. */
export const VERIFICATION_CANONICALIZATION = "clunk-stable-json-v1" as const;

/** Value of `verificationMode` for a passport Clunk's server produced from real bytes. */
export const SERVER_VERIFIED_MODE = "server-verified" as const;

/** Value of `verificationMode` for the local-first record the browser produced. */
export const CLIENT_LOCAL_MODE = "client-local-attested" as const;

export type VerificationAlgorithm = "Ed25519" | "ECDSA-P256-SHA256";

/** Public half of the issuing key, in the exact shape published at the well-known endpoint. */
export type VerificationPublicKey =
  | { kty: "OKP"; crv: "Ed25519"; x: string }
  | { kty: "EC"; crv: "P-256"; x: string; y: string };

export interface VerificationSignature {
  algorithm: VerificationAlgorithm;
  keyId: string;
  canonicalization: typeof VERIFICATION_CANONICALIZATION;
  /** Base64 (standard alphabet, padded) of the raw signature bytes. */
  value: string;
  /** Human-readable statement of what the bytes above cover. */
  signedFields: string;
}

export interface VerificationPassport {
  schemaVersion: "1.0";
  documentType: typeof VERIFICATION_DOCUMENT_TYPE;
  verificationMode: typeof SERVER_VERIFIED_MODE;
  passportId: string;
  issuer: string;
  inspectedAt: string;
  coreVersion: string;
  ruleSetId: string;
  ruleSetVersion: string;
  profileId: ProfileId;
  asset: {
    fileName: string;
    format: AssetFormat;
    byteLength: number;
    sha256: string;
  };
  metrics: AssetMetrics;
  findings: Finding[];
  score: ScoreReport;
  resultDigest: string;
  limitations: string[];
  signature: VerificationSignature;
}

/** The passport before a signature exists — exactly what gets canonicalized and signed. */
export type UnsignedVerificationPassport = Omit<VerificationPassport, "signature">;

export interface VerificationKeyPair {
  algorithm: VerificationAlgorithm;
  keyId: string;
  publicKey: VerificationPublicKey;
  privateJwk: JsonWebKey;
}

/**
 * What a passport does NOT prove. Stamped into every signed document so the limits travel with
 * the claim instead of living only in a docs page the recipient never opens.
 */
export const SERVER_VERIFICATION_LIMITATIONS: readonly string[] = [
  "이 서명은 'Clunk 서버가 이 sha256을 가진 바이트를 직접 열어 이 규칙 세트로 검사했고 그 결과가 아래와 같다'는 사실만 증명합니다.",
  "해당 에셋이 특정 게임·엔진·기기에서 실제로 정상 동작한다는 보증이 아닙니다.",
  "Game-Ready Score는 Clunk가 선언한 정책 점수이며 범용 엔진 인증이 아닙니다.",
  "검사 대상 바이트는 검사 직후 폐기되며 Clunk는 원본을 보관하지 않습니다. 따라서 나중에 원본을 재현해 주지 못합니다.",
  "v1 규칙 세트는 손실 압축·텍스처 변환·애니메이션 품질을 평가하지 않습니다.",
];

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const BASE64_LOOKUP: Record<string, number> = (() => {
  const table: Record<string, number> = {};
  for (let index = 0; index < BASE64_ALPHABET.length; index++) {
    table[BASE64_ALPHABET[index]] = index;
  }
  // base64url is accepted on the way in so a JWK-style value can be pasted anywhere.
  table["-"] = 62;
  table["_"] = 63;
  return table;
})();

export function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = index + 1 < bytes.length ? bytes[index + 1] : undefined;
    const c = index + 2 < bytes.length ? bytes[index + 2] : undefined;
    out += BASE64_ALPHABET[a >> 2];
    out += BASE64_ALPHABET[((a & 0b11) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? "=" : BASE64_ALPHABET[((b & 0b1111) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? "=" : BASE64_ALPHABET[c & 0b111111];
  }
  return out;
}

export function fromBase64(value: string): Uint8Array {
  const clean = value.replace(/[\s=]/g, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of clean) {
    const digit = BASE64_LOOKUP[character];
    if (digit === undefined) throw new Error(`base64 문자열에 사용할 수 없는 문자가 있습니다: ${character}`);
    buffer = (buffer << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function base64UrlToBase64(value: string): string {
  return value.replace(/-/g, "+").replace(/_/g, "/");
}

/** Stable, algorithm-independent identifier for a public key. Short enough to print. */
export function computeKeyId(publicKey: VerificationPublicKey): string {
  return sha256Hex(new TextEncoder().encode(stableStringify(publicKey))).slice(0, 16);
}

function subtle(): SubtleCrypto {
  const webcrypto = (globalThis as { crypto?: Crypto }).crypto;
  if (!webcrypto?.subtle) {
    throw new Error("이 런타임에는 Web Crypto(crypto.subtle)가 없어 서버 검증 서명을 처리할 수 없습니다.");
  }
  return webcrypto.subtle;
}

/*
 * Ed25519 takes a bare `{ name }` while ECDSA needs a curve on import and a hash on sign. The
 * lib.dom typings model those as separate interfaces, so one loose shape is declared here and
 * narrowed at each call site instead of branching the crypto calls themselves.
 */
function importParams(algorithm: VerificationAlgorithm): EcKeyImportParams {
  return (
    algorithm === "Ed25519" ? { name: "Ed25519" } : { name: "ECDSA", namedCurve: "P-256" }
  ) as EcKeyImportParams;
}

function signParams(algorithm: VerificationAlgorithm): EcdsaParams {
  return (
    algorithm === "Ed25519" ? { name: "Ed25519" } : { name: "ECDSA", hash: { name: "SHA-256" } }
  ) as EcdsaParams;
}

/**
 * Read `CLUNK_VERIFY_PRIVATE_KEY`.
 *
 * Accepted forms, in order of what an operator is likely to paste:
 *   1. the JWK JSON itself, e.g. {"kty":"OKP","crv":"Ed25519","d":"...","x":"..."}
 *   2. base64 (or base64url) of that same JSON, for shells that mangle braces and quotes
 *
 * The public half is derived from the private JWK rather than configured separately, so the two
 * can never drift apart and an operator only has one secret to handle.
 */
export function parseVerificationPrivateKey(raw: string): VerificationKeyPair {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) throw new Error("CLUNK_VERIFY_PRIVATE_KEY 값이 비어 있습니다.");
  let jwk: Record<string, unknown>;
  const decoded = trimmed.startsWith("{")
    ? trimmed
    : new TextDecoder().decode(fromBase64(base64UrlToBase64(trimmed)));
  try {
    jwk = JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    throw new Error(
      "CLUNK_VERIFY_PRIVATE_KEY를 읽지 못했습니다. JWK JSON 또는 그 JSON의 base64 값이어야 합니다. `npm run clunk -- verify-keygen`으로 새 키를 만들 수 있습니다.",
    );
  }
  if (!jwk || typeof jwk !== "object" || typeof jwk.d !== "string" || typeof jwk.x !== "string") {
    throw new Error("CLUNK_VERIFY_PRIVATE_KEY가 개인키 JWK가 아닙니다(d, x 필드가 필요합니다).");
  }
  if (jwk.kty === "OKP" && jwk.crv === "Ed25519") {
    const publicKey: VerificationPublicKey = { kty: "OKP", crv: "Ed25519", x: jwk.x };
    return {
      algorithm: "Ed25519",
      keyId: computeKeyId(publicKey),
      publicKey,
      // `alg`/`key_ops`/`ext` are dropped: Node stamps alg:"Ed25519" on export and some
      // runtimes reject the pair on import.
      privateJwk: { kty: "OKP", crv: "Ed25519", x: jwk.x, d: jwk.d },
    };
  }
  if (jwk.kty === "EC" && jwk.crv === "P-256" && typeof jwk.y === "string") {
    const publicKey: VerificationPublicKey = { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y };
    return {
      algorithm: "ECDSA-P256-SHA256",
      keyId: computeKeyId(publicKey),
      publicKey,
      privateJwk: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, d: jwk.d },
    };
  }
  throw new Error(
    "지원하는 키는 Ed25519(OKP) 또는 P-256(EC) JWK 두 가지입니다. 다른 곡선의 키는 사용할 수 없습니다.",
  );
}

/** Generate a fresh issuing key. Used by `clunk verify-keygen`; never called at request time. */
export async function generateVerificationKeyPair(
  algorithm: VerificationAlgorithm = "Ed25519",
): Promise<{ pair: VerificationKeyPair; privateKeyEnvValue: string }> {
  const generated = (await subtle().generateKey(importParams(algorithm) as EcKeyGenParams, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const exported = (await subtle().exportKey("jwk", generated.privateKey)) as Record<string, unknown>;
  const minimal =
    algorithm === "Ed25519"
      ? { kty: "OKP", crv: "Ed25519", x: exported.x, d: exported.d }
      : { kty: "EC", crv: "P-256", x: exported.x, y: exported.y, d: exported.d };
  const json = JSON.stringify(minimal);
  return { pair: parseVerificationPrivateKey(json), privateKeyEnvValue: toBase64(new TextEncoder().encode(json)) };
}

/**
 * Turn an InspectionReport into the document that gets signed.
 *
 * Every field is copied from a report the *server* computed from bytes it read itself, so there is
 * no field a caller can steer. Lives in core rather than the route so the test suite signs exactly
 * what production signs.
 */
export function buildUnsignedVerificationPassport(
  report: InspectionReport,
  issuer: string,
  inspectedAt: string,
): UnsignedVerificationPassport {
  return {
    schemaVersion: "1.0",
    documentType: VERIFICATION_DOCUMENT_TYPE,
    verificationMode: SERVER_VERIFIED_MODE,
    passportId: `verify-${report.inputHash.slice(0, 12)}-${report.resultDigest.slice(0, 8)}`,
    issuer,
    inspectedAt,
    coreVersion: report.coreVersion,
    ruleSetId: report.ruleSetId,
    ruleSetVersion: report.ruleSetVersion,
    profileId: report.profileId,
    asset: {
      fileName: report.fileName,
      format: report.format,
      byteLength: report.byteLength,
      sha256: report.inputHash,
    },
    metrics: report.metrics,
    findings: report.findings,
    score: report.score,
    resultDigest: report.resultDigest,
    limitations: [...SERVER_VERIFICATION_LIMITATIONS],
  };
}

/** The exact bytes a signature covers: the whole document except the `signature` member. */
export function canonicalVerificationBytes(document: UnsignedVerificationPassport): Uint8Array {
  return new TextEncoder().encode(stableStringify(document));
}

export async function signVerificationPassport(
  document: UnsignedVerificationPassport,
  keys: VerificationKeyPair,
): Promise<VerificationPassport> {
  const privateKey = await subtle().importKey("jwk", keys.privateJwk, importParams(keys.algorithm), false, ["sign"]);
  const signature = await subtle().sign(
    signParams(keys.algorithm),
    privateKey,
    canonicalVerificationBytes(document) as unknown as ArrayBuffer,
  );
  return {
    ...document,
    signature: {
      algorithm: keys.algorithm,
      keyId: keys.keyId,
      canonicalization: VERIFICATION_CANONICALIZATION,
      value: toBase64(new Uint8Array(signature)),
      signedFields: "`signature`를 제외한 이 문서의 모든 필드 (키 이름 사전순 정렬 JSON, UTF-8)",
    },
  };
}

export type VerificationCheck =
  | { ok: true; keyId: string; algorithm: VerificationAlgorithm }
  | { ok: false; reason: string };

/**
 * Verify a signed passport against a published public key.
 *
 * Deliberately offline: it takes the key as a value. A recipient can hold the key in a file
 * checked into their own repo and never talk to Clunk again.
 */
export async function verifyVerificationPassport(
  document: unknown,
  publicKey: VerificationPublicKey,
): Promise<VerificationCheck> {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return { ok: false, reason: "Passport가 JSON 객체가 아닙니다." };
  }
  const record = document as Record<string, unknown>;
  if (record.documentType !== VERIFICATION_DOCUMENT_TYPE || record.verificationMode !== SERVER_VERIFIED_MODE) {
    return {
      ok: false,
      reason:
        "이 파일은 서버 검증 Passport가 아닙니다. 로컬 검사 기록(client-local-attested)은 서명이 없어 제3자 검증 대상이 아닙니다.",
    };
  }
  const signature = record.signature as Partial<VerificationSignature> | undefined;
  if (!signature || typeof signature !== "object" || typeof signature.value !== "string") {
    return { ok: false, reason: "서명 블록(signature)이 없습니다." };
  }
  if (signature.canonicalization !== VERIFICATION_CANONICALIZATION) {
    return { ok: false, reason: `알 수 없는 정규화 방식입니다: ${String(signature.canonicalization)}` };
  }
  if (signature.algorithm !== "Ed25519" && signature.algorithm !== "ECDSA-P256-SHA256") {
    return { ok: false, reason: `알 수 없는 서명 알고리즘입니다: ${String(signature.algorithm)}` };
  }
  const expectedKeyId = computeKeyId(publicKey);
  if (signature.keyId !== expectedKeyId) {
    return {
      ok: false,
      reason: `Passport는 keyId ${String(signature.keyId)}로 서명되었지만 대조에 사용한 공개키의 keyId는 ${expectedKeyId}입니다.`,
    };
  }
  const expectedAlgorithm: VerificationAlgorithm = publicKey.kty === "OKP" ? "Ed25519" : "ECDSA-P256-SHA256";
  if (signature.algorithm !== expectedAlgorithm) {
    return { ok: false, reason: "서명 알고리즘이 공개키 종류와 맞지 않습니다." };
  }
  const unsigned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key !== "signature") unsigned[key] = value;
  }
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = fromBase64(signature.value);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "서명 값을 디코딩하지 못했습니다." };
  }
  const key = await subtle().importKey(
    "jwk",
    publicKey as unknown as JsonWebKey,
    importParams(signature.algorithm),
    false,
    ["verify"],
  );
  const valid = await subtle().verify(
    signParams(signature.algorithm),
    key,
    signatureBytes as unknown as ArrayBuffer,
    canonicalVerificationBytes(unsigned as unknown as UnsignedVerificationPassport) as unknown as ArrayBuffer,
  );
  if (!valid) {
    return {
      ok: false,
      reason: "서명이 문서 내용과 일치하지 않습니다. 발급 후 내용이 수정되었거나 다른 키로 만든 문서입니다.",
    };
  }
  return { ok: true, keyId: expectedKeyId, algorithm: signature.algorithm };
}

/**
 * Recompute the inspection digest from the passport's own fields.
 *
 * The signature already covers every field, so this cannot catch a forgery. What it catches is an
 * *inconsistent* document — a `resultDigest` that does not describe the metrics and findings
 * printed beside it — which is the shape a partially edited or partially migrated record takes.
 * It is the same canonical object `inspectAsset` hashes, rebuilt from the passport.
 */
export function recomputeInspectionDigest(passport: VerificationPassport): string {
  return sha256Hex(
    new TextEncoder().encode(
      stableStringify({
        schemaVersion: "1.0",
        coreVersion: passport.coreVersion,
        ruleSetId: passport.ruleSetId,
        ruleSetVersion: passport.ruleSetVersion,
        profileId: passport.profileId,
        fileName: passport.asset.fileName,
        format: passport.asset.format,
        byteLength: passport.asset.byteLength,
        inputHash: passport.asset.sha256,
        metrics: passport.metrics,
        findings: passport.findings,
        score: passport.score,
      }),
    ),
  );
}

/** Shape check for a public key read from a file or the well-known endpoint. */
export function parseVerificationPublicKey(value: unknown): VerificationPublicKey {
  const source =
    value && typeof value === "object" && "publicKey" in (value as Record<string, unknown>)
      ? (value as Record<string, unknown>).publicKey
      : value;
  const record = source as Record<string, unknown> | null;
  if (!record || typeof record !== "object") throw new Error("공개키 JSON을 읽지 못했습니다.");
  if (record.kty === "OKP" && record.crv === "Ed25519" && typeof record.x === "string") {
    return { kty: "OKP", crv: "Ed25519", x: record.x };
  }
  if (record.kty === "EC" && record.crv === "P-256" && typeof record.x === "string" && typeof record.y === "string") {
    return { kty: "EC", crv: "P-256", x: record.x, y: record.y };
  }
  throw new Error("공개키는 Ed25519(OKP) 또는 P-256(EC) JWK여야 합니다.");
}
