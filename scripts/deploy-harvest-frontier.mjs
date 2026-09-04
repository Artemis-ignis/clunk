#!/usr/bin/env node
/**
 * 하베스트 프론티어를 웹에 올린다.
 *
 * 왜 Clunk 저장소에 있나. 상품 페이지가 "이 파일은 실제 게임에 들어가 돌던 것"이라고
 * 말하는데, 그 게임을 아무도 볼 수 없으면 그것은 증거가 아니라 주장이다. 이 배포는
 * 그 주장을 클릭 한 번으로 확인할 수 있게 만드는 것이므로 마켓 쪽 일이다.
 *
 * 게임 저장소는 건드리지 않는다. 거기서 빌드한 dist 를 복사해 와 별도 워커로 올린다.
 * 게임 31MB 를 상점 워커에 넣으면 상점 배포가 무거워지고, 둘의 수명도 다르다.
 *
 * 사용:
 *   node scripts/deploy-harvest-frontier.mjs            # 복사 + 배포
 *   node scripts/deploy-harvest-frontier.mjs --dry-run  # 복사만
 *   HF_DIR="D:/..." node scripts/deploy-harvest-frontier.mjs
 *
 * 필요: CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID
 */
import { cpSync, existsSync, mkdirSync, rmSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const HF = process.env.HF_DIR ?? "C:/Users/50106/Desktop/Harvest Frontier";
const dist = join(HF, "dist");
const out = join(root, "deploy", "harvest-frontier", "public");

if (!existsSync(dist)) {
  console.error(`빌드가 없습니다: ${dist}\n게임 폴더에서 npm run build 를 먼저 돌리세요.`);
  process.exit(2);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(dist, out, { recursive: true });

// 소스맵은 브라우저가 개발자 도구를 열 때만 받는다. 올려 봐야 배포만 무거워지고,
// 게임 소스를 통째로 공개하는 셈이기도 하다.
let maps = 0;
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith(".map")) { rmSync(path); maps += 1; }
  }
};
walk(out);

const total = (() => {
  let bytes = 0;
  const add = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) add(path);
      else bytes += statSync(path).size;
    }
  };
  add(out);
  return bytes;
})();
console.log(`복사 완료 · 소스맵 ${maps}개 제외 · ${(total / 1048576).toFixed(1)}MB`);

if (process.argv.includes("--dry-run")) {
  console.log("복사만 했습니다. 올리려면 --dry-run 을 빼세요.");
  process.exit(0);
}
if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
  console.error("CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID 가 필요합니다.");
  process.exit(2);
}
execFileSync("npx", ["wrangler", "deploy", "-c", "deploy/harvest-frontier/wrangler.json"], {
  cwd: root, stdio: "inherit", shell: process.platform === "win32",
});
