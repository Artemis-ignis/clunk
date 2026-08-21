# 서버 검증 Passport (옵트인)

## 왜 필요한가

Clunk의 기본 검사는 이용자의 브라우저에서 실행되고, 서버는 브라우저가 보낸 리포트를 저장한다.
서버가 하는 확인은 두 가지뿐이다.

1. 리포트의 필드가 같은 요청에 담긴 요약값과 일치하는가
2. `resultDigest`가 그 리포트 자신의 해시인가

두 값 모두 클라이언트가 만든 데이터에서 클라이언트가 계산할 수 있다. 즉 **자기참조 검증**이다.
`score: 100, ready: true`짜리 리포트를 손으로 만들어 보내면 그대로 저장되고, 한 번도 열어본 적
없는 파일에 "Clunk 검사 통과" 기록이 남는다. 소유자 본인에게는 재현 가능한 기록으로 쓸모가
있지만, 퍼블리셔나 발주처에 제출하는 증명서로는 값이 0이다. 발급자와 주장하는 사람이 같은
기계이기 때문이다.

서버 검증은 그 축을 바꾼다. 이용자가 명시적으로 선택한 에셋만 바이트를 업로드하고, Clunk 서버가
`packages/core`의 `inspectAsset`을 **직접** 돌려 리포트를 만들고, 그 결과에 서명한다. 받는 쪽은
공개키로 서명을 대조한다. 보낸 사람을 믿을 필요가 없다.

기본값은 그대로 로컬 검사다. 서버 검증은 이용자가 요청한 파일에만 적용된다.

---

## 1. 엔드포인트

### `POST /api/verifications`

에셋 바이트를 업로드하고 서명된 Passport를 받는다. 로그인 필요, 동일 출처 요청만 허용.

요청은 **multipart가 아니라 원본 바이트 그대로**다. 이유는 프레임워크 제약이다. App Router는
action id 없는 `multipart/form-data` POST를 전부 progressive-enhancement Server Action으로 보고
라우트 핸들러에 닿기 전에 1MB에서 plain-text 413으로 거절한다. octet-stream 본문은 그 경로를
통째로 피하고, 폼 파싱이 만드는 추가 버퍼링도 없앤다.

| 항목 | 값 |
| --- | --- |
| `content-type` | `application/octet-stream` (필수) |
| `x-clunk-file-name` | 파일 이름, **percent-encoded UTF-8**. `.glb` 또는 `.gltf`로 끝나야 한다 |
| `x-clunk-profile-id` | `web` \| `mobile` \| `pc` |
| body | 파일 바이트 그대로 |

```bash
curl -X POST http://localhost:3025/api/verifications \
  -H "content-type: application/octet-stream" \
  -H "x-clunk-file-name: $(node -e 'process.stdout.write(encodeURIComponent("트랙터.glb"))')" \
  -H "x-clunk-profile-id: pc" \
  --data-binary @tractor.glb
```

성공 응답(200):

```jsonc
{
  "ok": true,
  "verificationMode": "server-verified",
  "assetId": "asset-...",
  "analysisId": "analysis-3db33225dda5-d2c961ef",
  "passportId": "verify-3db33225dda5-d2c961ef",
  "keyId": "0efc3e5e14207037",
  "algorithm": "Ed25519",
  "status": "ready" | "blocked",
  "credits": 22,          // 차감 후 잔액
  "creditCost": 3,
  "idempotent": false,    // 같은 바이트+프로파일 재요청이면 true, 추가 차감 없음
  "bytesRetained": false,
  "passport": { /* 서명된 Passport 문서. 아래 3절 */ },
  "report": { /* 서버가 만든 InspectionReport + verificationMode 등 */ }
}
```

오류 응답은 전부 `{ ok: false, error, code }` 형태다.

