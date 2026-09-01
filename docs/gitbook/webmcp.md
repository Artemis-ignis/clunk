# 브라우저에서 직접 확인
WebMCP가 노출된 브라우저에서는 읽기 전용 상태 도구를 확인할 수 있습니다. 원본 파일을 바꾸거나 시각 승인을 만들지 않습니다.

## 브라우저 WebMCP 경계

HTTP MCP**/api/mcp**

키 발급 후 initialize → tools/list를 실제 호출

WEBMCP**REGISTERED / UNAVAILABLE**

브라우저 API 노출 여부를 라이브 상태로 표시

SAFETY BOUNDARY**READ-ONLY**

structural PASS와 visualRuntime/GAP은 독립

document.modelContext 예시 브라우저 도구 보기

document.modelContextbash

```
// Chrome WebMCP imperative API
// Clunk registers these only when the browser exposes document.modelContext.
document.modelContext.getTools();

// Read-only browser tools
clunk_connection_check       // public /api/mcp status
clunk_product_capabilities   // contracts + state boundary

// The result never upgrades these states:
visualRuntime: GAP
playerFacing: NOT_EVALUATED
humanDecision: PENDING
```

document.modelContext를 우선 확인하고 구형 호환 브라우저에서는 navigator.modelContext를 확인합니다.
