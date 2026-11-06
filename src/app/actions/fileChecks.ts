import { back } from "@/lib/flash";

export const MAX_BYTES = 25 * 1024 * 1024;
export const ALLOWED_EXT = new Set(["pdf", "png", "jpg", "jpeg", "xlsx", "xls", "csv", "docx", "doc"]);

/** Validate an uploaded file from a form; redirects back with a message when it is not acceptable. */
export function checkFile(fd: FormData, path: string): File {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) back(path, { error: "Choose a file to upload." });
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.has(ext)) back(path, { error: `Files of type .${ext || "?"} aren't accepted. Use PDF, Word, Excel, CSV or an image.` });
  if (file.size > MAX_BYTES) back(path, { error: "That file is larger than 25 MB." });
  return file;
}
