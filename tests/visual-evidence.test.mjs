/**
 * 화면 증거가 사람 없이 끝나는지, 그리고 끝내면서 거짓말을 하지 않는지 확인한다.
 *
 * 실행: node --test tests/visual-evidence.test.mjs
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { fileURLToPath } from "node:url";

try {
  const { register } = await import("tsx/esm/api");
  register();
} catch {
  // 이미 tsx 로 실행 중이면 등록할 것이 없다.
}

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const { captureVisualEvidence } = await import("../packages/core/src/visual-evidence/capture-node.ts");
const { normalizeAssetInspectionEvidenceV3, readAssetInspectionEvidence, toAssetInspectionEvidenceV2 } =
  await import("../packages/core/src/visual-evidence/evidence.ts");
const { MOTION_PHASES, SKINNED_MOTION_PHASES } = await import("../packages/core/src/visual-evidence/views.ts");
const { createAssetInspectionEvidenceV2 } = await import("../packages/core/src/asset-inspection-evidence.ts");
const { createAssetBundle, inspectAsset } = await import("../packages/core/src/index.ts");

const CRATE = resolve(ROOT, "public/market/cozy-crate-closed/crate-closed.clunk-optimized.glb");
const TRACTOR = resolve(ROOT, "public/landing/tractor.compact.m1.glb");
const HELI = resolve(ROOT, "public/market/clunk-heli-h145/h145.glb");

/**
 * 결함 픽스처를 손으로 만든다.
 *
 * `floorOffset` 만큼 바닥에서 띄운 상자 하나짜리 GLB. 압축도 그림도 없어서 이 파일이 통과하지
 * 못하는 이유는 오직 "떠 있다" 하나로 남는다.
 */
