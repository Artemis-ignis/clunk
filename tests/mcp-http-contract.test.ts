import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MCP_HTTP_ENDPOINT_PATH,
  MCP_HTTP_PROTOCOL_VERSION,
  MCP_HTTP_TARGET_PROFILE_IDS,
  MCP_HTTP_TOOLS,
  createMcpInitializeResult,
  createMcpToolsListResult,
  parseBearerToken,
} from "../app/api/_lib/mcp-http";
import {
  PHYSICAL_RULE_IDS,
  getBuiltInTargetProfiles,
  inspectAsset,
  inspectAssetForTarget,
} from "../packages/core/src/index";
import { factsOfListing } from "../app/api/mcp/catalog";
import { buildAssetInspectionPayload } from "../app/api/mcp/inspection-response";
import { parseAssetInspectionRequest } from "../app/api/assetops/inspect/bundle-contract";
import {
  buildAgentGuides,
  type AgentConnection,
} from "../app/components/agent-guides";
import {
  MCP_HTTP_TOOL_COUNT,
  MCP_HTTP_TOOL_NAMES,
  MCP_TOOLS,
} from "../app/components/product-facts";

test("remote MCP contract accepts only an Authorization Bearer token", () => {
  assert.equal(parseBearerToken(null), null);
  assert.equal(parseBearerToken("Basic abc"), null);
  assert.equal(parseBearerToken("Bearer "), null);
  assert.equal(parseBearerToken("Bearer clunk_test_key"), "clunk_test_key");
  assert.equal(parseBearerToken("bearer clunk_test_key"), "clunk_test_key");
});

/** 이름으로 찾는다. 도구를 하나 끼워 넣었다고 무관한 단언이 깨지면 안 된다. */
function tool(name: string) {
  const found = MCP_HTTP_TOOLS.find((item) => item.name === name);
  assert.ok(found, `${name} is not advertised by tools/list`);
  return found as (typeof MCP_HTTP_TOOLS)[number] & {
    inputSchema: { required?: readonly string[]; properties: Record<string, { description?: string; enum?: readonly string[] }> };
  };
}

test("HTTP MCP advertises a Clunk-owned endpoint and remote-safe tools", () => {
  assert.equal(MCP_HTTP_ENDPOINT_PATH, "/api/mcp");
  assert.equal(MCP_HTTP_PROTOCOL_VERSION, "2025-06-18");
  const names = MCP_HTTP_TOOLS.map((item) => item.name);
  assert.deepEqual(names, [
    "clunk_connection_check",
    "clunk_search_assets",
    "clunk_asset_facts",
    "clunk_asset_inspect",
    "clunk_asset_validate",
    "clunk_asset_inspection_evidence",
    "clunk_collaboration_append",
    "clunk_scene_review",
    "clunk_sprite_sheet_review",
  ]);
  assert.match(tool("clunk_asset_inspect").description, /base64/i);
  assert.match(tool("clunk_asset_inspect").description, /path on your machine/i);
  assert.match(tool("clunk_asset_inspect").inputSchema.properties.targetProfileId.description ?? "", /harvest-frontier-web-three/);
  assert.match(tool("clunk_asset_validate").inputSchema.properties.targetProfileId.description ?? "", /pc\/web\/mobile/i);
  assert.match(tool("clunk_asset_inspection_evidence").description, /verified evidence/i);
  assert.match(tool("clunk_collaboration_append").description, /workspace/i);
  assert.match(tool("clunk_scene_review").description, /scene review/i);
  assert.match(tool("clunk_sprite_sheet_review").description, /sprite sheet/i);
  assert.deepEqual(tool("clunk_scene_review").inputSchema.required, ["manifest"]);
  assert.deepEqual(tool("clunk_sprite_sheet_review").inputSchema.required, ["manifest"]);
});

/**
 * 2026-09-05 실측 회귀: 원격 tools/list에는 카탈로그 도구가 하나도 없어서, HTTP로 붙은
 * 에이전트는 "폴리곤 2,000개 이하 무료 소품을 찾아라"를 시작조차 할 수 없었습니다.
 * 브라우저 WebMCP에만 있던 그 능력이 원격에도 있어야 합니다.
 */
