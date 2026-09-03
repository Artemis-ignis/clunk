---
description: 클라이언트가 읽는 설정 모양만 고르면 됩니다
---

# 클라이언트별 설정

아래 표는 [에이전트 연결 화면](https://clunk.games/agents)이 실제로 설정을 만들어 주는 클라이언트 전부입니다. 그 화면에서 키를 발급하면 `<endpoint>`와 `Bearer` 키가 채워진 채로 복사됩니다.

| 클라이언트          | 방식             | 명령 / 파일                                       |
| -------------- | -------------- | --------------------------------------------- |
| Claude Code    | CLI 등록         | `claude mcp add clunk --scope user --transport http` |
| Codex          | CLI 등록 · 환경변수 분리 | `codex mcp add clunk --bearer-token-env-var CLUNK_API_KEY` |
| Cursor         | 설정 파일          | `.cursor/mcp.json` (`mcpServers`)             |
| GitHub Copilot | CLI 등록         | `copilot mcp add --transport http`            |
| Claude Desktop | 설정 파일          | `claude_desktop_config.json` (`mcpServers`)   |
| VS Code        | 설정 파일          | `.vscode/mcp.json` (`servers`)                |
| 로컬 stdio       | 설정 파일          | `mcp.json` — 내 컴퓨터의 파일을 경로로 읽어야 할 때만          |

원격 HTTP로 붙은 클라이언트는 내 컴퓨터의 파일 경로를 읽거나 쓰지 않습니다. 로컬 파일을 직접 읽고 새 파일을 쓰는 일은 로컬 stdio 서버만 합니다.
