/**
 * Every tool this site hands to an agent in the browser — the human-readable table.
 *
 * /webmcp renders this, and the test suite checks that each name here really is defined
 * in the code. When the two drift apart the test fails first.
 *
 * Bilingual on purpose: the judges and the agents read English, the product's own screens
 * are Korean, and the manifest has to be the same document for both.
 */

export type Bilingual = { en: string; ko: string };

export type ToolSurface = "global" | "product page" | "studio" | "inspector";

export type ToolDoc = {
  name: string;
  surface: ToolSurface;
  /** Which address the tool is registered on. */
  page: string;
  purpose: Bilingual;
  /** Inputs. Empty when the tool takes none. */
  inputs: readonly { name: string; note: Bilingual }[];
  /** What comes back, and where each figure comes from. */
  returns: Bilingual;
  /** Whether the human has to be signed in first. */
  signedIn?: boolean;
};

const EVERY_PAGE = "every page";

export const TOOL_DOCS: readonly ToolDoc[] = [
  {
    name: "clunk_connection_check",
    surface: "global",
    page: EVERY_PAGE,
    purpose: {
      en: "Check that the public MCP endpoint is answering.",
      ko: "공개 MCP 주소가 살아 있는지 확인합니다.",
    },
    inputs: [],
    returns: {
      en: "The response code and body of GET /api/mcp, unchanged.",
      ko: "GET /api/mcp 의 응답 코드와 본문 그대로.",
    },
  },
  {
    name: "clunk_product_capabilities",
    surface: "global",
    page: EVERY_PAGE,
    purpose: {
      en: "Describe the read-only contracts this product exposes, and where its evidence stops.",
      ko: "이 서비스가 읽기 전용으로 무엇을 내주는지, 근거가 어디서 끊기는지 알려 줍니다.",
    },
    inputs: [],
    returns: {
      en: "Contract ids and the four evidence states (structural, visual runtime, player-facing, human decision).",
      ko: "계약 이름과 근거 상태 넷(구조·런타임·플레이어·사람 판단).",
    },
  },
  {
    name: "clunk_site_map",
    surface: "global",
    page: EVERY_PAGE,
    purpose: {
      en: "Which tools live on which page, which are registered right now, and how the human signs in.",
      ko: "어느 화면에 어떤 도구가 걸리는지, 지금 무엇이 걸려 있는지, 로그인은 어떻게 하는지 알려 줍니다.",
    },
    inputs: [],
    returns: {
      en: "The page map, the tools registered on this page at this moment, and the sign-in addresses.",
      ko: "화면별 도구 목록, 지금 이 화면에 등록된 도구 이름, 로그인 주소.",
    },
  },
  {
    name: "clunk_search_assets",
    surface: "global",
    page: EVERY_PAGE,
    purpose: {
      en: "Search the marketplace by text, theme, grade, polygon budget, or whether the asset has motion.",
      ko: "마켓에 올라온 에셋을 낱말·갈래·등급·폴리곤 수·움직임 여부로 찾습니다.",
    },
    inputs: [
      { name: "query", note: { en: "free text over slug, title and description", ko: "슬러그·이름·설명에서 찾을 낱말" } },
      { name: "theme", note: { en: "all / structure / prop / tree / texture", ko: "all / structure / prop / tree / texture" } },
      { name: "grade", note: { en: "S / A / B / C", ko: "S / A / B / C" } },
      { name: "maxPolygons", note: { en: "at most this many measured triangles", ko: "측정한 폴리곤이 이 수 이하" } },
      { name: "minPolygons", note: { en: "at least this many measured triangles", ko: "측정한 폴리곤이 이 수 이상" } },
      { name: "hasAnimation", note: { en: "only assets that carry motion", ko: "움직임이 있는 것만" } },
      { name: "limit", note: { en: "how many results (default 12, max 50)", ko: "몇 개까지(기본 12, 최대 50)" } },
    ],
    returns: {
      en: "Slug, title, grade and its basis, polygons, materials, size in metres, bytes, animations and URL — every figure measured by the pipeline and served by GET /api/marketplace.",
      ko: "슬러그·이름·등급과 그 근거·폴리곤·재질·실제 크기·용량·동작·주소. 전부 GET /api/marketplace 의 측정값.",
    },
  },
  {
    name: "clunk_asset_facts",
    surface: "global",
    page: EVERY_PAGE,
    purpose: {
      en: "Read one listing's measured facts by slug.",
      ko: "에셋 하나의 측정값을 슬러그로 읽습니다.",
    },
    inputs: [{ name: "slug", note: { en: "the listing's slug", ko: "상품 주소 이름" } }],
    returns: {
      en: "The full measured record. Anything the pipeline could not measure comes back as null, never as a guess.",
      ko: "그 상품의 측정치 한 벌. 재지 못한 항목은 null 이고 채워 넣지 않습니다.",
    },
  },
  {
    name: "clunk_navigate",
    surface: "global",
    page: EVERY_PAGE,
    purpose: {
      en: "Move the page the human is looking at.",
      ko: "사람이 보는 화면을 다른 페이지로 옮깁니다.",
    },
    inputs: [
      { name: "page", note: { en: "home / marketplace / studio / inspect / agents / pricing / webmcp", ko: "home / marketplace / studio / inspect / agents / pricing / webmcp" } },
      { name: "slug", note: { en: "open that product page instead", ko: "그 상품 화면으로 갑니다" } },
    ],
    returns: { en: "The address the screen moved to.", ko: "옮겨 간 주소." },
  },
  {
    name: "viewer_set",
    surface: "product page",
    page: "/marketplace/<slug>",
    purpose: {
      en: "Change what the product page's 3D bench shows: wireframe, background, grid, shadows, auto-rotate, flat shading.",
      ko: "작업대의 보기 상태를 바꿉니다 — 와이어프레임·배경·격자·그림자·자동 회전·면 보기.",
    },
    inputs: [
      { name: "wireframe", note: { en: "draw as wireframe", ko: "선으로만 보기" } },
      { name: "background", note: { en: "dark / light", ko: "dark / light" } },
      { name: "grid", note: { en: "floor grid", ko: "격자 바닥" } },
      { name: "shadows", note: { en: "cast shadows", ko: "그림자" } },
      { name: "autoRotate", note: { en: "keep turning", ko: "자동 회전" } },
      { name: "flatShading", note: { en: "flat shading", ko: "면 보기" } },
      { name: "mirror", note: { en: "mirror left to right", ko: "좌우 반전" } },
      { name: "dimensions", note: { en: "measuring box in metres", ko: "치수 상자" } },
    ],
    returns: {
      en: "The full view state after the change, plus which settings changed. The file on sale is untouched.",
      ko: "바뀐 뒤의 보기 상태 전부. 파는 파일은 그대로입니다.",
    },
  },
  {
    name: "viewer_play_clip",
    surface: "product page",
    page: "/marketplace/<slug>",
    purpose: { en: "Play one of this model's motions on the bench.", ko: "이 모델이 가진 동작을 재생합니다." },
    inputs: [{ name: "name", note: { en: "the clip's name or its Korean button label", ko: "동작 이름 또는 화면에 적힌 이름" } }],
    returns: { en: "The clip that started, and every clip this file carries.", ko: "재생한 동작과 이 파일이 가진 동작 목록." },
  },
  {
    name: "viewer_stop",
    surface: "product page",
    page: "/marketplace/<slug>",
    purpose: { en: "Stop the motion playing on the bench.", ko: "재생을 멈춥니다." },
    inputs: [],
    returns: { en: "The view state after stopping.", ko: "멈춘 뒤의 상태." },
  },
  {
    name: "viewer_pivot_test",
    surface: "product page",
    page: "/marketplace/<slug>",
    purpose: {
      en: "Swing one named part ±30° so the human can see it really is a separate, turnable piece.",
      ko: "이름이 붙은 부품을 ±30° 흔들어 정말 따로 도는 조각인지 보입니다.",
    },
    inputs: [{ name: "part", note: { en: "the part's node name", ko: "부품 이름" } }],
    returns: { en: "The part that swung, and every named part this file has.", ko: "흔든 부품과 이 파일이 가진 부품 목록." },
  },
  {
    name: "viewer_state",
    surface: "product page",
    page: "/marketplace/<slug>",
    purpose: { en: "Read the bench's current settings, clips and moving parts.", ko: "작업대가 지금 어떤 상태인지 봅니다." },
    inputs: [],
    returns: { en: "View state, clip list, moving-part list, file name.", ko: "보기 상태, 동작 목록, 부품 목록, 파일 이름." },
  },
  {
    name: "asset_download_link",
    surface: "product page",
    page: "/marketplace/<slug>",
    purpose: {
      en: "Return the exact address the page's receive button opens.",
      ko: "받기 버튼이 쓰는 그 주소를 알려 줍니다.",
    },
    inputs: [],
    returns: {
      en: "The file address, name and size. Signed out, the sign-up address instead.",
      ko: "파일 주소·이름·크기. 로그아웃이면 가입 주소.",
    },
  },
  {
    name: "studio_templates",
    surface: "studio",
    page: "/studio",
    purpose: {
      en: "List the templates, palettes and sizes the studio can build from.",
      ko: "만들기에 쓸 수 있는 템플릿·팔레트·크기를 봅니다.",
    },
    inputs: [{ name: "kind", note: { en: "restrict to one kind", ko: "갈래로 거르기" } }],
    returns: { en: "The list GET /api/series/templates serves.", ko: "GET /api/series/templates 의 목록 그대로." },
    signedIn: true,
  },
  {
    name: "studio_create",
    surface: "studio",
    page: "/studio",
    purpose: {
      en: "Make an asset through the studio's own create flow — the request lands in the visible form first, then goes to the same endpoint the button uses.",
      ko: "화면의 만들기 흐름을 그대로 눌러 에셋을 만듭니다.",
    },
    inputs: [
      { name: "kind", note: { en: "2d-image / 3d-model / sprite-atlas / animation-clip", ko: "2d-image / 3d-model / sprite-atlas / animation-clip" } },
      { name: "prompt", note: { en: "one sentence; only the 2D lane draws from it", ko: "한 문장. 2D 만 이 문장으로 그립니다" } },
      { name: "templateId", note: { en: "required for every lane but 2d-image", ko: "2D 가 아니면 필요합니다" } },
      { name: "paletteId", note: { en: "palette offered by that template", ko: "그 템플릿의 팔레트" } },
      { name: "sizeId", note: { en: "size offered by that template", ko: "그 템플릿의 크기" } },
    ],
    returns: {
      en: "The stored asset id, its entry file, every artifact with its URL, and the server's inspection evidence.",
      ko: "저장된 에셋의 id·파일 이름·파일 목록·검사 근거.",
    },
    signedIn: true,
  },
  {
    name: "studio_my_generations",
    surface: "studio",
    page: "/studio",
    purpose: { en: "List what this workspace has made.", ko: "이 워크스페이스가 만든 것들을 봅니다." },
    inputs: [],
    returns: { en: "The list GET /api/generation serves, with a URL per file.", ko: "GET /api/generation 의 목록과 파일 주소." },
    signedIn: true,
  },
  {
    name: "inspect_url",
    surface: "inspector",
    page: "/app",
    purpose: {
      en: "Fetch a GLB/GLTF from a URL and inspect it inside this browser tab. The bytes are never uploaded.",
      ko: "주소에서 파일을 받아 이 브라우저에서 검사합니다. 파일은 서버로 올라가지 않습니다.",
    },
    inputs: [{ name: "url", note: { en: "the GLB/GLTF address", ko: "GLB/GLTF 주소" } }],
    returns: {
      en: "Score against the profile the screen is set to, the hard blockers, the warnings, and the figures read out of the file itself.",
      ko: "점수, 막는 항목, 경고, 그리고 파일에서 읽은 수치.",
    },
    signedIn: true,
  },
] as const;