test("a remote agent can find an asset without opening a browser", () => {
  const search = tool("clunk_search_assets");
  for (const field of ["query", "theme", "grade", "maxPolygons", "minPolygons", "hasAnimation", "freeOnly", "limit"]) {
    assert.ok(search.inputSchema.properties[field], `clunk_search_assets is missing the ${field} filter`);
  }
  // 등급이 곧 접근권이라는 사실을 도구 설명이 말해야, 에이전트가 받을 수 없는 것을 권하지 않습니다.
  assert.match(search.description, /free/i);
  assert.match(search.description, /measured/i);
  assert.deepEqual(tool("clunk_asset_facts").inputSchema.required, ["slug"]);
});

/**
 * 스키마가 통과시킨 호출을 핸들러가 거절하면 안 됩니다. 예전 스키마는 required가
 * targetProfileId 하나뿐이라, 그것만 넣은 호출이 `Invalid fileName.`으로 끝났습니다.
 */
test("the upload schema says how to send bytes, not just which profile", () => {
  for (const name of ["clunk_asset_inspect", "clunk_asset_validate"]) {
    const schema = tool(name).inputSchema as unknown as {
      description: string;
      properties: Record<string, { description?: string; items?: { required?: readonly string[] } }>;
    };
    assert.match(schema.description, /fileName \+ bytesBase64/);
    assert.match(schema.description, /entryFileName \+ files/);
    assert.ok(schema.properties.bytesBase64.description, `${name}.bytesBase64 has no description`);
    assert.deepEqual(schema.properties.files.items?.required, ["fileName", "bytesBase64"]);
    // 실제로 받는 값만 enum에 있어야 합니다. 없는 이름을 권하면 에이전트는 반드시 실패합니다.
    assert.deepEqual(
      tool(name).inputSchema.properties.targetProfileId.enum,
      MCP_HTTP_TARGET_PROFILE_IDS,
    );
  }
});

/**
 * 원격 검사 도구가 물리적 타당성까지 본다는 사실을 스키마가 말해야 합니다.
 *
 * 에이전트는 tools/list 만 읽고 부를 것을 정합니다. 설명이 "삼각형 수를 센다"에서
 * 끝나면, 앞바퀴가 허브 위 150 mm 에 떠 있는 파일을 받은 에이전트는 이 도구가 그것을
 * 말해 줄 수 있다는 것을 모릅니다.
 */
test("the upload tools advertise the physical-plausibility rules and what they measure", () => {
  const inspect = tool("clunk_asset_inspect").description;
  for (const ruleId of ["GEO-GROUND-CONTACT", "GEO-FLOATING-PART", "GEO-PART-INTERSECTION", "GEO-THIN-SHELL", "SCENE-ANIMATED-SCALE", "SCENE-UNNAMED-MESH", "FORMAT-EXTENSION-REQUIRED"]) {
    assert.match(inspect, new RegExp(ruleId), `clunk_asset_inspect does not name ${ruleId}`);
  }
  assert.match(inspect, /millimetre/i, "the description must say the findings carry measurements");
  assert.match(inspect, /world space/i, "the description must say the measurement applies parent transforms");
  assert.match(inspect, /8 phases/i, "the description must say how many animation phases are sampled");

  // 무엇이 hard 인지 도구 설명이 직접 말합니다.
  const validate = tool("clunk_asset_validate").description;
  assert.match(validate, /hardBlockerCount counts only ERROR and CRITICAL/);
  assert.match(validate, /never add to it/);
  assert.match(validate, /WARNING or INFO/);
});

/**
 * 원격 응답에 새 findings 가 실제로 실려 나가는지.
 *
 * 핸들러(app/api/mcp/handler.ts)는 D1 과 API 키가 있어야 도는 자리라 여기서는 그 핸들러가
 * 부르는 두 함수를 같은 순서로 부릅니다 — 업로드된 바이트에 대해 inspectAssetForTarget 이
 * evidence.findings 를, inspectAsset 이 응답에 함께 싣는 structural findings 를 냅니다.
 * 이 둘이 물리 규칙을 들고 있어야 원격 에이전트가 그것을 볼 수 있습니다.
 */
