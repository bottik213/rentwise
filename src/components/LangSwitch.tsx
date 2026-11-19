"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LOCALES, type Locale } from "@/i18n";
import { useI18n } from "@/i18n/client";

const LABEL: Record<Locale, string> = { ru: "RU", kk: "KZ", en: "EN" };
const NAME: Record<Locale, string> = { ru: "Русский", kk: "Қазақша", en: "English" };

/** RU / KZ / EN on the same page. A share link's #fragment comes along. */
export function LangSwitch() {
  const { t, locale } = useI18n();
  const path = usePathname();
  const router = useRouter();
  const swap = (l: Locale) => path.replace(/^\/[^/]+/, `/${l}`);
  return (
    <nav className="lang" aria-label={t.shell.lang}>
      {LOCALES.map((l) => (
        <Link
          key={l}
          href={swap(l)}
          lang={l}
          hrefLang={l}
          title={NAME[l]}
          aria-current={l === locale ? "true" : undefined}
          onClick={(e) => {
            if (!location.hash) return;
            e.preventDefault();
            router.push(swap(l) + location.hash);
          }}
        >
          {LABEL[l]}
        </Link>
      ))}
    </nav>
  );
}
