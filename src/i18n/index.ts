import { formatters, type Locale } from "../lib/format";
import { DEMO_PROPERTY } from "../data/demo-property";
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
    /** A property's display name. Only the untouched example gets the translated name; copies and renames keep theirs. */
    name: (nickname: string | undefined, isExample: boolean, fallback: string) =>
      isExample && nickname === DEMO_PROPERTY.nickname ? DICTS[locale].common.exampleName : nickname || fallback,
    /** "/results" → "/ru/results"; "/" → "/ru". */
    path: (p: string) => `/${locale}${p === "/" ? "" : p}`,
  };
}
export type I18n = ReturnType<typeof i18n>;
