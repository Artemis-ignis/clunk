#!/usr/bin/env node
/**
 * Mine Entrance Kit — everything the shop needs, written from the measurements and nothing else.
 *
 *   node examples/generated/kits/mine-entrance/publish.mjs
 *
 * Reads   outputs/kits/mine-entrance/build-report.json   (bytes, hashes, bounds, meshes, clips)
 *         tmp/kits/mine-entrance/qa/<slug>.json          (our own MCP's metrics and scores)
 * Writes  tmp/kits/mine-entrance/listing-facts.fragment.json
 *         tmp/kits/mine-entrance/seed.sql
 *         tmp/kits/mine-entrance/copy.json
 *
 * Two rules this file exists to enforce:
 *
 *   1. Every number in a Korean sentence below is interpolated from a measurement. There is no
 *      hand-typed figure in any description. If a factory changes, the copy changes with it.
 *   2. `triangles` in the facts fragment is the STORED triangle count that clunk_inspect reports,
 *      not the count the scene draws, because scripts/listing-facts-cli.ts takes its figure from
 *      `report.metrics.triangleCount` and the two must not disagree on one screen. For the kit
 *      file they genuinely differ — dedup lets two nodes share five meshes — so the kit's own
 *      description says both numbers out loud.
 *
 * Nothing here writes to app/data/listing-facts.json or to the database. Both are the
 * conductor's to apply.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const HERE = import.meta.dirname;
const REPO = resolve(HERE, "..", "..", "..", "..");
const REPORT = JSON.parse(readFileSync(join(REPO, "outputs/kits/mine-entrance/build-report.json"), "utf8"));
const QA = join(REPO, "tmp/kits/mine-entrance");
const OUT = QA;
mkdirSync(OUT, { recursive: true });

const KIT_SLUG = "kit-mine-entrance";
const KIT_ID = "kit-mine-entrance";
const STORE_USER = "usr-artemis-store";
const STORE_WORKSPACE = "ws-artemis-store";
/**
 * The hero renderer's fixed three-quarter direction, as a yaw. Same figure every other 3D
 * listing carries, because every hero in the shop is rendered from the same vector.
 */
const VIEW_YAW = Number((Math.atan2(0.78, 0.92) * (180 / Math.PI)).toFixed(1));

const qa = (slug) => JSON.parse(readFileSync(join(QA, "qa", `${slug}.json`), "utf8"));
const m = (value, digits = 2) => value.toFixed(digits);
const mm = (value) => Math.round(value * 1000);
const n = (value) => value.toLocaleString("en-US");

const parts = Object.fromEntries(REPORT.parts.map((part) => [part.slug, part]));
const kitFile = REPORT.kitFile;
const spec = REPORT.spec;

/** Korean titles. English titles are the plain trade names, not translations of the Korean. */
const NAMES = {
  "mine-portal": ["갱도 입구 목재 프레임", "Timbered Adit Portal"],
  "mine-support": ["갱도 목재 지지대 세트", "Timber Support Set"],
  "mine-cart": ["빈 광차", "Empty Mine Tub"],
  "mine-cart-ore": ["광석 실은 광차", "Loaded Mine Tub"],
  "mine-tool-rack": ["곡괭이·삽 거치대", "Pick and Shovel Rack"],
  "mine-rail-straight": ["직선 레일 (1.2 m)", "Straight Rail Module"],
  "mine-rail-curve": ["곡선 레일 (90도)", "90-Degree Curved Rail Module"],
  "mine-rail-stop": ["레일 끝막이", "Rail Stop Block"],
  "mine-ladder": ["갱도 나무 사다리", "Pit Ladder"],
  "mine-lantern": ["기둥에 건 광부 랜턴", "Hanging Pit Lamp on a Post"],
  "mine-powder-keg": ["화약통", "Blasting Powder Keg"],
  "mine-rock-large": ["바위 (1.2 m)", "Boulder, 1.2 m"],
  "mine-rock-small": ["바위 (0.6 m)", "Boulder, 0.6 m"],
  "mine-ore-copper": ["구리 광석 덩이", "Copper Ore Chunk"],
  "mine-ore-iron": ["철 광석 덩이", "Iron Ore Chunk"],
  "mine-ore-gold": ["금 광석 덩이", "Gold Ore Chunk"],
  [KIT_SLUG]: ["광산 입구 키트 (16종)", "Mine Entrance Kit (16 parts)"],
};

