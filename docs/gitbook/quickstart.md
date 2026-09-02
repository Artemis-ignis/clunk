---
description: 원격 에이전트는 HTTPS MCP, 로컬 파일은 stdio로 연결합니다
---

# 빠른 시작

원격 에이전트는 HTTPS MCP, 로컬 파일은 stdio를 사용합니다. [에이전트 연결 화면](https://clunk.games/connect)에서 키를 발급하면 클라이언트별 설정이 완성됩니다.

## 설정 블록 복사

로컬 stdio 서버를 등록하는 `mcpServers` 블록입니다.

```json
{
  "mcpServers": {
    "clunk": {
      "command": "cmd.exe",
      "args": ["/d", "/s", "/c", "call", "npm.cmd", "run", "--silent", "mcp"],
      "cwd": "<CLUNK_ROOT>"
    }
  }
}
```

원격으로 붙일 때는 `/connect`에서 발급한 endpoint와 Bearer 키를 넣습니다.

## 실제 연결 확인

`initialize` → `tools/list` 순서로 서버 응답을 직접 확인합니다.

```bash
$ POST /api/mcp
Authorization: Bearer clunk_live_<workspace-key>
{ "jsonrpc": "2.0", "id": 1, "method": "initialize" }

$ POST /api/mcp
Authorization: Bearer clunk_live_<workspace-key>
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }

# 원격 7개와 로컬 stdio 7개는 같은 Core 계약을 사용합니다.
```

설정을 복사한 뒤 반드시 실제 서버 응답까지 확인하세요.
