# 서버 측 재검증 설계 (R2 + Worker reinspection)

작성일: 2026-08-21 (KST) · 상태: 설계 초안, 코드 변경 없음 · 대상 저장소: `C:\Users\50106\Desktop\Clunk`

이 문서는 Clunk Passport를 현재의 **client-local-attested**(클라이언트가 브라우저에서 산출한 리포트를 서버가 digest·해시 정합성만 검증해 저장)에서, 고객이 명시적으로 선택했을 때만 **server-verified**(Cloudflare Worker가 R2에 올라온 실제 바이트를 직접 다시 검사)로 승급시키는 경로를 설계합니다.

전제 원칙 하나를 먼저 못 박습니다. **기본값은 바뀌지 않습니다.** `docs/application/form-answers.ko.md` Q3-1에 쓴 "원본 파일은 사용자의 브라우저 안에서 처리하고 서버로 자동 업로드하지 않습니다"는 이 기능이 들어간 뒤에도 참이어야 합니다. 서버 검증은 **에셋 단위 opt-in**이며, 자동 업로드·일괄 업로드·"항상 켜기" 설정은 1단계에 넣지 않습니다.

---

## 1. 목표와 비목표

### 1.1 누가, 왜 서버 검증을 필요로 하는가

현재 신뢰 모델은 "인증된 사용자가 자기 브라우저에서 돌린 결과를 자기 워크스페이스에 기록한다"입니다. 이 모델이 무너지는 순간은 **리포트를 읽는 사람이 리포트를 만든 사람과 다를 때**입니다. 구체적으로 세 갈래입니다.

| 수요자 | 상황 | client-local-attested로 부족한 이유 |
| --- | --- | --- |
| 팀 감사 (내부) | 아트 담당자가 검사하고 테크아트 리드가 승인 | 리드는 담당자의 브라우저를 신뢰해야 함. Core를 패치한 브라우저·조작된 fetch로 임의 리포트를 만들 수 있음 |
| 납품 증빙 (외부) | 외주 스튜디오가 발주사에 "Clunk 검사 통과"를 증빙으로 제출 | 발주사 입장에서 공급자가 스스로 만든 증거. 제3자 재현이 불가능 |
| CI 게이트 | 파이프라인이 Passport를 머지 조건으로 사용 | CI 러너가 신뢰 경계 밖. 브랜치별로 Core 버전이 흔들리면 재현 불가 |

세 경우 모두 필요한 것은 같습니다. **"클라이언트가 뭐라고 주장했는가"가 아니라 "우리가 그 바이트를 직접 읽고 같은 결론에 도달했는가"** 를 기록에 남기는 것입니다.

### 1.2 목표

1. 고객이 특정 에셋에 대해 명시적으로 요청했을 때만, 그 에셋의 원본 바이트를 R2에 올리고 Worker에서 `packages/core`의 `inspectAsset`을 그대로 실행해 리포트를 재산출한다.
2. 재산출한 리포트의 `resultDigest`가 클라이언트가 저장해 둔 값과 **일치할 때만** 해당 analysis run과 Passport를 `server-verified`로 승급한다.
3. 불일치는 조용히 덮어쓰지 않고 **불일치 자체를 증거로 기록**한다(제품 명제상 이것이 가장 중요한 산출물이다).
4. 업로드한 원본은 검증 직후 삭제하는 것을 기본값으로 하고, 보관은 별도 opt-in으로만 허용한다.
5. 크레딧·멱등성 경계는 기존 `applyCreditOperation` 패턴을 깨지 않고 확장한다.

### 1.3 비목표 (이번 범위에서 하지 않는 것)

- 자동 업로드, 워크스페이스 전체 "항상 서버 검증" 스위치, 백그라운드 배치 업로드.
- 서버에서의 **최적화 실행**. 서버는 `inspectAsset`만 돌리며, `optimizeAsset`은 계속 클라이언트 전용이다(원본 보존 경계를 서버로 옮기지 않는다).
- 원본 파일의 다운로드 API·미리보기·공유 링크. R2에 올라간 바이트는 **재검사 입력으로만** 읽히고 어떤 경로로도 다시 밖으로 나가지 않는다.
- 무제한 크기 지원. 1단계는 명시적 상한을 두고, 상한 초과 파일은 기존 local-first 경로로 남는다.
- 결제 연동. 크레딧 `kind`만 분리해 두고 실제 과금은 기존 `BillingProvider` 경계 뒤로 미룬다.

---

## 2. 신뢰 모델 변화

### 2.1 현재 (client-local-attested)

`app/api/runs/route.ts` → `verifyClientLocalInspection()` (`app/api/_lib/clunk.ts:192`)가 하는 일은 정확히 이것입니다.

1. payload의 스칼라 필드(`fileName`·`format`·`byteLength`·`inputHash`·`profileId`·`ruleSetId`·`score`·`hardBlockerCount`·`findings.length`)가 `report` 본문과 **서로 모순되지 않는지** 확인.
2. `report`에서 canonical 서브셋(`schemaVersion`·`coreVersion`·`ruleSetId`·`ruleSetVersion`·`profileId`·`fileName`·`format`·`byteLength`·`inputHash`·`metrics`·`findings`·`score`)을 뽑아 `stableStringify` → `sha256Hex` 후 `report.resultDigest`와 대조.

즉 **내부 정합성 검사**입니다. 서버는 `inputHash`가 실제 그 파일의 SHA-256인지, `metrics.triangleCount`가 실제 삼각형 수인지 전혀 알지 못합니다. 클라이언트가 임의의 자기 정합적인 리포트를 만들어 digest까지 맞춰 보내면 서버는 구분하지 못합니다. 이 한계는 `README.md` "정직한 제한"에 이미 그렇게 적혀 있습니다.

### 2.2 추가 (server-verified)

```text
[브라우저]                      [Worker]                       [R2]
inspectAsset(bytes)
  -> report(inputHash, resultDigest)
POST /api/runs  ------------->  verifyClientLocalInspection
                                D1: verification_mode='client-local-attested'

--- 여기까지가 현재. 아래는 사용자가 해당 에셋에 대해 명시적으로 눌렀을 때만 ---

PUT /api/assets/{inputHash}/blob (raw bytes)
                 ------------->  R2.put(body, { sha256 })  --> v1/eph/{ws}/{sha}.glb
POST /api/verifications      ->  R2.get -> Uint8Array
                                 inspectAsset(bundle)   <-- Core를 Worker에서 실행
                                 서버 resultDigest 계산
                                 클라이언트 저장값과 대조
                                 크레딧 -N (kind='verify')
                                 D1: verification_mode='server-verified'
                                 R2.delete (보존 클래스가 eph이면 즉시)
```

승급 조건은 **세 개 전부** 참일 때만입니다.

1. **바이트 동일성** — 업로드된 바이트의 SHA-256이 D1에 기록된 `clunk_analysis_runs.input_hash`와 같다. (R2 `put`의 `sha256` 옵션으로 R2가 쓰기 시점에 강제)
2. **결과 동일성** — Worker의 `inspectAsset(...).resultDigest`가 저장된 `report.resultDigest`와 같다.
3. **엔진 동일성** — Worker의 `CORE_VERSION`·`RULE_SET_VERSION`이 저장된 리포트의 `coreVersion`·`ruleSetVersion`과 같다.

3번은 실수하기 쉬운 지점이라 따로 강조합니다. Core가 한 버전 올라가면 `metrics`나 `findings` 문자열이 조금만 바뀌어도 `resultDigest`가 정당하게 달라집니다. 이걸 "불일치"로 기록하면 오탐이 대량 발생합니다. 그래서 상태는 세 갈래로 나눕니다.

