# Harvest Frontier ↔ Clunk 협업 메모

작성일: 2026-08-24 KST  
작성 주체: Harvest Frontier 오케스트레이션 레인  
범위: Clunk 제품·사이트에 전달할 현재 파일럿 관찰과 다음 협업 요구

이 문서는 Clunk 소스나 Harvest Frontier를 자동으로 수정하라는 요청이 아니다. HF는
게임 저장소와 런타임 에셋의 source of truth로 남고, Clunk는 원본 바이트를 읽기 전용으로
검사·공증한다. HF GLB에 `clunk_optimize`를 호출하지 않는다.

## 현재 실측

- Clunk MCP의 HF 프로파일 `harvest-frontier-runtime-v1`로 현재 HF 런타임 GLB 8종을
  fresh inspect했다.
- 8/8 결과가 score 100, READY true, hard blocker 0이었다.
- 입력 파일의 텍스처 외부 의존성은 0이었다.
- 처리 라인의 near/far는 각각 78/63 draw calls, 트랙터는 88/77, 시더는 75/55,
  컬티베이터는 42/33이었다. 트랙터 near와 컬티베이터 near에는 missing-normal INFO가
  남았다. 이는 Clunk 결과의 사실이며 게임의 시각적 승인과 같은 뜻이 아니다.
- 동일 에셋을 범용 `pc` 기준으로 읽은 오래된 파일럿 문서의 96~99점/비준비 결과와
  현재 HF 프로파일의 100/READY 결과가 공존한다. 프로파일이 다르므로 모순이라고
  단정할 수는 없지만, 제품 화면에서 active profile, rule-set 버전, input hash,
  검사 시각을 더 강하게 병기해야 사용자가 결과를 오해하지 않는다.

## Clunk가 HF 제작에 실제로 도움을 준 영역

1. 해시·finding·rule-set·Passport를 연결하는 공증 루프.
2. HF 전용 프로파일로 범용 기준의 false positive를 분리하는 기능.
3. 텍스처 세트의 밉 판독성, 심리스, GPU 메모리 예산을 별도 입력으로 검사하는 방향.
4. 변경 감지 후 재검사하는 watch/manifest 흐름.

## 아직 Clunk의 시야 밖인 HF의 실제 문제

M84 shipped-path 무-HUD 실사용 플레이테스트에서 발견한 다음 문제는 정적 GLB 단품
검사만으로는 판정할 수 없었다.

- 캐릭터의 얼굴·손이 없는 마네킹 인상, 작물·식생의 반복감과 실루엣 문제.
- 회백색 돔 지형, 흙/잔디 경계의 톱니 블렌딩, 반복이 보이는 배경 지형.
- 바위·생울타리·NPC 모자 관통과 월드 라벨의 공간 배치 오류.
- 딜러·시장·대화 장면의 실제 카메라 구도와 피사체 가시성.
- 비의 바람 방향·기울기, 날씨와 차폐가 화면에서 읽히는지 여부.

이 문제들은 Clunk가 못해서가 아니라 입력 단위가 GLB 하나이기 때문에 원리적으로
알 수 없는 영역이다. 다음 제품 단계는 정적 검사 결과에 게임 씬·런타임 캡처·시계열
검증을 선택적으로 연결하는 것이다.

## Clunk 제품에 제안하는 우선순위

### P0 — 판정 기준의 설명 가능성

- 결과 카드에 profile id, rule-set id/version, input hash, fresh inspection 시각을
  항상 노출한다.
- 같은 asset id의 이전 결과와 현재 결과가 다른 profile에서 왔으면 “비교 불가”를
  명시하고 점수만 나란히 보여주지 않는다.
- 오래된 파일럿 문서·manifest의 결과가 현재 재검사 결과와 다르면 stale 표시와
  재검사 명령을 제공한다.

### P1 — 게임 에셋 계약

- named node/pivot/socket/collider 계약과 축 규약.
- near/far LOD 쌍의 triangle·byte 감소율, Meshopt decode 후 bounds, 실제 파일 바이트
  예산.
- 애니메이션·스킨·인스턴싱·충돌 프록시의 프로젝트별 계약.

### P1 — 씬/캡처 연결

- 씬 텔레메트리 JSON 입력: draw calls, triangles, instancing coverage, material 수,
  p95 frame-time 시계열.
- shipped-camera 캡처 입력: 피사체 가시성, HUD/월드 라벨 겹침, 텍스처 판독성,
  WebGPU/WebGL2 패리티.
- 정적 GLB PASS가 게임 화면 PASS를 의미하지 않는다는 경계 문구를 제품 UI에서
  분명히 유지한다.

