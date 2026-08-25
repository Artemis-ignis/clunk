# Polyfork → Clunk 벤치마크 반영표

Polyfork는 화면만 참고하지 않고 현재 브라우저에서 DOM, 계산 스타일, 캔버스 컨텍스트, 네트워크, 클릭에 따른 상태 변화를 확인했습니다. 원본 결과는 [polyfork-devtools-audit.json](./polyfork-devtools-audit.json)에 보존합니다.

| Polyfork에서 확인한 흐름 | Clunk에 반영한 계약 | 확인 기준 |
| --- | --- | --- |
| 영웅 영역에서 실제 3D 모델과 수치가 함께 변함 | Harvest Frontier 실측 트랙터 이미지 + 구조 점수 + visualRuntime 분리 카드 | `inputHash`, `resultDigest`, `byteLength`, `visualRuntime` |
| 모델/키트 카드에 역할·수치·다음 행동이 함께 보임 | 2D/Spine/GLB/텍스처/프레임 근거를 asset kind 카드로 분리 | `/`, `/studio`, `/dashboard` |
| 에이전트 연결 화면이 클라이언트별 코드와 탭을 제공 | Claude Code, Codex, Cursor, Claude Desktop, VS Code, GitHub Copilot, stdio 탭 | `/agents`, `initialize` → `tools/list` |
| 설정을 복사하고 실제 연결 결과를 확인 | 랜딩 템플릿 복사 + `/agents` 키 발급/실제 핸드셰이크 | 복사 피드백, `PASS/FAIL`, 도구 수 |
| API at a glance와 “무엇을 할 수 있는가”를 시각적으로 설명 | `/docs`의 계약/상태/CI 예시와 `public/llms.txt` | fixture PASS와 player-facing review 분리 |
| AI 에이전트용 브라우저 상호작용 | `document.modelContext.registerTool` WebMCP 브리지 | 브라우저가 API를 노출하면 `REGISTERED`, 아니면 `UNAVAILABLE` |

## Clunk가 일부러 주장하지 않는 것

MCP handshake, 구조 점수, texture/UI raster audit는 실제 연결·정적 계약 결과입니다. 이것만으로 게임 화면의 상품성이나 사람의 시각 승인을 만들지 않습니다. 따라서 기본값은 다음과 같이 유지합니다.

```json
{
  "structural": "PASS",
  "visualRuntime": "GAP",
  "playerFacing": "NOT_EVALUATED",
  "humanDecision": "PENDING"
}
```

Polyfork의 WebGL 캔버스와 에셋 요청 패턴을 참고하되, Clunk는 HF 원본 GLB를 자동 최적화하거나 임의로 바이트를 바꾸지 않습니다. 실제 브라우저/엔진 캡처가 연결될 때만 `visualRuntime`을 갱신합니다.