| `status` | 의미 | 처리 |
| --- | --- | --- |
| `verified` | 세 조건 모두 일치 | analysis run·Passport 승급 |
| `mismatch` | 엔진은 같은데 결과가 다름 | **승급하지 않음.** 불일치를 증거로 기록하고 UI에 경고 상태로 노출 |
| `engine-drift` | 저장된 `coreVersion`/`ruleSetVersion`이 Worker와 다름 | 승급하지 않음. "현재 엔진으로 다시 검사하기" 액션 제시 |

`mismatch`가 났을 때 **기존 client-local-attested 행을 덮어쓰거나 지우지 않습니다.** 원래 주장과 서버 측정을 나란히 남기는 것이 이 제품의 존재 이유입니다.

### 2.3 두 모드의 공존 표현 (UX·데이터)

`verificationMode`는 지금 `app/api/runs/route.ts:97`, `app/api/optimizations/route.ts:123,128,222`에서 문자열 리터럴로만 박혀 있고 UI에는 노출되지 않습니다. 이걸 실제 상태로 승격합니다.

**타입** (`packages/core/src/contract.ts`에 추가 권장 — CLI·MCP·VS Code가 같은 어휘를 쓰도록):

```ts
export type VerificationMode =
  | "client-local-attested"
  | "server-verified"
  | "partially-server-verified";   // Passport 전용 롤업 값
export type VerificationStatus = "verified" | "mismatch" | "engine-drift";
```

**Passport 표현.** Passport는 입력·출력 두 파일에 걸쳐 있으므로 단일 플래그로 표현하면 거짓말이 됩니다. 출력만 검증한 상태가 납품 증빙에서 가장 흔하고 또 충분히 유용하기 때문에, 축을 분리합니다.

```jsonc
{
  "passportId": "passport-...",
  "verification": {
    "source": "client-local-attested",
    "output": "server-verified",
    "verifiedAt": "2026-08-21T00:00:00.000Z",
    "verifiedByCoreVersion": "0.1.0",
    "verifiedByRuleSetVersion": "1.0.0"
  },
  "verificationMode": "partially-server-verified"
}
```

롤업 규칙: 둘 다 `server-verified` → `server-verified`, 하나만 → `partially-server-verified`, 둘 다 아님 → `client-local-attested`.

**UI 어휘 (한국어 고정).** 배지는 세 가지만 씁니다. 애매한 중간 표현을 늘리면 신뢰 표현이 오히려 흐려집니다.

- `브라우저 검사` (회색, 기본) — 설명: "이 결과는 사용자의 브라우저에서 계산되었습니다. 서버는 원본 바이트를 보지 않았습니다."
- `서버 재검증` (시안, 강조) — 설명: "Clunk 서버가 같은 파일을 직접 읽어 같은 결과를 확인했습니다. 검증 시각·엔진 버전이 함께 기록됩니다."
- `재검증 불일치` (경고) — 설명: "서버가 같은 파일을 읽었을 때 다른 결과가 나왔습니다. 두 결과를 모두 보관합니다."

배지 옆에는 **항상** 원본 처리 위치를 같이 적습니다. `브라우저 검사` 배지의 툴팁에 "원본은 업로드되지 않았습니다"를 붙여, 기본값이 프라이버시 우위라는 사실을 UI가 계속 말하게 합니다. 서버 검증을 "더 좋은 등급"으로만 보이게 디자인하면 사용자가 불필요하게 업로드하도록 유도됩니다 — 이건 의도적으로 피합니다.

---

## 3. 업로드 흐름

### 3.1 opt-in 계약

업로드는 **에셋 하나 + 사용자 클릭 하나**에 1:1로 대응합니다. 다음을 지킵니다.

- 워크스페이스 설정 `serverVerification`은 `"off" | "ask"` 두 값만 가지며 기본은 `"off"`. `"always"`는 만들지 않습니다.
- `"ask"`여도 검사 시 자동 업로드는 없습니다. Inspector 결과 패널에 `서버 재검증 요청` 버튼이 생길 뿐입니다.
- 버튼을 누르면 확인 모달이 뜨고, 모달은 **실제 값**을 보여줍니다: 파일명, 바이트 수, SHA-256 앞 12자, 보존 클래스(기본 "검증 직후 삭제"), 차감될 크레딧 수. 문구를 하드코딩하지 않고 그 요청의 실제 값을 렌더링합니다.
- 모달에는 `이 파일만 업로드` 버튼 하나만 둡니다. "앞으로 묻지 않기" 체크박스는 넣지 않습니다.

### 3.2 크기 상한 — 근거 있는 수치

Cloudflare Workers의 두 제약을 실제 측정값과 붙여 계산합니다.

**제약**

- Isolate 메모리: **128 MB** (동시 요청이 같은 isolate를 공유).
- CPU 시간: Workers Paid 기본 **30초**/호출(`limits.cpu_ms`로 상향 가능). Workers **Free는 10ms** — 이 경로는 Free에서 원천적으로 불가능합니다(§9 O-4).
- 요청 본문 크기: Cloudflare 프록시 기준 Free/Pro 100 MB, Business 200 MB, Enterprise 500 MB. 우리가 두려는 상한이 훨씬 작으므로 제약이 되지 않습니다.

**실측 (2026-08-21, 이 저장소 Core, Node 22 / V8. workerd도 같은 V8 계열이라 자릿수는 이전 가능)**

`packages/core/src/index.ts:1553`의 `sha256Hex`는 WebCrypto가 아니라 **순수 JS SHA-256 구현**입니다(§4.1). 그래서 처리량이 검사 비용을 지배합니다.

| 입력 | 결과 |
| --- | --- |
| 합성 1 MiB / 4 MiB / 16 MiB 버퍼 `sha256Hex` | 32.9 / 40.7 / **42.2 MB/s** |
| `tractor.compact.m1.glb` (664 KB, prim 88, tri 30,188) | `inspectAsset` 19.77 ms, 그중 sha256 17.01 ms → **비-해시 오버헤드 2.76 ms** |
| `processing.line.m1.glb` (425 KB, prim 78) | `inspectAsset` 11.98 ms / sha256 9.97 ms |
| `cultivator.compact.m1.glb` (185 KB, prim 42) | `inspectAsset` 5.11 ms / sha256 4.23 ms |

읽어낼 사실 두 가지입니다.

1. `inspectAsset` 시간의 **약 85%가 SHA-256**입니다. 나머지(JSON.parse + mesh/primitive 순회)는 바이트 수가 아니라 primitive·node 개수에 비례하며 실측상 몇 ms 수준입니다.
2. 실효 처리량은 실제 GLB에서 **33~36 MB/s**입니다. 보수적으로 **32 MB/s**로 계산합니다.

**메모리 피크 산정.** `inspectAsset` 경로에서 원본 크기 N에 대해 다음 복사가 발생합니다.

| 단계 | 코드 | 추가 |
| --- | --- | --- |
| R2 객체 → 메모리 | `await object.arrayBuffer()` | +N |
| `createAssetBundle` | `new Uint8Array(bytes)` (`index.ts:380`) | +N |
| `normalizeBundle` | `new Uint8Array(bytes)` (`index.ts:680`) | +N |
| `sha256` 패딩 버퍼 | `new Uint8Array(blockCount * 64)` (`index.ts:1577`) | +N (일시) |
| `parseGlb` BIN 청크 | `binary = new Uint8Array(chunk)` (`index.ts:723`) | +약 N |

해시 구간과 파싱 구간이 겹치지 않으므로 피크는 대략 **4N**, 여기에 glTF JSON 객체 그래프가 더해집니다(대형 GLB는 대개 BIN이 크고 JSON은 작아 상대적으로 작음). Worker에서 `createAssetBundle`을 거치지 않고 `AssetBundle` 리터럴을 직접 만들면 복사 한 번을 아껴 **3N**까지 줄일 수 있습니다(Core 변경 불필요 — `AssetBundle`은 공개 인터페이스).

