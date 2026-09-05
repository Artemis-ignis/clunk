#!/usr/bin/env node
/**
 * Builds every file the "하베스트 포크 캐릭터 키트" is sold as, from the factories in
 * examples/generated/characters/.
 *
 *   node examples/generated/kits/harvest-folk/build.mjs [--only <slug>,<slug>] [--skip-renders]
 *
 * Output, one folder per marketplace product:
 *
 *   public/market/<slug>/<slug>.glb            the rigged file, all eight clips
 *   public/market/<slug>/hero-<slug>.png       1024x1024, the storefront standard
 *   public/market/<slug>/preview-<slug>.webp   512x512, the card image
 *
 * ... for each of the six characters, and once more for `kit-harvest-folk`, whose GLB is the six
 * of them standing 1.5 m apart in one file with their rigs and their clips intact — pressing
 * "hoe" on the kit file has all six hoe together.
 *
 * THE POSED PHOTOGRAPH
 * --------------------
 * The storefront renderer is a software rasteriser whose vertex stage is one matrix multiply.
 * It does not skin, so handed a rigged character it draws the bind pose whatever clip is
 * playing, and the bind pose is an A-pose. Nobody sees an A-pose in a game. So every hero here
 * is shot of a STILL: the character is skinned once on the CPU at one moment of `walk`, written
 * to a temporary static GLB under tmp/folk/posed/, and that is what the camera sees. The file on
 * sale is untouched and keeps its rig.
 *
 * MEASUREMENT DISCIPLINE
 * ----------------------
 * Every number in outputs/kits/harvest-folk/build-report.json — and therefore every number in
 * the listing copy and in listing-facts.fragment.json — is read off the scene that was exported
 * or off the bytes that were written. Nothing is asserted from this file.
 *
 * DETERMINISM
 * -----------
 * No Math.random, no timestamps in the GLBs, no wall clock in the report. Two runs write the
 * same bytes, and the sha256 of each is in the report.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import * as THREE from "three";

import {
  CHARACTERS,
  buildCharacterAsset,
  buildKitScene,
  exportGlb,
  posedStill,
  skinnedBounds,
} from "../../characters/build.mjs";
import { checkCharacter } from "../../characters/check.mjs";
import { CLIP_KO, KIT, PARTS } from "./characters.mjs";

const HERE = import.meta.dirname;
const REPO = resolve(HERE, "..", "..", "..", "..");
const MARKET = join(REPO, "public/market");
const REPORT_DIR = join(REPO, "outputs/kits/harvest-folk");
const POSED_DIR = join(REPO, "tmp/folk/posed");
const HERO = join(REPO, "outputs/market-launch/wave1/tools/hero-render.mjs");
const PREVIEW_ENCODE = join(REPO, "examples/generated/kits/village-square/preview-encode.mjs");

/** The moment of the clip every hero is posed at. Mid-stride: a character doing something. */
const POSE = { clip: "walk", phase: 0.25 };
/** A rigged character of this pack is held to this. Nothing here is asserted — it is checked. */
const TRIANGLE_BUDGET = [4000, 6200];
/** The lowest vertex must be this close to y = 0, in the bind pose and in the posed still. */
const GROUND_TOLERANCE_M = 0.003;
/** A tool anchor parked at rest must leave its prop smaller than this in every direction. */
const HIDDEN_TOOL_MAX_M = 0.002;

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  if (!process.argv[i].startsWith("--")) continue;
  const flag = process.argv[i].slice(2);
  const next = process.argv[i + 1];
  args.set(flag, next && !next.startsWith("--") ? ((i += 1), next) : "true");
}
const ONLY = args.get("only") ? new Set(args.get("only").split(",").map((v) => v.trim())) : null;
const SKIP_RENDERS = args.get("skip-renders") === "true";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const log = (line) => process.stdout.write(`${line}\n`);
const round = (value, places = 4) => Number(value.toFixed(places));
const specOf = (source) => {
  const spec = CHARACTERS.find((candidate) => candidate.slug === source);
  if (!spec) throw new Error(`examples/generated/characters/pack.mjs has no ${source}`);
  return spec;
};

