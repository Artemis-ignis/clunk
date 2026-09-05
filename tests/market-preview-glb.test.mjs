import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { Document, NodeIO } from "@gltf-transform/core";

import { TINY_BYTES, buildPreview, previewNameOf } from "../scripts/market-preview-glb.mjs";

/**
 * 미리보기 굽기가 약속한 것을 실제로 지키는지 본다.
 *
 * 약속은 셋이다 — 삼각형이 줄어든다, 움직임(클립)은 남는다, 같은 입력에 같은 바이트가
 * 나온다. 셋 중 하나라도 깨지면 로그인하지 않은 방문자가 보는 화면이 거짓이 되거나
 * (움직임이 사라진 모델), 문이 있으나 마나가 된다(판매본과 같은 파일).
 *
 * 저장소에 이진 fixture 를 두지 않고 여기서 만든다. 만드는 규칙이 코드에 적혀 있어야
 * 나중에 이 테스트가 무엇을 재는지 읽을 수 있다.
 */

/**
 * 격자 평면 하나와 회전 클립 하나를 가진 GLB.
 *
 * 격자여야 하는 이유: simplify 는 이어 붙은 면끼리만 접을 수 있다. 면이 서로 떨어진
 * 모델은 줄일 것이 없다고 답한다(실제로 우리 저폴리곤 상품 여럿이 그렇다).
 */
async function gridGlb(side = 60) {
  const document = new Document();
  const buffer = document.createBuffer();
  const positions = [];
  const normals = [];
  for (let row = 0; row <= side; row += 1) {
    for (let column = 0; column <= side; column += 1) {
      const x = column / side - 0.5;
      const z = row / side - 0.5;
      // 평평한 판이면 simplify 가 통째로 접어 버린다. 물결을 넣어 모양을 지키게 한다.
      positions.push(x, Math.sin(x * 9) * Math.cos(z * 7) * 0.12, z);
      normals.push(0, 1, 0);
    }
  }
  const indices = [];
  for (let row = 0; row < side; row += 1) {
    for (let column = 0; column < side; column += 1) {
      const a = row * (side + 1) + column;
      const b = a + 1;
      const c = a + side + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const primitive = document.createPrimitive()
    .setAttribute("POSITION", document.createAccessor().setType("VEC3").setArray(new Float32Array(positions)).setBuffer(buffer))
    .setAttribute("NORMAL", document.createAccessor().setType("VEC3").setArray(new Float32Array(normals)).setBuffer(buffer))
    .setIndices(document.createAccessor().setType("SCALAR").setArray(new Uint32Array(indices)).setBuffer(buffer))
    .setMaterial(document.createMaterial("paint").setBaseColorFactor([0.4, 0.7, 0.5, 1]));
  const mesh = document.createMesh("field").addPrimitive(primitive);
  const node = document.createNode("field").setMesh(mesh);
  document.createScene("scene").addChild(node);

  const input = document.createAccessor().setType("SCALAR").setArray(new Float32Array([0, 0.5, 1])).setBuffer(buffer);
  const output = document.createAccessor().setType("VEC4")
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0.707, 0, 0.707, 0, 0, 0, 1]))
    .setBuffer(buffer);
  const sampler = document.createAnimationSampler().setInput(input).setOutput(output).setInterpolation("LINEAR");
  const channel = document.createAnimationChannel().setTargetNode(node).setTargetPath("rotation").setSampler(sampler);
  document.createAnimation("turn").addSampler(sampler).addChannel(channel);

  return Buffer.from(await new NodeIO().writeBinary(document));
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("미리보기 이름은 판매 파일 이름에 접두를 붙인다", () => {
  assert.equal(previewNameOf("h145.glb"), "preview-h145.glb");
  assert.equal(previewNameOf("fence-gate.m1.clunk-optimized.glb"), "preview-fence-gate.m1.clunk-optimized.glb");
  // 이미 미리보기인 파일을 다시 구워도 이름이 겹겹이 쌓이지 않는다.
  assert.equal(previewNameOf("preview-h145.glb"), "preview-h145.glb");
});

test("미리보기는 삼각형을 줄이고 움직임은 남긴다", async () => {
  const sale = await gridGlb();
  assert.ok(sale.byteLength > TINY_BYTES, "이 시험용 파일은 20KB 를 넘어야 굽는 길로 간다");
  const preview = await buildPreview(sale);

  assert.equal(preview.equalsSale, false);
  assert.ok(
    preview.trianglesAfter <= preview.trianglesBefore * 0.4,
    `삼각형이 40% 이하로 줄어야 합니다: ${preview.trianglesBefore} → ${preview.trianglesAfter}`,
  );
  assert.equal(preview.clips, 1, "움직임은 미리보기에 그대로 남는다");
  assert.ok(preview.bytes.byteLength < sale.byteLength);
  assert.notEqual(sha256(preview.bytes), sha256(sale), "미리보기는 판매본과 다른 파일이어야 한다");

  // 파일이 스스로 미리보기라고 말한다. 그래야 이것을 게임에 넣은 사람이 알아차린다.
  const document = await new NodeIO().readBinary(new Uint8Array(preview.bytes));
  const root = document.getRoot();
  assert.equal(root.getAsset().extras.clunkPreview, true);
  assert.equal(root.getAsset().extras.sourceSha256, sha256(sale));
  assert.ok(root.getAsset().extras.triangleRatio <= 0.4);
  assert.equal(root.listAnimations().length, 1);
  assert.equal(root.listAnimations()[0].getName(), "turn");
  // 압축 확장을 요구하지 않는다 — 아무 엔진에서나 열려야 한다.
  assert.deepEqual(root.listExtensionsRequired().map((extension) => extension.extensionName), []);
});

test("같은 판매 파일에서 같은 미리보기가 나온다", async () => {
  const sale = await gridGlb(24);
  const first = await buildPreview(sale);
  const second = await buildPreview(sale);
  assert.equal(sha256(first.bytes), sha256(second.bytes));
});

test("20KB 이하의 파일은 미리보기가 판매본과 같다고 적는다", async () => {
  const sale = await gridGlb(6);
  assert.ok(sale.byteLength <= TINY_BYTES, "이 시험용 파일은 20KB 이하여야 한다");
  const preview = await buildPreview(sale);
  assert.equal(preview.equalsSale, true, "숨기지 않고 같다고 말한다");
  assert.equal(sha256(preview.bytes), sha256(sale));
});