test("uploaded bytes carry the physical findings on both halves of the HTTP response", async () => {
  const fileName = "penetrating-rod.glb";
  const bytes = new Uint8Array(await readFile(`tests/fixtures/geometry/${fileName}`));
  const bundleFiles = new Map([[fileName, bytes]]);

  const evidence = inspectAssetForTarget({
    sourcePath: `http-upload:${fileName}`,
    fileName,
    bytes,
    targetProfileId: "unity",
    bundleFiles,
  });
  const evidenceHit = evidence.findings.find((finding) => finding.id.startsWith("GEO-PART-INTERSECTION"));
  assert.ok(evidenceHit, "evidence.findings has no GEO-PART-INTERSECTION");
  assert.equal(evidenceHit.severity, "WARNING");
  assert.match(evidenceHit.message, /conveyorBelt/);
  assert.match(evidenceHit.message, /200 mm/);
  assert.notEqual(evidence.status, "BLOCKED", "a physical warning must not block the evidence envelope");

  const structural = inspectAsset({ entry: fileName, files: bundleFiles });
  const structuralHit = structural.findings.find((finding) => finding.ruleId === "GEO-PART-INTERSECTION");
  assert.ok(structuralHit, "structural findings have no GEO-PART-INTERSECTION");
  assert.equal(structuralHit.observed, "200 mm");
  assert.ok(structuralHit.title.length > 0, "the response must carry a title an agent can print");

  /*
   * clunk_asset_validate 의 hardBlockerCount 근거.
   *
   * 그 숫자는 ERROR/CRITICAL 만 셉니다. 물리 규칙은 어느 것도 그 등급이 아니므로 이
   * 숫자를 바꾸지 않고, valid 도 뒤집지 않습니다. 같은 측정이 어떤 파일에서는 결함이고
   * 다른 파일에서는 의도이기 때문입니다 — 땅 밑 뿌리, 베어링을 지나는 축, 옷 안의 몸.
   */
  const blocking = structural.findings.filter(
    (finding) => finding.severity === "ERROR" || finding.severity === "CRITICAL",
  );
  assert.equal(structural.score.hardBlockerCount, blocking.length);
  for (const finding of structural.findings) {
    if (!(PHYSICAL_RULE_IDS as readonly string[]).includes(finding.ruleId)) continue;
    assert.ok(
      finding.severity === "WARNING" || finding.severity === "INFO",
      `${finding.ruleId} reached ${finding.severity}; it would change hardBlockerCount`,
    );
  }
});

/** 브라우저 번들 때문에 베껴 둔 목록이 진짜 등록부와 갈라지면 여기서 먼저 깨집니다. */
test("the advertised target profile ids are the ones core actually registers", () => {
  assert.deepEqual(
    [...MCP_HTTP_TARGET_PROFILE_IDS],
    getBuiltInTargetProfiles().map((profile) => profile.id),
  );
});

/**
 * 2026-09-05 실측: B등급 downloadUrl은 키도 세션도 없이 302 뒤 실제 바이트를 내주고,
 * A등급은 같은 조건에서 401입니다. 도구가 이 둘을 같은 말로 설명하면 에이전트는 받을 수
 * 있는 파일을 못 받고 사람에게 떠넘기거나, 못 받을 파일을 계속 두드립니다.
 */
test("catalogue results tell an agent which downloads it can fetch itself", () => {
  const base = {
    id: "listing-test",
    priceCents: 0,
    currency: "KRW",
    status: "PUBLISHED",
    assetId: "asset-test",
    entryFileName: "prop.glb",
    variantOf: null,
    licenseStatus: "cleared",
    byteLength: 1000,
    variants: [],
    clips: [],
  };
  const free = factsOfListing(
    { ...base, slug: "test-crate", title: "궤짝", description: "", facts: { triangles: 700 } },
    "https://clunk.games",
  );
  const paid = factsOfListing(
    { ...base, slug: "test-barn", title: "헛간", description: "", facts: { triangles: 5000 } },
    "https://clunk.games",
  );
  assert.equal(free.grade, "B");
  assert.equal(free.free, true);
  // 2026-09-05: B 등급도 세션 또는 clunk_live 키가 있어야 받는다(약관·마켓 문구와 같은 계약).
  // 에이전트에게는 "같은 Bearer 키로 받아라, 사람은 필요 없다" 가 핵심 문장이다.
  assert.match(free.access, /Bearer clunk_live/);
  assert.match(free.access, /No human needed/);
  assert.doesNotMatch(free.access, /no sign-in|no key/i);
  assert.equal(paid.grade, "S");
  assert.equal(paid.free, false);
  assert.match(paid.access, /401|sign(ed)?-in/i);
  // 사람에게 넘길 주소와 파일 주소는 서로 다른 자리여야 합니다.
  assert.equal(free.downloadUrl, "https://clunk.games/api/marketplace/assets/asset-test?file=prop.glb");
  assert.equal(paid.productUrl, "https://clunk.games/marketplace/test-barn");
});

