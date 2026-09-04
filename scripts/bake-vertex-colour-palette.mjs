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
 * 가리키는 좌표가 삼각형 안에서 이어져 변하며 엉뚱한 칸을 훑기 때문이다. 그런 부품은
 * 정점 색인 채로 둔다.
 *
 * 파일 전체를 중단하지 않고 부품 단위로 건너뛰는 이유. 헬리콥터(H145)는 삼각형 85,150개
 * 중 1,984개(2.3%)만 그라데이션이고 그것이 전부 실내 재질 하나에 몰려 있었다. 전체를
 * 중단하면 동체 도장 35,924개 삼각형 — 정점 색을 안 읽는 셰이더에서 통째로 흰색이 되는
 * 바로 그 부분 — 이 그대로 남는다. 하나 때문에 나머지를 포기할 이유가 없다.
 *
 * 다만 재질은 부품이 나눠 쓴다. 옮긴 부품의 재질에 색표를 달면 그 재질을 같이 쓰는
 * 안 옮긴 부품은 좌표가 없어 엉뚱한 자리를 집는다. 그래서 한 재질을 옮긴 부품과 안 옮긴
 * 부품이 나눠 쓰면 그 재질은 통째로 손대지 않는다.
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
 * 이미 있는 UV 는 덮지 않는다. 텍스처가 없어도 UV 는 있을 수 있고(H145 가 그랬다),
 * 그것은 산 사람이 자기 그림을 입힐 때 쓰는 지도다. 덮으면 그 지도를 없애는 것이므로
 * 색표는 두 번째 자리(TEXCOORD_1)에 넣고 재질이 그 자리를 보게 한다.
 *
 * 떼어 낸 정점 색은 파일에서 지운다. gltf-transform 은 부품에서 뗀 자료를 문서에 그대로
 * 두기 때문에, 지우지 않으면 아무도 안 쓰는 정점 색이 파일에 남아 산 사람이 계속
 * 내려받는다. 먼저 구운 12개가 그랬다 — 트랙터에만 고아 자료가 16개 남아 있었다.
 *
 * 사용: node scripts/bake-vertex-colour-palette.mjs <입력.glb> <출력.glb>
 */
import { deflateSync } from "node:zlib";

import { NodeIO, PropertyType } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

/** 선형 → sRGB 8비트. glTF 명세의 변환식 그대로. */
const toSrgb8 = (v) =>
  Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055) * 255);

/**
 * RGBA 픽셀을 PNG 한 장으로. sharp 를 안 쓰는 이유는 취향이 아니라 충돌이다 —
 * `@gltf-transform/functions` 를 불러오면 sharp 의 raw 픽셀 경로가 libvips 안에서
 * 깨진다("colourspace: parameter space not set"). 색표는 몇십 바이트라 직접 쓰는 편이
 * 의존성 하나를 빼면서도 결과가 같다.
 */
function encodePng(rgba, width, height) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, body) => {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(body.length, 0);
    const name = Buffer.from(type, "ascii");
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc32(Buffer.concat([name, body])), 0);
    return Buffer.concat([head, name, body, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 채널당 8비트
  ihdr[9] = 6; // 트루컬러 + 알파
  // 줄마다 앞에 필터 번호 0(안 걸었음)을 붙이는 것이 PNG 규격이다.
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
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

// 0) 안전장치. 이미 텍스처를 쓰는 파일이면 좌표를 덮어쓰는 순간 그 텍스처가 엉뚱한
//    자리를 가리키게 된다. 그런 파일은 손대지 않는다.
const existingTextures = doc.getRoot().listTextures().length;
if (existingTextures > 0) {
  process.stderr.write(
    `이미 텍스처가 ${existingTextures}개 있는 파일입니다. 좌표를 덮어쓰면 그 텍스처가 깨지므로 중단합니다.\n`,
  );
  process.exit(1);
}

// 1) 부품마다 색을 모으고, 삼각형 안에서 색이 섞이는지 본다.
const scanned = []; // { prim, keys, gradient, triangles }
let triangles = 0;
let mixed = 0;
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const col = prim.getAttribute("COLOR_0");
    if (!col) continue;
    const keys = new Array(col.getCount());
    for (let i = 0; i < col.getCount(); i++) {
      const c = col.getElement(i, [0, 0, 0]);
      keys[i] = `${toSrgb8(c[0])},${toSrgb8(c[1])},${toSrgb8(c[2])}`;
    }
    const idx = prim.getIndices();
    const n = idx ? idx.getCount() : col.getCount();
    let gradient = 0;
    for (let i = 0; i < n; i += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => (idx ? idx.getScalar(i + k) : i + k));
      if (keys[a] !== keys[b] || keys[b] !== keys[c]) gradient++;
    }
    triangles += n / 3;
    mixed += gradient;
    // 이미 UV 가 있으면 색표는 두 번째 자리로 간다. 자리는 재질 단위로 하나여야 해서
    // 아래에서 재질별로 일치하는지 본다.
    scanned.push({ prim, keys, gradient, triangles: n / 3, slot: prim.getAttribute("TEXCOORD_0") ? 1 : 0 });
  }
}
if (!scanned.length) {
  process.stderr.write("정점 색이 없는 파일입니다. 옮길 것이 없습니다.\n");
  process.exit(1);
}

