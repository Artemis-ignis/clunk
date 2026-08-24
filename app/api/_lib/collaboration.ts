import {
  resolveCollaborationStatus,
  type AuditStatus,
  type CollaborationStatus,
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
};

export type MessagePayload = {
  body: string;
  assetId?: string;
  inputHash: string;
  targetProfileId: string;
  status?: CollaborationStatusPayload;
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

export function parseThreadPayload(value: unknown): ThreadPayload {
  const source = record(value);
  return {
    ...parseStatusPayload(source.status ?? source),
    subject: text(source.subject, "subject", 240),
    assetId: optionalId(source.assetId, "assetId"),
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
