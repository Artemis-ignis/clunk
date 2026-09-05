#!/usr/bin/env node
/**
 * hf-barn — 실내가 민무늬다.
 *
 * 헛간은 앞이 폭 전체로 열려 있고, 6각도 렌더의 "앞"과 "낮은 앞"에서 문 사이로 안이
 * 그대로 보인다. 지금 그 안에 보이는 것은 다음 둘이다.
 *
 *   barnInteriorFloor  8,050 x 139.5 x 5,920 mm  덩어리 1개 · 588 삼각형 · 색 #5f5a4b
 *   barnRearWall       7,890 x 4,700 x 260 mm    덩어리 1개 · 588 삼각형 · 색 #a25540
 *
 *   둘 다 "덩어리 1개"다. 즉 8 m x 5.9 m 짜리 바닥과 7.9 m x 4.7 m 짜리 뒷벽이 각각
 *   **한 가지 색의 매끈한 판 하나**다. 이음새도, 판자도, 기둥도, 띠장도 없다. 바깥은
 *   barnbatch1/2 가 세로 판자를 붙여 놓았는데(각 1,176 삼각형) 안쪽은 그 언어가
 *   하나도 없어서, 문으로 들여다보면 색칠한 상자 안을 보는 것이 된다.
 *
 *   가려지는 부분도 재 두었다. 짚단 8개는 y 150..750(그리고 750..1350) 사이 좌우에만
 *   있고 가운데 x -1,550..1,700 은 바닥부터 다락 밑(y 3,000)까지 완전히 비어 있다.
 *   다락 바닥판은 y 3,000..3,280 이다. 그러니까 카메라가 실제로 보는 민무늬 면은
 *   뒷벽 y 150..3,000 의 큰 띠와 바닥 전체다.
 *
 * 고치는 방법: 헛간이 이미 쓰고 있는 색과 재질로만, 안쪽에 목구조를 붙인다.
 *
 *   세로 샛기둥 11개   120 x 2,850 x 60 mm, x -3,600..3,600 을 720 mm 간격, 뒷벽 안쪽 면에
 *   가로 띠장 1개      7,800 x 140 x 60 mm, y 1,800, 샛기둥 앞면에 얹혀 붙는다
 *   바닥 판자 이음 9줄  70 x 10 x 5,800 mm, x -3,200..3,200 을 800 mm 간격, 바닥 윗면에
 *
 * 색은 팔레트(16x16 PNG)에 이미 있는 칸만 쓴다 — 새 재질도 새 색도 만들지 않는다:
 *   샛기둥 (3,0) #7f4032 · 띠장 (12,0) #7c3d2e · 바닥 이음 (13,0) #4b382a
 * 재질은 셋 다 barn.fixed-palette-rubber 로, 바닥과 뒷벽이 쓰는 바로 그것이다.
 * 전부 한 메시에 넣으므로 드로우콜은 하나만 는다.
 *
 * 삼각형은 15,080 -> 15,332 (+252, +1.7 %). 이 항목은 없는 것을 만드는 일이라
 * 보존이 불가능하다 — 늘어난 값과 이유를 여기와 보고서에 적는다.
 *
 * 같은 평면을 만들지 않는다: 새 부재는 기대는 면에 6 mm 박아 넣는다 — 딱 맞추면 뒷면이
 * 벽·샛기둥·바닥의 면과 같은 평면이 되어 z-fighting 이 된다. 짚단 뒤로 지나가는 샛기둥은 짚단에
 * 가려 보이지 않는다(짚단은 부피가 전체의 0.1 % 로, 형상 감사의 '몸통' 문턱 4 % 아래다).
 *
 * 사용:
 *   node scripts/hf-export/barn-interior.mjs           제자리에서 고친다
 *   node scripts/hf-export/barn-interior.mjs --dry     재기만 한다
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io, mm, apply, invert, flatten, entry, triangleCount } from './glb-surgery.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const DRY = process.argv.includes('--dry');
const IN = args[0] ?? path.join(REPO, 'public/market/hf-barn/barn.m1.glb');
const OUT = args[1] ?? IN;

const doc = await io.read(IN);
const list = flatten(doc);
const report = {
  input: path.relative(REPO, IN).replace(/\\/g, '/'),
  output: path.relative(REPO, OUT).replace(/\\/g, '/'),
  trianglesBefore: triangleCount(doc),
};

const wall = entry(list, 'barnRearWall');
const floor = entry(list, 'barnInteriorFloor');
const loft = entry(list, 'barnHayLoft');
const rubber = wall.node.getMesh().listPrimitives()[0].getMaterial();
if (rubber !== floor.node.getMesh().listPrimitives()[0].getMaterial()) throw new Error('바닥과 뒷벽의 재질이 다르다');

/** 세계 좌표 상자를 재기 위한 최소 도구. */
function worldBox(e) {
  const lo = [Infinity, Infinity, Infinity]; const hi = [-Infinity, -Infinity, -Infinity];
  for (const prim of e.node.getMesh().listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    for (let i = 0; i < pos.getCount(); i += 1) {
      const p = apply(e.world, pos.getElement(i, [0, 0, 0]));
      for (let a = 0; a < 3; a += 1) { if (p[a] < lo[a]) lo[a] = p[a]; if (p[a] > hi[a]) hi[a] = p[a]; }
    }
  }
  return { lo, hi };
}
const wallBox = worldBox(wall);
const floorBox = worldBox(floor);
const loftBox = worldBox(loft);
report.measured = {
  rearWallMm: { x: [mm(wallBox.lo[0]), mm(wallBox.hi[0])], y: [mm(wallBox.lo[1]), mm(wallBox.hi[1])], z: [mm(wallBox.lo[2]), mm(wallBox.hi[2])] },
  interiorFloorMm: { x: [mm(floorBox.lo[0]), mm(floorBox.hi[0])], y: [mm(floorBox.lo[1]), mm(floorBox.hi[1])], z: [mm(floorBox.lo[2]), mm(floorBox.hi[2])] },
  loftUndersideMm: mm(loftBox.hi[1] - 280.1 / 1000),
};

