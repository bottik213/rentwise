"use client";
import { useState } from "react";
import { Chevron } from "@/components/Icons";
import { YearChart } from "@/components/charts/YearChart";
import { NumberField } from "@/components/forms/NumberField";
import type { FieldDef } from "@/components/forms/fields";
import { DEFAULT_PROJECTION, projectScenarios } from "@/lib/finance/projection";
import type { ProjectionAssumptions, PropertyInputs, ScenarioAdjustments, ScenarioName } from "@/lib/finance/types";
import { pct, usd } from "@/lib/format";
import { setAppState } from "@/lib/storage";
import { MetricCard } from "./MetricCard";

type Def = Pick<FieldDef, "label" | "kind" | "suffix" | "help" | "min" | "max">;
const DEFS: [keyof ProjectionAssumptions, Def][] = [
  ["holdYears", { label: "Hold period", kind: "years", suffix: "years", help: "How long you plan to own it. The projection sells at the end of the last year.", min: 1, max: 30 }],
  ["rentGrowth", { label: "Rent growth", kind: "rate", suffix: "%/yr", help: "How much rent and other income rise each year, from year 2. An assumption, not a prediction.", min: -20, max: 20 }],
  ["expenseGrowth", { label: "Expense growth", kind: "rate", suffix: "%/yr", help: "How much tax, insurance, HOA, utilities and other fixed costs rise each year. Maintenance, management and the CapEx reserve follow rent.", min: -20, max: 20 }],
  ["valueGrowth", { label: "Value growth", kind: "rate", suffix: "%/yr", help: "How much the property's value changes each year. An assumption, not a prediction: values can fall.", min: -20, max: 20 }],
  ["sellingCostPct", { label: "Selling costs", kind: "rate", suffix: "% of sale", help: "Agent commission, transfer tax and closing costs when you sell. 6 to 8% is common.", min: 0, max: 20 }],
];
const COLS: [ScenarioName, string][] = [
  ["conservative", "Conservative"],
  ["base", "Base"],
  ["optimistic", "Optimistic"],
];
const IRR_REASON = { "no-investment": "No cash invested, so there is no return to measure.", "no-sign-change": "The money never comes back, so there is no rate of return.", "no-convergence": "No single rate fits these cash flows." };

const whole = (v: number) => usd(Math.round(v));
const rate = (v: number) => pct(v);
const times = (v: number) => `${v.toFixed(2)}×`;

