#!/usr/bin/env node
/**
 * hf-player-farmhand — 2026-09-05 수리 한 판.
 *
 * 마스터가 "너무 퀄리티 떨어진다"고 한 뒤, 팔고 있는 파일
 * (public/market/hf-player-farmhand/player-farmhand.m1.glb)을 6각도로 렌더해 놓고
 * 1024 px 히어로 이미지를 부위별로 확대해 봤다. 눈에 보이면서 파일에서 숫자로 잴 수
 * 있는 결함은 둘이었다: 부츠가 널빤지 위에 서 있는 것과, 재킷 앞면의 잔부품 넷이
 * 몸에 닿지 않고 떠 있는 것.
 *
 *   (1) 부츠가 널빤지 위에 서 있다.
 *
 *   부츠는 가죽 덩어리 셋(앞코 190x142x184, 몸통 208x208x286, 뒤축 184x82x108)으로
 *   된 모따기 형상인데, 그 안에 든 밑창(225.3 x 46 x 387.3 mm, 거의 검정 #2c251d)과
 *   웰트(210.9 x 26 x 362.6 mm, 밝은 갈색 #9c7c58)는 축에 정렬된 직육면체다.
 *   가죽의 XZ 볼록 껍질에 대고 재면 두 상자의 정점 36개가 전부 껍질 밖에 있고,
 *   가장 많이 나간 곳이 밑창 24.8 mm · 웰트 13.8 mm다(둘 다 앞코 모서리).
 *
 *   2026-09-03 판 player-postprocess.mts 는 이 둘을 이미 한 번 줄였지만 AABB 로
 *   판정했다. 모따기된 신발의 AABB 안에 들어간 직육면체는 여전히 모서리가 밖으로
 *   튀어나온다 — 히어로 이미지에서 부츠 뒤·옆으로 삐져나온 검은 판이 그것이다.
 *
 *   고치는 방법: 두 상자를 가죽 발자국의 중심으로 옮기고, XZ 를 한 비율로 줄여
 *   가장 많이 나간 정점이 정해진 립(lip)이 되게 한다. 밑창 3.0 mm, 웰트 1.5 mm —
 *   0 으로 만들면 둘 다 가죽 안에 묻혀 보이지 않게 되고(삼각형 값을 치르고 아무것도
 *   못 보는 자리), 부츠는 갈색 덩어리 하나가 된다. 옆에서 보면 가죽 → 웰트 실선 →
 *   밑창 테두리 순서로 읽힌다. Y 는 건드리지 않는다: 밑창 바닥(y 8 mm)을 지면으로
 *   내리면 앞코 블록의 밑면과 같은 평면이 되어 z-fighting 이 된다.
 *
 *   (2) 재킷 앞면의 옆솔기 둘과 놋쇠 단추 둘이 몸에 닿지 않는다 — 아래
 *   "재킷의 잔부품이 공중에 떠 있다" 절에 측정값과 함께 적었다.
 *
 * 손대지 않은 것과 그 이유는 보고서의 `notFixed` 에 적는다.
 *
 * 삼각형 수는 보존한다. 정점을 옮길 뿐 추가·삭제·병합하지 않는다.
 *
 * 사용:
 *   node scripts/hf-export/farmhand-repair.mjs                 제자리에서 고친다
 *   node scripts/hf-export/farmhand-repair.mjs <in> <out>      경로를 직접 준다
 *   node scripts/hf-export/farmhand-repair.mjs --dry           재기만 한다
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io, mm, apply, invert, flatten, entry, componentsOf, triangleCount, triTriDist, triBox, boxGap } from './glb-surgery.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const DRY = process.argv.includes('--dry');
const IN = args[0] ?? path.join(REPO, 'public/market/hf-player-farmhand/player-farmhand.m1.glb');
const OUT = args[1] ?? IN;

/** 밑창·웰트가 가죽 밖으로 남길 립. 0 이면 묻혀서 안 보인다. */
const SOLE_LIP_MM = 3.0;
const WELT_LIP_MM = 1.5;
/** 가죽 실루엣을 재는 높이. 이보다 위는 바지 커프스라 발자국이 아니다. */
const FOOTPRINT_MAX_Y = 0.13;

