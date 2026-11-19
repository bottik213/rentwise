"use client";
import { useTapTip } from "@/components/useTapTip";
import { useI18n } from "@/i18n/client";
import type { VarianceContributor } from "@/lib/finance/types";

export interface MonthPoint {
  month: string;
  actual: number;
}

/** 1-2-5 step ticks covering [lo, hi]. */
export function niceTicks(lo: number, hi: number) {
  const raw = (hi - lo) / 4 || 10_000;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((x) => x * mag).find((x) => x >= raw)!;
  const a = Math.floor(lo / step) * step;
  const b = Math.ceil(hi / step) * step;
  const out: number[] = [];
  for (let t = a; t <= b + step / 2; t += step) out.push(t);
  return out;
}

function Column({ m, plan, y, zero, last, first, cur }: { m: MonthPoint; plan: number; y: (v: number) => number; zero: number; last: boolean; first: boolean; cur: boolean }) {
  const tip = useTapTip<HTMLDivElement>();
  const { t, money: usd, month: monthLabel } = useI18n();
  const below = m.actual < 0;
  const top = y(Math.max(m.actual, 0));
  const bottom = y(Math.min(m.actual, 0));
  const d = m.actual - plan;
  return (
    <div ref={tip.ref} className={`col tw ${first ? "first" : ""} ${last ? "last" : ""} ${tip.open ? "open" : ""}`}>
      <span className={`cb ${below ? "below" : ""} ${cur ? "cur" : ""}`} style={{ bottom: `${bottom}%`, height: `${Math.max(0.6, top - bottom)}%` }} />
      <span className="val num" style={{ bottom: below ? undefined : `calc(${top}% + 6px)`, top: below ? `calc(${100 - bottom}% + 6px)` : undefined }}>
        {usd(m.actual, { exact: true })}
      </span>
      <button
        type="button"
        className="hit"
        aria-label={t.chart.colAria(monthLabel(m.month), usd(m.actual, { exact: true }), usd(plan, { exact: true }))}
        aria-expanded={tip.open}
        onClick={tip.toggle}
      />
      <span className="pop up num" role="tooltip" style={{ bottom: `calc(${Math.max(top, zero)}% + 8px)` }}>
        <b>{monthLabel(m.month)}</b>
        <br />
        {t.chart.tip(usd(m.actual, { exact: true }), usd(plan, { exact: true }))}
        <br />
        <span>{d === 0 ? t.chart.onPlan : t.chart.off(usd(d, { exact: true, signed: true }), d < 0)}</span>
      </span>
    </div>
  );
}

/** One bar per recorded month (cash flow before CapEx) against the dashed plan line. */
export function PlanVsActual({ points, plan }: { points: MonthPoint[]; plan: number }) {
  const { t, money: usd, month: monthLabel, monthShort } = useI18n();
  const vals = points.map((p) => p.actual);
  const ticks = niceTicks(Math.min(0, plan, ...vals), Math.max(plan, ...vals, 1) * 1.15);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const y = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const cols = { gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` };
  return (
    <div className="card chart">
      <div className="legend" aria-hidden>
        <span>
          <i className="sw1" />
          {t.chart.actualCf}
        </span>
        <span>
          <i className="sw2" />
          {t.chart.planLegend(usd(plan, { exact: true }))}
        </span>
      </div>
      <div className="ch">
        <div className="ya num" aria-hidden>
          {ticks.map((t) => (
            <span key={t} style={{ bottom: `${y(t)}%` }}>
              {usd(t)}
            </span>
          ))}
        </div>
        <div
          className="plot"
          role="group"
          aria-label={t.chart.aria(usd(plan, { exact: true }), points.map((p) => `${monthLabel(p.month)} ${usd(p.actual, { exact: true })}`).join(", "))}
          style={cols}
        >
          {ticks.map((t) => (
            <span key={t} className={`gl ${t === 0 ? "zero" : ""}`} style={{ bottom: `${y(t)}%` }} aria-hidden />
          ))}
          <span className="plan" style={{ bottom: `${y(plan)}%` }} aria-hidden>
            <b>{t.chart.plan}</b>
          </span>
          {points.map((p, i) => (
            <Column key={p.month} m={p} plan={plan} y={y} zero={y(0)} first={i < 2} last={i >= points.length - 2 && points.length > 2} cur={i === points.length - 1} />
          ))}
        </div>
      </div>
      <div className="xa" style={cols} aria-hidden>
        {points.map((p) => (
          <span key={p.month}>{monthShort(p.month)}</span>
        ))}
      </div>
    </div>
  );
}

/** Each line's effect on the month's cash flow: left of center is worse than plan, right is better. */
export function Contributors({ movers, total, month }: { movers: VarianceContributor[]; total: number; month: string }) {
  const { t, money: usd, month: monthLabel } = useI18n();
  const max = Math.max(1, Math.abs(total), ...movers.map((c) => Math.abs(c.impact)));
  const w = (v: number) => `${(Math.abs(v) / max) * 50}%`;
  const row = (label: string, v: number, tot = false) => (
    <div key={label} className={`dr ${tot ? "tot" : ""}`}>
      <span>{label}</span>
      <span className="t" aria-hidden>
        <span className="z" />
        {v !== 0 && <i className={v < 0 ? "n" : "p"} style={{ width: w(v) }} />}
      </span>
      <span className={`r num ${v < 0 ? "neg" : v > 0 ? "pos" : ""}`}>{usd(v, { exact: true, signed: true })}</span>
    </div>
  );
  return (
    <div
      className="dv"
      role="img"
      aria-label={t.chart.contribAria(monthLabel(month), movers.map((c) => `${t.cat[c.category]} ${usd(c.impact, { exact: true, signed: true })}`).join(", ") || t.chart.nothingMoved, usd(total, { exact: true, signed: true }))}
    >
      {movers.map((c) => row(t.cat[c.category], c.impact))}
      {row(t.chart.totalVsPlan, total, true)}
    </div>
  );
}
