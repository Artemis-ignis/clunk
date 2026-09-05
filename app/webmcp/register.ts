"use client";

/**
 * WebMCP — 이 페이지가 직접 에이전트에게 내주는 도구들.
 *
 * 브라우저가 노출하는 명령형 API(`navigator.modelContext.registerTool`, 옛 문서에서는
 * `document.modelContext`)에 도구를 등록한다. 서버 MCP(/api/mcp)와 다른 점은 하나다 —
 * 여기 등록된 도구는 **지금 이 화면**을 움직인다. 에이전트가 마켓을 걸러 보면 사람이 보고
 * 있는 그 목록이 그대로 바뀌고, 와이어프레임을 켜면 사람이 보던 모델이 그 자리에서 바뀐다.
 *
 * 규칙 셋:
 *  1. 도구는 평범한 JSON 만 돌려준다. DOM 노드도, undefined 도 내보내지 않는다.
 *  2. 던지지 않는다. 실패는 { ok:false, error } 로 돌려준다.
 *  3. 값을 지어내지 않는다. 숫자는 전부 /api/marketplace 응답이나 화면이 이미 측정해 둔
 *     값에서 온다.
 */

/** 도구 하나. WebMCP 명세의 ModelContextTool 과 같은 모양이다. */
export type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: unknown, options?: { signal?: AbortSignal }) => Promise<unknown> | unknown;
};

type ModelContext = {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => void | Promise<void>;
};

/** McpEndpointStatus 가 이미 듣고 있는 이벤트 이름. 늘리기만 하고 바꾸지 않는다. */
export const STATUS_EVENT = "clunk:webmcp-status";

export type WebMcpStatus = "registered" | "unavailable" | "error";

/** 상태 이벤트에 실리는 값. status/detail 은 옛 카드가 읽던 그대로이고 tools 만 늘었다. */
export type WebMcpStatusDetail = {
  status: WebMcpStatus;
  detail: string;
  /** 지금 이 페이지에 실제로 등록되어 있는 도구들. */
  tools: RegisteredTool[];
};

/** 등록된 도구 한 줄. /webmcp 의 상태판이 이것을 그대로 읽는다. */
export type RegisteredTool = {
  name: string;
  description: string;
  /** 어느 화면이 등록했는지 — 전역, 상품, 스튜디오, 검사. */
  surface: string;
};

/* ---------------------------------------------------------------------------
   브라우저가 내주는 자리 찾기
   ------------------------------------------------------------------------- */

/**
 * 이 브라우저의 WebMCP 자리.
 *
 * 지금 크롬(149, chrome://flags/#enable-webmcp-testing)과 ChatGPT 인앱 브라우저는
 * `navigator.modelContext` 로 내주고, 명세 문서와 초기 구현은 `document.modelContext`
 * 로 적었다. 둘 다 본다 — 없으면 null 이고, 그때는 아무 소리도 내지 않는다.
 */
export function getModelContext(): ModelContext | null {
  if (typeof navigator === "undefined" && typeof document === "undefined") return null;
  const fromNavigator = typeof navigator === "undefined"
    ? undefined
    : (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
  const fromDocument = typeof document === "undefined"
    ? undefined
    : (document as Document & { modelContext?: ModelContext }).modelContext;
  const fromWindow = typeof window === "undefined"
    ? undefined
    : (window as Window & { modelContext?: ModelContext }).modelContext;
  const context = fromNavigator ?? fromDocument ?? fromWindow;
  return context && typeof context.registerTool === "function" ? context : null;
}

/* ---------------------------------------------------------------------------
   등록부 — 지금 이 페이지에 무엇이 걸려 있는지
   ------------------------------------------------------------------------- */

const registry = new Map<string, RegisteredTool>();
let lastStatus: WebMcpStatus = "unavailable";
let lastDetail = "이 브라우저는 화면 안 도구(WebMCP)를 아직 받지 않습니다.";

/** 지금 등록되어 있는 도구들. 등록한 순서 그대로. */
export function registeredTools(): RegisteredTool[] {
  return [...registry.values()];
}

export function currentStatus(): WebMcpStatusDetail {
  return { status: lastStatus, detail: lastDetail, tools: registeredTools() };
}

function announce(status: WebMcpStatus, detail: string): void {
  lastStatus = status;
  lastDetail = detail;
  if (typeof document === "undefined" || typeof window === "undefined") return;
  document.documentElement.dataset.webmcpStatus = status;
  document.documentElement.dataset.webmcpDetail = detail;
  document.documentElement.dataset.webmcpTools = String(registry.size);
  window.dispatchEvent(new CustomEvent<WebMcpStatusDetail>(STATUS_EVENT, { detail: currentStatus() }));
}

/** WebMCP 가 없는 브라우저라고 한 번만 알린다. 콘솔에는 아무것도 찍지 않는다. */
export function announceUnavailable(): void {
  if (registry.size > 0) return;
  announce("unavailable", "이 브라우저는 화면 안 도구(WebMCP)를 아직 받지 않습니다.");
}

/* ---------------------------------------------------------------------------
   결과 다듬기
   ------------------------------------------------------------------------- */

/** 도구가 실패했을 때의 한 가지 모양. 어디서든 이것만 돌아온다. */
export type ToolFailure = { ok: false; error: string };

/**
 * 돌려줄 값을 JSON 으로만 남긴다.
 *
 * DOM 노드, 함수, 순환 참조, undefined 는 전부 여기서 걸린다 — 에이전트가 받는 것은
 * 언제나 문자열로 굳는 평범한 객체다.
 */
export function jsonSafe(value: unknown): unknown {
  if (value === undefined) return { ok: true };
  try {
    const text = JSON.stringify(value);
    if (typeof text !== "string") return { ok: false, error: "The result could not be turned into JSON." } satisfies ToolFailure;
    return JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "The result could not be turned into JSON." } satisfies ToolFailure;
  }
}

