import { describe, expect, it } from "vitest";
import { DEMO_PROPERTY as REF } from "../../src/data/demo-property";
import { monthlyPayment } from "../../src/lib/finance/mortgage";
import { underwrite } from "../../src/lib/finance/underwriting";
import { DEFAULT_SCENARIOS, applyScenario, runScenarios } from "../../src/lib/finance/scenarios";
import { offerCeiling } from "../../src/lib/finance/offer-ceiling";
import { sensitivity } from "../../src/lib/finance/sensitivity";
import { monthlyForecast, variance } from "../../src/lib/finance/variance";
import type { ActualMonth, PropertyInputs } from "../../src/lib/finance/types";

const with_ = (p: Partial<PropertyInputs>): PropertyInputs => ({ ...REF, ...p });

describe("underwriting: MASTER_PROMPT reference case", () => {
  const u = underwrite(REF);
  it.each([
    ["monthlyPI", 124_744],
    ["effectiveRent", 232_750],
    ["operatingExpenses", 89_220],
    ["noi", 143_530],
    ["cashFlowBeforeCapex", 18_786],
    ["reserveAdjustedCashFlow", 6_536],
    ["cashInvested", 8_500_000],
  ] as const)("%s = %i cents", (k, v) => expect(Math.abs(u[k] - v)).toBeLessThanOrEqual(1));

  it("cap rate 6.8894%, CoC 0.9227%", () => {
    expect(u.capRate!).toBeCloseTo(0.068894, 6);
    expect(u.cashOnCash!).toBeCloseTo(0.009227, 6);
  });

  it("break-even rent is the lowest rent with non-negative reserve-adjusted CF", () => {
    const be = u.breakEvenRent!;
    expect(underwrite(with_({ monthlyRent: be })).reserveAdjustedCashFlow).toBeGreaterThanOrEqual(0);
    expect(underwrite(with_({ monthlyRent: be - 100 })).reserveAdjustedCashFlow).toBeLessThan(0);
  });
});

describe("underwriting: edge cases", () => {
  it("zero interest → P&I = L/n", () => {
    expect(monthlyPayment(18_750_000, 0, 30)).toBe(52_083);
    expect(underwrite(with_({ annualInterestRate: 0 })).monthlyPI).toBe(52_083);
  });

  it.each([1e-8, 1e-12, 1e-16, Number.MIN_VALUE])("near-zero interest %s stays finite and approaches the zero-rate payment", (annualRate) => {
    expect(monthlyPayment(18_750_000, annualRate, 30)).toBe(52_083);
    const u = underwrite(with_({ annualInterestRate: annualRate }));
    expect(u.monthlyPI).toBe(52_083);
    expect(u.reserveAdjustedCashFlow).toBe(79_197);
    expect(Number.isFinite(u.breakEvenRent)).toBe(true);
  });

  it("all-cash → no loan, no P&I, full price in cash invested", () => {
    const u = underwrite(with_({ allCash: true }));
    expect([u.loanAmount, u.monthlyPI]).toEqual([0, 0]);
    expect(u.cashInvested).toBe(25_000_000 + 750_000 + 500_000 + 1_000_000);
    expect(u.reserveAdjustedCashFlow).toBe(143_530 - 12_250);
  });

  it("negative cash flow propagates to negative CoC", () => {
    const u = underwrite(with_({ monthlyRent: 150_000 }));
    expect(u.reserveAdjustedCashFlow).toBeLessThan(0);
    expect(u.cashOnCash!).toBeLessThan(0);
  });

  it("100% vacancy → no income, no break-even rent", () => {
    const u = underwrite(with_({ vacancyPct: 1 }));
    expect([u.effectiveRent, u.management]).toEqual([0, 0]);
    expect(u.breakEvenRent).toBeNull();
  });

  it("zero price and zero cash invested → null ratios, not Infinity/NaN", () => {
    const u = underwrite(with_({ allCash: true, purchasePrice: 0, initialRepairs: 0, initialReserve: 0 }));
    expect(u.cashInvested).toBe(0);
    expect([u.capRate, u.cashOnCash]).toEqual([null, null]);
  });

  it("rejects NaN and Infinity", () => {
    expect(() => underwrite(with_({ monthlyRent: NaN }))).toThrow(RangeError);
    expect(() => underwrite(with_({ annualInsurance: Infinity }))).toThrow(RangeError);
  });

  it("recalculates after edits without mutating inputs", () => {
    const before = structuredClone(REF);
    const edited = underwrite(with_({ vacancyPct: 0.1 }));
    expect(edited.reserveAdjustedCashFlow).toBeLessThan(underwrite(REF).reserveAdjustedCashFlow);
    expect(REF).toEqual(before);
  });
});

describe("scenarios", () => {
  it("conservative < base < optimistic, base = plain underwriting", () => {
    const s = runScenarios(REF);
    expect(s.base).toEqual(underwrite(REF));
    expect(s.conservative.reserveAdjustedCashFlow).toBeLessThan(s.base.reserveAdjustedCashFlow);
    expect(s.optimistic.reserveAdjustedCashFlow).toBeGreaterThan(s.base.reserveAdjustedCashFlow);
  });

  it("clamps rates to [0, 1]", () => {
    const i = applyScenario(with_({ vacancyPct: 0.01 }), DEFAULT_SCENARIOS.optimistic);
    expect(i.vacancyPct).toBe(0);
  });
});

