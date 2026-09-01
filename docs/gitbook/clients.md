# 클라이언트별 설정
클라이언트가 읽는 설정 모양만 고르면 됩니다. 키는 workspace에서 발급하고 화면에서 복사합니다.

## 클라이언트별 설정 모양

CLAUDE CODE**CLI 등록**`claude mcp add --transport http`

HTTPS endpoint와 Bearer 헤더를 한 명령으로 등록합니다.

CODEX**환경변수 분리**`codex mcp add --bearer-token-env-var`

키를 환경변수로 보관하고 설정은 JSON으로 확인합니다.

CURSOR · DESKTOP**mcpServers JSON**`.cursor/mcp.json`

프로젝트 또는 앱 설정 파일에 원격 서버 블록을 넣습니다.

VS CODE · COPILOT**servers / CLI**`servers · copilot mcp add`

VS Code는 servers 키, Copilot은 등록 명령을 사용합니다.

[완성된 설정 블록 열기](https://clunk.artemis-clunk.workers.dev/agents#connect)
