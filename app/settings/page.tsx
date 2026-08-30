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

export default async function SettingsPage() {
  const user = await requireChatGPTUser("/settings");

  const rows = [
    { label: "계정", value: user.email, note: "ChatGPT가 전달한 인증 헤더에서 확인합니다." },
    { label: "워크스페이스", value: `${user.displayName}님의 워크스페이스`, note: "인증된 API를 처음 호출할 때 생성됩니다." },
    { label: "인증", value: "ChatGPT SIWC", note: "v1에서는 앱 자체 이메일과 비밀번호 데이터베이스를 만들지 않습니다." },
    { label: "저장", value: "D1 메타데이터와 비공개 R2 artifact", note: "인증된 워크스페이스에 결과 bundle을 보관하고, 입력 원본은 덮어쓰지 않습니다." },
  ];

  const notStored = [
    { label: "원본 에셋 바이트", note: "GLB와 GLTF는 브라우저에서만 열립니다. 서버로 업로드하지 않습니다." },
    { label: "비밀번호", note: "인증은 ChatGPT가 전달한 헤더로만 처리하고, 자체 자격 증명을 만들지 않습니다." },
    { label: "결제 수단", note: "결제 제공자를 연결하지 않았으므로 카드 정보를 받는 경로가 없습니다." },
    { label: "원본 덮어쓰기", note: "검사·최적화는 별도 output과 Passport를 만들며 입력 원본을 수정하지 않습니다." },
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
          <p>ChatGPT 로그인으로 워크스페이스를 보호합니다. 원본 입력과 결과 artifact의 저장 경계를 분리해 표시합니다.</p>
        </div>
        <div className="settings-boundary-visual" aria-label="Clunk 저장 경계 시각 안내">
          <div className="settings-boundary-topline"><span><i /> STORAGE MAP</span><strong>PRIVATE OUTPUT ONLY</strong></div>
          <div className="settings-boundary-stage">
            <div className="settings-boundary-file"><span>01</span><strong>asset.glb</strong><small>browser bytes</small></div>
            <b>→</b>
            <div className="settings-boundary-file is-safe"><span>02</span><strong>evidence.json</strong><small>hash · policy · finding</small></div>
            <b>→</b>
            <div className="settings-boundary-file is-safe"><span>03</span><strong>R2</strong><small>private artifact</small></div>
          </div>
          <p>원본 바이트와 저장되는 근거를 분리해 보여줍니다.</p>
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

      <div className="settings-actions">
        <Link href="/app" className="button button-primary">
          검사기로 돌아가기
          <Icon name="arrowUpRight" size={15} />
        </Link>
        <Link href="/docs" className="button button-quiet">
          연동 문서
          <Icon name="arrowRight" size={15} />
        </Link>
        <Link href={chatGPTSignOutPath("/")} className="button button-quiet">
          이 브라우저에서 로그아웃
          <Icon name="arrowRight" size={15} />
        </Link>
      </div>

      <p className="muted-note">
        로그아웃은 이 브라우저의 Clunk 세션 쿠키를 즉시 만료시킵니다. ChatGPT 등 인증 제공자
        자체의 로그인 상태는 해당 제공자가 관리하므로 Clunk가 종료하지 않습니다.
      </p>
    </WorkspaceShell>
  );
}
