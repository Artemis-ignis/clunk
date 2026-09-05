#!/usr/bin/env node
/**
 * 파는 3D 파일의 부품들이 물리적으로 말이 되는지 본다.
 *
 * 2026-09-04 마스터 지적으로 시작했다. 가공 라인의 컨베이어가 밀폐 탱크를 293 mm 뚫고
 * 지나가고 있었고, 급송 호퍼는 벨트의 반대쪽 끝에 34 mm 떠 있어 쏟으면 기계 밖으로
 * 실려 나갔다. 둘 다 상품 페이지의 뷰어에서 그대로 보이는 것이었다.
 *
 * 세 가지를 본다.
 *
 *   관통    서로 다른 덩어리가 상대를 파고든 것. 같은 덩어리 안에서 클램프가 날개에
 *           박히고 허브캡이 허브에 끼는 것은 조립이므로 세지 않는다. 깊이는 겹친 세 축
 *           가운데 가장 얕은 값으로 재는데, 그것이 "빼내려면 얼마나 밀어야 하는가"다.
 *   떠 있음  아무것과도 닿지 않는 부품. 예전 판은 "바로 아래에 받치는 것이 있는가"만
 *           봤는데, 흙받이는 차체에 옆으로 붙어 있고 바퀴는 축에 매달려 있어서 멀쩡한
 *           부품이 무더기로 걸렸다. 방향을 가리지 않고 닿는 것이 하나도 없을 때만 센다.
 *   묻힘    다른 덩어리 안에 완전히 들어가 보이지 않는 부품. 사는 사람이 삼각형 값을
 *           치르고 아무것도 못 보는 자리다.
 *
 * 옷 입은 캐릭터는 몸이 옷 안에 들어가 있는 것이 정상이라 관통으로 잡힌다. 그건 결함이
 * 아니라 그렇게 만드는 것이므로, 나온 것을 그대로 고치지 말고 무엇인지 보고 판단한다.
 *
 * 상자(AABB)로 잰다. 저폴리 에셋의 부품은 대체로 상자에 가깝고, 삼각형 단위로 재면
 * 부품 수백 개짜리 파일에서 몇 분이 걸린다. 상자가 겹쳐도 실제로는 안 닿는 경우가
 * 있으므로, 나온 것은 사람이 렌더로 확인한다 — 이 검사는 어디를 볼지 알려 주는 것이다.
 *
 * 이 판정은 2026-09-05 에 packages/core/src/geometry-rules.ts 로 옮겨졌다. 거기서는 상자가
 * 아니라 삼각형 대 삼각형으로 재고, 애니메이션 위상까지 돌려 보며, /app 검사기와 두
 * MCP 표면이 같은 findings 를 낸다(GEO-GROUND-CONTACT / GEO-FLOATING-PART /
 * GEO-PART-INTERSECTION / GEO-THIN-SHELL). 이 스크립트는 출력 형식을 그대로 쓰는 곳이
 * 있어 남겨 둔 것이고, 판정 기준을 고칠 일이 있으면 코어 쪽을 고친다.
 *
 * 사용:
 *   node scripts/asset-geometry-audit.mjs                     public/market 전부
 *   node scripts/asset-geometry-audit.mjs hf-processing-line  상품 하나
 *   node scripts/asset-geometry-audit.mjs path/to/file.glb    파일 하나
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dequantize } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { readdirSync } from "node:fs";

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

/** 뚫고 들어간 것으로 셀 최소 깊이. 이보다 얕으면 맞물린 면이지 관통이 아니다. */
const PENETRATION_MM = 40;
/**
 * 관통으로 셀 상대의 최소 크기. 모델 전체 부피의 이만큼을 차지하는 것이 "몸통"이다.
 *
 * 모든 쌍을 보면 조립이 전부 걸린다 — 클램프가 날개에 박히고 볼트가 레일을 지나고
 * 허브캡이 허브에 끼는 것은 그렇게 만들어야 하는 것이다. 사는 사람이 화면에서 잘못됐다고
 * 느끼는 것은 큰 덩어리를 무언가가 뚫고 지나갈 때뿐이다 — 탱크를 통과하는 컨베이어처럼.
 *
 * 4%다. 8%로 뒀더니 이 검사를 만들게 한 바로 그 탱크를 놓쳤다 — 가공 라인의 탱크 몸통은
 * 모델 전체 부피의 7.4%다. 문턱은 잡으려는 것을 실제로 잡는 자리에 둔다.
 */
