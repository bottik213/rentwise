"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [["/analyze", "Inputs"], ["/results", "Analysis"], ["/performance", "Actuals"]] as const;

/** Marks the current step so users always know where they are in the workflow. */
export function NavLinks() {
  const path = usePathname();
  return LINKS.map(([href, label]) => (
    <Link
      key={href}
      href={href}
      aria-current={path === href ? "page" : undefined}
      className="flex h-full items-center border-b-2 border-transparent text-muted transition-colors hover:text-ink aria-[current=page]:border-ink aria-[current=page]:text-ink"
    >
      {label}
    </Link>
  ));
}
