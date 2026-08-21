import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "../components/SiteShell";
import { COMPANY } from "../legal/company";

export const metadata: Metadata = {
  title: "지원과 현재 한계",
  description:
    "문의 경로, 응답 목표, 그리고 Clunk가 지금 하지 못하는 일을 그대로 적어 둔 페이지입니다.",
};

/**
 * A buyer's page, not a marketing one. Everything here is either a way to reach a human or a
 * limit stated before someone pays for it — the questions that decide a purchase are exactly
 * the ones a landing page tends to avoid.
 */
const CONTACT = [
  {
    title: "제품 문의·버그 신고",
    detail: "재현 방법과 사용한 파일의 sha256을 함께 적어 주시면 가장 빠릅니다. 원본 파일은 보내지 않으셔도 됩니다.",
    target: COMPANY.email,
    goal: "영업일 기준 2일 이내 1차 회신",
  },
  {
    title: "보안 취약점 신고",
    detail:
      "공개 이슈로 올리기 전에 먼저 알려주세요. 확인 즉시 수정 일정과 진행 상황을 알려드리고, 원하시면 수정 후 공개 기록에 기여자로 남깁니다.",
    target: COMPANY.email,
    goal: "영업일 기준 1일 이내 접수 확인",
  },
  {
    title: "데이터 열람·삭제 요청",
    detail:
      "로그인 상태라면 설정 화면에서 직접 내려받고 삭제할 수 있습니다. 계정에 접근할 수 없는 상황이면 메일로 요청해 주세요.",
    target: COMPANY.email,
    goal: "접수일로부터 10일 이내 처리",
  },
] as const;

const LIMITS = [
  {
    title: "유료 결제가 없습니다",
    body: "결제 제공자를 연결하지 않았습니다. 요금 화면의 금액은 예정가이며 카드가 청구되지 않습니다. 지금 쓰시는 모든 기능은 무상입니다.",
  },
  {
    title: "자체 로그인이 없습니다",
    body: "현재는 ChatGPT 계정 인증을 거친 호스트 안에서만 워크스페이스가 열립니다. 자체 도메인 로그인은 아직 제공하지 않습니다.",
  },
  {
    title: "손실 최적화를 하지 않습니다",
    body: "v1이 적용하는 작업은 허용 목록에 있는 무손실·메타데이터 정리뿐입니다. 메시 단순화, 텍스처 재인코딩(KTX2·Basis), Draco·Meshopt 압축, 애니메이션·스킨 변경은 하지 않습니다. 용량을 크게 줄이는 것이 목적이라면 지금은 맞지 않습니다.",
  },
  {
    title: "서버가 원본을 재검증하지 않습니다",
    body: "검사는 이용자의 기기에서 실행되고 서버는 결과 메타데이터만 보관합니다. 따라서 Passport는 같은 파일로 누구나 재현해 대조할 수 있는 기록이지, 제3자 감사 증명서가 아닙니다. 상대에게 제출할 때는 파일과 함께 보내 직접 대조하게 하십시오.",
  },
  {
    title: "점수는 선언된 정책에 대한 판정입니다",
    body: "Game-Ready Score는 Clunk가 선언한 규칙 세트와 예산에 대조한 결과이며, 특정 엔진·기기에서의 실제 성능을 보증하지 않습니다. 엔진 프리셋과 프로젝트 프로파일로 기준을 여러분의 게임에 맞출 수 있습니다.",
  },
] as const;

const FAQ = [
  {
    q: "내 에셋이 서버로 올라가나요?",
    a: "아닙니다. 검사와 최적화는 브라우저 안에서 실행되고, 서버에는 파일 이름·형식·바이트 길이·해시와 검사 결과만 저장됩니다. 원본 바이트를 저장하는 테이블 자체가 없습니다.",
  },
  {
    q: "내 에셋이 AI 학습에 쓰이나요?",
    a: "쓰지 않습니다. 애초에 원본이 서버로 전송되지 않고, 검사 결과도 서비스 제공과 장애 대응 외의 목적으로 사용하지 않습니다.",
  },
  {
    q: "원본 파일이 바뀌나요?",
    a: "바뀌지 않습니다. 최적화는 항상 새 파일을 만들고 원본은 그대로 둡니다. Passport에는 원본과 결과물의 해시가 함께 들어갑니다.",
  },
  {
    q: "검사가 실패하면 크레딧이 차감되나요?",
    a: "차감되지 않습니다. 성공한 실행에만 차감합니다.",
  },
  {
    q: "CI에서 쓸 수 있나요?",
    a: "가능합니다. CLI의 validate는 정책을 만족하지 않으면 종료 코드 2를 반환하므로 그대로 빌드 게이트로 쓸 수 있습니다. 자세한 사용법은 문서에 있습니다.",
  },
  {
    q: "지원하는 형식은 무엇인가요?",
    a: "glTF 2.0과 GLB입니다. 텍스처 세트(타일링·지형 텍스처)는 별도 검사 도구로 다룹니다.",
  },
] as const;

export default function SupportPage() {
  return (
    <SiteShell active="support">
      <main className="legal-main">
        <div className="legal-inner">
          <header className="legal-head">
            <span className="eyebrow">지원</span>
            <h1>막히면 사람에게 닿습니다</h1>
            <p>
              문의 경로와 응답 목표, 그리고 Clunk가 지금 <strong>하지 못하는 일</strong>을 그대로
              적었습니다. 결제를 결심하기 전에 알아야 할 것을 나중에 알게 되는 일이 없도록.
            </p>
          </header>

          <section className="support-section" aria-labelledby="contact-heading">
            <h2 id="contact-heading">연락</h2>
            <div className="support-grid">
              {CONTACT.map((item) => (
                <article key={item.title} className="panel support-card">
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                  <a className="text-link" href={`mailto:${item.target}`}>
                    {item.target}
                  </a>
                  <p className="support-goal">{item.goal}</p>
                </article>
              ))}
            </div>
            <p className="muted-note">
              아직 1인이 운영합니다. 응답 목표는 약속이지 자동 응답이 아니며, 지키지 못할 때는
              언제까지 처리할 수 있는지 먼저 알려드립니다.
            </p>
          </section>

          <section className="support-section" aria-labelledby="limits-heading">
            <h2 id="limits-heading">지금 하지 못하는 일</h2>
            <div className="support-limits">
              {LIMITS.map((item) => (
                <div key={item.title} className="support-limit">
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="support-section" aria-labelledby="faq-heading">
            <h2 id="faq-heading">자주 묻는 것</h2>
            <dl className="support-faq">
              {FAQ.map((item) => (
                <div key={item.q} className="support-faq-row">
                  <dt>{item.q}</dt>
                  <dd>{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="support-section" aria-labelledby="more-heading">
            <h2 id="more-heading">더 볼 곳</h2>
            <p>
              연동 방법과 규칙 세트는 <Link href="/docs">문서</Link>에, 요금과 크레딧 계산은{" "}
              <Link href="/pricing">요금 안내</Link>에 있습니다. 데이터 처리 방식은{" "}
              <Link href="/legal/privacy">개인정보처리방침</Link>에 실제 저장 항목까지 적어 두었고,
              내 데이터 내려받기와 계정 삭제는 <Link href="/settings">설정</Link>에서 직접 하실 수
              있습니다.
            </p>
          </section>
        </div>
      </main>
    </SiteShell>
  );
}
