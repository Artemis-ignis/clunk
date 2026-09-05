import Link from "../components/NativeLink";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import { Icon } from "../components/Icon";
import { WorkspaceShell } from "../components/WorkspaceShell";
import { createPageMetadata } from "../components/site-metadata";
import { MarketingConsentToggle } from "./MarketingConsentToggle";
import { areSalesOpen } from "../api/_lib/sales-lock";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({
  title: "설정",
  description: "내 계정과, Clunk가 무엇을 저장하고 무엇을 저장하지 않는지 확인합니다.",
  path: "/settings",
});

/** 이번 로그인이 실제로 쓴 방식만 그대로 적습니다. */
function authDescription(provider: string): {
  label: string;
  lede: string;
  accountNote: string;
  passwordNote: string;
} {
  if (provider === "google" || provider === "github") {
    const name = provider === "google" ? "Google" : "GitHub";
    return {
      label: `${name} 계정으로 로그인`,
      lede: `${name} 계정으로 들어온 작업공간입니다.`,
      accountNote: `${name} 계정에서 받은 정보입니다.`,
      passwordNote: `로그인은 ${name}에서 처리하고, Clunk는 비밀번호를 받지도 보관하지도 않습니다.`,
    };
  }
  if (provider === "qa") {
    return {
      label: "임시 접속",
      lede: "임시 접속으로 열린 작업공간입니다.",
      accountNote: "접속할 때 발급된 임시 정보에서 가져왔습니다.",
      passwordNote: "Clunk는 비밀번호를 저장하지 않습니다.",
    };
  }
  return {
    label: "ChatGPT 로그인",
    lede: "ChatGPT 로그인으로 들어온 작업공간입니다.",
    accountNote: "ChatGPT가 전달한 로그인 정보에서 가져왔습니다.",
    passwordNote: "로그인은 ChatGPT가 처리하고, Clunk는 따로 아이디와 비밀번호를 만들지 않습니다.",
  };
}

export default async function SettingsPage() {
  const user = await requireChatGPTUser("/settings");

  // 예전에는 어떤 로그인이든 "ChatGPT SIWC"라고 적었는데, Google·GitHub·임시 접속에서는
  // 사실이 아니었습니다(2026-08-31 점검). 지금은 실제로 쓴 방식만 적습니다.
  const auth = authDescription(user.provider);
  // 결제가 열렸는지는 이 화면이 판단하지 않는다. 실제로 결제를 막고 있는 값에서 읽는다.
  const salesOpen = areSalesOpen();

  const rows = [
    { label: "계정", value: user.email, note: auth.accountNote },
    {
      label: "대시보드",
      value: `${user.displayName}님의 대시보드`,
      note: "처음 로그인할 때 자동으로 만들어졌습니다. 여기에 만든 파일과 검사 결과가 쌓입니다.",
    },
    { label: "로그인 방식", value: auth.label, note: "Clunk는 따로 아이디와 비밀번호를 만들지 않습니다." },
    // 사이드바에는 "지금 요금 · 무료"가 늘 떠 있는데 설정에는 요금 이야기가 한 줄도 없어서,
    // 무엇을 쓰고 있는지 확인하러 온 사람이 갈 곳이 없었다. 판매가 닫혀 있다는 사실은
    // 이 파일이 아니라 sales-lock 이 정한다.
    {
      label: "지금 요금제",
      value: salesOpen ? "유료 요금제 사용 중" : "무료 (베타)",
      note: salesOpen
        ? "요금제와 결제 내역은 요금 화면에서 확인합니다."
        : "베타 동안 모든 기능이 열려 있고, 결제 기능은 아직 없습니다. 앞으로 적용될 요금은 요금 화면에 미리 적어 두었습니다.",
    },
    {
      label: "저장하는 것",
      value: "검사 결과와 내가 만든 파일",
      note: "만든 파일은 나만 볼 수 있는 저장소에 보관합니다. 검사에 올린 원본은 그대로 두고 덮어쓰지 않습니다.",
    },
  ];

  const notStored = [
    { label: "검사에 올린 원본 파일", note: "GLB와 GLTF는 브라우저 안에서만 열립니다. 서버로 올라가지 않습니다." },
    { label: "비밀번호", note: auth.passwordNote },
    { label: "결제 수단", note: "카드 정보는 Clunk 서버에 저장하지 않습니다. 지금은 결제 기능이 없어 결제 자체를 받지 않습니다." },
    { label: "원본 덮어쓰기", note: "검사와 정리는 새 파일을 만들 뿐 원본을 바꾸지 않습니다." },
  ];

  return (
    <WorkspaceShell active="settings" title="설정" userLabel={user.displayName}>
      <section className="ws-welcome settings-welcome">
        <div>
          <h2>
            무엇을 저장하는지
            <br />
            <em>숨기지 않습니다.</em>
          </h2>
          <p>{auth.lede} 무엇이 저장되고 무엇이 저장되지 않는지 아래에 그대로 적었습니다.</p>
        </div>
        <div className="settings-boundary-visual" aria-label="Clunk가 저장하는 범위">
          <div className="settings-boundary-topline"><span><i /> 저장 범위</span><strong>내 파일만 저장</strong></div>
          <div className="settings-boundary-stage">
            <div className="settings-boundary-file"><span>01</span><strong>내 GLB 파일</strong><small>브라우저에서만 열림</small></div>
            <b>→</b>
            <div className="settings-boundary-file is-safe"><span>02</span><strong>검사 결과</strong><small>점수와 발견된 문제</small></div>
            <b>→</b>
            <div className="settings-boundary-file is-safe"><span>03</span><strong>내 저장소</strong><small>나만 볼 수 있음</small></div>
          </div>
          <p>검사에 올린 원본 파일은 서버로 올라가지 않습니다.</p>
        </div>
      </section>

      <div className="settings-grid">
        <div className="panel settings-panel">
          <dl className="settings-list">
            {rows.map((row) => (
              <div key={row.label} className="settings-row">
                <dt>{row.label}</dt>
                <dd>
                  <strong>{row.value}</strong>
                  <small>{row.note}</small>
                </dd>
              </div>
            ))}
          </dl>
          <MarketingConsentToggle />
        </div>

        <aside className="panel settings-aside">
          <div className="panel-head">
            <div>
              <span className="mono-label">저장하지 않는 것</span>
              <h3>보관하지 않습니다</h3>
            </div>
          </div>
          <ul className="settings-negative">
            {notStored.map((item) => (
              <li key={item.label}>
                <Icon name="shield" size={15} />
                <span>
                  <strong>{item.label}</strong>
                  {item.note}
                </span>
              </li>
            ))}
          </ul>
          <p className="muted-note">
            파일 이름, 파일 크기, 검사 점수, 발견된 문제만 저장합니다.
          </p>
        </aside>
      </div>

      <div className="settings-actions">
        <Link href="/app" className="button button-primary">
          내 파일 검사하러 가기
          <Icon name="arrowUpRight" size={15} />
        </Link>
        <Link href="/pricing" className="button button-quiet">
          요금과 실행 횟수 보기
          <Icon name="arrowRight" size={15} />
        </Link>
        <Link href="/docs" className="button button-quiet">
          도움말 보기
          <Icon name="arrowRight" size={15} />
        </Link>
        <Link href={chatGPTSignOutPath("/")} className="button button-quiet">
          이 브라우저에서 로그아웃
          <Icon name="arrowRight" size={15} />
        </Link>
      </div>

      <p className="muted-note">
        이 브라우저에서만 로그아웃됩니다. Google·GitHub 계정 로그인은 그대로 유지됩니다.
      </p>
    </WorkspaceShell>
  );
}