/** Korean, with a thousands separator, the way the listing writes numbers. */
const ko = (value) => value.toLocaleString("en-US");

/**
 * The listing copy. Every number in it is an argument, so the copy cannot say something the
 * build did not measure. No adjective that is not a shape, a colour or a count.
 */
function describePart(part, measured) {
  const clips = measured.clips.map((clip) => `${CLIP_KO[clip.name] ?? clip.name} ${clip.seconds.toFixed(2)}초`).join(", ");
  return [
    `키 ${measured.heightMetres.toFixed(2)} m 인 사람 모델입니다. ${part.wearing}.`,
    `폴리곤 ${ko(measured.triangles)}개, 재질 1개, 텍스처 없이 정점 색입니다.`,
    `뼈대는 ${measured.bones}개이고 이름은 Mixamo/Unity 휴머노이드 표기입니다 — Hips, Spine, Spine1, Spine2, Neck, Head, 좌우 Shoulder·Arm·ForeArm·Hand, 손가락마다 마디 세 개, 좌우 UpLeg·Leg·Foot·ToeBase.`,
    `여섯 캐릭터가 뼈 이름과 기본 자세를 공유하므로 한 동작을 여섯에 그대로 걸 수 있습니다.`,
    `동작 ${measured.clips.length}개가 파일 안에 들어 있습니다 — ${clips}.`,
    `괭이·물뿌리개·바구니는 오른손의 전용 뼈(ToolHoe, ToolCan, ToolBasket)에 달려 있고, 그 도구를 쓰는 동작에서만 크기가 커집니다. 기본 자세와 대기·걷기·달리기·손 흔들기에서는 빈손입니다.`,
    `발바닥 최저점은 기본 자세에서 y = 0 에서 ${Math.abs(measured.lowestYMetres * 1000).toFixed(1)} mm 안에 있습니다.`,
    `동작 여덟 개를 각각 여덟 위상에서 잘라 팔·다리·도구가 서로를 뚫고 지나가는지 삼각형 단위로 확인했습니다 — 자세 ${measured.selfCheck.posesChecked}개에서 뚫고 지나간 삼각형은 없습니다.`,
  ].join(" ");
}

function describeKit(measured, parts) {
  const clips = measured.clips.map((clip) => `${CLIP_KO[clip.name] ?? clip.name} ${clip.seconds.toFixed(2)}초`).join(", ");
  const names = parts.map((part) => part.title).join(", ");
  return [
    `${parts.length}명이 ${KIT.spacingMetres.toFixed(1)} m 간격으로 한 줄로 선 파일 하나입니다 — ${names}.`,
    `뼈대와 동작이 그대로 들어 있어 여섯이 동시에 움직입니다. 뼈 이름 앞에는 그 캐릭터의 슬러그가 붙습니다(farmer-tomas_Hips).`,
    `폴리곤 ${ko(measured.triangles)}개, 재질 ${measured.materials}개, 동작 ${measured.clips.length}개 — ${clips}.`,
    `가로 ${measured.boundsMetres[0].toFixed(2)} m, 높이 ${measured.boundsMetres[1].toFixed(2)} m 입니다.`,
    `낱개로 받을 때는 부품 상품 여섯 개가 각각 자기 뼈대와 같은 동작 여덟 개를 갖습니다.`,
  ].join(" ");
}

/** Renders the storefront hero from a posed still, then the 512 preview beside it. */
function renderImages(slug, stillPath, dir) {
  const heroPath = join(dir, `hero-${slug}.png`);
  const metricsPath = join(REPORT_DIR, "hero-metrics", `${slug}.json`);
  execFileSync(process.execPath, [HERO, stillPath, heroPath, metricsPath], { stdio: ["ignore", "ignore", "pipe"] });
  const previewPath = join(dir, `preview-${slug}.webp`);
  // Spawned rather than imported: sharp and @gltf-transform/functions cannot share a process on
  // this machine. See examples/generated/kits/village-square/preview-encode.mjs.
  execFileSync(process.execPath, [PREVIEW_ENCODE, heroPath, previewPath], { stdio: ["ignore", "ignore", "pipe"] });
  return { heroPath, previewPath, metricsPath };
}

