import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import { inspectAsset } from "../packages/core/src/index.ts";

const root = new URL("../", import.meta.url);

/**
 * 상품 페이지에 적힌 숫자가 파일 안의 숫자와 같은가.
 *
 * 이 검사가 없어서 두 번 틀렸다. 트랙터는 표기 32,300 삼각형에 실측 58,156 이었고,
 * 헬리콥터는 사양이 통째로 비어 최하 등급으로 팔릴 뻔했다. 두 번 다 사람이 눈으로
 * 발견했다.
 *
 * 사실은 파이프라인 매니페스트에서 옵니다(scripts/listing-facts-cli.ts 의
 * factsFromManifest). 매니페스트는 한 번 잰 값을 적어 두는 종이라, 파일이 바뀌거나
 * 측정이 실패해도 종이는 그대로 남는다. **여기서만 파일을 다시 연다.**
 *
 * 2026-09-04 관찰이 이걸 제품의 중심으로 올렸다. 경쟁사들도 잰 값을 싣는다 — Fab 은
 * 기계 판독 스펙 패널을 달고, polyfork 는 네 항목이 전부 정확했다. 차별점은 값을 싣는
 * 것이 아니라 **적힌 것과 파일이 어긋나면 잡아내는 것**이다. 그 주장을 우리가 먼저
 * 지키지 못하면 팔 수 없다.
 */

const FACTS = "app/data/listing-facts.json";
const MARKET = "public/market";

/** 삼각형은 정확히 같아야 한다. 재질은 파이프라인이 중복을 접을 수 있어 같거나 적다. */
const TRIANGLE_TOLERANCE = 0;

async function loadFacts() {
  const raw = JSON.parse(await readFile(new URL(FACTS, root), "utf8"));
  return raw.facts ?? raw;
}

/** public/market/<slug>/ 안의 GLB 하나. 없으면 이 상품은 3D 가 아니다. */
async function entryGlb(slug) {
  let names;
  try {
    names = await readdir(new URL(`${MARKET}/${slug}`, root));
  } catch {
    return null;
  }
  // preview-*.glb 는 비로그인 뷰어용 미리보기다(scripts/market-preview-glb.mjs). 판매 파일이 아니므로 세지 않는다.
  const glb = names.filter((n) => n.toLowerCase().endsWith(".glb") && !/^preview-/i.test(n));
  if (glb.length !== 1) return null; // 여러 개면 어느 것이 대표인지 여기서 정하지 않는다
  return `${MARKET}/${slug}/${glb[0]}`;
}

test("적힌 삼각형 수가 파일에서 다시 측정한 값과 같다", async () => {
  const facts = await loadFacts();
  const checked = [];
  const wrong = [];

  for (const [slug, fact] of Object.entries(facts)) {
    if (typeof fact?.triangles !== "number") continue; // 빈 칸은 §"빈 칸" 검사가 맡는다
    const path = await entryGlb(slug);
    if (!path) continue;
    const bytes = await readFile(new URL(path, root));
    const report = inspectAsset({ entry: path, files: new Map([[path, new Uint8Array(bytes)]]) });
    const measured = report?.metrics?.triangleCount;
    if (typeof measured !== "number") continue; // 못 읽은 파일은 아래 검사가 잡는다
    checked.push(slug);
    if (Math.abs(measured - fact.triangles) > TRIANGLE_TOLERANCE) {
      wrong.push(`${slug}: 표기 ${fact.triangles.toLocaleString()} / 실측 ${measured.toLocaleString()}`);
    }
  }

  assert.ok(checked.length > 0, "재 본 상품이 하나도 없습니다 — 검사가 아무것도 지키지 않고 있습니다");
  assert.deepEqual(
    wrong,
    [],
    `상품 페이지의 삼각형 수가 파일과 다릅니다. 이것이 이 제품이 팔겠다고 하는 바로 그 결함입니다:\n  ${wrong.join("\n  ")}`,
  );
});

