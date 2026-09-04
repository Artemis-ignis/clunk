#!/usr/bin/env node
/**
 * 상품 설명이 파는 부품이 파일 안에 실제로, 보이는 크기로 있는지 본다.
 *
 * 왜 필요한가. 2026-09-04 눈으로 훑어 보니 가장 위험한 결함은 형상이 아니라 약속이었다.
 *
 *   헛간   설명: "다락으로 올라가는 사다리" → 파일에 ladder/stair 노드 0건
 *   농부   이름: "도구 세 가지를 든" → 물뿌리개·바구니·호미가 전부 크기 0으로 눌려 있음
 *
 * 둘 다 형상 감사(asset-geometry-audit)와 색·수치 검사를 전부 통과했다. 그 검사들은
 * 파일 안을 보지만 상품이 무엇을 약속했는지는 안 보기 때문이다. 사는 사람은 반대로
 * 약속을 읽고 산다.
 *
 * 어떻게 보나. 한국어 부품 이름과 파일 안 노드 이름을 잇는 사전을 두고, 설명이나 제목에
 * 그 말이 나오면 파일에 짝이 되는 노드가 있는지, 그리고 **눈에 보이는 크기인지**를 잰다.
 * 크기 0은 게임이 "장착 안 함"을 표현하는 방식이라 노드는 있어도 사는 사람에게는 없다.
 *
 * 사전은 손으로 적는다. 낱말을 기계로 뽑으면 "게임" 같은 말까지 부품으로 세고, 없는 것을
 * 있다고 하거나 있는 것을 없다고 하는 쪽이 더 나쁘다. 새 상품이 오면 여기 한 줄 는다.
 *
 * 사용: node scripts/listing-claim-audit.mjs
 * 필요: CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN (설명문이 D1 에만 있다)
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const D1 = process.env.CLUNK_CF_D1_ID ?? "15b7bd6c-7677-4fe7-b882-5f80a272d6ea";
if (!ACCOUNT || !TOKEN) {
  console.error("CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN 이 필요합니다.");
  process.exit(2);
}

/**
 * 한국어 부품 이름 → 파일 안 노드 이름.
 *
 * `words` 중 하나라도 상품 글에 나오면, `nodes` 중 하나가 파일에 있어야 한다.
 * 글에 안 나오면 아무것도 요구하지 않는다 — 이 검사는 없는 부품을 팔았는지만 본다.
 */
const CLAIMS = [
  { label: "사다리", words: [/사다리/], nodes: /ladder|stair|rung/i },
  { label: "다락", words: [/다락/], nodes: /loft|attic/i },
  { label: "사일로", words: [/사일로/], nodes: /silo/i },
  { label: "굴뚝", words: [/굴뚝/], nodes: /chimney|stack|flue/i },
  { label: "현관", words: [/현관/], nodes: /porch|entry|veranda/i },
  { label: "물뿌리개", words: [/물뿌리개/], nodes: /wateringcan|watering/i },
  { label: "수확 바구니", words: [/바구니/], nodes: /basket/i },
  { label: "호미", words: [/호미/], nodes: /hoe/i },
  { label: "밀짚모자", words: [/밀짚모자|밀짚 모자/], nodes: /hat|straw/i },
  { label: "로터", words: [/로터/], nodes: /rotor|blade|fenestron/i },
  { label: "문", words: [/문이 열리|문 두 짝|여닫|옆문|뒷문/], nodes: /door|hatch|gate/i },
  { label: "창", words: [/창유리|창문|창살/], nodes: /window|pane|glass/i },
  { label: "바퀴", words: [/바퀴/], nodes: /wheel/i },
  { label: "날개", words: [/날개/], nodes: /blade|sail|vane|wing/i },
  { label: "꼭지", words: [/꼭지/], nodes: /tap|spigot|faucet|nozzle/i },
  { label: "뚜껑", words: [/뚜껑/], nodes: /lid|cover|cap/i },
  { label: "경첩", words: [/경첩/], nodes: /hinge|pivot|pintle/i },
  { label: "컨베이어", words: [/컨베이어/], nodes: /conveyor|belt/i },
  { label: "호퍼", words: [/호퍼/], nodes: /hopper/i },
  { label: "탱크", words: [/탱크/], nodes: /tank|vat/i },
  { label: "병입대", words: [/병입/], nodes: /bottl/i },
  { label: "짚단", words: [/짚단|건초 더미|볏단/], nodes: /bale|hay|straw/i },
  { label: "화단", words: [/화단/], nodes: /planter|flower|box/i },
  { label: "기초 돌", words: [/돌 기초|돌을 쌓은|기단/], nodes: /stone|foundation|base|plinth/i },
  { label: "경운 날", words: [/경운|날 부분|보습/], nodes: /tine|sweep|share|blade/i },
  { label: "씨앗 통", words: [/씨앗 통|파종/], nodes: /hopper|seed|opener/i },
];

