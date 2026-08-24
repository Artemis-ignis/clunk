import {
  normalizeFrameManifest,
  type FrameManifest,
} from "../../../packages/core/src/collaboration-contract";
import { ClunkHttpError } from "./http-error";

/**
 * Authenticated collaboration evidence boundary. Kept independent of the
 * Cloudflare runtime so the exact 400 contract can be regression-tested in Node.
 */
export function parseEvidencePayload(value: unknown): FrameManifest | undefined {
  if (value === undefined || value === null) return undefined;
  try {
    return normalizeFrameManifest(value);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid frame manifest";
    throw new ClunkHttpError(`Invalid collaboration evidence: ${detail}`, 400);
  }
}
