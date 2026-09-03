"use client";

import Link from "../NativeLink";

/**
 * 무대 오른쪽 위의 동전 계수기.
 *
 * 2026-09-03(운영자): "크레딧은 일종의 코인처럼 우측 상단에 보이게 해야 실제 가챠 머신
 * 돌리는 느낌이 난다. 실시간으로 코인이 돌아가거나 반짝이게." — 잔액을 아래 판의 글줄로
 * 적어 두면 화면을 내리기 전에는 아무도 보지 못한다. 오락실 기계의 크레딧 표시처럼 무대
 * 안, 내비 바로 밑에 걸어 두고 동전이 계속 돈다.
 *
 * 여기의 숫자는 전부 서버가 준 값이다 — 잔액은 /api/credits, 가입 지급분은 /api/marketplace
 * 응답의 access 블록(SIGNUP_GRANT_CREDITS 를 그대로 실어 준다)이다. 이 파일에는 크레딧
 * 숫자가 하나도 적혀 있지 않다.
 *
 * 뽑기는 크레딧을 쓰지 않는다. 레버가 내려가면 동전이 한 바퀴 넘어가지만 숫자는 그대로다 —
 * 있지도 않은 차감을 흉내 내지 않는다.
 */

export type CoinHudProps = {
  /** 로그인 여부(/api/session). */
  authenticated: boolean;
  /** 잔액(/api/credits). 아직 못 읽었으면 null. */
  credits: number | null;
  /**
   * 뽑기가 크레딧을 쓰지 않는 동안 참. 카드가 값을 지울 때 쓰는 그 플래그(beta)와 같은
   * 값이라, 결제가 열리는 날 두 곳이 함께 바뀐다.
   */
  freePulls: boolean;
  /**
   * 가입하면 들어오는 크레딧. /api/marketplace 의 access.a_signed_in_workspace_adds
   * .credits_on_signup 이고, 그 값은 서버의 SIGNUP_GRANT_CREDITS 다. 아직 못 읽었으면 null.
   */
  signupGrant: number | null;
  /** 가입 문. 뽑은 것이 있으면 그 상품 페이지로 돌아온다. */
  loginHref: string;
  /** 레버가 내려가 캡슐이 떨어지는 동안 참 — 동전이 한 바퀴 넘어간다. */
  inserting: boolean;
};

export function CoinHud({
  authenticated,
  credits,
  freePulls,
  signupGrant,
  loginHref,
  inserting,
}: CoinHudProps) {
  // 로그아웃 상태에서 지급분을 아직 못 읽었으면 아무것도 걸지 않는다. 모르는 숫자를
  // 지어내느니 자리를 비워 두는 편이 낫다.
  if (!authenticated && signupGrant === null) return null;

  const coin = (
    <span className="gc-coin" aria-hidden="true">
      <span className="gc-coin-spin">
        <span className="gc-coin-face">
          <i>C</i>
          {/* 표면을 훑는 빛. 면 안에 있어야 동전이 옆으로 설 때 함께 사라진다. */}
          <span className="gc-coin-shine" />
        </span>
        <span className="gc-coin-back" />
        {/* 옆면. 두 면이 옆으로 설 때 이것이 정면으로 돌아와 동전에 두께를 준다. */}
        <span className="gc-coin-rim" />
      </span>
      <span className="gc-coin-sparkle" />
    </span>
  );

  if (!authenticated) {
    return (
      <div className="gc-coin-hud" data-signed-out="" data-insert={inserting ? "" : undefined}>
        <Link className="gc-coin-body gc-coin-join" href={loginHref} prefetch={false}>
          {coin}
          <b>로그인하면 {signupGrant}크레딧</b>
        </Link>
      </div>
    );
  }

  const known = typeof credits === "number";

  return (
    <div className="gc-coin-hud" data-insert={inserting ? "" : undefined}>
      {coin}
      <span className="gc-coin-body">
        <span className="gc-coin-read">
          <b
            className="gc-coin-count"
            aria-live="polite"
            aria-label={known ? `보유 크레딧 ${credits}` : "보유 크레딧 확인 중"}
          >
            {known ? (credits as number).toLocaleString("ko-KR") : "—"}
          </b>
          <span className="gc-coin-unit">크레딧</span>
        </span>
        {freePulls ? <small className="gc-coin-note">뽑기는 무료</small> : null}
      </span>
    </div>
  );
}
