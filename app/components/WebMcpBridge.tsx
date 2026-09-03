"use client";

import { useEffect } from "react";

import { createGlobalTools } from "../webmcp/global-tools";
import { registerTools, STATUS_EVENT, type WebMcpTool } from "../webmcp/register";

/**
 * 모든 화면에 걸리는 WebMCP 도구.
 *
 * 브라우저 자리를 찾는 일(navigator.modelContext, 옛 이름 document.modelContext), 등록,
 * 상태 알림은 전부 app/webmcp/register.ts 한 곳에 있다 — 화면마다 도구를 다시 등록하지만
 * 등록부는 하나다.
 */

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
    void registerTools([...createTools(), ...createGlobalTools()], controller.signal, "global");
    return () => controller.abort();
  }, []);

  return null;
}

export { STATUS_EVENT as WEBMCP_STATUS_EVENT };