export function Projection({ property: p, scenarios }: { property: PropertyInputs; scenarios: Record<ScenarioName, ScenarioAdjustments> }) {
  const [name, setName] = useState<ScenarioName>("base");
  const a = p.projection ?? DEFAULT_PROJECTION;
  const r = projectScenarios(p, scenarios)[name];
  const N = r.years.length;
  const setA = (patch: Partial<ProjectionAssumptions>) =>
    setAppState((x) => (x.property ? { ...x, property: { ...x.property, projection: { ...(x.property.projection ?? DEFAULT_PROJECTION), ...patch } } } : x));

  return (
    <div className="pj">
      <div className="card">
        <p style={{ margin: "0 0 12px", fontWeight: 600 }}>Projection assumptions</p>
        <div className="pjf">
          {DEFS.map(([k, def]) => (
            <NumberField key={k} def={def} value={a[k]} onCommit={(v) => setA({ [k]: v })} />
          ))}
        </div>
        <p className="note" style={{ margin: "16px 0 0" }}>
          Illustrative assumptions, not predictions. Change them to match what you expect. Each scenario also moves these growth rates; change how much in the scenario section above.
        </p>
      </div>

      <div className="pjh">
        <span className="seg" role="group" aria-label="Projection scenario">
          {COLS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={name === k} onClick={() => setName(k)}>
              {label}
            </button>
          ))}
        </span>
        <span className="num" style={{ color: "var(--ink-2)", fontSize: 14 }}>
          Rent {pct(r.assumptions.rentGrowth, 1)}/yr · costs {pct(r.assumptions.expenseGrowth, 1)}/yr · value {pct(r.assumptions.valueGrowth, 1)}/yr
        </span>
      </div>

      <div className="sgrid">
        <MetricCard id="pirr" small title={`IRR over ${N} year${N === 1 ? "" : "s"}`} value={r.irr.ok ? r.irr.rate : null} format={rate} offText="n/a" negative={r.irr.ok && r.irr.rate < 0}>
          <p><b>What it means:</b> the yearly return on your cash once every year&apos;s cash flow and the sale are counted, with timing taken into account.</p>
          {!r.irr.ok && <p><b>Why n/a:</b> {IRR_REASON[r.irr.reason]}</p>}
          <p><b>How it&apos;s worked out:</b> the rate that makes today&apos;s cash invested equal to the yearly cash flows plus the net sale proceeds. Before income tax.</p>
        </MetricCard>
        <MetricCard id="pem" small title="Equity multiple" value={r.equityMultiple} format={times} offText="n/a">
          <p><b>What it means:</b> how many times your cash comes back over the hold. 2.00× means you end with twice what you put in.</p>
          <p><b>How it&apos;s worked out:</b> (all yearly cash flow + net sale proceeds) ÷ cash invested.</p>
        </MetricCard>
        <MetricCard id="pprofit" small title="Total profit" value={r.totalProfit} format={whole} negative={r.totalProfit < 0}>
          <p><b>What it means:</b> everything you get back minus everything you put in, before income tax.</p>
          <p><b>How it&apos;s worked out:</b> yearly cash flow + net sale proceeds − cash invested.</p>
        </MetricCard>
        <MetricCard id="pnet" small title="Net sale proceeds" value={r.netSaleProceeds} format={whole} negative={r.netSaleProceeds < 0}>
          <p><b>What it means:</b> the cash you would walk away with at the sale in year {N}.</p>
          <p><b>How it&apos;s worked out:</b> sale price − selling costs − loan payoff + your initial cash reserve.</p>
        </MetricCard>
      </div>

      <div className="pjg">
        <YearChart title="Cash flow each year" legend="Projected cash flow after reserves" values={r.years.map((y) => y.cashFlow)} />
        <YearChart title="Your equity each year" legend="Projected value minus loan balance" values={r.years.map((y) => y.equity)} />
      </div>

      <div className="card">
        <p style={{ margin: "0 0 12px", fontWeight: 600 }}>If you sell at the end of year {N}</p>
        <dl className="ocs pjx num">
          <div><dt>Sale price</dt><dd>{whole(r.salePrice)}</dd></div>
          <div><dt>Selling costs</dt><dd>−{whole(r.sellingCosts)}</dd></div>
          <div><dt>Loan payoff</dt><dd>−{whole(r.loanPayoff)}</dd></div>
          <div><dt>Initial reserve back</dt><dd>+{whole(r.reserveReturned)}</dd></div>
          <div><dt>Net sale proceeds</dt><dd className={r.netSaleProceeds < 0 ? "neg" : ""}>{whole(r.netSaleProceeds)}</dd></div>
          <div><dt>Cash flow, all years</dt><dd className={r.totalCashFlow < 0 ? "neg" : ""}>{whole(r.totalCashFlow)}</dd></div>
          <div><dt>Cash invested</dt><dd>−{whole(r.cashInvested)}</dd></div>
          <div><dt>Total profit</dt><dd className={r.totalProfit < 0 ? "neg" : "pos"}>{usd(Math.round(r.totalProfit), { signed: true })}</dd></div>
        </dl>
        <details className="x" style={{ marginTop: 16 }}>
          <summary>
            <Chevron />
            Year-by-year table
          </summary>
          <div className="xb">
            <table className="ct num pjt">
              <caption className="sr-only">Projection by year, {COLS.find(([k]) => k === name)![1].toLowerCase()} scenario, before income tax</caption>
              <thead>
                <tr>
                  <th scope="col">Year</th>
                  <th scope="col" className="opt">Rent</th>
                  <th scope="col" className="opt">Income</th>
                  <th scope="col" className="opt">Costs</th>
                  <th scope="col">NOI</th>
                  <th scope="col" className="opt">Mortgage</th>
                  <th scope="col" className="opt">CapEx</th>
                  <th scope="col">Cash flow</th>
                  <th scope="col" className="opt">Cumulative</th>
                  <th scope="col" className="opt">Loan</th>
                  <th scope="col" className="opt">Value</th>
                  <th scope="col">Equity</th>
                  <th scope="col">CoC</th>
                </tr>
              </thead>
              <tbody>
                {r.years.map((y) => (
                  <tr key={y.year}>
                    <th scope="row">{y.year}</th>
                    <td className="opt">{whole(y.grossRent)}</td>
                    <td className="opt">{whole(y.effectiveIncome)}</td>
                    <td className="opt">{whole(y.operatingExpenses)}</td>
                    <td className={y.noi < 0 ? "neg" : ""}>{whole(y.noi)}</td>
                    <td className="opt">{whole(y.debtService)}</td>
                    <td className="opt">{whole(y.capexReserve)}</td>
                    <td className={y.cashFlow < 0 ? "neg" : ""}>{whole(y.cashFlow)}</td>
                    <td className={`opt ${y.cumulativeCashFlow < 0 ? "neg" : ""}`}>{whole(y.cumulativeCashFlow)}</td>
                    <td className="opt">{whole(y.loanBalance)}</td>
                    <td className="opt">{whole(y.value)}</td>
                    <td>{whole(y.equity)}</td>
                    <td>{pct(y.cashOnCash, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <p className="note" style={{ margin: "16px 0 0" }}>
          Before income tax. The CapEx reserve is treated as spent each year, which is the conservative choice. Your initial cash reserve comes back to you at the sale: it is still your money. Money is shown in whole dollars.
        </p>
      </div>
    </div>
  );
}
