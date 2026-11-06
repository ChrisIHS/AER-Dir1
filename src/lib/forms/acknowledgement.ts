import PizZip from "pizzip";

export interface SignoffInfo {
  name: string;
  /** e.g. "APEGA 12345" (association and registration number). */
  credentials: string;
  /** ISO date the sign-off was recorded. */
  signedOn: string;
}

export interface AckData {
  licensee: string;
  /** "<licence number> <site name>" */
  siteLicenceAndName: string;
  lsd: string;
  assessmentDate: string;
  careSuspAband: SignoffInfo | null;
  remediationReclamation: SignoffInfo | null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const textOf = (p: string) => [...p.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");

/** Replace the "(INSERT ...)" placeholders in a paragraph whose text Word has split across several runs. */
function mergeAndReplace(p: string, d: AckData): string {
  let n = 0;
  const joined = textOf(p)
    .replace("(INSERT SITE LICENCE AND NAME)", esc(d.siteLicenceAndName))
    .replace("(INSERT LICENSEE NAME)", esc(d.licensee))
    .replace("(INSERT LICENSEE)", esc(d.licensee))
    .replace("(INSERT ASSESSMENT DATE)", esc(d.assessmentDate))
    .replace("(LSD)", esc(d.lsd));
  return p.replace(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/g, () => (n++ === 0 ? `<w:t xml:space="preserve">${joined}</w:t>` : "<w:t></w:t>"));
}

function signerParagraph(s: SignoffInfo | null): string {
  const text = s
    ? `Signed electronically in CORE SSLA by ${s.name}, ${s.credentials}, on ${s.signedOn}. Professional stamp or seal: not applied by this app; apply it before submission (Req. 54, 55).`
    : "Not yet signed by the lead assessor.";
  return `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

/**
 * Fill the two Acknowledgement Statements (reference/Directive001_Acknowledgement-Statement-Forms.docx).
 * Placeholders are replaced; each statement's attestation check boxes are ticked only once its sign-off
 * is recorded; a line naming the signer is added above each signature block. The wet or digital
 * signature itself and the professional stamp stay with the lead assessor.
 */
export function fillAcknowledgements(template: ArrayBuffer | Buffer, d: AckData): Buffer {
  const zip = new PizZip(template as Buffer);
  const xml = zip.file("word/document.xml")!.asText();

  let section: 1 | 2 = 1;
  const out = xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (p) => {
    const text = textOf(p);
    if (text.includes("Remediation and Surface Land Reclamation Acknowledgement")) section = 2;
    let result = p;
    if (text.includes("(INSERT") || text.includes("(LSD)")) result = mergeAndReplace(result, d);
    if (result.includes("<w:ffData>")) {
      const signed = section === 1 ? d.careSuspAband : d.remediationReclamation;
      result = result.replace(/<w:default w:val="[01]"\/>/g, `<w:default w:val="${signed ? 1 : 0}"/>`);
    }
    if (text.startsWith("Signature of Lead Assessor")) {
      result = signerParagraph(section === 1 ? d.careSuspAband : d.remediationReclamation) + result;
    }
    return result;
  });

  zip.file("word/document.xml", out);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