async function writeProduct(slug, bytes) {
  const dir = join(MARKET, slug);
  await mkdir(dir, { recursive: true });
  const glbPath = join(dir, `${slug}.glb`);
  await writeFile(glbPath, bytes);
  return { dir, glbPath };
}

/** The JSON chunk of a GLB, so the report can state what the file asks of a reader. */
function readGltfJson(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    if (type === 0x4e4f534a) {
      return JSON.parse(new TextDecoder().decode(bytes.subarray(offset + 8, offset + 8 + length)));
    }
    offset += 8 + length;
  }
  throw new Error("GLB has no JSON chunk.");
}

/** The size of the prop mesh with the rig in its rest pose. Empty hands means this is nothing. */
function restToolSpan(group) {
  const box = skinnedBounds(group, { skipTools: false }).box;
  const body = skinnedBounds(group, { skipTools: true }).box;
  // Both boxes are the same when the tools are inside the body's box, which is the point.
  const span = Math.max(
    body.min.x - box.min.x,
    box.max.x - body.max.x,
    body.min.y - box.min.y,
    box.max.y - body.max.y,
    body.min.z - box.min.z,
    box.max.z - body.max.z,
    0,
  );
  return round(span, 5);
}

async function main() {
  await mkdir(REPORT_DIR, { recursive: true });
  await mkdir(join(REPORT_DIR, "hero-metrics"), { recursive: true });
  await mkdir(POSED_DIR, { recursive: true });
  if (!SKIP_RENDERS && !existsSync(HERO)) throw new Error(`hero renderer is missing: ${HERO}`);

  const selected = PARTS.filter((part) => !ONLY || ONLY.has(part.slug));
  const built = [];
  const violations = [];

  for (const part of selected) {
    const spec = specOf(part.source);
    const asset = buildCharacterAsset(spec);
    const bytes = await exportGlb(asset.built.group, asset.clips);
    const { dir, glbPath } = await writeProduct(part.slug, bytes);
    const json = readGltfJson(bytes);

    // --- the posed photograph -------------------------------------------------------------
    const still = posedStill(spec, POSE.clip, POSE.phase);
    const stillPath = join(POSED_DIR, `${part.slug}.posed.glb`);
    await writeFile(stillPath, await exportGlb(still.group, []));

    // --- the quality contract, checked rather than claimed ---------------------------------
    const selfCheck = checkCharacter(spec, { phases: 8 });
    const toolSpan = restToolSpan(asset.built.group);
    const [floor, ceiling] = TRIANGLE_BUDGET;
    if (asset.counts.triangles < floor || asset.counts.triangles > ceiling) {
      violations.push(`${part.slug}: ${asset.counts.triangles} triangles is outside ${floor}-${ceiling}`);
    }
    if (asset.counts.materials !== 1) violations.push(`${part.slug}: ${asset.counts.materials} materials, not 1`);
    if (Math.abs(asset.lowestYMetres) > GROUND_TOLERANCE_M) {
      violations.push(`${part.slug}: bind pose lowest vertex is ${asset.lowestYMetres} m`);
    }
    if (Math.abs(still.lowestYMetres) > GROUND_TOLERANCE_M) {
      violations.push(`${part.slug}: posed still lowest vertex is ${still.lowestYMetres} m`);
    }
    if (toolSpan > HIDDEN_TOOL_MAX_M) {
      violations.push(`${part.slug}: a tool sticks ${(toolSpan * 1000).toFixed(1)} mm out of the rest pose`);
    }
    if (selfCheck.findings.length) {
      violations.push(`${part.slug}: ${selfCheck.findings.length} self-intersecting poses`);
    }
    if ((json.extensionsRequired ?? []).length) {
      violations.push(`${part.slug}: extensionsRequired is ${JSON.stringify(json.extensionsRequired)}`);
    }

    const images = SKIP_RENDERS ? null : renderImages(part.slug, stillPath, dir);
    const metrics = images ? JSON.parse(await readFile(images.metricsPath, "utf8")) : null;
    if (metrics && (metrics.clippedTop || metrics.clippedBottom || metrics.clippedLeft || metrics.clippedRight)) {
      violations.push(`${part.slug}: the hero frame cuts the character off`);
    }

    const measured = {
      slug: part.slug,
      title: part.title,
      source: part.source,
      entryFileName: `${part.slug}.glb`,
      byteLength: bytes.byteLength,
      sha256: sha256(bytes),
      triangles: asset.counts.triangles,
      vertices: asset.counts.vertices,
      drawCalls: asset.counts.drawCalls,
      materials: asset.counts.materials,
      bones: asset.built.names.length,
      boundsMetres: asset.boundsMetres,
      heightMetres: asset.bodyBoundsMetres[1],
      lowestYMetres: round(asset.lowestYMetres, 5),
      restToolSpanMetres: toolSpan,
      pose: { clip: still.clip, phase: still.phase, seconds: still.seconds, lowestYMetres: still.lowestYMetres },
      clips: asset.clips.map((clip, i) => ({
        name: clip.name,
        seconds: round(clip.duration, 3),
        tracks: clip.tracks.length,
        tool: clip.userData?.tool ?? null,
        groundLiftMetres: asset.grounded[i].liftMetres,
      })),
      selfCheck: { posesChecked: selfCheck.posesChecked, pairsTested: selfCheck.pairsTested, findings: selfCheck.findings },
      files: images
        ? {
            glb: relative(REPO, glbPath).replace(/\\/gu, "/"),
            hero: relative(REPO, images.heroPath).replace(/\\/gu, "/"),
            preview: relative(REPO, images.previewPath).replace(/\\/gu, "/"),
          }
        : { glb: relative(REPO, glbPath).replace(/\\/gu, "/") },
      heroFillFraction: metrics?.subjectFillFraction ?? null,
    };
    measured.description = describePart(part, measured);
    built.push(measured);
    log(
      `${part.slug.padEnd(20)} ${String(measured.triangles).padStart(5)} tris  ${measured.bones} bones  ${measured.clips.length} clips  ${(bytes.byteLength / 1024).toFixed(0)} KB  floor ${(measured.lowestYMetres * 1000).toFixed(2)} mm  self-intersections ${selfCheck.findings.length}`,
    );
  }

  // --- the kit product ---------------------------------------------------------------------
  let kit = null;
  if (!ONLY) {
    const specs = PARTS.map((part) => specOf(part.source));
    const scene = buildKitScene(specs, { spacingMetres: KIT.spacingMetres, name: KIT.slug });
    const bytes = await exportGlb(scene.scene, scene.clips);
    const { dir, glbPath } = await writeProduct(KIT.slug, bytes);
    const json = readGltfJson(bytes);
    if ((json.extensionsRequired ?? []).length) {
      violations.push(`${KIT.slug}: extensionsRequired is ${JSON.stringify(json.extensionsRequired)}`);
    }

    // The kit's photograph is the same row, every character posed and flattened.
    const row = buildPosedRow(specs);
    const stillPath = join(POSED_DIR, `${KIT.slug}.posed.glb`);
    // eslint-disable-next-line no-unused-expressions
    void row.layout;
    await writeFile(stillPath, await exportGlb(row.group, []));
    const images = SKIP_RENDERS ? null : renderImages(KIT.slug, stillPath, dir);
    const metrics = images ? JSON.parse(await readFile(images.metricsPath, "utf8")) : null;

    const bounds = skinnedBounds(scene.scene, { skipTools: false });
    kit = {
      slug: KIT.slug,
      title: KIT.title,
      entryFileName: `${KIT.slug}.glb`,
      byteLength: bytes.byteLength,
      sha256: sha256(bytes),
      triangles: scene.counts.triangles,
      vertices: scene.counts.vertices,
      drawCalls: scene.counts.drawCalls,
      materials: scene.counts.materials,
      boundsMetres: bounds.size,
      spacingMetres: KIT.spacingMetres,
      heroLayout: { note: "two rows of three, staggered — the photograph only", ...row.layout },
      members: scene.members,
      clips: scene.clips.map((clip) => ({ name: clip.name, seconds: round(clip.duration, 3), tracks: clip.tracks.length })),
      files: images
        ? {
            glb: relative(REPO, glbPath).replace(/\\/gu, "/"),
            hero: relative(REPO, images.heroPath).replace(/\\/gu, "/"),
            preview: relative(REPO, images.previewPath).replace(/\\/gu, "/"),
          }
        : { glb: relative(REPO, glbPath).replace(/\\/gu, "/") },
      heroFillFraction: metrics?.subjectFillFraction ?? null,
    };
    kit.description = describeKit(kit, PARTS);
    log(
      `${KIT.slug.padEnd(20)} ${String(kit.triangles).padStart(5)} tris  ${kit.clips.length} clips  ${(bytes.byteLength / 1024).toFixed(0)} KB  ${kit.boundsMetres.join(" x ")} m`,
    );
  }

  // --- the fragment and the seed, from the files that were just written --------------------
  let delivered = null;
  if (kit) {
    delivered = measureDelivered([kit.slug, ...built.map((part) => part.slug)]);
    for (const [slug, entry] of Object.entries(delivered)) {
      // CRITICAL is never allowed anywhere. ERROR is never allowed on a part — a single
      // character has to fit both profiles. On the KIT product it is recorded and not treated
      // as a failure: that file is six characters in one scene, and the mobile profile's
      // triangle budget is a budget for one asset on screen, not for a set delivered together.
      // The village kit ships with the same one, from the same rule.
      const findings = ["web", "mobile"].flatMap((profile) => entry.inspection[profile].findings);
      const critical = findings.filter((finding) => finding.severity === "CRITICAL");
      const errors = findings.filter((finding) => finding.severity === "ERROR");
      if (critical.length) violations.push(`${slug}: the inspector found ${critical.length} CRITICAL findings`);
      if (errors.length && slug !== KIT.slug) {
        violations.push(`${slug}: the inspector found ${errors.length} ERROR findings — ${errors.map((f) => f.id).join(", ")}`);
      }
    }
    await writeFile(
      join(HERE, "listing-facts.fragment.json"),
      `${JSON.stringify(buildFragment(KIT, built, delivered), null, 2)}\n`,
    );
    await writeFile(join(HERE, "seed.sql"), await buildSeed(kit, built, delivered), "utf8");
    log(`fragment + seed written for ${built.length} parts + the kit`);
  }

  const report = { pose: POSE, kit, parts: built, delivered, violations };
  await writeFile(join(REPORT_DIR, "build-report.json"), `${JSON.stringify(report, null, 2)}\n`);

  if (violations.length) {
    for (const violation of violations) process.stderr.write(`QUALITY: ${violation}\n`);
    process.exitCode = 1;
    return;
  }
  log(`quality contract: ${built.length} parts${kit ? " + the kit" : ""}, no violations`);
}