const BODY_SHARE = 0.04;
/** 부품이 아닌 것들. 충돌용 프록시와 재질별로 쪼개진 조각은 조립을 논할 대상이 아니다. */
const NOT_A_PART = /collider|proxy|^body_|^mesh_\d+_instance_|_metal$|_matte$|_rubber$|_coated$|_glass/i;
/** 닿았다고 볼 틈. 저폴리 조립은 면끼리 딱 붙지 않고 살짝 떨어져 있다. */
const CONTACT_M = 0.025;
/**
 * 관통으로 셀 최소 비율 — 작은 쪽 꼭짓점 가운데 큰 쪽 안에 든 몫.
 *
 * 겹친 깊이(mm)는 큰 판끼리 스칠 때 뜻이 흐려진다. 헛간 지붕과 사일로 사다리는 겹친
 * 상자의 가장 얕은 축이 1.5 m 로 나오지만 실제로 지붕 안에 든 꼭짓점은 245 개 중 3 개,
 * 처마를 스치는 난간이다. 얼마나 깊이 박혔느냐가 아니라 얼마나 많이 들어갔느냐가 신호다.
 */
const INSIDE_SHARE = 0.05;

const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c += 1) for (let r = 0; r < 4; r += 1)
    for (let k = 0; k < 4; k += 1) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
const apply = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];

/**
 * 한 노드가 실제로 서 있는 자리들. 보통은 하나지만, EXT_mesh_gpu_instancing 을 쓰는
 * 노드는 같은 메시를 여러 자리에 세운다.
 *
 * 이걸 빠뜨리면 인스턴스로 놓인 부품이 전부 원점 근처에 있는 것으로 읽혀 아무 데도
 * 안 닿는다 — 이 검사를 만들게 한 탱크 관통이 그래서 안 잡혔다.
 */
function placementsOf(node, world) {
  const inst = node.getExtension("EXT_mesh_gpu_instancing");
  if (!inst) return [world];
  const t = inst.getAttribute?.("TRANSLATION");
  const r = inst.getAttribute?.("ROTATION");
  const sc = inst.getAttribute?.("SCALE");
  const count = t?.getCount() ?? r?.getCount() ?? sc?.getCount() ?? 0;
  if (!count) return [world];
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const [tx, ty, tz] = t ? t.getElement(i, [0, 0, 0]) : [0, 0, 0];
    const [qx, qy, qz, qw] = r ? r.getElement(i, [0, 0, 0, 1]) : [0, 0, 0, 1];
    const [sx, sy, sz] = sc ? sc.getElement(i, [1, 1, 1]) : [1, 1, 1];
    // 쿼터니언 → 3×3, 열 우선 4×4 로.
    const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
    const xx = qx * x2, xy = qx * y2, xz = qx * z2;
    const yy = qy * y2, yz = qy * z2, zz = qz * z2;
    const wx = qw * x2, wy = qw * y2, wz = qw * z2;
    const m = [
      (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
      (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
      (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
      tx, ty, tz, 1,
    ];
    out.push(mul(world, m));
  }
  return out;
}

/** 부품마다 세계 좌표 상자. 이름과, 어느 덩어리에 속하는지도 같이 들고 온다. */
function partsOf(doc) {
  const out = [];
  const walk = (node, parentMatrix, ancestry) => {
    const world = mul(parentMatrix, node.getMatrix());
    const mesh = node.getMesh();
    if (mesh) {
      const lo = [Infinity, Infinity, Infinity];
      const hi = [-Infinity, -Infinity, -Infinity];
      let tris = 0;
      const seats = placementsOf(node, world);
      const points = [];
      const faces = [];
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        const idx = prim.getIndices();
        tris += ((idx ? idx.getCount() : pos.getCount()) / 3) * seats.length;
        for (const seat of seats) {
          const base = points.length;
          for (let i = 0; i < pos.getCount(); i += 1) {
            const p = apply(seat, pos.getElement(i, [0, 0, 0]));
            points.push(p);
            for (let k = 0; k < 3; k += 1) {
              if (p[k] < lo[k]) lo[k] = p[k];
              if (p[k] > hi[k]) hi[k] = p[k];
            }
          }
          const n = idx ? idx.getCount() : pos.getCount();
          for (let i = 0; i < n; i += 3) {
            faces.push([
              base + (idx ? idx.getScalar(i) : i),
              base + (idx ? idx.getScalar(i + 1) : i + 1),
              base + (idx ? idx.getScalar(i + 2) : i + 2),
            ]);
          }
        }
      }
      out.push({
        name: node.getName() || mesh.getName() || "(이름 없음)",
        lo, hi, tris: Math.round(tris), ancestry, points, faces,
        /* 덩어리 = 이 부품을 감싸는 가장 가까운 이름 붙은 묶음.
           조상 목록은 뿌리부터라 앞에서 찾으면 `processing-root` 가 먼저 걸려 모델의 모든
           부품이 한 덩어리가 된다 — 그러면 서로 다른 덩어리끼리의 관통을 영영 못 잡는다.
           안쪽부터 찾고, 뿌리는 덩어리로 치지 않는다. */
        group: [...ancestry].reverse().find((a) => /-module$|-network$|-panel$|-crates$|Group$/.test(a ?? ""))
          ?? ancestry[ancestry.length - 1] ?? null,
      });
    }
    for (const child of node.listChildren()) walk(child, world, [...ancestry, node.getName()]);
  };
  for (const scene of doc.getRoot().listScenes())
    for (const node of scene.listChildren()) walk(node, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], []);
  return out;
}

