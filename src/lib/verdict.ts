import type { Status } from "@/components/Icons";
import type { ConstraintKey, OfferCeilingResult, OfferConstraints, Underwriting } from "./finance/types";
import { pct, usd } from "./format";

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

export function verdict(u: Underwriting, constraints: OfferConstraints, monthlyRent: number): Judged & { text: string } {
  const st = cashFlowStatus(u, constraints, monthlyRent);
  const cf = u.reserveAdjustedCashFlow;
  const c = cushion(u, monthlyRent);
  const label = st === "good" ? "Meets your target" : st === "warn" ? "Thin margin" : "Misses your target";
  const invested = usd(u.cashInvested);
  if (cf < 0) {
    const fix = c ? ` Rent would need to rise by about ${usd(-c.amount)} a month to break even.` : " No rent covers these costs, because the percentage costs take all of it.";
    return { st, label, text: `At these numbers, this property costs you money. After all costs and reserves, you would pay about ${usd(-cf)} a month (${usd(-cf * 12)} a year) out of pocket on ${invested} invested.${fix}` };
  }
  const opener = st === "good" ? "At these numbers, this property covers its costs with some margin." : "At these numbers, this property covers its costs, but only just.";
  const body = `After all costs and reserves, it brings in about ${usd(cf)} a month (${usd(cf * 12)} a year) on ${invested} invested, a ${pct(u.cashOnCash)} cash-on-cash return.`;
  const tail = !c
    ? ""
    : st === "good"
      ? ` Rent could fall by about ${usd(c.amount)} a month before it stops covering its costs.`
      : ` If rent drops by about ${usd(c.amount)} a month, it stops covering its costs.`;
  return { st, label, text: `${opener} ${body}${tail}` };
}

export function cashFlowBadge(st: Status): Judged {
  return { st, label: st === "good" ? "Meets target" : st === "warn" ? "Thin margin" : "Below target" };
}

export function cashOnCashBadge(coc: number | null, minCoc: number | undefined): Judged {
  if (minCoc === undefined) return { st: "none", label: "No target set" };
  if (coc === null || coc < minCoc) return { st: "bad", label: "Below target" };
  if (coc < minCoc + 0.01) return { st: "warn", label: "Just above target" };
  return { st: "good", label: "Meets target" };
}

export function breakEvenBadge(u: Underwriting, monthlyRent: number): Judged {
  const c = cushion(u, monthlyRent);
  if (!c) return { st: "bad", label: "Not reachable" };
  if (c.amount < 0) return { st: "bad", label: "Rent below break-even" };
  if (c.share < THIN_CUSHION) return { st: "warn", label: "Thin cushion" };
  return { st: "good", label: "Rent above break-even" };
}

export function ceilingBadge(r: OfferCeilingResult, asking: number): Judged {
  if (r.status === "no-constraints") return { st: "none", label: "No target set" };
  if (r.status === "infeasible") return { st: "bad", label: "Targets not met" };
  if (r.hitSearchBound) return { st: "good", label: "Not limited" };
  if (r.price < asking) return { st: "bad", label: "Below asking" };
  if ((r.price - asking) / asking < 0.02) return { st: "warn", label: "Just above asking" };
  return { st: "good", label: "Above asking" };
}

const pctText = (r: number) => `${Number((r * 100).toFixed(2))}%`;
const SHORT: Record<ConstraintKey, string> = {
  minMonthlyCashFlow: "cash flow",
  minCashOnCash: "cash-on-cash",
  maxUpfrontCash: "upfront cash",
  minCapRate: "cap rate",
  minDscr: "DSCR",
  minIrr: "IRR",
};

/** A target as a short rule, e.g. "Cash-on-cash ≥ 8%". */
export function targetText(key: ConstraintKey, c: OfferConstraints): string {
  const v = c[key] as number;
  switch (key) {
    case "minMonthlyCashFlow": return `Cash flow ≥ ${usd(v)}/mo`;
    case "minCashOnCash": return `Cash-on-cash ≥ ${pctText(v)}`;
    case "maxUpfrontCash": return `Upfront cash ≤ ${usd(v)}`;
    case "minCapRate": return `Cap rate ≥ ${pctText(v)}`;
    case "minDscr": return `DSCR ≥ ${v}×`;
    case "minIrr": return `IRR ≥ ${pctText(v)}`;
  }
}

/** One plain sentence naming the binding target and what the others alone would allow. */
export function ceilingReason(r: OfferCeilingResult, alone: { key: ConstraintKey; result: OfferCeilingResult }[], c: OfferConstraints): string | null {
  if (r.status !== "feasible" || r.hitSearchBound || !r.limitingConstraints.length) return null;
  const bind = r.limitingConstraints;
  const rules = bind.map((k) => targetText(k, c)).join(" and ");
  const head = `${rules} ${bind.length > 1 ? "are" : "is"} the binding limit${r.limitingScenario === "conservative" ? " in the conservative scenario" : ""}`;
  const others = alone
    .filter((a) => !bind.includes(a.key) && a.result.status === "feasible")
    .map((a) => (a.result.status === "feasible" && a.result.hitSearchBound ? `${SHORT[a.key]} doesn't limit the price` : `${SHORT[a.key]} would allow ${usd(a.result.status === "feasible" ? a.result.price : 0)}`));
  return others.length ? `${head}; ${others.join(", ")}.` : `${head}.`;
}
