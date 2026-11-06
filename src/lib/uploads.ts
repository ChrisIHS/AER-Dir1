/**
 * Upload rules shared by the browser (pre-checks), the signing route and the finalize actions.
 * Files go browser -> Supabase Storage through a signed upload URL, so they never pass through a
 * Vercel function (which caps request bodies at about 4.5 MB).
 */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const ALLOWED_EXT = ["pdf", "png", "jpg", "jpeg", "xlsx", "xls", "csv", "docx", "doc"] as const;

export type UploadPurpose = "rate_sheet" | "document" | "library";

export function safeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/\.{2,}/g, ".").replace(/^[._-]+|_+$/g, "").slice(0, 120) || "file";
}

export function extensionOf(name: string): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(name.trim());
  return m ? m[1]!.toLowerCase() : "";
}

/** Returns a message the user can act on, or null when the file is acceptable. */
export function validateUpload(fileName: string, size: number): string | null {
  if (!fileName.trim()) return "Choose a file to upload.";
  if (!Number.isFinite(size) || size <= 0) return "That file is empty.";
  const ext = extensionOf(fileName);
  if (!(ALLOWED_EXT as readonly string[]).includes(ext)) {
    return `Files of type .${ext || "?"} aren't accepted. Use PDF, Word, Excel, CSV or an image.`;
  }
  if (size > MAX_UPLOAD_BYTES) return "That file is larger than 25 MB.";
  return null;
}

/** '<org>/<site>/<uuid>-<name>' for rate sheets and documents. */
export const siteObjectPath = (orgId: string, siteId: string, fileName: string, uuid: string) =>
  `${orgId}/${siteId}/${uuid}-${safeFileName(fileName)}`;

/** '<org>/library/<uuid>-<name>' for the organization rate library. */
export const libraryObjectPath = (orgId: string, fileName: string, uuid: string) =>
  `${orgId}/library/${uuid}-${safeFileName(fileName)}`;

/**
 * True when `path` is exactly one file directly under the expected folder. The finalize actions use this so a
 * client cannot register an object that lives somewhere else (another organization's folder, a parent path).
 */
export function pathBelongsTo(path: string, folder: { orgId: string; siteId: string } | { orgId: string; library: true }): boolean {
  const parts = path.split("/");
  if (parts.length !== 3 || parts.some((p) => p === "" || p === "." || p === "..")) return false;
  const [org, second, file] = parts as [string, string, string];
  if (org !== folder.orgId) return false;
  if ("library" in folder) return second === "library" && file.length > 0;
  return second === folder.siteId && file.length > 0;
}
