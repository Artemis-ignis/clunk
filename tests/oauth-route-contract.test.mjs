import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = async (path) => readFile(new URL(path, root), "utf8");

test("OAuth start and callback routes exist and fail closed around provider configuration", async () => {
  await access(new URL("app/api/auth/[provider]/route.ts", root));
  await access(new URL("app/api/auth/[provider]/callback/route.ts", root));
  const start = await source("app/api/auth/[provider]/route.ts");
  const callback = await source("app/api/auth/[provider]/callback/route.ts");
  assert.match(start, /createOAuthAuthorization/);
  assert.match(start, /encodeOAuthTransaction/);
  assert.match(start, /CONFIG_REQUIRED/);
  assert.match(start, /return_to/);
  assert.match(callback, /verifyOAuthState/);
  assert.match(callback, /exchangeOAuthCode/);
  assert.match(callback, /encodeOAuthSession/);
  assert.match(callback, /HttpOnly/);
  assert.match(callback, /SameSite=Lax/);
  assert.match(callback, /auth_error/);
  assert.match(callback, /state/);
  assert.match(callback, /code/);
});

test("the signed session outranks host identity headers, which stay behind a trust flag", async () => {
  const auth = await source("app/auth.ts");
  const sitesHeaderIndex = auth.indexOf("oai-authenticated-user-id");
  const sessionCookieIndex = auth.indexOf("const session =");
  const headerReadIndex = auth.indexOf("readUpstreamIdentityUser()");
  assert.ok(sitesHeaderIndex >= 0);
  assert.ok(sessionCookieIndex >= 0);
  assert.ok(headerReadIndex >= 0);

  // A forged `oai-authenticated-*` header must never displace a verified
  // session, so the cookie is resolved first inside getCurrentUser().
  const resolver = auth.slice(
    auth.indexOf("export async function getCurrentUser"),
    auth.indexOf("async function readSignedSessionUser"),
  );
  assert.ok(resolver.length > 0);
  assert.ok(resolver.indexOf("readSignedSessionUser") < resolver.indexOf("readUpstreamIdentityUser"));
  assert.match(resolver, /trustsUpstreamIdentityHeaders\(environment\)/);

  assert.match(auth, /providerAccountId/);
  assert.match(auth, /decodeOAuthSession/);
});

test("login entry points expose only configured external providers and explain unavailable configuration", async () => {
  const card = await source("app/components/AuthEntryCard.tsx");
  assert.match(card, /getOAuthProviderStatus/);
  assert.match(card, /Google/);
  assert.match(card, /GitHub/);
  assert.match(card, /CONFIG_REQUIRED|운영 설정/);
  assert.match(card, /chatGPTSignInPath/);
});
