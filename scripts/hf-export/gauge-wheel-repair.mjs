/**
 * hf-seeder-compact / hf-cultivator-compact — 2026-09-05 게이지 휠 접지 수리.
 *
 * 팔고 있는 파일에서 직접 잰 것(public/market/.../seeder.compact.m1.glb,
 * cultivator.compact.m1.glb):
 *
 *   시더  gaugeWheel01..04_rubber 의 가장 낮은 정점 y = 111.2 mm.
 *         같은 줄기의 openerDisc01Right 는 y = 0.0, closingWheel 은 y = 16.9.
 *   컬티  gaugeWheelLeft/Right 의 가장 낮은 정점 y = 102.5 mm.
 *         같은 기계의 sweep1..7 은 y = 0.0.
 *
 * 게이지 휠은 땅 위를 굴러서 작업 깊이를 정하는 부품이다. 땅에 닿지 않으면 그 부품은
 * 아무 일도 하지 않는다. 낮은 앞 시선(outputs/visual-sweep)에서 바로 보인다.
 *
 * 왜 두 파일에서 같은 값이 나왔다고 볼 수 없는가. 111.2 와 102.5 는 서로 다른 수이고,
 * 원인도 서로 다르다:
 *
 *   1. 컬티베이터의 102.5 는 scripts/hf-export/cultivator-postprocess.mts 의 1번 항목이
 *      만든 것이다. 그 패스는 게이지 휠이 자기 스윕(sweep1/sweep7) 안에 485 mm 바퀴의
 *      아래 89 mm 가 박혀 있는 것을 고치려고 `pivotgaugeWheelLeft/Right` 를 108 mm
 *      들어올렸다(cultivator.fixed.report.json 의 gaugeWheel.upMm = 108). 그 뒤
 *      cultivator-repair.mjs 가 지면 접지를 다시 잡으면서 뿌리를 22.3 mm 내렸고,
 *      -282.5(원래) + 299.3(지면 보정) + 108(들어올림) - 22.3 = 102.5 이 남았다.
 *      들어올린 다음 다시 내려놓지 않은 것이 지금의 부양이다.
 *   2. 시더의 111.2 는 어떤 스크립트가 만든 값이 아니라 Harvest Frontier 의 저작값이다.
 *      seeder.ts 에서 게이지 휠 축은 오프너 원판 축보다 46 mm 높고 반지름은 65.2 mm
 *      작다 — 그 차이 111.2 mm 가 게임 안에서는 파종 깊이다. 판매용 GLB 를 가장 낮은
 *      부품(오프너 날) 기준으로 지면에 앉히면, 흙 대신 단단한 바닥 위에 세운 셈이 되어
 *      깊이만큼 바퀴가 뜬다. seeder-postprocess.mts 는 게이지 휠을 건드리지 않는다.
 *
 * 즉 "scripts/ 안의 상수 하나"는 아니다. 컬티베이터 쪽은 스크립트가 계산한 값이지만
 * 손으로 적은 상수가 아니라 탐색 결과이고, 그 패스를 다시 돌리면 판매 파일 전체가
 * 다시 만들어진다. 그래서 이 수리는 팔고 있는 GLB 위의 수리 패스로 한다.
 *
 * 무엇을 하는가:
 *
 *   시더  네 개의 `pivotgaugeWheel0N` 을 109.8 mm 내린다. 축을 바퀴의 최대 반지름
 *         (190.8 mm)과 같은 높이에 두는 값이라, 바퀴가 한 바퀴 다 돌아도 어느 위상에서도
 *         지면 아래로 내려가지 않는다. 바퀴를 매단 `gaugeArm` 은 병합된
 *         `pivotrowUnit0N_metal` 안에 있어서 노드로는 못 옮긴다 — 그 덩어리의 정점만
 *         찾아 아래 끝을 새 축까지 늘인다(위 끝은 그대로). 네 줄기가 POSITION accessor
 *         하나를 공유하므로 한 번의 수정이 네 줄기에 똑같이 적용된다.
 *
 *   컬티  내리기만 해서는 안 된다. 지금 바퀴는 sweep1 위 13.5 mm 에 떠 있고, 20 mm 만
 *         내려도 스윕을 다시 뚫는다(측정표는 리포트에 남는다). 그래서 바퀴를 안쪽으로
 *         옮겨 tine01-tine02 사이의 빈 칸에 넣고 나서 96.3 mm 내린다. 안쪽 거리는
 *         고정 상수가 아니라 매 실행마다 5 mm 격자로 탐색해 "그 칸 한가운데"를 고른다 —
 *         날의 배열이 좌우 대칭이 아니어서(sweep1 은 z -1305, sweep7 은 +1255 에 중심이
 *         있다) 좌우 값이 다르게 나오는 것이 정상이다. 포크와 두 지지대는 병합된
 *         `body_metal` 안에 있으므로 같은 거리만큼 함께 옮기고, 축까지 닿는 지지대는
 *         아래 끝만 96.3 mm 늘여 바퀴를 계속 잡게 한다.
 *
 * 삼각형은 한 개도 늘거나 줄지 않는다. 정점 좌표와 노드 translation 만 바뀐다.
 *
 * 사용:
 *   node scripts/hf-export/gauge-wheel-repair.mjs seeder [--dry]
 *   node scripts/hf-export/gauge-wheel-repair.mjs cultivator [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  io, flatten, entry, descendants, ownTris, ownVerts, subtree, bounds, componentsOf,
  shiftVerts, triangleCount, soupDist, insideDepth, mm, invert,
} from './glb-surgery.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');

const MACHINES = {
  seeder: {
    file: 'public/market/hf-seeder-compact/seeder.compact.m1.glb',
    wheels: [
      { pivot: 'pivotgaugeWheel01', inboardSign: 0 },
      { pivot: 'pivotgaugeWheel02', inboardSign: 0 },
      { pivot: 'pivotgaugeWheel03', inboardSign: 0 },
      { pivot: 'pivotgaugeWheel04', inboardSign: 0 },
    ],
    /* 바퀴를 매단 팔이 들어 있는 병합 메시. 줄기마다 하나씩이지만 accessor 는 공유다. */
    armHost: (i) => `pivotrowUnit0${i + 1}_metal`,
    ground: ['openerDisc01Left_metal', 'openerDisc01Right_metal', 'closingWheel01Left_rubber', 'closingWheel01Right_rubber'],
    clip: 'sow',
  },
  cultivator: {
    file: 'public/market/hf-cultivator-compact/cultivator.compact.m1.glb',
    wheels: [
      { pivot: 'pivotgaugeWheelLeft', inboardSign: +1 },
      { pivot: 'pivotgaugeWheelRight', inboardSign: -1 },
    ],
    mountHost: 'body_metal',
    ground: ['sweep1', 'sweep4', 'sweep7'],
    clip: 'work',
  },
};

