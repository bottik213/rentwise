import type { Status } from "@/components/Icons";
import type { OfferConstraints, Underwriting } from "./finance/types";
import type { I18n } from "@/i18n";

export interface Judged {
  st: Status;
  label: string;
}

const THIN_MARGIN = 10_000; // $100/mo above the cash-flow target
const THIN_CUSHION = 0.05; // rent within 5% of break-even

/** Rent minus break-even rent, in cents and as a share of rent. Null when no rent can break even. */
export function cushion(u: Underwriting, monthlyRent: number): { amount: number; share: number } | null {
  if (u.breakEvenRent === null) return null;
  const amount = monthlyRent - u.breakEvenRent;
  return { amount, share: monthlyRent > 0 ? amount / monthlyRent : 0 };
}

/** Cash flow compared with the user's own minimum (or $0 when they set none). Never a judgment of the deal. */
export function cashFlowStatus(u: Underwriting, constraints: OfferConstraints, monthlyRent: number): Status {
  const target = constraints.minMonthlyCashFlow ?? 0;
  const c = cushion(u, monthlyRent);
  if (u.reserveAdjustedCashFlow < target) return "bad";
  if (u.reserveAdjustedCashFlow < target + THIN_MARGIN || !c || c.share < THIN_CUSHION) return "warn";
  return "good";
}

export function verdict(u: Underwriting, constraints: OfferConstraints, monthlyRent: number, i: I18n): Judged & { text: string } {
  const { t, money: usd } = i;
  const st = cashFlowStatus(u, constraints, monthlyRent);
  const cf = u.reserveAdjustedCashFlow;
  const c = cushion(u, monthlyRent);
  const label = t.verdict[st === "none" ? "good" : st];
  const invested = usd(u.cashInvested);
  if (cf < 0) {
    const fix = c ? t.verdict.fixRise(usd(-c.amount)) : t.verdict.fixNone;
    return { st, label, text: t.verdict.loss(usd(-cf), usd(-cf * 12), invested, fix) };
  }
  const opener = st === "good" ? t.verdict.openerGood : t.verdict.openerThin;
  const body = t.verdict.body(usd(cf), usd(cf * 12), invested, i.pct(u.cashOnCash));
  const tail = !c ? "" : st === "good" ? t.verdict.tailGood(usd(c.amount)) : t.verdict.tailThin(usd(c.amount));
  return { st, label, text: `${opener} ${body}${tail}` };
}

export function cashFlowBadge(st: Status, { t }: I18n): Judged {
  return { st, label: st === "good" ? t.badge.meets : st === "warn" ? t.badge.thin : t.badge.below };
}

export function cashOnCashBadge(coc: number | null, minCoc: number | undefined, { t }: I18n): Judged {
  if (minCoc === undefined) return { st: "none", label: t.badge.noTarget };
  if (coc === null || coc < minCoc) return { st: "bad", label: t.badge.below };
  if (coc < minCoc + 0.01) return { st: "warn", label: t.badge.justAbove };
  return { st: "good", label: t.badge.meets };
}

export function breakEvenBadge(u: Underwriting, monthlyRent: number, { t }: I18n): Judged {
  const c = cushion(u, monthlyRent);
  if (!c) return { st: "bad", label: t.badge.notReachable };
  if (c.amount < 0) return { st: "bad", label: t.badge.rentBelow };
  if (c.share < THIN_CUSHION) return { st: "warn", label: t.badge.thinCushion };
  return { st: "good", label: t.badge.rentAbove };
}

