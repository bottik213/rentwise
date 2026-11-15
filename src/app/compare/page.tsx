"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CompareChart } from "@/components/charts/CompareChart";
import { PageFooter } from "@/components/DataControls";
import { Arrow, StatusIcon } from "@/components/Icons";
import { PageSkeleton } from "@/components/results/PageSkeleton";
import { TryExampleButton } from "@/components/TryExampleButton";
import { COMPARE_ROWS, bestIndexes, dealMetrics, differingAssumptions } from "@/lib/compare";
import { usd } from "@/lib/format";
import { type Deal, deleteDeal, duplicateDeal, importAppData, openDeal, renameDeal, useAppState } from "@/lib/storage";
import { runScenarios } from "@/lib/finance/scenarios";
import "../performance/performance.css";
import "./compare.css";

const MAX = 4;
const nameOf = (d: Deal) => (d.isExample ? d.inputs.nickname?.replace(/\s*\(synthetic\)$/i, "") : d.inputs.nickname) || "Untitled property";

/** The best value per row: check icon and the positive treatment (a negative best keeps its negative color). */
function Best({ on, negative, children }: { on: boolean; negative: boolean; children: React.ReactNode }) {
  return on ? (
    <span className={`best ${negative ? "neg" : "pos"}`}>
      <StatusIcon st="good" size={12} />
      {children}
      <span className="sr-only"> (best)</span>
    </span>
  ) : (
    <>{children}</>
  );
}

