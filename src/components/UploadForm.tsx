"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { validateUpload, type UploadPurpose } from "@/lib/uploads";

/**
 * Upload form: the browser sends the file straight to Supabase Storage through a one-time signed URL (so it never
 * passes through a Vercel function and its ~4.5 MB request cap), then calls `action` with the other fields plus
 * `object_path` and `file_name`. The server action confirms the object arrived and records it.
 * Fields are passed as children (server-rendered) and must include `<input type="file" name="file">`.
 */
export function UploadForm({
  action,
  purpose,
  siteId,
  orgId,
  submitLabel = "Upload",
  children,
}: {
  action: (fd: FormData) => Promise<void>;
  purpose: UploadPurpose;
  siteId?: string;
  orgId?: string;
  submitLabel?: string;
  children: ReactNode;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    if (!(file instanceof File)) {
      setMessage("Choose a file to upload.");
      return;
    }
    const problem = validateUpload(file.name, file.size);
    if (problem) {
      setMessage(problem);
      return;
    }
    setBusy(true);
    setMessage("Uploading…");
    try {
      const res = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose,
          siteId,
          orgId: String(fd.get("org_id") ?? orgId ?? "") || undefined,
          fileName: file.name,
          size: file.size,
        }),
      });
      const body = (await res.json().catch(() => null)) as { path?: string; token?: string; error?: string } | null;
      if (!res.ok || !body?.token || !body.path) throw new Error(body?.error ?? "Could not start the upload.");

      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { error } = await supabase.storage.from("site-files").uploadToSignedUrl(body.path, body.token, file, {
        contentType: file.type || undefined,
      });
      if (error) throw new Error(error.message);

      fd.delete("file");
      fd.set("object_path", body.path);
      fd.set("file_name", file.name);
      setMessage("Saving…");
      startTransition(async () => {
        await action(fd);
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload failed.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card">
      {children}
      <p>
        <button type="submit" disabled={busy}>{submitLabel}</button>{" "}
        {message && <span className="sub" role="status">{message}</span>}
      </p>
    </form>
  );
}
