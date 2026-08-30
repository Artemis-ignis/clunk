# 마켓 1차 등록 결정 패키지 (Wave 1)

작성: 2026-08-31, 오케스트레이터. 목적: 마스터가 **가격과 라이선스만 결정하면**
바로 등록 절차(게시 7게이트)로 들어갈 수 있도록 상품·스펙·증거를 확정해 둔다.
아래 모든 수치는 실측이며, 가격란은 비워 둔다 — 이 저장소는 가격을 지어내지 않는다.

## 결정이 필요한 것 (마스터)

1. **라이선스 문안 확정** — 전 상품 공통 제안: "구매자 프로젝트(상업 포함) 무제한 사용,
   재판매·재배포 금지, 저작인격권 표기 불요" (폴리포크식 표준). luna 생성물(2D)은
   OpenAI 생성 콘텐츠 약관상 사용자 권리 귀속을 전제로 하되, 최종 확인은 마스터 몫.
2. **가격** — 각 상품 가격란 기입 (KRW는 100전 단위 = 원 단위 정수 필요,
   예: ₩3,000 → price_cents 300000).
3. **크레딧 팩 가격** — clunk_credit_packs 3종(Starter 500 / Studio 2,000 / Foundry 6,000
   크레딧)의 price_cents 기입 + status를 ACTIVE로 전환하면 즉시 판매 개시.

참고 시장가(정직 표기 — 우리 가격 근거가 아니라 관측치): polyfork.dev 개별 저폴리
에셋 무료~소액, 키트 단위 판매 병행. meshy.ai는 구독제(생성형). aetherforge는 크레딧제.

## 상품 1 — Cozy Farm Set (3D, 3종 개별 + 세트)

| 항목 | market-stall | storage-shed | fence-gate |
|---|---|---|---|
| tris / draws / mats | 2,456 / 31 / 11 | 1,620 / 24 / 9 | 520 / 13 / 6 |
| 실측 크기(m) | 2.44×2.26×1.35 | 2.60×2.93×2.23 | 2.40×1.71×0.52 |
| 검증 | web·HF 프로파일 100/100 READY, blocker 0 (양쪽) | 동일 | 동일 |
| 소켓 | crate_slot_* 4종 | door_pivot | gate_pivot(걸쇠 포함) |
| sha256 | 5db7a839… | a0db8de2… | 9102e822… |
| 파일 | examples/generated/cozy-farm-set/*.m1.glb + passport | 동일 | 동일 |
| 제안 슬러그 | cozy-market-stall | cozy-storage-shed | cozy-fence-gate |
| **가격(₩, 결정란)** | ____ | ____ | ____ |

세트(3종 묶음) 병행 판매 제안 — 슬러그 cozy-farm-set-vol1, **세트가(결정란)**: ____
비고: 실게임(Harvest Frontier) 납품분과 동일 계보. 스타일 사전판정 합격(HF 회신).
등록 전 필요 작업(오케스트레이터): 엔진급 히어로 렌더, preview 아티팩트(다운스케일) 생성.

## 상품 2 — Grove Tree Pack Vol.1 (3D, 6 템플릿 일괄)

| 템플릿 | tris | 특징 |
|---|---|---|
| broadleaf-round-full | 1,730 | 단일 돔 캐노피 |
| broadleaf-round-forked | 2,136 | 분기 쌍덩어리 |
| broadleaf-column-flame | 2,120 | 수직 화염 실루엣 |
| broadleaf-column-tiered | 2,050 | 4단 선반 |
| conifer-spire | 860 | 톱니 스커트 침엽 |
| conifer-umbrella | 1,772 | 우산소나무 |

공통: 머티리얼 2/드로우 2, COLOR_0 3스톱 램프, InstancedMesh 직행 구조(21배치 실증),
양 프로파일 100/100 READY, 결정론 export(2회 sha 동일). 파일: examples/generated/harvest-frontier-trees/.
제안 슬러그: grove-tree-pack-vol1. **가격(결정란)**: ____
비고: far LOD 없음(1단) — 상품 설명에 정직 표기 필수.

## 상품 3 — Verified Seamless Textures Vol.1 (2D, 7종)

grass-meadow / dirt-path / stone-wall / wood-planks / roof-tiles / sand-dry / soil-tilled-v2.
전량 1024², 심리스 오디트 통과(SEAMLESS 5·SOFT 2), 판독성 밴드 실측표·GPU 메모리
실측(합 37.33MB)·luna provenance(프롬프트·모델·sha) 동봉. 파일: outputs/market-2d/textures-vol1/
(등록 시 R2 업로드 필요). 차별점 문구 제안: "생성형 텍스처를 심리스·판독성 실측 증거와
함께 판다 — 세계에서 이 증거를 주는 텍스처 팩은 Clunk뿐."
제안 슬러그: verified-seamless-textures-vol1. **가격(결정란)**: ____
비고: soil-tilled-v2/v3는 실게임 채택 이력(HF) 을 설명에 사용 가능 — 사실이므로.

## 등록 절차 (가격·라이선스 확정 후, 오케스트레이터 실행)

1. preview 아티팩트 생성(유료 상품 무료 유출 차단 규칙 대응: role="preview" 저해상판)
2. 히어로 렌더(엔진급) 촬영 → 상품 이미지
3. R2 업로드 → 자산·아티팩트 등록 → 7게이트(정적/증거/라이선스/런타임/플레이어/휴먼) 통과
4. PUBLISHED 전환 → 사이트 마켓 노출 확인 → HF/FF 인게임 검증 이력을 상세 페이지 증거로 연결
