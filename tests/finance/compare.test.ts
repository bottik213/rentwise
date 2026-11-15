import { describe, expect, it } from "vitest";
import { DEMO_PROPERTY as P } from "../../src/data/demo-property";
import { COMPARE_ROWS, bestIndexes, dealMetrics, differingAssumptions } from "../../src/lib/compare";
import { DEFAULT_SCENARIOS } from "../../src/lib/finance/scenarios";

const metric = (label: string) => COMPARE_ROWS.find((r) => r.label === label)!;

describe("compare", () => {
  it("uses the same engine as the Analysis page", () => {
    const m = dealMetrics(P, DEFAULT_SCENARIOS, { minMonthlyCashFlow: 0 });
    expect(m.base.reserveAdjustedCashFlow).toBe(6536);
    expect(m.ceiling).toMatchObject({ status: "feasible", price: 26_309_900 });
    expect(m.projection.irr.ok && m.projection.irr.rate).toBeCloseTo(0.092883, 5);
    expect(m.dscr).toBeCloseTo(143_530 / 124_744, 10);
    expect(dealMetrics({ ...P, allCash: true }, DEFAULT_SCENARIOS, {}).dscr).toBeNull();
  });

  it("marks the best per row in the right direction, ties included, and never a lone value", () => {
    expect(bestIndexes([1, 3, 2], "higher")).toEqual([1]);
    expect(bestIndexes([1, 3, 1], "lower")).toEqual([0, 2]);
    expect(bestIndexes([5, null], "higher")).toEqual([]);
    expect(bestIndexes([4, 4], "higher")).toEqual([]);
    expect(metric("Break-even rent").better).toBe("lower");
    expect(metric("Price").better).toBe("lower");
  });

  it("lists only the assumptions that differ, with each deal's value", () => {
    const b = { ...P, vacancyPct: 0.1, projection: { holdYears: 10, rentGrowth: 0.02, expenseGrowth: 0.03, valueGrowth: 0.03, sellingCostPct: 0.06 } };
    expect(differingAssumptions([P, b])).toEqual([
      { label: "Vacancy", values: ["5.00%", "10.00%"] },
      { label: "Rent growth", values: ["3.00%", "2.00%"] },
    ]);
    expect(differingAssumptions([P, { ...P, purchasePrice: 1 }])).toEqual([]); // price is a fact, shown in the table
  });
});
