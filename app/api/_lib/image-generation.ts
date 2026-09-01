import { getRuntimeBinding } from "../../runtime-environment";

/**
 * Prompt-driven image generation, on the Workers AI binding.
 *
 * Until now the 2D lane charged a credit and returned a shape drawn from a hash of the
 * label: a circle for a head, a rectangle for a body, colour picked by sha256. The prompt
 * reached provenance and never reached a pixel. This is the lane that makes the prompt
 * the thing that decides the picture.
 *
 * The binding is a capability on the account, not a resource we create, so it can simply
 * be absent — on a local `vite dev`, or on a deploy that predates it. Every path here
 * reports which of those happened rather than falling back silently, because the caller
 * has to decide whether to charge for the result.
 */

/** Measured on this account 2026-09-01: 129.6 neurons per image, 10,000 free per day. */
export const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell" as const;

/** The model's own ceiling; asking for more is rejected upstream, not clamped. */
const MAX_STEPS = 8;

export type ImageGenerationOutcome =
  | { status: "GENERATED"; bytes: Uint8Array; contentType: "image/jpeg"; model: string; steps: number }
  | { status: "BINDING_UNAVAILABLE" }
  | { status: "REJECTED"; reason: string }
  | { status: "FAILED"; reason: string };

type AiBinding = {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
};

/** Flux returns base64 rather than bytes, on `image`, and older shapes used `result`. */
function readImageBase64(response: unknown): string | null {
  if (typeof response === "string") return response;
  if (!response || typeof response !== "object") return null;
  const record = response as Record<string, unknown>;
  if (typeof record.image === "string") return record.image;
  const nested = record.result;
  if (nested && typeof nested === "object" && typeof (nested as Record<string, unknown>).image === "string") {
    return (nested as Record<string, unknown>).image as string;
  }
  return null;
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function generateImage(options: {
  prompt: string;
  steps?: number;
  seed?: number;
}): Promise<ImageGenerationOutcome> {
  const ai = getRuntimeBinding<AiBinding>("AI");
  if (!ai || typeof ai.run !== "function") return { status: "BINDING_UNAVAILABLE" };

  const prompt = options.prompt.trim();
  if (!prompt) return { status: "REJECTED", reason: "A prompt is required." };
  if (prompt.length > 2_000) return { status: "REJECTED", reason: "The prompt is longer than the model accepts." };
  const steps = Math.min(Math.max(Math.round(options.steps ?? 4), 1), MAX_STEPS);

  let response: unknown;
  try {
    response = await ai.run(IMAGE_MODEL, {
      prompt,
      steps,
      ...(options.seed === undefined ? {} : { seed: options.seed }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // The safety classifier declines outright rather than returning an empty image, and
    // it has false positives on innocuous game-asset prompts — a tilled-soil texture was
    // refused on this account. That is the prompt's problem to fix, not an outage, so it
    // is reported apart from a genuine failure.
    if (/nsfw|safety|content policy/i.test(message)) {
      return { status: "REJECTED", reason: "이 문장은 이미지 모델의 안전 필터에 걸렸습니다. 표현을 바꿔 다시 시도해 주세요." };
    }
    if (/daily free allocation|neurons/i.test(message)) {
      return { status: "FAILED", reason: "오늘의 이미지 생성 한도를 모두 썼습니다. 내일 다시 열립니다." };
    }
    return { status: "FAILED", reason: message.slice(0, 300) };
  }

  const base64 = readImageBase64(response);
  if (!base64) return { status: "FAILED", reason: "The image model returned no image." };
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(base64);
  } catch {
    return { status: "FAILED", reason: "The image model returned an unreadable payload." };
  }
  // A JPEG starts FF D8 FF. Anything else is not the file we are about to charge for.
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    return { status: "FAILED", reason: "The image model returned bytes that are not a JPEG." };
  }
  return { status: "GENERATED", bytes, contentType: "image/jpeg", model: IMAGE_MODEL, steps };
}
