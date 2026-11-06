import { createHash } from "node:crypto";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { TrackerItem } from "@/lib/tracker/tracker";
import { buildZip, DOC_FOLDER, packageFileName, uniquePath, type PackageMeta } from "./zip";

const meta: PackageMeta = {
  siteName: "Demo 6-12 Oil Well", licenceNumber: "DEMO-W-0001", licensee: "Prairie Ridge Energy Ltd.",
  generatedAt: "2026-11-05T12:00:00Z", generatedBy: "Dana Admin",
};
const tracker: TrackerItem[] = [
  { ref: "a", title: "Suspension plan", req: "Req. 58(a)", status: "green", owner: "NAS", detail: "ok" },
  { ref: "k", title: "Estimate entered in the AER's designated system", req: "Req. 58(k)", status: "red", owner: "Licensee", detail: "no" },
];
const bytes = (s: string) => new TextEncoder().encode(s);

describe("buildZip", () => {
  const files = [
    { path: "01-forms/Form.xlsx", data: bytes("xlsx-bytes"), req: "Req. 58(g)(ii)" },
    { path: "05-rate-sheets/NAS rates.pdf", data: bytes("pdf-bytes"), req: "Req. 58(j)" },
  ];
  const { zip, manifest } = buildZip(files, meta, tracker);
  const unzipped = unzipSync(zip);

  it("contains the files, a README and a manifest", () => {
    expect(Object.keys(unzipped).sort()).toEqual(["00-README.txt", "01-forms/Form.xlsx", "05-rate-sheets/NAS rates.pdf", "manifest.json"]);
    expect(strFromU8(unzipped["01-forms/Form.xlsx"]!)).toBe("xlsx-bytes");
  });

  it("manifest hashes match the stored bytes", () => {
    const parsed = JSON.parse(strFromU8(unzipped["manifest.json"]!));
    expect(parsed).toEqual(manifest);
    for (const f of parsed.files) {
      expect(f.sha256).toBe(createHash("sha256").update(unzipped[f.path]!).digest("hex"));
      expect(f.bytes).toBe(unzipped[f.path]!.byteLength);
    }
  });

  it("README names the site, the Req. 58 status, and what remains to do", () => {
    const readme = strFromU8(unzipped["00-README.txt"]!);
    expect(readme).toContain("Licence number:  DEMO-W-0001");
    expect(readme).toMatch(/a\s+Suspension plan\s+complete/);
    expect(readme).toMatch(/k\s+Estimate entered.*MISSING/);
    expect(readme).toContain("ssla@aer.ca");
    expect(readme).toContain("senior corporate officer");
    expect(readme).toContain("stamp or seal");
  });
});

describe("file naming", () => {
  it("keeps the stored extension and strips path characters", () => {
    expect(packageFileName("Recycler: price/list", "org/site/uuid-prices.PDF")).toBe("Recycler_ price_list.pdf");
    expect(packageFileName("Plan.pdf", "a/b/c-plan.pdf")).toBe("Plan.pdf");
    expect(packageFileName("", "a/b/c.docx")).toBe("file.docx");
    expect(packageFileName("../../etc/passwd", "a/b/c.pdf")).not.toContain("/");
  });

  it("makes duplicate paths unique, case-insensitively", () => {
    const taken = new Set<string>();
    expect(uniquePath("03-plans/Plan.pdf", taken)).toBe("03-plans/Plan.pdf");
    expect(uniquePath("03-plans/plan.pdf", taken)).toBe("03-plans/plan (2).pdf");
    expect(uniquePath("03-plans/Plan.pdf", taken)).toBe("03-plans/Plan (3).pdf");
  });

  it("routes document kinds to folders; forbidden kinds are never routed into the package", () => {
    expect(DOC_FOLDER.abandonment_plan).toBe("03-plans");
    expect(DOC_FOLDER.phase1_esa).toBe("04-esa-and-supporting-information");
    expect(DOC_FOLDER.remedial_action_plan).toBe("excluded");
    expect(DOC_FOLDER.contamination_mgmt_report).toBe("excluded");
  });
});
