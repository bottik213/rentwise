"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import duplex from "@/assets/photos/duplex-hinesburg.jpg";
import porch from "@/assets/photos/porch-toronto.jpg";
import { PageFooter } from "@/components/DataControls";
import { Contributors, PlanVsActual } from "@/components/charts/PlanVsActual";
import { NumberField } from "@/components/forms/NumberField";
import { Arrow, Badge, Logo } from "@/components/Icons";
import { PageSkeleton } from "@/components/results/PageSkeleton";
import { TryExampleButton } from "@/components/TryExampleButton";
import { CATEGORY_LABEL, explainVariance } from "@/lib/explain";
import { underwrite } from "@/lib/finance/underwriting";
import { monthlyForecast, variance } from "@/lib/finance/variance";
import { ACTUAL_CATEGORIES, type ActualMonth, type Cents, type Underwriting, type VarianceContributor } from "@/lib/finance/types";
import { monthLabel, usd } from "@/lib/format";
import { RentTab } from "@/components/ledger/RentTab";
import { localToday } from "@/lib/ledger/dates";
import { missingBills } from "@/lib/ledger/bills";
import { combinedActuals } from "@/lib/ledger/to-actuals";
import type { Ledger } from "@/lib/ledger/types";
import { setAppState, useAppState } from "@/lib/storage";
import { ActualMonthSchema } from "@/lib/validation";
import "./performance.css";

const FIELD_KEYS = [...ACTUAL_CATEGORIES, "capex"] as const;
const HELP: Partial<Record<(typeof FIELD_KEYS)[number], string>> = {
  rentReceived: "Rent actually collected. Security deposits are not income; leave them out.",
  capex: "Big replacements (roof, HVAC). Tracked against your reserve, not cash flow.",
};
const INCOME = new Set(["rentReceived", "otherIncome"]);
const nextMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
};
const longMonth = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const lc = (s: string) => (/^[A-Z]{2}/.test(s) ? s : s[0].toLowerCase() + s.slice(1));
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

const movers = (cs: VarianceContributor[]) => cs.filter((c) => c.impact !== 0).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

/** "maintenance cost $120.00 more than planned" / "rent received was $32.61 lower than planned". */
function phrase(c: VarianceContributor) {
  const amt = usd(Math.abs(c.impact), { exact: true });
  const label = lc(CATEGORY_LABEL[c.category]);
  if (INCOME.has(c.category)) return `${label} was ${amt} ${c.impact < 0 ? "lower" : "higher"} than planned`;
  return `${label} cost ${amt} ${c.impact < 0 ? "more" : "less"} than planned`;
}

function monthSentence(u: Underwriting, m: ActualMonth) {
  const ms = movers(variance(u, [m]).contributors);
  if (!ms.length) return "Everything matched the plan.";
  const rest = ms.length > 1 ? ` ${ms.length - 1} other line${ms.length > 2 ? "s" : ""} moved too.` : "";
  return `${cap(phrase(ms[0]))}.${rest}`;
}

const TABS = [["overview", "Overview"], ["rent", "Rent"]] as const;
type Tab = (typeof TABS)[number][0];

const judge = (t: number) => (t < 0 ? { st: "bad" as const, label: "Below plan" } : { st: "good" as const, label: t > 0 ? "Above plan" : "On plan" });

