import { sites } from "@openai/sites-vite-plugin";
import { nitro } from "nitro/vite";
import { fileURLToPath } from "node:url";
import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const isNetlifyBuild = process.env.NITRO_PRESET === "netlify" || process.env.NITRO_PRESET === "netlify_edge";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  // 판매 파일의 문을 정적 경로에도 세운다.
  //
  // Cloudflare 는 배포에 번들된 파일이 있으면 워커를 건너뛰고 그 파일을 그대로 준다.
  // 그래서 `/api/marketplace/assets/{id}` 가 401 로 막는 바이트가 `/market/<slug>/<file>`
  // 에서는 문 없이 나가고 있었다(2026-09-05 점검 A1). `run_worker_first` 는 여기 적은
  // 경로만 워커가 먼저 받게 한다 — 나머지 정적 파일은 예전처럼 자산 층이 바로 준다.
  //
  // `binding` 은 통과시킨 파일을 워커가 스스로 내주기 위한 손잡이다. 이름이
  // STATIC_ASSETS 인 이유는 ASSETS 가 이미 R2 버킷(.openai/hosting.json)이라서다.
  assets: {
    binding: "STATIC_ASSETS",
    run_worker_first: ["/market/*"],
  },
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    resolve: isNetlifyBuild
      ? { alias: { "cloudflare:workers": fileURLToPath(new URL("./worker/netlify-workers-shim.ts", import.meta.url)) } }
      : undefined,
    server: {
      watch: {
        // `tmp/` is where the QA harnesses drop screenshots and downloaded
        // artifacts. Watching it means a Playwright run restarts the server it is
        // driving, and a half-written download crashes it outright with EBUSY.
        ignored: ["**/.playwright-cli/**", "**/.clunk-evidence/**", "**/.wrangler/**", "**/dist/**", "**/tmp/**"],
        ...(isCodexSeatbeltSandbox ? { useFsEvents: false, usePolling: true } : {}),
      },
      // Opt-in only: lets a quick-tunnel host through the dev server's host check so the
      // user can view the local site from outside. Never set in normal local runs.
      ...(process.env.CLUNK_DEV_ALLOWED_HOSTS
        ? { allowedHosts: process.env.CLUNK_DEV_ALLOWED_HOSTS.split(",") }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      ...(isNetlifyBuild
        ? [nitro()]
        : [cloudflare({
            viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
            config: localBindingConfig,
          })]),
    ],
  };
});
