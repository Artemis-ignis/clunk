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

/** KTX2 헤더만 갖춘 최소 파일. 크기 필드가 실제로 읽히는지 보기 위한 것이다. */
function ktx2(width: number, height: number) {
  const bytes = new Uint8Array(80);
  bytes.set([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(20, width, true);
  view.setUint32(24, height, true);
  return bytes;
}

function texturedGltf(images: Array<{ name: string; bytes: Uint8Array }>, required: string[] = []) {
  const document = {
    asset: { version: "2.0" },
    extensionsUsed: required,
    extensionsRequired: required,
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 0, TEXCOORD_0: 1 }, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    textures: images.map((_, index) => ({ source: index })),
    images: images.map((image) => ({ uri: image.name })),
    accessors: [
      { componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 1] },
      { componentType: 5126, count: 3, type: "VEC2" },
    ],
    bufferViews: [],
    buffers: [],
  };
  const files = new Map<string, Uint8Array>([
    ["scene.gltf", new TextEncoder().encode(JSON.stringify(document))],
  ]);
  for (const image of images) files.set(image.name, image.bytes);
  return { entry: "scene.gltf", files };
}

test("KTX2 텍스처의 크기를 실제로 읽는다", () => {
  // 읽지 못하던 때는 4096 두 장짜리 에셋이 '텍스처 메모리 0'으로 모든 예산을 통과했다.
  // 제대로 최적화한 모바일 게임 에셋이 정확히 이 포맷을 쓴다.
  const bundle = texturedGltf(
    [
      { name: "a.ktx2", bytes: ktx2(4096, 4096) },
      { name: "b.ktx2", bytes: ktx2(4096, 4096) },
    ],
    ["KHR_texture_basisu"],
  );
  const report = inspectAsset(bundle);
  assert.equal(report.metrics.textureMaxDimension, 4096);
  assert.equal(report.metrics.unreadableImageCount, 0);
  // 블록 압축이므로 픽셀당 1바이트로 센다. 전부 RGBA 4바이트로 세면 4배 부풀려
  // 없는 예산 초과를 만들어 낸다.
  assert.equal(report.metrics.textureMemoryBytes, 4096 * 4096 * 2);

  // 같은 파일이 프로파일에 따라 갈려야 한다.
  assert.equal(inspectAsset(bundle, { profileId: "pc" }).score.ready, true);
  const mobile = inspectAsset(bundle, { profileId: "mobile" });
  assert.equal(mobile.score.ready, false);
  assert.ok(mobile.findings.some((finding) => finding.ruleId === "TEX-DIMENSION-BUDGET"));
});

test("측정하지 못한 텍스처가 있으면 통과시키지 않는다", () => {
  const bundle = texturedGltf([{ name: "weird.tga", bytes: new Uint8Array(64).fill(7) }]);
  const report = inspectAsset(bundle);
  assert.equal(report.metrics.unreadableImageCount, 1);
  // READY는 '검사했고 통과했다'는 뜻이다. 읽지 못했으면 그 문장이 성립하지 않는다.
  assert.equal(report.score.ready, false);
  assert.ok(report.findings.some((finding) => finding.ruleId === "TEX-UNREADABLE"));
});

test("해석하지 못하는 필수 확장이 있으면 통과시키지 않는다", () => {
  const known = texturedGltf(
    [{ name: "a.ktx2", bytes: ktx2(512, 512) }],
    ["KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_texture_basisu"],
  );
  // draco·meshopt는 데이터가 압축돼 있어도 accessor의 count와 min/max가 남으므로
  // 우리 수치가 유효하다. 그런 확장까지 막으면 실제 게임 에셋 대부분이 걸린다.
  assert.equal(inspectAsset(known).metrics.unknownRequiredExtensionCount, 0);
  assert.equal(inspectAsset(known).score.ready, true);

  const unknown = texturedGltf([{ name: "a.ktx2", bytes: ktx2(512, 512) }], ["VENDOR_secret_sauce"]);
  const report = inspectAsset(unknown);
  assert.equal(report.metrics.unknownRequiredExtensionCount, 1);
  assert.equal(report.score.ready, false);
  assert.ok(report.findings.some((finding) => finding.ruleId === "FORMAT-UNKNOWN-EXTENSION"));
});

test("WebP 텍스처의 크기를 세 가지 청크 형식 모두에서 읽는다", () => {
  const riff = (chunk: string, body: Uint8Array) => {
    const bytes = new Uint8Array(12 + 8 + body.length);
    const ascii = (text: string, offset: number) => {
      for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i);
    };
    ascii("RIFF", 0);
    new DataView(bytes.buffer).setUint32(4, bytes.length - 8, true);
    ascii("WEBP", 8);
    ascii(chunk, 12);
    new DataView(bytes.buffer).setUint32(16, body.length, true);
    bytes.set(body, 20);
    return bytes;
  };

  const lossy = new Uint8Array(24);
  lossy.set([0x9d, 0x01, 0x2a], 3);
  new DataView(lossy.buffer).setUint16(6, 1024, true);
  new DataView(lossy.buffer).setUint16(8, 512, true);

  const lossless = new Uint8Array(24);
  lossless[0] = 0x2f;
  new DataView(lossless.buffer).setUint32(1, (1023 & 0x3fff) | ((511 & 0x3fff) << 14), true);

  const extended = new Uint8Array(24);
  extended[4] = 1023 & 0xff;
  extended[5] = (1023 >> 8) & 0xff;
  extended[7] = 511 & 0xff;
  extended[8] = (511 >> 8) & 0xff;

  for (const [label, bytes] of [
    ["VP8 ", riff("VP8 ", lossy)],
    ["VP8L", riff("VP8L", lossless)],
    ["VP8X", riff("VP8X", extended)],
  ] as const) {
    const report = inspectAsset(texturedGltf([{ name: "t.webp", bytes }]));
    assert.equal(report.metrics.unreadableImageCount, 0, label);
    assert.equal(report.metrics.textureMaxDimension, 1024, label);
  }
});