export default function PerformancePage() {
  const s = useAppState();
  const [draft, setDraft] = useState<ActualMonth | null>(null);
  const [formRevision, setFormRevision] = useState(0);
  const [tab, setTab] = useState<Tab>("overview");
  if (!s) return <PageSkeleton />;

  if (!s.plan) {
    return (
      <div className="pg-actuals">
        <div className="es">
          <figure>
            <Image src={porch} priority alt="A red-brick Victorian house with a white wooden front porch and a bicycle by the steps, on a sunny Toronto street" sizes="(max-width: 899px) 100vw, 540px" />
            <figcaption>Beverly Street, Toronto. Photo: Bill Badzo, public domain mark.</figcaption>
          </figure>
          <div>
            <h1 className="disp">No owned property yet</h1>
            <p className="l">Once you buy, this is where you&apos;ll see how the property is really doing. Record what you collect and pay each month, and RentWise compares it with the plan you bought on.</p>
            <ol className="steps">
              <li>Analyze a property, then choose &ldquo;Mark as owned&rdquo; to lock the plan you buy on.</li>
              <li>Each month, enter the rent you collected and the bills you paid.</li>
              <li>See which costs moved cash flow away from plan, to the cent.</li>
            </ol>
            <div className="ctas">
              <Link href={s.property ? "/results" : s.deals.length ? "/compare" : "/analyze"} className="btn btn-primary btn-lg">
                {s.property ? "Go to the analysis" : s.deals.length ? "Your properties" : "Analyze a property"} <Arrow size={18} />
              </Link>
              {!s.property && <TryExampleButton className="btn btn-quiet btn-lg" />}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const plan = s.plan;
  const u = underwrite(plan.inputs); // the locked plan, never the live inputs
  const forecast = monthlyForecast(u);
  const today = localToday();
  // Manual months and ledger months together, never both for one month (see combinedActuals).
  const combined = combinedActuals(s.actuals, s.ledger, today);
  const actuals = combined.months;
  const setLedger = (fn: (l: Ledger) => Ledger) => setAppState((x) => ({ ...x, ledger: fn(x.ledger) }));
  const ledgerMonths = Object.keys(combined.mode).filter((m) => combined.mode[m] === "ledger");
  const bills = missingBills(ledgerMonths, s.ledger.expenses, forecast);
  const billMonths = [...new Set(bills.map((b) => b.date.slice(0, 7)))];
  const blank = (month: string): ActualMonth => ({ month, ...forecast, capex: 0 });
  const upcoming = actuals.length ? nextMonth(actuals[actuals.length - 1].month) : plan.lockedAt.slice(0, 7);
  const form = draft ?? blank(upcoming);
  const replacing = actuals.some((a) => a.month === form.month);
  const valid = ActualMonthSchema.safeParse(form).success;
  const monthOk = /^\d{4}-(0[1-9]|1[0-2])$/.test(form.month);
  const all = variance(u, actuals);

  const latest = actuals[actuals.length - 1];
  const rl = latest ? variance(u, [latest]) : null;
  const latestMovers = rl ? movers(rl.contributors) : [];
  const quiet = rl ? rl.contributors.filter((c) => c.impact === 0) : [];
  const previous = actuals.slice(-3, -1).reverse();
  const planCf = u.cashFlowBeforeCapex;
  const points = actuals.slice(-12).map((a) => ({ month: a.month, actual: variance(u, [a]).actualCashFlowBeforeCapex }));
  const name = (s.isExample ? plan.inputs.nickname?.replace(/\s*\(synthetic\)$/i, "") : plan.inputs.nickname) || "Your property";

  const save = () => {
    if (!valid) return;
    // Upsert by month: a duplicate month would be counted twice.
    setAppState((x) => ({ ...x, actuals: [...x.actuals.filter((a) => a.month !== form.month), form].sort((a, b) => a.month.localeCompare(b.month)) }));
    setDraft(null);
  };
  const remove = (month: string) => {
    if (!confirm(`Delete ${monthLabel(month)}?`)) return;
    setAppState((x) => ({ ...x, actuals: x.actuals.filter((a) => a.month !== month) }));
  };

  return (
    <div className="pg-actuals">
      <div className="wrap">
        <header className="ph">
          {s.isExample ? (
            <Image className="thumb" src={duplex} alt="Two-story side-by-side duplex with a shared front porch" width={64} height={64} />
          ) : (
            <span className="thumb" aria-hidden>
              <Logo />
            </span>
          )}
          <div className="txt">
            <h1 className="disp">{name}, plan vs. actual</h1>
            <p className="num">
              Plan locked {new Date(plan.lockedAt).toLocaleDateString("en-US", { dateStyle: "medium" })} · {actuals.length} month{actuals.length === 1 ? "" : "s"} recorded
              {s.isExample && <> · <span className="tag">Synthetic example</span></>} · Later edits to the analysis don&apos;t change the plan.{" "}
              <Link href="/results">Back to analysis</Link>
            </p>
          </div>
          <a href="#record" className="btn btn-primary" onClick={() => setTab("overview")}>
            Record {longMonth(upcoming).split(" ")[0]} <Arrow />
          </a>
        </header>

        <div className="tabs" role="tablist" aria-label="Owned property">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls={`panel-${k}`} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>

        {tab === "rent" && (
          <div role="tabpanel" id="panel-rent" aria-labelledby="tab-rent">
            <RentTab ledger={s.ledger} setLedger={setLedger} today={today} plannedRent={plan.inputs.monthlyRent} />
          </div>
        )}

        {tab === "overview" && (
        <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" className="tabp">
        {bills.length > 0 && (
          <section className="card bills" aria-labelledby="bills-h">
            <p id="bills-h" style={{ margin: 0, fontWeight: 600 }}>
              {bills.length} usual bill{bills.length === 1 ? " isn't" : "s aren't"} recorded for {billMonths.map(monthLabel).join(", ")}
            </p>
            <p style={{ margin: 0, color: "var(--ink-2)" }}>
              Months built from your ledger count only what you record, so a month without its mortgage, tax or insurance looks better than it really was.
            </p>
            <div>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setLedger((x) => ({ ...x, expenses: [...x.expenses, ...bills.map((b) => ({ ...b, id: crypto.randomUUID() }))] }))}>
                Add them at the planned amounts
              </button>
            </div>
            <p className="note" style={{ margin: 0 }}>Each one is a dated expense you can change or delete later if the real bill differed.</p>
          </section>
        )}
        {rl && latest ? (
          <>
            <div className="lead">
              <section className="hl" aria-labelledby="hl-h">
                <div className="k">
                  <span id="hl-h">{longMonth(latest.month)}</span>
                  <Badge {...judge(rl.totalVariance)} />
                </div>
                <p className="big">
                  {rl.totalVariance === 0 ? (
                    "Cash flow matched the plan this month."
                  ) : (
                    <>
                      Cash flow was <b className="num">{usd(Math.abs(rl.totalVariance))}</b> {rl.totalVariance < 0 ? "below" : "above"} plan this month
                      {latestMovers.length ? <>, mostly because {phrase(latestMovers[0])}.</> : "."}
                    </>
                  )}
                </p>
                <dl className="num">
                  <div>
                    <dt>Planned</dt>
                    <dd>{usd(rl.forecastCashFlowBeforeCapex, { exact: true })}</dd>
                  </div>
                  <div>
                    <dt>Actual</dt>
                    <dd>{usd(rl.actualCashFlowBeforeCapex, { exact: true })}</dd>
                  </div>
                  <div>
                    <dt>Difference</dt>
                    <dd className={rl.totalVariance < 0 ? "neg" : rl.totalVariance > 0 ? "pos" : ""}>{usd(rl.totalVariance, { exact: true, signed: true })}</dd>
                  </div>
                </dl>
                <p className="note" style={{ margin: 0 }}>
                  Cash flow before CapEx. Big replacements are tracked against your reserve, not here. Rule-based explanation computed from your numbers. No AI involved.
                </p>
              </section>
              <div className="side">
                {previous.map((m) => {
                  const t = variance(u, [m]).totalVariance;
                  return (
                    <div key={m.month} className="vc">
                      <div className="m">
                        <span>{longMonth(m.month)}</span>
                        <span className={`num ${t < 0 ? "neg" : t > 0 ? "pos" : ""}`}>{usd(t, { exact: true, signed: true })}</span>
                      </div>
                      <p>{monthSentence(u, m)}</p>
                    </div>
                  );
                })}
                {actuals.length > 1 && (
                  <div className="vc">
                    <div className="m">
                      <span>Since you bought</span>
                      <span className={`num ${all.totalVariance < 0 ? "neg" : all.totalVariance > 0 ? "pos" : ""}`}>{usd(all.totalVariance, { exact: true, signed: true })}</span>
                    </div>
                    <p className="num">
                      {all.months} months, {usd(all.actualCashFlowBeforeCapex, { exact: true })} actual against {usd(all.forecastCashFlowBeforeCapex, { exact: true })} planned.
                    </p>
                  </div>
                )}
                {actuals.length === 1 && (
                  <div className="vc">
                    <div className="m">
                      <span>Your first month</span>
                    </div>
                    <p>Each month you add shows up in the chart below, so you can see a trend form.</p>
                  </div>
                )}
              </div>
            </div>

            <section aria-labelledby="ch-h">
              <div className="shead">
                <h2 className="disp" id="ch-h">
                  Monthly cash flow, plan vs. actual
                </h2>
                <p>Bars are what really happened. The dashed line is the plan you bought on.</p>
              </div>
              <PlanVsActual points={points} plan={planCf} />
            </section>

            <div className="two">
              <section className="card" aria-labelledby="why-h">
                <h2 className="disp" id="why-h">
                  What pulled {longMonth(latest.month).split(" ")[0]} away from plan
                </h2>
                <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 15 }}>Each line&apos;s effect on cash flow. Right is better than plan, left is worse.</p>
                <Contributors movers={latestMovers} total={rl.totalVariance} month={latest.month} />
                <table className="ct num">
                  <caption className="sr-only">Plan and actual by category for {longMonth(latest.month)}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Category</th>
                      <th scope="col">Plan</th>
                      <th scope="col">Actual</th>
                      <th scope="col">Effect on cash flow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestMovers.map((c) => (
                      <tr key={c.category}>
                        <th scope="row">{CATEGORY_LABEL[c.category]}</th>
                        <td className="mut">{usd(c.forecast, { exact: true })}</td>
                        <td>{usd(c.actual, { exact: true })}</td>
                        <td className={c.impact < 0 ? "neg" : "pos"}>{usd(c.impact, { exact: true, signed: true })}</td>
                      </tr>
                    ))}
                    {quiet.length > 0 && (
                      <tr>
                        <th scope="row">Everything else ({quiet.length} lines, on plan)</th>
                        <td className="mut">{usd(quiet.reduce((t, c) => t + c.forecast, 0), { exact: true })}</td>
                        <td>{usd(quiet.reduce((t, c) => t + c.actual, 0), { exact: true })}</td>
                        <td className="mut">{usd(0, { exact: true })}</td>
                      </tr>
                    )}
                    <tr className="s">
                      <th scope="row">Total variance</th>
                      <td />
                      <td />
                      <td className={rl.totalVariance < 0 ? "neg" : rl.totalVariance > 0 ? "pos" : ""}>{usd(rl.totalVariance, { exact: true, signed: true })}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="note">Positive means better than plan. The rows add up exactly to the total.</p>
                <ul className="why">
                  {explainVariance(rl).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <section className="card cx" aria-labelledby="cx-h">
                  <h2 className="disp" id="cx-h">
                    CapEx, kept separate
                  </h2>
                  <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 15 }}>
                    Your reserve for a roof, HVAC or water heater. Saving into it isn&apos;t a loss, and spending from it doesn&apos;t count against monthly cash flow.
                  </p>
                  <div className="meter" aria-hidden>
                    <i style={{ width: `${all.plannedCapexReserve ? Math.min(100, 100 - (all.actualCapex / all.plannedCapexReserve) * 100) : 0}%` }} />
                  </div>
                  <dl className="num">
                    <div>
                      <dt>Set aside so far</dt>
                      <dd>{usd(all.plannedCapexReserve, { exact: true })}</dd>
                    </div>
                    <div>
                      <dt>Spent from it</dt>
                      <dd>{usd(all.actualCapex, { exact: true })}</dd>
                    </div>
                  </dl>
                </section>

                <section className="card" aria-labelledby="rm-h">
                  <h2 className="disp" id="rm-h">
                    Recorded months
                  </h2>
                  <div className="rmh" aria-hidden>
                    <span>Month</span>
                    <span>Cash flow</span>
                    <span />
                  </div>
                  <ul className="rm num">
                    {actuals.map((a) => {
                      const v = variance(u, [a]).actualCashFlowBeforeCapex;
                      return (
                        <li key={a.month} className="rmr">
                          <span>{monthLabel(a.month)}</span>
                          <span className={v < 0 ? "neg" : ""}>{usd(v, { exact: true })}</span>
                          {combined.mode[a.month] === "ledger" ? (
                            <span className="tag" title="Built from your rent and expense entries">Ledger</span>
                          ) : (
                            <span>
                              <button type="button" className="lnk" onClick={() => setDraft(a)}>
                                Edit
                              </button>
                              <button type="button" className="lnk danger" onClick={() => remove(a.month)}>
                                Delete
                              </button>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </div>
            </div>
          </>
        ) : (
          <section className="hl" aria-labelledby="first-h">
            <h2 className="disp" id="first-h" style={{ margin: 0, fontSize: 28 }}>
              Record your first month
            </h2>
            <p style={{ margin: 0, color: "var(--ink-2)", maxWidth: "60ch" }}>
              The form below starts at your plan&apos;s forecast. Change only what really happened, like a repair bill, and RentWise explains the difference.
            </p>
          </section>
        )}

        <section id="record" className="card" aria-labelledby="record-h" style={{ maxWidth: 760, scrollMarginTop: 24 }}>
          <h2 className="disp" id="record-h" style={{ margin: 0, fontSize: 22 }}>
            {replacing ? `Edit ${monthLabel(form.month)}` : "Record a month"}
          </h2>
          <p style={{ margin: "4px 0 0", color: "var(--ink-2)", fontSize: 15 }}>Prefilled with the plan&apos;s monthly forecast. Overwrite with what was actually received and paid.</p>
          <form
            key={formRevision}
            className="rf num"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <label className="mo full">
              Month
              {/* Safari and Firefox desktop render type="month" as plain text, so the format is spelled out. */}
              <input
                type="month"
                required
                placeholder="YYYY-MM"
                pattern="\d{4}-(0[1-9]|1[0-2])"
                aria-invalid={!monthOk}
                aria-describedby="month-help"
                value={form.month}
                onChange={(e) => setDraft({ ...form, month: e.target.value.trim() })}
              />
              <span id="month-help" className={monthOk ? "sr-only" : "ferr"} style={{ fontWeight: 400 }}>
                Use year and month, like 2026-11.
              </span>
            </label>
            {FIELD_KEYS.map((k) => (
              <NumberField
                key={`${form.month}-${k}`}
                className={k === "capex" ? "full" : undefined}
                def={{ label: k === "capex" ? "CapEx spent" : CATEGORY_LABEL[k], kind: "money", help: HELP[k] ?? "", min: 0, max: 1_000_000 }}
                value={form[k]}
                onCommit={(v: Cents) => setDraft({ ...form, [k]: v })}
              />
            ))}
            <p className="note full" style={{ margin: 0 }}>
              Security deposits are not income; leave them out. CapEx is tracked against your reserve, not cash flow.
              {replacing && " Saving replaces the entry already recorded for this month."}
            </p>
            <div className="full" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button type="submit" disabled={!valid} className="btn btn-primary">
                {replacing ? "Save changes" : "Add month"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(null);
                  setFormRevision((n) => n + 1);
                }}
                className="btn btn-quiet"
              >
                Reset
              </button>
            </div>
          </form>
        </section>

        </div>
        )}

        <PageFooter>RentWise is a modeling tool, not financial or tax advice. Keep your own receipts and statements; this page only compares the numbers you enter.</PageFooter>
      </div>
    </div>
  );
}
