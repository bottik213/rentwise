"use client";
import { YearChart } from "@/components/charts/YearChart";
import { FIELDS, GROUPS, closingDef, type FieldDef } from "@/components/forms/fields";
import { SOURCE_LABEL } from "@/components/forms/NumberField";
import { Badge } from "@/components/Icons";
import { Waterfall } from "@/components/results/Metrics";
import { Sensitivity } from "@/components/results/Sensitivity";
import { ceilingByConstraint, offerCeiling } from "@/lib/finance/offer-ceiling";
import { DEFAULT_PROJECTION, growthDeltas, projectScenarios } from "@/lib/finance/projection";
import { runScenarios } from "@/lib/finance/scenarios";
import { sensitivity } from "@/lib/finance/sensitivity";
import { CONSTRAINT_KEYS, type OfferConstraints, type PropertyInputs, type ScenarioAdjustments, type ScenarioName } from "@/lib/finance/types";
import { pct, usd } from "@/lib/format";
import type { Stored } from "@/lib/storage";
import { ceilingReason, targetText, verdict } from "@/lib/verdict";

export interface ReportData {
  inputs: PropertyInputs;
  isExample: boolean;
  scenarios: Record<ScenarioName, ScenarioAdjustments>;
  constraints: OfferConstraints;
  branding?: Stored["branding"];
}

