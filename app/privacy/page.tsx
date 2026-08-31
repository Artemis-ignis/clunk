import { createPageMetadata } from "../components/site-metadata";
import {
  LEGAL_DRAFT_DATE,
  LegalRows,
  LegalShell,
  type LegalRow,
} from "../components/LegalShell";

export const metadata = createPageMetadata({
  title: "개인정보처리방침",
  description:
    "Clunk가 처리하는 개인정보의 항목, 목적, 보유기간, 위탁과 정보주체 권리를 정리한 개인정보처리방침 초안입니다.",
  path: "/privacy",
});

/**
 * 개인정보처리방침 초안. 처리 항목은 db/schema.ts에 실제로 존재하는 컬럼과
 * oauth.ts가 실제로 설정하는 쿠키에서만 옮겼고, 확정되지 않은 책임자·수탁자
 * 정보는 플레이스홀더로 남겨 둡니다.
 */
const PRIVACY_OFFICER_ROWS: LegalRow[] = [
  { label: "개인정보보호책임자", value: "[성명·직위 — 운영자 지정 후 기재]", placeholder: true },
  { label: "책임자 연락처", value: "[전화번호 — 확정 후 기재]", placeholder: true },
  { label: "책임자 전자우편", value: "[개인정보 문의 이메일 — 운영 계정 확정 후 기재]", placeholder: true },
  { label: "개인정보 열람 청구 접수", value: "[접수 창구 — 확정 후 기재]", placeholder: true },
];

const COOKIE_ROWS: LegalRow[] = [
  { label: "clunk_auth_session", value: "외부 OAuth 로그인 세션 유지 · HttpOnly · SameSite=Lax · 최대 30일" },
  { label: "clunk_oauth_tx_*", value: "OAuth 인증 요청의 위조 방지(state·PKCE) · HttpOnly · 10분 · 인증 완료 즉시 만료" },
];

