import Link from "../components/NativeLink";
import { ForceDarkTheme } from "../components/ForceDarkTheme";
import { SiteShell } from "../components/SiteShell";
import { createPageMetadata } from "../components/site-metadata";
import "./portfolio-v5.css";

/**
 * /portfolio — 한 장짜리 사업개발 지원용 기록.
 *
 * docs/portfolio/clunk.ko.md 와 같은 내용을 같은 순서로 담습니다. 링크 하나로 보낼 수
 * 있어야 해서 웹에도 둡니다. 여기 있는 숫자는 전부 잰 값이고, 재는 방법은 문서 부록 A에
 * 있습니다. 재지 않은 것(사용자 수·매출)은 없다고 적습니다.
 *
 * 이 파일은 공용 컴포넌트를 고치지 않습니다. 껍데기는 다른 페이지와 같은 SiteShell,
 * 색은 cv5 토큰, 이 페이지만의 규칙은 portfolio-v5.css 의 .pf- 접두사 안에만 있습니다.
 */

export const metadata = createPageMetadata({
  title: "포트폴리오 — Clunk를 어떻게 만들고 검증했나",
  description:
    "박준성이 혼자 기획·개발·운영한 게임 에셋 서비스 Clunk의 기록. 시장에서 본 문제, 판매 에셋 30건 전수 감사, 사이트 문구 102개 대조, 1인 운영 방식과 비용 설계.",
  path: "/portfolio",
});

const FIGURES: { value: string; label: string; zero?: boolean }[] = [
  { value: "24건", label: "라이브 마켓 공개 상품 (파생 포함 31건)" },
  { value: "17가지", label: "GLB 검사 규칙 · 엔진 프로파일 8종" },
  { value: "23개", label: "브라우저 안에서 에이전트가 부르는 WebMCP 도구" },
  { value: "30건", label: "전수 감사한 판매 에셋 — 8건은 내리기로 판정" },
  { value: "102개", label: "코드와 대조한 사이트 문구 — 22개가 틀림" },
  { value: "271커밋", label: "2026-08-21 → 09-03, 14일, 1인" },
  { value: "0원", label: "매출 · 유료 고객 (결제 기능을 잠가 뒀습니다)", zero: true },
  { value: "0원", label: "인프라 지출 — 쓴 돈은 도메인뿐", zero: true },
];

const SURFACES: { name: string; href: string; job: string; real: React.ReactNode }[] = [
  {
    name: "에셋 마켓",
    href: "https://clunk.games/marketplace",
    job: "게임에 바로 넣는 3D 모델·2D 텍스처를 고르고 받는 곳",
    real: (
      <>
        공개 상품 <b>24건</b>. 상품마다 폴리곤 수·재질 수·실제 크기(m)·용량을{" "}
        <b>파일에서 잰 값</b>으로 표기합니다.
      </>
    ),
  },
  {
    name: "에셋 검사",
    href: "https://clunk.games/app",
    job: "GLB·glTF를 올리면 게임에 넣어도 되는지 판정",
    real: (
      <>
        <b>17가지 규칙</b>을 6개 범주로 검사하고 Game-Ready 점수를 냅니다. 검사는{" "}
        <b>브라우저 안에서</b> 파일 바이트를 직접 읽어 돌고, 파일은 서버로 올라가지 않습니다.
      </>
    ),
  },
  {
    name: "에셋 제작",
    href: "https://clunk.games/studio",
    job: "2D 이미지와 3D 모델을 만드는 곳",
    real: (
      <>
        2D는 Cloudflare Workers AI(<code>flux-1-schnell</code>), 3D는{" "}
        <b>코드로 짜 둔 템플릿 21종 × 색조합 6종</b>을 요청한 크기로 다시 구워 GLB로 냅니다.
        결과에는 &quot;코드 템플릿 조립 · AI 아님&quot;이 붙습니다.
      </>
    ),
  },
  {
    name: "AI 도구 연결",
    href: "https://clunk.games/agents",
    job: "Claude Code·Cursor·Codex 같은 도구에 Clunk를 붙임",
    real: <>원격 MCP 도구 7개, 로컬 stdio 도구 7개. 클라이언트 7종의 설정을 화면에서 만들어 줍니다.</>,
  },
  {
    name: "브라우저 WebMCP",
    href: "https://clunk.games/webmcp",
    job: "사람이 보는 그 화면을 AI 에이전트도 같이 조작",
    real: (
      <>
        페이지 안에 <b>도구 23개</b>를 등록합니다. 그중 4개만 로그인이 필요합니다.
      </>
    ),
  },
];