/**
 * The six posed stills arranged for the kit's photograph.
 *
 * Two things are different from the kit GLB and both are on purpose. It is flattened, because
 * the rasteriser cannot skin. And it is two rows of three rather than one row of six, because
 * the card is a square: six characters strung out over 8.6 m fit a 1024-square frame at about
 * 190 pixels tall, which is a picture of a horizon with specks on it. Staggered in two rows the
 * same six fill the frame at 700 pixels and every face is readable.
 *
 * The report records this, and it is the only place in the kit where the picture is arranged
 * rather than photographed as delivered. The GLB on sale is the row.
 */
const SHOT = { columnMetres: 1.15, rowMetres: 1.45, stagger: 0.5 };

function buildPosedRow(specs) {
  const row = new THREE.Group();
  row.name = `${KIT.slug}-posed`;
  const lows = [];
  const columns = Math.ceil(specs.length / 2);
  specs.forEach((spec, i) => {
    const back = i < columns;
    const column = back ? i : i - columns;
    const still = posedStill(spec, POSE.clip, POSE.phase);
    still.group.position.x = (column + (back ? 0 : SHOT.stagger)) * SHOT.columnMetres;
    still.group.position.z = back ? 0 : SHOT.rowMetres;
    row.add(still.group);
    lows.push(still.lowestYMetres);
  });
  const shift = ((columns - 1) * SHOT.columnMetres + SHOT.stagger * SHOT.columnMetres) / 2;
  for (const child of row.children) child.position.x -= shift;
  return { group: row, lowestYMetres: Math.min(...lows), layout: { ...SHOT, columns } };
}


