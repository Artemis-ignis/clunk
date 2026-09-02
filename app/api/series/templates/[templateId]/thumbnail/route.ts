import { jsonError, privateJson, requireClunkContext } from "../../../../_lib/clunk";
import { getTemplateStore, hasTemplateStore, loadTemplateLibrary } from "../../../../_lib/templates";
import { templateObjectKey } from "../../../../../../packages/clunk-series/src/template-library";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ templateId: string }> };

/**
 * Serves one template's picture out of the private bucket.
 *
 * The file name is never taken from the request — it is looked up in library.json — so this
 * route cannot be walked into any other object in the bucket. `?palette=` chooses which
 * colourway's thumbnail to show; without it the first colourway that has one is served.
 *
 * The bytes are immutable for the life of an uploaded library, so they are cached hard in the
 * browser but marked private: the catalogue is behind a sign-in like the rest of /studio.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    await requireClunkContext();
    const { templateId } = await context.params;
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(templateId)) {
      return privateJson({ ok: false, error: "템플릿 id 형식이 아닙니다." }, { status: 400 });
    }
    if (!hasTemplateStore()) {
      return privateJson({ ok: false, error: "템플릿 보관소가 연결되어 있지 않습니다." }, { status: 503 });
    }
    const store = getTemplateStore();
    const library = await loadTemplateLibrary(store);
    const template = library?.templates.find((entry) => entry.id === templateId);
    if (!template) return privateJson({ ok: false, error: "그 템플릿은 목록에 없습니다." }, { status: 404 });

    const wanted = new URL(request.url).searchParams.get("palette");
    const palette = (wanted ? template.palettes.find((entry) => entry.id === wanted) : undefined)
      ?? template.palettes.find((entry) => entry.thumbnail);
    if (!palette?.thumbnail) {
      return privateJson({ ok: false, error: "이 템플릿에는 미리보기 그림이 없습니다." }, { status: 404 });
    }
    const bytes = await store.get(templateObjectKey(template.id, palette.thumbnail));
    if (!bytes) return privateJson({ ok: false, error: "보관소에서 그림 파일을 찾지 못했습니다." }, { status: 404 });

    // A fresh ArrayBuffer over exactly this view: the store may hand back a Uint8Array that
    // is a window onto a larger buffer, and the whole buffer must not be served.
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new Response(body, {
      headers: {
        "content-type": "image/webp",
        "content-length": String(bytes.byteLength),
        "cache-control": "private, max-age=86400, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
