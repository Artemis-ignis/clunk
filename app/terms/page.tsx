import { createPageMetadata } from "../components/site-metadata";
import {
  LEGAL_DRAFT_DATE,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_OPERATOR_ROWS,
  LegalRows,
  LegalShell,
} from "../components/LegalShell";

export const metadata = createPageMetadata({
  title: "이용약관",
  description:
    "Clunk 서비스 이용약관 초안입니다. 크레딧 실행, 마켓 단건 구매, 계정과 인증, 디지털 콘텐츠 청약철회 제한 고지, 생성형 인공지능 이용·표시 조항을 담고 있습니다.",
  path: "/terms",
});

/**
 * 이용약관 초안. 서술된 기능·요금·상태는 저장소에 실제로 구현된 계약만 옮긴
 * 것이고, 사업자 표시사항은 등록 전이므로 전부 플레이스홀더로 남겨 둡니다.
 */
export default function TermsPage() {
  return (
    <LegalShell
      eyebrow="CLUNK / LEGAL"
      title="이용약관"
      lede="Clunk(이하 “서비스”)가 제공하는 게임 에셋 생성·검사·마켓 기능의 이용 조건입니다. 운영자(아르테미스)의 사업자 등록은 완료되어 있으며, 지금은 무료 베타 기간이라 유상 거래는 하지 않습니다."
    >
      <section aria-labelledby="terms-operator">
        <h2 id="terms-operator">사업자 표시사항</h2>
        <p>
          전자상거래 등에서의 소비자보호에 관한 법률 제10조가 요구하는 표시사항입니다.
          확정된 항목은 사업자등록증명 그대로 기재했고, 미확정 항목은 <b>지어낸 값 대신 [ ]로 표시</b>합니다.
        </p>
        <LegalRows rows={LEGAL_OPERATOR_ROWS} />
        <p className="cv5-legal-note">
          위 항목이 모두 채워지고 통신판매업 신고가 완료되기 전까지 이 약관은 시행되지 않으며,
          서비스는 유상 결제를 개시하지 않습니다.
        </p>
      </section>

      <section aria-labelledby="terms-purpose">
        <h2 id="terms-purpose">제1조 (목적)</h2>
        <p>
          이 약관은 서비스 운영자와 이용자가 Clunk의 게임 에셋 생성, 검사·최적화, 마켓 거래,
          에이전트 연동(MCP·CLI) 기능을 이용할 때의 권리와 의무, 책임 사항을 정합니다.
        </p>
      </section>

      <section aria-labelledby="terms-definitions">
        <h2 id="terms-definitions">제2조 (용어의 정의)</h2>
        <ul>
          <li><b>이용자</b> — 인증을 거쳐 서비스의 워크스페이스를 사용하는 사람입니다.</li>
          <li><b>워크스페이스</b> — 이용자별로 분리되는 저장·실행 경계이며, 인증된 API를 처음 호출할 때 생성됩니다.</li>
          <li><b>크레딧</b> — 검사·최적화·생성·provider 실행 등 서비스 기능 1회 실행에 사용되는 내부 사용 단위입니다.</li>
          <li><b>listing</b> — 마켓에 공개(PUBLISHED)된 에셋 상품 단위입니다.</li>
          <li><b>이용권(entitlement)</b> — 결제가 확인된 뒤 구매자에게 부여되는 해당 에셋의 다운로드 권한입니다.</li>
          <li><b>Passport</b> — 입력 해시, 규칙 세트, 검사 결과를 결정론적으로 봉인한 검사 근거 기록입니다.</li>
        </ul>
      </section>

      <section aria-labelledby="terms-amend">
        <h2 id="terms-amend">제3조 (약관의 게시와 개정)</h2>
        <p>
          운영자는 이 약관을 서비스 초기 화면에서 접근할 수 있는 <a href="/terms">/terms</a> 경로에 게시합니다.
          약관을 개정할 때에는 적용일자와 개정 사유를 밝혀 적용일 7일 전(이용자에게 불리하거나 중대한 변경은 30일 전)부터
          공지합니다. 현재 문서는 초안 상태이며 최초 시행일은 사업자 표시사항 확정 시점에 별도로 고지합니다.
        </p>
      </section>

      <section aria-labelledby="terms-service">
        <h2 id="terms-service">제4조 (서비스의 구성)</h2>
        <p>서비스가 실제로 제공하는 기능은 다음과 같습니다. 이 목록에 없는 기능은 제공되지 않습니다.</p>
        <ul>
          <li><b>에셋 생성</b> — 프롬프트·레퍼런스로 2D 이미지와 3D GLB/glTF 파일을 생성하고 결과 바이트와 해시를 워크스페이스에 기록합니다.</li>
          <li><b>검사·최적화</b> — 업로드하거나 생성한 파일을 정책 규칙으로 검사하고, 원본을 덮어쓰지 않는 별도 산출물과 Passport를 만듭니다.</li>
          <li><b>마켓</b> — 게시 조건을 충족한 listing의 열람과 단건 구매, 구매자에 한정된 다운로드를 제공합니다.</li>
          <li><b>에이전트 연동</b> — MCP(HTTP·로컬 stdio)와 CLI로 위 기능을 호출할 수 있는 계약을 제공합니다.</li>
        </ul>
        <p>
          검사 점수와 정책 판정은 파일 구조에 대한 정적·기계적 결과이며, 사람의 최종 승인이나
          게임 내 실사용 적합성 판단을 대체하지 않습니다.
        </p>
      </section>

      <section aria-labelledby="terms-account">
        <h2 id="terms-account">제5조 (계정과 인증)</h2>
        <ul>
          <li>서비스는 자체 비밀번호를 만들거나 보관하지 않습니다. 인증은 호스트의 ChatGPT(SIWC) identity 또는 설정된 외부 OAuth provider(Google·GitHub)로만 이루어집니다.</li>
          <li>외부 OAuth로 로그인한 경우 브라우저에 <code>clunk_auth_session</code> 세션 쿠키(HttpOnly, SameSite=Lax, 최대 30일)가 설정됩니다.</li>
          <li>이용자는 <a href="/signout-with-chatgpt">로그아웃 경로</a>로 언제든지 이 브라우저의 Clunk 세션을 종료할 수 있습니다. 이때 종료되는 것은 Clunk 세션 쿠키이며, ChatGPT 등 인증 제공자 자체의 로그인 상태는 해당 제공자가 관리합니다.</li>
          <li>이용자는 계정과 API 키를 제3자와 공유해서는 안 되며, 유출을 인지한 경우 즉시 키를 폐기하고 운영자에게 알려야 합니다.</li>
        </ul>
      </section>

      <section aria-labelledby="terms-credit">
        <h2 id="terms-credit">제6조 (크레딧)</h2>
        <ul>
          <li>과금 대상으로 정의된 실행이 <b>성공</b>하면 1 크레딧을 차감합니다.</li>
          <li>입력 검증 실패, 인증 실패, provider 오류, 저장 실패 등 실행이 완료되지 않은 경우 <b>차감하지 않습니다</b>.</li>
          <li>동일한 idempotency key로 들어온 중복 요청은 원장에 한 번만 기록됩니다.</li>
          <li>현재 코드에 확정된 유료 크레딧 판매 금액이나 정기 결제 상품은 없습니다. 유상 판매를 시작할 때에는 금액·수량·유효기간을 <a href="/pricing">요금 안내</a>와 이 약관에 먼저 명시합니다.</li>
        </ul>
      </section>

      <section aria-labelledby="terms-purchase">
        <h2 id="terms-purchase">제7조 (마켓 단건 구매와 디지털 콘텐츠 특칙)</h2>
        <p>
          마켓 구매는 개별 에셋 파일에 대한 <b>디지털 콘텐츠 단건 거래</b>입니다. 결제가 확인되면
          구매자에게 즉시 이용권이 부여되고 해당 파일을 내려받을 수 있게 됩니다.
        </p>
        <p>
          전자상거래 등에서의 소비자보호에 관한 법률 제17조 제2항 제5호에 따라,
          <b>제공이 개시된 디지털 콘텐츠는 청약철회가 제한될 수 있습니다.</b> 따라서 운영자는
          결제 진행 전에 (1) 다운로드 권한이 즉시 부여된다는 사실, (2) 그 시점부터 청약철회가
          제한된다는 사실을 고지하고 구매자의 <b>동의를 받은 뒤에만</b> 결제를 개시하는 구조로
          운영합니다. 구체적인 예외와 절차는 <a href="/refunds">취소·환불정책</a>에 정합니다.
        </p>
        <p className="cv5-legal-note">
          위 고지·동의 절차는 구매 흐름에 구현되어 있습니다: 유료 결제는 청약철회 제한
          동의가 확인된 요청에서만 시작되고, 동의 없는 요청에는 결제 세션이 생성되지
          않습니다. 동의가 있어야만 주문이 생성되므로 주문 기록이 동의 시점의 기록을
          겸합니다. 단, 사업자 표시사항 확정 전까지는 유상 거래를 개시하지 않습니다.
        </p>
      </section>

      <section aria-labelledby="terms-payment">
        <h2 id="terms-payment">제8조 (결제)</h2>
        <ul>
          <li>결제는 외부 결제대행사(Stripe)를 통해 처리할 예정이며, 서비스는 카드번호 등 결제수단 정보를 직접 수집·보관하지 않습니다.</li>
          <li>결제 제공자 설정이 완료되지 않은 상태에서는 결제 요청과 주문 생성이 이루어지지 않고, 서비스가 설정 필요 상태를 그대로 응답합니다.</li>
          <li>주문 기록에는 주문 식별자, 결제대행사 참조 식별자, 금액, 통화, 상태만 보관합니다.</li>
        </ul>
      </section>

      <section aria-labelledby="terms-duty">
        <h2 id="terms-duty">제9조 (이용자의 의무)</h2>
        <ul>
          <li>타인의 권리를 침해하는 자료를 업로드하거나 판매하지 않습니다.</li>
          <li>서비스의 검사 결과·Passport·점수를 위조하거나, 사실과 다르게 표시하여 제3자에게 제공하지 않습니다.</li>
          <li>자동화 수단으로 서비스에 과도한 부하를 유발하거나 접근 제한을 우회하지 않습니다.</li>
          <li>법령과 이 약관을 위반한 경우 운영자는 사전 통지 후(긴급한 경우 사후 통지) 이용을 제한할 수 있습니다.</li>
        </ul>
      </section>

      <section aria-labelledby="terms-ip">
        <h2 id="terms-ip">제10조 (콘텐츠의 권리와 라이선스)</h2>
        <ul>
          <li>이용자가 업로드한 원본 파일의 권리는 이용자에게 있습니다.</li>
          <li>이용자가 서비스로 생성한 결과물의 이용 권리는 이용자에게 귀속되며, 운영자는 서비스 제공에 필요한 범위(저장·검사·전송)에서만 이를 처리합니다.</li>
          <li>마켓에서 판매되는 에셋의 라이선스 범위는 각 listing에 표시된 라이선스 상태를 따릅니다. 판매자는 판매 권한과 라이선스 표시의 정확성에 대해 책임을 집니다.</li>
        </ul>
      </section>

      <section aria-labelledby="terms-availability">
        <h2 id="terms-availability">제11조 (서비스의 변경과 중단)</h2>
        <p>
          운영자는 서비스의 기능을 변경하거나 중단할 수 있으며, 유상 거래에 영향을 주는 변경은
          사전에 공지합니다. 시스템 점검, 장애, 외부 제공자의 장애로 서비스가 일시 중단될 수 있습니다.
        </p>
      </section>

      <section aria-labelledby="terms-liability">
        <h2 id="terms-liability">제12조 (책임의 제한)</h2>
        <ul>
          <li>운영자는 천재지변, 외부 제공자 장애 등 통제할 수 없는 사유로 인한 손해에 대해 책임을 지지 않습니다.</li>
          <li>검사 점수, 정책 판정, Game Ready 상태는 구조적 확인 결과이며, 이를 근거로 한 상업적 판단의 결과에 대해서는 책임을 지지 않습니다.</li>
          <li>다만 운영자의 고의 또는 중대한 과실로 인한 손해에 대한 책임은 배제하지 않습니다.</li>
        </ul>
      </section>

      <section aria-labelledby="terms-privacy">
        <h2 id="terms-privacy">제13조 (개인정보의 보호)</h2>
        <p>
          운영자가 처리하는 개인정보의 항목·목적·보유기간과 정보주체의 권리는{" "}
          <a href="/privacy">개인정보처리방침</a>에서 정합니다.
        </p>
      </section>

      <section aria-labelledby="terms-dispute">
        <h2 id="terms-dispute">제14조 (분쟁의 해결)</h2>
        <p>
          이 약관은 대한민국 법령에 따릅니다. 서비스 이용과 관련한 분쟁은 운영자와 이용자가
          성실히 협의하여 해결하며, 협의가 이루어지지 않는 경우 민사소송법상 관할 법원에 제소할 수 있습니다.
          이용자는 소비자분쟁조정위원회 등 법령이 정한 분쟁조정기관에 조정을 신청할 수 있습니다.
        </p>
      </section>

      {/* 제15조·제16조는 docs/legal/ai-labeling-law.ko.md §3.5 약관 조항 초안을
          이 약관의 용어(운영자)에 맞춰 최소 수정으로 옮긴 조항입니다. */}
      <section aria-labelledby="terms-ai">
        <h2 id="terms-ai">제15조 (생성형 인공지능의 이용 및 표시)</h2>
        <p>
          ① 운영자가 제공하는 에셋 생성, 검사·수정, 에이전트 기능 중 일부는 생성형 인공지능을
          기반으로 운용되며, 운영자는 「인공지능 발전과 신뢰 기반 조성 등에 관한 기본법」 제31조에
          따라 그 사실을 본 약관 및 서비스 화면을 통하여 고지합니다.
        </p>
        <p>
          ② 생성형 인공지능을 활용하여 제작된 에셋에는 그 사실이 상품 정보, 구매 전 안내 및 파일
          메타데이터 등의 방법으로 표시됩니다. 이용자는 운영자가 삽입한 인공지능 생성 표시(메타데이터,
          워터마크, 출처 정보 등)를 제거·변조하여서는 안 됩니다.
        </p>
      </section>

      <section aria-labelledby="terms-ai-license">
        <h2 id="terms-ai-license">제16조 (AI 생성 에셋에 대한 권리의 부여 및 보증의 범위)</h2>
        <p>
          ① 운영자는 구매자에게 해당 에셋을 게임 및 관련 콘텐츠 제작에 이용할 수 있는 비독점적
          이용권을 부여합니다. 생성형 인공지능만으로 제작되어 인간의 창작적 기여가 없는 산출물
          부분은 저작권법상 저작물로 보호되지 않을 수 있으며, 이 경우 본 조의 권리 부여는 저작권의
          양도 또는 저작권 존재의 보증을 의미하지 않습니다.
        </p>
        <p>
          ② 운영자는 에셋 제작에 사용된 도구, 제작 이력(Provenance)을 상품 정보에 표시하며,
          제3자의 권리를 침해하지 않도록 합리적인 검수를 수행합니다. 다만 인공지능 산출물의 특성상
          잠재적 유사성에 대한 절대적 보증은 제공되지 않으며, 구체적 보증 범위는 각 상품의
          라이선스 문서에 따릅니다.
        </p>
        <p className="cv5-legal-note">
          부칙 — 이 약관은 {LEGAL_DRAFT_DATE} 작성되어 {LEGAL_EFFECTIVE_DATE}부터 시행합니다. 유상 판매에
          관한 조항은 유료 전환을 최소 30일 전에 공지한 뒤부터 적용합니다.
        </p>
      </section>
    </LegalShell>
  );
}