describe("offer ceiling", () => {
  it("no constraints → explicit status, never a silent 0", () => {
    expect(offerCeiling(REF, {})).toEqual({ status: "no-constraints" });
  });

  it("max upfront cash $85,000 → ceiling exactly at asking (0.28·P + $15k)", () => {
    const r = offerCeiling(REF, { maxUpfrontCash: 8_500_000 });
    expect(r.status).toBe("feasible");
    if (r.status !== "feasible") return;
    expect(r.price).toBe(25_000_000);
    expect(r.deltaFromAsking).toBe(0);
    expect(r.limitingConstraints).toEqual(["maxUpfrontCash"]);
  });

  it("min cash flow $0 → highest price to $1 where CF ≥ 0, recomputing loan per candidate", () => {
    const r = offerCeiling(REF, { minMonthlyCashFlow: 0 });
    if (r.status !== "feasible") throw new Error(r.status);
    expect(r.price).toBeGreaterThan(REF.purchasePrice);
    expect(r.metrics.reserveAdjustedCashFlow).toBeGreaterThanOrEqual(0);
    expect(underwrite(with_({ purchasePrice: r.price + 100 })).reserveAdjustedCashFlow).toBeLessThan(0);
    expect(r.limitingConstraints).toEqual(["minMonthlyCashFlow"]);
  });

  it("must pass conservative → lower ceiling, conservative is the limit", () => {
    const loose = offerCeiling(REF, { minMonthlyCashFlow: 0 });
    const strict = offerCeiling(REF, { minMonthlyCashFlow: 0, mustPassConservative: true });
    if (loose.status !== "feasible" || strict.status !== "feasible") throw new Error("expected feasible");
    expect(strict.price).toBeLessThan(loose.price);
    expect(strict.limitingScenario).toBe("conservative");
    expect(strict.conservativeMetrics!.reserveAdjustedCashFlow).toBeGreaterThanOrEqual(0);
  });

  it("all-cash min CoC 5% → verified ceiling", () => {
    const i = with_({ allCash: true });
    const r = offerCeiling(i, { minCashOnCash: 0.05 });
    if (r.status !== "feasible") throw new Error(r.status);
    expect(r.metrics.cashOnCash!).toBeGreaterThanOrEqual(0.05);
    expect(underwrite({ ...i, purchasePrice: r.price + 100 }).cashOnCash!).toBeLessThan(0.05);
  });

  it("infeasible constraints → infeasible result naming the constraint", () => {
    expect(offerCeiling(REF, { minMonthlyCashFlow: 300_000 })).toEqual({
      status: "infeasible", failingConstraints: ["minMonthlyCashFlow"], failingScenario: "base",
    });
  });

  it("flags when the ceiling hits the search bound", () => {
    const r = offerCeiling(REF, { maxUpfrontCash: 1e12 });
    expect(r.status === "feasible" && r.hitSearchBound).toBe(true);
  });
});

describe("sensitivity", () => {
  const rows = sensitivity(REF);
  it("+$100/mo insurance = −$1,200/yr", () => {
    expect(rows.find((r) => r.key === "annualInsurance")!.annualImpact).toBe(-120_000);
  });
  it("ranked by absolute impact, with verification flags from sources", () => {
    const abs = rows.map((r) => Math.abs(r.annualImpact));
    expect(abs).toEqual([...abs].sort((a, b) => b - a));
    expect(rows.find((r) => r.key === "annualPropertyTax")!.verified).toBe(true);
    expect(rows.find((r) => r.key === "annualInsurance")!.verified).toBe(false);
  });
  it("omits the interest shock for all-cash deals", () => {
    expect(sensitivity(with_({ allCash: true })).some((r) => r.key === "annualInterestRate")).toBe(false);
  });
});

describe("variance", () => {
  const u = underwrite(REF);
  const onPlan = (month: string): ActualMonth => ({ month, ...monthlyForecast(u), capex: 0 });

  it("actuals exactly on plan → zero variance", () => {
    const v = variance(u, [onPlan("2026-01"), onPlan("2026-02"), onPlan("2026-03")]);
    expect(v.totalVariance).toBe(0);
    expect(v.forecastCashFlowBeforeCapex).toBe(3 * 18_786);
  });

  it("surprise $1,800 repair → −$1,800 variance, attributed to repairs", () => {
    const m2 = { ...onPlan("2026-02"), repairsMaintenance: u.maintenance + 180_000 };
    const v = variance(u, [onPlan("2026-01"), m2, onPlan("2026-03")]);
    expect(v.totalVariance).toBe(-180_000);
    expect(v.contributors.find((c) => c.category === "repairsMaintenance")!.impact).toBe(-180_000);
  });

  it("CapEx spend never enters cash flow before CapEx", () => {
    const v = variance(u, [{ ...onPlan("2026-01"), capex: 450_000 }]);
    expect(v.totalVariance).toBe(0);
    expect([v.actualCapex, v.plannedCapexReserve]).toEqual([450_000, 12_250]);
  });

  it("contributors sum exactly to total variance (randomized)", () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31);
    for (let t = 0; t < 200; t++) {
      const months = Array.from({ length: 1 + Math.floor(rand() * 12) }, (_, k) => {
        const m = onPlan(`2026-${k + 1}`);
        for (const key of Object.keys(m) as (keyof ActualMonth)[]) {
          if (key !== "month") (m[key] as number) = Math.floor(rand() * 400_000);
        }
        return m;
      });
      const v = variance(u, months);
      expect(v.contributors.reduce((s, c) => s + c.impact, 0)).toBe(v.totalVariance);
    }
  });

  it("no months entered → empty, zero report", () => {
    const v = variance(u, []);
    expect([v.months, v.totalVariance, v.forecastCashFlowBeforeCapex]).toEqual([0, 0, 0]);
  });
});
