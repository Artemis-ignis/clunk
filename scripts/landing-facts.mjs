#!/usr/bin/env node
/**
 * 첫 화면이 보여 주는 파일의 숫자를 그 파일에서 측정해 적어 둔다.
 *
 * 왜 필요한가. 첫 화면의 폴리곤 수와 용량이 코드에 손으로 박혀 있었다(page.tsx 의
 * FEATURED_MODEL·INSPECTED_MODEL). 2026-09-04 그 자리의 GLB 를 파는 트랙터로 갈면서
 * 숫자를 같이 못 고쳤고, 화면은 58,156 삼각형짜리 모델을 보여 주면서 "39,320개"라고
 * 적고 있었다. 이 가게가 팔겠다고 하는 바로 그 결함을 첫 화면이 저지르고 있었다.
 *
 * 손으로 적는 한 또 어긋난다. 파일에서 측정해 JSON 으로 내려놓고, 화면은 그것만 읽는다.
 * 각 항목에 파일 경로를 같이 적어 두는 것은 tests/listing-facts-truth.test.mjs 가 같은
 * 파일을 다시 측정해 이 값을 대조하기 위해서다 — 경로가 없으면 검사가 무엇을 열어야
 * 하는지 알 수 없다.
 *
 * 사용: node --import tsx scripts/landing-facts.mjs
 *       (packages/core 를 .ts 그대로 읽으므로 tsx 가 있어야 한다 — npm test 와 같은 방식)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { inspectAsset } from "../packages/core/src/index.ts";

const root = resolve(import.meta.dirname, "..");

/**
 * 첫 화면이 쓰는 파일들. 이름은 화면이 부르는 이름 그대로.
 *
 * 헬리콥터는 public/landing 으로 복사하지 않고 파는 자리(public/market)의 파일을 그대로
 * 가리킨다 — 2.8 MB 를 두 벌 두면 하나를 고칠 때 다른 하나가 낡는다. 섹션 01 이 보여 주는
 * 것이 "마켓에 올라와 있는 파일 그대로" 이므로 그 파일이어야 맞기도 하다.
 */
const FILES = {
  tractor: "public/landing/tractor.compact.m1.glb",
  helicopter: "public/market/clunk-heli-h145/h145.glb",
};

/**
 * 첫 화면 진열판 12칸. 칸마다 마켓의 실제 GLB 하나를 가리키고, 폴리곤 수는 그 파일에서
 * 측정한다. 전에는 page.tsx 에 손으로 적은 숫자였고 그중 하나(농산물 상자 782)가 이미
 * 파일(882)과 어긋나 있었다. 이미지는 public/landing/showcase/<slug>.webp.
 */
const TILES = [
  { slug: "market-stall", listing: "cozy-market-stall", name: "시장 노점", path: "public/market/cozy-market-stall/market-stall.m1.clunk-optimized.glb" },
  { slug: "greenhouse", listing: "cozy-greenhouse", name: "온실", path: "public/market/cozy-greenhouse/greenhouse.m1.clunk-optimized.glb" },
  { slug: "storage-shed", listing: "cozy-storage-shed", name: "창고 헛간", path: "public/market/cozy-storage-shed/storage-shed.m1.clunk-optimized.glb" },
  { slug: "haystack", listing: "cozy-haystack-full", name: "건초 더미", path: "public/market/cozy-haystack-full/haystack-full.clunk-optimized.glb" },
  { slug: "fence-gate", listing: "cozy-fence-gate", name: "울타리 게이트", path: "public/market/cozy-fence-gate/fence-gate.m1.clunk-optimized.glb" },
  { slug: "crate-produce", listing: "cozy-crate-produce", name: "농산물 상자", path: "public/market/cozy-crate-produce/crate-produce.clunk-optimized.glb" },
  { slug: "broadleaf-full", listing: "grove-tree-pack-vol1", name: "활엽수 · 라운드", path: "public/market/grove-tree-pack-vol1/broadleaf-round-full.glb" },
  { slug: "column-flame", listing: "grove-tree-pack-vol1", name: "활엽수 · 플레임", path: "public/market/grove-tree-pack-vol1/broadleaf-column-flame.glb" },
  { slug: "conifer-spire", listing: "grove-tree-pack-vol1", name: "침엽수 · 스파이어", path: "public/market/grove-tree-pack-vol1/conifer-spire.glb" },
  { slug: "broadleaf-forked", listing: "grove-tree-pack-vol1", name: "활엽수 · 포크", path: "public/market/grove-tree-pack-vol1/broadleaf-round-forked.glb" },
  { slug: "conifer-umbrella", listing: "grove-tree-pack-vol1", name: "침엽수 · 우산", path: "public/market/grove-tree-pack-vol1/conifer-umbrella.glb" },
  { slug: "crate-closed", listing: "cozy-crate-closed", name: "뚜껑 상자", path: "public/market/cozy-crate-closed/crate-closed.clunk-optimized.glb" },
];

function measureTriangles(path) {
  const bytes = readFileSync(resolve(root, path));
  const name = path.split("/").pop();
  const report = inspectAsset({ entry: name, files: new Map([[name, new Uint8Array(bytes)]]) });
  const triangles = report?.metrics?.triangleCount;
  if (typeof triangles !== "number") throw new Error();
  return { name, bytes, triangles };
}
/** 웹 게임 권장 상한. packages/core 의 harvest-frontier-web-three 프로필과 같은 값이다. */
const FACE_LIMIT = 40000;

const facts = {};
for (const [key, path] of Object.entries(FILES)) {
  const bytes = readFileSync(resolve(root, path));
  const name = path.split("/").pop();
  const report = inspectAsset({ entry: name, files: new Map([[name, new Uint8Array(bytes)]]) });
  const triangles = report?.metrics?.triangleCount;
  if (typeof triangles !== "number") throw new Error(`${path} 의 형상을 읽지 못했습니다`);
  facts[key] = {
    fileName: name,
    path,
    triangles,
    bytes: bytes.byteLength,
    faceLimit: FACE_LIMIT,
    limitPercent: Math.round((triangles / FACE_LIMIT) * 100),
  };
  console.log(`${key.padEnd(10)} ${name} · 폴리곤 ${triangles.toLocaleString("ko-KR")} · ${(bytes.byteLength / 1024).toFixed(0)}KB · 상한의 ${facts[key].limitPercent}%`);
}

const tiles = TILES.map((tile) => {
  const { bytes, triangles } = measureTriangles(tile.path);
  console.log(`${("tile:" + tile.slug).padEnd(22)} 폴리곤 ${triangles.toLocaleString("ko-KR")}`);
  return { ...tile, triangles, bytes: bytes.byteLength };
});

const out = resolve(root, "app/data/landing-facts.json");
writeFileSync(out, `${JSON.stringify({ schema: "clunk.landing-facts.v1", generatedAt: new Date().toISOString(), facts, tiles }, null, 2)}\n`, "utf8");
console.log(`→ ${relative(root, out)}`);
