export const str = (fd: FormData, name: string): string => {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
};

export const strOrNull = (fd: FormData, name: string): string | null => str(fd, name) || null;

export const numOrNull = (fd: FormData, name: string): number | null => {
  const raw = str(fd, name);
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string): boolean => UUID.test(s);

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export { safeFileName } from "@/lib/uploads";
