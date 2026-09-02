---
description: 2D와 3D 모두 provenance를 남기고 검사합니다
---

# Asset Studio

2D와 3D 모두 provenance를 남기고 검사합니다. **생성 완료와 게임 화면 승인은 다른 증거**입니다.

## Clunk Series · Native

GitHub 자료는 감사된 source material로만 기록하고, 실제 실행은 Clunk 내부 코드와 Core 계약으로 수행합니다. [여섯 시리즈와 소스 장부](https://clunk.games/series)

```bash
# Clunk Series: 내부 코드로 실행하는 Game Ready mesh pass
$ npm.cmd run series:mesh -- game-ready public/samples/clunk-messy-sample.glb \
    --out output/game-ready/optimized.glb \
    --target-profile web-three-mobile --run-id series-game-ready-001

# output과 같은 이름의 .clunk.json sidecar에 input/output hash와 fresh evidence 기록
# 원본은 절대 덮어쓰지 않음
# provider: clunk-series-native-v1
# productionReady: false until runtime capture and human review are supplied
```

## 검사 범위

| 종류     | 대상                                    | 검사 내용                                                                      |
| ------ | ------------------------------------- | -------------------------------------------------------------------------- |
| 2D     | Sprite · Atlas · Spine JSON           | PNG page, region bounds, bones, slots, attachments, animation 이름과 atlas 관계 |
| 3D     | Model · Mesh · Motion                 | GLB/GLTF 구조, 재질, bounds, animation sampler와 target node                    |
| Engine | Web · Godot · Unity · Unreal · Mobile | 실제 runner가 없으면 `ENVIRONMENT_UNAVAILABLE`로 남김                               |

## 생성 명령

```bash
# 2D Sprite / Atlas / Spine JSON bundle
$ npm.cmd run asset:author -- --asset-kind 2d-image --target-profile harvest-frontier-web-three --recipe-id sprite-sheet-factory-v1 --recipe-version 1.0.0 --output-directory output/generated
$ npm.cmd run asset:author -- --asset-kind sprite-atlas --target-profile harvest-frontier-web-three --recipe-id sprite-atlas-factory-v1 --recipe-version 1.0.0 --output-directory output/generated
$ npm.cmd run asset:author -- --asset-kind spine-project --target-profile harvest-frontier-web-three --recipe-id spine-json-factory-v1 --recipe-version 1.0.0 --output-directory output/generated

# 3D model / animation
$ npm.cmd run asset:generate -- --factory examples/generated/windmill.factory.mjs --target-profile harvest-frontier-web-three --recipe-id threejs-factory-v1 --recipe-version 1.0.0 --output-directory output/generated
$ npm.cmd run asset:author -- --asset-kind animation-clip --target-profile harvest-frontier-web-three --recipe-id threejs-animation-factory-v1 --recipe-version 1.0.0 --output-directory output/generated
```

모든 output은 별도 폴더에 쓰고 같은 target profile로 reopen합니다.

## 사용 제한

로컬 stdio의 `clunk_asset_author`와 CLI만 출력 파일을 작성합니다. 원격 HTTPS MCP는 로컬 경로를 읽거나 쓰지 않고 업로드된 bundle만 검사합니다. `.skel` binary parser와 실제 엔진 playback은 아직 adapter/runner가 필요하며, `CONTRACT_FIXTURE`나 structural PASS만으로 player-facing 승인을 만들지 않습니다.
