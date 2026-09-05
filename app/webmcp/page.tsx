import Link from "../components/NativeLink";
import { ForceDarkTheme } from "../components/ForceDarkTheme";
import { SiteShell } from "../components/SiteShell";
import { createPageMetadata } from "../components/site-metadata";
import { EXAMPLE_PROMPTS, SURFACES, SURFACE_TITLES, TOOL_DOCS } from "./tool-manifest";
import { WebMcpStatusPanel } from "./WebMcpStatusPanel";
import styles from "./webmcp.module.css";

export const metadata = createPageMetadata({
  title: "WebMCP — tools this page hands to your agent",
  description: "Clunk's pages register WebMCP tools in the browser, so a person and their agent use the same screen at the same time. English first, Korean below.",
  path: "/webmcp",
});

/**
 * The manifest page.
 *
 * English first because the people evaluating this arrive in English and their agent reads
 * English; Korean second because that is the product's own language and every tool returns
 * the screen's own Korean wording alongside the English. One document, both readers.
 */
export default function WebMcpPage() {
  return (
    <div className="cv5 cv5-surface">
      <ForceDarkTheme />
      <SiteShell active="agents">
        <main className={styles.page}>
          <section className={styles.hero}>
            <span className={styles.eyebrow}>WebMCP · in-page tools</span>
            <h1>A person and their agent<br />using one screen.</h1>
            <p>
              Normally an agent talks to a server the person cannot see. These pages hand the agent
              tools of their own, so when the agent pulls the lever the machine the human is watching
              actually turns, and when it flips the model to wireframe the model in front of them
              changes. Every number a tool returns was measured by the asset pipeline and is served
              by the same API the page reads — nothing is estimated, and a figure that was never
              measured comes back as <code>null</code> rather than as a guess.
            </p>
            <p className={styles.ko}>
              보통 에이전트는 사람이 보는 화면과 다른 곳(서버)에 말을 겁니다. 이 사이트는 화면 자신이
              도구를 내줍니다. 에이전트가 마켓을 걸러 보면 사람이 보고 있던 그 목록이 그대로 바뀌고, 모델을
              선으로 바꾸면 사람이 보던 모델이 그 자리에서 바뀝니다. 도구가 돌려주는 숫자는 전부
              파일에서 직접 측정한 값입니다.
            </p>
          </section>

          <WebMcpStatusPanel />

          <section className={styles.section} id="how-to-test">
            <h2>How to test this</h2>
            <ol className={styles.steps}>
              <li>
                <b>Chrome 149 or newer</b> — open <code>chrome://flags/#enable-webmcp-testing</code>,
                enable it, restart the browser, then reload this page. The status panel above will
                name the tools that registered.
              </li>
              <li>
                <b>The ChatGPT in-app browser</b> — open this address inside ChatGPT and the model
                in that conversation can call these tools directly.
              </li>
              <li>
                <b>Neither?</b> Every page still works exactly as before. The tools simply do not
                register; nothing breaks and nothing is logged at the visitor.
              </li>
            </ol>

            <h3 className={styles.subhead}>Without signing in</h3>
            <p>
              Search the catalogue, read any asset&apos;s measured facts, navigate the site, and drive
              the 3D bench on any product page — wireframe, background, grid, shadows,
              auto-rotate, motion clips, and the ±30° part test. Asking for the file itself returns
              the sign-up address instead of a download.
            </p>
            <h3 className={styles.subhead}>After signing in</h3>
            <p>
              Four more tools open on two surfaces: the studio (list templates, create through the
              screen&apos;s own create flow, list what you made) and the inspector (inspect a GLB from a
              URL in the browser tab). An agent never signs anyone in; the human does that themselves
              at <Link href="/signup">/signup</Link>.
            </p>

            <h3 className={styles.subhead}>Prompts to try</h3>
            <ul className={styles.prompts}>
              {EXAMPLE_PROMPTS.map((prompt) => (
                <li key={prompt.en}>
                  <span>{prompt.en}</span>
                  <small className={styles.ko}>{prompt.ko}</small>
                </li>
              ))}
            </ul>

            <p className={styles.foot}>
              Tools are registered with <code>navigator.modelContext.registerTool()</code>, falling
              back to <code>document.modelContext</code>, which is what the specification&apos;s own
              text uses. The server-side path (<Link href="/agents">MCP over HTTP</Link>) still exists
              and is separate: it does not move this screen.
            </p>
          </section>

          {SURFACES.map((surface) => {
            const rows = TOOL_DOCS.filter((doc) => doc.surface === surface);
            if (rows.length === 0) return null;
            return (
              <section key={surface} className={styles.group}>
                <div className={styles.groupHead}>
                  <h3>{SURFACE_TITLES[surface].en}</h3>
                  <small className={styles.ko}>{SURFACE_TITLES[surface].ko}</small>
                </div>
                <ul className={styles.tools}>
                  {rows.map((doc) => (
                    <li key={doc.name} className={styles.tool}>
                      <div className={styles.toolHead}>
                        <code>{doc.name}</code>
                        <span className={styles.badge}>{doc.page}</span>
                        {doc.signedIn ? <span className={styles.badge}>sign-in required</span> : null}
                      </div>
                      <p>{doc.purpose.en}</p>
                      <p className={styles.ko}>{doc.purpose.ko}</p>
                      <dl>
                        <dt>Input</dt>
                        <dd>
                          {doc.inputs.length === 0 ? (
                            "none"
                          ) : (
                            <span className={styles.inputs}>
                              {doc.inputs.map((input) => (
                                <span key={input.name} title={input.note.en}>{input.name}</span>
                              ))}
                            </span>
                          )}
                        </dd>
                        <dt>Returns</dt>
                        <dd>
                          {doc.returns.en}
                          <br />
                          <span className={styles.ko}>{doc.returns.ko}</span>
                        </dd>
                      </dl>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          <section className={styles.section}>
            <h2>The lines this does not cross</h2>
            <p className={styles.foot}>
              An agent never signs in for the human: signed out, a claim returns the sign-up URL, not
              a file. A tool never invents a number: a field the pipeline could not measure is absent
              or null, never filled with a dash. Every tool result is plain JSON — no DOM nodes, no
              undefined — and a failure comes back as <code>{"{ ok: false, error }"}</code> instead of
              throwing. And a file passing structural inspection is not the same as a frame passing in
              a shipped game; that boundary is written out on the{" "}
              <Link href="/agents">agent connection</Link> page and repeated inside the tool results.
            </p>
            <p className={styles.foot}>
              로그인은 사람이 직접 합니다. 도구가 돌려주는 값은 전부 이 사이트가 측정한 것이고,
              재지 못한 항목은 결과에서 빠집니다. 파일 검사는 규격을 봅니다 — 게임 화면에서
              어떻게 보이는지는 엔진에서 찍은 최신 화면이 말해 줍니다.
            </p>
          </section>
        </main>
      </SiteShell>
    </div>
  );
}
