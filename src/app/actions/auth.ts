"use server";

import { redirect } from "next/navigation";
import { back } from "@/lib/flash";
import { supabaseServer } from "@/lib/supabase/server";
import { SITE_URL, str } from "./util";

export async function signIn(fd: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email: str(fd, "email"), password: str(fd, "password") });
  if (error) back("/login", { error: error.message });
  redirect("/sites");
}

export async function signUp(fd: FormData) {
  const password = str(fd, "password");
  if (password.length < 10) back("/login", { error: "Use a password of at least 10 characters." });
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signUp({
    email: str(fd, "email"),
    password,
    options: { data: { full_name: str(fd, "full_name") }, emailRedirectTo: `${SITE_URL}/auth/callback` },
  });
  if (error) back("/login", { error: error.message });
  back("/login", { ok: "Check your email and follow the link to confirm your account, then sign in." });
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