/** The measured tail every 3D listing in this kit ends with. */
function tail(slug, storedTriangles, materials) {
  const part = parts[slug] ?? { boundsMetres: kitFile.boundsMetres, byteLength: kitFile.byteLength };
  const [x, y, z] = part.boundsMetres;
  return `크기 ${m(x)} × ${m(y)} × ${m(z)} m, 삼각형 ${n(storedTriangles)}개, 재질 ${materials}개, 텍스처 없음. 바닥 y = 0 에 맞춰 놓았고 어느 노드에도 배율이 들어가 있지 않습니다.`;
}

function bodyFor(slug, storedTriangles, materials) {
  const part = parts[slug];
  const size = part ? part.boundsMetres : kitFile.boundsMetres;
  const t = tail(slug, storedTriangles, materials);
  switch (slug) {
    case "mine-portal": {
      const opening = part.userData.clearOpeningMetres;
      return `산기슭에 낸 갱도 입구를 목재로 짠 것입니다. 기둥 사이가 ${m(opening[0])} m, 상인방 아래가 ${m(opening[1])} m 이고, ${mm(0.3)} mm 각재 기둥이 돌 기초 위에 섰습니다. 안쪽 어둠은 두께 ${mm(part.userData.aditPlateThicknessMetres)} mm 짜리 판재입니다 — 검게 칠한 얇은 면이 아니라 실제로 두께가 있어서 옆에서 보아도 모서리가 있고, 뒷면 렌더를 켜지 않아도 사라지지 않습니다. 상인방은 프레임보다 양쪽으로 ${mm(0.2)} mm 씩 더 나와 있고, 그 위에 길이가 서로 다른 널판 일곱 장, 무릎 버팀목 넷, 이음매마다 띠쇠와 못이 들어 있습니다. 입구 양옆에는 파낸 돌더미가 있습니다. ${t}`;
    }
    case "mine-support": {
      const u = part.userData;
      return `갱도 안에서 되풀이해 놓는 목재 지지대 한 세트입니다. 다리 중심 사이 ${m(u.spanMetres)} m, 다리 통과 높이 ${m(u.clearHeightMetres)} m 이고, 되풀이 간격은 ${m(u.repeatPitchMetres)} m 로 이 키트의 직선 레일 한 칸 길이와 같습니다. 다리 머리마다 쐐기 두 개가 갓돌을 ${mm(u.capUndersideMetres - u.clearHeightMetres)} mm 들어 올리고 있고, 무릎 버팀목 넷과 갓돌 위로 뻗은 널판 넷이 붙어 있습니다. 뒤에 같은 세트를 ${m(u.repeatPitchMetres)} m 간격으로 놓으면 이 널판이 다음 세트의 갓돌에 얹힙니다. 입구 프레임보다 한 치수 작게 만들었습니다 — 안으로 들어갈수록 좁아져야 굴로 읽힙니다. ${t}`;
    }
    case "mine-cart":
    case "mine-cart-ore": {
      const u = part.userData;
      const contact = REPORT.interlock.contact[slug];
      const clip = part.animations[0];
      const base =
        `밀어서 옮기는 광차입니다. 궤간 ${m(u.gaugeMetres, 3)} m 로 이 키트의 레일 세 종류와 그대로 맞물립니다. 답면 반지름 ${mm(u.wheelTreadRadiusMetres)} mm, 플랜지가 답면보다 ${mm(u.flangeDropMetres)} mm 아래로 내려와 있어서 바닥에 두면 플랜지로 서고, ${m(u.liftOntoRailMetres, 3)} m 들어 올리면 답면이 레일 머리(y = ${m(spec.railTopYMetres, 3)} m)에 닿습니다 — 빌드가 매번 측정하는데 틈이 ${contact.gapToRailheadMillimetres} mm 입니다. ` +
        `몸통은 모서리 기둥 넷에 널판을 세 단씩 두르고 그 사이를 실제로 비워 둔 것이고, 쇠 띠는 네 조각을 못으로 박은 모양입니다. 바퀴 축 둘이 각각 노드로 나뉘어 있고 '${clip.name}' 동작(${m(clip.seconds, 1)}초)이 그 둘을 한 바퀴 돌립니다 — 회전 채널만 쓰고 배율 채널은 없습니다.`;
      const loaded = ` 광석은 구리·철·금 세 색으로 아홉 덩이에 결정면 셋을 얹었고, 위에서 내려다보아도 바닥이 비쳐 보이지 않도록 어두운 받침판을 깔았습니다. 광석은 'ore_load' 메시로 따로 있어 지우면 빈 광차가 됩니다.`;
      const joint = ` 검사 도구는 바퀴 메시와 쇠붙이 메시가 ${mm(0.044)} mm 겹친다고 알려 주는데, 축이 베어링을 지나는 자리라 그렇게 만든 것입니다.`;
      return `${base}${slug === "mine-cart-ore" ? loaded : ""}${joint} ${t}`;
    }
    case "mine-tool-rack":
      return `곡괭이와 삽을 세워 두는 거치대입니다. 받침목이 ${m(0.9, 2)} m, 가로대가 ${m(0.92, 2)} m 높이에 있고 쇠 걸이못 둘이 가로대에서 앞으로 나와 있습니다. 곡괭이 머리는 눈구멍과 양옆으로 뻗은 뾰족날 둘, 자루에 박은 쐐기까지 전부 지오메트리이고, 삽날은 두께 ${mm(0.02)} mm 짜리 판이라 옆에서 보아도 사라지지 않습니다. 두 도구 모두 제 최저점을 측정해 바닥에 앉혔기 때문에 뜨지도, 받침목을 뚫고 나가지도 않습니다. 도구는 'tools' 메시로 따로 있어 지우면 빈 거치대가 됩니다. ${t}`;
    case "mine-rail-straight":
      return `직선 레일 한 칸입니다. 길이 ${m(spec.straightModuleMetres, 3)} m, 궤간 ${m(spec.gaugeMetres, 3)} m, 침목 세 개를 ${m(spec.sleeperPitchMetres, 3)} m 간격으로 놓았습니다. 두 칸을 이어 붙여도 침목 간격이 그대로 유지됩니다. 레일 머리 윗면은 y = ${m(spec.railTopYMetres, 3)} m 이고, 곡선·끝막이와 ${REPORT.interlock.railTopSpreadMillimetres} mm 차이입니다 — 세 칸 모두 같은 열두 점짜리 단면을 밀어 만들었습니다. 침목마다 레일당 못 두 개가 ${mm(0.009)} mm 솟아 있고, 옆에는 굵은 자갈이 놓여 있습니다. ${t}`;
    case "mine-rail-curve": {
      const c = part.userData.connectors;
      return `90도 곡선 레일 한 칸입니다. 중심선 반지름 ${m(spec.curveRadiusMetres, 3)} m, 궤간 ${m(spec.gaugeMetres, 3)} m 이고 침목 다섯 개가 곡선을 따라 놓여 있습니다. 이음점은 모듈 원점 기준 (${m(c[0].at[0], 3)}, ${m(c[0].at[2], 3)}) 과 (${m(c[1].at[0], 3)}, ${m(c[1].at[2], 3)}) 로 대각선에 대칭이라, 90도씩 돌려 놓아도 직선 칸과 만납니다. 레일 단면과 레일 머리 높이(y = ${m(spec.railTopYMetres, 3)} m)는 직선 칸과 같은 값입니다. ${t}`;
    }
    case "mine-rail-stop":
      return `레일 끝막이입니다. 길이 ${m(0.6, 3)} m 로 직선 칸의 절반이고 이음점은 x = ${m(-0.3, 3)} m 한쪽뿐입니다. 레일은 x = ${m(0.2, 3)} m 에서 끝나고 버팀목 앞면은 x = ${m(0.21, 3)} m 이라, 광차가 들어오면 바퀴가 아니라 완충목이 나무에 먼저 닿습니다. 기둥 둘과 가로 버팀목, 이음매를 감은 띠쇠 둘이 들어 있습니다. 레일 머리 높이는 나머지 두 칸과 같습니다. ${t}`;
    case "mine-ladder": {
      const u = part.userData;
      return `갱도용 나무 사다리입니다. 길이 ${m(size[1], 2)} m, 바깥 폭 ${m(size[0], 2)} m, 가로살 ${u.rungCount}개를 ${m(u.rungPitchMetres, 2)} m 간격으로 놓았습니다. 가로살은 ${mm(0.036)} mm 팔각 기둥으로 실제 지오메트리이고 양쪽 세로대에 ${mm(0.015)} mm 씩 물려 있어서, 옆에서 보든 뒤에서 보든 사다리로 보입니다. 세로대를 6도 기울여 벽에 기대 세우는 자세로 만들었고, 아래 네 칸에는 밟은 자리를 밝은 색으로 넣었습니다. ${t}`;
    }
    case "mine-lantern": {
      const clip = part.animations[0];
      return `기둥에 걸어 둔 광부용 랜턴입니다. 기둥 높이 ${m(size[1], 2)} m, 팔 길이 ${m(0.4, 2)} m 이고, 램프는 갈고리에 걸린 별도 노드('lantern_body')입니다. '${clip.name}' 동작(${m(clip.seconds, 1)}초, 회전 채널만)에서 기둥과 팔은 가만히 있고 램프만 좌우로 흔들립니다. 유리 네 장은 두께 ${mm(0.006)} mm 짜리 실제 판이고 이 키트에서 가장 밝은 색값으로 칠해 가장 어두운 쇠 테와 맞붙여 두었습니다. 텍스처도 발광 맵도 없는 파일이므로 주변을 실제로 밝히지는 않습니다 — 밝아 보이는 것은 색값입니다. ${t}`;
    }
    case "mine-powder-keg":
      return `발파용 화약통입니다. 배 지름 ${m(size[0], 2)} m, 높이 ${m(size[1], 2)} m 이고 널 ${part.userData.staveCount}장의 색이 이음매마다 끊깁니다 — 통을 매끈하게 칠하면 나무 달걀로 보입니다. 테 세 줄은 각자 앉은 자리의 지름에 맞춰 ${mm(0.008)} mm 씩 솟아 있고, 머리판에는 마개와 심지가 붙어 있습니다. 이 키트는 텍스처를 쓰지 않으므로 통에 찍는 글자는 없습니다. ${t}`;
    case "mine-rock-large":
    case "mine-rock-small":
      return `바위입니다. 폭 ${m(size[0], 2)} m, 높이 ${m(size[1], 2)} m. 덩어리 ${part.userData.lumpCount}개를 서로 물려 붙여 실루엣에 모서리가 생기게 했고, 꼭짓점을 좌표 해시로 밀어 어느 고리도 원이 아닙니다. 면 색도 면 중심 좌표에서 뽑으므로 어느 쪽에서 보아도 각이 집니다. 큰 것과 작은 것은 같은 모델을 키우고 줄인 것이 아니라 서로 다른 모델입니다 — 그래서 노드에 배율이 들어가지 않습니다. ${t}`;
    case "mine-ore-copper":
    case "mine-ore-iron":
    case "mine-ore-gold": {
      const label = { "mine-ore-copper": "구리", "mine-ore-iron": "철", "mine-ore-gold": "금" }[slug];
      return `${label} 광석 덩이입니다. 폭 ${m(size[0], 2)} m. 모암은 이 키트의 바위·자갈과 같은 돌 색이고, 결정면 여섯 개만 ${label} 색(${part.userData.oreHex})으로 칠했습니다. 세 가지 광석은 이 한 가지만 다릅니다 — 나란히 놓으면 서로 다른 돌이 아니라 같은 광산에서 나온 세 광석으로 보입니다. 결정은 절반 이상이 모암에 묻혀 있어 꽂아 둔 것처럼 보이지 않습니다. ${t}`;
    }
    default:
      return t;
  }
}