const doc = await io.read(IN);
const list = flatten(doc);
const report = {
  input: path.relative(REPO, IN).replace(/\\/g, '/'),
  output: path.relative(REPO, OUT).replace(/\\/g, '/'),
  trianglesBefore: triangleCount(doc),
};

/* ------------------------------------------------------ XZ 볼록 껍질과 그 밖 거리 */
function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  const upper = [];
  for (let i = p.length - 1; i >= 0; i -= 1) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}
/** 껍질 밖이면 양수(밖으로 나간 거리, m), 안이면 음수. */
function outside(h, q) {
  let best = -Infinity;
  for (let i = 0; i < h.length; i += 1) {
    const a = h[i]; const b = h[(i + 1) % h.length];
    const nx = b[1] - a[1]; const nz = -(b[0] - a[0]);
    const L = Math.hypot(nx, nz);
    const d = ((q[0] - a[0]) * nx + (q[1] - a[1]) * nz) / L;
    if (d > best) best = d;
  }
  return best;
}
const centroid = (h) => {
  let x = 0; let z = 0;
  for (const p of h) { x += p[0]; z += p[1]; }
  return [x / h.length, z / h.length];
};

/* ---------------------------------------------------------------- 밑창 · 웰트 refit */
/*
 * 두 정강이는 같은 POSITION accessor 를 쓴다 — 부츠 둘은 좌우 대칭이 아니라 같은
 * 형상을 x 로 ±125 mm 옮겨 놓은 것이고, glTF-Transform 이 그 accessor 를 하나로
 * 합쳐 두었다. 그래서 한쪽을 고치면 반대쪽도 같이 고쳐진다. 그것이 원하는 결과이지만,
 * 같은 배열을 두 번 재면 두 번째 측정이 첫 번째 수정 뒤의 상태가 되므로 accessor 를
 * 기억해 두고 한 번만 고친다.
 */