### P2 — 읽기 쉬운 결과

- HF가 운용 중인 portrait/readability audit처럼 작은 화면에서의 텍스트·초상화·아이콘
  판독성을 캡처 기반으로 검사한다.
- 결과를 “asset ready”와 “scene/player-facing ready”로 분리한다.

## 협업 루프

1. HF가 커밋·파일 바이트·provenance를 고정한다.
2. Clunk MCP가 HF 프로파일로 read-only inspect/validate하고 결과 digest를 돌려준다.
3. HF가 게임 씬·브라우저·실제 입력으로 의미 검증을 한다.
4. 에셋 SHA가 바뀔 때만 Clunk를 재검사하며, 이전 결과는 삭제하지 않고 stale로 남긴다.
5. Clunk 기능이 HF의 다음 검증 게이트에 실제로 소비될 때만 “유용성”으로 기록한다.

## 사이트 상태 관찰

현재 Sites 프로젝트는 active이며 live URL은 `https://clunk.honna1.chatgpt.site`이다.
현재 공개 발행물에는 Clunk MCP 서버가 선언되어 있지 않아 MCP 연결 요청은 실패했고,
사이트 DB에도 제품 피드백/상태 스레드 테이블은 없다. 이 표면을 외부 협업 채널로
사용하려면 MCP 연결 활성화 또는 상태/피드백의 명시적 저장·조회 계약이 필요하다.

이 메모 자체는 Clunk 제품팀이 다음 상태 확인에서 읽을 수 있는 파일럿 전달물이다.

## 2026-08-24 재검사 추가 관찰

최신 MCP `clunk_inspect`를 HF 프로파일 파일로 8종에 다시 호출했다. 결과의 최상위
`ruleSetId`와 score의 `ruleSetId`는 `harvest-frontier-runtime-v1`로 바뀌었지만,
각 report 안의 `profileId`는 여전히 `pc`로 남았다. 즉 커스텀 판정은 적용되지만 결과
라벨의 profile 필드가 기본 프로파일을 가리키는 제품 결함이다. UI·Passport·저장 이력에서
`profileId`와 `ruleSetId`를 혼동하지 않도록, custom profile id를 정확히 전달하거나
`profileId: custom`과 `baseProfileId: pc`처럼 두 값을 분리해 주기를 요청한다.

이 관찰은 점수 100/READY를 홍보하기 위한 것이 아니라, 동일 입력·동일 프로파일의
재현성과 판정 기준의 설명 가능성을 확보하기 위한 것이다.

## 2026-08-24 HF 재검증 및 연동 결함

- HF가 현재 `public/assets/runtime`의 near/far GLB 8종에 대해 Clunk MCP
  `clunk_inspect`와 `clunk_validate`를 다시 호출했다. 8/8이 score 100, READY true,
  hard blocker 0이었다. 동일 트랙터 입력에 `clunk_passport`도 호출해 source/output
  hash와 inspection digest가 동일한 무변경 Passport를 반환하는 것까지 확인했다.
- HF의 `npm run asset:readability`는 현재 Clunk checkout에
  `scripts/ui-readability-audit.mjs`가 없어 SKIP되었다. HF 쪽 wrapper와 config는
  존재하지만, 이 상태는 “상시 감사가 통과했다”가 아니라 “감사기가 없어 실행하지
  못했다”이다. Clunk가 auditor를 다시 제공하거나 버전이 있는 CLI 경로를 선언할
  때까지 HF는 해당 검사를 PASS로 홍보하지 않는다.
- 이 연동 허점을 숨기지 않도록 HF wrapper를 보강했다. Clunk checkout이 없을 때만
  `asset:readability`가 SKIP하고, checkout은 있는데 auditor가 없으면 BLOCKED(exit 2)로
  구분한다. CI/release가 Clunk를 명시적으로 요구할 때는
  `npm run asset:readability:required`를 사용한다. 따라서 현재 상태는 의도적으로
  게이트 실패이며, auditor 제공 이후에만 실제 판정으로 승격된다.
- `clunk_passport`의 `outputPath`는 새 JSON을 생성하는 경로가 아니라 이미 존재하는
  output artifact를 요구하는 것으로 보인다. 새 경로를 주면 ENOENT가 나고, source와
  동일한 기존 GLB를 주면 정상 응답한다. API 설명이 생성물 저장 경로처럼 읽히므로
  `sourcePath`/`outputPath` 의미와 Passport JSON 저장 기능을 분리해 설명해 주기를
  요청한다.
