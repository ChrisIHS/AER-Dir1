/**
 * Money is handled as integer cents in app code (CLAUDE.md). Database `numeric(14,2)` values
 * arrive from PostgREST as JSON numbers or strings; both are converted exactly here.
 */
export type Cents = number;

export function toCents(value: number | string | null | undefined): Cents {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "string") {
    const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(value.trim());
    if (!m) return 0;
    const sign = m[1] === "-" ? -1 : 1;
    const whole = Number(m[2] || "0");
    const frac = (m[3] ?? "").padEnd(3, "0");
    // round half away from zero at the third decimal
    const cents = whole * 100 + Number(frac.slice(0, 2)) + (Number(frac[2]) >= 5 ? 1 : 0);
    return sign * cents;
  }
  return Math.round(value * 100);
}

export function sumCents(values: Iterable<Cents>): Cents {
  let t = 0;
  for (const v of values) t += v;
  return t;
}

export function formatCad(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${dollars}.${(abs % 100).toString().padStart(2, "0")}`;
}
