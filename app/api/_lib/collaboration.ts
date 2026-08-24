import {
  FRAME_MANIFEST_SCHEMA,
  mergeFrameManifestEvidence,
  normalizeFrameManifest,
  resolveCollaborationStatus,
  type AuditStatus,
  type CollaborationStatus,
  type FrameManifest,
  type FrameManifestWriteMode,
  type RuntimeReviewStatus,
} from "../../../packages/core/src/collaboration-contract";
import { ClunkHttpError, isSafeRecordId } from "./clunk";

export type CollaborationStatusPayload = {
  assetAudit: AuditStatus;
  visualRuntime: RuntimeReviewStatus;
  profileId: string;
  baseProfileId?: string;
  ruleSetId: string;
  inputHash: string;
  previousInputHash?: string;
};

export type ThreadPayload = CollaborationStatusPayload & {
  subject: string;
  assetId?: string;
  evidence?: FrameManifest;
  evidenceMode: FrameManifestWriteMode;
};

export type MessagePayload = {
  body: string;
  assetId?: string;
  inputHash: string;
  targetProfileId: string;
  status?: CollaborationStatusPayload;
  evidence?: FrameManifest;
  evidenceMode: FrameManifestWriteMode;
};

export type StoredEvidence = FrameManifest | {
  schema: typeof FRAME_MANIFEST_SCHEMA;
  status: "INVALID";
  error: string;
};

const AUDIT_STATUSES = new Set<AuditStatus>(["NOT_RUN", "PASS", "FAIL", "BLOCKED"]);
const RUNTIME_STATUSES = new Set<RuntimeReviewStatus>(["NOT_RUN", "PASS", "GAP", "BLOCKED"]);

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ClunkHttpError("A collaboration object is required.", 400);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new ClunkHttpError(`Invalid collaboration ${field}.`, 400);
  }
  return value.trim();
}

function optionalId(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (!isSafeRecordId(value)) throw new ClunkHttpError(`Invalid collaboration ${field}.`, 400);
  return value;
}

function hash(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new ClunkHttpError(`Invalid collaboration ${field}.`, 400);
  }
  return value.toLowerCase();
}

function evidenceMode(value: unknown): FrameManifestWriteMode {
  if (value === undefined || value === null) return "replace";
  if (value !== "append" && value !== "replace") {
    throw new ClunkHttpError("Invalid collaboration evidenceMode. Use append or replace.", 400);
  }
  return value;
}

export function parseStatusPayload(value: unknown): CollaborationStatusPayload {
  const source = record(value);
  const assetAudit = source.assetAudit;
  const visualRuntime = source.visualRuntime;
  if (!AUDIT_STATUSES.has(assetAudit as AuditStatus)) {
    throw new ClunkHttpError("Invalid collaboration asset audit status.", 400);
  }
  if (!RUNTIME_STATUSES.has(visualRuntime as RuntimeReviewStatus)) {
    throw new ClunkHttpError("Invalid collaboration runtime status.", 400);
  }
  return {
    assetAudit: assetAudit as AuditStatus,
    visualRuntime: visualRuntime as RuntimeReviewStatus,
    profileId: text(source.profileId, "profileId", 160),
    baseProfileId: optionalId(source.baseProfileId, "baseProfileId"),
    ruleSetId: text(source.ruleSetId, "ruleSetId", 160),
    inputHash: hash(source.inputHash, "inputHash"),
    previousInputHash: source.previousInputHash === undefined
      ? undefined
      : hash(source.previousInputHash, "previousInputHash"),
  };
}

export function resolveStoredStatus(payload: CollaborationStatusPayload): CollaborationStatus {
  return resolveCollaborationStatus(payload);
}

export function parseEvidencePayload(value: unknown): FrameManifest | undefined {
  if (value === undefined || value === null) return undefined;
  try {
    return normalizeFrameManifest(value);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid frame manifest";
    throw new ClunkHttpError(`Invalid collaboration evidence: ${detail}`, 400);
  }
}

export function parseThreadPayload(value: unknown): ThreadPayload {
  const source = record(value);
  return {
    ...parseStatusPayload(source.status ?? source),
    subject: text(source.subject, "subject", 240),
    assetId: optionalId(source.assetId, "assetId"),
    evidence: parseEvidencePayload(source.evidence),
    evidenceMode: evidenceMode(source.evidenceMode),
  };
}

export function parseMessagePayload(value: unknown): MessagePayload {
  const source = record(value);
  const body = text(source.body, "message body", 10_000);
  const inputHash = hash(source.inputHash, "inputHash");
  const targetProfileId = text(source.targetProfileId, "targetProfileId", 160);
  return {
    body,
    assetId: optionalId(source.assetId, "assetId"),
    inputHash,
    targetProfileId,
    status: source.status === undefined ? undefined : parseStatusPayload(source.status),
    evidence: parseEvidencePayload(source.evidence),
    evidenceMode: evidenceMode(source.evidenceMode),
  };
}

export function statusJson(status: CollaborationStatus): string {
  return JSON.stringify(status);
}

export function parseStoredStatus(value: unknown): CollaborationStatus {
  const source = record(value);
  const payload = parseStatusPayload(source);
  const resolved = resolveStoredStatus(payload);
  return typeof source.stale === "boolean" ? { ...resolved, stale: source.stale } : resolved;
}

export function parseStoredEvidence(value: unknown): StoredEvidence | null {
  if (value === undefined || value === null || value === "") return null;
  try {
    const decoded = typeof value === "string" ? JSON.parse(value) : value;
    return normalizeFrameManifest(decoded);
  } catch (error) {
    return {
      schema: FRAME_MANIFEST_SCHEMA,
      status: "INVALID",
      error: error instanceof Error ? error.message : "Stored collaboration evidence is invalid.",
    };
  }
}

export function evidenceJson(evidence: FrameManifest | undefined): string | null {
  return evidence ? JSON.stringify(evidence) : null;
}

export function mergeStoredEvidence(
  current: StoredEvidence | null,
  incoming: FrameManifest | undefined,
  mode: FrameManifestWriteMode,
): FrameManifest | null {
  if (!incoming) {
    if (!current) return null;
    if (isInvalidStoredEvidence(current)) {
      throw new ClunkHttpError("Stored collaboration evidence is invalid; replace it with a valid manifest.", 409);
    }
    return current;
  }
  if (current && isInvalidStoredEvidence(current)) {
    throw new ClunkHttpError("Stored collaboration evidence is invalid; replace it with a valid manifest.", 409);
  }
  return mergeFrameManifestEvidence(current, incoming, mode);
}

function isInvalidStoredEvidence(value: StoredEvidence): value is Extract<StoredEvidence, { status: "INVALID" }> {
  return "status" in value && value.status === "INVALID";
}
