# 빠른 시작
원격 에이전트는 HTTPS MCP, 로컬 파일은 stdio를 사용합니다. [에이전트 연결 화면](https://clunk.artemis-clunk.workers.dev/agents#connect)에서 키를 발급하면 클라이언트별 설정이 완성됩니다.

## 설정 블록 복사

**mcpServers**

```
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

/connect에서 발급한 endpoint와 Bearer 키를 넣습니다.

## 실제 연결 확인

실제 handshake 예시 initialize → tools/list 열기

**실제 연결 확인**

```
$ POST /api/mcp
Authorization: Bearer clunk_live_<workspace-key>
{ "jsonrpc": "2.0", "id": 1, "method": "initialize" }

$ POST /api/mcp
Authorization: Bearer clunk_live_<workspace-key>
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }

# 원격 7개와 로컬 stdio 7개는 같은 Core 계약을 사용합니다.
```

설정 복사 뒤 실제 서버 응답을 확인합니다.
