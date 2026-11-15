import { describe, expect, it } from "vitest";
import { DEMO_PROPERTY } from "../../src/data/demo-property";
import { irr } from "../../src/lib/finance/irr";
import { loanBalance } from "../../src/lib/finance/mortgage";
import { DEFAULT_PROJECTION, projectScenarios, projection } from "../../src/lib/finance/projection";
import type { PropertyInputs } from "../../src/lib/finance/types";
import { underwrite } from "../../src/lib/finance/underwriting";

const P = DEMO_PROPERTY;
const money = (actual: number, dollars: number) => expect(Math.abs(actual - dollars * 100)).toBeLessThanOrEqual(5); // ±$0.05
const rate = (actual: number, pctValue: number) => expect(Math.abs(actual * 100 - pctValue)).toBeLessThanOrEqual(0.01); // ±0.01 pts

describe("projection: Phase 2 reference case (10-year hold, default growth)", () => {
  const r = projection(P);
  const y = (n: number) => r.years[n - 1];

  it("matches the independently computed year table", () => {
    money(y(1).noi, 17_223.6);
    money(y(1).cashFlow, 784.29);
    money(y(2).noi, 17_740.31);
    money(y(2).cashFlow, 1_256.9);
    money(y(5).noi, 19_385.31);
    money(y(5).cashFlow, 2_761.51);
    money(y(10).noi, 22_472.89);
    money(y(10).cashFlow, 5_585.57);
    money(y(1).loanBalance, 185_595.36);
    money(y(10).loanBalance, 160_898.22);
    money(y(10).value, 335_979.09);
    money(y(10).cumulativeCashFlow, 30_904.31);
  });

  it("matches the exit summary, profit, equity multiple and IRR", () => {
    money(r.netSaleProceeds, 164_922.13);
    money(r.totalProfit, 110_826.44);
    expect(Math.abs(r.equityMultiple! - 2.3038)).toBeLessThanOrEqual(0.0001);
    expect(r.irr.ok).toBe(true);
    if (r.irr.ok) rate(r.irr.rate, 9.2883);
  });

  it("year 1 is 12 × the monthly underwriting, apart from P&I rounding", () => {
    const u = underwrite(P);
    expect(Math.abs(y(1).noi - 12 * u.noi)).toBeLessThan(1);
    expect(Math.abs(y(1).cashFlow - 12 * u.reserveAdjustedCashFlow)).toBeLessThanOrEqual(6); // 12 × ½ cent
    expect(r.cashInvested).toBe(u.cashInvested);
  });

  it("returns the initial reserve at exit and reconciles profit", () => {
    expect(r.reserveReturned).toBe(P.initialReserve);
    expect(r.netSaleProceeds).toBeCloseTo(r.salePrice - r.sellingCosts - r.loanPayoff + P.initialReserve, 6);
    expect(r.totalProfit).toBeCloseTo(r.totalCashFlow + r.netSaleProceeds - r.cashInvested, 6);
  });
});

