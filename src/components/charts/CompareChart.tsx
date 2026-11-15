"use client";
import { useTapTip } from "@/components/useTapTip";
import { usd } from "@/lib/format";
import { niceTicks } from "./PlanVsActual";

export interface Series {
  name: string;
  /** One value per year of that deal's hold; holds can differ. */
  values: number[];
}

const axis = (t: number) => (Math.abs(t) >= 1_000_000 ? `${t < 0 ? "−" : ""}$${Math.abs(t) / 100_000}k` : usd(t));

function YearHit({ year, series, first, last }: { year: number; series: Series[]; first: boolean; last: boolean }) {
  const tip = useTapTip<HTMLDivElement>();
  const rows = series.flatMap((s, k) => (s.values[year - 1] === undefined ? [] : [{ k, name: s.name, v: s.values[year - 1] }]));
  return (
    <div ref={tip.ref} className={`col tw ${first ? "first" : ""} ${last ? "last" : ""} ${tip.open ? "open" : ""}`}>
      <button type="button" className="hit" aria-label={`Year ${year}: ${rows.map((r) => `${r.name} ${usd(r.v)}`).join(", ")}`} aria-expanded={tip.open} onClick={tip.toggle} />
      <span className="pop up num" role="tooltip" style={{ bottom: "calc(100% + 8px)" }}>
        <b>Year {year}</b>
        {rows.map((r) => (
          <span key={r.k} className="ovr">
            <i style={{ background: `var(--series-${r.k + 1})` }} />
            {r.name}: {usd(r.v)}
          </span>
        ))}
      </span>
    </div>
  );
}

/** Cumulative values per deal on one axis, in the forecast style, each line named at its end. */
export function CompareChart({ title, series }: { title: string; series: Series[] }) {
  const all = series.flatMap((s) => s.values);
  const ticks = niceTicks(Math.min(0, ...all), Math.max(1, ...all) * 1.1);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const y = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const n = Math.max(...series.map((s) => s.values.length));
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const cols = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` };
  const labelEvery = n > 15 ? 5 : n > 6 ? 2 : 1;

  // End labels, nudged apart so names never overlap (at least 7% of the plot height between them).
  const ends = series.map((s, k) => ({ k, name: s.name, at: y(s.values[s.values.length - 1]) })).sort((a, b) => a.at - b.at);
  for (let j = 1; j < ends.length; j++) ends[j].at = Math.max(ends[j].at, ends[j - 1].at + 7);

  return (
    <div className="card chart ov">
      <p style={{ margin: "0 0 12px", fontWeight: 600 }}>{title}</p>
      <div className="legend" aria-hidden>
        {series.map((s, k) => (
          <span key={k}>
            <i className="swl" style={{ borderColor: `var(--series-${k + 1})` }} />
            {s.name}
          </span>
        ))}
      </div>
      <div className="ch">
        <div className="ya num" aria-hidden>
          {ticks.map((t) => (
            <span key={t} style={{ bottom: `${y(t)}%` }}>
              {axis(t)}
            </span>
          ))}
        </div>
        <div className="plot" role="group" aria-label={`${title}, projected: ${series.map((s) => `${s.name} ${usd(s.values[s.values.length - 1])} after ${s.values.length} years`).join("; ")}.`} style={cols}>
          {ticks.map((t) => (
            <span key={t} className={`gl ${t === 0 ? "zero" : ""}`} style={{ bottom: `${y(t)}%` }} aria-hidden />
          ))}
          <svg className="lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            {series.map((s, k) => (
              <polyline
                key={k}
                points={s.values.map((v, i) => `${x(i)},${100 - y(v)}`).join(" ")}
                fill="none"
                stroke={`var(--series-${k + 1})`}
                strokeWidth={2}
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {Array.from({ length: n }, (_, i) => (
            <YearHit key={i} year={i + 1} series={series} first={i < 2} last={i >= n - 2 && n > 2} />
          ))}
        </div>
        <div className="ends num" aria-hidden>
          {ends.map((e) => (
            <span key={e.k} style={{ bottom: `${e.at}%` }}>
              <i style={{ background: `var(--series-${e.k + 1})` }} />
              {e.name}
            </span>
          ))}
        </div>
      </div>
      <div className="xa num" style={cols} aria-hidden>
        {Array.from({ length: n }, (_, i) => (
          <span key={i}>{(i + 1) % labelEvery === 0 || i === 0 ? i + 1 : ""}</span>
        ))}
      </div>
    </div>
  );
}
