import type {
  ConstraintKey, Cents, OfferCeilingResult, OfferConstraints, PropertyInputs, ScenarioAdjustments, ScenarioName, Underwriting,
} from "./types";
import type { IrrResult } from "./irr";
import { CONSTRAINT_KEYS } from "./types";
import { growthDeltas, projection } from "./projection";
import { DEFAULT_SCENARIOS, applyScenario } from "./scenarios";
import { underwrite } from "./underwriting";

const STEP: Cents = 100; // $1 precision
const IRR_SCAN_STEPS = 120;
/** Targets that only get harder as the price rises (rent, tax and insurance held constant). */
const MONOTONE: ConstraintKey[] = ["minMonthlyCashFlow", "minCashOnCash", "maxUpfrontCash", "minCapRate", "minDscr"];

function failing(u: Underwriting, c: OfferConstraints, irrAt?: () => IrrResult): ConstraintKey[] {
  const out: ConstraintKey[] = [];
  if (c.minMonthlyCashFlow !== undefined && u.reserveAdjustedCashFlow < c.minMonthlyCashFlow) out.push("minMonthlyCashFlow");
  if (c.minCashOnCash !== undefined && (u.cashOnCash === null || u.cashOnCash < c.minCashOnCash)) out.push("minCashOnCash");
  if (c.maxUpfrontCash !== undefined && u.cashInvested > c.maxUpfrontCash) out.push("maxUpfrontCash");
  if (c.minCapRate !== undefined && (u.capRate === null || u.capRate < c.minCapRate)) out.push("minCapRate");
  // No loan → no debt to cover. A loan whose payment rounds to 0¢ (the $1 probe) passes only with positive NOI.
  if (c.minDscr !== undefined && u.loanAmount > 0 && (u.monthlyPI > 0 ? u.noi / u.monthlyPI < c.minDscr : u.noi <= 0)) out.push("minDscr");
  if (c.minIrr !== undefined && irrAt) {
    const r = irrAt();
    if (!r.ok || r.rate < c.minIrr) out.push("minIrr"); // no IRR at all fails the target
  }
  return out;
}

/**
 * Highest purchase price (to $1) that meets every constraint, "offer ceiling under assumptions".
 * Each candidate recomputes loan, down payment and %-based closing costs; rent, tax and insurance
 * are held constant (disclosed in the UI).
 * Binary search assumes feasibility shrinks as price rises, which holds for min CF, max upfront cash,
 * min cap rate, min DSCR and min CoC ≥ 0. IRR can break that (value growth scales with price), so an IRR
 * target is checked after the search: at the ceiling first, then by a coarse scan downward and a bisection
 * on the highest passing bracket. Every returned price is re-validated against every target.
 */
export function offerCeiling(
  inputs: PropertyInputs,
  c: OfferConstraints,
  conservative: ScenarioAdjustments = DEFAULT_SCENARIOS.conservative,
): OfferCeilingResult {
  const hasIrr = c.minIrr !== undefined;
  if (!hasIrr && MONOTONE.every((k) => c[k] === undefined)) return { status: "no-constraints" };

  const check = (price: Cents, withIrr = false) => {
    const at = { ...inputs, purchasePrice: price };
    const consAt = c.mustPassConservative ? applyScenario(at, conservative) : null;
    const base = underwrite(at);
    const cons = consAt ? underwrite(consAt) : null;
    const baseFails = failing(base, c, withIrr ? () => projection(at).irr : undefined);
    const consFails = cons && consAt ? failing(cons, c, withIrr ? () => projection(consAt, growthDeltas("conservative", conservative)).irr : undefined) : [];
    const scenario: ScenarioName | null = baseFails.length ? "base" : consFails.length ? "conservative" : null;
    return { base, cons, fails: baseFails.length ? baseFails : consFails, scenario };
  };

  let lo = STEP;
  const atLo = check(lo);
  if (atLo.scenario) return { status: "infeasible", failingConstraints: atLo.fails, failingScenario: atLo.scenario };

  let hi = Math.max(4 * inputs.purchasePrice, 200_000_000); // ≥ $2M search bound
  hi -= hi % STEP;
  const atHi = check(hi);
  let hitSearchBound = atHi.scenario === null;

  if (!hitSearchBound) {
    while (hi - lo > STEP) {
      const mid = lo + Math.floor((hi - lo) / 2 / STEP) * STEP;
      if (check(mid).scenario === null) lo = mid;
      else hi = mid;
    }
  } else lo = hi;

  let irrNonMonotonic: boolean | undefined;
  if (hasIrr && check(lo, true).scenario !== null) {
    // IRR fails at the monotone ceiling: scan down for the highest passing price, then bisect up to $1.
    const top = lo;
    const grid = Array.from({ length: IRR_SCAN_STEPS + 1 }, (_, j) => Math.max(STEP, top - Math.round(((top - STEP) * j) / IRR_SCAN_STEPS / STEP) * STEP));
    const pass = grid.map((p) => check(p, true).scenario === null);
    const first = pass.indexOf(true);
    if (first < 0) {
      const f = check(top, true);
      return { status: "infeasible", failingConstraints: f.fails, failingScenario: f.scenario!, scanned: true };
    }
    irrNonMonotonic = pass.slice(first).includes(false);
    let ok = grid[first];
    let bad = grid[first - 1] ?? ok;
    while (bad - ok > STEP) {
      const mid = ok + Math.floor((bad - ok) / 2 / STEP) * STEP;
      if (check(mid, true).scenario === null) ok = mid;
      else bad = mid;
    }
    lo = ok;
    hitSearchBound = false;
  }

  const result = check(lo, hasIrr);
  if (result.scenario !== null) throw new Error("offerCeiling: search returned an infeasible price"); // invariant
  const above = hitSearchBound ? null : check(lo + STEP, hasIrr);

  return {
    status: "feasible",
    price: lo,
    deltaFromAsking: lo - inputs.purchasePrice,
    limitingConstraints: above?.fails ?? [],
    limitingScenario: above?.scenario ?? null,
    hitSearchBound,
    metrics: result.base,
    conservativeMetrics: result.cons,
    ...(irrNonMonotonic ? { irrNonMonotonic } : {}),
  };
}

/** The ceiling each enabled target allows on its own (same scenario rule), so the binding one is obvious. */
export function ceilingByConstraint(
  inputs: PropertyInputs,
  c: OfferConstraints,
  conservative: ScenarioAdjustments = DEFAULT_SCENARIOS.conservative,
): { key: ConstraintKey; result: OfferCeilingResult }[] {
  const keys = CONSTRAINT_KEYS.filter((k) => c[k] !== undefined);
  return keys.map((key) => ({ key, result: offerCeiling(inputs, { [key]: c[key], mustPassConservative: c.mustPassConservative }, conservative) }));
}
