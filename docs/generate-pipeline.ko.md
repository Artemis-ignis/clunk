# Clunk 생성 파이프라인 — 에이전트 생성 → GLB → 검수 게이트

작성일: 2026-08-21. 상태: **1차 레일 구현·실증 완료** (아래 실측 기록).

## 무엇인가

Clunk 안에서 3D 에셋의 **생성부터 판정까지** 닫는 파이프라인이다:

```
이미지/의도  →  에이전트가 절차적 three.js 팩토리 코드 작성   (img2threejs 스킬 규율)
           →  scripts/threejs-to-glb.mjs 로 GLB 추출          (로컬, 무텍스처 코드 전용)
           →  clunk inspect --profile <대상>                  (엔진·목적별 예산 판정)
           →  clunk optimize → 재검사 → Passport              (증명 발급)
```

핵심 설계 판단 — **생성 지능은 에이전트, 레일과 게이트는 Clunk**:
[img2threejs](https://github.com/img2threejs/img2threejs)(Apache-2.0, 상업 사용 가능)는
npm 라이브러리가 아니라 에이전트 스킬이다. 이미지를 근거로 에이전트가 단계별
게이트(블록아웃→구조→형태→재질→…, 패스마다 시각 검증)를 거쳐 **코드로** 모델을 빚는다.
따라서 "웹 버튼 클릭 생성"으로 포장하지 않는다 — Clunk의 고객이 애초에 에이전트이므로,
생성도 에이전트가 하고 Clunk는 GLB 추출 레일과 품질 게이트·증명을 소유한다.
이 구조는 생성 모델이 named node·socket 규약(`blades_pivot` 등)을 코드 수준에서 갖게
만들어, 프로파일 계약 검사(P1: named-node/축 규약)와 자연스럽게 연결된다.

## 구성 요소

- `scripts/threejs-to-glb.mjs` — 팩토리 모듈(`(THREE) => Object3D` export)을 헤드리스로
  실행해 바이너리 GLB를 쓴다. 텍스처 없는 절차 모델 전용(의도된 제약).
  ```bash
  npx tsx scripts/threejs-to-glb.mjs examples/generated/windmill.factory.mjs out.glb
  ```
- `examples/generated/windmill.factory.mjs` — 데모 팩토리. 명명된 애니메이션 소켓
  `blades_pivot`, 중복 없는 머티리얼 5종, userData(sockets)가 glTF extras로 보존된다.
- 이후 단계는 기존 Clunk 표면 그대로: CLI/MCP/웹 검사기·`watch` 모드.

## 실증 기록 (2026-08-21, 전부 실측)

| 단계 | 결과 |
| --- | --- |
| 생성 | farm-windmill.m1.glb — 35,292 B, 노드 20, 정점 544, 삼각형 408, 머티리얼 5, 빈 노드 0 |
| 검사(pc) | **100/100 READY**, finding 1건(INFO FORMAT-GLTF2), sha256 `f8d9f62e…a7d0b` |
| 최적화 | clean-metadata ×2 → 출력 sha256 `22af0110…a772c`, 재검사 100/100 |
| Passport | `examples/generated/farm-windmill.m1.clunk-optimized.glb.passport.json` 발급 |

## 경계 (정직 고지)

- 생성 품질은 에이전트와 참조 이미지에 좌우된다. img2threejs 원칙대로 근사/스타일라이즈드
  결과임을 명시하고, 단일 이미지가 뒷면을 보증하지 못한다는 한계도 그대로 말한다.
- 웹 워크스페이스에는 생성 버튼이 없다(에이전트 없이 성립하지 않는 기능을 UI로 위장하지
  않는다). 웹은 생성물의 검수·판정·증명을 담당한다.
- 텍스처 포함 생성물은 현 레일 밖이다 — 텍스처 세트 검사(P0)와 함께 확장한다.

관련: [roadmap-hf-feedback.ko.md](roadmap-hf-feedback.ko.md) · [benchmark-meshy.ko.md](benchmark-meshy.ko.md) · [custom-profiles.ko.md](custom-profiles.ko.md)
