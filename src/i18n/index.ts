import { formatters, type Locale } from "../lib/format";
import type { Rate } from "../lib/finance/types";
import { en, type Dict } from "./en";
import { kk } from "./kk";
import { ru } from "./ru";

export type { Dict } from "./en";
export { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from "../lib/format";

const DICTS: Record<Locale, Dict> = { ru, kk, en };

/** Everything a screen needs for one language: the text (`t`), formatters, and locale-prefixed paths. */
export function i18n(locale: Locale) {
  const f = formatters(locale);
  return {
    ...f,
    locale,
    t: DICTS[locale],
    pct: (r: Rate | null, digits = 2) => (r === null ? DICTS[locale].common.na : f.pct(r, digits)),
    /** "/results" → "/ru/results"; "/" → "/ru". */
    path: (p: string) => `/${locale}${p === "/" ? "" : p}`,
  };
}
export type I18n = ReturnType<typeof i18n>;
