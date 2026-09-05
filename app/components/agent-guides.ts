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
  /**
   * 화면에 그릴 때만 쓰는, 가려진 키. 복사·연결 확인은 언제나 apiKey 를 쓴다.
   * 비어 있으면 화면도 실제 키를 그린다(예전 동작).
   */
  maskedApiKey?: string;
};

export type AgentGuide = {
  key: AgentGuideKey;
  label: string;
  kicker: string;
  title: string;
  description: string;
  fileLabel: string;
  /** 복사·다운로드가 쓰는 값. 실제 키가 들어 있다. */
  code: string;
  /** 화면에 그리는 값. 키가 가려져 있다. 가릴 것이 없으면 code 와 같다. */
  displayCode: string;
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

/**
 * 화면에 그리는 판과 복사되는 판을 갈라 놓는다.
 *
 * 예전에는 발급된 평문 키가 `claude mcp add … --header "Authorization: Bearer clunk_live_…"`
 * 스니펫 안에 통째로 렌더되어, 화면 공유·녹화·스크린샷·어깨너머에 그대로 남았다. 이제
 * 화면에는 가린 판(displayCode)이 나가고, 복사 버튼과 연결 확인만 실제 키(code)를 쓴다.
 */
export function buildAgentGuides(connection?: AgentConnection): AgentGuide[] {
  const endpoint = connection?.endpoint ?? DEFAULT_ENDPOINT;
  const real = buildGuidesForKey(endpoint, connection?.apiKey ?? DEFAULT_KEY);
  if (!connection?.maskedApiKey) return real;
  const masked = buildGuidesForKey(endpoint, connection.maskedApiKey);
  return real.map((guide, index) => ({ ...guide, displayCode: masked[index].code }));
}

function buildGuidesForKey(endpoint: string, key: string): AgentGuide[] {
  const hasIssuedKey = key !== DEFAULT_KEY;
  const authCommand = `claude mcp add clunk --scope user --transport http ${endpoint} --header "Authorization: Bearer ${key}"`;
  const remoteMcpJson = remoteJson(endpoint, key);
  const vscodeJson = remoteJson(endpoint, key, "servers");

  const guides: Omit<AgentGuide, "displayCode">[] = [
    {
      key: "claude-code",
      label: "Claude Code",
      kicker: "원격 MCP · 권장",
      title: "Clunk 연결을 한 줄로 완료",
      description: "Clunk가 발급한 연결 키와 HTTPS 연결 주소를 그대로 등록합니다. 내 컴퓨터 경로를 바꿔 넣을 일이 없습니다.",
      fileLabel: "명령줄",
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
      description: "Codex가 쓰는 원격 연결 등록 명령과 키 환경변수를 함께 만들어 줍니다.",
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
      description: "Cursor 편집기와 cursor-agent 가 읽는 원격 연결 설정을 만들어 줍니다.",
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
      description: "GitHub Copilot 명령줄 도구의 등록 명령에 Clunk 연결 주소와 인증 키를 넣습니다.",
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
      description: "Claude Desktop이 쓰는 원격 서버 설정에 Clunk 연결 주소와 키를 함께 넣습니다.",
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
      description: "VS Code 의 .vscode/mcp.json 형식으로 완성된 설정을 그대로 드립니다.",
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
      label: "내 컴퓨터 연결",
      kicker: "내 컴퓨터에서 도는 서버",
      title: "원본 파일을 직접 읽는 내 컴퓨터 서버",
      description: "웹으로는 열 수 없는 내 컴퓨터 안의 GLB·GLTF 는 내 컴퓨터에서 도는 서버가 읽어 검사합니다. 이 길은 내 컴퓨터 파일 작업용입니다.",
      fileLabel: "mcp.json",
      code: MCP_CONFIG_SNIPPET,
      note: "내 컴퓨터의 원본 파일을 읽어야 할 때만 쓰세요. 저장소 위치는 사람마다 달라 이 화면이 대신 채울 수 없으므로, 설정 안의 그 자리는 직접 적어야 합니다.",
      status: "available",
    },
    {
      key: "api",
      label: "Clunk 연결 정보",
      kicker: "연결 상태",
      title: "Clunk가 직접 운영하는 연결 주소",
      description: "웹으로 연결한 도구는 Clunk의 HTTPS 주소로 붙고, 키로 어느 작업공간인지를 확인합니다. 내 컴퓨터 안의 경로는 이 길로 읽지 않습니다.",
      fileLabel: "연결 정보",
      code: [
        `연결 주소: ${endpoint}`,
        "전송: streamable HTTP",
        "인증: Authorization: Bearer <발급받은 Clunk 키>",
        `웹으로 쓰는 도구 ${MCP_HTTP_TOOL_COUNT}개 · 내 컴퓨터에서 쓰는 도구 ${MCP_TOOLS.length}개`,
      ].join("\n"),
      note: hasIssuedKey
        ? "연결 확인 버튼이 이 주소에 실제로 물어보고 답을 그대로 보여 줍니다. 이 주소는 Clunk가 직접 운영합니다."
        : "Clunk 연결 키를 발급한 뒤 연결 확인을 눌러 이 주소의 실제 응답을 확인하세요.",
      status: "available",
      recommended: true,
    },
  ];
  return guides.map((guide) => ({ ...guide, displayCode: guide.code }));
}

export const AGENT_GUIDES = buildAgentGuides();
export const DEFAULT_AGENT_GUIDE = AGENT_GUIDES[0];

export const AGENT_GUIDE_PROTOCOL_NOTE = `MCP ${MCP_SERVER.protocolVersion} · 웹으로 쓰는 도구 ${MCP_HTTP_TOOL_COUNT}개 · 내 컴퓨터에서 쓰는 도구 ${MCP_TOOLS.length}개`;
