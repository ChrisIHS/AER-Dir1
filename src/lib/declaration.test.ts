import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { declarationFigures, declarationHash, officerSignatureState, type DeclarationContent, type OfficerSignature } from "./declaration";
import { fillCostWorkbook } from "./forms/costForms";
import { TEMPLATE_FILE } from "./forms/templateMap";
import { allLines } from "./validation/helpers";
import { goodContext, line } from "./validation/fixtures";

const template = readFileSync(path.resolve(__dirname, "../..", TEMPLATE_FILE));

describe("declarationFigures", () => {
  it("splits the good estimate: reclamation 10,800; the rest of 001-B is remediation", () => {
    const f = declarationFigures(goodContext());
    expect(f.reclamationCents).toBe(10_800_00);
    expect(f.totalCents).toBe(f.suspensionAbandonmentCents + f.remediationCents + f.reclamationCents);
  });

  it("agrees with the filled AER workbook to the cent", async () => {
    const ctx = goodContext();
    ctx.workstreams.reclamation.lineItems.push(
      line({ costCategory: "reclamation", formRef: "001-B", formRowKey: "001-B:contouring", quantity: 1.7, unitRate: 3333.33 }),
      line({ costCategory: "remediation_on_site", formRef: "001-B", formRowKey: "001-B:surface_water", quantity: 12.5, unitRate: 71.17 }),
    );
    const f = declarationFigures(ctx);
    const { totals } = await fillCostWorkbook(template, { licenceNumber: "X", licenceType: "Well", legalLandDescription: "", licenseeNameBaId: "", siteName: "" }, allLines(ctx).map((x) => x.line));
    expect(Math.round(totals.form001A * 100)).toBe(f.suspensionAbandonmentCents);
    expect(Math.round(totals.reclamation * 100)).toBe(f.reclamationCents);
    expect(Math.round((totals.form001B - totals.reclamation) * 100)).toBe(f.remediationCents);
    expect(Math.round((totals.form001A + totals.form001B) * 100)).toBe(f.totalCents);
  });

  it("is zero for an empty estimate", () => {
    const ctx = goodContext();
    for (const w of Object.values(ctx.workstreams)) w.lineItems = [];
    expect(declarationFigures(ctx)).toEqual({ suspensionAbandonmentCents: 0, remediationCents: 0, reclamationCents: 0, totalCents: 0 });
  });
});

describe("declarationHash", () => {
  const base = (): DeclarationContent => ({
    licenceNumber: "DEMO-W-0001", licenseeName: "Prairie Ridge Energy Ltd.", baId: "DEMO-BA-0001", lsd: "00/06-12-045-08W5/0",
    assessmentDate: "2026-11-05", figures: declarationFigures(goodContext()),
  });

  it("is a 64-character hex SHA-256 and deterministic", () => {
    expect(declarationHash(base())).toMatch(/^[0-9a-f]{64}$/);
    expect(declarationHash(base())).toBe(declarationHash(base()));
  });

  it.each([
    ["licence", (c: DeclarationContent) => (c.licenceNumber = "OTHER")],
    ["licensee", (c: DeclarationContent) => (c.licenseeName = "Other Ltd.")],
    ["BA ID", (c: DeclarationContent) => (c.baId = "X")],
    ["location", (c: DeclarationContent) => (c.lsd = "01-01-001-01W5")],
    ["date", (c: DeclarationContent) => (c.assessmentDate = "2026-11-06")],
    ["suspension/abandonment", (c: DeclarationContent) => (c.figures.suspensionAbandonmentCents += 1)],
    ["remediation", (c: DeclarationContent) => (c.figures.remediationCents += 1)],
    ["reclamation", (c: DeclarationContent) => (c.figures.reclamationCents += 1)],
    ["total", (c: DeclarationContent) => (c.figures.totalCents += 1)],
  ])("changes when the %s changes (a one-cent change is enough)", (_n, mutate) => {
    const c = base();
    const before = declarationHash(c);
    mutate(c);
    expect(declarationHash(c)).not.toBe(before);
  });
});

describe("officerSignatureState", () => {
  const sig = (hash: string, at: string): OfficerSignature => ({
    id: at, signer_name: "Dana Admin", signer_position: "President", typed_signature: "Dana Admin", content_hash: hash, signed_at: at,
  });

  it("none without signatures", () => expect(officerSignatureState([], "h").state).toBe("none"));
  it("valid when the latest signature certified the current figures", () => {
    expect(officerSignatureState([sig("h", "2026-11-05T10:00:00Z")], "h").state).toBe("valid");
  });
  it("stale when the figures have changed since", () => {
    expect(officerSignatureState([sig("old", "2026-11-05T10:00:00Z")], "h").state).toBe("stale");
  });
  it("the latest signature decides, so re-signing after a change makes it valid again", () => {
    const sigs = [sig("old", "2026-11-05T10:00:00Z"), sig("h", "2026-11-06T10:00:00Z")];
    const r = officerSignatureState(sigs, "h");
    expect(r.state).toBe("valid");
    expect(r.latest!.signed_at).toBe("2026-11-06T10:00:00Z");
  });
  it("an older matching signature does not rescue a newer stale one", () => {
    expect(officerSignatureState([sig("h", "2026-11-05T10:00:00Z"), sig("other", "2026-11-06T10:00:00Z")], "h").state).toBe("stale");
  });
});
