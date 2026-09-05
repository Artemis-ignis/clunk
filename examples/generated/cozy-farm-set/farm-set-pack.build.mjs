#!/usr/bin/env node
/**
 * cozy-farm-set-vol1 이 팔려야 하는 파일 한 장을 만든다.
 *
 * 지금 팔고 있는 것은 상품 폴더에 GLB 세 개가 나란히 놓인 것이다:
 *
 *   fence-gate.m1.clunk-optimized.glb      520 삼각형 ·  6 재질 ·  47,960 바이트
 *   market-stall.m1.clunk-optimized.glb  2,456 삼각형 · 11 재질 · 215,248 바이트
 *   storage-shed.m1.clunk-optimized.glb  1,620 삼각형 ·  9 재질 · 138,020 바이트
 *
 * 그런데 상품 카드의 사양(app/data/listing-facts.json 의 cozy-farm-set-vol1)은
 * "2,456 삼각형 · 11 재질 · 215,248 바이트" 다 — 셋 중 **가판대 하나**의 값이다.
 * 사양이 파일과 다른 상태이고, 이 가게가 팔지 않겠다고 한 바로 그 상태다.
 *
 * grove-tree-pack-vol1 이 2026-09-04 에 같은 문제를 같은 방법으로 해결했다
 * (scripts/build-tree-pack.mjs). 여기도 그 방식을 따른다: 세 부재를 한 씬에 넣고
 * 각각 온 파일 이름을 딴 노드 아래에 두고, +X 방향으로 서로의 경계 상자가 1.5 m
 * 떨어지게 세운다. 각 부재는 제가 작성된 높이(y = 0 위아래)를 그대로 지킨다.
 * 세 낱개 파일은 지금처럼 옆에 그대로 남아 아티팩트로 팔린다.
 *
 *   node examples/generated/cozy-farm-set/farm-set-pack.build.mjs [out.glb]
 *
 * 기본 출력은 examples/generated/cozy-farm-set/cozy-farm-set-vol1.glb 이고,
 * public/market/cozy-farm-set-vol1/cozy-farm-set-vol1.glb 로도 함께 쓴다 —
 * listing-facts-cli 는 슬러그와 이름이 같은 파일을 엔트리로 고른다.
 */
import { readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { NodeIO } from "@gltf-transform/core";
import { dedup, prune } from "@gltf-transform/functions";

// GLTFExporter 는 GLB 를 쓸 때 DOM 의 FileReader 를 찾는다. scripts/hf-export/lib.mts
// 와 scripts/build-tree-pack.mjs 가 까는 것과 같은 대체물.
class NodeFileReader {
  result = null;
  onloadend = null;
  onerror = null;
  readAsArrayBuffer(blob) {
    void blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.(); })
      .catch((error) => this.onerror?.(error));
  }
}
if (typeof globalThis.FileReader === "undefined") Object.assign(globalThis, { FileReader: NodeFileReader });

const HERE = import.meta.dirname;
const ROOT = resolve(HERE, "../../..");
const MARKET = join(ROOT, "public/market/cozy-farm-set-vol1");
const OUT = resolve(process.argv[2] ?? join(HERE, "cozy-farm-set-vol1.glb"));
/** 상품 설명이 부르는 순서: 문 · 가판대 · 창고. */
const MEMBERS = [
  { slug: "cozy-fence-gate", file: "fence-gate.m1.clunk-optimized.glb", node: "cozy-fence-gate" },
  { slug: "cozy-market-stall", file: "market-stall.m1.clunk-optimized.glb", node: "cozy-market-stall" },
  { slug: "cozy-storage-shed", file: "storage-shed.m1.clunk-optimized.glb", node: "cozy-storage-shed" },
];
const GAP = 1.5;

async function load(file) {
  const bytes = await readFile(file);
  const array = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Promise((ok, fail) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.parse(array, "", ok, fail);
  });
}

/*
 * 세트 폴더는 세 부재의 GLB 를 제 사본으로 들고 있다. 그래서 낱개 상품
 * (public/market/cozy-storage-shed/ 같은 곳)을 고쳐도 세트에는 옛 파일이 남는다 —
 * 2026-09-05 실제로 그랬다: 창고를 고친 뒤에도 세트 안의 창고는 138,020 바이트짜리
 * 옛 파일이었다. 팩을 묶기 전에 낱개 쪽에서 다시 복사해 둘이 갈라질 수 없게 한다.
 */