describe("projection: edge cases", () => {
  it("all-cash: no debt service and no balance", () => {
    const r = projection({ ...P, allCash: true });
    expect(r.years.every((y) => y.debtService === 0 && y.loanBalance === 0)).toBe(true);
    expect(r.cashInvested).toBe(underwrite({ ...P, allCash: true }).cashInvested);
    expect(r.irr.ok).toBe(true);
  });

  it("0% interest: straight-line principal", () => {
    const r = projection({ ...P, annualInterestRate: 0 });
    const loan = underwrite(P).loanAmount;
    expect(r.years[0].debtService).toBeCloseTo((loan / 360) * 12, 6);
    expect(r.years[0].loanBalance).toBeCloseTo(loan * (1 - 12 / 360), 6);
    expect(loanBalance(loan, 0, 30, 360)).toBe(0);
  });

  it("1-year hold: one year, and the sale lands in year 1's flow", () => {
    const r = projection({ ...P, projection: { ...DEFAULT_PROJECTION, holdYears: 1 } });
    expect(r.years).toHaveLength(1);
    expect(r.totalProfit).toBeCloseTo(r.years[0].cashFlow + r.netSaleProceeds - r.cashInvested, 6);
    expect(r.irr.ok).toBe(true);
  });

  it("30-year hold on a 30-year loan: paid off at the end", () => {
    const r = projection({ ...P, projection: { ...DEFAULT_PROJECTION, holdYears: 30 } });
    expect(r.years).toHaveLength(30);
    expect(r.years[29].loanBalance).toBe(0);
    expect(r.loanPayoff).toBe(0);
    expect(r.years[29].debtService).toBeCloseTo(r.years[0].debtService, 6);
  });

  it("hold longer than the loan: debt service stops at payoff", () => {
    const r = projection({ ...P, loanTermYears: 15, projection: { ...DEFAULT_PROJECTION, holdYears: 20 } });
    expect(r.years[14].debtService).toBeGreaterThan(0);
    expect(r.years[15].debtService).toBe(0);
    expect(r.years[15].loanBalance).toBe(0);
    expect(r.years[15].cashFlow).toBeGreaterThan(r.years[14].cashFlow);
  });

  it("negative cash flow every year never produces NaN", () => {
    const r = projection({ ...P, monthlyRent: 150_000 });
    expect(r.years.every((y) => y.cashFlow < 0)).toBe(true);
    expect(Number.isFinite(r.totalProfit)).toBe(true);
    if (r.irr.ok) expect(Number.isFinite(r.irr.rate)).toBe(true);
    else expect(["no-sign-change", "no-convergence"]).toContain(r.irr.reason);
  });

  it("0% growth: year N income and costs equal year 1", () => {
    const flat = { holdYears: 10, rentGrowth: 0, expenseGrowth: 0, valueGrowth: 0, sellingCostPct: 0.06 };
    const r = projection({ ...P, projection: flat });
    const [a, b] = [r.years[0], r.years[9]];
    for (const k of ["grossRent", "effectiveIncome", "operatingExpenses", "noi", "debtService", "capexReserve", "cashFlow", "value"] as const) {
      expect(b[k]).toBeCloseTo(a[k], 6);
    }
  });

  it("other income grows with rent and is not reduced by vacancy", () => {
    const withOther: PropertyInputs = { ...P, otherMonthlyIncome: 10_000 };
    const d = projection(withOther).years[1].effectiveIncome - projection(P).years[1].effectiveIncome;
    expect(d).toBeCloseTo(12 * 10_000 * 1.03, 6);
  });

  it("zero cash invested: equity multiple and IRR are n/a, never NaN", () => {
    const r = projection({ ...P, downPaymentPct: 0, closingCostValue: 0, initialRepairs: 0, initialReserve: 0 });
    expect(r.cashInvested).toBe(0);
    expect(r.equityMultiple).toBeNull();
    expect(r.irr).toEqual({ ok: false, reason: "no-investment" });
  });

  it("scenarios move the growth rates by their deltas", () => {
    const s = projectScenarios(P);
    expect(s.base.assumptions.rentGrowth).toBeCloseTo(0.03, 10);
    expect(s.conservative.assumptions.rentGrowth).toBeCloseTo(0.01, 10);
    expect(s.conservative.assumptions.expenseGrowth).toBeCloseTo(0.04, 10);
    expect(s.conservative.assumptions.valueGrowth).toBeCloseTo(0.01, 10);
    expect(s.optimistic.assumptions.valueGrowth).toBeCloseTo(0.05, 10);
    expect(s.base.irr).toEqual(projection(P).irr);
  });

  it("scenarios saved before Phase 2 fall back to the default growth deltas", () => {
    const old = { rentChangePct: -0.05, vacancyPts: 0.03, maintenancePts: 0.02, capexPts: 0.03, fixedCostChangePct: 0.1 };
    const s = projectScenarios(P, { conservative: old, base: { ...old, rentChangePct: 0, vacancyPts: 0, maintenancePts: 0, capexPts: 0, fixedCostChangePct: 0 }, optimistic: old });
    expect(s.conservative.assumptions.rentGrowth).toBeCloseTo(0.01, 10);
    expect(s.base.assumptions.rentGrowth).toBeCloseTo(0.03, 10);
  });
});

describe("irr", () => {
  it("solves a simple case", () => {
    const r = irr([-100, 110]);
    expect(r.ok && r.rate).toBeCloseTo(0.1, 10);
  });
  it("reports no solution instead of NaN", () => {
    expect(irr([-100, -10, -10])).toEqual({ ok: false, reason: "no-sign-change" });
    expect(irr([0, 10])).toEqual({ ok: false, reason: "no-investment" });
    expect(irr([100, -10])).toEqual({ ok: false, reason: "no-investment" });
  });
  it("handles a deep loss (IRR near −100%)", () => {
    const r = irr([-100, 1]);
    expect(r.ok && r.rate).toBeCloseTo(-0.99, 6);
  });
});