const which = process.argv[2];
const DRY = process.argv.includes('--dry');
const spec = MACHINES[which];
if (!spec) throw new Error(`usage: gauge-wheel-repair.mjs <${Object.keys(MACHINES).join('|')}> [--dry]`);

const FILE = path.join(REPO, spec.file);
const doc = await io.read(FILE);
const report = { file: spec.file, ranAt: new Date().toISOString(), machine: which };

const trisBefore = triangleCount(doc);
const extBefore = { used: doc.getRoot().listExtensionsUsed().map((e) => e.extensionName), required: doc.getRoot().listExtensionsRequired().map((e) => e.extensionName) };

let list = flatten(doc);
const sceneVerts = () => flatten(doc).flatMap((e) => ownVerts(e));
const boxBefore = bounds(sceneVerts());

/* ------------------------------------------------------------------ 0. 지금 상태 */
/** 축(회전 중심)에서 가장 먼 정점까지의 거리. 한 바퀴 도는 동안 가장 낮아지는 값을 준다. */
function wheelMetrics(e) {
  const axle = [e.world[12], e.world[13], e.world[14]];
  const vs = subtree(list, e, (x) => ownVerts(x));
  let rmax = 0;
  for (const p of vs) { const r = Math.hypot(p[0] - axle[0], p[1] - axle[1]); if (r > rmax) rmax = r; }
  return { axle, radiusMax: rmax, box: bounds(vs) };
}
report.before = { triangles: trisBefore, extensions: extBefore, sceneMinYmm: mm(boxBefore.lo[1]), wheels: [] };
for (const w of spec.wheels) {
  const m = wheelMetrics(entry(list, w.pivot));
  report.before.wheels.push({
    node: w.pivot, axleYmm: mm(m.axle[1]), axleZmm: mm(m.axle[2]),
    maxRadiusMm: mm(m.radiusMax), lowestVertexYmm: mm(m.box.lo[1]),
    lowestOverAFullTurnYmm: mm(m.axle[1] - m.radiusMax),
  });
}
report.before.groundParts = spec.ground.map((n) => ({ node: n, lowestYmm: mm(bounds(subtree(list, entry(list, n), (x) => ownVerts(x))).lo[1]) }));