test("적힌 재질 수가 파일보다 많지 않다", async () => {
  const facts = await loadFacts();
  const wrong = [];
  for (const [slug, fact] of Object.entries(facts)) {
    if (typeof fact?.materials !== "number") continue;
    const path = await entryGlb(slug);
    if (!path) continue;
    const bytes = await readFile(new URL(path, root));
    const measured = inspectAsset({ entry: path, files: new Map([[path, new Uint8Array(bytes)]]) })?.metrics?.materialCount;
    if (typeof measured !== "number") continue;
    // 적힌 값이 실제보다 크면 없는 재질을 광고하는 것이다. 작은 것은 파이프라인이
    // 중복 재질을 접은 결과일 수 있어 허용한다.
    if (fact.materials > measured) wrong.push(`${slug}: 표기 ${fact.materials} / 실측 ${measured}`);
  }
  assert.deepEqual(wrong, [], `없는 재질을 상품 페이지가 광고하고 있습니다:\n  ${wrong.join("\n  ")}`);
});

test("파일이 있는데 사양이 비어 있는 상품이 없다", async () => {
  // 헬리콥터가 이렇게 팔릴 뻔했다. 파일은 멀쩡한데 사양만 비어, 등급이 최하로 떨어졌다.
  const facts = await loadFacts();
  const blank = [];
  for (const [slug, fact] of Object.entries(facts)) {
    const path = await entryGlb(slug);
    if (!path) continue;
    if (fact?.triangles == null && fact?.materials == null && fact?.boundsMetres == null) {
      blank.push(`${slug} (${path})`);
    }
  }
  assert.deepEqual(
    blank,
    [],
    `3D 파일이 있는데 사양이 전부 비어 있습니다. 사양이 비면 등급이 바닥으로 떨어지고, 등급이 곧 접근권입니다:\n  ${blank.join("\n  ")}`,
  );
});

/**
 * 카드에 "실제 크기"라고 적힌 숫자가 파일의 크기와 같은가.
 *
 * 상자를 겹쳐 재면 돌아가 있는 부품에서 상자가 부품보다 커진다. 헬리콥터가 10.60m 로
 * 적혀 있었지만 꼭짓점을 재면 10.52m 다. 그래서 여기서는 꼭짓점을 하나씩 제자리로 옮겨
 * 놓고 잰다 — 만드는 쪽(scripts/listing-facts-cli.ts)과 다른 코드로 재야 검사가 된다.
 *
 * 빗물통이 이 검사가 없어서 1.60×2.33×1.87m 로 팔리고 있었다. 실제로는 0.69×1.00×0.81m,
 * 사람 허리 높이의 통이다. 세 배 큰 물건을 산다고 생각하고 장면에 넣으면 다시 짜야 한다.
 */
