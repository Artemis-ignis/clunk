#!/usr/bin/env node
/**
 * 정점에 들어 있는 색을 작은 색표 그림 한 장으로 옮긴다.
 *
 * 왜 필요한가. 우리 3D 상품 20개 중 16개는 색이 전부 정점(COLOR_0)에 들어 있고 텍스처가
 * 하나도 없다. 정점 색을 읽는 셰이더에서는 제대로 나오지만, Unity URP 의 기본 Lit 처럼
 * 정점 색을 안 읽는 재질에 넣으면 색이 통째로 사라져 흰 덩어리가 된다. 산 사람은 상품
 * 페이지에서 본 것과 다른 것을 보게 된다.
 *
 * 어떻게 옮기나. 이 파일들은 삼각형 하나가 한 가지 색으로만 칠해져 있고(트랙터는
 * 58,156개 전부), 색 종류도 적다(28가지). 그래서 색을 가로로 늘어놓은 아주 작은 그림을
 * 만들고, 각 꼭짓점이 자기 색 칸을 가리키는 좌표(UV)를 붙이면 된다. 확대·축소 방식을
 * NEAREST(가장 가까운 픽셀 그대로)로 두면 옆 칸 색이 섞이지 않아 원본과 정확히 같은
 * 색이 나온다.
 *
 * 색 공간. glTF 는 COLOR_0 를 선형(linear)으로, baseColorTexture 를 sRGB 로 읽는다.
 * 그래서 그림에 넣을 때 선형→sRGB 로 바꿔 준다. 이걸 빠뜨리면 전체가 어두워진다.
 *
 * 꼭짓점을 쪼갤 필요는 없다. COLOR_0 는 꼭짓점마다 색이 하나뿐이라, 색 경계에서는 이미
 * 파일이 꼭짓점을 나눠 두었다.
 *
 * 사용: node scripts/bake-vertex-colour-palette.mjs <입력.glb> <출력.glb>
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

/** 선형 → sRGB. glTF 명세의 변환식 그대로. */
function linearToSrgb(v) {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  process.stderr.write("사용: node scripts/bake-vertex-colour-palette.mjs <입력.glb> <출력.glb>\n");
  process.exit(2);
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(input);

// 1) 쓰이는 색을 전부 모은다. 8비트로 세는 이유는 COLOR_0 자체가 8비트라서다.
const index = new Map(); // "r,g,b" -> 색표에서의 자리
const order = [];
const primitives = [];
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const col = prim.getAttribute("COLOR_0");
    if (!col) continue;
    primitives.push(prim);
    for (let i = 0; i < col.getCount(); i++) {
      const c = col.getElement(i, [0, 0, 0]);
      const key = `${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)}`;
      if (!index.has(key)) {
        index.set(key, order.length);
        order.push(key);
      }
    }
  }
}
if (!order.length) {
  process.stderr.write("정점 색이 없는 파일입니다. 옮길 것이 없습니다.\n");
  process.exit(1);
}

// 2) 색표 그림. 가로 한 줄로 두고, 그래픽 카드가 편하도록 2의 거듭제곱으로 넓힌다.
const width = Math.max(2, 2 ** Math.ceil(Math.log2(order.length)));
const px = Buffer.alloc(width * 4, 0);
order.forEach((key, i) => {
  const [r, g, b] = key.split(",").map(Number);
  px[i * 4 + 0] = Math.round(linearToSrgb(r / 255) * 255);
  px[i * 4 + 1] = Math.round(linearToSrgb(g / 255) * 255);
  px[i * 4 + 2] = Math.round(linearToSrgb(b / 255) * 255);
  px[i * 4 + 3] = 255;
});
// 남는 칸은 마지막 색으로 채운다. 비워 두면 좌표가 조금만 어긋나도 투명이 새어 나온다.
for (let i = order.length; i < width; i++) px.copy(px, i * 4, (order.length - 1) * 4, order.length * 4);
const png = await sharp(px, { raw: { width, height: 1, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();

const texture = doc.createTexture("palette").setImage(png).setMimeType("image/png");

// 3) 꼭짓점마다 자기 색 칸을 가리키는 좌표를 붙이고, 정점 색은 뗀다.
let vertices = 0;
for (const prim of primitives) {
  const col = prim.getAttribute("COLOR_0");
  const n = col.getCount();
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const c = col.getElement(i, [0, 0, 0]);
    const key = `${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)}`;
    uv[i * 2 + 0] = (index.get(key) + 0.5) / width; // 칸 한가운데를 찍는다
    uv[i * 2 + 1] = 0.5;
  }
  prim.setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(uv));
  prim.setAttribute("COLOR_0", null);
  vertices += n;
}

// 4) 모든 재질이 이 색표를 보게 한다. NEAREST 로 둬야 옆 칸 색이 섞이지 않는다.
for (const mat of doc.getRoot().listMaterials()) {
  mat.setBaseColorTexture(texture);
  mat.getBaseColorTextureInfo()
    .setMagFilter(9728)   // NEAREST
    .setMinFilter(9728)   // NEAREST — 밉맵을 만들지 않는다
    .setWrapS(33071)      // CLAMP_TO_EDGE
    .setWrapT(33071);
}

await io.write(output, doc);

const before = (await import("node:fs")).statSync(input).size;
const after = (await import("node:fs")).statSync(output).size;
process.stdout.write(
  `색 ${order.length}가지 → ${width}×1 색표 (PNG ${png.length}B)\n` +
  `좌표 붙인 꼭짓점 ${vertices.toLocaleString("ko-KR")}개 · 부품 ${primitives.length}개 · 재질 ${doc.getRoot().listMaterials().length}개\n` +
  `${before.toLocaleString("ko-KR")}B → ${after.toLocaleString("ko-KR")}B (${after > before ? "+" : ""}${(((after - before) / before) * 100).toFixed(1)}%)\n`,
);
