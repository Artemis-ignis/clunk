/* eslint-disable @typescript-eslint/no-unused-expressions */
/**
 * Engine/target preset regression: picking a preset in the inspector must fetch the
 * matching `public/profiles/<key>.profile.json`, switch the workspace to that rule set,
 * and judge the next asset against *that engine's* budget — locally, with no save and no
 * credit.
 *
 * The proof is a synthetic 6-material GLB built in this file: godot-mobile caps materials
 * at 4 (so the report must carry MAT-MATERIAL-BUDGET / 관측값 6 / 기준값 4) while
 * godot-desktop caps them at 8 (so the same bytes must come back clean). A preset that was
 * loaded but not applied — or applied with the built-in budget — fails one of the two.
 *
 * A bare `async page => result` expression, loaded by `scripts/qa-run-flow.mjs`
 * (it needs Node globals, exactly like `playwright-auth-inspector-flow.js`):
 *   node scripts/qa-run-flow.mjs scripts/playwright-engine-preset-flow.js
 *
 * The flow throws when an assertion fails, so a non-zero exit is the failure signal;
 * the thrown message carries the full check table.
 *
 *   CLUNK_FLOW_BASE_URL  server under test          (default http://localhost:3000)
 *   CLUNK_FLOW_USER_ID   SIWC actor
 *   CLUNK_FLOW_TIMEOUT   per-step wait budget in ms (default 30000)
 */
