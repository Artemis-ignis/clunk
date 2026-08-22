// 코드에 박혀 있는 "실측값"을 실제 실행으로 다시 뽑아 제자리에 써 넣는다.
//
// 왜 필요한가: 리포트의 metric이 하나만 늘어도 resultDigest가 전부 바뀐다. 그 값은
// 테스트의 회귀 잠금, 랜딩의 CLI 카드, MCP 전사 세 곳에 흩어져 박혀 있다. 손으로
// 옮기다 보면 한 곳을 빠뜨리고, 그 한 곳이 사이트에 "실측 응답"이라는 이름으로
// 남는다. 실제로 세 번 그랬다.
//
// 실행: node scripts/refresh-pinned-evidence.mjs
//   --check  값이 어긋나 있으면 고치지 않고 1로 종료한다 (CI용)
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("tsx/cjs");

const { inspectAsset, optimizeAsset, createAssetBundle } = await import(
  "../packages/core/src/index.ts"
);

const checkOnly = process.argv.includes("--check");
const SAMPLES = ["clunk-messy-sample.glb", "clunk-ready-sample.glb"];
const PROFILES = ["web", "mobile", "pc"];

async function bundle(name) {
  return createAssetBundle(name, new Uint8Array(await readFile(`public/samples/${name}`)));
}

const digests = {};
for (const name of SAMPLES) {
  const asset = await bundle(name);
  digests[name] = {};
  for (const profileId of PROFILES) {
    digests[name][profileId] = inspectAsset(asset, { profileId }).resultDigest;
  }
}

const messy = await bundle("clunk-messy-sample.glb");
const pc = inspectAsset(messy, { profileId: "pc" });
const optimizedWeb = optimizeAsset(messy, { profileId: "web" });

/** 잠금 블록은 통째로 다시 쓴다. 항목 순서에 기대는 치환은 조용히 어긋난다. */
const digestBlock = [
  "const BUILT_IN_DIGESTS = {",
  ...SAMPLES.flatMap((name) => [
    `  "${name}": {`,
    ...PROFILES.map((profileId) => `    ${profileId}: "${digests[name][profileId]}",`),
    "  },",
  ]),
  "} as const;",
].join("\n");

const replacements = [
  {
    file: "tests/custom-profile.test.ts",
    find: /const BUILT_IN_DIGESTS = \{[\s\S]*?\} as const;/,
    value: digestBlock,
    label: "BUILT_IN_DIGESTS",
  },
  {
    file: "tests/custom-profile.test.ts",
    find: /(assert\.equal\(optimized\.outputHash, ")[0-9a-f]{64}(")/,
    value: (m, a, b) => `${a}${optimizedWeb.outputHash}${b}`,
    label: "optimized.outputHash",
  },
  {
    file: "tests/custom-profile.test.ts",
    find: /(assert\.equal\(optimized\.after\.resultDigest, ")[0-9a-f]{64}(")/,
    value: (m, a, b) => `${a}${optimizedWeb.after.resultDigest}${b}`,
    label: "optimized.after.resultDigest",
  },
  {
    file: "app/components/product-facts.ts",
    find: /(byteLength: )\d+(,)/,
    value: (m, a, b) => `${a}${pc.byteLength}${b}`,
    label: "CLI_SAMPLE.byteLength",
  },
  {
    file: "app/components/product-facts.ts",
    find: /(inputHash: ")[0-9a-f]{64}(")/,
    value: (m, a, b) => `${a}${pc.inputHash}${b}`,
    label: "CLI_SAMPLE.inputHash",
  },
  {
    file: "app/components/product-facts.ts",
    find: /(resultDigest: ")[0-9a-f]{64}(")/,
    value: (m, a, b) => `${a}${pc.resultDigest}${b}`,
    label: "CLI_SAMPLE.resultDigest",
  },
  {
    file: "app/components/product-facts.ts",
    find: /(\n {2}score: )\d+(,)/,
    value: (m, a, b) => `${a}${pc.score.score}${b}`,
    label: "CLI_SAMPLE.score",
  },
  {
    file: "app/components/product-facts.ts",
    find: /(hardBlockerCount: )\d+(,)/,
    value: (m, a, b) => `${a}${pc.score.hardBlockerCount}${b}`,
    label: "CLI_SAMPLE.hardBlockerCount",
  },
  {
    file: "app/components/product-facts.ts",
    find: /(findings: \[)[\s\S]*?(\n {2}\],)/,
    value: (m, a, b) =>
      a +
      pc.findings
        .map((finding) => `\n    { severity: "${finding.severity}", ruleId: "${finding.ruleId}" },`)
        .join("") +
      b,
    label: "CLI_SAMPLE.findings",
  },
];

const touched = new Map();
const stale = [];
for (const { file, find, value, label } of replacements) {
  const before = touched.get(file) ?? (await readFile(file, "utf8"));
  if (!find.test(before)) {
    console.error(`FAIL: ${file} 에서 ${label} 자리를 찾지 못했습니다.`);
    process.exit(2);
  }
  const after = before.replace(find, value);
  if (after !== before) stale.push(`${file} :: ${label}`);
  touched.set(file, after);
}

if (checkOnly) {
  if (stale.length) {
    console.error("고정값이 실제 실행과 다릅니다:");
    for (const entry of stale) console.error(`  ${entry}`);
    console.error("node scripts/refresh-pinned-evidence.mjs 로 갱신하세요.");
    process.exit(1);
  }
  console.log("고정값이 실제 실행과 일치합니다.");
  process.exit(0);
}

for (const [file, contents] of touched) await writeFile(file, contents);
console.log(stale.length ? `갱신 ${stale.length}건:` : "바뀐 값 없음.");
for (const entry of stale) console.log(`  ${entry}`);
console.log("");
console.log("MCP 전사는 별도입니다: node scripts/capture-mcp-transcript.mjs");
