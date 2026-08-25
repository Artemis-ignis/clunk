import { MCP_CONFIG_SNIPPET, MCP_SERVER, MCP_TOOLS } from "./product-facts";

export type AgentGuideKey =
  | "claude-code"
  | "codex"
  | "cursor"
  | "claude-desktop"
  | "vscode"
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

const DEFAULT_ENDPOINT = "/mcp";
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

export function buildAgentGuides(connection?: AgentConnection): AgentGuide[] {
  const endpoint = connection?.endpoint ?? DEFAULT_ENDPOINT;
  const key = connection?.apiKey ?? DEFAULT_KEY;
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
      note: connection
        ? "Clunk에서 발급한 이 키가 이미 명령에 삽입되어 있습니다. 실행 후 claude mcp list에서 clunk가 connected인지 확인하세요."
        : "먼저 ‘Clunk 연결 키 만들기’를 누르면 이 블록에 일회성 키가 자동으로 삽입됩니다.",
      status: "available",
      recommended: true,
    },
    {
      key: "codex",
      label: "Codex",
      kicker: "원격 MCP · JSON",
      title: "프로젝트 MCP 설정을 바로 다운로드",
      description: "Clunk endpoint와 Authorization header가 채워진 JSON을 Codex MCP 설정에 넣습니다.",
      fileLabel: "mcp.json",
      code: remoteMcpJson,
      note: connection
        ? "이 JSON은 Clunk 연결 키가 삽입된 완성본입니다. Codex의 MCP 서버 설정에 그대로 붙여 넣으세요."
        : "키를 만들면 placeholder가 없는 완성 JSON을 복사·다운로드할 수 있습니다.",
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
      note: connection
        ? "프로젝트의 .cursor/mcp.json에 그대로 저장한 뒤 cursor-agent mcp list로 확인하세요."
        : "키 발급 후 .cursor/mcp.json 완성본을 바로 복사할 수 있습니다.",
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
      note: connection
        ? "완성된 JSON을 설정에 저장한 뒤 Claude Desktop의 연결 목록에서 Clunk를 확인하세요."
        : "키를 만들면 실제 endpoint와 일회성 키가 들어간 JSON이 생성됩니다.",
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
      note: connection
        ? "이 JSON을 .vscode/mcp.json에 저장하고 MCP: List Servers에서 Clunk를 확인하세요."
        : "키 발급 뒤 workspace용 VS Code 설정을 그대로 복사할 수 있습니다.",
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
        `remote-safe tools: ${MCP_TOOLS.length} local tools + collaboration evidence lane`,
      ].join("\n"),
      note: connection
        ? "연결 확인 버튼이 initialize → tools/list를 실제로 호출합니다. 이 endpoint는 Clunk 소유 계약입니다."
        : "Clunk 연결 키를 발급한 뒤 연결 확인을 눌러 실제 endpoint 응답을 확인하세요.",
      status: "available",
      recommended: true,
    },
  ];
}

export const AGENT_GUIDES = buildAgentGuides();
export const DEFAULT_AGENT_GUIDE = AGENT_GUIDES[0];

export const AGENT_GUIDE_PROTOCOL_NOTE = `MCP ${MCP_SERVER.protocolVersion} · ${MCP_TOOLS.length} local stdio tools`;
