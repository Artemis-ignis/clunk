import { BETA_MONTHLY_GRANT_CREDITS, SIGNUP_GRANT_CREDITS } from "./api/_lib/clunk";
// 가입 직후 계량기는 가입분(SIGNUP_GRANT_CREDITS)과 그달 지급분(BETA_MONTHLY_GRANT_CREDITS, 첫 요청에
// 바로 들어온다)의 합을 보여 준다(2026-09-05 QA 실측 55). 문장도 그 합을 말하고 내역을 괄호에 둔다.
// 그 문장은 가입을 마친 사람이 작업공간에서 읽는 welcome 한 줄에만 남았다 —
// 2026-09-05 마스터 지시로 로그인·가입 화면에서는 지급 횟수를 말하지 않는다.

/**
 * 2026-09-03 — 가입 흐름의 문구가 사는 곳.
 *
 * 문제: 로그인하지 않은 사람이 무엇을 눌렀든 전부 /login 으로 갔고, /login 의 문구는
 * "돌아오는 사람"을 위해 쓰여 있었습니다. 처음 온 사람은 자기가 누른 것과 아무 상관 없는
 * 화면을 만났습니다.
 *
 * 해결: 의도(intent)는 return_to 안에 실려 다닙니다(`/studio?intent=create`). OAuth 상태
 * 스키마는 그대로 두고, 이미 검증되는 return_to 의 쿼리를 그대로 씁니다. 가입/로그인 화면은
 * 그 의도를 읽어 자기가 눌린 이유를 그대로 말합니다.
 *
 * 화면에 나오는 숫자는 전부 그 숫자를 강제하는 모듈에서 옵니다. 여기에 직접 타이핑하면
 * 원장과 어긋난 약속이 되고, 그건 지어낸 숫자와 같습니다.
 */

export type AuthIntent = "create" | "inspect" | "agents" | "market";

/** 어느 문으로 들어왔는가. 처음 온 사람은 /signup, 돌아온 사람은 /login. */
export type AuthDoor = "signup" | "login";

/**
 * 2026-09-05 — 문 한 장이 말하는 것은 두 가지뿐이다: 제목 한 줄과 그 아래 한 문장.
 * 배지·사실 띠·알약 옆 작은 글씨는 카드에서 사라졌다. 눈썹 한 줄은 돌아갈 곳을
 * 말하므로 문구가 아니라 return_to 에서 나온다(returnWithParticle).
 */
export type AuthCardCopy = {
  /** 큰 제목 한 줄. */
  h1: string;
  /** 제목 아래 한 문장. */
  lede: string;
};

export type AuthIntentCopy = {
  signup: AuthCardCopy;
  login: AuthCardCopy;
  /** 가입 직후 작업공간 위에 한 줄로 뜨는 문장. */
  welcome: string;
};

const AUTH_INTENTS: readonly AuthIntent[] = ["create", "inspect", "agents", "market"];

export function isAuthIntent(value: unknown): value is AuthIntent {
  return typeof value === "string" && (AUTH_INTENTS as readonly string[]).includes(value);
}

/**
 * 문 한 장의 문구. 2026-09-05 마스터: 제목 한 낱말과 짧은 한 문장이면 된다 —
 * "이전 화면으로 돌아갑니다 / 다시 오셨군요 / 비밀번호를 만들지도 보관하지도…" 같은
 * 설명은 전부 뺀다(참고: polyfork.dev 의 Sign in 카드). 의도(intent)는 돌아갈 곳을
 * 정할 뿐 문구를 바꾸지 않는다. 가입 직후 대시보드의 환영 한 줄만 의도별로 남긴다.
 */
const DOOR_COPY: Pick<AuthIntentCopy, "signup" | "login"> = {
  signup: { h1: "가입", lede: "Google이나 GitHub 계정으로 바로 시작합니다." },
  login: { h1: "로그인", lede: "계정 하나로 받은 에셋과 검사 기록을 관리합니다." },
};

/** 아무 의도도 실려 오지 않았을 때의 문구. 두 문의 기본값이다. */
export const DEFAULT_AUTH_COPY: AuthIntentCopy = {
  ...DOOR_COPY,
  welcome: `만들기·검사 ${SIGNUP_GRANT_CREDITS + BETA_MONTHLY_GRANT_CREDITS}회(가입 ${SIGNUP_GRANT_CREDITS}회 + 이달 ${BETA_MONTHLY_GRANT_CREDITS}회)가 들어왔습니다 · 무엇을 만들지 골라 보세요`,
};

