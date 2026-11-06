import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCad, toCents } from "@/lib/money";
import type { SiteType } from "@/lib/validation/types";

export interface LiabilityDeclarationData {
  licenceNumber: string; // "NEW" for a new, unnumbered site
  licenseeName: string;
  baId: string;
  lsd: string;
  siteType: SiteType;
  isLandfill: boolean;
  /** Directive 056 Table 1 description (facilities); must match one of the PDF dropdown's options. */
  facilityType: string | null;
  assessmentDate: string | null; // ISO date
  /** Dollars. */
  suspensionAbandonment: number;
  remediation: number;
  reclamation: number;
  total: number;
  /** Present only when a current e-signature certifies exactly these figures. */
  officer?: OfficerSigning;
}

export interface OfficerSigning {
  name: string;
  position: string;
  typedSignature: string;
  /** ISO date. */
  signedOn: string;
  recordId: string;
  contentHash: string;
}

const money = (dollars: number) => formatCad(toCents(dollars));

/**
 * Fill AER form F035, Liability Declaration (reference/Directive001-F035_LiabilityDeclaration.pdf).
 * The Certification block (signature, position, date) is left blank unless `officer` is given, i.e. the
 * licensee's senior corporate officer or director has e-signed these exact figures in CORE SSLA. It is then
 * filled and the typed signature is drawn above the signature line, with a record reference below the box.
 * Without an e-signature, the officer signs outside the app.
 */
export async function fillLiabilityDeclaration(template: ArrayBuffer | Buffer, d: LiabilityDeclarationData): Promise<Buffer> {
  const pdf = await PDFDocument.load(template);
  const form = pdf.getForm();

  form.getTextField("BAcode").setText(d.baId);
  form.getTextField("Name").setText(d.licenseeName);
  form.getTextField("Number").setText(d.licenceNumber || "NEW");
  form.getTextField("LSD").setText(d.lsd);
  if (d.assessmentDate) form.getTextField("SSLADate").setText(d.assessmentDate);
  form.getTextField("S&AEstimate").setText(money(d.suspensionAbandonment));
  form.getTextField("RemEstimate").setText(money(d.remediation));
  form.getTextField("RecEstimate").setText(money(d.reclamation));
  form.getTextField("TotalEstimate").setText(money(d.total));

  const typeBox = {
    well: "Well",
    pipeline: "Pipeline",
    facility: "Facility",
    owm_facility: "Waste Management",
  }[d.siteType];
  for (const name of ["Well", "Pipeline", "Facility", "Waste Management"]) {
    const box = form.getCheckBox(name);
    if (name === typeBox) box.check();
    else box.uncheck();
  }
  const landfill = form.getCheckBox("Check if this is a landfill");
  if (d.isLandfill) landfill.check();
  else landfill.uncheck();

  const dropdown = form.getDropdown("FacilityType");
  if (d.facilityType && dropdown.getOptions().includes(d.facilityType)) dropdown.select(d.facilityType);

  if (d.officer) {
    form.getTextField("SigningDate").setText(d.officer.signedOn);
    form.getTextField("Position").setText(d.officer.position);
  }

  form.updateFieldAppearances();

  if (d.officer) {
    const page = pdf.getPage(0);
    const script = await pdf.embedFont(StandardFonts.TimesRomanItalic);
    const plain = await pdf.embedFont(StandardFonts.Helvetica);
    // Coordinates are from the template: the "Signature of senior corporate officer" label sits at y~312,
    // "Position" at y~278, and the Certification box ends at y~251.
    page.drawText(d.officer.typedSignature, { x: 82, y: 288, size: 18, font: script, color: rgb(0.08, 0.1, 0.42) });
    page.drawText(`Electronically signed in CORE SSLA by ${d.officer.name} on ${d.officer.signedOn} (record ${d.officer.recordId.slice(0, 8)}).`, {
      x: 72, y: 240, size: 7, font: plain, color: rgb(0.25, 0.25, 0.25),
    });
    page.drawText(`Certified figures fingerprint (SHA-256): ${d.officer.contentHash.slice(0, 32)}...`, {
      x: 72, y: 231, size: 7, font: plain, color: rgb(0.25, 0.25, 0.25),
    });
  }
  return Buffer.from(await pdf.save());
}

/** The facility descriptions F035 accepts, read from the template so the app never drifts from it. */
export async function facilityTypeOptions(template: ArrayBuffer | Buffer): Promise<string[]> {
  const pdf = await PDFDocument.load(template);
  return pdf.getForm().getDropdown("FacilityType").getOptions().filter((o) => !o.startsWith("--"));
}
