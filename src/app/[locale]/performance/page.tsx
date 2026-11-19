"use client";
import Image from "next/image";
import Link from "next/link";
import { Fragment, useState } from "react";
import duplex from "@/assets/photos/duplex-hinesburg.jpg";
import porch from "@/assets/photos/porch-toronto.jpg";
import { PageFooter } from "@/components/DataControls";
import { Contributors, PlanVsActual } from "@/components/charts/PlanVsActual";
import { NumberField } from "@/components/forms/NumberField";
import { Arrow, Badge, Chevron, Logo } from "@/components/Icons";
import { PageSkeleton } from "@/components/results/PageSkeleton";
import { TryExampleButton } from "@/components/TryExampleButton";
import type { I18n } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { explainVariance } from "@/lib/explain";
import { underwrite } from "@/lib/finance/underwriting";
import { monthlyForecast, variance } from "@/lib/finance/variance";
import { ACTUAL_CATEGORIES, type ActualMonth, type Cents, type Underwriting, type VarianceContributor } from "@/lib/finance/types";
import { ExpensesTab } from "@/components/ledger/ExpensesTab";
import { RentTab } from "@/components/ledger/RentTab";
import { localToday } from "@/lib/ledger/dates";
import { missingBills } from "@/lib/ledger/bills";
import { combinedActuals, type SourceRef } from "@/lib/ledger/to-actuals";
import type { Ledger, MonthMode } from "@/lib/ledger/types";
import { setAppState, useAppState } from "@/lib/storage";
import { ActualMonthSchema } from "@/lib/validation";
import "./performance.css";

const FIELD_KEYS = [...ACTUAL_CATEGORIES, "capex"] as const;
const INCOME = new Set(["rentReceived", "otherIncome"]);
const nextMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
};
// Lower-case a label inside a sentence, but keep abbreviations like "HOA" or "ОСИ" as they are.
const lc = (s: string) => (/^\p{Lu}{2}/u.test(s) ? s : s[0].toLocaleLowerCase() + s.slice(1));
const cap = (s: string) => s[0].toLocaleUpperCase() + s.slice(1);

const movers = (cs: VarianceContributor[]) => cs.filter((c) => c.impact !== 0).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

/** "maintenance cost ₸120.00 more than planned" / "rent received was ₸32.61 lower than planned". */
function phrase(c: VarianceContributor, { t, money }: I18n) {
  const amt = money(Math.abs(c.impact), { exact: true });
  const label = lc(t.cat[c.category]);
  return INCOME.has(c.category) ? t.perf.lowerHigher(label, amt, c.impact < 0) : t.perf.moreLess(label, amt, c.impact < 0);
}

function monthSentence(u: Underwriting, m: ActualMonth, i: I18n) {
  const ms = movers(variance(u, [m]).contributors);
  if (!ms.length) return i.t.perf.matched;
  const rest = ms.length > 1 ? i.t.perf.others(ms.length - 1) : "";
  return `${cap(phrase(ms[0], i))}.${rest}`;
}

const refLabel = (r: SourceRef, { t }: I18n) => (r.what ? t.perf.src[r.what](r.label) : r.label || t.perf.src.expense);

const TABS = ["overview", "rent", "expenses"] as const;
/** Set one month's mode explicitly, replacing any earlier choice for it. */
const withMode = (modes: MonthMode[], month: string, mode: MonthMode["mode"]) => [...modes.filter((m) => m.month !== month), { month, mode }];
type Tab = (typeof TABS)[number];

