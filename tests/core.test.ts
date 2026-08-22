import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createAssetBundle,
  inspectAsset,
  optimizeAsset,
  sha256Hex,
} from "../packages/core/src/index";
import {
  buildUnsignedVerificationPassport,
  generateVerificationKeyPair,
  parseVerificationPrivateKey,
  recomputeInspectionDigest,
  signVerificationPassport,
  verifyVerificationPassport,
} from "../packages/core/src/verification";

async function sample(name: string) {
  const bytes = new Uint8Array(await readFile(`public/samples/${name}`));
  return { bytes, bundle: createAssetBundle(name, bytes) };
}

test("real GLB inspection is deterministic across three runs", async () => {
  const { bytes, bundle } = await sample("clunk-messy-sample.glb");
  const reports = [inspectAsset(bundle), inspectAsset(bundle), inspectAsset(bundle)];
  assert.equal(reports[0].inputHash, sha256Hex(bytes));
  assert.equal(reports[0].resultDigest, reports[1].resultDigest);
  assert.equal(reports[1].resultDigest, reports[2].resultDigest);
  // 샘플은 제품의 유일한 무료 체험 경로다. 장난감으로 되돌아가면 여기서 걸린다.
  assert.ok(reports[0].metrics.triangleCount > 20_000, "데모 샘플이 실제 게임 에셋 규모여야 한다");
  assert.ok(reports[0].metrics.textureMaxDimension >= 4096, "텍스처 과다 문제가 담겨 있어야 한다");
  assert.ok(reports[0].findings.some((finding) => finding.id.startsWith("GEO-MISSING-NORMALS")));
  assert.ok(reports[0].findings.some((finding) => finding.severity === "ERROR"));
  assert.equal(reports[0].score.ready, false);
});

test("정답지 샘플은 세 프로파일 모두에서 통과한다", async () => {
  const { bundle } = await sample("clunk-ready-sample.glb");
  for (const profileId of ["pc", "web", "mobile"] as const) {
    const report = inspectAsset(bundle, { profileId });
    assert.equal(report.score.ready, true, `${profileId} 프로파일에서 통과해야 한다`);
  }
});

test("빈 노드 리포트는 최적화가 실제로 지우는 수만 약속한다", async () => {
  const { bundle } = await sample("clunk-messy-sample.glb");
  const report = inspectAsset(bundle);
  const finding = report.findings.find((entry) => entry.ruleId === "SCENE-EMPTY-NODES");
  assert.ok(finding, "샘플에 빈 노드가 있어야 이 검증이 의미가 있다");
  // extras나 트랜스폼을 가진 마커는 남긴다. 비어 보인다고 지우면 스폰 포인트가 사라진다.
  assert.ok(report.metrics.prunableEmptyNodeCount < report.metrics.emptyNodeCount);

  const result = optimizeAsset(bundle);
  const pruned = result.operations.find((operation) => operation.id === "prune-empty-nodes");
  assert.equal(pruned?.count, report.metrics.prunableEmptyNodeCount);
  assert.equal(
    result.after.metrics.emptyNodeCount,
    report.metrics.emptyNodeCount - report.metrics.prunableEmptyNodeCount,
  );
});

test("같은 파일을 반복 최적화해도 남기기로 한 노드는 계속 남는다", async () => {
  const { bundle } = await sample("clunk-messy-sample.glb");
  const first = optimizeAsset(bundle);
  const held = first.after.metrics.emptyNodeCount;
  assert.ok(held > 0, "남기기로 한 마커가 있어야 이 검증이 의미가 있다");

  // CI는 같은 파일에 이걸 반복해서 돌린다. 두 번째 실행에서 판단이 뒤집히면 안 된다.
  let bytes = first.outputBytes;
  let name = first.outputFileName;
  for (let pass = 0; pass < 2; pass += 1) {
    const again = optimizeAsset(createAssetBundle(name, bytes));
    assert.equal(again.after.metrics.emptyNodeCount, held);
    assert.equal(again.after.metrics.nodeCount, first.after.metrics.nodeCount);
    bytes = again.outputBytes;
    name = again.outputFileName;
  }
});

