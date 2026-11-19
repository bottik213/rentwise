"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";

const LINKS = [["/", "home"], ["/analyze", "inputs"], ["/results", "analysis"], ["/performance", "actuals"], ["/compare", "compare"]] as const;

/** Marks the current step so users always know where they are in the workflow. */
export function NavLinks() {
  const path = usePathname();
  const { t, path: to } = useI18n();
  return LINKS.map(([href, key]) => (
    <Link key={href} href={to(href)} className={href === "/" ? "home" : undefined} aria-current={path === to(href) ? "page" : undefined}>
      {t.nav[key]}
    </Link>
  ));
}