/** 눈에 보이는 크기인가. 게임은 "장착 안 함" 을 크기 0 으로 쓴다. */
const MIN_VISIBLE_M = 0.005;

async function query(sql) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${D1}/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ sql }),
  });
  const payload = await response.json();
  if (!payload.success) throw new Error(`D1: ${JSON.stringify(payload.errors)}`);
  return payload.result[0].results;
}

/** 파일 안 노드마다 이름과 세상에서의 크기. 크기 0 인 것을 가려내려고 실제로 잰다. */
async function partsOf(path) {
  const { NodeIO } = await import("@gltf-transform/core");
  const { ALL_EXTENSIONS } = await import("@gltf-transform/extensions");
  const { MeshoptDecoder, MeshoptEncoder } = await import("meshoptimizer");
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
  const doc = await io.read(path);
  const parts = [];
  const place = (m, p) => [0, 1, 2].map((i) => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i]);
  // 이름은 메시가 없는 묶음 노드에 붙어 있는 일이 많다 — 파는 파일에서 메시 노드는
  // 재질별로 다시 이름 붙고(`mixerPivot_metal`), 뜻이 담긴 이름은 그 위 묶음
  // (`tank-module`, `conveyor-module`)에 남는다. 메시 있는 노드만 보면 파일에 있는
  // 부품을 없다고 하게 된다. 그래서 모든 노드를 보되, 크기는 그 아래 전부를 합쳐 잰다.
  const walk = (node) => {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    const gather = (current) => {
      const mesh = current.getMesh();
      if (mesh) {
        const world = current.getWorldMatrix();
        for (const prim of mesh.listPrimitives()) {
          const pos = prim.getAttribute("POSITION");
          if (!pos) continue;
          for (let i = 0; i < pos.getCount(); i++) {
            const at = place(world, pos.getElement(i, [0, 0, 0]));
            for (let k = 0; k < 3; k++) {
              if (at[k] < min[k]) min[k] = at[k];
              if (at[k] > max[k]) max[k] = at[k];
            }
          }
        }
      }
      for (const child of current.listChildren()) gather(child);
    };
    gather(node);
    const size = min.every(Number.isFinite) ? Math.max(...[0, 1, 2].map((i) => max[i] - min[i])) : 0;
    parts.push({ name: node.getName() ?? "", size });
    for (const child of node.listChildren()) walk(child);
  };
  for (const scene of doc.getRoot().listScenes()) for (const node of scene.listChildren()) walk(node);
  return parts;
}

/** 상품 폴더의 대표 GLB. */
function entryOf(slug) {
  let names;
  try {
    names = readdirSync(resolve(root, "public/market", slug)).filter((n) => n.toLowerCase().endsWith(".glb"));
  } catch {
    return null;
  }
  if (!names.length) return null;
  const named = names.find((n) => n.replace(/\.[^.]+$/, "") === slug);
  return resolve(root, "public/market", slug, named ?? names[0]);
}

