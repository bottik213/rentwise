"use client";
import { useId, useState } from "react";
import type { AssumptionSource } from "@/lib/finance/types";
import { parseNumber } from "@/lib/validation";
import { type FieldDef, toDisplay, toEngine } from "./fields";

const SOURCES: AssumptionSource[] = ["estimate", "listing", "bill", "quote", "document"];

function validate(def: Pick<FieldDef, "kind" | "min" | "max">, raw: string): { value: number } | { error: string } {
  const n = parseNumber(raw);
  if (n === null) return { error: "Enter a number" };
  if (n < def.min || n > def.max) return { error: `Between ${def.min.toLocaleString()} and ${def.max.toLocaleString()}` };
  if (def.kind === "years" && !Number.isInteger(n)) return { error: "Whole years only" };
  return { value: toEngine(def.kind, n) };
}

interface Props {
  def: Pick<FieldDef, "label" | "kind" | "suffix" | "help" | "min" | "max">;
  value: number | undefined;
  onCommit: (v: number) => void;
  disabled?: boolean;
  source?: AssumptionSource;
  onSource?: (s: AssumptionSource) => void;
  compact?: boolean;
}

/** Text input that commits only valid values; the draft (and its error) stays visible while invalid. */
export function NumberField({ def, value, onCommit, disabled, source, onSource, compact }: Props) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === undefined ? "" : toDisplay(def.kind, value));
  const result = draft === null ? null : validate(def, draft);
  const error = result && "error" in result ? result.error : value === undefined && draft !== null ? "Required" : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">{def.label}</label>
        {onSource && (
          <select
            aria-label={`${def.label} source`}
            value={source ?? "estimate"}
            onChange={(e) => onSource(e.target.value as AssumptionSource)}
            className="rounded-sm bg-transparent text-xs text-muted hover:text-ink"
          >
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>
      <div
        className={`flex h-11 items-center rounded-md border bg-bg px-3 transition-colors focus-within:border-ink focus-within:ring-1 focus-within:ring-ink ${
          error ? "border-bad" : "border-line hover:border-muted"
        } ${disabled ? "opacity-50" : ""}`}
      >
        {def.kind === "money" && <span className="mr-1 text-muted" aria-hidden>$</span>}
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          value={shown}
          aria-invalid={!!error}
          aria-describedby={`${id}-help`}
          onFocus={() => setDraft(shown)}
          onChange={(e) => {
            setDraft(e.target.value);
            const r = validate(def, e.target.value);
            if ("value" in r) onCommit(r.value);
          }}
          onBlur={() => { if (result && "value" in result) setDraft(null); }}
          className="num w-full min-w-0 bg-transparent outline-none"
        />
        {def.suffix && <span className="ml-2 shrink-0 text-sm text-muted">{def.suffix}</span>}
      </div>
      <p id={`${id}-help`} className={`text-xs ${error ? "text-bad" : "text-muted"}`}>
        {error ?? (compact ? null : def.help)}
      </p>
    </div>
  );
}