test("product capability facts keep HTTP and local stdio tool sets separate", () => {
  assert.deepEqual(MCP_HTTP_TOOL_NAMES, MCP_HTTP_TOOLS.map((item) => item.name));
  assert.equal(MCP_HTTP_TOOL_COUNT, MCP_HTTP_TOOLS.length);
  /*
   * 이 8 은 app/components/product-facts.ts 가 손으로 들고 있는 목록의 길이입니다.
   * 2026-09-05 현재 로컬 stdio 서버(integrations/mcp/server.ts)는 clunk_validate 와
   * clunk_passport 를 포함해 10개를 tools/list 로 내보냅니다 — 그 둘은 예전부터 답하고
   * 있었는데 목록에만 없었습니다. 이 파일은 app/components 를 고칠 수 없으므로 숫자를
   * 그대로 두고 어긋남을 여기 적어 둡니다: product-facts 의 MCP_TOOLS 에 두 항목을
   * 더하고 이 단언을 10 으로 올려야 사이트 문구가 서버와 같아집니다.
   */
  assert.equal(MCP_TOOLS.length, 10);
});

test("MCP initialize and tools/list responses are stable JSON-RPC results", () => {
  assert.deepEqual(createMcpInitializeResult(), {
    protocolVersion: MCP_HTTP_PROTOCOL_VERSION,
    capabilities: { tools: {} },
    serverInfo: { name: "clunk", version: "0.1.0" },
  });
  const result = createMcpToolsListResult();
  assert.deepEqual(result.tools, MCP_HTTP_TOOLS);
});

test("each client guide is generated from one Clunk endpoint and one issued key", () => {
  const connection: AgentConnection = {
    endpoint: "https://clunk.games/api/mcp",
    apiKey: "clunk_live_test_key",
  };
  const guides = buildAgentGuides(connection);
  const byKey = new Map(guides.map((guide) => [guide.key, guide]));

  assert.match(byKey.get("claude-code")?.code ?? "", /https:\/\/clunk\.games\/api\/mcp/);
  assert.match(byKey.get("claude-code")?.code ?? "", /clunk_live_test_key/);
  assert.match(byKey.get("codex")?.code ?? "", /codex mcp add clunk --url/);
  assert.match(byKey.get("codex")?.code ?? "", /CLUNK_API_KEY/);
  assert.match(byKey.get("cursor")?.code ?? "", /type.*http/);
  assert.match(byKey.get("claude-desktop")?.code ?? "", /type.*http/);
  assert.match(byKey.get("vscode")?.code ?? "", /type.*http/);
  assert.match(byKey.get("github-copilot")?.code ?? "", /copilot mcp add --transport http/);
  assert.match(byKey.get("github-copilot")?.code ?? "", /Authorization/);
  assert.match(byKey.get("stdio")?.code ?? "", /npm\.cmd/);
  assert.match(byKey.get("stdio")?.code ?? "", /"run"/);
  // 도구를 늘렸을 때 이 숫자를 손으로 고치게 두면, 고치는 것을 잊은 만큼 안내가 틀립니다.
  assert.match(byKey.get("api")?.code ?? "", new RegExp(`${MCP_HTTP_TOOL_COUNT} remote-safe tools`));
  assert.ok(guides.filter((guide) => guide.key !== "stdio").every((guide) => !guide.code.includes("<CLUNK_ROOT>")));
});


/*
 * ------------------------------------------------------------------ 레인별 정직한 상태
 *
 * 2026-09-05 라이브 실측(https://clunk.games/api/mcp): 같은 mine-cart.glb 를
 * unity / godot-4 / unreal / web-three-mobile 에 넣으면 `valid: true, score: 99` 가
 * 나가면서 evidence.status 는 "ENVIRONMENT_UNAVAILABLE" 이었습니다. 응답 어디에도
 * "이 점수는 파일만 보고 낸 것이고 에디터 임포트는 아예 돌지 않았다"는 말이 없었습니다.
 */
