"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [["/", "Home"], ["/analyze", "Inputs"], ["/results", "Analysis"], ["/performance", "Actuals"]] as const;

/** Marks the current step so users always know where they are in the workflow. */
export function NavLinks() {
  const path = usePathname();
  return LINKS.map(([href, label]) => (
    <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>
      {label}
    </Link>
  ));
}
