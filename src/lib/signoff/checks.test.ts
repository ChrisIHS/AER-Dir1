import { describe, expect, it } from "vitest";
import { WORKSTREAM_KINDS } from "@/lib/validation/types";
import { checkSignoff, type SignoffCheckInput } from "./checks";

const ready = (): SignoffCheckInput => ({
  assessmentDate: "2026-11-05",
  limitationsText: "Snow cover limited access to the north half of the lease.",
  personnel: [{ name: "Pat Assessor", role: "Lead assessor", technical_training: "B.Sc. Environmental Science", experience: "12 years of SSLAs" }],
  credentials: [{ association: "APEGA", registration_no: "12345", good_standing_attested_at: "2026-11-01T00:00:00Z" }],
  workstreams: Object.fromEntries(WORKSTREAM_KINDS.map((k) => [k, { applicable: true, status: "approved" }])) as SignoffCheckInput["workstreams"],
  issues: [],
  acknowledged: { req54: true, req56: true, req57: true },
});

const reqs = (i: SignoffCheckInput) => checkSignoff(i).map((p) => `${p.ruleId} ${p.req}`);

describe("sign-off checks (V-22, V-23)", () => {
  it("passes when everything is in place", () => expect(checkSignoff(ready())).toEqual([]));

  it("blocks while any applicable workstream is not approved", () => {
    const i = ready();
    i.workstreams.reclamation.status = "submitted";
    expect(reqs(i)).toEqual(["GATE Req. 52"]);
    expect(checkSignoff(i)[0]!.message).toContain("reclamation");
  });

  it("ignores workstreams that do not apply", () => {
    const i = ready();
    i.workstreams.reclamation = { applicable: false, status: "not_started" };
    expect(checkSignoff(i)).toEqual([]);
  });

  it("blocks on any blocking validation issue", () => {
    const i = ready();
    i.issues = [{ ruleId: "V-10", severity: "block", req: "Req. 19", message: "x", workstream: "esa_remediation" }];
    expect(reqs(i)).toEqual(["GATE Req. 58(h)"]);
  });

  it("warnings do not block", () => {
    const i = ready();
    i.issues = [{ ruleId: "V-13", severity: "warn", req: "Req. 17", message: "x", workstream: "esa_remediation" }];
    expect(checkSignoff(i)).toEqual([]);
  });

  it("requires the assessment date and the limitations section (Req. 48)", () => {
    const i = ready();
    i.assessmentDate = null;
    i.limitationsText = "  ";
    expect(reqs(i)).toEqual(["V-22 Req. 58", "V-22 Req. 48"]);
  });

  it("requires at least one person, and every field of every row (Req. 51)", () => {
    const i = ready();
    i.personnel = [];
    expect(reqs(i)).toEqual(["V-22 Req. 51"]);
    i.personnel = [
      { name: "Pat", role: "Lead", technical_training: "B.Sc.", experience: "5 yrs" },
      { name: "Sam", role: "", technical_training: null, experience: "2 yrs" },
    ];
    const p = checkSignoff(i);
    expect(p).toHaveLength(1);
    expect(p[0]!.message).toContain("Personnel row 2 (Sam)");
    expect(p[0]!.message).toContain("role, technical training");
  });

  it("requires professional credentials with good standing attested (Req. 53)", () => {
    const i = ready();
    i.credentials = [];
    expect(reqs(i)).toEqual(["V-22 Req. 53"]);
    i.credentials = [{ association: "APEGA", registration_no: "12345", good_standing_attested_at: null }];
    expect(checkSignoff(i)[0]!.message).toMatch(/good standing/);
    i.credentials = [{ association: "APEGA", registration_no: " ", good_standing_attested_at: "2026-11-01" }];
    expect(reqs(i)).toEqual(["V-22 Req. 53"]);
  });

  it.each([
    ["req54", "V-23 Req. 54"],
    ["req56", "V-23 Req. 56"],
    ["req57", "V-23 Req. 57"],
  ] as const)("requires the %s acknowledgement", (k, want) => {
    const i = ready();
    i.acknowledged[k] = false;
    expect(reqs(i)).toEqual([want]);
  });

  it("reports everything at once, not just the first problem", () => {
    const i = ready();
    i.assessmentDate = null;
    i.personnel = [];
    i.acknowledged = { req54: false, req56: false, req57: false };
    expect(checkSignoff(i).length).toBe(5);
  });
});
