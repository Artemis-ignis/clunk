#!/usr/bin/env node
/**
 * 파는 GLB 옆에 미리보기 GLB 를 굽는다.
 *
 * 왜. `/market/<slug>/<file>` 정적 경로에는 문이 없어서, API 가 401 로 막는 판매 파일이
 * 같은 주소에서 그대로 나가고 있었다(2026-09-05 점검 A1, 195개). 문을 세우면 첫 화면과
 * 상품 화면의 3D 뷰어가 그 파일을 직접 읽고 있으므로 화면이 통째로 깨진다. 그래서 문을
 * 세우기 전에, 로그인하지 않은 방문자가 볼 파일을 따로 굽는다.
 *
 * 무엇을 줄이고 무엇을 남기나.
 *
 *   줄인다 — 삼각형을 40% 이하로(meshopt simplify, 오차 0.01, 가장자리 고정),
 *            그림은 긴 변 128px 로.
 *   남긴다 — 애니메이션 클립 전부, 스킨 전부. 사는 사람이 보고 판단하는 것이 움직임이다.
 *            움직임을 뺀 미리보기는 미리보기가 아니라 다른 물건이다.
 *
 * 압축 확장은 붙이지 않는다. 미리보기는 아무 엔진에서나 열려야 하는 파일이라 평범한
 * glTF 로 쓴다(EXT_meshopt_compression, KHR_mesh_quantization 은 읽고 나서 떼어낸다).
 *
 * 20KB 이하의 파일은 삼각형을 40% 로 줄여도 지킬 것이 없다 — 이미 통째로 작다. 그런
 * 파일은 판매본을 그대로 미리보기로 두고 보고서에 "미리보기 = 판매본" 이라고 적는다.
 * 숨기지 않는다.
 *
 * 같은 입력에 같은 출력이 나온다(두 번 돌려 sha256 이 같다).
 *
 * 사용:
 *   node scripts/market-preview-glb.mjs            모든 상품
 *   node scripts/market-preview-glb.mjs --slug x   상품 하나(여러 번 쓸 수 있다)
 *   node scripts/market-preview-glb.mjs --dry      무엇을 굽는지만 적고 파일은 안 쓴다
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { dedup, dequantize, prune, simplify } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const MARKET_DIR = path.join(ROOT, "public", "market");

/** 삼각형을 이 비율 이하로 줄인다. */
export const TRIANGLE_RATIO = 0.4;
/** simplify 가 허용하는 모양 오차(모델 크기 대비). */
export const SIMPLIFY_ERROR = 0.01;
/** 그림의 긴 변 상한(px). */
export const TEXTURE_MAX_PX = 128;
/** 이 크기 이하는 줄여도 지킬 것이 없다. */
export const TINY_BYTES = 20 * 1024;

/** 판매 GLB 하나에 대응하는 미리보기 파일 이름. app/api/_lib/market-path.ts 와 같은 규칙. */
export function previewNameOf(entryFileName) {
  return entryFileName.startsWith("preview-") ? entryFileName : `preview-${entryFileName}`;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** public/market 아래에서 미리보기를 구울 대상을 모은다. */
export function listSaleModels(marketDir = MARKET_DIR) {
  if (!fs.existsSync(marketDir)) return [];
  const found = [];
  for (const slug of fs.readdirSync(marketDir).sort()) {
    const dir = path.join(marketDir, slug);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const fileName of fs.readdirSync(dir).sort()) {
      if (!/\.glb$/iu.test(fileName)) continue;
      if (fileName.startsWith("preview-") || fileName.startsWith("hero-")) continue;
      found.push({ slug, fileName, filePath: path.join(dir, fileName) });
    }
  }
  return found;
}

function countTriangles(document) {
  let triangles = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices();
      const position = primitive.getAttribute("POSITION");
      const count = indices ? indices.getCount() : (position ? position.getCount() : 0);
      // 미리보기는 삼각형 목록만 다룬다. 다른 모드는 세지 않는다.
      if (primitive.getMode() === 4) triangles += Math.floor(count / 3);
    }
  }
  return triangles;
}

/**
 * 128px 을 넘는 그림만 줄인다. 넘지 않는 그림은 바이트 하나 건드리지 않는다.
 *
 * 색표(4x4, 8x8)를 다시 인코딩하면 원본과 다른 PNG 가 되고, 색이 칸 경계에서 섞이면
 * 모델의 색이 통째로 달라진다. 줄일 때도 nearest 로 줄여 옆 칸 색이 섞이지 않게 한다.
 */