/**
 * 각 바퀴가 지금 어느 부품에 닿아 있고 얼마나 파고들어 있는가.
 *
 * 파종기의 게이지 휠은 원래 오프너 원판에 닿아 있다 — 실제 파종기가 그 면을 눌러
 * 고랑을 막기 때문이다. 그러니 "닿아 있다"는 사실만으로는 이 수리가 나빠졌는지 알 수
 * 없고, 겹침의 깊이를 전후로 비교해야 한다.
 */
function touchTable(wheelPivot) {
  const e = entry(list, wheelPivot);
  const skip = descendants(e);
  const wheelTris = subtree(list, e, (x) => ownTris(x));
  const wheelVerts = subtree(list, e, (x) => ownVerts(x));
  const rows = [];
  for (const other of list) {
    if (skip.has(other.node) || !other.node.getMesh()) continue;
    const t = ownTris(other);
    const d = soupDist(wheelTris, t, 0.30);
    if (d >= 0.30) continue;
    const row = { part: other.name, gapMm: mm(d) };
    if (d === 0) Object.assign(row, insideDepth(wheelVerts, t));
    rows.push(row);
  }
  rows.sort((a, b) => a.gapMm - b.gapMm || (b.deepestMm ?? 0) - (a.deepestMm ?? 0));
  return rows.slice(0, 6);
}
report.before.contacts = spec.wheels.map((w) => ({ node: w.pivot, nearest: touchTable(w.pivot) }));

/* --------------------------------------------------------- 1. 바퀴가 갈 자리 찾기 */
/** 바퀴를 뺀 나머지 전부의 삼각형. 마운트가 들어 있는 병합 메시는 따로 뺀다. */
function obstaclesFor(wheelPivots, exclude) {
  const skip = new Set();
  for (const p of wheelPivots) for (const n of descendants(entry(list, p))) skip.add(n);
  const out = [];
  for (const e of list) {
    if (skip.has(e.node) || exclude.includes(e.name)) continue;
    out.push(...ownTris(e));
  }
  return out;
}
const DROP = {};        // pivot -> 내릴 거리(m)
const INBOARD = {};     // pivot -> 안쪽으로 옮길 거리(m)
const excludeHosts = [spec.mountHost, 'body_matte'].filter(Boolean);
const obstacles = obstaclesFor(spec.wheels.map((w) => w.pivot), excludeHosts);

report.placement = [];
for (const w of spec.wheels) {
  const e = entry(list, w.pivot);
  const m = wheelMetrics(e);
  const drop = m.axle[1] - m.radiusMax;              // 축을 최대 반지름 높이에 둔다
  const wheelTris = subtree(list, e, (x) => ownTris(x));
  /* 제자리에서 내리면 무엇에 닿는가. 고치기 전에 그것부터 표로 남긴다. */
  const straightDown = [0, 20, 40, 60, 80, 100, mm(drop)].map((d) => ({
    dropMm: d,
    gapMm: mm(soupDist(wheelTris.map((t) => t.map((p) => [p[0], p[1] - d / 1000, p[2]])), obstacles, 0.25)),
  }));
  let inboard = 0;
  if (w.inboardSign !== 0) {
    /* 5 mm 격자로 훑어 여유가 가장 큰 자리를 고른다. 최소 이동이 아니라 최대 여유다 —
       cultivator-postprocess.mts 가 "가장 작은 이동"을 골랐다가 바퀴를 공중에 두고
       끝난 것이 지금 고치는 결함이다. */
    let best = { d: 0, gap: -1 };
    for (let d = 0; d <= 300; d += 5) {
      const moved = wheelTris.map((t) => t.map((p) => [p[0], p[1] - drop, p[2] + w.inboardSign * d / 1000]));
      const gap = soupDist(moved, obstacles, 0.12);
      if (gap > best.gap) best = { d, gap };
    }
    if (best.gap < 0.005) throw new Error(`${w.pivot}: no inboard offset within 300 mm gives 5 mm of daylight`);
    inboard = best.d / 1000;
  }
  DROP[w.pivot] = drop;
  INBOARD[w.pivot] = inboard;
  report.placement.push({
    node: w.pivot,
    dropMm: mm(drop),
    inboardMm: mm(inboard),
    straightDownWouldTouch: straightDown,
    why: w.inboardSign === 0
      ? 'nothing new is under this wheel, so it goes straight down'
      : 'straight down puts the tyre back inside its own share, so it moves into the gap between two tines first',
  });
}

