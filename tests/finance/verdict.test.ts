import { describe, expect, it } from "vitest";
import { DEMO_PROPERTY } from "../../src/data/demo-property";
import { offerCeiling } from "../../src/lib/finance/offer-ceiling";
import { underwrite } from "../../src/lib/finance/underwriting";
import { breakEvenBadge, cashFlowStatus, cashOnCashBadge, ceilingBadge, verdict } from "../../src/lib/verdict";

const u = underwrite(DEMO_PROPERTY);
const rent = DEMO_PROPERTY.monthlyRent;

describe("verdict", () => {
  it("calls the example a thin margin and says why in plain dollars", () => {
    const v = verdict(u, { minMonthlyCashFlow: 0 }, rent);
    expect(v.st).toBe("warn");
    expect(v.label).toBe("Thin margin");
    expect(v.text).toBe(
      "At these numbers, this property covers its costs, but only just. After all costs and reserves, it brings in about $65 a month ($784 a year) on $85,000 invested, a 0.92% cash-on-cash return. If rent drops by about $88 a month, it stops covering its costs.",
    );
  });

  it("compares against the user's own target, not a fixed bar", () => {
    expect(cashFlowStatus(u, { minMonthlyCashFlow: 20_000 }, rent)).toBe("bad");
    expect(cashFlowStatus(u, { minMonthlyCashFlow: -10_000 }, rent)).toBe("warn"); // margin is fine, cushion is under 5%
    const roomy = underwrite({ ...DEMO_PROPERTY, monthlyRent: 300_000 });
    expect(cashFlowStatus(roomy, {}, 300_000)).toBe("good");
  });

  it("turns negative cash flow into an out-of-pocket sentence", () => {
    const loss = underwrite({ ...DEMO_PROPERTY, vacancyPct: 0.1 });
    const v = verdict(loss, {}, rent);
    expect(v.st).toBe("bad");
    expect(v.text).toContain("you would pay about $47 a month ($568 a year) out of pocket");
  });
});

describe("badges", () => {
  it("cash-on-cash only judges against a target the user set", () => {
    expect(cashOnCashBadge(u.cashOnCash, undefined)).toEqual({ st: "none", label: "No target set" });
    expect(cashOnCashBadge(0.085, 0.08).st).toBe("warn");
    expect(cashOnCashBadge(0.12, 0.08).st).toBe("good");
    expect(cashOnCashBadge(0.05, 0.08).st).toBe("bad");
  });

  it("break-even cushion under 5% is thin", () => {
    expect(breakEvenBadge(u, rent)).toEqual({ st: "warn", label: "Thin cushion" });
  });

  it("offer ceiling above asking with room is good", () => {
    const r = offerCeiling(DEMO_PROPERTY, { minMonthlyCashFlow: 0 });
    expect(ceilingBadge(r, DEMO_PROPERTY.purchasePrice)).toEqual({ st: "good", label: "Above asking" });
    expect(ceilingBadge(offerCeiling(DEMO_PROPERTY, {}), DEMO_PROPERTY.purchasePrice).st).toBe("none");
  });
});
