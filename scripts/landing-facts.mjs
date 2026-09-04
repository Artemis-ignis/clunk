#!/usr/bin/env node
/**
 * 첫 화면이 보여 주는 파일의 숫자를 그 파일에서 재서 적어 둔다.
 *
 * 왜 필요한가. 첫 화면의 폴리곤 수와 용량이 코드에 손으로 박혀 있었다(page.tsx 의
 * FEATURED_MODEL·INSPECTED_MODEL). 2026-09-04 그 자리의 GLB 를 파는 트랙터로 갈면서
 * 숫자를 같이 못 고쳤고, 화면은 58,156 삼각형짜리 모델을 보여 주면서 "39,320개"라고
 * 적고 있었다. 이 가게가 팔겠다고 하는 바로 그 결함을 첫 화면이 저지르고 있었다.
 *
 * 손으로 적는 한 또 어긋난다. 파일에서 재서 JSON 으로 내려놓고, 화면은 그것만 읽는다.
 * tests/listing-facts-truth.test.mjs 가 같은 파일을 다시 재서 이 값을 검사한다.
 *
 * 사용: node scripts/landing-facts.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { inspectAsset } from "../packages/core/src/index.ts";

const root = resolve(import.meta.dirname, "..");

/** 첫 화면이 쓰는 파일들. 이름은 화면이 부르는 이름 그대로. */
const FILES = {
  tractor: "public/landing/tractor.compact.m1.glb",
};

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
    triangles,
    bytes: bytes.byteLength,
    faceLimit: FACE_LIMIT,
    limitPercent: Math.round((triangles / FACE_LIMIT) * 100),
  };
  console.log(`${key.padEnd(10)} ${name} · 폴리곤 ${triangles.toLocaleString("ko-KR")} · ${(bytes.byteLength / 1024).toFixed(0)}KB · 상한의 ${facts[key].limitPercent}%`);
}

const out = resolve(root, "app/data/landing-facts.json");
writeFileSync(out, `${JSON.stringify({ schema: "clunk.landing-facts.v1", generatedAt: new Date().toISOString(), facts }, null, 2)}\n`, "utf8");
console.log(`→ ${out.replace(`${root}\\`, "").replace(`${root}/`, "")}`);
