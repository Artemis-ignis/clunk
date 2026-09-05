import { areSalesOpen } from "./_lib/sales-lock";

/**
 * The self-describing entry point for an agent.
 *
 * Until now an agent arriving at this origin had nowhere to land: /api was a 404, so the
 * only way to learn what Clunk does was to read the marketing HTML and guess at endpoint
 * names. Everything an agent needs to use the catalogue correctly is here, and the
 * conventions block in particular exists so a consumer never has to derive the coordinate
 * system by loading a file and measuring it.
 *
 * Every number below is measured from the shipped catalogue, not aspirational. Where the
 * catalogue does not yet keep a promise — the tree pack's roots sit below the ground
 * plane — this says so rather than stating the rule and letting a buyer discover the
 * exception by sinking a tree into their terrain.
 */
export const dynamic = "force-dynamic";

const DOCS = "https://clunk.gitbook.io/docs";

export function GET(request: Request) {
  const origin = new URL(request.url).origin;

  const body = {
    name: "Clunk",
    what: "게임 에셋을 만들고, 게임에 넣어도 되는지 검사하고, 마켓에서 골라 쓰는 곳입니다.",
    read_this_first: `${origin}/llms.txt`,
    read_this_first_note:
      "If you are a coding agent about to build something, fetch /prompt.txt instead: the same catalogue written as working instructions rather than as a reference.",
    docs: DOCS,

    // 2026-09-05: 이 자리에 "There is no public API key yet" 이라고 적혀 있었다. 사실이
    // 아니다 — `clunk_live_...` 키는 실재하고 /agents 에서 발급한다. 에이전트가 우리를
    // 처음 읽는 자리라 여기서 틀리면 그 뒤가 전부 어긋난다.
    auth: {
      browse: "none — the published catalogue is readable without a key, and a B-grade asset's bytes download without one too",
      apiKey:
        "Bearer clunk_live_… on POST /api/mcp. Issue one at https://clunk.games/agents. Needed for the tools that generate or inspect; browsing and B-grade downloads are not.",
      workspace: "session cookie; every workspace-scoped route requires it and same-origin",
      note: "An agent can also run the local MCP server (integrations/mcp/server.ts) over stdio, which reads and writes files on the machine it runs on — that path takes a local file path where the HTTP one takes bytes.",
    },

    endpoints: {
      "GET /api/marketplace": "every published listing; add ?slug= for one, with its artifacts and evidence",
      "GET /api/marketplace/assets/{assetId}?file=": "the bytes of one artifact; a grade B artifact answers to any caller, grade A and S need a signed-in session with a live subscription",
      "GET /api/providers": "which generation and inspection rails are actually wired, and which are declared but unavailable",
      "GET /api/health": "liveness",
    },

    /**
     * The contract a consumer would otherwise have to reverse-engineer by loading a file
     * and measuring it. Measured across all 18 shipped models on 2026-09-02.
     */
    conventions: {
      up_axis: "y",
      units: "meters, real-world scale (a produce crate is 0.56 m wide, a greenhouse 8.42 m)",
      node_scale: "every node ships at unit scale; size is baked into geometry, never into a transform (18 of 18)",
      ground:
        "most models rest on y=0, so placing one is setting position to the ground point (14 of 18). The six models in grove-tree-pack-vol1 are the exception: their root flare extends up to 0.44 m below y=0. Read boundingBox.minY on the listing and offset by it rather than assuming zero.",
      materials:
        "flat-shaded colour, carried either as named materials or as a COLOR_0 attribute under a white material. A converter that ignores COLOR_0 will produce a white model.",
      textures: "the 3D catalogue is texture-free; the 2D catalogue is 1024² seamless PNG tiles",
      formats: ["glb", "png"],
      sprite_sheets:
        "frames run across, directions down, one row per facing. Cell coordinates, the grid and per-frame hashes travel in a clunk.sprite-sheet-review.v1 manifest beside the PNG.",
    },

    inspection: {
      what: "Clunk reads the actual bytes and reports triangles, draw calls, materials and texture memory against a target profile.",
      not: "A policy score is not a statement that the asset looks right in your game. Runtime capture and human review are separate lanes and stay NOT_EVALUATED until someone supplies them.",
      profiles: `${origin}/api/providers`,
    },

    // Selling is gated on the mail-order filing, and an agent should be told that plainly
    // rather than discovering it as a failed checkout.
    commerce: {
      currency: "KRW",
      sells: "one time-based subscription, nothing else. No per-asset price and no credit to top up; a run is an allowance inside a plan, never a purchase.",
      sales_open: areSalesOpen(),
      ...(areSalesOpen()
        ? {}
        : { sales_note: "결제 기능이 아직 없어 결제를 받지 않습니다. 목록·상세·검사·생성은 그대로 열려 있습니다." }),
    },

    "if the asset does not exist": "GET /api/marketplace?slug=… returns 404 with a JSON body naming the collection endpoint.",

    humans: {
      catalogue: `${origin}/marketplace`,
      docs: DOCS,
    },
  };

  return Response.json(body, {
    headers: {
      "cache-control": "public, max-age=300",
      // The same signal polyfork puts on every response: an agent that reached a JSON
      // endpoint first has a way back to the document written for it.
      link: `<${origin}/llms.txt>; rel="help"; type="text/plain"; title="Clunk agent guide"`,
    },
  });
}
