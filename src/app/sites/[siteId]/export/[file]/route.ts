import { NextResponse, type NextRequest } from "next/server";
import { requireSiteAccess, seesAll } from "@/lib/db/access";
import { buildArtifacts, loadExportData } from "@/lib/export/data";

const TYPES = {
  "cost-forms": { key: "costForms", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  "liability-declaration": { key: "liabilityDeclaration", type: "application/pdf" },
  acknowledgements: { key: "acknowledgements", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  schedule: { key: "schedule", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
} as const;

/** Individual form downloads. Licensee staff and the lead assessor only; filenames say DRAFT until both statements are signed. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ siteId: string; file: string }> }) {
  const { siteId, file } = await params;
  const spec = TYPES[file as keyof typeof TYPES];
  if (!spec) return new NextResponse("Not found", { status: 404 });
  const a = await requireSiteAccess(siteId);
  if (!seesAll(a)) return new NextResponse("Not found", { status: 404 });

  const art = await buildArtifacts(await loadExportData(siteId));
  const out = art[spec.key];
  return new NextResponse(new Uint8Array(out.data), {
    headers: {
      "Content-Type": spec.type,
      "Content-Disposition": `attachment; filename="${out.name}"`,
      "Cache-Control": "no-store",
    },
  });
}