export default function PrivacyPage() {
  return (
    <LegalShell
      eyebrow="CLUNK / PRIVACY"
      title="개인정보처리방침"
      lede="Clunk가 어떤 개인정보를 어떤 목적으로 처리하고 어디에 보관하는지, 이용자가 무엇을 요구할 수 있는지를 실제 구현된 저장 구조에 맞춰 정리한 초안입니다."
    >
      <section aria-labelledby="privacy-officer">
        <h2 id="privacy-officer">개인정보보호책임자</h2>
        <p>
          개인정보 보호법 제31조에 따른 개인정보보호책임자입니다. 운영자(아르테미스, 대표
          박준성)의 사업자 등록은 완료되었으나 책임자 지정·공개 절차가 아직 남아 있으며,
          <b>임의의 이름이나 연락처를 기재하지 않습니다</b>.
        </p>
        <LegalRows rows={PRIVACY_OFFICER_ROWS} />
      </section>

      <section aria-labelledby="privacy-items">
        <h2 id="privacy-items">1. 처리하는 개인정보 항목</h2>
        <h3>인증 정보</h3>
        <ul>
          <li>인증 제공자가 전달한 <b>사용자 식별자</b>, <b>이메일 주소</b>, <b>표시 이름</b>(제공된 경우 전체 이름)</li>
          <li>서비스는 자체 비밀번호를 생성하거나 보관하지 않습니다.</li>
        </ul>
        <h3>서비스 이용 과정에서 생성되는 정보</h3>
        <ul>
          <li>워크스페이스 식별자와 소유자·구성원 관계</li>
          <li>에셋 메타데이터 — 파일 이름, 형식, 바이트 길이, SHA-256 해시</li>
          <li>검사·최적화 실행 기록 — 입력 해시, 프로파일·규칙 세트 식별자, 상태, 점수, finding 요약, 결과 리포트</li>
          <li>Passport 기록과 결과 digest</li>
          <li>크레딧 원장과 실행 기록(멱등 키, 지문, 종류, 수량, 상태)</li>
          <li>API 키의 라벨·접두사·<b>해시</b>(원본 키는 저장하지 않습니다)</li>
          <li>협업 스레드의 제목·메시지 등 이용자가 직접 입력한 내용</li>
        </ul>
        <h3>거래 정보</h3>
        <ul>
          <li>주문 식별자, listing 식별자, 구매자 식별자, 금액, 통화, 주문 상태, 결제대행사 참조 식별자</li>
          <li><b>카드번호·계좌번호 등 결제수단 정보는 수집하지 않습니다.</b> 결제 인증과 승인은 결제대행사 화면에서 이루어집니다.</li>
        </ul>
      </section>

      <section aria-labelledby="privacy-purpose">
        <h2 id="privacy-purpose">2. 처리 목적</h2>
        <ul>
          <li>이용자 식별과 워크스페이스 접근 권한 관리</li>
          <li>에셋 생성·검사·최적화 기능의 제공과 결과 보관</li>
          <li>크레딧 사용량 계산과 중복 청구 방지</li>
          <li>마켓 주문 처리, 이용권 부여·회수, 환불 처리</li>
          <li>부정 이용 방지와 장애 대응</li>
        </ul>
      </section>

      <section aria-labelledby="privacy-legal-basis">
        <h2 id="privacy-legal-basis">3. 처리의 근거</h2>
        <p>
          인증·서비스 제공·거래 처리에 필요한 정보는 <b>계약의 이행</b>을 위해 처리합니다.
          법령상 보존 의무가 있는 거래 기록은 <b>법령상 의무 준수</b>를 근거로 보관합니다.
        </p>
      </section>

      <section aria-labelledby="privacy-retention">
        <h2 id="privacy-retention">4. 보유 및 파기</h2>
        <ul>
          <li>계정·워크스페이스 정보는 이용자가 삭제를 요청할 때까지 보관합니다.</li>
          <li>전자상거래법상 보존 의무가 적용되는 기록(계약·청약철회 5년, 대금 결제 5년, 소비자 불만·분쟁 처리 3년)은 해당 기간 동안 보관합니다.</li>
          <li>파기 시에는 데이터베이스 레코드를 삭제하고 저장소의 결과 파일을 삭제합니다.</li>
        </ul>
        <p className="cv5-legal-note">
          현재 코드에는 <b>기간 경과 자동 파기 스케줄러가 구현되어 있지 않습니다</b>. 삭제 요청은 아래
          문의 창구를 통해 수동으로 처리하며, 자동 파기 주기는 이 방침 시행 전까지 확정해 여기에 기재합니다.
        </p>
      </section>

      <section aria-labelledby="privacy-storage">
        <h2 id="privacy-storage">5. 보관 장소와 처리위탁</h2>
        <ul>
          <li>메타데이터는 <b>Cloudflare D1</b> 데이터베이스에, 결과 artifact 파일은 <b>비공개 Cloudflare R2</b> 버킷에 보관합니다.</li>
          <li>결제 처리는 <b>Stripe</b>에 위탁할 예정입니다. 결제 제공자 설정이 완료되기 전까지 결제 요청 자체가 생성되지 않습니다.</li>
          <li>위 수탁자는 국외에 서버를 둘 수 있으며, 실제 운영 배포처와 이전 국가·항목·시점은 사업자 정보 확정 시점에 이 방침에 정확히 기재합니다.</li>
          <li>운영자는 위 목적 외에 개인정보를 제3자에게 제공하지 않습니다.</li>
        </ul>
        <p className="cv5-legal-note">
          수탁자 명칭과 국외 이전 내역은 운영 배포처가 확정된 뒤 <b>확정된 사실만</b> 기재합니다.
        </p>
      </section>

      <section aria-labelledby="privacy-cookies">
        <h2 id="privacy-cookies">6. 쿠키</h2>
        <p>서비스가 설정하는 쿠키는 다음이 전부이며, 광고·행태정보 수집 목적의 쿠키는 사용하지 않습니다.</p>
        <LegalRows rows={COOKIE_ROWS} />
        <p>
          이용자는 <a href="/signout-with-chatgpt">로그아웃</a>으로 세션 쿠키를 즉시 만료시킬 수 있고,
          브라우저 설정에서 쿠키 저장을 거부할 수 있습니다. 다만 세션 쿠키를 거부하면 워크스페이스 로그인 상태가 유지되지 않습니다.
        </p>
      </section>

      <section aria-labelledby="privacy-rights">
        <h2 id="privacy-rights">7. 정보주체의 권리</h2>
        <p>
          이용자는 언제든지 자신의 개인정보에 대한 <b>열람·정정·삭제·처리정지</b>를 요구할 수 있습니다.
          요청은 위 개인정보보호책임자 연락처(확정 후 기재)로 접수하며, 법령이 정한 기간 내에 처리하고 결과를 알립니다.
          법령상 보존 의무가 있는 기록은 삭제 요구가 제한될 수 있으며, 그 사유를 함께 알립니다.
        </p>
      </section>

      <section aria-labelledby="privacy-security">
        <h2 id="privacy-security">8. 안전성 확보 조치</h2>
        <ul>
          <li>세션 쿠키는 HttpOnly·SameSite=Lax로 설정하여 스크립트 접근과 교차 사이트 전송을 제한합니다.</li>
          <li>OAuth 인증은 state 서명과 PKCE로 요청 위조를 차단합니다.</li>
          <li>API 키는 해시로만 저장하고, 결과 artifact는 비공개 버킷에 두어 인증된 워크스페이스에서만 접근합니다.</li>
          <li>결제 승인 알림은 결제대행사의 서명을 검증한 뒤에만 주문·이용권 상태에 반영합니다.</li>
        </ul>
      </section>

      <section aria-labelledby="privacy-children">
        <h2 id="privacy-children">9. 만 14세 미만 아동</h2>
        <p>
          서비스는 만 14세 미만 아동을 대상으로 하지 않으며, 법정대리인의 동의 절차를 별도로 운영하지 않습니다.
        </p>
      </section>

      <section aria-labelledby="privacy-change">
        <h2 id="privacy-change">10. 방침의 변경</h2>
        <p>
          이 방침을 변경할 때에는 변경 내용과 적용일자를 <a href="/privacy">/privacy</a>에 게시하고,
          이용자에게 불리한 변경은 최소 30일 전에 공지합니다.
        </p>
        <p className="cv5-legal-note">
          이 방침 초안은 {LEGAL_DRAFT_DATE} 작성되었으며, 개인정보보호책임자 지정과 통신판매업
          신고가 완료되어 시행일을 고지하는 시점부터 효력이 발생합니다. 침해 신고·상담은 개인정보침해신고센터(118),
          개인정보 분쟁조정위원회, 대검찰청·경찰청 사이버수사 창구를 이용할 수 있습니다.
        </p>
      </section>
    </LegalShell>
  );
}
