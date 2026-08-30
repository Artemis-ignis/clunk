/**
 * Cloudflare bindings expose secrets through `env`, while local Vinext and
 * Netlify expose them through process.env. Keep the list explicit so provider
 * and auth code never serializes database, bucket, or unrelated bindings.
 */
const RUNTIME_ENVIRONMENT_KEYS = [
  "CLUNK_SITE_ORIGIN",
  "CLUNK_OAUTH_STATE_SECRET",
  "CLUNK_AUTH_SESSION_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "GOOGLE_OAUTH_REDIRECT_URI",
  "GITHUB_CLIENT_ID",
  "GITHUB_OAUTH_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GITHUB_OAUTH_CLIENT_SECRET",
  "GITHUB_REDIRECT_URI",
  "GITHUB_OAUTH_REDIRECT_URI",
  "TRELLIS_ENDPOINT",
  "TRELLIS_MODEL_ID",
  "TRELLIS_API_KEY",
  "BLENDER_BIN",
  "CLUNK_BILLING_PROVIDER",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
] as const;

export type RuntimeEnvironment = Record<string, string | undefined>;

/**
 * The Worker entry installs the request's bindings here before handing the
 * request to Vinext. Keeping the bridge framework-neutral prevents a
 * `cloudflare:workers` import from leaking into Node's server-render bundle,
 * while preserving the same binding values in the deployed Worker.
 */
let activeRuntimeBindings: Record<string, unknown> = {};

export function setRuntimeBindings(value: Record<string, unknown>): void {
  activeRuntimeBindings = value;
}

export function getRuntimeBinding<T>(name: string): T | undefined {
  const value = activeRuntimeBindings[name];
  return value as T | undefined;
}

export function getRuntimeEnvironment(): RuntimeEnvironment {
  const environment: RuntimeEnvironment = {};
  if (typeof process !== "undefined" && process.env) {
    for (const name of RUNTIME_ENVIRONMENT_KEYS) {
      const value = process.env[name];
      if (typeof value === "string") environment[name] = value;
    }
  }
  for (const name of RUNTIME_ENVIRONMENT_KEYS) {
    try {
      const value = activeRuntimeBindings[name];
      if (typeof value === "string") environment[name] = value;
    } catch {
      // An unbound optional secret must remain unavailable, never fatal.
    }
  }
  return environment;
}
