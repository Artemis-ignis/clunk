#!/usr/bin/env node
/**
 * 파는 3D 파일 전부를 훑어, 정점 색을 색표 그림으로 옮기고 옮기기 전후의 색을 대조한다.
 * 대조를 통과한 것만 원본 자리에 넣는다.
 *
 * 왜 대조가 필요한가. 색을 옮기는 일은 눈으로는 확인되지 않는다 — 렌더러가 정점 색을
 * 읽어 주면 옮기기 전후가 똑같이 보이고, 안 읽어 주면 옮기기 전이 흰색으로 보인다.
 * 어느 쪽도 "색이 정확히 옮겨졌는가"를 답하지 않는다. 그래서 꼭짓점마다 원래 색과
 * 새 좌표가 집어 오는 칸의 색을 직접 견준다.
 *
 * 오차의 기준은 sRGB 1칸이다. 정점 색은 선형, 그림은 sRGB 라 왕복하면 8비트 반올림
 * 오차가 남는다. 값이 같은지로 보면 색이 많은 파일은 전부 불합격이 나오지만, 눈이 보는
 * 공간에서 1칸 이하는 화면에서 구분되지 않는다.
 *
 * 색표를 어느 좌표에서 찾는지는 파일마다 다르다. 원래 UV 가 있던 파일은 그것을 덮지
 * 않으려고 두 번째 자리를 쓴다. 그래서 재질이 가리키는 자리(texCoord)를 보고 읽는다.
 *
 * 색을 옮길 수 없는 파일도 여기서 함께 손본다 — 앞서 구운 파일에 아무도 안 쓰는 정점
 * 색 자료가 그대로 남아 있었다. 산 사람이 계속 내려받으므로 지운다.
 *
 * 사용:
 *   node scripts/palette-bake-sweep.mjs           미리보기
 *   node scripts/palette-bake-sweep.mjs --apply   통과한 것을 원본에 적용
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

import { NodeIO, PropertyType } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

const linearToSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055);

/**
 * PNG 를 픽셀로. sharp 를 안 쓰는 이유는 `@gltf-transform/functions` 를 불러오면 sharp 의
 * raw 픽셀 경로가 libvips 안에서 깨지기 때문이다. 색표는 우리가 만든 파일이라 필터 0 짜리
 * 8비트 RGBA 한 종류만 나온다.
 */
function decodePng(bytes) {
  let at = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (at < bytes.length) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.subarray(at + 4, at + 8).toString("ascii");
    const body = bytes.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[9] !== 6) throw new Error(`색표가 8비트 RGBA 가 아닙니다 (깊이 ${body[8]}, 형식 ${body[9]})`);
    } else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter !== 0) throw new Error(`색표 ${y}번째 줄의 필터가 ${filter} 입니다 — 이 도구는 0만 읽습니다`);
    raw.copy(out, y * stride, y * (stride + 1) + 1, (y + 1) * (stride + 1));
  }
  return { data: out, width, height, channels: 4 };
}

/** 원본에서 꼭짓점 색을 부품 순서대로. */
async function readSource(path) {
  const doc = await io.read(path);
  const prims = [];
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const col = prim.getAttribute("COLOR_0");
      if (!col) {
        prims.push(null); // 정점 색이 없는 부품. 자리를 비워 둬야 짝이 맞는다.
        continue;
      }
      const colours = [];
      for (let i = 0; i < col.getCount(); i++) colours.push(col.getElement(i, [0, 0, 0]).slice(0, 3));
      prims.push(colours);
    }
  return prims;
}

/** 옮긴 파일에서 각 꼭짓점이 실제로 집어 오는 색. 없으면 null(안 옮긴 부품). */
async function readBaked(path) {
  const doc = await io.read(path);
  const images = new Map();
  const prims = [];
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const info = prim.getMaterial()?.getBaseColorTextureInfo();
      const tex = prim.getMaterial()?.getBaseColorTexture();
      const uv = info ? prim.getAttribute(`TEXCOORD_${info.getTexCoord()}`) : null;
      if (!tex || !uv) {
        prims.push(null);
        continue;
      }
      if (!images.has(tex)) images.set(tex, decodePng(Buffer.from(tex.getImage())));
      const img = images.get(tex);
      const picked = [];
      for (let i = 0; i < uv.getCount(); i++) {
        const [u, v] = uv.getElement(i, [0, 0]);
        const x = Math.min(img.width - 1, Math.max(0, Math.floor(u * img.width)));
        const y = Math.min(img.height - 1, Math.max(0, Math.floor(v * img.height)));
        const at = (y * img.width + x) * img.channels;
        picked.push([img.data[at], img.data[at + 1], img.data[at + 2]]); // sRGB 8비트 그대로
      }
      prims.push(picked);
    }
  return prims;
}

/** 아무 부품도 안 쓰는 자료를 지운다. 지우는 것은 자료와 그 조각뿐이다. */
async function pruneOrphans(input, output) {
  const doc = await io.read(input);
  await doc.transform(
    prune({
      propertyTypes: [PropertyType.ACCESSOR, PropertyType.BUFFER_VIEW],
      keepAttributes: true,
      keepLeaves: true,
      keepSolidTextures: true,
      keepExtras: true,
    }),
  );
  await io.write(output, doc);
}