async page => {
  const base = (process.env.CLUNK_FLOW_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const userId = process.env.CLUNK_FLOW_USER_ID ?? `browser-engine-preset-${Date.now()}`;
  const budget = Number(process.env.CLUNK_FLOW_TIMEOUT ?? 30000);

  /**
   * Minimal valid GLB: one 3-vertex triangle drawn once per material, so
   * materialCount === triangleCount === materials. Built here instead of shipped as a
   * fixture so the budget the test leans on is visible next to the assertion.
   */
  const buildMultiMaterialGlb = materialCount => {
    const bin = new Uint8Array(44);
    const binView = new DataView(bin.buffer);
    [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) => binView.setFloat32(index * 4, value, true));
    [0, 1, 2].forEach((value, index) => binView.setUint16(36 + index * 2, value, true));
    const json = {
      asset: { version: "2.0", generator: "clunk-e2e-synthetic" },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0, name: "synthetic" }],
      meshes: [{
        name: "synthetic-mesh",
        primitives: Array.from({ length: materialCount }, (_, index) => ({
          attributes: { POSITION: 0 }, indices: 1, material: index,
        })),
      }],
      materials: Array.from({ length: materialCount }, (_, index) => ({
        name: `mat-${index}`,
        pbrMetallicRoughness: {
          baseColorFactor: [(index + 1) / (materialCount + 1), 0.2, 0.3, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
        },
      })),
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] },
        { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
        { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 },
      ],
      buffers: [{ byteLength: bin.byteLength }],
    };
    let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
    const pad = (4 - (jsonBytes.byteLength % 4)) % 4;
    if (pad) {
      const padded = new Uint8Array(jsonBytes.byteLength + pad);
      padded.set(jsonBytes);
      padded.fill(0x20, jsonBytes.byteLength);
      jsonBytes = padded;
    }
    const total = 12 + 8 + jsonBytes.byteLength + 8 + bin.byteLength;
    const out = new Uint8Array(total);
    const view = new DataView(out.buffer);
    view.setUint32(0, 0x46546c67, true);   // glTF
    view.setUint32(4, 2, true);
    view.setUint32(8, total, true);
    view.setUint32(12, jsonBytes.byteLength, true);
    view.setUint32(16, 0x4e4f534a, true);  // JSON
    out.set(jsonBytes, 20);
    const binOffset = 20 + jsonBytes.byteLength;
    view.setUint32(binOffset, bin.byteLength, true);
    view.setUint32(binOffset + 4, 0x004e4942, true); // BIN
    out.set(bin, binOffset + 8);
    return out;
  };

  const SIX_MATERIALS = {
    name: "synthetic-6mat.glb",
    mimeType: "model/gltf-binary",
    buffer: Buffer.from(buildMultiMaterialGlb(6)),
  };

  const consoleErrors = [];
  const pageErrors = [];
  const apiPosts = [];
  const profileFetches = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", error => { pageErrors.push(String(error)); });
  page.on("request", request => {
    if (request.method() === "POST" && request.url().includes("/api/")) apiPosts.push(request.url());
  });
  page.on("response", response => {
    if (response.url().includes("/profiles/")) {
      profileFetches.push(`${response.url().split("/profiles/")[1]} ${response.status()}`);
    }
  });
  await page.context().setExtraHTTPHeaders({
    "oai-authenticated-user-id": userId,
    "oai-authenticated-user-email": `${userId}@example.test`,
    "oai-authenticated-user-full-name": "Browser%20Preset",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  });

  const checks = {};
  const failures = [];
  const expect = (name, actual, expected) => {
    const ok = typeof expected === "function" ? expected(actual) : actual === expected;
    checks[name] = { ok, actual };
    if (!ok) failures.push(`${name}: ${JSON.stringify(actual)}`);
    return ok;
  };
  const flat = value => value.replace(/\s+/g, " ").trim();
  const until = async (probe, timeout = budget) => {
    const deadline = Date.now() + timeout;
    for (;;) {
      const value = await probe();
      if (value || Date.now() > deadline) return value;
      await page.waitForTimeout(200);
    }
  };
  const noticeText = async () => {
    const banner = page.locator(".banner-info p");
    return (await banner.count()) ? flat(await banner.first().innerText()) : "";
  };
  const findings = () =>
    page.$$eval(".finding-row", rows =>
      rows.map(row => ({
        severity: (row.querySelector(".severity")?.className ?? "").replace("severity ", "").trim(),
        evidence: (row.querySelector("small")?.textContent ?? "").replace(/\s+/g, " ").trim(),
      })),
    );
  const ruleSetLabel = async () => flat(await page.locator(".metrics-panel .panel-head > .mono-label").innerText());
  const score = async () => flat(await page.locator(".score-number strong").innerText());

  /** Hydration gate: a change event fired before React attaches is dropped silently. */
  const openInspector = async () => {
    await page.goto(`${base}/app`, { waitUntil: "domcontentloaded" });
    await page.locator('input[aria-label="GLB 또는 GLTF 파일 선택"]').waitFor({ state: "attached", timeout: budget });
    const chips = page.locator(".profile-options .profile-chip");
    const ready = await until(async () => {
      await chips.nth(2).click({ timeout: 2000 }).catch(() => {});
      return (await chips.nth(2).getAttribute("aria-checked")) === "true";
    });
    await chips.nth(0).click();
    return ready;
  };

  const applyPreset = async key => {
    await page.locator('select[aria-label="엔진 프리셋 선택"]').selectOption(key);
    return until(async () => {
      const text = await noticeText();
      return text.includes("엔진 프리셋") ? text : "";
    });
  };
  const inspectSynthetic = async () => {
    await page.locator('input[aria-label="GLB 또는 GLTF 파일 선택"]').setInputFiles(SIX_MATERIALS);
    return until(async () => flat(await page.locator(".run-file strong").innerText()) === SIX_MATERIALS.name);
  };

  // --- godot-mobile: 4-material budget must fail a 6-material asset ------------
  expect("hydratedMobilePhase", await openInspector(), true);
  const presetOptions = await page.$$eval('select[aria-label="엔진 프리셋 선택"] option', options =>
    options.filter(option => option.value).map(option => option.value),
  );
  expect("presetOptionsMatchPublicProfiles", presetOptions, values =>
    values.join(",") === "godot-mobile,godot-desktop,unity-mobile,unity-desktop,unreal-desktop",
  );

  const mobileNotice = await applyPreset("godot-mobile");
  expect("mobilePresetNotice", mobileNotice, text =>
    text.startsWith("엔진 프리셋 'Godot · 모바일' 적용") && text.includes("로컬 전용"),
  );
  expect("mobilePresetFetched", profileFetches, list => list.includes("godot-mobile.profile.json 200"));
  expect("selectResetsAfterApply", await page.locator('select[aria-label="엔진 프리셋 선택"]').inputValue(), "");
  const customChip = page.locator(".profile-options .profile-chip").nth(3);
  expect("presetShownOnCustomChip", flat(await customChip.innerText()), text =>
    text.includes("godot-mobile.profile.json") && text.includes("로컬 검사 전용 · 저장·크레딧 없음"),
  );
  expect("presetChipSelected", await customChip.getAttribute("aria-checked"), "true");

  expect("syntheticInspectedUnderMobilePreset", await inspectSynthetic(), true);
  expect("mobilePresetRuleSetLabel", await ruleSetLabel(), "godot-mobile-preset-v1 v0.1.0");
  expect("materialCountObserved", flat(await page.locator(".metrics-grid .metric").nth(4).innerText()), "머티리얼 6");
  const mobileFindings = await findings();
  const budgetFinding = mobileFindings.find(row => row.evidence.startsWith("MAT-MATERIAL-BUDGET"));
  expect("mobilePresetBudgetEnforced", budgetFinding?.evidence, "MAT-MATERIAL-BUDGET / 관측값 6 / 기준값 4");
  expect("mobilePresetBudgetIsError", budgetFinding?.severity, "severity-error");
  expect("mobilePresetScore", await score(), "97");
  expect("mobilePresetRunNotPersisted", apiPosts.length, 0);
  expect("noErrorBannerMobile", await page.locator(".banner-error").count(), 0);

  // --- godot-desktop: 8-material budget clears the very same bytes -------------
  expect("hydratedDesktopPhase", await openInspector(), true);
  const desktopNotice = await applyPreset("godot-desktop");
  expect("desktopPresetNotice", desktopNotice, text => text.startsWith("엔진 프리셋 'Godot · 데스크톱' 적용"));
  expect("desktopPresetFetched", profileFetches, list => list.includes("godot-desktop.profile.json 200"));
  expect("syntheticInspectedUnderDesktopPreset", await inspectSynthetic(), true);
  expect("desktopPresetRuleSetLabel", await ruleSetLabel(), "godot-desktop-preset-v1 v0.1.0");
  const desktopFindings = await findings();
  expect("desktopPresetHasNoMaterialBudgetFinding",
    desktopFindings.some(row => row.evidence.startsWith("MAT-MATERIAL-BUDGET")), false);
  expect("desktopPresetScore", await score(), "100");
  expect("desktopPresetRunNotPersisted", apiPosts.length, 0);
  expect("noErrorBannerDesktop", await page.locator(".banner-error").count(), 0);

  const result = {
    url: page.url(),
    userId,
    checks,
    failures,
    pass: failures.length === 0,
    profileFetches,
    apiPosts,
    consoleErrors,
    pageErrors,
  };
  if (failures.length) throw new Error(`engine-preset flow failed\n${JSON.stringify(result, null, 2)}`);
  return result;
}
