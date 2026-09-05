import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat, access } from "node:fs/promises";
import path from "node:path";

/**
 * 테마 세 벌(기본·화이트·블랙)의 계약.
 *
 * 2026-09-05 오전에 라이트/다크 토글을 걷어낸 이유가 여기 적혀 있다: 배색이 한
 * 곳에 없어서, data-theme 을 뒤집어도 요소 435개 중 19개(4.4%)만 색이 바뀌었다.
 * 같은 날 오후에 app/theme.css 한 곳으로 모으고 스위치를 되살렸다. 이 파일은 그
 * "한 곳"이 계속 한 곳으로 남는지를 본다.
 *
 * 화면에서 실제로 몇 %가 바뀌는지와 글자 대비는 브라우저가 있어야 재므로
 * tmp/theme/coverage.mjs 가 맡는다(2026-09-05 실측: 적용률 68.1~100%,
 * 최소 대비 기본 5.02 · 화이트 4.90 · 블랙 5.02).
 */

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (rel) => readFile(path.join(ROOT, rel), "utf8");

async function walk(dir, filter, out = []) {
  for (const name of await readdir(dir)) {
    const full = path.join(dir, name);
    if ((await stat(full)).isDirectory()) await walk(full, filter, out);
    else if (filter(name)) out.push(full);
  }
  return out;
}

const rel = (full) => path.relative(ROOT, full).split(path.sep).join("/");

/** `:root[data-theme="X"] { … }` 블록에서 선언된 사용자 지정 속성 이름을 뽑는다. */
function paletteTokens(css, theme) {
  const head = `:root[data-theme="${theme}"] {`;
  const start = css.indexOf(head);
  assert.notEqual(start, -1, `app/theme.css 에 ${theme} 팔레트 블록이 없다`);
  const end = css.indexOf("\n}", start);
  assert.ok(end > start, `${theme} 팔레트 블록이 닫히지 않았다`);
  const body = css.slice(start + head.length, end);
  return new Set([...body.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]));
}

test("첫 칠 전에 저장된 테마가 <html data-theme> 에 얹힌다", async () => {
  const layout = await read("app/layout.tsx");

  // 저장 키와 세 값.
  assert.match(layout, /"clunk\.theme"/);
  for (const value of ["default", "light", "dark"]) {
    assert.ok(layout.includes(`"${value}"`), `${value} 를 읽는 곳이 없다`);
  }
  // 운영체제 설정을 넘겨짚지 않는다(운영자 지시 2026-09-05).
  assert.doesNotMatch(layout, /prefers-color-scheme/);

  // 서버가 내보내는 값은 기본. 스크립트가 파싱 중에 바꾸므로 경고를 눌러 둔다.
  assert.match(layout, /<html lang="ko" data-theme="default" suppressHydrationWarning>/);

  // 스크립트는 <head> 안, 그리고 <body> 보다 앞이어야 한다 — 한 프레임이라도
  // 늦으면 화이트 테마 이용자가 어두운 화면을 한 번 보고 만다.
  const headAt = layout.indexOf("<head>");
  const scriptAt = layout.indexOf("dangerouslySetInnerHTML={{ __html: THEME_BOOT }}");
  const bodyAt = layout.indexOf("<body");
  assert.ok(headAt > 0 && scriptAt > headAt && scriptAt < bodyAt, "테마 스크립트가 <head> 맨 앞이 아니다");

  // 배색 파일은 다른 전역 스타일시트 뒤에 실려야 이긴다.
  const themeCssAt = layout.indexOf('import "./theme.css"');
  for (const earlier of ['import "./globals.css"', 'import "./foundry.css"', 'import "./site-v5.css"']) {
    assert.ok(layout.indexOf(earlier) < themeCssAt, `${earlier} 가 theme.css 보다 뒤에 있다`);
  }
});

