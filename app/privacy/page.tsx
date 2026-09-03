import { createPageMetadata } from "../components/site-metadata";
import {
  LEGAL_DRAFT_DATE,
  LEGAL_EFFECTIVE_DATE,
  LegalRows,
  LegalShell,
  type LegalRow,
} from "../components/LegalShell";

export const metadata = createPageMetadata({
  title: "개인정보처리방침",
  description:
    "2026-09-02부터 시행 중인 Clunk 개인정보처리방침입니다. 처리하는 항목, 목적, 보유기간, 맡기는 곳과 이용자의 권리를 정리했습니다.",
  path: "/privacy",
});

/**
 * 개인정보처리방침. 처리 항목은 데이터베이스에 실제로 존재하는 컬럼과 로그인이 실제로
 * 설정하는 쿠키에서만 옮겼고, 아직 확정되지 않은 책임자 정보만 [ ] 플레이스홀더로 남겨
 * 둡니다.
 */
const PRIVACY_OFFICER_ROWS: LegalRow[] = [
  { label: "개인정보보호책임자", value: "박준성 (대표)" },
  { label: "책임자 연락처", value: "+82 10-2761-9841" },
  { label: "책임자 전자우편", value: "junsuopar@gmail.com" },
  { label: "개인정보 열람 청구 접수", value: "junsuopar@gmail.com (전자우편 접수)" },
];

// code: true — 쿠키 이름은 브라우저에 저장되는 문자 그대로다. 표의 라벨 대문자 변환을
// 적용하면 존재하지 않는 이름(CLUNK_AUTH_SESSION)이 찍힌다.
const COOKIE_ROWS: LegalRow[] = [
  { label: "clunk_auth_session", code: true, value: "로그인 상태 유지 · 스크립트 접근 차단 · 교차 사이트 전송 제한 · 최대 30일" },
  { label: "clunk_oauth_tx_*", code: true, value: "로그인 요청의 위조 방지 · 스크립트 접근 차단 · 10분 · 로그인이 끝나면 즉시 만료" },
];

