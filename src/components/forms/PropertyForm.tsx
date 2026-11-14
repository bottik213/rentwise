"use client";
import { useState } from "react";
import { Arrow } from "@/components/Icons";
import { AnimatedNumber } from "@/components/results/AnimatedNumber";
import { underwrite } from "@/lib/finance/underwriting";
import type { AssumptionSource, PropertyInputs } from "@/lib/finance/types";
import { pct, usd } from "@/lib/format";
import { PropertyInputsSchema } from "@/lib/validation";
import { FIELDS, GROUPS, closingDef, type NumericKey } from "./fields";
import { NumberField } from "./NumberField";

type Draft = Partial<PropertyInputs>;

interface Props {
  initial: Draft;
  submitLabel: string;
  onSubmit: (p: PropertyInputs) => void;
}

const exact = (v: number) => usd(Math.round(v), { exact: true });
const rate = (v: number) => pct(v);

export function PropertyForm({ initial, submitLabel, onSubmit }: Props) {
  const [d, setD] = useState<Draft>(initial);
  const [tried, setTried] = useState(false);
  const set = (patch: Draft) => setD((x) => ({ ...x, ...patch }));
  const setSource = (k: NumericKey, s: AssumptionSource) => setD((x) => ({ ...x, sources: { ...x.sources, [k]: s } }));

  const parsed = PropertyInputsSchema.safeParse(d);
  const missing = Object.values(FIELDS).filter((f) => d[f.key] === undefined && !(d.allCash && isFinancing(f.key)));
  const live = parsed.success ? underwrite(parsed.data) : null;

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

  const field = (k: keyof typeof FIELDS) => (
    <NumberField
      key={k}
      def={FIELDS[k]}
      value={d[k]}
      disabled={d.allCash && isFinancing(k)}
      onCommit={(v) => set({ [k]: v })}
      source={FIELDS[k].source ? d.sources?.[k] : undefined}
      onSource={FIELDS[k].source ? (s) => setSource(k, s) : undefined}
    />
  );

  const cf = live?.reserveAdjustedCashFlow ?? 0;

  return (
    <div className="grid">
      <form
        id="property-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (e.currentTarget.reportValidity() && parsed.success) onSubmit(parsed.data);
        }}
        className="formc"
      >
        <div className="nick">
          <label htmlFor="nickname">
            Nickname <span>(optional)</span>
          </label>
          <input id="nickname" maxLength={60} value={d.nickname ?? ""} onChange={(e) => set({ nickname: e.target.value || undefined })} placeholder="e.g. Maple St duplex" />
        </div>

        {GROUPS.map((g) => (
          <fieldset key={g.title} className="sec">
            <legend className="disp">
              {g.title}
              <small>{g.sub}</small>
            </legend>
            <div className="fg">
              {g.title === "Loan" && (
                <label className="chk">
                  <input type="checkbox" checked={!!d.allCash} onChange={(e) => set({ allCash: e.target.checked })} />
                  All-cash purchase (no mortgage)
                </label>
              )}
              {g.keys.map((k) => (
                <div key={k} style={{ display: "contents" }}>
                  {field(k)}
                  {k === "purchasePrice" && (
                    <NumberField
                      key={d.closingCostMode}
                      def={closingDef(closingIsPct)}
                      value={d.closingCostValue}
                      onCommit={(v) => set({ closingCostValue: v })}
                      extra={
                        <span className="seg" role="group" aria-label="Closing cost unit">
                          {([["%", true], ["$", false]] as const).map(([label, pctMode]) => (
                            <button key={label} type="button" aria-pressed={closingIsPct === pctMode} onClick={() => switchClosing(pctMode)}>
                              {label}
                            </button>
                          ))}
                        </span>
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          </fieldset>
        ))}
      </form>

      <aside className="sum" aria-label="Live summary">
        <div className="sumc num" aria-live="polite">
          <p className="k">As you type</p>
          {live ? (
            <>
              <dl>
                <div>
                  <dt>Cash flow after reserves</dt>
                  <dd>
                    <AnimatedNumber value={cf} format={exact} />
                    <small>/mo</small>
                  </dd>
                </div>
                <div>
                  <dt>Cash-on-cash return</dt>
                  <dd>{live.cashOnCash === null ? "n/a" : <AnimatedNumber value={live.cashOnCash} format={rate} />}</dd>
                </div>
              </dl>
              <div className="row">
                <span>Cash invested</span>
                <b>{usd(live.cashInvested)}</b>
              </div>
              <div className="row">
                <span>Break-even rent</span>
                <b>{live.breakEvenRent === null ? "Not reachable" : `${usd(live.breakEvenRent)}/mo`}</b>
              </div>
              <p className="say">
                {cf >= 0
                  ? `At these numbers the property would bring in about ${usd(cf)} a month after every cost.`
                  : `At these numbers the property would cost you about ${usd(-cf)} a month after every cost.`}
              </p>
            </>
          ) : (
            <p className="say" style={{ display: "block" }}>
              Fill in {missing.length ? `${missing.length} more field${missing.length === 1 ? "" : "s"}` : "the highlighted fields"} to see live numbers.
            </p>
          )}
        </div>
        <button type="submit" form="property-form" className="btn btn-cta btn-lg">
          {submitLabel} <Arrow size={18} />
        </button>
        {tried && !parsed.success && (
          <p role="alert" className="err">
            {missing.length ? `Still needed: ${missing.map((f) => f.label.toLowerCase()).join(", ")}.` : "Fix the highlighted fields."}
          </p>
        )}
        <p className="tip2">Nothing is sent anywhere. Your inputs are saved in this browser when you continue.</p>
      </aside>
    </div>
  );
}

const isFinancing = (k: NumericKey) => k === "downPaymentPct" || k === "annualInterestRate" || k === "loanTermYears";