| 파일 크기 | CPU(32 MB/s) | 피크 메모리 4N | 피크 메모리 3N | 판정 |
| --- | --- | --- | --- | --- |
| 4 MiB | 0.13 s | 16 MiB | 12 MiB | 여유 |
| 8 MiB | 0.25 s | 32 MiB | 24 MiB | 여유 |
| **16 MiB** | **0.50 s** | **64 MiB** | **48 MiB** | **1단계 상한** |
| 32 MiB | 1.0 s | 128 MiB | 96 MiB | 128 MB 벽에 붙음 — 불가 |
| 64 MiB | 2.0 s | 256 MiB | 192 MiB | 불가 |

**결론: 1단계 상한은 16 MiB (16,777,216 바이트).** 근거는 CPU가 아니라 메모리입니다. CPU는 30초 예산 대비 0.5초로 약 60배 여유이고, 벽에 먼저 닿는 것은 128 MB isolate입니다. 3N 경로에서도 48 MiB를 쓰므로 vinext/React 서버 런타임 baseline과 합쳐 대략 70~90 MB, 안전 마진 약 1.4~1.8배입니다. 32 MiB는 여유가 사실상 0이므로 채택하지 않습니다.

정직한 커버리지 서술도 문서·UI에 같이 씁니다. Harvest Frontier 실제 런타임 GLB 8종은 185~664 KB로 상한의 1/25 이하입니다. 1K~2K 텍스처를 쓰는 일반적인 마켓·외주 GLB는 대체로 16 MiB 아래에 들어오지만, **4K 텍스처를 다수 내장한 에셋은 초과**합니다. 초과 파일은 오류가 아니라 "이 파일은 현재 브라우저 검사만 지원합니다"로 안내하고 local-first 경로에 그대로 남깁니다.

### 3.3 업로드 API와 해시 게이트

```text
PUT /api/assets/{inputHash}/blob
  Content-Type: application/octet-stream
  Content-Length: <필수>
  X-Clunk-Retention: eph | keep30      (기본 eph)
```

Worker 처리 순서:

1. `assertSameOrigin(request)` + `requireClunkContext()` (기존 경계 그대로).
2. `inputHash`가 `/^[a-f0-9]{64}$/`인지, 그 해시를 가진 `clunk_analysis_runs` 행이 **이 워크스페이스에** 존재하는지 확인. 없으면 404. → 임의 파일 업로드 저장소로 쓰이는 것을 차단합니다.
3. `Content-Length` 확인. 없거나 16,777,216 초과면 **본문을 읽기 전에** 413.
4. `Content-Length`가 D1의 `byte_length`와 다르면 400.
5. R2 키를 **서버가 조립** (§6.1). 클라이언트가 준 키는 어떤 형태로도 받지 않습니다.
6. 스트리밍 저장:

```ts
// 버퍼링 없이 스트림으로 저장 + 쓰기 시점 체크섬 강제
await env.R2.put(key, request.body, {
  sha256: inputHash,                    // R2가 불일치 시 put 자체를 거부
  httpMetadata: { contentType: "model/gltf-binary" },
  customMetadata: { ws: workspaceId, retention, uploadedAt: new Date().toISOString() },
});
```

R2 바인딩의 `put`은 `sha256` 옵션을 받으면 수신 바이트의 SHA-256을 검증하고 불일치 시 쓰기를 실패시킵니다. 즉 **"업로드 바이트의 SHA-256 = 클라이언트가 주장한 inputHash일 때만 수락"이 스토리지 레이어에서 강제**되며, Worker 메모리에 전체를 버퍼링할 필요가 없습니다. 이중 안전장치가 필요하면 `request.body.tee()`로 한 갈래를 `new crypto.DigestStream("SHA-256")`(Workers 확장 API)에 흘려 직접 대조할 수 있습니다. 1단계는 R2 강제만으로 충분하다고 판단합니다.

7. 성공 시 `clunk_assets`의 `r2_key`·`r2_bytes`·`r2_uploaded_at`·`retention_class` 갱신. **크레딧 차감 없음.**

업로드 단계에서 과금하지 않는 이유는 기존 불변식("결과가 성공적으로 저장될 때만 차감")을 유지하기 위해서입니다. 업로드는 그 자체로 산출물이 아닙니다.

### 3.4 보존 기간과 삭제

| 보존 클래스 | 키 프리픽스 | 수명 | 용도 |
| --- | --- | --- | --- |
| `eph` (기본) | `v1/eph/` | 검증 성공/실패 직후 즉시 삭제, 백스톱 **1일** | 대부분의 검증 |
| `keep30` (opt-in) | `v1/keep30/` | **30일** | 감사 대응, 분쟁 시 재현 |

R2 lifecycle rule은 객체별 TTL이 아니라 **프리픽스 + 경과일** 단위라서, 보존 클래스를 키 프리픽스로 인코딩합니다. 이렇게 하면 애플리케이션이 `delete`를 놓쳐도 스토리지 레이어가 반드시 회수합니다. 애플리케이션 삭제(즉시)와 lifecycle(백스톱)은 **둘 다** 겁니다 — 한쪽만 믿지 않습니다.

```text
DELETE /api/assets/{inputHash}/blob
```

- 인증 + 워크스페이스 소유 확인 후 `env.R2.delete(key)`.
- `clunk_assets.r2_key = NULL`, `r2_deleted_at = CURRENT_TIMESTAMP`.
- **멱등**: 이미 없으면 200 + `{ ok: true, alreadyDeleted: true }`.
- 검증 결과(`clunk_verifications` 행)는 삭제하지 않습니다. 증거는 남고 원본만 사라집니다.
- 설정 화면에 `워크스페이스의 업로드 원본 전부 삭제` 액션을 둡니다(리스트 → 순차 delete → 결과 요약).

### 3.5 크레딧 설계

검사 크레딧과 **분리**합니다. 이유:

- `inspect`는 사용자의 CPU만 씁니다. `verify`는 우리 CPU·R2 저장·클래스 A/B 작업을 씁니다. 원가 구조가 다릅니다.
- 가격 가설을 따로 움직일 수 있어야 합니다(Q3-2가 "납품 증빙 Passport 별도 단가"를 후순위 가설로 이미 열어 두었습니다).

```ts
// 기존 kind: "inspect" | "optimize" | "refund"
// 추가:      "verify"
```

1단계 값: **`verify` = 2 크레딧 정액**(검사 1과 구분되도록). 보관(`keep30`)은 1단계에서 추가 과금하지 않되, `clunk_verifications.retention_class`를 남겨 나중에 storage-day 미터링을 붙일 수 있게 합니다.

멱등성 키와 fingerprint는 기존 패턴을 그대로 따릅니다.

```ts
await applyCreditOperation(db, workspaceId, {
  key: `verify:${analysisId}`,
  fingerprint: canonicalFingerprint({
    kind: "verify",
    analysisId,
    inputHash,
    serverResultDigest,        // 서버가 계산한 값
    serverCoreVersion: CORE_VERSION,
    serverRuleSetVersion: RULE_SET_VERSION,
    status,                    // verified | mismatch | engine-drift
  }),
  kind: "verify",
  amount: -2,
}, (operationId) => [
  // clunk_verifications INSERT OR IGNORE + clunk_analysis_runs UPDATE
  // 모두 WHERE EXISTS (SELECT 1 FROM clunk_credit_operations WHERE id = ? AND status = 'applied') 가드
]);
```

같은 요청이 중복 도착하면 `idempotency_key`가 같고 fingerprint도 같으므로 `idempotent: true`로 통과하고 이중 차감되지 않습니다. 서버 결과가 달라졌다면(있어서는 안 되는 일) fingerprint가 달라져 409가 나오고, 이는 곧 결정성 위반 알림 역할을 합니다.