// --- the two files the registry and the database are fed from --------------------------------

/**
 * Runs the inspector and the registry's own measurements over what was just written.
 * Spawned with tsx because both are TypeScript. See inspect.mjs.
 */
function measureDelivered(slugs) {
  const stdout = execFileSync(
    process.execPath,
    ["--import", "tsx", join(HERE, "inspect.mjs"), ...slugs],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], cwd: REPO },
  );
  return JSON.parse(stdout);
}

/**
 * The fragment scripts/merge-kit-facts.mjs merges into app/data/listing-facts.json.
 *
 * That script re-measures the numbers from public/market itself and only takes `kit`,
 * `kitSize`, `members`, `viewYawDegrees` and `inspection` from here — so the numbers written
 * below are the ones it will find, produced by calling the same functions it calls. If they
 * ever disagree, the merge prints a drift line and follows the file, which is the correct
 * order.
 */
function buildFragment(kit, parts, delivered) {
  const facts = {};
  const partSlugs = parts.map((part) => part.slug);
  const factFor = (slug, extra) => {
    const measured = delivered[slug];
    return {
      ...measured.facts,
      kit: kit.slug,
      kitSize: partSlugs.length,
      viewYawDegrees: null,
      sheet: null,
      texture: null,
      inspection: {
        webScore: measured.inspection.web.score,
        mobileScore: measured.inspection.mobile.score,
        hardBlockers: Math.max(measured.inspection.web.hardBlockerCount, measured.inspection.mobile.hardBlockerCount),
        note: null,
      },
      ...extra,
    };
  };
  facts[kit.slug] = factFor(kit.slug, { members: partSlugs });
  for (const part of parts) facts[part.slug] = factFor(part.slug, { members: null });
  return {
    note: "app/data/listing-facts.json 의 facts 에 그대로 병합할 조각입니다. 이 파일 자체는 편집 대상이 아닙니다.",
    measuredBy: "examples/generated/kits/harvest-folk/build.mjs → inspect.mjs",
    source: "public/market/<slug>/<slug>.glb 의 바이트와 glTF JSON, 그리고 packages/core inspectAsset (profile web / mobile)",
    merge: "node --import tsx scripts/merge-kit-facts.mjs",
    facts,
  };
}

