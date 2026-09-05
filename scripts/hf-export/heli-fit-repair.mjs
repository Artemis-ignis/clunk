#!/usr/bin/env node
/**
 * 헬리콥터에서 부품이 붙어야 할 곳에 안 붙어 있는 두 군데를 붙인다.
 *
 * 무엇이 잘못됐나. 자로 잰 값이다.
 *
 *   뒷문 두 짝   동체 뒷면이 Z=-2560 인데 문 앞면이 Z=-2578 — 18 mm 뒤에 떠 있다.
 *                닫힌 자세인데 동체에 닿지 않아, 뒤에서 보면 그 틈으로 기체 안이 보인다.
 *                상품 설명이 "뒷문 두 짝이 바깥으로 열립니다" 라고 파는 바로 그 부품이다.
 *
 *   수평 미익 끝판  미익 윗면이 Y=2368 인데 끝판 바닥이 Y=2376 — 좌우 둘 다 8 mm 떠 있다.
 *                미익 위에 서 있어야 하는데 아무것도 안 닿는다. 3/4 시점에서 끝판이
 *                미익에 얹힌 것이 아니라 옆에 세워 둔 판때기로 읽히는 까닭이다.
 *
 * 왜 노드를 옮기나. 뒷문은 회전으로만 움직인다(doors_open 이 rotation 채널만 몰고,
 * translation 은 경첩 자리로 고정돼 있다). 그래서 노드를 옮기면 닫힌 자세와 열린 자세가
 * 함께 옮겨지고 여닫는 동작은 그대로다. 정점을 옮기면 경첩 축이 어긋나 문이 비뚤게 열린다.
 *
 * 손대지 않는 것. 뒷문 두 짝 사이 48 mm 틈과, 문 두 짝 폭 합계(1,504 mm)가 동체 폭
 * (1,890 mm)을 못 덮는 것은 여기서 고치지 않는다. 둘 다 고치려면 문을 늘려야 하는데,
 * 그것은 원래 모양을 바꾸는 일이라 이 자리에서 혼자 정할 것이 아니다. 재 둔 값만 남긴다.
 *
 * 사용: node scripts/hf-export/heli-fit-repair.mjs [--apply]
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

const root = resolve(import.meta.dirname, "../..");
const TARGET = resolve(root, "public/market/clunk-heli-h145/h145.glb");
const BACKUP = resolve(root, "tmp/hf-repair/h145.before-fit.glb");

const apply = process.argv.includes("--apply");
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(TARGET);

const byName = new Map();
const walk = (node) => {
  byName.set(node.getName(), node);
  for (const child of node.listChildren()) walk(child);
};
for (const scene of doc.getRoot().listScenes()) for (const node of scene.listChildren()) walk(node);

/** 세상에서의 상자. 옮기기 전후를 같은 방법으로 잰다. */
function boxOf(node) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const place = (m, p) => [0, 1, 2].map((i) => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i]);
  const gather = (current) => {
    const mesh = current.getMesh();
    if (mesh)
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        for (let i = 0; i < pos.getCount(); i++) {
          const at = place(current.getWorldMatrix(), pos.getElement(i, [0, 0, 0]));
          for (let k = 0; k < 3; k++) {
            if (at[k] < min[k]) min[k] = at[k];
            if (at[k] > max[k]) max[k] = at[k];
          }
        }
      }
    for (const child of current.listChildren()) gather(child);
  };
  gather(node);
  return { min, max };
}

const mm = (v) => `${(v * 1000).toFixed(1)}mm`;
const moves = [];

// 1) 뒷문 두 짝을 동체 뒷면까지 앞으로.
const fuselageBack = boxOf(byName.get("fuselage")).min[2];
for (const name of ["door_rear_right", "door_rear_left"]) {
  const node = byName.get(name);
  if (!node) throw new Error(`${name} 이 없습니다`);
  const before = boxOf(node);
  const gap = fuselageBack - before.max[2]; // 문이 동체보다 뒤에 있으면 양수
  if (gap <= 0.0005) {
    console.log(`${name.padEnd(18)} 이미 닿아 있습니다 (${mm(gap)})`);
    continue;
  }
  const t = node.getTranslation();
  node.setTranslation([t[0], t[1], t[2] + gap]);
  const after = boxOf(node);
  moves.push({ name, before: before.max[2], after: after.max[2], target: fuselageBack, axis: "Z" });
  console.log(`${name.padEnd(18)} 앞면 Z ${mm(before.max[2])} → ${mm(after.max[2])} (동체 뒷면 ${mm(fuselageBack)})`);
}

