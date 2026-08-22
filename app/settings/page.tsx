import type { Metadata } from "next";
import Link from "next/link";
import { requireUser, SELF_SIGN_OUT_PATH } from "../auth-provider";
import { Icon } from "../components/Icon";
import { WorkspaceShell } from "../components/WorkspaceShell";
import { AccountDataControls } from "./AccountDataControls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "설정",
  description: "무엇이 저장되는지 확인하고, 내 데이터를 내려받거나 계정을 지웁니다.",
};

export default async function SettingsPage() {
  const user = await requireUser("/settings");

  const viaChatGPT = user.provider === "chatgpt";

  const rows = [
    {
      label: "계정",
      value: user.email,
      note: viaChatGPT
        ? "ChatGPT가 전달한 인증 헤더에서 확인합니다."
        : "GitHub 계정에서 확인한 주소입니다.",
    },
    { label: "워크스페이스", value: `${user.displayName}님의 워크스페이스`, note: "인증된 API를 처음 호출할 때 생성됩니다." },
    {
      label: "인증",
      value: viaChatGPT ? "ChatGPT SIWC" : "GitHub 계정",
      note: "어느 쪽이든 Clunk는 자체 이메일과 비밀번호 데이터베이스를 만들지 않습니다.",
    },
    { label: "저장", value: "브라우저에서 처리, 결과만 서버에", note: "에셋 파일을 보관하는 저장소는 연결되어 있지 않습니다." },
  ];

  const notStored = [
    {
      label: "원본 에셋 바이트",
      note: "GLB와 GLTF는 기본적으로 브라우저에서만 열립니다. 서버 검증 Passport를 직접 요청한 파일만 업로드되고, 그 바이트도 검사 직후 폐기되어 저장되지 않습니다.",
    },
    { label: "비밀번호", note: "인증은 계정 제공자가 확인해 준 신원으로만 처리하고, 자체 자격 증명을 만들지 않습니다." },
    { label: "결제 수단", note: "결제 제공자를 연결하지 않았으므로 카드 정보를 받는 경로가 없습니다." },
    { label: "최적화 결과 파일", note: "다운로드는 브라우저에서 바로 만들고, R2 보관은 꺼 두었습니다." },
  ];

  return (
    <WorkspaceShell active="settings" title="설정" userLabel={user.displayName}>
      <section className="ws-welcome">
        <div>
          <h2>
            내 계정과
            <br />
            <em>내 데이터.</em>
          </h2>
          <p>
            무엇이 저장되고 무엇이 저장되지 않는지 확인하고, 내 데이터를 통째로 내려받거나 계정을
            지울 수 있습니다.
          </p>
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
            저장하는 값은 파일 이름, 형식, 바이트 길이, 해시, 정책 ID, 점수, finding 요약, 결과 digest입니다.
          </p>
        </aside>
      </div>

      <AccountDataControls />

      <div className="settings-actions">
        <Link href="/app" className="button button-primary">
          검사기로 돌아가기
          <Icon name="arrowUpRight" size={15} />
        </Link>
        <Link href="/docs" className="button button-quiet">
          연동 문서
          <Icon name="arrowRight" size={15} />
        </Link>
        {/* Only the self-hosted session is ours to end. A ChatGPT Sites session belongs to
            the host, so offering a sign-out here would clear nothing the visitor can see. */}
        {viaChatGPT ? null : (
          <form method="post" action={SELF_SIGN_OUT_PATH}>
            <input type="hidden" name="return_to" value="/" />
            <button type="submit" className="button button-quiet">
              로그아웃
              <Icon name="arrowRight" size={15} />
            </button>
          </form>
        )}
      </div>
    </WorkspaceShell>
  );
}
