"use client";

import { useEffect } from "react";

type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: unknown, options?: { signal?: AbortSignal }) => Promise<unknown>;
};

type ModelContext = {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => void | Promise<void>;
};

type ContextWindow = Window & {
  modelContext?: ModelContext;
};

const STATUS_EVENT = "clunk:webmcp-status";

function announce(status: "registered" | "unavailable" | "error", detail: string) {
  document.documentElement.dataset.webmcpStatus = status;
  document.documentElement.dataset.webmcpDetail = detail;
  window.dispatchEvent(new CustomEvent(STATUS_EVENT, { detail: { status, detail } }));
}

function publicOrigin() {
  return new URL("/api/mcp", window.location.origin).toString();
}

function createTools(): WebMcpTool[] {
  return [
    {
      name: "clunk_connection_check",
      description: "Read Clunk's public HTTP MCP status. This checks transport availability only; it never approves an asset or a game frame.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      execute: async () => {
        const response = await fetch(publicOrigin(), { cache: "no-store" });
        const payload = await response.json();
        return {
          ok: response.ok,
          httpStatus: response.status,
          endpoint: publicOrigin(),
          product: "clunk",
          transport: "streamable-http",
          payload,
          boundary: {
            structural: "requires authenticated inspection evidence",
            visualRuntime: "GAP",
            playerFacing: "NOT_EVALUATED",
            humanDecision: "PENDING",
          },
        };
      },
    },
    {
      name: "clunk_product_capabilities",
      description: "Describe Clunk's available read-only asset, evidence, and collaboration contracts without claiming runtime or human visual approval.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      execute: async () => ({
        product: "Clunk",
        contracts: [
          "clunk.asset-inspection-evidence.v2",
          "clunk.frame-manifest.v1",
          "clunk.frame-comparison.v1",
          "clunk.asset-evidence-ref.v1",
        ],
        surfaces: ["GLB/GLTF structure", "2D readability", "texture audit", "frame evidence", "MCP handshake"],
        readOnly: true,
        optimizer: "never called by this browser tool",
        stateBoundary: {
          structural: "PASS or FAIL from verified bytes and policy",
          visualRuntime: "GAP until shipped renderer evidence is linked",
          playerFacing: "NOT_EVALUATED until human review exists",
          humanDecision: "independent review state",
        },
      }),
    },
  ];
}

export function WebMcpBridge() {
  useEffect(() => {
    const controller = new AbortController();
    // Primary API is document.modelContext; navigator.modelContext remains a compatibility fallback.
    const context = (document as Document & { modelContext?: ModelContext }).modelContext
      ?? (navigator as Navigator & { modelContext?: ModelContext }).modelContext
      ?? (window as ContextWindow).modelContext;

    if (!context?.registerTool) {
      announce("unavailable", "이 브라우저는 WebMCP imperative API를 노출하지 않습니다.");
      return () => controller.abort();
    }

    void (async () => {
      try {
        for (const tool of createTools()) {
          await context.registerTool(tool, { signal: controller.signal });
        }
        announce("registered", "2개 읽기 전용 도구가 등록되었습니다.");
      } catch (error) {
        announce("error", error instanceof Error ? error.message : "WebMCP 도구 등록에 실패했습니다.");
      }
    })();

    return () => controller.abort();
  }, []);

  return null;
}

export { STATUS_EVENT as WEBMCP_STATUS_EVENT };
