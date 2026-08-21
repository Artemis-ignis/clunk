import { sites } from "@openai/sites-vite-plugin";
import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
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
    environments: {
      client: {
        build: {
          rolldownOptions: {
            output: {
              codeSplitting: {
                // P0 workaround for vinext 1.0.0-beta.2 + rolldown 1.0.1.
                //
                // `next/link`'s shim reaches for the navigation shim through a
                // dynamic `import("./navigation.js")` — once for the click path
                // (`navigateClientSide`) and once for prefetch (the whole
                // namespace). The browser entry also imports navigation.js
                // statically, so rolldown folds it into the *entry* chunk. Entry
                // chunks only expose the entry module's own exports, and rolldown
                // does not synthesize a namespace for the dynamic import that now
                // points at them, so in a production build every one of those
                // reads is `undefined`:
                //   TypeError: d is not a function  (prefetch setup)
                //   TypeError: e is not a function  (click -> navigateClientSide)
                // Link has already called preventDefault() by then, so clicking an
                // internal link did nothing at all. Dev is unaffected (no bundling).
                //
                // Pinning the navigation shim (and the modules its dynamic-import
                // namespace pulls in) into its own non-entry chunk restores the
                // namespace object rolldown emits for every other dynamic import.
                // Revisit when upgrading vinext past 1.0.0-beta.2.
                groups: [
                  {
                    name: "vinext-navigation",
                    test: /[\\/]node_modules[\\/]vinext[\\/]dist[\\/]shims[\\/]navigation\.js$/,
                  },
                ],
              },
            },
          },
        },
      },
    },
    server: {
      watch: {
        ignored: ["**/.playwright-cli/**", "**/.clunk-evidence/**", "**/.wrangler/**", "**/dist/**"],
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
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
