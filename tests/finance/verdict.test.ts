import { describe, expect, it } from "vitest";
import { DEMO_PROPERTY } from "../../src/data/demo-property";
import { i18n } from "../../src/i18n";
import { underwrite } from "../../src/lib/finance/underwriting";
import { breakEvenBadge, cashFlowStatus, cashOnCashBadge, verdict } from "../../src/lib/verdict";

const u = underwrite(DEMO_PROPERTY);
const rent = DEMO_PROPERTY.monthlyRent;
const EN = i18n("en");

describe("verdict", () => {
  it("calls the example a thin margin and says why in plain money", () => {
    const v = verdict(u, { minMonthlyCashFlow: 0 }, rent, EN);
    expect(v.st).toBe("warn");
    expect(v.label).toBe("Thin margin");
    expect(v.text).toBe(
      "At these numbers, this property covers its costs, but only just. After all costs and reserves, it brings in about ₸65 a month (₸784 a year) on ₸85,000 invested, a 0.92% cash-on-cash return. If rent drops by about ₸88 a month, it stops covering its costs.",
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
    const v = verdict(loss, {}, rent, EN);
    expect(v.st).toBe("bad");
    expect(v.text).toContain("you would pay about ₸47 a month (₸568 a year) out of pocket");
  });
});

describe("badges", () => {
  it("cash-on-cash only judges against a target the user set", () => {
    expect(cashOnCashBadge(u.cashOnCash, undefined, EN)).toEqual({ st: "none", label: "No target set" });
    expect(cashOnCashBadge(0.085, 0.08, EN).st).toBe("warn");
    expect(cashOnCashBadge(0.12, 0.08, EN).st).toBe("good");
    expect(cashOnCashBadge(0.05, 0.08, EN).st).toBe("bad");
  });

  it("break-even cushion under 5% is thin", () => {
    expect(breakEvenBadge(u, rent, EN)).toEqual({ st: "warn", label: "Thin cushion" });
  });
});
