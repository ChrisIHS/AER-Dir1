import { NextResponse } from "next/server";

/** Post-deploy check: reports whether the required configuration is present (never the values). */
export function GET() {
  const need = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SITE_URL"];
  const missing = need.filter((k) => !process.env[k]);
  return NextResponse.json({ ok: missing.length === 0, missing }, { status: missing.length === 0 ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
