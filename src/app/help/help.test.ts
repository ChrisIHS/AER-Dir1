import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RULES } from "@/lib/validation/rules";
import { WORKSTREAM_META } from "@/lib/workstreams/meta";

const page = readFileSync(path.resolve(__dirname, "page.tsx"), "utf8");

/** The Help page is the user manual: it must not fall behind the rules and screens the app actually has. */
describe("Help page stays in sync with the app", () => {
  it.each([...Object.keys(RULES), "V-22", "V-23", "V-25"])("explains check %s", (id) => {
    expect(page).toContain(`"${id}"`);
  });

  it.each(Object.values(WORKSTREAM_META).map((m) => m.title))("describes the workstream: %s", (title) => {
    expect(page).toContain(title);
  });

  it("covers the screens a user needs", () => {
    for (const label of ["Access and assignments", "Rate sheets", "Report details", "Sign-off", "Forms and package", "Rate library", "My credentials", "Confirmations"]) {
      expect(page, label).toContain(label);
    }
  });

  it("is honest about the limits", () => {
    expect(page).toContain("does <strong>not submit anything to the AER</strong>");
    expect(page).toContain("professional stamp or seal");
    expect(page).toContain("electronic signature");
  });

  it("only links to routes that exist", () => {
    const hrefs = [...page.matchAll(/href="(\/[a-z/]*)"/g)].map((m) => m[1]);
    expect(new Set(hrefs)).toEqual(new Set(["/sites", "/library", "/account/credentials"]));
  });
});
