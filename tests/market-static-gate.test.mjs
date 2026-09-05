import assert from "node:assert/strict";
import { register } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

// 문지기가 있는 모듈은 app/auth.ts 를 거쳐 next/headers 를 읽는다. 이 저장소에 next
// 패키지는 없으므로(vinext 가 빌드 때 끼워 넣는다) 그 이름을 자리채우기로 돌린 뒤에야
// 불러올 수 있다. 그래서 아래 세 줄은 정적 import 가 아니라 register 다음의 동적
// import 다 — 정적 import 는 이 줄보다 먼저 실행된다.
register(new URL("./helpers/next-resolve-hooks.mjs", import.meta.url));

const { setRuntimeBindings } = await import("../app/runtime-environment.ts");
const { gateStaticMarketRequest } = await import("../app/api/_lib/market-gate.ts");
const { isPublicMarketFile, previewGlbFileName, previewGlbUrl } = await import("../app/api/_lib/market-path.ts");
const { previewModelUrl, saleModelUrl, modelSourceFor, previewNoteFor, PREVIEW_NOTE, PREVIEW_NOTE_SIGNED_IN } =
  await import("../app/components/model-source.ts");

/**
 * 정적 경로의 문지기를 직접 돌려 본다.
 *
 * dev 서버는 워커 층을 태우지 않으므로(vite 가 public/ 을 먼저 준다) 브라우저로는 이
 * 문을 확인할 수 없다. 그래서 워커가 부르는 바로 그 함수에 진짜 D1(메모리 sqlite)과
 * 진짜 Request 를 넣고, 무엇이 나오는지 본다.
 */

/** node:sqlite 를 D1 처럼 보이게 하는 얇은 껍데기. 스키마는 진짜 DDL 이 돈다. */
function memoryD1() {
  const db = new DatabaseSync(":memory:");
  const shim = {
    prepare(sql) {
      let args = [];
      const statement = {
        bind(...values) {
          args = values.map((value) => (value === undefined ? null : value));
          return statement;
        },
        async first(column) {
          const row = db.prepare(sql).get(...args);
          if (!row) return null;
          return column ? row[column] : row;
        },
        async all() {
          return { results: db.prepare(sql).all(...args), success: true, meta: {} };
        },
        async run() {
          db.prepare(sql).run(...args);
          return { success: true, meta: {} };
        },
      };
      return statement;
    },
    async batch(statements) {
      const out = [];
      for (const statement of statements) out.push(await statement.run());
      return out;
    },
    async exec(sql) {
      db.exec(sql);
      return { count: 0, duration: 0 };
    },
  };
  return { shim, raw: db };
}

const SLUG = "gate-probe-widget";
const SALE_FILE = "gate-probe-widget.glb";
const ASSET_ID = "asset-gate-probe";

// ensureSchema 는 아이솔레이트당 한 번만 돈다(clunk.ts 의 schemaReadyForIsolate). 그래서
// 데이터베이스도 이 파일에 하나만 세우고 모든 테스트가 나눠 쓴다.
const { shim: DB, raw } = memoryD1();
{
  setRuntimeBindings({ DB });
  const { ensureSchema } = await import("../app/api/_lib/clunk.ts");
  await ensureSchema(DB);
  raw.exec(`INSERT INTO clunk_workspaces (id, owner_user_id, name) VALUES ('ws-gate', 'user-gate', 'gate')`);
  raw.exec(`INSERT INTO clunk_assets (id, workspace_id, file_name, format, byte_length, sha256)
            VALUES ('${ASSET_ID}', 'ws-gate', '${SALE_FILE}', 'glb', 1234, 'abc')`);
  raw.exec(`INSERT INTO clunk_marketplace_listings (id, workspace_id, asset_id, slug, title, description, price_cents, license_status, status)
            VALUES ('listing-gate', 'ws-gate', '${ASSET_ID}', '${SLUG}', 'Gate probe widget', 'probe', 0, 'CLEARED', 'PUBLISHED')`);
  raw.exec(`INSERT INTO clunk_asset_artifacts (id, workspace_id, asset_id, file_name, role, content_type, byte_length, sha256, object_key)
            VALUES ('artifact-gate', 'ws-gate', '${ASSET_ID}', '${SALE_FILE}', 'entry', 'model/gltf-binary', 1234, 'abc', 'asset:/market/${SLUG}/${SALE_FILE}')`);
}

function seededGate() {
  setRuntimeBindings({ DB });
}

function served(body = "bytes") {
  let calls = 0;
  return {
    get calls() { return calls; },
    fetch: async () => {
      calls += 1;
      return new Response(body, { status: 200, headers: { "content-type": "model/gltf-binary" } });
    },
  };
}

test("미리보기 파일은 문을 거치지 않고 그대로 나간다", async () => {
  seededGate();
  const asset = served();
  const response = await gateStaticMarketRequest(
    new Request(`https://clunk.games/market/${SLUG}/${previewGlbFileName(SALE_FILE)}`),
    asset.fetch,
  );
  assert.equal(response?.status, 200);
  assert.equal(asset.calls, 1);
});