export const INTENT_COPY: Record<AuthIntent, AuthIntentCopy> = {
  create: { ...DOOR_COPY, welcome: `만들기·검사 ${SIGNUP_GRANT_CREDITS + BETA_MONTHLY_GRANT_CREDITS}회(가입 ${SIGNUP_GRANT_CREDITS}회 + 이달 ${BETA_MONTHLY_GRANT_CREDITS}회)가 들어왔습니다 · 첫 에셋을 만들어 보세요`, },
  inspect: { ...DOOR_COPY, welcome: `만들기·검사 ${SIGNUP_GRANT_CREDITS + BETA_MONTHLY_GRANT_CREDITS}회(가입 ${SIGNUP_GRANT_CREDITS}회 + 이달 ${BETA_MONTHLY_GRANT_CREDITS}회)가 들어왔습니다 · 파일 하나를 올려 검사해 보세요`, },
  agents: { ...DOOR_COPY, welcome: `만들기·검사 ${SIGNUP_GRANT_CREDITS + BETA_MONTHLY_GRANT_CREDITS}회(가입 ${SIGNUP_GRANT_CREDITS}회 + 이달 ${BETA_MONTHLY_GRANT_CREDITS}회)가 들어왔습니다 · 키를 만들면 바로 연결됩니다`, },
  market: { ...DOOR_COPY, welcome: `만들기·검사 ${SIGNUP_GRANT_CREDITS + BETA_MONTHLY_GRANT_CREDITS}회(가입 ${SIGNUP_GRANT_CREDITS}회 + 이달 ${BETA_MONTHLY_GRANT_CREDITS}회)가 들어왔습니다 · 마켓에서 에셋을 받아 보세요`, },
};

/**
 * return_to 안에 실려 온 의도를 읽는다. 쿼리에 적힌 값이 먼저고, 없으면 경로에서 유추한다.
 * 어느 쪽도 아니면 null — 그때는 오늘까지 쓰던 기본 문구가 나온다.
 */
export function intentFromReturnTo(returnTo: string): AuthIntent | null {
  let url: URL;
  try {
    url = new URL(returnTo, "https://clunk.local");
  } catch {
    return null;
  }

  const declared = url.searchParams.get("intent");
  if (isAuthIntent(declared)) return declared;

  const pathname = url.pathname;
  if (pathname === "/studio" || pathname.startsWith("/studio/")) return "create";
  if (pathname === "/app" || pathname.startsWith("/app/")) return "inspect";
  if (pathname === "/agents" || pathname.startsWith("/agents/")) return "agents";
  if (pathname === "/marketplace" || pathname.startsWith("/marketplace/")) return "market";
  return null;
}

/** 눈썹에 날 것의 경로("/app")를 찍지 않기 위한 이름표. 사람은 경로로 가지 않는다. */
export function returnLabel(path: string): string {
  if (path.startsWith("/dashboard")) return "대시보드";
  if (path.startsWith("/app")) return "에셋 검사";
  if (path.startsWith("/studio")) return "에셋 제작";
  if (path.startsWith("/marketplace")) return "에셋 마켓";
  if (path.startsWith("/agents")) return "에이전트 연결";
  if (path.startsWith("/review")) return "검수 뷰어";
  return "이전 화면";
}

/**
 * 눈썹 한 줄이 쓰는 "대시보드로 / 에셋 제작으로". 조사를 손으로 적으면 돌아갈 곳이
 * 하나 늘 때마다 "에셋 마켓로"가 생긴다 — 받침으로 고른다(ㄹ 받침은 "로").
 */
export function returnWithParticle(path: string): string {
  const label = returnLabel(path);
  const last = label.codePointAt(label.length - 1) ?? 0;
  const isHangulSyllable = last >= 0xac00 && last <= 0xd7a3;
  const jongseong = isHangulSyllable ? (last - 0xac00) % 28 : 0;
  // 받침이 없거나(0) ㄹ(8)이면 "로", 그 밖에는 "으로".
  return `${label}${jongseong === 0 || jongseong === 8 ? "로" : "으로"}`;
}

/** 한 문(door)이 이 의도에서 쓰는 문구. */
export function authCardCopy(door: AuthDoor, intent: AuthIntent | null): AuthCardCopy {
  return (intent ? INTENT_COPY[intent] : DEFAULT_AUTH_COPY)[door];
}

/** 가입 직후 작업공간 위에 한 줄로 뜨는 문장. */
export function welcomeLine(intent: AuthIntent | null): string {
  return (intent ? INTENT_COPY[intent] : DEFAULT_AUTH_COPY).welcome;
}
