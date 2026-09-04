#!/usr/bin/env node
/**
 * 정점에 들어 있는 색을 작은 색표 그림 한 장으로 옮긴다.
 *
 * 왜 필요한가. 우리 3D 상품 20개 중 16개는 색이 전부 정점(COLOR_0)에 들어 있고 텍스처가
 * 하나도 없다. 정점 색을 읽는 셰이더에서는 제대로 나오지만, Unity URP 의 기본 Lit 처럼
 * 정점 색을 안 읽는 재질에 넣으면 색이 통째로 사라져 흰 덩어리가 된다. 산 사람은 상품
 * 페이지에서 본 것과 다른 것을 보게 된다.
 *
 * 어떻게 옮기나. 색을 네모난 작은 그림에 한 칸씩 늘어놓고, 각 꼭짓점이 자기 색 칸을
 * 가리키는 좌표(UV)를 붙인다. 확대·축소 방식을 NEAREST(가장 가까운 픽셀 그대로)로 두면
 * 옆 칸 색이 섞이지 않아 원본과 같은 색이 나온다.
 *
 * 삼각형 안에서 색이 섞이면(세 꼭짓점 색이 서로 다르면) 이 방법을 쓸 수 없다. 칸을
 * 가리키는 좌표가 삼각형 안에서 이어져 변하며 엉뚱한 칸을 훑기 때문이다. 그런 파일은
 * 손대지 않고 중단한다.
 *
 * 색 공간. glTF 는 COLOR_0 를 선형(linear)으로, baseColorTexture 를 sRGB 로 읽는다.
 * 그래서 그림에 넣을 때 선형→sRGB 로 바꿔 준다. 이걸 빠뜨리면 전체가 어두워진다.
 *
 * 색을 묶는 기준은 "그림에 실제로 저장될 sRGB 값"이다. 정점 색이 float32 인 파일이 있어
 * (cozy 계열) 8비트로 반올림해 묶으면 서로 다른 색이 한 칸을 나눠 쓰게 되고, 그만큼
 * 색이 어긋난다. 저장될 값으로 묶으면 칸을 나눠 쓰는 색은 애초에 구분되지 않는 색뿐이고,
 * 어긋나는 양은 8비트 반올림 한계(sRGB 0.5칸) 안에 들어온다.
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

/** 선형 → sRGB 8비트. glTF 명세의 변환식 그대로. */
const toSrgb8 = (v) =>
  Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055) * 255);

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  process.stderr.write("사용: node scripts/bake-vertex-colour-palette.mjs <입력.glb> <출력.glb>\n");
  process.exit(2);
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(input);

// 0) 안전장치. 이미 텍스처를 쓰는 파일이면 좌표를 덮어쓰는 순간 그 텍스처가 엉뚱한
//    자리를 가리키게 된다. 그런 파일은 손대지 않는다.
const existingTextures = doc.getRoot().listTextures().length;
if (existingTextures > 0) {
  process.stderr.write(
    `이미 텍스처가 ${existingTextures}개 있는 파일입니다. 좌표를 덮어쓰면 그 텍스처가 깨지므로 중단합니다.\n`,
  );
  process.exit(1);
}

// 1) 쓰이는 색을 모으고, 동시에 삼각형 안에서 색이 섞이는지 본다.
const index = new Map(); // "r,g,b"(sRGB 8비트) -> 색표에서의 자리
const order = [];
const primitives = [];
let mixed = 0;
let triangles = 0;
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const col = prim.getAttribute("COLOR_0");
    if (!col) continue;
    primitives.push(prim);
    const keys = new Array(col.getCount());
    for (let i = 0; i < col.getCount(); i++) {
      const c = col.getElement(i, [0, 0, 0]);
      const key = `${toSrgb8(c[0])},${toSrgb8(c[1])},${toSrgb8(c[2])}`;
      keys[i] = key;
      if (!index.has(key)) {
        index.set(key, order.length);
        order.push(key);
      }
    }
    const idx = prim.getIndices();
    const n = idx ? idx.getCount() : col.getCount();
    triangles += n / 3;
    for (let i = 0; i < n; i += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => (idx ? idx.getScalar(i + k) : i + k));
      if (keys[a] !== keys[b] || keys[b] !== keys[c]) mixed++;
    }
  }
}
if (!order.length) {
  process.stderr.write("정점 색이 없는 파일입니다. 옮길 것이 없습니다.\n");
  process.exit(1);
}
if (mixed > 0) {
  process.stderr.write(
    `삼각형 ${mixed.toLocaleString("ko-KR")}개가 그라데이션입니다` +
      ` (전체 ${Math.round(triangles).toLocaleString("ko-KR")}개 중 ${((mixed / triangles) * 100).toFixed(1)}%).` +
      ` 색표 한 칸으로는 옮길 수 없어 중단합니다.\n`,
  );
  process.exit(1);
}

