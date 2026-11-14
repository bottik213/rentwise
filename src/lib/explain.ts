import type { ActualCategory, VarianceReport } from "./finance/types";
import { usd } from "./format";

export const CATEGORY_LABEL: Record<ActualCategory, string> = {
  rentReceived: "Rent received",
  otherIncome: "Other income",
  propertyTax: "Property tax",
  insurance: "Insurance",
  utilities: "Utilities",
  hoa: "HOA",
  repairsMaintenance: "Repairs & maintenance",
  management: "Management",
  otherOperating: "Other operating",
  mortgagePI: "Mortgage P&I",
};

const $ = (c: number, signed = false) => usd(c, { exact: true, signed });

/** Plain-English, rule-based explanation of a variance report. Deterministic: same numbers, same words. */
export function explainVariance(r: VarianceReport): string[] {
  if (!r.months) return [];
  const span = `${r.months} month${r.months === 1 ? "" : "s"}`;
  const t = r.totalVariance;
  const out = [
    t === 0
      ? `Over ${span}, cash flow before CapEx matched the plan exactly at ${$(r.actualCashFlowBeforeCapex)}.`
      : `Over ${span}, cash flow before CapEx was ${$(r.actualCashFlowBeforeCapex)}, ${$(Math.abs(t))} ${t < 0 ? "below" : "above"} the plan's ${$(r.forecastCashFlowBeforeCapex)}.`,
  ];

  const movers = r.contributors.filter((c) => c.impact !== 0).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  for (const c of movers.slice(0, 3)) {
    out.push(`${CATEGORY_LABEL[c.category]}: ${$(c.actual)} actual vs. ${$(c.forecast)} planned, ${$(c.impact, true)} to cash flow.`);
  }
  if (movers.length > 3) {
    const rest = movers.slice(3).reduce((s, c) => s + c.impact, 0);
    out.push(`${movers.length - 3} smaller item${movers.length === 4 ? "" : "s"} account for the remaining ${$(rest, true)}.`);
  }

  out.push(
    `CapEx: ${$(r.actualCapex)} spent against ${$(r.plannedCapexReserve)} set aside. A reserve is savings, not an expense, so CapEx stays out of the cash-flow comparison.`,
  );
  return out;
}
