import { createHash } from "node:crypto";
import { summarizeCosts } from "@/lib/costs";
import type { ValidationContext } from "@/lib/validation/types";

/** Bump when the wording changes; stored with each e-signature. */
export const OFFICER_STATEMENT_VERSION = "2025-02";

export const OFFICER_STATEMENT =
  "I am a senior corporate officer or director of the licensee or approval holder named on this Liability Declaration. " +
  "I have reviewed the estimates below, and I certify that the site-specific liability assessment meets all Directive 001 requirements " +
  "and that the estimates are correct to the best of my knowledge.";

/** The four dollar figures on F035, in cents. Remediation is everything on Form 001-B except reclamation. */
export interface DeclarationFigures {
  suspensionAbandonmentCents: number;
  remediationCents: number;
  reclamationCents: number;
  totalCents: number;
}

export function declarationFigures(ctx: ValidationContext): DeclarationFigures {
  const s = summarizeCosts(ctx);
  const reclamation = s.byBlock["001-B"]["reclamation"] ?? 0;
  return {
    suspensionAbandonmentCents: s.byForm["001-A"],
    remediationCents: s.byForm["001-B"] - reclamation,
    reclamationCents: reclamation,
    totalCents: s.byForm["001-A"] + s.byForm["001-B"],
  };
}

export interface DeclarationContent {
  licenceNumber: string;
  licenseeName: string;
  baId: string;
  lsd: string;
  assessmentDate: string;
  figures: DeclarationFigures;
}

/** SHA-256 over a canonical rendering of everything the officer certifies. Any change makes the signature stale. */
export function declarationHash(c: DeclarationContent): string {
  const canonical = JSON.stringify([
    c.licenceNumber, c.licenseeName, c.baId, c.lsd, c.assessmentDate,
    c.figures.suspensionAbandonmentCents, c.figures.remediationCents, c.figures.reclamationCents, c.figures.totalCents,
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

export interface OfficerSignature {
  id: string;
  signer_name: string;
  signer_position: string;
  typed_signature: string;
  content_hash: string;
  signed_at: string;
}

export type OfficerSignatureState = "none" | "valid" | "stale";

/** Latest signature wins. Valid only if it certified exactly the current figures. */
export function officerSignatureState(sigs: OfficerSignature[], currentHash: string): { state: OfficerSignatureState; latest: OfficerSignature | null } {
  const latest = [...sigs].sort((a, b) => b.signed_at.localeCompare(a.signed_at))[0] ?? null;
  if (!latest) return { state: "none", latest: null };
  return { state: latest.content_hash === currentHash ? "valid" : "stale", latest };
}