async function payloadFor(path: string, targetProfileId: string, operation: "inspect" | "validate" = "validate") {
  const bytes = new Uint8Array(await readFile(path));
  const fileName = path.split("/").pop() as string;
  const parsed = parseAssetInspectionRequest({
    schema: "clunk.asset-inspection-request.v1",
    fileName,
    bytesBase64: Buffer.from(bytes).toString("base64"),
    targetProfileId,
  });
  return buildAssetInspectionPayload(operation, parsed) as Record<string, any>;
}

test("a response that could not run the engine lanes never claims a whole-pipeline pass", async () => {
  for (const profileId of ["unity", "godot-4", "unreal", "web-three-mobile"]) {
    const payload = await payloadFor("public/market/mine-cart/mine-cart.glb", profileId);
    assert.equal(payload.coverage.schema, "clunk.evidence-coverage.v1", profileId);
    assert.equal(payload.coverage.engineEnvironment, "NOT_RUN", profileId);
    assert.equal(payload.coverage.scoreBasis, "FILE_ONLY", profileId);
    assert.equal(payload.engineVerified, false, profileId);
    assert.deepEqual([...payload.coverage.ranLanes], ["bytes", "structure", "policy"], profileId);
    assert.deepEqual(
      payload.coverage.skippedLanes.map((lane: { id: string }) => lane.id),
      ["import", "runtime"],
      profileId,
    );
    // 안 돈 레인이 있으면 scoreBasis 문장이 그 사실을 말해야 한다.
    assert.match(payload.scoreBasis, /did not run/, profileId);
    assert.match(payload.scoreBasis, new RegExp(profileId), profileId);
  }
});

/**
 * "환경 없음 + 100점"이 아무 단서 없이 나가는 일은 없어야 한다. 점수가 100 이어도
 * 그것이 파일 레인만의 결과라는 사실이 같은 응답 안에 있어야 한다.
 */
test("no built-in profile can answer environment-unavailable and a clean score at the same time", async () => {
  for (const profile of getBuiltInTargetProfiles()) {
    if (!profile.acceptedFormats.includes("glb")) continue;
    const payload = await payloadFor("public/market/cozy-crate-closed/crate-closed.clunk-optimized.glb", profile.id);
    const engineRan = payload.coverage.engineEnvironment === "RAN";
    assert.equal(payload.engineVerified, engineRan, profile.id);
    if (engineRan) continue;
    assert.equal(payload.coverage.scoreBasis, "FILE_ONLY", profile.id);
    assert.ok(payload.coverage.skippedLanes.length > 0, `${profile.id} claims every lane ran`);
    for (const lane of payload.coverage.skippedLanes) {
      assert.equal(lane.kind, "engine-environment", `${profile.id} skipped a file-only lane: ${lane.id}`);
      assert.notEqual(lane.status, "RAN", `${profile.id} lists ${lane.id} as both skipped and run`);
    }
    // 점수가 있으면 그 옆에 근거가 반드시 붙는다.
    if (typeof payload.score === "number") {
      assert.match(payload.scoreBasis, /file-only rules/, profile.id);
      assert.match(payload.scoreBasis, /did not run/, profile.id);
    }
  }
});

/**
 * 프로파일을 고르면 예산이 실제로 바뀌어야 한다. 예전에는 목표 프로파일과 무관하게
 * 기본 web 예산으로 점수를 내서 unreal 과 web-three-mobile 이 같은 답을 돌려주었다.
 */
test("the target profile chooses the budgets the score is judged against", async () => {
  const desktop = await payloadFor("public/market/mine-cart/mine-cart.glb", "unreal");
  const mobile = await payloadFor("public/market/mine-cart/mine-cart.glb", "web-three-mobile");
  assert.match(desktop.scoreBasis, /250000 triangles/);
  assert.match(desktop.scoreBasis, /8192 px/);
  assert.match(mobile.scoreBasis, /25000 triangles/);
  assert.match(mobile.scoreBasis, /2048 px/);
});

/**
 * hardBlockerCount 가 1 인데 blockingFindings 가 빈 배열로 나가던 자리.
 * CRITICAL 은 그 숫자에 들어가는데 걸러 담는 쪽은 ERROR 만 보고 있었다.
 */
