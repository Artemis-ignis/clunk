import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

/**
 * 남의 파일이 우리 마켓에 올라가지 않게 막는다.
 *
 * 2026-09-04. 경쟁사(polyfork.dev)의 무료 에셋을 받아 Harvest Frontier 엔진에 넣어 보는
 * 시험을 했다. 그 라이선스는 게임에 넣는 것은 허용하지만 **원본 재판매는 금지**한다 —
 * 즉 우리 마켓에 상품으로 올리면 라이선스 위반이다.
 *
 * 사람이 기억하기로 막을 일이 아니다. 파일 하나를 잘못 복사하면 그대로 팔린다.
 * 그래서 대장(docs/legal/third-party-assets.md)에 적힌 SHA-256 을 마켓이 서빙하는
 * 자리에서 직접 찾는다. 대장에 적는 순간 자동으로 막히고, 적지 않으면 막히지 않는다 —
 * 그래서 대장에 적는 것이 규칙의 전부다.
 */

const LEDGER = "docs/legal/third-party-assets.md";

/** 마켓이 실제로 서빙하는 자리. 여기 있는 파일은 구매자가 받을 수 있다. */
const SERVED_DIRS = ["public/market"];

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(new URL(dir, root), { withFileTypes: true });
  } catch {
    return; // 없는 디렉터리는 검사할 것도 없다
  }
  for (const entry of entries) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

/** 대장에서 SHA-256 을 뽑는다. 표 안이든 본문이든 64자리 16진수면 잡는다. */
function ledgerHashes(markdown) {
  return new Set((markdown.match(/\b[0-9a-f]{64}\b/gu) ?? []).map((h) => h.toLowerCase()));
}

test("제3자 에셋 대장이 있고, 규칙과 해시를 담고 있다", async () => {
  const ledger = await source(LEDGER);
  assert.match(ledger, /마켓에 올리지 않습니다/u, "대장이 금지 규칙을 적지 않았습니다");
  const hashes = ledgerHashes(ledger);
  assert.ok(
    hashes.size > 0,
    "대장에 SHA-256 이 하나도 없습니다 — 해시가 없으면 아래 검사가 아무것도 막지 못합니다",
  );
});

test("대장에 적힌 제3자 파일이 마켓에 올라가 있지 않다", async () => {
  const hashes = ledgerHashes(await source(LEDGER));
  const offenders = [];
  for (const dir of SERVED_DIRS) {
    for await (const path of walk(dir)) {
      const bytes = await readFile(new URL(path, root));
      const sha = createHash("sha256").update(bytes).digest("hex");
      if (hashes.has(sha)) offenders.push(`${path} (${sha})`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `제3자 파일이 마켓에 올라가 있습니다. 라이선스가 원본 재판매를 금지합니다: ${offenders.join(", ")}`,
  );
});

test("마켓 자리에 제3자임을 이름으로 밝힌 경로가 없다", async () => {
  // 해시는 파일이 한 바이트만 달라져도 빗나간다. 이름 규칙은 그 틈을 메우는 두 번째 그물이다.
  const named = [];
  for (const dir of SERVED_DIRS) {
    for await (const path of walk(dir)) {
      if (/thirdparty|third-party|polyfork|sketchfab|turbosquid|assetstore/iu.test(path)) named.push(path);
    }
  }
  assert.deepEqual(named, [], `마켓 자리에 제3자 출처 이름을 가진 파일이 있습니다: ${named.join(", ")}`);
});