test("로그인하지 않은 요청은 판매 파일을 받지 못한다", async () => {
  seededGate();
  const asset = served();
  const response = await gateStaticMarketRequest(
    new Request(`https://clunk.games/market/${SLUG}/${SALE_FILE}`),
    asset.fetch,
  );
  assert.equal(response?.status, 401);
  assert.equal(asset.calls, 0, "판정을 통과하지 못한 요청은 파일을 열어 보지도 못한다");
  assert.equal(response?.headers.get("cache-control"), "private, no-store");
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.schema, "clunk.marketplace-download.v1");
  assert.equal(body.status, "AUTHENTICATION_REQUIRED");
});

test("공개된 상품에 없는 파일도 문 없이 나가지 않는다", async () => {
  seededGate();
  const asset = served();
  const response = await gateStaticMarketRequest(
    new Request(`https://clunk.games/market/${SLUG}/leftover.bin`),
    asset.fetch,
  );
  assert.equal(response?.status, 401);
  assert.equal(asset.calls, 0);
});

test("판정을 할 수 없으면 파일을 내주지 않는다", async () => {
  setRuntimeBindings({});
  const asset = served();
  const response = await gateStaticMarketRequest(
    new Request(`https://clunk.games/market/${SLUG}/${SALE_FILE}`),
    asset.fetch,
  );
  assert.equal(response?.status, 503);
  assert.equal(asset.calls, 0);
  assert.equal((await response.json()).status, "GATE_UNAVAILABLE");
});

test("/market 밖의 주소는 문지기가 손대지 않는다", async () => {
  seededGate();
  const asset = served();
  for (const path of ["/marketplace/x", "/landing/tractor.compact.m1.glb", `/market/${SLUG}`, "/market/a/b/c.glb"]) {
    assert.equal(await gateStaticMarketRequest(new Request(`https://clunk.games${path}`), asset.fetch), null, path);
  }
  // 쓰기는 이 문이 다루지 않는다 — 앱 라우터가 평소대로 받는다.
  assert.equal(
    await gateStaticMarketRequest(new Request(`https://clunk.games/market/${SLUG}/${SALE_FILE}`, { method: "POST" }), asset.fetch),
    null,
  );
});

test("이름 규칙은 미리보기와 대표 그림만 공개로 친다", () => {
  assert.equal(isPublicMarketFile("preview-h145.glb"), true);
  assert.equal(isPublicMarketFile("preview-clunk-heli-h145.webp"), true);
  assert.equal(isPublicMarketFile("hero-clunk-heli-h145.png"), true);
  assert.equal(isPublicMarketFile("h145.glb"), false);
  assert.equal(isPublicMarketFile("crate.sheet.png"), false);
  assert.equal(isPublicMarketFile("crate.sheet.card.png"), false);
  assert.equal(isPublicMarketFile("h145.glb.passport.json"), false);
});

test("뷰어 주소는 '받을 수 있는가' 로 갈린다", () => {
  const target = { slug: SLUG, entryFileName: SALE_FILE, assetId: ASSET_ID };
  // 받을 수 없는 사람 — 미리보기.
  assert.deepEqual(modelSourceFor(target, false, false), {
    src: previewModelUrl(SLUG, SALE_FILE),
    isPreview: true,
    note: PREVIEW_NOTE,
  });
  // 아직 모르는 동안(null)에도 미리보기다. 모르는 채로 판매 주소를 걸면 문에 막혀
  // 콘솔에 오류가 남고 첫 그림이 늦는다.
  assert.equal(modelSourceFor(target, null, null).isPreview, true);
  // 로그인은 했지만 받을 수 없는 사람에게 "로그인하면" 이라고 말하지 않는다.
  assert.equal(modelSourceFor(target, false, true).note, PREVIEW_NOTE_SIGNED_IN);
  assert.equal(previewNoteFor(null), PREVIEW_NOTE);
  assert.equal(previewNoteFor(true), PREVIEW_NOTE_SIGNED_IN);
  // 받을 수 있는 사람 — 문이 있는 주소로 판매 파일 그대로.
  assert.deepEqual(modelSourceFor(target, true, true), {
    src: saleModelUrl(ASSET_ID, SALE_FILE),
    isPreview: false,
    note: null,
  });
  // assetId 를 모르면 받을 수 있어도 미리보기다. 문 있는 주소를 지어낼 수 없다.
  assert.equal(modelSourceFor({ slug: SLUG, entryFileName: SALE_FILE }, true, true).isPreview, true);
  assert.equal(previewGlbUrl(SLUG, SALE_FILE), `/market/${SLUG}/preview-${SALE_FILE}`);
  assert.equal(saleModelUrl(ASSET_ID, SALE_FILE), `/api/marketplace/assets/${ASSET_ID}?file=${SALE_FILE}`);
});
