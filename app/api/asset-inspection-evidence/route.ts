import {
  assertSameOrigin,
  jsonError,
  parseJson,
  privateJson,
  requireClunkContext,
} from "../_lib/clunk";
import { parseAssetInspectionEvidencePayload } from "../_lib/asset-inspection-evidence";

export const dynamic = "force-dynamic";

/**
 * Stable authenticated validation endpoint. It deliberately returns the normalized envelope
 * without charging credits or claiming that a capture is visually approved.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireClunkContext();
    const evidence = parseAssetInspectionEvidencePayload(await parseJson<unknown>(request));
    return privateJson({ ok: true, schema: evidence.schema, evidence });
  } catch (error) {
    return jsonError(error);
  }
}
