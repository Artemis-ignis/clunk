"use client";

import { useEffect, useState } from "react";

import Link from "../NativeLink";

/**
 * 내비에 걸리는 크레딧 지갑.
 *
 * 2026-09-03(운영자): "크레딧은 일종의 코인처럼 우측 상단에 보이게 해야 실제 가챠 머신
 * 돌리는 느낌이 난다. 실시간으로 코인이 돌아가거나 반짝이게." — 처음에는 첫 화면의 무대
 * 안에 띄웠지만, 지갑은 첫 화면에만 있는 물건이 아니다. 같은 날 두 번째 지시로 내비 안의
 * 알약으로 들어왔다: 어느 화면에서나 같은 자리에 있고, 무대 위 층을 하나 덜어 준다.
 *
 * 여기의 숫자는 전부 서버가 준 값이다.
 *  · 잔액        /api/credits 의 credits (로그인했을 때만 부른다 — 401 을 콘솔에 남기지 않는다)
 *  · 가입 지급분 /api/credits/packs 의 access.a_signed_in_workspace_adds.credits_on_signup
 *                (서버의 SIGNUP_GRANT_CREDITS 를 그대로 싣는 그 접근 계약이다)
 * 이 파일에는 크레딧 숫자가 하나도 적혀 있지 않다.
 *
 * "+" 는 충전 단추가 아니다. 결제는 아직 열려 있지 않으므로 살 수 있다고 말하지 않고,
 * 요금 화면(/pricing)으로 데려다 줄 뿐이다.
 */

type CreditsPayload = { ok?: boolean; credits?: number };
type PacksPayload = {
  access?: { a_signed_in_workspace_adds?: { credits_on_signup?: number } };
};

export type CoinHudProps = {
  /** 로그인 여부. 내비가 이미 물어본 /api/session 의 대답을 그대로 받는다. */
  authenticated: boolean;
  /** 가입 문. 내비가 지금 보던 화면을 return_to 로 달아 준다. */
  joinHref: string;
};

/** 돌면서 반짝이는 동전 한 닢. CSS 로만 지은 원반이라 그림 파일이 없다. */
function Coin() {
  return (
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
}

export function CoinHud({ authenticated, joinHref }: CoinHudProps) {
  const [credits, setCredits] = useState<number | null>(null);
  const [signupGrant, setSignupGrant] = useState<number | null>(null);

  /* 잔액 — 로그인했을 때만 묻는다. */
  useEffect(() => {
    if (!authenticated) return;
    let alive = true;
    void fetch("/api/credits", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json() as CreditsPayload;
        if (alive && typeof payload.credits === "number") setCredits(payload.credits);
      })
      .catch(() => { /* 못 읽으면 자리를 비워 둔다 — 지어낸 잔액을 적지 않는다. */ });
    return () => { alive = false; };
  }, [authenticated]);

  /* 가입 지급분 — 로그아웃일 때만 필요하다. 공개 경로이고 60초 캐시가 걸려 있다. */
  useEffect(() => {
    if (authenticated) return;
    let alive = true;
    void fetch("/api/credits/packs")
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json() as PacksPayload;
        const grant = payload.access?.a_signed_in_workspace_adds?.credits_on_signup;
        if (alive && typeof grant === "number") setSignupGrant(grant);
      })
      .catch(() => { /* 모르는 숫자를 지어내느니 알약을 걸지 않는다. */ });
    return () => { alive = false; };
  }, [authenticated]);

  if (!authenticated) {
    // 지급분을 아직 못 읽었으면 아무것도 걸지 않는다 — 내비가 그만큼 좁아질 뿐이다.
    if (signupGrant === null) return null;
    return (
      <Link className="gc-coin-pill gc-coin-join" href={joinHref} prefetch={false} data-signed-out="">
        <Coin />
        <b>로그인하면 {signupGrant}크레딧</b>
      </Link>
    );
  }

  const known = typeof credits === "number";

  return (
    <div className="gc-coin-pill">
      <Coin />
      <span className="gc-coin-read">
        <b
          className="gc-coin-count"
          aria-live="polite"
          aria-label={known ? `보유 크레딧 ${credits}` : "보유 크레딧 확인 중"}
        >
          {/* 잔액을 아직 못 읽은 동안에는 대시를 적지 않는다 — 대시는 "0 도 아니고 오류도
              아닌" 상태를 결함처럼 보이게 한다(운영자 2026-09-03). 숫자 자리를 그대로 둔
              은은한 자리표시가 들어가고, 값이 오면 그 자리에 앉는다. */}
          {known ? (credits as number).toLocaleString("ko-KR") : <span className="gc-coin-wait" aria-hidden="true" />}
        </b>
        <span className="gc-coin-unit" aria-hidden="true">C</span>
      </span>
      {/* 충전은 아직 열려 있지 않다. 사겠다고 말하지 않고 요금 화면으로만 데려간다. */}
      <Link
        className="gc-coin-plus"
        href="/pricing"
        prefetch={false}
        aria-label="크레딧 요금 보기"
        title="크레딧 요금 보기"
      >
        <span aria-hidden="true">+</span>
      </Link>
    </div>
  );
}
