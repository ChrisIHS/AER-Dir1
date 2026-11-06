import { NextResponse, type NextRequest } from "next/server";
import { loadMemberships, resolveSiteAccess } from "@/lib/db/access";
import { supabaseServer } from "@/lib/supabase/server";
import { libraryObjectPath, siteObjectPath, validateUpload, type UploadPurpose } from "@/lib/uploads";

const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Step 1 of an upload: check the user may add this file, and hand back a one-time signed upload URL token.
 * Supabase evaluates the storage INSERT policy when the token is created, so the folder rules in
 * app.can_upload_path apply exactly as they did when files passed through the server.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    purpose?: UploadPurpose; siteId?: string; orgId?: string; fileName?: string; size?: number;
  } | null;
  if (!body || typeof body.fileName !== "string" || typeof body.size !== "number") return json({ error: "Bad request." }, 400);

  const problem = validateUpload(body.fileName, body.size);
  if (problem) return json({ error: problem }, 400);

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in again." }, 401);
  const memberships = await loadMemberships(supabase, user.id);
  if (memberships.length === 0) return json({ error: "Set up your organization first." }, 403);

  let path: string;
  if (body.purpose === "library") {
    if (!body.orgId || !memberships.some((m) => m.org.id === body.orgId)) return json({ error: "Choose one of your organizations." }, 403);
    path = libraryObjectPath(body.orgId, body.fileName, crypto.randomUUID());
  } else if (body.purpose === "rate_sheet" || body.purpose === "document") {
    if (!body.siteId) return json({ error: "Bad request." }, 400);
    const access = await resolveSiteAccess(supabase, user.id, memberships, body.siteId);
    if (!access) return json({ error: "Site not found." }, 404);
    path = siteObjectPath(access.actingOrgId, body.siteId, body.fileName, crypto.randomUUID());
  } else {
    return json({ error: "Bad request." }, 400);
  }

  const { data, error } = await supabase.storage.from("site-files").createSignedUploadUrl(path);
  if (error || !data) return json({ error: "You can't upload here." }, 403);
  return json({ path: data.path, token: data.token });
}
