import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Email-confirmation landing: exchanges the PKCE code for a session, then continues to the app. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const origin = request.nextUrl.origin;
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/sites`);
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("That confirmation link is invalid or has expired. Try signing in, or create the account again.")}`);
}