/** 파일이 들고 있는, 아무도 참조하지 않는 자료의 개수. */
function orphanCount(path) {
  const b = readFileSync(path);
  if (b.length < 20 || b.readUInt32LE(0) !== 0x46546c67) return 0;
  const j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8"));
  const used = new Set();
  for (const m of j.meshes ?? [])
    for (const p of m.primitives ?? []) {
      for (const a of Object.values(p.attributes)) used.add(a);
      if (p.indices !== undefined) used.add(p.indices);
      for (const t of p.targets ?? []) for (const a of Object.values(t)) used.add(a);
    }
  for (const an of j.animations ?? []) for (const s of an.samplers ?? []) used.add(s.input), used.add(s.output);
  for (const sk of j.skins ?? []) if (sk.inverseBindMatrices !== undefined) used.add(sk.inverseBindMatrices);
  return (j.accessors ?? []).length - used.size;
}

const apply = process.argv.includes("--apply");
const work = "tmp/palette-sweep";
mkdirSync(work, { recursive: true });
const rows = [];

for (const slug of readdirSync("public/market").sort()) {
  let names;
  try {
    names = readdirSync(`public/market/${slug}`).filter((f) => f.toLowerCase().endsWith(".glb")).filter((n) => !/^preview-.*.glb$/i.test(n)) /* 비로그인 뷰어용 미리보기 GLB(preview-*.glb)는 판매 파일이 아니다 */;
  } catch {
    continue; // 폴더가 아닌 것
  }
  for (const name of names.sort()) {
    const src = `public/market/${slug}/${name}`;
    const out = `${work}/${slug}__${name}`;
    const label = `${slug}/${name}`;
    const before = await readSource(src);
    const sizeA = statSync(src).size;

    // 옮길 정점 색이 없는 파일은 남은 찌꺼기만 치운다.
    if (!before.some(Boolean)) {
      const orphans = orphanCount(src);
      if (!orphans) {
        rows.push({ label, 결과: "그대로", 이유: "옮길 정점 색 없음 · 찌꺼기 없음" });
        continue;
      }
      await pruneOrphans(src, out);
      const sizeB = statSync(out).size;
      rows.push({
        label,
        결과: "찌꺼기 정리",
        용량: `${(sizeA / 1024).toFixed(0)}→${(sizeB / 1024).toFixed(0)}KB (${(((sizeB - sizeA) / sizeA) * 100).toFixed(1)}%)`,
        이유: `안 쓰는 자료 ${orphans}개`,
      });
      if (apply) copyFileSync(out, src);
      continue;
    }

    try {
      execFileSync("node", ["scripts/bake-vertex-colour-palette.mjs", src, out], { encoding: "utf8" });
    } catch (e) {
      rows.push({ label, 결과: "손대지 않음", 이유: String(e.stderr || e.message).trim().split("\n")[0].slice(0, 78) });
      continue;
    }

    const after = await readBaked(out);
    let worst = 0;
    let sum = 0;
    let n = 0;
    let left = 0;
    let shape = after.length === before.length;
    for (let p = 0; p < before.length && shape; p++) {
      if (!before[p]) continue; // 원래 정점 색이 없던 부품
      if (!after[p]) {
        left += 1; // 정점 색인 채로 남긴 부품. 색이 어긋난 것이 아니다.
        continue;
      }
      if (after[p].length !== before[p].length) {
        shape = false;
        break;
      }
      for (let i = 0; i < before[p].length; i++)
        for (let k = 0; k < 3; k++) {
          const d = Math.abs(linearToSrgb(before[p][i][k]) * 255 - after[p][i][k]);
          worst = Math.max(worst, d);
          sum += d;
          n++;
        }
    }

    const sizeB = statSync(out).size;
    const ok = shape && n > 0 && worst <= 1;
    rows.push({
      label,
      결과: ok ? "통과" : "불일치",
      오차: shape && n ? `최대 ${worst.toFixed(2)} · 평균 ${(sum / n).toFixed(3)}` : "형상이 변함",
      용량: `${(sizeA / 1024).toFixed(0)}→${(sizeB / 1024).toFixed(0)}KB (${(((sizeB - sizeA) / sizeA) * 100).toFixed(1)}%)`,
      이유: left ? `정점 색으로 남긴 부품 ${left}개` : "",
    });
    if (ok && apply) copyFileSync(out, src);
  }
}

const w = (s, n) => String(s ?? "").padEnd(n);
console.log(`${w("파일", 48)}${w("결과", 14)}${w("오차(sRGB 칸)", 26)}${w("용량", 26)}비고`);
for (const r of rows) console.log(`${w(r.label, 48)}${w(r.결과, 14)}${w(r.오차, 26)}${w(r.용량, 26)}${r.이유 ?? ""}`);
const count = (k) => rows.filter((r) => r.결과 === k).length;
console.log(
  `\n통과 ${count("통과")} · 찌꺼기 정리 ${count("찌꺼기 정리")} · 불일치 ${count("불일치")}` +
    ` · 손대지 않음 ${count("손대지 않음")} · 그대로 ${count("그대로")}`,
);
console.log(apply ? "원본에 적용했습니다." : "미리보기입니다. 적용하려면 --apply 를 붙이세요.");
if (count("불일치") > 0) process.exit(1);
writeFileSync(`${work}/report.json`, `${JSON.stringify(rows, null, 2)}\n`);
