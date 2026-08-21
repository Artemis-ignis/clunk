// 로컬 데모 프록시: 마스터가 브라우저로 보호 페이지(/app, /dashboard, /settings)를
// 로그인 절차 없이 직접 볼 수 있도록 SIWC 헤더를 주입해 dev 서버(3000)로 전달한다.
// 로컬 시연 전용 — 배포 환경에서는 Sites 호스트가 실제 인증 후 같은 헤더를 주입한다.
import http from "node:http";

const UPSTREAM_PORT = Number(process.env.CLUNK_DEMO_UPSTREAM ?? 3000);
const PORT = Number(process.env.CLUNK_DEMO_PORT ?? 3005);
const USER = process.env.CLUNK_DEMO_USER ?? "master-demo-20260821";

const SIWC = {
  "oai-authenticated-user-id": USER,
  "oai-authenticated-user-email": `${USER}@clunk.local`,
  "oai-authenticated-user-full-name": encodeURIComponent("마스터"),
  "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
};

// 터널 등으로 외부 노출할 때의 최소 잠금: CLUNK_DEMO_TOKEN이 설정되면 ?demo_token=<값>
// 으로 처음 한 번 열어 쿠키를 심고, 이후 요청은 쿠키로 통과시킨다. 토큰 미설정 시 기존
// 로컬 동작 그대로.
const TOKEN = process.env.CLUNK_DEMO_TOKEN ?? null;

const server = http.createServer((req, res) => {
  if (TOKEN) {
    const requestUrl = new URL(req.url, "http://localhost");
    const queryToken = requestUrl.searchParams.get("demo_token");
    const cookieToken = /(?:^|;\s*)clunk_demo_token=([^;]+)/.exec(req.headers.cookie ?? "")?.[1];
    if (queryToken === TOKEN) {
      requestUrl.searchParams.delete("demo_token");
      res.writeHead(302, {
        "set-cookie": `clunk_demo_token=${TOKEN}; Path=/; HttpOnly; SameSite=Lax`,
        location: `${requestUrl.pathname}${requestUrl.search}`,
      });
      return res.end();
    }
    if (cookieToken !== TOKEN) {
      res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      return res.end("접근 토큰이 필요합니다. 전달받은 링크(?demo_token=...)로 접속하세요.");
    }
  }
  const headers = { ...req.headers, ...SIWC, host: `localhost:${UPSTREAM_PORT}` };
  // dev 서버의 same-origin 쓰기 보호(CSRF)가 3005 Origin을 거부하지 않도록 상류 원점으로 재작성한다.
  if (headers.origin) headers.origin = `http://localhost:${UPSTREAM_PORT}`;
  if (headers.referer) {
    headers.referer = String(headers.referer).replace(`localhost:${PORT}`, `localhost:${UPSTREAM_PORT}`);
  }
  const upstream = http.request(
    { host: "localhost", port: UPSTREAM_PORT, path: req.url, method: req.method, headers },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", () => {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("dev 서버(3000)가 아직 준비되지 않았습니다. 잠시 후 새로고침하세요.");
  });
  req.pipe(upstream);
});

// Loopback by default. Binding 0.0.0.0 put a logged-in /app, /dashboard and /settings —
// with whatever real data the local D1 holds — in front of anyone on the same network,
// and the token was optional. Exposing it now takes an explicit opt-in and a token.
const HOST = process.env.CLUNK_DEMO_EXPOSE === "1" ? "0.0.0.0" : "127.0.0.1";

if (HOST === "0.0.0.0" && !TOKEN) {
  console.error(
    "[demo-proxy] CLUNK_DEMO_EXPOSE=1 은 CLUNK_DEMO_TOKEN 없이 쓸 수 없습니다.",
    "토큰 없이 외부에 열면 인증된 워크스페이스가 그대로 공개됩니다.",
  );
  process.exit(1);
}

server.listen(PORT, HOST, () => {
  const scope = HOST === "0.0.0.0" ? "모든 인터페이스(토큰 필요)" : "루프백 전용";
  console.log(
    `[demo-proxy] http://localhost:${PORT} -> localhost:${UPSTREAM_PORT} (SIWC user: ${USER}, ${scope})`,
  );
});
