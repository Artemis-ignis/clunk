# 현장 시험 — Polyfork 무료 에셋을 Harvest Frontier에 넣어 보기

**2026-09-04.** Day5의 사용자 이해 1순위(**사용자 되어보기** — 다른 서비스에 가서 손님의
입장을 직접 경험)를 실제로 한 기록입니다. 인터뷰 대상이 없어 인터뷰를 못 하는 상황에서,
강의가 인터뷰(3순위)보다 위에 둔 방법을 먼저 했습니다.

대상은 운영자가 레퍼런스로 지목한 **polyfork.dev**입니다. 같은 종류를 나란히 비교하려고
Harvest Frontier에 이미 있는 `farm-water-butt`와 짝이 되는 **Stone Water Trough**를
골랐습니다.

---

## 1. 손님이 되어 본 경로

| 단계 | 결과 |
|---|---|
| 무료 목록 | 1,159개 중 **586개 무료**, 전부 600 tris 이하 |
| 계정 | 페이지가 명시 — *"Free: create a free account to download. **Hotlinking from the CDN needs no account.**"* → **계정 없이 CDN에서 받음** |
| 받은 것 | `stone-water-trough-aeabaa.glb` **60,580 B** (페이지 표기 "GLB (59 KB)"와 일치) |
| 함께 받은 것 | `.mjs` ES 모듈 30,414 B |