// 2) 색표 그림. 한 줄로 늘어놓으면 색이 많은 파일에서 폭이 4096까지 가 옛 기기가 못
//    받는다. 네모로 접고 그래픽 카드가 편하도록 한 변을 2의 거듭제곱으로 둔다.
const side = Math.max(2, 2 ** Math.ceil(Math.log2(Math.ceil(Math.sqrt(order.length)))));
const px = Buffer.alloc(side * side * 4, 0);
order.forEach((key, i) => {
  const [r, g, b] = key.split(",").map(Number);
  px[i * 4 + 0] = r;
  px[i * 4 + 1] = g;
  px[i * 4 + 2] = b;
  px[i * 4 + 3] = 255;
});
// 남는 칸은 마지막 색으로 채운다. 비워 두면 좌표가 조금만 어긋나도 투명이 새어 나온다.
for (let i = order.length; i < side * side; i++) px.copy(px, i * 4, (order.length - 1) * 4, order.length * 4);
const png = await sharp(px, { raw: { width: side, height: side, channels: 4 } })
  .png({ compressionLevel: 9 })
  .toBuffer();

const texture = doc.createTexture("palette").setImage(png).setMimeType("image/png");

// 3) 꼭짓점마다 자기 색 칸을 가리키는 좌표를 붙이고, 정점 색은 뗀다.
let vertices = 0;
const materials = new Set();
for (const prim of primitives) {
  const col = prim.getAttribute("COLOR_0");
  const n = col.getCount();
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const c = col.getElement(i, [0, 0, 0]);
    const at = index.get(`${toSrgb8(c[0])},${toSrgb8(c[1])},${toSrgb8(c[2])}`);
    uv[i * 2 + 0] = ((at % side) + 0.5) / side; // 칸 한가운데를 찍는다
    uv[i * 2 + 1] = (Math.floor(at / side) + 0.5) / side;
  }
  prim.setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(uv));
  prim.setAttribute("COLOR_0", null);
  vertices += n;
  const mat = prim.getMaterial();
  if (mat) materials.add(mat);
}

// 4) 색을 옮긴 부품이 쓰는 재질만 이 색표를 보게 한다. 좌표가 없는 부품의 재질까지
//    건드리면 그 부품이 엉뚱한 자리를 집는다. NEAREST 로 둬야 옆 칸이 섞이지 않는다.
for (const mat of materials) {
  mat.setBaseColorTexture(texture);
  mat.getBaseColorTextureInfo()
    .setMagFilter(9728)   // NEAREST
    .setMinFilter(9728)   // NEAREST — 밉맵을 만들지 않는다
    .setWrapS(33071)      // CLAMP_TO_EDGE
    .setWrapT(33071);
}

await io.write(output, doc);

const { statSync } = await import("node:fs");
const before = statSync(input).size;
const after = statSync(output).size;
process.stdout.write(
  `색 ${order.length}가지 → ${side}×${side} 색표 (PNG ${png.length}B)\n` +
    `좌표 붙인 꼭짓점 ${vertices.toLocaleString("ko-KR")}개 · 부품 ${primitives.length}개 · 재질 ${materials.size}개\n` +
    `${before.toLocaleString("ko-KR")}B → ${after.toLocaleString("ko-KR")}B (${after > before ? "+" : ""}${(((after - before) / before) * 100).toFixed(1)}%)\n`,
);
