# Clunk engine-aware AssetOps pilot

Read-only report. Source assets were not modified.

```json
{
  "schema": "clunk.assetops-engine-pilot.v1",
  "runId": "HF-M96-engine-pilot-r01",
  "generatedAt": "2026-08-24T05:11:35.530Z",
  "workspaceRoot": "C:\\Users\\50106\\Desktop\\Harvest Frontier",
  "sourceCommit": "82459216c618a15f7588f57003e5f4f4ee99f40a",
  "targetProfileId": "harvest-frontier-web-three",
  "environments": [
    {
      "family": "web-three",
      "available": false,
      "plugins": [],
      "capabilities": [],
      "reason": "A browser/WebGL harness must be invoked for this target; discovery alone is not a runtime PASS."
    },
    {
      "family": "godot",
      "available": false,
      "plugins": [],
      "capabilities": [],
      "reason": "godot executable was not found on PATH."
    },
    {
      "family": "unity",
      "available": true,
      "executable": "C:\\Users\\50106\\AppData\\Local\\Unity\\bin\\unity.exe",
      "plugins": [],
      "capabilities": [
        "asset-database-import",
        "editor-smoke"
      ],
      "reason": "unity executable was found, but its version probe returned no output."
    },
    {
      "family": "unreal",
      "available": false,
      "plugins": [],
      "capabilities": [],
      "reason": "unreal executable was not found on PATH."
    },
    {
      "family": "android",
      "available": false,
      "plugins": [],
      "capabilities": [],
      "reason": "android executable was not found on PATH."
    },
    {
      "family": "ios",
      "available": false,
      "plugins": [],
      "capabilities": [],
      "reason": "ios executable was not found on PATH."
    }
  ],
  "sourceAssets": [
    {
      "runId": "HF-M96-engine-pilot-r01:cultivator.compact.m1.glb",
      "sourcePath": "C:\\Users\\50106\\Desktop\\Harvest Frontier\\public\\assets\\runtime\\cultivator.compact.m1.glb",
      "sourceHash": "18a720e4e55878eb64cdcd5da39fb02187741d0e1af7ed06ca2a279540519a50",
      "bytes": 189912,
      "assetKind": "3d-model",
      "targetProfileId": "harvest-frontier-web-three",
      "status": "ENVIRONMENT_UNAVAILABLE",
      "productionReady": false,
      "stages": {
        "bytes": {
          "status": "pass",
          "message": "Input bytes and target format were received.",
          "evidence": [
            {
              "key": "bytes",
              "value": 189912
            },
            {
              "key": "format",
              "value": "glb"
            },
            {
              "key": "sha256",
              "value": "18a720e4e55878eb64cdcd5da39fb02187741d0e1af7ed06ca2a279540519a50"
            }
          ],
          "durationMs": 0
        },
        "structure": {
          "status": "pass",
          "message": "GLB/glTF structure parsed.",
          "evidence": [
            {
              "key": "analysisId",
              "value": "analysis-18a720e4e558-6ea903b4"
            },
            {
              "key": "resultDigest",
              "value": "6ea903b410b4d0936c4e4f771015f55656a5bec8106dd3eee6173ee668dd3ed1"
            }
          ],
          "durationMs": 0
        },
        "policy": {
          "status": "pass",
          "message": "3D target policy has no blocking findings.",
          "evidence": [
            {
              "key": "score",
              "value": 99
            },
            {
              "key": "hardBlockerCount",
              "value": 0
            },
            {
              "key": "legacyRuleSetId",
              "value": "clunk-game-ready-v1"
            }
          ],
          "durationMs": 0
        },
        "import": {
          "status": "environmentUnavailable",
          "message": "No web-three import runner was supplied; structural evidence only.",
          "evidence": [
            {
              "key": "engine",
              "value": "web-three"
            },
            {
              "key": "engineVersion",
              "value": "detected"
            },
            {
              "key": "profileId",
              "value": "harvest-frontier-web-three"
            }
          ],
          "durationMs": 0
        },
        "runtime": {
          "status": "environmentUnavailable",
          "message": "No web-three runtime runner was supplied; structural evidence only.",
          "evidence": [
            {
              "key": "engine",
              "value": "web-three"
            },
            {
              "key": "engineVersion",
              "value": "detected"
            },
            {
              "key": "profileId",
              "value": "harvest-frontier-web-three"
            }
          ],
          "durationMs": 0
        }
      },
      "findings": [
        {
          "id": "FORMAT-GLTF2:/asset",
          "severity": "INFO",
          "message": "GLB is a supported glTF 2.0 container.",
          "path": "/asset"
        },
        {
          "id": "GEO-MISSING-NORMALS:/meshes/*/primitives/*/attributes",
          "severity": "WARNING",
          "message": "One or more primitives do not provide NORMAL attributes.",
          "path": "/meshes/*/primitives/*/attributes"
        },
        {
          "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
          "severity": "WARNING",
          "message": "The asset contains non-unit node scales that may differ across engines.",
          "path": "/nodes/*/scale"
        }
      ],
      "qualityWarnings": [
        {
          "id": "quality-geo-missing-normals:/meshes/*/primitives/*/attributes",
          "domain": "model",
          "status": "NON_BLOCKING",
          "message": "One or more primitives do not provide NORMAL attributes.",
          "path": "/meshes/*/primitives/*/attributes"
        },
        {
          "id": "quality-scene-nonunit-scale:/nodes/*/scale",
          "domain": "model",
          "status": "NON_BLOCKING",
          "message": "The asset contains non-unit node scales that may differ across engines.",
          "path": "/nodes/*/scale"
        }
      ]
    },
    {
      "runId": "HF-M96-engine-pilot-r01:cultivator.compact.m1.lod1.glb",
      "sourcePath": "C:\\Users\\50106\\Desktop\\Harvest Frontier\\public\\assets\\runtime\\cultivator.compact.m1.lod1.glb",
      "sourceHash": "464106711b59289dc0fd432b323fae691aec66deefff68e7f67c37306a098c3a",
      "bytes": 104760,
      "assetKind": "3d-model",
      "targetProfileId": "harvest-frontier-web-three",
      "status": "ENVIRONMENT_UNAVAILABLE",
      "productionReady": false,
      "stages": {
        "bytes": {
          "status": "pass",
          "message": "Input bytes and target format were received.",
          "evidence": [
            {
              "key": "bytes",
              "value": 104760
            },
            {
              "key": "format",
              "value": "glb"
            },
            {
              "key": "sha256",
              "value": "464106711b59289dc0fd432b323fae691aec66deefff68e7f67c37306a098c3a"
            }
          ],
          "durationMs": 0
        },
        "structure": {
          "status": "pass",
          "message": "GLB/glTF structure parsed.",
          "evidence": [
            {
              "key": "analysisId",
              "value": "analysis-464106711b59-e8143a0d"
            },
            {
              "key": "resultDigest",
              "value": "e8143a0d715a8deb42dfcbbb6cc9185c68ca7d86274e971db447e4a7732cc008"
            }
          ],
          "durationMs": 0
        },
        "policy": {
          "status": "pass",
          "message": "3D target policy has no blocking findings.",
          "evidence": [
            {
              "key": "score",
              "value": 99
            },
            {
              "key": "hardBlockerCount",
              "value": 0
            },
            {
              "key": "legacyRuleSetId",
              "value": "clunk-game-ready-v1"
            }
          ],
          "durationMs": 0
        },
        "import": {
          "status": "environmentUnavailable",
          "message": "No web-three import runner was supplied; structural evidence only.",
          "evidence": [
            {
              "key": "engine",
              "value": "web-three"
            },
            {
              "key": "engineVersion",
              "value": "detected"
            },
            {
              "key": "profileId",
              "value": "harvest-frontier-web-three"
            }
          ],
          "durationMs": 0
        },
        "runtime": {
          "status": "environmentUnavailable",
          "message": "No web-three runtime runner was supplied; structural evidence only.",
          "evidence": [
            {
              "key": "engine",
              "value": "web-three"
            },
            {
              "key": "engineVersion",
              "value": "detected"
            },
            {
              "key": "profileId",
              "value": "harvest-frontier-web-three"
            }
          ],
          "durationMs": 0
        }
      },
      "findings": [
        {
          "id": "FORMAT-GLTF2:/asset",
          "severity": "INFO",
          "message": "GLB is a supported glTF 2.0 container.",
          "path": "/asset"
        },
        {
          "id": "GEO-MISSING-NORMALS:/meshes/*/primitives/*/attributes",
          "severity": "WARNING",
          "message": "One or more primitives do not provide NORMAL attributes.",
          "path": "/meshes/*/primitives/*/attributes"
        },
        {
          "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
          "severity": "WARNING",
          "message": "The asset contains non-unit node scales that may differ across engines.",
          "path": "/nodes/*/scale"
        }
      ],
      "qualityWarnings": [
        {
          "id": "quality-geo-missing-normals:/meshes/*/primitives/*/attributes",
          "domain": "model",
          "status": "NON_BLOCKING",
          "message": "One or more primitives do not provide NORMAL attributes.",
          "path": "/meshes/*/primitives/*/attributes"
        },
        {
          "id": "quality-scene-nonunit-scale:/nodes/*/scale",
          "domain": "model",
          "status": "NON_BLOCKING",
          "message": "The asset contains non-unit node scales that may differ across engines.",
          "path": "/nodes/*/scale"
        }
      ]
    },
    {
      "runId": "HF-M96-engine-pilot-r01:processing.line.m1.glb",
      "sourcePath": "C:\\Users\\50106\\Desktop\\Harvest Frontier\\public\\assets\\runtime\\processing.line.m1.glb",
      "sourceHash": "dc2de953592988384f2cd0fed87350b8f6d4226003567ab837fc06a09f305fed",
      "bytes": 435532,
      "assetKind": "3d-model",
      "targetProfileId": "harvest-frontier-web-three",
      "status": "ENVIRONMENT_UNAVAILABLE",
      "productionReady": false,
      "stages": {
        "bytes": {
          "status": "pass",
          "message": "Input bytes and target format were received.",
          "evidence": [
            {
              "key": "bytes",
              "value": 435532
            },
            {
              "key": "format",
              "value": "glb"
            },
            {
              "key": "sha256",
              "value": "dc2de953592988384f2cd0fed87350b8f6d4226003567ab837fc06a09f305fed"
            }
          ],
          "durationMs": 0
        },
        "structure": {
          "status": "pass",
          "message": "GLB/glTF structure parsed.",
          "evidence": [
            {
              "key": "analysisId",
              "value": "analysis-dc2de9535929-cdd6bcb7"
            },
            {
              "key": "resultDigest",
              "value": "cdd6bcb78069d6972142313d007ad572855279f72449eff748776f7174b67711"
            }
          ],
          "durationMs": 0
        },
        "policy": {
          "status": "pass",
          "message": "3D target policy has no blocking findings.",
          "evidence": [
            {
              "key": "score",
              "value": 99
            },
            {
              "key": "hardBlockerCount",
              "value": 0
            },
            {
              "key": "legacyRuleSetId",
              "value": "clunk-game-ready-v1"
            }
          ],
          "durationMs": 0
        },
        "import": {
          "status": "environmentUnavailable",
          "message": "No web-three import runner was supplied; structural evidence only.",
          "evidence": [
            {
              "key": "engine",
              "value": "web-three"
            },
            {
              "key": "engineVersion",
              "value": "detected"
            },
            {
              "key": "profileId",
              "value": "harvest-frontier-web-three"
            }
          ],
          "durationMs": 0
        },
        "runtime": {
          "status": "environmentUnavailable",
          "message": "No web-three runtime runner was supplied; structural evidence only.",
          "evidence": [
            {
              "key": "engine",
              "value": "web-three"
            },
            {
              "key": "engineVersion",
              "value": "detected"
            },
            {
              "key": "profileId",
              "value": "harvest-frontier-web-three"
            }
          ],
          "durationMs": 0
        }
      },
      "findings": [
        {
          "id": "FORMAT-GLTF2:/asset",
          "severity": "INFO",
          "message": "GLB is a supported glTF 2.0 container.",
          "path": "/asset"
        },
        {
          "id": "SCENE-EMPTY-NODES:/nodes",
          "severity": "WARNING",
          "message": "Identity-only nodes without a mesh, camera, skin, or child are present.",
          "path": "/nodes"
        },
        {
          "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
          "severity": "WARNING",
          "message": "The asset contains non-unit node scales that may differ across engines.",
          "path": "/nodes/*/scale"
        }
      ],
      "qualityWarnings": [
        {
          "id": "quality-scene-empty-nodes:/nodes",
          "domain": "model",
          "status": "NON_BLOCKING",
          "message": "Identity-only nodes without a mesh, camera, skin, or child are present.",
          "path": "/nodes"
        },
        {
          "id": "quality-scene-nonunit-scale:/nodes/*/scale",
          "domain": "model",
          "status": "NON_BLOCKING",
          "message": "The asset contains non-unit node scales that may differ across engines.",
          "path": "/nodes/*/scale"
        }
      ]
    },
    {
      "runId": "HF-M96-engine-pilot-r01:processing.line.m1.lod1.glb",
      "sourcePath": "C:\\Users\\50106\\Desktop\\Harvest Frontier\\public\\assets\\runtime\\processing.line.m1.lod1.glb",
      "sourceHash": "2605f6fa3f477b569566b4db9b371c5c87554221c61a5edbf10317e3f3e2ba49",
      "bytes": 199700,
      "assetKind": "3d-model",
      "targetProfileId": "harvest-frontier-web-three",
      "status": "ENVIRONMENT_UNAVAILABLE",
      "productionReady": false,
      "stages": {
        "bytes": {
          "status": "pass",
          "message": "Input bytes and target format were received.",
          "evidence": [
            {
              "key": "bytes",
              "value": 199700
            },
            {
              "key": "format",
              "value": "glb"
            },
            {
              "key": "sha256",
              "value": "2605f6fa3f477b569566b4db9b371c5c87554221c61a5edbf10317e3f3e2ba49"
            }
          ],
          "durationMs": 0
        },
        "structure": {
          "status": "pass",
          "message": "GLB/glTF structure parsed.",
          "evidence": [
            {
              "key": "analysisId",
              "value": "analysis-2605f6fa3f47-59d727a1"
            },
            {
              "key": "resultDigest",
              "value": "59d727a1cf0ce115fc167b140b3660f429e086b9c7b06112bb70c913c9f08b85"
            }
          ],
          "durationMs": 0
        },
        "policy": {
          "status": "pass",
          "message": "3D target policy has no blocking findings.",
          "evidence": [
            {
              "key": "score",
              "value": 99
            },
            {
              "key": "hardBlockerCount",
              "value": 0
            },
            {
              "key": "legacyRuleSetId",
              "value": "clunk-game-ready-v1"
            }
          ],
          "durationMs": 0
        },
        "import": {
          "status": "environmentUnavailable",
          "message": "No web-three import runner was supplied; structural evidence only.",
          "evidence": [
            {
              "key": "engine",
              "value": "web-three"
            },
            {
              "key": "engineVersion",
              "value": "detected"
            },
            {
              "key": "profileId",
              "value": "harvest-frontier-web-three"
            }
          ],
          "durationMs": 0
        },
        "runtime": {
          "status": "environmentUnavailable",
          "message": "No web-three runtime runner was supplied; structural evidence only.",
          "evidence": [
            {
              "key": "engine",
              "value": "web-three"
            },
            {
              "key": "engineVersion",
              "value": "detected"
            },
            {
              "key": "profileId",
              "value": "harvest-frontier-web-three"
            }
          ],
          "durationMs": 0
        }
      },
      "findings": [
        {
          "id": "FORMAT-GLTF2:/asset",
          "severity": "INFO",
          "message": "GLB is a supported glTF 2.0 container.",
          "path": "/asset"
        },
        {
          "id": "SCENE-EMPTY-NODES:/nodes",
          "severity": "WARNING",
          "message": "Identity-only nodes without a mesh, camera, skin, or child are present.",
          "path": "/nodes"
        },
        {
          "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
          "severity": "WARNING",
          "message": "The asset contains non-unit node scales that may differ across engines.",
          "path": "/nodes/*/scale"
        }
      ],
      "qualityWarnings": [
        {
          "id": "quality-scene-empty-nodes:/nodes",
          "domain": "model",
          "status": "NON_BLOCKING",
          "message": "Identity-only nodes without a mesh, camera, skin, or child are present.",
          "path": "/nodes"
        },
        {
          "id": "quality-scene-nonunit-scale:/nodes/*/scale",
          "domain": "model",
          "status": "NON_BLOCKING",
          "message": "The asset contains non-unit node scales that may differ across engines.",
          "path": "/nodes/*/scale"
        }
      ]
    },
    {
      "runId": "HF-M96-engine-pilot-r01:seeder.compact.m1.glb",
      "sourcePath": "C:\\Users\\50106\\Desktop\\Harvest Frontier\\public\\assets\\runtime\\seeder.compact.m1.glb",
      "sourceHash": "b5ece82b0c814ad8ac7c028a5d14303ee2e0da9462bb386c47fdc58000733570",
      "bytes": 557888,
      "assetKind": "3d-model",
      "targetProfileId": "harvest-frontier-web-three",
      "status": "ENVIRONMENT_UNAVAILABLE",
      "productionReady": false,
      "stages": {
        "bytes": {
          "status": "pass",
          "message": "Input bytes and target format were received.",
          "evidence": [
            {
              "key": "bytes",
              "value": 557888
            },
            {
              "key": "format",
              "value": "glb"
            },
            {
              "key": "sha256",
              "value": "b5ece82b0c814ad8ac7c028a5d14303ee2e0da9462bb386c47fdc58000733570"
            }
          ],
          "durationMs": 0
        },
        "structure": {
          "status": "pass",
          "message": "GLB/glTF structure parsed.",
          "evidence": [
            {
              "key": "analysisId",
              "value": "analysis-b5ece82b0c81-08408aa8"
            },
            {
              "key": "resultDigest",
              "value": "08408aa8c027a28eb0e3ac349a2d1b53f9180e5a9ea9e25c8cef030613f5678f"
            }
          ],
          "durationMs": 0
        },
        "policy": {
          "status": "pass",
          "message": "3D target policy has no blocking findings.",
          "evidence": [
            {
              "key": "score",
              "value": 99
            },
            {
              "key": "hardBlockerCount",
              "value": 0
            },
            {
              "key": "legacyRuleSetId",
              "value": "clunk-game-ready-v1"
            }
          ],
          "durationMs": 0
        },
        "import": {
          "status": "environmentUnavailable",
          "message": "No web-three import runner was supplied; structural evidence only.",
          "evidence": [
            {
              "key": "engine",
              "value": "web-three"
            },
            {
              "key": "engineVersion",
              "value": "detected"
            },
            {
              "key": "profileId",
              "value": "harvest-frontier-web-three"
            }
          ],
          "durationMs": 0
        },
        "runtime": {
          "status": "environmentUnavailable",
          "message": "No web-three runtime runner was supplied; structural evidence only.",
          "evidence": [
            {
              "key": "engine",
              "value": "web-three"
            },
            {
              "key": "engineVersion",
              "value": "detected"
            },
            {
              "key": "profileId",
              "value": "harvest-frontier-web-three"
            }
          ],
          "durationMs": 0
        }
      },
      "findings": [
        {
          "id": "FORMAT-GLTF2:/asset",
          "severity": "INFO",
          "message": "GLB is a supported glTF 2.0 container.",
          "path": "/asset"
        },
        {
          "id": "SCENE-EMPTY-NODES:/nodes",
          "severity": "WARNING",
          "message": "Identity-only nodes without a mesh, camera, skin, or child are present.",
          "path": "/nodes"
        },
        {
          "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
          "severity": "WARNING",
          "message": "The asset contains non-unit node scales that may differ across engines.",
          "path": "/nodes/*/scale"
        }
      ],
      "qualityWarnings": [
        {
          "id": "quality-scene-empty-nodes:/nodes",
          "domain": "model",
          "status": "NON_BLOCKING",
          "message": "Identity-only nodes without a mesh, camera, skin, or child are present.",
          "path": "/nodes"
        },
        {
          "id": "quality-scene-nonunit-scale:/nodes/*/scale",
          "domain": "model",
          "status": "NON_BLOCKING",
          "message": "The asset contains non-unit node scales that may differ across engines.",
          "path": "/nodes/*/scale"
        }
      ]
    },
    {
      "runId": "HF-M96-engine-pilot-r01:seeder.compact.m1.lod1.glb",
      "sourcePath": "C:\\Users\\50106\\Desktop\\Harvest Frontier\\public\\assets\\runtime\\seeder.compact.m1.lod1.glb",
      "sourceHash": "72a6937833549abf43ecaf498ee4e950d2c91b0c824488b894e7cab8aaf3667c",
      "bytes": 219100,
      "assetKind": "3d-model",
      "targetProfileId": "harvest-frontier-web-three",
      "status": "ENVIRONMENT_UNAVAILABLE",
      "productionReady": false,
      "stages": {
        "bytes": {
          "status": "pass",
          "message": "Input bytes and target format were received.",
          "evidence": [
            {
              "key": "bytes",
              "value": 219100
            },
            {
              "key": "format",
              "value": "glb"
            },
            {
              "key": "sha256",
              "value": "72a6937833549abf43ecaf498ee4e950d2c91b0c824488b894e7cab8aaf3667c"
            }
          ],
          "durationMs": 0
        },
        "structure": {
          "status": "pass",
          "message": "GLB/glTF structure parsed.",
          "evidence": [
            {
              "key": "analysisId",
              "value": "analysis-72a693783354-e459dc05"
            },
            {
              "key": "resultDigest",
              "value": "e459dc052490940d113ee64b937ffcc50b022fe4c733b0a86c42a4a13d4559ce"
            }
          ],
          "durationMs": 0
        },
        "policy": {
          "status": "pass",
          "message": "3D target policy has no blocking findings.",
          "evidence": [
            {
              "key": "score",
              "value": 99
            },
            {
              "key": "hardBlockerCount",
              "value": 0
            },
            {
              "key": "legacyRuleSetId",
              "value": "clunk-game-ready-v1"
            }
          ],
          "durationMs": 0
        },
        "import": {
          "status": "environmentUnavailable",
          "message": "No web-three import runner was supplied; structural evidence only.",
          "evidence": [
            {
              "key": "engine",
              "value": "web-three"
            },
            {
              "key": "engineVersion",
              "value": "detected"
            },
            {
              "key": "profileId",
              "value": "harvest-frontier-web-three"
            }
          ],
          "durationMs": 0
        },
        "runtime": {
          "status": "environmentUnavailable",
          "message": "No web-three runtime runner was supplied; structural evidence only.",
          "evidence": [
            {
              "key": "engine",
              "value": "web-three"
            },
            {
              "key": "engineVersion",
              "value": "detected"
            },
            {
              "key": "profileId",
              "value": "harvest-frontier-web-three"
            }
          ],
          "durationMs": 0
        }
      },
      "findings": [
        {
          "id": "FORMAT-GLTF2:/asset",
          "severity": "INFO",
          "message": "GLB is a supported glTF 2.0 container.",
          "path": "/asset"
        },
        {
          "id": "SCENE-EMPTY-NODES:/nodes",
          "severity": "WARNING",
          "message": "Identity-only nodes without a mesh, camera, skin, or child are present.",
          "path": "/nodes"
        },
        {
          "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
          "severity": "WARNING",
          "message": "The asset contains non-unit node scales that may differ across engines.",
          "path": "/nodes/*/scale"
        }
      ],
      "qualityWarnings": [
        {
          "id": "quality-scene-empty-nodes:/nodes",
          "domain": "model",
          "status": "NON_BLOCKING",
          "message": "Identity-only nodes without a mesh, camera, skin, or child are present.",
          "path": "/nodes"
        },
        {
          "id": "quality-scene-nonunit-scale:/nodes/*/scale",
          "domain": "model",
          "status": "NON_BLOCKING",
          "message": "The asset contains non-unit node scales that may differ across engines.",
          "path": "/nodes/*/scale"
        }
      ]
    },
    {
      "runId": "HF-M96-engine-pilot-r01:tractor.compact.m1.glb",
      "sourcePath": "C:\\Users\\50106\\Desktop\\Harvest Frontier\\public\\assets\\runtime\\tractor.compact.m1.glb",
      "sourceHash": "d92ae93240cc9b4d477df13cbddd0342738feb57ed9b8551e73d68fd83b3222c",
      "bytes": 680412,
      "assetKind": "3d-model",
      "targetProfileId": "harvest-frontier-web-three",
      "status": "ENVIRONMENT_UNAVAILABLE",
      "productionReady": false,
      "stages": {
        "bytes": {
          "status": "pass",
          "message": "Input bytes and target format were received.",
          "evidence": [
            {
              "key": "bytes",
              "value": 680412
            },
            {
              "key": "format",
              "value": "glb"
            },
            {
              "key": "sha256",
              "value": "d92ae93240cc9b4d477df13cbddd0342738feb57ed9b8551e73d68fd83b3222c"
            }
          ],
          "durationMs": 0
        },
        "structure": {
          "status": "pass",
          "message": "GLB/glTF structure parsed.",
          "evidence": [
            {
              "key": "analysisId",
              "value": "analysis-d92ae93240cc-0cd7d97b"
            },
            {
              "key": "resultDigest",
              "value": "0cd7d97bb3f8148a2b0d873a626d80b20fb4e2db796c4dd230ca48e3384bc9ed"
            }
          ],
          "durationMs": 0
        },
        "policy": {
          "status": "pass",
          "message": "3D target policy has no blocking findings.",
          "evidence": [
            {
              "key": "score",
              "value": 99
            },
            {
              "key": "hardBlockerCount",
              "value": 0
            },
            {
              "key": "legacyRuleSetId",
              "value": "clunk-game-ready-v1"
            }
          ],
          "durationMs": 0
        },
        "import": {
          "status": "environmentUnavailable",
          "message": "No web-three import runner was supplied; structural evidence only.",
          "evidence": [
            {
              "key": "engine",
              "value": "web-three"
            },
            {
              "key": "engineVersion",
              "value": "detected"
            },
            {
              "key": "profileId",
              "value": "harvest-frontier-web-three"
            }
          ],
          "durationMs": 0
        },
        "runtime": {
          "status": "environmentUnavailable",
          "message": "No web-three runtime runner was supplied; structural evidence only.",
          "evidence": [
            {
              "key": "engine",
              "value": "web-three"
            },
            {
              "key": "engineVersion",
              "value": "detected"
            },
            {
              "key": "profileId",
              "value": "harvest-frontier-web-three"
            }
          ],
          "durationMs": 0
        }
      },
      "findings": [
        {
          "id": "FORMAT-GLTF2:/asset",
          "severity": "INFO",
          "message": "GLB is a supported glTF 2.0 container.",
          "path": "/asset"
        },
        {
          "id": "GEO-MISSING-NORMALS:/meshes/*/primitives/*/attributes",
          "severity": "WARNING",
          "message": "One or more primitives do not provide NORMAL attributes.",
          "path": "/meshes/*/primitives/*/attributes"
        },
        {
          "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
          "severity": "WARNING",
          "message": "The asset contains non-unit node scales that may differ across engines.",
          "path": "/nodes/*/scale"
        }
      ],
      "qualityWarnings": [
        {
          "id": "quality-geo-missing-normals:/meshes/*/primitives/*/attributes",
          "domain": "model",
          "status": "NON_BLOCKING",
          "message": "One or more primitives do not provide NORMAL attributes.",
          "path": "/meshes/*/primitives/*/attributes"
        },
        {
          "id": "quality-scene-nonunit-scale:/nodes/*/scale",
          "domain": "model",
          "status": "NON_BLOCKING",
          "message": "The asset contains non-unit node scales that may differ across engines.",
          "path": "/nodes/*/scale"
        }
      ]
    },
    {
      "runId": "HF-M96-engine-pilot-r01:tractor.compact.m1.lod1.glb",
      "sourcePath": "C:\\Users\\50106\\Desktop\\Harvest Frontier\\public\\assets\\runtime\\tractor.compact.m1.lod1.glb",
      "sourceHash": "5b457fc118613961793662111a3e69b75c7200c25f89368d3fb44841a056cf5f",
      "bytes": 509584,
      "assetKind": "3d-model",
      "targetProfileId": "harvest-frontier-web-three",
      "status": "ENVIRONMENT_UNAVAILABLE",
      "productionReady": false,
      "stages": {
        "bytes": {
          "status": "pass",
          "message": "Input bytes and target format were received.",
          "evidence": [
            {
              "key": "bytes",
              "value": 509584
            },
            {
              "key": "format",
              "value": "glb"
            },
            {
              "key": "sha256",
              "value": "5b457fc118613961793662111a3e69b75c7200c25f89368d3fb44841a056cf5f"
            }
          ],
          "durationMs": 0
        },
        "structure": {
          "status": "pass",
          "message": "GLB/glTF structure parsed.",
          "evidence": [
            {
              "key": "analysisId",
              "value": "analysis-5b457fc11861-5b291985"
            },
            {
              "key": "resultDigest",
              "value": "5b291985520e5635559f9a32c1b0485776c68dc520b73bfcf8cd21ae4c376bf6"
            }
          ],
          "durationMs": 0
        },
        "policy": {
          "status": "pass",
          "message": "3D target policy has no blocking findings.",
          "evidence": [
            {
              "key": "score",
              "value": 99
            },
            {
              "key": "hardBlockerCount",
              "value": 0
            },
            {
              "key": "legacyRuleSetId",
              "value": "clunk-game-ready-v1"
            }
          ],
          "durationMs": 0
        },
        "import": {
          "status": "environmentUnavailable",
          "message": "No web-three import runner was supplied; structural evidence only.",
          "evidence": [
            {
              "key": "engine",
              "value": "web-three"
            },
            {
              "key": "engineVersion",
              "value": "detected"
            },
            {
              "key": "profileId",
              "value": "harvest-frontier-web-three"
            }
          ],
          "durationMs": 0
        },
        "runtime": {
          "status": "environmentUnavailable",
          "message": "No web-three runtime runner was supplied; structural evidence only.",
          "evidence": [
            {
              "key": "engine",
              "value": "web-three"
            },
            {
              "key": "engineVersion",
              "value": "detected"
            },
            {
              "key": "profileId",
              "value": "harvest-frontier-web-three"
            }
          ],
          "durationMs": 0
        }
      },
      "findings": [
        {
          "id": "FORMAT-GLTF2:/asset",
          "severity": "INFO",
          "message": "GLB is a supported glTF 2.0 container.",
          "path": "/asset"
        },
        {
          "id": "GEO-MISSING-NORMALS:/meshes/*/primitives/*/attributes",
          "severity": "WARNING",
          "message": "One or more primitives do not provide NORMAL attributes.",
          "path": "/meshes/*/primitives/*/attributes"
        },
        {
          "id": "SCENE-NONUNIT-SCALE:/nodes/*/scale",
          "severity": "WARNING",
          "message": "The asset contains non-unit node scales that may differ across engines.",
          "path": "/nodes/*/scale"
        }
      ],
      "qualityWarnings": [
        {
          "id": "quality-geo-missing-normals:/meshes/*/primitives/*/attributes",
          "domain": "model",
          "status": "NON_BLOCKING",
          "message": "One or more primitives do not provide NORMAL attributes.",
          "path": "/meshes/*/primitives/*/attributes"
        },
        {
          "id": "quality-scene-nonunit-scale:/nodes/*/scale",
          "domain": "model",
          "status": "NON_BLOCKING",
          "message": "The asset contains non-unit node scales that may differ across engines.",
          "path": "/nodes/*/scale"
        }
      ]
    }
  ],
  "visualRuntime": "NOT_EVALUATED",
  "playerFacing": "NOT_EVALUATED",
  "readiness": "SCENE_GAP",
  "productionReady": false,
  "readOnlyVerification": {
    "before": {
      "head": "82459216c618a15f7588f57003e5f4f4ee99f40a",
      "status": "## master\n M .logs/screenshots/M77/HF-M77-inv-camera-clearance-barn-behind.png\n M .logs/screenshots/M77/HF-M77-inv-camera-clearance-chrome-webgl2.png\n M .logs/screenshots/M77/HF-M77-inv-camera-clearance-dealer.png\n M .logs/screenshots/M77/HF-M77-inv-camera-clearance-market-counter.png\n M .logs/screenshots/M77/HF-M77-inv-camera-clearance-market-stall.png\n M .logs/screenshots/M77/HF-M77-inv-camera-clearance-orchard-tree.png\n M .logs/screenshots/M77/HF-M77-inv-mechanization-chrome-webgl2.png\n M .logs/screenshots/M77/HF-M77-inv-mechanization-final-mech-state.png\n M .logs/screenshots/M77/HF-M77-inv-mechanization-t2-push-tilling.png\n M .logs/screenshots/M77/HF-M77-inv-mechanization-t3-cultivator-row.png\n M .logs/screenshots/M77/HF-M77-inv-mechanization-t4-seeder-row.png\n M .logs/screenshots/M77/HF-M77-inv-onboarding-chrome-webgl2.png\n M .logs/screenshots/M77/HF-M77-inv-save-durability-chrome-webgl2.png\n M .logs/screenshots/M77/HF-M77-inv-tile-farming-chrome-webgl2.png\n M .logs/screenshots/M77/HF-M77-inv-tile-farming-f2-worked-row.png\n M .logs/screenshots/M77/HF-M77-inv-tile-farming-f3-wet-vs-dry.png\n M .logs/screenshots/M77/HF-M77-inv-tile-farming-n3-row-walk-1.png\n M .logs/screenshots/M77/HF-M77-inv-tile-farming-n3-row-walk-2.png\n M .logs/screenshots/M77/HF-M77-inv-tile-farming-n3-row-walk-3.png\n M .logs/screenshots/M77/HF-M77-inv-tile-farming-n4-night-2330-field.png\n M .logs/screenshots/M77/HF-M77-inv-tile-farming-tile-farming-webgl2.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-chrome-webgl2.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-credits-scrolled.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-credits.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-field-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-hud-1600x900.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-inventory-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-journal-crop-row.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-map-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-market-scrolled.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-minimap-closeup.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-progression-scrolled.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-quests-1280x720-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-quests-1920x1080-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-quests-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-seed-shelf.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-settings-scrolled.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-settings.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-varieties-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-worst-1280x720.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-worst-1600x900-tutorial.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-worst-1600x900.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-worst-1920x1080.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-chrome-webgl2.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-credits-scrolled.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-credits.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-field-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-hud-1600x900.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-inventory-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-journal-crop-row.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-map-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-market-scrolled.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-minimap-closeup.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-progression-scrolled.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-quests-1280x720-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-quests-1920x1080-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-quests-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-seed-shelf.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-settings-scrolled.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-settings.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-varieties-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-worst-1280x720.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-worst-1600x900-tutorial.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-worst-1600x900.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-worst-1920x1080.png\n M .logs/screenshots/M89/HF-M89-field-door-after-work.png\n M .logs/screenshots/M89/HF-M89-field-door-before.png\n M .logs/screenshots/M89/HF-M89-field-door-door.png\n M .logs/verification/M77/HF-M77-inv-camera-clearance.json\n M .logs/verification/M77/HF-M77-inv-mechanization.json\n M .logs/verification/M77/HF-M77-inv-onboarding.json\n M .logs/verification/M77/HF-M77-inv-save-durability.json\n M .logs/verification/M77/HF-M77-inv-tile-farming.json\n M .logs/verification/M77/HF-M77-inv-ui-layout-en.json\n M .logs/verification/M77/HF-M77-inv-ui-layout-ko.json\n M .logs/verification/M77/HF-M77-invariant-set.json\n M .logs/verification/M79/HF-M79-audio-measurements-r01.json\n M src/app/gameSession.ts\n M tools/playwright/m84-chain.cjs\n?? .codex/\n?? .logs/audio/M93/\n?? .logs/audio/M94/\n?? .logs/screenshots/M55/HF-M55-20260823T095330720Z-gameplay-webgl2-chrome-webgl2.png\n?? .logs/screenshots/M55/HF-M55-20260823T095330720Z-gameplay-webgl2-water-action-webgl2.png\n?? .logs/screenshots/M55/HF-M55-20260823T105713530Z-gameplay-webgl2-chrome-webgl2.png\n?? .logs/screenshots/M55/HF-M55-20260823T105713530Z-gameplay-webgl2-water-action-webgl2.png\n?? .logs/screenshots/M55/HF-M55-20260823T111219445Z-gameplay-webgl2-chrome-webgl2.png\n?? .logs/screenshots/M55/HF-M55-20260823T111219445Z-gameplay-webgl2-water-action-webgl2.png\n?? .logs/screenshots/M77/HF-M77-inv-day-labour-save-ko-chrome-webgl2.png\n?? .logs/screenshots/M85/\n?? .logs/screenshots/M86/\n?? .logs/screenshots/M87/HF-M87-20260823T1715Z-croplab-chrome-webgl2.png\n?? .logs/screenshots/M87/HF-M87-20260823T1730Z-croplab-chrome-webgl2.png\n?? .logs/screenshots/M87/HF-M87-20260823T1745Z-croplab-chrome-webgl2.png\n?? .logs/screenshots/M87/HF-M87-20260823T1810Z-croplab-r2-chrome-webgpu.png\n?? .logs/screenshots/M87/HF-M87-20260823T1830Z-croplab-r3-chrome-webgpu.png\n?? .logs/screenshots/M87/HF-M87-20260823T1840Z-croplab-r3-cherry-chrome-webgpu.png\n?? .logs/screenshots/M87/HF-M87-20260823T1850Z-croplab-r4-cherry-chrome-webgpu.png\n?? .logs/screenshots/M87/HF-M87-20260823T1900Z-croplab-final-chrome-webgpu.png\n?? .logs/screenshots/M87/croplab/HF-M87-20260823T0907Z-croplab-r5/\n?? .logs/screenshots/M87/croplab/HF-M87-20260823T0940Z-croplab-r6-burial/\n?? .logs/screenshots/M87/croplab/HF-M87-20260823T1715Z-croplab/\n?? .logs/screenshots/M87/croplab/HF-M87-20260823T1730Z-croplab/\n?? .logs/screenshots/M87/croplab/HF-M87-20260823T1745Z-croplab/\n?? .logs/screenshots/M87/croplab/HF-M87-20260823T1810Z-croplab-r2/\n?? .logs/screenshots/M87/croplab/HF-M87-20260823T1830Z-croplab-r3/\n?? .logs/screenshots/M87/croplab/HF-M87-20260823T1840Z-croplab-r3-cherry/\n?? .logs/screenshots/M87/croplab/HF-M87-20260823T1850Z-croplab-r4-cherry/\n?? .logs/screenshots/M87/croplab/HF-M87-20260823T1900Z-croplab-final/\n?? .logs/screenshots/M87/world/HF-M87-20260823T0915Z-world-r5-final-webgpu/\n?? .logs/screenshots/M87/world/HF-M87-20260823T0920Z-world-r5-final-webgpu/\n?? .logs/screenshots/M87/world/HF-M87-20260823T0930Z-world-r6-standard-webgpu-centerfix/\n?? .logs/screenshots/M87/world/HF-M87-20260823T0935Z-world-r5-standard-webgpu/\n?? .logs/screenshots/M87/world/HF-M87-20260823T0945Z-world-r5-standard-webgpu-final/\n?? .logs/screenshots/M87/world/HF-M87-20260823T1015Z-world-r5-standard-webgpu-postfix/\n?? .logs/screenshots/M87/world/HF-M87-20260823T1028Z-world-r5-standard-webgpu-framing/\n?? .logs/screenshots/M87/world/HF-M87-20260823T1915Z-world-r4-final/\n?? .logs/screenshots/M87/world/HF-M87-20260823T1920Z-world-r4-final/\n?? .logs/screenshots/M87/world/HF-M87-20260823T1930Z-world-r4-final/\n?? .logs/screenshots/M87/world/HF-M87-20260823T1940Z-world-r4-debug/\n?? .logs/screenshots/M87/world/HF-M87-20260823T1950Z-world-r4-final/\n?? .logs/screenshots/M87/world/HF-M87-20260823T2000Z-world-r4-final/\n?? .logs/screenshots/M87/world/HF-M87-20260823T2010Z-world-r4-final/\n?? .logs/screenshots/M87/world/HF-M87-20260823T2030Z-world-r4-final-webgpu/\n?? .logs/screenshots/M87/world/HF-M87-20260823T2050Z-world-r4-final-webgpu/\n?? .logs/screenshots/M88/characters/HF-M88-character-world-webgpu-r01/\n?? .logs/screenshots/M88/characters/HF-M88-character-world-webgpu-r02/\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-credits-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-credits.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-field-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-hud-1600x900.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-inventory-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-journal-crop-row.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-map-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-market-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-minimap-closeup.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-progression-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-quests-1280x720-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-quests-1920x1080-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-quests-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-seed-shelf.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-settings-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-settings.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-varieties-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-worst-1280x720.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-worst-1600x900-tutorial.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-worst-1600x900.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-worst-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-credits-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-credits.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-field-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-hud-1600x900.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-inventory-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-journal-crop-row.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-market-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-minimap-closeup.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-progression-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-quests-1280x720-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-quests-1920x1080-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-quests-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-seed-shelf.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-settings-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-settings.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-varieties-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-worst-1280x720.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-worst-1600x900-tutorial.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-worst-1600x900.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-worst-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-credits-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-credits.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-field-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-hud-1600x900.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-inventory-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-journal-crop-row.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-map-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-market-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-minimap-closeup.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-progression-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-quests-1280x720-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-quests-1920x1080-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-quests-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-seed-shelf.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-settings-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-settings.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-varieties-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-worst-1280x720.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-worst-1600x900-tutorial.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-worst-1600x900.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-worst-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-credits-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-credits.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-field-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-hud-1600x900.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-inventory-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-journal-crop-row.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-market-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-minimap-closeup.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-progression-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-quests-1280x720-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-quests-1920x1080-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-quests-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-seed-shelf.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-settings-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-settings.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-varieties-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-worst-1280x720.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-worst-1600x900-tutorial.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-worst-1600x900.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-worst-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-field-door-webgl2-r02-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-en-webgpu-r02-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-en-webgpu-r02-en-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-en-webgpu-r03-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-en-webgpu-r03-en-quest-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-en-webgpu-r03-en-tutorial-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-en-webgpu-r04-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-en-webgpu-r04-en-quest-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-en-webgpu-r04-en-tutorial-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-ko-webgpu-r02-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-ko-webgpu-r02-ko-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-ko-webgpu-r03-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-ko-webgpu-r03-ko-quest-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-ko-webgpu-r03-ko-tutorial-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-ko-webgpu-r04-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-ko-webgpu-r04-ko-quest-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-ko-webgpu-r04-ko-tutorial-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-en-webgpu-r01-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-en-webgpu-r01-en-quest-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-en-webgpu-r01-en-tutorial-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-ko-webgpu-r01-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-ko-webgpu-r01-ko-quest-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-ko-webgpu-r01-ko-tutorial-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-webgl2-en-r01-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-webgl2-en-r01-en-quest-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-webgl2-en-r01-en-tutorial-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-webgl2-ko-r02-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-webgl2-ko-r02-ko-quest-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-webgl2-ko-r02-ko-tutorial-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-readable-en-webgl2-r01-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-hud-readable-en-webgpu-r01-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-hud-readable-ko-webgl2-r01-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-hud-readable-ko-webgpu-r01-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-hud-red-ko-webgpu-r01-ko-quest-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-red-ko-webgpu-r01-ko-tutorial-1280x720.png\n?? .logs/screenshots/M89/HF-M89-preserve-en-webgl2-r01-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-preserve-en-webgl2-r01-en-1600x900.png\n?? .logs/screenshots/M89/HF-M89-preserve-en-webgl2-r01-en-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-preserve-ko-webgl2-r01-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-preserve-ko-webgl2-r01-ko-1600x900.png\n?? .logs/screenshots/M89/HF-M89-preserve-ko-webgl2-r01-ko-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-preserve-readable-en-webgl2-r02-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-preserve-readable-en-webgl2-r02-en-1600x900.png\n?? .logs/screenshots/M89/HF-M89-preserve-readable-en-webgl2-r02-en-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-preserve-readable-ko-webgl2-r02-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-preserve-readable-ko-webgl2-r02-ko-1600x900.png\n?? .logs/screenshots/M89/HF-M89-preserve-readable-ko-webgl2-r02-ko-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-tile-farming-webgl2-r01-f2-worked-row.png\n?? .logs/screenshots/M89/HF-M89-tile-farming-webgl2-r01-f3-wet-vs-dry.png\n?? .logs/screenshots/M89/HF-M89-tile-farming-webgl2-r01-n3-row-walk-1.png\n?? .logs/screenshots/M89/HF-M89-tile-farming-webgl2-r01-n3-row-walk-2.png\n?? .logs/screenshots/M89/HF-M89-tile-farming-webgl2-r01-n3-row-walk-3.png\n?? .logs/screenshots/M89/HF-M89-tile-farming-webgl2-r01-n4-night-2330-field.png\n?? .logs/screenshots/M89/HF-M89-tile-farming-webgl2-r01-tile-farming-webgl2.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-field-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-inventory-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-journal-crop-row.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-market-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-minimap-closeup.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-progression-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-quests-1280x720-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-quests-1920x1080-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-quests-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-seed-shelf.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-varieties-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-worst-1280x720.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-worst-1600x900-tutorial.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-worst-1600x900.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-worst-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-credits-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-credits.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-field-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-hud-1600x900.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-inventory-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-journal-crop-row.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-map-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-market-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-minimap-closeup.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-progression-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-quests-1280x720-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-quests-1920x1080-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-quests-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-seed-shelf.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-settings-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-settings.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-varieties-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-worst-1280x720.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-worst-1600x900-tutorial.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-worst-1600x900.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-worst-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-credits-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-credits.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-field-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-hud-1600x900.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-inventory-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-journal-crop-row.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-map-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-market-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-minimap-closeup.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-progression-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-quests-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-seed-shelf.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-settings-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-settings.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-varieties-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-worst-1600x900-tutorial.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-worst-1600x900.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-credits-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-credits.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-field-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-hud-1600x900.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-inventory-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-journal-crop-row.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-map-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-market-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-minimap-closeup.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-progression-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-quests-1280x720-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-quests-1920x1080-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-quests-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-seed-shelf.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-settings-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-settings.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-varieties-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-worst-1280x720.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-worst-1600x900-tutorial.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-worst-1600x900.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-worst-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-credits-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-credits.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-field-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-hud-1600x900.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-inventory-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-journal-crop-row.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-map-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-market-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-minimap-closeup.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-progression-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-quests-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-seed-shelf.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-settings-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-settings.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-varieties-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-worst-1600x900-tutorial.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-worst-1600x900.png\n?? .logs/screenshots/M90/\n?? .logs/screenshots/M91/\n?? .logs/screenshots/M92/\n?? .logs/screenshots/M93/\n?? .logs/screenshots/M94/\n?? .logs/screenshots/M95/\n?? .logs/screenshots/M96/\n?? .logs/screenshots/M97/\n?? .logs/screenshots/M98/\n?? .logs/verification/M55/HF-M55-20260823T074220804Z-gameplay-webgl2.json\n?? .logs/verification/M55/HF-M55-20260823T074234850Z-gameplay-webgl2.json\n?? .logs/verification/M55/HF-M55-20260823T095330720Z-gameplay-webgl2.json\n?? .logs/verification/M55/HF-M55-20260823T105713530Z-gameplay-webgl2.json\n?? .logs/verification/M55/HF-M55-20260823T111219445Z-gameplay-webgl2.json\n?? .logs/verification/M77/HF-M77-inv-day-labour-save-ko.json\n?? .logs/verification/M85/\n?? .logs/verification/M86/\n?? .logs/verification/M87/HF-M87-20260823T1715Z-croplab.json\n?? .logs/verification/M87/HF-M87-20260823T1730Z-croplab.json\n?? .logs/verification/M87/HF-M87-20260823T1745Z-croplab.json\n?? .logs/verification/M87/HF-M87-20260823T1810Z-croplab-r2.json\n?? .logs/verification/M87/HF-M87-20260823T1830Z-croplab-r3.json\n?? .logs/verification/M87/HF-M87-20260823T1840Z-croplab-r3-cherry.json\n?? .logs/verification/M87/HF-M87-20260823T1850Z-croplab-r4-cherry.json\n?? .logs/verification/M87/HF-M87-20260823T1900Z-croplab-final.json\n?? .logs/verification/M87/HF-M87-20260823T1915Z-world-r4-final.json\n?? .logs/verification/M87/HF-M87-20260823T1920Z-world-r4-final.json\n?? .logs/verification/M87/HF-M87-20260823T1930Z-world-r4-final.json\n?? .logs/verification/M87/HF-M87-20260823T1940Z-world-r4-debug.json\n?? .logs/verification/M87/HF-M87-20260823T1950Z-world-r4-final.json\n?? .logs/verification/M87/HF-M87-20260823T2000Z-world-r4-final.json\n?? .logs/verification/M87/HF-M87-20260823T2010Z-world-r4-final.json\n?? .logs/verification/M87/HF-M87-20260823T2030Z-world-r4-final-webgpu.json\n?? .logs/verification/M87/HF-M87-20260823T2050Z-world-r4-final-webgpu.json\n?? .logs/verification/M88/HF-M88-character-world-webgpu-r01.json\n?? .logs/verification/M88/HF-M88-character-world-webgpu-r02.json\n?? .logs/verification/M88/HF-M88-character-world-webgpu-r03.json\n?? .logs/verification/M89/HF-M89-farm-map-en-webgl2-r01.json\n?? .logs/verification/M89/HF-M89-farm-map-ko-webgl2-r01.json\n?? .logs/verification/M89/HF-M89-field-door-webgl2-r01.json\n?? .logs/verification/M89/HF-M89-field-door-webgl2-r02.json\n?? .logs/verification/M89/HF-M89-field-door-webgl2-r03.json\n?? .logs/verification/M89/HF-M89-field-door-webgpu-r01.json\n?? .logs/verification/M89/HF-M89-field-door-webgpu-r02.json\n?? .logs/verification/M89/HF-M89-field-door-webgpu-r03.json\n?? .logs/verification/M89/HF-M89-hud-baseline-en-webgpu-r01.json\n?? .logs/verification/M89/HF-M89-hud-baseline-en-webgpu-r02.json\n?? .logs/verification/M89/HF-M89-hud-baseline-en-webgpu-r03.json\n?? .logs/verification/M89/HF-M89-hud-baseline-en-webgpu-r04.json\n?? .logs/verification/M89/HF-M89-hud-baseline-ko-webgpu-r01.json\n?? .logs/verification/M89/HF-M89-hud-baseline-ko-webgpu-r02.json\n?? .logs/verification/M89/HF-M89-hud-baseline-ko-webgpu-r03.json\n?? .logs/verification/M89/HF-M89-hud-baseline-ko-webgpu-r04.json\n?? .logs/verification/M89/HF-M89-hud-compact-en-webgpu-r01.json\n?? .logs/verification/M89/HF-M89-hud-compact-ko-webgpu-r01.json\n?? .logs/verification/M89/HF-M89-hud-compact-webgl2-en-r01.json\n?? .logs/verification/M89/HF-M89-hud-compact-webgl2-ko-r01.json\n?? .logs/verification/M89/HF-M89-hud-compact-webgl2-ko-r02.json\n?? .logs/verification/M89/HF-M89-hud-red-ko-webgpu-r01.json\n?? .logs/verification/M89/HF-M89-preserve-en-webgl2-r01.json\n?? .logs/verification/M89/HF-M89-preserve-ko-webgl2-r01.json\n?? .logs/verification/M89/HF-M89-ui-layout-diag-ko-webgl2-r02.json\n?? .logs/verification/M89/HF-M89-ui-layout-final-en-webgl2-r03.json\n?? .logs/verification/M89/HF-M89-ui-layout-final-en-webgl2-r04.json\n?? .logs/verification/M89/HF-M89-ui-layout-final-ko-webgl2-r01.json\n?? .logs/verification/M89/HF-M89-ui-preserve-en-webgl2-r01.json\n?? .logs/verification/M89/HF-M89-ui-preserve-ko-webgl2-r01.json\n?? .logs/verification/M89/HF-M89-ui-preserve-ko-webgl2-r02.json\n?? .logs/verification/M90/\n?? .logs/verification/M91/\n?? .logs/verification/M92/\n?? .logs/verification/M93/\n?? .logs/verification/M94/\n?? .logs/verification/M95/\n?? .logs/verification/M96/\n?? .logs/verification/M97/\n?? .logs/verification/M98/\n?? output/charpreview/latest/\n?? src/app/cameraComposition.ts\n?? tests/cameraComposition.test.ts\n?? tools/playwright/m85-crop-lab-flow.js\n?? tools/playwright/m86-probe-flow.js\n?? tools/playwright/m86-probe2-flow.js\n?? tools/playwright/m87-cherry-review-flow.js\n?? tools/playwright/m93-shipped-visual-flow.js\n?? tools/playwright/m94-audio-focus.cjs",
      "diffStat": ".../HF-M77-inv-camera-clearance-barn-behind.png    |  Bin 2250223 -> 2376653 bytes\n .../HF-M77-inv-camera-clearance-chrome-webgl2.png  |  Bin 2309425 -> 2682072 bytes\n .../M77/HF-M77-inv-camera-clearance-dealer.png     |  Bin 2086807 -> 2125720 bytes\n .../HF-M77-inv-camera-clearance-market-counter.png |  Bin 595768 -> 593722 bytes\n .../HF-M77-inv-camera-clearance-market-stall.png   |  Bin 1448790 -> 1525377 bytes\n .../HF-M77-inv-camera-clearance-orchard-tree.png   |  Bin 2153122 -> 2657849 bytes\n .../M77/HF-M77-inv-mechanization-chrome-webgl2.png |  Bin 1904031 -> 1943285 bytes\n .../HF-M77-inv-mechanization-final-mech-state.png  |  Bin 1953143 -> 1980102 bytes\n .../HF-M77-inv-mechanization-t2-push-tilling.png   |  Bin 1805265 -> 1823502 bytes\n .../HF-M77-inv-mechanization-t3-cultivator-row.png |  Bin 1847500 -> 1874821 bytes\n .../M77/HF-M77-inv-mechanization-t4-seeder-row.png |  Bin 1839629 -> 1869723 bytes\n .../M77/HF-M77-inv-onboarding-chrome-webgl2.png    |  Bin 1805752 -> 1832721 bytes\n .../HF-M77-inv-save-durability-chrome-webgl2.png   |  Bin 1825340 -> 1785713 bytes\n .../M77/HF-M77-inv-tile-farming-chrome-webgl2.png  |  Bin 1707644 -> 1722870 bytes\n .../M77/HF-M77-inv-tile-farming-f2-worked-row.png  |  Bin 1808183 -> 1795936 bytes\n .../M77/HF-M77-inv-tile-farming-f3-wet-vs-dry.png  |  Bin 1836440 -> 1855206 bytes\n .../M77/HF-M77-inv-tile-farming-n3-row-walk-1.png  |  Bin 1822150 -> 1834205 bytes\n .../M77/HF-M77-inv-tile-farming-n3-row-walk-2.png  |  Bin 1867854 -> 1906017 bytes\n .../M77/HF-M77-inv-tile-farming-n3-row-walk-3.png  |  Bin 1874187 -> 1930501 bytes\n ...HF-M77-inv-tile-farming-n4-night-2330-field.png |  Bin 1351197 -> 1373675 bytes\n ...HF-M77-inv-tile-farming-tile-farming-webgl2.png |  Bin 1706159 -> 1717638 bytes\n .../M77/HF-M77-inv-ui-layout-en-chrome-webgl2.png  |  Bin 1655121 -> 1721057 bytes\n ...HF-M77-inv-ui-layout-en-en-credits-scrolled.png |  Bin 356019 -> 352602 bytes\n .../M77/HF-M77-inv-ui-layout-en-en-credits.png     |  Bin 396502 -> 392586 bytes\n .../M77/HF-M77-inv-ui-layout-en-en-field-panel.png |  Bin 1553230 -> 1659695 bytes\n .../HF-M77-inv-ui-layout-en-en-hud-1600x900.png    |  Bin 1655019 -> 1721181 bytes\n .../HF-M77-inv-ui-layout-en-en-inventory-panel.png |  Bin 1647085 -> 1686741 bytes\n ...HF-M77-inv-ui-layout-en-en-journal-crop-row.png |  Bin 83624 -> 82098 bytes\n .../M77/HF-M77-inv-ui-layout-en-en-map-panel.png   |  Bin 1496454 -> 1618970 bytes\n .../HF-M77-inv-ui-layout-en-en-market-scrolled.png |  Bin 1556753 -> 1652360 bytes\n .../HF-M77-inv-ui-layout-en-en-minimap-closeup.png |  Bin 21614 -> 24842 bytes\n ...77-inv-ui-layout-en-en-progression-scrolled.png |  Bin 1577076 -> 1670463 bytes\n ...7-inv-ui-layout-en-en-quests-1280x720-panel.png |  Bin 981504 -> 1063176 bytes\n ...-inv-ui-layout-en-en-quests-1920x1080-panel.png |  Bin 2342714 -> 2466477 bytes\n .../HF-M77-inv-ui-layout-en-en-quests-panel.png    |  Bin 1580409 -> 1677088 bytes\n .../M77/HF-M77-inv-ui-layout-en-en-seed-shelf.png  |  Bin 118876 -> 117780 bytes\n ...F-M77-inv-ui-layout-en-en-settings-scrolled.png |  Bin 1555935 -> 1645060 bytes\n .../M77/HF-M77-inv-ui-layout-en-en-settings.png    |  Bin 1555660 -> 1647434 bytes\n .../HF-M77-inv-ui-layout-en-en-varieties-panel.png |  Bin 1640536 -> 1682911 bytes\n .../HF-M77-inv-ui-layout-en-en-worst-1280x720.png  |  Bin 1056353 -> 1110678 bytes\n ...inv-ui-layout-en-en-worst-1600x900-tutorial.png |  Bin 1657507 -> 1738278 bytes\n .../HF-M77-inv-ui-layout-en-en-worst-1600x900.png  |  Bin 1654004 -> 1721860 bytes\n .../HF-M77-inv-ui-layout-en-en-worst-1920x1080.png |  Bin 2418121 -> 2560155 bytes\n .../M77/HF-M77-inv-ui-layout-ko-chrome-webgl2.png  |  Bin 1651287 -> 1724282 bytes\n .../HF-M77-inv-ui-layout-ko-credits-scrolled.png   |  Bin 347492 -> 346498 bytes\n .../M77/HF-M77-inv-ui-layout-ko-credits.png        |  Bin 386437 -> 385225 bytes\n .../M77/HF-M77-inv-ui-layout-ko-field-panel.png    |  Bin 1549555 -> 1659019 bytes\n .../M77/HF-M77-inv-ui-layout-ko-hud-1600x900.png   |  Bin 1653316 -> 1722076 bytes\n .../HF-M77-inv-ui-layout-ko-inventory-panel.png    |  Bin 1653226 -> 1677449 bytes\n .../HF-M77-inv-ui-layout-ko-journal-crop-row.png   |  Bin 77099 -> 76363 bytes\n .../M77/HF-M77-inv-ui-layout-ko-map-panel.png      |  Bin 1503099 -> 1609626 bytes\n .../HF-M77-inv-ui-layout-ko-market-scrolled.png    |  Bin 1547680 -> 1639603 bytes\n .../HF-M77-inv-ui-layout-ko-minimap-closeup.png    |  Bin 21964 -> 24841 bytes\n ...F-M77-inv-ui-layout-ko-progression-scrolled.png |  Bin 1566413 -> 1653528 bytes\n ...-M77-inv-ui-layout-ko-quests-1280x720-panel.png |  Bin 974745 -> 1052237 bytes\n ...M77-inv-ui-layout-ko-quests-1920x1080-panel.png |  Bin 2331513 -> 2449649 bytes\n .../M77/HF-M77-inv-ui-layout-ko-quests-panel.png   |  Bin 1568842 -> 1662571 bytes\n .../M77/HF-M77-inv-ui-layout-ko-seed-shelf.png     |  Bin 95911 -> 96171 bytes\n .../HF-M77-inv-ui-layout-ko-settings-scrolled.png  |  Bin 1553703 -> 1632767 bytes\n .../M77/HF-M77-inv-ui-layout-ko-settings.png       |  Bin 1553106 -> 1633884 bytes\n .../HF-M77-inv-ui-layout-ko-varieties-panel.png    |  Bin 1645934 -> 1672870 bytes\n .../M77/HF-M77-inv-ui-layout-ko-worst-1280x720.png |  Bin 1052198 -> 1108614 bytes\n ...77-inv-ui-layout-ko-worst-1600x900-tutorial.png |  Bin 1661212 -> 1738118 bytes\n .../M77/HF-M77-inv-ui-layout-ko-worst-1600x900.png |  Bin 1650000 -> 1722099 bytes\n .../HF-M77-inv-ui-layout-ko-worst-1920x1080.png    |  Bin 2416692 -> 2562259 bytes\n .../M89/HF-M89-field-door-after-work.png           |  Bin 1972179 -> 1922189 bytes\n .logs/screenshots/M89/HF-M89-field-door-before.png |  Bin 1968570 -> 1920147 bytes\n .logs/screenshots/M89/HF-M89-field-door-door.png   |  Bin 2025524 -> 1987922 bytes\n .../M77/HF-M77-inv-camera-clearance.json           |   88 +-\n .../verification/M77/HF-M77-inv-mechanization.json |   68 +-\n .logs/verification/M77/HF-M77-inv-onboarding.json  |   94 +-\n .../M77/HF-M77-inv-save-durability.json            |  112 +-\n .../verification/M77/HF-M77-inv-tile-farming.json  |  146 +-\n .../verification/M77/HF-M77-inv-ui-layout-en.json  | 3365 +++++++++++++++++++-\n .../verification/M77/HF-M77-inv-ui-layout-ko.json  | 1132 ++++++-\n .logs/verification/M77/HF-M77-invariant-set.json   |   52 +-\n .../M79/HF-M79-audio-measurements-r01.json         |  941 +++++-\n src/app/gameSession.ts                             |   54 +-\n tools/playwright/m84-chain.cjs                     |    2 +-\n 79 files changed, 5735 insertions(+), 319 deletions(-)"
    },
    "after": {
      "head": "82459216c618a15f7588f57003e5f4f4ee99f40a",
      "status": "## master\n M .logs/screenshots/M77/HF-M77-inv-camera-clearance-barn-behind.png\n M .logs/screenshots/M77/HF-M77-inv-camera-clearance-chrome-webgl2.png\n M .logs/screenshots/M77/HF-M77-inv-camera-clearance-dealer.png\n M .logs/screenshots/M77/HF-M77-inv-camera-clearance-market-counter.png\n M .logs/screenshots/M77/HF-M77-inv-camera-clearance-market-stall.png\n M .logs/screenshots/M77/HF-M77-inv-camera-clearance-orchard-tree.png\n M .logs/screenshots/M77/HF-M77-inv-mechanization-chrome-webgl2.png\n M .logs/screenshots/M77/HF-M77-inv-mechanization-final-mech-state.png\n M .logs/screenshots/M77/HF-M77-inv-mechanization-t2-push-tilling.png\n M .logs/screenshots/M77/HF-M77-inv-mechanization-t3-cultivator-row.png\n M .logs/screenshots/M77/HF-M77-inv-mechanization-t4-seeder-row.png\n M .logs/screenshots/M77/HF-M77-inv-onboarding-chrome-webgl2.png\n M .logs/screenshots/M77/HF-M77-inv-save-durability-chrome-webgl2.png\n M .logs/screenshots/M77/HF-M77-inv-tile-farming-chrome-webgl2.png\n M .logs/screenshots/M77/HF-M77-inv-tile-farming-f2-worked-row.png\n M .logs/screenshots/M77/HF-M77-inv-tile-farming-f3-wet-vs-dry.png\n M .logs/screenshots/M77/HF-M77-inv-tile-farming-n3-row-walk-1.png\n M .logs/screenshots/M77/HF-M77-inv-tile-farming-n3-row-walk-2.png\n M .logs/screenshots/M77/HF-M77-inv-tile-farming-n3-row-walk-3.png\n M .logs/screenshots/M77/HF-M77-inv-tile-farming-n4-night-2330-field.png\n M .logs/screenshots/M77/HF-M77-inv-tile-farming-tile-farming-webgl2.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-chrome-webgl2.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-credits-scrolled.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-credits.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-field-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-hud-1600x900.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-inventory-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-journal-crop-row.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-map-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-market-scrolled.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-minimap-closeup.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-progression-scrolled.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-quests-1280x720-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-quests-1920x1080-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-quests-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-seed-shelf.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-settings-scrolled.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-settings.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-varieties-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-worst-1280x720.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-worst-1600x900-tutorial.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-worst-1600x900.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-en-en-worst-1920x1080.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-chrome-webgl2.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-credits-scrolled.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-credits.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-field-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-hud-1600x900.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-inventory-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-journal-crop-row.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-map-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-market-scrolled.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-minimap-closeup.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-progression-scrolled.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-quests-1280x720-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-quests-1920x1080-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-quests-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-seed-shelf.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-settings-scrolled.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-settings.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-varieties-panel.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-worst-1280x720.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-worst-1600x900-tutorial.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-worst-1600x900.png\n M .logs/screenshots/M77/HF-M77-inv-ui-layout-ko-worst-1920x1080.png\n M .logs/screenshots/M89/HF-M89-field-door-after-work.png\n M .logs/screenshots/M89/HF-M89-field-door-before.png\n M .logs/screenshots/M89/HF-M89-field-door-door.png\n M .logs/verification/M77/HF-M77-inv-camera-clearance.json\n M .logs/verification/M77/HF-M77-inv-mechanization.json\n M .logs/verification/M77/HF-M77-inv-onboarding.json\n M .logs/verification/M77/HF-M77-inv-save-durability.json\n M .logs/verification/M77/HF-M77-inv-tile-farming.json\n M .logs/verification/M77/HF-M77-inv-ui-layout-en.json\n M .logs/verification/M77/HF-M77-inv-ui-layout-ko.json\n M .logs/verification/M77/HF-M77-invariant-set.json\n M .logs/verification/M79/HF-M79-audio-measurements-r01.json\n M src/app/gameSession.ts\n M tools/playwright/m84-chain.cjs\n?? .codex/\n?? .logs/audio/M93/\n?? .logs/audio/M94/\n?? .logs/screenshots/M55/HF-M55-20260823T095330720Z-gameplay-webgl2-chrome-webgl2.png\n?? .logs/screenshots/M55/HF-M55-20260823T095330720Z-gameplay-webgl2-water-action-webgl2.png\n?? .logs/screenshots/M55/HF-M55-20260823T105713530Z-gameplay-webgl2-chrome-webgl2.png\n?? .logs/screenshots/M55/HF-M55-20260823T105713530Z-gameplay-webgl2-water-action-webgl2.png\n?? .logs/screenshots/M55/HF-M55-20260823T111219445Z-gameplay-webgl2-chrome-webgl2.png\n?? .logs/screenshots/M55/HF-M55-20260823T111219445Z-gameplay-webgl2-water-action-webgl2.png\n?? .logs/screenshots/M77/HF-M77-inv-day-labour-save-ko-chrome-webgl2.png\n?? .logs/screenshots/M85/\n?? .logs/screenshots/M86/\n?? .logs/screenshots/M87/HF-M87-20260823T1715Z-croplab-chrome-webgl2.png\n?? .logs/screenshots/M87/HF-M87-20260823T1730Z-croplab-chrome-webgl2.png\n?? .logs/screenshots/M87/HF-M87-20260823T1745Z-croplab-chrome-webgl2.png\n?? .logs/screenshots/M87/HF-M87-20260823T1810Z-croplab-r2-chrome-webgpu.png\n?? .logs/screenshots/M87/HF-M87-20260823T1830Z-croplab-r3-chrome-webgpu.png\n?? .logs/screenshots/M87/HF-M87-20260823T1840Z-croplab-r3-cherry-chrome-webgpu.png\n?? .logs/screenshots/M87/HF-M87-20260823T1850Z-croplab-r4-cherry-chrome-webgpu.png\n?? .logs/screenshots/M87/HF-M87-20260823T1900Z-croplab-final-chrome-webgpu.png\n?? .logs/screenshots/M87/croplab/HF-M87-20260823T0907Z-croplab-r5/\n?? .logs/screenshots/M87/croplab/HF-M87-20260823T0940Z-croplab-r6-burial/\n?? .logs/screenshots/M87/croplab/HF-M87-20260823T1715Z-croplab/\n?? .logs/screenshots/M87/croplab/HF-M87-20260823T1730Z-croplab/\n?? .logs/screenshots/M87/croplab/HF-M87-20260823T1745Z-croplab/\n?? .logs/screenshots/M87/croplab/HF-M87-20260823T1810Z-croplab-r2/\n?? .logs/screenshots/M87/croplab/HF-M87-20260823T1830Z-croplab-r3/\n?? .logs/screenshots/M87/croplab/HF-M87-20260823T1840Z-croplab-r3-cherry/\n?? .logs/screenshots/M87/croplab/HF-M87-20260823T1850Z-croplab-r4-cherry/\n?? .logs/screenshots/M87/croplab/HF-M87-20260823T1900Z-croplab-final/\n?? .logs/screenshots/M87/world/HF-M87-20260823T0915Z-world-r5-final-webgpu/\n?? .logs/screenshots/M87/world/HF-M87-20260823T0920Z-world-r5-final-webgpu/\n?? .logs/screenshots/M87/world/HF-M87-20260823T0930Z-world-r6-standard-webgpu-centerfix/\n?? .logs/screenshots/M87/world/HF-M87-20260823T0935Z-world-r5-standard-webgpu/\n?? .logs/screenshots/M87/world/HF-M87-20260823T0945Z-world-r5-standard-webgpu-final/\n?? .logs/screenshots/M87/world/HF-M87-20260823T1015Z-world-r5-standard-webgpu-postfix/\n?? .logs/screenshots/M87/world/HF-M87-20260823T1028Z-world-r5-standard-webgpu-framing/\n?? .logs/screenshots/M87/world/HF-M87-20260823T1915Z-world-r4-final/\n?? .logs/screenshots/M87/world/HF-M87-20260823T1920Z-world-r4-final/\n?? .logs/screenshots/M87/world/HF-M87-20260823T1930Z-world-r4-final/\n?? .logs/screenshots/M87/world/HF-M87-20260823T1940Z-world-r4-debug/\n?? .logs/screenshots/M87/world/HF-M87-20260823T1950Z-world-r4-final/\n?? .logs/screenshots/M87/world/HF-M87-20260823T2000Z-world-r4-final/\n?? .logs/screenshots/M87/world/HF-M87-20260823T2010Z-world-r4-final/\n?? .logs/screenshots/M87/world/HF-M87-20260823T2030Z-world-r4-final-webgpu/\n?? .logs/screenshots/M87/world/HF-M87-20260823T2050Z-world-r4-final-webgpu/\n?? .logs/screenshots/M88/characters/HF-M88-character-world-webgpu-r01/\n?? .logs/screenshots/M88/characters/HF-M88-character-world-webgpu-r02/\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-credits-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-credits.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-field-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-hud-1600x900.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-inventory-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-journal-crop-row.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-map-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-market-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-minimap-closeup.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-progression-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-quests-1280x720-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-quests-1920x1080-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-quests-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-seed-shelf.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-settings-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-settings.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-varieties-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-worst-1280x720.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-worst-1600x900-tutorial.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-worst-1600x900.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r01-en-worst-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-credits-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-credits.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-field-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-hud-1600x900.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-inventory-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-journal-crop-row.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-market-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-minimap-closeup.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-progression-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-quests-1280x720-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-quests-1920x1080-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-quests-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-seed-shelf.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-settings-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-settings.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-varieties-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-worst-1280x720.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-worst-1600x900-tutorial.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-worst-1600x900.png\n?? .logs/screenshots/M89/HF-M89-farm-map-en-webgl2-r02-en-worst-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-credits-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-credits.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-field-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-hud-1600x900.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-inventory-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-journal-crop-row.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-map-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-market-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-minimap-closeup.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-progression-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-quests-1280x720-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-quests-1920x1080-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-quests-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-seed-shelf.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-settings-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-settings.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-varieties-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-worst-1280x720.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-worst-1600x900-tutorial.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-worst-1600x900.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r01-worst-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-credits-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-credits.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-field-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-hud-1600x900.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-inventory-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-journal-crop-row.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-market-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-minimap-closeup.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-progression-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-quests-1280x720-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-quests-1920x1080-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-quests-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-seed-shelf.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-settings-scrolled.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-settings.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-varieties-panel.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-worst-1280x720.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-worst-1600x900-tutorial.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-worst-1600x900.png\n?? .logs/screenshots/M89/HF-M89-farm-map-ko-webgl2-r02-worst-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-field-door-webgl2-r02-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-en-webgpu-r02-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-en-webgpu-r02-en-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-en-webgpu-r03-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-en-webgpu-r03-en-quest-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-en-webgpu-r03-en-tutorial-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-en-webgpu-r04-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-en-webgpu-r04-en-quest-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-en-webgpu-r04-en-tutorial-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-ko-webgpu-r02-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-ko-webgpu-r02-ko-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-ko-webgpu-r03-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-ko-webgpu-r03-ko-quest-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-ko-webgpu-r03-ko-tutorial-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-ko-webgpu-r04-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-ko-webgpu-r04-ko-quest-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-baseline-ko-webgpu-r04-ko-tutorial-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-en-webgpu-r01-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-en-webgpu-r01-en-quest-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-en-webgpu-r01-en-tutorial-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-ko-webgpu-r01-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-ko-webgpu-r01-ko-quest-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-ko-webgpu-r01-ko-tutorial-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-webgl2-en-r01-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-webgl2-en-r01-en-quest-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-webgl2-en-r01-en-tutorial-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-webgl2-ko-r02-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-webgl2-ko-r02-ko-quest-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-compact-webgl2-ko-r02-ko-tutorial-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-readable-en-webgl2-r01-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-hud-readable-en-webgpu-r01-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-hud-readable-ko-webgl2-r01-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-hud-readable-ko-webgpu-r01-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-hud-red-ko-webgpu-r01-ko-quest-1280x720.png\n?? .logs/screenshots/M89/HF-M89-hud-red-ko-webgpu-r01-ko-tutorial-1280x720.png\n?? .logs/screenshots/M89/HF-M89-preserve-en-webgl2-r01-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-preserve-en-webgl2-r01-en-1600x900.png\n?? .logs/screenshots/M89/HF-M89-preserve-en-webgl2-r01-en-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-preserve-ko-webgl2-r01-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-preserve-ko-webgl2-r01-ko-1600x900.png\n?? .logs/screenshots/M89/HF-M89-preserve-ko-webgl2-r01-ko-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-preserve-readable-en-webgl2-r02-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-preserve-readable-en-webgl2-r02-en-1600x900.png\n?? .logs/screenshots/M89/HF-M89-preserve-readable-en-webgl2-r02-en-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-preserve-readable-ko-webgl2-r02-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-preserve-readable-ko-webgl2-r02-ko-1600x900.png\n?? .logs/screenshots/M89/HF-M89-preserve-readable-ko-webgl2-r02-ko-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-tile-farming-webgl2-r01-f2-worked-row.png\n?? .logs/screenshots/M89/HF-M89-tile-farming-webgl2-r01-f3-wet-vs-dry.png\n?? .logs/screenshots/M89/HF-M89-tile-farming-webgl2-r01-n3-row-walk-1.png\n?? .logs/screenshots/M89/HF-M89-tile-farming-webgl2-r01-n3-row-walk-2.png\n?? .logs/screenshots/M89/HF-M89-tile-farming-webgl2-r01-n3-row-walk-3.png\n?? .logs/screenshots/M89/HF-M89-tile-farming-webgl2-r01-n4-night-2330-field.png\n?? .logs/screenshots/M89/HF-M89-tile-farming-webgl2-r01-tile-farming-webgl2.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-field-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-inventory-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-journal-crop-row.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-market-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-minimap-closeup.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-progression-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-quests-1280x720-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-quests-1920x1080-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-quests-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-seed-shelf.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-varieties-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-worst-1280x720.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-worst-1600x900-tutorial.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-worst-1600x900.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r03-en-worst-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-credits-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-credits.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-field-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-hud-1600x900.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-inventory-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-journal-crop-row.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-map-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-market-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-minimap-closeup.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-progression-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-quests-1280x720-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-quests-1920x1080-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-quests-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-seed-shelf.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-settings-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-settings.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-varieties-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-worst-1280x720.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-worst-1600x900-tutorial.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-worst-1600x900.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgl2-r05-en-worst-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-credits-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-credits.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-field-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-hud-1600x900.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-inventory-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-journal-crop-row.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-map-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-market-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-minimap-closeup.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-progression-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-quests-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-seed-shelf.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-settings-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-settings.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-varieties-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-worst-1600x900-tutorial.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-en-webgpu-r01-en-worst-1600x900.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-chrome-webgl2.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-credits-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-credits.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-field-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-hud-1600x900.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-inventory-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-journal-crop-row.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-map-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-market-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-minimap-closeup.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-progression-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-quests-1280x720-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-quests-1920x1080-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-quests-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-seed-shelf.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-settings-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-settings.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-varieties-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-worst-1280x720.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-worst-1600x900-tutorial.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-worst-1600x900.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgl2-r03-worst-1920x1080.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-chrome-webgpu.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-credits-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-credits.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-field-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-hud-1600x900.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-inventory-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-journal-crop-row.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-map-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-market-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-minimap-closeup.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-progression-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-quests-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-seed-shelf.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-settings-scrolled.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-settings.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-varieties-panel.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-worst-1600x900-tutorial.png\n?? .logs/screenshots/M89/HF-M89-ui-layout-final-ko-webgpu-r01-worst-1600x900.png\n?? .logs/screenshots/M90/\n?? .logs/screenshots/M91/\n?? .logs/screenshots/M92/\n?? .logs/screenshots/M93/\n?? .logs/screenshots/M94/\n?? .logs/screenshots/M95/\n?? .logs/screenshots/M96/\n?? .logs/screenshots/M97/\n?? .logs/screenshots/M98/\n?? .logs/verification/M55/HF-M55-20260823T074220804Z-gameplay-webgl2.json\n?? .logs/verification/M55/HF-M55-20260823T074234850Z-gameplay-webgl2.json\n?? .logs/verification/M55/HF-M55-20260823T095330720Z-gameplay-webgl2.json\n?? .logs/verification/M55/HF-M55-20260823T105713530Z-gameplay-webgl2.json\n?? .logs/verification/M55/HF-M55-20260823T111219445Z-gameplay-webgl2.json\n?? .logs/verification/M77/HF-M77-inv-day-labour-save-ko.json\n?? .logs/verification/M85/\n?? .logs/verification/M86/\n?? .logs/verification/M87/HF-M87-20260823T1715Z-croplab.json\n?? .logs/verification/M87/HF-M87-20260823T1730Z-croplab.json\n?? .logs/verification/M87/HF-M87-20260823T1745Z-croplab.json\n?? .logs/verification/M87/HF-M87-20260823T1810Z-croplab-r2.json\n?? .logs/verification/M87/HF-M87-20260823T1830Z-croplab-r3.json\n?? .logs/verification/M87/HF-M87-20260823T1840Z-croplab-r3-cherry.json\n?? .logs/verification/M87/HF-M87-20260823T1850Z-croplab-r4-cherry.json\n?? .logs/verification/M87/HF-M87-20260823T1900Z-croplab-final.json\n?? .logs/verification/M87/HF-M87-20260823T1915Z-world-r4-final.json\n?? .logs/verification/M87/HF-M87-20260823T1920Z-world-r4-final.json\n?? .logs/verification/M87/HF-M87-20260823T1930Z-world-r4-final.json\n?? .logs/verification/M87/HF-M87-20260823T1940Z-world-r4-debug.json\n?? .logs/verification/M87/HF-M87-20260823T1950Z-world-r4-final.json\n?? .logs/verification/M87/HF-M87-20260823T2000Z-world-r4-final.json\n?? .logs/verification/M87/HF-M87-20260823T2010Z-world-r4-final.json\n?? .logs/verification/M87/HF-M87-20260823T2030Z-world-r4-final-webgpu.json\n?? .logs/verification/M87/HF-M87-20260823T2050Z-world-r4-final-webgpu.json\n?? .logs/verification/M88/HF-M88-character-world-webgpu-r01.json\n?? .logs/verification/M88/HF-M88-character-world-webgpu-r02.json\n?? .logs/verification/M88/HF-M88-character-world-webgpu-r03.json\n?? .logs/verification/M89/HF-M89-farm-map-en-webgl2-r01.json\n?? .logs/verification/M89/HF-M89-farm-map-ko-webgl2-r01.json\n?? .logs/verification/M89/HF-M89-field-door-webgl2-r01.json\n?? .logs/verification/M89/HF-M89-field-door-webgl2-r02.json\n?? .logs/verification/M89/HF-M89-field-door-webgl2-r03.json\n?? .logs/verification/M89/HF-M89-field-door-webgpu-r01.json\n?? .logs/verification/M89/HF-M89-field-door-webgpu-r02.json\n?? .logs/verification/M89/HF-M89-field-door-webgpu-r03.json\n?? .logs/verification/M89/HF-M89-hud-baseline-en-webgpu-r01.json\n?? .logs/verification/M89/HF-M89-hud-baseline-en-webgpu-r02.json\n?? .logs/verification/M89/HF-M89-hud-baseline-en-webgpu-r03.json\n?? .logs/verification/M89/HF-M89-hud-baseline-en-webgpu-r04.json\n?? .logs/verification/M89/HF-M89-hud-baseline-ko-webgpu-r01.json\n?? .logs/verification/M89/HF-M89-hud-baseline-ko-webgpu-r02.json\n?? .logs/verification/M89/HF-M89-hud-baseline-ko-webgpu-r03.json\n?? .logs/verification/M89/HF-M89-hud-baseline-ko-webgpu-r04.json\n?? .logs/verification/M89/HF-M89-hud-compact-en-webgpu-r01.json\n?? .logs/verification/M89/HF-M89-hud-compact-ko-webgpu-r01.json\n?? .logs/verification/M89/HF-M89-hud-compact-webgl2-en-r01.json\n?? .logs/verification/M89/HF-M89-hud-compact-webgl2-ko-r01.json\n?? .logs/verification/M89/HF-M89-hud-compact-webgl2-ko-r02.json\n?? .logs/verification/M89/HF-M89-hud-red-ko-webgpu-r01.json\n?? .logs/verification/M89/HF-M89-preserve-en-webgl2-r01.json\n?? .logs/verification/M89/HF-M89-preserve-ko-webgl2-r01.json\n?? .logs/verification/M89/HF-M89-ui-layout-diag-ko-webgl2-r02.json\n?? .logs/verification/M89/HF-M89-ui-layout-final-en-webgl2-r03.json\n?? .logs/verification/M89/HF-M89-ui-layout-final-en-webgl2-r04.json\n?? .logs/verification/M89/HF-M89-ui-layout-final-ko-webgl2-r01.json\n?? .logs/verification/M89/HF-M89-ui-preserve-en-webgl2-r01.json\n?? .logs/verification/M89/HF-M89-ui-preserve-ko-webgl2-r01.json\n?? .logs/verification/M89/HF-M89-ui-preserve-ko-webgl2-r02.json\n?? .logs/verification/M90/\n?? .logs/verification/M91/\n?? .logs/verification/M92/\n?? .logs/verification/M93/\n?? .logs/verification/M94/\n?? .logs/verification/M95/\n?? .logs/verification/M96/\n?? .logs/verification/M97/\n?? .logs/verification/M98/\n?? output/charpreview/latest/\n?? src/app/cameraComposition.ts\n?? tests/cameraComposition.test.ts\n?? tools/playwright/m85-crop-lab-flow.js\n?? tools/playwright/m86-probe-flow.js\n?? tools/playwright/m86-probe2-flow.js\n?? tools/playwright/m87-cherry-review-flow.js\n?? tools/playwright/m93-shipped-visual-flow.js\n?? tools/playwright/m94-audio-focus.cjs",
      "diffStat": ".../HF-M77-inv-camera-clearance-barn-behind.png    |  Bin 2250223 -> 2376653 bytes\n .../HF-M77-inv-camera-clearance-chrome-webgl2.png  |  Bin 2309425 -> 2682072 bytes\n .../M77/HF-M77-inv-camera-clearance-dealer.png     |  Bin 2086807 -> 2125720 bytes\n .../HF-M77-inv-camera-clearance-market-counter.png |  Bin 595768 -> 593722 bytes\n .../HF-M77-inv-camera-clearance-market-stall.png   |  Bin 1448790 -> 1525377 bytes\n .../HF-M77-inv-camera-clearance-orchard-tree.png   |  Bin 2153122 -> 2657849 bytes\n .../M77/HF-M77-inv-mechanization-chrome-webgl2.png |  Bin 1904031 -> 1943285 bytes\n .../HF-M77-inv-mechanization-final-mech-state.png  |  Bin 1953143 -> 1980102 bytes\n .../HF-M77-inv-mechanization-t2-push-tilling.png   |  Bin 1805265 -> 1823502 bytes\n .../HF-M77-inv-mechanization-t3-cultivator-row.png |  Bin 1847500 -> 1874821 bytes\n .../M77/HF-M77-inv-mechanization-t4-seeder-row.png |  Bin 1839629 -> 1869723 bytes\n .../M77/HF-M77-inv-onboarding-chrome-webgl2.png    |  Bin 1805752 -> 1832721 bytes\n .../HF-M77-inv-save-durability-chrome-webgl2.png   |  Bin 1825340 -> 1785713 bytes\n .../M77/HF-M77-inv-tile-farming-chrome-webgl2.png  |  Bin 1707644 -> 1722870 bytes\n .../M77/HF-M77-inv-tile-farming-f2-worked-row.png  |  Bin 1808183 -> 1795936 bytes\n .../M77/HF-M77-inv-tile-farming-f3-wet-vs-dry.png  |  Bin 1836440 -> 1855206 bytes\n .../M77/HF-M77-inv-tile-farming-n3-row-walk-1.png  |  Bin 1822150 -> 1834205 bytes\n .../M77/HF-M77-inv-tile-farming-n3-row-walk-2.png  |  Bin 1867854 -> 1906017 bytes\n .../M77/HF-M77-inv-tile-farming-n3-row-walk-3.png  |  Bin 1874187 -> 1930501 bytes\n ...HF-M77-inv-tile-farming-n4-night-2330-field.png |  Bin 1351197 -> 1373675 bytes\n ...HF-M77-inv-tile-farming-tile-farming-webgl2.png |  Bin 1706159 -> 1717638 bytes\n .../M77/HF-M77-inv-ui-layout-en-chrome-webgl2.png  |  Bin 1655121 -> 1721057 bytes\n ...HF-M77-inv-ui-layout-en-en-credits-scrolled.png |  Bin 356019 -> 352602 bytes\n .../M77/HF-M77-inv-ui-layout-en-en-credits.png     |  Bin 396502 -> 392586 bytes\n .../M77/HF-M77-inv-ui-layout-en-en-field-panel.png |  Bin 1553230 -> 1659695 bytes\n .../HF-M77-inv-ui-layout-en-en-hud-1600x900.png    |  Bin 1655019 -> 1721181 bytes\n .../HF-M77-inv-ui-layout-en-en-inventory-panel.png |  Bin 1647085 -> 1686741 bytes\n ...HF-M77-inv-ui-layout-en-en-journal-crop-row.png |  Bin 83624 -> 82098 bytes\n .../M77/HF-M77-inv-ui-layout-en-en-map-panel.png   |  Bin 1496454 -> 1618970 bytes\n .../HF-M77-inv-ui-layout-en-en-market-scrolled.png |  Bin 1556753 -> 1652360 bytes\n .../HF-M77-inv-ui-layout-en-en-minimap-closeup.png |  Bin 21614 -> 24842 bytes\n ...77-inv-ui-layout-en-en-progression-scrolled.png |  Bin 1577076 -> 1670463 bytes\n ...7-inv-ui-layout-en-en-quests-1280x720-panel.png |  Bin 981504 -> 1063176 bytes\n ...-inv-ui-layout-en-en-quests-1920x1080-panel.png |  Bin 2342714 -> 2466477 bytes\n .../HF-M77-inv-ui-layout-en-en-quests-panel.png    |  Bin 1580409 -> 1677088 bytes\n .../M77/HF-M77-inv-ui-layout-en-en-seed-shelf.png  |  Bin 118876 -> 117780 bytes\n ...F-M77-inv-ui-layout-en-en-settings-scrolled.png |  Bin 1555935 -> 1645060 bytes\n .../M77/HF-M77-inv-ui-layout-en-en-settings.png    |  Bin 1555660 -> 1647434 bytes\n .../HF-M77-inv-ui-layout-en-en-varieties-panel.png |  Bin 1640536 -> 1682911 bytes\n .../HF-M77-inv-ui-layout-en-en-worst-1280x720.png  |  Bin 1056353 -> 1110678 bytes\n ...inv-ui-layout-en-en-worst-1600x900-tutorial.png |  Bin 1657507 -> 1738278 bytes\n .../HF-M77-inv-ui-layout-en-en-worst-1600x900.png  |  Bin 1654004 -> 1721860 bytes\n .../HF-M77-inv-ui-layout-en-en-worst-1920x1080.png |  Bin 2418121 -> 2560155 bytes\n .../M77/HF-M77-inv-ui-layout-ko-chrome-webgl2.png  |  Bin 1651287 -> 1724282 bytes\n .../HF-M77-inv-ui-layout-ko-credits-scrolled.png   |  Bin 347492 -> 346498 bytes\n .../M77/HF-M77-inv-ui-layout-ko-credits.png        |  Bin 386437 -> 385225 bytes\n .../M77/HF-M77-inv-ui-layout-ko-field-panel.png    |  Bin 1549555 -> 1659019 bytes\n .../M77/HF-M77-inv-ui-layout-ko-hud-1600x900.png   |  Bin 1653316 -> 1722076 bytes\n .../HF-M77-inv-ui-layout-ko-inventory-panel.png    |  Bin 1653226 -> 1677449 bytes\n .../HF-M77-inv-ui-layout-ko-journal-crop-row.png   |  Bin 77099 -> 76363 bytes\n .../M77/HF-M77-inv-ui-layout-ko-map-panel.png      |  Bin 1503099 -> 1609626 bytes\n .../HF-M77-inv-ui-layout-ko-market-scrolled.png    |  Bin 1547680 -> 1639603 bytes\n .../HF-M77-inv-ui-layout-ko-minimap-closeup.png    |  Bin 21964 -> 24841 bytes\n ...F-M77-inv-ui-layout-ko-progression-scrolled.png |  Bin 1566413 -> 1653528 bytes\n ...-M77-inv-ui-layout-ko-quests-1280x720-panel.png |  Bin 974745 -> 1052237 bytes\n ...M77-inv-ui-layout-ko-quests-1920x1080-panel.png |  Bin 2331513 -> 2449649 bytes\n .../M77/HF-M77-inv-ui-layout-ko-quests-panel.png   |  Bin 1568842 -> 1662571 bytes\n .../M77/HF-M77-inv-ui-layout-ko-seed-shelf.png     |  Bin 95911 -> 96171 bytes\n .../HF-M77-inv-ui-layout-ko-settings-scrolled.png  |  Bin 1553703 -> 1632767 bytes\n .../M77/HF-M77-inv-ui-layout-ko-settings.png       |  Bin 1553106 -> 1633884 bytes\n .../HF-M77-inv-ui-layout-ko-varieties-panel.png    |  Bin 1645934 -> 1672870 bytes\n .../M77/HF-M77-inv-ui-layout-ko-worst-1280x720.png |  Bin 1052198 -> 1108614 bytes\n ...77-inv-ui-layout-ko-worst-1600x900-tutorial.png |  Bin 1661212 -> 1738118 bytes\n .../M77/HF-M77-inv-ui-layout-ko-worst-1600x900.png |  Bin 1650000 -> 1722099 bytes\n .../HF-M77-inv-ui-layout-ko-worst-1920x1080.png    |  Bin 2416692 -> 2562259 bytes\n .../M89/HF-M89-field-door-after-work.png           |  Bin 1972179 -> 1922189 bytes\n .logs/screenshots/M89/HF-M89-field-door-before.png |  Bin 1968570 -> 1920147 bytes\n .logs/screenshots/M89/HF-M89-field-door-door.png   |  Bin 2025524 -> 1987922 bytes\n .../M77/HF-M77-inv-camera-clearance.json           |   88 +-\n .../verification/M77/HF-M77-inv-mechanization.json |   68 +-\n .logs/verification/M77/HF-M77-inv-onboarding.json  |   94 +-\n .../M77/HF-M77-inv-save-durability.json            |  112 +-\n .../verification/M77/HF-M77-inv-tile-farming.json  |  146 +-\n .../verification/M77/HF-M77-inv-ui-layout-en.json  | 3365 +++++++++++++++++++-\n .../verification/M77/HF-M77-inv-ui-layout-ko.json  | 1132 ++++++-\n .logs/verification/M77/HF-M77-invariant-set.json   |   52 +-\n .../M79/HF-M79-audio-measurements-r01.json         |  941 +++++-\n src/app/gameSession.ts                             |   54 +-\n tools/playwright/m84-chain.cjs                     |    2 +-\n 79 files changed, 5735 insertions(+), 319 deletions(-)"
    },
    "unchanged": true
  }
}
```