// 재질을 옮긴 부품과 안 옮긴 부품이 나눠 쓰면 색표를 달 수 없다. 재질이 없는 부품도
// 색표를 걸 자리가 없으니 같은 취급이다.
const blockedMaterials = new Set();
for (const entry of scanned) if (entry.gradient > 0 && entry.prim.getMaterial()) blockedMaterials.add(entry.prim.getMaterial());

// 한 재질을 쓰는 부품들이 색표를 서로 다른 자리에서 찾으면 재질은 한 자리밖에 못 가리킨다.
const slotsPerMaterial = new Map();
for (const entry of scanned) {
  const mat = entry.prim.getMaterial();
  if (!mat || entry.gradient > 0) continue;
  const seen = slotsPerMaterial.get(mat) ?? new Set();
  seen.add(entry.slot);
  slotsPerMaterial.set(mat, seen);
}
for (const [mat, slots] of slotsPerMaterial) if (slots.size > 1) blockedMaterials.add(mat);

const primitives = [];
const skipped = { gradient: 0, sharedMaterial: 0, noMaterial: 0, triangles: 0 };
for (const entry of scanned) {
  const mat = entry.prim.getMaterial();
  const why = !mat ? "noMaterial" : entry.gradient > 0 ? "gradient" : blockedMaterials.has(mat) ? "sharedMaterial" : null;
  if (why) {
    skipped[why] += 1;
    skipped.triangles += entry.triangles;
    continue;
  }
  primitives.push(entry);
}
if (!primitives.length) {
  process.stderr.write(
    `옮길 수 있는 부품이 하나도 없습니다 — 삼각형 ${mixed.toLocaleString("ko-KR")}개가 그라데이션입니다` +
      ` (전체 ${Math.round(triangles).toLocaleString("ko-KR")}개 중 ${((mixed / triangles) * 100).toFixed(1)}%).\n`,
  );
  process.exit(1);
}

// 남는 몫이 크면 옮기지 않는 편이 낫다. 색표가 붙는 순간 파일은 "색이 그림에 있다"고
// 말하게 되는데, 절반이 정점 색인 채로 남으면 그 말이 사는 사람을 속인다. 풍차가
// 그랬다 — 꼭짓점 26개만 옮겨지고 삼각형의 98.6%가 그대로 남았다.
const LEFT_LIMIT = 0.2;
if (skipped.triangles / triangles > LEFT_LIMIT) {
  process.stderr.write(
    `삼각형의 ${((skipped.triangles / triangles) * 100).toFixed(1)}% 가 정점 색인 채로 남습니다` +
      ` (한도 ${LEFT_LIMIT * 100}%). 색표를 달면 파일은 색이 그림에 있다고 말하는데 절반이 아니므로 중단합니다.\n`,
  );
  process.exit(1);
}