| 상태 | `code` | 상황 |
| --- | --- | --- |
| 401 | `auth_required` | 로그인 없음 |
| 403 | `cross_origin_rejected` | 다른 출처에서 보낸 쓰기 요청 |
| 402 | `insufficient_credits` | 크레딧 부족 (`balance`, `required` 동봉) |
| 413 | `verification_upload_too_large` | 상한 초과 (`maxUploadBytes` 동봉) |
| 415 | `verification_bad_content_type` | octet-stream이 아님 |
| 400 | `verification_unsupported_file` | 파일 이름 헤더 없음 / 확장자 불일치 |
| 400 | `verification_unsupported_profile` | 프로파일 값이 web·mobile·pc가 아님 |
| 422 | `verification_unparseable` | glTF 2.0으로 못 읽음. **크레딧 차감 없음** |
| 503 | `server_verification_disabled` | 서명키 미설정 (fail-closed) |

### `GET /api/verifications`

정책 조회. 업로드 전에 상한·비용·활성 여부를 확인하는 용도.

```json
{
  "ok": true, "enabled": true,
  "algorithm": "Ed25519", "keyId": "0efc3e5e14207037",
  "publicKeyUrl": "/.well-known/clunk-verification-key",
  "maxUploadBytes": 16777216, "creditCost": 3,
  "acceptedFormats": ["glb", "gltf"], "profileIds": ["web", "mobile", "pc"],
  "bytesRetained": false
}
```

### `GET /.well-known/clunk-verification-key`

공개키 배포. 인증 없음, 캐시 가능(`public, max-age=300, s-maxage=3600`).

```json
{
  "schemaVersion": "1.0", "ok": true, "enabled": true,
  "issuer": "https://clunk.example",
  "documentType": "clunk-verification-passport",
  "algorithm": "Ed25519",
  "keyId": "0efc3e5e14207037",
  "keyFormat": "jwk",
  "publicKey": { "kty": "OKP", "crv": "Ed25519", "x": "6WZF6b6jArH9b1sJ_RgeyjEdVA42SzxwcFck_knyLE8" },
  "canonicalization": "clunk-stable-json-v1",
  "signatureEncoding": "base64"
}
```

---

## 2. 서명

**알고리즘: Ed25519.** Workers(workerd)의 `crypto.subtle`에서 `{ name: "Ed25519" }` 로 동작하는
것을 실제 요청으로 확인했다. Node 22+의 WebCrypto에도 있으므로 CLI 검증이 같은 코드로 돈다.
ECDSA P-256(`ECDSA-P256-SHA256`)도 대체 경로로 구현되어 있고 테스트로 덮여 있다 — 키 JWK의
`kty`가 알고리즘을 결정하므로, P-256 키를 넣으면 그대로 P-256으로 서명한다.

**정규화(`clunk-stable-json-v1`).** 서명 대상 바이트는
`UTF-8(stableStringify(signature를 제외한 문서 전체))` 이다. `stableStringify`는 객체 키를
사전순으로 정렬하고 `undefined` 필드를 버린다. 따라서 문서의 어느 필드든 한 글자만 바뀌어도
서명이 깨진다.

**키.** `CLUNK_VERIFY_PRIVATE_KEY` 환경변수 하나만 쓴다. 값은 개인키 JWK JSON이거나 그 JSON의
base64다. 공개키는 개인키 JWK의 `x`(및 P-256이면 `y`)에서 유도하므로 둘이 어긋날 수 없다.
`keyId`는 공개키 JWK의 정규화 JSON을 sha256한 앞 16자다.

```
npm run clunk -- verify-keygen               # Ed25519
npm run clunk -- verify-keygen --algorithm p256
```

출력된 `CLUNK_VERIFY_PRIVATE_KEY=...` 한 줄을 서버 환경변수(로컬은 `.dev.vars`)에 넣는다.
**미설정이면 기능 전체가 꺼진다(fail-closed).** POST·GET·well-known 모두 503과 한국어 안내를
돌려주고, 크레딧은 움직이지 않는다. 서명 없는 문서를 "공식처럼 보이게" 발급하는 경로는 없다.

---

## 3. Passport 문서

