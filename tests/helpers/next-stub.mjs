/**
 * `next/*` 자리채우기. 테스트에서만 쓴다.
 *
 * app/api/_lib/clunk.ts 는 app/auth.ts 를 부르고, 그 파일이 next/headers 를 읽는다.
 * 이 저장소에는 next 패키지가 없다(vinext 가 빌드 때 제자리에 끼워 넣는다). 그래서
 * 노드로 그 모듈을 그냥 불러오면 ERR_MODULE_NOT_FOUND 로 죽는다.
 *
 * 여기서 내주는 것은 "부르면 터지는" 자리채우기다. 정적 경로의 문지기는 요청에서 직접
 * 쿠키를 읽으므로(readRequestUser) 이 함수들을 부르지 않는다. 혹시라도 부르는 길이
 * 생기면 조용히 지나가는 대신 여기서 멈춘다.
 */
function unavailable(name) {
  return () => {
    throw new Error(`${name}() is not available outside the app router; the test reached a path it should not.`);
  };
}

export const cookies = unavailable("cookies");
export const headers = unavailable("headers");
export const draftMode = unavailable("draftMode");
export const redirect = unavailable("redirect");
export const permanentRedirect = unavailable("permanentRedirect");
export const notFound = unavailable("notFound");
export const usePathname = unavailable("usePathname");
export const useRouter = unavailable("useRouter");
export const useSearchParams = unavailable("useSearchParams");
export default function NextStub() {
  throw new Error("next/* default export is not available in tests.");
}
