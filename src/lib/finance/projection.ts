import type { Cents, ProjectionAssumptions, PropertyInputs, Rate, ScenarioAdjustments, ScenarioName } from "./types";
import { irr, type IrrResult } from "./irr";
import { assertFinite } from "./money";
import { loanBalance, monthlyPaymentExact } from "./mortgage";
import { DEFAULT_SCENARIOS, applyScenario } from "./scenarios";
import { underwrite } from "./underwriting";

/** Illustrative defaults, shown and editable in the UI. Not market data or predictions. */
export const DEFAULT_PROJECTION: ProjectionAssumptions = { holdYears: 10, rentGrowth: 0.03, expenseGrowth: 0.03, valueGrowth: 0.03, sellingCostPct: 0.06 };

/** Annual figures for one year of the hold. Money is unrounded cents; round only for display. */
export interface ProjectionYear {
  year: number;
  grossRent: number;
  effectiveIncome: number;
  operatingExpenses: number;
  noi: number;
  debtService: number;
  capexReserve: number;
  /** Reserve-adjusted cash flow for the year (the CapEx reserve is treated as spent). */
  cashFlow: number;
  cumulativeCashFlow: number;
  loanBalance: number;
  value: number;
  equity: number;
  cashOnCash: Rate | null;
}

export interface ProjectionResult {
  assumptions: ProjectionAssumptions;
  cashInvested: Cents;
  years: ProjectionYear[];
  salePrice: number;
  sellingCosts: number;
  loanPayoff: number;
  /** Initial cash reserve, returned at exit: it is still the owner's cash. */
  reserveReturned: Cents;
  netSaleProceeds: number;
  totalCashFlow: number;
  totalProfit: number;
  /** null when cash invested ≤ 0. */
  equityMultiple: number | null;
  irr: IrrResult;
}

export interface GrowthDeltas {
  rentGrowthPts: Rate;
  expenseGrowthPts: Rate;
  valueGrowthPts: Rate;
}
const NO_DELTAS: GrowthDeltas = { rentGrowthPts: 0, expenseGrowthPts: 0, valueGrowthPts: 0 };

/**
 * Year-by-year projection before income tax. Year 1 = 12 × the monthly underwriting (unrounded P&I);
 * rent and other income grow with rent growth, fixed costs with expense growth, and the %-of-rent costs
 * (maintenance, management, CapEx reserve) grow with rent. Debt service stops once the loan is paid off.
 */
export function projection(i: PropertyInputs, deltas: GrowthDeltas = NO_DELTAS): ProjectionResult {
  assertFinite(i, "projection");
  const base = i.projection ?? DEFAULT_PROJECTION;
  const a: ProjectionAssumptions = {
    ...base,
    rentGrowth: base.rentGrowth + deltas.rentGrowthPts,
    expenseGrowth: base.expenseGrowth + deltas.expenseGrowthPts,
    valueGrowth: base.valueGrowth + deltas.valueGrowthPts,
  };
  assertFinite(a, "projection assumptions");
  const N = Math.round(a.holdYears);
  if (N < 1) throw new RangeError("projection: hold period must be at least 1 year");

  const u = underwrite(i);
  const pi = i.allCash ? 0 : monthlyPaymentExact(u.loanAmount, i.annualInterestRate, i.loanTermYears);
  const n = Math.round(i.loanTermYears * 12);
  const balance = (months: number) => (i.allCash ? 0 : loanBalance(u.loanAmount, i.annualInterestRate, i.loanTermYears, months));
  const fixedYear1 = i.annualPropertyTax + i.annualInsurance + 12 * (i.monthlyHoa + i.monthlyUtilities + i.otherMonthlyFixed);

  const years: ProjectionYear[] = [];
  let cumulative = 0;
  for (let y = 1; y <= N; y++) {
    const rg = Math.pow(1 + a.rentGrowth, y - 1);
    const grossRent = 12 * i.monthlyRent * rg;
    const effectiveRent = grossRent * (1 - i.vacancyPct);
    const effectiveIncome = effectiveRent + 12 * i.otherMonthlyIncome * rg;
    const operatingExpenses = fixedYear1 * Math.pow(1 + a.expenseGrowth, y - 1) + grossRent * i.maintenancePct + effectiveRent * i.managementPct;
    const noi = effectiveIncome - operatingExpenses;
    const monthsPaid = Math.max(0, Math.min(12 * y, n) - 12 * (y - 1));
    const debtService = pi * monthsPaid;
    const capexReserve = grossRent * i.capexPct;
    const cashFlow = noi - debtService - capexReserve;
    cumulative += cashFlow;
    const loanBal = balance(12 * y);
    const value = i.purchasePrice * Math.pow(1 + a.valueGrowth, y);
    years.push({
      year: y, grossRent, effectiveIncome, operatingExpenses, noi, debtService, capexReserve, cashFlow,
      cumulativeCashFlow: cumulative, loanBalance: loanBal, value, equity: value - loanBal,
      cashOnCash: u.cashInvested > 0 ? cashFlow / u.cashInvested : null,
    });
  }

  const last = years[N - 1];
  const salePrice = last.value;
  const sellingCosts = salePrice * a.sellingCostPct;
  const netSaleProceeds = salePrice - sellingCosts - last.loanBalance + i.initialReserve;
  const flows = [-u.cashInvested, ...years.map((y) => y.cashFlow)];
  flows[N] += netSaleProceeds;

  return {
    assumptions: a,
    cashInvested: u.cashInvested,
    years,
    salePrice,
    sellingCosts,
    loanPayoff: last.loanBalance,
    reserveReturned: i.initialReserve,
    netSaleProceeds,
    totalCashFlow: cumulative,
    totalProfit: cumulative + netSaleProceeds - u.cashInvested,
    equityMultiple: u.cashInvested > 0 ? (cumulative + netSaleProceeds) / u.cashInvested : null,
    irr: irr(flows),
  };
}

/** A scenario's growth deltas; scenarios saved before Phase 2 fall back to that scenario's defaults. */
export function growthDeltas(name: ScenarioName, s: ScenarioAdjustments): GrowthDeltas {
  const d = DEFAULT_SCENARIOS[name];
  return {
    rentGrowthPts: s.rentGrowthPts ?? d.rentGrowthPts ?? 0,
    expenseGrowthPts: s.expenseGrowthPts ?? d.expenseGrowthPts ?? 0,
    valueGrowthPts: s.valueGrowthPts ?? d.valueGrowthPts ?? 0,
  };
}

/** The projection under each scenario: the scenario's input changes plus its growth deltas. */
export function projectScenarios(i: PropertyInputs, scenarios: Record<ScenarioName, ScenarioAdjustments> = DEFAULT_SCENARIOS): Record<ScenarioName, ProjectionResult> {
  const run = (name: ScenarioName) => projection(applyScenario(i, scenarios[name]), growthDeltas(name, scenarios[name]));
  return { conservative: run("conservative"), base: run("base"), optimistic: run("optimistic") };
}
