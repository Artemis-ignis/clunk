import { sha256Hex } from "../../../packages/core/src/index";

export const MCP_API_KEY_PREFIX = "clunk_live_" as const;

export type McpApiKeyMaterial = {
  secret: string;
  prefix: string;
  hash: string;
};

export function createMcpApiKeyMaterial(): McpApiKeyMaterial {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const secret = `${MCP_API_KEY_PREFIX}${toBase64Url(random)}`;
  return { secret, prefix: secret.slice(0, 20), hash: hashMcpApiKey(secret) };
}

export function hashMcpApiKey(secret: string): string {
  return sha256Hex(new TextEncoder().encode(secret));
}

export function isMcpApiKey(value: unknown): value is string {
  return typeof value === "string" && /^clunk_live_[A-Za-z0-9_-]{43}$/.test(value);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
