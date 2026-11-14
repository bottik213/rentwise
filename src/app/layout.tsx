import type { Metadata } from "next";
import Link from "next/link";
import { Schibsted_Grotesk } from "next/font/google";
import { NavLinks } from "@/components/NavLinks";
import "./globals.css";

const sans = Schibsted_Grotesk({ variable: "--font-schibsted", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RentWise: rental property numbers, before and after you buy",
  description:
    "Underwrite a long-term rental, find your offer ceiling, then track actuals and see exactly why cash flow differs from plan.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} flex min-h-dvh flex-col`}>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-bg focus:px-3 focus:py-2">
          Skip to content
        </a>
        <header className="border-b border-line">
          <nav aria-label="Main" className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 text-sm sm:px-6">
            <Link href="/" className="mr-auto font-semibold tracking-tight">
              RentWise
            </Link>
            <NavLinks />
          </nav>
        </header>
        <main id="main" className="flex-1">{children}</main>
        <footer className="border-t border-line">
          <p className="mx-auto max-w-6xl px-4 py-6 text-xs leading-relaxed text-muted sm:px-6">
            Financial modeling and education only. Not investment, legal, mortgage or tax advice. Results depend
            entirely on your assumptions; nothing here is a guaranteed return. Your data stays in this browser.
          </p>
        </footer>
      </body>
    </html>
  );
}