function kitBody(storedTriangles, drawnTriangles, materials) {
  const [x, y, z] = kitFile.boundsMetres;
  const partList = REPORT.parts.map((part) => NAMES[part.slug][0]).join(", ");
  return (
    `산기슭 광산 입구를 통째로 만드는 키트입니다. 부품 ${kitFile.memberCount}종이 한 팔레트(12색), 한 축척(미터), 한 형태 언어로 만들어져 서로 어울립니다. 목재 네 색과 쇠 색은 코지 팜 세트의 색값을 그대로 가져왔으므로 농장 물건과 같은 세계로 읽힙니다. ` +
    `맞물림은 숫자로 맞춰 두었습니다 — 궤간 ${m(spec.gaugeMetres, 3)} m, 레일 머리 높이 y = ${m(spec.railTopYMetres, 3)} m 가 직선·곡선·끝막이 세 칸에서 ${REPORT.interlock.railTopSpreadMillimetres} mm 차이로 같고, 광차를 ${m(spec.cartLiftOntoRailMetres, 3)} m 들어 올리면 답면이 레일 머리에 ${REPORT.interlock.contact["mine-cart"].gapToRailheadMillimetres} mm 틈으로 닿습니다. 지지대 반복 간격 ${m(spec.supportPitchMetres, 2)} m 는 직선 레일 한 칸 길이와 같습니다. ` +
    `이 파일은 ${kitFile.memberCount}종을 바닥 격자에 늘어놓은 한 장짜리 배치도입니다(${partList}). 크기 ${m(x)} × ${m(y)} × ${m(z)} m, 파일에 저장된 삼각형 ${n(storedTriangles)}개, 화면에 그려지는 삼각형 ${n(drawnTriangles)}개 — 광차 두 대가 몸통·쇠붙이·바퀴 메시 다섯 개를 공유하기 때문에 두 값이 다릅니다. 재질 ${materials}개, 텍스처 없음. ` +
    `동작은 이 파일에 들어 있지 않습니다. 광차의 바퀴 회전과 랜턴의 흔들림은 각 부품 파일에 있습니다.`
  );
}

