import { describe, expect, it } from "vitest";
import {
  ALLOWED_EXT, extensionOf, libraryObjectPath, MAX_UPLOAD_BYTES, pathBelongsTo, safeFileName, siteObjectPath, validateUpload,
} from "./uploads";

const ORG = "a0000000-0000-4000-8000-000000000002";
const SITE = "b0000000-0000-4000-8000-000000000001";
const U = "d0000000-0000-4000-8000-000000000009";

describe("validateUpload", () => {
  it.each(ALLOWED_EXT)("accepts .%s", (ext) => expect(validateUpload(`file.${ext}`, 1000)).toBeNull());
  it("is case-insensitive about the extension", () => expect(validateUpload("RATES.PDF", 1000)).toBeNull());
  it("accepts a file exactly at the limit and rejects one byte over", () => {
    expect(validateUpload("a.pdf", MAX_UPLOAD_BYTES)).toBeNull();
    expect(validateUpload("a.pdf", MAX_UPLOAD_BYTES + 1)).toMatch(/25 MB/);
  });
  it.each(["a.exe", "a.zip", "a.html", "a.svg", "noextension", "a.pdf.exe"])("rejects %s", (n) => {
    expect(validateUpload(n, 1000)).toMatch(/aren't accepted/);
  });
  it("rejects empty files and empty names", () => {
    expect(validateUpload("a.pdf", 0)).toMatch(/empty/);
    expect(validateUpload("", 10)).toMatch(/Choose a file/);
    expect(validateUpload("a.pdf", Number.NaN)).toMatch(/empty/);
  });
});

describe("file names and paths", () => {
  it("extensionOf", () => {
    expect(extensionOf("a.b.PDF")).toBe("pdf");
    expect(extensionOf("none")).toBe("");
  });
  it("safeFileName strips path characters and caps the length", () => {
    expect(safeFileName("../../etc/passwd")).toBe("etc_passwd");
    expect(safeFileName("Rates 2026 (final).pdf")).toBe("Rates_2026_final_.pdf");
    expect(safeFileName("///")).toBe("file");
    expect(safeFileName("x".repeat(300)).length).toBe(120);
  });
  it("builds site and library object paths", () => {
    expect(siteObjectPath(ORG, SITE, "My Rates.pdf", U)).toBe(`${ORG}/${SITE}/${U}-My_Rates.pdf`);
    expect(libraryObjectPath(ORG, "My Rates.pdf", U)).toBe(`${ORG}/library/${U}-My_Rates.pdf`);
  });
});

describe("pathBelongsTo", () => {
  const site = { orgId: ORG, siteId: SITE };
  const lib = { orgId: ORG, library: true as const };
  it("accepts the exact folder", () => {
    expect(pathBelongsTo(siteObjectPath(ORG, SITE, "a.pdf", U), site)).toBe(true);
    expect(pathBelongsTo(libraryObjectPath(ORG, "a.pdf", U), lib)).toBe(true);
  });
  it.each([
    ["another organization", `a0000000-0000-4000-8000-000000000003/${SITE}/x.pdf`],
    ["another site", `${ORG}/b0000000-0000-4000-8000-000000000002/x.pdf`],
    ["the library when a site is expected", `${ORG}/library/x.pdf`],
    ["a nested path", `${ORG}/${SITE}/sub/x.pdf`],
    ["a parent path", `${ORG}/${SITE}/../x.pdf`],
    ["an empty file name", `${ORG}/${SITE}/`],
    ["a bare file", "x.pdf"],
  ])("rejects %s", (_n, p) => expect(pathBelongsTo(p, site)).toBe(false));
  it("the library folder rejects site paths", () => {
    expect(pathBelongsTo(`${ORG}/${SITE}/x.pdf`, lib)).toBe(false);
  });
});
