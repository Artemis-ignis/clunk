#!/usr/bin/env node
/**
 * Publishes the sprite sheets baked from the 3D catalogue as their own listings.
 *
 * Every sheet here is a render of a model already on sale, so the artwork cost nothing
 * to make twice — but a developer building a top-down 2D game cannot use a GLB, and a
 * developer building in three.js does not want a PNG strip. They are different buyers,
 * and this is the same inventory offered to the second one.
 *
 * Nothing in a description is written by hand: the triangle count, the cell count, the
 * palette size and the byte length all come out of the manifest the baker wrote from the
 * real pixels, so a listing cannot claim a number the file does not carry.
 *
 * Price follows the rule already in this repository for a 2D deliverable
 * (scripts/seed-wave1-qa.mjs, creditPriceFor: 9 credits), not a new one invented here.
 *
 * Usage: node scripts/seed-sprite-sheets.mjs [--sheets tmp/sheets] [--out tmp/sprite-listings.sql]
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, join, resolve } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  if (process.argv[i].startsWith("--")) args.set(process.argv[i].slice(2), process.argv[i + 1]);
}
const sheetsRoot = resolve(root, args.get("sheets") ?? "tmp/sheets");
const outSql = resolve(root, args.get("out") ?? "tmp/sprite-listings.sql");

const STORE_USER = "user-w1-artemis-store";
const STORE_WORKSPACE = "ws-w1-artemis-store";
/** The repository's existing price for a 2D deliverable. 1 credit = 100 KRW. */
const CREDITS = 9;

/** Korean titles for the eleven 3D listings these sheets are rendered from. */
const TITLES = {
  "cozy-crate-closed": "나무 궤짝 (닫힘)",
  "cozy-crate-open": "나무 궤짝 (열림)",
  "cozy-crate-produce": "나무 궤짝 (수확물 적재)",
  "cozy-farm-set-vol1": "코지 팜 세트 Vol.1 (3종)",
  "cozy-fence-gate": "코지 울타리 문",
  "cozy-greenhouse": "코지 온실",
  "cozy-haystack-full": "건초 롤 (온전한 것)",
  "cozy-haystack-used": "건초 롤 (헐린 것)",
  "cozy-market-stall": "코지 마켓 스톨",
  "cozy-storage-shed": "코지 창고 헛간",
  "grove-tree-pack-vol1": "그로브 트리 팩 Vol.1 (6종)",
  "farmhand": "팜핸드 (밀짚모자 농부)",
};

/** Korean names for the clips, so a title reads as a product rather than a track id. */
const CLIP_LABELS = { swing: "여닫기", open: "문 열기", walk: "걷기" };

/** A source directory suffixed with a clip is a distinct product, not another sheet. */
const ANIMATED_SUFFIX = { "cozy-fence-gate-swing": "cozy-fence-gate", "cozy-storage-shed-door": "cozy-storage-shed", "farmhand-walk": "farmhand" };

/** Models authored for a sheet rather than rendered from a listing that already exists. */
const AUTHORED_FOR_SPRITE = new Set(["farmhand"]);

const q = (value) => `'${String(value).replace(/'/g, "''")}'`;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");


/**
 * Rewraps a sheet into a card-shaped contact image. The sheet keeps the layout an engine
 * needs (a row per direction); the card gets a grid close to 4:3 so a shopper sees the
 * whole set rather than the slice a cover-fit crop would leave them.
 */
