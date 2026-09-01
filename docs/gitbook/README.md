# 연결하고, 검사하고,
근거로 판단하세요.
CLUNK DOCUMENTATION

GitBook식으로 빠른 시작, 클라이언트 설정, API 계약, 실제 화면 검토를 분리했습니다. 읽는 순서가 곧 실행 순서입니다.

CURRENT CORE **Clunk v0.1.0**clunk-game-ready-v15 SURFACES

![실제 GLB 검사 결과를 보여주는 Clunk 트랙터 렌더](/_next/image?url=%2Flanding%2Ftractor-hero.png&w=1920&q=75)REAL BYTES · TRACTOR.GLB

## 검사 결과를 화면으로 읽는 법

같은 에셋도 구조 계약, 실제 런타임, 사람의 화면 판정은 서로 다른 증거입니다.

STRUCTURAL**PASS**hash · policy · blocker

RUNTIME**GAP**shipped frame 필요

PLAYER FACING**대기**실제 화면 판정 전

HUMAN**대기**자동 승격하지 않음

## 문서를 읽기 전에 내 파일부터 고르세요.

각 포맷은 같은 판정 흐름을 공유하지만, 확인하는 근거가 다릅니다.

FORMAT**2D Sprite / Atlas / Spine**`pixel contract · bundle`

FORMAT**Motion / Animation**`clip · loop · playback`

FORMAT**GLB / GLTF**`mesh · scene · hash`

[지원 범위 전체 보기](https://clunk.artemis-clunk.workers.dev/docs/scope)

## 문서 목차

왼쪽 사이드바와 같은 순서입니다. 각 문서는 한 주제만 다룹니다.

### 시작하기

[**01**START HERE**빠른 시작**

원격 에이전트는 HTTPS MCP, 로컬 파일은 stdio를 사용합니다. 에이전트 연결 화면에서 키를 발급하면 클라이언트별 설정이 완성됩니다.

](https://clunk.artemis-clunk.workers.dev/docs/quickstart)[**02**COPY THE RIGHT SHAPE**클라이언트별 설정**

클라이언트가 읽는 설정 모양만 고르면 됩니다. 키는 workspace에서 발급하고 화면에서 복사합니다.

](https://clunk.artemis-clunk.workers.dev/docs/clients)

### 실행

[**03**AUTOMATE THE GATE**CLI와 CI**

CLI는 실제 바이트를 읽고 JSON evidence와 0/2/4 exit code를 남깁니다. 긴 예시는 필요할 때만 펼칩니다.

](https://clunk.artemis-clunk.workers.dev/docs/cli)[**04**AUTHOR · INSPECT · ATTACH**Asset Studio**

2D와 3D 모두 provenance를 남기고 검사합니다. 생성 완료와 게임 화면 승인은 다른 증거입니다.

](https://clunk.artemis-clunk.workers.dev/docs/asset-studio)

### 계약과 협업

[**05**READ THE RESULT CORRECTLY**계약과 상태**

점수는 구조 계약의 한 축입니다. 실제 게임 화면과 사람의 판단은 각각 별도 필드이며 자동 승격하지 않습니다.

](https://clunk.artemis-clunk.workers.dev/docs/contracts)[**06**COLLABORATION EXAMPLE**Harvest Frontier**

HF는 Clunk의 구조 evidence를 소비하지만 원본 에셋과 최종 플레이어 화면 판정의 source of truth를 유지합니다.

](https://clunk.artemis-clunk.workers.dev/docs/harvest-frontier)

### 브라우저와 범위

[**07**BROWSER-NATIVE AGENT FLOW**브라우저 WebMCP**

WebMCP가 노출된 브라우저에서는 읽기 전용 상태 도구를 확인할 수 있습니다. 원본 파일을 바꾸거나 시각 승인을 만들지 않습니다.

](https://clunk.artemis-clunk.workers.dev/docs/webmcp)[**08**WHAT CLUNK CAN VERIFY**지원 범위**

자세한 모델·재질·Spine·애니메이션 범위는 입력 종류별로 분리되어 반환됩니다.

](https://clunk.artemis-clunk.workers.dev/docs/scope)

## 문서를 읽기 전에 결과부터 한 번 보세요.

샘플은 계약 fixture로 표시됩니다. 실제 플레이어 화면과 사람 승인은 별도 capture에서만 생깁니다.

[샘플 실행 화면 열기](https://clunk.artemis-clunk.workers.dev/agents#connect)

## 문서에서 바로 실행 화면으로 이동하세요.

설명만 읽고 끝나지 않도록 연결 키 발급과 샘플 검사를 바로 열어 둡니다.

[에이전트 연결](https://clunk.artemis-clunk.workers.dev/agents#connect) [내 파일 검사 · 로그인](https://clunk.artemis-clunk.workers.dev/app)
