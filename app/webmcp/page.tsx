import Link from "../components/NativeLink";
import { SiteShell } from "../components/SiteShell";
import { createPageMetadata } from "../components/site-metadata";
import { EXAMPLE_PROMPTS, SURFACES, SURFACE_TITLES, TOOL_DOCS } from "./tool-manifest";
import { WebMcpStatusPanel } from "./WebMcpStatusPanel";
import styles from "./webmcp.module.css";

export const metadata = createPageMetadata({
  title: "WebMCP 도구 목록",
  description: "Clunk의 화면이 브라우저에서 직접 내주는 브라우저 도구 목록입니다. 사람과 에이전트가 같은 화면을 동시에 씁니다.",
  path: "/webmcp",
});

/**
 * The manifest page.
 *
 * 2026-09-05 점검 C2: 이 화면의 본문 9,275자가 영어였습니다. 방문자가 읽는 글은 한국어
 * 하나입니다. 에이전트가 읽는 영어는 도구 자신(tool-manifest.ts 의 `en`, 각 도구의
 * description 과 inputSchema)에 그대로 남아 있으므로 사실은 하나도 줄지 않았습니다 —
 * 이 화면은 그중 한국어 쪽만 그립니다. 도구 이름과 설정 값은 붙여 넣는 코드이므로
 * 번역하지 않습니다.
 */
export default function WebMcpPage() {
  return (
    <div className="cv5 cv5-surface">
      <SiteShell active="agents">
        <main className={styles.page}>
          <section className={styles.hero}>
            <span className={styles.eyebrow}>브라우저 도구(WebMCP)</span>
            <h1>사람과 에이전트가<br />같은 화면을 씁니다.</h1>
            <p>
              보통 에이전트는 사람이 보는 화면과 다른 곳(서버)에 말을 겁니다. 이 사이트는 화면
              자신이 도구를 내줍니다. 에이전트가 마켓을 걸러 보면 사람이 보고 있던 그 목록이
              그대로 바뀌고, 모델을 선으로 바꾸면 사람이 보던 모델이 그 자리에서 바뀝니다.
            </p>
            <p>
              도구가 돌려주는 숫자는 전부 에셋 파일에서 직접 측정한 값이고, 이 화면이 읽는 그
              자리에서 그대로 나옵니다. 어림잡은 값은 없습니다. 측정하지 못한 항목은 지어내는
              대신 값 없음(<code>null</code>)으로 돌아갑니다.
            </p>
          </section>

          <WebMcpStatusPanel />

          <section className={styles.section} id="how-to-test">
            <h2>이 화면을 시험하는 법</h2>
            <ol className={styles.steps}>
              <li>
                <b>Chrome 149 이상</b> — <code>chrome://flags/#enable-webmcp-testing</code> 를 열어
                켜고 브라우저를 다시 시작한 뒤 이 화면을 새로 고칩니다. 위 상태 칸이 걸린 도구
                이름을 적어 줍니다.
              </li>
              <li>
                <b>ChatGPT 앱 안의 브라우저</b> — ChatGPT 안에서 이 주소를 열면 그 대화의 모델이
                이 도구들을 바로 부를 수 있습니다.
              </li>
              <li>
                <b>둘 다 아니라면</b> — 모든 화면이 지금까지와 똑같이 움직입니다. 도구가 걸리지
                않을 뿐, 깨지는 것도 방문자에게 남는 기록도 없습니다.
              </li>
            </ol>

            <h3 className={styles.subhead}>로그인하지 않아도</h3>
            <p>
              마켓을 찾아보고, 에셋마다 측정된 사실을 읽고, 화면을 옮기고, 상품 화면의 3D 작업대를
              움직일 수 있습니다 — 와이어프레임, 배경, 격자, 그림자, 자동 회전, 동작 재생, 부품
              ±30° 흔들어 보기까지. 파일 자체를 달라고 하면 내려받기 대신 가입 주소가 돌아옵니다.
            </p>
            <h3 className={styles.subhead}>로그인한 뒤에</h3>
            <p>
              두 화면에서 도구 넷이 더 열립니다 — 에셋 제작(템플릿 목록, 화면의 만들기 흐름으로
              제작, 내가 만든 것 목록)과 검사(브라우저 탭에서 주소로 GLB 검사). 로그인은 에이전트가
              대신하지 않습니다. 사람이 <Link href="/signup">/signup</Link> 에서 직접 합니다.
            </p>

            <h3 className={styles.subhead}>이렇게 시켜 보세요</h3>
            <ul className={styles.prompts}>
              {EXAMPLE_PROMPTS.map((prompt) => (
                <li key={prompt.en}>
                  <span>{prompt.ko}</span>
                </li>
              ))}
            </ul>

            <p className={styles.foot}>
              도구는 <code>navigator.modelContext.registerTool()</code> 로 걸고, 그것이 없으면
              <code>document.modelContext</code> 로 겁니다 — 규격 문서가 쓰는 그대로입니다. 서버로
              연결하는 길(<Link href="/agents">AI 도구 연결</Link>)은 따로 그대로 있고, 그쪽은 이
              화면을 움직이지 않습니다.
            </p>
          </section>

          {SURFACES.map((surface) => {
            const rows = TOOL_DOCS.filter((doc) => doc.surface === surface);
            if (rows.length === 0) return null;
            return (
              <section key={surface} className={styles.group}>
                <div className={styles.groupHead}>
                  <h3>{SURFACE_TITLES[surface].ko}</h3>
                </div>
                <ul className={styles.tools}>
                  {rows.map((doc) => (
                    <li key={doc.name} className={styles.tool}>
                      <div className={styles.toolHead}>
                        <code>{doc.name}</code>
                        <span className={styles.badge}>{doc.page === "every page" ? "모든 화면" : doc.page}</span>
                        {doc.signedIn ? <span className={styles.badge}>로그인 필요</span> : null}
                      </div>
                      <p>{doc.purpose.ko}</p>
                      {/* 도구 이름과 넣는 값의 키는 에이전트가 그대로 적어야 하는 코드라 그대로 둡니다. */}
                      <dl>
                        <dt>넣는 값</dt>
                        <dd>
                          {doc.inputs.length === 0 ? (
                            "없음"
                          ) : (
                            <span className={styles.inputs}>
                              {doc.inputs.map((input) => (
                                <span key={input.name} title={input.note.ko}>{input.name}</span>
                              ))}
                            </span>
                          )}
                        </dd>
                        <dt>돌아오는 값</dt>
                        <dd>{doc.returns.ko}</dd>
                      </dl>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          <section className={styles.section}>
            <h2>넘지 않는 선</h2>
            <p className={styles.foot}>
              로그인은 사람이 직접 합니다. 로그아웃 상태에서 파일을 달라고 하면 파일 대신 가입
              주소가 돌아옵니다. 도구는 숫자를 지어내지 않습니다 — 측정하지 못한 항목은 값 없음으로
              돌아가고, 줄표로 채우지 않습니다. 돌아오는 값은 언제나 그대로 읽히는 JSON 이며,
              실패도 <code>{"{ ok: false, error }"}</code> 한 줄로 돌아옵니다.
            </p>
            <p className={styles.foot}>
              파일 검사를 통과한 것과 게임 화면에서 통과한 것은 다릅니다. 그 경계는{" "}
              <Link href="/agents">AI 도구 연결</Link> 화면에 적어 두었고, 도구가 돌려주는 결과
              안에서도 같은 말을 합니다.
            </p>
          </section>
        </main>
      </SiteShell>
    </div>
  );
}
