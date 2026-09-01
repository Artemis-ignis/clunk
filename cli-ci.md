---
description: CLI는 실제 바이트를 읽고 JSON evidence와 0/2/4 exit code를 남깁니다
---

# CLI와 CI

CLI는 실제 바이트를 읽고 JSON evidence와 `0/2/4` exit code를 남깁니다. CI는 이 exit code만 보고 게이트를 판단합니다.

## GLB / GLTF 검사

```bash
# 검사: 실제 바이트에서 JSON evidence 생성
$ npm.cmd run clunk -- inspect public/samples/clunk-messy-sample.glb --profile pc

# 정책 판정: blocker 또는 기준 미달이면 exit 2
$ npm.cmd run clunk -- validate public/samples/clunk-messy-sample.glb --profile web

# 원본은 유지하고 별도 파일만 작성
$ npm.cmd run clunk -- optimize public/samples/clunk-messy-sample.glb --out out/quad.glb

# source/output 재검사 결과를 Passport로 묶기
$ npm.cmd run clunk -- passport public/samples/clunk-messy-sample.glb out/quad.glb
```

원본은 절대 수정하지 않고 output을 fresh reopen합니다.

## 텍스처 · UI · evidence

```bash
# texture: 실제 gameplay 거리 band를 포함한 정적 측정
$ npm.cmd run asset:readability -- --config examples/texture-audit/harvest-frontier.textures.json --format json --strict

# portrait UI: 실제 CSS renderPx에서 ΔE 측정
$ npm.cmd run asset:ui-readability -- --config examples/ui-readability/harvest-frontier.portraits.json --format json --strict

# evidence: source identity와 capture를 분리해 normalize
$ npm.cmd run asset:evidence -- normalize --input evidence.json
$ npm.cmd run asset:evidence -- validate --input evidence.json --required
```

`clunk.texture-audit.v1` — exit 0 PASS · 2 FAIL · 4 UNAVAILABLE.

## Pixi 스프라이트 시트 리뷰

```
schema: clunk.sprite-sheet-review.v1
targetProfileId: yeongheo-pixi-2d
evidenceKind: CONTRACT_FIXTURE | PLAYER_FACING_CAPTURE
checks: grid/cell/direction/state/fps/loop/holdLast/pivot/hitbox/opaque-bottom
checks: duplicate/motion delta/clipping/alpha spill/border/silhouette/runtime-size

# local exact RGBA bytes rehash
$ npm.cmd run asset:sprite-audit -- validate --input manifest.json --format json --required
# exit 0 PASS · exit 2 policy/quality FAIL · exit 4 UNAVAILABLE or required review missing

# HTTP API is metadata-only and never dereferences a local path
verificationMode: DECLARED_METADATA_ONLY
visualRuntime: GAP · playerFacing: NOT_EVALUATED · humanDecision: NOT_EVALUATED
```

로컬 바이트 rehash와 HTTP `DECLARED_METADATA_ONLY`를 분리합니다.

## 멀티파일 번들 (Atlas · PNG · Spine)

```json
{
  "schema": "clunk.asset-inspection-request.v2",
  "entryFileName": "skeleton.json",
  "fileCount": 3,
  "files": [
    { "path": "skeleton.json", "role": "spine-json", "relatesTo": ["atlas.atlas"] },
    { "path": "atlas.atlas", "role": "atlas", "relatesTo": ["texture.png"] },
    { "path": "texture.png", "role": "texture", "relatesTo": [] }
  ]
}
```

`entryFileName` · `fileCount` · 역할 · `relatesTo`를 그대로 보존합니다.