```jsonc
{
  "schemaVersion": "1.0",
  "documentType": "clunk-verification-passport",
  "verificationMode": "server-verified",
  "passportId": "verify-<inputHash 12자>-<resultDigest 8자>",
  "issuer": "https://clunk.example",
  "inspectedAt": "2026-08-21T15:10:37.598Z",
  "coreVersion": "0.1.0",
  "ruleSetId": "clunk-game-ready-v1",
  "ruleSetVersion": "1.0.0",
  "profileId": "pc",
  "asset": { "fileName": "...", "format": "glb", "byteLength": 949384, "sha256": "3db3..." },
  "metrics": { /* AssetMetrics 전체 */ },
  "findings": [ /* Finding[] */ ],
  "score": { "score": 97, "threshold": 90, "ready": false, "hardBlockerCount": 1, ... },
  "resultDigest": "d2c961ef...",
  "limitations": [ "..." ],
  "signature": {
    "algorithm": "Ed25519",
    "keyId": "0efc3e5e14207037",
    "canonicalization": "clunk-stable-json-v1",
    "value": "<base64 서명>",
    "signedFields": "`signature`를 제외한 이 문서의 모든 필드 (키 이름 사전순 정렬 JSON, UTF-8)"
  }
}
```

### 두 종류의 Passport 구분

| | 로컬 검사 기록 | 서버 검증 Passport |
| --- | --- | --- |
| `verificationMode` | `client-local-attested` | `server-verified` |
| `documentType` | 없음 | `clunk-verification-passport` |
| `signature` | **없음** | 있음 (`algorithm`/`keyId`/`value`) |
| 검사를 실행한 주체 | 이용자의 브라우저 | Clunk 서버 |
| 제3자 검증 | 불가 (같은 파일로 재현만 가능) | 가능 (공개키 대조) |
| 화면 표시 | "로컬 검사 기록 · 서버 검증 아님" | "Clunk 서버 검증 · Ed25519 서명" |

Passport 보관함(`/passport`)은 `documentType` + `verificationMode` + `signature` 세 조건을 모두
만족하는 문서만 서버 검증으로 표시한다. 하나라도 어긋나면 로컬 기록으로 떨어진다. 로컬 기록에는
"검증됨"이라는 말을 절대 붙이지 않는다.

---

## 4. 상한과 근거

실측(로컬 dev, workerd, 왕복 시간 = 업로드 + 서버 검사 + 서명 + D1 기록):

| 파일 | 바이트 | 삼각형 | 왕복 |
| --- | ---: | ---: | ---: |
| `clunk-ready-sample.glb` | 1,224 | 2 | 118ms |
| `farm-windmill.m1.glb` | 35,292 | 408 | 35ms |
| `bench-0.5mb.glb` | 651,592 | 6,000 | 71ms |
| `tractor.flat.glb` | 949,384 | 12,324 | 64ms |
| `cultivator.raw.glb` | 2,425,056 | 27,008 | 119ms |
| `tractor.raw.glb` | 4,101,256 | 43,968 | 198ms |
| `processing.line.m1.raw.glb` | 4,861,588 | 54,540 | 207ms |
| `bench-4mb.glb` | 5,619,624 | 52,000 | 225ms |
| `bench-8mb.glb` | 11,343,644 | 105,000 | 446ms |
| `bench-15mb.glb` | 15,555,644 | 144,000 | 604–658ms |
| `bench-16mb.glb` | 22,683,644 | 210,000 | 836–897ms |
| `bench-31mb.glb` | 31,323,656 | 290,000 | 1,126–1,139ms |

시간은 병목이 아니다. 31MB도 1.1초로 Workers CPU 예산 근처에 가지 않는다. **병목은 메모리다.**
isolate 메모리는 128MB인데 업로드 하나가 경로 위에서 약 4번 존재한다.

1. 요청 본문 버퍼
2. `createAssetBundle`의 `new Uint8Array(bytes)` 사본
3. `normalizeBundle`의 사본
4. `parseGlb`의 BIN 청크 사본

