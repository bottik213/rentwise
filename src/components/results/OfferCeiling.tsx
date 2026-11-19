"use client";
import { NumberField } from "@/components/forms/NumberField";
import type { FieldDef } from "@/components/forms/fields";
import type { ConstraintKey, OfferCeilingResult, OfferConstraints, PropertyInputs } from "@/lib/finance/types";
import { ceilingReason, targetText } from "@/lib/verdict";
import { pct, usd } from "@/lib/format";
import { setAppState } from "@/lib/storage";
import { AnimatedNumber } from "./AnimatedNumber";

type Def = Pick<FieldDef, "label" | "kind" | "suffix" | "help" | "min" | "max">;
const CONSTRAINT_LABEL: Record<ConstraintKey, string> = {
  minMonthlyCashFlow: "minimum cash flow",
  minCashOnCash: "minimum cash-on-cash",
  maxUpfrontCash: "maximum upfront cash",
  minCapRate: "minimum cap rate",
  minDscr: "minimum DSCR",
  minIrr: "minimum IRR",
};
const ROWS: [ConstraintKey, Def, number][] = [
  ["minMonthlyCashFlow", { label: "Min. cash flow after reserves", kind: "money", suffix: "/mo", help: "", min: -100_000, max: 1_000_000 }, 20_000],
  // Floor at 0: the price search assumes a higher price never helps, which a negative target can break.
  ["minCashOnCash", { label: "Min. cash-on-cash", kind: "rate", suffix: "%/yr", help: "", min: 0, max: 100 }, 0.08],
  ["maxUpfrontCash", { label: "Max. upfront cash", kind: "money", help: "", min: 0, max: 100_000_000 }, 10_000_000],
  ["minCapRate", { label: "Min. cap rate", kind: "rate", suffix: "%", help: "", min: 0, max: 100 }, 0.06],
  ["minDscr", { label: "Min. DSCR (NOI ÷ mortgage)", kind: "number", suffix: "×", help: "", min: 0, max: 10 }, 1.25],
  ["minIrr", { label: "Min. IRR over the hold", kind: "rate", suffix: "%/yr", help: "", min: 0, max: 100 }, 0.1],
];

const list = (keys: ConstraintKey[]) => keys.map((k) => CONSTRAINT_LABEL[k]).join(" and ");
const whole = (v: number) => usd(Math.round(v));

/** Ticks on a 1-2-5 step with about four to eight labels between the two prices. */
function ticks(lo: number, hi: number): number[] {
  const span = hi - lo;
  let step = 10 ** Math.floor(Math.log10(span / 4));
  if (span / step > 8) step *= 2;
  if (span / step > 8) step *= 2.5;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) out.push(t);
  return out;
}

function Scale({ asking, ceiling }: { asking: number; ceiling: number }) {
  const lo = Math.min(asking, ceiling) * 0.9;
  const hi = Math.max(asking, ceiling) * 1.08;
  const X = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const above = ceiling >= asking;
  const delta = ceiling - asking;
  return (
    <div className="scale num" role="img" aria-label={`Price scale. Asking price ${usd(asking)}. Offer ceiling ${usd(ceiling)}.`}>
      <span className="ln" />
      {ticks(lo, hi).map((t, i) => (
        <span key={t}>
          <span className="tk" style={{ left: `${X(t)}%` }} />
          <span className={`tl ${i % 2 ? "alt" : ""}`} style={{ left: `${X(t)}%` }}>
            ${Math.round(t / 100_000)}k
          </span>
        </span>
      ))}
      <span className="gap" style={{ left: `${X(Math.min(asking, ceiling))}%`, width: `${Math.abs(X(ceiling) - X(asking))}%` }} />
      <span className="mk" style={{ left: `${X(asking)}%` }} />
      <span className="ml" style={{ left: `${X(asking)}%`, transform: `translateX(${above ? "calc(-100% - 8px)" : "8px"})` }}>
        Asking<b>{usd(asking)}</b>
      </span>
      <span className="mk ceil" style={{ left: `${X(ceiling)}%` }} />
      <span className="ml" style={{ left: `${X(ceiling)}%`, transform: `translateX(${above ? "8px" : "calc(-100% - 8px)"})`, color: "var(--brand)" }}>
        Offer ceiling
        <b>
          <AnimatedNumber value={ceiling} format={whole} />
        </b>
      </span>
      <span className="gl" style={{ left: `${(X(asking) + X(ceiling)) / 2}%` }}>
        {usd(delta, { signed: true })}
      </span>
    </div>
  );
}

type Alone = { key: ConstraintKey; result: OfferCeilingResult }[];
const aloneText = (r: OfferCeilingResult) =>
  r.status === "infeasible" ? "No price works" : r.status === "feasible" ? (r.hitSearchBound ? "Doesn't limit the price" : usd(r.price)) : "";

