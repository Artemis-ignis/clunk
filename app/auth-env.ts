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
import { env } from "cloudflare:workers";

type RuntimeEnv = Record<string, unknown> & { DB?: D1Database };

const runtime = env as unknown as RuntimeEnv;

export function readAuthEnv(name: string): string | undefined {
  const fromBinding = runtime[name];
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
  return runtime.DB ?? null;
}
