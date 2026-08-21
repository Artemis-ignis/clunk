# Clunk Taste Skill 품질 감사

감사일: 2026-08-20 (KST)

## Brief inference

Clunk는 대한민국 초기 게임 개발팀을 위한 근거 중심 Game AssetOps SaaS입니다. 제품의 첫인상은 화려한 3D 쇼케이스보다 실제 파일·정책·재검사·Passport가 연결된다는 신뢰를 먼저 전달해야 합니다. 따라서 공개 랜딩은 editorial product marketing으로, 로그인은 보안 경계가 분명한 dark glass gateway로, Inspector와 Dashboard는 dense product UI로 분리했습니다.

## Design dials

- `DESIGN_VARIANCE`: 7/10. 템플릿 구조는 보존하되 Clunk 고유의 evidence chain, cyan accent, Korean editorial type scale로 재구성했습니다.
- `MOTION_INTENSITY`: 3/10. 진입·hover·상태 전환만 사용하고, 결과 수치가 움직이는 것처럼 보이게 하는 장식 애니메이션은 넣지 않았습니다.
- `VISUAL_DENSITY`: 랜딩 4/10, 로그인 4/10, Inspector 7/10, Dashboard 8/10. 마케팅과 운영 화면의 목적이 다르므로 같은 카드 시스템을 억지로 공유하지 않습니다.

## System lock

- accent: Clunk cyan 하나를 핵심 상태·CTA·focus에 공통 사용
- typography: Geist Sans + Geist Mono, 한국어 본문과 숫자 계층을 분리
- shape: 10px control / 18px panel / 22px feature radius
- public theme: light evidence surface with dark navy evidence canvas
- login theme: one dark page with labeled web glass approximation
- imagery: provided templates adapted into product surfaces; ImageGen OG card is brand-only and contains no measured result

## Surface audit

| Surface | Template source | Current quality decision |
| --- | --- | --- |
| Landing | `agentic-build-and-orchestrate-ai-agents-while-you-sleep` | Hero copy, proof band, method bento, real sample result, trust principles, and CTA are product-specific. No generic SaaS logos or fake testimonials. |
| Login | `liquid-glass-login-page` | Dark gateway preserves the provided glass direction while clearly naming Sites SIWC and the no-password boundary. It does not pretend to be official Apple Liquid Glass. |
| Dashboard | `custom-globe-component` | Globe becomes an Evidence Atlas with live run/finding/Passport nodes and D1 ledger. Empty, loading, API-error, and authenticated states are explicit. |
| Inspector | Clunk Core product surface | Real metrics and findings are rendered from the selected bytes; the 3D viewport is labeled as a preview, not evidence by itself. |

## Hard pre-flight evidence

- [x] no em dash in product UI copy
- [x] one accent/radius system per surface
- [x] visible focus treatment and CTA contrast
- [x] mobile navigation and stacked Inspector/Dashboard layout tested
- [x] reduced-motion CSS fallback present
- [x] no fake metric image or hand-authored SVG illustration
- [x] real SIWC-authenticated Inspector/Dashboard captures reviewed at `output/application/evidence/22`, `23`, `24`
- [x] console and page errors are zero in the authenticated evidence run
- [x] Plugin/Skill package validated and MCP stdio handshake tested

## Deliberate limits

The Taste Skill explicitly excludes dense operational dashboards from marketing-page rules. Dashboard density is therefore reviewed against product usability and the Core evidence contract, while the public landing and login follow Taste's anti-slop audit. The next visual change must preserve route structure, copy truth, and the evidence-first hierarchy.
