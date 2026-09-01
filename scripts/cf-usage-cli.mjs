#!/usr/bin/env node
/**
 * What this account is actually using against Cloudflare's free allowances.
 *
 * The standing instruction is to never cross a free limit. That is only keepable if the
 * numbers are visible, so this asks Cloudflare rather than reasoning about it: R2 storage
 * and object count from the bucket, Worker requests from GraphQL analytics, Workers AI
 * neurons from the account. Anything the API will not tell us is printed as unknown rather
 * than filled in with a guess.
 *
 * The free tiers below are Cloudflare's published figures. They are constants here so a
 * reading is always shown next to the line it must not cross; if Cloudflare changes them,
 * this file is the one place to correct.
 *
 * Usage: npm run cf:usage
 */
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
if (!ACCOUNT || !TOKEN) {
  console.error("CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN 이 필요합니다.");
  process.exit(2);
}
const BUCKET = process.env.CLUNK_CF_R2_BUCKET ?? "clunk-assets";
const WORKER = process.env.CLUNK_CF_WORKER_NAME ?? "clunk";

const FREE = {
  r2StorageBytes: 10 * 1024 ** 3,
  r2ClassAPerMonth: 1_000_000,
  r2ClassBPerMonth: 10_000_000,
  workerRequestsPerDay: 100_000,
  aiNeuronsPerDay: 10_000,
};

const api = async (path) => {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}${path}`, {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  return response.json();
};

const graphql = async (query, variables) => {
  const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return response.json();
};

/** A reading and its ceiling on one line, with the share used, so nothing needs mental maths. */
function line(label, used, limit, unit) {
  if (used === null || used === undefined) {
    console.log(`  ${label.padEnd(22)} 알 수 없음 (한도 ${limit.toLocaleString("ko-KR")}${unit})`);
    return;
  }
  const share = (used / limit) * 100;
  const flag = share >= 80 ? "  ← 한도 임박" : share >= 50 ? "  ← 절반 넘음" : "";
  console.log(
    `  ${label.padEnd(22)} ${used.toLocaleString("ko-KR")}${unit} / ${limit.toLocaleString("ko-KR")}${unit}  (${share.toFixed(2)}%)${flag}`,
  );
}

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 7)}-01`;

console.log(`Cloudflare 무료 한도 대비 사용량 · ${today}\n`);

console.log("R2");
const usage = await api(`/r2/buckets/${BUCKET}/usage`);
if (usage.success) {
  line("저장 용량", Math.round(usage.result.payloadSize / 1048576), Math.round(FREE.r2StorageBytes / 1048576), " MB");
  console.log(`  ${"객체 수".padEnd(22)} ${Number(usage.result.objectCount).toLocaleString("ko-KR")}개`);
  console.log("  (사용량 통계는 몇 분 늦게 반영됩니다)");
} else {
  console.log(`  읽지 못했습니다: ${JSON.stringify(usage.errors)}`);
}

const r2Ops = await graphql(
  `query($account: String!, $since: Date!) {
     viewer { accounts(filter: { accountTag: $account }) {
       r2OperationsAdaptiveGroups(limit: 100, filter: { date_geq: $since }) {
         sum { requests } dimensions { actionType }
       } } } }`,
  { account: ACCOUNT, since: monthStart },
);
const opsGroups = r2Ops?.data?.viewer?.accounts?.[0]?.r2OperationsAdaptiveGroups;
if (Array.isArray(opsGroups)) {
  // Cloudflare bills writes/lists as Class A and reads as Class B.
  const CLASS_A = new Set(["PutObject", "CopyObject", "ListObjects", "CompleteMultipartUpload", "CreateMultipartUpload", "UploadPart"]);
  let a = 0;
  let b = 0;
  for (const group of opsGroups) {
    if (CLASS_A.has(group.dimensions.actionType)) a += group.sum.requests;
    else b += group.sum.requests;
  }
  line("이번 달 Class A", a, FREE.r2ClassAPerMonth, "회");
  line("이번 달 Class B", b, FREE.r2ClassBPerMonth, "회");
} else {
  console.log("  작업 횟수: 알 수 없음 (분석 토큰 권한이 없으면 조회되지 않습니다)");
}

console.log("\nWorkers");
const workerStats = await graphql(
  `query($account: String!, $since: Date!, $worker: String!) {
     viewer { accounts(filter: { accountTag: $account }) {
       workersInvocationsAdaptive(limit: 100, filter: { date_geq: $since, scriptName: $worker }) {
         sum { requests errors }
       } } } }`,
  { account: ACCOUNT, since: today, worker: WORKER },
);
const invocations = workerStats?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive;
if (Array.isArray(invocations)) {
  const requests = invocations.reduce((sum, row) => sum + row.sum.requests, 0);
  const errors = invocations.reduce((sum, row) => sum + row.sum.errors, 0);
  line("오늘 요청", requests, FREE.workerRequestsPerDay, "회");
  console.log(`  ${"오늘 오류".padEnd(22)} ${errors.toLocaleString("ko-KR")}회`);
} else {
  console.log("  알 수 없음 (분석 토큰 권한이 없으면 조회되지 않습니다)");
}

console.log("\nWorkers AI");
const ai = await graphql(
  `query($account: String!, $since: Date!) {
     viewer { accounts(filter: { accountTag: $account }) {
       aiInferenceAdaptiveGroups(limit: 100, filter: { date_geq: $since }) { sum { totalNeurons } }
     } } }`,
  { account: ACCOUNT, since: today },
);
const aiGroups = ai?.data?.viewer?.accounts?.[0]?.aiInferenceAdaptiveGroups;
if (Array.isArray(aiGroups)) {
  line("오늘 뉴런", aiGroups.reduce((sum, row) => sum + row.sum.totalNeurons, 0), FREE.aiNeuronsPerDay, "");
} else {
  console.log("  알 수 없음 (분석 토큰 권한이 없으면 조회되지 않습니다)");
}
console.log("");
