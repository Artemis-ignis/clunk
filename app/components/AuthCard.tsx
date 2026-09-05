import type { ReactNode } from "react";
import Link from "./NativeLink";

/**
 * 2026-09-05 — /login 과 /signup 이 쓰는 한 장의 카드.
 *
 * 문제: 두 문이 각자 마크업을 들고 있었고, 카드 안에 눈썹·제목·문장·제공자 알약·
 * 사실 띠·동의문·전환 링크가 한꺼번에 쌓여 있었습니다. 어느 것을 눌러야 하는지가
 * 화면에서 읽히지 않았습니다.
 *
 * 해결: 순서를 하나로 고정합니다 — 마크 → 제목 → 한 문장 → 기본 제공자 버튼 →
 * "또는" → 나머지 제공자 → 전환 한 줄 → 동의 한 줄. 어느 폭에서도 한 단이고,
 * 큰 버튼은 화면에 하나뿐입니다.
 *
 * 이 파일은 표현만 합니다. 어떤 제공자가 살아 있는지, 링크가 무엇인지, 동의문이
 * 무엇인지는 부르는 쪽(/login, /signup)이 정해서 넘깁니다 — 인증 판단은 문 쪽에
 * 그대로 남아 있어야 하기 때문입니다.
 */

export type AuthProviderMark = "google" | "github" | "chatgpt";

export type AuthProviderOption = {
  key: string;
  mark: AuthProviderMark;
  /** 버튼에 적히는 한 줄. 부르는 쪽이 완성해서 넘깁니다. */
  label: string;
  /** null 이면 아직 연결되지 않은 수단이라 버튼이 아니라 안내 행으로 그려집니다. */
  href: string | null;
  /** 연결 대기 상태에서 밑에 붙는 작은 글씨. */
  note?: string | null;
};

export function AuthCard({
  titleId,
  eyebrow,
  title,
  lede,
  errorMessage,
  providers,
  hint,
  actions,
  switchRow,
  legalNote,
}: {
  titleId: string;
  /** 카드 맨 위 작은 한 줄 — 로그인 뒤 돌아갈 곳. */
  eyebrow?: string | null;
  title: string;
  lede: string;
  errorMessage?: string | null;
  /** 제공자 목록. 살아 있는 첫 번째가 흰 기본 버튼이 됩니다. */
  providers: AuthProviderOption[];
  hint?: ReactNode;
  /** 이미 로그인된 브라우저에서 제공자 목록 대신 그려지는 내용. */
  actions?: ReactNode;
  switchRow: ReactNode;
  legalNote: ReactNode;
}) {

  return (
    <section className="cv5-auth-card cv5-door" aria-labelledby={titleId}>
      {eyebrow ? <p className="cv5-door-eyebrow">{eyebrow}</p> : null}
      <h1 id={titleId} className="cv5-door-title">{title}</h1>
      <p className="cv5-door-lede">{lede}</p>

      {errorMessage ? <p className="cv5-auth-alert" role="alert">{errorMessage}</p> : null}

      {actions ? (
        <div className="cv5-door-actions">{actions}</div>
      ) : (
        <div className="cv5-door-ways">
          {providers.map((option) => (
            <AuthProviderButton key={option.key} option={option} tone="secondary" />
          ))}
        </div>
      )}

      {hint}

      <div className="cv5-door-switch">{switchRow}</div>
      <div className="cv5-door-legal">{legalNote}</div>
    </section>
  );
}

function AuthProviderButton({
  option,
  tone,
}: {
  option: AuthProviderOption;
  tone: "primary" | "secondary";
}) {
  const body = (
    <>
      <span className="cv5-door-way-mark" aria-hidden="true"><ProviderMark mark={option.mark} /></span>
      <span className="cv5-door-way-label">
        {option.label}
        {option.href ? null : <small>{option.note ?? "연결 대기"}</small>}
      </span>
      <span className="cv5-door-way-tail" aria-hidden="true" />
    </>
  );

  if (!option.href) {
    return <div className="cv5-door-way" data-tone={tone} data-ready="false">{body}</div>;
  }

  return (
    <Link className="cv5-door-way" data-tone={tone} data-ready="true" href={option.href}>
      {body}
    </Link>
  );
}

/**
 * 제공자 마크는 공식 형태 그대로 인라인 SVG 로 둡니다. 외부 이미지를 부르면 버튼이
 * 늦게 완성되고, 그 사이 흰 버튼 위에 빈 네모가 앉습니다.
 */
function ProviderMark({ mark }: { mark: AuthProviderMark }) {
  if (mark === "google") {
    return (
      <svg viewBox="0 0 48 48" width="20" height="20" focusable="false" aria-hidden="true">
        <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
        <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
        <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
        <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
      </svg>
    );
  }

  if (mark === "github") {
    return (
      <svg viewBox="0 0 24 24" width="19" height="19" focusable="false" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.74.8 1.18 1.83 1.18 3.08 0 4.41-2.7 5.38-5.27 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" width="19" height="19" focusable="false" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"
      />
    </svg>
  );
}