- 이번 재검증에서도 최상위 `ruleSetId`는
  `harvest-frontier-runtime-v1`이지만 report/passport의 `profileId`는 `pc`로 남았다.
  custom profile과 base profile을 별도 필드로 반환하지 않으면 사용자가 판정 기준을
  오해할 수 있다는 기존 요청을 유지한다.

## 2026-08-24 HF M94 texture/readability 연동 후속

- HF가 Clunk `7ffefd1`의 `scripts/texture-audit-cli.mjs`를 실제 프로젝트에 연결했다.
  연결 표면은 `tools/check-texture-audit.cjs`,
  `tools/asset-pipeline/texture-audit.config.json`, `npm run asset:texture-audit`이다.
- 7종 텍스처에 대해 `clunk.texture-audit.v1 --strict`가 exit 0으로 끝났고,
  GPU 밉 메모리는 `21.33MB / 40MB`, 심리스 정책 위반은 0건이었다. 원본 결과는
  HF `/.logs/verification/M94/HF-M94-clunk-texture-audit-r01.json`에 저장됐다.
- 이 PASS는 텍스처 정책·메모리·심리스 검사 결과이며, 게임 화면 또는 player-facing
  readiness PASS로 승격하지 않는다.
- 기존 HF 초상화용 `asset:readability`는 `scripts/ui-readability-audit.mjs`가 없어
  BLOCKED(exit 2)였다. 이 상태를 명령 누락으로 방치하지 않도록 Clunk에는
  `npm run asset:ui-readability -- --format json` 경로를 추가했다. 현재 안정 계약은
  `schema: clunk.ui-readability.v1`, `status: UNAVAILABLE`,
  `capability: not-shipped`, exit 4이며, UI readability 또는 player-facing PASS를
  주장하지 않는다.
- 실제 portrait/UI readability 측정기를 출시할 때까지 HF CI는 texture CLI와 UI auditor를
  별도 게이트로 유지한다. UI 측정기가 없는 `UNAVAILABLE`은 텍스처 PASS를 덮어쓰지
  않으며, release 정책에서 요구하면 별도 BLOCKED로 승격할 수 있다.

## 2026-08-24 HF UI readability 안정 계약 확인

- HF가 `tools/check-ui-readability.cjs`를 추가해 Clunk
  `scripts/ui-readability-cli.mjs`를 `--config`/`--format json`으로 실제 호출했다.
- 결과는 HF `/.logs/verification/M94/HF-M94-clunk-ui-readability-r01.json`에
  `clunk.ui-readability.v1`, `UNAVAILABLE`, exit 4로 보존됐다. 이 결과는 auditor 미제공을
  명시적으로 전달받은 것이며, asset PASS나 player-facing PASS가 아니다.
- 실제 portrait auditor가 준비되면 같은 v1 envelope에서 PASS/FAIL을 반환하도록 확장하고,
  현재의 `capability: not-shipped` 계약과 혼동되지 않게 toolVersion·inputHash·configHash를
  유지한다. HF는 그때 128px 초상화 5종을 46px 실제 렌더 크기로 재측정한다.

## 2026-08-24 HF M94 r11 공식 협업 입력 및 UI auditor 출시

- HF M84 무-HUD 실브라우저 프레임에서 반복 식생·프롭 관통·캐릭터 디테일·간판 판독 gap이
  남아 있다는 결과를 전달받았다. Clunk GLB/texture 정적 PASS와 이 player-facing gap은
  서로 다른 상태이며, 어느 쪽도 다른 쪽을 덮어쓰지 않는다.
- HF M94 r11 오디오 측정도 같은 경계를 확인한다. 5개 WAV는 무클리핑, 레벨 spread
  `2.41 dB`, stereo side/mid 약 `-10.5~-12.2 dB`였지만, 고역 2–6 kHz는
  `0.16~0.33%`, 6–20 kHz는 대부분 `0~0.49%`였다. 이는 정적 신호 수치이지 실제 청취
  품질 PASS가 아니며, Clunk의 portrait raster PASS와도 별도다.
- Clunk는 이제 `scripts/ui-readability-cli.mjs`에서 실제 raster 측정을 제공한다. HF 설정의
  128×128 PNG를 `renderPx: 46`으로 Lanczos 재래스터화하고 luminance range, edge density,
  local contrast coverage, group pairwise CIE Lab ΔE76을 측정한다. 현재 HF 5종 실제 호출은
  exit `0` / `PASS`였고, luminance range `0.5470~0.6503`, edge density `0.1493~0.1700`,
  local contrast coverage `0.4137~0.4504`, 최저 pairwise mean ΔE76 `11.6431`이었다.
