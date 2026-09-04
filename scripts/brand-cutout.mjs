#!/usr/bin/env node
/**
 * 검은 바탕에 그려진 브랜드 그림에서 바탕을 빼고, 아이콘 한 벌을 다시 만든다.
 *
 * 왜 필요한가. 우리 마크는 검은 배경 위에 빛나는 그림으로 왔고, 그 상태로 파비콘에
 * 들어가 있었다. 브라우저 탭은 자기 색이 따로 있어서, 배경이 칠해진 아이콘은 탭 위에
 * 검은 네모로 앉는다 — 마크가 아니라 마크가 든 상자가 보인다.
 *
 * 어떻게 빼나. 문턱 하나로 자르면 빛나는 부분의 가장자리가 톱니로 남는다. 이 그림은
 * 어두운 데서 밝은 데로 이어지는 발광 그림이므로, 밝기(세 채널의 최댓값)를 그대로
 * 불투명도로 삼되 두 지점 사이에서만 이어 준다.
 *
 *   밝기 ≤ CLEAR  → 완전히 비침 (바탕)
 *   CLEAR..SOLID  → 그 사이를 부드럽게 (빛무리 꼬리)
 *   밝기 ≥ SOLID  → 그대로 (글자, 마크의 몸통)
 *
 * SOLID 를 낮게 두는 이유는, 글자의 어두운 옆면과 터짐 무늬 안쪽이 마크의 일부이지
 * 바탕이 아니기 때문이다. 밝기만으로 알파를 만들면 그 부분이 반투명해져서 흰 배경에서
 * 로고가 비어 보인다.
 *
 * 색은 건드리지 않는다. 검은 배경 위에 다시 올리면 원본과 같은 그림이 나와야 한다.
 *
 * 사용: node scripts/brand-cutout.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
/** 이 밝기 아래는 바깥으로 번져 갈 수 있는 바탕이다. 마크의 테두리는 이보다 훨씬 밝다. */
const FLOOD = 90;
/** 이 아래는 잡티다. 나누면 색이 터진다. */
const NOISE = 4;

/**
 * 검은 바탕을 빼고 RGBA 픽셀을 돌려준다.
 *
 * 두 영역을 다르게 다룬다.
 *
 * 바깥(가장자리에서 번져 닿는 어두운 자리)은 발광 그림으로 본다 — 불투명도를 밝기
 * 그대로 두고 색을 그만큼 되돌린다(un-premultiply). 그래서 구석의 밝기 6짜리 비네트는
 * 2% 만 남아 흰 배경에서도 안 보이고, 빛무리는 밝기만큼 남는다. 문턱 하나로 자르면
 * 이 비네트가 35% 짜리 회색 네모로 남는다 — 실제로 그렇게 나왔다.
 *
 * 안쪽(마크의 몸통)은 그대로 둔다. 글자의 어두운 옆면과 터짐 무늬 안쪽은 밝기가 낮아도
 * 바탕이 아니라 그림이라, 밝기로 알파를 매기면 흰 배경에서 로고가 비어 보인다.
 */
async function cutout(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const luma = new Uint8Array(width * height);
  for (let p = 0; p < luma.length; p += 1) {
    luma[p] = Math.max(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
  }

  // 가장자리에서 번져 나가며 바탕을 표시한다. 마크의 밝은 테두리에서 멈춘다.
  const outside = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x += 1) {
    stack.push(x, (height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    stack.push(y * width, y * width + width - 1);
  }
  while (stack.length) {
    const p = stack.pop();
    if (outside[p] || luma[p] >= FLOOD) continue;
    outside[p] = 1;
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - width);
    if (y < height - 1) stack.push(p + width);
  }

  let cleared = 0;
  for (let p = 0; p < luma.length; p += 1) {
    const i = p * 4;
    if (!outside[p]) continue; // 마크의 몸통은 그대로
    const value = luma[p];
    if (value <= NOISE) {
      data[i + 3] = 0;
      cleared += 1;
      continue;
    }
    // 발광: 알파는 밝기, 색은 그만큼 되돌린다. 검은 바탕 위에 다시 올리면 원본과 같다.
    const scale = 255 / value;
    data[i] = Math.min(255, Math.round(data[i] * scale));
    data[i + 1] = Math.min(255, Math.round(data[i + 1] * scale));
    data[i + 2] = Math.min(255, Math.round(data[i + 2] * scale));
    data[i + 3] = Math.min(data[i + 3], value);
  }
  return { data, info, cleared };
}

/**
 * ICO 한 장. sharp 는 .ico 를 못 써서 직접 만든다.
 *
 * ICO 는 헤더 6바이트, 그림마다 항목 16바이트, 그다음 그림 자료다. 32px 이상은 PNG 를
 * 그대로 넣을 수 있고 요즘 브라우저는 전부 읽는다. 크기 칸은 1바이트라 256 은 0 으로 적는다.
 */
function encodeIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // 예약
  header.writeUInt16LE(1, 2); // 1 = 아이콘
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + pngs.length * 16;
  for (const { size, bytes } of pngs) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0; // 팔레트 색 수
    entry[3] = 0; // 예약
    entry.writeUInt16LE(1, 4); // 색 평면
    entry.writeUInt16LE(32, 6); // 픽셀당 비트
    entry.writeUInt32LE(bytes.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += bytes.length;
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.bytes)]);
}

const jobs = [
  { from: "public/brand/clunk-mark.png", to: "public/brand/clunk-mark.png", label: "C 마크" },
  { from: "public/brand/clunk-wordmark.png", to: "public/brand/clunk-wordmark.png", label: "CLUNK 글자" },
];

const results = [];
for (const job of jobs) {
  const { data, info, cleared } = await cutout(resolve(root, job.from));
  const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(resolve(root, job.to), png);
  results.push(
    `${job.label.padEnd(12)} ${info.width}×${info.height} · 비운 픽셀 ${((cleared / (info.width * info.height)) * 100).toFixed(1)}%` +
      ` · ${(png.length / 1024).toFixed(0)}KB`,
  );
}

// 아이콘 한 벌은 배경 뺀 C 마크에서 다시 굽는다. 파비콘만 갈고 나머지를 두면 탭과 홈
// 화면과 북마크가 서로 다른 아이콘을 들게 된다.
const markPng = readFileSync(resolve(root, "public/brand/clunk-mark.png"));
mkdirSync(resolve(root, "public"), { recursive: true });
const sizes = [
  { size: 512, out: "public/icon-512.png" },
  { size: 192, out: "public/icon-192.png" },
  { size: 180, out: "public/apple-touch-icon.png" },
];
for (const { size, out } of sizes) {
  const bytes = await sharp(markPng).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(resolve(root, out), bytes);
  results.push(`${out.padEnd(30)} ${size}×${size} · ${(bytes.length / 1024).toFixed(0)}KB`);
}

const icoSizes = [16, 32, 48, 64];
const icoPngs = [];
for (const size of icoSizes) {
  const bytes = await sharp(markPng).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  icoPngs.push({ size, bytes });
}
const ico = encodeIco(icoPngs);
writeFileSync(resolve(root, "public/favicon.ico"), ico);
results.push(`public/favicon.ico              ${icoSizes.join("·")} · ${(ico.length / 1024).toFixed(1)}KB`);

for (const line of results) console.log(line);