/** 팔레트 16x16 의 칸 중심 UV. 새 색을 만들지 않고 이미 있는 칸만 고른다. */
const CELL = (col, row) => [(col + 0.5) / 16, (row + 0.5) / 16];
const STUD_UV = CELL(3, 0);   // #7f4032
const GIRT_UV = CELL(12, 0);  // #7c3d2e
const SEAM_UV = CELL(13, 0);  // #4b382a

const wallInnerZ = wallBox.hi[2];      // 벽의 실내 쪽 면
const floorTopY = floorBox.hi[1];
const studTopY = 3.0;                  // 다락 바닥판 밑면
const studBottomY = floorTopY;

const boxes = [];
const push = (cx, cy, cz, sx, sy, sz, uv) => boxes.push({ c: [cx, cy, cz], s: [sx, sy, sz], uv });

/*
 * 새 부재는 기대는 면에 딱 맞추지 않고 EMBED 만큼 박아 넣는다. 딱 맞추면 뒷면이
 * 벽 안쪽 면과 같은 평면이 되어, 뒷면을 그리는 렌더러(상품 페이지의 히어로 래스터라이저가
 * 그렇다)와 뒷면 컬링을 끄는 엔진에서 z-fighting 이 된다.
 */
const EMBED = 0.006;

/* 1. 뒷벽 안쪽 세로 샛기둥 11개 */
const STUDS = 11;
const STUD_W = 0.12; const STUD_D = 0.06; const STUD_SPAN = 7.2;
const studFrontZ = wallInnerZ + STUD_D - EMBED;
for (let i = 0; i < STUDS; i += 1) {
  const x = -STUD_SPAN / 2 + (STUD_SPAN * i) / (STUDS - 1);
  push(x, (studBottomY + studTopY) / 2, wallInnerZ + STUD_D / 2 - EMBED, STUD_W, studTopY - studBottomY, STUD_D, STUD_UV);
}
/* 2. 샛기둥 앞면에 얹히는 가로 띠장 */
const GIRT_Y = 1.8; const GIRT_H = 0.14; const GIRT_D = 0.06;
push(0, GIRT_Y, studFrontZ + GIRT_D / 2 - EMBED, 7.8, GIRT_H, GIRT_D, GIRT_UV);
/* 3. 바닥 판자 이음 9줄 (문에서 안쪽으로 달린다) */
const SEAMS = 9; const SEAM_W = 0.07; const SEAM_H = 0.01; const SEAM_SPAN = 6.4;
const seamZ0 = floorBox.lo[2] + 0.06; const seamZ1 = floorBox.hi[2] - 0.06;
for (let i = 0; i < SEAMS; i += 1) {
  const x = -SEAM_SPAN / 2 + (SEAM_SPAN * i) / (SEAMS - 1);
  push(x, floorTopY + SEAM_H / 2 - 0.004, (seamZ0 + seamZ1) / 2, SEAM_W, SEAM_H, seamZ1 - seamZ0, SEAM_UV);
}