**순서 문제 하나.** fingerprint에 서버 결과가 들어가므로 크레딧 차감은 재검사 **이후**에 일어납니다. 크레딧이 모자라면 CPU를 쓰고 나서 402가 납니다. 완화책으로 재검사 전에 `getCredits(db, workspaceId) >= 2`를 조기 검사(advisory)하고, 원자적 게이트는 기존대로 `applyCreditOperation` 안에만 둡니다. 이중 게이트가 아니라 "빠른 실패 + 진짜 게이트"입니다.

`mismatch`도 차감하는 것을 기본값으로 제안합니다. 서버는 실제로 일을 했고, 불일치 발견은 실패가 아니라 이 제품이 파는 결과이기 때문입니다. (§9 O-3에서 마스터 확인 필요.)

---

## 4. Worker 재검사 실행

### 4.1 Core를 Worker에서 실행할 수 있는가 — 실제 코드 기준 판정

**판정: 코드 변경 없이 실행 가능합니다.** 근거는 다음 세 가지입니다.

**(1) Node 전용 API가 하나도 없습니다.** `packages/core/src/index.ts` 1,926줄 전수 grep 결과:

| 확인 대상 | 결과 |
| --- | --- |
| `require(`, `from "node:*"` | **0건** |
| `Buffer`, `process.*`, `fs.*` | **0건** |
| `crypto.*`, `subtle`, `SubtleCrypto` | **0건** — WebCrypto를 아예 쓰지 않음 |
| `window.`, `document.`, `self.`, `FileReader`, `Blob`, `atob`/`btoa` | **0건** |
| `fetch(`, `WebAssembly`, `Worker`, `structuredClone`, `performance.` | **0건** |
| 외부 npm 의존 | **0건** (import는 `./billing`의 타입 재export 1줄뿐) |

실제로 쓰는 플랫폼 API는 전부 workerd에 있는 것들입니다: `TextDecoder`(695·722·1502행), `TextEncoder`(1550행), `DataView`(1276·1439·1454·1579·1625·1903행), `Uint8Array`/`Uint32Array`, `JSON`, `Map`/`Set`, `Math`. glTF의 `data:` URI 처리(1353·1362·1380행)도 `atob` 없이 자체 base64 디코더를 씁니다.

**(2) 해싱이 동기 순수 JS입니다.** `sha256Hex`(1553행)는 `Promise`가 아니라 `string`을 반환하는 자체 구현(1557~1631행)입니다. 그래서 `inspectAsset` 전체가 동기 함수이고, WebCrypto의 async 경계를 Worker에서 새로 맞출 필요가 없습니다. 대가는 처리량(§3.2, 약 42 MB/s 상한)입니다.

**(3) 이미 Worker에서 Core가 돌고 있습니다.** `app/api/_lib/clunk.ts:3`이 `sha256Hex`와 `stableStringify`를 Core에서 직접 import해 `ensureWorkspace`·`scopedStorageId`·`canonicalFingerprint`에서 매 요청 실행합니다. 즉 Core의 Worker 실행 가능성은 이론이 아니라 **현재 운영 중인 사실**이고, 이번 작업은 그 표면을 `inspectAsset`까지 넓히는 것입니다.

**남는 리스크는 메모리 하나입니다.** §3.2에서 4N/3N으로 계산한 그 문제이고, 대응은 크기 상한입니다.

### 4.2 스트리밍/청크 vs 크기 상한 — 트레이드오프

`inspectAsset`은 스트리밍이 **불가능한 구조**입니다. 세 가지 이유가 겹칩니다.

1. `inputHash`가 전체 바이트에 대한 SHA-256이라 파일 끝까지 봐야 합니다(다만 이건 스트리밍 해시로 해결 가능).
2. `accessorBytes`/`bufferViewBytes`가 `bufferView.byteOffset`으로 **임의 위치**를 읽습니다. 순차 스트림으로는 못 합니다.
3. `parseGlb`가 JSON 청크와 BIN 청크를 모두 `sourceBytes`의 subarray로 참조합니다.

선택지 세 개를 비교합니다.

| 안 | 내용 | 메모리 | Core 변경 | 리포트 동일성 | 판정 |
| --- | --- | --- | --- | --- | --- |
| A. 크기 상한 + 전량 버퍼 | 16 MiB 이하만 `arrayBuffer()` | 3~4N | 없음 | 자동 보장 | **1단계 채택** |
| B. 스트리밍 해시 + 전량 버퍼 | 업로드 때 R2 `sha256`/`DigestStream`, 검사 때 전량 로드 | 검사 시 A와 동일 | 없음 | 보장 | 업로드에만 유효(§3.3에서 이미 채택) |
| C. 범위 읽기 기반 검사 | GLB 헤더+JSON 청크만 로드, BIN은 `R2.get(key, { range })`로 필요한 bufferView만 | O(JSON + 최대 bufferView) | **필요** (바이트 제공자 인터페이스) | 별도 검증 필요 | 3단계 이후 |

안 C가 실제로 가능한 이유를 적어 둡니다. `inputHash`는 R2가 저장해 둔 SHA-256 체크섬을 그대로 쓰면 되고, `accessorBounds`는 대부분 glTF 스펙상 POSITION accessor에 필수인 `min`/`max`를 JSON에서 바로 읽습니다(1420행 분기). 실제 BIN 접근이 필요한 곳은 텍스처 크기 추정(`parsePngDimensions`/`parseJpegDimensions`)과 min/max가 없는 accessor의 폴백 루프뿐이고, 둘 다 좁은 범위 읽기로 대체 가능합니다. 다만 Core에 `inspectAsset(source: ByteSource)` 형태의 제공자 인터페이스를 넣는 API 변경이 필요하고, 무엇보다 **메모리 경로와 범위 경로가 같은 파일에서 완전히 같은 `resultDigest`를 내는지** 자동 테스트로 못 박아야 합니다. 그 게이트 없이는 두 경로가 서서히 갈라지고, 그 순간 Passport 승급이 거짓말이 됩니다. 1단계에 넣을 일이 아닙니다.

### 4.3 실행 시간 제한 대응 — 동기 vs Queue vs Durable Object

| 안 | 지연 | 복잡도 | 필요한가 |
| --- | --- | --- | --- |
| 동기 (요청 안에서 처리) | 16 MiB 기준 CPU 약 0.5초 + R2 GET 왕복 | 낮음 | **1단계 채택** |
| Queues | 비동기, 폴링/알림 UI 필요, consumer 워커 추가 | 중 | 불필요 |
| Durable Object | isolate 격리로 메모리 경합 해소, 직렬화 보장 | 중 | 조건부(아래) |

**1단계는 동기 + 상한을 권장합니다.** CPU 0.5초는 30초 예산의 1.7%이고, Queue를 넣으면 "진행 중" 상태·재시도·결과 알림·부분 실패 UI가 전부 따라옵니다. 상한이 있는 한 그 복잡도는 값을 하지 않습니다.

단, API는 **업로드(PUT)와 재검사(POST)를 분리**합니다. 한 요청에 합치면 느린 회선에서 16 MiB 업로드 + 검사가 한 연결에 묶여 오래 열려 있게 되고, 중간에 끊기면 무엇이 끝났는지 알 수 없습니다. 분리하면 재검사 호출은 짧고 멱등이라 안전하게 재시도할 수 있습니다.

Durable Object를 고려할 유일한 조건은 **동시성**입니다. 같은 isolate가 재검사 요청 2건을 동시에 처리하면 피크가 2×48 MiB = 96 MiB가 되어 위험합니다. 1단계 완화책은 애플리케이션 레벨 직렬화입니다: `clunk_verifications`에 `status='running'` 행을 `INSERT OR IGNORE`로 선점해 **워크스페이스당 동시 1건**으로 제한하고, 이미 running이면 409를 돌려줍니다. 워크스페이스 단위라 전역 isolate 경합을 완전히 막지는 못하지만, 실제 예상 트래픽(파일럿 10팀 내외)에서는 충분합니다. 전역 직렬화가 필요해지는 시점에 DO로 승격합니다.

