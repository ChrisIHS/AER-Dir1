import { readFileSync } from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { fillAcknowledgements, type AckData, type SignoffInfo } from "./acknowledgement";

const template = readFileSync(path.resolve(__dirname, "../../../reference/Directive001_Acknowledgement-Statement-Forms.docx"));

const signer: SignoffInfo = { name: "Alex Assessor", credentials: "APEGA DEMO-12345", signedOn: "2026-11-05" };
const base: AckData = {
  licensee: "Prairie Ridge Energy Ltd.",
  siteLicenceAndName: "DEMO-W-0001 Demo 6-12 Oil Well",
  lsd: "00/06-12-045-08W5/0",
  assessmentDate: "2026-11-05",
  careSuspAband: null,
  remediationReclamation: null,
};

const docXml = (buf: Buffer) => new PizZip(buf).file("word/document.xml")!.asText();
const plain = (xml: string) => [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");
const checked = (xml: string) => (xml.match(/<w:default w:val="1"\/>/g) ?? []).length;
const TOTAL_BOXES = (new PizZip(template).file("word/document.xml")!.asText().match(/<w:ffData>/g) ?? []).length;

describe("acknowledgement statements", () => {
  it("replaces every placeholder, including ones Word split across runs", () => {
    const xml = docXml(fillAcknowledgements(template, base));
    const text = plain(xml);
    expect(text).not.toContain("(INSERT");
    expect(text).not.toContain("(LSD)");
    expect(text).toContain("prepared for Prairie Ridge Energy Ltd. for the DEMO-W-0001 Demo 6-12 Oil Well facility located at 00/06-12-045-08W5/0 on 2026-11-05");
    expect(text).toContain("for the use of Prairie Ridge Energy Ltd., the Alberta Energy Regulator, and the Government of Alberta");
  });

  it("escapes characters that are special in XML", () => {
    const xml = docXml(fillAcknowledgements(template, { ...base, licensee: "Smith & Sons <Energy> Ltd." }));
    expect(xml).toContain("Smith &amp; Sons &lt;Energy&gt; Ltd.");
  });

  it("leaves all attestation boxes unticked until a statement is signed", () => {
    expect(checked(docXml(fillAcknowledgements(template, base)))).toBe(0);
  });

  it("ticks both statements' boxes when both are signed", () => {
    expect(checked(docXml(fillAcknowledgements(template, { ...base, careSuspAband: signer, remediationReclamation: signer })))).toBe(TOTAL_BOXES);
  });

  it("ticks only the signed statement's boxes", () => {
    const first = checked(docXml(fillAcknowledgements(template, { ...base, careSuspAband: signer })));
    const second = checked(docXml(fillAcknowledgements(template, { ...base, remediationReclamation: signer })));
    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(0);
    expect(first + second).toBe(TOTAL_BOXES);
    expect(TOTAL_BOXES).toBe(5);
  });

  it("names the signer above each signature block and says the stamp is not applied", () => {
    const text = plain(docXml(fillAcknowledgements(template, { ...base, careSuspAband: signer })));
    expect(text).toContain("Signed electronically in CORE SSLA by Alex Assessor, APEGA DEMO-12345, on 2026-11-05");
    expect(text).toContain("Professional stamp or seal: not applied by this app");
    expect(text).toContain("Not yet signed by the lead assessor.");
  });

  it("keeps the statement wording intact", () => {
    const text = plain(docXml(fillAcknowledgements(template, base)));
    expect(text).toContain("Closure Statement");
    expect(text).toContain("Phase 1 Environmental Site Assessment");
    expect(text).toContain("Signature of Lead Assessor");
  });

  it("produces a valid zip that still contains every original part", () => {
    const out = new PizZip(fillAcknowledgements(template, base));
    const orig = new PizZip(template);
    expect(Object.keys(out.files).sort()).toEqual(Object.keys(orig.files).sort());
  });
});