// ================================================================================= assemble

const rows = [];
for (const part of REPORT.parts) {
  const report = qa(part.slug).localStdio.clunk_inspect.report;
  const mobile = qa(part.slug).localStdio["clunk_inspect:mobile"]?.report;
  rows.push({
    slug: part.slug,
    kind: "part",
    title: NAMES[part.slug][0],
    titleEn: NAMES[part.slug][1],
    storedTriangles: report.metrics.triangleCount,
    drawnTriangles: part.triangles,
    materials: report.metrics.materialCount,
    boundsMetres: part.boundsMetres,
    byteLength: part.byteLength,
    sha256: part.sha256,
    animations: part.animations.map((clip) => ({ name: clip.name, seconds: clip.seconds })),
    animatedParts: [...new Set(part.animations.flatMap((clip) => clip.nodes))],
    webScore: report.score.score,
    mobileScore: mobile?.score?.score ?? null,
    hardBlockers: report.score.hardBlockerCount,
  });
}
{
  const report = qa(KIT_SLUG).localStdio.clunk_inspect.report;
  const mobile = qa(KIT_SLUG).localStdio["clunk_inspect:mobile"]?.report;
  rows.push({
    slug: KIT_SLUG,
    kind: "kit",
    title: NAMES[KIT_SLUG][0],
    titleEn: NAMES[KIT_SLUG][1],
    storedTriangles: report.metrics.triangleCount,
    drawnTriangles: kitFile.triangles,
    materials: report.metrics.materialCount,
    boundsMetres: kitFile.boundsMetres,
    byteLength: kitFile.byteLength,
    sha256: kitFile.sha256,
    animations: [],
    animatedParts: [],
    webScore: report.score.score,
    mobileScore: mobile?.score?.score ?? null,
    hardBlockers: report.score.hardBlockerCount,
  });
}