### 4.4 Worker 측 재검사 코드 스케치

```ts
// app/api/verifications/route.ts (설계 스케치)
const object = await env.R2.get(asset.r2_key);
if (!object) return privateJson({ ok: false, error: "업로드된 원본을 찾을 수 없습니다." }, { status: 409 });
if (object.size > MAX_VERIFY_BYTES) return privateJson({ ok: false, error: "..." }, { status: 413 });

const bytes = new Uint8Array(await object.arrayBuffer());
// createAssetBundle의 방어적 복사를 건너뛰어 피크를 3N으로 낮춘다.
const bundle: AssetBundle = { entry: run.file_name, files: new Map([[run.file_name, bytes]]) };
const serverReport = inspectAsset(bundle, { profileId: run.profile_id as ProfileId });

const status =
  serverReport.coreVersion !== stored.coreVersion ||
  serverReport.ruleSetVersion !== stored.ruleSetVersion
    ? "engine-drift"
    : serverReport.resultDigest === stored.resultDigest &&
      serverReport.inputHash === run.input_hash
      ? "verified"
      : "mismatch";
```

`policy`는 저장된 run의 `profile_id`·`rule_set_id`에서 복원합니다. 커스텀 프로파일(`docs/custom-profiles.ko.md`)을 쓴 검사는 프로파일 정의 자체가 서버에 없으면 재현할 수 없으므로, **1단계는 내장 프로파일(`web`/`mobile`/`pc`) + `clunk-game-ready-v1`만 서버 검증 대상**으로 하고 커스텀 프로파일 run은 버튼을 비활성화합니다(사유 문구 노출).

---

## 5. 데이터 모델

### 5.1 D1 스키마 델타

```sql
-- clunk_assets: R2 객체 참조와 보존 상태
ALTER TABLE clunk_assets ADD COLUMN r2_key TEXT;
ALTER TABLE clunk_assets ADD COLUMN r2_bytes INTEGER;
ALTER TABLE clunk_assets ADD COLUMN r2_uploaded_at TEXT;
ALTER TABLE clunk_assets ADD COLUMN r2_deleted_at TEXT;
ALTER TABLE clunk_assets ADD COLUMN retention_class TEXT NOT NULL DEFAULT 'none';

-- clunk_analysis_runs: 검증 모드 승급
ALTER TABLE clunk_analysis_runs ADD COLUMN verification_mode TEXT NOT NULL DEFAULT 'client-local-attested';
ALTER TABLE clunk_analysis_runs ADD COLUMN verified_at TEXT;
ALTER TABLE clunk_analysis_runs ADD COLUMN verified_core_version TEXT;
ALTER TABLE clunk_analysis_runs ADD COLUMN verified_rule_set_version TEXT;

-- clunk_passports: 입력·출력 축 분리
ALTER TABLE clunk_passports ADD COLUMN source_verification TEXT NOT NULL DEFAULT 'client-local-attested';
ALTER TABLE clunk_passports ADD COLUMN output_verification TEXT NOT NULL DEFAULT 'client-local-attested';
ALTER TABLE clunk_passports ADD COLUMN verification_mode TEXT NOT NULL DEFAULT 'client-local-attested';
ALTER TABLE clunk_passports ADD COLUMN verified_at TEXT;

-- 검증 시도 원장 (성공·불일치·드리프트 모두 남는다)
CREATE TABLE IF NOT EXISTS clunk_verifications (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  analysis_run_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  status TEXT NOT NULL,                  -- running | verified | mismatch | engine-drift | failed
  claimed_result_digest TEXT NOT NULL,   -- 클라이언트가 저장했던 값
  server_result_digest TEXT,             -- Worker가 계산한 값
  server_core_version TEXT,
  server_rule_set_version TEXT,
  server_report_json TEXT,               -- mismatch일 때 특히 중요
  retention_class TEXT NOT NULL DEFAULT 'eph',
  byte_length INTEGER NOT NULL,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (workspace_id, analysis_run_id)
);
CREATE INDEX IF NOT EXISTS idx_clunk_verifications_workspace_created
  ON clunk_verifications(workspace_id, created_at DESC);

-- 스키마 버전 (아래 5.2 참조)
CREATE TABLE IF NOT EXISTS clunk_schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

`UNIQUE (workspace_id, analysis_run_id)`가 §4.3의 워크스페이스당 동시 1건 선점과 재시도 멱등성을 동시에 처리합니다.

`db/schema.ts`(drizzle)에도 같은 델타를 반영하고 `npm run db:generate`로 마이그레이션 파일을 만듭니다. `@openai/sites-vite-plugin`은 빌드 시 `drizzle/`를 `dist/.openai/drizzle`로 통째로 복사하므로(플러그인 소스 확인 완료), Sites 배포 경로에서는 이 파일들이 그대로 스테이징됩니다.

### 5.2 마이그레이션 순서와 기존 행 호환

여기에 **실제 함정**이 하나 있습니다. `app/api/_lib/clunk.ts:52`의 `ensureSchema()`는 인증된 요청마다 `SCHEMA_STATEMENTS`를 `db.batch()`로 실행합니다. 전부 `CREATE TABLE IF NOT EXISTS`라서 지금은 안전하지만, `ALTER TABLE ... ADD COLUMN`은 다릅니다.

- SQLite에서 이미 존재하는 컬럼을 `ADD COLUMN`하면 **에러**입니다. `IF NOT EXISTS`가 없습니다.
- D1의 `batch()`는 한 문장이 실패하면 배치 전체가 실패합니다. 즉 ALTER를 `SCHEMA_STATEMENTS`에 그냥 끼워 넣으면 **두 번째 요청부터 모든 API가 500**이 됩니다.

대응 순서를 명시합니다.

1. `SCHEMA_STATEMENTS`의 `CREATE TABLE` 정의를 **새 컬럼이 포함된 최종 형태로 교체**한다. (신규 D1은 한 번에 올바른 스키마로 생성됨)
2. 기존 D1을 위한 마이그레이션은 `ensureSchema`와 **분리된** `migrateSchema(db)`로 만들고, `db.batch()`가 아니라 **문장별 개별 실행 + try/catch**로 duplicate column 에러를 흡수한다. 판별을 더 확실히 하려면 `PRAGMA table_info(...)`로 컬럼 존재 여부를 먼저 읽고 없을 때만 ALTER한다.
3. 매 요청마다 마이그레이션을 시도하지 않도록 `clunk_schema_meta`에 `('version', 'N')` 행을 두고, `version < TARGET`일 때만 `migrateSchema`를 돌린 뒤 버전을 올린다. (현재 `ensureSchema`가 요청마다 문장 배치를 도는 비용도 함께 줄어든다.)
4. Sites 배포 경로에서는 호스트가 `dist/.openai/drizzle`의 SQL을 적용하므로, drizzle 마이그레이션과 `migrateSchema`가 **양쪽 다 멱등**해야 한다. 3번의 버전 게이트가 이걸 보장한다.

**기존 행 호환.** 모든 신규 컬럼은 `NULL` 허용이거나 `NOT NULL DEFAULT`를 가집니다. 기존 analysis run은 자동으로 `verification_mode='client-local-attested'`가 되고, 이는 사실과 일치합니다 — 마이그레이션이 과거 기록의 의미를 바꾸지 않습니다. 기존 asset은 `retention_class='none'`, `r2_key IS NULL`로 "업로드된 적 없음"을 정확히 표현합니다.

`GET /api/runs`는 새 컬럼을 SELECT 목록에 추가하고, 클라이언트는 `verificationMode`가 없을 때 `"client-local-attested"`로 폴백합니다(구버전 응답 호환).

---

## 6. 보안·프라이버시

### 6.1 R2 키 구조

```text
v1/{retentionClass}/{workspaceId}/{sha256}.{glb|gltf}

