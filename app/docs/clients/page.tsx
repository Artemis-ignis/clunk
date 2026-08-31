import Link from "../../components/NativeLink";
import { Icon } from "../../components/Icon";
import { createPageMetadata } from "../../components/site-metadata";
import { DocsPageFrame } from "../DocsPageFrame";
import { docsRoute } from "../docs-nav";

const route = docsRoute("clients");

export const metadata = createPageMetadata({
  title: `${route.title} · 문서`,
  description: route.summary,
  path: route.href,
});

/** Was section 02 (#clients) of the single-page docs. Rows are unchanged. */
const CLIENT_ROUTES = [
  {
    client: "CLAUDE CODE",
    shape: "CLI 등록",
    code: "claude mcp add --transport http",
    detail: "HTTPS endpoint와 Bearer 헤더를 한 명령으로 등록합니다.",
  },
  {
    client: "CODEX",
    shape: "환경변수 분리",
    code: "codex mcp add --bearer-token-env-var",
    detail: "키를 환경변수로 보관하고 설정은 JSON으로 확인합니다.",
  },
  {
    client: "CURSOR · DESKTOP",
    shape: "mcpServers JSON",
    code: ".cursor/mcp.json",
    detail: "프로젝트 또는 앱 설정 파일에 원격 서버 블록을 넣습니다.",
  },
  {
    client: "VS CODE · COPILOT",
    shape: "servers / CLI",
    code: "servers · copilot mcp add",
    detail: "VS Code는 servers 키, Copilot은 등록 명령을 사용합니다.",
  },
] as const;

export default function DocsClientsPage() {
  return (
    <DocsPageFrame id="clients">
      <section className="dv5-section">
        <h2>클라이언트별 설정 모양</h2>
        <div className="dv5-cards">
          {CLIENT_ROUTES.map((item) => (
            <article className="dv5-card" key={item.client}>
              <span>{item.client}</span>
              <strong>{item.shape}</strong>
              <code>{item.code}</code>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
        <Link className="dv5-text-link" href="/agents#connect">
          완성된 설정 블록 열기 <Icon name="arrowUpRight" size={15} />
        </Link>
      </section>
    </DocsPageFrame>
  );
}