32MB면 최악의 순간 합이 한계선 위로 올라간다. **상한을 16MB로 잡는다.** 최악 약 64MB로 isolate
절반 수준이고, 레퍼런스 코퍼스의 최대 에셋(4.9MB)의 3배 여유가 있다.

상한 초과는 **바이트를 읽기 전에** 거절한다. 본문이 원본 그대로이므로 `content-length`가 곧
파일 크기이고, 그 값만 보고 413을 돌려준다.

```
서버 검증은 16MB 이하 파일만 받습니다. 이 요청은 약 16.3MB입니다. 에셋을 나누거나 로컬 검사를 사용해 주세요.
```

---

## 5. 크레딧

**서버 검증 1건 = 3크레딧** (로컬 검사 저장은 1크레딧).

근거:

- 로컬 검사 저장(`POST /api/runs`)은 Clunk의 CPU를 쓰지 않는다. 브라우저가 계산했고 서버는 행을
  하나 썼을 뿐이다.
- 서버 검증은 최대 16MB 업로드 대역, 서버에서의 전체 검사(실측 최대 ~0.9초), 서명, 그리고
  D1 쓰기 3건(asset·analysis·passport)을 쓴다. 요청당 실측 비용이 대략 한 자릿수 배 차이다.
- 동시에, 값을 지불할 만한 유일한 모드를 못 쓰게 만들 만큼 비싸면 안 된다. 데모 잔액 25개 기준
  8건까지 발급할 수 있다.

멱등키는 `verify:<analysisId>`이고 `analysisId`는 `analysis-<inputHash 12자>-<resultDigest 8자>`,
즉 **바이트와 해석된 규칙만의 함수**다. 같은 파일을 같은 프로파일로 다시 올리면 같은 키가 되어
`idempotent: true`로 응답하고 추가 차감이 없다. 파싱 실패(422)와 상한 초과(413)는 크레딧을
건드리지 않는다.

---

## 6. 업로드 바이트를 저장하지 않는다는 보장

- 바이트는 `app/api/verifications/route.ts`의 `inspectUploadedAsset()` **안에서만** 존재한다. 이
  함수가 돌려주는 것은 `InspectionReport`(숫자·규칙 id·해시)와 검사 시각뿐이다.
- 호출부에는 바이트 참조가 없다. D1에 쓰는 세 문장은 파일 이름·형식·바이트 길이·sha256·리포트
  JSON·Passport JSON만 바인딩한다.
- 배포에 객체 저장소 바인딩 자체가 없다(`.openai/hosting.json`의 `"r2": null`). 실수로라도 쓸
  대상이 존재하지 않는다.
- 응답에 `bytesRetained: false`를 명시한다.
- 개인정보처리방침 1절과 2절, 이용약관 제2조, 설정 화면의 "저장하지 않는 것" 목록에 모두
  반영되어 있다.

---

## 7. 받는 쪽에서 검증하는 방법

```
npm run clunk -- verify <passport.json> [--asset <파일>] [--key <공개키.json> | --key-url <url>]
```

- `--asset` 을 주면 그 파일의 sha256을 Passport의 `asset.sha256`과 대조한다.
- `--key` 는 well-known 응답을 저장해 둔 파일. **오프라인 검증 경로**이며 권장 방식이다.
  환경변수 `CLUNK_VERIFY_PUBLIC_KEY_FILE` 로도 준다.
- `--key` / `--key-url` 이 모두 없으면 Passport가 스스로 밝힌 `issuer`에서 공개키를 받아온다.
  이건 trust-on-first-use이므로 CLI가 경고를 출력한다. 위조자가 그 출처를 통제하면 맞는 키를
  내려줄 수 있기 때문이다. 한 번 받아 파일로 고정(pin)하는 것이 정답이다.

종료 코드: 통과 `0`, 검증 실패 `2`, 파일/사용법 오류 `1`.

검사 항목 세 가지:

