# FORGE FRONT와 Clunk 협업 핸드오프

이 문서는 Clunk가 FORGE FRONT의 게임 제작을 대신하는 계획이 아닙니다. FORGE FRONT는 별도 게임 프로젝트이며, Clunk는 그 프로젝트가 만든 게임 에셋을 생성·검사·패키징하고 근거를 전달하는 협업 도구입니다.

## 협업 경계

- Clunk가 담당: native 2D·3D authoring, asset hash, provenance, Game Ready 정적 검사, Passport, review evidence, Kit manifest, MCP·CLI 전달.
- FORGE FRONT가 담당: 로그라이크 규칙, 생산 유닛, 전투·맵·UI·저장·플레이테스트와 게임 자체의 완성.
- 이 저장소에서 FORGE FRONT의 게임 코드나 자산을 직접 수정하지 않습니다.

## 권장 흐름

1. FORGE FRONT 팀이 필요한 asset 종류, target profile, 라이선스와 프롬프트를 정합니다.
2. Clunk Studio에서 실제 artifact를 만들거나 파일을 검사합니다.
3. Clunk가 source hash, output hash, provenance와 evidence 상태를 저장합니다.
4. runtime과 player-facing 화면은 FORGE FRONT의 shipped build에서 별도로 캡처합니다.
5. 사람 검토가 끝난 asset만 `clunk.asset-kit.v1` manifest로 묶어 전달합니다.
6. FORGE FRONT 팀은 manifest의 파일 hash와 target profile을 확인한 뒤 게임에 반영합니다.

## 전달물

- asset detail URL: `/assets/:assetId`
- Kit manifest: `/api/kits/:kitId?download=manifest`
- 검수 상태: static, visual runtime, player-facing, human review를 각각 보존
- `productionReady`: 모든 필수 게이트가 실제로 기록되기 전에는 `false`

Kit manifest는 raw bytes를 복제하지 않고 artifact 이름·역할·크기·SHA-256을 기록합니다. R2가 구성되지 않은 로컬 미리보기는 다운로드 성공이나 게임 투입 승인으로 표시하지 않습니다.
