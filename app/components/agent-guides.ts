import { MCP_CONFIG_SNIPPET, MCP_HTTP_TOOL_COUNT, MCP_SERVER, MCP_TOOLS } from "./product-facts";

export type AgentGuideKey =
  | "claude-code"
  | "codex"
  | "cursor"
  | "claude-desktop"
  | "vscode"
  | "github-copilot"
  | "stdio"
  | "api";

export type AgentConnection = {
  endpoint: string;
  apiKey: string;
};

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
  recommended?: boolean;
};

const DEFAULT_ENDPOINT = "/api/mcp";
const DEFAULT_KEY = "${CLUNK_API_KEY}";

function remoteJson(endpoint: string, key: string, root = "mcpServers"): string {
  return JSON.stringify(
    {
      [root]: {
        clunk: {
          type: "http",
          url: endpoint,
          headers: { Authorization: `Bearer ${key}` },
        },
      },
    },
    null,
    2,
  );
}

function codexCommand(endpoint: string, key: string): string {
  return [
    `$env:CLUNK_API_KEY = "${key}"`,
    `codex mcp add clunk --url "${endpoint}" --bearer-token-env-var CLUNK_API_KEY`,
    "codex mcp get clunk --json",
  ].join("\n");
}

function copilotCommand(endpoint: string, key: string): string {
  return `copilot mcp add --transport http --header "Authorization: Bearer ${key}" clunk "${endpoint}"`;
}