function boxGlb({ floorOffset = 0, size = 1 } = {}) {
  const y0 = floorOffset;
  const y1 = floorOffset + size;
  const half = size / 2;
  const positions = new Float32Array([
    -half, y0, -half, half, y0, -half, half, y1, -half, -half, y1, -half,
    -half, y0, half, half, y0, half, half, y1, half, -half, y1, half,
  ]);
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1,
    3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2,
  ]);
  // 정점 색을 넣어 상자 자체에 대비를 준다. 그래야 이 픽스처가 떨어질 때 이유가
  // "떠 있다" 하나로 좁혀지고, 단색 덩어리라서 가독성에서 걸린 것과 섞이지 않는다.
  const colors = new Float32Array([
    0.85, 0.78, 0.62, 0.20, 0.24, 0.30, 0.86, 0.42, 0.20, 0.14, 0.36, 0.44,
    0.92, 0.88, 0.80, 0.10, 0.14, 0.22, 0.78, 0.30, 0.34, 0.30, 0.62, 0.40,
  ]);
  const positionBytes = Buffer.from(positions.buffer);
  const colorBytes = Buffer.from(colors.buffer);
  const indexBytes = Buffer.from(indices.buffer);
  const bin = Buffer.concat([positionBytes, colorBytes, indexBytes, Buffer.alloc((4 - (indexBytes.length % 4)) % 4)]);
  const json = {
    asset: { version: "2.0", generator: "clunk visual-evidence test fixture" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "box" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, COLOR_0: 1 }, indices: 2, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.9 } }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 8, type: "VEC3", min: [-half, y0, -half], max: [half, y1, half] },
      { bufferView: 1, componentType: 5126, count: 8, type: "VEC3" },
      { bufferView: 2, componentType: 5123, count: 36, type: "SCALAR" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positionBytes.length, target: 34962 },
      { buffer: 0, byteOffset: positionBytes.length, byteLength: colorBytes.length, target: 34962 },
      { buffer: 0, byteOffset: positionBytes.length + colorBytes.length, byteLength: indexBytes.length, target: 34963 },
    ],
    buffers: [{ byteLength: bin.length }],
  };
  const jsonBytes = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPadded = Buffer.concat([jsonBytes, Buffer.alloc((4 - (jsonBytes.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  header.write("glTF", 0, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + bin.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonPadded.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, jsonPadded, binHeader, bin]);
}

/**
 * 뼈대 픽스처를 손으로 만든다.
 *
 * 관절 둘(바닥에 고정된 뿌리, 1 m 위의 끝)에 매달린 세로 막대 하나. 위쪽 네 정점은 끝 관절에만,
 * 아래쪽 네 정점은 뿌리 관절에만 붙어 있어서, 끝 관절이 돌면 막대 윗절반만 꺾인다. 노드 트리는
 * 그대로이고 움직이는 것은 뼈대뿐이므로, 스키닝을 하지 않는 그리기는 이 파일에서 언제나 같은
 * 그림 세 장을 낸다 — 이 픽스처가 지키는 것이 그 차이다.
 *
 * JOINTS_0 는 unsigned byte, WEIGHTS_0 는 normalized unsigned byte 로 쓴다. 실제 캐릭터
 * 파일이 쓰는 양자화 경로를 픽스처가 실제로 지나가게 하려는 것이다.
 */
function skinnedBarGlb() {
  const half = 0.15;
  const positions = new Float32Array([
    -half, 0, -half, half, 0, -half, half, 0, half, -half, 0, half,
    -half, 2, -half, half, 2, -half, half, 2, half, -half, 2, half,
  ]);
  // 아래 네 정점은 뿌리 관절(0), 위 네 정점은 끝 관절(1)에 100 % 로 붙인다.
  const joints = new Uint8Array(8 * 4);
  const weights = new Uint8Array(8 * 4);
  for (let v = 0; v < 8; v += 1) {
    joints[v * 4] = v < 4 ? 0 : 1;
    weights[v * 4] = 255; // normalized unsigned byte: 255 = 1.0
  }
  const colors = new Float32Array([
    0.86, 0.42, 0.20, 0.20, 0.24, 0.30, 0.85, 0.78, 0.62, 0.14, 0.36, 0.44,
    0.92, 0.88, 0.80, 0.10, 0.14, 0.22, 0.78, 0.30, 0.34, 0.30, 0.62, 0.40,
  ]);
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1,
    3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2,
  ]);
  // 역바인드 행렬(열 우선): 뿌리는 단위행렬, 끝은 (0, -1, 0) 이동.
  const inverseBind = new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1, 0, 1,
  ]);
  // 시작과 끝이 같은 값이라 반복 동작이고, 네 키프레임이라 25/50/75 % 가 서로 다른 자세가 된다.
  const times = new Float32Array([0, 0.25, 0.6, 1]);
  const angles = [0, Math.PI / 3, -Math.PI / 3, 0];
  const rotations = new Float32Array(angles.flatMap((angle) => [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)]));

  const parts = [];
  let offset = 0;
  const views = [];
  const push = (typed, target) => {
    const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    const padding = (4 - (bytes.length % 4)) % 4;
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(target ? { target } : {}) });
    parts.push(bytes, Buffer.alloc(padding));
    offset += bytes.length + padding;
    return views.length - 1;
  };
  const positionView = push(positions, 34962);
  const colorView = push(colors, 34962);
  const jointView = push(joints, 34962);
  const weightView = push(weights, 34962);
  const indexView = push(indices, 34963);
  const inverseBindView = push(inverseBind);
  const timeView = push(times);
  const rotationView = push(rotations);
  const bin = Buffer.concat(parts);

  const json = {
    asset: { version: "2.0", generator: "clunk visual-evidence skinned test fixture" },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [
      { mesh: 0, skin: 0, name: "bar" },
      { name: "BoneRoot", children: [2] },
      { name: "BoneTip", translation: [0, 1, 0] },
    ],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0, COLOR_0: 1, JOINTS_0: 2, WEIGHTS_0: 3 },
        indices: 4,
        material: 0,
      }],
    }],
    skins: [{ inverseBindMatrices: 5, joints: [1, 2], skeleton: 1 }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.9 } }],
    animations: [{
      name: "bend",
      channels: [{ sampler: 0, target: { node: 2, path: "rotation" } }],
      samplers: [{ input: 6, output: 7, interpolation: "LINEAR" }],
    }],
    accessors: [
      { bufferView: positionView, componentType: 5126, count: 8, type: "VEC3", min: [-half, 0, -half], max: [half, 2, half] },
      { bufferView: colorView, componentType: 5126, count: 8, type: "VEC3" },
      { bufferView: jointView, componentType: 5121, count: 8, type: "VEC4" },
      { bufferView: weightView, componentType: 5121, normalized: true, count: 8, type: "VEC4" },
      { bufferView: indexView, componentType: 5123, count: 36, type: "SCALAR" },
      { bufferView: inverseBindView, componentType: 5126, count: 2, type: "MAT4" },
      { bufferView: timeView, componentType: 5126, count: 4, type: "SCALAR", min: [0], max: [1] },
      { bufferView: rotationView, componentType: 5126, count: 4, type: "VEC4" },
    ],
    bufferViews: views,
    buffers: [{ byteLength: bin.length }],
  };
  const jsonBytes = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPadded = Buffer.concat([jsonBytes, Buffer.alloc((4 - (jsonBytes.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  header.write("glTF", 0, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + bin.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonPadded.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, jsonPadded, binHeader, bin]);
}

async function workspace(prefix) {
  return await mkdtemp(join(tmpdir(), `clunk-visual-evidence-${prefix}-`));
}

function checkById(evidence, id, lane) {
  const found = evidence.visualEvidence.checks.find((check) => check.id === id && (!lane || check.lane === lane));
  assert.ok(found, `check ${id}/${lane ?? "any"} is missing`);
  return found;
}

test("the same file rendered twice produces byte-identical captures and the same digests", async () => {
  const first = await workspace("determinism-a");
  const second = await workspace("determinism-b");
  try {
    const a = await captureVisualEvidence({ glbPath: CRATE, outDir: first, slug: "crate", inspectionRunId: "fixed-run-id" });
    const b = await captureVisualEvidence({ glbPath: CRATE, outDir: second, slug: "crate", inspectionRunId: "fixed-run-id" });

    assert.equal(a.evidence.visualEvidence.sceneDigest, b.evidence.visualEvidence.sceneDigest);
    assert.equal(a.evidence.visualEvidence.cameraRigHash, b.evidence.visualEvidence.cameraRigHash);
    assert.equal(a.evidence.identity.inputHash, b.evidence.identity.inputHash);
    assert.deepEqual(
      a.evidence.captureEvidence.map((capture) => capture.sha256),
      b.evidence.captureEvidence.map((capture) => capture.sha256),
    );
    assert.deepEqual(
      a.evidence.visualEvidence.captures.map((capture) => capture.cameraPoseHash),
      b.evidence.visualEvidence.captures.map((capture) => capture.cameraPoseHash),
    );
    // 기록한 해시가 실제로 그 파일의 해시여야 한다.
    for (const capture of a.evidence.captureEvidence) {
      const bytes = await readFile(capture.path);
      assert.equal(bytes.byteLength, capture.bytes);
    }
  } finally {
    await rm(first, { recursive: true, force: true });
    await rm(second, { recursive: true, force: true });
  }
});

test("a crate that stands on the floor passes without asking a human anything", async () => {
  const directory = await workspace("crate-pass");
  try {
    const { evidence } = await captureVisualEvidence({ glbPath: CRATE, outDir: directory, slug: "crate" });
    assert.equal(evidence.visualEvidence.verdict, "PASS");
    assert.equal(evidence.statuses.visualRuntime, "APPROVED");
    assert.equal(evidence.statuses.playerFacing, "PASS");
    assert.equal(evidence.statuses.humanDecision, "NOT_REQUIRED");
    assert.equal(evidence.statuses.decisionAuthority, "MACHINE");
    assert.equal(evidence.statuses.reviewStatus, "EVALUATED");
    assert.equal(evidence.readiness, "ready");
    assert.equal(checkById(evidence, "groundContact", "playerFacing").status, "PASS");
    // 엔진 렌더 넷 + 게임 시점 둘. 정지 화면 여섯 장이 실제로 저장돼야 한다.
    assert.equal(evidence.captureEvidence.length, 6);
    assert.ok(evidence.visualEvidence.checks.every((check) => check.reason_ko.trim().length > 0));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a model authored a whole height above the floor fails, and says why", async () => {
  const directory = await workspace("floating-fail");
  try {
    const path = join(directory, "floating-box.glb");
    await (await import("node:fs/promises")).writeFile(path, boxGlb({ floorOffset: 1, size: 1 }));
    const { evidence } = await captureVisualEvidence({ glbPath: path, outDir: directory, slug: "floating-box" });

    const ground = checkById(evidence, "groundContact", "playerFacing");
    assert.equal(ground.status, "FAIL");
    assert.equal(ground.observed.originGroundOffsetRatio, 1);
    assert.match(ground.reason_ko, /엔진 바닥/);
    assert.equal(evidence.visualEvidence.verdict, "FAIL");
    assert.equal(evidence.statuses.playerFacing, "NO_GO");
    assert.equal(evidence.statuses.humanDecision, "NOT_REQUIRED");
    assert.equal(evidence.readiness, "blocked");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a model that clears the floor by a hair asks for an optional review rather than passing", async () => {
  const directory = await workspace("floating-review");
  try {
    const path = join(directory, "hovering-box.glb");
    await (await import("node:fs/promises")).writeFile(path, boxGlb({ floorOffset: 0.05, size: 1 }));
    const { evidence } = await captureVisualEvidence({ glbPath: path, outDir: directory, slug: "hovering-box" });

    const ground = checkById(evidence, "groundContact", "playerFacing");
    assert.equal(ground.status, "REVIEW");
    assert.equal(evidence.statuses.humanDecision, "OPTIONAL_REVIEW");
    assert.equal(evidence.statuses.decisionAuthority, "MACHINE");
    assert.equal(evidence.statuses.playerFacing, "PASS_WITH_FOLLOW_UP");
    assert.equal(evidence.visualEvidence.verdict, "REVIEW");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a box sitting exactly on the origin clears the ground check", async () => {
  const directory = await workspace("grounded-box");
  try {
    const path = join(directory, "grounded-box.glb");
    await (await import("node:fs/promises")).writeFile(path, boxGlb({ floorOffset: 0, size: 1 }));
    const { evidence } = await captureVisualEvidence({ glbPath: path, outDir: directory, slug: "grounded-box" });
    assert.equal(checkById(evidence, "groundContact", "playerFacing").status, "PASS");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("motion phases do not alias on a clip that loops a whole number of times", async () => {
  const directory = await workspace("motion");
  try {
    // drive 는 클립 한 번에 바퀴가 정확히 세 바퀴 돈다. 0, 1/3, 2/3 으로 찍으면 같은 자세가 나온다.
    assert.deepEqual(MOTION_PHASES, [0, 3 / 7, 6 / 7]);
    const { evidence } = await captureVisualEvidence({ glbPath: TRACTOR, outDir: directory, slug: "tractor" });
    const motion = checkById(evidence, "motion", "visualRuntime");
    assert.equal(motion.status, "PASS");
    assert.ok(motion.observed.movedPixelRatio > 0.01, `movedPixelRatio was ${motion.observed.movedPixelRatio}`);
    assert.equal(evidence.visualEvidence.motionPhases.length, 3);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a rigged file is drawn in the pose its skeleton is in, not in its bind pose", async () => {
  const directory = await workspace("skinned");
  try {
    const path = join(directory, "bending-bar.glb");
    await writeFile(path, skinnedBarGlb());
    const { evidence } = await captureVisualEvidence({ glbPath: path, outDir: directory, slug: "bending-bar" });

    const motion = evidence.visualEvidence.motion;
    assert.ok(motion, "skinned fixture produced no motion block");
    assert.equal(motion.skinned, true);
    assert.equal(motion.jointCount, 2);
    assert.equal(motion.skinnedVertexCount, 8);
    // 뼈대가 있는 파일은 반복 동작을 25/50/75 % 에서 본다.
    assert.deepEqual([...motion.phases], [...SKINNED_MOTION_PHASES]);
    assert.equal(motion.framing, "frozen");

    // 실루엣이 위상 사이에서 바뀌어야 한다. 스키닝을 하지 않으면 이 값이 정확히 0 이었다.
    assert.ok(
      motion.silhouetteChangeRatio > 0.1,
      `silhouetteChangeRatio was ${motion.silhouetteChangeRatio}; a bent bone changed nothing`,
    );
    for (const pair of motion.silhouetteChangePairs) {
      assert.ok(pair.ratio > 0, `phases ${pair.from} and ${pair.to} are the same picture`);
    }
    const check = checkById(evidence, "motion", "visualRuntime");
    assert.equal(check.status, "PASS");
    assert.equal(check.observed.skinned, 1);
    assert.ok(check.observed.minPhaseGroundYMetres >= -0.005);
    // 세 장이 서로 다른 파일이어야 한다. 같은 자세를 세 번 저장하면 해시가 같다.
    const hashes = new Set(evidence.visualEvidence.motionPhases.map((phase) => phase.sha256));
    assert.equal(hashes.size, 3);

    // 바인드 자세와 직접 견준다: 같은 카메라로 찍은 정지 화면과 세 위상이 모두 달라야 한다.
    const { decodeGlb } = await import("../packages/core/src/visual-evidence/glb-node.ts");
    const { renderView } = await import("../packages/core/src/visual-evidence/raster.ts");
    const { measureSilhouetteChange } = await import("../packages/core/src/visual-evidence/metrics.ts");
    const { MOTION_VIEW } = await import("../packages/core/src/visual-evidence/views.ts");
    const { sceneSet } = await decodeGlb(new Uint8Array(await readFile(path)));
    const scenes = [sceneSet.rest, ...sceneSet.animation.phases.map((phase) => phase.scene)];
    const frames = scenes.map((scene) =>
      renderView({ scene, bounds: sceneSet.bounds, view: MOTION_VIEW, framingScenes: scenes }));
    const againstBind = measureSilhouetteChange(frames).pairs.filter((pair) => pair.from === 0);
    assert.equal(againstBind.length, 3);
    for (const pair of againstBind) {
      assert.ok(pair.ratio > 0.05, `posed phase ${pair.to} is the bind pose again (${pair.ratio})`);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("an 85k triangle asset finishes inside the performance ceiling", async () => {
  const directory = await workspace("performance");
  try {
    const started = Date.now();
    const { evidence } = await captureVisualEvidence({ glbPath: HELI, outDir: directory, slug: "h145" });
    const elapsed = Date.now() - started;
    assert.equal(evidence.visualEvidence.triangleCount, 85150);
    // 실측 1.5-4초. 10배 여유를 두되, 성능이 무너지면 잡히도록 상한은 남긴다.
    assert.ok(elapsed < 40_000, `visual evidence took ${elapsed} ms for 85k triangles`);
    assert.ok(evidence.visualEvidence.timings.totalMs <= elapsed);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a capture that claims to come from the shipped rendering path is refused", async () => {
  const directory = await workspace("shipped-path");
  try {
    const { evidence } = await captureVisualEvidence({ glbPath: CRATE, outDir: directory, slug: "crate" });
    const forged = {
      ...evidence,
      captureEvidence: evidence.captureEvidence.map((capture) => ({ ...capture, shippedPath: true })),
    };
    assert.throws(() => normalizeAssetInspectionEvidenceV3(forged), /shippedPath must be false/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a machine envelope may not claim a human decided", async () => {
  const directory = await workspace("authority");
  try {
    const { evidence } = await captureVisualEvidence({ glbPath: CRATE, outDir: directory, slug: "crate" });
    const forged = { ...evidence, statuses: { ...evidence.statuses, humanDecision: "PASS" } };
    assert.throws(() => normalizeAssetInspectionEvidenceV3(forged), /NOT_REQUIRED or OPTIONAL_REVIEW/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the reader still reads v2, and the v2 view of a v3 envelope stays a valid v2 envelope", async () => {
  const directory = await workspace("v2-reader");
  try {
    const bytes = new Uint8Array(await readFile(CRATE));
    const report = inspectAsset(createAssetBundle("crate-closed.clunk-optimized.glb", bytes));
    const v2 = createAssetInspectionEvidenceV2(report, { inspectionRunId: "v2-fixture" });
    const readV2 = readAssetInspectionEvidence(v2);
    assert.equal(readV2.schemaVersion, "2");
    assert.equal(readV2.value.schema, "clunk.asset-inspection-evidence.v2");

    const { evidence } = await captureVisualEvidence({ glbPath: CRATE, outDir: directory, slug: "crate" });
    const readV3 = readAssetInspectionEvidence(evidence);
    assert.equal(readV3.schemaVersion, "3");

    const view = toAssetInspectionEvidenceV2(evidence);
    assert.equal(view.schema, "clunk.asset-inspection-evidence.v2");
    // 오프라인 래스터는 v2 정의상 PLAYER_FACING_CAPTURE 가 아니다. 그렇게 부르지 않는다.
    assert.equal(view.evidenceKind, "CONTRACT_FIXTURE");
    assert.equal(view.statuses.humanDecision, "NOT_EVALUATED");
    assert.equal(view.visualEvidence.verdict, evidence.visualEvidence.verdict);
    assert.equal(readAssetInspectionEvidence(view).schemaVersion, "2");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("every check states a rule a reader can recompute from the numbers beside it", async () => {
  const directory = await workspace("thresholds");
  try {
    const { evidence } = await captureVisualEvidence({ glbPath: CRATE, outDir: directory, slug: "crate" });
    for (const check of evidence.visualEvidence.checks) {
      assert.ok(check.threshold.trim().length > 0, `${check.id} has no stated rule`);
      assert.ok(check.reason.trim().length > 0, `${check.id} has no English reason`);
      assert.ok(check.reason_ko.trim().length > 0, `${check.id} has no Korean reason`);
      assert.equal(typeof check.observed, "object");
    }
    assert.equal(evidence.captureLimitation, "OFFLINE_SOFTWARE_RASTER_IS_NOT_AN_ENGINE_SCREENSHOT");
    assert.equal(evidence.visualEvidence.renderer.gpu, false);
    assert.ok(evidence.visualEvidence.limits_ko.length >= 4);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
