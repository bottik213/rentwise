import type { PropertyInputs, ScenarioAdjustments, ScenarioName, Underwriting } from "./types";
import { roundCents } from "./money";
import { underwrite } from "./underwriting";

/** Illustrative defaults, shown and editable in the UI. Not market data. */
export const DEFAULT_SCENARIOS: Record<ScenarioName, ScenarioAdjustments> = {
  conservative: { rentChangePct: -0.05, vacancyPts: 0.03, maintenancePts: 0.02, capexPts: 0.03, fixedCostChangePct: 0.1, rentGrowthPts: -0.02, expenseGrowthPts: 0.01, valueGrowthPts: -0.02 },
  base: { rentChangePct: 0, vacancyPts: 0, maintenancePts: 0, capexPts: 0, fixedCostChangePct: 0, rentGrowthPts: 0, expenseGrowthPts: 0, valueGrowthPts: 0 },
  optimistic: { rentChangePct: 0.03, vacancyPts: -0.02, maintenancePts: -0.01, capexPts: -0.01, fixedCostChangePct: 0, rentGrowthPts: 0.02, expenseGrowthPts: 0, valueGrowthPts: 0.02 },
};

const clampRate = (x: number) => Math.min(1, Math.max(0, x));

/** Fixed costs = tax, insurance, HOA, utilities, other fixed. Financing and acquisition are unchanged. */
export function applyScenario(i: PropertyInputs, s: ScenarioAdjustments): PropertyInputs {
  const f = (c: number) => roundCents(c * (1 + s.fixedCostChangePct));
  return {
    ...i,
    monthlyRent: roundCents(i.monthlyRent * (1 + s.rentChangePct)),
    vacancyPct: clampRate(i.vacancyPct + s.vacancyPts),
    maintenancePct: clampRate(i.maintenancePct + s.maintenancePts),
    capexPct: clampRate(i.capexPct + s.capexPts),
    annualPropertyTax: f(i.annualPropertyTax),
    annualInsurance: f(i.annualInsurance),
    monthlyHoa: f(i.monthlyHoa),
    monthlyUtilities: f(i.monthlyUtilities),
    otherMonthlyFixed: f(i.otherMonthlyFixed),
  };
}

export function runScenarios(
  i: PropertyInputs,
  scenarios: Record<ScenarioName, ScenarioAdjustments> = DEFAULT_SCENARIOS,
): Record<ScenarioName, Underwriting> {
  return {
    conservative: underwrite(applyScenario(i, scenarios.conservative)),
    base: underwrite(applyScenario(i, scenarios.base)),
    optimistic: underwrite(applyScenario(i, scenarios.optimistic)),
  };
}
