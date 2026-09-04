import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

/**
 * 화면과 백엔드의 경계.
 *
 * 2026-09-04. 서버 컴포넌트 두 곳이 SQL 을 직접 들고 있었다 — `/consent` 는 동의
 * 여부를, `/marketplace/[slug]` 는 상품 한 줄을. 같은 사실을 라우트도 따로 조회하고
 * 있었으므로 한 사실에 질의가 둘이었고, 한쪽만 고치면 화면과 API 가 다른 답을 한다.
 *
 * 조회는 app/api/_lib/reads.ts 하나가 소유한다. 백엔드를 다른 언어·다른 서버로 떼어
 * 낼 때 고칠 곳이 그 파일 하나가 되도록 만든 경계이므로, 화면이 다시 SQL 을 들면
 * 그 약속이 깨진다.
 */

async function* walk(dir) {
  for (const entry of await readdir(new URL(dir, root), { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const path = `${dir}${entry.name}`;
    if (entry.isDirectory()) yield* walk(`${path}/`);
    else yield path;
  }
}

const TOUCHES_DB = /getRuntimeDb|\.prepare\(|SELECT\s+[\w.*]+\s+FROM/u;

/**
 * app/api/ 밖에서 저장소를 여는 백엔드 파일들. 라우트 핸들러와 인증 어댑터라 저장소를
 * 여는 것 자체는 옳다 — 여기 적어 두는 것은 금지가 아니라 **재고 목록**이다.
 *
 * 백엔드를 다른 서버로 떼어 낼 때 옮겨야 할 것이 app/api/ 만은 아니라는 사실을 이
 * 목록이 붙잡는다. 새 파일이 저장소를 열면 이 핀이 걸리고, 그때 옮길 목록에 넣을지
 * 조회 모듈로 보낼지 정하면 된다.
 */
const BACKEND_OUTSIDE_API = [
  "app/chatgpt-auth.ts",
  "app/sitemap.xml/route.ts",
];

test("화면 계층은 데이터베이스를 직접 열지 않는다", async () => {
  const offenders = [];
  for await (const path of walk("app/")) {
    if (path.startsWith("app/api/")) continue;
    if (!path.endsWith(".tsx")) continue;
    if (TOUCHES_DB.test(await source(path))) offenders.push(path);
  }
  assert.deepEqual(
    offenders,
    [],
    `화면이 SQL 을 직접 씁니다. app/api/_lib/reads.ts 에 조회를 만들고 그것을 부르세요: ${offenders.join(", ")}`,
  );
});

test("app/api 밖에서 저장소를 여는 파일은 알고 있는 것뿐이다", async () => {
  const found = [];
  for await (const path of walk("app/")) {
    if (path.startsWith("app/api/")) continue;
    if (!path.endsWith(".ts")) continue;
    if (TOUCHES_DB.test(await source(path))) found.push(path);
  }
  assert.deepEqual(
    found.sort(),
    [...BACKEND_OUTSIDE_API].sort(),
    "app/api/ 밖에서 저장소를 여는 파일이 늘거나 줄었습니다. 백엔드를 떼어 낼 때 함께 옮겨야 하는 목록이니 확인하고 갱신하세요",
  );
});

test("한 사실에는 질의가 하나다 — 동의 여부와 상품 한 줄", async () => {
  const reads = await source("app/api/_lib/reads.ts");
  assert.match(reads, /export async function readConsentState/u);
  assert.match(reads, /export async function readPublishedListingBySlug/u);

  // 부르는 쪽이 실제로 이 모듈을 쓰는지. 함수만 있고 아무도 안 부르면 경계가 아니다.
  for (const [file, fn] of [
    ["app/consent/page.tsx", "readConsentState"],
    ["app/api/consent/route.ts", "readConsentState"],
    ["app/marketplace/[slug]/page.tsx", "readPublishedListingBySlug"],
  ]) {
    assert.match(await source(file), new RegExp(fn, "u"), `${file} 이 ${fn} 을 부르지 않습니다`);
  }
});

test("목록 응답은 등급을 매기는 데 필요한 것을 빠짐없이 싣는다", async () => {
  // 등급이 접근권이 된 뒤로, 목록이 clips 를 빼면 카드는 움직임 없이 등급을 매기고
  // 다운로드 문지기는 clipsFor 로 매겨 둘이 갈라진다. 카드에 "무료"라 적힌 상품이
  // 403 으로 막히는 자리였다.
  const catalogue = await source("app/api/marketplace/route.ts");
  const listMap = catalogue.slice(catalogue.indexOf("listings: rows.results.map"));
  for (const field of ["facts:", "clips:", "variants:"]) {
    assert.ok(listMap.includes(field), `목록 응답에 ${field} 가 없습니다 — 카드와 문지기의 등급이 갈라집니다`);
  }
});

test("상세 페이지는 아무도 청구하지 않는 값을 검색엔진에 적지 않는다", async () => {
  const page = await source("app/marketplace/[slug]/page.tsx");
  assert.doesNotMatch(
    page,
    /price:\s*\(listing\.priceCents/u,
    "낱개 가격을 구조화 데이터에 싣고 있습니다 — 그 값은 아무도 청구하지 않습니다",
  );
  assert.match(page, /isFreeGrade\(gradeOf\(/u, "무료 등급인지 등급으로 판정해야 합니다");
});
