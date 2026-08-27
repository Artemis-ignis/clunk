export const PRODUCT_CONTRACT_SCHEMA = "clunk.product-contract.v1" as const;

export type ProductEvidenceStatus = "PASS" | "GAP" | "NOT_EVALUATED" | "NO_GO" | "PENDING" | "UNAVAILABLE";
export type ProductLicenseStatus = "cleared" | "review-required" | "restricted" | "unknown";
export type MarketplaceReadiness = "PUBLISHABLE" | "EVIDENCE_INCOMPLETE" | "BLOCKED" | "STORAGE_INCOMPLETE" | "LICENSE_INCOMPLETE";

export type PublicationGateInput = {
  artifactStored: boolean;
  provenanceComplete: boolean;
  licenseStatus: ProductLicenseStatus;
  staticStatus: ProductEvidenceStatus;
  visualRuntime: ProductEvidenceStatus;
  playerFacing: ProductEvidenceStatus;
  humanDecision: ProductEvidenceStatus;
};

export type ReadinessInput = Pick<PublicationGateInput, "staticStatus" | "visualRuntime" | "playerFacing" | "humanDecision">;

export function canPublishListing(input: PublicationGateInput): boolean {
  return input.artifactStored
    && input.provenanceComplete
    && input.licenseStatus === "cleared"
    && input.staticStatus === "PASS"
    && input.visualRuntime === "PASS"
    && input.playerFacing === "PASS"
    && input.humanDecision === "PASS";
}

export function readinessLabel(input: ReadinessInput): MarketplaceReadiness {
  if (input.staticStatus === "NO_GO" || input.staticStatus === "GAP") return "BLOCKED";
  if (input.visualRuntime === "NO_GO" || input.playerFacing === "NO_GO" || input.humanDecision === "NO_GO") return "BLOCKED";
  if (input.staticStatus !== "PASS" || input.visualRuntime !== "PASS" || input.playerFacing !== "PASS" || input.humanDecision !== "PASS") {
    return "EVIDENCE_INCOMPLETE";
  }
  return "PUBLISHABLE";
}

export function publicationReadiness(input: PublicationGateInput): MarketplaceReadiness {
  if (!input.artifactStored) return "STORAGE_INCOMPLETE";
  if (!input.provenanceComplete) return "EVIDENCE_INCOMPLETE";
  if (input.licenseStatus !== "cleared") return "LICENSE_INCOMPLETE";
  if (!canPublishListing(input)) return readinessLabel(input);
  return "PUBLISHABLE";
}

export function isProductLicenseStatus(value: unknown): value is ProductLicenseStatus {
  return value === "cleared" || value === "review-required" || value === "restricted" || value === "unknown";
}