async function vertexBoundsOf(path) {
  const { NodeIO } = await import("@gltf-transform/core");
  const { ALL_EXTENSIONS } = await import("@gltf-transform/extensions");
  const { MeshoptDecoder, MeshoptEncoder } = await import("meshoptimizer");
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
  const doc = await io.read(new URL(path, root).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const walk = (node) => {
    const m = node.getWorldMatrix();
    for (const prim of node.getMesh()?.listPrimitives() ?? []) {
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      for (let i = 0; i < pos.getCount(); i++) {
        const p = pos.getElement(i, [0, 0, 0]);
        for (let k = 0; k < 3; k++) {
          const v = m[k] * p[0] + m[4 + k] * p[1] + m[8 + k] * p[2] + m[12 + k];
          if (v < min[k]) min[k] = v;
          if (v > max[k]) max[k] = v;
        }
      }
    }
    for (const child of node.listChildren()) walk(child);
  };
  for (const scene of doc.getRoot().listScenes()) for (const node of scene.listChildren()) walk(node);
  return min.every(Number.isFinite) ? [0, 1, 2].map((i) => max[i] - min[i]) : null;
}

test("적힌 실제 크기가 파일의 크기와 같다", async () => {
  const facts = await loadFacts();
  const wrong = [];
  let checked = 0;
  for (const [slug, fact] of Object.entries(facts)) {
    if (!fact?.boundsMetres) continue;
    // 묶음은 한 파일에 여러 물건을 늘어놓은 것이라 파일의 크기가 물건의 크기가 아니다.
    if ((fact.members ?? 0) > 1) continue;
    const path = await entryGlb(slug);
    if (!path) continue;
    const measured = await vertexBoundsOf(path);
    if (!measured) continue;
    checked += 1;
    // 1mm 까지 같아야 한다. 카드는 cm 단위로 보여 주므로 이보다 큰 차이는 화면에 나온다.
    if (![0, 1, 2].every((i) => Math.abs(measured[i] - fact.boundsMetres[i]) < 0.001)) {
      wrong.push(
        `${slug}: 표기 ${fact.boundsMetres.map((v) => v.toFixed(3)).join("×")} / 실측 ${measured.map((v) => v.toFixed(3)).join("×")}`,
      );
    }
  }
  assert.ok(checked > 0, "크기를 재 본 상품이 하나도 없습니다");
  assert.deepEqual(wrong, [], `상품 페이지의 실제 크기가 파일과 다릅니다:\n  ${wrong.join("\n  ")}`);
});

test("파일이 들고 있는 동작을 상품 페이지가 빠뜨리지 않는다", async () => {
  // 헬리콥터가 로터와 문 동작 두 개를 파일에 갖고 있는데 사양은 "동작 없음"이었다.
  // 같은 화면의 설명문은 두 동작을 자랑하고 있었다.
  const facts = await loadFacts();
  const wrong = [];
  for (const [slug, fact] of Object.entries(facts)) {
    const path = await entryGlb(slug);
    if (!path) continue;
    const bytes = await readFile(new URL(path, root));
    if (bytes.byteLength < 20 || bytes.readUInt32LE(0) !== 0x46546c67) continue;
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
    const inFile = (json.animations ?? []).map((clip, i) => clip.name ?? `animation_${i}`).sort();
    const written = (fact?.animations ?? []).map((clip) => clip.name).sort();
    if (inFile.join("|") !== written.join("|")) {
      wrong.push(`${slug}: 표기 [${written.join(", ")}] / 파일 [${inFile.join(", ")}]`);
    }
  }
  assert.deepEqual(wrong, [], `파일의 동작과 상품 페이지의 동작이 다릅니다:\n  ${wrong.join("\n  ")}`);
});

/**
 * 어느 엔진에서 열리는지를 상품 페이지가 말한다. 그 말의 근거는 파일이어야 한다.
 *
 * 호환성 표는 팔기 위해 적기 쉬운 종류의 문장이다. glTF 파일은 자기가 필요로 하는 확장을
 * `extensionsRequired` 에 스스로 적어 두고, 규격상 그 이름을 모르는 프로그램은 파일을 여는
 * 것 자체가 금지된다. 그래서 이 목록이 표의 유일한 근거다 — 여기 적힌 것과 파일이 어긋나면
 * 우리는 열리지 않는 파일을 열린다고 팔고 있는 것이다.
 */
async function requiredExtensionsOf(path) {
  const bytes = await readFile(new URL(path, root));
  if (bytes.byteLength < 20 || bytes.readUInt32LE(0) !== 0x46546c67) return null;
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
  return {
    requires: [...(json.extensionsRequired ?? [])].sort(),
    hasVertexColour: (json.meshes ?? []).some((mesh) =>
      (mesh.primitives ?? []).some((prim) => prim.attributes?.COLOR_0 !== undefined),
    ),
    hasBaseColourTexture: (json.materials ?? []).some(
      (material) => material.pbrMetallicRoughness?.baseColorTexture !== undefined,
    ),
  };
}

test("적힌 요구 확장이 파일이 실제로 요구하는 것과 같다", async () => {
  const facts = await loadFacts();
  const wrong = [];
  let checked = 0;
  for (const [slug, fact] of Object.entries(facts)) {
    const path = await entryGlb(slug);
    if (!path) continue;
    const real = await requiredExtensionsOf(path);
    if (!real) continue;
    checked += 1;
    if (!fact?.engine) {
      wrong.push(`${slug}: 파일은 있는데 어디서 열리는지를 재지 않았습니다`);
      continue;
    }
    const written = [...fact.engine.requires].sort();
    if (written.join("|") !== real.requires.join("|")) {
      wrong.push(`${slug}: 표기 [${written.join(", ")}] / 실제 [${real.requires.join(", ")}]`);
    }
    const colour =
      real.hasBaseColourTexture && real.hasVertexColour
        ? "mixed"
        : real.hasBaseColourTexture
          ? "texture"
          : real.hasVertexColour
            ? "vertex"
            : "material";
    if (fact.engine.colour !== colour) {
      wrong.push(`${slug}: 색 위치 표기 ${fact.engine.colour} / 실제 ${colour}`);
    }
  }
  assert.ok(checked > 0, "재 본 파일이 하나도 없습니다");
  assert.deepEqual(
    wrong,
    [],
    `열리는 곳 표시가 파일과 다릅니다. 열리지 않는 파일을 열린다고 파는 셈입니다:\n  ${wrong.join("\n  ")}`,
  );
});

test("확장을 요구하는 파일은 넣는 법 대신 그 사실을 말한다", async () => {
  const { engineSteps } = await import("../app/components/engine-fit-rows.ts");
  const plain = { requires: [], uses: [], colour: "texture", modes: [4], imageTypes: ["image/png"] };
  const compressed = { ...plain, requires: ["EXT_meshopt_compression"] };
  const lines = { ...plain, modes: [1, 4] };

  assert.ok(engineSteps(plain).length >= 4, "엔진 줄이 나오지 않습니다");
  assert.ok(engineSteps(plain).every((row) => row.opens), "아무것도 요구하지 않는 파일이 열리지 않는다고 나옵니다");
  assert.ok(
    engineSteps(compressed).every((row) => !row.opens && /meshopt/.test(row.how)),
    "압축 확장을 요구하는 파일에 그냥 끌어다 놓으라고 적습니다",
  );
  assert.ok(engineSteps(lines).every((row) => !row.opens), "삼각형이 아닌 도형이 든 파일을 그냥 열린다고 표시합니다");
  assert.equal(engineSteps(null).length, 0, "재지 않은 상품에 표를 만들어 냅니다");

  // Unity 만 임포터를 따로 깔아야 한다. 이 줄이 없으면 파일을 끌어다 놓고 아무 일도
  // 일어나지 않는 경험을 사는 사람이 한다.
  const unity = engineSteps(plain).find((row) => row.engine === "Unity");
  assert.match(unity?.caution ?? "", /glTFast/);
  // Godot·Unreal 은 준비할 것이 없다. 없는 준비를 적으면 어렵게 만든다.
  assert.equal(engineSteps(plain).find((row) => row.id === "godot")?.caution, null);
});

test("색이 어디에 들어 있는지를 파일대로 말한다", async () => {
  const { engineBasis } = await import("../app/components/engine-fit-rows.ts");
  const vertex = { requires: [], uses: [], colour: "vertex", modes: [4], imageTypes: [] };
  const textured = { ...vertex, colour: "texture", imageTypes: ["image/png"] };
  assert.match(engineBasis(vertex).join(" "), /정점 색을 읽는 셰이더/);
  assert.match(engineBasis(textured).join(" "), /따로 챙길 텍스처가 없/);
  assert.match(engineBasis(textured).join(" "), /확장을 하나도 요구하지 않습니다/);
  assert.equal(engineBasis(null).length, 0, "재지 않은 상품에 근거를 지어냅니다");
});

/**
 * 첫 화면의 숫자도 같은 규칙을 따른다. app/data/landing-facts.json 은
 * scripts/landing-facts.mjs 가 파일에서 측정해 내려놓은 값이고, 화면(app/page.tsx)은
 * 그것만 읽는다. 여기서 같은 파일을 다시 열어 대조한다 — JSON 을 손으로 고치거나,
 * 파일을 갈아 끼우고 스크립트를 안 돌리면 여기서 걸린다. 2026-09-04 에 실제로 그렇게
 * 어긋났다(58,156 삼각형짜리 파일 옆에 "39,320개").
 */
test("첫 화면에 적힌 폴리곤 수와 용량이 그 파일에서 다시 측정한 값과 같다", async () => {
  const raw = JSON.parse(await readFile(new URL("app/data/landing-facts.json", root), "utf8"));
  // facts 는 섹션 01·02 의 모델, tiles 는 첫 화면 진열판 열두 칸. 둘 다 같은 규칙.
  const entries = [
    ...Object.entries(raw.facts ?? {}),
    ...(raw.tiles ?? []).map((tile) => [`tile:${tile.slug}`, tile]),
  ];
  assert.ok(entries.length > 0, "첫 화면이 보여 주는 파일이 하나도 적혀 있지 않습니다");

  const wrong = [];
  for (const [key, fact] of entries) {
    assert.equal(typeof fact.path, "string", `${key}: 어느 파일인지(path)가 없어 다시 측정할 수 없습니다`);
    if (fact.fileName && fact.path.split("/").pop() !== fact.fileName) {
      wrong.push(`${key}: fileName ${fact.fileName} 이 path ${fact.path} 의 파일 이름과 다릅니다`);
    }
    const bytes = await readFile(new URL(fact.path, root));
    const entryName = fact.path.split("/").pop();
    const report = inspectAsset({ entry: entryName, files: new Map([[entryName, new Uint8Array(bytes)]]) });
    const measured = report?.metrics?.triangleCount;
    if (measured !== fact.triangles) {
      wrong.push(`${key}: 표기 ${fact.triangles?.toLocaleString()} / 실측 ${measured?.toLocaleString()} 삼각형`);
    }
    if (bytes.byteLength !== fact.bytes) {
      wrong.push(`${key}: 표기 ${fact.bytes?.toLocaleString()} / 실제 ${bytes.byteLength.toLocaleString()} bytes`);
    }
  }

  assert.deepEqual(
    wrong,
    [],
    `첫 화면의 숫자가 파일과 다릅니다. node --import tsx scripts/landing-facts.mjs 를 다시 돌리세요:\n  ${wrong.join("\n  ")}`,
  );
});

/**
 * /agents 의 다섯 칸이 진짜 파일을 보여 주는가.
 *
 * 이 자리는 CSS 로 그린 그림 네 개였다 — 가짜 캐릭터, 가짜 격자, 막대 인간, 그리고
 * "00:00 / 00:42" 가 적힌 가짜 파형. 다섯 종류를 다 다룬다고 말하면서 정작 화면에 있는
 * 파일은 트랙터 한 칸뿐이었다. 적힌 숫자와 파일이 어긋나면 잡아내겠다는 가게가 자기
 * 화면에서는 파일 없이 그림만 그리고 있었던 셈이다.
 *
 * 그래서 다섯 칸 모두 마켓에 올라와 있는 파일을 가리키고, 밑줄의 숫자는
 * scripts/landing-facts.mjs 가 상품 기록에서 옮겨 적는다. 여기서 (1) 그림 파일이 실제로
 * 있고 적어 둔 픽셀 크기와 같은지, (2) 옮겨 적은 숫자가 상품 기록과 같은지, (3) 3D 모델
 * 칸은 파일을 다시 열어 측정한 값과도 같은지, (4) 그 숫자가 밑줄에 그대로 적혀 있는지를
 * 본다. JSON 을 손으로 고치거나 파일을 갈아 끼우고 스크립트를 안 돌리면 여기서 걸린다.
 */

/**
 * 그림 파일의 픽셀 크기를 파일 머리에서 읽는다. PNG 는 IHDR, WebP 는 RIFF 안의
 * VP8X/VP8/VP8L 청크. 만드는 쪽(scripts/landing-facts.mjs)과 다른 코드로 읽어야 대조가
 * 된다 — 같은 함수를 부르면 둘이 같이 틀린다.
 */
async function imagePixelSize(url) {
  const b = await readFile(url);
  const be32 = (i) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
  const le = (i, n) => { let v = 0; for (let k = n - 1; k >= 0; k--) v = v * 256 + b[i + k]; return v; };
  if (b.length > 24 && b.toString("ascii", 1, 4) === "PNG") return [be32(16), be32(20)];
  if (b.length > 16 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    for (let at = 12; at + 8 <= b.length; ) {
      const type = b.toString("ascii", at, at + 4);
      const size = le(at + 4, 4);
      const data = at + 8;
      if (type === "VP8X") return [le(data + 4, 3) + 1, le(data + 7, 3) + 1];
      if (type === "VP8 ") return [le(data + 6, 2) & 0x3fff, le(data + 8, 2) & 0x3fff];
      if (type === "VP8L") { const bits = le(data + 1, 4); return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1]; }
      at = data + size + (size & 1);
    }
  }
  return null;
}