export default function PrivacyPage() {
  return (
    <LegalShell
      eyebrow="개인정보 처리"
      title="개인정보처리방침"
      lede="Clunk가 어떤 개인정보를 어떤 목적으로 처리하고 어디에 보관하는지, 이용자가 무엇을 요구할 수 있는지를 실제 구현된 저장 구조에 맞춰 정리한 것입니다."
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
          <li>작업공간 식별자와 소유자·구성원 관계</li>
          <li>에셋 정보 — 파일 이름, 형식, 파일 크기, SHA-256 지문(해시)</li>
          <li>검사·수정 실행 기록 — 검사한 파일의 지문, 적용한 기준의 식별자, 상태, 점수, 발견된 문제 요약, 결과 보고서</li>
          <li>검사 증명서 기록과 그 결과 지문</li>
          <li>크레딧 사용 기록과 실행 기록(중복 방지 키, 지문, 종류, 수량, 상태)</li>
          <li>API 키의 이름·앞자리·<b>지문</b>(원본 키는 저장하지 않습니다)</li>
          <li>협업 스레드의 제목·메시지 등 이용자가 직접 입력한 내용</li>
        </ul>
        <h3>거래 정보</h3>
        <ul>
          <li>주문 번호, 마켓 상품 식별자, 구매자 식별자, 금액, 통화, 주문 상태, 결제대행사 참조 번호</li>
          <li><b>카드번호·계좌번호 등 결제수단 정보는 수집하지 않습니다.</b> 결제 인증과 승인은 결제대행사 화면에서 이루어집니다.</li>
        </ul>
      </section>

      <section aria-labelledby="privacy-purpose">
        <h2 id="privacy-purpose">2. 처리 목적</h2>
        <ul>
          <li>이용자 확인과 작업공간 접근 권한 관리</li>
          <li>에셋 만들기·검사·수정 기능의 제공과 결과 보관</li>
          <li>크레딧 사용량 계산과 중복 청구 방지</li>
          <li>마켓 주문 처리, 받을 권리의 부여·회수, 환불 처리</li>
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
          <li>계정·작업공간 정보는 이용자가 삭제를 요청할 때까지 보관합니다.</li>
          <li>전자상거래법상 보존 의무가 적용되는 기록(계약·청약철회 5년, 대금 결제 5년, 소비자 불만·분쟁 처리 3년)은 해당 기간 동안 보관합니다.</li>
          <li>파기할 때는 데이터베이스의 기록과 저장소의 결과 파일을 함께 지웁니다.</li>
        </ul>
        <p className="cv5-legal-note">
          <b>계정 삭제 요청 시 30일 이내</b>에 계정·작업공간·크레딧 기록을 파기합니다. 법령상 보존
          의무가 있는 거래 기록만 그 기간 동안 따로 보관한 뒤 파기합니다. 삭제 요청은
          <b>junsuopar@gmail.com</b>으로 받습니다. 이 브라우저의 로그인 상태를 끝내는 것은
          <a href="/settings">설정 화면</a>에서 바로 할 수 있습니다.
        </p>
      </section>

      <section aria-labelledby="privacy-storage">
        <h2 id="privacy-storage">5. 보관 장소와 처리위탁</h2>
        <ul>
          <li>서비스는 <b>Cloudflare, Inc. (미국)</b>에서 운영됩니다. <a href="/terms">이용약관</a>의 사업자 표시사항에 적은 호스팅 제공자와 같습니다.</li>
          <li>계정·에셋 정보는 <b>Cloudflare D1</b> 데이터베이스에, 결과 파일은 <b>비공개 Cloudflare R2</b> 버킷에 보관합니다. 두 곳 모두 미국에 있습니다.</li>
          <li>결제 처리는 <b>Stripe</b>에 위탁할 예정입니다. 결제 준비가 끝나기 전까지 결제 요청 자체가 만들어지지 않습니다.</li>
          <li>운영자는 위 목적 외에 개인정보를 제3자에게 제공하지 않습니다.</li>
        </ul>
        <p className="cv5-legal-note">
          맡기는 곳이 늘어나면 <b>확정된 사실만</b> 이 방침에 먼저 적습니다.
        </p>
      </section>

      <section aria-labelledby="privacy-cookies">
        <h2 id="privacy-cookies">6. 쿠키</h2>
        <p>서비스가 설정하는 쿠키는 다음이 전부이며, 광고·행태정보 수집 목적의 쿠키는 사용하지 않습니다.</p>
        <LegalRows rows={COOKIE_ROWS} />
        <p>
          이용자는 <a href="/signout-with-chatgpt">로그아웃</a>으로 이 쿠키를 즉시 만료시킬 수 있고,
          브라우저 설정에서 쿠키 저장을 거부할 수 있습니다. 다만 거부하면 작업공간 로그인 상태가 유지되지 않습니다.
        </p>
      </section>

      <section aria-labelledby="privacy-rights">
        <h2 id="privacy-rights">7. 정보주체의 권리</h2>
        <p>
          이용자는 언제든지 자신의 개인정보에 대한 <b>열람·정정·삭제·처리정지</b>를 요구할 수 있습니다.
          요청은 <b>junsuopar@gmail.com</b>으로 받으며, 법령이 정한 기간 안에 처리하고 결과를 알립니다.
          이 브라우저의 로그인 상태를 끝내는 것은 <a href="/settings">설정 화면</a>에서 바로 할 수 있습니다.
          법령상 보존 의무가 있는 기록은 삭제 요구가 제한될 수 있으며, 그 사유를 함께 알립니다.
        </p>
      </section>

      <section aria-labelledby="privacy-security">
        <h2 id="privacy-security">8. 안전성 확보 조치</h2>
        <ul>
          <li>로그인 쿠키는 스크립트가 읽지 못하게 하고, 다른 사이트에서 함께 전송되지 않도록 제한합니다.</li>
          <li>외부 계정 로그인은 요청마다 서명된 확인값을 붙여 위조를 차단합니다.</li>
          <li>API 키는 지문으로만 저장하고, 결과 파일은 비공개 버킷에 두어 로그인한 본인의 작업공간에서만 열립니다.</li>
          <li>결제 승인 알림은 결제대행사의 서명을 확인한 뒤에만 주문과 받을 권리에 반영합니다.</li>
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
          이 방침은 {LEGAL_DRAFT_DATE} 작성되어 {LEGAL_EFFECTIVE_DATE}부터 시행합니다. 침해 신고·상담은 개인정보침해신고센터(118),
          개인정보 분쟁조정위원회, 대검찰청·경찰청 사이버수사 창구를 이용할 수 있습니다.
        </p>
      </section>
    </LegalShell>
  );
}
