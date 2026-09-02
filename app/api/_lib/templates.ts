import { getRuntimeAssets, hasRuntimeAssets } from "./clunk";
import {
  TEMPLATE_LIBRARY_KEY,
  parseTemplateLibrary,
  type TemplateLibrary,
} from "../../../packages/clunk-series/src/template-library";

/**
 * Where the template library's bytes come from.
 *
 * In production it is the same private R2 bucket generated assets already live in. The local
 * fallback exists so the whole path — catalogue, selection, GLB edit, bundle — can be run and
 * tested on a laptop against the tree scripts/template-library/build.mjs just wrote, without a
 * Cloudflare binding. It is opt-in through an environment variable and can never engage in a
 * deployed Worker, where `process.env` carries no such value.
 */
export interface TemplateStore {
  get(key: string): Promise<Uint8Array | null>;
  origin: "r2" | "local";
}

export function hasTemplateStore(): boolean {
  return hasRuntimeAssets() || Boolean(localTemplateDir());
}

function localTemplateDir(): string | null {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const dir = env?.CLUNK_TEMPLATE_LIBRARY_DIR;
  return dir && dir.trim() ? dir.trim() : null;
}

/**
 * The local adapter reads `templates/<a>/<b>` as `<dir>/<a>/<b>`, which is exactly the layout
 * the builder writes and the uploader mirrors, so a key that works here works in R2.
 */
function localStore(dir: string): TemplateStore {
  return {
    origin: "local",
    async get(key: string) {
      // The specifier is held in a variable so a Workers bundler never pulls node:fs into the
      // graph; this branch only exists for local verification.
      const nodePath = "node:path";
      const nodeFs = "node:fs/promises";
      const path = await import(/* @vite-ignore */ nodePath);
      const fs = await import(/* @vite-ignore */ nodeFs);
      const relative = key.startsWith("templates/") ? key.slice("templates/".length) : key;
      try {
        const file = await fs.readFile(path.join(dir, relative));
        return new Uint8Array(file);
      } catch {
        return null;
      }
    },
  };
}

export function getTemplateStore(): TemplateStore {
  const dir = localTemplateDir();
  if (dir) return localStore(dir);
  const bucket = getRuntimeAssets();
  return {
    origin: "r2",
    async get(key: string) {
      const object = await bucket.get(key);
      if (!object) return null;
      return new Uint8Array(await object.arrayBuffer());
    },
  };
}

/**
 * One parse per isolate.
 *
 * library.json is a single immutable object that changes only when an operator uploads a new
 * library, and every request in the 3D lane needs it. Re-fetching and re-parsing it per request
 * would spend the Worker's whole CPU budget on JSON before any geometry was touched.
 */
let cached: { key: string; library: TemplateLibrary } | null = null;

export async function loadTemplateLibrary(store: TemplateStore): Promise<TemplateLibrary | null> {
  if (cached?.key === store.origin) return cached.library;
  const bytes = await store.get(TEMPLATE_LIBRARY_KEY);
  if (!bytes) return null;
  const library = parseTemplateLibrary(new TextDecoder().decode(bytes));
  cached = { key: store.origin, library };
  return library;
}

/** Test and operator hook: forget the parsed catalogue so the next request re-reads it. */
export function resetTemplateLibraryCache(): void {
  cached = null;
}
