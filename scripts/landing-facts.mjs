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

import { formatBytes } from "../app/components/listing-facts-rows.ts";
import { gltfClipLabel } from "../app/components/review/gltf-clip-labels.ts";
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
  // 2026-09-05 점검 M4: 첫 화면이 "파일 크기 578.4 KB" 라 적고 상품 화면은 같은 이름의
  // 파일을 "1.5 MB" 라 적고 있었다. 뷰어가 여는 것은 가볍게 만든 사본(public/landing)
  // 이지만, 방문자가 읽는 숫자는 실제로 받게 되는 파일의 것이어야 한다. 그래서 재는
  // 대상만 파는 자리의 원본으로 옮긴다 — 뷰어가 여는 파일은 그대로다.
  tractor: "public/market/hf-tractor-compact/tractor.compact.m1.glb",
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

/**
 * /agents 의 다섯 칸("에이전트가 부르면 이 흐름으로 들어옵니다").
 *
 * 이 자리는 CSS 로 그린 그림 네 개였다 — 가짜 캐릭터, 가짜 격자, 막대 인간, 가짜 파형.
 * 다섯 종류를 다룬다고 말하면서 정작 다루는 파일은 한 칸(트랙터)에만 있었다. 칸마다
 * 마켓에 실제로 올라와 있는 파일을 보여 주고, 그 밑줄의 숫자는 여기서 상품 기록
 * (app/data/listing-facts.json)에서 옮겨 적는다. 화면은 옮겨 적은 것만 읽는다.
 *
 * `factsSlug` 는 숫자를 가져올 상품이 그림의 상품과 다를 때만 쓴다 — 애니메이션 클립 칸은
 * 프레임으로 구운 시트를 보여 주지만, 그 동작의 이름과 길이는 원본 3D 상품이 갖고 있다.
 */
const FAMILIES = [
  {
    kind: "sprite",
    slug: "tex-grass-meadow-v1",
    name: "초원 잔디 타일",
    aria: "초원 잔디 타일, 에셋 마켓에 있는 텍스처",
    image: "public/market/tex-grass-meadow-v1/preview-tex-grass-meadow-v1.webp",
    fit: "cover",
  },
  {
    kind: "atlas",
    slug: "cozy-market-stall-sprites",
    name: "시장 노점 8방향",
    aria: "농부 걷기, 에셋 마켓에 있는 스프라이트 시트",
    image: "public/market/cozy-market-stall-sprites/market-stall.m1.clunk-optimized.sheet.card.png",
    fit: "contain",
  },
  {
    kind: "motion",
    slug: "cozy-fence-gate-swing-sprites",
    factsSlug: "cozy-fence-gate",
    name: "울타리 문",
    aria: "울타리 문 여닫기, 에셋 마켓에 있는 애니메이션 클립 시트",
    image: "public/market/cozy-fence-gate-swing-sprites/fence-gate.m1.clunk-optimized.sheet.card.png",
    fit: "contain",
  },
  {
    kind: "model",
    slug: "hf-tractor-compact",
    name: "소형 트랙터",
    aria: "소형 트랙터, 에셋 마켓에 있는 3D 모델",
    image: "public/landing/tractor-hero.png",
    // 이 칸의 숫자만 파일에서 직접 측정한다. 첫 화면이 쓰는 그 GLB 다.
    measure: "public/landing/tractor.compact.m1.glb",
    fit: "contain",
  },
];

/**
 * 그림 파일의 픽셀 크기를 파일 머리에서 읽는다.
 *
 * 화면이 next/image 에 넘길 width·height 이고, tests/listing-facts-truth.test.mjs 가
 * 같은 파일을 다시 열어 대조하는 값이기도 하다. 라이브러리를 쓰지 않는 것은 이 숫자가
 * 두 곳에서 서로 다른 코드로 나와야 대조가 되기 때문이다.
 */
function readImageSize(path) {
  const b = readFileSync(path);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.length > 16 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    let offset = 12;
    while (offset + 8 <= b.length) {
      const type = b.toString("ascii", offset, offset + 4);
      const size = b.readUInt32LE(offset + 4);
      const data = offset + 8;
      if (type === "VP8X") return [(b.readUIntLE(data + 4, 3) + 1), (b.readUIntLE(data + 7, 3) + 1)];
      if (type === "VP8 ") return [b.readUInt16LE(data + 6) & 0x3fff, b.readUInt16LE(data + 8) & 0x3fff];
      if (type === "VP8L") {
        const bits = b.readUInt32LE(data + 1);
        return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
      }
      offset = data + size + (size & 1);
    }
  }
  throw new Error(`${path} 의 픽셀 크기를 읽지 못했습니다`);
}

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

