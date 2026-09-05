#!/usr/bin/env node
/**
 * hf-seeder-compact — `body_coated` 메시의 뒤집힌 감김을 바로잡는다.
 *
 * 2026-09-05 새 규칙 GEO-INVERTED-WINDING 이 마켓 80종 중 이 파일 하나를 잡았다: node 131
 * `body_coated`(48삼각형, 단면 재질)의 닫힌 메시 부호 있는 부피가 네 조각 모두 음수
 * (−0.0973 m³ ×4). 안팎이 뒤집혀 있어 뒷면 컬링을 켜는 엔진에서 앞면이 잘린다.
 *
 * 고치는 법: 그 프리미티브의 삼각형마다 두 번째·세 번째 색인을 맞바꿔 감김을 뒤집고,
 * 법선이 있으면 부호를 뒤집는다. 정점 좌표·개수·삼각형 수는 그대로다.
 *
 * 사용: node scripts/hf-export/seeder-winding-fix.mjs [--apply]
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

const root = resolve(import.meta.dirname, "../..");
const TARGET = resolve(root, "public/market/hf-seeder-compact/seeder.compact.m1.glb");
const BACKUP = resolve(root, "tmp/hf-repair/seeder.before-winding.glb");
const NODE_NAME = "body_coated";
const apply = process.argv.includes("--apply");

await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(TARGET);

const nodes = doc.getRoot().listNodes().filter((n) => n.getName() === NODE_NAME && n.getMesh());
if (nodes.length !== 1) throw new Error(`${NODE_NAME} 노드가 ${nodes.length}개입니다`);
const mesh = nodes[0].getMesh();

/** 삼각형 목록의 부호 있는 부피(로컬 좌표). 음수면 안팎이 뒤집혀 있다. */
function signedVolume(prim) {
  const pos = prim.getAttribute("POSITION");
  const idx = prim.getIndices();
  const count = idx ? idx.getCount() : pos.getCount();
  const at = (k) => pos.getElement(idx ? idx.getScalar(k) : k, [0, 0, 0]);
  let v = 0;
  for (let t = 0; t < count; t += 3) {
    const [a, b, c] = [at(t), at(t + 1), at(t + 2)];
    v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return v;
}

let flipped = 0;
for (const prim of mesh.listPrimitives()) {
  const before = signedVolume(prim);
  if (before >= 0) { console.log(`프리미티브 부피 ${before.toFixed(5)} m³ — 정상, 손대지 않음`); continue; }
  const idx = prim.getIndices();
  if (!idx) throw new Error("색인 없는 프리미티브 — 이 스크립트는 색인 있는 경우만 다룬다");
  const arr = idx.getArray().slice();
  for (let t = 0; t + 2 < arr.length; t += 3) { const tmp = arr[t + 1]; arr[t + 1] = arr[t + 2]; arr[t + 2] = tmp; }
  idx.setArray(arr);
  const normal = prim.getAttribute("NORMAL");
  if (normal) { const n = normal.getArray().slice(); for (let i = 0; i < n.length; i++) n[i] = -n[i]; normal.setArray(n); }
  const after = signedVolume(prim);
  console.log(`프리미티브 부피 ${before.toFixed(5)} → ${after.toFixed(5)} m³ (삼각형 ${arr.length / 3}, 법선 ${normal ? "뒤집음" : "없음"})`);
  if (after <= 0) throw new Error("뒤집었는데도 부피가 양수가 아닙니다 — 중단");
  flipped++;
}
if (!flipped) { console.log("뒤집을 것이 없습니다."); process.exit(0); }
if (!apply) { console.log("미리보기입니다. 적용하려면 --apply."); process.exit(0); }
mkdirSync(resolve(root, "tmp/hf-repair"), { recursive: true });
if (!existsSync(BACKUP)) copyFileSync(TARGET, BACKUP);
await io.write(TARGET, doc);
console.log(`적용했습니다 (${flipped} 프리미티브). 되돌리려면 tmp/hf-repair/seeder.before-winding.glb 를 덮어쓰세요.`);
