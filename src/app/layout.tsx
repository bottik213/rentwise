import type { Metadata } from "next";
import Link from "next/link";
import { Archivo, Public_Sans } from "next/font/google";
import { Logo } from "@/components/Icons";
import { NavLinks } from "@/components/NavLinks";
import { StorageNotice } from "@/components/StorageNotice";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });
const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RentWise: rental property numbers, before and after you buy",
  description:
    "Check a long-term rental before you buy, find your offer ceiling, then track actuals and see exactly why cash flow differs from plan.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${archivo.variable} ${publicSans.variable} flex min-h-dvh flex-col`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <header className="top">
          <Link href="/" className="logo disp">
            <Logo />
            RentWise
          </Link>
          <nav className="nav" aria-label="Main">
            <NavLinks />
          </nav>
          <p className="top-note">No sign-up. Your data stays in this browser.</p>
        </header>
        <StorageNotice />
        <main id="main" className="flex min-h-0 flex-1 flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
