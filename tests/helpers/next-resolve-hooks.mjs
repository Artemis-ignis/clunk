/** `next/*` 를 테스트용 자리채우기로 돌린다. tests/helpers/next-stub.mjs 참고. */
const STUB = new URL("./next-stub.mjs", import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next" || specifier.startsWith("next/")) {
    return { url: STUB, shortCircuit: true, format: "module" };
  }
  return nextResolve(specifier, context);
}