test("safe optimization creates a new artifact and fresh reinspection", async () => {
  const { bytes, bundle } = await sample("clunk-messy-sample.glb");
  const sourceHash = sha256Hex(bytes);
  const result = optimizeAsset(bundle);
  assert.equal(result.inputHash, sourceHash);
  assert.notEqual(result.outputFileName, "clunk-messy-sample.glb");
  assert.notEqual(result.outputHash, result.inputHash);
  assert.equal(result.passport.sourceHash, result.inputHash);
  assert.equal(result.passport.outputHash, result.outputHash);
  assert.equal(sha256Hex(bytes), sourceHash);
  const downloaded = inspectAsset(createAssetBundle(result.outputFileName, result.outputBytes));
  assert.equal(downloaded.inputHash, result.outputHash);
  assert.equal(downloaded.resultDigest, result.after.resultDigest);
  // 리포트가 "무손실로 병합 가능"이라고 적은 중복이 실제로 사라져야 한다.
  assert.equal(downloaded.metrics.duplicateMaterialCount, 0);
  assert.equal(
    downloaded.metrics.materialCount,
    result.before.metrics.materialCount - result.before.metrics.duplicateMaterialCount,
  );
  assert.equal(downloaded.metrics.prunableEmptyNodeCount, 0);
});

test("malformed and incomplete inputs are rejected with evidence", () => {
  const malformed = inspectAsset(createAssetBundle("broken.glb", new Uint8Array([1, 2, 3, 4])));
  assert.equal(malformed.score.ready, false);
  assert.ok(malformed.findings.some((finding) => finding.severity === "CRITICAL"));
  const missingResource = new TextEncoder().encode(JSON.stringify({ asset: { version: "2.0" }, buffers: [{ uri: "missing.bin", byteLength: 4 }] }));
  const report = inspectAsset(createAssetBundle("missing.gltf", missingResource));
  assert.ok(report.metrics.unresolvedResourceCount > 0);
  assert.equal(report.score.ready, false);
});

test("metadata cleanup is explicit, allowlisted, and render-safe", () => {
  const document = {
    asset: { version: "2.0", generator: "fixture", copyright: "fixture copyright" },
    extras: { source: "fixture" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      // 실제로 무언가를 붙들고 있는 노드. extras는 런타임이 쓰지 않으므로 지운다.
      { name: "Root", children: [1, 2], extras: { editorOnly: true } },
      // 순수 익스포터 잔여물. 지운다.
      { name: "Empty" },
      // 엔진이 이름으로 찾는 마커. 노드도 extras도 지키지 않으면 게임이 깨진다.
      { name: "SpawnPoint", extras: { team: "blue" } },
    ],
  };
  const source = new TextEncoder().encode(JSON.stringify(document));
  const result = optimizeAsset(createAssetBundle("metadata.gltf", source));
  const cleaned = JSON.parse(new TextDecoder().decode(result.outputBytes)) as typeof document;

  assert.equal(cleaned.asset.generator, undefined);
  assert.equal(cleaned.asset.copyright, undefined);
  assert.equal(cleaned.extras, undefined);
  assert.deepEqual(result.operations.map((operation) => operation.id), [
    "prune-empty-nodes",
    "clean-metadata",
  ]);
  assert.equal(result.operations[1].safety, "metadata-only");

  assert.deepEqual(
    cleaned.nodes.map((node) => node.name),
    ["Root", "SpawnPoint"],
  );
  assert.equal(cleaned.nodes[0].extras, undefined, "일반 노드의 extras는 허용 목록대로 지운다");
  assert.deepEqual(cleaned.nodes[1].extras, { team: "blue" }, "남기기로 한 마커는 extras까지 지킨다");
  assert.deepEqual(cleaned.nodes[0].children, [1], "노드를 지웠으면 참조도 다시 이어야 한다");
});