const COLS: [ScenarioName, string][] = [
  ["conservative", "Conservative"],
  ["base", "Base"],
  ["optimistic", "Optimistic"],
];
const whole = (v: number) => usd(Math.round(v));
const exact = (v: number) => usd(Math.round(v), { exact: true });
const num = (v: number) => Number(v.toFixed(2));
const signed = (v: number, unit: string) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${num(Math.abs(v * 100))}${unit}`;

function fieldValue(def: Pick<FieldDef, "kind" | "suffix">, v: number): string {
  if (def.kind === "money") return `${usd(v)}${def.suffix ?? ""}`;
  if (def.kind === "rate") return `${num(v * 100)}${def.suffix ?? "%"}`; // rate suffixes start with "%": "5% of rent"
  return `${v} ${def.suffix ?? ""}`.trim();
}

function adjustments(a: ScenarioAdjustments, name: ScenarioName): string {
  const g = growthDeltas(name, a);
  const parts = [
    a.rentChangePct && `rent ${signed(a.rentChangePct, "%")}`,
    a.vacancyPts && `vacancy ${signed(a.vacancyPts, " pts")}`,
    a.maintenancePts && `maintenance ${signed(a.maintenancePts, " pts")}`,
    a.capexPts && `CapEx ${signed(a.capexPts, " pts")}`,
    a.fixedCostChangePct && `fixed costs ${signed(a.fixedCostChangePct, "%")}`,
    g.rentGrowthPts && `rent growth ${signed(g.rentGrowthPts, " pts/yr")}`,
    g.expenseGrowthPts && `expense growth ${signed(g.expenseGrowthPts, " pts/yr")}`,
    g.valueGrowthPts && `value growth ${signed(g.valueGrowthPts, " pts/yr")}`,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "your inputs, unchanged";
}

/** The full investment report, read-only. Everything is recalculated from the inputs by the same engine. */
export function Report({ data, generated }: { data: ReportData; generated: Date }) {
  const { inputs: p, scenarios, constraints: c, branding: b } = data;
  const sc = runScenarios(p, scenarios);
  const u = sc.base;
  const proj = projectScenarios(p, scenarios);
  const pr = proj.base;
  const v = verdict(u, c, p.monthlyRent);
  const ceiling = offerCeiling(p, c, scenarios.conservative);
  const alone = ceilingByConstraint(p, c, scenarios.conservative);
  const reason = ceilingReason(ceiling, alone, c);
  const a = p.projection ?? DEFAULT_PROJECTION;
  const N = pr.years.length;
  const name = (data.isExample ? p.nickname?.replace(/\s*\(synthetic\)$/i, "") : p.nickname) || "Property";
  const by = [b?.name, b?.company].filter(Boolean).join(", ");

  const rows: [string, string, string][] = [];
  for (const g of GROUPS) {
    if (g.title === "Loan" && p.allCash) rows.push(["Financing", "All-cash purchase (no mortgage)", "—"]);
    for (const k of g.keys) {
      if (p.allCash && (k === "downPaymentPct" || k === "annualInterestRate" || k === "loanTermYears")) continue;
      const f = FIELDS[k];
      rows.push([f.label, fieldValue(f, p[k]), f.source ? SOURCE_LABEL[p.sources?.[k] ?? "estimate"] : "Not labeled"]);
      if (k === "purchasePrice") rows.push(["Closing costs", fieldValue(closingDef(p.closingCostMode !== "amount"), p.closingCostValue), "Not labeled"]);
    }
  }
  rows.push(
    ["Hold period", `${a.holdYears} years`, "Assumption"],
    ["Rent growth", `${num(a.rentGrowth * 100)}%/yr`, "Assumption"],
    ["Expense growth", `${num(a.expenseGrowth * 100)}%/yr`, "Assumption"],
    ["Value growth", `${num(a.valueGrowth * 100)}%/yr`, "Assumption"],
    ["Selling costs", `${num(a.sellingCostPct * 100)}% of sale`, "Assumption"],
  );

  return (
    <article className="rpt">
      <header className="rh">
        <div className="brand">
          {b?.logo && (
            // eslint-disable-next-line @next/next/no-img-element -- a local data URL; next/image adds nothing here
            <img src={b.logo} alt={`${b.company || b.name || "Company"} logo`} />
          )}
          <div>
            {by ? <b>{by}</b> : <b>RentWise</b>}
            {b?.contact && <span>{b.contact}</span>}
          </div>
        </div>
        <div className="ttl">
          <h1 className="disp">{name}</h1>
          <p className="num">
            Investment report · Asking {usd(p.purchasePrice)} · Rent {usd(p.monthlyRent)}/mo · Prepared {generated.toLocaleDateString("en-US", { dateStyle: "medium" })}
            {data.isExample && <> · <span className="tag">Synthetic example</span></>}
          </p>
        </div>
      </header>

      <section className="verdict" aria-labelledby="r-v">
        <div className="vrow">
          <span className="lbl" id="r-v">The short version</span>
          <Badge st={v.st} label={v.label} knock="#fff" />
        </div>
        <p className="big num">{v.text}</p>
        <p className="fine">Compared with the investor&apos;s own targets, not a judgment of the deal.</p>
      </section>

      <section aria-labelledby="r-k">
        <div className="shead"><h2 className="disp" id="r-k">Key numbers</h2></div>
        <div className="card">
          <dl className="ocs rgrid num">
            <div><dt>Cash flow after reserves</dt><dd className={u.reserveAdjustedCashFlow < 0 ? "neg" : ""}>{exact(u.reserveAdjustedCashFlow)}/mo</dd></div>
            <div><dt>Cash-on-cash</dt><dd>{pct(u.cashOnCash)}</dd></div>
            <div><dt>Cap rate</dt><dd>{pct(u.capRate)}</dd></div>
            <div><dt>Net operating income</dt><dd>{exact(u.noi)}/mo</dd></div>
            <div><dt>Break-even rent</dt><dd>{u.breakEvenRent === null ? "Not reachable" : `${usd(u.breakEvenRent)}/mo`}</dd></div>
            <div><dt>DSCR</dt><dd>{u.monthlyPI > 0 ? `${(u.noi / u.monthlyPI).toFixed(2)}×` : "No mortgage"}</dd></div>
            <div><dt>Monthly P&amp;I</dt><dd>{exact(u.monthlyPI)}</dd></div>
            <div><dt>Total cash invested</dt><dd>{usd(u.cashInvested)}</dd></div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="r-w">
        <div className="shead"><h2 className="disp" id="r-w">Where the rent goes</h2></div>
        <div className="card"><Waterfall u={u} cfStatus={v.st} /></div>
      </section>

      <section aria-labelledby="r-a">
        <div className="shead">
          <h2 className="disp" id="r-a">Assumptions and where they came from</h2>
          <p>Every input behind this report. &ldquo;Estimate&rdquo; means nobody has checked it against a listing, bill, quote or document yet.</p>
        </div>
        <div className="card">
          <table className="ct num">
            <caption className="sr-only">Assumptions with their source labels</caption>
            <thead><tr><th scope="col">Assumption</th><th scope="col">Value</th><th scope="col">Source</th></tr></thead>
            <tbody>
              {rows.map(([label, value, src]) => (
                <tr key={label}><th scope="row">{label}</th><td>{value}</td><td className={src === "Estimate" ? "est" : "mut"}>{src}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="r-s">
        <div className="shead"><h2 className="disp" id="r-s">Scenarios</h2><p>The same property under a tougher and an easier set of assumptions. Illustrative, not forecasts.</p></div>
        <div className="card">
          <table className="ct num">
            <caption className="sr-only">Results by scenario</caption>
            <thead><tr><th scope="col">Result</th>{COLS.map(([k, l]) => <th key={k} scope="col">{l}</th>)}</tr></thead>
            <tbody>
              <tr><th scope="row">Cash flow after reserves</th>{COLS.map(([k]) => <td key={k} className={sc[k].reserveAdjustedCashFlow < 0 ? "neg" : ""}>{exact(sc[k].reserveAdjustedCashFlow)}/mo</td>)}</tr>
              <tr><th scope="row">Cash-on-cash</th>{COLS.map(([k]) => <td key={k}>{pct(sc[k].cashOnCash)}</td>)}</tr>
              <tr><th scope="row">NOI</th>{COLS.map(([k]) => <td key={k}>{exact(sc[k].noi)}/mo</td>)}</tr>
              <tr><th scope="row">IRR over {N} years</th>{COLS.map(([k]) => <td key={k}>{proj[k].irr.ok ? pct(proj[k].irr.rate) : "n/a"}</td>)}</tr>
            </tbody>
          </table>
          <ul className="adjl">
            {COLS.filter(([k]) => k !== "base").map(([k, l]) => <li key={k}><b>{l}:</b> {adjustments(scenarios[k], k)}.</li>)}
          </ul>
        </div>
      </section>

      <section aria-labelledby="r-se">
        <div className="shead"><h2 className="disp" id="r-se">What moves cash flow most</h2><p>Each change on its own, in dollars of yearly cash flow.</p></div>
        <Sensitivity rows={sensitivity(p)} />
      </section>

      <section aria-labelledby="r-o">
        <div className="shead"><h2 className="disp" id="r-o">Offer ceiling</h2><p>The highest price that still meets every target set. A walk-away price under these assumptions, not a recommendation or an appraisal.</p></div>
        <div className="card">
          {ceiling.status === "no-constraints" && <p className="m0">No targets were set.</p>}
          {ceiling.status === "infeasible" && (
            <p className="m0"><b className="neg">No price works.</b> The {ceiling.failingConstraints.map((k) => targetText(k, c)).join(" and ")} target fails{ceiling.failingScenario === "conservative" ? " in the conservative scenario" : ""}.</p>
          )}
          {ceiling.status === "feasible" && ceiling.hitSearchBound && <p className="m0">Not limited by the targets: every price up to {usd(ceiling.price)} meets them.</p>}
          {ceiling.status === "feasible" && !ceiling.hitSearchBound && (
            <>
              <p className="big num m0">
                {usd(ceiling.price)} <span className={ceiling.deltaFromAsking < 0 ? "neg" : "pos"}>{usd(ceiling.deltaFromAsking, { signed: true })}</span> <small>vs. asking {usd(p.purchasePrice)}</small>
              </p>
              {reason && <p className="m0" style={{ marginTop: 8 }}>{reason}</p>}
            </>
          )}
          {CONSTRAINT_KEYS.some((k) => c[k] !== undefined) && (
            <p className="note" style={{ marginTop: 12 }}>
              Targets: {CONSTRAINT_KEYS.filter((k) => c[k] !== undefined).map((k) => targetText(k, c)).join(" · ")}
              {c.mustPassConservative ? " · must also pass the conservative scenario" : ""}. Rent, property tax and insurance are held at the inputs as the price changes.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="r-p">
        <div className="shead"><h2 className="disp" id="r-p">Over {N} years</h2><p>Base scenario, before income tax. Growth rates are assumptions, not predictions.</p></div>
        <div className="pjg">
          <YearChart title="Cash flow each year" legend="Projected cash flow after reserves" values={pr.years.map((y) => y.cashFlow)} />
          <YearChart title="Equity each year" legend="Projected value minus loan balance" values={pr.years.map((y) => y.equity)} />
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <dl className="ocs rgrid num">
            <div><dt>IRR</dt><dd>{pr.irr.ok ? pct(pr.irr.rate) : "n/a"}</dd></div>
            <div><dt>Equity multiple</dt><dd>{pr.equityMultiple === null ? "n/a" : `${pr.equityMultiple.toFixed(2)}×`}</dd></div>
            <div><dt>Total profit</dt><dd className={pr.totalProfit < 0 ? "neg" : ""}>{whole(pr.totalProfit)}</dd></div>
            <div><dt>Net sale proceeds</dt><dd>{whole(pr.netSaleProceeds)}</dd></div>
            <div><dt>Sale price, year {N}</dt><dd>{whole(pr.salePrice)}</dd></div>
            <div><dt>Selling costs</dt><dd>−{whole(pr.sellingCosts)}</dd></div>
            <div><dt>Loan payoff</dt><dd>−{whole(pr.loanPayoff)}</dd></div>
            <div><dt>Initial reserve back</dt><dd>+{whole(pr.reserveReturned)}</dd></div>
          </dl>
          <table className="ct num" style={{ marginTop: 16 }}>
            <caption className="sr-only">Projection by year, base scenario</caption>
            <thead><tr><th scope="col">Year</th><th scope="col">NOI</th><th scope="col">Mortgage</th><th scope="col">Cash flow</th><th scope="col">Equity</th><th scope="col">CoC</th></tr></thead>
            <tbody>
              {pr.years.map((y) => (
                <tr key={y.year}>
                  <th scope="row">{y.year}</th>
                  <td>{whole(y.noi)}</td>
                  <td>{whole(y.debtService)}</td>
                  <td className={y.cashFlow < 0 ? "neg" : ""}>{whole(y.cashFlow)}</td>
                  <td>{whole(y.equity)}</td>
                  <td>{pct(y.cashOnCash, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note" style={{ marginTop: 12 }}>The CapEx reserve is treated as spent each year. The initial cash reserve is returned at the sale. Whole dollars.</p>
        </div>
      </section>

      <footer className="disc" role="note">
        <b>Important.</b> This report is a modeling result under the assumptions listed above, made with RentWise. It is not financial, investment, tax, legal or mortgage advice, and not an appraisal. Nothing in it is guaranteed. Results are before income tax, and projections are not predictions. Check every estimate with a lender, an insurer, a local property manager and your own advisers before you decide.
      </footer>
    </article>
  );
}