const size = (b, k) => Math.max(0, b.hi[k] - b.lo[k]);
const vol = (b) => size(b, 0) * size(b, 1) * size(b, 2);
const gapOn = (a, b, k) => Math.max(a.lo[k], b.lo[k]) - Math.min(a.hi[k], b.hi[k]);
/** 겹친 세 축 가운데 가장 얕은 값. 빼내려면 그만큼만 밀면 된다. */
const penetration = (a, b) => {
  let least = Infinity;
  for (let k = 0; k < 3; k += 1) {
    const over = Math.min(a.hi[k], b.hi[k]) - Math.max(a.lo[k], b.lo[k]);
    if (over <= 0) return 0;
    least = Math.min(least, over);
  }
  return least;
};
/**
 * 점 하나가 메시 안에 있는지. +x 로 광선을 쏘아 면을 몇 번 지나는지 센다 — 홀수면 안이다.
 *
 * 상자만으로는 못 가른다. 기울어진 컨베이어의 상자는 벨트 위 허공을 통째로 포함하고,
 * 원기둥인 탱크의 상자는 네 귀퉁이가 탱크 밖인데도 안이라고 답한다. 상자로 후보를
 * 추리고 여기서 실제 면을 본다.
 */
function pointInMesh(point, host) {
  let crossings = 0;
  const [px, py, pz] = point;
  for (const [i0, i1, i2] of host.faces) {
    const a = host.points[i0];
    const b = host.points[i1];
    const c = host.points[i2];
    // yz 평면에서 삼각형이 점을 감싸는지 먼저 보고, 감쌀 때만 x 를 푼다.
    const d = (b[1] - c[1]) * (a[2] - c[2]) - (b[2] - c[2]) * (a[1] - c[1]);
    if (Math.abs(d) < 1e-12) continue;
    const u = ((b[1] - c[1]) * (pz - c[2]) - (b[2] - c[2]) * (py - c[1])) / d;
    const v = ((c[1] - a[1]) * (pz - c[2]) - (c[2] - a[2]) * (py - c[1])) / d;
    const w = 1 - u - v;
    if (u < 0 || v < 0 || w < 0) continue;
    const x = u * a[0] + v * b[0] + w * c[0];
    if (x > px) crossings += 1;
  }
  return crossings % 2 === 1;
}

/** 작은 쪽 꼭짓점 가운데 큰 쪽 안에 들어간 개수. 표본을 두어 큰 파일에서도 몇 초에 끝난다. */
function verticesInside(through, body, sample = 240) {
  const step = Math.max(1, Math.floor(through.points.length / sample));
  let inside = 0;
  let looked = 0;
  for (let i = 0; i < through.points.length; i += step) {
    looked += 1;
    if (pointInMesh(through.points[i], body)) inside += 1;
  }
  return { inside, looked };
}

const touching = (a, b) => [0, 1, 2].every((k) => gapOn(a, b, k) <= CONTACT_M);
const insideOf = (small, big) => [0, 1, 2].every((k) => small.lo[k] >= big.lo[k] - 1e-4 && small.hi[k] <= big.hi[k] + 1e-4);
const related = (a, b) => a.ancestry.includes(b.name) || b.ancestry.includes(a.name);

