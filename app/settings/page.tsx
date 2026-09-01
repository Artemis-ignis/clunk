import Link from "../components/NativeLink";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import { Icon } from "../components/Icon";
import { WorkspaceShell } from "../components/WorkspaceShell";
import { createPageMetadata } from "../components/site-metadata";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({
  title: "설정",
  description: "계정과 워크스페이스 저장 경계를 확인합니다.",
  path: "/settings",
});

/** Truthful copy for whichever identity the current session actually used. */
function authDescription(provider: string): {
  label: string;
  lede: string;
  accountNote: string;
  passwordNote: string;
} {
  if (provider === "google" || provider === "github") {
    const name = provider === "google" ? "Google" : "GitHub";
    return {
      label: `${name} OAuth`,
      lede: `${name} 계정 로그인으로 워크스페이스를 보호합니다.`,
      accountNote: `${name} OAuth가 반환한 프로필에서 확인합니다.`,
      passwordNote: `인증은 ${name}가 처리하며 Clunk는 자격 증명을 보관하지 않습니다.`,
    };
  }
  if (provider === "qa") {
    return {
      label: "임시 접속 세션",
      lede: "임시 접속으로 열린 작업실입니다.",
      accountNote: "접속할 때 발급된 세션에서 확인합니다.",
      passwordNote: "Clunk는 비밀번호를 저장하지 않습니다.",
    };
  }
  return {
    label: "ChatGPT 로그인",
    lede: "ChatGPT 로그인으로 워크스페이스를 보호합니다.",
    accountNote: "ChatGPT가 전달한 인증 헤더에서 확인합니다.",
    passwordNote: "인증은 ChatGPT가 전달한 헤더로만 처리하고, 자체 자격 증명을 만들지 않습니다.",
  };
}

export default async function SettingsPage() {
  const user = await requireChatGPTUser("/settings");

  // The page used to state "ChatGPT SIWC" for every session, which is false on
  // a QA-key or OAuth login (2026-08-31 review). Name the real provider.
  const auth = authDescription(user.provider);

  const rows = [
    { label: "계정", value: user.email, note: auth.accountNote },
    { label: "워크스페이스", value: `${user.displayName}님의 워크스페이스`, note: "인증된 API를 처음 호출할 때 생성됩니다." },
    { label: "인증", value: auth.label, note: "Clunk는 자체 이메일·비밀번호 데이터베이스를 만들지 않습니다." },
    { label: "저장", value: "D1 메타데이터와 비공개 R2 artifact", note: "인증된 워크스페이스에 결과 bundle을 보관하고, 입력 원본은 덮어쓰지 않습니다." },
  ];

  const notStored = [
    { label: "원본 에셋 바이트", note: "GLB와 GLTF는 브라우저에서만 열립니다. 서버로 업로드하지 않습니다." },
    { label: "비밀번호", note: auth.passwordNote },
    { label: "결제 수단", note: "카드 정보는 Clunk 서버에 저장하지 않습니다." },
    { label: "원본 덮어쓰기", note: "검사와 최적화는 새 파일을 만들 뿐 원본을 바꾸지 않습니다." },
  ];

  return (
    <WorkspaceShell active="settings" title="설정" userLabel={user.displayName}>
      <section className="ws-welcome settings-welcome">
        <div>
          <h2>
            경계를
            <br />
            <em>명확하게 유지합니다.</em>
          </h2>
          <p>{auth.lede} 무엇이 저장되고 무엇이 저장되지 않는지 아래에 정리했습니다.</p>
        </div>
        <div className="settings-boundary-visual" aria-label="Clunk 저장 경계 시각 안내">
          <div className="settings-boundary-topline"><span><i /> 저장 범위</span><strong>내 파일만 저장</strong></div>
          <div className="settings-boundary-stage">
            <div className="settings-boundary-file"><span>01</span><strong>내 GLB 파일</strong><small>브라우저에서만 열림</small></div>
            <b>→</b>
            <div className="settings-boundary-file is-safe"><span>02</span><strong>검사 결과</strong><small>점수와 발견된 문제</small></div>
            <b>→</b>
            <div className="settings-boundary-file is-safe"><span>03</span><strong>내 저장소</strong><small>나만 볼 수 있음</small></div>
          </div>
          <p>원본 파일은 서버에 올라가지 않습니다.</p>
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
        </div>

        <aside className="panel settings-aside">
          <div className="panel-head">
            <div>
              <span className="mono-label">저장 경계</span>
              <h3>보관하지 않는 것</h3>
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
            파일 이름, 크기, 검사 점수, 발견된 문제만 저장합니다.
          </p>
        </aside>
      </div>

      <div className="settings-actions">
        <Link href="/app" className="button button-primary">
          에셋 검사하러 가기
          <Icon name="arrowUpRight" size={15} />
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