test("unparseable input scores zero and reports the real reason", async () => {
  const cases: Array<{ name: string; bytes: Uint8Array; expect: RegExp }> = [
    { name: "empty.glb", bytes: new Uint8Array(0), expect: /shorter than its header/i },
    {
      name: "text.glb",
      bytes: new TextEncoder().encode("this is definitely not a glb file at all"),
      expect: /invalid glb magic/i,
    },
    {
      name: "broken.gltf",
      bytes: new TextEncoder().encode("{ not json at all"),
      expect: /json/i,
    },
  ];

  for (const testCase of cases) {
    const report = inspectAsset(createAssetBundle(testCase.name, testCase.bytes));

    // A file we could not read has no measurable qualities. Scoring it on a per-category
    // average used to return 92/100 for a renamed text file, which made the headline number
    // meaningless. Every category must be zero.
    assert.equal(report.score.score, 0, `${testCase.name} must score 0`);
    assert.equal(report.score.ready, false);
    assert.ok(report.score.hardBlockerCount > 0);
    for (const [category, value] of Object.entries(report.score.breakdown)) {
      assert.equal(value, 0, `${testCase.name} breakdown.${category} must be 0`);
    }

    // The byte length must be the real one: hard-coding 0 made the storage API reject the
    // run with a byte-length error, so the actual diagnostic never reached the user.
    assert.equal(report.byteLength, testCase.bytes.byteLength);

    const parseFinding = report.findings.find((finding) => finding.ruleId === "FORMAT-PARSE");
    assert.ok(parseFinding, `${testCase.name} must report FORMAT-PARSE`);
    assert.equal(parseFinding.severity, "CRITICAL");
    assert.match(parseFinding.message, testCase.expect);
  }
});

test("a node graph that revisits paths cannot stall the inspection", () => {
  // Each node lists the same child twice. Depth is still linear, but a walk that carries a
  // per-path visited set explores 2^n paths — 40 such nodes in a 900-byte file used to freeze
  // the browser tab with no way to cancel. Receiving an asset from a collaborator is the
  // product's main use, so this was a hand-written file away from being a denial of service.
  const nodeCount = 2000;
  const nodes: Array<{ children?: number[] }> = [];
  for (let index = 0; index < nodeCount; index += 1) {
    nodes.push(index < nodeCount - 1 ? { children: [index + 1, index + 1] } : {});
  }
  const bytes = new TextEncoder().encode(
    JSON.stringify({ asset: { version: "2.0" }, scenes: [{ nodes: [0] }], scene: 0, nodes }),
  );

  const started = Date.now();
  const report = inspectAsset(createAssetBundle("revisit.gltf", bytes));
  const elapsed = Date.now() - started;

  assert.equal(report.metrics.maxDepth, nodeCount);
  assert.ok(elapsed < 2000, `inspection took ${elapsed}ms; the walk is not linear`);
});

test("an embedded resource that cannot be decoded is reported, not ignored", () => {
  // A data URI with characters outside the base64 alphabet decodes to nothing. Before, embedded
  // resources were assumed resolved, so a broken payload disappeared and the asset looked clean.
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      asset: { version: "2.0" },
      buffers: [{ byteLength: 8, uri: "data:application/octet-stream;base64,!!!!not-base64!!!!" }],
      scenes: [{ nodes: [] }],
      scene: 0,
    }),
  );

  const report = inspectAsset(createAssetBundle("broken-embed.gltf", bytes));
  assert.ok(
    report.metrics.unresolvedResourceCount > 0,
    "an undecodable embedded resource must be counted as unresolved",
  );
});

test("a large embedded resource decodes in linear time", () => {
  // 3 MB of valid base64. The old decoder accumulated a JS number per byte and looked each
  // character up with indexOf, so this scaled quadratically in both time and memory.
  const payload = "QUJDRA==".repeat(512 * 1024 / 8);
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      asset: { version: "2.0" },
      buffers: [{ byteLength: 8, uri: "data:application/octet-stream;base64," + payload }],
      scenes: [{ nodes: [] }],
      scene: 0,
    }),
  );

  const started = Date.now();
  inspectAsset(createAssetBundle("big-embed.gltf", bytes));
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 3000, `decoding took ${elapsed}ms; it is not linear`);
});

/*
 * Server-verification signing.
 *
 * These are the claims the product sells: a passport Clunk signed verifies, a passport anyone
 * edited afterwards does not, and a passport for one asset does not describe another. The whole
 * point of the feature is that the last two fail, so they are asserted as loudly as the first.
 */
test("a signed verification passport verifies against the matching public key", async () => {
  const { bytes, bundle } = await sample("clunk-ready-sample.glb");
  const report = inspectAsset(bundle, { profileId: "pc" });
  const { pair } = await generateVerificationKeyPair("Ed25519");
  const passport = await signVerificationPassport(
    buildUnsignedVerificationPassport(report, "https://clunk.test", "2026-08-22T00:00:00.000Z"),
    pair,
  );

  assert.equal(passport.verificationMode, "server-verified");
  assert.equal(passport.asset.sha256, sha256Hex(bytes));
  assert.equal(recomputeInspectionDigest(passport), report.resultDigest);
  assert.deepEqual(await verifyVerificationPassport(passport, pair.publicKey), {
    ok: true,
    keyId: pair.keyId,
    algorithm: "Ed25519",
  });
});