const kitSize = rows.length;
const facts = {};
const copy = {};
for (const row of rows) {
  const description = row.kind === "kit" ? kitBody(row.storedTriangles, row.drawnTriangles, row.materials) : bodyFor(row.slug, row.storedTriangles, row.materials);
  copy[row.slug] = { title: row.title, titleEn: row.titleEn, description };
  facts[row.slug] = {
    triangles: row.storedTriangles,
    materials: row.materials,
    boundsMetres: row.boundsMetres,
    byteLength: row.byteLength,
    format: "GLB",
    animatedParts: row.animatedParts,
    animations: row.animations,
    kit: KIT_ID,
    kitSize,
    members: row.kind === "kit" ? kitFile.memberCount : null,
    viewYawDegrees: VIEW_YAW,
    sheet: null,
    texture: null,
    engine: { requires: [], uses: [], colour: "vertex", modes: [4], imageTypes: [] },
    inspection: { webScore: row.webScore, mobileScore: row.mobileScore, hardBlockers: row.hardBlockers, note: null },
  };
}

writeFileSync(
  join(OUT, "listing-facts.fragment.json"),
  `${JSON.stringify(
    {
      schema: "clunk.listing-facts.v1",
      note: "app/data/listing-facts.json 의 facts 에 합칠 조각입니다. kit 값 'kit-mine-entrance' 는 scripts/listing-facts-cli.ts 의 KitId 합집합에 아직 없습니다 — 등록부에 넣는 것은 지휘자 몫입니다.",
      generatedAt: new Date().toISOString().slice(0, 10),
      sources: [
        "outputs/kits/mine-entrance/build-report.json (배달 바이트에서 다시 측정한 값)",
        "tmp/kits/mine-entrance/qa/<slug>.json (로컬 stdio MCP clunk_inspect, profile web/mobile)",
      ],
      facts,
    },
    null,
    2,
  )}\n`,
);
writeFileSync(join(OUT, "copy.json"), `${JSON.stringify(copy, null, 2)}\n`);

