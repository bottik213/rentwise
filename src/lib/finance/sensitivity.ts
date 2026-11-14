import type { Cents, PropertyInputs } from "./types";
import { roundCents } from "./money";
import { underwrite } from "./underwriting";

export interface SensitivityRow {
  key: keyof PropertyInputs;
  shock: string;
  /** Change in annual reserve-adjusted cash flow caused by the shock. */
  annualImpact: Cents;
  /** True when the user marked the assumption with a non-estimate source. */
  verified: boolean;
}

type Shock = [key: keyof PropertyInputs, label: string, apply: (i: PropertyInputs) => PropertyInputs];

const SHOCKS: Shock[] = [
  ["monthlyRent", "Rent −$100/mo", (i) => ({ ...i, monthlyRent: Math.max(0, i.monthlyRent - 10_000) })],
  ["vacancyPct", "Vacancy +5 pts", (i) => ({ ...i, vacancyPct: Math.min(1, i.vacancyPct + 0.05) })],
  ["annualInterestRate", "Interest rate +1 pt", (i) => ({ ...i, annualInterestRate: i.annualInterestRate + 0.01 })],
  ["annualInsurance", "Insurance +$100/mo", (i) => ({ ...i, annualInsurance: i.annualInsurance + 120_000 })],
  ["annualPropertyTax", "Property tax +10%", (i) => ({ ...i, annualPropertyTax: roundCents(i.annualPropertyTax * 1.1) })],
  ["maintenancePct", "Maintenance +2 pts", (i) => ({ ...i, maintenancePct: Math.min(1, i.maintenancePct + 0.02) })],
  ["managementPct", "Management +2 pts", (i) => ({ ...i, managementPct: Math.min(1, i.managementPct + 0.02) })],
  ["capexPct", "CapEx reserve +2 pts", (i) => ({ ...i, capexPct: Math.min(1, i.capexPct + 0.02) })],
  ["monthlyHoa", "HOA +$50/mo", (i) => ({ ...i, monthlyHoa: i.monthlyHoa + 5_000 })],
  ["monthlyUtilities", "Utilities +$50/mo", (i) => ({ ...i, monthlyUtilities: i.monthlyUtilities + 5_000 })],
];

/** Real-dollar what-ifs, ranked by size of impact. No probabilities. */
export function sensitivity(i: PropertyInputs): SensitivityRow[] {
  const base = underwrite(i).reserveAdjustedCashFlow;
  return SHOCKS.filter(([key]) => !(key === "annualInterestRate" && i.allCash))
    .map(([key, shock, apply]) => ({
      key,
      shock,
      annualImpact: 12 * (underwrite(apply(i)).reserveAdjustedCashFlow - base),
      verified: !!i.sources?.[key] && i.sources[key] !== "estimate",
    }))
    .sort((a, b) => Math.abs(b.annualImpact) - Math.abs(a.annualImpact));
}
