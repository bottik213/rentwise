"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import duplex from "@/assets/photos/duplex-hinesburg.jpg";
import { PageFooter } from "@/components/DataControls";
import { Arrow, Badge, Logo } from "@/components/Icons";
import { TryExampleButton } from "@/components/TryExampleButton";
import { FIELDS, GROUPS, closingDef } from "@/components/forms/fields";
import { NumberField } from "@/components/forms/NumberField";
import { MetricCard } from "@/components/results/MetricCard";
import { Waterfall } from "@/components/results/Metrics";
import { OfferCeiling } from "@/components/results/OfferCeiling";
import { Projection } from "@/components/results/Projection";
import { PageSkeleton } from "@/components/results/PageSkeleton";
import { Scenarios } from "@/components/results/Scenarios";
import { NextSteps, Sensitivity } from "@/components/results/Sensitivity";
import { ceilingByConstraint, offerCeiling } from "@/lib/finance/offer-ceiling";
import { runScenarios } from "@/lib/finance/scenarios";
import { sensitivity } from "@/lib/finance/sensitivity";
import type { AssumptionSource, PropertyInputs } from "@/lib/finance/types";
import { pct, usd } from "@/lib/format";
import { setAppState, useAppState } from "@/lib/storage";
import { breakEvenBadge, cashFlowBadge, cashOnCashBadge, ceilingBadge, cushion, verdict } from "@/lib/verdict";
import "./results.css";

const exact = (v: number) => usd(Math.round(v), { exact: true });
const whole = (v: number) => usd(Math.round(v));
const rate = (v: number) => pct(v);
const dExact = (d: number) => usd(Math.round(d), { exact: true, signed: true });
const dWhole = (d: number) => usd(Math.round(d), { signed: true });
const dPts = (d: number) => `${d > 0 ? "+" : "−"}${Math.abs(d * 100).toFixed(2)} pts`;
const isFinancing = (k: string) => k === "downPaymentPct" || k === "annualInterestRate" || k === "loanTermYears";

/** The example's stored nickname keeps "(synthetic)" for exports; the tag already says so on screen. */
const displayName = (p: PropertyInputs, isExample: boolean) => (isExample ? p.nickname?.replace(/\s*\(synthetic\)$/i, "") : p.nickname) || "Your property";

