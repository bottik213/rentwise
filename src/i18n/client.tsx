"use client";
import { createContext, useContext, useMemo } from "react";
import { i18n, type I18n, type Locale } from "./index";

const Ctx = createContext<I18n | null>(null);

/** Set once per locale layout; client components read it with useI18n(). */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => i18n(locale), [locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside I18nProvider");
  return v;
}
