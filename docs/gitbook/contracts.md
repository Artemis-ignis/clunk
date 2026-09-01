# 계약과 상태
점수는 구조 계약의 한 축입니다. 실제 게임 화면과 사람의 판단은 각각 별도 필드이며 자동 승격하지 않습니다.

## 네 개의 상태

STATIC**PASS**bytes · hash · policy

RUNTIME**GAP**shipped frame 필요

PLAYER**NOT\_EVALUATED**실제 화면 전

HUMAN**PENDING**사람 판정 대기

## 계약 JSON

asset inspection evidence JSON 계약 예시 보기

clunk.asset-inspection-evidence.v2json

```
{
  "schema": "clunk.asset-inspection-evidence.v2",
  "evidenceKind": "CONTRACT_FIXTURE",
  "inputHash": "<sha256-of-source-bytes>",
  "resultDigest": "<sha256-of-canonical-result>",
  "byteLength": 680412,
  "coreBuildId": "0.1.0",
  "ruleSetVersion": "0.1.0",
  "profileId": "pc",
  "profileHash": "<sha256-of-profile>",
  "inspectionRunId": "HF-M117-tractor-r01",
  "qualityPolicy": { "requireRuntimeEvidence": "ADVISORY" },
  "findings": [{
    "code": "GEO-MISSING-NORMALS",
    "severity": "INFO",
    "observed": 7,
    "threshold": 0,
    "ownership": "unknown",
    "enforcement": "ADVISORY",
    "recommendation": "Confirm target-engine import policy before changing source bytes."
  }]
}
```

CONTRACT\_FIXTURE (static only) | PLAYER\_FACING\_CAPTURE (hashed screenshot/frame required); finding ownership을 보존합니다.

shipped frame manifest JSON runtime 입력 보기

frame-manifest.v1json

```
{
  "schema": "clunk.frame-manifest.v1",
  "runId": "HF-M111-baseline",
  "sourceCommit": "<HF_SOURCE_HEAD>",
  "renderer": "WEBGPU",
  "viewport": { "width": 1920, "height": 1080, "dpr": 1 },
  "shippedPath": true,
  "frames": [{
    "id": "farm-nohud-webgpu",
    "path": "<ABSOLUTE_OR_UPLOADED_PATH>",
    "bytes": 2844135,
    "sha256": "<sha256>",
    "hud": false,
    "console": { "errors": 0, "warnings": 0 }
  }],
  "reviewStatus": "NOT_EVALUATED",
  "visualRuntime": "GAP",
  "playerFacing": "NOT_EVALUATED"
}
```

reviewStatus: NOT\_EVALUATED · visualRuntime: GAP · playerFacing: NOT\_EVALUATED; renderer pair는 별도 제출합니다.

**기본 경계**reviewStatus=NOT\_EVALUATED · visualRuntime=GAP · playerFacing=NOT\_EVALUATED
