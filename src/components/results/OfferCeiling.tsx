"use client";
import { NumberField } from "@/components/forms/NumberField";
import type { FieldDef } from "@/components/forms/fields";
import { offerCeiling } from "@/lib/finance/offer-ceiling";
import type { ConstraintKey, OfferConstraints, PropertyInputs, ScenarioAdjustments } from "@/lib/finance/types";
import { pct, usd } from "@/lib/format";
import { setAppState } from "@/lib/storage";
import { AnimatedNumber } from "./AnimatedNumber";

type Def = Pick<FieldDef, "label" | "kind" | "suffix" | "help" | "min" | "max">;
const CONSTRAINT_LABEL: Record<ConstraintKey, string> = {
  minMonthlyCashFlow: "minimum cash flow",
  minCashOnCash: "minimum cash-on-cash",
  maxUpfrontCash: "maximum upfront cash",
};
const ROWS: [ConstraintKey, Def, number][] = [
  ["minMonthlyCashFlow", { label: "Min. cash flow after reserves", kind: "money", suffix: "/mo", help: "", min: -100_000, max: 1_000_000 }, 20_000],
  // Floor at 0: the price search assumes a higher price never helps, which a negative target can break.
  ["minCashOnCash", { label: "Min. cash-on-cash", kind: "rate", suffix: "%/yr", help: "", min: 0, max: 100 }, 0.08],
  ["maxUpfrontCash", { label: "Max. upfront cash", kind: "money", help: "", min: 0, max: 100_000_000 }, 10_000_000],
];

export function OfferCeiling({ property, constraints, conservative }: { property: PropertyInputs; constraints: OfferConstraints; conservative: ScenarioAdjustments }) {
  const r = offerCeiling(property, constraints, conservative);
  const setC = (patch: Partial<OfferConstraints>) =>
    setAppState((x) => {
      const next = { ...x.constraints, ...patch };
      for (const k of Object.keys(patch) as (keyof OfferConstraints)[]) if (patch[k] === undefined) delete next[k];
      return { ...x, constraints: next };
    });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 text-sm text-muted">Your targets. Turn on any combination.</legend>
        {ROWS.map(([key, def, initial]) => {
          const on = constraints[key] !== undefined;
          return (
            <div key={key} className="flex items-start gap-3">
              <input
                type="checkbox"
                aria-label={`Use ${def.label}`}
                checked={on}
                onChange={(e) => setC({ [key]: e.target.checked ? initial : undefined })}
                className="mt-1 size-4 accent-ink"
              />
              <div className="flex-1">
                <NumberField def={def} value={constraints[key]} disabled={!on} onCommit={(v) => setC({ [key]: v })} compact />
              </div>
            </div>
          );
        })}
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={!!constraints.mustPassConservative}
            onChange={(e) => setC({ mustPassConservative: e.target.checked || undefined })}
            className="size-4 accent-ink"
          />
          Must also pass the conservative scenario
        </label>
      </fieldset>

      <div aria-live="polite" className="rounded-md bg-surface p-6">
        {/* Remount on state change so the new state fades in; price changes within "feasible" tween instead. */}
        <div key={r.status === "feasible" ? `f-${r.hitSearchBound}` : r.status} className="enter">
        {r.status === "no-constraints" && <p className="text-muted">Turn on at least one target to find an offer ceiling.</p>}

        {r.status === "infeasible" && (
          <>
            <p className="text-sm text-muted">Offer ceiling under your assumptions</p>
            <p className="mt-2 text-2xl font-medium tracking-tight text-bad">No price works</p>
            <p className="mt-3 text-sm leading-relaxed">
              Even at $1, the {list(r.failingConstraints)} target fails
              {r.failingScenario === "conservative" ? " in the conservative scenario" : ""}. Loosen a target, or revisit
              rent, costs and financing.
            </p>
          </>
        )}

        {r.status === "feasible" && r.hitSearchBound && (
          <>
            <p className="text-sm text-muted">Offer ceiling under your assumptions</p>
            <p className="mt-2 text-2xl font-medium tracking-tight">Not limited by your targets</p>
            <p className="mt-3 text-sm leading-relaxed">
              Every price up to {usd(r.price)} (the search limit) meets them. Add or tighten a target to get a ceiling.
            </p>
          </>
        )}

        {r.status === "feasible" && !r.hitSearchBound && (
          <>
            <p className="text-sm text-muted">Offer ceiling under your assumptions</p>
            <p className="mt-2 text-4xl font-medium tracking-tight">
              <AnimatedNumber value={r.price} format={(v) => usd(Math.round(v))} />
            </p>
            <p className="num mt-1 text-sm">
              <span className={r.deltaFromAsking < 0 ? "text-bad" : "text-good"}>{usd(r.deltaFromAsking, { signed: true })}</span>
              <span className="text-muted"> vs. asking {usd(property.purchasePrice)}</span>
            </p>
            <p className="mt-4 text-sm">
              Limited by <strong className="font-medium">{list(r.limitingConstraints)}</strong>
              {r.limitingScenario === "conservative" ? " in the conservative scenario" : ""}.
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm">
              <Stat label="Cash flow after reserves" value={`${usd(r.metrics.reserveAdjustedCashFlow, { exact: true })}/mo`} />
              <Stat label="Cash-on-cash" value={pct(r.metrics.cashOnCash)} />
              <Stat label="Cash invested" value={usd(r.metrics.cashInvested)} />
              <Stat label="Monthly P&I" value={usd(r.metrics.monthlyPI, { exact: true })} />
            </dl>
          </>
        )}
        </div>

        <p className="mt-6 text-xs leading-relaxed text-muted">
          Each candidate price recomputes the loan, down payment and percentage closing costs. Rent, property tax and
          insurance are held at your inputs. A modeling result, not an appraisal or a recommendation to buy.
        </p>
      </div>
    </div>
  );
}

const list = (keys: ConstraintKey[]) => keys.map((k) => CONSTRAINT_LABEL[k]).join(" and ");

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="num mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