const rows = await query(
  "SELECT slug, title, COALESCE(title_en,'') AS titleEn, description FROM clunk_marketplace_listings WHERE status = 'PUBLISHED' ORDER BY slug",
);

/** 포장이 붙인 이름. 뜻이 담긴 부품 이름으로 치지 않는다. */
const MACHINE_NAME = /^(AuxScene|mesh_|body_|.*batch\d|.*_instance_|.*-root$)/i;

const problems = [];
const unverifiable = [];
let checked = 0;
for (const row of rows) {
  const entry = entryOf(row.slug);
  if (!entry) continue; // 3D 가 아닌 상품
  const parts = await partsOf(entry);
  checked += 1;
  // 파는 파일은 포장하면서 메시를 재질별 덩어리로 합치고(`body_matte`, `barnbatch0`)
  // 그때 부품 이름이 사라진다. 이름이 거의 안 남은 파일에서 "없다"고 말하면 있는 물건을
  // 없다고 하는 것이 된다 — 그쪽이 더 나쁜 거짓말이다. 그런 파일은 따로 센다.
  const meaningful = parts.filter((part) => part.name && !MACHINE_NAME.test(part.name));
  const merged = meaningful.length < 6;
  const text = `${row.title} ${row.titleEn} ${row.description}`;
  for (const claim of CLAIMS) {
    if (!claim.words.some((word) => word.test(text))) continue;
    const named = parts.filter((part) => claim.nodes.test(part.name));
    if (!named.length) {
      // 이름이 없다고 부품이 없는 것은 아니다. 포장이 메시를 재질별 덩어리로 합치면서
      // 이름을 지우기 때문에, 물건은 있는데 이름만 사라진 경우가 흔하다. 그것을 "없다"고
      // 단정하면 있는 물건을 없다고 파는 셈이라 더 나쁜 거짓말이 된다.
      //
      // 그래서 이 검사가 단정하는 것은 하나뿐이다 — 이름은 있는데 크기가 0인 것.
      // 이름을 못 찾은 것은 사람이 눈으로 볼 자리로 넘긴다.
      unverifiable.push(
        `${row.slug}: "${claim.label}" — 이름 붙은 부품으로는 못 찾았습니다` +
          (merged ? " (이 파일은 부품 이름이 통째로 병합돼 있습니다)" : ""),
      );
      continue;
    }
    const visible = named.filter((part) => part.size >= MIN_VISIBLE_M);
    if (!visible.length) {
      problems.push(
        `${row.slug}: "${claim.label}" 가 파일에 있지만 크기가 0 입니다 (${named.map((p) => p.name).slice(0, 3).join(", ")})` +
          " — 노드는 있어도 사는 사람에게는 없습니다",
      );
    }
  }
}

console.log(`3D 상품 ${checked}개의 약속을 파일과 대조했습니다.`);
if (!problems.length && !unverifiable.length) {
  console.log("설명이 파는 부품이 전부 파일에 있고 보입니다.");
  process.exit(0);
}
console.log(`\n지키지 못한 약속 ${problems.length}건:`);
for (const line of problems) console.log(`  ${line}`);
if (unverifiable.length) {
  console.log(`\n눈으로 확인할 것 ${unverifiable.length}건 (이름으로는 못 찾음 — 없다는 뜻이 아닙니다):`);
  for (const line of unverifiable) console.log(`  ${line}`);
  console.log(
    "  → outputs/visual-sweep/<slug>.png 여섯 각도를 보고 판단하세요.\n" +
      "  → 이름이 남아야 사는 사람이 그 부품을 집어 쓸 수 있습니다. 여러 상품이 " +
      "\"부품이 이름 붙은 별도 노드\" 라고 파는 만큼, 포장 단계에서 이름을 살리는 것이 근본 해결입니다.",
  );
}
process.exit(problems.length ? 1 : 0);