export default function ComparePage() {
  const s = useAppState();
  const router = useRouter();
  const [picked, setPicked] = useState<string[] | null>(null);
  const [pair, setPair] = useState<[number, number]>([0, 1]);
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (!s) return <PageSkeleton />;

  const deals = s.deals;
  const ids = (picked ?? deals.slice(0, MAX).map((d) => d.id)).filter((id) => deals.some((d) => d.id === id));
  const chosen = ids.map((id) => deals.find((d) => d.id === id)!);
  const metrics = chosen.map((d) => dealMetrics(d.inputs, s.scenarios, s.constraints));
  const names = chosen.map(nameOf);
  const toggle = (id: string, on: boolean) => setPicked(on ? [...ids, id].slice(0, MAX) : ids.filter((x) => x !== id));
  const open = (id: string, to: string) => openDeal(id) && router.push(to);
  const [a, b] = [Math.min(pair[0], chosen.length - 1), Math.min(pair[1], chosen.length - 1)];

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5_000_000) return setMsg("That file is too large to be a RentWise export.");
    const r = importAppData(await file.text());
    setMsg(typeof r === "number" ? `Added ${r} propert${r === 1 ? "y" : "ies"} from the file.` : r);
  };

  return (
    <div className="pg-actuals pg-compare">
      <div className="wrap">
        <header className="ph">
          <div className="txt">
            <h1 className="disp">Your properties</h1>
            <p>Every property you analyze is saved here, in this browser. Tick 2 to {MAX} to compare them side by side.</p>
          </div>
          <div className="acts">
            <label className="btn btn-quiet btn-sm">
              Import (JSON)
              <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { void onImport(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openDeal(null) && router.push("/analyze")}>
              New property <Arrow />
            </button>
          </div>
        </header>
        {msg && (
          <p role="status" className="note" style={{ margin: "-32px 0 0" }}>
            {msg}
          </p>
        )}

        {!deals.length ? (
          <section className="card">
            <h2 className="disp" style={{ margin: 0, fontSize: 22 }}>No properties yet</h2>
            <p style={{ margin: "8px 0 16px", color: "var(--ink-2)" }}>Analyze a property, or load the synthetic example, and it appears here.</p>
            <div className="ctas">
              <Link href="/analyze" className="btn btn-primary">Analyze a property <Arrow /></Link>
              <TryExampleButton className="btn btn-quiet" />
            </div>
          </section>
        ) : (
          <section className="card" aria-labelledby="list-h">
            <h2 className="disp" id="list-h" style={{ margin: "0 0 12px", fontSize: 22 }}>Saved in this browser</h2>
            <ul className="dlist num">
              {deals.map((d) => {
                const u = runScenarios(d.inputs, s.scenarios).base;
                const on = ids.includes(d.id);
                return (
                  <li key={d.id} className={d.id === s.activeId ? "cur" : ""}>
                    <label className="chk pick">
                      <input type="checkbox" checked={on} disabled={!on && ids.length >= MAX} onChange={(e) => toggle(d.id, e.target.checked)} />
                      <span className="sr-only">Compare {nameOf(d)}</span>
                    </label>
                    <div className="nm">
                      {renaming?.id === d.id ? (
                        <form className="rn" onSubmit={(e) => { e.preventDefault(); renameDeal(d.id, renaming.draft); setRenaming(null); }}>
                          <span className="inp">
                            <input aria-label="Property name" maxLength={60} value={renaming.draft} autoFocus onChange={(e) => setRenaming({ id: d.id, draft: e.target.value })} />
                          </span>
                          <button type="submit" className="lnk">Save</button>
                          <button type="button" className="lnk" onClick={() => setRenaming(null)}>Cancel</button>
                        </form>
                      ) : (
                        <b>{nameOf(d)}</b>
                      )}
                      <span className="meta">
                        {usd(d.inputs.purchasePrice)} · {usd(d.inputs.monthlyRent)}/mo rent
                        {d.isExample && <> · <span className="tag">Synthetic example</span></>}
                        {d.plan && <> · <span className="tag">Owned</span></>}
                        {d.id === s.activeId && <> · open now</>}
                      </span>
                    </div>
                    <span className={`cf ${u.reserveAdjustedCashFlow < 0 ? "neg" : ""}`}>
                      {usd(u.reserveAdjustedCashFlow, { exact: true })}
                      <small>/mo</small>
                    </span>
                    <span className="acts2">
                      <button type="button" className="lnk" onClick={() => open(d.id, "/results")}>Open</button>
                      <Link href={`/report/${d.id}`} className="lnk">Report</Link>
                      <button type="button" className="lnk" onClick={() => setRenaming({ id: d.id, draft: d.inputs.nickname ?? "" })}>Rename</button>
                      <button type="button" className="lnk" onClick={() => duplicateDeal(d.id)}>Duplicate</button>
                      <button
                        type="button"
                        className="lnk danger"
                        onClick={() => confirm(`Delete ${nameOf(d)}${d.actuals.length ? ` and its ${d.actuals.length} recorded month(s)` : ""}${d.ledger.payments.length + d.ledger.expenses.length ? " and its rent and expense entries" : ""}? This can't be undone.`) && deleteDeal(d.id)}
                      >
                        Delete
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="note" style={{ margin: "12px 0 0" }}>
              Cash flow after reserves, per month, with your current scenarios. Duplicate a property to try different numbers without touching the original.
            </p>
          </section>
        )}

        {chosen.length >= 2 && (
          <>
            <section aria-labelledby="cmp-h">
              <div className="shead">
                <h2 className="disp" id="cmp-h">Side by side</h2>
                <p>Same engine, same scenarios and targets for every property. The best value in each row is marked; whether higher or lower is better is shown under each label.</p>
              </div>

              <div className="card cmp-d">
                <table className="ct num cmp">
                  <caption className="sr-only">Comparison of {names.join(", ")}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Metric</th>
                      {names.map((n, k) => (
                        <th key={k} scope="col">
                          <span className="dn">
                            <i style={{ background: `var(--series-${k + 1})` }} />
                            {n}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_ROWS.map((r) => {
                      const vals = metrics.map((m, k) => r.value(m, chosen[k].inputs));
                      const best = bestIndexes(vals, r.better);
                      return (
                        <tr key={r.label}>
                          <th scope="row">
                            {r.label}
                            <small>{r.better === "higher" ? "Higher is better" : "Lower is better"}</small>
                          </th>
                          {vals.map((v, k) => (
                            <td key={k} className={v !== null && v < 0 && r.better === "higher" ? "neg" : ""}>
                              {v === null ? <span className="mut">n/a</span> : <Best on={best.includes(k)} negative={v < 0}>{r.format(v)}</Best>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="cmp-m">
                <div className="pickers">
                  {([0, 1] as const).map((slot) => (
                    <label key={slot} className="fld">
                      <span className="flabel">Property {slot === 0 ? "A" : "B"}</span>
                      <select value={slot === 0 ? a : b} onChange={(e) => setPair(slot === 0 ? [Number(e.target.value), b] : [a, Number(e.target.value)])}>
                        {names.map((n, k) => (
                          <option key={k} value={k}>{n}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <ul className="mlist num">
                  {COMPARE_ROWS.map((r) => {
                    const vals = [a, b].map((k) => r.value(metrics[k], chosen[k].inputs));
                    const best = a === b ? [] : bestIndexes(vals, r.better);
                    return (
                      <li key={r.label} className="card">
                        <span className="ml">
                          {r.label}
                          <small>{r.better === "higher" ? "Higher is better" : "Lower is better"}</small>
                        </span>
                        {vals.map((v, j) => (
                          <span key={j} className="mv">
                            <small>{names[[a, b][j]]}</small>
                            {v === null ? <span className="mut">n/a</span> : <Best on={best.includes(j)} negative={v < 0}>{r.format(v)}</Best>}
                          </span>
                        ))}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>

            <section aria-labelledby="diff-h">
              <div className="shead">
                <h2 className="disp" id="diff-h">Different assumptions</h2>
                <p>Comparing properties built on different guesses can mislead. These are the assumptions that differ.</p>
              </div>
              <div className="card">
                {(() => {
                  const diff = differingAssumptions(chosen.map((d) => d.inputs));
                  return diff.length ? (
                    <table className="ct num">
                      <caption className="sr-only">Assumptions that differ between the properties</caption>
                      <thead>
                        <tr>
                          <th scope="col">Assumption</th>
                          {names.map((n, k) => <th key={k} scope="col">{n}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {diff.map((r) => (
                          <tr key={r.label}>
                            <th scope="row">{r.label}</th>
                            {r.values.map((v, k) => <td key={k}>{v}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ margin: 0, color: "var(--ink-2)" }}>Every assumption matches, so the numbers compare like for like.</p>
                  );
                })()}
              </div>
            </section>

            <section aria-labelledby="cc-h">
              <div className="shead">
                <h2 className="disp" id="cc-h">Cash flow over the hold</h2>
                <p>Cumulative cash flow after reserves for each property, base scenario, before income tax. Projections, not predictions.</p>
              </div>
              <CompareChart title="Cumulative cash flow" series={chosen.map((d, k) => ({ name: names[k], values: metrics[k].projection.years.map((y) => y.cumulativeCashFlow) }))} />
            </section>
          </>
        )}
        {chosen.length === 1 && deals.length > 1 && <p className="note">Tick one more property to compare.</p>}

        <PageFooter>RentWise is a modeling tool, not financial advice. A comparison is only as good as the assumptions behind each property.</PageFooter>
      </div>
    </div>
  );
}