// 색표에 넣을 색은 옮기는 부품의 것만이다. 안 옮기는 부품의 색까지 넣으면 쓰지도 않을
// 칸이 늘어 색표가 커진다.
const index = new Map(); // "r,g,b"(sRGB 8비트) -> 색표에서의 자리
const order = [];
for (const { keys } of primitives)
  for (const key of keys)
    if (!index.has(key)) {
      index.set(key, order.length);
      order.push(key);
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
const png = encodePng(px, side, side);

const texture = doc.createTexture("palette").setImage(png).setMimeType("image/png");

// 3) 꼭짓점마다 자기 색 칸을 가리키는 좌표를 붙이고, 정점 색은 뗀다.
// 좌표는 부호 없는 16비트로 넣는다. 핵심 규격이 그대로 허용해서 확장이 늘지 않고,
// 32비트 실수의 절반만 쓴다. 반올림 오차는 최대 (0.5/65535)×side 칸이라 side 가 256이어도
// 0.002칸 — 칸 한가운데에서 0.5칸 떨어진 경계까지 한참 남는다.
if (side > 256) {
  process.stderr.write(`색표 한 변이 ${side}칸입니다. 16비트 좌표로는 칸을 정확히 못 짚어 중단합니다.\n`);
  process.exit(1);
}
const uvSlot = primitives[0].slot;
let vertices = 0;
const materials = new Set();
for (const { prim, keys, slot } of primitives) {
  const n = keys.length;
  const uv = new Uint16Array(n * 2);
  for (let i = 0; i < n; i++) {
    const at = index.get(keys[i]);
    const [col, row] = [at % side, Math.floor(at / side)];
    uv[i * 2 + 0] = Math.round(((col + 0.5) / side) * 65535); // 칸 한가운데를 찍는다
    uv[i * 2 + 1] = Math.round(((row + 0.5) / side) * 65535);
    // 16비트로 반올림한 좌표가 여전히 같은 칸을 짚는지 여기서 확인한다. 어긋나면 산 사람이
    // 옆 칸 색을 보게 되는데, 파일을 열어 보기 전에는 아무도 모른다.
    const picked = [0, 1].map((k) => Math.min(side - 1, Math.floor((uv[i * 2 + k] / 65535) * side)));
    if (picked[0] !== col || picked[1] !== row) {
      process.stderr.write(`좌표 반올림이 칸을 벗어났습니다 (색 ${at}, ${col},${row} → ${picked.join(",")}). 중단합니다.\n`);
      process.exit(1);
    }
  }
  prim.setAttribute(`TEXCOORD_${slot}`, doc.createAccessor().setType("VEC2").setArray(uv).setNormalized(true));
  prim.setAttribute("COLOR_0", null);
  vertices += n;
  materials.add(prim.getMaterial());
}

// 4) 색을 옮긴 부품이 쓰는 재질만 이 색표를 보게 한다. 좌표가 없는 부품의 재질까지
//    건드리면 그 부품이 엉뚱한 자리를 집는다. NEAREST 로 둬야 옆 칸이 섞이지 않는다.
for (const mat of materials) {
  mat.setBaseColorTexture(texture);
  mat.getBaseColorTextureInfo()
    .setTexCoord(uvSlot)  // 원래 있던 UV 를 덮지 않았다면 두 번째 자리다
    .setMagFilter(9728)   // NEAREST
    .setMinFilter(9728)   // NEAREST — 밉맵을 만들지 않는다
    .setWrapS(33071)      // CLAMP_TO_EDGE
    .setWrapT(33071);
}

// 5) 뗀 정점 색은 문서에도 남는다. 지우지 않으면 아무도 안 쓰는 자료를 산 사람이 받는다.
//    지우는 것은 자료(accessor)와 그 조각(bufferView)뿐이다 — 재질·노드·텍스처까지
//    건드리면 이 스크립트가 하기로 한 일보다 많은 일을 하게 된다.
await doc.transform(
  prune({
    propertyTypes: [PropertyType.ACCESSOR, PropertyType.BUFFER_VIEW],
    keepAttributes: true, // 산 사람이 자기 그림을 입힐 때 쓰는 원래 UV 를 지우지 않는다
    keepLeaves: true,
    keepSolidTextures: true,
    keepExtras: true,
  }),
);

await io.write(output, doc);

const { statSync } = await import("node:fs");
const before = statSync(input).size;
const after = statSync(output).size;
const left = skipped.gradient + skipped.sharedMaterial + skipped.noMaterial;
process.stdout.write(
  `색 ${order.length}가지 → ${side}×${side} 색표 (PNG ${png.length}B)\n` +
    `좌표 붙인 꼭짓점 ${vertices.toLocaleString("ko-KR")}개 · 부품 ${primitives.length}개 · 재질 ${materials.size}개\n` +
    `${before.toLocaleString("ko-KR")}B → ${after.toLocaleString("ko-KR")}B (${after > before ? "+" : ""}${(((after - before) / before) * 100).toFixed(1)}%)\n` +
    (left
      ? `정점 색인 채로 둔 부품 ${left}개` +
        ` (그라데이션 ${skipped.gradient}, 재질 공유 ${skipped.sharedMaterial}, 재질 없음 ${skipped.noMaterial})` +
        ` · 삼각형 ${Math.round(skipped.triangles).toLocaleString("ko-KR")}개` +
        ` (전체의 ${((skipped.triangles / triangles) * 100).toFixed(1)}%)\n` +
        `  이 부품은 정점 색을 안 읽는 셰이더에서 흰색으로 나옵니다. 상품 설명이 그 사실을 말해야 합니다.\n`
      : ""),
);
