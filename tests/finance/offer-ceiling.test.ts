import { describe, expect, it } from "vitest";
import { DEMO_PROPERTY as P } from "../../src/data/demo-property";
import { ceilingByConstraint, offerCeiling } from "../../src/lib/finance/offer-ceiling";
import { irr } from "../../src/lib/finance/irr";
import { growthDeltas, projection } from "../../src/lib/finance/projection";
import { underwrite } from "../../src/lib/finance/underwriting";
import { DEFAULT_SCENARIOS, applyScenario } from "../../src/lib/finance/scenarios";
import type { OfferConstraints, PropertyInputs } from "../../src/lib/finance/types";

// Captured from the Phase 1 engine before any Phase 2 change. Phase 1 constraints must keep giving exactly these.
const GOLDEN: Record<string, object> = {"none":{"status":"no-constraints"},"cf0":{"status":"feasible","price":26309900,"limitingConstraints":["minMonthlyCashFlow"],"limitingScenario":"base","hitSearchBound":false,"cons":false},"cf200":{"status":"feasible","price":22301700,"limitingConstraints":["minMonthlyCashFlow"],"limitingScenario":"base","hitSearchBound":false,"cons":false},"cf200cons":{"status":"feasible","price":15833400,"limitingConstraints":["minMonthlyCashFlow"],"limitingScenario":"conservative","hitSearchBound":false,"cons":true},"coc8":{"status":"feasible","price":17688400,"limitingConstraints":["minCashOnCash"],"limitingScenario":"base","hitSearchBound":false,"cons":false},"coc5":{"status":"feasible","price":20308800,"limitingConstraints":["minCashOnCash"],"limitingScenario":"base","hitSearchBound":false,"cons":false},"cash85":{"status":"feasible","price":25000000,"limitingConstraints":["maxUpfrontCash"],"limitingScenario":"base","hitSearchBound":false,"cons":false},"all3":{"status":"feasible","price":19642800,"limitingConstraints":["maxUpfrontCash"],"limitingScenario":"base","hitSearchBound":false,"cons":false},"infeasible":{"status":"infeasible","failingConstraints":["minMonthlyCashFlow"],"failingScenario":"base"},"bound":{"status":"feasible","price":200000000,"limitingConstraints":[],"limitingScenario":null,"hitSearchBound":true,"cons":false},"allcash":{"status":"feasible","price":29133200,"limitingConstraints":["minCashOnCash"],"limitingScenario":"base","hitSearchBound":false,"cons":false},"cons-edited":{"status":"feasible","price":18205500,"limitingConstraints":["minMonthlyCashFlow"],"limitingScenario":"conservative","hitSearchBound":false,"cons":true}};

const CASES: [string, OfferConstraints, Partial<PropertyInputs>?][] = [
  ["none", {}], ["cf0", { minMonthlyCashFlow: 0 }], ["cf200", { minMonthlyCashFlow: 20_000 }],
  ["cf200cons", { minMonthlyCashFlow: 20_000, mustPassConservative: true }], ["coc8", { minMonthlyCashFlow: 0, minCashOnCash: 0.08 }],
  ["coc5", { minCashOnCash: 0.05 }], ["cash85", { maxUpfrontCash: 8_500_000 }], ["all3", { minMonthlyCashFlow: 10_000, minCashOnCash: 0.03, maxUpfrontCash: 7_000_000 }],
  ["infeasible", { minMonthlyCashFlow: 300_000 }], ["bound", { maxUpfrontCash: 1e12 }],
  ["allcash", { minCashOnCash: 0.05 }, { allCash: true }], ["cons-edited", { minMonthlyCashFlow: 0, mustPassConservative: true }],
];

describe("offer ceiling: Phase 1 outputs are locked", () => {
  for (const [name, c, patch] of CASES) {
    it(name, () => {
      const cons = name === "cons-edited" ? { ...DEFAULT_SCENARIOS.conservative, rentChangePct: -0.1 } : undefined;
      const r = offerCeiling({ ...P, ...(patch ?? {}) }, c, cons);
      const got = r.status === "feasible"
        ? { status: r.status, price: r.price, limitingConstraints: r.limitingConstraints, limitingScenario: r.limitingScenario, hitSearchBound: r.hitSearchBound, cons: r.conservativeMetrics !== null }
        : r;
      expect(got).toEqual(GOLDEN[name]);
    });
  }
});


const at = (price: number, patch: Partial<PropertyInputs> = {}) => ({ ...P, ...patch, purchasePrice: price });