/** 같은 머티리얼·같은 속성 프리미티브를 N개 가진 메시 하나. 익스포터가 스무딩 그룹마다
    프리미티브를 쪼갤 때 나오는 모양이다. */
function splitMesh(primitiveCount: number) {
  const document = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: Array.from({ length: primitiveCount }, () => ({
          attributes: { POSITION: 0, NORMAL: 0 },
          indices: 1,
          material: 0,
        })),
      },
    ],
    materials: [{ pbrMetallicRoughness: {} }],
    accessors: [
      { componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 1] },
      { componentType: 5125, count: 3, type: "SCALAR" },
    ],
    bufferViews: [],
    buffers: [],
  };
  return createAssetBundle("split.gltf", new TextEncoder().encode(JSON.stringify(document)));
}

test("드로우콜을 재기만 하지 않고 예산과 대조한다", () => {
  // Harvest Frontier 실측(2026-08-22): 157,560 삼각형 그룹이 0.15ms인데 82,100 삼각형
  // 그룹이 5.67ms였다. 비용은 삼각형이 아니라 그려지는 오브젝트 수에 붙어 있다. 그런데
  // drawCallCount는 계산만 되고 어떤 규칙도 보지 않았다.
  const report = inspectAsset(splitMesh(40), { profileId: "mobile" });
  assert.equal(report.metrics.drawCallCount, 40);
  const finding = report.findings.find((entry) => entry.ruleId === "GEO-DRAW-CALL-BUDGET");
  assert.ok(finding, "예산을 넘겼으면 말해야 한다");
  assert.equal(finding?.observed, 40);

  // 삼각형은 그대로인데 프리미티브만 합친 에셋은 통과해야 한다 — 규칙이 실제로 보는
  // 것이 삼각형이 아니라 드로우콜이라는 뜻이다.
  const merged = inspectAsset(splitMesh(4), { profileId: "mobile" });
  assert.equal(merged.findings.some((entry) => entry.ruleId === "GEO-DRAW-CALL-BUDGET"), false);
});

test("합쳐도 화면이 달라지지 않는 프리미티브를 수로 알려준다", () => {
  const report = inspectAsset(splitMesh(40));
  // 40개가 모두 같은 (머티리얼, 속성, 모드)이므로 하나만 남기고 39개가 사라진다.
  assert.equal(report.metrics.mergeablePrimitiveCount, 39);
  const finding = report.findings.find((entry) => entry.ruleId === "GEO-MERGEABLE-PRIMITIVES");
  assert.equal(finding?.observed, 39);
  // 지오메트리 버퍼를 다시 쓰는 일은 무손실 허용 목록 밖이다. 보고만 하고 손대지 않는다.
  assert.equal(finding?.autoFixable, false);

  // 프리미티브가 하나뿐이면 합칠 것이 없다.
  assert.equal(inspectAsset(splitMesh(1)).metrics.mergeablePrimitiveCount, 0);
});

test("메시 경계를 넘는 병합 여지는 따로, 조건과 함께 보고한다", () => {
  // 실제 게임 에셋은 프리미티브를 메시 안에서 쪼개지 않고 메시 자체를 여러 개 만든다.
  // 메시 안만 보던 규칙은 그래서 진짜 에셋에서 한 번도 켜지지 않았다.
  const document = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1, 2] }],
    nodes: [{ mesh: 0 }, { mesh: 1 }, { mesh: 2 }],
    meshes: [0, 1, 2].map(() => ({
      primitives: [{ attributes: { POSITION: 0, NORMAL: 0 }, indices: 1, material: 0 }],
    })),
    materials: [{ pbrMetallicRoughness: {} }],
    accessors: [
      { componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 1] },
      { componentType: 5125, count: 3, type: "SCALAR" },
    ],
    bufferViews: [],
    buffers: [],
  };
  const bundle = createAssetBundle("meshes.gltf", new TextEncoder().encode(JSON.stringify(document)));
  const report = inspectAsset(bundle);

  assert.equal(report.metrics.drawCallCount, 3);
  assert.equal(report.metrics.mergeablePrimitiveCount, 0, "메시 안에서는 합칠 것이 없다");
  assert.equal(report.metrics.mergeableAcrossMeshCount, 2);

  const finding = report.findings.find((entry) => entry.ruleId === "GEO-MERGEABLE-MESHES");
  // 부품이 따로 나뉜 데에는 보통 이유가 있다(도는 바퀴, 꺾이는 조향). 파일만 보고는
  // 알 수 없으므로 점수를 깎지 않고 수치와 조건만 준다.
  assert.equal(finding?.severity, "INFO");
  assert.equal(finding?.observed, 2);
  assert.equal(report.score.ready, true);
});

test("두 병합 수치가 같은 드로우콜을 두 번 세지 않는다", () => {
  // 겹쳐 세면 사람이 같은 드로우콜을 두 번 줄일 수 있다고 읽는다.
  const report = inspectAsset(splitMesh(40));
  assert.equal(report.metrics.mergeablePrimitiveCount, 39);
  assert.equal(report.metrics.mergeableAcrossMeshCount, 0);
  assert.ok(
    report.metrics.mergeablePrimitiveCount + report.metrics.mergeableAcrossMeshCount <
      report.metrics.drawCallCount,
    "드로우콜을 0개로 줄일 수 있다고 말해서는 안 된다",
  );
});