report.boots = [];
const done = new Set();
for (const side of ['left', 'right']) {
  const shin = entry(list, `${side}Shin`);
  const prim = shin.node.getMesh().listPrimitives()[0];
  const pos = prim.getAttribute('POSITION');
  const array = pos.getArray();
  const world = (v) => apply(shin.world, [array[v * 3], array[v * 3 + 1], array[v * 3 + 2]]);
  const inv = invert(shin.world);

  const parts = componentsOf(shin).map((c) => ({ ...c, size: [0, 1, 2].map((a) => mm(c.box.hi[a] - c.box.lo[a])) }));
  // 밑창과 웰트는 크기로 가른다. 색은 grain 잡음 때문에 뒤축과 10 단위 안에서 겹친다.
  const isSole = (c) => Math.abs(c.size[1] - 46) < 2 && c.size[2] > 300;
  const isWelt = (c) => Math.abs(c.size[1] - 26) < 2 && c.size[2] > 260;
  const leather = parts.filter((c) => !isSole(c) && !isWelt(c) && c.box.lo[1] < 0.22 && c.size[1] < 260);

  const footprint = [];
  for (const c of leather) for (const v of c.verts) { const p = world(v); if (p[1] < FOOTPRINT_MAX_Y) footprint.push([p[0], p[2]]); }
  const h = hull(footprint);
  const c0 = centroid(h);
  const shared = done.has(pos);
  done.add(pos);

  for (const part of parts) {
    const lip = isSole(part) ? SOLE_LIP_MM / 1000 : isWelt(part) ? WELT_LIP_MM / 1000 : null;
    if (lip === null) continue;
    const label = isSole(part) ? 'sole' : 'welt';
    const before = { maxOutMm: -Infinity, verticesOutside: 0, widthMm: part.size[0], lengthMm: part.size[2] };
    for (const v of part.verts) {
      const p = world(v); const d = outside(h, [p[0], p[2]]);
      if (d > 0) before.verticesOutside += 1;
      if (d > before.maxOutMm) before.maxOutMm = d;
    }
    before.maxOutMm = mm(before.maxOutMm);

    /*
     * 상자를 발자국 중심으로 옮긴 뒤 XZ 를 한 비율로 줄인다. 최대 돌출은 비율에
     * 대해 단조 감소하므로 이분법으로 립에 맞춘다.
     */
    const fit = (s) => {
      let worst = -Infinity;
      for (const v of part.verts) {
        const p = world(v);
        const q = [c0[0] + (p[0] - c0[0]) * s, c0[1] + (p[2] - c0[1]) * s];
        const d = outside(h, q);
        if (d > worst) worst = d;
      }
      return worst;
    };
    let lo = 0.4; let hi = 1.0;
    for (let i = 0; i < 40; i += 1) { const mid = (lo + hi) / 2; if (fit(mid) > lip) hi = mid; else lo = mid; }
    const s = shared ? 1 : lo;

    // 월드에서 옮긴 뒤 노드 좌표계로 되돌려 쓴다.
    if (!shared) for (const v of part.verts) {
      const p = world(v);
      const t = [c0[0] + (p[0] - c0[0]) * s, p[1], c0[1] + (p[2] - c0[1]) * s];
      array[v * 3] = inv[0] * t[0] + inv[4] * t[1] + inv[8] * t[2] + inv[12];
      array[v * 3 + 1] = inv[1] * t[0] + inv[5] * t[1] + inv[9] * t[2] + inv[13];
      array[v * 3 + 2] = inv[2] * t[0] + inv[6] * t[1] + inv[10] * t[2] + inv[14];
    }

    const after = { maxOutMm: -Infinity, verticesOutside: 0, widthMm: 0, lengthMm: 0 };
    let xlo = Infinity; let xhi = -Infinity; let zlo = Infinity; let zhi = -Infinity;
    for (const v of part.verts) {
      const p = world(v); const d = outside(h, [p[0], p[2]]);
      if (d > 0) after.verticesOutside += 1;
      if (d > after.maxOutMm) after.maxOutMm = d;
      xlo = Math.min(xlo, p[0]); xhi = Math.max(xhi, p[0]); zlo = Math.min(zlo, p[2]); zhi = Math.max(zhi, p[2]);
    }
    after.maxOutMm = mm(after.maxOutMm);
    after.widthMm = mm(xhi - xlo);
    after.lengthMm = mm(zhi - zlo);
    report.boots.push(shared
      ? { node: `${side}Shin`, part: label, sharedAccessorWith: `${side === 'right' ? 'left' : 'right'}Shin`, after }
      : { node: `${side}Shin`, part: label, lipTargetMm: lip * 1000, scaleXZ: +s.toFixed(4), before, after });
  }
  pos.setArray(array);
}

/* --------------------------------------------------- 재킷의 잔부품이 공중에 떠 있다 */
/*
 * 재킷 앞면의 옆솔기 둘과 놋쇠 단추 셋 가운데 둘이 몸통에 닿지 않는다. 삼각형-삼각형
 * 최단거리로 잰 값(닿을 수 있는 큰 덩어리 전부에 대해):
 *
 *   옆솔기 43.9 x 280.2 x 12 mm  x ±(148.1..191.9)   16.8 mm
 *   단추   24.7 x 26 x 21.5 mm   y 1189..1215        18.7 mm
 *   단추   24.7 x 26 x 21.5 mm   y 1319..1345         9.6 mm
 *
 * 원인은 형상 자체다. Harvest Frontier 의 createJacketShell 은 몸통을 선반(lathe)으로
 * 돌린 뒤, 솔기와 단추를 z = -0.169 / -0.163 이라는 **한 값**에 놓는다. 선반의 앞면은
 * 위로 갈수록, 그리고 옆으로 갈수록 뒤로 물러나므로 그 평면 위의 잔부품은 몸에서 떨어진다.
 * HF 자신의 주석도 이 솔기를 "flush stitch lines" 라고 적어 놓았다 — 의도는 붙어 있는
 * 것이었다.
 *
 * 게임 카메라(위에서, 멀리)에서는 16.8 mm 가 안 보인다. 1024 px 상품 사진에서는
 * 솔기가 가슴 앞에 떠 있는 막대로, 단추가 허공의 점으로 보인다.
 *
 * 고치는 방법: 각 잔부품을 +Z(몸 쪽)로 밀어 몸통에 닿게 한 뒤 EMBED 만큼 더 밀어
 * 박아 넣는다. 미는 양은 "닿을 때까지"를 이분법으로 찾는다 — 표면이 기울어 있어
 * 틈 값을 그대로 밀면 정확히 닿지 않는다. X·Y 는 건드리지 않으므로 무늬의 자리는
 * 그대로다.
 */
