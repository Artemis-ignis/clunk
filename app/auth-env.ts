/**
 * Runtime configuration lookup for the authentication providers.
 *
 * Two runtimes have to agree here. Under `vinext dev` the Cloudflare plugin exposes
 * `.dev.vars` / `.env` values on the worker `env` object, while a plain Node context
 * (scripts, one-off checks) only ever sees `process.env`. Reading both keeps a single
 * variable name working in either place instead of forcing two spellings.
 *
 * Every value here is optional on purpose: the self-hosted sign-in providers must stay
 * fail-closed. An unset secret disables the provider rather than falling back to a
 * default, so a deployment that forgets to configure it cannot issue sessions signed
 * with a guessable key.
 */
/**
 * The Cloudflare env is read from what the worker stashes on the global at the top of
 * `fetch`, not through a `cloudflare:workers` import.
 *
 * That import is a virtual module: it only resolves inside workerd. Pulling it into the
 * page-render path meant plain Node could not even load /app — the production Node server
 * returned 500 and the built worker could not be exercised in tests. Reading a stashed
 * reference keeps the same value in workerd while staying loadable anywhere.
 */
type RuntimeGlobal = typeof globalThis & { __clunkRuntimeEnv?: Record<string, unknown> };

type RuntimeEnv = Record<string, unknown> & { DB?: D1Database };

function runtimeEnv(): RuntimeEnv {
  return ((globalThis as RuntimeGlobal).__clunkRuntimeEnv ?? {}) as RuntimeEnv;
}

export function readAuthEnv(name: string): string | undefined {
  const fromBinding = runtimeEnv()[name];
  if (typeof fromBinding === "string" && fromBinding.trim() !== "") {
    return fromBinding.trim();
  }
  const fromProcess =
    typeof process !== "undefined" && process.env ? process.env[name] : undefined;
  if (typeof fromProcess === "string" && fromProcess.trim() !== "") {
    return fromProcess.trim();
  }
  return undefined;
}

/** D1 handle for the auth path. Returns null instead of throwing: a signed-out visitor is a valid state. */
export function getAuthDatabase(): D1Database | null {
  return runtimeEnv().DB ?? null;
}