- 최종 외부 호출 계약은 다음과 같다.

```powershell
npm.cmd run asset:ui-readability -- --config tools/asset-pipeline/ui-readability.config.json --format json --strict
```

  - schema: `clunk.ui-readability.v1`
  - `PASS` → exit `0`
  - `FAIL` + `--strict` → exit `2`
  - 지원하지 않는 입력 형식 또는 decoder 불가 → `UNAVAILABLE`, exit `4`
  - 정상 auditor envelope의 `capability`는 `shipped`이며 `inputHash`·`configHash`·group별
    `renderPx`·metrics·violations를 포함한다.

정상 PASS의 축약 샘플은 다음과 같다. 전체 입력은 HF의 `HF-M94-clunk-ui-readability-r02.json`
같은 경로에 보존하면 된다.

```json
{
  "schema": "clunk.ui-readability.v1",
  "toolVersion": "clunk-ui-readability/1.1.0",
  "status": "PASS",
  "capability": "shipped",
  "inputHash": "<64-hex>",
  "configHash": "<64-hex>",
  "groups": [{
    "name": "NPC 대화 초상화",
    "sourcePx": 128,
    "renderPx": 46,
    "status": "PASS",
    "images": [{
      "path": "npc.choi-minseo.png",
      "status": "PASS",
      "rendered": { "width": 46, "height": 46, "channels": 4 },
      "metrics": {
        "luminanceRange": 0.6503,
        "edgeDensity": 0.1563,
        "localContrastCoverage": 0.4499,
        "resizedPixelHash": "<64-hex>"
      },
      "violations": []
    }],
    "violations": []
  }],
  "assetAudit": { "status": "NOT_EVALUATED" },
  "playerFacing": { "status": "NOT_EVALUATED" },
  "engineReadiness": "not-evaluated"
}
```

이 구현의 PASS는 portrait-ui-raster PASS일 뿐이다. HF는 이후 WebGPU/무-HUD 실브라우저
프레임을 별도 player-facing gate로 재검증해야 하며, Clunk API·문서·랜딩·에이전트 화면도
이 경계를 동일하게 표시한다. 이전 M94 `UNAVAILABLE`/exit 4 결과는 당시의 실제 계약
증거로 그대로 보존하고, 새 PASS는 그것을 소급해 바꾸지 않는다.

## 2026-08-24 HF M94 r11 협업 입력 보존

- 위 UI·오디오·M84 visual/runtime gap을 현재 Clunk 인증 협업 스레드의 공식 입력으로
  저장한다. thread status는 정적 결과가 아니라 `SCENE_GAP` 또는 `BLOCKED`로 유지할 수
  있으며, `assetAudit`·`visualRuntime`·`playerFacing`을 한 숫자로 합치지 않는다.

## 2026-08-24 HF M94 frame manifest handoff 계약

- HF가 현재 HEAD `486fe66`에서 재검증한 save-durability는 실제 브라우저 왕복 PASS이며,
  렌더된 `오늘 한 일` row는 `경운 3 물주기 3`으로 동일하고 wet tile·lifetime ledger가
  유지된다. 이 결과는 Clunk 정적 에셋 PASS와 별도다.
- M84 무-HUD 캡처의 mannequin-like player silhouette, gray dome/terrain seam, prop
  intersection, dealer camera framing, dialogue composition의 missing NPC는
  `visualRuntime: GAP`인 scene-gap note로 보존한다. Clunk는 이 manifest를 받았다고
  `playerFacing` PASS를 만들지 않으며 `reviewStatus: NOT_EVALUATED`를 유지한다.
- 인증된 대시보드와 API에 `evidence_json` 저장 경로를 추가했다. 입력 envelope는
  `clunk.frame-manifest.v1`이며 필수 키는 `runId`, `sourceProject`, `sourceCommit`,
  `reviewStatus`, `frames`, `sceneGaps`다. 각 frame은 `id`·`path`·`hud`를 가지며,
  gap의 `frameIds`는 제출된 frame을 참조해야 한다.
- HF 제출 순서: `POST /api/collaboration/threads`에 상태와 `evidence`를 함께 보내고,
  반환된 `thread.id`에 `POST /api/collaboration/threads/:threadId/messages`로 사람이
  읽을 scene-gap 메모를 보낸다. `GET /api/collaboration/threads` 또는
  `GET /api/collaboration/threads/:threadId`에서 저장된 normalized evidence를 읽는다.
  두 POST 모두 SIWC 인증과 workspace 범위를 요구하며, malformed manifest는 HTTP 400이다.
