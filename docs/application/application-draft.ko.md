# Clunk 모두의 창업 2차 통합 모집공고 일반·기술트랙 예비창업자 1차 서면 제출(1R) 입력 초안

이 문서는 공식 플랫폼에 직접 입력하기 위한 초안입니다. live form의 실제 문항과 글자 수가 우선이며, 문항이 다르면 의미를 유지한 채 재배치합니다.

## 신청 기준

- 신청자 구분: 예비창업자
- 분야 기준: 일반·기술 분야용 초안
- 제출 원칙: 실제 실행 결과와 향후 검증 계획을 분리하고, 고객·매출·성능을 확보한 것처럼 쓰지 않음

## 아이디어명

생성형 게임 에셋을 출시에 견디는 상태로 바꾸는 Game AssetOps, Clunk

## 아이디어 개요

Clunk는 GLB/GLTF 게임 에셋을 실제 바이트 기준으로 검사하고, 문제를 규칙과 수치로 설명하며, 안전하게 정리한 새 파일을 재검사하고 Asset Passport로 증명하는 Game AssetOps SaaS입니다. 생성형 AI와 마켓·외주 에셋의 생산 속도는 빨라졌지만, 프로젝트에 넣기 전 품질·호환성·성능 위험을 확인하는 과정은 여전히 수작업과 담당자 경험에 의존합니다. Clunk는 검사·정책·최적화·재검사·Passport 핵심 흐름을 Web, CLI, MCP, VS Code에서 동일한 Core 계약으로 제공하고, workspace 이력·크레딧 저장은 Web/Sites API에서 담당합니다.

## 고객 문제

게임 개발팀은 에셋의 triangle, node, material, texture, transform과 리소스 상태를 파일마다 확인해야 합니다. 문제가 늦게 발견되면 엔진에서 다시 수정하고, 원본·수정본 차이를 추적하고, 담당자에게 재검수를 요청하는 비용이 발생합니다. 특히 AI가 생성한 에셋은 빠르게 늘어나므로 “만들 수 있는가”보다 “실제 파이프라인에 넣어도 되는가”를 반복적으로 판단하는 도구가 필요합니다.

## 해결 방법

Clunk는 사용자가 선택한 GLB/GLTF를 브라우저에서 검사하고 SHA-256, 실제 메트릭, 정책 finding, Game-Ready Score를 계산합니다. 자동화는 허용 목록으로 제한하며 원본을 보존하고 새 출력 파일을 만듭니다. 출력 파일을 fresh reinspection하고 source/output hash와 결과 digest를 Passport에 기록하므로, 스크린샷이나 임의의 점수보다 재현 가능한 품질 증거를 제공합니다.

## 기술 구현

순수 TypeScript `Clunk Core`에 `inspectAsset`, `validateAsset`, `scoreAsset`, `optimizeAsset`, `reinspectAsset`, `createPassport` 계약을 구현했습니다. React/Sites Web, CLI, stdio MCP, VS Code는 이 Core의 어댑터입니다. 현재 Core가 계산하는 항목은 파일 hash·크기·포맷, scene/node/depth, mesh/primitive/vertex/triangle, material/draw call, texture와 해상도·메모리, animation/skin, bounds·dimensions, scale·normal·UV 상태입니다. 동일 입력과 정책에서는 canonical 결과 digest가 일치하도록 했습니다.

## 안전 경계

v1 자동 최적화는 빈 identity 노드 제거, 동일 머티리얼 dedupe, 명시적으로 허용한 `extras`·`asset.generator`·`asset.copyright` metadata 정리, 별도 출력 repack입니다. metadata 정리는 Passport에 `metadata-only`로 기록합니다. mesh simplification, texture 재인코딩, Draco/Meshopt 압축, quantization, animation·skin 변경, unknown extension 변경은 자동 적용하지 않습니다. 원본 파일은 덮어쓰지 않으며 출력과 Passport는 별도 다운로드합니다.

## 사업화 계획

초기에는 인디·소규모 게임팀, 외주·마켓 에셋 통합팀, 생성형 3D 파이프라인 팀을 대상으로 파일럿을 운영합니다. 이후 워크스페이스 구독과 검사·최적화 사용량 크레딧을 결합하고, 팀 정책·CI·엔진별 profile·보관형 Passport를 추가합니다. 국내 결제는 실제 수요와 가격 단위를 검증한 후 `BillingProvider` 인터페이스에 연결합니다. 현재 데모 원장은 결제가 아니며, 시장성과 매출은 향후 실증으로 검증할 항목입니다.

## 실행 계획

1. 1차 서면 심사(1R): 실제 에셋 기반 사용성·문제 유형·정책 우선순위를 멘토링과 파일럿으로 확인
2. 후속 심사(2R) 준비: Web·CLI·MCP의 결과 패리티와 Passport 증거를 확장하고 사용자 반복 실행을 측정
3. 기술 고도화: 서버 재검증이 필요한 고객을 위해 R2 보관과 재검사 경계를 설계하고, 엔진별 정책을 추가
4. 사업 검증: 고객 인터뷰, 반복 사용량, 지불 의사와 결제 단위를 확인해 구독·크레딧 모델을 결정

## 현재 성과를 쓰는 방법

“고객 00명”, “처리 속도 00배”, “매출 00원”처럼 측정하지 않은 수치를 쓰지 않습니다. 현재 실행 사실은 측정 결과로, 1차 서면 제출 이후의 고객·수익모델·기술 고도화는 계획 또는 가설로 분리해 씁니다. 대신 아래처럼 실제 실행 사실을 씁니다.

> Clunk MVP에서 실제 GLB 샘플의 hash·scene·node·mesh·material·triangle을 계산하고, 정책 finding을 표시한 뒤, 허용된 노드 제거와 머티리얼 dedupe를 새 파일에 적용했습니다. 출력 파일은 다시 파싱했고, Passport에 원본·출력 hash와 전후 결과를 남겼습니다. Web·CLI·MCP는 같은 Core 계약을 호출합니다.

## 대표 증거 문장

> Clunk의 핵심은 예쁜 3D 뷰어가 아니라, 생성·마켓·외주 에셋이 실제 게임 파이프라인에 들어가기 전 “왜 가능한지, 무엇을 고쳤는지, 출력물이 원본과 어떻게 다른지”를 반복해서 설명하는 증거 체인입니다.