describe("offer ceiling: Phase 2 targets", () => {
  it("min cap rate: passes at the ceiling and fails $1 above", () => {
    const r = offerCeiling(P, { minCapRate: 0.07 });
    if (r.status !== "feasible") throw new Error(r.status);
    expect(underwrite(at(r.price)).capRate!).toBeGreaterThanOrEqual(0.07);
    expect(underwrite(at(r.price + 100)).capRate!).toBeLessThan(0.07);
    expect(r.limitingConstraints).toEqual(["minCapRate"]);
  });

  it("min DSCR: passes at the ceiling and fails $1 above; all-cash is never limited", () => {
    const r = offerCeiling(P, { minDscr: 1.25 });
    if (r.status !== "feasible") throw new Error(r.status);
    const dscr = (p: number) => { const u = underwrite(at(p)); return u.noi / u.monthlyPI; };
    expect(dscr(r.price)).toBeGreaterThanOrEqual(1.25);
    expect(dscr(r.price + 100)).toBeLessThan(1.25);
    const cash = offerCeiling({ ...P, allCash: true }, { minDscr: 1.25 });
    expect(cash.status === "feasible" && cash.hitSearchBound).toBe(true);
  });

  it("min IRR: passes at the ceiling, fails $1 above, and is verified against the projection", () => {
    const r = offerCeiling(P, { minIrr: 0.09 });
    if (r.status !== "feasible") throw new Error(r.status);
    const irrAt = (p: number) => { const x = projection(at(p)).irr; return x.ok ? x.rate : -Infinity; };
    expect(irrAt(r.price)).toBeGreaterThanOrEqual(0.09);
    expect(irrAt(r.price + 100)).toBeLessThan(0.09);
    expect(r.limitingConstraints).toContain("minIrr");
    expect(r.irrNonMonotonic).toBeUndefined();
  });

  it("an unreachable IRR is infeasible, names the target and says it was a scan", () => {
    const r = offerCeiling(P, { minIrr: 5 });
    expect(r).toMatchObject({ status: "infeasible", failingConstraints: ["minIrr"], scanned: true });
  });

  it("IRR together with cash flow: never above the cash-flow ceiling", () => {
    const cf = offerCeiling(P, { minMonthlyCashFlow: 20_000 });
    const both = offerCeiling(P, { minMonthlyCashFlow: 20_000, minIrr: 0.12 });
    if (cf.status !== "feasible" || both.status !== "feasible") throw new Error("expected feasible");
    expect(both.price).toBeLessThanOrEqual(cf.price);
  });

  it("without IRR, the overall ceiling is the lowest single-target ceiling", () => {
    const c: OfferConstraints = { minMonthlyCashFlow: 20_000, minCashOnCash: 0.05, minCapRate: 0.065, minDscr: 1.2, maxUpfrontCash: 9_000_000 };
    const all = offerCeiling(P, c);
    const alone = ceilingByConstraint(P, c);
    expect(alone.map((a) => a.key)).toEqual(["minMonthlyCashFlow", "minCashOnCash", "maxUpfrontCash", "minCapRate", "minDscr"]);
    const prices = alone.map((a) => (a.result.status === "feasible" ? a.result.price : 0));
    if (all.status !== "feasible") throw new Error(all.status);
    expect(all.price).toBe(Math.min(...prices));
  });

  it("each single-target ceiling keeps the conservative rule", () => {
    const alone = ceilingByConstraint(P, { minMonthlyCashFlow: 20_000, mustPassConservative: true });
    expect(alone[0].result).toMatchObject({ status: "feasible", price: 15_833_400, limitingScenario: "conservative" });
  });
});

describe("offer ceiling: Phase 2 edge paths", () => {
  const irrAt = (i: PropertyInputs, deltas?: Parameters<typeof projection>[1]) => { const x = projection(i, deltas).irr; return x.ok ? x.rate : -Infinity; };

  it("DSCR on a financed loss-maker is infeasible, even though the $1 probe has a 0¢ payment", () => {
    expect(offerCeiling({ ...P, monthlyRent: 50_000 }, { minDscr: 1.2 })).toEqual({ status: "infeasible", failingConstraints: ["minDscr"], failingScenario: "base" });
  });

  it("IRR with the conservative rule uses the conservative projection and its growth deltas", () => {
    const base = offerCeiling(P, { minIrr: 0.08 });
    const cons = offerCeiling(P, { minIrr: 0.08, mustPassConservative: true });
    if (base.status !== "feasible" || cons.status !== "feasible") throw new Error("expected feasible");
    expect(cons.price).toBeLessThan(base.price);
    const c = DEFAULT_SCENARIOS.conservative;
    expect(irrAt(applyScenario(at(cons.price), c), growthDeltas("conservative", c))).toBeGreaterThanOrEqual(0.08);
    expect(cons.limitingScenario).toBe("conservative");
  });

  it("when IRR binds, the overall ceiling equals the IRR-alone ceiling", () => {
    const c: OfferConstraints = { minMonthlyCashFlow: 0, minIrr: 0.12 };
    const all = offerCeiling(P, c);
    const irrAlone = ceilingByConstraint(P, c).find((a) => a.key === "minIrr")!.result;
    if (all.status !== "feasible" || irrAlone.status !== "feasible") throw new Error("expected feasible");
    expect(all.limitingConstraints).toContain("minIrr");
    expect(all.price).toBe(irrAlone.price);
  });
});

describe("irr: agrees with plain bisection", () => {
  const npv = (f: number[], r: number) => f.reduce((s, c, i) => s + c / Math.pow(1 + r, i), 0);
  it("on 200 random single-sign-change flows", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let t = 0; t < 200; t++) {
      const n = 1 + Math.floor(rnd() * 30);
      const flows = [-(1_000 + rnd() * 1e7), ...Array.from({ length: n }, () => rnd() * 3e6)];
      const r = irr(flows);
      if (!r.ok) throw new Error(`no IRR for case ${t}`);
      let lo = -0.9999, hi = 1e3;
      for (let i = 0; i < 400; i++) { const m = (lo + hi) / 2; if (npv(flows, m) > 0) lo = m; else hi = m; }
      expect(r.rate).toBeCloseTo((lo + hi) / 2, 6);
    }
  });
});