export function auditParts(all) {
  // 재질별로 통째 합쳐진 덩어리는 모델 전체를 덮어 모든 부품을 자기 안에 넣는다.
  // 그건 결함이 아니라 묶는 방식이므로 겹침 판정에서 뺀다.
  const whole = (() => {
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (const p of all) for (let k = 0; k < 3; k += 1) { lo[k] = Math.min(lo[k], p.lo[k]); hi[k] = Math.max(hi[k], p.hi[k]); }
    return vol({ lo, hi });
  })();
  const parts = all.filter((p) => vol(p) > 1e-9 && vol(p) < whole * 0.25 && !NOT_A_PART.test(p.name));
  const batched = all.length - parts.length;

  const findings = [];
  /* 닿았는지는 걸러낸 조각까지 넣고 본다. 재질별로 쪼개진 몸통이나 충돌 프록시도 부품이
     기대어 서 있을 수 있는 실체이고, 그것을 빼면 멀쩡히 붙어 있는 부품이 떠 있다고 나온다. */
  const contact = new Set();
  for (const a of parts) {
    for (const b of all) {
      if (a === b || a.name === b.name) continue;
      if (touching(a, b)) { contact.add(a.name); break; }
    }
  }
  for (let i = 0; i < parts.length; i += 1) {
    for (let j = i + 1; j < parts.length; j += 1) {
      const a = parts[i];
      const b = parts[j];
      if (related(a, b)) continue;
      if (a.group && b.group && a.group === b.group) continue;
      const deep = penetration(a, b);
      if (deep <= 0) continue;
      const large = Math.max(vol(a), vol(b));
      if (large / whole < BODY_SHARE) continue;        // 몸통을 뚫은 것만 결함으로 센다
      if (deep * 1000 < PENETRATION_MM) continue;
      const [body, through] = vol(a) >= vol(b) ? [a, b] : [b, a];
      const { inside, looked } = verticesInside(through, body);
      if (!inside || inside / looked < INSIDE_SHARE) continue;   // 스친 것은 관통이 아니다
      findings.push({
        kind: "관통", a: through.name,
        b: `${body.name} 안으로 · 꼭짓점 ${inside}/${looked} (${((inside / looked) * 100).toFixed(0)}%)`,
        rank: inside / looked, mm: deep * 1000,
      });
    }
  }
  for (const p of parts) {
    if (!contact.has(p.name)) findings.push({ kind: "떠 있음", a: p.name, b: "아무것과도 닿지 않음", rank: 0.5, mm: 0 });
    /* 상자가 상자 안에 들어갔다고 묻힌 것은 아니다 — 기울어진 컨베이어의 상자는 벨트 위
       허공을 통째로 품는다. 실제 면으로 다시 본다. */
    const host = parts.find((o) => o !== p && !related(p, o) && o.group !== p.group && insideOf(p, o)
      && verticesInside(p, o).inside > 0);
    if (host) findings.push({ kind: "묻힘", a: p.name, b: `${host.name} 안에 완전히 들어감 · 삼각형 ${p.tris}`, rank: 1, mm: 0 });
  }
  return { parts: parts.length, batched, findings };
}

async function auditFile(label, file) {
  const doc = await io.read(file);
  await doc.transform(dequantize());
  const { parts, batched, findings } = auditParts(partsOf(doc));
  const head = `${label.padEnd(26)} 부품 ${String(parts).padStart(4)}${batched ? ` (덩어리 ${batched} 제외)` : ""}`;
  if (!findings.length) { console.log(`${head} · 이상 없음`); return 0; }
  console.log(`${head} · 지적 ${findings.length}`);
  for (const f of findings.sort((x, y) => (y.rank ?? 0) - (x.rank ?? 0) || y.mm - x.mm).slice(0, 10))
    console.log(`   ${f.kind}  ${f.a} ↔ ${f.b}${f.mm ? ` · ${f.mm.toFixed(0)}mm` : ""}`);
  if (findings.length > 10) console.log(`   … 그 밖에 ${findings.length - 10}건`);
  return findings.length;
}

const args = process.argv.slice(2);
const files = args.filter((a) => a.endsWith(".glb"));
const slugs = args.filter((a) => !a.endsWith(".glb"));
let total = 0;
for (const file of files) total += await auditFile(file.split(/[\\/]/).pop(), file);
for (const slug of (slugs.length || files.length ? slugs : readdirSync("public/market").sort())) {
  let names;
  try { names = readdirSync(`public/market/${slug}`); } catch { continue; }
  const glb = names.find((n) => n.replace(/\.[^.]+$/, "") === slug && n.endsWith(".glb"))
    ?? (names.filter((n) => n.toLowerCase().endsWith(".glb")).length === 1
      ? names.find((n) => n.toLowerCase().endsWith(".glb")) : null);
  if (glb) total += await auditFile(slug, `public/market/${slug}/${glb}`);
}
console.log(total ? `\n지적 ${total}건` : "\n이상 없음");