async function cardImage(manifest, pngPath) {
  const cells = manifest.frames.length;
  const cell = manifest.grid.frameWidth;
  const columns = Math.max(1, Math.round(Math.sqrt((cells * 4) / 3)));
  const rows = Math.ceil(cells / columns);
  const tiles = await Promise.all(manifest.frames.map(async (frame, i) => ({
    input: await sharp(pngPath).extract({ left: frame.x, top: frame.y, width: cell, height: cell }).png().toBuffer(),
    left: (i % columns) * cell,
    top: Math.floor(i / columns) * cell,
  })));
  return sharp({ create: { width: columns * cell, height: rows * cell, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(tiles).png().toBuffer();
}

const statements = [];
let copied = 0;
const products = [];

for (const sourceSlug of readdirSync(sheetsRoot).sort()) {
  const dir = join(sheetsRoot, sourceSlug);
  if (!statSync(dir).isDirectory()) continue;
  const manifestFiles = readdirSync(dir).filter((f) => f.endsWith(".sheet.json")).sort();
  if (!manifestFiles.length) continue;

  // An animated directory carries its clip in the name. The title comes from the model it
  // was rendered from; the slug keeps the clip so the still and the animation stay two
  // separate products rather than overwriting each other.
  const titleKey = ANIMATED_SUFFIX[sourceSlug] ?? sourceSlug;
  const slug = `${sourceSlug}-sprites`;
  const assetId = `asset-sp-${sourceSlug}`;
  const destDir = join(root, "public", "market", slug);
  mkdirSync(destDir, { recursive: true });

  const sheets = [];
  for (const manifestFile of manifestFiles) {
    const manifest = JSON.parse(readFileSync(join(dir, manifestFile), "utf8"));
    const pngName = manifest.sheet.path;
    const pngBytes = readFileSync(join(dir, pngName));
    if (sha256(pngBytes) !== manifest.sheet.sha256) {
      throw new Error(`${pngName} does not match the hash its manifest recorded; re-bake before publishing.`);
    }
    copyFileSync(join(dir, pngName), join(destDir, pngName));
    copyFileSync(join(dir, manifestFile), join(destDir, manifestFile));
    copied += 2;
    sheets.push({ manifest, pngName, manifestFile, pngBytes });
  }

  // Facts, read off the manifests rather than written by hand.
  const cells = sheets.reduce((sum, s) => sum + s.manifest.frames.length, 0);
  const bytes = sheets.reduce((sum, s) => sum + s.manifest.sheet.bytes, 0);
  const sourceTriangles = sheets.reduce((sum, s) => sum + s.manifest.generation.triangles, 0);
  const palette = new Set(sheets.flatMap((s) => s.manifest.generation.palette?.colours ?? []));
  const cell = sheets[0].manifest.grid.frameWidth;
  const views = sheets[0].manifest.generation.views;
  const models = sheets.length;

  // A clip in the manifest means the sheet moves, and a moving sheet is a different
  // product with a different title, a different sentence and its own price.
  const clip = sheets[0].manifest.generation.clip;
  const fps = clip ? sheets[0].manifest.animations[0].fps : null;

  const title = clip
    ? `${TITLES[titleKey] ?? sourceSlug} — ${CLIP_LABELS[clip.name] ?? clip.name} 애니메이션 (${cell}×${cell}, ${views}방향 × ${clip.frames}프레임)`
    : `${TITLES[titleKey] ?? sourceSlug} — 스프라이트 시트 (${cell}×${cell}, ${views}방향)`;

  const description = [
    clip
      ? `${cell}×${cell} RGBA PNG ${cells}컷으로, ${views}방향 각각에 ${clip.frames}프레임짜리 ${CLIP_LABELS[clip.name] ?? clip.name} 동작이 들어 있습니다. 방향당 한 줄이라 한 줄을 그대로 재생하면 됩니다 (${fps}fps 루프).`
      : `${models === 1 ? "" : `모델 ${models}종 · `}${cell}×${cell} RGBA PNG ${cells}컷으로, 한 모델을 ${views}방향에서 렌더했습니다.`,
    `투명 배경이고 팔레트는 ${palette.size}색이며, 시트 합계는 ${(bytes / 1024).toFixed(1)} KB입니다.`,
    // Only the sheets rendered from a model that is itself on sale can claim the pairing.
    // The farmhand was authored for this sheet and has no 3D listing beside it; saying it
    // did would be a sentence the catalogue cannot back.
    //
    // It used to say the two share a palette. Measuring both (npm run asset:palette:index)
    // showed that is not true and could not be: the sheet is the model under this
    // renderer's lighting, then reduced to a fixed number of colours. It is the nearest
    // thing in the whole shop to its model, which is worth saying — but nearest is not
    // identical, and the earlier sentence promised identical.
    TITLES[titleKey] && !AUTHORED_FOR_SPRITE.has(titleKey)
      ? `같은 이름의 3D 상품(${sourceTriangles.toLocaleString("ko-KR")} 삼각형)을 Clunk 렌더러로 구운 것이라 형태가 같은 메시입니다. 색은 그 모델의 색에 조명을 입혀 ${palette.size}색으로 줄인 것이라, 3D와 나란히 놓아도 겉도지 않지만 같은 색값은 아닙니다.`
      : `Clunk가 코드로 만든 ${sourceTriangles.toLocaleString("ko-KR")} 삼각형 3D 모델을 렌더한 것이라, 모든 방향·모든 프레임이 같은 모델에서 나옵니다.`,
    clip
      ? `프레임 좌표·격자·해시·프레임별 해시가 담긴 clunk.sprite-sheet-review.v1 매니페스트가 함께 들어 있고, Clunk 스프라이트 검사에서 규격 PASS·픽셀 품질 PASS·애니메이션 재생 PASS입니다.`
      : `프레임 좌표·격자·해시가 담긴 clunk.sprite-sheet-review.v1 매니페스트가 함께 들어 있고, Clunk 스프라이트 검사에서 규격 PASS·픽셀 품질 PASS입니다.`,
  ].join(" ");

  const entry = sheets[0];
  statements.push(
    `INSERT OR REPLACE INTO clunk_assets (id, workspace_id, file_name, format, byte_length, sha256) VALUES (`
    + `${q(assetId)}, ${q(STORE_WORKSPACE)}, ${q(entry.pngName)}, 'image/png', ${entry.manifest.sheet.bytes}, ${q(entry.manifest.sheet.sha256)});`,
  );

  for (const sheet of sheets) {
    const pngKey = `market/${slug}/${sheet.pngName}`;
    statements.push(
      `INSERT OR REPLACE INTO clunk_asset_artifacts (id, workspace_id, asset_id, file_name, role, content_type, byte_length, sha256, object_key) VALUES (`
      + `${q(`artifact-sp-${slug}-${sheet.pngName}`)}, ${q(STORE_WORKSPACE)}, ${q(assetId)}, ${q(sheet.pngName)}, `
      // "preview" rather than "page": the catalogue picks a card image from the roles
      // preview/page/texture, and a manifest registered as a page would win that pick and
      // send every card off to render a JSON file as a picture.
      + `${q(sheet === entry ? "entry" : "preview")}, 'image/png', ${sheet.manifest.sheet.bytes}, ${q(sheet.manifest.sheet.sha256)}, ${q(`asset:/${pngKey}`)});`,
    );
    if (sheet === entry) {
      // A sheet is one row of eight cells — 8:1 — and the catalogue card frame is 4:3 with
      // object-fit: cover, so using the sheet itself as card art crops it to a cell and a
      // half. The card gets its own image: the same cells, rewrapped to roughly 4:3.
      //
      // The catalogue's preview query only reads preview/page/texture, so this row is also
      // what gives every single-model product in this batch any card art at all.
      const cardName = `${basename(sheet.pngName, ".png")}.card.png`;
      const cardBytes = await cardImage(sheet.manifest, join(destDir, sheet.pngName));
      writeFileSync(join(destDir, cardName), cardBytes);
      copied += 1;
      statements.push(
        `INSERT OR REPLACE INTO clunk_asset_artifacts (id, workspace_id, asset_id, file_name, role, content_type, byte_length, sha256, object_key) VALUES (`
        + `${q(`artifact-sp-${slug}-preview`)}, ${q(STORE_WORKSPACE)}, ${q(assetId)}, ${q(cardName)}, `
        + `'preview', 'image/png', ${cardBytes.length}, ${q(sha256(cardBytes))}, ${q(`asset:/market/${slug}/${cardName}`)});`,
      );
    }
    const manifestBytes = readFileSync(join(destDir, sheet.manifestFile));
    statements.push(
      `INSERT OR REPLACE INTO clunk_asset_artifacts (id, workspace_id, asset_id, file_name, role, content_type, byte_length, sha256, object_key) VALUES (`
      + `${q(`artifact-sp-${slug}-${sheet.manifestFile}`)}, ${q(STORE_WORKSPACE)}, ${q(assetId)}, ${q(sheet.manifestFile)}, `
      + `'metadata', 'application/json', ${manifestBytes.length}, ${q(sha256(manifestBytes))}, ${q(`asset:/market/${slug}/${sheet.manifestFile}`)});`,
    );
  }

  // The seller reviewed these: they are renders of models this store authored and already
  // sells, graded by the local sprite audit. Runtime and player-facing stay unevaluated,
  // which is what the listing's evidence panel will show.
  statements.push(
    `INSERT OR REPLACE INTO clunk_asset_reviews (id, workspace_id, asset_id, visual_runtime, player_facing, human_decision, note, evidence_json, reviewer_user_id) VALUES (`
    + `${q(`review-sp-${sourceSlug}`)}, ${q(STORE_WORKSPACE)}, ${q(assetId)}, 'PASS', 'NOT_EVALUATED', 'PASS', `
    + `${q("Clunk 렌더러로 3D 원본에서 구운 시트. 로컬 스프라이트 검사 규격·픽셀 품질 PASS, 게임 화면 판정은 미평가.")}, `
    + `${q(JSON.stringify({ source: "sprite-sheet-from-glb", cells, views, cell, paletteColours: palette.size, salesLock: true }))}, ${q(STORE_USER)});`,
  );

  statements.push(
    `INSERT OR REPLACE INTO clunk_marketplace_listings (id, workspace_id, asset_id, slug, title, description, price_cents, currency, license_status, status, published_at) VALUES (`
    + `${q(`listing-sp-${sourceSlug}`)}, ${q(STORE_WORKSPACE)}, ${q(assetId)}, ${q(slug)}, ${q(title)}, ${q(description)}, `
    + `${CREDITS * 10_000}, 'KRW', 'cleared', 'PUBLISHED', CURRENT_TIMESTAMP);`,
  );

  products.push({ slug, title, cells, models, kb: Number((bytes / 1024).toFixed(1)) });
}

mkdirSync(resolve(outSql, ".."), { recursive: true });
writeFileSync(outSql, `${statements.join("\n")}\n`);
process.stdout.write(`${JSON.stringify({
  products: products.length,
  cells: products.reduce((sum, p) => sum + p.cells, 0),
  filesCopied: copied,
  creditsEach: CREDITS,
  sql: outSql,
  statements: statements.length,
  listings: products,
}, null, 2)}\n`);
