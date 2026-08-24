# Harvest Frontier x Clunk 파일럿 리포트

실제 Harvest Frontier 런타임 GLB를 Clunk에 읽기 전용 입력으로 연결한 재현 가능한 파일럿입니다.

## 판정

- 실행 ID: hf-clunk-20260824023146
- 생성 시각: 2026-08-24T02:31:47.333Z
- Harvest Frontier commit: 657eda1d02890686ff4f91dac14a15504b52e081
- rule set: harvest-frontier-runtime-v1
- readOnly: true
- Harvest 원본에 optimizer가 쓰였는가: false
- productionReady: false

Clunk의 READY/점수는 GLB 구조·정책 검사 결과입니다. Harvest Frontier의 named pivot/socket/collider, Meshopt 보존, decoded bounds, near/far LOD 관계, 엔진 플레이 검증과 판매 승인까지 대신 판정하지 않습니다.

## 요약

| Asset | Bytes | Triangles | Clunk score | Output reopen | Operations |
| --- | ---: | ---: | --- | --- | --- |
| cultivator.compact.m1.glb | 189912 | 16196 | 100/90 READY | YES | clean-metadata |
| cultivator.compact.m1.lod1.glb | 104760 | 7824 | 100/90 READY | YES | clean-metadata |
| processing.line.m1.glb | 435532 | 24936 | 100/90 READY | YES | clean-metadata |
| processing.line.m1.lod1.glb | 199700 | 14906 | 100/90 READY | YES | clean-metadata |
| seeder.compact.m1.glb | 557888 | 11318 | 100/90 READY | YES | clean-metadata |
| seeder.compact.m1.lod1.glb | 219100 | 6460 | 100/90 READY | YES | clean-metadata |
| tractor.compact.m1.glb | 680412 | 30188 | 100/90 READY | YES | clean-metadata |
| tractor.compact.m1.lod1.glb | 509584 | 18668 | 100/90 READY | YES | clean-metadata |

## 협업 경계

- Harvest Frontier public/assets/runtime GLB files were opened as read-only inputs.
- All optimizer outputs were written below a temporary directory outside the Harvest Frontier checkout.
- The source asset hash is compared with Clunk before inspection, and each output is reopened and re-inspected.
- Passport records source/output hashes, inspection digests, operations, metrics, and scores.
- productionReady remains false because Clunk does not certify Harvest engine semantics or gameplay.

## 자산별 증거

### cultivator.compact.m1.glb
- 원본 경로: C:\Users\50106\Desktop\Harvest Frontier\public\assets\runtime\cultivator.compact.m1.glb
- 원본 SHA-256: 18a720e4e55878eb64cdcd5da39fb02187741d0e1af7ed06ca2a279540519a50
- 원본 결과 digest: d8b74ed389f38bd836b9f3b5d257bd7cf266cb5e3e9e23355f7dadee1bcc5c33
- Clunk 점수: 100/90 READY
- 차단 finding: 0
- 최적화 출력: cultivator.compact.m1.clunk-optimized.glb
- 출력 reopen: 확인됨
- Passport output hash: 4cdf4ced856d181c8c7a687975a35c82810d9dc86bfee7e61f9a969f274b74cd
Findings
- INFO FORMAT-GLTF2: glTF 2.0 parsed
- INFO GEO-MISSING-NORMALS: Normals are missing
- INFO SCENE-NONUNIT-SCALE: Non-unit scale transforms found
Operations
- clean-metadata (metadata-only, 93)

### cultivator.compact.m1.lod1.glb
- 원본 경로: C:\Users\50106\Desktop\Harvest Frontier\public\assets\runtime\cultivator.compact.m1.lod1.glb
- 원본 SHA-256: 464106711b59289dc0fd432b323fae691aec66deefff68e7f67c37306a098c3a
- 원본 결과 digest: b487996a093ae594578bf763ad7ce5bce67a77eeb5fdeb1207fb02d7c37ee06e
- Clunk 점수: 100/90 READY
- 차단 finding: 0
- 최적화 출력: cultivator.compact.m1.lod1.clunk-optimized.glb
- 출력 reopen: 확인됨
- Passport output hash: 3fff470c2248298072f01dcfc69a2df4b10e9ac32844f2fd4ae81e18a07705f8
Findings
- INFO FORMAT-GLTF2: glTF 2.0 parsed
- INFO GEO-MISSING-NORMALS: Normals are missing
- INFO SCENE-NONUNIT-SCALE: Non-unit scale transforms found
Operations
- clean-metadata (metadata-only, 93)

### processing.line.m1.glb
- 원본 경로: C:\Users\50106\Desktop\Harvest Frontier\public\assets\runtime\processing.line.m1.glb
- 원본 SHA-256: dc2de953592988384f2cd0fed87350b8f6d4226003567ab837fc06a09f305fed
- 원본 결과 digest: 1b8c152d8010eddd8c098810f036daf4909597b2028bf4f52a0ab177995dc118
- Clunk 점수: 100/90 READY
- 차단 finding: 0
- 최적화 출력: processing.line.m1.clunk-optimized.glb
- 출력 reopen: 확인됨
- Passport output hash: bf0581d5108a0ce180a8b7d0e9d54ab66f05a1f67442d7e5812662164bca90cb
Findings
- INFO FORMAT-GLTF2: glTF 2.0 parsed
- INFO SCENE-EMPTY-NODES: Empty nodes found
- INFO SCENE-NONUNIT-SCALE: Non-unit scale transforms found
Operations
- clean-metadata (metadata-only, 82)

### processing.line.m1.lod1.glb
- 원본 경로: C:\Users\50106\Desktop\Harvest Frontier\public\assets\runtime\processing.line.m1.lod1.glb
- 원본 SHA-256: 2605f6fa3f477b569566b4db9b371c5c87554221c61a5edbf10317e3f3e2ba49
- 원본 결과 digest: 432f6dcb02446e8b4d3f0d0380c213c8558efed999e0cd7e37e7ecd125f31cb3
- Clunk 점수: 100/90 READY
- 차단 finding: 0
- 최적화 출력: processing.line.m1.lod1.clunk-optimized.glb
- 출력 reopen: 확인됨
- Passport output hash: fab38a1b2978faf113d7c40bed9a42bc1e78d82e9520ba443278bcfff448078c
Findings
- INFO FORMAT-GLTF2: glTF 2.0 parsed
- INFO SCENE-EMPTY-NODES: Empty nodes found
- INFO SCENE-NONUNIT-SCALE: Non-unit scale transforms found
Operations
- clean-metadata (metadata-only, 55)

### seeder.compact.m1.glb
- 원본 경로: C:\Users\50106\Desktop\Harvest Frontier\public\assets\runtime\seeder.compact.m1.glb
- 원본 SHA-256: b5ece82b0c814ad8ac7c028a5d14303ee2e0da9462bb386c47fdc58000733570
- 원본 결과 digest: 8f8554cf9cbb222bf3e8069b5ece5afd0fb99b6d4c3d9a9a5f17026964ea8fc9
- Clunk 점수: 100/90 READY
- 차단 finding: 0
- 최적화 출력: seeder.compact.m1.clunk-optimized.glb
- 출력 reopen: 확인됨
- Passport output hash: 659034394b92eff874553b8e807098b35a4b0a076b8e1361fd72f37eab232863
Findings
- INFO FORMAT-GLTF2: glTF 2.0 parsed
- INFO SCENE-EMPTY-NODES: Empty nodes found
- INFO SCENE-NONUNIT-SCALE: Non-unit scale transforms found
Operations
- clean-metadata (metadata-only, 253)

### seeder.compact.m1.lod1.glb
- 원본 경로: C:\Users\50106\Desktop\Harvest Frontier\public\assets\runtime\seeder.compact.m1.lod1.glb
- 원본 SHA-256: 72a6937833549abf43ecaf498ee4e950d2c91b0c824488b894e7cab8aaf3667c
- 원본 결과 digest: 224a501ec45720e8bc40b46c8b4bd4c8681be8f75ff24a7706432e6c7cee93a8
- Clunk 점수: 100/90 READY
- 차단 finding: 0
- 최적화 출력: seeder.compact.m1.lod1.clunk-optimized.glb
- 출력 reopen: 확인됨
- Passport output hash: 382302f5e1496154062e54abe1af32d6d460545193d803974fcf57a1a3c97700
Findings
- INFO FORMAT-GLTF2: glTF 2.0 parsed
- INFO SCENE-EMPTY-NODES: Empty nodes found
- INFO SCENE-NONUNIT-SCALE: Non-unit scale transforms found
Operations
- clean-metadata (metadata-only, 109)

### tractor.compact.m1.glb
- 원본 경로: C:\Users\50106\Desktop\Harvest Frontier\public\assets\runtime\tractor.compact.m1.glb
- 원본 SHA-256: d92ae93240cc9b4d477df13cbddd0342738feb57ed9b8551e73d68fd83b3222c
- 원본 결과 digest: 4789a69a70cecbd4f3cc30e70c17293c1776823747095467da9b8c5b4dc008df
- Clunk 점수: 100/90 READY
- 차단 finding: 0
- 최적화 출력: tractor.compact.m1.clunk-optimized.glb
- 출력 reopen: 확인됨
- Passport output hash: 7724e87b373678c40c0481a97b09b1801756273d4059f84bf4abd80759feda1c
Findings
- INFO FORMAT-GLTF2: glTF 2.0 parsed
- INFO GEO-MISSING-NORMALS: Normals are missing
- INFO SCENE-NONUNIT-SCALE: Non-unit scale transforms found
Operations
- clean-metadata (metadata-only, 128)

### tractor.compact.m1.lod1.glb
- 원본 경로: C:\Users\50106\Desktop\Harvest Frontier\public\assets\runtime\tractor.compact.m1.lod1.glb
- 원본 SHA-256: 5b457fc118613961793662111a3e69b75c7200c25f89368d3fb44841a056cf5f
- 원본 결과 digest: 966b295fedd878112acb9d34ea47c52d26bc121c054fd9af60a8aab26a8e01d5
- Clunk 점수: 100/90 READY
- 차단 finding: 0
- 최적화 출력: tractor.compact.m1.lod1.clunk-optimized.glb
- 출력 reopen: 확인됨
- Passport output hash: df4c472efd58706e9df3696046b9447d940891e368ebce0f18ba1d3cd76b2879
Findings
- INFO FORMAT-GLTF2: glTF 2.0 parsed
- INFO GEO-MISSING-NORMALS: Normals are missing
- INFO SCENE-NONUNIT-SCALE: Non-unit scale transforms found
Operations
- clean-metadata (metadata-only, 128)

## Machine-readable payload

아래 JSON은 이 Markdown과 함께 보관되는 실행 원장입니다.

