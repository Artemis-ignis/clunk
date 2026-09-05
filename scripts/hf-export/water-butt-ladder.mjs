#!/usr/bin/env node
/**
 * hf-water-butt — 사다리가 공중에 떠 있다.
 *
 * 팔고 있는 파일(public/market/hf-water-butt/farm-water-butt.m1.glb)에서 잰 값:
 *
 *   측주(stile) 2개   17.2 x 684.6 x 17.2 mm,  x ±(67.1..84.3),  y 197.8..882.4
 *   가로대(rung) 4개  151.4 x 16.7 x 19.3 mm,  y 309.9 / 481.8 / 653.8 / 825.8
 *
 *   즉 사다리의 아래 끝이 **지면에서 197.8 mm 위**에서 끝난다. 통 전체 높이가
 *   1,000 mm 이므로 물건 높이의 19.8 % 를 허공에서 시작하는 사다리다. 6각도 렌더의
 *   "뒤" 칸에서 그대로 보인다 — 통은 다리 넷 위에 서 있고, 사다리는 그 다리 사이
 *   허공에 매달려 있다.
 *
 *   원인은 Harvest Frontier 쪽에 있다. props.ts 는 측주를 `bodyBase - 0.05`,
 *   그러니까 통 몸통 바닥보다 50 mm 아래까지만 내린다. 그 게임에서 탱크는 받침대
 *   위에 앉아 있어 그것으로 충분했는데, 파는 파일에서는 통이 다리 넷 위에 서 있고
 *   몸통 바닥이 지면에서 215 mm 다.
 *
 *   고치는 방법: 측주의 아래 네 꼭짓점을 y = 0 까지 내려 사다리가 땅을 딛게 한다
 *   (길이 684.6 -> 882.4 mm). 그러면 아래쪽 310 mm 에 가로대가 하나도 없게 되므로,
 *   맨 위 가로대(825.8 mm — 여기서 통 위로 올라선다)를 고정한 채 나머지 셋을 아래로
 *   옮겨 네 개가 206.45 mm 간격으로 고르게 서게 한다. 가로대 개수·길이·굵기는
 *   그대로다.
 *
 *   삼각형 수는 보존한다. 정점을 옮길 뿐 추가·삭제하지 않는다.
 *
 * 사다리 폭(측주 바깥 168.6 mm, 가로대 151.4 mm)은 **건드리지 않았다.** 이 사다리는
 * HF 에서 0.49 m 폭으로, 지름 1.94 m 짜리 탱크에 붙어 있다(가로대/탱크지름 = 23 %).
 * 파는 파일은 그 탱크를 0.344 배로 줄여 1 m 짜리 빗물통으로 내보낸 것이라, 비율은
 * 그대로이고 절대 치수만 작아졌다(151.4 / 685.5 = 22 %). 폭만 늘리면 이 물건에서만
 * 사다리가 통에 비해 굵어진다. 절대 치수를 키우려면 내보내는 배율을 바꾸는 결정이
 * 필요하므로 마스터 판단으로 올린다.
 *
 * 사용:
 *   node scripts/hf-export/water-butt-ladder.mjs           제자리에서 고친다
 *   node scripts/hf-export/water-butt-ladder.mjs --dry     재기만 한다
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io, mm, apply, invert, flatten, entry, componentsOf, triangleCount } from './glb-surgery.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const DRY = process.argv.includes('--dry');
const IN = args[0] ?? path.join(REPO, 'public/market/hf-water-butt/farm-water-butt.m1.glb');
const OUT = args[1] ?? IN;

const doc = await io.read(IN);
const list = flatten(doc);
const report = {
  input: path.relative(REPO, IN).replace(/\\/g, '/'),
  output: path.relative(REPO, OUT).replace(/\\/g, '/'),
  trianglesBefore: triangleCount(doc),
};

const hardware = entry(list, 'waterButtHardware');
const prim = hardware.node.getMesh().listPrimitives()[0];
const pos = prim.getAttribute('POSITION');
const array = pos.getArray();
const world = (v) => apply(hardware.world, [array[v * 3], array[v * 3 + 1], array[v * 3 + 2]]);
const inv = invert(hardware.world);
const writeWorld = (v, p) => {
  array[v * 3] = inv[0] * p[0] + inv[4] * p[1] + inv[8] * p[2] + inv[12];
  array[v * 3 + 1] = inv[1] * p[0] + inv[5] * p[1] + inv[9] * p[2] + inv[13];
  array[v * 3 + 2] = inv[2] * p[0] + inv[6] * p[1] + inv[10] * p[2] + inv[14];
};

const parts = componentsOf(hardware).map((c) => ({ ...c, size: [0, 1, 2].map((a) => mm(c.box.hi[a] - c.box.lo[a])) }));
/** 측주: 아주 가늘고(17 mm 각) 아주 긴(684 mm) 기둥 둘. */
const stiles = parts.filter((c) => c.size[0] < 25 && c.size[2] < 25 && c.size[1] > 600);
/** 가로대: 길고(151 mm) 얇은(20 mm 이하) 원통 넷. z 는 통 뒤쪽. */
const rungs = parts.filter((c) => c.size[0] > 140 && c.size[0] < 170 && c.size[1] < 25 && c.size[2] < 25 && c.box.hi[2] < -0.3)
  .sort((a, b) => a.box.lo[1] - b.box.lo[1]);
