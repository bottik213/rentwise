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
import { GROUPS, closingDef, fieldDef, type FieldKey } from "@/components/forms/fields";
import { NumberField } from "@/components/forms/NumberField";
import { MetricCard } from "@/components/results/MetricCard";
import { Waterfall } from "@/components/results/Metrics";
import { PageSkeleton } from "@/components/results/PageSkeleton";
import { useI18n } from "@/i18n/client";
import { runScenarios } from "@/lib/finance/scenarios";
import type { AssumptionSource, PropertyInputs } from "@/lib/finance/types";
import { setAppState, useAppState } from "@/lib/storage";
import { breakEvenBadge, cashFlowBadge, cashOnCashBadge, cushion, verdict } from "@/lib/verdict";
import "./results.css";

const isFinancing = (k: string) => k === "downPaymentPct" || k === "annualInterestRate" || k === "loanTermYears";

export default function ResultsPage() {
  const s = useAppState();
  const router = useRouter();
  const i = useI18n();
  const { t, money: usd, pct, num, path } = i;
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
  const r = t.results;

  if (!p) {
    return (
      <div className="pg-results" style={{ height: "auto" }}>
        <div className="empty">
          {s.deals.length ? (
            <>
              <h1 className="disp">{r.noneOpen}</h1>
              <p>{r.youHave(s.deals.length)}</p>
              <div className="ctas">
                <Link href={path("/compare")} className="btn btn-primary">
                  {t.common.yourProperties} <Arrow />
                </Link>
                <Link href={path("/analyze")} className="btn btn-quiet">
                  {r.analyzeNew}
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="disp">{r.noneYet}</h1>
              <p>{r.noneYetText}</p>
              <div className="ctas">
                <Link href={path("/analyze")} className="btn btn-primary">
                  {t.common.analyzeProperty} <Arrow />
                </Link>
                <TryExampleButton className="btn btn-quiet" />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const exact = (v: number) => usd(Math.round(v), { exact: true });
  const whole = (v: number) => usd(Math.round(v));
  const rate = (v: number) => pct(v);
  const dExact = (d: number) => usd(Math.round(d), { exact: true, signed: true });
  const dWhole = (d: number) => usd(Math.round(d), { signed: true });
  const dPts = (d: number) => `${d > 0 ? "+" : "−"}${num(Math.abs(d * 100))} ${t.common.pts}`;

  const results = runScenarios(p, s.scenarios);
  const u = results.base; // headline = base column, so they can never disagree
  const v = verdict(u, s.constraints, p.monthlyRent, i);
  const cush = cushion(u, p.monthlyRent);

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
    if (s.plan && s.actuals.length && !confirm(r.lockConfirm(s.actuals.length))) return;
    const accepted = setAppState((x) => ({ ...x, plan: { inputs: x.property!, lockedAt: new Date().toISOString() } }));
    if (accepted) router.push(path("/performance"));
  };

  const field = (k: FieldKey) => {
    const def = fieldDef(t, k);
    return (
      <NumberField
        key={k}
        def={def}
        value={p[k]}
        disabled={p.allCash && isFinancing(k)}
        onCommit={(val) => setProp({ [k]: val })}
        source={def.source ? p.sources?.[k] : undefined}
        onSource={def.source ? (src) => setSource(k, src) : undefined}
      />
    );
  };

  const cf = u.reserveAdjustedCashFlow;
  const share = (x: number) => num(Math.abs(x * 100), 1);
  const shareBar = (be: number) => `${Math.max(0, Math.min(100, (be / p.monthlyRent) * 100))}%`;

  return (
    <div className="pg-results">
      <div className="prop">
        {s.isExample ? (
          <Image className="thumb" src={duplex} alt={r.thumbAlt} width={56} height={56} />
        ) : (
          <span className="thumb" aria-hidden>
            <Logo />
          </span>
        )}
        <div className="ttl">
          <h1 className="disp">{s.isExample ? t.common.exampleName : p.nickname || t.common.yourProperty}</h1>
          <p className="num">
            {r.sub(usd(p.purchasePrice), usd(p.monthlyRent))}
            {s.isExample && <> · <span className="tag">{t.common.synthetic}</span></>}
          </p>
        </div>
        <div className="acts">
          <Link href={path("/analyze")} className="btn btn-quiet btn-sm">
            {r.allInputs}
          </Link>
          {s.activeId && (
            <Link href={path(`/report/${s.activeId}`)} className="btn btn-quiet btn-sm">
              {t.common.report}
            </Link>
          )}
          <button type="button" onClick={markOwned} className="btn btn-primary btn-sm">
            {s.plan ? r.relock : r.markOwned} <Arrow />
          </button>
        </div>
      </div>

      <div className="split">
        <aside className={`aside scroll ${sheet ? "open" : ""}`} aria-label={r.quick}>
          <div className="shandle">
            <strong>{r.quick}</strong>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setSheet(false)}>
              {r.done}
            </button>
          </div>
          <h2 className="disp">{r.quick}</h2>
          <p className="sub">{r.quickSub}</p>
          <form ref={quickForm} noValidate onSubmit={(e) => e.preventDefault()}>
            {GROUPS.map((g) => (
              <fieldset key={g.id} className="grp">
                <legend>{t.groups[g.id].title}</legend>
                {g.id === "loan" && (
                  <label className="chk">
                    <input type="checkbox" checked={p.allCash} onChange={(e) => setProp({ allCash: e.target.checked })} />
                    {t.form.allCash}
                  </label>
                )}
                {g.keys.map((k) => (
                  <div key={k} style={{ display: "contents" }}>
                    {field(k)}
                    {k === "purchasePrice" && (
                      <NumberField
                        key={p.closingCostMode}
                        def={closingDef(t, p.closingCostMode !== "amount")}
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
                  {r.short}
                </span>
                <Badge st={v.st} label={v.label} knock="#fff" />
              </div>
              <p className="big num" aria-live="polite">
                {v.text}
              </p>
              <p className="fine">{r.fine}</p>
            </section>

            <section aria-labelledby="km-h">
              <div className="shead">
                <h2 className="disp" id="km-h">
                  {r.keyTitle}
                </h2>
                <p>{r.keySub}</p>
              </div>
              <div className="hgrid">
                <MetricCard id="cf" title={r.cf.title} value={cf} format={exact} unit={t.common.mo} negative={cf < 0} badge={cashFlowBadge(v.st, i)} delta={dExact}>
                  <p>
                    <b className="num">{cf >= 0 ? r.cf.yearIn(usd(cf * 12)) : r.cf.yearOut(usd(-cf * 12))}</b>
                  </p>
                  <p><b>{r.means}</b> {r.cf.means}</p>
                  <p><b>{r.how}</b> {r.cf.how}</p>
                  <p><b>{r.why}</b> {r.cf.why}</p>
                </MetricCard>
                <MetricCard
                  id="coc"
                  title={r.coc.title}
                  value={u.cashOnCash}
                  format={rate}
                  offText={t.common.na}
                  negative={(u.cashOnCash ?? 0) < 0}
                  badge={cashOnCashBadge(u.cashOnCash, s.constraints.minCashOnCash, i)}
                  delta={dPts}
                >
                  <p>
                    <b className="num">{r.coc.per100(usd(Math.max(0, u.cashOnCash ?? 0) * 10_000, { exact: true }), usd(10_000))}</b>
                  </p>
                  <p><b>{r.means}</b> {r.coc.means}</p>
                  <p><b>{r.how}</b> {r.coc.how}</p>
                  <p><b>{r.why}</b> {r.coc.why}</p>
                </MetricCard>
                <MetricCard id="be" title={r.be.title} value={u.breakEvenRent} format={whole} offText={t.common.notReachable} unit={t.common.mo} badge={breakEvenBadge(u, p.monthlyRent, i)} delta={dWhole} upIsGood={false}>
                  {cush && u.breakEvenRent !== null ? (
                    <>
                      <p>
                        <b className="num">{cush.amount >= 0 ? r.be.cushion(usd(cush.amount), share(cush.share)) : r.be.short(usd(-cush.amount), share(cush.share))}</b>
                      </p>
                      <div className="minibar" aria-hidden>
                        <i style={{ width: shareBar(u.breakEvenRent) }} />
                        <b style={{ left: shareBar(u.breakEvenRent) }} />
                      </div>
                      <p className="num" style={{ fontSize: 13 }}>
                        {r.be.line(usd(u.breakEvenRent), usd(p.monthlyRent))}
                      </p>
                    </>
                  ) : (
                    <p><b>{r.be.noRent}</b></p>
                  )}
                  <p><b>{r.means}</b> {r.be.means}</p>
                  <p><b>{r.how}</b> {r.be.how}</p>
                  <p><b>{r.why}</b> {r.be.why}</p>
                </MetricCard>
              </div>
              <div className="sgrid">
                <MetricCard id="cap" small title={r.cap.title} value={u.capRate} format={rate} offText={t.common.na} delta={dPts}>
                  <p><b>{r.means}</b> {r.cap.means}</p>
                  <p><b>{r.why}</b> {r.cap.why}</p>
                </MetricCard>
                <MetricCard id="noi" small title={r.noi.title} value={u.noi} format={exact} unit={t.common.mo} negative={u.noi < 0} delta={dExact}>
                  <p><b>{r.means}</b> {r.noi.means}</p>
                  <p><b>{r.why}</b> {r.noi.why}</p>
                </MetricCard>
                <MetricCard id="pi" small title={r.pi.title} value={u.monthlyPI} format={exact} delta={dExact} upIsGood={false}>
                  <p><b>{r.means}</b> {r.pi.means}</p>
                  <p><b>{r.why}</b> {r.pi.why}</p>
                </MetricCard>
                <MetricCard id="cash" small title={r.cash.title} value={u.cashInvested} format={whole} delta={dWhole} upIsGood={false}>
                  <p><b>{r.means}</b> {r.cash.means}</p>
                  <p><b>{r.why}</b> {r.cash.why}</p>
                </MetricCard>
              </div>
            </section>

            <section aria-labelledby="wf-h">
              <div className="shead">
                <h2 className="disp" id="wf-h">
                  {r.wfTitle}
                </h2>
                <p>{r.wfSub}</p>
              </div>
              <div className="card">
                <Waterfall u={u} cfStatus={v.st} />
              </div>
            </section>

            <PageFooter />
          </div>
        </div>
      </div>

      <div className="mob num">
        <span>
          {r.mobCf} <b>{usd(cf)}</b>
          {t.common.mo}
        </span>
        <button type="button" className="btn btn-sm" onClick={() => setSheet(true)}>
          {r.editAssumptions}
        </button>
      </div>
      <button type="button" tabIndex={-1} className={`scrim ${sheet ? "on" : ""}`} aria-label={r.closeAssumptions} onClick={() => setSheet(false)} />
    </div>
  );
}
