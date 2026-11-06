import { issue } from "../helpers";
import type { Issue, Rule } from "../types";

/** V-09 (Req. 11): pipeline abandonment must state abandon-in-place or removed, per segment. */
export const v09PipelineMethod: Rule = (ctx) => {
  const segments = ctx.details.abandonment.pipelineSegments;
  const out: Issue[] = [];
  if (ctx.site.siteType === "pipeline" && segments.length === 0) {
    out.push(
      issue("V-09", "block", "Req. 11", "abandonment",
        "Add the pipeline segment(s) and state for each whether the pipe is abandoned in place or removed.",
        { field: "pipelineSegments" }),
    );
  }
  segments.forEach((seg, i) => {
    if (seg.method === null) {
      out.push(
        issue("V-09", "block", "Req. 11", "abandonment",
          `Segment "${seg.label ?? seg.id}": state whether the pipe is abandoned in place or removed.`,
          { field: `pipelineSegments.${i}.method` }),
      );
    }
  });
  return out;
};
