"use client";

import { GRADE_RULE_EN, factsOf, findListing, loadCatalog, searchAssets } from "./catalog";
import { GACHA_THEMES, GRADE_RULE } from "../components/gacha/gacha-catalog";
import {
  asRecord,
  boolProp,
  enumProp,
  numberProp,
  objectSchema,
  registeredTools,
  stringProp,
  type WebMcpTool,
} from "./register";
import { TOOL_DOCS } from "./tool-manifest";

/**
 * The four tools that are registered on every page.
 *
 * Read the catalogue, read one listing's measured facts, move the page the human is
 * looking at, and describe what this site offers. Every figure comes from
 * GET /api/marketplace; nothing here estimates.
 */

const PAGES: Readonly<Record<string, string>> = {
  home: "/",
  marketplace: "/marketplace",
  studio: "/studio",
  inspect: "/app",
  agents: "/agents",
  pricing: "/pricing",
  webmcp: "/webmcp",
};

export function createGlobalTools(): WebMcpTool[] {
  return [
    {
      name: "clunk_search_assets",
      description:
        "Search the Clunk marketplace for game assets. Every figure returned (polygons, materials, real-world size in metres, bytes, animations) was measured by the asset pipeline and is served by GET /api/marketplace — nothing is estimated, and a field that could not be measured comes back as null. Grades S/A/B/C follow the shop's single published rule, and each result says which part of the rule fired.",
      inputSchema: objectSchema({
        query: stringProp("Free text. Matched against the slug, title and description."),
        theme: enumProp("Restrict to one theme of the shop's dial.", ["all", "structure", "prop", "tree", "texture"]),
        grade: enumProp("Restrict to one grade.", ["S", "A", "B", "C"]),
        maxPolygons: numberProp("Only assets whose measured triangle count is at most this.", { minimum: 1 }),
        minPolygons: numberProp("Only assets whose measured triangle count is at least this.", { minimum: 1 }),
        hasAnimation: boolProp("Only assets that carry animation clips or named moving parts."),
        limit: numberProp("How many results to return (default 12, maximum 50).", { minimum: 1, maximum: 50 }),
      }),
      execute: async (input) => {
        const args = asRecord(input);
        const rows = await searchAssets({
          query: typeof args.query === "string" ? args.query : undefined,
          theme: typeof args.theme === "string" ? args.theme : undefined,
          grade: typeof args.grade === "string" ? args.grade : undefined,
          limit: typeof args.limit === "number" ? args.limit : undefined,
          maxPolygons: typeof args.maxPolygons === "number" ? args.maxPolygons : undefined,
          minPolygons: typeof args.minPolygons === "number" ? args.minPolygons : undefined,
          hasAnimation: args.hasAnimation === true ? true : undefined,
        });
        const snapshot = await loadCatalog();
        return {
          ok: true,
          count: rows.length,
          assets: rows,
          beta: snapshot.beta,
          factsMeasuredAt: snapshot.measuredAt,
          gradeRule: GRADE_RULE_EN,
          gradeRule_ko: GRADE_RULE,
          source: "GET /api/marketplace",
        };
      },
    },
    {
      name: "clunk_asset_facts",
      description:
        "Read one listing's measured facts by slug: its grade and the basis for that grade, polygon count, material count, real size in metres, file size, format, animations, named moving parts, license and price. Fields the pipeline could not measure come back as null rather than as a guess.",
      inputSchema: objectSchema({ slug: stringProp("The listing's slug, as it appears in its product URL.") }, ["slug"]),
      execute: async (input) => {
        const slug = String(asRecord(input).slug ?? "").trim();
        if (!slug) return { ok: false, error: "A slug is required.", error_ko: "slug 가 필요합니다." };
        const listing = await findListing(slug);
        if (!listing) {
          return { ok: false, error: `No listing named '${slug}'.`, error_ko: `'${slug}' 상품을 찾지 못했습니다.` };
        }
        return { ok: true, asset: factsOf(listing), gradeRule: GRADE_RULE_EN, gradeRule_ko: GRADE_RULE };
      },
    },
    {
      name: "clunk_navigate",
      description:
        "Move the page the human is looking at. Pass a named page, or a listing slug to open that product. The tools registered on the destination page become available once it has loaded, so call clunk_site_map afterwards to see them.",
      inputSchema: objectSchema({
        page: enumProp("Which page to open.", Object.keys(PAGES)),
        slug: stringProp("A listing slug. When given, opens that product page instead."),
      }),
      execute: (input) => {
        const args = asRecord(input);
        const slug = typeof args.slug === "string" ? args.slug.trim() : "";
        const page = typeof args.page === "string" ? args.page.trim() : "";
        const path = slug
          ? `/marketplace/${encodeURIComponent(slug)}`
          : PAGES[page] ?? null;
        if (!path) {
          return {
            ok: false,
            error: "Give either a page or a slug.",
            error_ko: "page 또는 slug 하나는 있어야 합니다.",
            pages: Object.keys(PAGES),
          };
        }
        const url = new URL(path, window.location.origin).toString();
        window.location.assign(url);
        return {
          ok: true,
          url,
          note: "The human's screen is now moving to this address. The destination page registers its own tools once it loads.",
          note_ko: "사람이 보는 화면이 이 주소로 옮겨 갑니다. 새 화면이 뜨면 그 화면의 도구가 등록됩니다.",
        };
      },
    },
    {
      name: "clunk_site_map",
      description:
        "What tools this site offers, on which page, and how the human signs in. Also reports which tools are registered on the page right now, so an agent can tell whether it needs to navigate first. This site is a Korean-language product; tool results carry English text with the screen's own Korean wording in `_ko` fields.",
      inputSchema: objectSchema(),
      execute: () => ({
        ok: true,
        site: "Clunk — a game-asset shop: draw an asset from the capsule machine, inspect it, and make new ones",
        site_ko: "Clunk — 게임 에셋 뽑기 · 마켓 · 만들기 · 검사",
        here: typeof window === "undefined" ? null : window.location.pathname,
        registeredHere: registeredTools().map((tool) => ({ name: tool.name, surface: tool.surface })),
        pages: Object.entries(PAGES).map(([id, path]) => ({
          id,
          path,
          tools: TOOL_DOCS.filter((doc) => doc.page === path || doc.page === "every page").map((doc) => doc.name),
        })),
        allTools: TOOL_DOCS.map((doc) => ({
          name: doc.name,
          page: doc.page,
          purpose: doc.purpose.en,
          signedIn: doc.signedIn === true,
        })),
        themes: GACHA_THEMES.map((theme) => ({ id: theme.id, name_ko: theme.name })),
        gradeRule: GRADE_RULE_EN,
        gradeRule_ko: GRADE_RULE,
        signIn: {
          how: "The human opens /signup or /login in this browser and signs in with their ChatGPT account. An agent never signs in on someone's behalf.",
          how_ko: "브라우저에서 /signup 또는 /login 을 열고 ChatGPT 계정으로 들어옵니다. 에이전트는 사람 대신 로그인하지 않습니다.",
          signupUrl: "/signup",
          loginUrl: "/login",
          needsSignIn: ["studio_create", "studio_templates", "studio_my_generations", "inspect_url", "gacha_claim"],
        },
        manifestPage: "/webmcp",
        serverMcp: "/api/mcp — the same contracts called from a server. Separate from these in-page tools; it does not move this screen.",
      }),
    },
  ];
}
