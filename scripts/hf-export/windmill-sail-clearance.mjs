/**
 * hf-windmill — 도는 날개와 나머지 전부 사이의 간격, 48 위상.
 *
 * 왜 이 도구가 필요한가. 상품 설명은 "도는 날개와 지붕 사이는 24위상 내내 최소
 * 143.8 mm 떨어져 있습니다"라고 적혀 있다. 그 값은 맞다 — 아래 표의
 * sailLattice x roofCone 이 정확히 143.8 mm 다. 다만 그 문장은 (a) 지붕만 재고 탑·난간·
 * 문·창을 재지 않았으며, (b) 격자만 재고 격자를 매단 날개대(whip)를 재지 않았다.
 * 날개대는 지붕에 65.7 mm 까지 다가간다. 재지 않은 것을 안 재었다고 말하지 않는 문장은
 * 참이면서도 사는 사람을 오해하게 한다. 그래서 이 도구는 도는 쪽 전부 x 서 있는 쪽
 * 전부를 잰다.
 *
 * 회전축을 어디로 두느냐가 답을 통째로 바꾼다 — 이것이 이 파일에서 가장 중요한 사실이다.
 *
 *   `blades_pivot` 은 자기 로컬 z 축을 돈다. 그 부모 `blades_tilt` 는 x 축으로 -10 도
 *   기울어 있으므로(로컬 행렬 R = [-0.08716, 0, 0, 0.99619]), 실제 회전축은 기울어진
 *   샤프트다. `windmillShaftSleeve` 가 바로 그 축에 놓여 있어 확인이 된다.
 *
 *   기울기를 빼고 — 즉 허브를 지나는 월드 수직면의 z 축으로 — 날개를 돌리면 완전히
 *   다른 그림이 나온다. 180도 위상에서 격자 정점 하나가 탑 축에서 800.6 mm 지점에
 *   놓이고(y = 1751.5 mm), 그 높이의 탑 반지름은 992.7 mm 이므로 192.1 mm 를 파고든다.
 *   난간까지는 105도 위상에서 정점 대 정점 16.5 mm 가 된다.
 *
 *   그 두 수(192 mm, 16.5 mm)는 이 파일을 잘못된 축으로 잰 결과다. 파일이 실제로 도는
 *   축으로 재면 날개는 48 위상 어디서도 탑에 닿지 않고, 가장 가까운 순간이 206.7 mm,
 *   난간까지는 219.9 mm 다. `--wrong-axis` 로 두 계산을 나란히 찍을 수 있게 해 두었으니
 *   숫자가 어긋날 때 어느 쪽을 본 것인지 바로 가려낼 수 있다.
 *
 * 붙어 있는 것으로 나오는 세 쌍은 결함이 아니라 이음매다: hubBarrel x
 * windmillShaftSleeve 와 sailWhips x windmillShaftSleeve 는 허브가 샤프트에 끼워진
 * 자리이고, hubBarrel x roofCone 은 그 샤프트가 지붕을 뚫고 나오는 자리다(허브 뒤쪽
 * 테두리가 지붕면 안으로 25.2 mm 들어가 있다).
 *
 * 아무것도 고치지 않는다. 재고 표를 남길 뿐이다.
 *
 * 사용:
 *   node scripts/hf-export/windmill-sail-clearance.mjs [file.glb] [phases] [--wrong-axis]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  io, flatten, entry, descendants, apply, mul, invert, bounds, componentsOf, ownTris, soupDist, mm,
} from './glb-surgery.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const FILE = process.argv.find((a) => a.endsWith('.glb')) ?? path.join(REPO, 'public/market/hf-windmill/farm-windmill.m1.glb');
const PHASES = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 48);
const WRONG = process.argv.includes('--wrong-axis');

const doc = await io.read(FILE);
const list = flatten(doc);
const pivot = entry(list, 'blades_pivot');
const inPivot = descendants(pivot);
const Rz = (a) => [Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/* 도는 쪽은 blades_pivot 자기 프레임에 담아 둔다. 위상마다 Rz 만 갈아 끼우면 된다. */
const toPivot = invert(pivot.parentWorld);
const rotating = [];
const statics = [];
for (const e of list) {
  if (!e.node.getMesh()) continue;
  const frame = inPivot.has(e.node) ? mul(toPivot, e.world) : e.world;
  for (const c of componentsOf({ ...e, world: frame })) {
    const tris = [];
    const prim = c.prim;
    const a = prim.getAttribute('POSITION').getArray();
    const idx = prim.getIndices();
    const ix = idx ? idx.getArray() : Array.from({ length: prim.getAttribute('POSITION').getCount() }, (_, i) => i);
    const own = new Set(c.verts);
    for (let i = 0; i < ix.length; i += 3) {
      if (!own.has(ix[i])) continue;
      tris.push([0, 1, 2].map((k) => apply(frame, [a[ix[i + k] * 3], a[ix[i + k] * 3 + 1], a[ix[i + k] * 3 + 2]])));
    }
    (inPivot.has(e.node) ? rotating : statics).push({ owner: e.name, box: c.box, tris });
  }
}

