"use client";
import { useState } from "react";
import { Arrow } from "@/components/Icons";
import { AnimatedNumber } from "@/components/results/AnimatedNumber";
import { underwrite } from "@/lib/finance/underwriting";
import type { AssumptionSource, PropertyInputs } from "@/lib/finance/types";
import { useI18n } from "@/i18n/client";
import { PropertyInputsSchema } from "@/lib/validation";
import { FIELDS, GROUPS, closingDef, fieldDef, type FieldKey, type NumericKey } from "./fields";
import { NumberField } from "./NumberField";

type Draft = Partial<PropertyInputs>;

interface Props {
  initial: Draft;
  submitLabel: string;
  onSubmit: (p: PropertyInputs) => void;
}

export function PropertyForm({ initial, submitLabel, onSubmit }: Props) {
  const { t, money: usd, pct } = useI18n();
  const exact = (v: number) => usd(Math.round(v), { exact: true });
  const rate = (v: number) => pct(v);
  const [d, setD] = useState<Draft>(initial);
  const [tried, setTried] = useState(false);
  const set = (patch: Draft) => setD((x) => ({ ...x, ...patch }));
  const setSource = (k: NumericKey, s: AssumptionSource) => setD((x) => ({ ...x, sources: { ...x.sources, [k]: s } }));

  const parsed = PropertyInputsSchema.safeParse(d);
  const missing = (Object.keys(FIELDS) as FieldKey[]).filter((k) => d[k] === undefined && !(d.allCash && isFinancing(k))).map((k) => t.fields[k].label);
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

  const field = (k: FieldKey) => (
    <NumberField
      key={k}
      def={fieldDef(t, k)}
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
            {t.form.nickname} <span>{t.common.optional}</span>
          </label>
          <input id="nickname" maxLength={60} value={d.nickname ?? ""} onChange={(e) => set({ nickname: e.target.value || undefined })} placeholder={t.form.nicknameHint} />
        </div>

        {GROUPS.map((g) => (
          <fieldset key={g.id} className="sec">
            <legend className="disp">
              {t.groups[g.id].title}
              <small>{t.groups[g.id].sub}</small>
            </legend>
            <div className="fg">
              {g.id === "loan" && (
                <label className="chk">
                  <input type="checkbox" checked={!!d.allCash} onChange={(e) => set({ allCash: e.target.checked })} />
                  {t.form.allCash}
                </label>
              )}
              {g.keys.map((k) => (
                <div key={k} style={{ display: "contents" }}>
                  {field(k)}
                  {k === "purchasePrice" && (
                    <NumberField
                      key={d.closingCostMode}
                      def={closingDef(t, closingIsPct)}
                      value={d.closingCostValue}
                      onCommit={(v) => set({ closingCostValue: v })}
                      extra={
                        <span className="seg" role="group" aria-label={t.form.closingUnit}>
                          {([["%", true], ["₸", false]] as const).map(([label, pctMode]) => (
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

      <aside className="sum" aria-label={t.form.liveSummary}>
        <div className="sumc num" aria-live="polite">
          <p className="k">{t.form.asYouType}</p>
          {live ? (
            <>
              <dl>
                <div>
                  <dt>{t.form.cfAfter}</dt>
                  <dd>
                    <AnimatedNumber value={cf} format={exact} />
                    <small>{t.common.mo}</small>
                  </dd>
                </div>
                <div>
                  <dt>{t.form.coc}</dt>
                  <dd>{live.cashOnCash === null ? t.common.na : <AnimatedNumber value={live.cashOnCash} format={rate} />}</dd>
                </div>
              </dl>
              <div className="row">
                <span>{t.form.cashInvested}</span>
                <b>{usd(live.cashInvested)}</b>
              </div>
              <div className="row">
                <span>{t.form.breakEven}</span>
                <b>{live.breakEvenRent === null ? t.common.notReachable : `${usd(live.breakEvenRent)}${t.common.mo}`}</b>
              </div>
              <p className="say">
                {cf >= 0 ? t.form.bringsIn(usd(cf)) : t.form.costs(usd(-cf))}
              </p>
            </>
          ) : (
            <p className="say" style={{ display: "block" }}>
              {t.form.fillIn(missing.length)}
            </p>
          )}
        </div>
        <button type="submit" form="property-form" className="btn btn-cta btn-lg">
          {submitLabel} <Arrow size={18} />
        </button>
        {tried && !parsed.success && (
          <p role="alert" className="err">
            {missing.length ? t.form.stillNeeded(missing.map((l) => l.toLocaleLowerCase()).join(", ")) : t.form.fixHighlighted}
          </p>
        )}
        <p className="tip2">{t.form.nothingSent}</p>
      </aside>
    </div>
  );
}

const isFinancing = (k: NumericKey) => k === "downPaymentPct" || k === "annualInterestRate" || k === "loanTermYears";
