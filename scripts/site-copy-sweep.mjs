#!/usr/bin/env node
/**
 * 사이트의 모든 화면을 받아, 있으면 안 되는 말이 남아 있는지 본다.
 *
 * 왜 소스 grep 이 아닌가. 2026-09-04 크레딧과 낱개 가격을 걷어내면서 API·마켓·문서는
 * 고쳤는데 /pricing·/studio·/app·/consent·/signup 다섯 화면을 통째로 놓쳤다. 소스에는
 * 문구가 상수와 템플릿으로 흩어져 있어 grep 으로는 안 보이고, 방문자는 렌더된 글자를
 * 본다. 그래서 여기서는 실제 HTML 을 받아 태그를 걷어내고 남은 글자만 본다.
 *
 * 사용:
 *   node scripts/site-copy-sweep.mjs                 # 라이브
 *   SWEEP_BASE=http://localhost:3000 node scripts/site-copy-sweep.mjs
 *   node scripts/site-copy-sweep.mjs /pricing /studio
 *
 * 지적이 하나라도 있으면 1로 끝난다.
 */
const BASE = process.env.SWEEP_BASE ?? "https://clunk.games";

const PAGES = [
  "/", "/agents", "/marketplace", "/pricing", "/privacy", "/refunds", "/review", "/series",
  "/studio", "/app", "/webmcp", "/terms", "/consent", "/login", "/signup",
  "/kits", "/connect",
  "/marketplace/hf-tractor-compact", "/marketplace/cozy-crate-closed", "/marketplace/tex-soil-tilled-v2",
];

/**
 * 규칙. `only` 가 있으면 그 화면에서만 본다 — 같은 말이라도 자리에 따라 뜻이 다르다.
 * 법률 문서가 "유상 거래가 없다"고 적는 것은 고지 의무이고, 요금 화면이 실행 횟수를
 * 앞세우는 것은 파는 것을 잘못 말하는 것이다.
 */
const RULES = [
  { name: "크레딧", re: /크레딧/g, why: "현금을 재화로 바꾸는 것처럼 읽혀 결제 심사가 반려한 개념" },
  { name: "가챠", re: /뽑기|가챠|캡슐/g, why: "사행성으로 반려된 개념" },
  { name: "주식회사", re: /주식회사/g, why: "등록증은 개인사업자 「아르테미스」" },
  { name: "낱개 가격", re: /개당|낱개로 (사|살|팔)|₩[\d,]+\s*(에|짜리)/g, why: "에셋은 하나씩 팔지 않는다" },
  { name: "계량을 앞세움", re: /매달 실행|실행 횟수가 다시|성공한 실행 1건/g, only: ["/pricing"], why: "요금의 주제는 무료와 구독이지 계량이 아니다" },
  { name: "그리기 횟수", re: /그리기\s*\d+\s*회|드로우콜/g, why: "사는 사람 화면에서 뺀 지표" },
  { name: "메타 문구", re: /표시된 가격은|검사 맡|데모입니다/g, why: "방문자가 아니라 운영자에게 하는 말" },
];

const strip = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/\s+/g, " ")
  .trim();

const asked = process.argv.slice(2).filter((a) => a.startsWith("/"));
const pages = asked.length ? asked : PAGES;
let total = 0;

for (const page of pages) {
  let html;
  try {
    const response = await fetch(`${BASE}${page}?cb=${Math.random().toString(36).slice(2)}`);
    if (!response.ok) { console.log(`${page.padEnd(38)} HTTP ${response.status}`); total += 1; continue; }
    html = await response.text();
  } catch (error) {
    console.log(`${page.padEnd(38)} 못 받음 — ${error.message}`);
    total += 1;
    continue;
  }
  const text = strip(html);
  const hits = [];
  for (const rule of RULES) {
    if (rule.only && !rule.only.includes(page)) continue;
    const found = [...text.matchAll(rule.re)];
    if (!found.length) continue;
    hits.push({
      ...rule,
      count: found.length,
      sample: found.slice(0, 2).map((m) => `…${text.slice(Math.max(0, (m.index ?? 0) - 26), (m.index ?? 0) + m[0].length + 26).trim()}…`),
    });
  }
  total += hits.length;
  if (!hits.length) { console.log(`${page.padEnd(38)} 이상 없음`); continue; }
  console.log(`${page.padEnd(38)} 지적 ${hits.length}`);
  for (const hit of hits) {
    console.log(`   ${hit.name} ×${hit.count} — ${hit.why}`);
    for (const line of hit.sample) console.log(`      ${line}`);
  }
}

console.log(total ? `\n지적 ${total}건` : `\n${pages.length}개 화면 모두 이상 없음`);
process.exit(total ? 1 : 0);
