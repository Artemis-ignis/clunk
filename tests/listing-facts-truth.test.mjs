import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import { inspectAsset } from "../packages/core/src/index.ts";

const root = new URL("../", import.meta.url);

/**
 * 상품 페이지에 적힌 숫자가 파일 안의 숫자와 같은가.
 *
 * 이 검사가 없어서 두 번 틀렸다. 트랙터는 표기 32,300 삼각형에 실측 58,156 이었고,
 * 헬리콥터는 사양이 통째로 비어 최하 등급으로 팔릴 뻔했다. 두 번 다 사람이 눈으로
 * 발견했다.
 *
 * 사실은 파이프라인 매니페스트에서 옵니다(scripts/listing-facts-cli.ts 의
 * factsFromManifest). 매니페스트는 한 번 잰 값을 적어 두는 종이라, 파일이 바뀌거나
 * 측정이 실패해도 종이는 그대로 남는다. **여기서만 파일을 다시 연다.**
 *
 * 2026-09-04 관찰이 이걸 제품의 중심으로 올렸다. 경쟁사들도 잰 값을 싣는다 — Fab 은
 * 기계 판독 스펙 패널을 달고, polyfork 는 네 항목이 전부 정확했다. 차별점은 값을 싣는
 * 것이 아니라 **적힌 것과 파일이 어긋나면 잡아내는 것**이다. 그 주장을 우리가 먼저
 * 지키지 못하면 팔 수 없다.
 */

const FACTS = "app/data/listing-facts.json";
const MARKET = "public/market";

/** 삼각형은 정확히 같아야 한다. 재질은 파이프라인이 중복을 접을 수 있어 같거나 적다. */
const TRIANGLE_TOLERANCE = 0;

async function loadFacts() {
  const raw = JSON.parse(await readFile(new URL(FACTS, root), "utf8"));
  return raw.facts ?? raw;
}

/** public/market/<slug>/ 안의 GLB 하나. 없으면 이 상품은 3D 가 아니다. */
async function entryGlb(slug) {
  let names;
  try {
    names = await readdir(new URL(`${MARKET}/${slug}`, root));
  } catch {
    return null;
  }
  const glb = names.filter((n) => n.toLowerCase().endsWith(".glb"));
  if (glb.length !== 1) return null; // 여러 개면 어느 것이 대표인지 여기서 정하지 않는다
  return `${MARKET}/${slug}/${glb[0]}`;
}

test("적힌 삼각형 수가 파일에서 다시 잰 값과 같다", async () => {
  const facts = await loadFacts();
  const checked = [];
  const wrong = [];

  for (const [slug, fact] of Object.entries(facts)) {
    if (typeof fact?.triangles !== "number") continue; // 빈 칸은 §"빈 칸" 검사가 맡는다
    const path = await entryGlb(slug);
    if (!path) continue;
    const bytes = await readFile(new URL(path, root));
    const report = inspectAsset({ entry: path, files: new Map([[path, new Uint8Array(bytes)]]) });
    const measured = report?.metrics?.triangleCount;
    if (typeof measured !== "number") continue; // 못 읽은 파일은 아래 검사가 잡는다
    checked.push(slug);
    if (Math.abs(measured - fact.triangles) > TRIANGLE_TOLERANCE) {
      wrong.push(`${slug}: 표기 ${fact.triangles.toLocaleString()} / 실측 ${measured.toLocaleString()}`);
    }
  }

  assert.ok(checked.length > 0, "재 본 상품이 하나도 없습니다 — 검사가 아무것도 지키지 않고 있습니다");
  assert.deepEqual(
    wrong,
    [],
    `상품 페이지의 삼각형 수가 파일과 다릅니다. 이것이 이 제품이 팔겠다고 하는 바로 그 결함입니다:\n  ${wrong.join("\n  ")}`,
  );
});

test("적힌 재질 수가 파일보다 많지 않다", async () => {
  const facts = await loadFacts();
  const wrong = [];
  for (const [slug, fact] of Object.entries(facts)) {
    if (typeof fact?.materials !== "number") continue;
    const path = await entryGlb(slug);
    if (!path) continue;
    const bytes = await readFile(new URL(path, root));
    const measured = inspectAsset({ entry: path, files: new Map([[path, new Uint8Array(bytes)]]) })?.metrics?.materialCount;
    if (typeof measured !== "number") continue;
    // 적힌 값이 실제보다 크면 없는 재질을 광고하는 것이다. 작은 것은 파이프라인이
    // 중복 재질을 접은 결과일 수 있어 허용한다.
    if (fact.materials > measured) wrong.push(`${slug}: 표기 ${fact.materials} / 실측 ${measured}`);
  }
  assert.deepEqual(wrong, [], `없는 재질을 상품 페이지가 광고하고 있습니다:\n  ${wrong.join("\n  ")}`);
});

test("파일이 있는데 사양이 비어 있는 상품이 없다", async () => {
  // 헬리콥터가 이렇게 팔릴 뻔했다. 파일은 멀쩡한데 사양만 비어, 등급이 최하로 떨어졌다.
  const facts = await loadFacts();
  const blank = [];
  for (const [slug, fact] of Object.entries(facts)) {
    const path = await entryGlb(slug);
    if (!path) continue;
    if (fact?.triangles == null && fact?.materials == null && fact?.boundsMetres == null) {
      blank.push(`${slug} (${path})`);
    }
  }
  assert.deepEqual(
    blank,
    [],
    `3D 파일이 있는데 사양이 전부 비어 있습니다. 사양이 비면 등급이 바닥으로 떨어지고, 등급이 곧 접근권입니다:\n  ${blank.join("\n  ")}`,
  );
});
