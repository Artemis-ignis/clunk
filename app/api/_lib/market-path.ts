/**
 * `/market/<slug>/<file>` 정적 경로의 문지기가 쓰는 순수 규칙.
 *
 * 이 파일에는 D1 도, Request 도, next/* 도 들어오지 않는다. 워커(worker/index.ts)와
 * 오프라인 검사(tests/public-market-exposure.test.mjs)와 화면 쪽 주소 생성
 * (app/components/model-source.ts)이 **같은 한 함수**를 부르게 하려는 것이 목적이다.
 * 세 곳이 각자 정규식을 갖고 있으면 어느 하나가 조용히 느슨해진다.
 *
 * 공개 판정의 근거는 D1 의 artifact role 이다. 2026-09-05 실측(clunk_asset_artifacts,
 * object_key LIKE 'asset:/market/%', 327행):
 *
 *   role hero(77) · preview(112) — 카드와 첫 화면이 거는 그림. 원래 공개다.
 *   role entry(185) · page(37) · texture(3) · manifest(81) · metadata(22)
 *        · passport(12) · animation(4) — 파는 바이트. 문 뒤에 있어야 한다.
 *
 * 파일 이름으로 같은 선을 그으면 hero-*, preview-*, *.card.png 세 모양이 role
 * hero/preview 와 정확히 겹친다. 어긋나는 것은 일곱 개뿐인데(스프라이트 시트 원본
 * *.sheet.png 가 role preview 로 올라가 있다) 그 일곱은 파는 파일 자체이므로 여기서는
 * 이름 규칙을 따라 **막는 쪽**으로 남긴다 — 이름 규칙이 role 보다 좁다. 화면이 그 시트를
 * 그릴 때는 정적 경로가 아니라 문이 있는 API(preview=1)를 쓰므로 깨지지 않는다.
 */

/** 정적 경로 하나를 슬러그와 파일 이름으로 가른다. 그 모양이 아니면 null. */
export function parseMarketPath(pathname: string): { slug: string; fileName: string } | null {
  if (!pathname.startsWith("/market/")) return null;
  const rest = pathname.slice("/market/".length);
  if (!rest || rest.includes("..") || rest.includes("//")) return null;
  const parts = rest.split("/");
  if (parts.length !== 2) return null;
  const [slug, fileName] = parts;
  if (!isSafeMarketSegment(slug) || !isSafeMarketSegment(fileName)) return null;
  return { slug, fileName };
}

function isSafeMarketSegment(value: string): boolean {
  return value.length > 0 && value.length <= 200 && /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value);
}

/**
 * 로그인 없이 나가도 되는 파일인가. 여기서 true 인 것만 문 없이 나간다.
 *
 * - `hero-*`    상품 카드와 첫 화면의 대표 그림(role hero)
 * - `preview-*` 미리보기 그림과 이번에 굽는 미리보기 GLB(role preview)
 *
 * - `*.card.png` 시트의 카드용 축소본(role preview). 처음에는 아무 화면도 정적 경로로 부르지
 *   않아 닫아 두었는데, /agents 의 "스프라이트 시트"·"애니메이션 클립" 칸이 그 그림을 정적
 *   경로로 쓰면서(2026-09-05) 두 칸이 401 로 비어 보였다. D1 에서도 미리보기인 파일이라 연다.
 *   판매 파일(GLB·원본 시트 PNG·텍스처)은 여전히 이 목록 밖이다.
 */
export function isPublicMarketFile(fileName: string): boolean {
  return /^(?:hero-|preview-)/u.test(fileName) || /.card.png$/iu.test(fileName);
}

/**
 * 판매 GLB 하나에 대응하는 미리보기 파일 이름.
 *
 * 폴더 이름이 아니라 파는 파일 이름에 접두를 붙인다. 키트 폴더 하나에 GLB 가 네 개
 * 들어 있는 자리가 있어서(cozy-farm-set-vol1), 슬러그로 이름을 지으면 넷이 한 파일을
 * 놓고 다툰다.
 */
export function previewGlbFileName(entryFileName: string): string {
  return entryFileName.startsWith("preview-") ? entryFileName : `preview-${entryFileName}`;
}

/** 미리보기 GLB 의 주소. 로그인하지 않은 방문자의 뷰어가 읽는 파일. */
export function previewGlbUrl(slug: string, entryFileName: string): string {
  return `/market/${encodeURIComponent(slug)}/${encodeURIComponent(previewGlbFileName(entryFileName))}`;
}

/**
 * 미리보기 파일을 보고 있을 때 화면에 서는 한 줄.
 *
 * 서버 컴포넌트(첫 화면)와 클라이언트 컴포넌트(상품·키트 화면)가 같은 문장을 써야 해서
 * 순수 모듈인 여기 있다.
 */
export const PREVIEW_NOTE = "미리보기 파일로 보는 중입니다. 로그인하면 받는 파일 그대로 봅니다.";

/**
 * 로그인 여부와 상관없이 늘 미리보기를 거는 자리(첫 화면)의 한 줄.
 *
 * 첫 화면은 로그인한 사람에게도 미리보기를 보여 준다 — 공개 화면이 방문자마다 다른
 * 파일을 부르지 않게 하려는 것이다. 그 자리에서 "로그인하면" 이라고 적으면 이미 로그인한
 * 사람에게 거짓이 된다.
 */
export const PREVIEW_NOTE_ALWAYS = "미리보기 파일로 보는 중입니다. 받는 파일은 마켓 상품 화면에서 봅니다.";

/** GLB/glTF 인가. 미리보기를 굽는 대상이자 뷰어가 여는 파일. */
export function isModelFileName(fileName: string): boolean {
  return /\.(?:glb|gltf)$/iu.test(fileName);
}
