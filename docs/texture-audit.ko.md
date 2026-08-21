# 텍스처 세트 검사 (texture-audit) — 밉 판독성 · 타일 심리스 · GPU 메모리

상태: v0.2 (2026-08-21) · 실사용 파일럿(Harvest Frontier) 지상 진실 8/8 정합 검증 완료.
GLB 검사와 별개의 **이미지 세트 입력** 검사다 — 지형·타일링 텍스처는 의도적으로 GLB 밖에
두는 것이 표준이라, GLB 검사에 욱여넣지 않고 전용 입력 타입으로 만들었다.

## 실행

```bash
npx tsx scripts/texture-audit.mjs <config.json> [--out report.json] [--strict] [--sigma-floor v] [--calibrate]
```

- `--out` JSON 리포트 저장, `--strict` CI 게이트 모드(위반 시 exit 2: VISIBLE-SEAM /
  게임플레이 밴드 D / 메모리 예산 초과), `--calibrate` 캘리브레이션 프로브 필드 추가.
- 설정 예: [examples/texture-audit/harvest-frontier.textures.json](../examples/texture-audit/harvest-frontier.textures.json)
- 의존성 0: PNG 디코더(8bit, 비인터레이스, 컬러타입 0/2/3/4/6)를 node:zlib 위에 자체 구현.

## 1) 밉 판독성 예측

질문: "이 텍스처는 이 사용 밀도(m/타일)로 깔았을 때, 게임플레이 거리에서 여전히 읽히는가?"

- 분석은 **sRGB 디코드 후 linear 휘도**에서(감마 공간 표준편차는 어두운 텍스처를 과대평가).
- 거리 밴드별 유효 밉 = log₂(화면 픽셀당 텍셀 수 × groundAnisotropy(지면 사선 보정)).
- **보존율** = 유효 밉 이미지(업샘플)의 24px 윈도 로컬 σ ÷ mip0의 같은 값.
- 등급 A/B/C/D 임계 = 보존율 60/35/15% (config로 조정).
- **워시 강등 노브**: 비율 등급이 C일 때, 유효 밉에서의 잔여 입자성 grad/σ가
  `washGradientPerSigma`(기본 0.40)를 넘으면 D로 강등. 물리 해석: 마진 대역에서 잔여
  분산이 fine-grain 노이즈면 "워시"(안 읽힘), 완만한 블롭이면 "얼룩"(읽힘).
- **★처방**: D/C 판정 시 "usage를 N m/타일로 올리거나, 파장 ≥ Y m 대역에 구조(제2 레이어)를
  추가하라"를 수치로 출력. HF M65의 수동 결론(11 m/타일 제2 레이어)을 도구가 재현함을 확인.

### 캘리브레이션 기록 (정직 고지)

- HF가 제안한 절대 σ 하한(σ_floor) 노브는 실데이터에서 **반증**됨: @15m 절대 σ 순서가
  grass 0.0291 > wood 0.0173 > plaster 0.0164 > dirt 0.0103 > roof 0.0095 — 예측(grass<dirt<roof)의
  역순. 보존율·생존 옥타브 에너지도 분리 실패. grad/σ만이 C-대역에서 분리(grass 0.481 vs
  plaster 0.323·dirt 0.312·wood 0.307, 마진 49%).
- 최종 판정 8/8 정합: grass3.4→D(강등)·grass11→A·dirt→C·soil 1.6/1.2→D/D·wood→C·plaster→C·roof→A
  (지상 진실 = HF 마일스톤 캡처 감사 기록).
- 한계: C-대역 강등 사례가 1점(grass)인 캘리브레이션 — 경계 0.32~0.48 어디든 8/8이 나온다.
  HF가 이후 마일스톤의 육안 판정 (usage, 거리, 등급) 튜플을 지속 공급해 경계를 조이기로 확약.
  chroma(대립 채널 σ) 노브는 이 규칙이 깨질 때의 예비 후보.

## 2) 타일 심리스 검사

랩 경계 점프(마지막↔첫 열/행의 평균 |Δ휘도|) ÷ 내부 인접 스텝 평균. 비율 ≈1이면 경계가
내부와 구분 불가(심리스). 판정: SEAMLESS(<1.5) / SOFT-SEAM(<2.5) / VISIBLE-SEAM(≥2.5).
한계: 휘도 전용 — 순수 채도 심은 통과할 수 있음(리포트에 명시).

