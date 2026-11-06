import { describe, expect, it } from "vitest";
import { parseDetails } from "./details";
import {
  apecsToText, DETAIL_FIELDS, getAt, readDetailsForm, segmentsToText, setAt, textToApecs, textToSegments,
} from "./fields";
import { WORKSTREAM_KINDS } from "@/lib/validation/types";

function form(entries: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  return fd;
}

describe("path helpers", () => {
  it("getAt / setAt handle nesting", () => {
    const o: Record<string, unknown> = {};
    setAt(o, "a.b.c", 5);
    expect(o).toEqual({ a: { b: { c: 5 } } });
    expect(getAt(o, "a.b.c")).toBe(5);
    expect(getAt(o, "a.x.c")).toBeUndefined();
    setAt(o, "a.b.c", undefined);
    expect(getAt(o, "a.b")).toEqual({});
  });
});

describe("list <-> text", () => {
  it("parses pipeline segments", () => {
    expect(textToSegments("Seg A | removed\nSeg B | in_place\nSeg C\nSeg D | bogus\n\n")).toEqual([
      { id: "seg-1", label: "Seg A", method: "removed" },
      { id: "seg-2", label: "Seg B", method: "in_place" },
      { id: "seg-3", label: "Seg C", method: null },
      { id: "seg-4", label: "Seg D", method: null },
    ]);
  });
  it("round-trips segments", () => {
    const segs = textToSegments("Seg A | removed\nSeg B");
    expect(textToSegments(segmentsToText(segs))).toEqual(segs);
  });
  it("round-trips APECs", () => {
    const a = textToApecs("Former tank area\n  Flare pit \n");
    expect(a.map((x) => x.description)).toEqual(["Former tank area", "Flare pit"]);
    expect(textToApecs(apecsToText(a))).toEqual(a);
  });
});

describe("field specs", () => {
  it("every kind has the Req. 4 attestation first", () => {
    for (const k of WORKSTREAM_KINDS) expect(DETAIL_FIELDS[k][0]!.path).toBe("attestations.noNpvDiscount");
  });
  it("paths are unique within a kind", () => {
    for (const k of WORKSTREAM_KINDS) {
      const paths = DETAIL_FIELDS[k].map((f) => f.path);
      expect(new Set(paths).size).toBe(paths.length);
    }
  });
  it("every spec path exists in the default details object", () => {
    for (const k of WORKSTREAM_KINDS) {
      const defaults = parseDetails(k, {});
      for (const f of DETAIL_FIELDS[k]) {
        if (f.path.startsWith("req5ZeroRationale.")) continue; // record keys exist only once filled
        expect(getAt(defaults, f.path), `${k}.${f.path}`).not.toBeUndefined();
      }
    }
  });
});

describe("readDetailsForm", () => {
  it("reads bools, numbers, text and trims", () => {
    const r = readDetailsForm(
      form({
        "attestations.noNpvDiscount": "on",
        phase1OnestopId: "  P1-77 ",
        "volumes.bulkingFactor": "1.3",
        "volumes.moisturePct": "",
        offSiteDisposalPlanned: "on",
        remediationApproach: "tier2",
        apecs: "Tank area\nFlare pit",
      }),
      "esa_remediation",
      {},
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = r.data as ReturnType<typeof parseDetails<"esa_remediation">>;
    expect(d.attestations.noNpvDiscount).toBe(true);
    expect(d.phase1OnestopId).toBe("P1-77");
    expect(d.volumes.bulkingFactor).toBe(1.3);
    expect(d.volumes.moisturePct).toBeNull();
    expect(d.offSiteDisposalPlanned).toBe(true);
    expect(d.remediationApproach).toBe("tier2");
    expect(d.apecs).toHaveLength(2);
  });

  it("unchecked boxes become false", () => {
    const r = readDetailsForm(form({}), "contingencies", { attestations: { noNpvDiscount: true }, missingHistoryDeclared: true });
    expect(r.ok && (r.data as { missingHistoryDeclared: boolean }).missingHistoryDeclared).toBe(false);
  });

  it("non-numeric text in a number field becomes null instead of NaN", () => {
    const r = readDetailsForm(form({ "volumes.bulkingFactor": "abc" }), "esa_remediation", {});
    expect(r.ok && (r.data as { volumes: { bulkingFactor: number | null } }).volumes.bulkingFactor).toBeNull();
  });

  it("rejects an unknown select value rather than wiping the stored data", () => {
    const r = readDetailsForm(form({ remediationApproach: "tier9" }), "esa_remediation", { phase1OnestopId: "KEEP" });
    expect(r.ok).toBe(false);
  });

  it("filters multicheck values to the allowed options", () => {
    const r = readDetailsForm(form({ elementsAddressed: ["a", "c", "zzz"] }), "reclamation", {});
    expect(r.ok && (r.data as { elementsAddressed: string[] }).elementsAddressed).toEqual(["a", "c"]);
  });

  it("omits empty zero-rationale entries but keeps filled ones", () => {
    const r = readDetailsForm(form({ "req5ZeroRationale.h": "Supplied by the licensee", "req5ZeroRationale.i": "" }), "mgmt_admin", {
      req5ZeroRationale: { i: "old" },
    });
    expect(r.ok && (r.data as { req5ZeroRationale: Record<string, string> }).req5ZeroRationale).toEqual({ h: "Supplied by the licensee" });
  });

  it("drops keys outside the schema (Zod strips unknown keys)", () => {
    const r = readDetailsForm(form({}), "abandonment", { extra: "dropped" });
    expect(r.ok && "extra" in r.data).toBe(false);
  });
});