if (stiles.length !== 2) throw new Error(`측주를 2개 찾아야 하는데 ${stiles.length}개다`);
if (rungs.length !== 4) throw new Error(`가로대를 4개 찾아야 하는데 ${rungs.length}개다`);

report.before = {
  stileBottomMm: mm(Math.min(...stiles.map((s) => s.box.lo[1]))),
  stileTopMm: mm(Math.max(...stiles.map((s) => s.box.hi[1]))),
  stileLengthMm: stiles.map((s) => s.size[1]),
  ladderOuterWidthMm: mm(Math.max(...stiles.map((s) => s.box.hi[0])) - Math.min(...stiles.map((s) => s.box.lo[0]))),
  rungCentresMm: rungs.map((r) => mm((r.box.lo[1] + r.box.hi[1]) / 2)),
  rungSpacingMm: rungs.slice(1).map((r, i) => mm((r.box.lo[1] + r.box.hi[1]) / 2 - (rungs[i].box.lo[1] + rungs[i].box.hi[1]) / 2)),
  groundMinYmm: mm(Math.min(...parts.map((p) => p.box.lo[1]))),
};

/* 1. 측주의 아래 끝을 지면(y = 0)까지 내린다. 상자의 아래 네 꼭짓점만 움직인다. */
for (const stile of stiles) {
  const bottom = stile.box.lo[1];
  for (const v of stile.verts) {
    const p = world(v);
    if (p[1] - bottom > 0.001) continue; // 아래 면만
    writeWorld(v, [p[0], 0, p[2]]);
  }
}

/* 2. 맨 위 가로대는 그대로 두고, 나머지 셋을 고른 간격으로 내린다. */
const topCentre = (rungs[3].box.lo[1] + rungs[3].box.hi[1]) / 2;
const step = topCentre / 4;
for (let i = 0; i < 3; i += 1) {
  const rung = rungs[i];
  const centre = (rung.box.lo[1] + rung.box.hi[1]) / 2;
  const delta = step * (i + 1) - centre;
  for (const v of rung.verts) { const p = world(v); writeWorld(v, [p[0], p[1] + delta, p[2]]); }
}
pos.setArray(array);

const after = componentsOf(entry(flatten(doc), 'waterButtHardware')).map((c) => ({ ...c, size: [0, 1, 2].map((a) => mm(c.box.hi[a] - c.box.lo[a])) }));
const stiles2 = after.filter((c) => c.size[0] < 25 && c.size[2] < 25 && c.size[1] > 600);
const rungs2 = after.filter((c) => c.size[0] > 140 && c.size[0] < 170 && c.size[1] < 25 && c.size[2] < 25 && c.box.hi[2] < -0.3)
  .sort((a, b) => a.box.lo[1] - b.box.lo[1]);
report.after = {
  stileBottomMm: mm(Math.min(...stiles2.map((s) => s.box.lo[1]))),
  stileTopMm: mm(Math.max(...stiles2.map((s) => s.box.hi[1]))),
  stileLengthMm: stiles2.map((s) => s.size[1]),
  ladderOuterWidthMm: mm(Math.max(...stiles2.map((s) => s.box.hi[0])) - Math.min(...stiles2.map((s) => s.box.lo[0]))),
  rungCentresMm: rungs2.map((r) => mm((r.box.lo[1] + r.box.hi[1]) / 2)),
  rungSpacingMm: rungs2.slice(1).map((r, i) => mm((r.box.lo[1] + r.box.hi[1]) / 2 - (rungs2[i].box.lo[1] + rungs2[i].box.hi[1]) / 2)),
  groundMinYmm: mm(Math.min(...after.map((p) => p.box.lo[1]))),
};
report.trianglesAfter = triangleCount(doc);
if (report.trianglesAfter !== report.trianglesBefore) throw new Error('삼각형 수가 바뀌었다');
report.widthLeftAlone = {
  ladderOuterWidthMm: report.after.ladderOuterWidthMm,
  rungLengthMm: rungs2[0].size[0],
  buttDiameterMm: 685.5,
  rungOverDiameter: +(rungs2[0].size[0] / 685.5).toFixed(3),
  harvestFrontier: { rungLengthM: 0.44, tankDiameterM: 1.94, ratio: 0.227, displayScale: 0.344 },
  why: '비율은 게임과 같다. 절대 치수만 작은 것이므로 내보내는 배율의 문제이고, 마스터 결정 사항이다.',
};

if (!DRY) {
  await io.write(OUT, doc);
  fs.writeFileSync(
    path.join(REPO, 'examples/harvest-frontier/exports/prop/farm-water-butt.ladder.report.json'),
    JSON.stringify(report, null, 2),
  );
}
process.stdout.write(
  `사다리 아래 끝 ${report.before.stileBottomMm} -> ${report.after.stileBottomMm} mm (지면)\n`
  + `측주 길이 ${report.before.stileLengthMm.join('/')} -> ${report.after.stileLengthMm.join('/')} mm\n`
  + `가로대 높이 ${report.before.rungCentresMm.join(' ')} -> ${report.after.rungCentresMm.join(' ')} mm`
  + ` (간격 ${report.before.rungSpacingMm.join('/')} -> ${report.after.rungSpacingMm.join('/')} mm)\n`
  + `삼각형 ${report.trianglesBefore} -> ${report.trianglesAfter}${DRY ? '  (--dry: 쓰지 않음)' : `  → ${path.relative(REPO, OUT)}`}\n`,
);