/* ------------------------------------------------------------------ 2. 바퀴 이동 */
for (const w of spec.wheels) {
  const e = entry(list, w.pivot);
  const t = e.node.getTranslation();
  /* 노드의 부모 프레임으로 옮겨 적는다. 이 파일들의 부모는 회전이 없어 사실상 그대로지만,
     가정으로 두지 않고 역행렬로 되돌린다. */
  const inv = invert(e.parentWorld);
  const d = [0, -DROP[w.pivot], w.inboardSign * INBOARD[w.pivot]];
  const local = [
    inv[0] * d[0] + inv[4] * d[1] + inv[8] * d[2],
    inv[1] * d[0] + inv[5] * d[1] + inv[9] * d[2],
    inv[2] * d[0] + inv[6] * d[1] + inv[10] * d[2],
  ];
  e.node.setTranslation([t[0] + local[0], t[1] + local[1], t[2] + local[2]]);
}
list = flatten(doc);

/* ------------------------------------------- 3. 바퀴를 잡고 있는 것도 같이 옮긴다 */
/**
 * 병합 메시 안에서 이 바퀴의 마운트에 해당하는 덩어리를 찾아 함께 옮긴다.
 * 아래 끝이 옛 축 높이 근처까지 내려오는 덩어리는 "바퀴를 잡는 팔"이므로, 위 끝은
 * 그대로 두고 아래 끝만 바퀴가 내려간 만큼 늘인다. 늘이기는 위에서 아래로 선형이라
 * 부품 모양이 꺾이지 않는다.
 */
function carryMount(hostName, wheel, oldAxle, drop, inboard, sign) {
  const host = entry(list, hostName);
  const comps = componentsOf(host);
  const zCentre = oldAxle[2];
  const picked = comps.filter((c) => {
    const cz = (c.box.lo[2] + c.box.hi[2]) / 2;
    return Math.abs(cz - zCentre) < 0.080 && c.box.hi[1] < 0.900 && (c.box.hi[2] - c.box.lo[2]) < 0.400;
  });
  const moved = [];
  for (const c of picked) {
    const reachesAxle = c.box.lo[1] < oldAxle[1] + 0.150;
    if (inboard !== 0) shiftVerts(host, c.prim, c.verts, [0, 0, sign * inboard]);
    if (reachesAxle && drop > 0) {
      /* 위 끝 고정, 아래 끝을 drop 만큼. 사이는 비례. */
      const a = c.prim.getAttribute('POSITION').getArray();
      const inv = invert(host.world);
      const scale = Math.hypot(inv[1], inv[5], inv[9]) || 1;   // 월드 mm -> 로컬
      const top = c.box.hi[1];
      const bottom = c.box.lo[1];
      for (const v of c.verts) {
        const worldY = host.world[1] * a[v * 3] + host.world[5] * a[v * 3 + 1] + host.world[9] * a[v * 3 + 2] + host.world[13];
        const f = Math.max(0, Math.min(1, (top - worldY) / (top - bottom)));
        a[v * 3 + 1] -= drop * f * scale;
      }
    }
    moved.push({
      tris: c.tris,
      boxMm: { lo: c.box.lo.map(mm), hi: c.box.hi.map(mm) },
      movedInboardMm: mm(inboard),
      stretchedDownMm: reachesAxle ? mm(drop) : 0,
      role: reachesAxle ? 'reaches the axle, so its lower end follows the wheel' : 'frame furniture over the wheel, moved sideways only',
    });
  }
  return { host: hostName, parts: moved };
}