export function buildAgentGuides(connection?: AgentConnection): AgentGuide[] {
  const endpoint = connection?.endpoint ?? DEFAULT_ENDPOINT;
  const key = connection?.apiKey ?? DEFAULT_KEY;
  const hasIssuedKey = key !== DEFAULT_KEY;
  const authCommand = `claude mcp add clunk --scope user --transport http ${endpoint} --header "Authorization: Bearer ${key}"`;
  const remoteMcpJson = remoteJson(endpoint, key);
  const vscodeJson = remoteJson(endpoint, key, "servers");

  return [
    {
      key: "claude-code",
      label: "Claude Code",
      kicker: "원격 MCP · 권장",
      title: "Clunk 연결을 한 줄로 완료",
      description: "Clunk가 발급한 연결 키와 HTTPS endpoint를 그대로 등록합니다. 로컬 경로 치환이 없습니다.",
      fileLabel: "terminal",
      code: authCommand,
      note: hasIssuedKey
        ? "Clunk에서 발급한 이 키가 이미 명령에 삽입되어 있습니다. 실행 후 claude mcp list에서 clunk가 connected인지 확인하세요."
        : "이 공개 예시의 ${CLUNK_API_KEY}를 Clunk에서 발급한 연결 키로 바꾼 뒤 실행하세요.",
      status: "available",
      recommended: true,
    },
    {
      key: "codex",
      label: "Codex",
      kicker: "원격 MCP · CLI",
      title: "Codex CLI에 한 번에 등록",
      description: "Codex의 공식 streamable HTTP 등록 명령과 bearer-token 환경변수를 함께 생성합니다.",
      fileLabel: "PowerShell + Codex",
      code: codexCommand(endpoint, key),
      note: hasIssuedKey
        ? "PowerShell에 그대로 붙여 넣으면 ~/.codex/config.toml에 등록됩니다. `codex mcp get clunk --json`으로 URL과 bearer 환경변수를 확인하세요."
        : "${CLUNK_API_KEY}를 Clunk에서 발급한 키로 바꾼 뒤 PowerShell에서 실행하세요.",
      status: "available",
      recommended: true,
    },
    {
      key: "cursor",
      label: "Cursor",
      kicker: "IDE · CLI · 원격 HTTP",
      title: "mcp.json으로 즉시 연결",
      description: "Cursor IDE와 cursor-agent가 읽는 원격 HTTP 설정을 발급합니다.",
      fileLabel: ".cursor/mcp.json",
      code: remoteMcpJson,
      note: hasIssuedKey
        ? "프로젝트의 .cursor/mcp.json에 그대로 저장한 뒤 cursor-agent mcp list로 확인하세요."
        : "${CLUNK_API_KEY}를 발급된 키로 바꾼 뒤 .cursor/mcp.json에 저장하세요.",
      status: "available",
      recommended: true,
    },
    {
      key: "github-copilot",
      label: "GitHub Copilot",
      kicker: "원격 MCP · CLI",
      title: "Copilot에 한 줄로 추가",
      description: "GitHub Copilot CLI가 지원하는 HTTP 등록 명령에 Clunk endpoint와 Bearer 키를 넣습니다.",
      fileLabel: "copilot mcp add",
      code: copilotCommand(endpoint, key),
      note: hasIssuedKey
        ? "실행 후 `copilot mcp list`에서 Clunk를 확인하세요. 저장 위치는 Copilot 사용자 MCP 설정입니다."
        : "${CLUNK_API_KEY}를 Clunk에서 발급한 키로 바꾼 뒤 실행하세요.",
      status: "available",
      recommended: true,
    },
    {
      key: "claude-desktop",
      label: "Claude Desktop",
      kicker: "데스크톱 · 원격 HTTP",
      title: "mcpServers 블록을 바로 사용",
      description: "Claude Desktop에서 사용하는 원격 서버 블록에 Clunk endpoint와 키를 함께 넣습니다.",
      fileLabel: "claude_desktop_config.json",
      code: remoteMcpJson,
      note: hasIssuedKey
        ? "완성된 JSON을 설정에 저장한 뒤 Claude Desktop의 연결 목록에서 Clunk를 확인하세요."
        : "${CLUNK_API_KEY}를 발급된 키로 바꾼 뒤 Claude Desktop 설정에 저장하세요.",
      status: "available",
      recommended: true,
    },
    {
      key: "vscode",
      label: "VS Code",
      kicker: "편집기 · 원격 HTTP",
      title: "servers 설정으로 연결",
      description: "VS Code .vscode/mcp.json에서 사용하는 servers 형식으로 완성된 설정을 제공합니다.",
      fileLabel: ".vscode/mcp.json",
      code: vscodeJson,
      note: hasIssuedKey
        ? "이 JSON을 .vscode/mcp.json에 저장하고 MCP: List Servers에서 Clunk를 확인하세요."
        : "${CLUNK_API_KEY}를 발급된 키로 바꾼 뒤 .vscode/mcp.json에 저장하세요.",
      status: "available",
      recommended: true,
    },
    {
      key: "stdio",
      label: "로컬 stdio",
      kicker: "오프라인 fallback",
      title: "원본 파일을 직접 읽는 로컬 서버",
      description: "HTTP가 접근할 수 없는 로컬 GLB/GLTF는 기존 stdio 경로로 검사합니다. 이 경로는 로컬 파일 작업용입니다.",
      fileLabel: "mcp.json",
      code: MCP_CONFIG_SNIPPET,
      note: "로컬 원본 파일을 읽어야 할 때만 사용하세요. 현재 저장소 루트 placeholder는 제품 UI에서 자동으로 채울 수 없으므로, 이 fallback은 명시적으로 로컬 설정으로 남깁니다.",
      status: "available",
    },
    {
      key: "api",
      label: "Clunk HTTP MCP",
      kicker: "연결 상태",
      title: "Clunk가 직접 제공하는 endpoint",
      description: "remote agent는 Clunk의 HTTPS endpoint로 연결하고, 키로 workspace 범위를 인증합니다. local path는 HTTP로 읽지 않습니다.",
      fileLabel: "endpoint",
      code: [
        `endpoint: ${endpoint}`,
        "transport: streamable HTTP",
        "auth: Authorization: Bearer <issued Clunk key>",
        `remote-safe tools: ${MCP_HTTP_TOOL_COUNT} remote-safe tools · local stdio tools: ${MCP_TOOLS.length}`,
      ].join("\n"),
      note: hasIssuedKey
        ? "연결 확인 버튼이 initialize → tools/list를 실제로 호출합니다. 이 endpoint는 Clunk 소유 계약입니다."
        : "Clunk 연결 키를 발급한 뒤 연결 확인을 눌러 실제 endpoint 응답을 확인하세요.",
      status: "available",
      recommended: true,
    },
  ];
}

export const AGENT_GUIDES = buildAgentGuides();
export const DEFAULT_AGENT_GUIDE = AGENT_GUIDES[0];

export const AGENT_GUIDE_PROTOCOL_NOTE = `MCP ${MCP_SERVER.protocolVersion} · ${MCP_HTTP_TOOL_COUNT} HTTP tools · ${MCP_TOOLS.length} local stdio tools`;
