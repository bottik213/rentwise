import { FIELDS } from "../components/forms/fields";
import { offerCeiling } from "./finance/offer-ceiling";
import { DEFAULT_PROJECTION, projectScenarios, type ProjectionResult } from "./finance/projection";
import { runScenarios } from "./finance/scenarios";
import type { OfferCeilingResult, OfferConstraints, PropertyInputs, ScenarioAdjustments, ScenarioName, Underwriting } from "./finance/types";
import { pct, usd } from "./format";

export interface DealMetrics {
  base: Underwriting;
  conservative: Underwriting;
  projection: ProjectionResult;
  ceiling: OfferCeilingResult;
  /** NOI ÷ P&I; null with no mortgage payment. */
  dscr: number | null;
}

/** Every number comes from the same engine as the Analysis page, with your scenarios and targets. */
export function dealMetrics(i: PropertyInputs, scenarios: Record<ScenarioName, ScenarioAdjustments>, constraints: OfferConstraints): DealMetrics {
  const r = runScenarios(i, scenarios);
  return {
    base: r.base,
    conservative: r.conservative,
    projection: projectScenarios(i, scenarios).base,
    ceiling: offerCeiling(i, constraints, scenarios.conservative),
    dscr: r.base.monthlyPI > 0 ? r.base.noi / r.base.monthlyPI : null,
  };
}

export interface CompareRow {
  label: string;
  better: "higher" | "lower";
  value: (m: DealMetrics, i: PropertyInputs) => number | null;
  format: (v: number) => string;
}

const money = (v: number) => usd(Math.round(v));
const monthly = (v: number) => `${usd(Math.round(v), { exact: true })}/mo`;
const rate = (v: number) => pct(v);

export const COMPARE_ROWS: CompareRow[] = [
  { label: "Price", better: "lower", value: (_, i) => i.purchasePrice, format: money },
  { label: "Rent", better: "higher", value: (_, i) => i.monthlyRent, format: (v) => `${usd(v)}/mo` },
  { label: "Cash invested", better: "lower", value: (m) => m.base.cashInvested, format: money },
  { label: "Cash flow after reserves", better: "higher", value: (m) => m.base.reserveAdjustedCashFlow, format: monthly },
  { label: "NOI", better: "higher", value: (m) => m.base.noi, format: monthly },
  { label: "Cap rate", better: "higher", value: (m) => m.base.capRate, format: rate },
  { label: "Cash-on-cash", better: "higher", value: (m) => m.base.cashOnCash, format: rate },
  { label: "DSCR", better: "higher", value: (m) => m.dscr, format: (v) => `${v.toFixed(2)}×` },
  { label: "Break-even rent", better: "lower", value: (m) => m.base.breakEvenRent, format: (v) => `${usd(v)}/mo` },
  {
    label: "Offer ceiling vs asking",
    better: "higher",
    value: (m) => (m.ceiling.status === "feasible" && !m.ceiling.hitSearchBound ? m.ceiling.deltaFromAsking : null),
    format: (v) => usd(v, { signed: true }),
  },
  { label: "Conservative cash flow", better: "higher", value: (m) => m.conservative.reserveAdjustedCashFlow, format: monthly },
  { label: "Total profit over the hold", better: "higher", value: (m) => m.projection.totalProfit, format: money },
  { label: "IRR over the hold", better: "higher", value: (m) => (m.projection.irr.ok ? m.projection.irr.rate : null), format: rate },
  { label: "Equity multiple", better: "higher", value: (m) => m.projection.equityMultiple, format: (v) => `${v.toFixed(2)}×` },
];

/** Indexes of the best value(s); none when fewer than two deals have a value or all are equal. */
export function bestIndexes(values: (number | null)[], better: "higher" | "lower"): number[] {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2 || nums.every((v) => v === nums[0])) return [];
  const target = better === "higher" ? Math.max(...nums) : Math.min(...nums);
  return values.flatMap((v, i) => (v === target ? [i] : []));
}

type Shown = { key: string; label: string; show: (i: PropertyInputs) => string };
const asField = (k: keyof typeof FIELDS): Shown => {
  const f = FIELDS[k];
  return { key: k, label: f.label, show: (i) => (f.kind === "money" ? usd(i[k]) : f.kind === "rate" ? pct(i[k], 2) : String(i[k])) };
};
const proj = (k: keyof typeof DEFAULT_PROJECTION, label: string, kind: "rate" | "years"): Shown => ({
  key: `projection.${k}`,
  label,
  show: (i) => {
    const v = (i.projection ?? DEFAULT_PROJECTION)[k];
    return kind === "rate" ? pct(v, 2) : `${v} years`;
  },
});

/** Assumptions (not the property facts like price and rent) that a comparison should flag when they differ. */
const ASSUMPTIONS: Shown[] = [
  ...(["vacancyPct", "maintenancePct", "managementPct", "capexPct", "downPaymentPct", "annualInterestRate", "loanTermYears", "initialReserve"] as const).map(asField),
  { key: "allCash", label: "All-cash purchase", show: (i) => (i.allCash ? "Yes" : "No") },
  { key: "closing", label: "Closing costs", show: (i) => (i.closingCostMode === "percent" ? `${pct(i.closingCostValue, 2)} of price` : usd(i.closingCostValue)) },
  proj("holdYears", "Hold period", "years"),
  proj("rentGrowth", "Rent growth", "rate"),
  proj("expenseGrowth", "Expense growth", "rate"),
  proj("valueGrowth", "Value growth", "rate"),
  proj("sellingCostPct", "Selling costs", "rate"),
];

/** Only the assumptions whose values differ between the deals, with each deal's value. */
export function differingAssumptions(deals: PropertyInputs[]): { label: string; values: string[] }[] {
  return ASSUMPTIONS.map((a) => ({ label: a.label, values: deals.map(a.show) })).filter((r) => new Set(r.values).size > 1);
}
