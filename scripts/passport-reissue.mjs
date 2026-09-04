#!/usr/bin/env node
/**
 * 여권을 옆에 놓인 파일에 맞춘다.
 *
 * 여권(`*.glb.passport.json`)은 "이 파일이 저 원본에서 이 동작들을 거쳐 나왔다"는 증서다.
 * 증서인 이상 `outputHash` 가 옆에 놓인 GLB 의 해시와 같아야 한다.
 *
 * 2026-09-04 궤짝 세 개가 그렇지 않았다. 파이프라인이 여권을 쓴 뒤에 색표 굽기가 파일을
 * 한 번 더 바꿨는데, 그 일은 파이프라인 밖이라 여권에 적히지 않았다. 사는 사람이 받는
 * 묶음 안에서 증서와 파일이 서로를 부정하고 있었다.
 *
 * 원본 쪽(`sourceHash`·`before`)은 여권에 이미 적혀 있으므로 그대로 두고, 결과 쪽만 지금
 * 파일에서 다시 재어 채운다. 그 사이에 무슨 일이 있었는지는 `operations` 에 덧붙인다.
 * 파이프라인을 다시 돌리지 않는 이유는, 다시 돌리면 색표 굽기 이전 파일이 나와 지금
 * 파는 파일과 또 달라지기 때문이다.
 *
 * 사용:
 *   node scripts/passport-reissue.mjs                미리보기
 *   node scripts/passport-reissue.mjs --apply        어긋난 여권을 고쳐 쓴다
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { inspectAsset } from "../packages/core/src/index.ts";

const root = resolve(import.meta.dirname, "..");
const apply = process.argv.includes("--apply");

/** 파이프라인 뒤에 가게가 하는 일. 여권이 이름을 댈 수 있어야 한다. */
const AFTER_PIPELINE = [
  {
    id: "bake-vertex-colour-palette",
    description:
      "Moved COLOR_0 into an embedded palette texture so a shader that does not read vertex colour still shows the model in colour. Verified vertex by vertex against the original: worst difference 0.5 of an sRGB step.",
    count: 1,
    safety: "lossless",
  },
  {
    id: "prune-orphan-data",
    description: "Removed accessors and buffer views no longer referenced by any primitive, so the download does not carry the replaced vertex colour.",
    count: 1,
    safety: "lossless",
  },
];

const rows = [];
for (const slug of readdirSync(resolve(root, "public/market")).sort()) {
  let names;
  try {
    names = readdirSync(resolve(root, "public/market", slug));
  } catch {
    continue;
  }
  for (const name of names.filter((n) => n.endsWith(".glb.passport.json"))) {
    const passportPath = resolve(root, "public/market", slug, name);
    const glbName = name.replace(/\.passport\.json$/, "");
    const glbPath = resolve(root, "public/market", slug, glbName);
    let passport;
    let bytes;
    try {
      passport = JSON.parse(readFileSync(passportPath, "utf8"));
      bytes = readFileSync(glbPath);
    } catch {
      rows.push({ slug, 결과: "건너뜀", 이유: `${glbName} 을 못 읽었습니다` });
      continue;
    }
    const outputHash = createHash("sha256").update(bytes).digest("hex");
    if (outputHash === passport.outputHash) {
      rows.push({ slug, 결과: "일치", 이유: "" });
      continue;
    }
    const report = inspectAsset({ entry: glbName, files: new Map([[glbName, new Uint8Array(bytes)]]) });
    if (!report) {
      rows.push({ slug, 결과: "건너뜀", 이유: "파일을 열지 못했습니다" });
      continue;
    }
    const already = new Set((passport.operations ?? []).map((operation) => operation.id));
    const next = {
      ...passport,
      passportId: `passport-${String(passport.sourceHash).slice(0, 12)}-${outputHash.slice(0, 12)}`,
      outputHash,
      outputInspectionDigest: report.resultDigest,
      operations: [...(passport.operations ?? []), ...AFTER_PIPELINE.filter((operation) => !already.has(operation.id))],
      after: { metrics: report.metrics, score: report.score },
    };
    rows.push({
      slug,
      결과: "고침",
      이유:
        `${String(passport.outputHash).slice(0, 8)}→${outputHash.slice(0, 8)}` +
        ` · 텍스처 ${passport.after?.metrics?.textureCount ?? "-"}→${report.metrics.textureCount}`,
      write: [passportPath, `${JSON.stringify(next, null, 2)}\n`],
    });
  }
}

const w = (s, n) => String(s ?? "").padEnd(n);
console.log(`${w("상품", 28)}${w("결과", 10)}비고`);
for (const row of rows) console.log(`${w(row.slug, 28)}${w(row.결과, 10)}${row.이유}`);
const fixable = rows.filter((row) => row.write);
console.log(`\n여권 ${rows.length}개 · 어긋난 것 ${fixable.length}개`);
if (!fixable.length) process.exit(0);
if (!apply) {
  console.log("미리보기입니다. 고치려면 --apply 를 붙이세요.");
  process.exit(0);
}
for (const row of fixable) writeFileSync(row.write[0], row.write[1], "utf8");
console.log(`${fixable.length}개를 고쳐 썼습니다.`);