export default function ResultsPage() {
  const s = useAppState();
  const router = useRouter();
  const quickForm = useRef<HTMLFormElement>(null);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    if (!sheet) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [sheet]);

  if (!s) return <PageSkeleton />;
  const p = s.property;

  if (!p) {
    return (
      <div className="pg-results" style={{ height: "auto" }}>
        <div className="empty">
          {s.deals.length ? (
            <>
              <h1 className="disp">No property open</h1>
              <p>
                You have {s.deals.length} saved propert{s.deals.length === 1 ? "y" : "ies"}. Open one to see its analysis, or start a new one.
              </p>
              <div className="ctas">
                <Link href="/compare" className="btn btn-primary">
                  Your properties <Arrow />
                </Link>
                <Link href="/analyze" className="btn btn-quiet">
                  Analyze a new property
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="disp">No property to analyze yet</h1>
              <p>Enter your own numbers, or load the synthetic example to see the full workflow.</p>
              <div className="ctas">
                <Link href="/analyze" className="btn btn-primary">
                  Analyze a property <Arrow />
                </Link>
                <TryExampleButton className="btn btn-quiet" />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const results = runScenarios(p, s.scenarios);
  const u = results.base; // headline = base column, so they can never disagree
  const ceiling = offerCeiling(p, s.constraints, s.scenarios.conservative);
  const alone = ceilingByConstraint(p, s.constraints, s.scenarios.conservative);
  const rows = sensitivity(p);
  const v = verdict(u, s.constraints, p.monthlyRent);
  const cush = cushion(u, p.monthlyRent);
  const ceilingValue = ceiling.status === "feasible" && !ceiling.hitSearchBound ? ceiling.price : null;
  const ceilingOff = ceiling.status === "infeasible" ? "None" : ceiling.status === "feasible" ? "Not limited" : "Off";

  const setProp = (patch: Partial<PropertyInputs>) => setAppState((x) => (x.property ? { ...x, property: { ...x.property, ...patch } } : x));
  const setSource = (k: keyof PropertyInputs, src: AssumptionSource) =>
    setAppState((x) => (x.property ? { ...x, property: { ...x.property, sources: { ...x.property.sources, [k]: src } } } : x));

  const markOwned = () => {
    const form = quickForm.current;
    if (form && !form.checkValidity()) {
      // On a phone the fields live in the closed sheet; open it first so the browser can focus the bad one.
      if (matchMedia("(max-width: 899px)").matches) flushSync(() => setSheet(true));
      form.reportValidity();
      return;
    }
    if (s.plan && s.actuals.length && !confirm(`Lock these inputs as the new plan? Your ${s.actuals.length} recorded month(s) will be compared against them.`)) return;
    const accepted = setAppState((x) => ({ ...x, plan: { inputs: x.property!, lockedAt: new Date().toISOString() } }));
    if (accepted) router.push("/performance");
  };

  const field = (k: keyof typeof FIELDS) => (
    <NumberField
      key={k}
      def={FIELDS[k]}
      value={p[k]}
      disabled={p.allCash && isFinancing(k)}
      onCommit={(val) => setProp({ [k]: val })}
      source={FIELDS[k].source ? p.sources?.[k] : undefined}
      onSource={FIELDS[k].source ? (src) => setSource(k, src) : undefined}
    />
  );

  const cf = u.reserveAdjustedCashFlow;
  const askTxt = usd(p.purchasePrice);
  const ceilCtx =
    ceiling.status === "no-constraints"
      ? "Turn on a target to see it."
      : ceiling.status === "infeasible"
        ? "No price meets every target you turned on."
        : ceiling.hitSearchBound
          ? "Your targets don't limit the price."
          : `${ceiling.deltaFromAsking >= 0 ? `${usd(ceiling.deltaFromAsking)} above` : `${usd(-ceiling.deltaFromAsking)} below`} the ${askTxt} asking price.`;

  return (
    <div className="pg-results">
      <div className="prop">
        {s.isExample ? (
          <Image className="thumb" src={duplex} alt="Two-story side-by-side duplex with a shared front porch on a quiet residential street" width={56} height={56} />
        ) : (
          <span className="thumb" aria-hidden>
            <Logo />
          </span>
        )}
        <div className="ttl">
          <h1 className="disp">{displayName(p, s.isExample)}</h1>
          <p className="num">
            Asking {askTxt} · Rent {usd(p.monthlyRent)}/mo{s.isExample && <> · <span className="tag">Synthetic example</span></>}
          </p>
        </div>
        <div className="acts">
          <Link href="/analyze" className="btn btn-quiet btn-sm">
            All inputs
          </Link>
          <button type="button" onClick={markOwned} className="btn btn-primary btn-sm">
            {s.plan ? "Re-lock plan and track actuals" : "Mark as owned"} <Arrow />
          </button>
        </div>
      </div>

      <div className="split">
        <aside className={`aside scroll ${sheet ? "open" : ""}`} aria-label="Quick assumptions">
          <div className="shandle">
            <strong>Quick assumptions</strong>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setSheet(false)}>
              Done
            </button>
          </div>
          <h2 className="disp">Quick assumptions</h2>
          <p className="sub">Change any number. The results update as you type.</p>
          <form ref={quickForm} noValidate onSubmit={(e) => e.preventDefault()}>
            {GROUPS.map((g) => (
              <fieldset key={g.title} className="grp">
                <legend>{g.title}</legend>
                {g.title === "Loan" && (
                  <label className="chk">
                    <input type="checkbox" checked={p.allCash} onChange={(e) => setProp({ allCash: e.target.checked })} />
                    All-cash purchase (no mortgage)
                  </label>
                )}
                {g.keys.map((k) => (
                  <div key={k} style={{ display: "contents" }}>
                    {field(k)}
                    {k === "purchasePrice" && (
                      <NumberField
                        key={p.closingCostMode}
                        def={closingDef(p.closingCostMode !== "amount")}
                        value={p.closingCostValue}
                        onCommit={(val) => setProp({ closingCostValue: val })}
                      />
                    )}
                  </div>
                ))}
              </fieldset>
            ))}
          </form>
        </aside>

        <div className="mainp scroll">
          <div className="mi">
            <section className="verdict" aria-labelledby="v-h">
              <div className="vrow">
                <span className="lbl" id="v-h">
                  The short version
                </span>
                <Badge st={v.st} label={v.label} knock="#fff" />
              </div>
              <p className="big num" aria-live="polite">
                {v.text}
              </p>
              <p className="fine">Compared with your own targets, not a judgment of the deal. RentWise is a modeling tool, not financial advice.</p>
            </section>

            <section aria-labelledby="km-h">
              <div className="shead">
                <h2 className="disp" id="km-h">
                  The four numbers to know
                </h2>
                <p>Hover, tap or tab to any card to see what it means and how it&apos;s worked out.</p>
              </div>
              <div className="hgrid">
                <MetricCard id="cf" title="Cash flow after reserves" value={cf} format={exact} unit="/mo" negative={cf < 0} badge={cashFlowBadge(v.st)} delta={dExact}>
                  <p>
                    <b className="num">{cf >= 0 ? `${usd(cf * 12)} a year in your pocket after everything` : `${usd(-cf * 12)} a year out of your pocket after everything`}</b>
                  </p>
                  <p><b>What it means:</b> the money left each month after empty months, every running cost, the mortgage and the savings set aside for big repairs.</p>
                  <p><b>How it&apos;s worked out:</b> net operating income minus mortgage P&amp;I minus the CapEx reserve.</p>
                  <p><b>Why it matters:</b> it is the clearest answer to &ldquo;does this property pay me or cost me each month?&rdquo;</p>
                </MetricCard>
                <MetricCard
                  id="coc"
                  title="Cash-on-cash return"
                  value={u.cashOnCash}
                  format={rate}
                  offText="n/a"
                  negative={(u.cashOnCash ?? 0) < 0}
                  badge={cashOnCashBadge(u.cashOnCash, s.constraints.minCashOnCash)}
                  delta={dPts}
                >
                  <p>
                    <b className="num">About {usd(Math.max(0, u.cashOnCash ?? 0) * 10_000, { exact: true })} a year for every $100 you put in</b>
                  </p>
                  <p><b>What it means:</b> a year of cash flow divided by the cash you put in upfront.</p>
                  <p><b>How it&apos;s worked out:</b> (monthly cash flow × 12) ÷ total cash invested.</p>
                  <p><b>Why it matters:</b> it lets you compare this property with other uses of your money, like a savings account or an index fund.</p>
                </MetricCard>
                <MetricCard id="be" title="Break-even rent" value={u.breakEvenRent} format={whole} offText="Not reachable" unit="/mo" badge={breakEvenBadge(u, p.monthlyRent)} delta={dWhole} upIsGood={false}>
                  {cush && u.breakEvenRent !== null ? (
                    <>
                      <p>
                        <b className="num">
                          {cush.amount >= 0
                            ? `${usd(cush.amount)} cushion (${(cush.share * 100).toFixed(1)}%)`
                            : `${usd(-cush.amount)} short (${Math.abs(cush.share * 100).toFixed(1)}%)`}
                        </b>
                      </p>
                      <div className="minibar" aria-hidden>
                        <i style={{ width: `${Math.max(0, Math.min(100, (u.breakEvenRent / p.monthlyRent) * 100))}%` }} />
                        <b style={{ left: `${Math.max(0, Math.min(100, (u.breakEvenRent / p.monthlyRent) * 100))}%` }} />
                      </div>
                      <p className="num" style={{ fontSize: 13 }}>
                        Break-even {usd(u.breakEvenRent)} · Your rent {usd(p.monthlyRent)}
                      </p>
                    </>
                  ) : (
                    <p><b>No rent covers these costs: the percentage costs take all of it.</b></p>
                  )}
                  <p><b>What it means:</b> the lowest rent at which the property still covers all its costs.</p>
                  <p><b>How it&apos;s worked out:</b> the rent that brings cash flow after reserves to exactly $0, with your percentages applied.</p>
                  <p><b>Why it matters:</b> the bigger the gap to your actual rent, the safer the deal.</p>
                </MetricCard>
                <MetricCard id="ceil" title="Offer ceiling" value={ceilingValue} format={whole} offText={ceilingOff} badge={ceilingBadge(ceiling, p.purchasePrice)} delta={dWhole}>
                  <p><b className="num">{ceilCtx}</b></p>
                  <p><b>What it means:</b> the highest price you could pay and still meet every target you set.</p>
                  <p><b>How it&apos;s worked out:</b> we test prices to the dollar, recalculating the loan, down payment and closing costs each time.</p>
                  <p><b>Why it matters:</b> it gives you a walk-away price before you negotiate.</p>
                </MetricCard>
              </div>
              <div className="sgrid">
                <MetricCard id="cap" small title="Cap rate" value={u.capRate} format={rate} offText="n/a" delta={dPts}>
                  <p><b>What it means:</b> the property&apos;s yearly income before the mortgage, as a percent of the price.</p>
                  <p><b>Why it matters:</b> it shows how productive the property is on its own, whatever the financing.</p>
                </MetricCard>
                <MetricCard id="noi" small title="Net operating income" value={u.noi} format={exact} unit="/mo" negative={u.noi < 0} delta={dExact}>
                  <p><b>What it means:</b> rent collected minus running costs, before the mortgage.</p>
                  <p><b>Why it matters:</b> it is what the property earns by itself.</p>
                </MetricCard>
                <MetricCard id="pi" small title="Monthly P&I" value={u.monthlyPI} format={exact} delta={dExact} upIsGood={false}>
                  <p><b>What it means:</b> your mortgage payment, principal and interest only, no taxes or insurance.</p>
                  <p><b>Why it matters:</b> it is usually the biggest monthly cost.</p>
                </MetricCard>
                <MetricCard id="cash" small title="Total cash invested" value={u.cashInvested} format={whole} delta={dWhole} upIsGood={false}>
                  <p><b>What it means:</b> everything you pay upfront: down payment, closing costs, repairs and the cash reserve.</p>
                  <p><b>Why it matters:</b> it is your money at risk, and the base for cash-on-cash.</p>
                </MetricCard>
              </div>
            </section>

            <section aria-labelledby="wf-h">
              <div className="shead">
                <h2 className="disp" id="wf-h">
                  Where the rent goes
                </h2>
                <p>Each month starts with the full rent and steps down through every cost until what&apos;s left is yours.</p>
              </div>
              <div className="card">
                <Waterfall u={u} cfStatus={v.st} />
              </div>
            </section>

            <section aria-labelledby="sc-h">
              <div className="shead">
                <h2 className="disp" id="sc-h">
                  What if things go better or worse?
                </h2>
                <p>The same property under a tougher year and an easier one. Illustrative adjustments, not forecasts.</p>
              </div>
              <Scenarios scenarios={s.scenarios} results={results} />
            </section>

            <section aria-labelledby="pj-h">
              <div className="shead">
                <h2 className="disp" id="pj-h">
                  Over the years you own it
                </h2>
                <p>Cash flow, equity and the sale over your hold period, before income tax. Growth rates are assumptions you set, not predictions.</p>
              </div>
              <Projection property={p} scenarios={s.scenarios} />
            </section>

            <section aria-labelledby="oc-h">
              <div className="shead">
                <h2 className="disp" id="oc-h">
                  Your offer ceiling
                </h2>
                <p>The highest price you could pay and still meet every target you turned on. A walk-away price under these assumptions, not a recommendation.</p>
              </div>
              <OfferCeiling property={p} constraints={s.constraints} result={ceiling} alone={alone} />
            </section>

            <section aria-labelledby="se-h">
              <div className="shead">
                <h2 className="disp" id="se-h">
                  What moves your cash flow most
                </h2>
                <p>Each bar changes one assumption and shows how much yearly cash flow you&apos;d lose.</p>
              </div>
              <Sensitivity rows={rows} />
            </section>

            <NextSteps rows={rows} />

            <PageFooter>
              RentWise is a modeling tool, not financial, tax or legal advice. Results depend on your assumptions. Check them with a lender, an insurer and a local property manager.
            </PageFooter>
          </div>
        </div>
      </div>

      <div className="mob num">
        <span>
          Cash flow <b>{usd(cf)}</b>/mo
        </span>
        <button type="button" className="btn btn-sm" onClick={() => setSheet(true)}>
          Edit assumptions
        </button>
      </div>
      <button type="button" tabIndex={-1} className={`scrim ${sheet ? "on" : ""}`} aria-label="Close assumptions" onClick={() => setSheet(false)} />
    </div>
  );
}