// 2) 끝판을 수평 미익 윗면까지 아래로.
const stabTop = boxOf(byName.get("h_stab")).max[1];
for (const name of ["endplate_r", "endplate_l"]) {
  const node = byName.get(name);
  if (!node) throw new Error(`${name} 이 없습니다`);
  const before = boxOf(node);
  const gap = before.min[1] - stabTop; // 끝판이 미익보다 위면 양수
  if (gap <= 0.0005) {
    console.log(`${name.padEnd(18)} 이미 닿아 있습니다 (${mm(gap)})`);
    continue;
  }
  const t = node.getTranslation();
  node.setTranslation([t[0], t[1] - gap, t[2]]);
  const after = boxOf(node);
  moves.push({ name, before: before.min[1], after: after.min[1], target: stabTop, axis: "Y" });
  console.log(`${name.padEnd(18)} 바닥 Y ${mm(before.min[1])} → ${mm(after.min[1])} (미익 윗면 ${mm(stabTop)})`);
}

// 옮긴 것이 실제로 닿았는지 다시 잰다. 옮겼다고 말하고 안 닿아 있으면 아무것도 고친 것이 아니다.
const failed = moves.filter((move) => Math.abs(move.after - move.target) > 0.001);
if (failed.length) {
  process.stderr.write(`옮긴 뒤에도 붙지 않은 부품 ${failed.length}개. 손대지 않고 중단합니다.\n`);
  for (const f of failed) process.stderr.write(`  ${f.name}: ${mm(f.after)} vs ${mm(f.target)}\n`);
  process.exit(1);
}

// 고치지 않기로 한 것을 숫자로 남긴다.
// 문이 동체를 못 덮는다는 말은 상자 폭(1,890mm)으로 재면 나오지만, 그것은 기체의 가장
// 넓은 곳이지 뒤쪽 개구부가 아니다. 뒷면 근처를 실제로 잘라 재면 1,660mm 다. 상자로 재면
// 없는 결함을 만들어 내므로 여기서는 그 단면을 잰다.
const dr = boxOf(byName.get("door_rear_right"));
const dl = boxOf(byName.get("door_rear_left"));
const rearWidth = (() => {
  const place = (m, p) => [0, 1, 2].map((i) => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i]);
  const xs = [];
  const gather = (current) => {
    const mesh = current.getMesh();
    if (mesh)
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        for (let i = 0; i < pos.getCount(); i++) {
          const at = place(current.getWorldMatrix(), pos.getElement(i, [0, 0, 0]));
          if (Math.abs(at[2] - fuselageBack) < 0.08) xs.push(at[0]);
        }
      }
    for (const child of current.listChildren()) gather(child);
  };
  gather(byName.get("fuselage"));
  return xs.length ? Math.max(...xs) - Math.min(...xs) : null;
})();
const doorSpan = dr.max[0] - dl.min[0];
console.log(
  `\n손대지 않은 것 — 뒷문 사이 틈 ${mm(dr.min[0] - dl.max[0])}, ` +
    `문 두 짝이 덮는 폭 ${mm(doorSpan)} vs 뒷면 개구부 ${rearWidth === null ? "?" : mm(rearWidth)}` +
    (rearWidth === null ? "" : ` (좌우 여유 ${mm((rearWidth - doorSpan) / 2)}씩)`),
);
console.log("  곡면 뒷면에 평판 문을 다는 구조라 이 여유는 정상 범위로 본다.");

if (!apply) {
  console.log("\n미리보기입니다. 적용하려면 --apply 를 붙이세요.");
  process.exit(0);
}
mkdirSync(resolve(root, "tmp/hf-repair"), { recursive: true });
if (!existsSync(BACKUP)) copyFileSync(TARGET, BACKUP);
await io.write(TARGET, doc);
console.log(`\n${moves.length}곳을 붙였습니다. 되돌리려면 ${BACKUP.replace(`${root}\\`, "").replace(`${root}/`, "")} 를 덮어쓰세요.`);
