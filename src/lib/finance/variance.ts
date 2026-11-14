import { ACTUAL_CATEGORIES, type ActualCategory, type ActualMonth, type Cents, type Underwriting, type VarianceReport } from "./types";
import { assertFinite } from "./money";

const INCOME: ReadonlySet<ActualCategory> = new Set(["rentReceived", "otherIncome"]);

/** Monthly forecast per actuals category, from the same base underwriting (same cash-flow definition). */
export function monthlyForecast(u: Underwriting): Record<ActualCategory, Cents> {
  return {
    rentReceived: u.effectiveRent,
    otherIncome: u.otherIncome,
    propertyTax: u.propertyTax,
    insurance: u.insurance,
    utilities: u.utilities,
    hoa: u.hoa,
    repairsMaintenance: u.maintenance,
    management: u.management,
    otherOperating: u.otherFixed,
    mortgagePI: u.monthlyPI,
  };
}

/**
 * Actual vs forecast cash flow before CapEx over exactly the months entered.
 * Contributor impacts are integer cents and sum exactly to totalVariance.
 * CapEx actuals are compared to the planned reserve separately; a reserve is never an expense.
 */
export function variance(u: Underwriting, actuals: ActualMonth[]): VarianceReport {
  const months = actuals.length;
  const perMonth = monthlyForecast(u);
  for (const m of actuals) assertFinite(m, `actuals ${m.month}`);

  const contributors = ACTUAL_CATEGORIES.map((category) => {
    const forecast = perMonth[category] * months;
    const actual = actuals.reduce((sum, m) => sum + m[category], 0);
    const impact = INCOME.has(category) ? actual - forecast : forecast - actual;
    return { category, forecast, actual, impact };
  });

  const sum = (pick: (c: (typeof contributors)[number]) => Cents, filter: (k: ActualCategory) => boolean) =>
    contributors.filter((c) => filter(c.category)).reduce((s, c) => s + pick(c), 0);
  const isIncome = (k: ActualCategory) => INCOME.has(k);
  const isOpex = (k: ActualCategory) => !INCOME.has(k) && k !== "mortgagePI";

  const forecastCashFlowBeforeCapex = u.cashFlowBeforeCapex * months;
  const actualCashFlowBeforeCapex = sum((c) => c.actual, isIncome) - sum((c) => c.actual, (k) => !isIncome(k));

  return {
    months,
    forecastRent: u.effectiveRent * months,
    actualRent: contributors[0].actual,
    forecastOperatingCosts: sum((c) => c.forecast, isOpex),
    actualOperatingCosts: sum((c) => c.actual, isOpex),
    forecastCashFlowBeforeCapex,
    actualCashFlowBeforeCapex,
    totalVariance: actualCashFlowBeforeCapex - forecastCashFlowBeforeCapex,
    contributors,
    plannedCapexReserve: u.capexReserve * months,
    actualCapex: actuals.reduce((s, m) => s + m.capex, 0),
  };
}
