"use client";
import { useState } from "react";
import { Chevron } from "@/components/Icons";
import { DEFAULT_SCENARIOS } from "@/lib/finance/scenarios";
import type { ScenarioAdjustments, ScenarioName, Underwriting } from "@/lib/finance/types";
import { pct, usd } from "@/lib/format";
import { setAppState } from "@/lib/storage";
import { parseNumber } from "@/lib/validation";

const ADJ: [key: keyof ScenarioAdjustments, label: string, unit: string, min: number, max: number][] = [
  ["rentChangePct", "Rent", "%", -100, 100],
  ["vacancyPts", "Vacancy", "pts", -100, 100],
  ["maintenancePts", "Maintenance", "pts", -100, 100],
  ["capexPts", "CapEx reserve", "pts", -100, 100],
  ["fixedCostChangePct", "Fixed costs: tax, insurance, HOA, utilities", "%", -100, 500],
  ["rentGrowthPts", "Rent growth, projection", "pts/yr", -20, 20],
  ["expenseGrowthPts", "Expense growth, projection", "pts/yr", -20, 20],
  ["valueGrowthPts", "Value growth, projection", "pts/yr", -20, 20],
];
const COLS: [ScenarioName, string][] = [
  ["conservative", "Conservative"],
  ["base", "Base"],
  ["optimistic", "Optimistic"],
];

export function Scenarios({ scenarios, results }: { scenarios: Record<ScenarioName, ScenarioAdjustments>; results: Record<ScenarioName, Underwriting> }) {
  const set = (name: ScenarioName, key: keyof ScenarioAdjustments, v: number) =>
    setAppState((x) => ({ ...x, scenarios: { ...x.scenarios, [name]: { ...x.scenarios[name], [key]: v } } }));

  const cf = COLS.map(([n]) => results[n].reserveAdjustedCashFlow);
  let lo = Math.min(0, ...cf);
  let hi = Math.max(0, ...cf);
  const pad = (hi - lo) * 0.12 || 5_000;
  lo -= pad;
  hi += pad;
  const X = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const [cons, , opt] = cf;
  const bandL = X(Math.min(cons, opt));
  const bandW = X(Math.max(cons, opt)) - bandL;
  const caption =
    cons < 0
      ? `In the conservative case, this property would cost you about ${usd(-cons)} a month out of pocket.`
      : `Even in the conservative case, it still brings in about ${usd(cons)} a month.`;

  return (
    <>
      <div className="scn">
        {COLS.map(([name, label]) => {
          const u = results[name];
          const neg = u.reserveAdjustedCashFlow < 0;
          return (
            <div key={name} className={`sc ${name === "base" ? "base" : ""}`}>
              <div className="n">
                <span>{label}</span>
                {name === "base" && <span className="tag">Your inputs</span>}
              </div>
              <div className={`cf num ${neg ? "neg" : ""}`}>
                {usd(u.reserveAdjustedCashFlow, { exact: true })}
                <small>/mo</small>
              </div>
              <dl className="num">
                <dt>Cash-on-cash</dt>
                <dd className={u.cashOnCash !== null && u.cashOnCash < 0 ? "neg" : ""}>{pct(u.cashOnCash)}</dd>
                <dt>NOI</dt>
                <dd>{usd(u.noi)}/mo</dd>
              </dl>
            </div>
          );
        })}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <p style={{ margin: 0, fontWeight: 600 }}>Monthly cash flow range</p>
        <div
          className="rng num"
          role="img"
          aria-label={`Cash flow range from ${usd(cons)} conservative to ${usd(opt)} optimistic, base ${usd(cf[1])}.`}
        >
          <span className="ln" />
          <span className="band" style={{ left: `${bandL}%`, width: `${bandW}%` }} />
          <span className="z" style={{ left: `${X(0)}%` }} />
          <span className="zt" style={{ left: `${X(0)}%` }}>
            $0
          </span>
          {COLS.map(([name, label], j) => (
            <span key={name}>
              <span className={`dot ${name === "base" ? "base" : cf[j] < 0 ? "bad" : "good"}`} style={{ left: `${X(cf[j])}%` }} />
              <span className="dl2" style={{ left: `${X(cf[j])}%` }}>
                {label}
                <br />
                <b>{usd(cf[j])}</b>
              </span>
            </span>
          ))}
        </div>
        <p className="cap" style={{ marginTop: 8 }}>
          {caption}
        </p>
        <details className="x">
          <summary>
            <Chevron />
            Edit scenario assumptions
          </summary>
          <div className="xb">
            <table className="adj num">
              <caption className="sr-only">Scenario adjustments</caption>
              <thead>
                <tr>
                  <th scope="col">Change from your inputs</th>
                  {COLS.map(([k, label]) => (
                    <th key={k} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ADJ.map(([key, label, unit, min, max]) => (
                  <tr key={key}>
                    <th scope="row">
                      {label} ({unit})
                    </th>
                    {COLS.map(([name, col]) => (
                      <td key={name}>
                        {name === "base" ? (
                          <span style={{ color: "var(--muted)" }}>0</span>
                        ) : (
                          <PctInput label={`${col} ${label} ${unit}`} value={scenarios[name][key] ?? DEFAULT_SCENARIOS[name][key] ?? 0} min={min} max={max} onCommit={(v) => set(name, key, v)} />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note">Illustrative adjustments, not forecasts. Financing and purchase costs stay the same in every case.</p>
          </div>
        </details>
      </div>
    </>
  );
}

/** Edits a fraction as signed percent / points. Commits only in-range numbers. */
function PctInput({ label, value, min, max, onCommit }: { label: string; value: number; min: number; max: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const n = Number((value * 100).toFixed(2));
  const shown = draft ?? `${n > 0 ? "+" : ""}${n}`;
  const parsed = draft === null ? null : parseNumber(draft);
  const invalid = draft !== null && (parsed === null || parsed < min || parsed > max);
  return (
    <input
      aria-label={label}
      aria-invalid={invalid}
      inputMode="decimal"
      value={shown}
      onFocus={() => setDraft(shown)}
      onChange={(e) => {
        setDraft(e.target.value);
        const p = parseNumber(e.target.value);
        if (p !== null && p >= min && p <= max) onCommit(p / 100);
      }}
      onBlur={() => {
        if (!invalid) setDraft(null);
      }}
    />
  );
}
