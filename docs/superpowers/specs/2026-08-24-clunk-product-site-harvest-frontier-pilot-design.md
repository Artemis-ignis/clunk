# Clunk 제품 사이트 및 Harvest Frontier 파일럿 설계

**상태:** 설계 승인됨, 구현 전 검토용

**작성일:** 2026-08-24

**범위:** Clunk 제품 홈페이지, 에이전트 연동 문서, 로그인·대시보드 UX, 실제 Harvest Frontier 에셋을 이용한 제품 유용성 검증

## 목표

Clunk를 단순한 랜딩 페이지가 아니라, 실제 3D 게임 제작자가 에셋을 검사하고 결과를 이해하며 자신의 AI 코딩 도구에 연결할 수 있는 제품 표면으로 만든다. Polyfork의 정보 전달력과 연결 문서 구조를 벤치마크하되, Polyfork의 코드·카피·이미지를 복제하지 않고 Clunk의 실제 GLB 바이트, hash, finding, Passport 계약을 중심으로 구성한다.

## 현재 문제

1. 홈은 시각 효과와 섹션은 많지만 첫 화면의 제품 약속, 사용 순서, 실제 연결 방법이 한 흐름으로 읽히지 않는다.
2. 일부 헤드라인은 강제 줄바꿈과 고정 높이 조합 때문에 글자가 겹치거나 화면 폭에 따라 어색하게 잘린다.
3. `html.snap-y`와 섹션 snap CSS는 존재하지만 섹션 높이와 내부 콘텐츠 높이가 일관되지 않아 사용자에게 안정적인 페이지 단위 이동으로 느껴지지 않는다.
4. `/agents`에 해당하는 실제 연결 안내가 없고, Claude Code·Codex·Cursor·Claude Desktop·VS Code·일반 stdio MCP 클라이언트의 설정 위치와 명령이 한 곳에 정리되어 있지 않다.
5. 현재 제품 표면은 Web, CLI, stdio MCP, VS Code 어댑터가 같은 Core 계약을 사용하지만 공개 HTTP MCP/REST API는 제공하지 않는다. 존재하지 않는 API를 문서에서 제공하는 것처럼 보이면 안 된다.
6. 로그인·대시보드는 Sites가 주입하는 ChatGPT SIWC와 D1에 의존한다. 인증 전환, D1 오류, 부분 API 실패, 빈 워크스페이스 상태가 사용자에게 충분히 설명되지 않는다.

## 제품 설계

### 1. 홈 정보 구조

홈은 다음 순서의 짧고 명확한 세로 흐름으로 재구성한다.

1. **Hero:** “에이전트가 만든 GLB를 게임에 넣기 전에 판정한다”는 한 문장과 실제 검사 결과 카드
2. **3-step flow:** 업로드 또는 샘플 선택 → 실제 바이트 검사 → 허용된 최적화와 Passport 생성
3. **Evidence proof:** input/output hash, finding, rule set, blocker, score를 실제 샘플 결과에서 표시
4. **Agent connection:** MCP·CLI·VS Code·Web 표면의 관계를 설명하고 `/agents`로 이동
5. **Use case:** Harvest Frontier와 같은 3D 게임 제작에서 어떤 시점에 Clunk를 호출하는지 표시
6. **CTA:** 검사기 열기와 연동 문서 보기

모든 숫자와 READY 상태는 고정된 마케팅 숫자가 아니라 현재 Core 결과와 일치해야 한다. 경고 finding이 남아 있으면 100점이어도 READY라고 표시하지 않고 조건부 상태로 표시한다.

### 2. 시각 언어

- Polyfork처럼 제품 약속과 개발자 연결 지점을 전면에 배치한다.
- Clunk의 기존 밝은 배경·딥 잉크·시안/블루 포인트를 유지하되, 장식용 blur/orb를 줄이고 실제 데이터 카드와 코드 패널을 주 시각 요소로 사용한다.
- 본문 폭과 제목 폭을 별도로 제한하고 `text-wrap: balance` 및 자연 줄바꿈을 사용한다. 한국어 제목에 화면 폭을 가정한 `<br />`를 남발하지 않는다.
- 외부 사이트의 이미지·코드·문구를 복제하지 않는다. Clunk에 이미 있는 샘플과 provenance가 있는 에셋만 제품 증거로 사용한다.

### 3. 스크롤 계약

