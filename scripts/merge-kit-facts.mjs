#!/usr/bin/env node
/**
 * 키트 빌드가 남긴 사실 조각을 app/data/listing-facts.json 에 합친다 — 숫자는 조각을 믿지
 * 않고 배달 파일에서 다시 측정한다.
 *
 * 키트(마을 광장·부두·광산 입구)는 wave-1 매니페스트가 아니라 examples/generated/kits/<kit>/
 * 의 팩토리에서 나온다. 그 빌드는 자기 부품을 examples/generated/kits/<kit>/
 * listing-facts.fragment.json 으로 적어 두고 등록부는 손대지 않는다(세 키트가 동시에
 * 만들어졌고 등록부를 셋이 같이 고치면 서로 덮어쓴다). 합치는 것은 여기서 한 번만 한다.
 *
 * 조각에서 가져오는 것은 파일이 말해 주지 않는 것뿐이다: 어느 키트에 속하는지(kit),
 * 히어로를 찍은 각도(viewYawDegrees). 삼각형·재질·크기·용량·동작·엔진 적합은 지금
 * public/market/<slug>/ 에 있는 GLB 에서 scripts/listing-facts-cli.ts 의 같은 측정으로 다시
 * 잰다 — 조각을 만든 뒤 색표 굽기 같은 후처리가 파일을 바꿔도 등록부는 파일을 따라간다.
 * tests/listing-facts-truth 가 같은 파일을 다시 열어 이 값을 대조한다.
 *
 * 바로잡는 것 두 가지:
 *   - 키트 상품의 `members` 는 부품 슬러그 배열(마켓의 키트 화면이 그 배열로 부품 격자를
 *     만든다 — app/components/catalog-facts.ts kitMemberSlugs). 숫자로 적혀 있으면 같은 조각
 *     안에서 kit 이 그 키트인 항목을 모아 배열로 바꾼다.
 *   - `kitSize` 는 부품 수. 키트 상품 자신은 세지 않는다.
 *
 * scripts/listing-facts-cli.ts 가 다시 돌아도 여기서 넣은 항목은 남는다(매니페스트에 없는
 * 슬러그는 "이전 판에서 유지한 항목"으로 이월).
 *
 * 사용: node --import tsx scripts/merge-kit-facts.mjs [--dry]
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { inspectAsset } from "../packages/core/src/index.ts";
import { formatLabelOf, measureAnimations, measureBoundsMetres, measureEngineFit } from "./listing-facts-cli.ts";

const root = resolve(import.meta.dirname, "..");
const kitsDir = resolve(root, "examples/generated/kits");
const target = resolve(root, "app/data/listing-facts.json");
const dry = process.argv.includes("--dry");

const file = JSON.parse(readFileSync(target, "utf8"));
const facts = file.facts ?? {};
const notes = [];

/** public/market/<slug>/ 의 GLB 하나. 여러 개면 어느 것이 대표인지 여기서 정하지 않는다. */
function entryGlb(slug) {
  const dir = resolve(root, "public/market", slug);
  if (!existsSync(dir)) throw new Error(`public/market/${slug} 가 없습니다`);
  const glbs = readdirSync(dir).filter((name) => name.toLowerCase().endsWith(".glb"));
  if (glbs.length !== 1) throw new Error(`public/market/${slug} 에 GLB 가 ${glbs.length}개입니다`);
  return { name: glbs[0], path: resolve(dir, glbs[0]) };
}

async function measure(slug) {
  const entry = entryGlb(slug);
  const bytes = readFileSync(entry.path);
  const report = inspectAsset({ entry: entry.name, files: new Map([[entry.name, new Uint8Array(bytes)]]) });
  const triangles = report?.metrics?.triangleCount;
  const materials = report?.metrics?.materialCount;
  if (typeof triangles !== "number") throw new Error(`${slug}: 삼각형 수를 읽지 못했습니다`);
  const motion = measureAnimations(bytes);
  return {
    triangles,
    materials: typeof materials === "number" ? materials : null,
    boundsMetres: await measureBoundsMetres(bytes),
    byteLength: bytes.byteLength,
    format: formatLabelOf(entry.name),
    animatedParts: motion?.parts ?? [],
    animations: motion?.animations ?? [],
    engine: measureEngineFit(bytes),
  };
}

for (const kitDir of readdirSync(kitsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
  const fragmentPath = resolve(kitsDir, kitDir, "listing-facts.fragment.json");
  if (!existsSync(fragmentPath)) {
    notes.push(`${kitDir}: 조각 없음 (건너뜀)`);
    continue;
  }
  const fragment = JSON.parse(readFileSync(fragmentPath, "utf8"));
  const entries = fragment.facts ?? fragment;
  const slugs = Object.keys(entries);
  const kitSlugs = slugs.filter((slug) => slug.startsWith("kit-"));
  if (kitSlugs.length !== 1) throw new Error(`${kitDir}: 키트 상품(kit-*)이 ${kitSlugs.length}개 — 정확히 하나여야 합니다`);
  const kitSlug = kitSlugs[0];
  const parts = slugs.filter((slug) => slug !== kitSlug && entries[slug]?.kit === kitSlug).sort();
  if (parts.length < 2) throw new Error(`${kitDir}: kit="${kitSlug}" 인 부품이 ${parts.length}개 — 키트가 아닙니다`);

  for (const slug of slugs) {
    const fromFragment = entries[slug];
    const measured = await measure(slug);
    const isKit = slug === kitSlug;
    facts[slug] = {
      ...measured,
      kit: kitSlug,
      kitSize: parts.length,
      members: isKit ? parts : null,
      viewYawDegrees: typeof fromFragment.viewYawDegrees === "number" ? fromFragment.viewYawDegrees : null,
      sheet: null,
      texture: null,
      inspection: fromFragment.inspection ?? null,
    };
    const drift = [];
    if (fromFragment.triangles !== measured.triangles) drift.push(`삼각형 ${fromFragment.triangles}→${measured.triangles}`);
    if (fromFragment.byteLength !== measured.byteLength) drift.push(`용량 ${fromFragment.byteLength}→${measured.byteLength}`);
    if (fromFragment.engine?.colour && measured.engine?.colour && fromFragment.engine.colour !== measured.engine.colour) drift.push(`색 ${fromFragment.engine.colour}→${measured.engine.colour}`);
    if (drift.length) notes.push(`  ${slug}: 조각과 다름 — ${drift.join(", ")} (파일을 따름)`);
  }
  notes.push(`${kitDir}: ${kitSlug} + 부품 ${parts.length}개`);
}

file.facts = Object.fromEntries(Object.entries(facts).sort(([a], [b]) => a.localeCompare(b)));
file.sources = Array.from(new Set([...(file.sources ?? []), "examples/generated/kits/*/listing-facts.fragment.json → public/market 파일에서 재측정 (scripts/merge-kit-facts.mjs)"]));
file.generatedAt = new Date().toISOString();

for (const note of notes) console.log(note);
console.log(`→ 항목 ${Object.keys(file.facts).length}개${dry ? " (미리보기, 쓰지 않음)" : ""}`);
if (!dry) writeFileSync(target, `${JSON.stringify(file, null, 2)}\n`, "utf8");