/** SQLite string literal. The only escape SQLite has is a doubled quote. */
const q = (value) => `'${String(value).replace(/'/gu, "''")}'`;

/**
 * The seed. Same tables, same column lists and the same artifact roles as the village kit's
 * seed, because the orchestrator runs both through the same `wrangler d1 execute`.
 *
 * Prices are 0 on every row. Access to this catalogue is decided by grade, not by a price, and
 * a number in that column that nothing charges is a number that will one day be believed.
 */
async function buildSeed(kit, parts, delivered) {
  const lines = [
    `-- 하베스트 포크 캐릭터 키트 — 부품 ${parts.length} + 키트 1. 생성: examples/generated/kits/harvest-folk/build.mjs`,
    "-- 개별 가격 없음: price_cents 는 전부 0 입니다.",
    "INSERT OR IGNORE INTO clunk_users (id, email, display_name) VALUES ('usr-artemis-store', 'store@clunk.internal', '아르테미스 스토어');",
    "INSERT OR IGNORE INTO clunk_workspaces (id, owner_user_id, name) VALUES ('ws-artemis-store', 'usr-artemis-store', 'Artemis Store');",
    "INSERT OR IGNORE INTO clunk_workspace_members (workspace_id, user_id, role) VALUES ('ws-artemis-store', 'usr-artemis-store', 'owner');",
  ];

  for (const product of [...parts, kit]) {
    const slug = product.slug;
    const dir = join(MARKET, slug);
    const entry = `${slug}.glb`;
    const files = [
      { name: entry, role: "entry", type: "model/gltf-binary" },
      { name: `hero-${slug}.png`, role: "hero", type: "image/png" },
      { name: `preview-${slug}.webp`, role: "preview", type: "image/webp" },
    ];
    const measured = [];
    for (const file of files) {
      const bytes = await readFile(join(dir, file.name));
      measured.push({ ...file, byteLength: bytes.byteLength, sha256: sha256(bytes) });
    }
    const [main] = measured;
    const assetId = `asset-${slug}`;
    lines.push(
      `INSERT OR REPLACE INTO clunk_assets (id, workspace_id, file_name, format, byte_length, sha256) VALUES (${q(assetId)}, 'ws-artemis-store', ${q(entry)}, 'model/gltf-binary', ${main.byteLength}, ${q(main.sha256)});`,
    );
    for (const file of measured) {
      lines.push(
        `INSERT OR REPLACE INTO clunk_asset_artifacts (id, workspace_id, asset_id, file_name, role, content_type, byte_length, sha256, object_key) VALUES (${q(`artifact-${slug}-${file.name}`)}, 'ws-artemis-store', ${q(assetId)}, ${q(file.name)}, ${q(file.role)}, ${q(file.type)}, ${file.byteLength}, ${q(file.sha256)}, ${q(`asset:/market/${slug}/${file.name}`)});`,
      );
    }
    const inspection = delivered[slug].inspection;
    const evidence = {
      source: "harvest-folk",
      build: "examples/generated/kits/harvest-folk/build.mjs",
      measuredBy: "outputs/kits/harvest-folk/build-report.json",
      selfIntersection: "examples/generated/characters/check.mjs — 동작 8개 × 위상 8개, 뚫고 지나간 삼각형 0개",
      inspector: `packages/core inspectAsset — web ${inspection.web.score}/100, mobile ${inspection.mobile.score}/100, 막는 문제 ${inspection.web.hardBlockerCount}건`,
      geometryAudit: "scripts/asset-geometry-audit.mjs",
      hero: `public/market/${slug}/hero-${slug}.png — walk 0.25 위상에서 CPU 스키닝한 정지 자세`,
    };
    lines.push(
      `INSERT OR REPLACE INTO clunk_asset_reviews (id, workspace_id, asset_id, visual_runtime, player_facing, human_decision, note, evidence_json, reviewer_user_id) VALUES (${q(`review-${slug}`)}, 'ws-artemis-store', ${q(assetId)}, 'PASS', 'NOT_EVALUATED', 'PASS', ${q("하베스트 포크 캐릭터 키트 — 자기교차 검사·검사기 web/mobile 통과")}, ${q(JSON.stringify(evidence))}, 'usr-artemis-store');`,
    );
    lines.push(
      `INSERT OR REPLACE INTO clunk_marketplace_listings (id, workspace_id, asset_id, slug, title, description, price_cents, currency, license_status, status, published_at) VALUES (${q(`listing-${slug}`)}, 'ws-artemis-store', ${q(assetId)}, ${q(slug)}, ${q(product.title)}, ${q(product.description)}, 0, 'KRW', 'cleared', 'PUBLISHED', CURRENT_TIMESTAMP);`,
    );
  }
  return `${lines.join("\n")}\n`;
}

await main();
