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

/**
 * 이 원격 서버가 받는 targetProfileId 전부.
 *
 * packages/core의 getBuiltInTargetProfiles()가 진짜 등록부이고, 이 배열은 그것을 그대로
 * 베낀 것입니다. 여기서 다시 적는 이유는 이 파일이 브라우저 번들에도 실려서
 * (product-facts → /agents) core 전체를 끌어올 수 없기 때문입니다. 둘이 어긋나면
 * tests/mcp-http-contract.test.ts가 먼저 깨집니다.
 */
export const MCP_HTTP_TARGET_PROFILE_IDS = [
  "yeongheo-pixi-2d",
  "harvest-frontier-web-three",
  "godot-4",
  "unity",
  "unreal",
  "web-three-mobile",
  "android",
  "ios",
] as const;

/**
 * 업로드 검사 두 도구가 공유하는 입력 스키마.
 *
 * 2026-09-05 실측: 예전 스키마는 required가 ["targetProfileId"] 하나뿐이었습니다.
 * 스키마만 읽은 에이전트가 targetProfileId만 넣고 부르면 핸들러는 `Invalid fileName.`을
 * 돌려주고 끝났습니다 — 스키마가 통과시킨 호출을 핸들러가 거절한 것입니다. 바이트를
 * 넣는 두 가지 방법을 스키마 본문에 적고, targetProfileId는 실제 값을 enum으로 못 박습니다.
 */
const UPLOAD_INSPECTION_SCHEMA = {
  type: "object",
  required: ["targetProfileId"],
  description:
    "Send the bytes one of two ways: a single file as fileName + bytesBase64, or a multi-file bundle as entryFileName + files[]. A call with targetProfileId alone is rejected — there is nothing to inspect.",
  properties: {
    schema: {
      type: "string",
      enum: ["clunk.asset-inspection-request.v1", "clunk.asset-inspection-request.v2"],
      description: "Optional. Inferred as v2 when files[] is present, v1 otherwise.",
    },
    fileName: { type: "string", description: "Single-file form: one file name, never a path. Pair it with bytesBase64." },
    bytesBase64: { type: "string", description: "Single-file form: the file's bytes, base64. Up to 64 MB decoded." },
    entryFileName: { type: "string", description: "Bundle form: which entry in files[] is the asset to open." },
    files: {
      type: "array",
      description: "Bundle form: up to 256 entries, 64 MB decoded in total. entryFileName must name one of them.",
      items: {
        type: "object",
        required: ["fileName", "bytesBase64"],
        properties: {
          fileName: { type: "string", description: "Relative name inside the bundle. No absolute path, no '..'." },
          bytesBase64: { type: "string", description: "That file's bytes, base64." },
          role: {
            type: "string",
            enum: ["entry", "project", "atlas", "page", "texture", "skeleton", "animation", "buffer", "sidecar", "unknown"],
            description: "Optional. Only entryFileName may use the entry role.",
          },
          relatesTo: {
            type: "array",
            items: { type: "string" },
            description: "Optional. Other fileName values in this same bundle.",
          },
        },
      },
    },
    targetProfileId: {
      type: "string",
      enum: MCP_HTTP_TARGET_PROFILE_IDS,
      description: "Which engine to check against, for example unity or harvest-frontier-web-three. It selects the triangle/material/texture budgets the score is judged against — unity, godot-4 and unreal use the desktop budget (250,000 triangles, 24 materials), web-three-mobile the mobile one (25,000 triangles, 6 materials). harvest-frontier-web-three is the Harvest Frontier delivery contract, not a general check: it additionally requires named root/socket/collider nodes and EXT_meshopt_compression as ERRORs, so an ordinary uncompressed GLB is always BLOCKED under it — use web-three-mobile or unity for a general verdict. The local stdio names pc/web/mobile are policy profiles and are not accepted here.",
    },
    assetKind: {
      type: "string",
      enum: ["3d-model", "2d-image", "sprite-atlas", "spine-project", "animation-clip"],
      description: "Optional. Inferred from the file extension and bytes when omitted.",
    },
    runId: { type: "string", description: "Optional. Your own id for this run, echoed back in the evidence." },
  },
  additionalProperties: false,
} as const;