/* 이름은 실측한 상자에서 붙인다. windmillHardware 는 22개 부품이 한 메시로 녹아 있어
   이름이 남아 있지 않다 — 아래 값은 이 파일에서 잰 것이고, 어긋나면 라벨이 아니라
   상자 그대로 찍힌다. */
const nameRotating = (c) => {
  if (c.owner === 'windmillSailLattice') return 'sailLattice';
  if (c.box.hi[0] - c.box.lo[0] > 3.0) return 'sailWhips';
  return c.box.lo[2] < 1.0 ? 'hubBarrel' : 'hubCap';
};
const nameStatic = (c) => {
  if (c.owner !== 'windmillHardware') return c.owner;
  const y = [mm(c.box.lo[1]), mm(c.box.hi[1])];
  const w = mm(c.box.hi[0] - c.box.lo[0]);
  if (y[0] > 1928 && y[1] < 2013) return 'balconyRail';
  if (y[0] > 1529 && y[1] < 1971) return 'balconyBracket';
  if (y[0] > 4369 && y[1] < 4511) return 'roofFinial';
  if (y[0] > 3469 && y[1] < 4421) return 'roofCone';
  if (y[0] > 3439 && y[1] < 3601) return 'roofEaves';
  if (y[0] > 539 && y[1] < 661) return 'baseRim';
  if (y[0] > 19 && y[1] < 571) return 'baseSkirt';
  if (y[0] > -1 && y[1] < 199) return 'groundRock';
  if (y[0] > 2327 && y[1] < 2813 && w > 300) return 'windowFrameZ';
  if (y[0] > 2386 && y[1] < 2754) return 'windowGlassZ';
  return `hardware(y ${y[0]}..${y[1]})`;
};
const fold = (items, namer) => {
  const m = new Map();
  for (const c of items) { const n = namer(c); if (!m.has(n)) m.set(n, []); m.get(n).push(...c.tris); }
  return [...m.entries()].map(([name, tris]) => ({ name, tris }));
};
const R = fold(rotating, nameRotating);
const S = fold(statics, nameStatic);

const report = { file: path.relative(REPO, FILE), phases: PHASES, ranAt: new Date().toISOString() };
report.rotating = R.map((r) => ({ part: r.name, triangles: r.tris.length }));
report.static = S.map((s) => ({ part: s.name, triangles: s.tris.length }));

const rows = [];
for (const r of R) {
  for (const s of S) {
    let best = Infinity; let at = null;
    for (let k = 0; k < PHASES; k += 1) {
      const th = (k / PHASES) * Math.PI * 2;
      const M = mul(pivot.parentWorld, Rz(th));
      const moved = r.tris.map((t) => t.map((p) => apply(M, p)));
      const d = soupDist(moved, s.tris, best + 1e-9);
      if (d < best) { best = d; at = Math.round((th * 180) / Math.PI); if (best === 0) break; }
    }
    rows.push({ rotating: r.name, static: s.name, minGapMm: mm(best), atPhaseDeg: at });
  }
}
rows.sort((a, b) => a.minGapMm - b.minGapMm);
report.clearances = rows;
const JOINTS = new Set(['hubBarrel|windmillShaftSleeve', 'sailWhips|windmillShaftSleeve', 'hubBarrel|roofCone', 'hubCap|windmillShaftSleeve']);
report.worstThatIsNotAJoint = rows.filter((r) => !JOINTS.has(`${r.rotating}|${r.static}`))[0];
report.sailsOnly = ['sailLattice', 'sailWhips'].map((n) => {
  const r = rows.filter((x) => x.rotating === n && x.static !== 'windmillShaftSleeve')[0];
  return { rotating: n, closestTo: r.static, minGapMm: r.minGapMm, atPhaseDeg: r.atPhaseDeg };
});