test("editing any field of a signed passport invalidates the signature", async () => {
  const { bundle } = await sample("clunk-messy-sample.glb");
  const report = inspectAsset(bundle, { profileId: "pc" });
  const { pair } = await generateVerificationKeyPair("Ed25519");
  const passport = await signVerificationPassport(
    buildUnsignedVerificationPassport(report, "https://clunk.test", "2026-08-22T00:00:00.000Z"),
    pair,
  );

  const forgedScore = JSON.parse(JSON.stringify(passport)) as typeof passport;
  forgedScore.score.score = 100;
  forgedScore.score.ready = true;
  forgedScore.score.hardBlockerCount = 0;
  const scoreCheck = await verifyVerificationPassport(forgedScore, pair.publicKey);
  assert.equal(scoreCheck.ok, false, "a hand-raised score must not verify");

  const forgedHash = JSON.parse(JSON.stringify(passport)) as typeof passport;
  forgedHash.asset.sha256 = "0".repeat(64);
  assert.equal((await verifyVerificationPassport(forgedHash, pair.publicKey)).ok, false);

  const forgedFindings = JSON.parse(JSON.stringify(passport)) as typeof passport;
  forgedFindings.findings = [];
  assert.equal((await verifyVerificationPassport(forgedFindings, pair.publicKey)).ok, false);
});

test("a passport does not verify against a different issuing key", async () => {
  const { bundle } = await sample("clunk-ready-sample.glb");
  const report = inspectAsset(bundle, { profileId: "pc" });
  const mine = await generateVerificationKeyPair("Ed25519");
  const theirs = await generateVerificationKeyPair("Ed25519");
  const passport = await signVerificationPassport(
    buildUnsignedVerificationPassport(report, "https://clunk.test", "2026-08-22T00:00:00.000Z"),
    mine.pair,
  );
  const check = await verifyVerificationPassport(passport, theirs.pair.publicKey);
  assert.equal(check.ok, false);
});

test("a local-first report is never mistaken for a server-verified passport", async () => {
  const { bundle } = await sample("clunk-ready-sample.glb");
  const report = inspectAsset(bundle);
  const { pair } = await generateVerificationKeyPair("Ed25519");
  const check = await verifyVerificationPassport(report, pair.publicKey);
  assert.equal(check.ok, false, "an unsigned local report must be rejected outright");
});

test("the private key env value round-trips through base64 and JSON", async () => {
  const { pair, privateKeyEnvValue } = await generateVerificationKeyPair("Ed25519");
  const fromBase64Value = parseVerificationPrivateKey(privateKeyEnvValue);
  assert.equal(fromBase64Value.keyId, pair.keyId);
  const fromJson = parseVerificationPrivateKey(JSON.stringify(pair.privateJwk));
  assert.equal(fromJson.keyId, pair.keyId);
  assert.deepEqual(fromJson.publicKey, pair.publicKey);
  assert.throws(() => parseVerificationPrivateKey(""), /비어 있습니다/);
  assert.throws(() => parseVerificationPrivateKey('{"kty":"RSA"}'), /개인키 JWK가 아닙니다/);
  assert.throws(
    () => parseVerificationPrivateKey('{"kty":"RSA","d":"aa","x":"bb"}'),
    /지원하는 키는/,
    "an unsupported curve must be refused rather than silently signed with",
  );
});

test("ECDSA P-256 is a working fallback for a runtime without Ed25519", async () => {
  const { bundle } = await sample("clunk-ready-sample.glb");
  const report = inspectAsset(bundle);
  const { pair } = await generateVerificationKeyPair("ECDSA-P256-SHA256");
  const passport = await signVerificationPassport(
    buildUnsignedVerificationPassport(report, "https://clunk.test", "2026-08-22T00:00:00.000Z"),
    pair,
  );
  assert.equal(passport.signature.algorithm, "ECDSA-P256-SHA256");
  assert.equal((await verifyVerificationPassport(passport, pair.publicKey)).ok, true);
});
