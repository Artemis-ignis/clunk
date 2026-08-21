# 제출 증거 매트릭스

모두의 창업 공고는 아이디어 이해를 돕는 이미지 최대 10장과 30~60초 숏폼 URL을 선택적으로 허용합니다. 아래 자료는 실제 실행 화면과 실제 Core 결과를 우선합니다. 이미지 안에 숫자를 따로 그려 넣지 않고, 화면이 실행 결과를 보여주게 합니다. 2026-08-21 사이트를 프리미엄 다크 디자인으로 전면 재구축했고, 화면 캡처 6장과 숏폼을 새 디자인에서 다시 촬영해 같은 파일명으로 교체했습니다(이전본은 `archive/*-pre-rebuild-20260821.*`).

| 번호 | 제출 이미지 주제 | 보여줄 사실 | 근거 파일·실행 | 상태 |
| --- | --- | --- | --- | --- |
| 01 | Clunk 한국어 랜딩 | 재구축 히어로의 문제·제품 정의, local-first 경계 | `app/page.tsx`, 브라우저 `/` | 확보(2026-08-21 재촬영): `11-landing-agentic-template-ko.png` 1440×900 |
| 02 | 반응형 랜딩 | 같은 브랜드의 모바일 레이아웃 | `app/page.tsx`, 브라우저 `/` 390px | 확보(2026-08-21 재촬영): `12-landing-agentic-mobile-ko.png` 390×844 |
| 03 | 로그인 진입 | ChatGPT SIWC 경계와 비밀번호 미보관 표기 | `app/login/page.tsx`, 브라우저 `/login` | 확보(2026-08-21 재촬영): `13-login-liquid-glass-ko.png` 1440×900; 별도 이메일·비밀번호는 만들지 않음 |
| 04 | 문제 샘플의 실제 검사 | 실제 score 99·metrics·finding 4건 | `public/samples/clunk-messy-sample.glb`, `packages/core/src/index.ts` | 확보(2026-08-21 재촬영): `22-inspector-auth-current-ko.png` 1440×1619 |
| 05 | 정책 finding 상세 | observed value·threshold·severity | 동일 Core report | 확보(2026-08-21 재촬영): `22-inspector-auth-current-ko.png` |
| 06 | 안전 최적화·새 재검사 | 새 출력, score·material·empty node·metadata 변화 | `tests/core.test.ts`, `OptimizationResult` | 확보(2026-08-21 재촬영): `23-inspector-auth-optimized-ko.png` 1440×1963 |
| 07 | Passport 다운로드 영역 | source/output hash·새 재검사·`조건부 준비` | `packages/core/src/index.ts`, `app/api/passports` | 확보(2026-08-21 재촬영): `23-inspector-auth-optimized-ko.png` |
| 08 | 워크스페이스 대시보드 | SIWC 연결됨·D1 작업 이력 2건·크레딧 23·Passport 1건 | `app/components/DashboardClient.tsx`, 브라우저 `/dashboard` | 확보(2026-08-21 재촬영): `24-dashboard-auth-d1-ko.png` 1440×1665 |
| 09 | CLI·MCP·VS Code 패리티 | 같은 `coreBuildId`·rule·digest 계약 | `scripts/clunk-cli.ts`, `integrations/mcp/server.ts`, `integrations/vscode/**` | 명령·패리티 테스트 검증; 제출 이미지 선택 보류 |
| 10 | 전체 아키텍처/지원 범위 | Web·MCP·CLI·VS Code와 안전 제한 | `README.md`, `app/docs/page.tsx` | 문서 근거; `10-og-card.png`는 분석 증거로 사용하지 않음 |
| 11 | 제품 구조 개념도 | 입력→Core 5단계→결과·저장, 4개 표면, "개념도" 표기 | `tmp/architecture-diagram-ko.html` 결정적 HTML/SVG 렌더 (AI 이미지 아님) | 확보: `25-architecture-diagram-ko.png` 3200×2020; Q3-1 배치 |

## 실제 숏폼 파일

