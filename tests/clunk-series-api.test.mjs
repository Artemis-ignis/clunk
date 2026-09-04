import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routePath = new URL("../app/api/series/route.ts", import.meta.url);

test("series API is authenticated, same-origin, and uses Clunk-native jobs", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /requireClunkContext/);
  assert.match(source, /assertSameOrigin/);
  assert.match(source, /createClunkSeriesJob/);
  assert.match(source, /createSeriesBundle/);
  assert.match(source, /clunk-series-native-v1/);
  assert.match(source, /hasRuntimeAssets/);
  assert.match(source, /STORAGE_NOT_CONFIGURED/);
  assert.match(source, /storageStatus: "UNAVAILABLE"/);
  // 2026-09-04: 화면에 뜨는 이 실패 안내도 "실행 횟수"로 부른다. 화면은 실행 횟수라
  // 부르는데 API 오류만 크레딧이라고 하면, 같은 것을 두 이름으로 말하는 셈이 된다.
  assert.match(source, /실행 횟수는 차감되지 않았습니다/);
  assert.doesNotMatch(source, /크레딧은 차감되지 않았습니다/, "옛 크레딧 표기가 남아 있으면 안 된다");
  const blockedGuard = source.indexOf('if (job.status === "BLOCKED")');
  const bundleCreation = source.indexOf("const bundle = createSeriesBundle(job)");
  const firstAssetPut = source.indexOf("bucket.put");
  const storageGuard = source.indexOf("if (!hasRuntimeAssets())");
  assert.ok(blockedGuard > 0 && blockedGuard < bundleCreation, "blocked jobs must be handled before bundle creation");
  assert.ok(blockedGuard < firstAssetPut, "blocked jobs must be handled before R2 writes");
  assert.ok(storageGuard > blockedGuard && storageGuard < firstAssetPut, "storage must be required before R2 writes and after blocked handling");
  assert.match(source, /storage_status/);
  assert.match(source, /'BLOCKED'/);
  assert.match(source, /artifacts: \[\]/);
  assert.doesNotMatch(source, /from ["']\.\.\/\.\.\/\.\.\/packages\/clunk-series\/src["']/);
  assert.doesNotMatch(source, /packages\/clunk-series\/src\/mesh-lab/);
  assert.doesNotMatch(source, /fal-ai|TRELLIS|fetch\(/i);
});

test("series API persists the series identity through the existing generation and artifact tables", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /clunk_generation_jobs/);
  assert.match(source, /clunk_asset_artifacts/);
  assert.match(source, /seriesId/);
  assert.match(source, /provenanceJson/);
  assert.match(source, /reserveCreditOperation/);
  assert.match(source, /confirmCreditOperation/);
  assert.match(source, /refundCreditOperation/);
  assert.match(source, /readIdempotencyKey/);
  assert.match(source, /verifyStorageEvidence/);
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /stored\.size|byteLength/);
  assert.doesNotMatch(source, /applyCreditOperation/);
  assert.doesNotMatch(source, /payload\.(artifactStored|storageAvailable)/);
  assert.doesNotMatch(source, /const storageAvailable/);
  assert.match(source, /storageStatus/);

  const blockedGuard = source.indexOf('if (job.status === "BLOCKED")');
  const firstAssetPut = source.indexOf("bucket.put");
  const bundleCreation = source.indexOf("const bundle = createSeriesBundle(job)");
  const storageProof = source.indexOf("storageStatus = await verifyStorageEvidence");
  const confirmation = source.indexOf("const confirmation = await confirmCreditOperation");
  assert.ok(storageProof >= 0, "series must reopen every R2 object before confirmation");
  assert.ok(confirmation > storageProof, "credit confirmation must follow storage evidence");
  const reservation = source.indexOf("const reservation = await reserveCreditOperation");
  assert.ok(reservation > bundleCreation, "credit reservation must happen after native authoring");
  assert.ok(reservation < firstAssetPut, "credit reservation must happen before storage writes");
  assert.ok(blockedGuard < reservation, "blocked jobs must not reserve credits");
  assert.match(source, /key: `series:\$\{idempotencyKey\}`/);
  assert.match(source, /status = 'applied'/);
  assert.match(source, /persistenceStatements/);
  assert.match(source, /storageVerified/);
  assert.match(source, /if \(creditOperationId\)/);
});