export function OfferCeiling({ property, constraints, result: r, alone }: { property: PropertyInputs; constraints: OfferConstraints; result: OfferCeilingResult; alone: Alone }) {
  const setC = (patch: Partial<OfferConstraints>) =>
    setAppState((x) => {
      const next = { ...x.constraints, ...patch };
      for (const k of Object.keys(patch) as (keyof OfferConstraints)[]) if (patch[k] === undefined) delete next[k];
      return { ...x, constraints: next };
    });
  const asking = property.purchasePrice;
  const feasible = r.status === "feasible" && !r.hitSearchBound ? r : null;
  const reason = feasible ? ceilingReason(feasible, alone, constraints) : null;

  return (
    <div className="card">
      <div aria-live="polite" className="ocstate">
        {/* Remount on state change so the new state fades in; price changes within "feasible" tween instead. */}
        <div key={r.status === "feasible" ? `f-${r.hitSearchBound}` : r.status}>
          {r.status === "no-constraints" && <p style={{ margin: 0, color: "var(--ink-2)" }}>Turn on at least one target below to see the most you could pay.</p>}

          {r.status === "infeasible" && (
            <>
              <p className="big neg">No price works</p>
              <p style={{ margin: "8px 0 0", color: "var(--ink-2)" }}>
                {r.scanned
                  ? `No price we tested meets the ${list(r.failingConstraints)} target${r.failingScenario === "conservative" ? " in the conservative scenario" : ""}. IRR is checked on a scan of prices, so a very narrow range could be missed. Loosen a target, or revisit rent, costs and financing.`
                  : `Even at $1, the ${list(r.failingConstraints)} target fails${r.failingScenario === "conservative" ? " in the conservative scenario" : ""}. Loosen a target, or revisit rent, costs and financing.`}
              </p>
            </>
          )}

          {r.status === "feasible" && r.hitSearchBound && (
            <>
              <p className="big">Not limited by your targets</p>
              <p style={{ margin: "8px 0 0", color: "var(--ink-2)" }}>
                Every price up to {usd(r.price)} (the search limit) meets them. Add or tighten a target to get a ceiling.
              </p>
            </>
          )}

          {feasible && (
            <>
              <Scale asking={asking} ceiling={feasible.price} />
              <p style={{ margin: "24px 0 0", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <span className="chip">
                  {feasible.limitingConstraints.length ? (
                    <>
                      Limited by <span>{list(feasible.limitingConstraints)}</span>
                      {feasible.limitingScenario === "conservative" ? " in the conservative scenario" : ""}
                    </>
                  ) : (
                    "Highest price that passed every target"
                  )}
                </span>
                <span className="num" style={{ color: "var(--ink-2)" }}>
                  <span className={feasible.deltaFromAsking < 0 ? "neg" : "pos"}>{usd(feasible.deltaFromAsking, { signed: true })}</span> vs. asking {usd(asking)}
                </span>
              </p>
              <p style={{ margin: "8px 0 0", color: "var(--ink-2)" }}>
                {feasible.deltaFromAsking >= 0
                  ? `You have ${usd(feasible.deltaFromAsking)} of room above the asking price.`
                  : `The asking price is ${usd(-feasible.deltaFromAsking)} more than your targets allow.`}
              </p>
              {reason && <p style={{ margin: "8px 0 0", color: "var(--ink-2)" }}>{reason}</p>}
              {feasible.irrNonMonotonic && (
                <p className="note" style={{ margin: "8px 0 0" }}>
                  IRR didn&apos;t fall steadily as the price rose, so some lower prices miss your IRR target while this one meets it. This is the highest price that passed.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="oc" style={{ marginTop: 32 }}>
        <fieldset className="tg">
          <legend>Your targets</legend>
          {ROWS.map(([key, def, initial]) => {
            const on = constraints[key] !== undefined;
            return (
              <div key={key} className="tgr">
                <input
                  type="checkbox"
                  className="sw"
                  aria-label={`Use ${def.label}`}
                  checked={on}
                  onChange={(e) => setC({ [key]: e.target.checked ? initial : undefined })}
                />
                {/* Off: show the value the switch would turn on with, greyed out. */}
                <NumberField def={def} value={on ? constraints[key] : initial} disabled={!on} onCommit={(v) => setC({ [key]: v })} />
              </div>
            );
          })}
          <label className="chk">
            <input type="checkbox" checked={!!constraints.mustPassConservative} onChange={(e) => setC({ mustPassConservative: e.target.checked || undefined })} />
            Must also pass the conservative scenario
          </label>
        </fieldset>
        <div>
          <p style={{ margin: "0 0 12px", fontWeight: 600 }}>At the ceiling price</p>
          {r.status === "feasible" ? (
            <dl className="ocs num">
              <div>
                <dt>Cash flow</dt>
                <dd className={r.metrics.reserveAdjustedCashFlow < 0 ? "neg" : ""}>{usd(r.metrics.reserveAdjustedCashFlow, { exact: true })}/mo</dd>
              </div>
              <div>
                <dt>Cash-on-cash</dt>
                <dd>{pct(r.metrics.cashOnCash)}</dd>
              </div>
              <div>
                <dt>Cash invested</dt>
                <dd>{usd(r.metrics.cashInvested)}</dd>
              </div>
              <div>
                <dt>Monthly P&amp;I</dt>
                <dd>{usd(r.metrics.monthlyPI, { exact: true })}</dd>
              </div>
            </dl>
          ) : (
            <p style={{ margin: 0, color: "var(--muted)" }}>No ceiling to show yet.</p>
          )}
        </div>
      </div>
      {alone.length > 1 && (
        <table className="ct num" style={{ marginTop: 24 }}>
          <caption className="sr-only">The ceiling each target allows on its own</caption>
          <thead>
            <tr>
              <th scope="col">Each target on its own</th>
              <th scope="col">Highest price</th>
            </tr>
          </thead>
          <tbody>
            {alone.map((a) => {
              const binding = !!feasible?.limitingConstraints.includes(a.key);
              return (
                <tr key={a.key} className={binding ? "s" : ""}>
                  <th scope="row">
                    {targetText(a.key, constraints)}
                    {binding ? " (binding)" : ""}
                  </th>
                  <td className={a.result.status === "infeasible" ? "neg" : ""}>{aloneText(a.result)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="note" style={{ marginTop: 24 }}>
        Each price we test recalculates the loan, down payment and percentage closing costs. Rent, property tax and insurance stay at your inputs. The IRR target uses the projection above, before income tax. This is a modeling result under your assumptions, not an appraisal or advice.
      </p>
    </div>
  );
}