- 랜딩 각 주요 섹션은 `data-snap-section`으로 식별하고 `scroll-snap-align: start`를 사용한다.
- 섹션은 최소 `100svh`를 기준으로 하되 내부 내용이 긴 섹션을 고정 높이로 잘라내지 않는다.
- 데스크톱은 페이지 단위 이동을 느낄 수 있는 `mandatory`, 모바일과 짧은 viewport는 콘텐츠를 가두지 않는 `proximity`를 사용한다.
- `prefers-reduced-motion`에서는 transform/animation만 제거하고 콘텐츠 순서와 앵커 이동은 유지한다.
- 고정 내비게이션은 현재 섹션을 표시하고, 키보드·앵커 링크·직접 URL(`/`#agents 등) 이동이 같은 섹션 기준을 사용한다.
- Playwright 검증에서 각 섹션의 scrollTop이 예상 snap 범위에 들어오는지, 제목·카드·CTA가 viewport 밖으로 잘리지 않는지 확인한다.

### 4. `/agents` 연동 문서

새 `/agents` 페이지는 Polyfork의 에이전트 안내처럼 한 번에 실행 가능한 문서를 제공한다. 탭은 다음 순서로 고정한다.

| 탭 | 현재 제공 방식 | 안내 내용 |
|---|---|---|
| Claude Code | stdio MCP | 프로젝트의 `.mcp.json`, Windows `npm.cmd run mcp`, 작업 폴더와 경로 규칙 |
| Codex | Plugin/Skill + stdio MCP | `plugins/clunk-assetops/` 사용법, MCP 도구, 같은 Core 계약 |
| Cursor | stdio MCP | `mcp.json`의 `command`/`args`, Windows 절대 경로, 복사 버튼 |
| Claude Desktop | stdio MCP | `claude_desktop_config.json`의 `mcpServers` 예시, 재시작과 로그 확인 |
| VS Code | VS Code 어댑터/stdio | `.vscode/mcp.json` 또는 저장소 어댑터 사용법, `servers`와 workspace 경계 |
| 기타 클라이언트 | 표준 stdio JSON-RPC | `tools/list`, `tools/call`, 제공 도구와 오류 응답 계약 |
| API/HTTP | 현재 공개 API 아님 | 현재는 Web API가 외부 개발자용 API가 아님을 명시하고, HTTP API가 필요한 경우의 문의/향후 범위를 분리 |

공통 문서 블록에는 다음을 포함한다.

- `clunk_inspect`, `clunk_validate`, `clunk_optimize`, `clunk_passport` 도구 목록
- 원본 입력과 출력 파일을 덮어쓰지 않는 규칙
- `inputHash`, `outputHash`, fresh reinspection, Passport의 의미
- 각 클라이언트용 복사 버튼과 복사 성공 상태
- Windows PowerShell/npm.cmd 기준 명령
- 실제 지원 여부를 나타내는 `지원`, `파일럿`, `준비 중` 상태 배지

### 5. 회원가입·로그인·대시보드

- ChatGPT SIWC를 현재 인증 경계로 유지한다. 자체 비밀번호나 임의 인증 우회는 추가하지 않는다.
- Clunk에는 별도 이메일/비밀번호 회원가입을 만들지 않는다. 최초 ChatGPT 인증 성공을 `계정 확인 → Clunk 워크스페이스 생성/입장`으로 설명하고, 사용자는 가입과 로그인을 하나의 명확한 시작 흐름으로 이해할 수 있어야 한다.
- `/login`은 `처음 시작하기`와 `다시 로그인하기`를 사용자의 상태에 맞게 설명하고, 인증 방식·Sites/ChatGPT 환경 의존성·외부 일반 브라우저에서 발생할 수 있는 접근 제한을 명시한다.
- 인증 전 랜딩 CTA, 로그인 화면, 보호된 `/app`·`/dashboard`·`/settings`의 이동이 같은 `return_to` 계약을 사용한다.
- 인증 성공, 인증 취소, 잘못된 return path, SIWC 헤더 누락, D1 준비 실패를 각각 사용자에게 구분해 표시한다.
- `return_to`를 보존하고 인증 후 원래 요청 화면으로 복귀한다.
- 대시보드는 `loading`, `connected`, `auth-required`, `data-error`, `empty` 상태를 별도 UI로 제공한다.
- `/api/me`, `/api/runs`, `/api/passports`, `/api/credits`가 일부 실패할 때 빈 데이터처럼 보이게 하지 않고 실패한 영역과 재시도 동작을 표시한다.
- 실제 Sites D1 migration과 인증 주입을 배포 URL에서 검증한다.

### 6. 전체 제품 진입 흐름

랜딩페이지에서 다음 흐름을 실제 사용자 기준으로 끊김 없이 완성한다.

`홈에서 가치 이해 → 시작하기 클릭 → ChatGPT 인증/첫 워크스페이스 생성 → 검사기에서 실제 GLB 선택 → 검사 결과 저장 → 대시보드에서 이력·크레딧·Passport 확인`

각 단계에는 다음 화면으로 이동할 수 있는 명시적 CTA와, 실패했을 때 돌아갈 수 있는 경로가 있어야 한다. 랜딩만 예쁘게 만들고 로그인·가입·대시보드가 별도 제품처럼 보이는 상태는 완료로 인정하지 않는다.

## Harvest Frontier 협업 파일럿

### 사용처

Harvest Frontier의 현재 runtime GLB를 Clunk의 실제 고객/파일럿 입력으로 사용한다. 우선 대상은 다음 8개 파일이다.

- `public/assets/runtime/tractor.compact.m1.glb`
- `public/assets/runtime/tractor.compact.m1.lod1.glb`
- `public/assets/runtime/cultivator.compact.m1.glb`
- `public/assets/runtime/cultivator.compact.m1.lod1.glb`
- `public/assets/runtime/seeder.compact.m1.glb`
- `public/assets/runtime/seeder.compact.m1.lod1.glb`
- `public/assets/runtime/processing.line.m1.glb`
- `public/assets/runtime/processing.line.m1.lod1.glb`

### 검증 루프

1. Harvest Frontier의 현재 commit, 파일 bytes, provenance와 SHA-256을 읽는다.
2. Clunk Core/CLI/MCP의 동일한 rule set으로 각 GLB를 검사한다.
3. missing normals/UV, material/draw call, triangle/vertex, bounds/scale, animation/skin, external resource finding을 실제 결과로 기록한다.
4. 최적화가 허용된 경우에만 별도 출력 파일을 만들고 원본은 보존한다.
5. 출력물을 fresh reinspection하고 Passport가 source/output hash와 결과 digest를 연결하는지 확인한다.
6. 결과를 `docs/pilot/harvest-frontier-clunk-pilot.ko.md`에 immutable run ID와 함께 기록한다.
7. Clunk UI와 연동 문서에서 실제 게임 제작자가 막히는 지점을 반영한다.

Harvest Frontier의 현재 dirty checkout, `.logs`, screenshots, provenance, runtime assets는 이 작업에서 수정·삭제·정리하지 않는다. Clunk에 필요한 개선이 Harvest Frontier 쪽 패치까지 요구되면 별도의 변경 제안과 검토 지점을 먼저 기록한다.

## 구현 경계

### 포함

- Clunk 홈 리디자인
- `/agents` 페이지와 공통 코드 블록/복사 UX
- 스크롤 snap 및 responsive layout 안정화
- 회원가입으로 오해하기 쉬운 별도 계정 폼을 만들지 않고, 첫 ChatGPT 인증을 워크스페이스 생성 흐름으로 명확히 표현
- 랜딩 → 로그인/첫 시작 → 검사기 → 대시보드 → Passport의 연결 UX
- 로그인·대시보드 상태 UX와 필요한 오류 처리
- Clunk의 실제 지원 표면을 반영한 문서
- Harvest Frontier runtime GLB의 읽기 전용 파일럿 검증과 Clunk 파일럿 보고서
- 실제 브라우저·빌드·Sites 배포 검증

### 제외

- Polyfork의 코드·이미지·카피 복제
- Clunk의 존재하지 않는 public HTTP API를 마케팅용으로 가짜 구현
- Harvest Frontier 원본 코드·에셋·로그의 임의 수정
- 실제 Stripe 결제 연결
- Core가 지원하지 않는 손실 최적화, texture 재인코딩, Draco/Meshopt 변환 추가

## 완료 기준

- 홈의 제목/카드/본문이 데스크톱·모바일에서 겹치거나 잘리지 않는다.
- 랜딩 주요 섹션의 스크롤 snap과 앵커 이동이 실제 브라우저에서 안정적으로 작동한다.
- `/agents`에서 6개 클라이언트와 기타 stdio MCP의 실제 설정을 복사할 수 있다.
- 문서의 지원/미지원 API 경계가 실제 코드와 일치한다.
- 랜딩의 시작 CTA에서 첫 인증/워크스페이스 생성, 재로그인, 인증 취소/실패가 구분된다.
- 인증 전·후 로그인 흐름과 대시보드의 성공/실패/빈 상태가 구분된다.
- 인증된 사용자가 실제 검사 1건을 만들고 대시보드·Passport에서 같은 결과를 다시 확인한다.
- Harvest Frontier의 8개 runtime GLB에 대해 입력 hash, rule set, finding, 최적화 여부, fresh reinspection, Passport/output hash가 기록된다.
- Clunk build, typecheck, lint, 관련 테스트, 브라우저 QA, Sites preflight와 실제 배포 URL 검증이 통과한다.