실측(HF 6종): 5종 SEAMLESS(0.89~1.18), **roof-tiles VISIBLE-SEAM(H 2.7 / V 5.78)**.
인게임 교차 검증(HF, M65 merged survey 캡처): **검출은 참**(심 실존)이나 현 배치는 노출
안 됨(경사면 반복 1~2회 + 용마루 캡/처마 트림 가림) — 도구의 첫 실검출이 "존재 vs 노출"
구분 스펙으로 이어진 사례.

### 심 존재 vs 심 노출 — 축별 판정 사다리

축별 판정: **SEAMLESS / SOFT-SEAM / MASKED / VISIBLE-SEAM**.

- **MASKED (구조 평행 마스킹, HF 발견)**: 평균 분모 비율로는 VISIBLE이지만, 랩 심(라인
  점프)이 텍스처 내부의 최강 구조 라인(행/열별 평균 점프 프로파일의 p99,
  `seamStructureQuantile`)과 견줘 `seamMaskedRatio`(기본 1.5) 이하면 "또 하나의 코스
  라인"으로 읽힌다. 원소 단위 분위수는 코스 경계가 전체 스텝의 1~2%뿐이라 실패하고,
  **라인 대 라인** 비교가 옳다(roof-tiles 가로축: 평균비 2.67 → 구조비 0.93 → MASKED로
  검증됨).
- **노출(exposure) 맥락 2종**: ① `expectedRepeats`(축별 예상 반복 수) ≤
  `seamCoverRepeats`(기본 1.5) → COVERED ② `coveredEdges: ["vertical"…]` — 랩 경계가
  지오메트리 트림에 가려지는 배치 선언 → COVERED. 미선언은 보수적으로 EXPOSED.
  **측정값(verdict)은 어느 경우에도 그대로 보존**된다.
  - `coveredEdges` 사용 주의(HF 사례에서 확립): 랩 라인은 UV **정수 교차점**에서 반복되므로
    표면 중간에도 떨어진다(예: v 0→2.70 매핑이면 v=1, v=2 두 곳이 경사면 중간). 트림이
    가리는 것은 UV 끝단 절단면뿐 — 선언 전에 랩 라인의 실제 위치를 기하로 확인할 것.
  - roof-tiles 판정 이력(수정-검증 루프 1호, 완결): v1 검출 V 5.85 → 반복수 커버 가설
    실측 반증 → 구조 평행 마스킹 발견·라인 p99 정교화(H MASKED 검증) → 트림 가림 가설
    UV 기하 반증(랩 라인은 정수 교차점, 경사면 중간) → EXPOSED/exit 2 → HF가 텍스처
    v2 재생성(커밋 b423769f, sha256 acd8bfd1… 공증 일치) → **공식 재감사: V 평균비
    5.85→1.48·구조비 1.81→0.28, H 2.67→1.28 — 양축 SEAMLESS, strict 통과 exit 0.**
    트레이드오프 정직 기록: 균일 알베도 제약으로 판독성 @15m A(70.2%)→B(56.6%),
    baseσ 0.011 — B는 기준 충족이므로 수용, 원거리 코스 대비가 필요해지면 v3에서 조정.

### CI 게이트 (`--strict`)

위반 시 exit 2, 통과 시 exit 0. 어떤 클래스가 게이트를 깨는지는 `strictChecks`로 선언:
`["seam","memory","readability"]`(기본, 보수적). seam 위반은 **노출(EXPOSED)된 심만**
집계한다. HF CI 편입 설정은 `["seam","memory"]` — grass 근접층의 판독성 D는 제2 광역층으로
설계상 완화되어 있어 정보성으로 유지.

## 3) GPU 메모리 예산

RGBA8 + 전체 밉체인(×4/3) 합산 vs `gpuMemoryBudgetBytes`. 가정은 리포트에 명시(압축 포맷
사용 팀은 재배율). 실측: HF 6종 합산 20.00MB — HF 빌드 스크립트 수동 계산 19.98MB와 일치.
