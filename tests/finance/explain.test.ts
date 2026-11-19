import { describe, expect, it } from "vitest";
import { DEMO_PROPERTY } from "../../src/data/demo-property";
import { i18n } from "../../src/i18n";
import { explainVariance } from "../../src/lib/explain";
import { underwrite } from "../../src/lib/finance/underwriting";
import { monthlyForecast, variance } from "../../src/lib/finance/variance";

describe("explainVariance", () => {
  const u = underwrite(DEMO_PROPERTY);
  const onPlan = { month: "2026-01", ...monthlyForecast(u), capex: 0 };

  it("names the 1,800 surprise repair as the only driver", () => {
    const r = variance(u, [onPlan, { ...onPlan, month: "2026-02", repairsMaintenance: onPlan.repairsMaintenance + 180_000 }]);
    const text = explainVariance(r, i18n("en"));
    expect(r.totalVariance).toBe(-180_000);
    expect(text[0]).toContain("₸1,800.00 below");
    expect(text[1]).toMatch(/^Repairs & maintenance: .* −₸1,800\.00 to cash flow\.$/);
    expect(text).toHaveLength(3); // summary, one driver, CapEx note
  });

  it("says when cash flow matched the plan exactly", () => {
    expect(explainVariance(variance(u, [onPlan]), i18n("en"))[0]).toContain("matched the plan exactly");
  });

  it("is empty with no months", () => {
    expect(explainVariance(variance(u, []), i18n("en"))).toEqual([]);
  });
});