/** 상품 기록. 다섯 칸의 숫자는 전부 여기서 옮겨 적는다. */
const listingFacts = JSON.parse(readFileSync(resolve(root, "app/data/listing-facts.json"), "utf8"));
const registry = listingFacts.facts ?? listingFacts;

/** 칸 하나의 숫자와 그 밑에 적을 한 줄. 숫자는 상품 기록에서, 말투는 상품 카드와 같게. */
function familyNumbers(family, fact, numbersFact) {
  if (family.kind === "sprite") {
    const texture = fact.texture;
    if (!texture?.resolution) throw new Error(`${family.slug} 에 텍스처 해상도가 없습니다`);
    return {
      numbers: { resolution: texture.resolution, byteLength: fact.byteLength, format: fact.format },
      caption: `${texture.resolution} · ${fact.format} ${formatBytes(fact.byteLength)}`,
    };
  }
  if (family.kind === "atlas" || family.kind === "motion") {
    const sheet = fact.sheet;
    if (!sheet?.cell || !sheet?.directions) throw new Error(`${family.slug} 에 시트 격자가 없습니다`);
    if (family.kind === "atlas") {
      // 돌려 찍은 시트(8방향 × 1장)는 프레임 수가 없다. 있는 것만 적는다.
      return {
        numbers: { cell: sheet.cell, directions: sheet.directions, frames: sheet.frames ?? null },
        caption: sheet.frames
          ? `${sheet.cell}×${sheet.cell} · ${sheet.directions}방향 × ${sheet.frames}프레임`
          : `${sheet.cell}×${sheet.cell} · ${sheet.directions}방향`,
      };
    }
    if (!sheet.frames) throw new Error(`${family.slug} 에 프레임 수가 없습니다`);
    // 동작의 이름과 길이는 이 시트를 구워 낸 원본 3D 상품이 갖고 있다.
    const clip = numbersFact.animations?.[0];
    if (!clip) throw new Error(`${family.factsSlug} 에 동작이 없습니다`);
    return {
      numbers: { clipSlug: family.factsSlug, clip: clip.name, seconds: clip.seconds, frames: sheet.frames },
      caption: `${gltfClipLabel(clip.name)} ${clip.seconds.toFixed(1)}초 · ${sheet.frames}프레임`,
    };
  }
  if (family.kind === "spine") {
    return {
      numbers: { clips: fact.animations.length, parts: fact.animatedParts.length },
      caption: `동작 ${fact.animations.length}개 · 움직이는 부품 ${fact.animatedParts.length}개`,
    };
  }
  // 3D 모델 칸만 파일을 직접 열어 측정한다. 그 값이 상품 기록과 같은지는 검사가 본다.
  const name = family.measure.split("/").pop();
  const bytes = readFileSync(resolve(root, family.measure));
  const metrics = inspectAsset({ entry: name, files: new Map([[name, new Uint8Array(bytes)]]) })?.metrics;
  if (typeof metrics?.triangleCount !== "number") throw new Error(`${family.measure} 의 형상을 읽지 못했습니다`);
  const numbers = {
    path: family.measure,
    triangles: metrics.triangleCount,
    materials: metrics.materialCount,
    clips: metrics.animationCount,
  };
  return {
    numbers,
    caption: `폴리곤 ${numbers.triangles.toLocaleString("ko-KR")}개 · 재질 ${numbers.materials}개 · 동작 ${numbers.clips}개`,
  };
}

const families = {};
for (const family of FAMILIES) {
  const fact = registry[family.slug];
  if (!fact) throw new Error(`${family.slug} 이 app/data/listing-facts.json 에 없습니다`);
  const numbersFact = family.factsSlug ? registry[family.factsSlug] : fact;
  if (!numbersFact) throw new Error(`${family.factsSlug} 이 app/data/listing-facts.json 에 없습니다`);
  const [imageWidth, imageHeight] = readImageSize(resolve(root, family.image));
  const { numbers, caption } = familyNumbers(family, fact, numbersFact);
  families[family.kind] = {
    slug: family.slug,
    name: family.name,
    aria: family.aria,
    image: `/${family.image.replace(/^public\//, "")}`,
    imagePath: family.image,
    imageWidth,
    imageHeight,
    fit: family.fit,
    caption,
    numbers,
  };
  console.log(`${("family:" + family.kind).padEnd(22)} ${family.slug} · ${caption}`);
}

const out = resolve(root, "app/data/landing-facts.json");
writeFileSync(out, `${JSON.stringify({ schema: "clunk.landing-facts.v1", generatedAt: new Date().toISOString(), facts, tiles, families }, null, 2)}\n`, "utf8");
console.log(`→ ${relative(root, out)}`);
