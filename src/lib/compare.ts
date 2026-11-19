import type { I18n } from "@/i18n";
import { fieldDef, type FieldKey } from "../components/forms/fields";
import { runScenarios } from "./finance/scenarios";
import type { PropertyInputs, ScenarioAdjustments, ScenarioName, Underwriting } from "./finance/types";

export interface DealMetrics {
  base: Underwriting;
  /** NOI ÷ P&I; null with no mortgage payment. */
  dscr: number | null;
}

/** Every number comes from the same engine as the Analysis page. */
export function dealMetrics(i: PropertyInputs, scenarios: Record<ScenarioName, ScenarioAdjustments>): DealMetrics {
  const r = runScenarios(i, scenarios);
  return {
    base: r.base,
    dscr: r.base.monthlyPI > 0 ? r.base.noi / r.base.monthlyPI : null,
  };
}

export interface CompareRow {
  label: string;
  better: "higher" | "lower";
  value: (m: DealMetrics, i: PropertyInputs) => number | null;
  format: (v: number) => string;
}

export function compareRows({ t, money, pct, num }: I18n): CompareRow[] {
  const r = t.compare.rows;
  const whole = (v: number) => money(Math.round(v));
  const monthly = (v: number) => `${money(Math.round(v), { exact: true })}${t.common.mo}`;
  const perMonth = (v: number) => `${money(v)}${t.common.mo}`;
  const rate = (v: number) => pct(v);
  return [
    { label: r.price, better: "lower", value: (_, i) => i.purchasePrice, format: whole },
    { label: r.rent, better: "higher", value: (_, i) => i.monthlyRent, format: perMonth },
    { label: r.cashInvested, better: "lower", value: (m) => m.base.cashInvested, format: whole },
    { label: r.cf, better: "higher", value: (m) => m.base.reserveAdjustedCashFlow, format: monthly },
    { label: r.noi, better: "higher", value: (m) => m.base.noi, format: monthly },
    { label: r.cap, better: "higher", value: (m) => m.base.capRate, format: rate },
    { label: r.coc, better: "higher", value: (m) => m.base.cashOnCash, format: rate },
    { label: r.dscr, better: "higher", value: (m) => m.dscr, format: (v) => `${num(v)}×` },
    { label: r.be, better: "lower", value: (m) => m.base.breakEvenRent, format: perMonth },
  ];
}

/** Indexes of the best value(s); none when fewer than two deals have a value or all are equal. */
export function bestIndexes(values: (number | null)[], better: "higher" | "lower"): number[] {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2 || nums.every((v) => v === nums[0])) return [];
  const target = better === "higher" ? Math.max(...nums) : Math.min(...nums);
  return values.flatMap((v, i) => (v === target ? [i] : []));
}

/** Assumptions (not the property facts like price and rent) that a comparison should flag when they differ. */
const ASSUMED: FieldKey[] = ["vacancyPct", "maintenancePct", "managementPct", "capexPct", "downPaymentPct", "annualInterestRate", "loanTermYears", "initialReserve"];

/** Only the assumptions whose values differ between the deals, with each deal's value. */
export function differingAssumptions(deals: PropertyInputs[], i: I18n): { label: string; values: string[] }[] {
  const { t, money, pct } = i;
  const shown: { label: string; show: (p: PropertyInputs) => string }[] = [
    ...ASSUMED.map((k) => {
      const f = fieldDef(t, k);
      return { label: f.label, show: (p: PropertyInputs) => (f.kind === "money" ? money(p[k]) : f.kind === "rate" ? pct(p[k], 2) : String(p[k])) };
    }),
    { label: t.compare.allCash, show: (p) => (p.allCash ? t.compare.yes : t.compare.no) },
    { label: t.compare.closing, show: (p) => (p.closingCostMode === "percent" ? t.compare.ofPrice(pct(p.closingCostValue, 2)) : money(p.closingCostValue)) },
  ];
  return shown.map((a) => ({ label: a.label, values: deals.map(a.show) })).filter((r) => new Set(r.values).size > 1);
}