/** Every tool name in this manifest. The tests check the code against this. */
export const TOOL_NAMES: readonly string[] = TOOL_DOCS.map((doc) => doc.name);

export const SURFACES: readonly ToolSurface[] = ["global", "product page", "studio", "inspector"];

/** What each surface is, in one line, on the manifest page. */
export const SURFACE_TITLES: Readonly<Record<ToolSurface, Bilingual>> = {
  "global": {
    en: "Global — registered on every page. Read the catalogue, move the screen.",
    ko: "전역 — 어느 화면에서나 걸립니다. 카탈로그를 읽고, 화면을 옮깁니다.",
  },
  "product page": {
    en: "Product page — registered only while one product is open. The bench's own controls become the agent's handles.",
    ko: "상품 화면 — 상품 하나를 열어 둔 동안만 걸립니다. 작업대의 도구가 그대로 손잡이가 됩니다.",
  },
  "studio": {
    en: "Studio — after sign-in, on /studio. Runs the screen's own create flow.",
    ko: "스튜디오 — 로그인한 뒤 /studio 에서 걸립니다. 화면의 만들기 흐름을 그대로 부릅니다.",
  },
  "inspector": {
    en: "Inspector — after sign-in, on /app. The file is opened in this browser only; nothing is uploaded.",
    ko: "검사 — 로그인한 뒤 /app 에서 걸립니다. 파일은 이 브라우저에서만 열립니다.",
  },
};