- `assetAudit: PASS` + `visualRuntime: GAP`의 제품 상태는 `SCENE_GAP`이다. portrait
  raster auditor의 `PASS`는 UI raster 판정일 뿐이며, WebGPU/무-HUD 실제 화면은
  여전히 별도 `playerFacing: NOT_EVALUATED`다.

## 2026-08-24 HF M94 packaged visual baseline 및 texture prescription

- HF frame manifest의 run은 `HF-M94-packaged-r01`, source commit은 `d3d56464`다.
  renderer는 packaged build의 `auto/WebGPU`, viewport는 `1920×1080`, `shippedPath: true`,
  console은 `0/0`이다.
- 기준 프레임은
  `.logs/screenshots/M94/shipped-visual/HF-M94-packaged-r01-03-game-nohud.png`이며,
  바이트 수는 `2,821,399`, SHA-256은
  `5978400B0DD77A5ED90EDE70617726B0DB838A5892075BDDD18DA5CCE0F58E15`다.
  현재 프레임은 식별 가능한 player, buildings, windmill, beds, vegetation을 보여주는
  개선된 기준선이지만, low-poly/flat distant terrain band, 단순화된 hedge/rock silhouette,
  tiny/soft sign text, dealer/dialogue composition·camera gap이 남아 있다.
- 이 프레임은 `reviewStatus: NOT_EVALUATED`, 협업 상태는 `visualRuntime: GAP` /
  `SCENE_GAP`으로 저장한다. static asset FAIL이나 player-facing PASS로 해석하지 않는다.
- texture strict audit는 seam/memory 기준으로 7종 `PASS`, GPU mip memory `21.33MB / 40MB`다.
  다만 gameplay-band detail loss는 별도 actionable prescription으로 보존한다: grass close
  layer at 15m = `D`, dirt path = `C`, soil-tilled apron/bed = `D`; wider grass layer는
  `A/B`, ridge/plaster/roof는 stronger다. 이 항목들은 `prescriptions[].status:
  NON_BLOCKING`으로 두고, HF가 shipped-frame 캡처를 기준으로 runtime material 또는
  second-layer 변경 여부를 결정한다. texture PASS를 blanket player-facing PASS로 승격하지 않는다.

### 최종 manifest payload

현재 HF 문서 기준 커밋은 `sourceCommit: 3e3e343`이며, 해당 프레임을 생성한 빌드는
`frameSourceCommit: d3d56464`로 분리 기록한다. frame entry에는 `bytes: 2821399`,
`shippedPath: true`, `renderer: auto/WebGPU`, viewport `1920×1080`, console
`{ errors: 0, warnings: 0 }`, 그리고 다음 SHA-256을 보존한다:
`5978400B0DD77A5ED90EDE70617726B0DB838A5892075BDDD18DA5CCE0F58E15`.

`prescriptions[]`에는 다음을 모두 `status: NON_BLOCKING`으로 기록한다: grass close layer
`D @ 15m`, dirt path `C @ 15m`, tilled soil `D @ 15m`, wider grass layer `A/B`,
ridge/plaster/roof detail strengthening, wood `SOFT-SEAM`. 이 목록은 texture audit의
actionable prescription이며, 정적 asset PASS를 FAIL로 바꾸거나 player-facing PASS로
승격하는 판정 필드가 아니다.

## 2026-08-24 HF M95 standing invariant 후속 입력

- HF sourceHead는 `3e3e3435b2e378a2446dacd8d352d2d24437518a`, renderer는 `WebGL2`다.
  실제 브라우저 입력 기준 ui-layout ko/en, mechanization, tile-farming, camera-clearance,
  onboarding, save-durability, day-labour-save까지 8/8 PASS, 재시도 0, console 오류/경고
  0/0이다. 심은 자리가 0인 현장 기록 dead-end를 위한 `questGuidance` 순수 함수·ko/en
  메시지·단위 테스트도 HF에 추가됐다.
- 이 invariant PASS는 player-facing visual approval을 대체하지 않는다. Clunk 협업 상태는
  `reviewStatus: NOT_EVALUATED`, `visualRuntime: GAP`, `playerFacing: NOT_EVALUATED`,
  `readiness: SCENE_GAP`를 유지한다.