export default function PerformancePage() {
  const s = useAppState();
  const i = useI18n();
  const { t, money: usd, month: monthLabel, longMonth, monthName, path } = i;
  const P = t.perf;
  const [draft, setDraft] = useState<ActualMonth | null>(null);
  const [formRevision, setFormRevision] = useState(0);
  const [tab, setTab] = useState<Tab>("overview");
  const [open, setOpen] = useState<string | null>(null); // the contributor whose entries are expanded
  if (!s) return <PageSkeleton />;

  const judge = (x: number) => (x < 0 ? { st: "bad" as const, label: P.belowPlan } : { st: "good" as const, label: x > 0 ? P.abovePlan : P.onPlan });

  if (!s.plan) {
    return (
      <div className="pg-actuals">
        <div className="es">
          <figure>
            <Image src={porch} priority alt={P.emptyAlt} sizes="(max-width: 899px) 100vw, 540px" />
            <figcaption>{P.emptyCredit}</figcaption>
          </figure>
          <div>
            <h1 className="disp">{P.emptyTitle}</h1>
            <p className="l">{P.emptyText}</p>
            <ol className="steps">
              {P.emptySteps.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ol>
            <div className="ctas">
              <Link href={path(s.property ? "/results" : s.deals.length ? "/compare" : "/analyze")} className="btn btn-primary btn-lg">
                {s.property ? P.goAnalysis : s.deals.length ? t.common.yourProperties : t.common.analyzeProperty} <Arrow size={18} />
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
  const bills = missingBills(ledgerMonths, s.ledger.expenses, forecast, P.usualBill);
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
  const name = s.isExample ? t.common.exampleName : plan.inputs.nickname || t.common.yourProperty;

  const save = () => {
    if (!valid) return;
    // Upsert by month: a duplicate month would be counted twice. Saving totals makes the month manual.
    setAppState((x) => ({
      ...x,
      actuals: [...x.actuals.filter((a) => a.month !== form.month), form].sort((a, b) => a.month.localeCompare(b.month)),
      ledger: { ...x.ledger, monthModes: withMode(x.ledger.monthModes, form.month, "manual") },
    }));
    setDraft(null);
  };
  const remove = (month: string) => {
    if (!confirm(P.deleteConfirm(monthLabel(month)))) return;
    setAppState((x) => ({ ...x, actuals: x.actuals.filter((a) => a.month !== month), ledger: { ...x.ledger, monthModes: x.ledger.monthModes.filter((m) => m.month !== month) } }));
  };
  // Switching never deletes anything: manual totals stay stored, and ledger entries stay recorded.
  const toManual = (m: ActualMonth) =>
    setAppState((x) => ({
      ...x,
      actuals: [...x.actuals.filter((a) => a.month !== m.month), m].sort((a, b) => a.month.localeCompare(b.month)), // prefilled from the ledger, in the same save
      ledger: { ...x.ledger, monthModes: withMode(x.ledger.monthModes, m.month, "manual") },
    }));
  const toLedger = (month: string) => setLedger((l) => ({ ...l, monthModes: withMode(l.monthModes, month, "ledger") }));
  const hasEntries = new Set([...s.ledger.payments, ...s.ledger.expenses, ...s.ledger.depositEvents].filter((e) => e.date <= today).map((e) => e.date.slice(0, 7)));
  const latestSources = latest ? combined.sources[latest.month] : undefined;
  const sign = (x: number) => (x < 0 ? "neg" : x > 0 ? "pos" : "");

  return (
    <div className="pg-actuals">
      <div className="wrap">
        <header className="ph">
          {s.isExample ? (
            <Image className="thumb" src={duplex} alt={P.thumbAlt} width={64} height={64} />
          ) : (
            <span className="thumb" aria-hidden>
              <Logo />
            </span>
          )}
          <div className="txt">
            <h1 className="disp">{P.title(name)}</h1>
            <p className="num">
              {P.locked(i.date(plan.lockedAt), actuals.length)}
              {s.isExample && <> · <span className="tag">{t.common.synthetic}</span></>} · {P.laterEdits}{" "}
              <Link href={path("/results")}>{P.back}</Link>
            </p>
          </div>
          <a href="#record" className="btn btn-primary" onClick={() => setTab("overview")}>
            {P.record(monthName(upcoming))} <Arrow />
          </a>
        </header>

        <div className="tabs" role="tablist" aria-label={P.tabsLabel}>
          {TABS.map((k) => (
            <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls={`panel-${k}`} onClick={() => setTab(k)}>
              {P.tabs[k]}
            </button>
          ))}
        </div>

        {tab === "rent" && (
          <div role="tabpanel" id="panel-rent" aria-labelledby="tab-rent">
            <RentTab ledger={s.ledger} setLedger={setLedger} today={today} plannedRent={plan.inputs.monthlyRent} />
          </div>
        )}

        {tab === "expenses" && (
          <div role="tabpanel" id="panel-expenses" aria-labelledby="tab-expenses">
            <ExpensesTab ledger={s.ledger} setLedger={setLedger} today={today} />
          </div>
        )}

        {tab === "overview" && (
        <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" className="tabp">
        {bills.length > 0 && (
          <section className="card bills" aria-labelledby="bills-h">
            <p id="bills-h" style={{ margin: 0, fontWeight: 600 }}>
              {P.bills(bills.length, billMonths.map(monthLabel).join(", "))}
            </p>
            <p style={{ margin: 0, color: "var(--ink-2)" }}>{P.billsWhy}</p>
            <div>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setLedger((x) => ({ ...x, expenses: [...x.expenses, ...bills.map((b) => ({ ...b, id: crypto.randomUUID() }))] }))}>
                {P.billsAdd}
              </button>
            </div>
            <p className="note" style={{ margin: 0 }}>{P.billsNote}</p>
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
                    P.matchedMonth
                  ) : (
                    <>
                      {P.wasPre}
                      <b className="num">{usd(Math.abs(rl.totalVariance))}</b>
                      {P.wasPost(rl.totalVariance < 0)}
                      {latestMovers.length ? P.mostly(phrase(latestMovers[0], i)) : "."}
                    </>
                  )}
                </p>
                <dl className="num">
                  <div>
                    <dt>{P.planned}</dt>
                    <dd>{usd(rl.forecastCashFlowBeforeCapex, { exact: true })}</dd>
                  </div>
                  <div>
                    <dt>{P.actual}</dt>
                    <dd>{usd(rl.actualCashFlowBeforeCapex, { exact: true })}</dd>
                  </div>
                  <div>
                    <dt>{P.difference}</dt>
                    <dd className={sign(rl.totalVariance)}>{usd(rl.totalVariance, { exact: true, signed: true })}</dd>
                  </div>
                </dl>
                <p className="note" style={{ margin: 0 }}>{P.hlNote}</p>
              </section>
              <div className="side">
                {previous.map((m) => {
                  const x = variance(u, [m]).totalVariance;
                  return (
                    <div key={m.month} className="vc">
                      <div className="m">
                        <span>{longMonth(m.month)}</span>
                        <span className={`num ${sign(x)}`}>{usd(x, { exact: true, signed: true })}</span>
                      </div>
                      <p>{monthSentence(u, m, i)}</p>
                    </div>
                  );
                })}
                {actuals.length > 1 && (
                  <div className="vc">
                    <div className="m">
                      <span>{P.since}</span>
                      <span className={`num ${sign(all.totalVariance)}`}>{usd(all.totalVariance, { exact: true, signed: true })}</span>
                    </div>
                    <p className="num">{P.sinceText(all.months, usd(all.actualCashFlowBeforeCapex, { exact: true }), usd(all.forecastCashFlowBeforeCapex, { exact: true }))}</p>
                  </div>
                )}
                {actuals.length === 1 && (
                  <div className="vc">
                    <div className="m">
                      <span>{P.first}</span>
                    </div>
                    <p>{P.firstText}</p>
                  </div>
                )}
              </div>
            </div>

            <section aria-labelledby="ch-h">
              <div className="shead">
                <h2 className="disp" id="ch-h">
                  {P.chTitle}
                </h2>
                <p>{P.chSub}</p>
              </div>
              <PlanVsActual points={points} plan={planCf} />
            </section>

            <div className="two">
              <section className="card" aria-labelledby="why-h">
                <h2 className="disp" id="why-h">
                  {P.whyTitle(monthName(latest.month))}
                </h2>
                <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 15 }}>{P.whySub}</p>
                <Contributors movers={latestMovers} total={rl.totalVariance} month={latest.month} />
                <table className="ct num">
                  <caption className="sr-only">{P.tableCaption(longMonth(latest.month))}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{P.category}</th>
                      <th scope="col">{P.plan}</th>
                      <th scope="col">{P.actual}</th>
                      <th scope="col">{P.effect}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestMovers.map((c) => {
                      const refs = latestSources?.[c.category] ?? [];
                      const expanded = open === c.category;
                      return (
                        <Fragment key={c.category}>
                          <tr>
                            <th scope="row">
                              {refs.length ? (
                                <button type="button" className="xp" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : c.category)}>
                                  <Chevron />
                                  {t.cat[c.category]}
                                </button>
                              ) : (
                                t.cat[c.category]
                              )}
                            </th>
                            <td className="mut">{usd(c.forecast, { exact: true })}</td>
                            <td>{usd(c.actual, { exact: true })}</td>
                            <td className={c.impact < 0 ? "neg" : "pos"}>{usd(c.impact, { exact: true, signed: true })}</td>
                          </tr>
                          {expanded &&
                            refs.map((r) => (
                              <tr key={`${r.kind}-${r.id}`} className="src">
                                <th scope="row" colSpan={2}>
                                  {r.date} · {refLabel(r, i)}
                                </th>
                                <td>{usd(r.amount, { exact: true })}</td>
                                <td />
                              </tr>
                            ))}
                        </Fragment>
                      );
                    })}
                    {quiet.length > 0 && (
                      <tr>
                        <th scope="row">{P.everythingElse(quiet.length)}</th>
                        <td className="mut">{usd(quiet.reduce((x, c) => x + c.forecast, 0), { exact: true })}</td>
                        <td>{usd(quiet.reduce((x, c) => x + c.actual, 0), { exact: true })}</td>
                        <td className="mut">{usd(0, { exact: true })}</td>
                      </tr>
                    )}
                    <tr className="s">
                      <th scope="row">{P.totalVariance}</th>
                      <td />
                      <td />
                      <td className={sign(rl.totalVariance)}>{usd(rl.totalVariance, { exact: true, signed: true })}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="note">{P.rowsAddUp}</p>
                <ul className="why">
                  {explainVariance(rl, i).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <section className="card cx" aria-labelledby="cx-h">
                  <h2 className="disp" id="cx-h">
                    {P.cxTitle}
                  </h2>
                  <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 15 }}>{P.cxText}</p>
                  <div className="meter" aria-hidden>
                    <i style={{ width: `${all.plannedCapexReserve ? Math.min(100, 100 - (all.actualCapex / all.plannedCapexReserve) * 100) : 0}%` }} />
                  </div>
                  <dl className="num">
                    <div>
                      <dt>{P.setAside}</dt>
                      <dd>{usd(all.plannedCapexReserve, { exact: true })}</dd>
                    </div>
                    <div>
                      <dt>{P.spent}</dt>
                      <dd>{usd(all.actualCapex, { exact: true })}</dd>
                    </div>
                  </dl>
                </section>

                <section className="card" aria-labelledby="rm-h">
                  <h2 className="disp" id="rm-h">
                    {P.rmTitle}
                  </h2>
                  <div className="rmh" aria-hidden>
                    <span>{P.month}</span>
                    <span>{P.cashFlow}</span>
                    <span />
                  </div>
                  <ul className="rm num">
                    {actuals.map((a) => {
                      const v = variance(u, [a]).actualCashFlowBeforeCapex;
                      return (
                        <li key={a.month} className="rmr">
                          <span>
                            {monthLabel(a.month)}
                            {combined.mode[a.month] === "ledger" && (
                              <>
                                {" "}
                                <span className="tag" title={P.ledgerTagTitle}>{P.ledgerTag}</span>
                              </>
                            )}
                          </span>
                          <span className={v < 0 ? "neg" : ""}>{usd(v, { exact: true })}</span>
                          {combined.mode[a.month] === "ledger" ? (
                            <span>
                              <button type="button" className="lnk" aria-label={P.enterTotalsFor(monthLabel(a.month))} onClick={() => toManual(a)}>
                                {P.enterTotals}
                              </button>
                            </span>
                          ) : (
                            <span>
                              <button type="button" className="lnk" onClick={() => setDraft(a)}>
                                {t.common.edit}
                              </button>
                              <button type="button" className="lnk danger" onClick={() => remove(a.month)}>
                                {t.common.delete}
                              </button>
                              {hasEntries.has(a.month) && (
                                <button type="button" className="lnk" onClick={() => toLedger(a.month)}>
                                  {P.useLedger}
                                </button>
                              )}
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
              {P.firstTitle}
            </h2>
            <p style={{ margin: 0, color: "var(--ink-2)", maxWidth: "60ch" }}>{P.firstHint}</p>
          </section>
        )}

        <section id="record" className="card" aria-labelledby="record-h" style={{ maxWidth: 760, scrollMarginTop: 24 }}>
          <h2 className="disp" id="record-h" style={{ margin: 0, fontSize: 22 }}>
            {replacing ? P.editMonth(monthLabel(form.month)) : P.recordMonth}
          </h2>
          <p style={{ margin: "4px 0 0", color: "var(--ink-2)", fontSize: 15 }}>{P.recordSub}</p>
          <form
            key={formRevision}
            className="rf num"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <label className="mo full">
              {P.month}
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
                {P.monthFormat}
              </span>
            </label>
            {FIELD_KEYS.map((k) => (
              <NumberField
                key={`${form.month}-${k}`}
                className={k === "capex" ? "full" : undefined}
                def={{ label: k === "capex" ? t.cat.capexSpent : t.cat[k], kind: "money", help: k === "rentReceived" ? P.helpRent : k === "capex" ? P.helpCapex : "", min: 0, max: 1_000_000 }}
                value={form[k]}
                onCommit={(v: Cents) => setDraft({ ...form, [k]: v })}
              />
            ))}
            <p className="note full" style={{ margin: 0 }}>
              {P.depositsNote}
              {replacing && P.replaces}
            </p>
            <div className="full" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button type="submit" disabled={!valid} className="btn btn-primary">
                {replacing ? P.saveChanges : P.addMonth}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(null);
                  setFormRevision((n) => n + 1);
                }}
                className="btn btn-quiet"
              >
                {P.reset}
              </button>
            </div>
          </form>
        </section>

        </div>
        )}

        <PageFooter />
      </div>
    </div>
  );
}