const EMBED = 0.003;
report.floatingTrim = [];
{
  const torso = entry(list, 'denimJacketTorso');
  const prim = torso.node.getMesh().listPrimitives()[0];
  const pos = prim.getAttribute('POSITION');
  const array = pos.getArray();
  const idxA = prim.getIndices();
  const N = idxA ? idxA.getCount() : pos.getCount();
  const at = (i) => (idxA ? idxA.getScalar(i) : i);
  const world = (v) => apply(torso.world, [array[v * 3], array[v * 3 + 1], array[v * 3 + 2]]);
  const inv = invert(torso.world);

  const comps = componentsOf(torso).map((c) => ({
    ...c,
    size: [0, 1, 2].map((a) => mm(c.box.hi[a] - c.box.lo[a])),
    vol: (c.box.hi[0] - c.box.lo[0]) * (c.box.hi[1] - c.box.lo[1]) * (c.box.hi[2] - c.box.lo[2]),
  })).sort((a, b) => b.vol - a.vol);
  const triFor = (set) => {
    const out = [];
    for (let i = 0; i < N; i += 3) { const a = at(i); if (!set.has(a)) continue; out.push([a, at(i + 1), at(i + 2)].map(world)); }
    return out;
  };
  /** 잔부품이 기댈 수 있는 것: 몸통 부피의 2 % 를 넘는 덩어리. */
  const anchors = comps.filter((c) => c.vol > comps[0].vol * 0.02);
  const anchorTris = anchors.flatMap((c) => triFor(new Set(c.verts)));
  const anchorBoxes = anchorTris.map(triBox);
  const gapOf = (tris) => {
    const boxes = tris.map(triBox);
    let best = Infinity;
    for (let i = 0; i < tris.length; i += 1) {
      for (let j = 0; j < anchorTris.length; j += 1) {
        if (boxGap(boxes[i], anchorBoxes[j]) >= best) continue;
        const d = triTriDist(tris[i], anchorTris[j]);
        if (d < best) { best = d; if (best === 0) return 0; }
      }
    }
    return best;
  };
  for (const part of comps) {
    if (anchors.includes(part)) continue;
    const tris = triFor(new Set(part.verts));
    const gap = gapOf(tris);
    if (gap <= 0.0005) continue;
    const shifted = (s) => tris.map((t) => t.map((p) => [p[0], p[1], p[2] + s]));
    /*
     * "닿을 때까지"는 이분법으로 찾을 수 없다. 단추처럼 작은 부품은 계속 밀면 몸통을
     * 지나 안쪽으로 완전히 들어가고, 그때 삼각형-삼각형 거리는 다시 0 보다 커진다 —
     * 거리는 s 에 대해 단조가 아니라 0 인 구간을 가진다. 그래서 0.5 mm 씩 훑어
     * **처음 닿는** s 를 찾는다.
     */
    let touch = null;
    for (let s = 0; s <= 0.06; s += 0.0005) { if (gapOf(shifted(s)) === 0) { touch = s; break; } }
    if (touch === null) { report.floatingTrim.push({ sizeMm: part.size, gapBeforeMm: mm(gap), note: '60 mm 를 밀어도 몸통에 닿지 않아 건드리지 않았다' }); continue; }
    const shift = touch + EMBED;
    for (const v of part.verts) {
      const p = world(v); const t = [p[0], p[1], p[2] + shift];
      array[v * 3] = inv[0] * t[0] + inv[4] * t[1] + inv[8] * t[2] + inv[12];
      array[v * 3 + 1] = inv[1] * t[0] + inv[5] * t[1] + inv[9] * t[2] + inv[13];
      array[v * 3 + 2] = inv[2] * t[0] + inv[6] * t[1] + inv[10] * t[2] + inv[14];
    }
    report.floatingTrim.push({
      what: part.size[1] > 200 ? 'jacket side seam' : 'brass button',
      sizeMm: part.size,
      triangles: part.tris,
      gapBeforeMm: mm(gap),
      pushedIntoBodyMm: mm(shift),
      gapAfterMm: mm(gapOf(triFor(new Set(part.verts)))),
    });
  }
  pos.setArray(array);
}

