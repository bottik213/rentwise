"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageFooter } from "@/components/DataControls";
import { Arrow, StatusIcon } from "@/components/Icons";
import { PageSkeleton } from "@/components/results/PageSkeleton";
import { TryExampleButton } from "@/components/TryExampleButton";
import { useI18n } from "@/i18n/client";
import { bestIndexes, compareRows, dealMetrics, differingAssumptions } from "@/lib/compare";
import { type Deal, deleteDeal, duplicateDeal, importAppData, openDeal, renameDeal, useAppState } from "@/lib/storage";
import { runScenarios } from "@/lib/finance/scenarios";
import "../performance/performance.css";
import "./compare.css";

const MAX = 4;

/** The best value per row: check icon and the positive treatment (a negative best keeps its negative color). */
function Best({ on, negative, children }: { on: boolean; negative: boolean; children: React.ReactNode }) {
  const { t } = useI18n();
  return on ? (
    <span className={`best ${negative ? "neg" : "pos"}`}>
      <StatusIcon st="good" size={12} />
      {children}
      <span className="sr-only">{t.compare.best}</span>
    </span>
  ) : (
    <>{children}</>
  );
}

export default function ComparePage() {
  const s = useAppState();
  const router = useRouter();
  const i = useI18n();
  const { t, money: usd, path } = i;
  const C = t.compare;
  const nameOf = (d: Deal) => (d.isExample ? t.common.exampleName : d.inputs.nickname || t.common.untitled);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [pair, setPair] = useState<[number, number]>([0, 1]);
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (!s) return <PageSkeleton />;

  const deals = s.deals;
  const ids = (picked ?? deals.slice(0, MAX).map((d) => d.id)).filter((id) => deals.some((d) => d.id === id));
  const chosen = ids.map((id) => deals.find((d) => d.id === id)!);
  const metrics = chosen.map((d) => dealMetrics(d.inputs, s.scenarios));
  const ROWS = compareRows(i);
  const names = chosen.map(nameOf);
  const toggle = (id: string, on: boolean) => setPicked(on ? [...ids, id].slice(0, MAX) : ids.filter((x) => x !== id));
  const open = (id: string, to: string) => openDeal(id) && router.push(path(to));
  const [a, b] = [Math.min(pair[0], chosen.length - 1), Math.min(pair[1], chosen.length - 1)];

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5_000_000) return setMsg(C.tooLarge);
    const r = importAppData(await file.text());
    setMsg(typeof r === "number" ? C.added(r) : C.importErr[r]);
  };

  return (
    <div className="pg-actuals pg-compare">
      <div className="wrap">
        <header className="ph">
          <div className="txt">
            <h1 className="disp">{t.common.yourProperties}</h1>
            <p>{C.intro(MAX)}</p>
          </div>
          <div className="acts">
            <label className="btn btn-quiet btn-sm">
              {C.import}
              <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { void onImport(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openDeal(null) && router.push(path("/analyze"))}>
              {C.newProperty} <Arrow />
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
            <h2 className="disp" style={{ margin: 0, fontSize: 22 }}>{C.noneTitle}</h2>
            <p style={{ margin: "8px 0 16px", color: "var(--ink-2)" }}>{C.noneText}</p>
            <div className="ctas">
              <Link href={path("/analyze")} className="btn btn-primary">{t.common.analyzeProperty} <Arrow /></Link>
              <TryExampleButton className="btn btn-quiet" />
            </div>
          </section>
        ) : (
          <section className="card" aria-labelledby="list-h">
            <h2 className="disp" id="list-h" style={{ margin: "0 0 12px", fontSize: 22 }}>{C.saved}</h2>
            <ul className="dlist num">
              {deals.map((d) => {
                const u = runScenarios(d.inputs, s.scenarios).base;
                const on = ids.includes(d.id);
                return (
                  <li key={d.id} className={d.id === s.activeId ? "cur" : ""}>
                    <label className="chk pick">
                      <input type="checkbox" checked={on} disabled={!on && ids.length >= MAX} onChange={(e) => toggle(d.id, e.target.checked)} />
                      <span className="sr-only">{C.compareX(nameOf(d))}</span>
                    </label>
                    <div className="nm">
                      {renaming?.id === d.id ? (
                        <form className="rn" onSubmit={(e) => { e.preventDefault(); renameDeal(d.id, renaming.draft); setRenaming(null); }}>
                          <span className="inp">
                            <input aria-label={C.propertyName} maxLength={60} value={renaming.draft} autoFocus onChange={(e) => setRenaming({ id: d.id, draft: e.target.value })} />
                          </span>
                          <button type="submit" className="lnk">{t.common.save}</button>
                          <button type="button" className="lnk" onClick={() => setRenaming(null)}>{t.common.cancel}</button>
                        </form>
                      ) : (
                        <b>{nameOf(d)}</b>
                      )}
                      <span className="meta">
                        {usd(d.inputs.purchasePrice)} · {C.rent(usd(d.inputs.monthlyRent))}
                        {d.isExample && <> · <span className="tag">{t.common.synthetic}</span></>}
                        {d.plan && <> · <span className="tag">{C.owned}</span></>}
                        {d.id === s.activeId && <> · {C.openNow}</>}
                      </span>
                    </div>
                    <span className={`cf ${u.reserveAdjustedCashFlow < 0 ? "neg" : ""}`}>
                      {usd(u.reserveAdjustedCashFlow, { exact: true })}
                      <small>{t.common.mo}</small>
                    </span>
                    <span className="acts2">
                      <button type="button" className="lnk" onClick={() => open(d.id, "/results")}>{t.common.open}</button>
                      <Link href={path(`/report/${d.id}`)} className="lnk">{t.common.report}</Link>
                      <button type="button" className="lnk" onClick={() => setRenaming({ id: d.id, draft: d.inputs.nickname ?? "" })}>{C.rename}</button>
                      <button type="button" className="lnk" onClick={() => duplicateDeal(d.id, (n) => t.common.copyOf(n || t.common.untitled))}>{C.duplicate}</button>
                      <button
                        type="button"
                        className="lnk danger"
                        onClick={() => confirm(C.deleteConfirm(nameOf(d), d.actuals.length, d.ledger.payments.length + d.ledger.expenses.length > 0)) && deleteDeal(d.id)}
                      >
                        {t.common.delete}
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="note" style={{ margin: "12px 0 0" }}>
              {C.listNote}
            </p>
          </section>
        )}

        {chosen.length >= 2 && (
          <>
            <section aria-labelledby="cmp-h">
              <div className="shead">
                <h2 className="disp" id="cmp-h">{C.sideTitle}</h2>
                <p>{C.sideSub}</p>
              </div>

              <div className="card cmp-d">
                <table className="ct num cmp">
                  <caption className="sr-only">{C.caption(names.join(", "))}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{C.metric}</th>
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
                    {ROWS.map((r) => {
                      const vals = metrics.map((m, k) => r.value(m, chosen[k].inputs));
                      const best = bestIndexes(vals, r.better);
                      return (
                        <tr key={r.label}>
                          <th scope="row">
                            {r.label}
                            <small>{r.better === "higher" ? C.higher : C.lower}</small>
                          </th>
                          {vals.map((v, k) => (
                            <td key={k} className={v !== null && v < 0 && r.better === "higher" ? "neg" : ""}>
                              {v === null ? <span className="mut">{t.common.na}</span> : <Best on={best.includes(k)} negative={v < 0}>{r.format(v)}</Best>}
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
                      <span className="flabel">{C.slot(slot === 0 ? "A" : "B")}</span>
                      <select value={slot === 0 ? a : b} onChange={(e) => setPair(slot === 0 ? [Number(e.target.value), b] : [a, Number(e.target.value)])}>
                        {names.map((n, k) => (
                          <option key={k} value={k}>{n}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <ul className="mlist num">
                  {ROWS.map((r) => {
                    const vals = [a, b].map((k) => r.value(metrics[k], chosen[k].inputs));
                    const best = a === b ? [] : bestIndexes(vals, r.better);
                    return (
                      <li key={r.label} className="card">
                        <span className="ml">
                          {r.label}
                          <small>{r.better === "higher" ? C.higher : C.lower}</small>
                        </span>
                        {vals.map((v, j) => (
                          <span key={j} className="mv">
                            <small>{names[[a, b][j]]}</small>
                            {v === null ? <span className="mut">{t.common.na}</span> : <Best on={best.includes(j)} negative={v < 0}>{r.format(v)}</Best>}
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
                <h2 className="disp" id="diff-h">{C.diffTitle}</h2>
                <p>{C.diffSub}</p>
              </div>
              <div className="card">
                {(() => {
                  const diff = differingAssumptions(chosen.map((d) => d.inputs), i);
                  return diff.length ? (
                    <table className="ct num">
                      <caption className="sr-only">{C.diffCaption}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{C.assumption}</th>
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
                    <p style={{ margin: 0, color: "var(--ink-2)" }}>{C.allMatch}</p>
                  );
                })()}
              </div>
            </section>
          </>
        )}
        {chosen.length === 1 && deals.length > 1 && <p className="note">{C.oneMore}</p>}

        <PageFooter />
      </div>
    </div>
  );
}
