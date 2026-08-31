import Link from "../../components/NativeLink";
import { Icon } from "../../components/Icon";
import { createPageMetadata } from "../../components/site-metadata";
import { ASSET_KIND_COVERAGE, SURFACES, TARGET_PROFILES } from "../../components/product-facts";
import { DocsPageFrame } from "../DocsPageFrame";
import { docsRoute } from "../docs-nav";

const route = docsRoute("scope");

export const metadata = createPageMetadata({
  title: `${route.title} · 문서`,
  description: route.summary,
  path: route.href,
});

/**
 * Was section 08 (#scope) of the single-page docs. Same product facts; the
 * target profile list is now a real table so long profile ids scroll inside the
 * table instead of widening the page.
 */
export default function DocsScopePage() {
  return (
    <DocsPageFrame id="scope">
      <section className="dv5-section">
        <h2>검사 가능한 입력</h2>
        <div className="dv5-cards dv5-cards-3">
          {ASSET_KIND_COVERAGE.map((item) => (
            <article className="dv5-card" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.detail}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="dv5-section">
        <h2>Target profile</h2>
        <div className="dv5-table-wrap">
          <table className="dv5-table">
            <thead>
              <tr>
                <th scope="col">PROFILE</th>
                <th scope="col">ENGINE · PLATFORM</th>
                <th scope="col">ID</th>
              </tr>
            </thead>
            <tbody>
              {TARGET_PROFILES.map((profile) => (
                <tr key={profile.id}>
                  <td>{profile.label}</td>
                  <td>
                    {profile.engine} · {profile.platform}
                  </td>
                  <td>
                    <code>{profile.id}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          지원 surface: {SURFACES.map((surface) => surface.label).join(" · ")}. 자세한 모델·재질·Spine·애니메이션
          범위는 입력 종류별로 분리되어 반환됩니다.
        </p>
        <Link className="dv5-text-link" href="/llms.txt">
          에이전트용 요약 보기 <Icon name="arrowUpRight" size={14} />
        </Link>
      </section>
    </DocsPageFrame>
  );
}