async function resizeTextures(document) {
  for (const texture of document.getRoot().listTextures()) {
    const image = texture.getImage();
    if (!image) continue;
    const source = Buffer.from(image);
    let metadata;
    try {
      metadata = await sharp(source).metadata();
    } catch {
      continue;
    }
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (width <= TEXTURE_MAX_PX && height <= TEXTURE_MAX_PX) continue;
    const resized = await sharp(source)
      .resize({ width: Math.min(width, TEXTURE_MAX_PX), height: Math.min(height, TEXTURE_MAX_PX), fit: "inside", kernel: "nearest" })
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();
    texture.setImage(new Uint8Array(resized)).setMimeType("image/png");
  }
}

function newIO() {
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
}

/**
 * 판매 GLB 한 개에서 미리보기 바이트를 만든다.
 *
 * 반환값의 `equalsSale` 이 true 면 판매본을 그대로 쓴 것이다(20KB 이하).
 */
export async function buildPreview(saleBytes) {
  const sourceSha256 = sha256(saleBytes);
  const io = newIO();
  const document = await io.readBinary(new Uint8Array(saleBytes));
  const trianglesBefore = countTriangles(document);
  const clipsBefore = document.getRoot().listAnimations().length;
  const skinsBefore = document.getRoot().listSkins().length;

  if (saleBytes.byteLength <= TINY_BYTES) {
    return {
      bytes: Buffer.from(saleBytes),
      trianglesBefore,
      trianglesAfter: trianglesBefore,
      clips: clipsBefore,
      skins: skinsBefore,
      equalsSale: true,
      sourceSha256,
    };
  }

  // 압축·양자화 확장은 읽고 나서 떼어낸다. 미리보기는 평범한 glTF 로 나가야 한다.
  let quantized = false;
  for (const extension of document.getRoot().listExtensionsUsed()) {
    const name = extension.extensionName;
    if (name === KHRMeshQuantization.EXTENSION_NAME) quantized = true;
    if (name === EXTMeshoptCompression.EXTENSION_NAME || name === KHRMeshQuantization.EXTENSION_NAME) {
      extension.dispose();
    }
  }
  // 양자화를 쓴 파일만 푼다.
  //
  // 조건 없이 부르면 dequantize 가 정규화된 정수 좌표(TEXCOORD_0 이 unsigned short 인
  // 파일이 대부분이다)까지 float32 로 바꿔 놓아, 삼각형이 하나도 안 줄어든 파일의
  // 미리보기가 판매본보다 커진다. 실측에서 나무 묶음이 932KB → 1.10MB 로 불었다.
  if (quantized) await document.transform(dequantize());

  // 삼각형을 줄인다. 가장자리를 고정해 부품이 서로 벌어지지 않게 한다.
  await document.transform(simplify({
    simplifier: MeshoptSimplifier,
    ratio: TRIANGLE_RATIO,
    error: SIMPLIFY_ERROR,
    lockBorder: true,
  }));

  // 그림은 긴 변 128px. 색과 모양은 알아볼 수 있고, 원본 텍스처는 넘어가지 않는다.
  //
  // gltf-transform 의 textureCompress 를 쓰지 않는다. 우리 파일의 그림은 4x4·8x8 짜리
  // 색표라 그 경로가 libvips 에서 "colourspace: parameter space not set" 으로 죽는다.
  // 이미 128px 이하인 그림은 손대지 않으므로(대부분이 그렇다) 되풀이해도 같은 바이트가
  // 나온다.
  await resizeTextures(document);

  await document.transform(dedup(), prune());

  const trianglesAfter = countTriangles(document);
  const root = document.getRoot();
  // 이 파일이 무엇인지 파일 스스로 말하게 한다. 미리보기를 판매본으로 착각해 게임에
  // 넣는 일이 없어야 한다.
  const extras = {
    clunkPreview: true,
    sourceSha256,
    triangleRatio: trianglesBefore > 0 ? Number((trianglesAfter / trianglesBefore).toFixed(4)) : 1,
  };
  root.getAsset().extras = { ...(root.getAsset().extras ?? {}), ...extras };
  root.setExtras({ ...(root.getExtras() ?? {}), ...extras });

  const bytes = Buffer.from(await newIO().writeBinary(document));
  return {
    bytes,
    trianglesBefore,
    trianglesAfter,
    clips: root.listAnimations().length,
    skins: root.listSkins().length,
    equalsSale: false,
    sourceSha256,
  };
}

function formatBytes(value) {
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function parseArgs(argv) {
  const slugs = [];
  let dry = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry") dry = true;
    else if (arg === "--slug") slugs.push(argv[index + 1] ?? "");
    else if (arg.startsWith("--slug=")) slugs.push(arg.slice("--slug=".length));
  }
  return { slugs: slugs.filter(Boolean), dry };
}