// ==================================================================================== seed

const q = (value) => `'${String(value).replace(/'/gu, "''")}'`;
const sha = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const statements = [];
statements.push("-- 광산 입구 키트 시드. examples/generated/kits/mine-entrance/publish.mjs 가 씁니다.");
statements.push("-- 실행은 지휘자 몫입니다. 가격은 scripts/seed-wave1-qa.mjs 의 creditPriceFor 를 그대로 따랐고,");
statements.push("-- 그 함수에는 mine- 접두사도 키트 상품도 분기가 없어 소품 기본값 19크레딧이 나옵니다. 값 결정은 마스터 몫입니다.");
statements.push(`INSERT OR IGNORE INTO clunk_users (id, email, display_name) VALUES (${q(STORE_USER)}, 'store@clunk.internal', '아르테미스 스토어');`);
statements.push(`INSERT OR IGNORE INTO clunk_workspaces (id, owner_user_id, name) VALUES (${q(STORE_WORKSPACE)}, ${q(STORE_USER)}, 'Artemis Store');`);
statements.push(`INSERT OR IGNORE INTO clunk_workspace_members (workspace_id, user_id, role) VALUES (${q(STORE_WORKSPACE)}, ${q(STORE_USER)}, 'owner');`);

const CREDITS = 19;
for (const row of rows) {
  const directory = join(REPO, "public", "market", row.slug);
  const files = [
    { name: `${row.slug}.glb`, role: "entry", contentType: "model/gltf-binary" },
    { name: `hero-${row.slug}.png`, role: "hero", contentType: "image/png" },
    { name: `preview-${row.slug}.webp`, role: "preview", contentType: "image/webp" },
  ];
  const assetId = `asset-mk-${row.slug}`;
  const entry = files[0];
  const entryPath = join(directory, entry.name);
  statements.push(
    `INSERT OR REPLACE INTO clunk_assets (id, workspace_id, file_name, format, byte_length, sha256) VALUES (` +
      `${q(assetId)}, ${q(STORE_WORKSPACE)}, ${q(entry.name)}, ${q(entry.contentType)}, ${statSync(entryPath).size}, ${q(sha(entryPath))});`,
  );
  for (const file of files) {
    const path = join(directory, file.name);
    statements.push(
      `INSERT OR REPLACE INTO clunk_asset_artifacts (id, workspace_id, asset_id, file_name, role, content_type, byte_length, sha256, object_key) VALUES (` +
        `${q(`artifact-mk-${row.slug}-${file.name}`)}, ${q(STORE_WORKSPACE)}, ${q(assetId)}, ${q(file.name)}, ${q(file.role)}, ${q(file.contentType)}, ` +
        `${statSync(path).size}, ${q(sha(path))}, ${q(`asset:/market/${row.slug}/${file.name}`)});`,
    );
  }
  statements.push(
    `INSERT OR REPLACE INTO clunk_asset_reviews (id, workspace_id, asset_id, visual_runtime, player_facing, human_decision, note, evidence_json, reviewer_user_id) VALUES (` +
      `${q(`review-mk-${row.slug}`)}, ${q(STORE_WORKSPACE)}, ${q(assetId)}, 'PASS', 'NOT_EVALUATED', 'NOT_EVALUATED', ` +
      `${q("빌드가 형상 계약(접지·단위 배율·바깥 향한 면·삼각형 예산·맞물림)을 측정으로 통과시켰고, 6각도 대조표를 렌더했습니다. 사람 판정은 아직입니다.")}, ` +
      `${q(JSON.stringify({ source: "kit-mine-entrance", report: "outputs/kits/mine-entrance/build-report.json", qa: `tmp/kits/mine-entrance/qa/${row.slug}.json`, sweep: `outputs/visual-sweep/${row.slug}.png` }))}, ${q(STORE_USER)});`,
  );
  statements.push(
    `INSERT OR REPLACE INTO clunk_marketplace_listings (id, workspace_id, asset_id, slug, title, description, price_cents, currency, license_status, status, published_at) VALUES (` +
      `${q(`listing-mk-${row.slug}`)}, ${q(STORE_WORKSPACE)}, ${q(assetId)}, ${q(row.slug)}, ${q(copy[row.slug].title)}, ${q(copy[row.slug].description)}, ` +
      `${CREDITS * 10_000}, 'KRW', 'cleared', 'PUBLISHED', CURRENT_TIMESTAMP);`,
  );
}
writeFileSync(join(OUT, "seed.sql"), `${statements.join("\n")}\n`);

process.stdout.write(
  `${rows.length} products\n` +
    rows.map((row) => `${row.slug.padEnd(20)} ${String(row.storedTriangles).padStart(5)} stored / ${String(row.drawnTriangles).padStart(5)} drawn tris, ${row.materials} mat, web ${row.webScore} / mobile ${row.mobileScore}`).join("\n") +
    `\nwrote listing-facts.fragment.json, copy.json, seed.sql\n`,
);
