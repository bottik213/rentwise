"use client";
import { useTapTip } from "@/components/useTapTip";
import { CATEGORY_LABEL } from "@/lib/explain";
import type { VarianceContributor } from "@/lib/finance/types";
import { monthLabel, usd } from "@/lib/format";

export interface MonthPoint {
  month: string;
  actual: number;
}

/** 1-2-5 step ticks covering [lo, hi]. */
function niceTicks(lo: number, hi: number) {
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
  const below = m.actual < 0;
  const top = y(Math.max(m.actual, 0));
  const bottom = y(Math.min(m.actual, 0));
  const d = m.actual - plan;
  return (
    <div ref={tip.ref} className={`col tw ${first ? "first" : ""} ${last ? "last" : ""} ${tip.open ? "open" : ""}`}>
      <span className={`bar ${below ? "below" : ""} ${cur ? "cur" : ""}`} style={{ bottom: `${bottom}%`, height: `${Math.max(0.6, top - bottom)}%` }} />
      <span className="val num" style={{ bottom: below ? undefined : `calc(${top}% + 6px)`, top: below ? `calc(${100 - bottom}% + 6px)` : undefined }}>
        {usd(m.actual, { exact: true })}
      </span>
      <button
        type="button"
        className="hit"
        aria-label={`${monthLabel(m.month)}: ${usd(m.actual, { exact: true })} actual against ${usd(plan, { exact: true })} planned`}
        aria-expanded={tip.open}
        onClick={tip.toggle}
      />
      <span className="pop up num" role="tooltip" style={{ bottom: `calc(${Math.max(top, zero)}% + 8px)` }}>
        <b>{monthLabel(m.month)}</b>
        <br />
        {usd(m.actual, { exact: true })} actual · {usd(plan, { exact: true })} plan
        <br />
        <span>{d === 0 ? "On plan" : `${usd(d, { exact: true, signed: true })} ${d < 0 ? "below" : "above"} plan`}</span>
      </span>
    </div>
  );
}

/** One bar per recorded month (cash flow before CapEx) against the dashed plan line. */
export function PlanVsActual({ points, plan }: { points: MonthPoint[]; plan: number }) {
  const vals = points.map((p) => p.actual);
  const ticks = niceTicks(Math.min(0, plan, ...vals), Math.max(plan, ...vals, 1) * 1.15);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const y = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const cols = { gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` };
  return (
    <div className="card">
      <div className="legend" aria-hidden>
        <span>
          <i className="sw1" />
          Actual cash flow
        </span>
        <span>
          <i className="sw2" />
          Plan, {usd(plan, { exact: true })}/mo
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
          aria-label={`Actual cash flow by month against a plan of ${usd(plan, { exact: true })}: ${points.map((p) => `${monthLabel(p.month)} ${usd(p.actual, { exact: true })}`).join(", ")}.`}
          style={cols}
        >
          {ticks.map((t) => (
            <span key={t} className={`gl ${t === 0 ? "zero" : ""}`} style={{ bottom: `${y(t)}%` }} aria-hidden />
          ))}
          <span className="plan" style={{ bottom: `${y(plan)}%` }} aria-hidden>
            <b>Plan</b>
          </span>
          {points.map((p, i) => (
            <Column key={p.month} m={p} plan={plan} y={y} zero={y(0)} first={i < 2} last={i >= points.length - 2 && points.length > 2} cur={i === points.length - 1} />
          ))}
        </div>
      </div>
      <div className="xa" style={cols} aria-hidden>
        {points.map((p) => (
          <span key={p.month}>{monthLabel(p.month).split(" ")[0]}</span>
        ))}
      </div>
    </div>
  );
}

/** Each line's effect on the month's cash flow: left of center is worse than plan, right is better. */
export function Contributors({ movers, total, month }: { movers: VarianceContributor[]; total: number; month: string }) {
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
      aria-label={`Effect on cash flow by category in ${monthLabel(month)}: ${movers.map((c) => `${CATEGORY_LABEL[c.category]} ${usd(c.impact, { exact: true, signed: true })}`).join(", ") || "nothing moved"}. Total ${usd(total, { exact: true, signed: true })}.`}
    >
      {movers.map((c) => row(CATEGORY_LABEL[c.category], c.impact))}
      {row("Total vs. plan", total, true)}
    </div>
  );
}
