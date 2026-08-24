import type { GateEvidence, GateResult } from "../assetops-contract";

export const HARVEST_FRONTIER_SEMANTIC_RULE_ID = "harvest-frontier-runtime-v1" as const;

export interface HarvestFrontierSemanticFinding {
  id: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  message: string;
  path?: string;
}

export interface HarvestFrontierSemanticResult {
  ruleId: typeof HARVEST_FRONTIER_SEMANTIC_RULE_ID;
  gate: GateResult;
  counts: {
    node: number;
    root: number;
    pivot: number;
    socket: number;
    collider: number;
  };
  findings: readonly HarvestFrontierSemanticFinding[];
}

interface JsonRecord {
  [key: string]: unknown;
}

export function inspectHarvestFrontierSemanticContract(document: unknown): HarvestFrontierSemanticResult {
  const source = isRecord(document) ? document : {};
  const nodes = Array.isArray(source.nodes) ? source.nodes : [];
  const names = nodes
    .map((node) => (isRecord(node) && typeof node.name === "string" ? node.name : ""))
    .filter(Boolean);
  const extensions = Array.isArray(source.extensionsUsed)
    ? source.extensionsUsed.filter((value): value is string => typeof value === "string")
    : [];
  const counts = {
    node: names.length,
    root: names.filter((name) => /root$/i.test(name)).length,
    pivot: names.filter((name) => /pivot/i.test(name)).length,
    socket: names.filter((name) => /^socket\./i.test(name)).length,
    collider: names.filter((name) => /^collider\./i.test(name)).length,
  };
  const findings: HarvestFrontierSemanticFinding[] = [];
  if (counts.root === 0) findings.push(finding("HF-ROOT-NODE", "ERROR", "No named runtime root node was found."));
  if (counts.socket === 0) findings.push(finding("HF-ATTACHMENT-SOCKET", "ERROR", "No named attachment socket was found."));
  if (counts.collider === 0) findings.push(finding("HF-COLLIDER", "ERROR", "No named collider proxy was found."));
  if (counts.pivot === 0) findings.push(finding("HF-PIVOT", "WARNING", "No named pivot node was found; animation/attachment semantics need review."));
  if (!extensions.includes("EXT_meshopt_compression")) {
    findings.push(finding("HF-MESHOPT", "ERROR", "EXT_meshopt_compression is missing from the runtime model."));
  }
  const status = findings.some((item) => item.severity === "ERROR" || item.severity === "CRITICAL") ? "fail" : "pass";
  return {
    ruleId: HARVEST_FRONTIER_SEMANTIC_RULE_ID,
    gate: {
      status,
      message: status === "pass"
        ? "Harvest Frontier runtime semantic node contract passed."
        : "Harvest Frontier runtime semantic node contract failed.",
      evidence: [
        evidence("nodeCount", counts.node),
        evidence("rootCount", counts.root),
        evidence("pivotCount", counts.pivot),
        evidence("socketCount", counts.socket),
        evidence("colliderCount", counts.collider),
        evidence("meshopt", extensions.includes("EXT_meshopt_compression")),
      ],
      durationMs: 0,
    },
    counts,
    findings,
  };
}

function finding(
  id: string,
  severity: HarvestFrontierSemanticFinding["severity"],
  message: string,
): HarvestFrontierSemanticFinding {
  return { id, severity, message };
}

function evidence(key: string, value: string | number | boolean | null): GateEvidence {
  return { key, value };
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