function failure(error: unknown): ToolFailure {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

/* ---------------------------------------------------------------------------
   JSON 스키마 거들기
   ------------------------------------------------------------------------- */

export function objectSchema(
  properties: Record<string, Record<string, unknown>> = {},
  required: readonly string[] = [],
): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    ...(required.length ? { required: [...required] } : {}),
  };
}

export function stringProp(description: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { type: "string", description, ...extra };
}

export function enumProp(description: string, values: readonly string[]): Record<string, unknown> {
  return { type: "string", description, enum: [...values] };
}

export function numberProp(description: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { type: "number", description, ...extra };
}

export function boolProp(description: string): Record<string, unknown> {
  return { type: "boolean", description };
}

/** 입력이 객체가 아닐 수도 있다(빈 호출). 언제나 읽을 수 있는 모양으로 바꿔 둔다. */
export function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
}

/* ---------------------------------------------------------------------------
   등록
   ------------------------------------------------------------------------- */

/**
 * 도구를 등록한다.
 *
 * - 같은 이름이 이미 걸려 있으면 건너뛴다(한 페이지에 두 번 등록되지 않는다).
 * - 모든 execute 는 감싸여서, 던지는 대신 { ok:false, error } 를 돌려준다.
 * - signal 이 끊기면 브라우저가 도구를 내리고, 등록부에서도 지운다.
 */
export async function registerTools(
  tools: readonly WebMcpTool[],
  signal: AbortSignal,
  surface: string,
): Promise<{ ok: boolean; registered: string[]; reason?: string }> {
  const context = getModelContext();
  if (!context) {
    announceUnavailable();
    return { ok: false, registered: [], reason: "unavailable" };
  }
  const fresh = tools.filter((tool) => !registry.has(tool.name));
  const registered: string[] = [];
  try {
    for (const tool of fresh) {
      if (signal.aborted) break;
      const wrapped: WebMcpTool = {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: async (input, options) => {
          try {
            return jsonSafe(await tool.execute(input, options));
          } catch (error) {
            return failure(error);
          }
        },
      };
      await context.registerTool(wrapped, { signal });
      registry.set(tool.name, { name: tool.name, description: tool.description, surface });
      registered.push(tool.name);
    }
    signal.addEventListener("abort", () => {
      for (const name of registered) registry.delete(name);
      announce(registry.size > 0 ? "registered" : "unavailable", `이 화면에 도구 ${registry.size}개가 걸렸습니다.`);
    }, { once: true });
    announce("registered", `이 화면에 도구 ${registry.size}개가 걸렸습니다.`);
    return { ok: true, registered };
  } catch (error) {
    announce("error", error instanceof Error ? error.message : "화면 안 도구를 걸지 못했습니다.");
    return { ok: false, registered, reason: "error" };
  }
}

/* ---------------------------------------------------------------------------
   기다리기 — 에이전트가 부른 동작이 화면에서 끝날 때까지
   ------------------------------------------------------------------------- */

/**
 * 조건이 참이 될 때까지 기다린다. 화면 연출은 시간이 걸리는 물건이라, 도구는 "눌렀다"
 * 가 아니라 "그 결과가 화면에 섰다" 를 돌려주어야 한다. 못 기다리면 false 다.
 */
export async function waitFor(
  ready: () => boolean,
  timeoutMs: number,
  stepMs = 90,
): Promise<boolean> {
  if (ready()) return true;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, stepMs));
    if (ready()) return true;
  }
  return false;
}
