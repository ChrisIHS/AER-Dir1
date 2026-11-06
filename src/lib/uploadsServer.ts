import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads";

/**
 * After the browser has uploaded through a signed URL, confirm the object really exists and is within the size
 * limit (the client's own size check can't be trusted). Oversized objects are deleted. Returns an error message
 * or null.
 */
export async function verifyUploadedObject(path: string): Promise<string | null> {
  const store = supabaseAdmin().storage.from("site-files");
  const { data, error } = await store.info(path);
  if (error || !data) return "The upload did not arrive. Please try again.";
  if ((data.size ?? 0) > MAX_UPLOAD_BYTES) {
    await store.remove([path]);
    return "That file is larger than 25 MB.";
  }
  if ((data.size ?? 0) <= 0) {
    await store.remove([path]);
    return "That file is empty.";
  }
  return null;
}
