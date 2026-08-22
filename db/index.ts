/** Same reason as app/api/_lib/clunk.ts: keep this module loadable outside workerd. */
type RuntimeGlobal = typeof globalThis & { __clunkRuntimeEnv?: Record<string, unknown> };
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type ClunkRuntimeEnv = {
  DB?: D1Database;
};

export function getDb() {
  const runtimeEnv = ((globalThis as RuntimeGlobal).__clunkRuntimeEnv ?? {}) as ClunkRuntimeEnv;
  if (!runtimeEnv.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(runtimeEnv.DB, { schema });
}