test("/agents 다섯 칸이 파는 파일을 보여 주고, 밑줄의 숫자가 상품 기록과 같다", async () => {
  const landing = JSON.parse(await readFile(new URL("app/data/landing-facts.json", root), "utf8"));
  const registry = await loadFacts();
  const families = landing.families ?? {};
  // 칸의 종류는 /agents 페이지가 정한다(AGENT_ASSETS). 2026-09-05 본 애니메이션 칸은 보여 줄
  // 만한 리깅 캐릭터가 없어 비웠고, 승인된 캐릭터가 생기면 페이지와 등록부가 함께 되살린다.
  const page = await readFile(new URL("../app/agents/page.tsx", import.meta.url), "utf8");
  const kinds = [...page.matchAll(/{ kind: "([a-z]+)", label: "/g)].map((m) => m[1]);
  assert.ok(kinds.length >= 4, "/agents 의 칸 정의를 읽지 못했습니다");
  assert.deepEqual(Object.keys(families).sort(), [...kinds].sort(), "/agents 의 칸과 등록부의 칸이 다릅니다");

  const wrong = [];
  for (const kind of kinds) {
    const tile = families[kind];
    const fact = registry[tile.slug];
    if (!fact) { wrong.push(`${kind}: ${tile.slug} 이 상품 기록에 없습니다`); continue; }

    const size = await imagePixelSize(new URL(tile.imagePath, root));
    if (!size) wrong.push(`${kind}: ${tile.imagePath} 의 픽셀 크기를 읽지 못했습니다`);
    else if (size[0] !== tile.imageWidth || size[1] !== tile.imageHeight) {
      wrong.push(`${kind}: 표기 ${tile.imageWidth}×${tile.imageHeight} / 파일 ${size[0]}×${size[1]} 픽셀`);
    }
    // public/ 아래가 그대로 정적 주소다. 주소와 파일이 다르면 화면은 빈 칸을 보여 준다.
    if (tile.image !== `/${tile.imagePath.replace(/^public\//, "")}`) {
      wrong.push(`${kind}: 화면 주소 ${tile.image} 가 파일 ${tile.imagePath} 와 다릅니다`);
    }

    const n = tile.numbers;
    const pieces = [];
    const same = (label, written, real) => { if (written !== real) wrong.push(`${kind}: ${label} 표기 ${written} / 기록 ${real}`); };
    if (kind === "sprite") {
      same("해상도", n.resolution, fact.texture?.resolution);
      same("용량", n.byteLength, fact.byteLength);
      same("형식", n.format, fact.format);
      pieces.push(String(n.resolution), String(n.format));
      if (n.byteLength >= 1_000_000) pieces.push(`${(n.byteLength / 1_000_000).toFixed(1)} MB`);
    } else if (kind === "atlas") {
      for (const key of ["cell", "directions", "frames"]) same(key, n[key], fact.sheet?.[key]);
      // 돌려 찍은 시트(8방향 × 1장)는 프레임 수가 없다 — 없는 수는 밑줄에 없어야 맞다.
      pieces.push(String(n.cell), String(n.directions));
      if (n.frames) pieces.push(String(n.frames));
    } else if (kind === "spine") {
      same("동작 수", n.clips, fact.animations.length);
      same("움직이는 부품 수", n.parts, fact.animatedParts.length);
      pieces.push(String(n.clips), String(n.parts));
    } else if (kind === "motion") {
      same("프레임 수", n.frames, fact.sheet?.frames);
      // 동작의 이름과 길이는 이 시트를 구워 낸 원본 3D 상품이 갖고 있다.
      const clip = registry[n.clipSlug]?.animations?.[0];
      if (!clip) wrong.push(`${kind}: ${n.clipSlug} 에 동작이 없습니다`);
      else { same("동작 이름", n.clip, clip.name); same("동작 길이", n.seconds, clip.seconds); }
      pieces.push(n.seconds.toFixed(1), String(n.frames));
    } else {
      // 3D 모델 칸만 파일에서 직접 측정한 값이다. 파일과도, 상품 기록과도 같아야 한다.
      const name = n.path.split("/").pop();
      const bytes = await readFile(new URL(n.path, root));
      const metrics = inspectAsset({ entry: name, files: new Map([[name, new Uint8Array(bytes)]]) })?.metrics;
      same("폴리곤(파일)", n.triangles, metrics?.triangleCount);
      same("재질(파일)", n.materials, metrics?.materialCount);
      same("동작(파일)", n.clips, metrics?.animationCount);
      same("폴리곤", n.triangles, fact.triangles);
      same("재질", n.materials, fact.materials);
      same("동작 수", n.clips, fact.animations.length);
      pieces.push(n.triangles.toLocaleString("ko-KR"), String(n.materials), String(n.clips));
    }
    for (const piece of pieces) {
      if (!tile.caption.includes(piece)) wrong.push(`${kind}: 밑줄 "${tile.caption}" 에 ${piece} 가 없습니다`);
    }
  }

  assert.deepEqual(
    wrong,
    [],
    `/agents 다섯 칸이 파일과 어긋납니다. node --import tsx scripts/landing-facts.mjs 를 다시 돌리세요:\n  ${wrong.join("\n  ")}`,
  );
});
