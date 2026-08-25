// Sites exposes authenticated server handlers under /api. Keep one stable
// Clunk-owned endpoint instead of advertising the host's unsupported root route.
export const MCP_HTTP_ENDPOINT_PATH = "/api/mcp" as const;
export const MCP_HTTP_PROTOCOL_VERSION = "2025-06-18" as const;

export type McpRequestId = string | number | null;

export type McpJsonRpcRequest = {
  jsonrpc: "2.0";
  id?: McpRequestId;
  method: string;
  params?: Record<string, unknown>;
};

export type McpJsonRpcResponse = {
  jsonrpc: "2.0";
  id?: McpRequestId;
  result?: unknown;
  error?: { code: number; message: string };
};

export type McpDispatch =
  | { kind: "response"; response: McpJsonRpcResponse }
  | { kind: "notification" }
  | { kind: "tool-call"; id: McpRequestId | undefined; name: string; arguments: Record<string, unknown> };

export const MCP_HTTP_TOOLS = [
  {
    name: "clunk_connection_check",
    description: "Verify the Clunk workspace connection and report which remote-safe capabilities are available.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "clunk_asset_inspect",
    description:
      "Inspect uploaded asset bytes against a Clunk target profile. HTTP cannot read a local path; send the file or bundle as base64 with safe relative names.",
    inputSchema: {
      type: "object",
      required: ["targetProfileId"],
      properties: {
        schema: { type: "string", enum: ["clunk.asset-inspection-request.v1", "clunk.asset-inspection-request.v2"] },
        fileName: { type: "string" },
        bytesBase64: { type: "string" },
        entryFileName: { type: "string" },
        files: { type: "array" },
        targetProfileId: {
          type: "string",
          description: "Engine-aware target profile id, for example harvest-frontier-web-three. Local stdio profiles pc/web/mobile are not HTTP targetProfileId values.",
        },
        assetKind: { type: "string" },
        runId: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "clunk_asset_validate",
    description:
      "Run the uploaded-asset structural contract and return numeric readiness plus observations; this never promotes visualRuntime or playerFacing review.",
    inputSchema: {
      type: "object",
      required: ["targetProfileId"],
      properties: {
        schema: { type: "string", enum: ["clunk.asset-inspection-request.v1", "clunk.asset-inspection-request.v2"] },
        fileName: { type: "string" },
        bytesBase64: { type: "string" },
        entryFileName: { type: "string" },
        files: { type: "array" },
        targetProfileId: {
          type: "string",
          description: "Engine-aware target profile id, for example harvest-frontier-web-three. Local stdio profiles pc/web/mobile are not HTTP targetProfileId values.",
        },
        assetKind: { type: "string" },
        runId: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "clunk_asset_inspection_evidence",
    description:
      "Store a locally verified clunk.asset-inspection-evidence.v2 envelope. HTTP cannot read a local path; send verified evidence hashes or use Clunk's local stdio transport for local bytes.",
    inputSchema: {
      type: "object",
      required: ["evidence"],
      properties: { evidence: { type: "object" } },
      additionalProperties: false,
    },
  },
  {
    name: "clunk_collaboration_append",
    description:
      "Append or replace a normalized frame manifest on an authenticated Clunk workspace collaboration thread without promoting human visual review.",
    inputSchema: {
      type: "object",
      required: ["threadId", "evidence"],
      properties: {
        threadId: { type: "string" },
        evidenceMode: { type: "string", enum: ["append", "replace"] },
        evidence: { type: "object" },
      },
      additionalProperties: false,
    },
  },
] as const;

export function parseBearerToken(header: string | null): string | null {
  if (typeof header !== "string") return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}

export function createMcpInitializeResult() {
  return {
    protocolVersion: MCP_HTTP_PROTOCOL_VERSION,
    capabilities: { tools: {} },
    serverInfo: { name: "clunk", version: "0.1.0" },
  } as const;
}

export function createMcpToolsListResult() {
  return { tools: MCP_HTTP_TOOLS } as const;
}

export function dispatchMcpRequest(value: unknown): McpDispatch {
  if (!isRecord(value) || value.jsonrpc !== "2.0" || typeof value.method !== "string") {
    return {
      kind: "response",
      response: {
        jsonrpc: "2.0",
        id: isRecord(value) && isMcpId(value.id) ? value.id : null,
        error: { code: -32600, message: "Invalid JSON-RPC request." },
      },
    };
  }

  const id = isMcpId(value.id) ? value.id : undefined;
  const params = value.params === undefined ? {} : value.params;
  if (!isRecord(params)) {
    return {
      kind: "response",
      response: { jsonrpc: "2.0", id, error: { code: -32602, message: "MCP params must be an object." } },
    };
  }

  if (value.method.startsWith("notifications/")) return { kind: "notification" };
  if (value.method === "initialize") {
    return { kind: "response", response: { jsonrpc: "2.0", id, result: createMcpInitializeResult() } };
  }
  if (value.method === "ping") {
    return { kind: "response", response: { jsonrpc: "2.0", id, result: {} } };
  }
  if (value.method === "tools/list") {
    return { kind: "response", response: { jsonrpc: "2.0", id, result: createMcpToolsListResult() } };
  }
  if (value.method === "tools/call") {
    const name = params.name;
    if (typeof name !== "string" || !MCP_HTTP_TOOLS.some((tool) => tool.name === name)) {
      return {
        kind: "response",
        response: { jsonrpc: "2.0", id, error: { code: -32602, message: "Unknown MCP tool." } },
      };
    }
    const args = params.arguments === undefined ? {} : params.arguments;
    if (!isRecord(args)) {
      return {
        kind: "response",
        response: { jsonrpc: "2.0", id, error: { code: -32602, message: "MCP tool arguments must be an object." } },
      };
    }
    return { kind: "tool-call", id, name, arguments: args };
  }
  return {
    kind: "response",
    response: { jsonrpc: "2.0", id, error: { code: -32601, message: `Unsupported MCP method: ${value.method}` } },
  };
}

function isMcpId(value: unknown): value is McpRequestId {
  return value === null || typeof value === "string" || typeof value === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