report.mounts = [];
if (spec.mountHost) {
  for (const w of spec.wheels) {
    const old = report.before.wheels.find((x) => x.node === w.pivot);
    const oldAxle = [0, old.axleYmm / 1000, old.axleZmm / 1000];
    report.mounts.push(carryMount(spec.mountHost, w.pivot, oldAxle, DROP[w.pivot], INBOARD[w.pivot], w.inboardSign));
  }
  list = flatten(doc);
}
if (spec.armHost) {
  /* 시더의 게이지 암. 네 줄기가 accessor 를 공유하므로 첫 줄기에서 찾아 한 번만 고친다. */
  const host = entry(list, spec.armHost(0));
  const old = report.before.wheels[0];
  const hub = [716.5 / 1000, old.axleYmm / 1000, old.axleZmm / 1000];
  const comps = componentsOf(host);
  const near = comps
    .map((c) => {
      const corners = [];
      for (const ax of [c.box.lo[0], c.box.hi[0]]) for (const ay of [c.box.lo[1], c.box.hi[1]]) for (const az of [c.box.lo[2], c.box.hi[2]]) corners.push([ax, ay, az]);
      const d = Math.min(...corners.map((p) => Math.hypot(p[0] - hub[0], p[1] - hub[1], p[2] - hub[2])));
      return { c, d };
    })
    .sort((a, b) => a.d - b.d);
  const arm = near[0].c;
  const drop = DROP[spec.wheels[0].pivot];
  const a = arm.prim.getAttribute('POSITION').getArray();
  const inv = invert(host.world);
  const scale = Math.hypot(inv[1], inv[5], inv[9]) || 1;
  const top = arm.box.hi[1];
  const bottom = arm.box.lo[1];
  for (const v of arm.verts) {
    const worldY = host.world[1] * a[v * 3] + host.world[5] * a[v * 3 + 1] + host.world[9] * a[v * 3 + 2] + host.world[13];
    const f = Math.max(0, Math.min(1, (top - worldY) / (top - bottom)));
    a[v * 3 + 1] -= drop * f * scale;
  }
  report.gaugeArm = {
    host: spec.armHost(0),
    sharedWith: 'pivotrowUnit01..04_metal share one POSITION accessor, so all four arms follow',
    tris: arm.tris,
    wasMm: { lo: arm.box.lo.map(mm), hi: arm.box.hi.map(mm) },
    nearestCornerToHubMm: mm(near[0].d),
    stretchedDownMm: mm(drop),
  };
  list = flatten(doc);
}

/* ------------------------------------------------------------------ 4. 검산 */
list = flatten(doc);
const boxAfter = bounds(sceneVerts());
report.after = { triangles: triangleCount(doc), sceneMinYmm: mm(boxAfter.lo[1]), wheels: [], groundParts: [] };
for (const w of spec.wheels) {
  const m = wheelMetrics(entry(list, w.pivot));
  report.after.wheels.push({
    node: w.pivot, axleYmm: mm(m.axle[1]), axleZmm: mm(m.axle[2]),
    lowestVertexYmm: mm(m.box.lo[1]),
    lowestOverAFullTurnYmm: mm(m.axle[1] - m.radiusMax),
  });
}
report.after.groundParts = spec.ground.map((n) => ({ node: n, lowestYmm: mm(bounds(subtree(list, entry(list, n), (x) => ownVerts(x))).lo[1]) }));

/* 새로 생긴 접촉이 없는지. 겹침의 깊이까지 같은 표로 전후 비교한다. */
report.after.contacts = spec.wheels.map((w) => ({ node: w.pivot, nearest: touchTable(w.pivot) }));

/**
 * 함께 옮긴 마운트도 검산한다. 병합 메시 안의 덩어리라 이름이 없으므로, 옮긴 뒤의
 * 바퀴 z 를 기준으로 다시 찾아 프레임 바깥의 모든 부품과 거리를 잰다. 바퀴만 자유롭게
 * 만들고 포크를 날 속에 밀어 넣었다면 그건 고친 것이 아니다.
 */