- 다음 M95 캡처는 기존 M94의 실제 inputHash
  `a8500559f6137a4ab35c3b7adb3a95e2d323198c11a0be00340ea3940db3552f`, frame id
  `hf-m94-packaged-r01-03-game-nohud`, scene gap 5건, NON_BLOCKING prescription 6건과
  혼동하지 않도록 실제 manifest 값을 제출한다. `evidenceMode: append`는 같은
  `runId`·`sourceProject`에서 안정 ID를 기준으로 기존 항목을 보존하고 새 항목을 추가하며,
  같은 ID는 incoming 항목으로 upsert한다. `evidenceMode: replace`는 누락된 항목을 제거하는
  완전한 snapshot 교체이므로, 일부 배열만 보내 기존 5/6건을 지우지 않도록 HF는 full
  manifest를 함께 보낸다.

## 2026-08-24 HF M96 최신 협업 입력

- 현재 HF 통합 기준 커밋은 `8245921`이다. WebGL2 실제 브라우저 입력에서 M95 불변식
  `ui-layout ko/en`, mechanization, tile-farming, camera-clearance, onboarding,
  save-durability, day-labour-save가 8/8 PASS이며 재시도 0, console 오류/경고 0/0이다.
  M96의 player-visible deterministic next-day forecast와 작물 심은 자리 0 회복 안내도
  ko/en UI layout 검증에 포함되었다. 이 내용은 플레이 흐름·기능 증거이지 visual approval이
  아니므로 현재 `reviewStatus: NOT_EVALUATED`, `visualRuntime: GAP`,
  `playerFacing: NOT_EVALUATED`, `readiness: SCENE_GAP`를 유지한다.
- HF 정적 UI raster 결과는 `clunk.ui-readability.v1`, 128px 원본 5종을 CSS 46px에서
  측정한 `PASS`, 최소 pairwise ΔE76 `11.6431`이다. texture strict 결과는 7종,
  `21.33MB / 40MB`, seam 위반 0의 PASS지만 scene quality warning은 별도다:
  `grass-meadow 15m D`, `dirt-path C`, `soil-tilled D`, `wood-planks C`, `plaster C`,
  `roof tiles B`. 자동 그래프·raster·texture PASS를 청취 품질이나 player-facing PASS로
  승격하지 않는다.
- scene-gap 우선순위는 (P0) 딜러 접근 시 지붕 위/플레이어 미표시와 장터 카운터-차양
  충돌을 shipped camera에서 바로 고정하고, (P0) 대화 시 NPC와 카메라 관계를 복원한 뒤,
  (P1) 원경 지형 band와 반복 식생을 거리별로 재구성하고, (P1) hedge/rock silhouette를
  contact·overlap이 읽히는 수준으로 보강하고, (P1) 간판은 실제 화면의 render size에서
  판독성을 재검증한다. camera-clearance 숫자 PASS만으로 이 순서를 완료 처리하지 않는다.
- 다음 제출은 하나의 `clunk.frame-manifest.v1`에 shipped frame과 `assetInspections[]`를
  함께 넣을 수 있다. 각 asset inspection은 `sourcePath`, 실제 64-hex `inputHash`,
  `targetProfileId`, `inspectionRunId`, `evidenceStatus`, `productionReady`, 연결할
  `frameIds`, `qualityWarningIds`를 가진다. `frameIds`는 같은 manifest의 제출 frame만
  참조해야 하며, 이 링크는 source asset evidence를 붙일 뿐 `reviewStatus`나
  `playerFacing`를 승격하지 않는다.
- `append`는 같은 `runId`·`sourceProject`만 허용하고 frames/sceneGaps/prescriptions/
  assetInspections를 안정 ID로 upsert한다. incoming에 빠진 ID는 보존한다. `replace`는
  incoming 배열이 완전한 snapshot이며 빠진 ID를 삭제한다. 일부 5개 gap 또는 6개
  prescription만 보낼 때는 `replace`를 사용하지 않는다.

## 2026-08-24 HF M98 최신 카메라·화면 협업 입력

- HF 기준 커밋은 `82459216c618a15f7588f57003e5f4f4ee99f40a`다. 딜러/장터 접근 카메라는
  건물 충돌 회피 숫자만 보지 않고 플레이어와 시설이 같은 프레임에 있는지, 렌즈가 시설
  내부에 들어가지 않는지, near-fill이 과하지 않은지까지 보정했다. WebGL2/WebGPU
  camera-clearance 계약은 PASS지만 이는 카메라·런타임 증거이며 GLB 바이트 최적화 결과가 아니다.
- M84 무-HUD 플레이테스트에는 여전히 원경 지형·식생 반복, 일부 프롭 관통, 간판 판독성,
  캐릭터·시설의 상업용 프레임 품질 리스크가 남아 있다. 따라서 Clunk는
  `reviewStatus: NOT_EVALUATED`, `visualRuntime: GAP`, `playerFacing: NOT_EVALUATED`,
  `readiness: SCENE_GAP`를 유지한다.
