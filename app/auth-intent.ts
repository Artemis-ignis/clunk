import { BETA_MONTHLY_GRANT_CREDITS, SIGNUP_GRANT_CREDITS } from "./api/_lib/clunk";
import { WORKSPACE_IMAGES_PER_DAY } from "./api/_lib/ai-budget";

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

export type AuthCardCopy = {
  /** 카드 맨 위의 아주 작은 배지. */
  badge: string;
  /** 큰 제목 한 줄. */
  h1: string;
  /** 제목 아래 한 문장. */
  lede: string;
  /** 카드 아래 회색 한 줄에 " · " 로 이어 붙는 짧은 사실들. */
  facts: string[];
  /** 제공자 알약 오른쪽의 작은 글씨. */
  providerSmall: string;
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

/** 처음 오는 사람이 받는 것 — 숫자는 전부 상수에서 온다. */
const SIGNUP_FACTS = [
  "카드·비밀번호 없음",
  `실행 ${SIGNUP_GRANT_CREDITS}회 즉시`,
  `이미지 하루 ${WORKSPACE_IMAGES_PER_DAY}장까지`,
];

const LOGIN_FACTS = ["비밀번호 없음", "보던 화면으로 복귀", "내 파일은 내 작업공간에만"];

const SIGNUP_PROVIDER_SMALL = "계정으로 시작 ↗";
const LOGIN_PROVIDER_SMALL = "계정으로 로그인 ↗";

/** 아무 의도도 실려 오지 않았을 때의 문구. 두 문의 기본값이다. */
export const DEFAULT_AUTH_COPY: AuthIntentCopy = {
  signup: {
    badge: "카드 없이 시작",
    h1: `가입하면 바로 씁니다`,
    lede: `카드도 비밀번호도 묻지 않습니다. Google이나 GitHub 계정으로 한 번 들어오면 내 작업공간이 만들어지고, 매달 ${BETA_MONTHLY_GRANT_CREDITS}회가 더 들어옵니다.`,
    facts: SIGNUP_FACTS,
    providerSmall: SIGNUP_PROVIDER_SMALL,
  },
  login: {
    badge: "내 작업공간",
    h1: "다시 오셨군요",
    lede: "Clunk는 비밀번호를 만들지도 보관하지도 않습니다. 쓰던 계정으로 들어오면 보던 화면으로 그대로 돌아갑니다.",
    facts: LOGIN_FACTS,
    providerSmall: LOGIN_PROVIDER_SMALL,
  },
  welcome: `만들기·검사 ${SIGNUP_GRANT_CREDITS}회가 들어왔습니다 · 무엇을 만들지 골라 보세요`,
};

export const INTENT_COPY: Record<AuthIntent, AuthIntentCopy> = {
  create: {
    signup: {
      badge: "카드 없이 시작",
      h1: "첫 에셋 만들기부터",
      lede: `계정 하나면 만들기 화면이 열립니다. 가입하는 그 자리에서 만들기·검사 ${SIGNUP_GRANT_CREDITS}회가 들어오고, 확인이 끝나면 만들던 화면으로 그대로 돌아갑니다.`,
      facts: SIGNUP_FACTS,
      providerSmall: SIGNUP_PROVIDER_SMALL,
    },
    login: {
      badge: "에셋 만들기",
      h1: "만들던 화면으로",
      lede: "쓰던 계정을 고르세요. 확인이 끝나면 에셋 만들기 화면으로 그대로 돌아갑니다.",
      facts: LOGIN_FACTS,
      providerSmall: LOGIN_PROVIDER_SMALL,
    },
    welcome: `만들기·검사 ${SIGNUP_GRANT_CREDITS}회가 들어왔습니다 · 첫 에셋을 만들어 보세요`,
  },
  inspect: {
    signup: {
      badge: "카드 없이 시작",
      h1: "파일 검사부터",
      lede: `파일 하나를 올리면 게임에 넣어도 되는지 확인해 드립니다. 가입하는 그 자리에서 만들기·검사 ${SIGNUP_GRANT_CREDITS}회가 들어오고, 확인이 끝나면 검사 화면으로 돌아갑니다.`,
      facts: SIGNUP_FACTS,
      providerSmall: SIGNUP_PROVIDER_SMALL,
    },
    login: {
      badge: "에셋 검사",
      h1: "검사하던 화면으로",
      lede: "쓰던 계정을 고르세요. 확인이 끝나면 검사 화면으로 그대로 돌아갑니다.",
      facts: LOGIN_FACTS,
      providerSmall: LOGIN_PROVIDER_SMALL,
    },
    welcome: `만들기·검사 ${SIGNUP_GRANT_CREDITS}회가 들어왔습니다 · 파일 하나를 올려 검사해 보세요`,
  },
  agents: {
    signup: {
      badge: "카드 없이 시작",
      h1: "에이전트 연결부터",
      lede: `내 계정 전용 키를 하나 만들면 쓰던 AI 도구가 바로 Clunk를 부릅니다. 가입하는 그 자리에서 만들기·검사 ${SIGNUP_GRANT_CREDITS}회가 들어옵니다.`,
      facts: SIGNUP_FACTS,
      providerSmall: SIGNUP_PROVIDER_SMALL,
    },
    login: {
      badge: "에이전트 연결",
      h1: "연결하던 화면으로",
      lede: "쓰던 계정을 고르세요. 확인이 끝나면 연결 설정 화면으로 그대로 돌아갑니다.",
      facts: LOGIN_FACTS,
      providerSmall: LOGIN_PROVIDER_SMALL,
    },
    welcome: `만들기·검사 ${SIGNUP_GRANT_CREDITS}회가 들어왔습니다 · 키를 만들면 바로 연결됩니다`,
  },
  market: {
    signup: {
      badge: "카드 없이 시작",
      h1: "에셋 받기부터",
      lede: `마켓 에셋은 계정만 있으면 받습니다. 가입하는 그 자리에서 만들기·검사 ${SIGNUP_GRANT_CREDITS}회도 함께 들어옵니다.`,
      facts: SIGNUP_FACTS,
      providerSmall: SIGNUP_PROVIDER_SMALL,
    },
    login: {
      badge: "에셋 마켓",
      h1: "보던 에셋으로",
      lede: "쓰던 계정을 고르세요. 확인이 끝나면 보던 상품 화면으로 그대로 돌아갑니다.",
      facts: LOGIN_FACTS,
      providerSmall: LOGIN_PROVIDER_SMALL,
    },
    welcome: `만들기·검사 ${SIGNUP_GRANT_CREDITS}회가 들어왔습니다 · 마켓에서 에셋을 받아 보세요`,
  },
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
  if (path.startsWith("/dashboard")) return "내 작업공간";
  if (path.startsWith("/app")) return "에셋 검사";
  if (path.startsWith("/studio")) return "에셋 만들기";
  if (path.startsWith("/marketplace")) return "에셋 마켓";
  if (path.startsWith("/agents")) return "에이전트 연결";
  if (path.startsWith("/review")) return "검수 뷰어";
  return "이전 화면";
}

/** 한 문(door)이 이 의도에서 쓰는 문구. */
export function authCardCopy(door: AuthDoor, intent: AuthIntent | null): AuthCardCopy {
  return (intent ? INTENT_COPY[intent] : DEFAULT_AUTH_COPY)[door];
}

/** 가입 직후 작업공간 위에 한 줄로 뜨는 문장. */
export function welcomeLine(intent: AuthIntent | null): string {
  return (intent ? INTENT_COPY[intent] : DEFAULT_AUTH_COPY).welcome;
}