test("팔레트 세 벌이 같은 토큰 이름을 전부 갖는다", async () => {
  const css = await read("app/theme.css");
  const base = paletteTokens(css, "default");
  assert.ok(base.size >= 40, `기본 팔레트의 토큰이 ${base.size}개뿐이다`);

  for (const theme of ["light", "dark"]) {
    const other = paletteTokens(css, theme);
    const missing = [...base].filter((name) => !other.has(name));
    const extra = [...other].filter((name) => !base.has(name));
    // 값이 없는 var() 는 선언 전체를 무효로 만든다. 한 칸이 비면 그 테마에서만
    // 화면이 통째로 깨지고, 기본 테마만 보고 있으면 알아채지 못한다.
    assert.deepEqual(missing, [], `${theme} 팔레트에 빠진 토큰`);
    assert.deepEqual(extra, [], `${theme} 팔레트에만 있는 토큰`);
  }
});

test("화면이 쓰는 --t-* 는 전부 팔레트에 있다", async () => {
  const themeCss = await read("app/theme.css");
  const declared = new Set([...themeCss.matchAll(/^\s*(--t-[a-z0-9-]+)\s*:/gim)].map((m) => m[1]));

  const files = await walk(path.join(ROOT, "app"), (name) => name.endsWith(".css"));
  const used = new Set();
  for (const file of files) {
    const css = await readFile(file, "utf8");
    for (const m of css.matchAll(/var\(\s*(--t-[a-z0-9-]+)/g)) used.add(m[1]);
  }
  const undeclared = [...used].filter((name) => !declared.has(name)).sort();
  assert.deepEqual(undeclared, [], "팔레트에 없는 토큰을 읽고 있다");
});

test("테마 스위치는 세 칸이고 한국어로 적혀 있다", async () => {
  const source = await read("app/components/ThemeSwitch.tsx");
  assert.match(source, /THEME_STORAGE_KEY = "clunk\.theme"/);
  for (const [value, label] of [["default", "기본"], ["light", "화이트"], ["dark", "블랙"]]) {
    assert.match(source, new RegExp(`value: "${value}", label: "${label}"`));
  }
  assert.match(source, /role="radiogroup"/);
  assert.match(source, /aria-label="화면 테마"/);
  assert.match(source, /aria-checked=/);
  // 고른 값은 남아야 한다. 2026-09-05 이전 토글은 저장조차 하지 않았다.
  assert.match(source, /localStorage\.setItem\(THEME_STORAGE_KEY, next\)/);
});

test("공개 내비와 작업공간 껍데기가 그 스위치를 단다", async () => {
  const nav = await read("app/components/SiteNav.tsx");
  assert.match(nav, /import \{ ThemeSwitch \} from "\.\/ThemeSwitch"/);
  // 데스크톱 바에 하나, 모바일 서랍에 하나. 서랍 쪽이 없으면 휴대폰에서 고를 곳이 없다.
  assert.match(nav, /<ThemeSwitch variant="bar" \/>/);
  assert.match(nav, /<ThemeSwitch variant="drawer" \/>/);
  const drawerAt = nav.indexOf('<ThemeSwitch variant="drawer" />');
  const drawerCardAt = nav.indexOf("sitenav-drawer-card");
  assert.ok(drawerCardAt > 0 && drawerAt > drawerCardAt, "서랍 사본이 서랍 밖에 있다");

  const shell = await read("app/components/WorkspaceShell.tsx");
  assert.match(shell, /import \{ ThemeSwitch \} from "\.\/ThemeSwitch"/);
  assert.match(shell, /<ThemeSwitch variant="bar" \/>/);
  assert.match(shell, /<ThemeSwitch variant="drawer" \/>/);
});

test("화면을 어둡게 못 박던 장치가 남아 있지 않다", async () => {
  // ForceDarkTheme 은 라이트 팔레트가 cv5 어두운 바닥에 검정 글자를 칠하던
  // 2026-08-31 사고를 막으려고 박은 못이다. 그 사고가 더는 나지 않으므로 뺐고,
  // 남아 있으면 사람이 고른 테마를 덮어쓴다.
  await assert.rejects(access(path.join(ROOT, "app/components/ForceDarkTheme.tsx")));

  const tsx = await walk(path.join(ROOT, "app"), (name) => name.endsWith(".tsx"));
  const offenders = [];
  for (const file of tsx) {
    const source = await readFile(file, "utf8");
    // 주석에 이름이 남는 것은 기록이므로 세지 않는다 — 실제로 부르거나 심는 곳만 본다.
    if (/<ForceDarkTheme|import\s*\{[^}]*ForceDarkTheme/.test(source)) offenders.push(rel(file));
    // data-theme 을 실제로 심는 곳은 layout 의 부팅 스크립트와 스위치, 둘뿐이다.
    const writesTheme = /setAttribute\(\s*["']data-theme|dataset\.theme\s*=|data-theme="/.test(source);
    if (writesTheme && !/layout\.tsx$|ThemeSwitch\.tsx$/.test(file)) {
      offenders.push(`${rel(file)} (data-theme 을 직접 박는다)`);
    }
  }
  assert.deepEqual(offenders, []);

  // cv5 층이 옛 토글을 숨기던 줄도 함께 없앴다. 줄 맨 앞에서 시작하는 규칙만
  // 본다 — 그 자리에 왜 없는지 적어 둔 주석에는 같은 글자가 남아 있다.
  const siteV5 = await read("app/site-v5.css");
  assert.doesNotMatch(siteV5, /^\.cv5 \.theme-toggle/m);
});

test("어제의 색 리터럴이 다시 늘지 않는다", async () => {
  /* 왜 이 문턱인가.
     리터럴은 테마를 안 따라온다 — 2026-09-05 오전의 실패가 정확히 그것이었다.
     그래서 app/**.css 의 리터럴을 두 무리로 나눠 각각 상한을 둔다.

     · cv5 층(오늘의 화면을 칠하는 파일들). 2026-09-05 작업 전 660개 →
       작업 후 197개. 남은 것은 대부분 무대(렌더가 구워져 들어오는 자리)와
       브랜드 그라데이션이라 일부러 테마를 안 따라간다. 상한 260.
     · legacy 층(globals·foundry·workspace·live-evidence). 2026-09-05 밤에
       1189 → 14 로 내렸다. 남은 14 는 전부 주석 안의 실측 기록(#060b12 H215
       S50.0% L4.7% 같은 것)이라 화면을 칠하지 않는다 — 왜 그 값이었는지
       읽으려면 남아 있어야 한다. 상한 40: 주석에 실측을 더 적을 여지는 두되,
       선언으로 리터럴이 돌아오면 바로 걸린다.

       어떻게 내렸나. 24개 화면을 돌며 실제로 칠해지는 색 266종을 걷고, DOM 에
       실제로 있는 class 701개를 걷어, 리터럴을 셋으로 갈랐다.
         · 화면에 뜨는 값·무대 위 값 210건 → --t-fx-* (세 테마 같은 값)
         · :root 사다리의 기본값 99건    → theme.css 의 리맵과 같은 식으로
         · 나머지 866건                  → --t-lg-* / --t-fd-* (테마를 따라감)
       셋째 무리는 어느 화면에서도 칠해지지 않던 값이라(측정) 역할 토큰으로
       묶어도 기본 테마가 움직이지 않는다.

     app/theme.css 자신은 세지 않는다 — 팔레트가 리터럴인 것이 이 파일의 일이다. */
  const LEGACY = new Set([
    "app/globals.css",
    "app/foundry.css",
    "app/workspace.css",
    "app/components/live-evidence.css",
  ]);
  const literalRe = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*[\d.]/g;

  const files = await walk(path.join(ROOT, "app"), (name) => name.endsWith(".css"));
  let legacy = 0;
  let cv5 = 0;
  for (const file of files) {
    const name = rel(file);
    if (name === "app/theme.css") continue;
    const count = ((await readFile(file, "utf8")).match(literalRe) || []).length;
    if (LEGACY.has(name)) legacy += count;
    else cv5 += count;
  }
  assert.ok(cv5 <= 260, `cv5 층의 색 리터럴이 ${cv5}개다(상한 260)`);
  assert.ok(legacy <= 40, `legacy 층의 색 리터럴이 ${legacy}개다(상한 40)`);
});
