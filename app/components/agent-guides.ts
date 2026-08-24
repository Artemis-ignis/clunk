import { MCP_CONFIG_SNIPPET, MCP_SERVER, MCP_TOOLS } from "./product-facts";

export type AgentGuideKey =
  | "claude-code"
  | "codex"
  | "cursor"
  | "claude-desktop"
  | "vscode"
  | "stdio"
  | "api";

export type AgentGuide = {
  key: AgentGuideKey;
  label: string;
  kicker: string;
  title: string;
  description: string;
  fileLabel: string;
  code: string;
  note: string;
  status: "available" | "not-shipped";
};

const WINDOWS_ARGS = ["/d", "/s", "/c", "call", "npm.cmd", "run", "--silent", "mcp"];

export const AGENT_GUIDES: AgentGuide[] = [
  {
    key: "claude-code",
    label: "Claude Code",
    kicker: "터미널 에이전트",
    title: "프로젝트 MCP로 등록",
    description: "Clunk 저장소 루트에서 명령 한 번으로 프로젝트 범위 MCP를 추가합니다.",
    fileLabel: "terminal",
    code: "claude mcp add clunk --scope project --transport stdio -- cmd.exe /d /s /c call npm.cmd run --silent mcp",
    note: "Windows에서는 반드시 --silent를 포함하세요. 명령은 실제 Clunk 저장소 루트에서 실행해야 하며, 다른 폴더에서 등록하면 npm이 package.json을 찾지 못합니다.",
    status: "available",
  },
  {
    key: "codex",
    label: "Codex",
    kicker: "프로젝트 MCP",
    title: "프로젝트 설정에 연결",
    description: "Codex가 읽는 프로젝트 MCP 설정에 같은 stdio 서버를 등록합니다. 저장소에 있는 플러그인 폴더는 자동 설치가 아니라 배포 가능한 소스 패키지입니다.",
    fileLabel: ".mcp.json",
    code: MCP_CONFIG_SNIPPET,
    note: "<CLUNK_ROOT>를 실제 절대 경로로 바꾸고 프로젝트 설정에 저장하세요. Codex에 Clunk AssetOps 플러그인이 설치되지 않은 상태에서도 이 설정으로 MCP만 연결할 수 있습니다.",
    status: "available",
  },
  {
    key: "cursor",
    label: "Cursor",
    kicker: "IDE · CLI",
    title: "mcp.json으로 연결",
    description: "Cursor IDE와 cursor-agent CLI는 프로젝트 mcp.json을 함께 읽습니다. 지원되지 않는 agent mcp add 명령 대신 설정 파일을 사용하세요.",
    fileLabel: ".cursor/mcp.json",
    code: MCP_CONFIG_SNIPPET,
    note: "<CLUNK_ROOT>를 실제 절대 경로로 바꾼 뒤 .cursor/mcp.json에 저장하고 cursor-agent mcp list 또는 Cursor의 MCP 목록에서 확인하세요.",
    status: "available",
  },
  {
    key: "claude-desktop",
    label: "Claude Desktop",
    kicker: "데스크톱 클라이언트",
    title: "mcpServers에 한 블록 추가",
    description: "Claude Desktop의 MCP 설정 파일에 Windows stdio 서버 항목을 추가합니다.",
    fileLabel: "claude_desktop_config.json",
    code: [
      "{",
      "  \"mcpServers\": {",
      "    \"clunk\": {",
      "      \"command\": \"cmd.exe\",",
      "      \"args\": [\"/d\", \"/s\", \"/c\", \"call\", \"npm.cmd\", \"run\", \"--silent\", \"mcp\"],",
      "      \"cwd\": \"<CLUNK_ROOT>\"",
      "    }",
      "  }",
      "}",
    ].join("\n"),
    note: "cwd를 실제 Clunk 저장소 절대 경로로 바꾸고 Claude Desktop을 재시작하세요. 원본 GLB 경로도 같은 작업 폴더에서 읽을 수 있어야 합니다.",
    status: "available",
  },
  {
    key: "vscode",
    label: "VS Code",
    kicker: "편집기 확장 · MCP",
    title: "두 가지 작업 표면",
    description: "VS Code 확장은 명령 팔레트에서 검사·최적화를 제공하고, Agent MCP는 같은 stdio 서버를 연결합니다.",
    fileLabel: ".vscode/mcp.json",
    code: [
      "{",
      "  \"servers\": {",
      "    \"clunk\": {",
      "      \"type\": \"stdio\",",
      "      \"command\": \"cmd.exe\",",
      "      \"args\": [\"/d\", \"/s\", \"/c\", \"call\", \"npm.cmd\", \"run\", \"--silent\", \"mcp\"],",
      '      "cwd": "' + "$" + '{workspaceFolder}"',
      "    }",
      "  }",
      "}",
    ].join("\n"),
    note: "명령 팔레트의 Clunk: Inspect Asset와 Clunk: Optimize Safely는 VS Code 확장이 제공하는 별도 경로입니다.",
    status: "available",
  },
  {
    key: "stdio",
    label: "기타 stdio",
    kicker: "MCP 표준",
    title: "모든 stdio 클라이언트의 공통 형태",
    description: "클라이언트가 표준 MCP 구성을 받는다면 아래 command, args, cwd 세 필드로 연결됩니다.",
    fileLabel: "mcp.json",
    code: [
      "{",
      "  \"mcpServers\": {",
      "    \"clunk\": {",
      "      \"command\": \"cmd.exe\",",
      "      \"args\": [\"" + WINDOWS_ARGS.join("\", \"") + "\"],",
      "      \"cwd\": \"<CLUNK_ROOT>\"",
      "    }",
      "  }",
      "}",
    ].join("\n"),
    note: "서버는 " + MCP_SERVER.protocolVersion + " 프로토콜로 initialize하고 " + MCP_TOOLS.length + "개 도구를 tools/list에 노출합니다.",
    status: "available",
  },
  {
    key: "api",
    label: "API / HTTP",
    kicker: "현재 상태",
    title: "공개 HTTP MCP는 아직 제공하지 않습니다",
    description: "현재 외부 에이전트 연결은 로컬 stdio MCP가 정식 경로입니다. 웹 API 라우트는 Clunk 웹 앱의 인증된 내부 경계이며 공개 API로 약속하지 않습니다.",
    fileLabel: "not-shipped",
    code: [
      "transport: stdio MCP",
      "endpoint: local process",
      "public HTTP MCP: not shipped",
      "web API routes: authenticated Clunk app only",
    ].join("\n"),
    note: "HTTP MCP를 제품 표면으로 열기 전에는 인증, workspace 범위, rate limit, 다운로드 artifact 서명을 먼저 확정해야 합니다. 지금은 연결되지 않는 URL을 문서에 넣지 않습니다.",
    status: "not-shipped",
  },
];

export const DEFAULT_AGENT_GUIDE = AGENT_GUIDES[0];
