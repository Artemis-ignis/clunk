#!/usr/bin/env tsx
/**
 * Fetch every published listing's real files from the live origin and report what a buyer
 * would actually get.
 *
 * This exists because the shop was serving intermittent 500s on two published texture
 * files for an unknown length of time, and nothing in the product would ever have said so:
 * the listing rendered, the price rendered, the evidence rendered, and the download was a
 * coin flip. A page that loads is not the same as a product that can be delivered.
 *
 * Each file is requested several times on purpose. One request cannot tell a stable
 * failure from an intermittent one, and an intermittent failure is the worse of the two —
 * it survives every spot check.
 *
 * Usage: npm run market:verify [-- --origin https://… --attempts 3]
 */
import { argv, exit } from "node:process";

const arg = (name: string, fallback: string) => {
  const at = argv.indexOf(`--${name}`);
  return at > -1 && argv[at + 1] ? argv[at + 1] : fallback;
};
const ORIGIN = arg("origin", "https://clunk.artemis-clunk.workers.dev");
const ATTEMPTS = Math.max(1, Number(arg("attempts", "3")));

type Listing = {
  slug: string;
  title: string;
  status: string;
  priceCents: number;
  byteLength: number;
  artifact: { entryFileName: string; previewFileName: string };
};

const index = await fetch(`${ORIGIN}/api/marketplace`, { headers: { "cache-control": "no-cache" } });
if (!index.ok) {
  console.error(`목록을 못 읽었습니다: HTTP ${index.status}`);
  exit(2);
}
const { listings } = (await index.json()) as { listings: Listing[] };

type Row = { slug: string; file: string; kind: string; codes: number[]; bytes: number | null; declared?: number };
const rows: Row[] = [];

/**
 * Run the checks a few at a time. Sequentially this walks ~180 MB of texture downloads and
 * takes longer than anyone will wait, so nobody would run it; wide open it looks like an
 * attack on our own origin and the flakiness it is trying to measure gets worse.
 */
const CONCURRENCY = 6;
async function inPool<T>(items: T[], work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++];
        await work(item);
      }
    }),
  );
}

await inPool(listings, async (listing) => {
  const files: Array<{ name: string; kind: string; declared?: number }> = [
    { name: listing.artifact.entryFileName, kind: "판매 파일", declared: listing.byteLength },
  ];
  if (listing.artifact.previewFileName) {
    files.push({ name: listing.artifact.previewFileName, kind: "미리보기" });
  }
  for (const file of files) {
    const codes: number[] = [];
    let bytes: number | null = null;
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      // Cache-busted so a cached hit cannot hide an origin that fails on a miss — which is
      // exactly how the texture failures stayed invisible.
      const response = await fetch(
        `${ORIGIN}/market/${listing.slug}/${encodeURIComponent(file.name)}?verify=${attempt}`,
      );
      codes.push(response.status);
      if (response.ok && bytes === null) bytes = (await response.arrayBuffer()).byteLength;
      else await response.body?.cancel().catch(() => undefined);
    }
    rows.push({ slug: listing.slug, file: file.name, kind: file.kind, codes, bytes, declared: file.declared });
  }
});

const broken = rows.filter((row) => row.codes.some((code) => code !== 200));
const mismatched = rows.filter(
  (row) => row.declared !== undefined && row.bytes !== null && row.bytes !== row.declared,
);

for (const row of broken) {
  const ok = row.codes.filter((code) => code === 200).length;
  console.log(
    `${ok === 0 ? "FAIL" : "FLAKY"}  ${row.slug} · ${row.kind} ${row.file} → ${row.codes.join("/")} (${ok}/${row.codes.length} 성공)`,
  );
}
for (const row of mismatched) {
  console.log(`SIZE  ${row.slug} · ${row.file} → 받은 ${row.bytes} B, 목록이 말한 ${row.declared} B`);
}

console.log(
  `\n파일 ${rows.length}개 × ${ATTEMPTS}회 요청 · 정상 ${rows.length - broken.length} · 실패 ${broken.length} · 크기 불일치 ${mismatched.length}`,
);
exit(broken.length + mismatched.length > 0 ? 1 : 0);
