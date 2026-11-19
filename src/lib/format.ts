import type { Cents, Rate } from "./finance/types";

export const LOCALES = ["ru", "kk", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ru";
export const isLocale = (s: string): s is Locale => (LOCALES as readonly string[]).includes(s);
export const INTL: Record<Locale, string> = { ru: "ru-KZ", kk: "kk-KZ", en: "en" };

export interface MoneyOpts {
  exact?: boolean;
  signed?: boolean;
}

/** Number, money and date formatting for one locale. Money is tenge from integer minor units (tiyn). */
export function formatters(locale: Locale) {
  const tag = INTL[locale];
  const cur = (digits: number) =>
    new Intl.NumberFormat(tag, { style: "currency", currency: "KZT", currencyDisplay: "narrowSymbol", minimumFractionDigits: digits, maximumFractionDigits: digits });
  const whole = cur(0);
  const exact = cur(2);
  const date = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso.length === 7 ? `${iso}-01T00:00:00` : iso).toLocaleDateString(tag, o);
  return {
    /** "250 000 ₸" (ru, kk) or "₸250,000" (en). `signed` prefixes + for positives; negatives always use a true minus. */
    money(c: Cents, o: MoneyOpts = {}): string {
      const s = (o.exact ? exact : whole).format(Math.abs(c) / 100);
      if (c < 0 && (o.exact ? c <= -1 : c <= -50)) return `−${s}`;
      return o.signed && c > 0 ? `+${s}` : s;
    },
    /** A rate as a percent, e.g. "0,92 %" (ru) or "0.92%" (en); null is "n/a" in the caller's words. */
    pct(r: Rate, digits = 2): string {
      return new Intl.NumberFormat(tag, { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay: "negative" }).format(r).replace("-", "−");
    },
    num: (n: number, digits = 2) => n.toLocaleString(tag, { maximumFractionDigits: digits }),
    /** "Mar 2026" / "март 2026 г." */
    month: (m: string) => date(m, { month: "short", year: "numeric" }),
    /** "March 2026" */
    longMonth: (m: string) => date(m, { month: "long", year: "numeric" }),
    /** "March" / "март" */
    monthName: (m: string) => date(m, { month: "long" }),
    /** "Mar" / "мар." */
    monthShort: (m: string) => date(m, { month: "short" }),
    /** "Nov 20, 2026" / "20 нояб. 2026 г." */
    date: (iso: string) => date(iso, { dateStyle: "medium" }),
  };
}
