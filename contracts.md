---
description: 점수는 구조 계약의 한 축입니다 — 화면과 사람의 판단은 별도 필드
---

# 계약과 상태

점수는 구조 계약의 한 축입니다. 실제 게임 화면과 사람의 판단은 각각 별도 필드이며 **자동 승격하지 않습니다**.

검사 규칙은 `clunk-game-ready-v1` 1.0.0이고, 규칙 17가지를 봅니다. 점수 90점 이상 · 차단 finding 0건 · 남은 finding이 전부 INFO — 이 세 가지가 모두 맞을 때만 `ready` 입니다.

## 네 개의 상태

| 필드            | 기본값            | 근거                    |
| ------------- | -------------- | --------------------- |
| STATIC        | PASS           | bytes · hash · policy |
| RUNTIME       | GAP            | shipped frame 필요      |
| PLAYER FACING | NOT\_EVALUATED | 실제 화면 판정 전            |
| HUMAN         | PENDING        | 사람 판정 대기              |

## asset inspection evidence

```json
{
  "schema": "clunk.asset-inspection-evidence.v2",
  "evidenceKind": "CONTRACT_FIXTURE",
  "inputHash": "<sha256-of-source-bytes>",
  "resultDigest": "<sha256-of-canonical-result>",
  "byteLength": 680412,
  "coreBuildId": "0.1.0",
  "ruleSetVersion": "1.0.0",
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

`CONTRACT_FIXTURE`는 static 전용, `PLAYER_FACING_CAPTURE`는 해시된 화면 캡처가 필수입니다.

## shipped frame manifest

```json
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

기본 경계는 항상 `reviewStatus=NOT_EVALUATED · visualRuntime=GAP · playerFacing=NOT_EVALUATED`입니다.
