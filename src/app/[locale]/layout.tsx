import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Onest } from "next/font/google";
import { Logo } from "@/components/Icons";
import { LangSwitch } from "@/components/LangSwitch";
import { NavLinks } from "@/components/NavLinks";
import { OldDataNotice } from "@/components/OldDataNotice";
import { StorageNotice } from "@/components/StorageNotice";
import { i18n, isLocale, LOCALES } from "@/i18n";
import { I18nProvider } from "@/i18n/client";
import "../globals.css";

// cyrillic-ext carries the Kazakh letters (ә ғ қ ң ө ұ ү һ і).
const onest = Onest({ variable: "--font-onest", subsets: ["latin", "cyrillic", "cyrillic-ext"] });

type Params = Promise<{ locale: string }>;

export const generateStaticParams = () => LOCALES.map((locale) => ({ locale }));

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = i18n(locale);
  return {
    title: t.meta.title,
    description: t.meta.description,
  };
}

export default async function LocaleLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Params }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { t, path } = i18n(locale);
  return (
    <html lang={locale}>
      <body className={`${onest.variable} flex min-h-dvh flex-col`}>
        <I18nProvider locale={locale}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
          >
            {t.shell.skip}
          </a>
          <header className="top">
            <Link href={path("/")} className="logo disp">
              <Logo />
              <span className="wm">RentWise</span>
            </Link>
            <nav className="nav" aria-label={t.shell.nav}>
              <NavLinks />
            </nav>
            <p className="top-note">{t.shell.topNote}</p>
            <LangSwitch />
          </header>
          <StorageNotice />
          <OldDataNotice />
          <main id="main" className="flex min-h-0 flex-1 flex-col">
            {children}
          </main>
        </I18nProvider>
      </body>
    </html>
  );
}
