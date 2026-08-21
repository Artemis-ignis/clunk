import type { Metadata } from "next";
import { LegalPage } from "../LegalPage";
import { COMPANY, PROCESSORS } from "../company";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "Clunk가 수집하는 항목, 보관 위치와 기간, 처리위탁 대상입니다.",
};

/**
 * Every row here is taken from the actual D1 schema (drizzle/0000, 0001) rather than from a
 * template. If a table changes, this page changes with it.
 */
const COLLECTED = [
  {
    item: "이메일 주소, 표시 이름, 성명, 계정 식별자",
    source: "ChatGPT 계정 로그인 시 호스트가 요청 헤더로 전달",
    purpose: "계정 식별, 워크스페이스 소유권 확인, 장애 시 연락",
    table: "clunk_users",
  },
  {
    item: "GitHub 계정 식별자·로그인명·이메일",
    source: "GitHub 계정으로 로그인할 때 GitHub가 전달(read:user, user:email 범위)",
    purpose: "계정 식별, 워크스페이스 소유권 확인",
    table: "clunk_users",
  },
  {
    item: "로그인 세션 쿠키",
    source: "GitHub 로그인 성공 시 발급",
    purpose: "로그인 상태 유지",
    table: "저장하지 않음(브라우저 쿠키, 7일 후 만료)",
  },
  {
    item: "워크스페이스 이름, 구성원 역할",
    source: "최초 로그인 시 자동 생성",
    purpose: "데이터 격리와 접근 권한 관리",
    table: "clunk_workspaces, clunk_workspace_members",
  },
  {
    item: "파일 이름, 형식, 바이트 길이, SHA-256 해시",
    source: "이용자가 검사한 에셋에서 계산",
    purpose: "검사 이력 식별, 동일 파일 재검사 판별",
    table: "clunk_assets",
  },
  {
    item: "검사 결과(점수, 위반 목록, 리포트 JSON), 최적화 작업 내역, Passport",
    source: "검사·최적화 실행 결과",
    purpose: "이력 조회, 증명서 재발급",
    table: "clunk_analysis_runs, clunk_optimization_runs, clunk_passports",
  },
  {
    item: "서버 검증 Passport(서명, 키 식별자, 검사 시각, 검사 결과)",
    source: "이용자가 ‘서버 검증’을 직접 선택해 업로드한 에셋을 서버가 검사한 결과. 업로드된 바이트 자체는 검사 직후 폐기하며 저장하지 않습니다.",
    purpose: "제3자가 대조할 수 있는 서명된 검사 증명서 발급과 재조회",
    table: "clunk_passports, clunk_analysis_runs",
  },
  {
    item: "크레딧 증감 내역과 사유, 구독 상태",
    source: "검사·최적화 실행 및 플랜 변경",
    purpose: "사용량 정산과 중복 차감 방지",
    table: "clunk_credit_ledger, clunk_credit_operations, clunk_subscriptions",
  },
] as const;