```json
<!-- clunk-pilot-report-json -->
{
  "schemaVersion": 1,
  "runId": "hf-clunk-20260824023146",
  "generatedAt": "2026-08-24T02:31:47.333Z",
  "sourceProject": "Harvest Frontier",
  "sourceCommit": "657eda1d02890686ff4f91dac14a15504b52e081",
  "workspaceRoot": "C:\\Users\\50106\\Desktop\\Harvest Frontier",
  "runtimeRoot": "C:\\Users\\50106\\Desktop\\Harvest Frontier\\public\\assets\\runtime",
  "readOnly": true,
  "optimizerWritesToHarvest": false,
  "profileFile": "C:\\Users\\50106\\Desktop\\Clunk\\examples\\profiles\\harvest-frontier.example.json",
  "ruleSetId": "harvest-frontier-runtime-v1",
  "productionReady": false,
  "optimizationMode": "temporary-copy-and-reopen",
  "collaborationBoundary": [
    "Harvest Frontier public/assets/runtime GLB files were opened as read-only inputs.",
    "All optimizer outputs were written below a temporary directory outside the Harvest Frontier checkout.",
    "The source asset hash is compared with Clunk before inspection, and each output is reopened and re-inspected.",
    "Passport records source/output hashes, inspection digests, operations, metrics, and scores.",
    "productionReady remains false because Clunk does not certify Harvest engine semantics or gameplay."
  ],
  "assets": [
    {
      "name": "cultivator.compact.m1.glb",
      "sourcePath": "C:\\Users\\50106\\Desktop\\Harvest Frontier\\public\\assets\\runtime\\cultivator.compact.m1.glb",
      "sourceHash": "18a720e4e55878eb64cdcd5da39fb02187741d0e1af7ed06ca2a279540519a50",
      "sourceBytes": 189912,
      "before": {
        "schemaVersion": "1.0",
        "coreVersion": "0.1.0",
        "ruleSetId": "harvest-frontier-runtime-v1",
        "ruleSetVersion": "0.1.0",
        "profileId": "pc",
        "fileName": "cultivator.compact.m1.glb",
        "format": "glb",
        "byteLength": 189912,
        "inputHash": "18a720e4e55878eb64cdcd5da39fb02187741d0e1af7ed06ca2a279540519a50",
        "metrics": {
          "sceneCount": 1,
          "nodeCount": 160,
          "maxDepth": 6,
          "emptyNodeCount": 0,
          "meshCount": 42,
          "primitiveCount": 42,
          "vertexCount": 45538,
          "triangleCount": 16196,
          "drawCallCount": 42,
          "materialCount": 20,
          "duplicateMaterialCount": 0,
          "textureCount": 0,
          "imageCount": 0,
          "textureMaxDimension": 0,
          "textureMemoryBytes": 0,
          "animationCount": 0,
          "skinCount": 0,
          "missingNormalPrimitiveCount": 6,
          "missingUvPrimitiveCount": 42,
          "nonUnitScaleNodeCount": 111,
          "zeroScaleNodeCount": 0,
          "externalResourceCount": 0,
          "unresolvedResourceCount": 0,
          "remoteResourceCount": 0,
          "extensionCount": 4,
          "bounds": {
            "min": [
              -32767,
              -32767,
              -32767
            ],
            "max": [
              32767,
              32767,
              32767
            ],
            "dimensions": [
              65534,
              65534,
              65534
            ]
          }
        },
        "findings": [
          {
            "id": "FORMAT-GLTF2:/asset",
            "ruleId": "FORMAT-GLTF2",
            "category": "format",
            "severity": "INFO",
            "path": "/asset",
            "title": "glTF 2.0 parsed",
            "message": "GLB is a supported glTF 2.0 container.",
            "observed": "GLB",
            "threshold": "GLB or GLTF 2.0",
            "autoFixable": false,
            "action": "No action required."
          },
          {
            "id": "GEO-MISSING-NORMALS:/meshes/*/primitives/*/attributes",
            "ruleId": "GEO-MISSING-NORMALS",
            "category": "geometry",
            "severity": "INFO",
            "path": "/meshes/*/primitives/*/attributes",
            "title": "Normals are missing",
            "message": "One or more primitives do not provide NORMAL attributes.",
            "observed": 6,
            "threshold": 0,
            "autoFixable": false,
            "action": "Generate or author normals in the source asset and re-import."
          },
          {
            "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
            "ruleId": "SCENE-NONUNIT-SCALE",
            "category": "scene",
            "severity": "INFO",
            "path": "/nodes/*/scale",
            "title": "Non-unit scale transforms found",
            "message": "The asset contains non-unit node scales that may differ across engines.",
            "observed": 111,
            "threshold": 0,
            "autoFixable": false,
            "action": "Confirm the target engine's transform and import policy."
          }
        ],
        "score": {
          "score": 100,
          "threshold": 90,
          "ready": true,
          "hardBlockerCount": 0,
          "breakdown": {
            "format": 100,
            "scene": 100,
            "geometry": 100,
            "materials": 100,
            "textures": 100,
            "runtime": 100
          },
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0"
        },
        "analysisId": "analysis-18a720e4e558-d8b74ed3",
        "resultDigest": "d8b74ed389f38bd836b9f3b5d257bd7cf266cb5e3e9e23355f7dadee1bcc5c33"
      },
      "blockingFindings": [],
      "optimization": {
        "enabled": true,
        "applied": true,
        "outputFileName": "cultivator.compact.m1.clunk-optimized.glb",
        "outputHash": "4cdf4ced856d181c8c7a687975a35c82810d9dc86bfee7e61f9a969f274b74cd",
        "outputBytes": 181744,
        "outputReopened": true,
        "operations": [
          {
            "id": "clean-metadata",
            "description": "Removed explicitly allowlisted non-runtime metadata: extras, asset.generator, and asset.copyright.",
            "count": 93,
            "safety": "metadata-only"
          }
        ],
        "after": {
          "schemaVersion": "1.0",
          "coreVersion": "0.1.0",
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0",
          "profileId": "pc",
          "fileName": "cultivator.compact.m1.clunk-optimized.glb",
          "format": "glb",
          "byteLength": 181744,
          "inputHash": "4cdf4ced856d181c8c7a687975a35c82810d9dc86bfee7e61f9a969f274b74cd",
          "metrics": {
            "sceneCount": 1,
            "nodeCount": 160,
            "maxDepth": 6,
            "emptyNodeCount": 0,
            "meshCount": 42,
            "primitiveCount": 42,
            "vertexCount": 45538,
            "triangleCount": 16196,
            "drawCallCount": 42,
            "materialCount": 20,
            "duplicateMaterialCount": 0,
            "textureCount": 0,
            "imageCount": 0,
            "textureMaxDimension": 0,
            "textureMemoryBytes": 0,
            "animationCount": 0,
            "skinCount": 0,
            "missingNormalPrimitiveCount": 6,
            "missingUvPrimitiveCount": 42,
            "nonUnitScaleNodeCount": 111,
            "zeroScaleNodeCount": 0,
            "externalResourceCount": 0,
            "unresolvedResourceCount": 0,
            "remoteResourceCount": 0,
            "extensionCount": 4,
            "bounds": {
              "min": [
                -32767,
                -32767,
                -32767
              ],
              "max": [
                32767,
                32767,
                32767
              ],
              "dimensions": [
                65534,
                65534,
                65534
              ]
            }
          },
          "findings": [
            {
              "id": "FORMAT-GLTF2:/asset",
              "ruleId": "FORMAT-GLTF2",
              "category": "format",
              "severity": "INFO",
              "path": "/asset",
              "title": "glTF 2.0 parsed",
              "message": "GLB is a supported glTF 2.0 container.",
              "observed": "GLB",
              "threshold": "GLB or GLTF 2.0",
              "autoFixable": false,
              "action": "No action required."
            },
            {
              "id": "GEO-MISSING-NORMALS:/meshes/*/primitives/*/attributes",
              "ruleId": "GEO-MISSING-NORMALS",
              "category": "geometry",
              "severity": "INFO",
              "path": "/meshes/*/primitives/*/attributes",
              "title": "Normals are missing",
              "message": "One or more primitives do not provide NORMAL attributes.",
              "observed": 6,
              "threshold": 0,
              "autoFixable": false,
              "action": "Generate or author normals in the source asset and re-import."
            },
            {
              "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
              "ruleId": "SCENE-NONUNIT-SCALE",
              "category": "scene",
              "severity": "INFO",
              "path": "/nodes/*/scale",
              "title": "Non-unit scale transforms found",
              "message": "The asset contains non-unit node scales that may differ across engines.",
              "observed": 111,
              "threshold": 0,
              "autoFixable": false,
              "action": "Confirm the target engine's transform and import policy."
            }
          ],
          "score": {
            "score": 100,
            "threshold": 90,
            "ready": true,
            "hardBlockerCount": 0,
            "breakdown": {
              "format": 100,
              "scene": 100,
              "geometry": 100,
              "materials": 100,
              "textures": 100,
              "runtime": 100
            },
            "ruleSetId": "harvest-frontier-runtime-v1",
            "ruleSetVersion": "0.1.0"
          },
          "analysisId": "analysis-4cdf4ced856d-fdf11ed3",
          "resultDigest": "fdf11ed36c8510146c22aa8078aa56c87910ee950f8c6f92ae3c8b27efcaa4f9"
        },
        "passport": {
          "schemaVersion": "1.0",
          "passportId": "passport-18a720e4e558-4cdf4ced856d",
          "coreVersion": "0.1.0",
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0",
          "profileId": "pc",
          "sourceHash": "18a720e4e55878eb64cdcd5da39fb02187741d0e1af7ed06ca2a279540519a50",
          "outputHash": "4cdf4ced856d181c8c7a687975a35c82810d9dc86bfee7e61f9a969f274b74cd",
          "sourceFileName": "cultivator.compact.m1.glb",
          "outputFileName": "cultivator.compact.m1.clunk-optimized.glb",
          "sourceInspectionDigest": "d8b74ed389f38bd836b9f3b5d257bd7cf266cb5e3e9e23355f7dadee1bcc5c33",
          "outputInspectionDigest": "fdf11ed36c8510146c22aa8078aa56c87910ee950f8c6f92ae3c8b27efcaa4f9",
          "operations": [
            {
              "id": "clean-metadata",
              "description": "Removed explicitly allowlisted non-runtime metadata: extras, asset.generator, and asset.copyright.",
              "count": 93,
              "safety": "metadata-only"
            }
          ],
          "before": {
            "metrics": {
              "sceneCount": 1,
              "nodeCount": 160,
              "maxDepth": 6,
              "emptyNodeCount": 0,
              "meshCount": 42,
              "primitiveCount": 42,
              "vertexCount": 45538,
              "triangleCount": 16196,
              "drawCallCount": 42,
              "materialCount": 20,
              "duplicateMaterialCount": 0,
              "textureCount": 0,
              "imageCount": 0,
              "textureMaxDimension": 0,
              "textureMemoryBytes": 0,
              "animationCount": 0,
              "skinCount": 0,
              "missingNormalPrimitiveCount": 6,
              "missingUvPrimitiveCount": 42,
              "nonUnitScaleNodeCount": 111,
              "zeroScaleNodeCount": 0,
              "externalResourceCount": 0,
              "unresolvedResourceCount": 0,
              "remoteResourceCount": 0,
              "extensionCount": 4,
              "bounds": {
                "min": [
                  -32767,
                  -32767,
                  -32767
                ],
                "max": [
                  32767,
                  32767,
                  32767
                ],
                "dimensions": [
                  65534,
                  65534,
                  65534
                ]
              }
            },
            "score": {
              "score": 100,
              "threshold": 90,
              "ready": true,
              "hardBlockerCount": 0,
              "breakdown": {
                "format": 100,
                "scene": 100,
                "geometry": 100,
                "materials": 100,
                "textures": 100,
                "runtime": 100
              },
              "ruleSetId": "harvest-frontier-runtime-v1",
              "ruleSetVersion": "0.1.0"
            }
          },
          "after": {
            "metrics": {
              "sceneCount": 1,
              "nodeCount": 160,
              "maxDepth": 6,
              "emptyNodeCount": 0,
              "meshCount": 42,
              "primitiveCount": 42,
              "vertexCount": 45538,
              "triangleCount": 16196,
              "drawCallCount": 42,
              "materialCount": 20,
              "duplicateMaterialCount": 0,
              "textureCount": 0,
              "imageCount": 0,
              "textureMaxDimension": 0,
              "textureMemoryBytes": 0,
              "animationCount": 0,
              "skinCount": 0,
              "missingNormalPrimitiveCount": 6,
              "missingUvPrimitiveCount": 42,
              "nonUnitScaleNodeCount": 111,
              "zeroScaleNodeCount": 0,
              "externalResourceCount": 0,
              "unresolvedResourceCount": 0,
              "remoteResourceCount": 0,
              "extensionCount": 4,
              "bounds": {
                "min": [
                  -32767,
                  -32767,
                  -32767
                ],
                "max": [
                  32767,
                  32767,
                  32767
                ],
                "dimensions": [
                  65534,
                  65534,
                  65534
                ]
              }
            },
            "score": {
              "score": 100,
              "threshold": 90,
              "ready": true,
              "hardBlockerCount": 0,
              "breakdown": {
                "format": 100,
                "scene": 100,
                "geometry": 100,
                "materials": 100,
                "textures": 100,
                "runtime": 100
              },
              "ruleSetId": "harvest-frontier-runtime-v1",
              "ruleSetVersion": "0.1.0"
            }
          },
          "limitations": [
            "Lossy geometry, texture, animation, skin, and unknown-extension transforms are not applied in v1.",
            "Game-Ready Score is Clunk's declared policy score, not a universal engine certification."
          ]
        },
        "error": null
      }
    },
    {
      "name": "cultivator.compact.m1.lod1.glb",
      "sourcePath": "C:\\Users\\50106\\Desktop\\Harvest Frontier\\public\\assets\\runtime\\cultivator.compact.m1.lod1.glb",
      "sourceHash": "464106711b59289dc0fd432b323fae691aec66deefff68e7f67c37306a098c3a",
      "sourceBytes": 104760,
      "before": {
        "schemaVersion": "1.0",
        "coreVersion": "0.1.0",
        "ruleSetId": "harvest-frontier-runtime-v1",
        "ruleSetVersion": "0.1.0",
        "profileId": "pc",
        "fileName": "cultivator.compact.m1.lod1.glb",
        "format": "glb",
        "byteLength": 104760,
        "inputHash": "464106711b59289dc0fd432b323fae691aec66deefff68e7f67c37306a098c3a",
        "metrics": {
          "sceneCount": 1,
          "nodeCount": 160,
          "maxDepth": 6,
          "emptyNodeCount": 0,
          "meshCount": 33,
          "primitiveCount": 33,
          "vertexCount": 5312,
          "triangleCount": 7824,
          "drawCallCount": 33,
          "materialCount": 20,
          "duplicateMaterialCount": 0,
          "textureCount": 0,
          "imageCount": 0,
          "textureMaxDimension": 0,
          "textureMemoryBytes": 0,
          "animationCount": 0,
          "skinCount": 0,
          "missingNormalPrimitiveCount": 6,
          "missingUvPrimitiveCount": 33,
          "nonUnitScaleNodeCount": 111,
          "zeroScaleNodeCount": 0,
          "externalResourceCount": 0,
          "unresolvedResourceCount": 0,
          "remoteResourceCount": 0,
          "extensionCount": 4,
          "bounds": {
            "min": [
              -32767,
              -32767,
              -32767
            ],
            "max": [
              32767,
              32767,
              32767
            ],
            "dimensions": [
              65534,
              65534,
              65534
            ]
          }
        },
        "findings": [
          {
            "id": "FORMAT-GLTF2:/asset",
            "ruleId": "FORMAT-GLTF2",
            "category": "format",
            "severity": "INFO",
            "path": "/asset",
            "title": "glTF 2.0 parsed",
            "message": "GLB is a supported glTF 2.0 container.",
            "observed": "GLB",
            "threshold": "GLB or GLTF 2.0",
            "autoFixable": false,
            "action": "No action required."
          },
          {
            "id": "GEO-MISSING-NORMALS:/meshes/*/primitives/*/attributes",
            "ruleId": "GEO-MISSING-NORMALS",
            "category": "geometry",
            "severity": "INFO",
            "path": "/meshes/*/primitives/*/attributes",
            "title": "Normals are missing",
            "message": "One or more primitives do not provide NORMAL attributes.",
            "observed": 6,
            "threshold": 0,
            "autoFixable": false,
            "action": "Generate or author normals in the source asset and re-import."
          },
          {
            "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
            "ruleId": "SCENE-NONUNIT-SCALE",
            "category": "scene",
            "severity": "INFO",
            "path": "/nodes/*/scale",
            "title": "Non-unit scale transforms found",
            "message": "The asset contains non-unit node scales that may differ across engines.",
            "observed": 111,
            "threshold": 0,
            "autoFixable": false,
            "action": "Confirm the target engine's transform and import policy."
          }
        ],
        "score": {
          "score": 100,
          "threshold": 90,
          "ready": true,
          "hardBlockerCount": 0,
          "breakdown": {
            "format": 100,
            "scene": 100,
            "geometry": 100,
            "materials": 100,
            "textures": 100,
            "runtime": 100
          },
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0"
        },
        "analysisId": "analysis-464106711b59-b487996a",
        "resultDigest": "b487996a093ae594578bf763ad7ce5bce67a77eeb5fdeb1207fb02d7c37ee06e"
      },
      "blockingFindings": [],
      "optimization": {
        "enabled": true,
        "applied": true,
        "outputFileName": "cultivator.compact.m1.lod1.clunk-optimized.glb",
        "outputHash": "3fff470c2248298072f01dcfc69a2df4b10e9ac32844f2fd4ae81e18a07705f8",
        "outputBytes": 96592,
        "outputReopened": true,
        "operations": [
          {
            "id": "clean-metadata",
            "description": "Removed explicitly allowlisted non-runtime metadata: extras, asset.generator, and asset.copyright.",
            "count": 93,
            "safety": "metadata-only"
          }
        ],
        "after": {
          "schemaVersion": "1.0",
          "coreVersion": "0.1.0",
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0",
          "profileId": "pc",
          "fileName": "cultivator.compact.m1.lod1.clunk-optimized.glb",
          "format": "glb",
          "byteLength": 96592,
          "inputHash": "3fff470c2248298072f01dcfc69a2df4b10e9ac32844f2fd4ae81e18a07705f8",
          "metrics": {
            "sceneCount": 1,
            "nodeCount": 160,
            "maxDepth": 6,
            "emptyNodeCount": 0,
            "meshCount": 33,
            "primitiveCount": 33,
            "vertexCount": 5312,
            "triangleCount": 7824,
            "drawCallCount": 33,
            "materialCount": 20,
            "duplicateMaterialCount": 0,
            "textureCount": 0,
            "imageCount": 0,
            "textureMaxDimension": 0,
            "textureMemoryBytes": 0,
            "animationCount": 0,
            "skinCount": 0,
            "missingNormalPrimitiveCount": 6,
            "missingUvPrimitiveCount": 33,
            "nonUnitScaleNodeCount": 111,
            "zeroScaleNodeCount": 0,
            "externalResourceCount": 0,
            "unresolvedResourceCount": 0,
            "remoteResourceCount": 0,
            "extensionCount": 4,
            "bounds": {
              "min": [
                -32767,
                -32767,
                -32767
              ],
              "max": [
                32767,
                32767,
                32767
              ],
              "dimensions": [
                65534,
                65534,
                65534
              ]
            }
          },
          "findings": [
            {
              "id": "FORMAT-GLTF2:/asset",
              "ruleId": "FORMAT-GLTF2",
              "category": "format",
              "severity": "INFO",
              "path": "/asset",
              "title": "glTF 2.0 parsed",
              "message": "GLB is a supported glTF 2.0 container.",
              "observed": "GLB",
              "threshold": "GLB or GLTF 2.0",
              "autoFixable": false,
              "action": "No action required."
            },
            {
              "id": "GEO-MISSING-NORMALS:/meshes/*/primitives/*/attributes",
              "ruleId": "GEO-MISSING-NORMALS",
              "category": "geometry",
              "severity": "INFO",
              "path": "/meshes/*/primitives/*/attributes",
              "title": "Normals are missing",
              "message": "One or more primitives do not provide NORMAL attributes.",
              "observed": 6,
              "threshold": 0,
              "autoFixable": false,
              "action": "Generate or author normals in the source asset and re-import."
            },
            {
              "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
              "ruleId": "SCENE-NONUNIT-SCALE",
              "category": "scene",
              "severity": "INFO",
              "path": "/nodes/*/scale",
              "title": "Non-unit scale transforms found",
              "message": "The asset contains non-unit node scales that may differ across engines.",
              "observed": 111,
              "threshold": 0,
              "autoFixable": false,
              "action": "Confirm the target engine's transform and import policy."
            }
          ],
          "score": {
            "score": 100,
            "threshold": 90,
            "ready": true,
            "hardBlockerCount": 0,
            "breakdown": {
              "format": 100,
              "scene": 100,
              "geometry": 100,
              "materials": 100,
              "textures": 100,
              "runtime": 100
            },
            "ruleSetId": "harvest-frontier-runtime-v1",
            "ruleSetVersion": "0.1.0"
          },
          "analysisId": "analysis-3fff470c2248-5a4cc000",
          "resultDigest": "5a4cc000d1574f9fb93c7274f80328b55caf3397ca0ea0e449d9ebd64666b712"
        },
        "passport": {
          "schemaVersion": "1.0",
          "passportId": "passport-464106711b59-3fff470c2248",
          "coreVersion": "0.1.0",
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0",
          "profileId": "pc",
          "sourceHash": "464106711b59289dc0fd432b323fae691aec66deefff68e7f67c37306a098c3a",
          "outputHash": "3fff470c2248298072f01dcfc69a2df4b10e9ac32844f2fd4ae81e18a07705f8",
          "sourceFileName": "cultivator.compact.m1.lod1.glb",
          "outputFileName": "cultivator.compact.m1.lod1.clunk-optimized.glb",
          "sourceInspectionDigest": "b487996a093ae594578bf763ad7ce5bce67a77eeb5fdeb1207fb02d7c37ee06e",
          "outputInspectionDigest": "5a4cc000d1574f9fb93c7274f80328b55caf3397ca0ea0e449d9ebd64666b712",
          "operations": [
            {
              "id": "clean-metadata",
              "description": "Removed explicitly allowlisted non-runtime metadata: extras, asset.generator, and asset.copyright.",
              "count": 93,
              "safety": "metadata-only"
            }
          ],
          "before": {
            "metrics": {
              "sceneCount": 1,
              "nodeCount": 160,
              "maxDepth": 6,
              "emptyNodeCount": 0,
              "meshCount": 33,
              "primitiveCount": 33,
              "vertexCount": 5312,
              "triangleCount": 7824,
              "drawCallCount": 33,
              "materialCount": 20,
              "duplicateMaterialCount": 0,
              "textureCount": 0,
              "imageCount": 0,
              "textureMaxDimension": 0,
              "textureMemoryBytes": 0,
              "animationCount": 0,
              "skinCount": 0,
              "missingNormalPrimitiveCount": 6,
              "missingUvPrimitiveCount": 33,
              "nonUnitScaleNodeCount": 111,
              "zeroScaleNodeCount": 0,
              "externalResourceCount": 0,
              "unresolvedResourceCount": 0,
              "remoteResourceCount": 0,
              "extensionCount": 4,
              "bounds": {
                "min": [
                  -32767,
                  -32767,
                  -32767
                ],
                "max": [
                  32767,
                  32767,
                  32767
                ],
                "dimensions": [
                  65534,
                  65534,
                  65534
                ]
              }
            },
            "score": {
              "score": 100,
              "threshold": 90,
              "ready": true,
              "hardBlockerCount": 0,
              "breakdown": {
                "format": 100,
                "scene": 100,
                "geometry": 100,
                "materials": 100,
                "textures": 100,
                "runtime": 100
              },
              "ruleSetId": "harvest-frontier-runtime-v1",
              "ruleSetVersion": "0.1.0"
            }
          },
          "after": {
            "metrics": {
              "sceneCount": 1,
              "nodeCount": 160,
              "maxDepth": 6,
              "emptyNodeCount": 0,
              "meshCount": 33,
              "primitiveCount": 33,
              "vertexCount": 5312,
              "triangleCount": 7824,
              "drawCallCount": 33,
              "materialCount": 20,
              "duplicateMaterialCount": 0,
              "textureCount": 0,
              "imageCount": 0,
              "textureMaxDimension": 0,
              "textureMemoryBytes": 0,
              "animationCount": 0,
              "skinCount": 0,
              "missingNormalPrimitiveCount": 6,
              "missingUvPrimitiveCount": 33,
              "nonUnitScaleNodeCount": 111,
              "zeroScaleNodeCount": 0,
              "externalResourceCount": 0,
              "unresolvedResourceCount": 0,
              "remoteResourceCount": 0,
              "extensionCount": 4,
              "bounds": {
                "min": [
                  -32767,
                  -32767,
                  -32767
                ],
                "max": [
                  32767,
                  32767,
                  32767
                ],
                "dimensions": [
                  65534,
                  65534,
                  65534
                ]
              }
            },
            "score": {
              "score": 100,
              "threshold": 90,
              "ready": true,
              "hardBlockerCount": 0,
              "breakdown": {
                "format": 100,
                "scene": 100,
                "geometry": 100,
                "materials": 100,
                "textures": 100,
                "runtime": 100
              },
              "ruleSetId": "harvest-frontier-runtime-v1",
              "ruleSetVersion": "0.1.0"
            }
          },
          "limitations": [
            "Lossy geometry, texture, animation, skin, and unknown-extension transforms are not applied in v1.",
            "Game-Ready Score is Clunk's declared policy score, not a universal engine certification."
          ]
        },
        "error": null
      }
    },
    {
      "name": "processing.line.m1.glb",
      "sourcePath": "C:\\Users\\50106\\Desktop\\Harvest Frontier\\public\\assets\\runtime\\processing.line.m1.glb",
      "sourceHash": "dc2de953592988384f2cd0fed87350b8f6d4226003567ab837fc06a09f305fed",
      "sourceBytes": 435532,
      "before": {
        "schemaVersion": "1.0",
        "coreVersion": "0.1.0",
        "ruleSetId": "harvest-frontier-runtime-v1",
        "ruleSetVersion": "0.1.0",
        "profileId": "pc",
        "fileName": "processing.line.m1.glb",
        "format": "glb",
        "byteLength": 435532,
        "inputHash": "dc2de953592988384f2cd0fed87350b8f6d4226003567ab837fc06a09f305fed",
        "metrics": {
          "sceneCount": 1,
          "nodeCount": 177,
          "maxDepth": 4,
          "emptyNodeCount": 4,
          "meshCount": 78,
          "primitiveCount": 78,
          "vertexCount": 17268,
          "triangleCount": 24936,
          "drawCallCount": 78,
          "materialCount": 40,
          "duplicateMaterialCount": 0,
          "textureCount": 0,
          "imageCount": 0,
          "textureMaxDimension": 0,
          "textureMemoryBytes": 0,
          "animationCount": 0,
          "skinCount": 0,
          "missingNormalPrimitiveCount": 0,
          "missingUvPrimitiveCount": 0,
          "nonUnitScaleNodeCount": 146,
          "zeroScaleNodeCount": 0,
          "externalResourceCount": 0,
          "unresolvedResourceCount": 0,
          "remoteResourceCount": 0,
          "extensionCount": 6,
          "bounds": {
            "min": [
              -32767,
              -32767,
              -32767
            ],
            "max": [
              32767,
              32767,
              32767
            ],
            "dimensions": [
              65534,
              65534,
              65534
            ]
          }
        },
        "findings": [
          {
            "id": "FORMAT-GLTF2:/asset",
            "ruleId": "FORMAT-GLTF2",
            "category": "format",
            "severity": "INFO",
            "path": "/asset",
            "title": "glTF 2.0 parsed",
            "message": "GLB is a supported glTF 2.0 container.",
            "observed": "GLB",
            "threshold": "GLB or GLTF 2.0",
            "autoFixable": false,
            "action": "No action required."
          },
          {
            "id": "SCENE-EMPTY-NODES:/nodes",
            "ruleId": "SCENE-EMPTY-NODES",
            "category": "scene",
            "severity": "INFO",
            "path": "/nodes",
            "title": "Empty nodes found",
            "message": "Identity-only nodes without a mesh, camera, skin, or child are present.",
            "observed": 4,
            "threshold": 0,
            "autoFixable": true,
            "action": "Run the allowlisted empty-node cleanup and recheck the output."
          },
          {
            "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
            "ruleId": "SCENE-NONUNIT-SCALE",
            "category": "scene",
            "severity": "INFO",
            "path": "/nodes/*/scale",
            "title": "Non-unit scale transforms found",
            "message": "The asset contains non-unit node scales that may differ across engines.",
            "observed": 146,
            "threshold": 0,
            "autoFixable": false,
            "action": "Confirm the target engine's transform and import policy."
          }
        ],
        "score": {
          "score": 100,
          "threshold": 90,
          "ready": true,
          "hardBlockerCount": 0,
          "breakdown": {
            "format": 100,
            "scene": 100,
            "geometry": 100,
            "materials": 100,
            "textures": 100,
            "runtime": 100
          },
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0"
        },
        "analysisId": "analysis-dc2de9535929-1b8c152d",
        "resultDigest": "1b8c152d8010eddd8c098810f036daf4909597b2028bf4f52a0ab177995dc118"
      },
      "blockingFindings": [],
      "optimization": {
        "enabled": true,
        "applied": true,
        "outputFileName": "processing.line.m1.clunk-optimized.glb",
        "outputHash": "bf0581d5108a0ce180a8b7d0e9d54ab66f05a1f67442d7e5812662164bca90cb",
        "outputBytes": 432024,
        "outputReopened": true,
        "operations": [
          {
            "id": "clean-metadata",
            "description": "Removed explicitly allowlisted non-runtime metadata: extras, asset.generator, and asset.copyright.",
            "count": 82,
            "safety": "metadata-only"
          }
        ],
        "after": {
          "schemaVersion": "1.0",
          "coreVersion": "0.1.0",
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0",
          "profileId": "pc",
          "fileName": "processing.line.m1.clunk-optimized.glb",
          "format": "glb",
          "byteLength": 432024,
          "inputHash": "bf0581d5108a0ce180a8b7d0e9d54ab66f05a1f67442d7e5812662164bca90cb",
          "metrics": {
            "sceneCount": 1,
            "nodeCount": 177,
            "maxDepth": 4,
            "emptyNodeCount": 4,
            "meshCount": 78,
            "primitiveCount": 78,
            "vertexCount": 17268,
            "triangleCount": 24936,
            "drawCallCount": 78,
            "materialCount": 40,
            "duplicateMaterialCount": 0,
            "textureCount": 0,
            "imageCount": 0,
            "textureMaxDimension": 0,
            "textureMemoryBytes": 0,
            "animationCount": 0,
            "skinCount": 0,
            "missingNormalPrimitiveCount": 0,
            "missingUvPrimitiveCount": 0,
            "nonUnitScaleNodeCount": 146,
            "zeroScaleNodeCount": 0,
            "externalResourceCount": 0,
            "unresolvedResourceCount": 0,
            "remoteResourceCount": 0,
            "extensionCount": 6,
            "bounds": {
              "min": [
                -32767,
                -32767,
                -32767
              ],
              "max": [
                32767,
                32767,
                32767
              ],
              "dimensions": [
                65534,
                65534,
                65534
              ]
            }
          },
          "findings": [
            {
              "id": "FORMAT-GLTF2:/asset",
              "ruleId": "FORMAT-GLTF2",
              "category": "format",
              "severity": "INFO",
              "path": "/asset",
              "title": "glTF 2.0 parsed",
              "message": "GLB is a supported glTF 2.0 container.",
              "observed": "GLB",
              "threshold": "GLB or GLTF 2.0",
              "autoFixable": false,
              "action": "No action required."
            },
            {
              "id": "SCENE-EMPTY-NODES:/nodes",
              "ruleId": "SCENE-EMPTY-NODES",
              "category": "scene",
              "severity": "INFO",
              "path": "/nodes",
              "title": "Empty nodes found",
              "message": "Identity-only nodes without a mesh, camera, skin, or child are present.",
              "observed": 4,
              "threshold": 0,
              "autoFixable": true,
              "action": "Run the allowlisted empty-node cleanup and recheck the output."
            },
            {
              "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
              "ruleId": "SCENE-NONUNIT-SCALE",
              "category": "scene",
              "severity": "INFO",
              "path": "/nodes/*/scale",
              "title": "Non-unit scale transforms found",
              "message": "The asset contains non-unit node scales that may differ across engines.",
              "observed": 146,
              "threshold": 0,
              "autoFixable": false,
              "action": "Confirm the target engine's transform and import policy."
            }
          ],
          "score": {
            "score": 100,
            "threshold": 90,
            "ready": true,
            "hardBlockerCount": 0,
            "breakdown": {
              "format": 100,
              "scene": 100,
              "geometry": 100,
              "materials": 100,
              "textures": 100,
              "runtime": 100
            },
            "ruleSetId": "harvest-frontier-runtime-v1",
            "ruleSetVersion": "0.1.0"
          },
          "analysisId": "analysis-bf0581d5108a-ad631c72",
          "resultDigest": "ad631c7232b23bdc9b6ba66f2ec74111b889cbafda23a134d6852ace29853922"
        },
        "passport": {
          "schemaVersion": "1.0",
          "passportId": "passport-dc2de9535929-bf0581d5108a",
          "coreVersion": "0.1.0",
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0",
          "profileId": "pc",
          "sourceHash": "dc2de953592988384f2cd0fed87350b8f6d4226003567ab837fc06a09f305fed",
          "outputHash": "bf0581d5108a0ce180a8b7d0e9d54ab66f05a1f67442d7e5812662164bca90cb",
          "sourceFileName": "processing.line.m1.glb",
          "outputFileName": "processing.line.m1.clunk-optimized.glb",
          "sourceInspectionDigest": "1b8c152d8010eddd8c098810f036daf4909597b2028bf4f52a0ab177995dc118",
          "outputInspectionDigest": "ad631c7232b23bdc9b6ba66f2ec74111b889cbafda23a134d6852ace29853922",
          "operations": [
            {
              "id": "clean-metadata",
              "description": "Removed explicitly allowlisted non-runtime metadata: extras, asset.generator, and asset.copyright.",
              "count": 82,
              "safety": "metadata-only"
            }
          ],
          "before": {
            "metrics": {
              "sceneCount": 1,
              "nodeCount": 177,
              "maxDepth": 4,
              "emptyNodeCount": 4,
              "meshCount": 78,
              "primitiveCount": 78,
              "vertexCount": 17268,
              "triangleCount": 24936,
              "drawCallCount": 78,
              "materialCount": 40,
              "duplicateMaterialCount": 0,
              "textureCount": 0,
              "imageCount": 0,
              "textureMaxDimension": 0,
              "textureMemoryBytes": 0,
              "animationCount": 0,
              "skinCount": 0,
              "missingNormalPrimitiveCount": 0,
              "missingUvPrimitiveCount": 0,
              "nonUnitScaleNodeCount": 146,
              "zeroScaleNodeCount": 0,
              "externalResourceCount": 0,
              "unresolvedResourceCount": 0,
              "remoteResourceCount": 0,
              "extensionCount": 6,
              "bounds": {
                "min": [
                  -32767,
                  -32767,
                  -32767
                ],
                "max": [
                  32767,
                  32767,
                  32767
                ],
                "dimensions": [
                  65534,
                  65534,
                  65534
                ]
              }
            },
            "score": {
              "score": 100,
              "threshold": 90,
              "ready": true,
              "hardBlockerCount": 0,
              "breakdown": {
                "format": 100,
                "scene": 100,
                "geometry": 100,
                "materials": 100,
                "textures": 100,
                "runtime": 100
              },
              "ruleSetId": "harvest-frontier-runtime-v1",
              "ruleSetVersion": "0.1.0"
            }
          },
          "after": {
            "metrics": {
              "sceneCount": 1,
              "nodeCount": 177,
              "maxDepth": 4,
              "emptyNodeCount": 4,
              "meshCount": 78,
              "primitiveCount": 78,
              "vertexCount": 17268,
              "triangleCount": 24936,
              "drawCallCount": 78,
              "materialCount": 40,
              "duplicateMaterialCount": 0,
              "textureCount": 0,
              "imageCount": 0,
              "textureMaxDimension": 0,
              "textureMemoryBytes": 0,
              "animationCount": 0,
              "skinCount": 0,
              "missingNormalPrimitiveCount": 0,
              "missingUvPrimitiveCount": 0,
              "nonUnitScaleNodeCount": 146,
              "zeroScaleNodeCount": 0,
              "externalResourceCount": 0,
              "unresolvedResourceCount": 0,
              "remoteResourceCount": 0,
              "extensionCount": 6,
              "bounds": {
                "min": [
                  -32767,
                  -32767,
                  -32767
                ],
                "max": [
                  32767,
                  32767,
                  32767
                ],
                "dimensions": [
                  65534,
                  65534,
                  65534
                ]
              }
            },
            "score": {
              "score": 100,
              "threshold": 90,
              "ready": true,
              "hardBlockerCount": 0,
              "breakdown": {
                "format": 100,
                "scene": 100,
                "geometry": 100,
                "materials": 100,
                "textures": 100,
                "runtime": 100
              },
              "ruleSetId": "harvest-frontier-runtime-v1",
              "ruleSetVersion": "0.1.0"
            }
          },
          "limitations": [
            "Lossy geometry, texture, animation, skin, and unknown-extension transforms are not applied in v1.",
            "Game-Ready Score is Clunk's declared policy score, not a universal engine certification."
          ]
        },
        "error": null
      }
    },
    {
      "name": "processing.line.m1.lod1.glb",
      "sourcePath": "C:\\Users\\50106\\Desktop\\Harvest Frontier\\public\\assets\\runtime\\processing.line.m1.lod1.glb",
      "sourceHash": "2605f6fa3f477b569566b4db9b371c5c87554221c61a5edbf10317e3f3e2ba49",
      "sourceBytes": 199700,
      "before": {
        "schemaVersion": "1.0",
        "coreVersion": "0.1.0",
        "ruleSetId": "harvest-frontier-runtime-v1",
        "ruleSetVersion": "0.1.0",
        "profileId": "pc",
        "fileName": "processing.line.m1.lod1.glb",
        "format": "glb",
        "byteLength": 199700,
        "inputHash": "2605f6fa3f477b569566b4db9b371c5c87554221c61a5edbf10317e3f3e2ba49",
        "metrics": {
          "sceneCount": 1,
          "nodeCount": 136,
          "maxDepth": 4,
          "emptyNodeCount": 5,
          "meshCount": 63,
          "primitiveCount": 63,
          "vertexCount": 9737,
          "triangleCount": 14906,
          "drawCallCount": 63,
          "materialCount": 31,
          "duplicateMaterialCount": 0,
          "textureCount": 0,
          "imageCount": 0,
          "textureMaxDimension": 0,
          "textureMemoryBytes": 0,
          "animationCount": 0,
          "skinCount": 0,
          "missingNormalPrimitiveCount": 0,
          "missingUvPrimitiveCount": 63,
          "nonUnitScaleNodeCount": 105,
          "zeroScaleNodeCount": 0,
          "externalResourceCount": 0,
          "unresolvedResourceCount": 0,
          "remoteResourceCount": 0,
          "extensionCount": 6,
          "bounds": {
            "min": [
              -32767,
              -32767,
              -32767
            ],
            "max": [
              32767,
              32767,
              32767
            ],
            "dimensions": [
              65534,
              65534,
              65534
            ]
          }
        },
        "findings": [
          {
            "id": "FORMAT-GLTF2:/asset",
            "ruleId": "FORMAT-GLTF2",
            "category": "format",
            "severity": "INFO",
            "path": "/asset",
            "title": "glTF 2.0 parsed",
            "message": "GLB is a supported glTF 2.0 container.",
            "observed": "GLB",
            "threshold": "GLB or GLTF 2.0",
            "autoFixable": false,
            "action": "No action required."
          },
          {
            "id": "SCENE-EMPTY-NODES:/nodes",
            "ruleId": "SCENE-EMPTY-NODES",
            "category": "scene",
            "severity": "INFO",
            "path": "/nodes",
            "title": "Empty nodes found",
            "message": "Identity-only nodes without a mesh, camera, skin, or child are present.",
            "observed": 5,
            "threshold": 0,
            "autoFixable": true,
            "action": "Run the allowlisted empty-node cleanup and recheck the output."
          },
          {
            "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
            "ruleId": "SCENE-NONUNIT-SCALE",
            "category": "scene",
            "severity": "INFO",
            "path": "/nodes/*/scale",
            "title": "Non-unit scale transforms found",
            "message": "The asset contains non-unit node scales that may differ across engines.",
            "observed": 105,
            "threshold": 0,
            "autoFixable": false,
            "action": "Confirm the target engine's transform and import policy."
          }
        ],
        "score": {
          "score": 100,
          "threshold": 90,
          "ready": true,
          "hardBlockerCount": 0,
          "breakdown": {
            "format": 100,
            "scene": 100,
            "geometry": 100,
            "materials": 100,
            "textures": 100,
            "runtime": 100
          },
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0"
        },
        "analysisId": "analysis-2605f6fa3f47-432f6dcb",
        "resultDigest": "432f6dcb02446e8b4d3f0d0380c213c8558efed999e0cd7e37e7ecd125f31cb3"
      },
      "blockingFindings": [],
      "optimization": {
        "enabled": true,
        "applied": true,
        "outputFileName": "processing.line.m1.lod1.clunk-optimized.glb",
        "outputHash": "fab38a1b2978faf113d7c40bed9a42bc1e78d82e9520ba443278bcfff448078c",
        "outputBytes": 197168,
        "outputReopened": true,
        "operations": [
          {
            "id": "clean-metadata",
            "description": "Removed explicitly allowlisted non-runtime metadata: extras, asset.generator, and asset.copyright.",
            "count": 55,
            "safety": "metadata-only"
          }
        ],
        "after": {
          "schemaVersion": "1.0",
          "coreVersion": "0.1.0",
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0",
          "profileId": "pc",
          "fileName": "processing.line.m1.lod1.clunk-optimized.glb",
          "format": "glb",
          "byteLength": 197168,
          "inputHash": "fab38a1b2978faf113d7c40bed9a42bc1e78d82e9520ba443278bcfff448078c",
          "metrics": {
            "sceneCount": 1,
            "nodeCount": 136,
            "maxDepth": 4,
            "emptyNodeCount": 5,
            "meshCount": 63,
            "primitiveCount": 63,
            "vertexCount": 9737,
            "triangleCount": 14906,
            "drawCallCount": 63,
            "materialCount": 31,
            "duplicateMaterialCount": 0,
            "textureCount": 0,
            "imageCount": 0,
            "textureMaxDimension": 0,
            "textureMemoryBytes": 0,
            "animationCount": 0,
            "skinCount": 0,
            "missingNormalPrimitiveCount": 0,
            "missingUvPrimitiveCount": 63,
            "nonUnitScaleNodeCount": 105,
            "zeroScaleNodeCount": 0,
            "externalResourceCount": 0,
            "unresolvedResourceCount": 0,
            "remoteResourceCount": 0,
            "extensionCount": 6,
            "bounds": {
              "min": [
                -32767,
                -32767,
                -32767
              ],
              "max": [
                32767,
                32767,
                32767
              ],
              "dimensions": [
                65534,
                65534,
                65534
              ]
            }
          },
          "findings": [
            {
              "id": "FORMAT-GLTF2:/asset",
              "ruleId": "FORMAT-GLTF2",
              "category": "format",
              "severity": "INFO",
              "path": "/asset",
              "title": "glTF 2.0 parsed",
              "message": "GLB is a supported glTF 2.0 container.",
              "observed": "GLB",
              "threshold": "GLB or GLTF 2.0",
              "autoFixable": false,
              "action": "No action required."
            },
            {
              "id": "SCENE-EMPTY-NODES:/nodes",
              "ruleId": "SCENE-EMPTY-NODES",
              "category": "scene",
              "severity": "INFO",
              "path": "/nodes",
              "title": "Empty nodes found",
              "message": "Identity-only nodes without a mesh, camera, skin, or child are present.",
              "observed": 5,
              "threshold": 0,
              "autoFixable": true,
              "action": "Run the allowlisted empty-node cleanup and recheck the output."
            },
            {
              "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
              "ruleId": "SCENE-NONUNIT-SCALE",
              "category": "scene",
              "severity": "INFO",
              "path": "/nodes/*/scale",
              "title": "Non-unit scale transforms found",
              "message": "The asset contains non-unit node scales that may differ across engines.",
              "observed": 105,
              "threshold": 0,
              "autoFixable": false,
              "action": "Confirm the target engine's transform and import policy."
            }
          ],
          "score": {
            "score": 100,
            "threshold": 90,
            "ready": true,
            "hardBlockerCount": 0,
            "breakdown": {
              "format": 100,
              "scene": 100,
              "geometry": 100,
              "materials": 100,
              "textures": 100,
              "runtime": 100
            },
            "ruleSetId": "harvest-frontier-runtime-v1",
            "ruleSetVersion": "0.1.0"
          },
          "analysisId": "analysis-fab38a1b2978-1cd59e47",
          "resultDigest": "1cd59e4750b6a3265cb092a680de7e5c333944fd818a7e3c63f55c2c8846d531"
        },
        "passport": {
          "schemaVersion": "1.0",
          "passportId": "passport-2605f6fa3f47-fab38a1b2978",
          "coreVersion": "0.1.0",
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0",
          "profileId": "pc",
          "sourceHash": "2605f6fa3f477b569566b4db9b371c5c87554221c61a5edbf10317e3f3e2ba49",
          "outputHash": "fab38a1b2978faf113d7c40bed9a42bc1e78d82e9520ba443278bcfff448078c",
          "sourceFileName": "processing.line.m1.lod1.glb",
          "outputFileName": "processing.line.m1.lod1.clunk-optimized.glb",
          "sourceInspectionDigest": "432f6dcb02446e8b4d3f0d0380c213c8558efed999e0cd7e37e7ecd125f31cb3",
          "outputInspectionDigest": "1cd59e4750b6a3265cb092a680de7e5c333944fd818a7e3c63f55c2c8846d531",
          "operations": [
            {
              "id": "clean-metadata",
              "description": "Removed explicitly allowlisted non-runtime metadata: extras, asset.generator, and asset.copyright.",
              "count": 55,
              "safety": "metadata-only"
            }
          ],
          "before": {
            "metrics": {
              "sceneCount": 1,
              "nodeCount": 136,
              "maxDepth": 4,
              "emptyNodeCount": 5,
              "meshCount": 63,
              "primitiveCount": 63,
              "vertexCount": 9737,
              "triangleCount": 14906,
              "drawCallCount": 63,
              "materialCount": 31,
              "duplicateMaterialCount": 0,
              "textureCount": 0,
              "imageCount": 0,
              "textureMaxDimension": 0,
              "textureMemoryBytes": 0,
              "animationCount": 0,
              "skinCount": 0,
              "missingNormalPrimitiveCount": 0,
              "missingUvPrimitiveCount": 63,
              "nonUnitScaleNodeCount": 105,
              "zeroScaleNodeCount": 0,
              "externalResourceCount": 0,
              "unresolvedResourceCount": 0,
              "remoteResourceCount": 0,
              "extensionCount": 6,
              "bounds": {
                "min": [
                  -32767,
                  -32767,
                  -32767
                ],
                "max": [
                  32767,
                  32767,
                  32767
                ],
                "dimensions": [
                  65534,
                  65534,
                  65534
                ]
              }
            },
            "score": {
              "score": 100,
              "threshold": 90,
              "ready": true,
              "hardBlockerCount": 0,
              "breakdown": {
                "format": 100,
                "scene": 100,
                "geometry": 100,
                "materials": 100,
                "textures": 100,
                "runtime": 100
              },
              "ruleSetId": "harvest-frontier-runtime-v1",
              "ruleSetVersion": "0.1.0"
            }
          },
          "after": {
            "metrics": {
              "sceneCount": 1,
              "nodeCount": 136,
              "maxDepth": 4,
              "emptyNodeCount": 5,
              "meshCount": 63,
              "primitiveCount": 63,
              "vertexCount": 9737,
              "triangleCount": 14906,
              "drawCallCount": 63,
              "materialCount": 31,
              "duplicateMaterialCount": 0,
              "textureCount": 0,
              "imageCount": 0,
              "textureMaxDimension": 0,
              "textureMemoryBytes": 0,
              "animationCount": 0,
              "skinCount": 0,
              "missingNormalPrimitiveCount": 0,
              "missingUvPrimitiveCount": 63,
              "nonUnitScaleNodeCount": 105,
              "zeroScaleNodeCount": 0,
              "externalResourceCount": 0,
              "unresolvedResourceCount": 0,
              "remoteResourceCount": 0,
              "extensionCount": 6,
              "bounds": {
                "min": [
                  -32767,
                  -32767,
                  -32767
                ],
                "max": [
                  32767,
                  32767,
                  32767
                ],
                "dimensions": [
                  65534,
                  65534,
                  65534
                ]
              }
            },
            "score": {
              "score": 100,
              "threshold": 90,
              "ready": true,
              "hardBlockerCount": 0,
              "breakdown": {
                "format": 100,
                "scene": 100,
                "geometry": 100,
                "materials": 100,
                "textures": 100,
                "runtime": 100
              },
              "ruleSetId": "harvest-frontier-runtime-v1",
              "ruleSetVersion": "0.1.0"
            }
          },
          "limitations": [
            "Lossy geometry, texture, animation, skin, and unknown-extension transforms are not applied in v1.",
            "Game-Ready Score is Clunk's declared policy score, not a universal engine certification."
          ]
        },
        "error": null
      }
    },
    {
      "name": "seeder.compact.m1.glb",
      "sourcePath": "C:\\Users\\50106\\Desktop\\Harvest Frontier\\public\\assets\\runtime\\seeder.compact.m1.glb",
      "sourceHash": "b5ece82b0c814ad8ac7c028a5d14303ee2e0da9462bb386c47fdc58000733570",
      "sourceBytes": 557888,
      "before": {
        "schemaVersion": "1.0",
        "coreVersion": "0.1.0",
        "ruleSetId": "harvest-frontier-runtime-v1",
        "ruleSetVersion": "0.1.0",
        "profileId": "pc",
        "fileName": "seeder.compact.m1.glb",
        "format": "glb",
        "byteLength": 557888,
        "inputHash": "b5ece82b0c814ad8ac7c028a5d14303ee2e0da9462bb386c47fdc58000733570",
        "metrics": {
          "sceneCount": 1,
          "nodeCount": 562,
          "maxDepth": 9,
          "emptyNodeCount": 35,
          "meshCount": 75,
          "primitiveCount": 75,
          "vertexCount": 13926,
          "triangleCount": 11318,
          "drawCallCount": 75,
          "materialCount": 22,
          "duplicateMaterialCount": 0,
          "textureCount": 0,
          "imageCount": 0,
          "textureMaxDimension": 0,
          "textureMemoryBytes": 0,
          "animationCount": 0,
          "skinCount": 0,
          "missingNormalPrimitiveCount": 0,
          "missingUvPrimitiveCount": 1,
          "nonUnitScaleNodeCount": 412,
          "zeroScaleNodeCount": 0,
          "externalResourceCount": 0,
          "unresolvedResourceCount": 0,
          "remoteResourceCount": 0,
          "extensionCount": 3,
          "bounds": {
            "min": [
              -32767,
              -32767,
              -32767
            ],
            "max": [
              32767,
              32767,
              32767
            ],
            "dimensions": [
              65534,
              65534,
              65534
            ]
          }
        },
        "findings": [
          {
            "id": "FORMAT-GLTF2:/asset",
            "ruleId": "FORMAT-GLTF2",
            "category": "format",
            "severity": "INFO",
            "path": "/asset",
            "title": "glTF 2.0 parsed",
            "message": "GLB is a supported glTF 2.0 container.",
            "observed": "GLB",
            "threshold": "GLB or GLTF 2.0",
            "autoFixable": false,
            "action": "No action required."
          },
          {
            "id": "SCENE-EMPTY-NODES:/nodes",
            "ruleId": "SCENE-EMPTY-NODES",
            "category": "scene",
            "severity": "INFO",
            "path": "/nodes",
            "title": "Empty nodes found",
            "message": "Identity-only nodes without a mesh, camera, skin, or child are present.",
            "observed": 35,
            "threshold": 0,
            "autoFixable": true,
            "action": "Run the allowlisted empty-node cleanup and recheck the output."
          },
          {
            "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
            "ruleId": "SCENE-NONUNIT-SCALE",
            "category": "scene",
            "severity": "INFO",
            "path": "/nodes/*/scale",
            "title": "Non-unit scale transforms found",
            "message": "The asset contains non-unit node scales that may differ across engines.",
            "observed": 412,
            "threshold": 0,
            "autoFixable": false,
            "action": "Confirm the target engine's transform and import policy."
          }
        ],
        "score": {
          "score": 100,
          "threshold": 90,
          "ready": true,
          "hardBlockerCount": 0,
          "breakdown": {
            "format": 100,
            "scene": 100,
            "geometry": 100,
            "materials": 100,
            "textures": 100,
            "runtime": 100
          },
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0"
        },
        "analysisId": "analysis-b5ece82b0c81-8f8554cf",
        "resultDigest": "8f8554cf9cbb222bf3e8069b5ece5afd0fb99b6d4c3d9a9a5f17026964ea8fc9"
      },
      "blockingFindings": [],
      "optimization": {
        "enabled": true,
        "applied": true,
        "outputFileName": "seeder.compact.m1.clunk-optimized.glb",
        "outputHash": "659034394b92eff874553b8e807098b35a4b0a076b8e1361fd72f37eab232863",
        "outputBytes": 529396,
        "outputReopened": true,
        "operations": [
          {
            "id": "clean-metadata",
            "description": "Removed explicitly allowlisted non-runtime metadata: extras, asset.generator, and asset.copyright.",
            "count": 253,
            "safety": "metadata-only"
          }
        ],
        "after": {
          "schemaVersion": "1.0",
          "coreVersion": "0.1.0",
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0",
          "profileId": "pc",
          "fileName": "seeder.compact.m1.clunk-optimized.glb",
          "format": "glb",
          "byteLength": 529396,
          "inputHash": "659034394b92eff874553b8e807098b35a4b0a076b8e1361fd72f37eab232863",
          "metrics": {
            "sceneCount": 1,
            "nodeCount": 562,
            "maxDepth": 9,
            "emptyNodeCount": 35,
            "meshCount": 75,
            "primitiveCount": 75,
            "vertexCount": 13926,
            "triangleCount": 11318,
            "drawCallCount": 75,
            "materialCount": 22,
            "duplicateMaterialCount": 0,
            "textureCount": 0,
            "imageCount": 0,
            "textureMaxDimension": 0,
            "textureMemoryBytes": 0,
            "animationCount": 0,
            "skinCount": 0,
            "missingNormalPrimitiveCount": 0,
            "missingUvPrimitiveCount": 1,
            "nonUnitScaleNodeCount": 412,
            "zeroScaleNodeCount": 0,
            "externalResourceCount": 0,
            "unresolvedResourceCount": 0,
            "remoteResourceCount": 0,
            "extensionCount": 3,
            "bounds": {
              "min": [
                -32767,
                -32767,
                -32767
              ],
              "max": [
                32767,
                32767,
                32767
              ],
              "dimensions": [
                65534,
                65534,
                65534
              ]
            }
          },
          "findings": [
            {
              "id": "FORMAT-GLTF2:/asset",
              "ruleId": "FORMAT-GLTF2",
              "category": "format",
              "severity": "INFO",
              "path": "/asset",
              "title": "glTF 2.0 parsed",
              "message": "GLB is a supported glTF 2.0 container.",
              "observed": "GLB",
              "threshold": "GLB or GLTF 2.0",
              "autoFixable": false,
              "action": "No action required."
            },
            {
              "id": "SCENE-EMPTY-NODES:/nodes",
              "ruleId": "SCENE-EMPTY-NODES",
              "category": "scene",
              "severity": "INFO",
              "path": "/nodes",
              "title": "Empty nodes found",
              "message": "Identity-only nodes without a mesh, camera, skin, or child are present.",
              "observed": 35,
              "threshold": 0,
              "autoFixable": true,
              "action": "Run the allowlisted empty-node cleanup and recheck the output."
            },
            {
              "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
              "ruleId": "SCENE-NONUNIT-SCALE",
              "category": "scene",
              "severity": "INFO",
              "path": "/nodes/*/scale",
              "title": "Non-unit scale transforms found",
              "message": "The asset contains non-unit node scales that may differ across engines.",
              "observed": 412,
              "threshold": 0,
              "autoFixable": false,
              "action": "Confirm the target engine's transform and import policy."
            }
          ],
          "score": {
            "score": 100,
            "threshold": 90,
            "ready": true,
            "hardBlockerCount": 0,
            "breakdown": {
              "format": 100,
              "scene": 100,
              "geometry": 100,
              "materials": 100,
              "textures": 100,
              "runtime": 100
            },
            "ruleSetId": "harvest-frontier-runtime-v1",
            "ruleSetVersion": "0.1.0"
          },
          "analysisId": "analysis-659034394b92-f85daff7",
          "resultDigest": "f85daff793db938dfe43b39542da98eef7c2bb7a2e7bd4b0de5cd9eabeed4afe"
        },
        "passport": {
          "schemaVersion": "1.0",
          "passportId": "passport-b5ece82b0c81-659034394b92",
          "coreVersion": "0.1.0",
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0",
          "profileId": "pc",
          "sourceHash": "b5ece82b0c814ad8ac7c028a5d14303ee2e0da9462bb386c47fdc58000733570",
          "outputHash": "659034394b92eff874553b8e807098b35a4b0a076b8e1361fd72f37eab232863",
          "sourceFileName": "seeder.compact.m1.glb",
          "outputFileName": "seeder.compact.m1.clunk-optimized.glb",
          "sourceInspectionDigest": "8f8554cf9cbb222bf3e8069b5ece5afd0fb99b6d4c3d9a9a5f17026964ea8fc9",
          "outputInspectionDigest": "f85daff793db938dfe43b39542da98eef7c2bb7a2e7bd4b0de5cd9eabeed4afe",
          "operations": [
            {
              "id": "clean-metadata",
              "description": "Removed explicitly allowlisted non-runtime metadata: extras, asset.generator, and asset.copyright.",
              "count": 253,
              "safety": "metadata-only"
            }
          ],
          "before": {
            "metrics": {
              "sceneCount": 1,
              "nodeCount": 562,
              "maxDepth": 9,
              "emptyNodeCount": 35,
              "meshCount": 75,
              "primitiveCount": 75,
              "vertexCount": 13926,
              "triangleCount": 11318,
              "drawCallCount": 75,
              "materialCount": 22,
              "duplicateMaterialCount": 0,
              "textureCount": 0,
              "imageCount": 0,
              "textureMaxDimension": 0,
              "textureMemoryBytes": 0,
              "animationCount": 0,
              "skinCount": 0,
              "missingNormalPrimitiveCount": 0,
              "missingUvPrimitiveCount": 1,
              "nonUnitScaleNodeCount": 412,
              "zeroScaleNodeCount": 0,
              "externalResourceCount": 0,
              "unresolvedResourceCount": 0,
              "remoteResourceCount": 0,
              "extensionCount": 3,
              "bounds": {
                "min": [
                  -32767,
                  -32767,
                  -32767
                ],
                "max": [
                  32767,
                  32767,
                  32767
                ],
                "dimensions": [
                  65534,
                  65534,
                  65534
                ]
              }
            },
            "score": {
              "score": 100,
              "threshold": 90,
              "ready": true,
              "hardBlockerCount": 0,
              "breakdown": {
                "format": 100,
                "scene": 100,
                "geometry": 100,
                "materials": 100,
                "textures": 100,
                "runtime": 100
              },
              "ruleSetId": "harvest-frontier-runtime-v1",
              "ruleSetVersion": "0.1.0"
            }
          },
          "after": {
            "metrics": {
              "sceneCount": 1,
              "nodeCount": 562,
              "maxDepth": 9,
              "emptyNodeCount": 35,
              "meshCount": 75,
              "primitiveCount": 75,
              "vertexCount": 13926,
              "triangleCount": 11318,
              "drawCallCount": 75,
              "materialCount": 22,
              "duplicateMaterialCount": 0,
              "textureCount": 0,
              "imageCount": 0,
              "textureMaxDimension": 0,
              "textureMemoryBytes": 0,
              "animationCount": 0,
              "skinCount": 0,
              "missingNormalPrimitiveCount": 0,
              "missingUvPrimitiveCount": 1,
              "nonUnitScaleNodeCount": 412,
              "zeroScaleNodeCount": 0,
              "externalResourceCount": 0,
              "unresolvedResourceCount": 0,
              "remoteResourceCount": 0,
              "extensionCount": 3,
              "bounds": {
                "min": [
                  -32767,
                  -32767,
                  -32767
                ],
                "max": [
                  32767,
                  32767,
                  32767
                ],
                "dimensions": [
                  65534,
                  65534,
                  65534
                ]
              }
            },
            "score": {
              "score": 100,
              "threshold": 90,
              "ready": true,
              "hardBlockerCount": 0,
              "breakdown": {
                "format": 100,
                "scene": 100,
                "geometry": 100,
                "materials": 100,
                "textures": 100,
                "runtime": 100
              },
              "ruleSetId": "harvest-frontier-runtime-v1",
              "ruleSetVersion": "0.1.0"
            }
          },
          "limitations": [
            "Lossy geometry, texture, animation, skin, and unknown-extension transforms are not applied in v1.",
            "Game-Ready Score is Clunk's declared policy score, not a universal engine certification."
          ]
        },
        "error": null
      }
    },
    {
      "name": "seeder.compact.m1.lod1.glb",
      "sourcePath": "C:\\Users\\50106\\Desktop\\Harvest Frontier\\public\\assets\\runtime\\seeder.compact.m1.lod1.glb",
      "sourceHash": "72a6937833549abf43ecaf498ee4e950d2c91b0c824488b894e7cab8aaf3667c",
      "sourceBytes": 219100,
      "before": {
        "schemaVersion": "1.0",
        "coreVersion": "0.1.0",
        "ruleSetId": "harvest-frontier-runtime-v1",
        "ruleSetVersion": "0.1.0",
        "profileId": "pc",
        "fileName": "seeder.compact.m1.lod1.glb",
        "format": "glb",
        "byteLength": 219100,
        "inputHash": "72a6937833549abf43ecaf498ee4e950d2c91b0c824488b894e7cab8aaf3667c",
        "metrics": {
          "sceneCount": 1,
          "nodeCount": 418,
          "maxDepth": 9,
          "emptyNodeCount": 39,
          "meshCount": 55,
          "primitiveCount": 55,
          "vertexCount": 4773,
          "triangleCount": 6460,
          "drawCallCount": 55,
          "materialCount": 18,
          "duplicateMaterialCount": 0,
          "textureCount": 0,
          "imageCount": 0,
          "textureMaxDimension": 0,
          "textureMemoryBytes": 0,
          "animationCount": 0,
          "skinCount": 0,
          "missingNormalPrimitiveCount": 0,
          "missingUvPrimitiveCount": 55,
          "nonUnitScaleNodeCount": 272,
          "zeroScaleNodeCount": 0,
          "externalResourceCount": 0,
          "unresolvedResourceCount": 0,
          "remoteResourceCount": 0,
          "extensionCount": 3,
          "bounds": {
            "min": [
              -32767,
              -32767,
              -32767
            ],
            "max": [
              32767,
              32767,
              32767
            ],
            "dimensions": [
              65534,
              65534,
              65534
            ]
          }
        },
        "findings": [
          {
            "id": "FORMAT-GLTF2:/asset",
            "ruleId": "FORMAT-GLTF2",
            "category": "format",
            "severity": "INFO",
            "path": "/asset",
            "title": "glTF 2.0 parsed",
            "message": "GLB is a supported glTF 2.0 container.",
            "observed": "GLB",
            "threshold": "GLB or GLTF 2.0",
            "autoFixable": false,
            "action": "No action required."
          },
          {
            "id": "SCENE-EMPTY-NODES:/nodes",
            "ruleId": "SCENE-EMPTY-NODES",
            "category": "scene",
            "severity": "INFO",
            "path": "/nodes",
            "title": "Empty nodes found",
            "message": "Identity-only nodes without a mesh, camera, skin, or child are present.",
            "observed": 39,
            "threshold": 0,
            "autoFixable": true,
            "action": "Run the allowlisted empty-node cleanup and recheck the output."
          },
          {
            "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
            "ruleId": "SCENE-NONUNIT-SCALE",
            "category": "scene",
            "severity": "INFO",
            "path": "/nodes/*/scale",
            "title": "Non-unit scale transforms found",
            "message": "The asset contains non-unit node scales that may differ across engines.",
            "observed": 272,
            "threshold": 0,
            "autoFixable": false,
            "action": "Confirm the target engine's transform and import policy."
          }
        ],
        "score": {
          "score": 100,
          "threshold": 90,
          "ready": true,
          "hardBlockerCount": 0,
          "breakdown": {
            "format": 100,
            "scene": 100,
            "geometry": 100,
            "materials": 100,
            "textures": 100,
            "runtime": 100
          },
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0"
        },
        "analysisId": "analysis-72a693783354-224a501e",
        "resultDigest": "224a501ec45720e8bc40b46c8b4bd4c8681be8f75ff24a7706432e6c7cee93a8"
      },
      "blockingFindings": [],
      "optimization": {
        "enabled": true,
        "applied": true,
        "outputFileName": "seeder.compact.m1.lod1.clunk-optimized.glb",
        "outputHash": "382302f5e1496154062e54abe1af32d6d460545193d803974fcf57a1a3c97700",
        "outputBytes": 208832,
        "outputReopened": true,
        "operations": [
          {
            "id": "clean-metadata",
            "description": "Removed explicitly allowlisted non-runtime metadata: extras, asset.generator, and asset.copyright.",
            "count": 109,
            "safety": "metadata-only"
          }
        ],
        "after": {
          "schemaVersion": "1.0",
          "coreVersion": "0.1.0",
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0",
          "profileId": "pc",
          "fileName": "seeder.compact.m1.lod1.clunk-optimized.glb",
          "format": "glb",
          "byteLength": 208832,
          "inputHash": "382302f5e1496154062e54abe1af32d6d460545193d803974fcf57a1a3c97700",
          "metrics": {
            "sceneCount": 1,
            "nodeCount": 418,
            "maxDepth": 9,
            "emptyNodeCount": 39,
            "meshCount": 55,
            "primitiveCount": 55,
            "vertexCount": 4773,
            "triangleCount": 6460,
            "drawCallCount": 55,
            "materialCount": 18,
            "duplicateMaterialCount": 0,
            "textureCount": 0,
            "imageCount": 0,
            "textureMaxDimension": 0,
            "textureMemoryBytes": 0,
            "animationCount": 0,
            "skinCount": 0,
            "missingNormalPrimitiveCount": 0,
            "missingUvPrimitiveCount": 55,
            "nonUnitScaleNodeCount": 272,
            "zeroScaleNodeCount": 0,
            "externalResourceCount": 0,
            "unresolvedResourceCount": 0,
            "remoteResourceCount": 0,
            "extensionCount": 3,
            "bounds": {
              "min": [
                -32767,
                -32767,
                -32767
              ],
              "max": [
                32767,
                32767,
                32767
              ],
              "dimensions": [
                65534,
                65534,
                65534
              ]
            }
          },
          "findings": [
            {
              "id": "FORMAT-GLTF2:/asset",
              "ruleId": "FORMAT-GLTF2",
              "category": "format",
              "severity": "INFO",
              "path": "/asset",
              "title": "glTF 2.0 parsed",
              "message": "GLB is a supported glTF 2.0 container.",
              "observed": "GLB",
              "threshold": "GLB or GLTF 2.0",
              "autoFixable": false,
              "action": "No action required."
            },
            {
              "id": "SCENE-EMPTY-NODES:/nodes",
              "ruleId": "SCENE-EMPTY-NODES",
              "category": "scene",
              "severity": "INFO",
              "path": "/nodes",
              "title": "Empty nodes found",
              "message": "Identity-only nodes without a mesh, camera, skin, or child are present.",
              "observed": 39,
              "threshold": 0,
              "autoFixable": true,
              "action": "Run the allowlisted empty-node cleanup and recheck the output."
            },
            {
              "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
              "ruleId": "SCENE-NONUNIT-SCALE",
              "category": "scene",
              "severity": "INFO",
              "path": "/nodes/*/scale",
              "title": "Non-unit scale transforms found",
              "message": "The asset contains non-unit node scales that may differ across engines.",
              "observed": 272,
              "threshold": 0,
              "autoFixable": false,
              "action": "Confirm the target engine's transform and import policy."
            }
          ],
          "score": {
            "score": 100,
            "threshold": 90,
            "ready": true,
            "hardBlockerCount": 0,
            "breakdown": {
              "format": 100,
              "scene": 100,
              "geometry": 100,
              "materials": 100,
              "textures": 100,
              "runtime": 100
            },
            "ruleSetId": "harvest-frontier-runtime-v1",
            "ruleSetVersion": "0.1.0"
          },
          "analysisId": "analysis-382302f5e149-e69c8000",
          "resultDigest": "e69c8000daa912f3800bcec0f1386b4f8b32f77f44723704224e7f22f762fa74"
        },
        "passport": {
          "schemaVersion": "1.0",
          "passportId": "passport-72a693783354-382302f5e149",
          "coreVersion": "0.1.0",
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0",
          "profileId": "pc",
          "sourceHash": "72a6937833549abf43ecaf498ee4e950d2c91b0c824488b894e7cab8aaf3667c",
          "outputHash": "382302f5e1496154062e54abe1af32d6d460545193d803974fcf57a1a3c97700",
          "sourceFileName": "seeder.compact.m1.lod1.glb",
          "outputFileName": "seeder.compact.m1.lod1.clunk-optimized.glb",
          "sourceInspectionDigest": "224a501ec45720e8bc40b46c8b4bd4c8681be8f75ff24a7706432e6c7cee93a8",
          "outputInspectionDigest": "e69c8000daa912f3800bcec0f1386b4f8b32f77f44723704224e7f22f762fa74",
          "operations": [
            {
              "id": "clean-metadata",
              "description": "Removed explicitly allowlisted non-runtime metadata: extras, asset.generator, and asset.copyright.",
              "count": 109,
              "safety": "metadata-only"
            }
          ],
          "before": {
            "metrics": {
              "sceneCount": 1,
              "nodeCount": 418,
              "maxDepth": 9,
              "emptyNodeCount": 39,
              "meshCount": 55,
              "primitiveCount": 55,
              "vertexCount": 4773,
              "triangleCount": 6460,
              "drawCallCount": 55,
              "materialCount": 18,
              "duplicateMaterialCount": 0,
              "textureCount": 0,
              "imageCount": 0,
              "textureMaxDimension": 0,
              "textureMemoryBytes": 0,
              "animationCount": 0,
              "skinCount": 0,
              "missingNormalPrimitiveCount": 0,
              "missingUvPrimitiveCount": 55,
              "nonUnitScaleNodeCount": 272,
              "zeroScaleNodeCount": 0,
              "externalResourceCount": 0,
              "unresolvedResourceCount": 0,
              "remoteResourceCount": 0,
              "extensionCount": 3,
              "bounds": {
                "min": [
                  -32767,
                  -32767,
                  -32767
                ],
                "max": [
                  32767,
                  32767,
                  32767
                ],
                "dimensions": [
                  65534,
                  65534,
                  65534
                ]
              }
            },
            "score": {
              "score": 100,
              "threshold": 90,
              "ready": true,
              "hardBlockerCount": 0,
              "breakdown": {
                "format": 100,
                "scene": 100,
                "geometry": 100,
                "materials": 100,
                "textures": 100,
                "runtime": 100
              },
              "ruleSetId": "harvest-frontier-runtime-v1",
              "ruleSetVersion": "0.1.0"
            }
          },
          "after": {
            "metrics": {
              "sceneCount": 1,
              "nodeCount": 418,
              "maxDepth": 9,
              "emptyNodeCount": 39,
              "meshCount": 55,
              "primitiveCount": 55,
              "vertexCount": 4773,
              "triangleCount": 6460,
              "drawCallCount": 55,
              "materialCount": 18,
              "duplicateMaterialCount": 0,
              "textureCount": 0,
              "imageCount": 0,
              "textureMaxDimension": 0,
              "textureMemoryBytes": 0,
              "animationCount": 0,
              "skinCount": 0,
              "missingNormalPrimitiveCount": 0,
              "missingUvPrimitiveCount": 55,
              "nonUnitScaleNodeCount": 272,
              "zeroScaleNodeCount": 0,
              "externalResourceCount": 0,
              "unresolvedResourceCount": 0,
              "remoteResourceCount": 0,
              "extensionCount": 3,
              "bounds": {
                "min": [
                  -32767,
                  -32767,
                  -32767
                ],
                "max": [
                  32767,
                  32767,
                  32767
                ],
                "dimensions": [
                  65534,
                  65534,
                  65534
                ]
              }
            },
            "score": {
              "score": 100,
              "threshold": 90,
              "ready": true,
              "hardBlockerCount": 0,
              "breakdown": {
                "format": 100,
                "scene": 100,
                "geometry": 100,
                "materials": 100,
                "textures": 100,
                "runtime": 100
              },
              "ruleSetId": "harvest-frontier-runtime-v1",
              "ruleSetVersion": "0.1.0"
            }
          },
          "limitations": [
            "Lossy geometry, texture, animation, skin, and unknown-extension transforms are not applied in v1.",
            "Game-Ready Score is Clunk's declared policy score, not a universal engine certification."
          ]
        },
        "error": null
      }
    },
    {
      "name": "tractor.compact.m1.glb",
      "sourcePath": "C:\\Users\\50106\\Desktop\\Harvest Frontier\\public\\assets\\runtime\\tractor.compact.m1.glb",
      "sourceHash": "d92ae93240cc9b4d477df13cbddd0342738feb57ed9b8551e73d68fd83b3222c",
      "sourceBytes": 680412,
      "before": {
        "schemaVersion": "1.0",
        "coreVersion": "0.1.0",
        "ruleSetId": "harvest-frontier-runtime-v1",
        "ruleSetVersion": "0.1.0",
        "profileId": "pc",
        "fileName": "tractor.compact.m1.glb",
        "format": "glb",
        "byteLength": 680412,
        "inputHash": "d92ae93240cc9b4d477df13cbddd0342738feb57ed9b8551e73d68fd83b3222c",
        "metrics": {
          "sceneCount": 1,
          "nodeCount": 249,
          "maxDepth": 8,
          "emptyNodeCount": 0,
          "meshCount": 88,
          "primitiveCount": 88,
          "vertexCount": 83090,
          "triangleCount": 30188,
          "drawCallCount": 88,
          "materialCount": 48,
          "duplicateMaterialCount": 0,
          "textureCount": 0,
          "imageCount": 0,
          "textureMaxDimension": 0,
          "textureMemoryBytes": 0,
          "animationCount": 0,
          "skinCount": 0,
          "missingNormalPrimitiveCount": 7,
          "missingUvPrimitiveCount": 88,
          "nonUnitScaleNodeCount": 181,
          "zeroScaleNodeCount": 0,
          "externalResourceCount": 0,
          "unresolvedResourceCount": 0,
          "remoteResourceCount": 0,
          "extensionCount": 8,
          "bounds": {
            "min": [
              -32767,
              -32767,
              -32767
            ],
            "max": [
              32767,
              32767,
              32767
            ],
            "dimensions": [
              65534,
              65534,
              65534
            ]
          }
        },
        "findings": [
          {
            "id": "FORMAT-GLTF2:/asset",
            "ruleId": "FORMAT-GLTF2",
            "category": "format",
            "severity": "INFO",
            "path": "/asset",
            "title": "glTF 2.0 parsed",
            "message": "GLB is a supported glTF 2.0 container.",
            "observed": "GLB",
            "threshold": "GLB or GLTF 2.0",
            "autoFixable": false,
            "action": "No action required."
          },
          {
            "id": "GEO-MISSING-NORMALS:/meshes/*/primitives/*/attributes",
            "ruleId": "GEO-MISSING-NORMALS",
            "category": "geometry",
            "severity": "INFO",
            "path": "/meshes/*/primitives/*/attributes",
            "title": "Normals are missing",
            "message": "One or more primitives do not provide NORMAL attributes.",
            "observed": 7,
            "threshold": 0,
            "autoFixable": false,
            "action": "Generate or author normals in the source asset and re-import."
          },
          {
            "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
            "ruleId": "SCENE-NONUNIT-SCALE",
            "category": "scene",
            "severity": "INFO",
            "path": "/nodes/*/scale",
            "title": "Non-unit scale transforms found",
            "message": "The asset contains non-unit node scales that may differ across engines.",
            "observed": 181,
            "threshold": 0,
            "autoFixable": false,
            "action": "Confirm the target engine's transform and import policy."
          }
        ],
        "score": {
          "score": 100,
          "threshold": 90,
          "ready": true,
          "hardBlockerCount": 0,
          "breakdown": {
            "format": 100,
            "scene": 100,
            "geometry": 100,
            "materials": 100,
            "textures": 100,
            "runtime": 100
          },
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0"
        },
        "analysisId": "analysis-d92ae93240cc-4789a69a",
        "resultDigest": "4789a69a70cecbd4f3cc30e70c17293c1776823747095467da9b8c5b4dc008df"
      },
      "blockingFindings": [],
      "optimization": {
        "enabled": true,
        "applied": true,
        "outputFileName": "tractor.compact.m1.clunk-optimized.glb",
        "outputHash": "7724e87b373678c40c0481a97b09b1801756273d4059f84bf4abd80759feda1c",
        "outputBytes": 391256,
        "outputReopened": true,
        "operations": [
          {
            "id": "clean-metadata",
            "description": "Removed explicitly allowlisted non-runtime metadata: extras, asset.generator, and asset.copyright.",
            "count": 128,
            "safety": "metadata-only"
          }
        ],
        "after": {
          "schemaVersion": "1.0",
          "coreVersion": "0.1.0",
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0",
          "profileId": "pc",
          "fileName": "tractor.compact.m1.clunk-optimized.glb",
          "format": "glb",
          "byteLength": 391256,
          "inputHash": "7724e87b373678c40c0481a97b09b1801756273d4059f84bf4abd80759feda1c",
          "metrics": {
            "sceneCount": 1,
            "nodeCount": 249,
            "maxDepth": 8,
            "emptyNodeCount": 0,
            "meshCount": 88,
            "primitiveCount": 88,
            "vertexCount": 83090,
            "triangleCount": 30188,
            "drawCallCount": 88,
            "materialCount": 48,
            "duplicateMaterialCount": 0,
            "textureCount": 0,
            "imageCount": 0,
            "textureMaxDimension": 0,
            "textureMemoryBytes": 0,
            "animationCount": 0,
            "skinCount": 0,
            "missingNormalPrimitiveCount": 7,
            "missingUvPrimitiveCount": 88,
            "nonUnitScaleNodeCount": 181,
            "zeroScaleNodeCount": 0,
            "externalResourceCount": 0,
            "unresolvedResourceCount": 0,
            "remoteResourceCount": 0,
            "extensionCount": 8,
            "bounds": {
              "min": [
                -32767,
                -32767,
                -32767
              ],
              "max": [
                32767,
                32767,
                32767
              ],
              "dimensions": [
                65534,
                65534,
                65534
              ]
            }
          },
          "findings": [
            {
              "id": "FORMAT-GLTF2:/asset",
              "ruleId": "FORMAT-GLTF2",
              "category": "format",
              "severity": "INFO",
              "path": "/asset",
              "title": "glTF 2.0 parsed",
              "message": "GLB is a supported glTF 2.0 container.",
              "observed": "GLB",
              "threshold": "GLB or GLTF 2.0",
              "autoFixable": false,
              "action": "No action required."
            },
            {
              "id": "GEO-MISSING-NORMALS:/meshes/*/primitives/*/attributes",
              "ruleId": "GEO-MISSING-NORMALS",
              "category": "geometry",
              "severity": "INFO",
              "path": "/meshes/*/primitives/*/attributes",
              "title": "Normals are missing",
              "message": "One or more primitives do not provide NORMAL attributes.",
              "observed": 7,
              "threshold": 0,
              "autoFixable": false,
              "action": "Generate or author normals in the source asset and re-import."
            },
            {
              "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
              "ruleId": "SCENE-NONUNIT-SCALE",
              "category": "scene",
              "severity": "INFO",
              "path": "/nodes/*/scale",
              "title": "Non-unit scale transforms found",
              "message": "The asset contains non-unit node scales that may differ across engines.",
              "observed": 181,
              "threshold": 0,
              "autoFixable": false,
              "action": "Confirm the target engine's transform and import policy."
            }
          ],
          "score": {
            "score": 100,
            "threshold": 90,
            "ready": true,
            "hardBlockerCount": 0,
            "breakdown": {
              "format": 100,
              "scene": 100,
              "geometry": 100,
              "materials": 100,
              "textures": 100,
              "runtime": 100
            },
            "ruleSetId": "harvest-frontier-runtime-v1",
            "ruleSetVersion": "0.1.0"
          },
          "analysisId": "analysis-7724e87b3736-86e11a03",
          "resultDigest": "86e11a0350985f2e5767fda2ea4797fd780a6028abd6520234d2c7a5aa759e23"
        },
        "passport": {
          "schemaVersion": "1.0",
          "passportId": "passport-d92ae93240cc-7724e87b3736",
          "coreVersion": "0.1.0",
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0",
          "profileId": "pc",
          "sourceHash": "d92ae93240cc9b4d477df13cbddd0342738feb57ed9b8551e73d68fd83b3222c",
          "outputHash": "7724e87b373678c40c0481a97b09b1801756273d4059f84bf4abd80759feda1c",
          "sourceFileName": "tractor.compact.m1.glb",
          "outputFileName": "tractor.compact.m1.clunk-optimized.glb",
          "sourceInspectionDigest": "4789a69a70cecbd4f3cc30e70c17293c1776823747095467da9b8c5b4dc008df",
          "outputInspectionDigest": "86e11a0350985f2e5767fda2ea4797fd780a6028abd6520234d2c7a5aa759e23",
          "operations": [
            {
              "id": "clean-metadata",
              "description": "Removed explicitly allowlisted non-runtime metadata: extras, asset.generator, and asset.copyright.",
              "count": 128,
              "safety": "metadata-only"
            }
          ],
          "before": {
            "metrics": {
              "sceneCount": 1,
              "nodeCount": 249,
              "maxDepth": 8,
              "emptyNodeCount": 0,
              "meshCount": 88,
              "primitiveCount": 88,
              "vertexCount": 83090,
              "triangleCount": 30188,
              "drawCallCount": 88,
              "materialCount": 48,
              "duplicateMaterialCount": 0,
              "textureCount": 0,
              "imageCount": 0,
              "textureMaxDimension": 0,
              "textureMemoryBytes": 0,
              "animationCount": 0,
              "skinCount": 0,
              "missingNormalPrimitiveCount": 7,
              "missingUvPrimitiveCount": 88,
              "nonUnitScaleNodeCount": 181,
              "zeroScaleNodeCount": 0,
              "externalResourceCount": 0,
              "unresolvedResourceCount": 0,
              "remoteResourceCount": 0,
              "extensionCount": 8,
              "bounds": {
                "min": [
                  -32767,
                  -32767,
                  -32767
                ],
                "max": [
                  32767,
                  32767,
                  32767
                ],
                "dimensions": [
                  65534,
                  65534,
                  65534
                ]
              }
            },
            "score": {
              "score": 100,
              "threshold": 90,
              "ready": true,
              "hardBlockerCount": 0,
              "breakdown": {
                "format": 100,
                "scene": 100,
                "geometry": 100,
                "materials": 100,
                "textures": 100,
                "runtime": 100
              },
              "ruleSetId": "harvest-frontier-runtime-v1",
              "ruleSetVersion": "0.1.0"
            }
          },
          "after": {
            "metrics": {
              "sceneCount": 1,
              "nodeCount": 249,
              "maxDepth": 8,
              "emptyNodeCount": 0,
              "meshCount": 88,
              "primitiveCount": 88,
              "vertexCount": 83090,
              "triangleCount": 30188,
              "drawCallCount": 88,
              "materialCount": 48,
              "duplicateMaterialCount": 0,
              "textureCount": 0,
              "imageCount": 0,
              "textureMaxDimension": 0,
              "textureMemoryBytes": 0,
              "animationCount": 0,
              "skinCount": 0,
              "missingNormalPrimitiveCount": 7,
              "missingUvPrimitiveCount": 88,
              "nonUnitScaleNodeCount": 181,
              "zeroScaleNodeCount": 0,
              "externalResourceCount": 0,
              "unresolvedResourceCount": 0,
              "remoteResourceCount": 0,
              "extensionCount": 8,
              "bounds": {
                "min": [
                  -32767,
                  -32767,
                  -32767
                ],
                "max": [
                  32767,
                  32767,
                  32767
                ],
                "dimensions": [
                  65534,
                  65534,
                  65534
                ]
              }
            },
            "score": {
              "score": 100,
              "threshold": 90,
              "ready": true,
              "hardBlockerCount": 0,
              "breakdown": {
                "format": 100,
                "scene": 100,
                "geometry": 100,
                "materials": 100,
                "textures": 100,
                "runtime": 100
              },
              "ruleSetId": "harvest-frontier-runtime-v1",
              "ruleSetVersion": "0.1.0"
            }
          },
          "limitations": [
            "Lossy geometry, texture, animation, skin, and unknown-extension transforms are not applied in v1.",
            "Game-Ready Score is Clunk's declared policy score, not a universal engine certification."
          ]
        },
        "error": null
      }
    },
    {
      "name": "tractor.compact.m1.lod1.glb",
      "sourcePath": "C:\\Users\\50106\\Desktop\\Harvest Frontier\\public\\assets\\runtime\\tractor.compact.m1.lod1.glb",
      "sourceHash": "5b457fc118613961793662111a3e69b75c7200c25f89368d3fb44841a056cf5f",
      "sourceBytes": 509584,
      "before": {
        "schemaVersion": "1.0",
        "coreVersion": "0.1.0",
        "ruleSetId": "harvest-frontier-runtime-v1",
        "ruleSetVersion": "0.1.0",
        "profileId": "pc",
        "fileName": "tractor.compact.m1.lod1.glb",
        "format": "glb",
        "byteLength": 509584,
        "inputHash": "5b457fc118613961793662111a3e69b75c7200c25f89368d3fb44841a056cf5f",
        "metrics": {
          "sceneCount": 1,
          "nodeCount": 249,
          "maxDepth": 8,
          "emptyNodeCount": 0,
          "meshCount": 77,
          "primitiveCount": 77,
          "vertexCount": 13022,
          "triangleCount": 18668,
          "drawCallCount": 77,
          "materialCount": 48,
          "duplicateMaterialCount": 0,
          "textureCount": 0,
          "imageCount": 0,
          "textureMaxDimension": 0,
          "textureMemoryBytes": 0,
          "animationCount": 0,
          "skinCount": 0,
          "missingNormalPrimitiveCount": 7,
          "missingUvPrimitiveCount": 77,
          "nonUnitScaleNodeCount": 181,
          "zeroScaleNodeCount": 0,
          "externalResourceCount": 0,
          "unresolvedResourceCount": 0,
          "remoteResourceCount": 0,
          "extensionCount": 8,
          "bounds": {
            "min": [
              -32767,
              -32767,
              -32767
            ],
            "max": [
              32767,
              32767,
              32767
            ],
            "dimensions": [
              65534,
              65534,
              65534
            ]
          }
        },
        "findings": [
          {
            "id": "FORMAT-GLTF2:/asset",
            "ruleId": "FORMAT-GLTF2",
            "category": "format",
            "severity": "INFO",
            "path": "/asset",
            "title": "glTF 2.0 parsed",
            "message": "GLB is a supported glTF 2.0 container.",
            "observed": "GLB",
            "threshold": "GLB or GLTF 2.0",
            "autoFixable": false,
            "action": "No action required."
          },
          {
            "id": "GEO-MISSING-NORMALS:/meshes/*/primitives/*/attributes",
            "ruleId": "GEO-MISSING-NORMALS",
            "category": "geometry",
            "severity": "INFO",
            "path": "/meshes/*/primitives/*/attributes",
            "title": "Normals are missing",
            "message": "One or more primitives do not provide NORMAL attributes.",
            "observed": 7,
            "threshold": 0,
            "autoFixable": false,
            "action": "Generate or author normals in the source asset and re-import."
          },
          {
            "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
            "ruleId": "SCENE-NONUNIT-SCALE",
            "category": "scene",
            "severity": "INFO",
            "path": "/nodes/*/scale",
            "title": "Non-unit scale transforms found",
            "message": "The asset contains non-unit node scales that may differ across engines.",
            "observed": 181,
            "threshold": 0,
            "autoFixable": false,
            "action": "Confirm the target engine's transform and import policy."
          }
        ],
        "score": {
          "score": 100,
          "threshold": 90,
          "ready": true,
          "hardBlockerCount": 0,
          "breakdown": {
            "format": 100,
            "scene": 100,
            "geometry": 100,
            "materials": 100,
            "textures": 100,
            "runtime": 100
          },
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0"
        },
        "analysisId": "analysis-5b457fc11861-966b295f",
        "resultDigest": "966b295fedd878112acb9d34ea47c52d26bc121c054fd9af60a8aab26a8e01d5"
      },
      "blockingFindings": [],
      "optimization": {
        "enabled": true,
        "applied": true,
        "outputFileName": "tractor.compact.m1.lod1.clunk-optimized.glb",
        "outputHash": "df4c472efd58706e9df3696046b9447d940891e368ebce0f18ba1d3cd76b2879",
        "outputBytes": 220432,
        "outputReopened": true,
        "operations": [
          {
            "id": "clean-metadata",
            "description": "Removed explicitly allowlisted non-runtime metadata: extras, asset.generator, and asset.copyright.",
            "count": 128,
            "safety": "metadata-only"
          }
        ],
        "after": {
          "schemaVersion": "1.0",
          "coreVersion": "0.1.0",
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0",
          "profileId": "pc",
          "fileName": "tractor.compact.m1.lod1.clunk-optimized.glb",
          "format": "glb",
          "byteLength": 220432,
          "inputHash": "df4c472efd58706e9df3696046b9447d940891e368ebce0f18ba1d3cd76b2879",
          "metrics": {
            "sceneCount": 1,
            "nodeCount": 249,
            "maxDepth": 8,
            "emptyNodeCount": 0,
            "meshCount": 77,
            "primitiveCount": 77,
            "vertexCount": 13022,
            "triangleCount": 18668,
            "drawCallCount": 77,
            "materialCount": 48,
            "duplicateMaterialCount": 0,
            "textureCount": 0,
            "imageCount": 0,
            "textureMaxDimension": 0,
            "textureMemoryBytes": 0,
            "animationCount": 0,
            "skinCount": 0,
            "missingNormalPrimitiveCount": 7,
            "missingUvPrimitiveCount": 77,
            "nonUnitScaleNodeCount": 181,
            "zeroScaleNodeCount": 0,
            "externalResourceCount": 0,
            "unresolvedResourceCount": 0,
            "remoteResourceCount": 0,
            "extensionCount": 8,
            "bounds": {
              "min": [
                -32767,
                -32767,
                -32767
              ],
              "max": [
                32767,
                32767,
                32767
              ],
              "dimensions": [
                65534,
                65534,
                65534
              ]
            }
          },
          "findings": [
            {
              "id": "FORMAT-GLTF2:/asset",
              "ruleId": "FORMAT-GLTF2",
              "category": "format",
              "severity": "INFO",
              "path": "/asset",
              "title": "glTF 2.0 parsed",
              "message": "GLB is a supported glTF 2.0 container.",
              "observed": "GLB",
              "threshold": "GLB or GLTF 2.0",
              "autoFixable": false,
              "action": "No action required."
            },
            {
              "id": "GEO-MISSING-NORMALS:/meshes/*/primitives/*/attributes",
              "ruleId": "GEO-MISSING-NORMALS",
              "category": "geometry",
              "severity": "INFO",
              "path": "/meshes/*/primitives/*/attributes",
              "title": "Normals are missing",
              "message": "One or more primitives do not provide NORMAL attributes.",
              "observed": 7,
              "threshold": 0,
              "autoFixable": false,
              "action": "Generate or author normals in the source asset and re-import."
            },
            {
              "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
              "ruleId": "SCENE-NONUNIT-SCALE",
              "category": "scene",
              "severity": "INFO",
              "path": "/nodes/*/scale",
              "title": "Non-unit scale transforms found",
              "message": "The asset contains non-unit node scales that may differ across engines.",
              "observed": 181,
              "threshold": 0,
              "autoFixable": false,
              "action": "Confirm the target engine's transform and import policy."
            }
          ],
          "score": {
            "score": 100,
            "threshold": 90,
            "ready": true,
            "hardBlockerCount": 0,
            "breakdown": {
              "format": 100,
              "scene": 100,
              "geometry": 100,
              "materials": 100,
              "textures": 100,
              "runtime": 100
            },
            "ruleSetId": "harvest-frontier-runtime-v1",
            "ruleSetVersion": "0.1.0"
          },
          "analysisId": "analysis-df4c472efd58-abad4b92",
          "resultDigest": "abad4b927375ef966ac249b262e36ce06c991628a01e7faf73ac9e449ab6cf4c"
        },
        "passport": {
          "schemaVersion": "1.0",
          "passportId": "passport-5b457fc11861-df4c472efd58",
          "coreVersion": "0.1.0",
          "ruleSetId": "harvest-frontier-runtime-v1",
          "ruleSetVersion": "0.1.0",
          "profileId": "pc",
          "sourceHash": "5b457fc118613961793662111a3e69b75c7200c25f89368d3fb44841a056cf5f",
          "outputHash": "df4c472efd58706e9df3696046b9447d940891e368ebce0f18ba1d3cd76b2879",
          "sourceFileName": "tractor.compact.m1.lod1.glb",
          "outputFileName": "tractor.compact.m1.lod1.clunk-optimized.glb",
          "sourceInspectionDigest": "966b295fedd878112acb9d34ea47c52d26bc121c054fd9af60a8aab26a8e01d5",
          "outputInspectionDigest": "abad4b927375ef966ac249b262e36ce06c991628a01e7faf73ac9e449ab6cf4c",
          "operations": [
            {
              "id": "clean-metadata",
              "description": "Removed explicitly allowlisted non-runtime metadata: extras, asset.generator, and asset.copyright.",
              "count": 128,
              "safety": "metadata-only"
            }
          ],
          "before": {
            "metrics": {
              "sceneCount": 1,
              "nodeCount": 249,
              "maxDepth": 8,
              "emptyNodeCount": 0,
              "meshCount": 77,
              "primitiveCount": 77,
              "vertexCount": 13022,
              "triangleCount": 18668,
              "drawCallCount": 77,
              "materialCount": 48,
              "duplicateMaterialCount": 0,
              "textureCount": 0,
              "imageCount": 0,
              "textureMaxDimension": 0,
              "textureMemoryBytes": 0,
              "animationCount": 0,
              "skinCount": 0,
              "missingNormalPrimitiveCount": 7,
              "missingUvPrimitiveCount": 77,
              "nonUnitScaleNodeCount": 181,
              "zeroScaleNodeCount": 0,
              "externalResourceCount": 0,
              "unresolvedResourceCount": 0,
              "remoteResourceCount": 0,
              "extensionCount": 8,
              "bounds": {
                "min": [
                  -32767,
                  -32767,
                  -32767
                ],
                "max": [
                  32767,
                  32767,
                  32767
                ],
                "dimensions": [
                  65534,
                  65534,
                  65534
                ]
              }
            },
            "score": {
              "score": 100,
              "threshold": 90,
              "ready": true,
              "hardBlockerCount": 0,
              "breakdown": {
                "format": 100,
                "scene": 100,
                "geometry": 100,
                "materials": 100,
                "textures": 100,
                "runtime": 100
              },
              "ruleSetId": "harvest-frontier-runtime-v1",
              "ruleSetVersion": "0.1.0"
            }
          },
          "after": {
            "metrics": {
              "sceneCount": 1,
              "nodeCount": 249,
              "maxDepth": 8,
              "emptyNodeCount": 0,
              "meshCount": 77,
              "primitiveCount": 77,
              "vertexCount": 13022,
              "triangleCount": 18668,
              "drawCallCount": 77,
              "materialCount": 48,
              "duplicateMaterialCount": 0,
              "textureCount": 0,
              "imageCount": 0,
              "textureMaxDimension": 0,
              "textureMemoryBytes": 0,
              "animationCount": 0,
              "skinCount": 0,
              "missingNormalPrimitiveCount": 7,
              "missingUvPrimitiveCount": 77,
              "nonUnitScaleNodeCount": 181,
              "zeroScaleNodeCount": 0,
              "externalResourceCount": 0,
              "unresolvedResourceCount": 0,
              "remoteResourceCount": 0,
              "extensionCount": 8,
              "bounds": {
                "min": [
                  -32767,
                  -32767,
                  -32767
                ],
                "max": [
                  32767,
                  32767,
                  32767
                ],
                "dimensions": [
                  65534,
                  65534,
                  65534
                ]
              }
            },
            "score": {
              "score": 100,
              "threshold": 90,
              "ready": true,
              "hardBlockerCount": 0,
              "breakdown": {
                "format": 100,
                "scene": 100,
                "geometry": 100,
                "materials": 100,
                "textures": 100,
                "runtime": 100
              },
              "ruleSetId": "harvest-frontier-runtime-v1",
              "ruleSetVersion": "0.1.0"
            }
          },
          "limitations": [
            "Lossy geometry, texture, animation, skin, and unknown-extension transforms are not applied in v1.",
            "Game-Ready Score is Clunk's declared policy score, not a universal engine certification."
          ]
        },
        "error": null
      }
    }
  ]
}
<!-- /clunk-pilot-report-json -->
```