예: v1/eph/ws-3f9a1c.../8c1d...a50.glb
```

설계 이유를 하나씩 못 박습니다.

- **보존 클래스가 맨 앞**: R2 lifecycle rule이 프리픽스 기반이라, 수명이 다른 객체가 같은 프리픽스에 섞이면 안 됩니다.
- **workspaceId가 경로에 포함**: 격리 경계가 키 자체에 새겨집니다. 조회는 항상 `SIWC → workspaceId → 키 조립` 순서이며, **클라이언트가 보낸 키·경로 조각을 절대 받지 않습니다.** 경로 순회(`../`) 벡터가 원천적으로 없습니다.
- **파일명이 키에 없음**: 사용자 파일명은 그 자체로 프로젝트 정보(미공개 타이틀명 등)입니다. 키가 아니라 D1 `clunk_assets.file_name`에만 둡니다.
- **콘텐츠 주소 지정(sha256)**: 같은 파일 재업로드가 자연스럽게 중복 제거되고, 키 자체가 무결성 라벨입니다.
- **`v1` 프리픽스**: 나중에 키 규칙을 바꿔야 할 때 병행 운영이 가능합니다.

### 6.2 접근 제어

- 모든 blob 엔드포인트는 기존 경계를 그대로 통과합니다: `assertSameOrigin()` → `requireClunkContext()`(SIWC 헤더 필수) → 워크스페이스 소유 확인.
- **R2 버킷에 public bucket·custom domain·`r2.dev` 노출을 절대 붙이지 않습니다.** 바인딩(`env.R2`)으로만 접근합니다.
- **presigned URL을 쓰지 않습니다.** S3 호환 presigned URL은 별도 R2 access key/secret이 필요해 Sites 호스팅 경로에 그 자격 증명을 넣어야 하고, 발급된 URL은 만료 전까지 인증 경계 밖에서 유효합니다. 16 MiB 상한에서는 바인딩 `put`으로 스트리밍하는 편이 더 안전하고 더 단순합니다. (트레이드오프: 업로드 대역폭이 Worker를 통과합니다. 상한 덕에 문제되지 않습니다.)
- **다운로드 경로가 존재하지 않습니다.** `GET /api/assets/{hash}/blob`을 만들지 않습니다. 업로드한 원본을 다시 가져갈 방법이 없으면 유출 표면도 없습니다. 사용자는 자기 파일을 이미 로컬에 갖고 있습니다.
- 로그·에러 응답에 R2 키 전체나 파일명을 싣지 않습니다. `verificationId`와 해시 앞 12자만 노출합니다.

### 6.3 보존·삭제 보장

- 기본은 `eph`: 재검사 트랜잭션이 끝나는 즉시 `env.R2.delete(key)`. 성공·불일치·실패 **모든 분기**에서 삭제합니다(`finally`).
- 애플리케이션 삭제가 실패해도 lifecycle rule(`v1/eph/` 1일)이 반드시 회수합니다.
- `keep30`은 사용자가 모달에서 명시적으로 고른 경우만. 대시보드에 "보관 중인 원본 N개 / 가장 오래된 것 D일 경과"를 상시 노출하고, 개별·일괄 삭제 버튼을 같은 자리에 둡니다. 보관 중인 파일이 있다는 사실을 사용자가 잊게 두지 않습니다.
- 워크스페이스 삭제·계정 해지 시 `v1/*/{workspaceId}/` 프리픽스를 리스트해 전량 삭제하는 경로를 함께 만듭니다.
- 검증 기록(`clunk_verifications`)은 원본 삭제 후에도 남습니다. 남는 것은 해시·digest·메트릭·finding이며 **원본 바이트를 복원할 수 있는 정보는 포함되지 않습니다.**

### 6.4 약관 문구 초안 (1문단)

> **서버 재검증 시 원본 파일 처리에 관하여.** Clunk는 기본적으로 회원의 3D 에셋 원본 파일을 서버로 전송하지 않으며, 검사는 회원의 브라우저 안에서 수행되고 서버에는 파일명·크기·SHA-256 해시·검사 결과 메타데이터만 저장됩니다. 다만 회원이 특정 에셋에 대해 '서버 재검증'을 개별적으로 선택한 경우에 한하여, 해당 파일의 원본 바이트가 암호화된 전송 구간을 통해 Clunk가 운영하는 오브젝트 스토리지(Cloudflare R2)의 회원 워크스페이스 전용 경로에 일시 저장됩니다. 이 파일은 오직 동일한 검사 엔진으로 결과를 다시 산출해 회원이 제출한 결과와 대조하는 목적으로만 사용되며, Clunk는 이를 학습 데이터로 사용하거나 제3자에게 제공하거나 회원 외의 접근 경로(공개 URL·다운로드 API 포함)를 제공하지 않습니다. 저장된 원본은 재검증 완료 즉시 삭제되는 것을 기본값으로 하며, 회원이 감사 목적의 보관(최대 30일)을 명시적으로 선택한 경우에도 회원은 언제든지 삭제를 요청할 수 있고 보관 기간이 지나면 자동으로 파기됩니다. 원본 삭제 후에도 해시·검사 결과·검증 이력은 회원의 증빙 목적을 위해 보존되나, 이 기록으로부터 원본 파일을 복원할 수는 없습니다.

---

## 7. `.openai/hosting.json` 변경안과 배포 경로별 차이

### 7.1 변경안

```jsonc
// 현재
{ "d1": "DB", "r2": null }

// 변경 후
{ "d1": "DB", "r2": "R2" }
```

### 7.2 이 한 줄이 실제로 무엇을 켜는가 (확인된 사실)

`vite.config.ts`가 `.openai/hosting.json`을 직접 import해서 Cloudflare 플러그인 바인딩을 생성합니다.

```ts
const { d1, r2 } = hostingConfig;
// ...
r2_buckets: r2 ? [{ binding: r2, bucket_name: "site-creator-r2" }] : [],
```

즉 **`r2`를 `"R2"`로 바꾸는 것만으로 로컬 `vite dev`(Miniflare)와 빌드 산출물에 `env.R2` 바인딩이 생깁니다.** 별도 wrangler 설정 파일을 만들 필요가 없습니다. 현재 `dist/server/wrangler.json`의 `"r2_buckets":[]`도 자동으로 채워집니다. 로컬 R2는 `.wrangler/state`에 시뮬레이션되므로 D1과 동일하게 로컬 검증이 가능합니다.

### 7.3 함께 고쳐야 하는 것

`scripts/site-preflight.ps1:24`가 **R2가 null임을 PASS 조건으로 단언**하고 있습니다.

```powershell
pass = ($hosting.d1 -eq 'DB' -and $null -eq $hosting.r2)
detail = 'D1 binding DB is declared and R2 remains null for v1.'
```

이걸 바꾸지 않으면 preflight가 5/5에서 4/5로 떨어집니다. 새 조건:

```powershell
pass = ($hosting.d1 -eq 'DB' -and ($null -eq $hosting.r2 -or $hosting.r2 -eq 'R2'))
detail = 'D1 binding DB is declared and R2 is either unset (local-first only) or bound as R2.'
```

`README.md`의 두 문장(".openai/hosting.json은 1차에 D1만 선언하며 R2는 null입니다"와 "정직한 제한"의 서버 재검증 없음 서술)도 같은 PR에서 갱신합니다. 문서가 코드보다 앞서서 거짓이 되면 안 됩니다.

### 7.4 배포 경로별 차이

| 항목 | 경로 A — OpenAI Sites | 경로 B — Cloudflare 직접 |
| --- | --- | --- |
| 버킷 생성 | 호스트가 `hosting.json`의 `r2` 선언을 보고 프로비저닝(추정 — **미확인**, §9 O-1) | 마스터가 `wrangler r2 bucket create` 직접 실행 |
| 바인딩 이름 | `hosting.json`의 값이 그대로 `env.R2` | 동일(빌드 산출물 경유) |
| 인증 | SIWC 헤더를 호스트가 주입 → blob 엔드포인트 보호가 **수정 없이** 동작 | SIWC 호스트 없음 → **인증 대체가 선행 조건**. 대체 없이는 업로드 엔드포인트가 무인증 공개 스토리지가 되므로 **절대 먼저 배포하면 안 됨** |
| lifecycle rule | 호스트가 규칙 설정 경로를 열어 주는지 불명 (§9 O-2). 못 걸면 애플리케이션 삭제 + 주기 청소 작업으로 대체 | 대시보드/API로 직접 설정 가능 |
| CPU 한도 | `limits.cpu_ms`를 우리가 제어하지 못할 수 있음 (§9 O-4). 16 MiB 상한이면 기본값 안에서 끝나므로 실질 위험 낮음 | 빌드 산출 wrangler 설정에서 직접 지정 |
| 요금제 | 호스트 계정 요금제에 종속 | 마스터 Cloudflare 계정. **Workers Free(10ms CPU)로는 불가**, Paid 필요 |

`docs/deployment-paths.ko.md`의 결정 원칙은 그대로 유효합니다. 이 기능은 배포 경로가 열린 뒤에 켜지는 것이 아니라, **로컬 Miniflare(R2 시뮬레이션)에서 완결적으로 개발·검증할 수 있습니다.** 배포는 여전히 별개 게이트입니다.

---

## 8. 단계별 구현 계획

### PR 1 — 스키마·선언 (동작 변화 없음)

**범위**

- `db/schema.ts` 델타 + `npm run db:generate`로 drizzle 마이그레이션 추가.
- `app/api/_lib/clunk.ts`: `SCHEMA_STATEMENTS`를 최종 형태로 교체 + `clunk_schema_meta` 기반 `migrateSchema()` 분리(§5.2).
- `.openai/hosting.json` → `"r2": "R2"`, `scripts/site-preflight.ps1` 조건 갱신, `README.md` 두 문장 갱신.
- `packages/core/src/contract.ts`에 `VerificationMode`/`VerificationStatus` 타입 추가.
- API 응답의 `verificationMode`를 하드코딩 리터럴 대신 D1 값에서 읽어 반환. 값은 여전히 전부 `client-local-attested`.

**테스트 게이트**

- `npm run test` 전체 통과(typecheck 포함).
- `npm run e2e` 3스위트 그대로 PASS — 특히 크레딧 25→24→24(중복) 숫자가 **변하지 않아야** 합니다.
- 신규: `scripts/e2e-api-boundary.ts`에 "마이그레이션 전 스키마의 D1에 대해 `migrateSchema`를 2회 연속 실행 → 둘 다 성공, duplicate column 에러 없음" 체크 추가. §5.2의 함정을 직접 겨냥합니다.
- `npm run site:preflight` 5/5 PASS 유지.
- 로컬 `vite dev`에서 `env.R2` 바인딩이 실제로 존재하는지 확인하는 임시 진단(머지 전 제거).

**리스크 / 롤백** — 마이그레이션이 기존 로컬 D1을 깨뜨릴 수 있음. 롤백은 `.openai/hosting.json`을 `null`로 되돌리고 커밋 revert. 신규 컬럼은 전부 nullable/default라 잔존해도 무해합니다.

### PR 2 — 업로드 경로

**범위**

- `app/api/assets/[inputHash]/blob/route.ts`: `PUT`(§3.3), `DELETE`(§3.4).
- 상한 상수 `MAX_VERIFY_BYTES = 16 * 1024 * 1024`를 Core `contract.ts`에 두고 클라이언트·서버가 공유(UI가 상한을 자기 마음대로 알지 않게).
- Inspector에 `서버 재검증 요청` 버튼 + 실제 값을 렌더링하는 확인 모달. 이 PR에서는 업로드까지만 하고 검증은 아직 하지 않음(업로드 후 즉시 삭제 가능한 상태로 UI 노출).
- 설정 화면에 `serverVerification: off | ask` 토글, 기본 `off`.

**테스트 게이트**

- `scripts/e2e-api-boundary.ts` 확장:
  - 미인증 `PUT /api/assets/*/blob` → 401.
  - evil-origin `PUT` → 403.
  - `Content-Length` 미지정 → 400/411, 16 MiB + 1 → 413(**본문 전송 전에** 거부되는지 확인).
  - 다른 워크스페이스의 `inputHash` → 404.
  - 바이트를 1비트 변조해 업로드 → R2 `sha256` 검증으로 거부(4xx), D1 `r2_key` 미갱신.
  - 업로드 후 `DELETE` → 200, 재호출 → 200 `alreadyDeleted:true`.
  - 업로드/삭제 전후로 **크레딧 잔액이 변하지 않음**.
- 로컬 Miniflare R2에 실제 객체가 생겼다 사라지는지 확인.

**리스크 / 롤백** — 무인증 스토리지 노출이 최악 시나리오. 완화: 인증 체크를 라우트 최상단에 두고 e2e에 401/403 케이스를 **먼저** 작성(TDD). 롤백은 라우트 파일 삭제 + hosting.json 되돌림.

### PR 3 — Worker 재검사

**범위**

- `app/api/verifications/route.ts`: `POST`(재검사 실행), `GET`(목록).
- Worker에서 `inspectAsset` 실행(§4.4), 3분기 status 판정, `verify` 크레딧(-2) 차감, `clunk_verifications` 기록, `eph`면 `finally`에서 R2 삭제.
- 워크스페이스당 동시 1건 선점(§4.3).
- 커스텀 프로파일 run은 서버 검증 대상에서 제외 + 사유 노출.

**테스트 게이트**

- 신규 `tests/worker-core-parity.test.ts`: 동일 GLB에 대해 (a) Node에서 `inspectAsset`, (b) Worker 환경(Miniflare)에서 `inspectAsset` → `resultDigest`가 **문자 단위로 동일**. Core의 Worker 실행 가능성 판정을 회귀 테스트로 고정합니다.
- `scripts/e2e-api-boundary.ts` 확장:
  - 정상 경로: 검사 저장(-1) → 업로드(0) → 검증(-2) → 잔액 25→24→24→22, `verificationMode:"server-verified"`.
  - 중복 `POST /api/verifications` → `idempotent:true`, 추가 차감 없음.
  - **불일치 유도**: 파일 A를 업로드하고 파일 B의 리포트로 검증 요청 → `status:"mismatch"`, run이 승급되지 **않고**, 원래 client-attested 리포트가 그대로 남아 있는지 확인.
  - 크레딧 0인 워크스페이스에서 검증 요청 → 402, `clunk_verifications`에 `applied` 행 없음, R2 객체는 정리됨.
  - 상한 초과 파일: 버튼 비활성 + API 직접 호출 시 413.
- 성능 게이트: 8 MiB 합성 GLB 검증이 로컬 Miniflare에서 5초 이내 완료(회귀 감지용 느슨한 상한).

**리스크 / 롤백** — 메모리 초과로 isolate가 죽으면 요청이 통째로 실패합니다. 완화: 상한 + 동시 1건 + `object.size` 재확인. 롤백은 라우트 삭제(스키마는 무해하게 잔존).

### PR 4 — Passport 승급과 UI

**범위**

- Passport 승급 로직(§2.3 롤업 규칙), `clunk_passports` 컬럼 갱신.
- `passportToBytes` 출력 JSON에 `verification` 블록 포함 — **Passport 스키마 변경이므로 `schemaVersion` 취급을 결정해야 합니다**(§9 O-5).
- Inspector·Dashboard 배지 3종(§2.3), 툴팁 문구, `keep30` 보관 현황 패널 + 삭제 버튼.
- 약관 문구(§6.4)를 `/docs` 또는 설정 화면에 반영.
- `docs/application/form-answers.ko.md` Q3-1 문장 갱신 제안(§9 O-6).

**테스트 게이트**

- `scripts/playwright-auth-inspector-flow.js` 확장: 업로드→검증→배지가 `서버 재검증`으로 바뀌는지, 다운로드한 Passport JSON에 `verification.output === "server-verified"`가 있는지, console 오류 0.
- `tests/surface-parity.test.ts`: CLI·MCP가 내놓는 리포트에 `verificationMode`가 일관되게 들어가는지(로컬 실행은 항상 `client-local-attested`).
- `node --test tests/rendered-html.test.mjs`: 새 배지가 공개 페이지에 유출되지 않는지.
- 390px 가로 오버플로 0 (`scripts/qa-layout.mjs` 기준 유지).

**리스크 / 롤백** — Passport 스키마 변경이 기존 발급본과의 호환을 깨뜨릴 수 있음. 완화: `verification`을 **선택 필드**로 추가하고 기존 `passportId`·해시·digest 필드는 위치·의미 모두 불변. 롤백은 UI만 되돌리면 되고 데이터는 남습니다.

### 전체 리스크 요약

| 리스크 | 영향 | 완화 |
| --- | --- | --- |
| local-first 약속 훼손으로 인식됨 | 신뢰·신청서 서술 붕괴 | 기본 off, 에셋 단위 opt-in, "항상" 옵션 없음, 배지에 원본 위치 상시 표기 |
| 마이그레이션이 운영 D1을 깸 | 전 API 500 | ALTER를 batch 밖에서 개별 실행 + 버전 게이트 + 2회 실행 테스트 |
| isolate OOM | 요청 실패, 진단 어려움 | 16 MiB 상한(근거 §3.2) + 워크스페이스당 동시 1건 + `object.size` 재확인 |
| 무인증 스토리지 노출 | 심각 | 인증 체크 최상단 + 401/403 e2e 선작성 + 다운로드 API 부재 |
| 원본 삭제 누락 | 프라이버시·약관 위반 | 애플리케이션 즉시 삭제 + `finally` + 프리픽스 lifecycle 백스톱 |
| Core 버전 드리프트로 대량 오탐 | 신뢰 하락 | `engine-drift` 별도 상태 + 재검사 유도 액션 |

---

## 9. 열린 질문 (마스터 결정 필요)

| ID | 질문 | 결정이 필요한 이유 | 기본 제안 |
| --- | --- | --- | --- |
| O-1 | Sites 호스트가 `hosting.json`의 `"r2"` 선언으로 실제 버킷을 프로비저닝하는가? `@openai/sites-vite-plugin`은 파일을 복사만 하고 해석은 호스트가 함 — 로컬에서 확인 불가 | 경로 A의 성립 여부 자체 | 로컬 Miniflare로 전 기능 개발·검증하고, 배포 커넥터가 열리는 세션에서 실측. 안 되면 경로 B로 승격 |
| O-2 | Sites 경로에서 R2 lifecycle rule을 설정할 수 있는가? | 삭제 백스톱 유무 | 못 걸면 `eph` 즉시 삭제 + Cron Trigger 주기 청소로 대체 |
| O-3 | `mismatch`일 때 크레딧을 차감하는가? | 가격·신뢰 양쪽에 영향 | **차감**(서버가 실제로 일했고, 불일치 발견이 제품의 산출물). 반대 의견이 있으면 무차감으로 전환 |
| O-4 | Workers 요금제 — 서버 재검증은 **Workers Paid 필수**(Free는 CPU 10ms로 수백 KB 수준밖에 처리 못 함). 유료 플랜 전제로 진행하는가? | 이 기능의 실행 가능성 전제 | Paid 전제. 파일럿 규모에서는 최소 유료 구간으로 충분 |
| O-5 | Passport `schemaVersion`을 `"1.0"` 유지 + 선택 필드 추가인가, `"1.1"`로 올리는가? | 이미 발급된 Passport와 CLI/MCP 소비자 호환 | **`"1.0"` 유지 + 선택 필드**. 기존 필드 의미가 하나도 안 바뀌므로 |
| O-6 | Q3-1 문장을 언제 어떻게 고치는가? 현재 "서버로 자동 업로드하지 않습니다"는 이 기능 후에도 참이지만, 심사 중 제품이 바뀌면 설명이 필요 | 신청 서류 정합성 (마감 2026-09-17) | **9/17 제출 전에는 머지하지 않는다.** 제출 후 착수하고, 문장은 "기본값은 브라우저 로컬 처리이며 자동 업로드가 없습니다. 팀 감사·납품 증빙이 필요한 경우에 한해 사용자가 파일 단위로 서버 재검증을 선택할 수 있습니다"로 갱신 |
| O-7 | 1단계 상한 16 MiB가 실제 고객 파일에 충분한가? | 커버리지 | 파일럿에서 실제 GLB 크기 분포를 먼저 측정. 부족하면 §4.2 안 C(범위 읽기)를 3단계로 승격 |
| O-8 | `verify` 단가 2 크레딧이 맞는가? | 가격 가설 | 파일럿까지 2로 두고, 실제 R2 egress·CPU 비용 측정 후 조정 |

---

## 부록 A. 측정 재현 방법

이 문서의 처리량 수치는 다음으로 재현했습니다(2026-08-21, Node 22, Windows 11).

- 합성 버퍼 1/4/16 MiB에 대해 `sha256Hex` 1회 호출 시간 측정 → 32.9 / 40.7 / 42.2 MB/s.
- Harvest Frontier 실제 런타임 GLB 3종(`public/assets/runtime/`, 읽기 전용 접근)에 대해 `inspectAsset(createAssetBundle(name, bytes), { profileId: "pc" })` 5회 평균과 `sha256Hex` 5회 평균을 비교 → 비-해시 오버헤드 0.88~2.76 ms.

Harvest Frontier 저장소는 `docs/integrations/harvest-frontier.ko.md`의 읽기 전용·최적화 금지 경계를 그대로 지켜 접근했습니다.

## 부록 B. 참조한 코드 위치

| 대상 | 위치 |
| --- | --- |
| Core 진입점·해시·검사 | `packages/core/src/index.ts` (`inspectAsset` 396, `sha256Hex` 1553, `parseGlb` 715, `normalizeBundle` 677) |
| 현재 신뢰 검증 | `app/api/_lib/clunk.ts` (`verifyClientLocalInspection` 192) |
| 크레딧 원자성 | `app/api/_lib/clunk.ts` (`applyCreditOperation` 130) |
| 스키마 부트스트랩 | `app/api/_lib/clunk.ts` (`SCHEMA_STATEMENTS` 14, `ensureSchema` 52) |
| 저장 API | `app/api/runs/route.ts`, `app/api/optimizations/route.ts`, `app/api/passports/route.ts` |
| drizzle 스키마 | `db/schema.ts`, `drizzle/` |
| R2 바인딩 생성 | `vite.config.ts` (`localBindingConfig.r2_buckets`) |
| Sites 메타데이터 복사 | `node_modules/@openai/sites-vite-plugin/dist/index.js` |
| preflight 단언 | `scripts/site-preflight.ps1` (24행) |
| e2e 러너 | `scripts/e2e.mjs`, `scripts/e2e-api-boundary.ts`, `scripts/playwright-auth-inspector-flow.js`, `docs/e2e.ko.md` |
| 배포 제약 | `docs/deployment-paths.ko.md` |
| local-first 약속 | `docs/application/form-answers.ko.md` Q3-1 |
