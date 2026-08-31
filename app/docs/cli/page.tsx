import { CodeBlock } from "../../components/CodeBlock";
import { createPageMetadata } from "../../components/site-metadata";
import { SPRITE_SHEET_REVIEW_CONTRACT, TEXTURE_AUDIT_CONTRACT } from "../../components/product-facts";
import { DocsPageFrame } from "../DocsPageFrame";
import { AUDIT_COMMANDS, BUNDLE_EXAMPLE, CLI_COMMANDS, SPRITE_SHEET_COMMANDS } from "../docs-content";
import { docsRoute } from "../docs-nav";

const route = docsRoute("cli");

export const metadata = createPageMetadata({
  title: `${route.title} · 문서`,
  description: route.summary,
  path: route.href,
});

/** Was section 03 (#cli) of the single-page docs. Every command is unchanged. */
export default function DocsCliPage() {
  return (
    <DocsPageFrame id="cli">
      <section className="dv5-section">
        <h2>실행 명령</h2>
        <details className="dv5-details" open>
          <summary>
            GLB/GLTF inspect · validate · optimize <span>실행 명령 보기</span>
          </summary>
          <CodeBlock
            title="clunk-cli"
            language="bash"
            code={CLI_COMMANDS}
            caption="원본은 유지하고 output을 fresh reopen합니다."
          />
        </details>
        <details className="dv5-details">
          <summary>
            texture · portrait · evidence <span>읽기 쉬움·증거 CLI 보기</span>
          </summary>
          <CodeBlock
            title="texture + portrait + evidence"
            language="bash"
            code={AUDIT_COMMANDS}
            caption={`${TEXTURE_AUDIT_CONTRACT.schema}: 0 PASS · 2 FAIL · 4 UNAVAILABLE.`}
          />
        </details>
        <details className="dv5-details">
          <summary>
            Pixi sprite sheet review <span>RGBA rehash와 HTTP 경계 보기</span>
          </summary>
          <CodeBlock
            title="Pixi sprite sheet review"
            language="bash"
            code={SPRITE_SHEET_COMMANDS}
            caption={`${SPRITE_SHEET_REVIEW_CONTRACT.schema}: local byte rehash와 HTTP DECLARED_METADATA_ONLY를 분리합니다.`}
          />
        </details>
        <details className="dv5-details">
          <summary>
            Atlas · PNG · Spine bundle <span>멀티파일 manifest 보기</span>
          </summary>
          <CodeBlock
            title="multi-file AssetOps bundle"
            language="json"
            code={BUNDLE_EXAMPLE}
            caption="entryFileName·fileCount·역할·relatesTo를 보존합니다."
          />
        </details>
      </section>
    </DocsPageFrame>
  );
}