report.trianglesAfter = triangleCount(doc);
if (report.trianglesAfter !== report.trianglesBefore) throw new Error('삼각형 수가 바뀌었다');

report.notFixed = [
  {
    what: '머리·어깨 비례 (머리 폭 536.5 mm = 재킷 어깨 폭 532.1 mm, 전신 2,299 mm 로 3.9 두신)',
    why: 'Harvest Frontier 가 위에서 내려다보는 게임 카메라에 맞춰 작성한 비례다 (playerMotion.ts M85 주석: 전신 2.27 -> 2.28 m). 여기서 바꾸면 캐릭터를 다시 그리는 일이고, 파는 근거인 "그 게임의 실제 파일"도 깨진다.',
  },
  {
    what: '밀짚모자 챙 787.8 mm 와 뒤로 17.2도 기울기',
    why: 'characterKit.ts HAT_TILT=0.3 / HAT_SET_BACK=0.075 는 챙 그림자가 눈을 덮는 것을 없애려고 정한 값이고, 주민 5명이 같은 모자를 같은 각도로 쓴다. 챙 지름은 머리 폭의 1.47배로, 실제 밀짚 차양모(2~3배)보다 오히려 좁다. 재서 과하지 않으므로 두었다.',
  },
  {
    what: '얼굴이 작은 그림에서 뭉개지는 것 (눈 87.7 mm 갈색 아몬드 + 17.2 mm 흰 점, 피부와의 명도차가 작다)',
    why: '팔레트를 바꾸면 같은 팔레트를 쓰는 주민 5명과 스프라이트 시트가 같이 어긋난다. 마스터 결정 사항으로 올린다.',
  },
];

if (!DRY) {
  await io.write(OUT, doc);
  fs.writeFileSync(
    path.join(REPO, 'examples/harvest-frontier/exports/npc/player-farmhand.repair.report.json'),
    JSON.stringify(report, null, 2),
  );
}

for (const b of report.boots) {
  if (b.sharedAccessorWith) {
    process.stdout.write(`${b.node} ${b.part}: ${b.sharedAccessorWith} 와 같은 accessor — 함께 고쳐졌다. 지금 밖으로 ${b.after.maxOutMm} mm (정점 ${b.after.verticesOutside} 개)\n`);
    continue;
  }
  process.stdout.write(`${b.node} ${b.part}: 밖으로 ${b.before.maxOutMm} -> ${b.after.maxOutMm} mm  (밖에 있는 정점 ${b.before.verticesOutside} -> ${b.after.verticesOutside} 개, 폭 ${b.before.widthMm} -> ${b.after.widthMm} mm, 길이 ${b.before.lengthMm} -> ${b.after.lengthMm} mm, x${b.scaleXZ})\n`);
}
for (const t of report.floatingTrim) {
  if (t.note) { process.stdout.write(`${t.sizeMm.join('x')}mm: 떠 있음 ${t.gapBeforeMm} mm — ${t.note}\n`); continue; }
  process.stdout.write(`${t.what} ${t.sizeMm.join('x')}mm: 몸통까지 ${t.gapBeforeMm} -> ${t.gapAfterMm} mm (${t.pushedIntoBodyMm} mm 밀어 앉힘)\n`);
}
process.stdout.write(`삼각형 ${report.trianglesBefore} -> ${report.trianglesAfter}${DRY ? '  (--dry: 쓰지 않음)' : `  → ${path.relative(REPO, OUT)}`}\n`);
