import { jsonError, privateJson, requireClunkContext } from "../../_lib/clunk";
import { getTemplateStore, hasTemplateStore, loadTemplateLibrary } from "../../_lib/templates";
import {
  TEMPLATE_HONESTY_KO,
  describeTemplateCatalog,
} from "../../../../packages/clunk-series/src/template-library";

export const dynamic = "force-dynamic";

/**
 * The template catalogue /studio picks from.
 *
 * Everything here was measured off the file it describes: the triangle count comes from the
 * scene the GLB was written from, the swatches are the colours the palette transform actually
 * produced, the bounds are metres. A row appears only when the library holds a file that can
 * serve it, so a picker built from this response can never offer a choice that 400s.
 *
 * The route answers 503 rather than an empty list when no library is uploaded, because an empty
 * grid of choices reads as "there are no templates" instead of "this is not set up yet".
 */
export async function GET() {
  try {
    await requireClunkContext();
    if (!hasTemplateStore()) {
      return privateJson({
        ok: false,
        schema: "clunk.series-templates.v1",
        error: "템플릿 보관소(R2 ASSETS)가 연결되어 있지 않습니다.",
        templates: [],
      }, { status: 503 });
    }
    const store = getTemplateStore();
    const library = await loadTemplateLibrary(store);
    if (!library) {
      return privateJson({
        ok: false,
        schema: "clunk.series-templates.v1",
        error: "템플릿 라이브러리가 아직 업로드되지 않았습니다.",
        hint: "node scripts/template-library/build.mjs 로 굽고 scripts/template-library/upload.mjs 로 올리십시오.",
        templates: [],
      }, { status: 503 });
    }
    return privateJson({
      ok: true,
      schema: "clunk.series-templates.v1",
      honesty: TEMPLATE_HONESTY_KO,
      note: library.honesty,
      generatedAt: library.generatedAt,
      colourways: library.colourways,
      sizes: library.sizes,
      scaleRange: library.scaleRange,
      templates: describeTemplateCatalog(library),
    });
  } catch (error) {
    return jsonError(error);
  }
}