/* ------------------------------------------------------------ 메시로 굽는다 */
/** 상자 하나 = 삼각형 12개 = 정점 36개. 면마다 법선이 하나라 평면 음영이 유지된다. */
const FACES = [
  { n: [0, 0, 1], q: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], q: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
  { n: [1, 0, 0], q: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
  { n: [-1, 0, 0], q: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { n: [0, 1, 0], q: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [0, -1, 0], q: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
];
const positions = []; const normals = []; const uvs = [];
// 새 노드는 뒷벽의 부모 아래에 항등 변환으로 놓는다. 그래서 정점은 그 부모의 좌표계로 옮긴다.
const parentInv = invert(wall.parentWorld);
const toParent = (p) => apply(parentInv, p);
const rotN = (n) => {
  // parentWorld 가 균등 스케일 + 이동이라 법선은 방향만 옮기면 된다.
  const o = apply(parentInv, n); const z = apply(parentInv, [0, 0, 0]);
  const v = [o[0] - z[0], o[1] - z[1], o[2] - z[2]];
  const L = Math.hypot(...v) || 1;
  return [v[0] / L, v[1] / L, v[2] / L];
};
for (const b of boxes) {
  for (const face of FACES) {
    const corner = (k) => toParent([
      b.c[0] + (face.q[k][0] * b.s[0]) / 2,
      b.c[1] + (face.q[k][1] * b.s[1]) / 2,
      b.c[2] + (face.q[k][2] * b.s[2]) / 2,
    ]);
    const n = rotN(face.n);
    for (const [a, bb, c] of [[0, 1, 2], [0, 2, 3]]) {
      for (const k of [a, bb, c]) { const p = corner(k); positions.push(p[0], p[1], p[2]); normals.push(n[0], n[1], n[2]); uvs.push(b.uv[0], b.uv[1]); }
    }
  }
}

const buffer = doc.getRoot().listBuffers()[0];
const prim = doc.createPrimitive()
  .setMaterial(rubber)
  .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer))
  .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(normals)).setBuffer(buffer))
  .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(uvs)).setBuffer(buffer));
const mesh = doc.createMesh('barnInteriorBoarding').addPrimitive(prim);
const node = doc.createNode('barnInteriorBoarding').setMesh(mesh);
// 뒷벽이 달린 그 부모에 붙인다.
const parentNode = doc.getRoot().listNodes().find((n) => n.listChildren().includes(wall.node))
  ?? doc.getRoot().listScenes()[0];
parentNode.addChild(node);

report.added = {
  node: 'barnInteriorBoarding',
  material: rubber.getName(),
  drawCallsAdded: 1,
  studs: { count: STUDS, sizeMm: [mm(STUD_W), mm(studTopY - studBottomY), mm(STUD_D)], spacingMm: mm(STUD_SPAN / (STUDS - 1)), paletteCell: '(3,0) #7f4032' },
  girt: { count: 1, sizeMm: [7800, mm(GIRT_H), mm(GIRT_D)], atYmm: mm(GIRT_Y), paletteCell: '(12,0) #7c3d2e' },
  floorSeams: { count: SEAMS, sizeMm: [mm(SEAM_W), mm(SEAM_H), mm(seamZ1 - seamZ0)], spacingMm: mm(SEAM_SPAN / (SEAMS - 1)), paletteCell: '(13,0) #4b382a' },
  trianglesAdded: positions.length / 9,
};
report.trianglesAfter = triangleCount(doc);
report.whyTrianglesGrew = '없던 실내 목구조를 만드는 항목이라 삼각형 보존이 불가능하다. 상자 21개 = 252 삼각형, 원본의 1.7 %.';

if (!DRY) {
  await io.write(OUT, doc);
  fs.writeFileSync(
    path.join(REPO, 'examples/harvest-frontier/exports/building/barn.interior.report.json'),
    JSON.stringify(report, null, 2),
  );
}
process.stdout.write(
  `뒷벽 안쪽 세로 샛기둥 ${STUDS}개 + 가로 띠장 1개, 바닥 판자 이음 ${SEAMS}줄\n`
  + `삼각형 ${report.trianglesBefore} -> ${report.trianglesAfter} (+${report.trianglesAfter - report.trianglesBefore})`
  + `${DRY ? '  (--dry: 쓰지 않음)' : `  → ${path.relative(REPO, OUT)}`}\n`,
);
