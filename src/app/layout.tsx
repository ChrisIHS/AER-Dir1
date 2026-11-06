import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "./actions/auth";
import { supabaseServer } from "@/lib/supabase/server";
import "./globals.css";

export const metadata = { title: "CORE SSLA", description: "Site-specific liability assessments under AER Directive 001" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <html lang="en">
      <body>
        <header className="top">
          <nav>
            <Link className="brand" href="/sites">CORE SSLA</Link>
            <Link href="/help">Help</Link>
            {user ? (
              <>
                <Link href="/sites">Sites</Link>
                <Link href="/library">Rate library</Link>
                <Link href="/account/credentials">My credentials</Link>
                <span className="sub" style={{ margin: 0 }}>{user.email}</span>
                <form action={signOut}>
                  <button className="secondary" type="submit">Sign out</button>
                </form>
              </>
            ) : null}
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
