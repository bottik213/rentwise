"use client";
import { useState } from "react";
import type { AssumptionSource, PropertyInputs } from "@/lib/finance/types";
import { PropertyInputsSchema } from "@/lib/validation";
import { FIELDS, GROUPS, type NumericKey } from "./fields";
import { NumberField } from "./NumberField";

type Draft = Partial<PropertyInputs>;

interface Props {
  initial: Draft;
  submitLabel: string;
  onSubmit: (p: PropertyInputs) => void;
}

export function PropertyForm({ initial, submitLabel, onSubmit }: Props) {
  const [d, setD] = useState<Draft>(initial);
  const [tried, setTried] = useState(false);
  const set = (patch: Draft) => setD((x) => ({ ...x, ...patch }));
  const setSource = (k: NumericKey, s: AssumptionSource) => setD((x) => ({ ...x, sources: { ...x.sources, [k]: s } }));

  const parsed = PropertyInputsSchema.safeParse(d);
  const missing = Object.values(FIELDS).filter((f) => d[f.key] === undefined && !(d.allCash && isFinancing(f.key)));

  const closingIsPct = d.closingCostMode !== "amount";
  const switchClosing = (toPct: boolean) => {
    if (toPct === closingIsPct) return;
    const price = d.purchasePrice ?? 0;
    const v = d.closingCostValue ?? 0;
    set({
      closingCostMode: toPct ? "percent" : "amount",
      closingCostValue: price > 0 ? (toPct ? Math.min(0.2, v / price) : Math.round(v * price)) : 0,
    });
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (e.currentTarget.reportValidity() && parsed.success) onSubmit(parsed.data);
      }}
      className="flex flex-col gap-10"
    >
      <div className="flex max-w-md flex-col gap-1.5">
        <label htmlFor="nickname" className="text-sm font-medium">Nickname <span className="font-normal text-muted">(optional)</span></label>
        <input
          id="nickname"
          maxLength={60}
          value={d.nickname ?? ""}
          onChange={(e) => set({ nickname: e.target.value || undefined })}
          placeholder="e.g. Maple St duplex"
          className="h-11 rounded-md border border-line px-3 outline-none hover:border-muted focus:border-ink focus:ring-1 focus:ring-ink"
        />
      </div>

      {GROUPS.map((g) => (
        <fieldset key={g.title} className="grid gap-x-6 gap-y-5 border-t border-line pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <legend className="float-left mb-1 w-full text-lg font-medium tracking-tight sm:col-span-2 lg:col-span-3">
            {g.title}
          </legend>
          {g.title === "Financing" && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3">
              <input type="checkbox" checked={!!d.allCash} onChange={(e) => set({ allCash: e.target.checked })} className="size-4 accent-ink" />
              All-cash purchase (no mortgage)
            </label>
          )}
          {g.keys.map((k) => (
            <NumberField
              key={k}
              def={FIELDS[k]}
              value={d[k]}
              disabled={d.allCash && isFinancing(k)}
              onCommit={(v) => set({ [k]: v })}
              source={FIELDS[k].source ? d.sources?.[k] : undefined}
              onSource={FIELDS[k].source ? (s) => setSource(k, s) : undefined}
            />
          ))}
          {g.title === "Acquisition" && (
            <div className="flex flex-col gap-1.5">
              <NumberField
                key={d.closingCostMode}
                def={
                  closingIsPct
                    ? { label: "Closing costs", kind: "rate", suffix: "% of price", help: "Lender, title, escrow fees. 2–5% is common.", min: 0, max: 20 }
                    : { label: "Closing costs", kind: "money", help: "Lender, title, escrow fees.", min: 0, max: 10_000_000 }
                }
                value={d.closingCostValue}
                onCommit={(v) => set({ closingCostValue: v })}
              />
              <div role="group" aria-label="Closing cost unit" className="-mt-1 flex gap-1 text-xs">
                {[["%", true], ["$", false]].map(([label, pctMode]) => (
                  <button
                    key={String(label)}
                    type="button"
                    aria-pressed={closingIsPct === pctMode}
                    onClick={() => switchClosing(pctMode as boolean)}
                    className="press h-7 min-w-9 rounded-sm border border-line px-2 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </fieldset>
      ))}

      <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center">
        <button type="submit" className="h-12 rounded-md bg-ink px-6 font-medium text-bg press hover:bg-ink/85">
          {submitLabel}
        </button>
        {tried && !parsed.success && (
          <p role="alert" className="text-sm text-bad">
            {missing.length ? `Still needed: ${missing.map((f) => f.label.toLowerCase()).join(", ")}.` : "Fix the highlighted fields."}
          </p>
        )}
      </div>
    </form>
  );
}

const isFinancing = (k: NumericKey) => k === "downPaymentPct" || k === "annualInterestRate" || k === "loanTermYears";
