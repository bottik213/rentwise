import type {
  ConstraintKey, Cents, OfferCeilingResult, OfferConstraints, PropertyInputs, ScenarioAdjustments, ScenarioName, Underwriting,
} from "./types";
import { DEFAULT_SCENARIOS, applyScenario } from "./scenarios";
import { underwrite } from "./underwriting";

const STEP: Cents = 100; // $1 precision

function failing(u: Underwriting, c: OfferConstraints): ConstraintKey[] {
  const out: ConstraintKey[] = [];
  if (c.minMonthlyCashFlow !== undefined && u.reserveAdjustedCashFlow < c.minMonthlyCashFlow) out.push("minMonthlyCashFlow");
  if (c.minCashOnCash !== undefined && (u.cashOnCash === null || u.cashOnCash < c.minCashOnCash)) out.push("minCashOnCash");
  if (c.maxUpfrontCash !== undefined && u.cashInvested > c.maxUpfrontCash) out.push("maxUpfrontCash");
  return out;
}

/**
 * Highest purchase price (to $1) that meets every constraint, "offer ceiling under assumptions".
 * Each candidate recomputes loan, down payment and %-based closing costs; rent, tax and insurance
 * are held constant (disclosed in the UI).
 * Binary search assumes feasibility shrinks as price rises, which holds for min CF, max upfront cash and
 * min CoC ≥ 0. A negative min CoC can break that; the result is still a verified feasible price.
 */
export function offerCeiling(
  inputs: PropertyInputs,
  c: OfferConstraints,
  conservative: ScenarioAdjustments = DEFAULT_SCENARIOS.conservative,
): OfferCeilingResult {
  if (c.minMonthlyCashFlow === undefined && c.minCashOnCash === undefined && c.maxUpfrontCash === undefined) {
    return { status: "no-constraints" };
  }

  const check = (price: Cents) => {
    const at = { ...inputs, purchasePrice: price };
    const base = underwrite(at);
    const cons = c.mustPassConservative ? underwrite(applyScenario(at, conservative)) : null;
    const baseFails = failing(base, c);
    const consFails = cons ? failing(cons, c) : [];
    const scenario: ScenarioName | null = baseFails.length ? "base" : consFails.length ? "conservative" : null;
    return { base, cons, fails: baseFails.length ? baseFails : consFails, scenario };
  };

  let lo = STEP;
  const atLo = check(lo);
  if (atLo.scenario) return { status: "infeasible", failingConstraints: atLo.fails, failingScenario: atLo.scenario };

  let hi = Math.max(4 * inputs.purchasePrice, 200_000_000); // ≥ $2M search bound
  hi -= hi % STEP;
  const atHi = check(hi);
  const hitSearchBound = atHi.scenario === null;

  if (!hitSearchBound) {
    while (hi - lo > STEP) {
      const mid = lo + Math.floor((hi - lo) / 2 / STEP) * STEP;
      if (check(mid).scenario === null) lo = mid;
      else hi = mid;
    }
  } else lo = hi;

  const result = check(lo);
  if (result.scenario !== null) throw new Error("offerCeiling: search returned an infeasible price"); // invariant
  const above = hitSearchBound ? null : check(lo + STEP);

  return {
    status: "feasible",
    price: lo,
    deltaFromAsking: lo - inputs.purchasePrice,
    limitingConstraints: above?.fails ?? [],
    limitingScenario: above?.scenario ?? null,
    hitSearchBound,
    metrics: result.base,
    conservativeMetrics: result.cons,
  };
}