상품 페이지가 싣는 값: **550 triangles · 1 material · 1.6 × 0.5 × 0.8 m, real-world
scale · GLB (59 KB)**, 그리고 라이선스 전문("No attribution required. No reselling the
raw assets").

## 2. Harvest Frontier 엔진에 실제로 로드

HF 개발 서버(`localhost:5173`)의 에셋 뷰어 페이지에서, **HF 자신의 three.js·GLTFLoader·
MeshoptDecoder 인스턴스**로 로드했습니다. 별도 엔진이 아니라 그 게임이 쓰는 그것입니다.

```
loaded : true      6 ms
triangles          550
meshes / materials 1 / 1
size               1.6 × 0.5 × 0.8 m
animations         0
nodes              AuxScene / stone-water-trough / trough
```

**표기값이 전부 정확했습니다.** 삼각형·재질·크기·용량 넷 다 파일과 일치합니다.
사람 키 1.7 m 기준 막대 옆에 세워 보니 스케일도 맞습니다.

## 3. Clunk 검사기에 넣어 본 결과

```
npm run asset:inspect -- --path <glb> --target-profile harvest-frontier-web-three
```

| 항목 | 값 |
|---|---|
| 최종 상태 | **BLOCKED** |
| **일반 게임 적합성 점수** (`clunk-game-ready-v1`) | **100점 · 하드 블로커 0** |
| Harvest Frontier 의미 규약 | **fail** — root 0 · pivot 0 · socket 0 · collider 0 · meshopt 없음 |
| `godot-4` 프로파일 | **ENVIRONMENT_UNAVAILABLE** |
| `unity` 프로파일 | **ENVIRONMENT_UNAVAILABLE** |

**BLOCKED의 원인은 품질이 아니라 Harvest Frontier의 사내 규약입니다.** 이름 규칙과
meshopt 요구는 HF의 것이지 보편 기준이 아닙니다. 제3자 에셋은 거의 전부 여기서 걸립니다.

그리고 Godot·Unity로 물으면 **검사기가 판정 자체를 못 합니다.** 웹 검사 화면(`/app`)은
별개의 예산 기반(`web|mobile|pc`) 시스템이라 이 제약을 받지 않지만, CLI·MCP 경로에서
"어느 엔진에 맞는가"를 묻는 순간 답이 "환경 없음"입니다.

## 4. 그리고 실제 결함을 하나 찾았습니다

Polyfork 상품 페이지의 문장:

> **"Materials, not vertex colours:** the palette comes across as **named materials you
> can retint**, and they carry this model's own knob names."

받은 GLB를 열어 본 실제 값:

| 항목 | 값 |
|---|---|
| `vertexColors` | **true** |
| 재질 이름 | **없음** (three `""`, glTF `null`) |
| 정점 속성 | position · **color** · normal |
| 텍스처 | 없음 |
| 재질 수 | 1 |

**정확히 "아니다"라고 적힌 그 방식입니다.**

공정하게 확인한 결과: `.mjs` ES 모듈에는 이름이 있습니다 — 파트 `basin`·`coping`·
`coping-rim`·`iron-pipe`·`iron-tap`, 팔레트 `black-basalt`·`bone-limestone`·
`crypt-granite`·`dusk-porphyry`. 그러니 **three.js에서 그 모듈을 쓰면 주장이 참입니다.**

문제는 같은 페이지가 **Unity · Godot · Blender**와 **FBX · USDZ · OBJ** 내려받기를 나란히
광고한다는 점입니다. 그 경로들은 전부 GLB 계열을 받고, 거기엔 이름 있는 재질이 없습니다.
**한 페이지가 한 문장으로 두 경로를 설명하는데, 한쪽에서는 사실이 아닙니다.**

그리고 **받아서 열어 보기 전에는 알 수 없습니다.** 이것이 Clunk가 존재한다고 주장하는
바로 그 문제이고, 관찰로 실제 사례를 하나 확보했습니다.

## 5. 우리에게 불리한 것 — 그대로 적습니다

확증편향을 피하려고 반대 증거도 같이 잽니다.

**5-1. 표기값이 전부 정확했습니다.** 550/1/1.6×0.5×0.8/59KB 넷 다 맞습니다.
"마켓이 숫자를 부정확하게 적는다"는 우리 문제 정의는 **적어도 이 경쟁사에는 해당하지
않습니다.** Clunk 자신은 트랙터 표기 32,300 → 실측 58,156, 헬기 사양 전체 소실을 겪었습니다.

**5-2. 베이크 조명이 회전에 안전합니다.** 정점 밝기와 법선의 상관을 재 봤습니다.

| 축 | 상관 |
|---|---|
| X (수평) | **0.0026** |
| Z (수평) | **0.0000** |
| Y (수직) | 0.1588 |

수평 성분이 사실상 0입니다 — 돌려도 밝기가 변하지 않습니다. **Clunk의 나무는 어제까지
+X 0.1442 / −X 0.0771(편차 0.0673)로 나침반이었습니다.** 이 항목은 저쪽이 옳게 했고
우리가 틀렸습니다.

**5-3. 무료 구간이 넓습니다.** 1,159개 중 586개, 상업 이용 가능, 출처 표시 불필요,
API·MCP 무료. Clunk의 무료 등급(31개 중 B등급 약 13개)보다 훨씬 큽니다.

**5-4. 우리 검사기가 남의 엔진을 모릅니다.** Godot·Unity는 ENVIRONMENT_UNAVAILABLE.
글로벌로 간다면 이 둘이 시장의 대부분입니다.

---

## 6. 이 시험이 계획에 미치는 영향

1. **문제 정의를 바꿔야 합니다.** "마켓이 숫자를 정확히 안 적는다"가 아닙니다. 좋은
   마켓은 정확히 적습니다. 실제 격차는 **"파일이 내 엔진의 규약과 맞는지"** 이고, 그건
   숫자가 아니라 **구조**(루트·소켓·콜라이더·압축·재질 이름)입니다. Polyfork의 재질 이름
   불일치가 바로 그 사례입니다.
2. **경쟁우위 칸이 더 약해졌습니다.** 검사기의 강점이 HF 전용 규약에 묶여 있습니다.
   Godot·Unity 러너 없이는 글로벌 사용자에게 판정을 줄 수 없습니다.
3. **우리 품질이 레퍼런스보다 낫다고 말할 수 없습니다.** 표기 정확도와 베이크 정합성
   둘 다 저쪽이 앞섰습니다. "우리는 검증한다"는 주장은 지금 근거가 약합니다.
4. **1순위는 값이 쌉니다.** 여기까지 약 30분, 비용 0원, 사용자 0명. Day5가 인터뷰보다
   위에 둔 이유가 이것입니다.

## 7. 남긴 것

- `C:\Users\50106\Desktop\Harvest Frontier\public\assets\thirdparty\polyfork-stone-water-trough.glb`
  — HF 트리에 남긴 유일한 파일입니다. 시험이 끝나면 지워도 됩니다. HF의 소스는 한 줄도
  고치지 않았습니다.
- `tmp/field-test/` — 받은 원본, 검사 리포트 3종(`harvest-frontier-web-three`,
  `godot-4`, `unity`).
- Clunk `.claude/launch.json` 에 `hf-dev` 항목 추가(기존 `clunk-vending-dev`와 같은 방식).
