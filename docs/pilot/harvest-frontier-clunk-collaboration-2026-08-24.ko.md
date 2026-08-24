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
- `clunk_passport`의 `outputPath`는 새 JSON을 생성하는 경로가 아니라 이미 존재하는
  output artifact를 요구하는 것으로 보인다. 새 경로를 주면 ENOENT가 나고, source와
  동일한 기존 GLB를 주면 정상 응답한다. API 설명이 생성물 저장 경로처럼 읽히므로
  `sourcePath`/`outputPath` 의미와 Passport JSON 저장 기능을 분리해 설명해 주기를
  요청한다.
- 이번 재검증에서도 최상위 `ruleSetId`는
  `harvest-frontier-runtime-v1`이지만 report/passport의 `profileId`는 `pc`로 남았다.
  custom profile과 base profile을 별도 필드로 반환하지 않으면 사용자가 판정 기준을
  오해할 수 있다는 기존 요청을 유지한다.