const refreshed = [];
for (const member of MEMBERS) {
  /*
   * 여권도 같이 옮긴다. GLB 만 새로 복사하던 첫 판은 세트 폴더에 새 파일과 옛 여권을
   * 나란히 남겼다 — 2026-09-05 창고의 박공널을 고친 뒤 세트 안 창고 여권의
   * outputHash 는 a44b999a 인데 옆에 놓인 GLB 는 e1fee84a 였다. 증거 문서가 제 파일과
   * 다르면 증거가 아니고, 그 상태는 낱개 쪽에서만 고치면 세트에서 되살아난다.
   */
  for (const name of [member.file, `${member.file}.passport.json`]) {
    const from = await readFile(join(ROOT, "public/market", member.slug, name));
    const target = join(MARKET, name);
    let same = false;
    try { same = Buffer.compare(from, await readFile(target)) === 0; } catch { same = false; }
    if (!same) await writeFile(target, from);
    refreshed.push({ slug: member.slug, file: name, bytes: from.byteLength, copied: !same });
  }
}

const pack = new THREE.Group();
pack.name = "cozy-farm-set-vol1";
const placed = [];
let cursor = 0;
for (const member of MEMBERS) {
  const file = join(MARKET, member.file);
  const gltf = await load(file);
  const holder = new THREE.Group();
  holder.name = member.node;
  for (const child of [...gltf.scene.children]) holder.add(child);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const size = box.getSize(new THREE.Vector3());
  // 제 X 폭이 서는 자리를 정한다. 그래야 두 부재 사이가 원점 간격이 아니라 실제 공기 1.5 m 다.
  holder.position.x = cursor - box.min.x;
  pack.add(holder);
  holder.updateMatrixWorld(true);
  const worldBox = new THREE.Box3().setFromObject(holder);
  let triangles = 0;
  holder.traverse((n) => {
    if (!n.isMesh) return;
    const index = n.geometry.getIndex();
    triangles += (index ? index.count : n.geometry.getAttribute("position").count) / 3;
  });
  placed.push({
    slug: member.slug,
    node: holder.name,
    sourceFile: member.file,
    sourceBytes: (await readFile(file)).byteLength,
    triangles,
    sizeMetres: [size.x, size.y, size.z].map((v) => +v.toFixed(4)),
    standsAtXmetres: +worldBox.min.x.toFixed(4),
    lowestYmetres: +worldBox.min.y.toFixed(4),
  });
  cursor += size.x + GAP;
}
pack.updateMatrixWorld(true);

const exporter = new GLTFExporter();
const binary = await exporter.parseAsync(pack, { binary: true, onlyVisible: false, trs: true });
const staged = `${OUT}.staged.glb`;
await writeFile(staged, Buffer.from(binary));

// dedup + prune 만. 세 낱개 파일은 압축 확장 없는 평범한 glTF 이고, 팩도 그대로 둔다 —
// 낱개가 열리는 자리에서 팩도 그대로 열려야 한다.
const io = new NodeIO();
const document = await io.read(staged);
// 중간 파일은 읽는 즉시 지운다. 남겨 두면 세트 폴더 옆에 추적되지 않는 GLB 가 한 장 더 생긴다.
await unlink(staged);
await document.transform(dedup(), prune());
await io.write(OUT, document);
await writeFile(join(MARKET, "cozy-farm-set-vol1.glb"), await readFile(OUT));

const bytes = await readFile(OUT);
const total = new THREE.Box3().setFromObject(pack);
const size = total.getSize(new THREE.Vector3());
const materials = new Set();
pack.traverse((n) => { if (n.isMesh) (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => materials.add(m.uuid)); });
process.stdout.write(`${JSON.stringify({
  output: OUT,
  refreshedFromSlugs: refreshed,
  alsoWrote: join(MARKET, "cozy-farm-set-vol1.glb"),
  members: placed,
  memberCount: placed.length,
  triangles: placed.reduce((sum, m) => sum + m.triangles, 0),
  sourceBytesTotal: placed.reduce((sum, m) => sum + m.sourceBytes, 0),
  packBytes: bytes.byteLength,
  packSizeMetres: [size.x, size.y, size.z].map((v) => +v.toFixed(4)),
  packLowestYmetres: +total.min.y.toFixed(4),
  materialsInScene: materials.size,
  gapMetres: GAP,
}, null, 2)}\n`);