export const MCP_HTTP_TOOLS = [
  {
    name: "clunk_connection_check",
    description: "Verify the Clunk workspace connection and report which remote-safe capabilities are available.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "clunk_search_assets",
    description:
      "Search Clunk's published game-asset catalogue: farm structures, props, trees and seamless textures. Filter by text, theme, grade, polygon budget, whether the asset carries motion, and whether it is free. Every figure (polygons, materials, real size in metres, bytes, animations) was measured by the pipeline — a figure that could not be measured comes back as null, never as a guess, and an asset with no measured polygon count is left out of a polygon filter rather than assumed to be small. Each result carries the URL a signed-in human downloads from.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free text, matched against the slug, title and description. The catalogue is Korean, so an English word may match nothing — leave this out and filter instead when unsure." },
        theme: { type: "string", enum: ["all", "structure", "prop", "tree", "texture"], description: "structure = barns, greenhouses, stalls, gates · prop = crates, haystacks and other loose objects · tree = trees · texture = seamless tiles." },
        grade: { type: "string", enum: ["S", "A", "B"], description: "Grade is access: B is free to any signed-in visitor, A and S need a subscription." },
        maxPolygons: { type: "number", minimum: 1, description: "Only assets whose measured triangle count is at most this." },
        minPolygons: { type: "number", minimum: 1, description: "Only assets whose measured triangle count is at least this." },
        hasAnimation: { type: "boolean", description: "Only assets that carry animation clips or named moving parts." },
        freeOnly: { type: "boolean", description: "Only grade B, the assets a signed-in human can download without a subscription." },
        limit: { type: "number", minimum: 1, maximum: 50, description: "How many results to return. Default 12, maximum 50." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "clunk_asset_facts",
    description:
      "Read one published listing's measured facts by slug: grade and what earned it, polygon and material counts, real size in metres, file size and format, animation clips, named moving parts, licence, and the download URL. Fields the pipeline could not measure come back as null. Call clunk_search_assets first to learn a slug.",
    inputSchema: {
      type: "object",
      required: ["slug"],
      properties: { slug: { type: "string", description: "The listing's slug, as it appears in its product URL, for example cozy-crate-closed." } },
      additionalProperties: false,
    },
  },
  {
    name: "clunk_asset_inspect",
    description:
      "Inspect uploaded asset bytes against one engine's target profile and return the measured evidence: triangle and draw-call counts, materials, texture memory, bounding box, and every rule finding. For a 3D model the findings also cover physical plausibility, measured in world space with every parent transform applied: how far the scene's lowest point sits from the y=0 ground plane (GEO-GROUND-CONTACT), named parts that touch neither the ground nor any other part and the millimetre gap to the nearest one (GEO-FLOATING-PART), parts whose triangles actually intersect with the penetration depth in millimetres and, for an animated file, the clip and phase where it is deepest (GEO-PART-INTERSECTION, 8 phases sampled per clip), zero-thickness single-sided cards (GEO-THIN-SHELL), animation channels that drive node scale (SCENE-ANIMATED-SCALE), unnamed mesh nodes (SCENE-UNNAMED-MESH) and declared extensionsRequired (FORMAT-EXTENSION-REQUIRED). None of those is a hard blocker: a tree's roots below ground, a shaft through its bearing and a leaf card are all intended, so they are reported as measurements for a human or agent to judge. HTTP cannot read a path on your machine — send the file itself as base64 (fileName + bytesBase64), or a multi-file bundle (entryFileName + files[]). Use Clunk's local stdio MCP when the file must stay on disk.",
    inputSchema: UPLOAD_INSPECTION_SCHEMA,
  },
  {
    name: "clunk_asset_validate",
    description:
      "Answer whether uploaded bytes pass the target profile's structural contract: returns valid true/false, a 0-100 score, the count of hard blockers, and the blocking findings themselves. Same input as clunk_asset_inspect; use this one when you want a verdict rather than the full evidence. hardBlockerCount counts only ERROR and CRITICAL findings, so the physical-plausibility rules (floating part, part intersection, ground contact, thin shell) never add to it — they come back in the report's findings as WARNING or INFO with the measured millimetres, because the same measurement describes a defect in one file and the author's intent in the next. Read those before shipping even when valid is true. `valid` and `score` are the FILE-ONLY lanes' answer: this endpoint never drives an engine editor, so `coverage` names which lanes ran (bytes, structure, policy) and which did not (import, runtime, and device on android/ios come back ENVIRONMENT_UNAVAILABLE), `engineVerified` is false whenever an engine lane was skipped, and `scoreBasis` says in one line what the number covers. `readiness` explains why ready can be false at score 100 — a rounded score hides a single WARNING. A structural pass is not a statement that the asset looks right in a game — visualRuntime and playerFacing stay unevaluated.",
    inputSchema: UPLOAD_INSPECTION_SCHEMA,
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
  {
    name: "clunk_scene_review",
    description:
      "Run a scene review over a frame manifest and evaluate whether its shipped evidence is reviewable; this never turns numeric PASS into human visual approval.",
    inputSchema: {
      type: "object",
      required: ["manifest"],
      properties: { manifest: { type: "object", description: "clunk.frame-manifest.v1 JSON; local absolute paths are references only over HTTP." } },
      additionalProperties: false,
    },
  },
  {
    name: "clunk_sprite_sheet_review",
    description:
      "Review a PixiJS sprite sheet manifest with measured pixel metrics; CONTRACT_FIXTURE and PLAYER_FACING_CAPTURE remain separate and human review is never inferred.",
    inputSchema: {
      type: "object",
      required: ["manifest"],
      properties: { manifest: { type: "object", description: "clunk.sprite-sheet-review.v1 with declared sheet hashes and measured metrics." } },
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
