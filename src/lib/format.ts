import type { Cents, Rate } from "./finance/types";

const whole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

/** $1,248 (or $1,247.44 with exact). `signed` prefixes + for positives; negatives always use a true minus. */
export function usd(c: Cents, opts: { exact?: boolean; signed?: boolean } = {}): string {
  const s = (opts.exact ? exact : whole).format(Math.abs(c) / 100);
  if (c < 0 && (opts.exact ? c <= -1 : c <= -50)) return `−${s}`;
  return opts.signed && c > 0 ? `+${s}` : s;
}

export const pct = (r: Rate | null, digits = 2): string => (r === null ? "n/a" : `${(r * 100).toFixed(digits).replace(/^-(?=.*[1-9])/, "−").replace(/^-/, "")}%`);

export const monthLabel = (m: string): string =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" });
