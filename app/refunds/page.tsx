import { createPageMetadata } from "../components/site-metadata";
import {
  LEGAL_DRAFT_DATE,
  LEGAL_OPERATOR_ROWS,
  LegalRows,
  LegalShell,
} from "../components/LegalShell";

export const metadata = createPageMetadata({
  title: "취소·환불정책",
  description:
    "Clunk 마켓 단건 구매와 크레딧 실행에 대한 청약철회·취소·환불 기준입니다. 디지털 콘텐츠 제공 개시에 따른 청약철회 제한 고지를 포함합니다.",
  path: "/refunds",
});

/**
 * 취소·환불정책 초안. 크레딧 차감 규칙과 환불 반영 절차는 실제 구현(성공 시에만
 * 차감, 환불 webhook에서 주문 REFUNDED + 이용권 REVOKED)에서 옮겼습니다.
 */
export default function RefundsPage() {
  return (
    <LegalShell
      eyebrow="CLUNK / REFUNDS"
      title="취소·환불정책"
      lede="Clunk 마켓에서 구매한 디지털 에셋과 워크스페이스 실행 크레딧에 대한 청약철회·취소·환불 기준입니다. 디지털 콘텐츠 특성상 제공이 개시된 뒤에는 청약철회가 제한될 수 있어, 그 조건을 결제 전에 고지합니다."
    >
      <section aria-labelledby="refunds-operator">
        <h2 id="refunds-operator">판매자 표시사항</h2>
        <p>
          청약철회와 환불의 상대방이 되는 통신판매업자 정보입니다. 등록 전이므로 플레이스홀더로 표시하며,
          확정 전까지 유상 거래를 개시하지 않습니다.
        </p>
        <LegalRows rows={LEGAL_OPERATOR_ROWS} />
      </section>

      <section aria-labelledby="refunds-scope">
        <h2 id="refunds-scope">1. 적용 범위</h2>
        <ul>
          <li><b>마켓 단건 구매</b> — 공개된 listing의 에셋 파일을 1회 결제로 구매하고 다운로드 이용권을 받는 거래</li>
          <li><b>실행 크레딧</b> — 검사·최적화·생성·provider 실행에 사용되는 내부 사용 단위</li>
        </ul>
        <p>
          정기 결제(구독) 상품은 제공하지 않습니다. 향후 도입할 경우 이 정책에 해지·잔여기간 환불 기준을 먼저 추가합니다.
        </p>
      </section>

      <section aria-labelledby="refunds-digital">
        <h2 id="refunds-digital">2. 디지털 콘텐츠 청약철회 제한 (중요)</h2>
        <p>
          마켓에서 판매되는 에셋은 <b>결제 확인 즉시 다운로드 권한이 부여되는 디지털 콘텐츠</b>입니다.
          전자상거래 등에서의 소비자보호에 관한 법률 제17조 제2항 제5호 및 같은 법 시행령에 따라,
          <b>제공이 개시된 디지털 콘텐츠에 대해서는 청약철회가 제한됩니다.</b>
        </p>
        <p>
          다만 같은 조항 단서에 따라, 하나의 계약에서 여러 개로 나눌 수 있는 콘텐츠 중{" "}
          <b>아직 제공이 개시되지 않은 부분</b>에 대해서는 청약철회가 가능합니다.
        </p>
        <h3>결제 전 고지·동의 구조</h3>
        <p>운영자는 결제 버튼을 누르기 전에 다음을 화면에 고지하고 구매자의 동의를 받은 뒤에만 결제를 개시합니다.</p>
        <ol>
          <li>구매 대상 에셋의 파일 형식·용량·해시와 라이선스 범위</li>
          <li>결제가 확인되면 <b>즉시</b> 다운로드 권한이 부여된다는 사실</li>
          <li>그 <b>제공 개시 시점부터 청약철회가 제한</b>된다는 사실</li>
          <li>위 내용에 동의한다는 구매자의 명시적 의사표시(동의 체크)</li>
        </ol>
        <p>
          동의가 확인되지 않으면 결제 세션을 생성하지 않습니다. 동의 사실은 주문 기록과 함께 보관하여
          분쟁 시 확인할 수 있게 합니다.
        </p>
        <p className="cv4-legal-note">
          현재 구매 화면에는 위 고지·동의 절차가 <b>아직 구현되어 있지 않습니다</b>. 이 절차를 구매 흐름에
          연결하고 사업자 정보를 확정하기 전까지 유상 거래를 개시하지 않으며, 이 정책도 시행되지 않습니다.
        </p>
      </section>

      <section aria-labelledby="refunds-eligible">
        <h2 id="refunds-eligible">3. 환불이 가능한 경우</h2>
        <p>제공 개시 여부와 무관하게 다음의 경우에는 환불합니다.</p>
        <ul>
          <li>결제는 완료되었으나 <b>이용권이 부여되지 않아 다운로드가 불가능한 경우</b></li>
          <li>제공된 파일이 손상되어 열리지 않거나, 표시된 형식·구성과 <b>명백히 다른 경우</b></li>
          <li>listing에 표시된 라이선스 범위와 실제 권리 상태가 다른 경우</li>
          <li>동일 건에 대한 <b>중복 결제</b>가 발생한 경우</li>
          <li>기타 표시·광고 내용과 다르거나 계약 내용이 이행되지 않은 경우(전자상거래법 제17조 제3항)</li>
        </ul>
        <p>
          위 사유는 콘텐츠 내용을 확인한 뒤의 단순 변심(스타일이 마음에 들지 않음, 다른 에셋을
          선택하고 싶음 등)과는 구분됩니다.
        </p>
      </section>

      <section aria-labelledby="refunds-credit">
        <h2 id="refunds-credit">4. 실행 크레딧</h2>
        <ul>
          <li>실행이 <b>실패</b>하거나 거부된 경우 크레딧을 <b>차감하지 않습니다</b>. 별도의 환불 절차가 필요 없습니다.</li>
          <li>동일한 멱등 키로 들어온 중복 요청은 한 번만 기록되므로 중복 차감이 발생하지 않습니다.</li>
          <li>실행이 성공하여 결과물이 워크스페이스에 저장된 경우, 해당 크레딧은 제공이 완료된 것으로 봅니다.</li>
          <li>서비스 장애로 결과가 저장되지 않았는데 차감이 발생한 경우, 확인 후 크레딧을 복구합니다.</li>
          <li>현재 유상으로 판매되는 크레딧 상품은 없습니다. 유상 판매 개시 시 미사용 크레딧의 환불 기준을 이 항목에 먼저 명시합니다.</li>
        </ul>
      </section>

      <section aria-labelledby="refunds-process">
        <h2 id="refunds-process">5. 신청 방법과 처리 절차</h2>
        <ol>
          <li>구매자가 주문 식별자와 사유를 적어 고객문의 창구(사업자 정보 확정 후 기재)로 신청합니다.</li>
          <li>운영자가 주문 기록, 이용권 상태, 다운로드 이력, 파일 해시를 확인합니다.</li>
          <li>환불 사유가 확인되면 결제대행사를 통해 환불을 요청합니다.</li>
          <li>환불이 확인되면 주문 상태는 <b>REFUNDED</b>로, 해당 이용권은 <b>REVOKED</b>로 변경되어 다운로드 권한이 회수됩니다.</li>
        </ol>
        <p>
          운영자는 청약철회 또는 환불 사유 확인일부터 <b>3영업일 이내</b>에 결제대행사에 환불을 요청하며,
          실제 환급 시점은 결제수단과 카드사·은행의 처리 일정에 따릅니다.
        </p>
      </section>

      <section aria-labelledby="refunds-dispute">
        <h2 id="refunds-dispute">6. 분쟁 처리</h2>
        <p>
          환불 여부에 이견이 있는 경우 구매자는 소비자분쟁조정위원회, 한국소비자원, 전자거래분쟁조정위원회 등
          법령이 정한 기관에 조정을 신청할 수 있습니다. 관련 이용 조건은{" "}
          <a href="/terms">이용약관</a>, 개인정보 처리는 <a href="/privacy">개인정보처리방침</a>을 따릅니다.
        </p>
        <p className="cv4-legal-note">
          이 정책 초안은 {LEGAL_DRAFT_DATE} 작성되었으며, 사업자 표시사항과 결제 전 동의 절차가
          확정·구현된 뒤 시행일을 고지하는 시점부터 효력이 발생합니다.
        </p>
      </section>
    </LegalShell>
  );
}
