/**
 * Single source of truth for the /docs GitBook information architecture.
 *
 * 2026-08-31 master directive: docs is PAGE-PER-TOPIC with a persistent
 * sidebar, not one long scroll. The eight sections that used to be anchors on
 * one page (#quickstart … #scope) are now real routes; labels, section numbers
 * and ledes below are the SAME strings the single-page docs used, so nothing
 * was rewritten — only split.
 *
 * The sidebar, the sidebar search, the overview cards and the per-page
 * prev/next pager all read this list, so a route can never drift out of the
 * table of contents.
 */

export type DocsRouteId =
  | "overview"
  | "quickstart"
  | "clients"
  | "cli"
  | "asset-studio"
  | "contracts"
  | "harvest-frontier"
  | "webmcp"
  | "scope";

export type DocsRoute = {
  id: DocsRouteId;
  href: string;
  /** Section number carried over from the single-page docs (01 … 08). */
  order?: string;
  /** Sidebar / search label. */
  label: string;
  /** Section eyebrow, verbatim from the previous docs sections. */
  eyebrow: string;
  /** Page heading, verbatim from the previous section headings. */
  title: string;
  /** Plain-text lede, verbatim from the previous section leads. */
  summary: string;
  /** Search keywords (navigation aid only). */
  keywords: string;
};

export const DOCS_ROUTES: readonly DocsRoute[] = [
  {
    id: "overview",
    href: "/docs",
    label: "개요",
    eyebrow: "CLUNK DOCUMENTATION",
    title: "문서 개요",
    summary:
      "GitBook식으로 빠른 시작, 클라이언트 설정, API 계약, 실제 화면 검토를 분리했습니다. 읽는 순서가 곧 실행 순서입니다.",
    keywords: "docs 문서 목차 overview 개요",
  },
  {
    id: "quickstart",
    href: "/docs/quickstart",
    order: "01",
    label: "빠른 시작",
    eyebrow: "START HERE",
    title: "빠른 시작",
    summary:
      "원격 에이전트는 HTTPS MCP, 로컬 파일은 stdio를 사용합니다. 에이전트 연결 화면에서 키를 발급하면 클라이언트별 설정이 완성됩니다.",
    keywords: "mcp endpoint 연결 키",
  },
  {
    id: "clients",
    href: "/docs/clients",
    order: "02",
    label: "클라이언트별 설정",
    eyebrow: "COPY THE RIGHT SHAPE",
    title: "클라이언트별 설정",
    summary: "클라이언트가 읽는 설정 모양만 고르면 됩니다. 키는 workspace에서 발급하고 화면에서 복사합니다.",
    keywords: "claude code codex cursor copilot vscode",
  },
  {
    id: "cli",
    href: "/docs/cli",
    order: "03",
    label: "CLI와 CI",
    eyebrow: "AUTOMATE THE GATE",
    title: "CLI와 CI",
    summary:
      "CLI는 실제 바이트를 읽고 JSON evidence와 0/2/4 exit code를 남깁니다. 긴 예시는 필요할 때만 펼칩니다.",
    keywords: "inspect validate passport texture readability",
  },
  {
    id: "asset-studio",
    href: "/docs/asset-studio",
    order: "04",
    label: "Asset Studio",
    eyebrow: "AUTHOR · INSPECT · ATTACH",
    title: "Asset Studio",
    summary: "2D와 3D 모두 provenance를 남기고 검사합니다. 생성 완료와 게임 화면 승인은 다른 증거입니다.",
    keywords: "sprite atlas spine glb animation series game ready 생성",
  },
  {
    id: "contracts",
    href: "/docs/contracts",
    order: "05",
    label: "계약과 상태",
    eyebrow: "READ THE RESULT CORRECTLY",
    title: "계약과 상태",
    summary:
      "점수는 구조 계약의 한 축입니다. 실제 게임 화면과 사람의 판단은 각각 별도 필드이며 자동 승격하지 않습니다.",
    keywords: "static visualRuntime playerFacing human review",
  },
  {
    id: "harvest-frontier",
    href: "/docs/harvest-frontier",
    order: "06",
    label: "Harvest Frontier",
    eyebrow: "COLLABORATION EXAMPLE",
    title: "Harvest Frontier",
    summary:
      "HF는 Clunk의 구조 evidence를 소비하지만 원본 에셋과 최종 플레이어 화면 판정의 source of truth를 유지합니다.",
    keywords: "hf scene gap frame manifest",
  },
  {
    id: "webmcp",
    href: "/docs/webmcp",
    order: "07",
    label: "브라우저 WebMCP",
    eyebrow: "BROWSER-NATIVE AGENT FLOW",
    title: "브라우저에서 직접 확인",
    summary:
      "WebMCP가 노출된 브라우저에서는 읽기 전용 상태 도구를 확인할 수 있습니다. 원본 파일을 바꾸거나 시각 승인을 만들지 않습니다.",
    keywords: "browser webmcp modelContext read-only",
  },
  {
    id: "scope",
    href: "/docs/scope",
    order: "08",
    label: "지원 범위",
    eyebrow: "WHAT CLUNK CAN VERIFY",
    title: "지원 범위",
    summary: "자세한 모델·재질·Spine·애니메이션 범위는 입력 종류별로 분리되어 반환됩니다.",
    keywords: "godot unity unreal mobile",
  },
] as const;

/** Sidebar grouping. Order inside the groups is the reading order above. */
export const DOCS_GROUPS: readonly { label: string; items: readonly DocsRouteId[] }[] = [
  { label: "시작하기", items: ["overview", "quickstart", "clients"] },
  { label: "실행", items: ["cli", "asset-studio"] },
  { label: "계약과 협업", items: ["contracts", "harvest-frontier"] },
  { label: "브라우저와 범위", items: ["webmcp", "scope"] },
];

export function docsRoute(id: DocsRouteId): DocsRoute {
  const route = DOCS_ROUTES.find((item) => item.id === id);
  if (!route) throw new Error(`Unknown docs route: ${id}`);
  return route;
}

/** Previous/next in reading order, used by the pager at the bottom of a page. */
export function docsSiblings(id: DocsRouteId): { prev?: DocsRoute; next?: DocsRoute } {
  const index = DOCS_ROUTES.findIndex((item) => item.id === id);
  return { prev: DOCS_ROUTES[index - 1], next: DOCS_ROUTES[index + 1] };
}