export default function PrivacyPage() {
  return (
    <LegalPage
      title="개인정보처리방침"
      summary="Clunk가 실제로 저장하는 것만 적었습니다. 아래 표의 항목은 데이터베이스 스키마와 1:1로 대응합니다."
      current="/legal/privacy"
    >
      <h2>1. 원본 에셋은 저장하지 않습니다</h2>
      <p>
        기본 동작에서 검사와 최적화는 이용자의 브라우저에서 실행됩니다. 이 경로에서 서버는 3D
        에셋의 <strong>바이트를 전송받지 않으며 저장하지도 않습니다.</strong> 서버에 남는 것은
        파일 이름, 형식, 바이트 길이, 해시와 검사 결과입니다.
      </p>
      <p>
        예외는 하나뿐이며, 그 예외는 <strong>이용자가 직접 선택해야만</strong> 일어납니다.
        ‘서버 검증 Passport’를 요청하시면 해당 파일의 바이트가 Clunk 서버로 업로드됩니다. 서버가
        직접 검사해야 서명이 의미를 갖기 때문입니다. 업로드된 바이트는 <strong>메모리에서 검사에만
        사용되고 응답을 만든 즉시 폐기</strong>되며, 파일 저장소나 데이터베이스에 기록되지
        않습니다. 남는 것은 SHA-256 해시, 검사 결과, 서명뿐입니다. 서비스에는 파일을 담아 둘
        객체 저장소 자체가 연결되어 있지 않습니다.
      </p>
      <p>
        따라서 Clunk는 나중에 원본 파일을 다시 내어 드릴 수 없습니다. 이는 제약이 아니라 설계이며,
        서버 검증을 요청하지 않은 에셋은 지금까지와 완전히 동일하게 브라우저 밖으로 나가지
        않습니다.
      </p>
      <p className="legal-callout">
        파일 이름은 그대로 저장됩니다. 파일 이름에 이름·소속 등 알려지길 원치 않는 정보가 들어
        있다면, 검사 전에 파일 이름을 바꾸시기 바랍니다.
      </p>

      <h2>2. 수집·저장 항목</h2>
      <div className="legal-table-scroll">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">항목</th>
              <th scope="col">수집 경로</th>
              <th scope="col">이용 목적</th>
              <th scope="col">저장 위치</th>
            </tr>
          </thead>
          <tbody>
            {COLLECTED.map((row) => (
              <tr key={row.table}>
                <td>{row.item}</td>
                <td>{row.source}</td>
                <td>{row.purpose}</td>
                <td>
                  <code>{row.table}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        위 항목 외에 주민등록번호, 결제카드 정보, 위치정보, 광고 식별자는 수집하지 않습니다.
        서비스는 광고·분석 목적의 제3자 추적 스크립트를 사용하지 않습니다.
      </p>

      <h2>2-1. 로그인 방법에 따른 차이</h2>
      <p>
        ChatGPT 계정으로 들어오시면 호스트가 전달한 식별자·이메일·성명을 저장합니다. GitHub
        계정으로 들어오시면 GitHub의 사용자 식별자와 로그인명, 그리고 공개 이메일을 저장합니다.
        GitHub에서 이메일을 모두 비공개로 두신 경우에는 GitHub가 제공하는 회신 불가 별칭
        주소(<code>@users.noreply.github.com</code>)를 대신 저장합니다.
      </p>
      <p>
        저희는 <strong>비밀번호를 받지도 저장하지도 않습니다.</strong> 로그인 상태는 서명된 쿠키로
        유지되며, 쿠키에는 계정 식별자와 발급·만료 시각만 들어갑니다. 이메일과 이름은 매 요청마다
        데이터베이스에서 다시 읽으므로, 계정을 삭제하시면 즉시 로그아웃됩니다.
      </p>

      <h2>3. 보관 기간과 파기</h2>
      <ul>
        <li>계정 및 워크스페이스 정보: 이용 계약이 유지되는 동안 보관하고, 해지 시 지체 없이 파기</li>
        <li>검사 이력·Passport·크레딧 기록: 워크스페이스 삭제 또는 계정 해지 시 함께 파기</li>
        <li>
          유료 결제가 시작된 이후의 거래 기록: 전자상거래법이 정하는 기간(대금 결제 및 재화 공급
          기록 5년, 소비자 불만·분쟁 처리 기록 3년) 동안 보관 후 파기
        </li>
      </ul>
      <p>파기는 데이터베이스에서 해당 레코드를 삭제하는 방식으로 즉시 이루어집니다.</p>

      <h2>4. 처리위탁</h2>
      <p>서비스 운영을 위해 아래 사업자에 처리를 위탁하며, 위탁 범위를 벗어난 이용을 금지합니다.</p>
      <div className="legal-table-scroll">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">수탁자</th>
              <th scope="col">위탁 업무</th>
              <th scope="col">처리 국가</th>
            </tr>
          </thead>
          <tbody>
            {PROCESSORS.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td>{p.role}</td>
                <td>{p.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        위 수탁자의 인프라가 국외에 있으므로 개인정보가 국외로 이전됩니다. 이전을 원하지 않는
        경우 서비스 이용을 중단하고 계정 삭제를 요청할 수 있습니다.
      </p>

      <h2>5. 제3자 제공</h2>
      <p>
        법령에 따른 요구가 있는 경우를 제외하고 개인정보를 제3자에게 제공하지 않습니다. 이용자의
        에셋과 검사 결과를 인공지능 모델의 학습에 사용하지 않습니다.
      </p>

      <h2>6. 이용자의 권리</h2>
      <p>
        이용자는 언제든지 자신의 개인정보에 대한 열람·정정·삭제·처리정지를 요구할 수 있습니다.
        요청은 아래 이메일로 접수하며, 접수일로부터 10일 이내에 처리 결과를 회신합니다.
      </p>
      <p>
        문의: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
      </p>

      <h2>7. 안전성 확보 조치</h2>
      <ul>
        <li>모든 요청은 인증된 사용자 식별자를 기준으로 워크스페이스 단위로 분리해 처리합니다.</li>
        <li>
          원본 에셋을 서버로 전송하지 않는 구조를 기본값으로 두어 유출 표면 자체를 줄였습니다.
          이용자가 명시적으로 선택한 서버 검증에서만 바이트를 전송받으며, 그 경우에도 검사 직후
          폐기하고 저장하지 않습니다.
        </li>
        <li>전송 구간은 HTTPS로 암호화됩니다.</li>
      </ul>

      <h2>8. 개인정보 보호책임자</h2>
      <p>
        보호책임자 지정 정보는 사업자 등록 후 아래 사업자 정보란에 함께 기재합니다. 그 전까지는
        위 문의 이메일이 개인정보 관련 창구입니다.
      </p>

      <h2>9. 방침의 변경</h2>
      <p>
        이 방침이 변경되는 경우 변경 내용과 시행일을 서비스 화면에 공지합니다. 이용자에게 불리한
        변경은 최소 30일 전에 공지합니다.
      </p>
    </LegalPage>
  );
}
