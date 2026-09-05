# 프로젝트별 검사 프로파일 (custom profile)

Clunk의 기본 정책은 `web` / `mobile` / `pc` 세 가지 내장 프로파일입니다. 실제 게임 프로젝트는 자기 파이프라인에서 "정상"인 항목과 "결함"인 항목이 서로 다르기 때문에, 범용 규칙을 그대로 적용하면 같은 경고가 매번 반복되고 판정이 무뎌집니다. 프로젝트별 검사 프로파일은 이 문제를 파일 하나(JSON)로 선언해 해결합니다.

- 대상 표면: **CLI(`--profile-file`)와 MCP(`profileFile`)**. 웹 앱은 v1에서 내장 프로파일만 사용합니다(아래 [한계](#현재-한계) 참고).
- 바꿀 수 있는 것: 예산(threshold), 규칙별 severity, 규칙 on/off, 리포트에 찍히는 rule set id·version.
- 바꾸지 않는 것: 검사 대상 바이트, hash, metric 계산, optimize의 허용 목록 동작.

## 1. 파일 스키마

```jsonc
{
  "schemaVersion": "1.0",          // 선택. 지금은 "1.0"만 허용
  "id": "my-game-runtime-v1",      // 필수. 리포트/Passport의 ruleSetId가 됩니다
  "version": "0.1.0",              // 필수. ruleSetVersion이 됩니다
  "basedOn": "pc",                 // 선택. web|mobile|pc, 기본값 web. 선언하지 않은 예산을 상속하고 리포트의 profileId가 됩니다
  "label": "My Game runtime",      // 선택
  "description": "...",            // 선택
  "thresholds": {                  // 선택. 선언한 값만 덮어씁니다
    "maxTriangles": 40000,
    "maxMaterials": 64,
    "maxTextureMemoryBytes": 0,
    "maxTextureDimension": 0,
    "readyScoreThreshold": 90
  },
  "rules": {                       // 선택. 규칙 id별 조정
    "GEO-MISSING-NORMALS": { "severity": "INFO" },
    "SCENE-EMPTY-NODES": { "enabled": false }
  }
}
```

규칙과 제약:

| 필드 | 규칙 |
| --- | --- |
| `id`, `version` | `[A-Za-z0-9][A-Za-z0-9._-]{0,63}` 패턴. 공백·빈 문자열·숫자 타입은 거부됩니다. |
| `basedOn` | `web`, `mobile`, `pc`만 허용. 그 외 값은 거부됩니다. |
| `thresholds.*` | 0 이상의 정수만 허용합니다. 문자열·`NaN`·소수·음수는 거부됩니다. `readyScoreThreshold`는 0~100입니다. |
| `rules.<RULE-ID>` | 알 수 없는 규칙 id는 **거부**합니다(오타가 조용히 무시되지 않습니다). |
| `rules.<RULE-ID>.enabled` | boolean. `false`면 그 규칙의 finding이 리포트에서 사라집니다. 기본값 `true`. |
| `rules.<RULE-ID>.severity` | `INFO`, `WARNING`, `ERROR`, `CRITICAL` 중 하나. 규칙이 발생시키던 severity를 대체합니다. |
| `_`로 시작하는 키 | 어느 객체에서든 주석으로 취급되어 무시됩니다(`_notes`, `_why`, `_limitations` 등). |
| 그 외 알 수 없는 필드 | 거부합니다. |

`schemaVersion`을 뺀 나머지 알 수 없는 필드가 거부되므로, 프로파일 파일의 오타는 검사 결과를 조용히 바꾸는 대신 즉시 실패합니다.

### 조정 가능한 규칙

| 규칙 id | 카테고리 | 기본 severity |
| --- | --- | --- |
| `FORMAT-GLTF2` | format | INFO |
| `SEC-REMOTE-RESOURCE` | format | ERROR |
| `SEC-MISSING-RESOURCE` | format | ERROR |
| `SCENE-EMPTY-NODES` | scene | WARNING |
| `SCENE-ZERO-SCALE` | scene | ERROR |
| `SCENE-NONUNIT-SCALE` | scene | WARNING |
| `GEO-NO-MESH` | geometry | ERROR |
| `GEO-TRIANGLE-BUDGET` | geometry | ERROR (예산의 80% 초과 구간은 WARNING) |
| `GEO-MISSING-NORMALS` | geometry | WARNING |
| `MAT-MATERIAL-BUDGET` | materials | ERROR |
| `MAT-DUPLICATES` | materials | WARNING |
| `TEX-MISSING-UV0` | textures | WARNING |
| `TEX-MEMORY-BUDGET` | textures | ERROR |
| `TEX-DIMENSION-BUDGET` | textures | ERROR |
| `RUNTIME-ANIMATION-SKIN` | runtime | INFO |

이 표는 `packages/core`의 `RULE_CATALOG` / `RULE_IDS` export와 같은 목록입니다.

물리적 타당성 규칙은 자기 등록부(`PHYSICAL_RULE_CATALOG` / `PHYSICAL_RULE_IDS`)를 쓰고, 커스텀 프로파일의 `rules`는 두 등록부의 id를 모두 받습니다.

| 규칙 id | 카테고리 | 기본 severity | 무엇을 재는가 |
| --- | --- | --- | --- |
| `GEO-GROUND-CONTACT` | geometry | WARNING | 장면 최저점이 y = 0 에서 몇 mm인가 |
| `GEO-FLOATING-PART` | geometry | WARNING | 바닥에도 다른 부품에도 닿지 않는 부품과 가장 가까운 것까지의 간격(mm) |
| `GEO-PART-INTERSECTION` | geometry | WARNING (겹침 ≤ 5 mm 는 INFO) | 삼각형이 실제로 교차하는 부품 쌍과 관통 깊이(mm)·애니메이션 위상 |
| `GEO-THIN-SHELL` | geometry | WARNING (전부 doubleSided 면 INFO) | 두께 0.5 mm 미만인 판의 수와 단면 여부 |
| `GEO-INVERTED-WINDING` | geometry | WARNING (전부 doubleSided 면 INFO) | 닫힌 메시의 부호 있는 부피 Σ a·(b×c)/6 가 음수인 것 = 면이 안쪽을 봄 |
| `SCENE-ANIMATED-SCALE` | scene | INFO | scale 채널을 모는 클립과 노드 이름 |
| `SCENE-UNNAMED-MESH` | scene | INFO | 이름 없는 메시 노드의 몫 |
| `SCENE-LAYOUT-FILE` | scene | INFO | 이 파일이 독립 상품 여럿을 늘어놓은 배치도(팩·키트)인가 |
| `FORMAT-EXTENSION-REQUIRED` | format | WARNING | `extensionsRequired` 에 선언된 확장 |
| `GEO-ANALYSIS-LIMIT` | geometry | INFO | 상한에 걸려 못 잰 부분이 있다는 사실 |

이 묶음은 어느 것도 ERROR/CRITICAL이 아닙니다. 같은 측정이 어떤 파일에서는 결함이고 다른 파일에서는 의도이기 때문입니다 — 땅 밑으로 내려간 나무 뿌리, 베어링을 지나는 축, 옷 안에 든 몸, 잎사귀 카드. 그래서 `hardBlockerCount` 와 `validateAsset` 의 `valid` 는 이 묶음 때문에 바뀌지 않습니다. 프로파일에서 `severity` 를 ERROR로 올리면 그때부터는 바뀝니다.

**`GEO-INVERTED-WINDING` 이 보는 것과 보지 않는 것.** 닫힌 메시(붙인 꼭짓점 기준으로 모든 모서리가 정방향 한 번·역방향 한 번씩만 쓰인 것)만 잽니다. 열린 면(잎사귀 카드, 천, 벽 한 장)에서는 부호 있는 부피가 원점 위치에 따라 부호가 바뀌어 아무 뜻이 없으므로 아예 재지 않습니다. glTF 규격대로 노드 전역 변환의 행렬식이 음수인 거울 인스턴스는 감김이 뒤집혀 그려지므로 결함이 아니며, 판정은 그 부호를 되돌린 뒤에 합니다.

**`SCENE-LAYOUT-FILE` 의 판별 기준.** 장면 뿌리에서 내려가 처음으로 형제가 둘 이상 나오는 층을 "단위"로 보고, 그 단위가 3개 이상이며 ①단위마다 자기 최저점이 바닥에서 ±5 mm 안에 있고 ②단위끼리 한 축 이상에서 50 mm 넘게 떨어져 있으면 배치도입니다. 배치도로 판정되면 부양은 같은 단위 안에서만 보고(상품끼리 안 닿는 것은 결함이 아닙니다), 관통의 "몸통" 기준 부피도 파일 전체가 아니라 단위 하나로 잽니다. 지붕·차양·경첩처럼 공중에 있는 부분이 있는 조립품은 ①에서 걸러집니다.

**조정할 수 없는 규칙**: `INPUT-MISSING`, `FORMAT-PARSE`. 바이트를 아예 파싱하지 못했을 때 나오는 CRITICAL 판정이므로, 프로파일이 낮추거나 끌 수 없습니다. 프로파일에 적으면 "rule id is not recognized" 오류가 납니다.

## 1-1. 무엇이 돌았고 무엇이 못 돌았는가 (레인)

검사 결과(`AssetEvidence`)는 게이트를 두 갈래로 갈라 `coverage` 필드에 적습니다.

| 레인 | 종류 | 언제 도는가 |
| --- | --- | --- |
| `bytes` · `structure` · `policy` | `file-only` | 바이트만 있으면 언제나 끝까지 돕니다(형식·구조·예산·재질·텍스처·물리). |
| `import` · `runtime` · `device` | `engine-environment` | 엔진 설치본을 몰 러너가 있어야 돕니다. 없으면 `ENVIRONMENT_UNAVAILABLE`. |

- `coverage.ranLanes` / `coverage.skippedLanes` — 어느 레인이 답을 냈고 어느 레인이 못 돌았는지.
- `coverage.fileContract` — 파일만으로 도는 레인의 판정(`PASS` / `FAIL` / `NOT_RUN`).
- `coverage.engineEnvironment` — 엔진 레인이 실제로 돌았는가(`RAN` / `NOT_RUN`).
- `coverage.scoreBasis` — 상위 `valid` / `score` 가 무엇의 결과인가(`FILE_ONLY` / `FILE_AND_ENGINE` / `NOT_SCORED`).
- `coverage.ranRules` — 이 응답이 실제로 평가한 규칙 id 전부. 여기 없는 id에 대해 이 응답은 아무 말도 하지 않은 것입니다.

엔진 러너를 붙이지 않은 지금, 모든 내장 프로파일의 `import` · `runtime` 은 `ENVIRONMENT_UNAVAILABLE` 이고 `scoreBasis` 는 `FILE_ONLY` 입니다. 그래서 점수 100 은 "파일 계약을 통과했다"이지 "이 엔진에서 열린다"가 아닙니다.

**HF 프로파일은 검사 기준이 아니라 납품 계약입니다.** `harvest-frontier-web-three` 는 HF 런타임이 요구하는 노드 이름 규약(`HF-ROOT-NODE`·`HF-ATTACHMENT-SOCKET`·`HF-COLLIDER`)과 `EXT_meshopt_compression`(`HF-MESHOPT`)을 ERROR로 요구하므로, 압축하지 않은 일반 GLB는 언제나 BLOCKED가 됩니다. 일반 검사에는 `web-three-mobile`(웹·모바일) 또는 `unity` / `godot-4` / `unreal` 을 쓰십시오.

## 2. CLI 사용법

```powershell
npx.cmd tsx scripts/clunk-cli.ts inspect public/samples/clunk-messy-sample.glb --profile-file examples/profiles/harvest-frontier.example.json
npx.cmd tsx scripts/clunk-cli.ts validate <path> --profile-file <profile.json>
npx.cmd tsx scripts/clunk-cli.ts optimize <path> --profile-file <profile.json> --out <output.glb>
npx.cmd tsx scripts/clunk-cli.ts passport <source> <optimized> --profile-file <profile.json>
```

`--profile`과 `--profile-file`은 동시에 쓸 수 없습니다.

실제 도움말 출력:

```text
Usage: npm run clunk -- <inspect|validate|optimize|passport> <path> [options]

  inspect  <path>                     Inspect one GLB or local GLTF bundle.
  validate <path>                     Inspect and exit with code 2 on an ERROR or CRITICAL finding.
  optimize <path>                     Apply the allowlisted safe operations into a new artifact.
  passport <source> <optimized>       Reinspect both files and print a Passport envelope.

Options:
  --profile web|mobile|pc             Built-in policy profile. Defaults to web.
  --profile-file <profile.json>       Custom project profile. Cannot be combined with --profile.
  --out, --output <path>              Optimize output path. Defaults next to the source file.

Custom profiles are documented in docs/custom-profiles.ko.md; there is an example in
examples/profiles/harvest-frontier.example.json.
```

실제 실행 결과(`inspect public/samples/clunk-messy-sample.glb --profile-file examples/profiles/harvest-frontier.example.json`, 발췌):

```json
{
  "ruleSetId": "harvest-frontier-runtime-v1",
  "ruleSetVersion": "0.1.0",
  "inputHash": "181473ff49e2a753b3c22198a0ef76f6052ab1efc38ac03a57c58bc62ae8fdf1",
  "resultDigest": "8e3cb5aa869af0d5dbd39497126044d1381735de628b68226cfd617bfbedd07d",
  "profileId": "pc",
  "score": 100,
  "ready": false,
  "findings": ["FORMAT-GLTF2 INFO", "GEO-MISSING-NORMALS INFO", "MAT-DUPLICATES WARNING", "SCENE-EMPTY-NODES INFO"]
}
```

잘못된 프로파일은 검사 전에 거부됩니다. 예를 들어 `"GEO-TRIANGLES"`라는 오타가 있는 파일:

```text
Custom profile rule id is not recognized: GEO-TRIANGLES (C:\...\broken.json)
```

두 옵션을 함께 쓰면:

```text
Use either --profile or --profile-file, not both.
```

## 3. MCP 사용법

`clunk_inspect`, `clunk_validate`, `clunk_optimize`, `clunk_passport` 네 도구 모두 선택 인자 `profileFile`을 받습니다. 경로는 절대 경로를 권장합니다.

```json
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"clunk_inspect","arguments":{"path":"C:/Users/50106/Desktop/Clunk/public/samples/clunk-messy-sample.glb","profileFile":"C:/Users/50106/Desktop/Clunk/examples/profiles/harvest-frontier.example.json"}}}
```

실제 응답의 envelope 발췌입니다. CLI·Core와 `resultDigest`가 동일합니다.

```json
{
  "ruleSetId": "harvest-frontier-runtime-v1",
  "ruleSetVersion": "0.1.0",
  "resultDigest": "8e3cb5aa869af0d5dbd39497126044d1381735de628b68226cfd617bfbedd07d",
  "score": 100,
  "ready": false,
  "findings": ["FORMAT-GLTF2 INFO", "GEO-MISSING-NORMALS INFO", "MAT-DUPLICATES WARNING", "SCENE-EMPTY-NODES INFO"]
}
```

`profile`과 `profileFile`을 함께 주면 CLI와 같은 메시지로 JSON-RPC 오류를 반환합니다.

## 4. Core API

```ts
import { createCustomProfile, inspectAsset } from "packages/core/src/index";

const profile = createCustomProfile(JSON.parse(json));   // 검증 실패 시 throw
const report = inspectAsset(bundle, { customProfile: profile });
```

- `createCustomProfile(definition: unknown): CustomProfile` — JSON에서 읽은 값을 그대로 넣습니다. 검증에 실패하면 문제 값을 포함한 `Error`를 던집니다.
- `AssetPolicy.customProfile` — `inspectAsset`, `validateAsset`, `optimizeAsset`이 모두 이 필드를 받습니다.
- Node 표면(CLI·MCP)은 `integrations/shared/custom-profile.ts`의 `loadCustomProfile()` / `resolveProfilePolicy()`를 공유합니다.
- 관련 export: `CUSTOM_PROFILE_SCHEMA_VERSION`, `RULE_CATALOG`, `RULE_IDS`, 타입 `CustomProfileDefinition`, `CustomProfile`, `RuleId`, `ResolvedRuleSetting`.

우선순위는 `AssetPolicy`의 명시 숫자 필드 → 커스텀 프로파일의 `thresholds` → `basedOn` 내장 프로파일 기본값 순입니다. 커스텀 프로파일을 넘기면 리포트의 `profileId`는 `basedOn` 값이 되고, `AssetPolicy.profileId`는 무시됩니다.

## 5. 기본 프로파일과의 차이

내장 프로파일 예산:

| 프로파일 | maxTriangles | maxMaterials | maxTextureMemoryBytes | maxTextureDimension | readyScoreThreshold |
| --- | ---: | ---: | ---: | ---: | ---: |
| `web` | 100,000 | 12 | 134,217,728 | 4,096 | 90 |
| `mobile` | 25,000 | 6 | 67,108,864 | 2,048 | 90 |
| `pc` | 250,000 | 24 | 536,870,912 | 8,192 | 90 |

커스텀 프로파일이 기본과 다른 점:

- `ruleSetId` / `ruleSetVersion`이 `clunk-game-ready-v1` / `1.0.0` 대신 프로파일이 선언한 값이 됩니다. 리포트, `ScoreReport`, Passport, CLI·MCP envelope 모두에 동일하게 반영됩니다.
- 같은 바이트라도 `resultDigest`가 달라집니다(정책이 결과의 일부이기 때문입니다). `inputHash`는 그대로입니다.
- severity를 바꾸면 점수와 READY 판정이 함께 바뀝니다. READY는 "점수 ≥ threshold **그리고** 모든 finding이 INFO"라는 기존 규칙을 그대로 씁니다.
- 내장 프로파일의 결과는 이 기능 도입 전과 **바이트 단위로 동일**합니다. `tests/custom-profile.test.ts`가 도입 이전에 기록한 digest 6개(샘플 2종 × 프로파일 3종)와 최적화 출력 hash를 그대로 검증합니다.

### 실측 비교 1 — `public/samples/clunk-messy-sample.glb`

| 항목 | 내장 `pc` | `harvest-frontier.example.json` |
| --- | --- | --- |
| ruleSetId | `clunk-game-ready-v1` | `harvest-frontier-runtime-v1` |
| resultDigest | `91811095b6afed62…` | `8e3cb5aa869af0d5…` |
| FORMAT-GLTF2 | INFO | INFO |
| GEO-MISSING-NORMALS | WARNING | INFO |
| MAT-DUPLICATES | WARNING | WARNING |
| SCENE-EMPTY-NODES | WARNING | INFO |
| 점수 | 99 | 100 |
| READY | false | false (실제 중복 머티리얼 WARNING이 남아 있음) |

### 실측 비교 2 — Harvest Frontier `tractor.compact.m1.glb` (읽기 전용, 680,412 bytes)

`inputHash`는 두 실행 모두 `d92ae93240cc9b4d477df13cbddd0342738feb57ed9b8551e73d68fd83b3222c`이며, 이는 [핸드오프 문서](integrations/harvest-frontier.ko.md)에 기록된 hash와 같습니다.

| 항목 | 내장 `pc` | `harvest-frontier.example.json` |
| --- | --- | --- |
| ruleSetId | `clunk-game-ready-v1` | `harvest-frontier-runtime-v1` |
| resultDigest | `2ed773f10f2cedd7…` | `4789a69a70cecbd4…` |
| FORMAT-GLTF2 | INFO | INFO |
| GEO-MISSING-NORMALS (7) | WARNING | INFO |
| SCENE-NONUNIT-SCALE (181) | WARNING | INFO |
| MAT-MATERIAL-BUDGET (48) | ERROR (한도 24) | 발생하지 않음 (한도 64) |
| hardBlockerCount | 1 | 0 |
| breakdown | format 100 / scene 97 / geometry 97 / materials 82 / textures 100 / runtime 100 | 전부 100 |
| 점수 | 96 | 100 |
| READY | false | **true** |
| `validate` 종료 코드 | 2 | 0 |

즉 같은 바이트가 범용 정책에서는 "머티리얼 예산 초과"로 막히고, 프로젝트 계약을 선언한 프로파일에서는 READY가 됩니다. 이 READY는 Clunk가 선언한 정책 판정이며, Harvest Frontier 자체 validator의 `PASS`나 판매 승인과는 다른 판정입니다.

## 6. 현재 한계

이 기능이 **표현하지 못하는** 것들입니다. 예시 프로파일의 `_limitations` 필드에도 같은 내용을 적어 두었습니다.

1. **필수 named node 검사 불가**: "이 노드/pivot/socket/collider가 반드시 있어야 한다"를 표현하는 규칙이 없습니다. Harvest Frontier validator가 확인하는 `missingNodes` 계약이 여기에 해당합니다. 프로파일은 빈 노드를 결함으로 보지 않게 만들 수는 있어도, 있어야 할 노드가 사라진 것을 잡지는 못합니다.
2. **Meshopt/Draco 보존 검사 불가**: `EXT_meshopt_compression`이 `extensionsUsed`·`extensionsRequired`에 남아 있는지 확인하는 규칙이 없습니다. Core는 `extensionCount`만 셉니다.
3. **decode-aware bounds 없음**: quantize된 accessor의 raw bounds가 그대로 보고됩니다(`tractor.compact.m1.glb`는 ±32767). 디코드 후 실제 bounds와 다릅니다.
4. **파일 간 계약 불가**: "far LOD는 near보다 삼각형·바이트가 적어야 한다" 같은 near/far 쌍 규칙은 파일 하나를 보는 프로파일로 표현할 수 없습니다.
5. **byte 예산 없음**: 파일 크기 상한 규칙이 없습니다.
6. **semantic metadata 보존 검사 불가**: `sculptRuntime.assetId` 같은 `extras` 기반 계약을 확인하는 규칙이 없습니다. 오히려 optimize의 `clean-metadata`가 `extras`를 제거합니다.
7. **optimize 허용 목록은 프로파일로 잠기지 않습니다**: 프로파일은 검사·점수만 바꿉니다. `SCENE-EMPTY-NODES`를 INFO로 두거나 꺼도 `optimize`는 여전히 조건에 맞는 빈 노드를 제거합니다. 삭제하면 안 되는 semantic 노드가 있는 프로젝트는 v1에서 optimize를 실행하지 않아야 합니다.
8. **웹 앱은 커스텀 프로파일을 받지 않습니다**: `/app`과 저장 API는 `ruleSetId === "clunk-game-ready-v1"`과 내장 `profileId`만 허용합니다. 커스텀 프로파일 결과를 D1 이력에 저장하려면 별도 스키마·검증 작업이 필요합니다.
9. **텍스처 0개 계약은 근사입니다**: "텍스처가 있으면 안 된다"를 `maxTextureMemoryBytes: 0` / `maxTextureDimension: 0`으로 표현합니다. 동작은 의도대로지만 finding 문구는 "budget exceeded"로 표시됩니다.
10. **커스텀 프로파일은 신뢰 경계가 아닙니다**: 프로파일 파일은 사용자가 선언한 정책이므로, 규칙을 꺼서 스스로 판정을 느슨하게 만들 수 있습니다. 판정을 인용할 때는 `ruleSetId`·`ruleSetVersion`을 함께 인용해야 합니다.

## 7. 향후 확장

- 존재 필수 노드·소켓 이름 목록을 검사하는 `SCENE-REQUIRED-NODES` 계열 규칙
- 확장 보존 검사(`EXT_meshopt_compression` 등)와 decode-aware bounds metric
- near/far LOD 쌍 검사(파일 두 개를 한 정책으로 비교)
- optimize 허용 목록을 프로파일에서 잠그는 `operations` 섹션
- 웹 앱·D1 이력에서의 커스텀 프로파일 지원
- 프로파일 파일 자체의 hash를 Passport에 기록하기
