import { redirect } from "next/navigation";

/** Redirect back to a page with a one-line message shown by <Flash />. */
export function back(path: string, msg: { error?: string; ok?: string }): never {
  const [base, hash] = path.split("#");
  const q = new URLSearchParams();
  if (msg.error) q.set("error", msg.error);
  if (msg.ok) q.set("ok", msg.ok);
  const sep = base!.includes("?") ? "&" : "?";
  redirect(`${base}${sep}${q.toString()}${hash ? `#${hash}` : ""}`);
}