/**
 * Prompts a judge can paste into ChatGPT (or a Chrome agent) with this site open.
 *
 * Each one exercises a different surface, and each one is answerable only by tools that
 * move something on screen — so the reviewer sees the page react while they read the answer.
 */
export const EXAMPLE_PROMPTS: readonly Bilingual[] = [
  {
    en: "Show me the tree assets in this shop and tell me each one's grade and why it got that grade.",
    ko: "이 가게의 나무 에셋을 보여 주고, 각각의 등급과 그 등급이 나온 까닭을 알려 줘.",
  },
  {
    en: "Search this shop for assets that carry animation and are under 2,000 polygons.",
    ko: "이 가게에서 움직임이 있고 폴리곤 2,000개 미만인 에셋을 찾아 줘.",
  },
  {
    en: "Open the lightest S-grade asset's product page, switch the viewer to wireframe, then play its motion.",
    ko: "S 등급 중 가장 가벼운 상품 화면을 열고, 뷰어를 와이어프레임으로 바꾼 다음 동작을 재생해 줘.",
  },
  {
    en: "On this product page, swing every named moving part one at a time and tell me which ones really move.",
    ko: "이 상품 화면에서 이름이 붙은 부품을 하나씩 흔들어 보고, 정말 움직이는 것이 무엇인지 알려 줘.",
  },
  {
    en: "Compare the two heaviest models in the shop: polygons, materials, real size and file size.",
    ko: "가게에서 가장 무거운 모델 둘을 비교해 줘 — 폴리곤, 재질, 실제 크기, 파일 크기.",
  },
  {
    en: "I am signed in: make a 3D model from a template in the studio, then inspect the file it produced and read me the score.",
    ko: "로그인했어. 스튜디오에서 템플릿으로 3D 모델을 하나 만들고, 그 파일을 검사해서 점수를 읽어 줘.",
  },
];
