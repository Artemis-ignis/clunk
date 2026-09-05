/*
 * clunk_visual_evidence — the local stdio tool that finishes the judgement.
 *
 * This file defines the tools/list entry and the handler only. It deliberately does not touch
 * integrations/mcp/server.ts, which another agent owns. Wiring is three lines, listed at the
 * bottom of this comment.
 *
 * What the tool does that the existing tools cannot: clunk_inspect and
 * clunk_asset_inspection_evidence stop at the bytes and leave visualRuntime as a gap. This one
 * renders the fixed camera rig, hashes every frame it wrote, measures the frames, and returns a
 * clunk.asset-inspection-evidence.v3 envelope whose visualRuntime and playerFacing lanes are
 * already decided and whose humanDecision is NOT_REQUIRED or OPTIONAL_REVIEW. A caller never has
 * to hand the result to a person to find out whether the asset is usable.
 *
 * It writes files, which no other tool on this server does. That is inherent — hashed capture
 * bytes are the evidence — so the destination is required, never guessed, and is echoed back.
 *
 * Wiring into integrations/mcp/server.ts:
 *   1. import { VISUAL_EVIDENCE_TOOL, handleVisualEvidenceTool } from "./visual-evidence-tool";
 *   2. add VISUAL_EVIDENCE_TOOL to the `tools` array;
 *   3. inside handle(), before the policy block:
 *        if (params.name === "clunk_visual_evidence") {
 *          return { content: [{ type: "text", text: JSON.stringify(await handleVisualEvidenceTool(args)) }] };
 *        }
 *   (tests/mcp-stdio.test.mjs asserts tools.length === 7; it becomes 8.)
 */

import { resolve } from "node:path";
import { captureVisualEvidence } from "../../packages/core/src/visual-evidence/capture-node";
import type { AssetInspectionEvidenceV3 } from "../../packages/core/src/visual-evidence/evidence";
import type { AssetPolicy, ProfileId } from "../../packages/core/src/index";

export const VISUAL_EVIDENCE_TOOL = {
  name: "clunk_visual_evidence",
  description:
    "Render a real GLB from a fixed camera rig, hash every frame, measure the frames, and return "
    + "clunk.asset-inspection-evidence.v3 with visualRuntime and playerFacing already decided. "
    + "Unlike clunk_asset_inspection_evidence this does not stop at the bytes and does not wait "
    + "for a person: humanDecision comes back NOT_REQUIRED (automatic PASS or FAIL) or "
    + "OPTIONAL_REVIEW (automatic REVIEW). The frames come from Clunk's own offline software "
    + "rasteriser, are recorded with shippedPath false, and are not engine screenshots. This is "
    + "the local transport, so it reads the asset and writes the captures itself; nothing is "
    + "uploaded.",
  inputSchema: {
    type: "object",
    required: ["path", "outputDirectory"],
    properties: {
      path: { type: "string", description: "Absolute path to the .glb or .gltf on this machine." },
      outputDirectory: { type: "string", description: "Absolute directory the capture PNGs and the evidence JSON are written to. Required: this tool writes files and will not guess where." },
      profile: { type: "string", enum: ["web", "mobile", "pc"], description: "Policy profile for the structural half — the triangle/material/texture budget. Not an engine id." },
      slug: { type: "string", description: "Name stem for the written files. Defaults to the asset's file name." },
      inspectionRunId: { type: "string" },
      includeCaptureMetrics: { type: "boolean", description: "Return every per-capture measurement. Default true; set false for a smaller payload with the checks and the verdict only." },
    },
  },
} as const;

export interface VisualEvidenceToolResult {
  evidence: AssetInspectionEvidenceV3;
  evidencePath: string;
  capturePaths: string[];
  verdict: "PASS" | "REVIEW" | "FAIL";
  verificationMode: "LOCAL_CLI_BYTE_REHASH";
  /** The decision was reached from measurements, not inferred from a person's silence. */
  humanReviewInferred: false;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required and must be a non-empty string. Received ${JSON.stringify(value)}.`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function policyFor(profile: string | undefined): AssetPolicy | undefined {
  if (!profile) return undefined;
  if (profile !== "web" && profile !== "mobile" && profile !== "pc") {
    throw new Error(`'${profile}' is not a policy profile. Valid values: web, mobile, pc.`);
  }
  return { profileId: profile as ProfileId };
}

export async function handleVisualEvidenceTool(args: Record<string, unknown>): Promise<VisualEvidenceToolResult> {
  const glbPath = resolve(requiredString(args.path, "path"));
  const outDir = resolve(requiredString(args.outputDirectory, "outputDirectory"));
  const result = await captureVisualEvidence({
    glbPath,
    outDir,
    slug: optionalString(args.slug),
    inspectionRunId: optionalString(args.inspectionRunId),
    policy: policyFor(optionalString(args.profile)),
  });

  const includeMetrics = args.includeCaptureMetrics !== false;
  const evidence = includeMetrics
    ? result.evidence
    : {
        ...result.evidence,
        visualEvidence: {
          ...result.evidence.visualEvidence,
          captures: result.evidence.visualEvidence.captures.map(({ metrics, ...rest }) => {
            void metrics;
            return rest;
          }),
        },
      } as AssetInspectionEvidenceV3;

  return {
    evidence,
    evidencePath: result.evidencePath,
    capturePaths: result.capturePaths,
    verdict: result.evidence.visualEvidence.verdict,
    verificationMode: "LOCAL_CLI_BYTE_REHASH",
    humanReviewInferred: false,
  };
}