- texture strict 경고는 8개 runtime GLB의 hard blocker와 섞지 않는다. 실제 shipped
  no-HUD frame `hf-m94-packaged-r01-03-game-nohud`의 거리·사용처를 기준으로
  `grass-meadow`·`dirt-path`·`soil-tilled`의 15m gameplay-band 처방은 P1, wood/plaster
  표면은 seam·macro·LOD 확인 후 P1, roof tiles B는 카메라 수정 뒤에도 읽기 손실이 있을
  때만 P2로 둔다. 권장 해상도는 일괄 상향이 아니라 기존 base texel/UV scale을 보존하고
  secondary structure, macro breakup, edge blend, distance LOD 중 관찰에 맞는 방법을
  선택하는 것이다.
- 새 검토 가능 캡처는 no-HUD shipped baseline, dealer approach/counter, dialogue
  NPC-camera, distant terrain/vegetation/sign 프레임을 같은 source/build lineage로 보내야
  한다. 각 frame에는 `runId`, `sourceCommit`, `frameSourceCommit`, id/path/sha256/bytes,
  renderer, viewport, `shippedPath`, `hud`, console counts, scene-gap `frameIds`를 붙인다.
  이 메타데이터가 완전하면 capture contract는 PASS로 표시할 수 있지만, 사람의 visual
  review가 끝나기 전에는 player-facing PASS로 승격하지 않는다.
- `clunk.ui-readability.v1`는 `status: PASS|FAIL|UNAVAILABLE`, exit `0|2|4`를 유지하고,
  `renderContext.css.sha256`, viewport, font, renderer, `metadataCompleteness`, 그리고
  `criteria.deltaE76[].threshold`를 envelope에 보존한다. raster PASS는 엔진 import/runtime
  또는 player-facing frame PASS가 아니다.
- M98 대화 카메라는 `runtimeChecks[]`의 숫자 계약으로 연결할 수 있다. `id`는
  `dialogue-camera-webgl2-r2`, `status: PASS`, renderer는 `WebGL2 fallback`,
  `poseAssist: true`, `poseFocusId: npc.kang-taeho`, `poseFocusOnScreen: true`,
  `poseFocusCoverage: 0.01517`, `poseFocusLensInside: false`, console `0/0`이다. 근거 JSON은
  `.logs/verification/M98/dialogue-camera-webgl2-r2.json`, 캡처는
  `.logs/screenshots/M98/dialogue-camera-webgl2-r2-A-opened.png`이며 1,242,189 bytes,
  SHA-256 `EAB863CA9F8B03DA8DADBC72BD8D921CC7461753684B8B2CC7325D020B7EBC29`다. 이 캡처는
  local Vite 기반이라 `shippedPath: false`다. 따라서 numeric runtime check는 PASS로 둘 수
  있지만 `humanReview: NOT_EVALUATED`와 전체 `reviewStatus: NOT_EVALUATED`는 유지한다.

## 2026-08-24 HF M98 runtime GLB MCP 재검증

- `public/assets/runtime/tractor.compact.m1.glb`를
  `examples/profiles/harvest-frontier.example.json`으로 read-only validate한 결과는
  `valid: true`, score `100/100`, threshold `90`, hardBlocker `0`이다. inputHash는
  `d92ae93240cc9b4d477df13cbddd0342738feb57ed9b8551e73d68fd83b3222c`, byteLength는
  `680,412`, triangles `30,188`, meshes `88`, drawCall `88`이다.
- findings의 `GEO-MISSING-NORMALS` info 7건과 `SCENE-NONUNIT-SCALE` info 181건,
  `missingUvPrimitiveCount: 88`, bounds `±32767`, textureCount `0`는 numeric/structural
  observation으로 보존한다. 이 PASS는 Three.js 실제 import·material·화면 가독성을 증명하지
  않으며, `runtimeChecks[]` 또는 새 shipped frame의 human review와 분리한다.
- Clunk는 HF 승인 없이 optimize를 호출하지 않는다. byte-changing output이 필요해지는
  경우에만 source/output hash와 Passport, 변경 전후 renderer capture, fresh reopen 결과를
  먼저 제출하고 HF visual review 뒤에 별도 실행한다.

## 2026-08-24 HF M98 WebGPU 불변식 후속

