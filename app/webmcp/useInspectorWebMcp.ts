"use client";

import { useEffect, useRef } from "react";

import { asRecord, objectSchema, registerTools, stringProp, type WebMcpTool } from "./register";

/**
 * 검사 화면 — 에이전트가 파일 주소를 주면 이 브라우저에서 연다.
 *
 * 바이트는 서버로 올라가지 않는다. 화면이 쓰는 그 검사기(packages/core inspectAsset)를
 * 이 탭에서 돌리고, 결과는 사람이 보는 그 점수판에 그대로 뜬다. 도구가 돌려주는 값은
 * 그 보고서에서 읽은 것뿐이다.
 */

/** One rule the report fired, said in the rule's own words plus the screen's Korean label. */
export type InspectFinding = {
  rule: string;
  title: string;
  title_ko: string;
  severity: string;
  observed: string | number;
  threshold: string | number;
};

export type InspectOutcome =
  | {
    ok: true;
    fileName: string;
    profileId: string;
    score: number;
    threshold: number;
    ready: boolean;
    hardBlockerCount: number;
    blockers: InspectFinding[];
    warnings: InspectFinding[];
    facts: Record<string, number>;
    inputHash: string;
    analysisId: string;
  }
  | { ok: false; error: string; error_ko?: string };

export type InspectorWebMcpInput = {
  active: boolean;
  /** 주소에서 파일을 받아 화면의 검사 흐름을 그대로 돌린다. */
  run: (url: string) => Promise<InspectOutcome>;
};

export function useInspectorWebMcp(input: InspectorWebMcpInput): void {
  const live = useRef(input);
  // Refreshed after every commit rather than during render: the tools read this ref from
  // event handlers, which always run after the commit that set it.
  useEffect(() => { live.current = input; });

  useEffect(() => {
    if (!input.active) return;
    const controller = new AbortController();

    const tools: WebMcpTool[] = [
      {
        name: "inspect_url",
        description:
          "Fetch a GLB/GLTF from a URL and inspect it in this browser tab — the bytes are never uploaded. Returns the score against the profile the screen is set to, the hard blockers, the warnings, and the figures read out of the file itself. The result appears on the human's screen at the same time.",
        inputSchema: objectSchema({ url: stringProp("URL of the GLB/GLTF to inspect. Must be reachable from this browser.") }, ["url"]),
        execute: async (raw) => {
          const url = String(asRecord(raw).url ?? "").trim();
          if (!url) return { ok: false, error: "A url is required.", error_ko: "url 이 필요합니다." };
          return live.current.run(url);
        },
      },
    ];

    void registerTools(tools, controller.signal, "inspector");
    return () => controller.abort();
  }, [input.active]);
}
