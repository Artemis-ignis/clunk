# Harvest Frontier
HF는 Clunk의 구조 evidence를 소비하지만 원본 에셋과 최종 플레이어 화면 판정의 source of truth를 유지합니다.

## 수신된 스냅샷

STATIC INSPECTION**score 100 · hard blockers 0**tractor.compact.m1.glb · read-only

OBSERVATIONS**88 draws · texture 0**missing normals 7 · UV 88 · non-unit scale 181

PLAYER REVIEW**NO\_GO · GAP**정적 PASS는 화면 승인이 아님

## 외부 handoff evidence

HF tractor reinspection 외부 handoff 예시 보기

canonical reinspection · received evidencejson

```
// EXTERNAL HF HANDOFF · fresh read-only MCP observation; static contract only
{
  "asset": "public/assets/runtime/tractor.compact.m1.glb",
  "profileFile": "C:/Users/50106/Desktop/Clunk/examples/profiles/harvest-frontier.example.json",
  "inputHash": "d92ae93240cc9b4d477df13cbddd0342738feb57ed9b8551e73d68fd83b3222c",
  "resultDigest": "4789a69a70cecbd4f3cc30e70c17293c1776823747095467da9b8c5b4dc008df",
  "numericContract": { "status": "PASS", "valid": true, "score": 100, "ready": true, "hardBlockerCount": 0 },
  "observations": { "drawCallCount": 88, "textureCount": 0, "missingNormalPrimitiveCount": 7, "missingUvPrimitiveCount": 88, "nonUnitScaleNodeCount": 181, "bounds": "±32767" },
  "ownership": "UNKNOWN",
  "runtimeUsage": "UNKNOWN",
  "visualRuntime": "GAP",
  "playerFacing": "NOT_EVALUATED",
  "optimization": "NOT_RUN",
  "interpretation": "INFO observations remain actionable evidence. textureCount=0 may be procedural/material runtime authoring and is not a defect without ownership and shipped-frame evidence."
}
```

HF 값은 외부 handoff이며 Clunk checkout에서 재검증하지 않았습니다.

stale evidence와 fresh run 현재 승인과 구분하기

freshness · stale vs errorjson

```
// EXTERNAL HF HANDOFF · stale notarisation is not current approval
{
  "manifestSession": "62a04389",
  "hfCommit": "bcf3523c",
  "readOnly": true,
  "optimizerAllowed": false,
  "coverage": { "shippedTotal": 41, "notarised": 14, "neverNotarised": 27 },
  "status": "STALE_NOTARISATION_NOT_CURRENT_APPROVAL",
  "staleNotarisations": ["roof-tiles.png", "assets/provenance.json", "public/assets/provenance.json"],
  "currentAction": "fresh read-only reinspection of current HF bytes, new inputHash/resultDigest, then a new manifest",
  "boundary": "STALE is historical evidence; ERROR/BLOCKED means the fresh reinspection failed. Neither status is player-facing approval."
}
```

stale coverage는 current-artifact approval이 아닙니다.

player-facing scene review comparison과 human lane 보기

player-facing scene review outputbash

```
# player-facing scene review output
comparisonSchema: clunk.frame-comparison.v1
reviewStatus=NOT_EVALUATED · visualRuntime=GAP · playerFacing=NOT_EVALUATED
inspectionRunId is required for a CURRENT reinspection

# frame evidence writes
append: keep prior frames/gaps and upsert the same stable id
replace: replace the named evidence lane only; do not erase other lanes
same renderer + viewport + cameraPoseHash + sourceTreeHash are required

# received HF evidence (not a template)
HF-M94-packaged-r01-03-game-nohud.png
sha256: 5978400B0DD77A5ED90EDE70617726B0DB838A5892075BDDD18DA5CCE0F58E15
scene gaps: distant-terrain-band · dialogue-composition · poseFocusCoverage
texture follow-up: wood SOFT-SEAM

M104 comparison acceptance
HF M105 WebGPU/WebGL2 handoff
HF M105 fresh tractor inspection
frameSourceCommit and sourceCommit stay separate

asset evidence: clunk.asset-evidence-ref.v1
STALE EVIDENCE · NOT CURRENT APPROVAL
stale notarisation is not an execution error

$ npm.cmd exec -- tsx scripts/frame-manifest-cli.ts validate --input evidence.json --required
```

comparison pair·asset provenance·human review를 합치지 않습니다.

협업 API는 evidenceMode: append (stable-id upsert) | replace (full snapshot), reviewStatus: NOT\_EVALUATED · visualRuntime: GAP · playerFacing: NOT\_EVALUATED, POST /api/collaboration/threads/:threadId/evidence · evidence-only merge, same auth/workspace boundary를 사용합니다.
