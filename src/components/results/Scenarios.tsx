"use client";
import { useState } from "react";
import type { ScenarioAdjustments, ScenarioName, Underwriting } from "@/lib/finance/types";
import { pct, usd } from "@/lib/format";
import { setAppState } from "@/lib/storage";
import { parseNumber } from "@/lib/validation";

const ADJ: [key: keyof ScenarioAdjustments, label: string, unit: string, min: number, max: number][] = [
  ["rentChangePct", "Rent", "%", -100, 100],
  ["vacancyPts", "Vacancy", "pts", -100, 100],
  ["maintenancePts", "Maintenance", "pts", -100, 100],
  ["capexPts", "CapEx reserve", "pts", -100, 100],
  ["fixedCostChangePct", "Fixed costs (tax, insurance, HOA, utilities)", "%", -100, 500],
];
const COLS: [ScenarioName, string][] = [["conservative", "Conservative"], ["base", "Base"], ["optimistic", "Optimistic"]];

export function Scenarios({ scenarios, results }: { scenarios: Record<ScenarioName, ScenarioAdjustments>; results: Record<ScenarioName, Underwriting> }) {
  const set = (name: ScenarioName, key: keyof ScenarioAdjustments, v: number) =>
    setAppState((x) => ({ ...x, scenarios: { ...x.scenarios, [name]: { ...x.scenarios[name], [key]: v } } }));

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[520px] text-sm">
        <caption className="sr-only">Scenario adjustments and results</caption>
        <thead>
          <tr className="border-b border-line text-left text-muted">
            <th scope="col" className="py-2 font-normal">Adjustment vs. your inputs</th>
            {COLS.map(([k, label]) => <th key={k} scope="col" className="w-32 py-2 text-right font-normal">{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {ADJ.map(([key, label, unit, min, max]) => (
            <tr key={key} className="border-b border-line/60">
              <th scope="row" className="py-1.5 text-left font-normal text-muted">{label} <span className="text-xs">({unit})</span></th>
              {COLS.map(([name, col]) => (
                <td key={name} className="py-1.5 text-right">
                  {name === "base" ? (
                    <span className="num text-muted">0</span>
                  ) : (
                    <PctInput label={`${col} ${label} ${unit}`} value={scenarios[name][key]} min={min} max={max} onCommit={(v) => set(name, key, v)} />
                  )}
                </td>
              ))}
            </tr>
          ))}
          <ResultRow label="Cash flow after reserves /mo" results={results} pick={(u) => usd(u.reserveAdjustedCashFlow, { exact: true })} strong />
          <ResultRow label="Cash-on-cash" results={results} pick={(u) => pct(u.cashOnCash)} />
          <ResultRow label="NOI /mo" results={results} pick={(u) => usd(u.noi)} />
        </tbody>
      </table>
    </div>
  );
}

function ResultRow({ label, results, pick, strong }: { label: string; results: Record<ScenarioName, Underwriting>; pick: (u: Underwriting) => string; strong?: boolean }) {
  return (
    <tr className={strong ? "border-t border-ink font-medium" : ""}>
      <th scope="row" className="py-2 text-left font-normal">{label}</th>
      {COLS.map(([name]) => (
        <td key={name} className={`num py-2 text-right ${strong && results[name].reserveAdjustedCashFlow < 0 ? "text-bad" : ""}`}>{pick(results[name])}</td>
      ))}
    </tr>
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
      onBlur={() => { if (!invalid) setDraft(null); }}
      className={`num h-9 w-20 rounded-md border bg-bg px-2 text-right outline-none focus:border-ink focus:ring-1 focus:ring-ink ${invalid ? "border-bad" : "border-line hover:border-muted"}`}
    />
  );
}