if (WRONG) {
  /* 기울기를 무시하고 허브를 지나는 월드 z 축으로 돌렸을 때. 설명서에 적힌 수가 여기서 나온다. */
  const hub = [pivot.world[12], pivot.world[13], pivot.world[14]];
  const T = (t) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t[0], t[1], t[2], 1];
  const tower = entry(list, 'windmillTower');
  const tb = bounds(ownTris(tower).flat());
  const rTop = Math.max(...ownTris(tower).flat().filter((p) => p[1] > tb.hi[1] - 0.001).map((p) => Math.hypot(p[0], p[2])));
  const rBot = Math.max(...ownTris(tower).flat().filter((p) => p[1] < tb.lo[1] + 0.001).map((p) => Math.hypot(p[0], p[2])));
  const towerR = (y) => rBot + ((rTop - rBot) * (y - tb.lo[1])) / (tb.hi[1] - tb.lo[1]);
  const sailVerts = rotating.flatMap((c) => c.tris.flat().map((p) => apply(pivot.parentWorld, p)));
  const rail = statics.filter((c) => nameStatic(c) === 'balconyRail').flatMap((c) => c.tris.flat());
  /* 비교는 미터 그대로 하고 밀리미터는 마지막에만 만든다 — 반올림한 값과 원값을 섞어
     비교하면 첫 정점 이후로는 아무것도 갱신되지 않는다. */
  let worstTower = { inside: -Infinity };
  let worstRail = { gap: Infinity };
  for (let k = 0; k < PHASES; k += 1) {
    const th = (k / PHASES) * Math.PI * 2;
    const M = mul(T(hub), mul(Rz(th), T([-hub[0], -hub[1], -hub[2]])));
    const deg = Math.round((th * 180) / Math.PI);
    for (const v of sailVerts) {
      const w = apply(M, v);
      if (w[1] >= tb.lo[1] && w[1] <= tb.hi[1]) {
        const inside = towerR(w[1]) - Math.hypot(w[0], w[2]);
        if (inside > worstTower.inside) worstTower = { inside, atPhaseDeg: deg, radial: Math.hypot(w[0], w[2]), y: w[1], towerRadius: towerR(w[1]) };
      }
      for (const q of rail) {
        const d = Math.hypot(w[0] - q[0], w[1] - q[1], w[2] - q[2]);
        if (d < worstRail.gap) worstRail = { gap: d, atPhaseDeg: deg };
      }
    }
  }
  report.ifSpunAboutTheWrongAxis = {
    what: 'blades_tilt의 -10도를 빼고 허브를 지나는 월드 z 축으로 돌린 경우',
    towerDeepestInsideMm: { insideMm: mm(worstTower.inside), atPhaseDeg: worstTower.atPhaseDeg, radialMm: mm(worstTower.radial), atYmm: mm(worstTower.y), towerRadiusMm: mm(worstTower.towerRadius) },
    railNearestVertexToVertexMm: { gapMm: mm(worstRail.gap), atPhaseDeg: worstRail.atPhaseDeg },
    note: '상품 설명과 결함 보고서의 192 mm / 16.5 mm 가 이 계산과 일치한다. 파일이 실제로 도는 축으로 재면 탑까지 206.7 mm, 난간까지 219.9 mm 다.',
  };
}

const OUT = path.join(REPO, 'outputs/gauge-wheel-repair/windmill-sail-clearance.json');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

process.stdout.write(`${report.file}  ${PHASES} phases\n`);
process.stdout.write('rotating part      static part            minGap(mm)  atPhase\n');
for (const r of rows.slice(0, 14)) {
  const joint = JOINTS.has(`${r.rotating}|${r.static}`) ? '   <- joint, not a clearance' : '';
  process.stdout.write(`${r.rotating.padEnd(18)} ${r.static.padEnd(22)} ${String(r.minGapMm).padStart(10)} ${String(r.atPhaseDeg).padStart(8)}${joint}\n`);
}
if (WRONG) process.stdout.write(`\nwrong-axis reproduction: tower inside by ${report.ifSpunAboutTheWrongAxis.towerDeepestInsideMm.insideMm} mm at ${report.ifSpunAboutTheWrongAxis.towerDeepestInsideMm.atPhaseDeg} deg, rail ${report.ifSpunAboutTheWrongAxis.railNearestVertexToVertexMm.gapMm} mm at ${report.ifSpunAboutTheWrongAxis.railNearestVertexToVertexMm.atPhaseDeg} deg\n`);
process.stdout.write(`report outputs/gauge-wheel-repair/windmill-sail-clearance.json\n`);
