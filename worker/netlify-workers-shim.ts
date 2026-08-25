/**
 * Build-time/runtime compatibility shim for the Netlify Nitro target.
 *
 * Cloudflare's `cloudflare:workers` module is supplied by the native Sites
 * runtime. Netlify does not provide that binding, so workspace APIs must not
 * silently pretend that D1 exists. The product helpers throw their explicit
 * "D1 is not configured" error when a protected data route is called.
 */
export const env: { DB?: never } = {};
