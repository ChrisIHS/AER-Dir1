"use server";

import { requireSiteAccess } from "@/lib/db/access";
import { loadSiteBundle } from "@/lib/db/load";
import { back } from "@/lib/flash";
import { FORM_ROW_BY_KEY } from "@/lib/forms/templateMap";
import { canSubmit, issuesFor, validate } from "@/lib/validation/engine";
import { WORKSTREAM_KINDS, type WorkstreamKind } from "@/lib/validation/types";
import { SCHEMA_VERSION } from "@/lib/workstreams/details";
import { readDetailsForm } from "@/lib/workstreams/fields";
import { isUuid, numOrNull, str, strOrNull } from "./util";

function parseKind(fd: FormData): WorkstreamKind {
  const k = str(fd, "kind");
  const found = WORKSTREAM_KINDS.find((x) => x === k);
  if (!found) throw new Error("Unknown workstream");
  return found;
}

export async function saveDetails(fd: FormData) {
  const siteId = str(fd, "site_id");
  const kind = parseKind(fd);
  const wsId = str(fd, "workstream_id");
  const path = `/sites/${siteId}/w/${kind}`;
  const a = await requireSiteAccess(siteId);

  const { data: ws } = await a.supabase.from("workstreams").select("id, kind").eq("id", wsId).maybeSingle();
  if (!ws || ws.kind !== kind) back(path, { error: "Workstream not found." });

  const { data: existing } = await a.supabase.from("workstream_details").select("data").eq("workstream_id", wsId).maybeSingle();
  const parsed = readDetailsForm(fd, kind, existing?.data ?? {});
  if (!parsed.ok) back(path, { error: parsed.error });

  const { data: saved, error } = await a.supabase
    .from("workstream_details")
    .update({ data: parsed.data, schema_version: SCHEMA_VERSION })
    .eq("workstream_id", wsId)
    .select("workstream_id");
  if (error) back(path, { error: error.message });
  if (!saved?.length) back(path, { error: "Not saved: this workstream is locked (submitted or approved) or you can't edit it." });

  if (fd.get("applicable_present")) {
    const applicable = fd.get("applicable") === "on";
    const rationale = strOrNull(fd, "na_rationale");
    if (!applicable && !rationale) back(path, { error: "Details saved, but a workstream marked not applicable needs a rationale." });
    await a.supabase.from("workstreams").update({ applicable, na_rationale: applicable ? null : rationale }).eq("id", wsId);
  }
  back(path, { ok: "Details saved." });
}

export async function saveLine(fd: FormData) {
  const siteId = str(fd, "site_id");
  const kind = parseKind(fd);
  const wsId = str(fd, "workstream_id");
  const lineId = str(fd, "id");
  const path = `/sites/${siteId}/w/${kind}`;
  const a = await requireSiteAccess(siteId);

  const rowKey = str(fd, "form_row_key");
  const row = FORM_ROW_BY_KEY.get(rowKey);
  if (!row) back(path + "#lines", { error: "Choose the AER form row this line belongs to." });

  const mode = str(fd, "calc_mode") === "percent_of_base" ? "percent_of_base" : "qty_x_rate";
  const qtyIn = numOrNull(fd, "quantity");
  // Percent lines: the user types 10 for 10%; it is stored as the fraction the form's column B expects.
  const quantity = mode === "percent_of_base" && qtyIn !== null ? Math.round((qtyIn / 100) * 1e6) / 1e6 : qtyIn;
  const rateSheetId = str(fd, "rate_sheet_id");
  const docId = str(fd, "supporting_document_id");
  const req5 = str(fd, "req5_item");

  const payload = {
    workstream_id: wsId,
    form_ref: row.form,
    form_row_key: rowKey,
    cost_category: str(fd, "cost_category") || "other",
    task: str(fd, "task"),
    calc_mode: mode,
    quantity,
    unit: mode === "percent_of_base" ? "%" : strOrNull(fd, "unit"),
    unit_rate: numOrNull(fd, "unit_rate"),
    rate_sheet_id: isUuid(rateSheetId) ? rateSheetId : null,
    rate_sheet_ref: strOrNull(fd, "rate_sheet_ref"),
    contingency_kind: strOrNull(fd, "contingency_kind"),
    rationale: strOrNull(fd, "rationale"),
    supporting_document_id: isUuid(docId) ? docId : null,
    notes: strOrNull(fd, "notes"),
    req5_item: req5 && /^[a-k]$/.test(req5) ? req5 : null,
  };

  if (lineId) {
    const { data, error } = await a.supabase.from("cost_line_items").update(payload).eq("id", lineId).select("id");
    if (error) back(path + "#lines", { error: error.message });
    if (!data?.length) back(path + "#lines", { error: "Not saved: this workstream is locked or you can't edit it." });
  } else {
    const { error } = await a.supabase.from("cost_line_items").insert(payload);
    if (error) {
      back(path + "#lines", { error: error.code === "42501" ? "Not saved: this workstream is locked or you can't edit it." : error.message });
    }
  }
  back(path + "#lines", { ok: "Line saved." });
}

export async function deleteLine(fd: FormData) {
  const siteId = str(fd, "site_id");
  const kind = parseKind(fd);
  const path = `/sites/${siteId}/w/${kind}`;
  const a = await requireSiteAccess(siteId);
  const { data, error } = await a.supabase.from("cost_line_items").delete().eq("id", str(fd, "id")).select("id");
  if (error) back(path + "#lines", { error: error.message });
  if (!data?.length) back(path + "#lines", { error: "Not deleted: this workstream is locked or you can't edit it." });
  back(path + "#lines", { ok: "Line deleted." });
}

export async function transition(fd: FormData) {
  const siteId = str(fd, "site_id");
  const kind = parseKind(fd);
  const wsId = str(fd, "workstream_id");
  const action = str(fd, "action");
  const path = `/sites/${siteId}/w/${kind}`;
  const a = await requireSiteAccess(siteId);
  if (!["start", "submit", "return", "approve"].includes(action)) back(path, { error: "Unknown action." });

  const { data: ws } = await a.supabase.from("workstreams").select("id, kind, status").eq("id", wsId).maybeSingle();
  if (!ws || ws.kind !== kind) back(path, { error: "Workstream not found." });

  if (action === "submit") {
    // Gate: Directive 001 rules evaluated on the full site context (docs/PLAN.md 4.2).
    const bundle = await loadSiteBundle(siteId);
    const issues = validate(bundle.ctx);
    if (!canSubmit(issues, kind)) {
      const n = issuesFor(issues, kind).filter((i) => i.severity === "block").length;
      back(path, { error: `Can't submit: ${n} blocking issue${n === 1 ? "" : "s"} must be fixed first (see Issues).` });
    }
    if (ws.status === "not_started") {
      const { error } = await a.supabase.rpc("transition_workstream", { p_workstream: wsId, p_action: "start" });
      if (error) back(path, { error: error.message });
    }
  }

  const { error } = await a.supabase.rpc("transition_workstream", {
    p_workstream: wsId,
    p_action: action,
    p_reason: strOrNull(fd, "reason"),
  });
  if (error) back(path, { error: error.message });
  back(path, { ok: { start: "Started.", submit: "Submitted for review.", return: "Returned for changes.", approve: "Approved." }[action] });
}