- 원문 파일은 `Harvest Frontier/.logs/verification/M98/HF-M98-inv-camera-clearance.json`과
  `Harvest Frontier/.logs/verification/M98/HF-M98-invariant-set.json`이다. 후자의 실제
  결과는 8개 중 6개 PASS, 2개 FAIL이다. ui-layout ko/en, mechanization, tile-farming,
  camera-clearance, onboarding은 WebGPU·Chrome에서 console 0/0으로 PASS였고,
  save-durability는 `No tile can accept 'water' (water 0)`, day-labour-save는
  `밭 텔레포트` click timeout으로 실패했다. 이 두 실패는 현재 asset audit FAIL이나
  player-facing visual approval로 분류하지 않고, HF 하니스 재현/기능 증거로 별도 보존한다.
- camera-clearance 원문은 `renderer: webgpu`, `shippedPath: false`, `flowStatus: passed`,
  console 0/0이며 딜러·장터·축사·과수원 spot의 `playerVisible`, `subjectOnScreen`,
  `subjectLensInside`, `nearFillFraction`, `poseFocusCoverage`를 기록한다. 이는
  `runtimeChecks[]`의 numeric layer에 넣을 수 있지만, 캡처가 실제 출하 경로가 아니므로
  `reviewStatus: NOT_EVALUATED`, `visualRuntime: GAP`, `playerFacing: NOT_EVALUATED`는
  바꾸지 않는다. HF evidence의 `sourceTree.clean: false`도 같은 lineage 주의사항으로 남긴다.
- tractor MCP 숫자 계약은 다음처럼 보존한다: `valid: true`, score `100/100`, threshold
  `90`, hardBlocker `0`, triangles `30,188`, meshes `88`, drawCall `88`, bytes `680,412`,
  textureCount `0`, missingUvPrimitiveCount `88`, bounds `±32767`. `GEO-MISSING-NORMALS`
  info `7`과 `SCENE-NONUNIT-SCALE` info `181`은 즉시 runtime FAIL이 아니라 관찰값이다.
  다만 normals/UV 부재, 극단 bounds, 텍스처 0은 Three.js material·조명·카메라 거리에서
  별도 검토할 위험 신호이므로 숫자 PASS와 화면 품질을 합치지 않는다.
- `clunk.frame-manifest.v1`의 linked `assetInspections[].numericContract`를 사용하면
  `status`, score/threshold, hardBlockerCount, findingIds와 `drawCallCount`,
  `missingUvPrimitiveCount`, bounds 같은 실제 관찰값을 frameIds와 함께 저장할 수 있다.
  이 필드는 static/numeric evidence이고 `visualRuntime`·`reviewStatus`를 절대 승격하지
  않는다. append는 numericContract도 안정 ID로 upsert하고, replace는 전체 snapshot으로
  취급한다.

### Clunk 다음 제품 개선 우선순위

1. **linked evidence bundle**: 한 제출에 shipped frame hash/viewport/renderer/console,
   draw-call·asset manifest·inputHash·numeric findings를 연결하고, `capture contract`,
   `numeric contract`, `human visual review`를 세 개의 독립 상태로 표시한다. WebGPU
   camera gate PASS와 frame visual approval을 한 배지로 만들지 않는다.
2. **frame-to-asset impact view**: scene gap 또는 draw-call/UV/normals/bounds observation을
   클릭하면 연결 frame과 해당 asset의 source hash, target profile, 사용 거리/씬을 같이
   보여준다. HF의 원경 지형·식생 반복, 6종 작물 구분, 캐릭터 silhouette/간판 판독성은
   static GLB finding이 아니라 이 화면에서 우선순위를 매길 대상이다.
3. **reproducible shipped-path capture runner**: HF가 runId/sourceCommit/frameSourceCommit,
   renderer 선택, viewport, asset manifest와 capture hash를 한 번에 제출하고 Clunk가
   같은 run의 draw-call/texture/material/animation manifest를 read-only로 재검사하게
   한다. WebGPU unavailable이면 PASS 대신 `UNAVAILABLE`을 남기고, WebGL2 fallback은
   renderer 차이를 숨기지 않는다.

HF 6종 작물·식생·캐릭터 에셋에 가장 유용한 즉시 단계는 (a) 작물별 source asset hash와
semantic role을 연결한 manifest, (b) 근거리/15m/원거리 shipped frame 세트, (c) 캐릭터
portrait 46px raster와 실제 월드 silhouette frame을 같은 runId로 제출하는 것이다. Clunk는
현재 bytes/구조/정적 texture·UI raster와 evidence linkage를 제공하고, 작물의 실제 게임
가독성·식생 반복·캐릭터 상업적 품질은 HF의 브라우저 캡처 human review로 남긴다.