- 파일: `output/application/evidence/clunk-demo-auth-final-ko.webm`
- 실제 재생 길이: `43.80초` (2026-08-21 프리미엄 다크 재구축 재녹화본)
- 해상도·오디오: 1280×720, 무음(오디오 트랙 없음), 3972656 bytes
- 내용: 인증된 검사기 → 실제 GLB 샘플 검사 → 허용 목록 최적화 → 새 파일 재검사(`조건부 준비`) → GLB·Passport 다운로드 → Dashboard 이력·크레딧·Passport
- SHA-256: `03286dd300051f3df4445e55e1d68fa1cf6baac6cbcdfe11f3b614af7eab517e`
- 이전 녹화본(47.24초, SHA-256 `be4d2023…9f9e00a0`)은 `archive/clunk-demo-auth-final-ko-pre-rebuild-20260821.webm`으로 보존했습니다.
- 로컬 파일은 확보했지만, 공식 접수용 URL·공개 권한·재생 확인은 아직 마스터 확인 전입니다.

## 실제 측정 증거

### 문제 샘플

- 파일: `public/samples/clunk-messy-sample.glb`
- SHA-256: `181473ff49e2a753b3c22198a0ef76f6052ab1efc38ac03a57c58bc62ae8fdf1`
- 크기: 1,124 bytes
- 실제 Core 결과: score 99, 4 findings, 4 vertices, 2 triangles, 2 materials, empty node 포함
- 생성·라이선스 기록: `public/samples/provenance.json`

### 최적화 결과

- 원본 hash: 위 문제 샘플 hash와 동일하게 보존
- 출력 SHA-256: `718f2fbaf4545bb96381c3055270212ca7c91e7197b562555ba63b3c0dc8302b`
- 출력 크기: 908 bytes
- 실제 작업: `prune-empty-nodes ×1`, `dedupe-materials ×1`, `clean-metadata ×1 (metadata-only)`
- 출력 재검사: score 100, 새 파일 parse 성공. missing normals warning은 자동 수정하지 않고 남김.

이 수치는 `clunk-messy-sample.glb` 한 건을 현재 로컬 실행에서 확인한 파일별 결과입니다. 제품 전체 성능이나 시장 성과의 측정값이 아닙니다. 제출 화면에 넣기 전에 `npm.cmd run core:test`, CLI와 브라우저 재실행으로 일치 여부를 다시 확인합니다.

## 숏폼 구성 기준

1. 랜딩 화면에서 Clunk의 문제 정의와 실제 검사기 진입
2. 검사기에서 문제 샘플 선택, 실제 3D 미리보기와 metrics 표시
3. Game-Ready Score와 finding의 관측값·기준값 표시
4. 안전 최적화 클릭, 새 출력·전후 score·material·empty node 표시
5. Passport와 최적화 GLB 다운로드 버튼, source/output hash 표시

촬영은 현재 실행되는 브라우저 화면으로만 하며, 사후 편집으로 결과 수치나 상태를 추가하지 않습니다.

## 제출 증거 게이트

- [x] 재구축 디자인 기준 PNG 6장과 SIWC 인증 실제 Inspector/Dashboard PNG를 파일 목록·hash와 대조 (2026-08-21 재촬영)
- [x] 재촬영 캡처·녹화 전 구간에서 `console` error, `pageerror`, `requestfailed` 0건 확인
- [ ] 최종 선택 이미지가 10장 이하이고, 각 파일이 허용 형식·용량·해상도 조건을 통과
- [ ] 최종 선택 이미지의 실제 실행 시점과 측정값을 재실행으로 확인
- [ ] `10-og-card.png`를 분석 결과 증거로 사용하지 않음
- [ ] 생성 이미지를 선택할 경우 prompt·reference role·license/provenance 기록을 함께 보관
- [x] 실제 브라우저 실행을 녹화한 30~60초 숏폼 파일 확보: `clunk-demo-auth-final-ko.webm` (43.80초, 1280×720, 무음)
- [ ] 숏폼 URL의 공개 권한·재생·길이·화면 수치 일치 확인