1. **서명** — 공개키로 대조. `keyId`가 다르면 대조 전에 실패시킨다.
2. **내부 정합성** — `metrics`/`findings`/`score`에서 `resultDigest`를 다시 계산해 비교. 서명이
   이미 전부를 덮으므로 위조를 잡는 용도는 아니고, 부분적으로 손상·이관된 문서를 잡는다.
3. **파일 대조** — `--asset` 이 있을 때만. 없으면 `[SKIP]`으로 명시한다.

---

## 8. 이 기능이 보장하지 않는 것

Passport의 `limitations` 배열에 그대로 들어가 문서와 함께 이동한다.

- 서명이 증명하는 것은 **"Clunk 서버가 이 sha256을 가진 바이트를 직접 열어 이 규칙 세트로
  검사했고 결과가 이렇다"** 뿐이다.
- 그 에셋이 특정 게임·엔진·기기에서 **실제로 잘 돈다는 보증이 아니다.** 런타임 성능, 셰이더
  호환성, 아트 품질은 검사 대상이 아니다.
- Game-Ready Score는 Clunk가 선언한 정책 점수이며 범용 엔진 인증이 아니다.
- Clunk는 원본을 보관하지 않으므로 나중에 원본을 재현해 주지 못한다. 대조는 **받는 쪽이 파일을
  가지고 있을 때만** 완결된다.
- v1 규칙 세트는 손실 압축·텍스처 변환·애니메이션 품질을 평가하지 않는다.
- 서명은 발급 시점의 사실을 봉인할 뿐, 이후 파일이 바뀌지 않았음을 보장하지 않는다. 그래서
  `--asset` 대조가 필요하다.
- `.gltf`는 자체 완결(embedded) 파일만 다룬다. 외부 리소스를 참조하는 번들은 미해결 리소스로
  집계되어 finding에 잡힌다.

---

## 9. 검사기 UI에서 호출하기

`ClunkInspector.tsx`는 아직 연결되어 있지 않다. 붙일 때 쓰는 최소 코드:

```ts
// 1) 업로드 전에 정책을 읽어 상한을 넘는 파일은 아예 올리지 않는다.
const policy = await fetch("/api/verifications", { headers: { accept: "application/json" } })
  .then((r) => r.json())
  .catch(() => null);

if (!policy?.ok) {
  // 503 = 이 서버에는 서명키가 없다. 서버 검증 버튼 자체를 숨기거나 비활성화한다.
  return;
}
if (bytes.byteLength > policy.maxUploadBytes) {
  setError(
    `서버 검증은 ${(policy.maxUploadBytes / 1024 / 1024).toFixed(0)}MB 이하 파일만 받습니다. ` +
      `이 파일은 ${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB입니다.`,
  );
  return;
}

// 2) 바이트를 그대로 보낸다. FormData를 쓰면 프레임워크가 1MB에서 잘라 버린다.
const response = await fetch("/api/verifications", {
  method: "POST",
  headers: {
    "content-type": "application/octet-stream",
    "x-clunk-file-name": encodeURIComponent(fileName),
    "x-clunk-profile-id": profileId, // "web" | "mobile" | "pc"
  },
  body: bytes,
});
const body = await response.json();

if (typeof body.credits === "number") setCredits(body.credits);
if (!response.ok) {
  setError(body.error); // 이미 한국어 문장이다. 그대로 보여주면 된다.
  return;
}

// 3) 서명된 Passport를 내려받게 한다.
downloadJson(JSON.stringify(body.passport, null, 2), `${body.passportId}.json`);
```

UI 문구 주의: 서버 검증을 받지 않은 결과에 "검증됨"을 쓰지 않는다. 로컬 검사 결과는 "로컬 검사
결과", 서버 검증 결과만 "Clunk 서버 검증"으로 부른다. 비용(3크레딧)과 "이 파일이 서버로
업로드된다"는 사실을 버튼 근처에 반드시 적는다 — 옵트인은 이용자가 무엇을 선택하는지 알 때만
옵트인이다.