async function main() {
  const { slugs, dry } = parseArgs(process.argv.slice(2));
  await MeshoptSimplifier.ready;
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;

  const targets = listSaleModels().filter((row) => slugs.length === 0 || slugs.includes(row.slug));
  if (!targets.length) {
    console.log("구울 대상이 없습니다.");
    return;
  }

  const rows = [];
  for (const target of targets) {
    const saleBytes = fs.readFileSync(target.filePath);
    const previewPath = path.join(path.dirname(target.filePath), previewNameOf(target.fileName));
    if (dry) {
      rows.push({
        slug: target.slug,
        file: target.fileName,
        preview: path.basename(previewPath),
        bytesBefore: saleBytes.byteLength,
        bytesAfter: null,
        trianglesBefore: null,
        trianglesAfter: null,
        clips: null,
        equalsSale: saleBytes.byteLength <= TINY_BYTES,
        planned: true,
      });
      continue;
    }
    try {
      const result = await buildPreview(saleBytes);
      fs.writeFileSync(previewPath, result.bytes);
      rows.push({
        slug: target.slug,
        file: target.fileName,
        preview: path.basename(previewPath),
        bytesBefore: saleBytes.byteLength,
        bytesAfter: result.bytes.byteLength,
        trianglesBefore: result.trianglesBefore,
        trianglesAfter: result.trianglesAfter,
        clips: result.clips,
        skins: result.skins,
        equalsSale: result.equalsSale,
        sha256: sha256(result.bytes),
        sourceSha256: result.sourceSha256,
      });
    } catch (error) {
      rows.push({ slug: target.slug, file: target.fileName, error: String(error?.message ?? error) });
    }
  }

  const width = (key, min) => Math.max(min, ...rows.map((row) => String(row[key] ?? "").length));
  const slugWidth = width("slug", 4);
  const fileWidth = width("file", 4);
  console.log("");
  console.log(
    `${"slug".padEnd(slugWidth)}  ${"file".padEnd(fileWidth)}  ${"tris before".padStart(11)}  ${"tris after".padStart(10)}  ${"bytes before".padStart(12)}  ${"bytes after".padStart(11)}  note`,
  );
  for (const row of rows) {
    if (row.error) {
      console.log(`${row.slug.padEnd(slugWidth)}  ${row.file.padEnd(fileWidth)}  ${"—".padStart(11)}  ${"—".padStart(10)}  ${"—".padStart(12)}  ${"—".padStart(11)}  실패: ${row.error}`);
      continue;
    }
    // 줄지 않은 파일은 줄지 않았다고 적는다. 이미 낮은 폴리곤으로 손수 만든 모델은
    // simplify 가 모양을 깨지 않고는 더 뺄 것이 없다고 말하는 것이고, 그런 파일의
    // 미리보기는 사실상 판매본이다.
    const ratio = row.trianglesBefore > 0 ? row.trianglesAfter / row.trianglesBefore : 1;
    const note = row.planned
      ? "예정"
      : row.equalsSale
        ? "미리보기 = 판매본(20KB 이하)"
        : ratio > 0.8
          ? `삼각형 ${(ratio * 100).toFixed(1)}% — 더 줄면 모양이 깨진다 · 클립 ${row.clips}개 유지`
          : `삼각형 ${(ratio * 100).toFixed(1)}% · 클립 ${row.clips}개 유지`;
    console.log(
      `${row.slug.padEnd(slugWidth)}  ${row.file.padEnd(fileWidth)}  ${String(row.trianglesBefore ?? "—").padStart(11)}  ${String(row.trianglesAfter ?? "—").padStart(10)}  ${formatBytes(row.bytesBefore).padStart(12)}  ${(row.bytesAfter === null ? "—" : formatBytes(row.bytesAfter)).padStart(11)}  ${note}`,
    );
  }

  const done = rows.filter((row) => !row.error && !row.planned);
  const totalBefore = done.reduce((sum, row) => sum + row.bytesBefore, 0);
  const totalAfter = done.reduce((sum, row) => sum + row.bytesAfter, 0);
  const ratios = done.filter((row) => !row.equalsSale && row.trianglesBefore > 0)
    .map((row) => row.trianglesAfter / row.trianglesBefore);
  console.log("");
  console.log(
    `파일 ${done.length}개 · 바이트 ${formatBytes(totalBefore)} → ${formatBytes(totalAfter)}`
    + (ratios.length ? ` · 삼각형 비율 ${(Math.min(...ratios) * 100).toFixed(1)}%~${(Math.max(...ratios) * 100).toFixed(1)}%` : "")
    + ` · 미리보기=판매본 ${done.filter((row) => row.equalsSale).length}개`
    + ` · 실패 ${rows.filter((row) => row.error).length}개`,
  );

  if (!dry) {
    const reportDir = path.join(ROOT, "tmp", "gate");
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, "market-preview-glb.json"), `${JSON.stringify({ rows }, null, 2)}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("market-preview-glb.mjs")) {
  await main();
}
