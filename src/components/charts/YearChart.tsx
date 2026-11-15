"use client";
import { useTapTip } from "@/components/useTapTip";
import { usd } from "@/lib/format";
import { niceTicks } from "./PlanVsActual";

function Column({ year, v, y, zero, first, last }: { year: number; v: number; y: (v: number) => number; zero: number; first: boolean; last: boolean }) {
  const tip = useTapTip<HTMLDivElement>();
  const below = v < 0;
  const top = y(Math.max(v, 0));
  const bottom = y(Math.min(v, 0));
  return (
    <div ref={tip.ref} className={`col tw ${first ? "first" : ""} ${last ? "last" : ""} ${tip.open ? "open" : ""}`}>
      <span className={`cb fc ${below ? "below" : ""}`} style={{ bottom: `${bottom}%`, height: `${Math.max(0.6, top - bottom)}%` }} />
      <button type="button" className="hit" aria-label={`Year ${year}: ${usd(v)} projected`} aria-expanded={tip.open} onClick={tip.toggle} />
      <span className="pop up num" role="tooltip" style={{ bottom: `calc(${Math.max(top, zero)}% + 8px)` }}>
        <b>Year {year}</b>
        <br />
        {usd(v)} projected
      </span>
    </div>
  );
}

/** Compact axis labels ("$150k") so six-figure ticks fit the narrow y-axis on a phone. */
const axis = (t: number) => (Math.abs(t) >= 1_000_000 ? `${t < 0 ? "−" : ""}$${Math.abs(t) / 100_000}k` : usd(t));

/** One projected value per year, drawn in the forecast style (dashed outline). */
export function YearChart({ title, values, legend }: { title: string; values: number[]; legend: string }) {
  const ticks = niceTicks(Math.min(0, ...values), Math.max(1, ...values) * 1.1);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const y = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const n = values.length;
  const cols = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` };
  const labelEvery = n > 15 ? 5 : 1;
  return (
    <div className="card chart yr">
      <p style={{ margin: "0 0 12px", fontWeight: 600 }}>{title}</p>
      <div className="legend" aria-hidden>
        <span>
          <i className="sw3" />
          {legend}
        </span>
      </div>
      <div className="ch">
        <div className="ya num" aria-hidden>
          {ticks.map((t) => (
            <span key={t} style={{ bottom: `${y(t)}%` }}>
              {axis(t)}
            </span>
          ))}
        </div>
        <div className="plot" role="group" aria-label={`${title}, projected: ${values.map((v, i) => `year ${i + 1} ${usd(v)}`).join(", ")}.`} style={cols}>
          {ticks.map((t) => (
            <span key={t} className={`gl ${t === 0 ? "zero" : ""}`} style={{ bottom: `${y(t)}%` }} aria-hidden />
          ))}
          {values.map((v, i) => (
            <Column key={i} year={i + 1} v={v} y={y} zero={y(0)} first={i < 2} last={i >= n - 2 && n > 2} />
          ))}
        </div>
      </div>
      <div className="xa num" style={cols} aria-hidden>
        {values.map((_, i) => (
          <span key={i}>{(i + 1) % labelEvery === 0 || i === 0 ? i + 1 : ""}</span>
        ))}
      </div>
    </div>
  );
}
