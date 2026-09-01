# CLI와 CI
CLI는 실제 바이트를 읽고 JSON evidence와 0/2/4 exit code를 남깁니다. 긴 예시는 필요할 때만 펼칩니다.

## 실행 명령

GLB/GLTF inspect · validate · optimize 실행 명령 보기

**clunk-cli**

```
# 검사: 실제 바이트에서 JSON evidence 생성
$ npm.cmd run clunk -- inspect public/samples/clunk-messy-sample.glb --profile pc

# 정책 판정: blocker 또는 기준 미달이면 exit 2
$ npm.cmd run clunk -- validate public/samples/clunk-messy-sample.glb --profile web

# 원본은 유지하고 별도 파일만 작성
$ npm.cmd run clunk -- optimize public/samples/clunk-messy-sample.glb --out out/quad.glb

# source/output 재검사 결과를 Passport로 묶기
$ npm.cmd run clunk -- passport public/samples/clunk-messy-sample.glb out/quad.glb
```

원본은 유지하고 output을 fresh reopen합니다.

texture · portrait · evidence 읽기 쉬움·증거 CLI 보기

**texture + portrait + evidence**

```
# texture: 실제 gameplay 거리 band를 포함한 정적 측정
$ npm.cmd run asset:readability -- --config examples/texture-audit/harvest-frontier.textures.json --format json --strict

# portrait UI: 실제 CSS renderPx에서 ΔE 측정
$ npm.cmd run asset:ui-readability -- --config examples/ui-readability/harvest-frontier.portraits.json --format json --strict

# evidence: source identity와 capture를 분리해 normalize
$ npm.cmd run asset:evidence -- normalize --input evidence.json
$ npm.cmd run asset:evidence -- validate --input evidence.json --required
```

clunk.texture-audit.v1: 0 PASS · 2 FAIL · 4 UNAVAILABLE.

Pixi sprite sheet review RGBA rehash와 HTTP 경계 보기

**Pixi sprite sheet review**

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

clunk.sprite-sheet-review.v1: local byte rehash와 HTTP DECLARED\_METADATA\_ONLY를 분리합니다.

Atlas · PNG · Spine bundle 멀티파일 manifest 보기

**multi-file AssetOps bundle**

```
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

entryFileName·fileCount·역할·relatesTo를 보존합니다.
