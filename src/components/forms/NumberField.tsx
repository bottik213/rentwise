"use client";
import { useEffect, useId, useRef, useState } from "react";
import { InfoIcon } from "@/components/Icons";
import { useTapTip } from "@/components/useTapTip";
import type { AssumptionSource } from "@/lib/finance/types";
import { parseNumber } from "@/lib/validation";
import { type FieldDef, toDisplay, toEngine } from "./fields";

const SOURCES: AssumptionSource[] = ["estimate", "listing", "bill", "quote", "document"];
export const SOURCE_LABEL: Record<AssumptionSource, string> = {
  estimate: "Estimate",
  listing: "From listing",
  bill: "From a bill",
  quote: "From a quote",
  document: "From a document",
};

function validate(def: Pick<FieldDef, "kind" | "min" | "max">, raw: string): { value: number } | { error: string } {
  const n = parseNumber(raw);
  if (n === null) return { error: "Enter a number" };
  if (n < def.min || n > def.max) return { error: `Between ${def.min.toLocaleString()} and ${def.max.toLocaleString()}` };
  if (def.kind === "years" && !Number.isInteger(n)) return { error: "Whole years only" };
  return { value: toEngine(def.kind, n) };
}

/** Money shows thousands separators once you leave the field; while typing, your own text stays. */
const pretty = (kind: FieldDef["kind"], v: number) => {
  const s = toDisplay(kind, v);
  return kind === "money" ? Number(s).toLocaleString("en-US", { maximumFractionDigits: 2 }) : s;
};

interface Props {
  def: Pick<FieldDef, "label" | "kind" | "suffix" | "help" | "min" | "max">;
  value: number | undefined;
  onCommit: (v: number) => void;
  disabled?: boolean;
  source?: AssumptionSource;
  onSource?: (s: AssumptionSource) => void;
  /** Rendered between the label and the help icon, e.g. the closing-cost % / $ switch. */
  extra?: React.ReactNode;
  className?: string;
}

/** Text input that commits only valid values; the draft (and its error) stays visible while invalid. */
export function NumberField({ def, value, onCommit, disabled, source, onSource, extra, className }: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const tip = useTapTip<HTMLDivElement>();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === undefined ? "" : pretty(def.kind, value));
  const result = draft === null ? null : validate(def, draft);
  const error = result && "error" in result ? result.error : value === undefined && draft !== null ? "Required" : null;

  // Invalid drafts must block form submission even while calculations keep the last valid value.
  useEffect(() => {
    inputRef.current?.setCustomValidity(error ?? "");
  }, [error]);

  return (
    <div ref={tip.ref} className={`tw fld ${tip.open ? "open" : ""} ${className ?? ""}`}>
      <div className="flabel">
        <label htmlFor={id}>{def.label}</label>
        {def.help && (
          <button type="button" className="ib" aria-label={`About ${def.label}`} aria-expanded={tip.open} onClick={tip.toggle}>
            <InfoIcon />
          </button>
        )}
        {extra}
        {onSource && (
          <select
            aria-label={`${def.label} source`}
            value={source ?? "estimate"}
            onChange={(e) => onSource(e.target.value as AssumptionSource)}
            className={`src ${source && source !== "estimate" ? "ok" : ""}`}
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className={`inp ${error ? "err" : ""} ${disabled ? "off" : ""}`}>
        {def.kind === "money" && <span className="pre" aria-hidden>$</span>}
        <input
          ref={inputRef}
          id={id}
          required
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          value={shown}
          aria-invalid={!!error}
          aria-describedby={`${id}-help ${id}-err`}
          onFocus={() => setDraft(shown)}
          onChange={(e) => {
            setDraft(e.target.value);
            const r = validate(def, e.target.value);
            if ("value" in r) onCommit(r.value);
          }}
          onBlur={() => {
            if (result && "value" in result) setDraft(null);
          }}
        />
        {def.suffix && <span className="unit">{def.suffix}</span>}
      </div>
      <p id={`${id}-err`} className="ferr" hidden={!error}>
        {error}
      </p>
      {def.help && (
        <div className="pop up" role="tooltip" id={`${id}-help`}>
          <p>{def.help}</p>
        </div>
      )}
    </div>
  );
}
