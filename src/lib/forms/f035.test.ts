import { readFileSync } from "node:fs";
import path from "node:path";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { facilityTypeOptions, fillLiabilityDeclaration, type LiabilityDeclarationData } from "./f035";

const template = readFileSync(path.resolve(__dirname, "../../../reference/Directive001-F035_LiabilityDeclaration.pdf"));

const base: LiabilityDeclarationData = {
  licenceNumber: "DEMO-F-0001",
  licenseeName: "Prairie Ridge Energy Ltd.",
  baId: "DEMO-BA-0001",
  lsd: "14-01-045-07W5",
  siteType: "facility",
  isLandfill: false,
  facilityType: "Oil satellite - multiwell",
  assessmentDate: "2026-11-05",
  suspensionAbandonment: 123456.789,
  remediation: 250000,
  reclamation: 10800,
  total: 384256.79,
};

async function read(over: Partial<LiabilityDeclarationData> = {}) {
  const out = await fillLiabilityDeclaration(template, { ...base, ...over });
  const form = (await PDFDocument.load(out)).getForm();
  return {
    text: (n: string) => form.getTextField(n).getText(),
    checked: (n: string) => form.getCheckBox(n).isChecked(),
    selected: () => form.getDropdown("FacilityType").getSelected(),
  };
}

describe("F035 Liability Declaration", () => {
  it("fills licence, licensee, location, date and the four estimates", async () => {
    const f = await read();
    expect(f.text("Number")).toBe("DEMO-F-0001");
    expect(f.text("Name")).toBe("Prairie Ridge Energy Ltd.");
    expect(f.text("BAcode")).toBe("DEMO-BA-0001");
    expect(f.text("LSD")).toBe("14-01-045-07W5");
    expect(f.text("SSLADate")).toBe("2026-11-05");
    expect(f.text("S&AEstimate")).toBe("$123,456.79");
    expect(f.text("RemEstimate")).toBe("$250,000.00");
    expect(f.text("RecEstimate")).toBe("$10,800.00");
    expect(f.text("TotalEstimate")).toBe("$384,256.79");
  });

  it("leaves the officer's certification block blank", async () => {
    const f = await read();
    expect(f.text("SigningDate") ?? "").toBe("");
    expect(f.text("Position") ?? "").toBe("");
  });

  it.each([
    ["well", "Well"],
    ["pipeline", "Pipeline"],
    ["facility", "Facility"],
    ["owm_facility", "Waste Management"],
  ] as const)("site type %s ticks only %s", async (siteType, box) => {
    const f = await read({ siteType });
    for (const b of ["Well", "Pipeline", "Facility", "Waste Management"]) expect(f.checked(b)).toBe(b === box);
  });

  it("ticks the landfill box only for landfills", async () => {
    expect((await read({ isLandfill: true })).checked("Check if this is a landfill")).toBe(true);
    expect((await read()).checked("Check if this is a landfill")).toBe(false);
  });

  it("selects the facility description when it is one the form offers", async () => {
    expect((await read()).selected()).toEqual(["Oil satellite - multiwell"]);
  });

  it("ignores a facility description the form does not offer", async () => {
    expect((await read({ facilityType: "Moon base" })).selected()).not.toContain("Moon base");
  });

  describe("officer e-signature", () => {
    const officer = {
      name: "Dana Admin", position: "President", typedSignature: "Dana Admin", signedOn: "2026-11-06",
      recordId: "abcdef12-0000-4000-8000-000000000001", contentHash: "a".repeat(64),
    };

    it("fills the signing date and position when an e-signature is present", async () => {
      const f = await read({ officer });
      expect(f.text("SigningDate")).toBe("2026-11-06");
      expect(f.text("Position")).toBe("President");
    });

    it("draws the signature and record reference onto the page", async () => {
      const unsigned = await fillLiabilityDeclaration(template, base);
      const signed = await fillLiabilityDeclaration(template, { ...base, officer });
      expect(signed.byteLength).toBeGreaterThan(unsigned.byteLength);
      // page content streams are deflated, so check structurally: the signed page has two more fonts
      const fonts = async (b: Buffer) => (await PDFDocument.load(b)).getPage(0).node.Resources()?.lookup(PDFName.of("Font"), PDFDict)?.keys().length ?? 0;
      expect(await fonts(signed)).toBeGreaterThan(await fonts(unsigned));
    });

    it("leaves the block blank without one", async () => {
      const f = await read();
      expect(f.text("SigningDate") ?? "").toBe("");
      expect(f.text("Position") ?? "").toBe("");
    });
  });

  it("uses NEW for an unnumbered site", async () => {
    expect((await read({ licenceNumber: "" })).text("Number")).toBe("NEW");
  });

  it("lists the dropdown options from the template", async () => {
    const opts = await facilityTypeOptions(template);
    expect(opts).toContain("Gas processing plant");
    expect(opts).not.toContain("-- Select facility type --");
    expect(opts).toHaveLength(18);
  });
});
