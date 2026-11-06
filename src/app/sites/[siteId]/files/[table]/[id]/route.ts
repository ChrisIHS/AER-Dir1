import { NextResponse, type NextRequest } from "next/server";
import { requireSiteAccess } from "@/lib/db/access";

/** Short-lived signed download. The row lookup runs under the user's RLS, so access matches the table policies. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ siteId: string; table: string; id: string }> }) {
  const { siteId, table, id } = await params;
  if (table !== "rate_sheets" && table !== "documents" && table !== "package_exports") return new NextResponse("Not found", { status: 404 });
  const a = await requireSiteAccess(siteId);

  // package_exports has no site_id: it hangs off the assessment
  let query = a.supabase.from(table).select("storage_path").eq("id", id);
  if (table !== "package_exports") query = query.eq("site_id", siteId);
  const { data: row } = await query.maybeSingle();
  if (!row) return new NextResponse("Not found", { status: 404 });

  const { data, error } = await a.supabase.storage.from("site-files").createSignedUrl(row.storage_path, 60);
  if (error || !data) return new NextResponse("The file is not available.", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