const EVIDENCE: { label: string; value: string; how: React.ReactNode }[] = [
  { label: "공개 상품", value: "24건 (파생 포함 31건, 전부 PUBLISHED)", how: <code>curl https://clunk.games/api/marketplace</code> },
  { label: "검사 규칙", value: "17가지 / 6개 범주 / 자동 수리 4종", how: <code>app/components/product-facts.ts</code> },
  { label: "엔진 프로파일", value: "8종 — Unity, Godot 4, Unreal, three.js, PixiJS 2D, 모바일 웹, Android, iOS", how: <code>packages/core/src/assetops-profiles.ts</code> },
  { label: "WebMCP 도구", value: "23개 (비로그인 19 · 로그인 필요 4)", how: <code>app/webmcp/tool-manifest.ts</code> },
  { label: "MCP 도구", value: "원격 7 · 로컬 stdio 7", how: <code>app/api/_lib/mcp-http.ts</code> },
  { label: "3D 템플릿", value: "21종 × 색조합 6종", how: <code>scripts/template-library/templates.mjs</code> },
  { label: "전수 감사한 상품", value: "30건 — 판매가 6 / 수정 16 / 내림 8", how: <code>tmp/asset-audit/README.md</code> },
  { label: "대조한 문구 주장", value: "102개 — 틀림 22 · 과장 10", how: <code>tmp/copy-audit/claims.md</code> },
  { label: "커밋", value: "271개, 2026-08-21 → 2026-09-03 (14일), 1인", how: <code>git rev-list --count HEAD</code> },
  { label: "인프라 비용", value: "Cloudflare 무료 구간 안 — 쓴 돈은 도메인뿐", how: <code>app/api/_lib/ai-budget.ts</code> },
  { label: "매출 · 유료 고객", value: "0원 · 0명 (결제 기능을 의도적으로 잠갔습니다)", how: <code>app/api/_lib/sales-lock.ts</code> },
  { label: "사용자 수", value: "내세울 수치 없음 — 유입 지표를 성과로 주장하지 않습니다", how: "—" },
];

export default function PortfolioPage() {
  return (
    <div className="cv5 cv5-surface">
      <ForceDarkTheme />
      <SiteShell>
        <main className="pf-page">
          {/* ------------------------------------------------------------ hero */}
          <section className="pf-hero">
            <span className="pf-eyebrow">포트폴리오 · 신사업개발 지원</span>
            <h1>
              만들고, 재고, 팝니다.
              <br />
              <em>재지 않은 건 팔지 않습니다.</em>
            </h1>
            <p className="pf-lead">
              AI가 게임 에셋을 아무리 많이 뽑아내도 &quot;이걸 게임에 넣어도 되는가&quot;를 판정해
              주는 곳이 없어서, 만들고(생성)·재고(검사)·파는(마켓) 세 가지를 한 사이트에 붙여
              혼자 만들어 2주 만에 실서비스로 띄웠습니다. 매출은 0원이고 사용자 수도 내세울 게
              없습니다. 대신 <b>내가 파는 물건 30건을 전부 열어 재서 8건은 내려야 한다고 스스로
              판정한 기록</b>과 <b>사이트 문구 102개를 코드와 대조해 22개가 틀렸다고 확인한
              기록</b>이 있습니다.
            </p>
            <p className="pf-byline">
              박준성 · 주식회사 아르테미스(사업자등록번호 361-02-03814) · 2026-09-03 기준
            </p>
            <div className="pf-links">
              <a className="pf-primary" href="https://clunk.games">
                라이브 제품 clunk.games
              </a>
              <a href="https://github.com/Artemis-ignis/clunk">소스 (MIT)</a>
              <Link href="/webmcp">WebMCP 도구 23개</Link>
              <a href="https://youtu.be/kS_DPMRWo68">데모 영상</a>
              <a href="https://devpost.com/software/clunk-x16w5o">WebMCP Challenge 출품</a>
            </div>
          </section>

          <section className="pf-figures" aria-label="핵심 숫자">
            {FIGURES.map((figure) => (
              <div key={figure.label} className={figure.zero ? "pf-zero" : undefined}>
                <b>{figure.value}</b>
                <span>{figure.label}</span>
              </div>
            ))}
          </section>

          {/* --------------------------------------------------- what I built */}
          <section className="pf-section">
            <span className="pf-eyebrow">01 — 무엇을 만들었나</span>
            <h2>지금 로그인 없이 확인할 수 있는 것들</h2>
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th scope="col">화면</th>
                    <th scope="col">하는 일</th>
                    <th scope="col">지금 실제로 되는 것</th>
                  </tr>
                </thead>
                <tbody>
                  {SURFACES.map((surface) => (
                    <tr key={surface.name}>
                      <th scope="row">
                        <a href={surface.href}>{surface.name}</a>
                      </th>
                      <td>{surface.job}</td>
                      <td>{surface.real}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="pf-note">
              특히 WebMCP — 보통 AI 에이전트는 사람이 보는 화면이 아니라 뒤쪽 서버에 말을 겁니다.
              Clunk는 화면 자신이 도구를 내줍니다. 에이전트가 카탈로그를 검색하면 사람이 보던
              목록이 바뀌고, 3D 모델을 와이어프레임으로 바꾸면 눈앞의 모델이 그 자리에서 바뀝니다.
              도구가 돌려주는 숫자는 전부 파일에서 잰 값이고, 재지 않은 값은 추측하지 않고{" "}
              <code>null</code>로 돌려줍니다.
            </p>
          </section>

          {/* ------------------------------------------------------------ why */}
          <section className="pf-section">
            <span className="pf-eyebrow">02 — 왜 만들었나</span>
            <h2>시장에서 본 문제 세 가지</h2>
            <div className="pf-cards">
              <article className="pf-card">
                <span className="pf-num">문제 1</span>
                <h3>생성은 넘치고 판정은 없다</h3>
                <p>
                  Meshy 같은 생성 도구는 검증 기능이 있어도 <b>3D 프린팅 기준</b>(워터타이트·
                  매니폴드)입니다. &quot;손에 쥘 수 있는가&quot;는 봐 주지만{" "}
                  <b>&quot;엔진에서 60프레임이 나오는가&quot;</b>는 아무도 안 봅니다. 제 마켓의
                  파종기는 프린팅 기준으로 멀쩡하지만 씬에 올리면 드로우콜 410개가 발생합니다.
                </p>
              </article>
              <article className="pf-card">
                <span className="pf-num">문제 2</span>
                <h3>파는 사람도 안 재고 판다</h3>
                <p>
                  상점에 적힌 폴리곤 수는 고유 지오메트리 합계인데, 씬에 배치하면 인스턴스 수만큼
                  곱해집니다. 제 트랙터는 32,300으로 적혀 있었지만 실제로는 56,056, 파종기는
                  10,880 → <b>51,602(4.74배)</b>. 사는 사람은 이 차이를 알 방법이 없습니다.
                </p>
              </article>
              <article className="pf-card">
                <span className="pf-num">문제 3</span>
                <h3>에이전트가 쇼핑하는 시대</h3>
                <p>
                  Meshy조차 MCP로 에이전트에 붙습니다. 앞으로 에셋을 고르는 주체는 사람이 아니라
                  사람의 에이전트일 가능성이 높습니다. 경쟁 제품이 서버 API만 열 때, 사람이 보는
                  화면 자체를 에이전트에 여는 쪽을 택했습니다.
                </p>
              </article>
            </div>
            <p className="pf-note">
              생성기가 늘어날수록 &quot;만들어진 것&quot;과 &quot;게임에 넣어도 되는 것&quot; 사이의
              간극이 커집니다. 그 간극이 시장입니다. Clunk는 생성기와 경쟁하지 않고, 어디서
              만들었든 게임에 들어가기 전 마지막 관문 자리에 섭니다.
            </p>
          </section>

          {/* ------------------------------------------------------- verified */}
          <section className="pf-section">
            <span className="pf-eyebrow">03 — 어떻게 검증했나</span>
            <h2>팔던 물건을 전부 뜯어봤습니다</h2>
            <p>
              라이브 카탈로그의 PUBLISHED 30건 전부를 헤드리스 크롬 + 실제 WebGL로 렌더링하고,
              파일 바이트를 직접 파싱해 측정했습니다. 상품마다 8종 뷰(정면·측면·후면·상면·
              와이어프레임·단면·노멀·클레이) 컨택트 시트를 뽑고, 표기 삼각형 대비 실제 렌더링
              삼각형, 드로우콜, 동일평면 겹침 면적, 움직이는 부품의 최소 표면거리(24위상),
              클립별 실제 정점 이동량, 스프라이트 프레임 지터, 텍스처 이음매 비율을 쟀습니다.
            </p>
            <div className="pf-verdicts">
              <span className="pf-good">
                <b>6</b>그대로 팔아도 됨
              </span>
              <span className="pf-warn">
                <b>16</b>고치면 팔 수 있음
              </span>
              <span className="pf-bad">
                <b>8</b>내려야 함
              </span>
            </div>
            <ul className="pf-list">
              <li>
                <b>상점 뷰어가 캐릭터의 뒤통수를 먼저 보여준다.</b> 저장소에는 정면 방향이 이미
                기록돼 있었는데 뷰어의 초기 카메라가 그 값을 안 읽었습니다.
              </li>
              <li>
                <b>트랙터 앞바퀴가 보닛을 뚫고 있다.</b> 트레드 ↔ 보닛 최소 표면거리 0.0 mm,
                24위상 전부.
              </li>
              <li>
                <b>&quot;작동&quot; 애니메이션이 작동을 안 보여준다.</b> 경운기 work 1.627초
                8프레임이 육안으로 동일. 농부 idle은 8.976초 동안 최대 이동량 27.9 mm.
              </li>
              <li>
                <b>스케일이 서로 안 맞는다.</b> 농부 키 2.4992 m vs 마켓 스톨 높이 2.2563 m —
                자기 가게보다 큰 농부.
              </li>
              <li>
                <b>&quot;검증된 이어붙는 텍스처&quot; 번들에 이어붙지 않는 텍스처가 있다.</b> 나무
                판자의 좌우 이음매가 타일 내부 대비 ×2.75 — 눈에 보이는 세로 줄.
              </li>
            </ul>
            <p className="pf-note">
              감사 보고서에는 <b>&quot;실패·한계&quot;</b> 절을 따로 뒀습니다. 겹침 검사 도구가
              인스턴스 행렬을 반영하지 않아 트랙터 수치 대부분이 <b>도구의 허상</b>이라는 것,
              최소거리 도구가 의도된 접합부까지 0 mm로 보고한다는 것, 유료 파일의 실제 다운로드
              바이트는 401이라 못 받아 저장소 원본과 API 표기 용량이 30/30 일치하는 것으로
              대신했다는 것을 전부 적었습니다. 숫자를 유리하게 쓰지 않기 위해서입니다.
            </p>

            <h3>같은 방식으로 사이트 문구도 감사했습니다</h3>
            <p>
              제품 화면과 문서의 주장 102개를 하나씩 코드·라이브 API와 대조했습니다 — 맞음 61,{" "}
              <b>틀림 22</b>, 과장 10, 용어 불일치 6, 확인 불가 3.
            </p>
            <ul className="pf-list">
              <li>
                랜딩이 &quot;한 줄이면 GLB가 나옵니다&quot;라고 했는데, 실제로는 템플릿을 지정하지
                않은 요청을 400으로 거절합니다.
              </li>
              <li>연결 가능한 AI 도구로 9종을 나열했는데 설정을 실제로 만들어 주는 건 7종이었습니다.</li>
              <li>
                문서가 WebMCP를 &quot;읽기 전용&quot;이라고 적어 뒀는데 실제 도구에는 크레딧을 쓰는{" "}
                <code>studio_create</code>가 있었습니다.
              </li>
              <li>&quot;결제 전 미리보기&quot; — 결제 기능이 없으므로 그 시점이 존재하지 않습니다.</li>
            </ul>
            <p className="pf-note">
              이 두 감사가 제가 일하는 방식입니다. 기능을 더 붙이는 대신, 이미 내놓은 것이 사실인지
              먼저 재고, 아니면 내리거나 고칩니다.
            </p>
          </section>

          {/* ----------------------------------------------------- what runs */}
          <section className="pf-section">
            <span className="pf-eyebrow">04 — 실제로 돌아가는 것</span>
            <h2>숫자와, 그 숫자를 확인하는 법</h2>
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th scope="col">항목</th>
                    <th scope="col">값</th>
                    <th scope="col">확인 방법</th>
                  </tr>
                </thead>
                <tbody>
                  {EVIDENCE.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td>{row.value}</td>
                      <td>{row.how}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>매출이 0인 이유를 숨기지 않는 쪽을 택했습니다</h3>
            <p>
              결제는 &quot;아직 못 붙인&quot; 게 아니라 코드로 잠가 둔 것이고, 잠긴 동안 로그인한
              사람에게는 모든 에셋을 무료로 내줍니다. 이유는 돈 계산입니다. 국내 PG는 매출이 0이어도
              선불 비용이 듭니다(가입비 22만 원 + 연 11만 원). Merchant of Record는 5% + 50¢로{" "}
              <b>매출이 0이면 비용도 0</b>입니다. 통신판매업 신고도 직전년도 거래 50회 미만이거나
              간이과세자면 면제됩니다. 그래서 순서를 <b>① 지금: 무료로 열고 사용자부터 →
              ② 첫 유료: MoR로 시작(고정비 0) → ③ 거래가 쌓이면 신고와 국내 PG</b>로 잡았습니다.
            </p>
          </section>

          {/* ------------------------------------------------------ solo ops */}
          <section className="pf-section">
            <span className="pf-eyebrow">05 — 혼자서 어떻게 굴렸나</span>
            <h2>AI를 보조가 아니라 인력으로 썼습니다</h2>
            <p>
              혼자 14일에 271커밋이 나온 이유입니다. 제가 하는 일은 코드를 치는 게 아니라 문제를
              정의하고, 병렬로 나눠 시키고, 결과를 검수하는 것입니다.
            </p>
            <div className="pf-cards">
              <article className="pf-card">
                <span className="pf-num">정의</span>
                <p>
                  &quot;농부 모델이 이상하다&quot; 같은 감상 대신 &quot;8방향에서 렌더해 실루엣을
                  비교하고, 클립별 정점 이동량이 몇 mm인지 재라&quot;처럼{" "}
                  <b>합격/불합격이 숫자로 갈리는 형태</b>로 바꿔서 넘깁니다. 그래야 결과가
                  &quot;했습니다&quot;가 아니라 &quot;27.9 mm&quot;로 돌아옵니다.
                </p>
              </article>
              <article className="pf-card">
                <span className="pf-num">병렬</span>
                <p>
                  서로 안 겹치는 작업(에셋 수리 / 문구 감사 / 랜딩 / 포트폴리오)을 동시에 다른
                  에이전트에 맡기되, <b>파일 소유권을 미리 나눠</b> 충돌을 없앱니다. 이 페이지를 만든
                  작업도 &quot;이 경로만 건드리고 공용 파일은 손대지 말 것&quot;이라는 경계를 받고
                  시작했습니다.
                </p>
              </article>
              <article className="pf-card">
                <span className="pf-num">검수</span>
                <p>
                  완료 보고를 그대로 믿지 않습니다. 한 번 &quot;배포 완료&quot;만 믿었다가 화면이
                  깨진 채로 나간 적이 있어서, 그 뒤로 <b>브라우저 풀페이지 캡처를 봐야 완료</b>로
                  칩니다. 위의 두 감사는 이 원칙을 제도로 만든 것입니다.
                </p>
              </article>
              <article className="pf-card">
                <span className="pf-num">도구</span>
                <p>
                  코딩 에이전트 외에 Playwright 헤드리스 크롬으로 시각 검증, Workers AI로 2D 생성,
                  three.js로 3D를 코드로 굽는 파이프라인, D1/R2로 저장. <b>없으면 직접 만듭니다</b> —
                  이번 감사에 쓴 측정 도구 6종은 전부 이 과정에서 새로 짰습니다.
                </p>
              </article>
            </div>

            <h3>돈을 안 쓰는 것도 설계입니다</h3>
            <p>
              전부 Cloudflare 무료 구간 위에서 돌리고, 실제로 쓴 돈은 도메인 값뿐입니다. 문제는 AI
              이미지 생성인데 실수 한 번으로 한도를 넘길 수 있습니다(실제로 파라미터 실험하다 하루치를
              오후 한나절에 태운 적이 있습니다). 그래서 한도를 희망이 아니라 <b>원장</b>으로
              만들었습니다 — 이미지 1장 <b>129.6 뉴런</b>(직접 측정), 무료 한도 하루 10,000,{" "}
              <b>자체 상한 하루 8,500(≈65장)</b>, 작업공간당 하루 8장. 상한을 넘길 호출은 크레딧을
              깎기 전에, 모델에 묻기 전에 거절하면서 언제 다시 열리는지 알려 줍니다.
            </p>

            <h3>가격은 경쟁사를 재서 정했습니다</h3>
            <p>
              Meshy·Polyfork·AetherForge 세 곳의 가격표를 화면에서 직접 확인해 표로 만들고, 크레딧
              단가 ₩29·구독 $10/월이라는 시장 기준선을 뽑았습니다. Maker 플랜 ₩9,900/월은 Polyfork
              Pro($10)와 같은 자리이자 Meshy Pro(₩28,869)의 1/3 가격에 크레딧도 1/3 —{" "}
              <b>크레딧 단가는 같게 두고 진입 문턱만 낮춘</b> 값입니다. 이 과정에서 D1에 남아 있던
              QA용 크레딧 팩(₩9.9/크레딧)이 사이트가 여섯 번 말하는 ₩100/크레딧과 모순인 걸 발견해
              폐기했습니다.
            </p>
          </section>

          {/* -------------------------------------------------- learned/next */}
          <section className="pf-section">
            <span className="pf-eyebrow">06 — 배운 것과 다음</span>
            <h2>배운 것</h2>
            <ul className="pf-list">
              <li>
                <b>&quot;만들었다&quot;와 &quot;판다&quot;는 다른 일이다.</b> 만드는 건 2주면 되지만,
                파는 물건이 사실인지 확인하는 데 하루가 더 들고 그 하루에 8건을 내려야 한다는 결론이
                나옵니다. 확인하지 않았으면 그 8건은 그대로 팔렸을 겁니다.
              </li>
              <li>
                <b>재지 않은 것은 쓰지 않는다.</b> 문구 102개 중 22개가 코드와 달랐습니다. 나쁜 의도가
                아니라 기능이 바뀌는 속도를 문구가 못 따라간 것이라, 대조를 정기 작업으로 만들었습니다.
              </li>
              <li>
                <b>한도는 마음먹는 게 아니라 코드로 막는 것이다.</b> 무료 구간을 한 번 넘겨 보고
                배웠습니다.
              </li>
              <li>
                <b>혼자 하는 일의 병목은 실행이 아니라 판단이다.</b> AI로 실행 속도는 올라갔지만,
                무엇을 만들지·무엇이 틀렸는지 정하는 건 여전히 사람 몫이고 그게 시간의 대부분입니다.
              </li>
            </ul>
            <h2>다음 (순서와 이유)</h2>
            <ul className="pf-list">
              <li>
                <b>내려야 할 8건 수리 후 재출고.</b> 감사 보고서에 상품별 수정안이 이미 적혀 있습니다.
                카탈로그를 늘리는 것보다 이게 먼저입니다.
              </li>
              <li>
                <b>3D에 텍스처를 붙이는 레일.</b> 15건 전부 텍스처가 0장인 게 카탈로그를 관통하는 단일
                최대 결함입니다.
              </li>
              <li>
                <b>첫 유료 — MoR로.</b> 고정비 0으로 시작해 거래가 쌓인 뒤 신고·PG로 넘어갑니다.
              </li>
              <li>
                <b>에이전트 유입.</b> MCP/WebMCP는 무료로 두고, 에이전트 워크플로 안에서
                &quot;생성 → 검사 → 판정&quot;의 판정 자리를 가져갑니다.
              </li>
            </ul>
          </section>

          {/* ------------------------------------------------- what I do not claim */}
          <section className="pf-honest">
            <h2>이 페이지가 주장하지 않는 것</h2>
            <ul className="pf-list">
              <li>사용자 수·다운로드 수·재방문율 — 측정하지 않았거나 내세울 수준이 아닙니다.</li>
              <li>매출·계약·파트너십 — 없습니다. 결제 기능을 의도적으로 잠가 뒀습니다.</li>
              <li>
                에셋 품질이 상용 수준이라는 주장 — 오히려 반대입니다. 30건 중 8건은 제가 직접 내려야
                한다고 판정했습니다.
              </li>
              <li>
                3D를 문장만으로 만든다는 주장 — 3D는 코드 템플릿 조립입니다. AI가 아니며 결과물에도
                그렇게 표기됩니다.
              </li>
            </ul>
          </section>

          <footer className="pf-foot">
            <span>
              같은 내용의 문서 판과 숫자 재현 명령: 저장소의{" "}
              <code>docs/portfolio/clunk.ko.md</code> · 감사 원본{" "}
              <code>tmp/asset-audit/README.md</code> · 문구 대조표{" "}
              <code>tmp/copy-audit/claims.md</code>
            </span>
            <span>
              박준성 · 주식회사 아르테미스 · <a href="https://clunk.games">clunk.games</a> ·{" "}
              <a href="https://github.com/Artemis-ignis/clunk">github.com/Artemis-ignis/clunk</a>
            </span>
          </footer>
        </main>
      </SiteShell>
    </div>
  );
}
