import assert from "node:assert/strict";
import test from "node:test";
import {
  createOAuthAuthorization,
  decodeOAuthSession,
  decodeOAuthTransaction,
  encodeOAuthSession,
  encodeOAuthTransaction,
  exchangeOAuthCode,
  getOAuthProviderStatus,
  verifyOAuthState,
  type OAuthAuthorization,
  type OAuthEnvironment,
} from "../app/oauth";

const NOW = 1_700_000_000_000;
const ENV: OAuthEnvironment = {
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  GOOGLE_REDIRECT_URI: "https://clunk.example.com/api/auth/google/callback",
  GITHUB_CLIENT_ID: "github-client-id",
  GITHUB_CLIENT_SECRET: "github-client-secret",
  GITHUB_REDIRECT_URI: "https://clunk.example.com/api/auth/github/callback",
  CLUNK_OAUTH_STATE_SECRET: "state-secret-for-contract-tests",
  CLUNK_AUTH_SESSION_SECRET: "session-secret-for-contract-tests",
};

function deterministicRandom(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (index * 17 + 11) % 256);
}

test("OAuth authorization uses signed state, nonce, and S256 PKCE without leaking secrets", async () => {
  const authorization = await createOAuthAuthorization("google", {
    returnTo: "/studio?from=login",
    env: ENV,
    now: NOW,
    randomBytes: deterministicRandom,
  });

  assert.match(authorization.url, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
  assert.match(authorization.url, /response_type=code/);
  assert.match(authorization.url, /code_challenge_method=S256/);
  assert.doesNotMatch(authorization.url, /google-client-secret/);
  assert.notEqual(authorization.state, authorization.nonce);
  assert.ok(authorization.codeVerifier.length >= 43);

  const query = new URL(authorization.url).searchParams;
  assert.equal(query.get("state"), authorization.state);
  assert.equal(query.get("nonce"), authorization.nonce);
  assert.equal(query.get("redirect_uri"), ENV.GOOGLE_REDIRECT_URI);

  const verified = await verifyOAuthState(
    authorization.state,
    ENV.CLUNK_OAUTH_STATE_SECRET!,
    NOW,
  );
  assert.deepEqual(verified, {
    provider: "google",
    returnTo: "/studio?from=login",
    nonce: authorization.nonce,
  });
});

test("OAuth state and transaction tokens reject tampering, expiry, and unsafe return paths", async () => {
  const authorization = await createOAuthAuthorization("github", {
    returnTo: "https://attacker.example/steal",
    env: ENV,
    now: NOW,
    randomBytes: deterministicRandom,
  });
  const transaction = await encodeOAuthTransaction(authorization, ENV.CLUNK_OAUTH_STATE_SECRET!, NOW);

  assert.equal((await verifyOAuthState(authorization.state, ENV.CLUNK_OAUTH_STATE_SECRET!, NOW)).returnTo, "/");
  assert.equal((await decodeOAuthTransaction(transaction, ENV.CLUNK_OAUTH_STATE_SECRET!, NOW)).returnTo, "/");
  await assert.rejects(() => verifyOAuthState(`${authorization.state}tampered`, ENV.CLUNK_OAUTH_STATE_SECRET!, NOW));
  await assert.rejects(() => verifyOAuthState(authorization.state, ENV.CLUNK_OAUTH_STATE_SECRET!, NOW + 11 * 60 * 1000));
  await assert.rejects(() => decodeOAuthTransaction(transaction, ENV.CLUNK_OAUTH_STATE_SECRET!, NOW + 11 * 60 * 1000));
});

test("Google and GitHub exchange normalize verified provider profiles", async () => {
  const googleCalls: Request[] = [];
  const googleFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    googleCalls.push(request);
    if (request.url.includes("oauth2.googleapis.com/token")) {
      const body = await request.text();
      assert.match(body, /code_verifier=verifier/);
      assert.match(body, /client_secret=google-client-secret/);
      return Response.json({ access_token: "google-access-token" });
    }
    assert.equal(request.url, "https://openidconnect.googleapis.com/v1/userinfo");
    assert.equal(request.headers.get("authorization"), "Bearer google-access-token");
    return Response.json({ sub: "google-subject", email: "MASTER@EXAMPLE.COM", email_verified: true, name: "Master Google" });
  };
  const google = await exchangeOAuthCode(
    "google",
    "google-code",
    ENV.GOOGLE_REDIRECT_URI!,
    "verifier",
    googleFetch,
    ENV,
  );
  assert.equal(google.id, "google:google-subject");
  assert.equal(google.providerAccountId, "google-subject");
  assert.equal(google.email, "master@example.com");
  assert.equal(google.displayName, "Master Google");
  assert.equal(google.provider, "google");
  assert.equal(googleCalls.length, 2);

  const githubFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    if (request.url.includes("github.com/login/oauth/access_token")) {
      assert.match(await request.text(), /client_secret=github-client-secret/);
      return Response.json({ access_token: "github-access-token" });
    }
    if (request.url === "https://api.github.com/user") {
      return Response.json({ id: 31415, login: "master", name: "Master GitHub", email: null });
    }
    assert.equal(request.url, "https://api.github.com/user/emails");
    return Response.json([{ email: "master@github.example", primary: true, verified: true }]);
  };
  const github = await exchangeOAuthCode(
    "github",
    "github-code",
    ENV.GITHUB_REDIRECT_URI!,
    "verifier",
    githubFetch,
    ENV,
  );
  assert.equal(github.id, "github:31415");
  assert.equal(github.providerAccountId, "31415");
  assert.equal(github.email, "master@github.example");
  assert.equal(github.displayName, "Master GitHub");
  assert.equal(github.provider, "github");
});

test("missing OAuth configuration is explicit and cannot produce an authorization URL", async () => {
  const status = getOAuthProviderStatus("google", { GOOGLE_CLIENT_ID: "only-client" });
  assert.equal(status.configured, false);
  assert.ok(status.missing.includes("GOOGLE_CLIENT_SECRET"));
  assert.ok(status.missing.includes("GOOGLE_REDIRECT_URI"));
  await assert.rejects(() => createOAuthAuthorization("google", { env: { GOOGLE_CLIENT_ID: "only-client" }, now: NOW }));
});

test("local OAuth sessions are signed, provider-scoped, and expire", async () => {
  const profile = {
    id: "github:31415",
    providerAccountId: "31415",
    provider: "github" as const,
    displayName: "Master GitHub",
    fullName: "Master GitHub",
    email: "master@github.example",
  };
  const token = await encodeOAuthSession(profile, ENV.CLUNK_AUTH_SESSION_SECRET!, NOW);
  const decoded = await decodeOAuthSession(token, ENV.CLUNK_AUTH_SESSION_SECRET!, NOW);
  assert.deepEqual(decoded, profile);
  assert.equal(await decodeOAuthSession(`${token}tampered`, ENV.CLUNK_AUTH_SESSION_SECRET!, NOW), null);
  assert.equal(await decodeOAuthSession(token, ENV.CLUNK_AUTH_SESSION_SECRET!, NOW + 31 * 24 * 60 * 60 * 1000), null);
});

void (null as unknown as OAuthAuthorization);