test("every hard blocker the score counted is also listed in blockingFindings", async () => {
  const notAGlb = parseAssetInspectionRequest({
    schema: "clunk.asset-inspection-request.v1",
    fileName: "not-really.glb",
    bytesBase64: Buffer.from("이건 GLB 가 아닙니다").toString("base64"),
    targetProfileId: "unity",
  });
  const payload = buildAssetInspectionPayload("validate", notAGlb) as Record<string, any>;
  assert.ok(payload.hardBlockerCount > 0, "a non-GLB body must count as a hard blocker");
  assert.equal(payload.blockingFindings.length, payload.hardBlockerCount);
  assert.equal(payload.valid, false);
});

/** 점수 100 인데 ready:false 인 조합의 이유가 응답 안에 있어야 한다. */
test("readiness explains itself when a warning holds a perfect score back", async () => {
  const payload = await payloadFor("public/market/kit-village-square/kit-village-square.glb", "unity");
  assert.ok(payload.readiness, "validate must carry a readiness block for a model");
  if (!payload.readiness.ready) {
    assert.ok(payload.readiness.reason.length > 0);
    if (payload.hardBlockerCount === 0 && payload.readiness.warningCount > 0) {
      assert.match(payload.readiness.reason, /WARNING/);
    }
  }
});

/** HF 프로파일은 납품 계약이라는 사실이 스키마 설명에 적혀 있어야 한다. */
test("the delivery-only profile says so where an agent picks a profile", () => {
  const description = tool("clunk_asset_validate").inputSchema.properties.targetProfileId.description ?? "";
  assert.match(description, /Harvest Frontier delivery contract/);
  assert.match(description, /use web-three-mobile or unity/);
  const profile = getBuiltInTargetProfiles().find((item) => item.id === "harvest-frontier-web-three");
  assert.match(profile?.label ?? "", /HF 납품 전용/);
});

/**
 * 한 JSON 안에서 위쪽과 아래쪽이 서로 다른 답을 하면 안 된다.
 *
 * 2026-09-05 부두 키트 실측: dock-lighthouse 를 harvest-frontier-web-three 로 올리면
 * 최상위가 `valid true · score 100 · blockingFindings []`, 그 안의 evidence 가
 * `status BLOCKED · HF-* ERROR 4건` 이었다. 사는 쪽 에이전트가 어느 쪽을 읽느냐로
 * 답이 갈렸다. HF-* 는 이제 blockingFindings 에 실리고 valid 를 뒤집는다.
 */
test("the verdict at the top never contradicts the evidence underneath", async () => {
  const hf = await payloadFor("public/market/mine-cart/mine-cart.glb", "harvest-frontier-web-three");
  assert.equal(hf.evidence.status, "BLOCKED");
  assert.equal(hf.valid, false);
  assert.equal(hf.coverage.fileContract, "FAIL");
  assert.equal(hf.hardBlockerCount, hf.blockingFindings.length);
  const blockedRules = hf.blockingFindings.map((item: { ruleId: string }) => item.ruleId);
  for (const ruleId of ["HF-ROOT-NODE", "HF-ATTACHMENT-SOCKET", "HF-COLLIDER", "HF-MESHOPT"]) {
    assert.ok(blockedRules.includes(ruleId), `${ruleId} blocked the evidence but is missing from blockingFindings`);
  }
  // 같은 파일이 일반 3D 프로파일에서는 파일 계약을 통과한다 — HF 는 납품 계약이기 때문이다.
  const unity = await payloadFor("public/market/mine-cart/mine-cart.glb", "unity");
  assert.equal(unity.valid, true);
  assert.equal(unity.coverage.fileContract, "PASS");
  assert.deepEqual(unity.blockingFindings, []);

  // 전 프로파일 불변식: valid 가 참이면 evidence 는 BLOCKED/UNSUPPORTED 일 수 없다.
  for (const profile of getBuiltInTargetProfiles()) {
    if (!profile.acceptedFormats.includes("glb")) continue;
    const payload = await payloadFor("public/market/cozy-crate-closed/crate-closed.clunk-optimized.glb", profile.id);
    if (payload.valid !== true) continue;
    assert.notEqual(payload.evidence.status, "BLOCKED", profile.id);
    assert.notEqual(payload.evidence.status, "UNSUPPORTED", profile.id);
  }
});