const templatesRoutePath = new URL("../app/api/series/templates/route.ts", import.meta.url);
const thumbnailRoutePath = new URL("../app/api/series/templates/[templateId]/thumbnail/route.ts", import.meta.url);

test("the 3D, sheet and animation lanes are served from the template library with no placeholder fallback", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /const TEMPLATE_KINDS = new Set<AssetKind>\(\["3d-model", "sprite-atlas", "animation-clip"\]\)/);
  assert.match(source, /resolveTemplateSelection/);
  assert.match(source, /createTemplateAssemblyJob/);
  assert.match(source, /templateChoiceList/);
  assert.match(source, /templateObjectKey/);
  assert.match(source, /TEMPLATE_HONESTY_KO/);

  // A template request that cannot be resolved must answer 400 with the catalogue, and must
  // never reach createClunkSeriesJob — that function writes the 1.2 KB box this lane replaced.
  const templateBranch = source.indexOf("if (templateKind) {");
  const proceduralCall = source.indexOf("job = createClunkSeriesJob({");
  const resolveCall = source.indexOf("const resolved = resolveTemplateSelection({");
  const refusal = source.indexOf("templates: templateChoiceList(resolved.templates),");
  const assembleCall = source.indexOf("const assembled = createTemplateAssemblyJob({");
  assert.ok(templateBranch > 0 && resolveCall > templateBranch, "the template branch resolves a template first");
  assert.ok(refusal > resolveCall && refusal < assembleCall, "an unresolved request is refused before anything is assembled");
  assert.ok(proceduralCall > assembleCall, "the procedural recipe is only the else branch");
  assert.match(source.slice(templateBranch, proceduralCall), /} else {/);

  // Storage failures inside the template branch must precede any credit reservation.
  const reservation = source.indexOf("const reservation = await reserveCreditOperation");
  assert.ok(source.indexOf("TEMPLATE_LIBRARY_UNAVAILABLE") < reservation);
  assert.ok(source.indexOf("TEMPLATE_FILE_MISSING") < reservation);
  assert.ok(source.indexOf("TEMPLATE_FILE_TOO_LARGE") < reservation);
  assert.match(source, /MAX_TEMPLATE_BYTES = 3 \* 1024 \* 1024/);

  // The result has to carry the assembly record and the honesty line into the response and
  // into the stored recipe, or the user cannot tell a template from a model.
  assert.equal((source.match(/\.\.\.\(assembly \? \{ assembly \} : \{\}\)/g) ?? []).length, 2, "both recipe rows record the assembly");
  assert.equal((source.match(/assembly, honesty: TEMPLATE_HONESTY_KO/g) ?? []).length, 2, "both responses say how the file was made");
});

test("the template catalogue and thumbnail routes are authenticated and cannot be walked", async () => {
  const catalogue = await readFile(templatesRoutePath, "utf8");
  assert.match(catalogue, /requireClunkContext/);
  assert.match(catalogue, /describeTemplateCatalog/);
  assert.match(catalogue, /schema: "clunk.series-templates.v1"/);
  assert.match(catalogue, /status: 503/, "an unbuilt library says so rather than answering an empty list as success");
  assert.doesNotMatch(catalogue, /fetch\(/);

  const thumbnail = await readFile(thumbnailRoutePath, "utf8");
  assert.match(thumbnail, /requireClunkContext/);
  // The object key is built from library.json, never from the request.
  assert.match(thumbnail, /templateObjectKey\(template\.id, palette\.thumbnail\)/);
  assert.match(thumbnail, /\/\^\[a-z0-9\]\[a-z0-9-\]\{0,63\}\$\//);
  assert.doesNotMatch(thumbnail, /searchParams\.get\("file"\)/);
  assert.match(thumbnail, /"cache-control": "private/);
});