if (spec.mountHost) {
  report.after.mountClearance = [];
  const host = entry(list, spec.mountHost);
  const outside = list.filter((e) => e.node.getMesh() && !e.name.startsWith('body_') && !spec.wheels.some((w) => descendants(entry(list, w.pivot)).has(e.node)));
  for (const w of spec.wheels) {
    const axleZ = entry(list, w.pivot).world[14];
    const comps = componentsOf(host).filter((c) => Math.abs((c.box.lo[2] + c.box.hi[2]) / 2 - axleZ) < 0.080 && c.box.hi[1] < 0.900 && (c.box.hi[2] - c.box.lo[2]) < 0.400);
    const a = host.node.getMesh().listPrimitives()[0].getAttribute('POSITION').getArray();
    const idx = host.node.getMesh().listPrimitives()[0].getIndices().getArray();
    const own = new Set(comps.flatMap((c) => c.verts));
    const tris = [];
    for (let i = 0; i < idx.length; i += 3) {
      if (!own.has(idx[i])) continue;
      tris.push([0, 1, 2].map((k) => {
        const v = idx[i + k];
        return [
          host.world[0] * a[v * 3] + host.world[4] * a[v * 3 + 1] + host.world[8] * a[v * 3 + 2] + host.world[12],
          host.world[1] * a[v * 3] + host.world[5] * a[v * 3 + 1] + host.world[9] * a[v * 3 + 2] + host.world[13],
          host.world[2] * a[v * 3] + host.world[6] * a[v * 3 + 1] + host.world[10] * a[v * 3 + 2] + host.world[14],
        ];
      }));
    }
    const per = [];
    for (const e of outside) {
      const d = soupDist(tris, ownTris(e), 0.25);
      if (d < 0.25) per.push({ part: e.name, gapMm: mm(d) });
    }
    per.sort((x, y) => x.gapMm - y.gapMm);
    const mb = bounds(tris.flat());
    report.after.mountClearance.push({
      node: w.pivot, components: comps.length, triangles: tris.length,
      boxMm: { lo: mb.lo.map(mm), hi: mb.hi.map(mm) },
      nearest: per.slice(0, 6),
    });
  }
}

report.checks = {
  trianglesUnchanged: report.after.triangles === trisBefore,
  extensionsRequired: doc.getRoot().listExtensionsRequired().map((e) => e.extensionName),
  boundsMetresBefore: [0, 1, 2].map((i) => Math.round((boxBefore.hi[i] - boxBefore.lo[i]) * 10000) / 10000),
  boundsMetresAfter: [0, 1, 2].map((i) => Math.round((boxAfter.hi[i] - boxAfter.lo[i]) * 10000) / 10000),
};
if (!report.checks.trianglesUnchanged) throw new Error(`triangle count moved: ${trisBefore} -> ${report.after.triangles}`);
if (report.checks.extensionsRequired.length) throw new Error(`the file now requires ${report.checks.extensionsRequired.join(', ')}`);
for (const w of report.after.wheels) {
  if (w.lowestOverAFullTurnYmm < -0.5) throw new Error(`${w.node} would go ${w.lowestOverAFullTurnYmm} mm under the ground while it turns`);
  if (w.lowestVertexYmm > 12) throw new Error(`${w.node} still floats ${w.lowestVertexYmm} mm`);
}

const OUTDIR = path.join(REPO, 'outputs/gauge-wheel-repair');
fs.mkdirSync(OUTDIR, { recursive: true });
fs.writeFileSync(path.join(OUTDIR, `${which}.report.json`), JSON.stringify(report, null, 2));
if (!DRY) await io.write(FILE, doc);

process.stdout.write(`${spec.file}${DRY ? '  (dry run, not written)' : ''}\n`);
for (let i = 0; i < report.before.wheels.length; i += 1) {
  const b = report.before.wheels[i];
  const a = report.after.wheels[i];
  process.stdout.write(`  ${b.node}: lowest vertex ${b.lowestVertexYmm} -> ${a.lowestVertexYmm} mm   (dropped ${report.placement[i].dropMm}, inboard ${report.placement[i].inboardMm} mm)\n`);
}
process.stdout.write(`  triangles ${trisBefore} -> ${report.after.triangles}   extensionsRequired [${report.checks.extensionsRequired.join(', ')}]\n`);
process.stdout.write(`  report outputs/gauge-wheel-repair/${which}.report.json\n`);
