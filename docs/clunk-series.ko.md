# Clunk Series 사용 안내

Clunk Series는 게임 에셋을 만드는 여러 화면을 하나의 Clunk 계약으로 묶은 제품군입니다.
GitHub 자료는 감사와 재구성의 출발점이고, 제품 실행은 Clunk 내부 코드와 `packages/core`
검사 경계에서 끝납니다. 외부 생성 API의 성공을 Clunk 결과로 표시하지 않습니다.

## 제품군

| 시리즈 | 책임 | 현재 실행 상태 |
| --- | --- | --- |
| Clunk Asset Forge | reference·prompt에서 3D GLB를 별도 출력하고 provenance를 붙임 | native |
| Clunk Sprite Lab | 2D image, Sprite Atlas, Spine 관계형 bundle을 만듦 | native |
| Clunk Material Lab | material graph와 base color·roughness·metallic·normal PNG를 만듦 | native |
| Clunk Motion Lab | animation clip과 로컬 runner 경계를 기록함 | native, runner가 없으면 `ENVIRONMENT_UNAVAILABLE` |
| Clunk Game Ready | bytes·structure·policy·optimization·fresh reopen·Passport·runtime 증거를 연결함 | native |
| Clunk Market | bundle 발견, license 상태, listing Draft와 결제 경계를 관리함 | native, 결제는 미설정 |

공개 제품군 화면은 [`/series`](/series)입니다. 인증이 필요한 실제 생성 화면은
[`/studio`](/studio), 검사·최적화·Passport 화면은 [`/app`](/app), 공개 카탈로그는
[`/marketplace`](/marketplace)입니다.

## 네이티브 작업 흐름

```text
요청 + prompt/reference + license
        ↓
Clunk Series plan + request hash
        ↓
Clunk 내부 authoring rail
        ↓
별도 artifact bytes + 파일별 SHA-256
        ↓
같은 target profile로 fresh inspection
        ↓
bundle manifest + provenance + evidence
        ↓
Game Ready · review · listing Draft
```

모든 결과는 기본적으로 `productionReady: false`입니다. `LOCAL_PREVIEW_ONLY`는 R2
binding이 없는 로컬·개발 환경의 저장 상태이며, 실제 artifact가 사라졌다는 뜻이나
상품 승인을 뜻하지 않습니다. API 결과의 provider는 `clunk-series-native-v1`이고,
기존 `/api/generation`의 provider-neutral 경계와 구분됩니다.

## 로컬 검증

```powershell
npm.cmd install
npm.cmd run typecheck
npm.cmd run series:test
npx.cmd tsx tests/clunk-series-mesh-lab.test.ts
```

3D Game Ready mesh rail은 원본 입력을 보존한 채 복사본에 `@gltf-transform/*`와 `meshoptimizer`로 별도
GLB를 작성합니다. 입력 hash가 보존되고 출력 hash가 새로 생긴 뒤, Clunk Core가 출력
bytes를 다시 읽습니다. meshopt 압축은 전송·저장 최적화이지 polygon 품질 승인이나
player-facing 화면 승인이 아닙니다.

## 라이선스와 provenance

소스 장부는 [GitHub 소스·라이선스 장부](third-party/clunk-series-sources.ko.md)와
`packages/clunk-series/src/source-manifest.ts`가 함께 관리합니다. 생성 결과에는
시리즈 ID, 소스 장부 ID, prompt/reference 역할, license 상태, request hash, 파일별
SHA-256이 들어갑니다. 라이선스를 확인하지 못한 자료는 제품 코드와 에셋에 포함하지
않습니다.

## 승격 경계

다음 항목을 각각 확인하기 전에는 결과를 `READY` 또는 판매 가능으로 부르지 않습니다.

- 실제 입력·출력 bytes와 source/output hash
- parse, structure, policy, blocker, score
- optimize 뒤 fresh output reinspection
- Passport와 다운로드 artifact reopen
- shipped runtime, player-facing 화면, 사람의 human review
- provenance와 license clearance

GitHub clone이 존재하는 것, PNG가 생성되는 것, 구조 점수가 높은 것, 브라우저 카드가
렌더링되는 것만으로는 위 조건을 충족하지 않습니다.
