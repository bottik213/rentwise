"use client";
import { GROUPS, closingDef, fieldDef, type FieldDef } from "@/components/forms/fields";
import { Badge } from "@/components/Icons";
import { Waterfall } from "@/components/results/Metrics";
import type { I18n } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { runScenarios } from "@/lib/finance/scenarios";
import type { OfferConstraints, PropertyInputs, ScenarioAdjustments, ScenarioName } from "@/lib/finance/types";
import type { Stored } from "@/lib/storage";
import { verdict } from "@/lib/verdict";

export interface ReportData {
  inputs: PropertyInputs;
  isExample: boolean;
  scenarios: Record<ScenarioName, ScenarioAdjustments>;
  constraints: OfferConstraints;
  branding?: Stored["branding"];
}

function fieldValue(def: Pick<FieldDef, "kind" | "suffix">, v: number, { money, num }: I18n): string {
  if (def.kind === "money") return `${money(v)}${def.suffix ?? ""}`;
  if (def.kind === "rate") return `${num(v * 100)}${def.suffix ?? "%"}`; // rate suffixes start with "%": "5% of rent"
  return `${v} ${def.suffix ?? ""}`.trim();
}

/** The full investment report, read-only. Everything is recalculated from the inputs by the same engine. */
export function Report({ data, generated }: { data: ReportData; generated: Date }) {
  const i = useI18n();
  const { t, money: usd, pct, num } = i;
  const R = t.report;
  const { inputs: p, scenarios, constraints: c, branding: b } = data;
  const exact = (v: number) => usd(Math.round(v), { exact: true });
  const u = runScenarios(p, scenarios).base;
  const v = verdict(u, c, p.monthlyRent, i);
  const name = i.name(p.nickname, data.isExample, t.common.property);
  const by = [b?.name, b?.company].filter(Boolean).join(", ");
  const estimate = t.sources.estimate;

  const rows: [string, string, string][] = [];
  for (const g of GROUPS) {
    if (g.id === "loan" && p.allCash) rows.push([R.financing, R.allCash, "—"]);
    for (const k of g.keys) {
      if (p.allCash && (k === "downPaymentPct" || k === "annualInterestRate" || k === "loanTermYears")) continue;
      const f = fieldDef(t, k);
      rows.push([f.label, fieldValue(f, p[k], i), f.source ? t.sources[p.sources?.[k] ?? "estimate"] : R.notLabeled]);
      if (k === "purchasePrice") {
        const cd = closingDef(t, p.closingCostMode !== "amount");
        rows.push([cd.label, fieldValue(cd, p.closingCostValue, i), R.notLabeled]);
      }
    }
  }

  return (
    <article className="rpt">
      <header className="rh">
        <div className="brand">
          {b?.logo && (
            // eslint-disable-next-line @next/next/no-img-element -- a local data URL; next/image adds nothing here
            <img src={b.logo} alt={R.logo(b.company || b.name || R.company)} />
          )}
          <div>
            {by ? <b>{by}</b> : <b>RentWise</b>}
            {b?.contact && <span>{b.contact}</span>}
          </div>
        </div>
        <div className="ttl">
          <h1 className="disp">{name}</h1>
          <p className="num">
            {R.sub(usd(p.purchasePrice), usd(p.monthlyRent), i.date(generated.toISOString()))}
            {data.isExample && <> · <span className="tag">{t.common.synthetic}</span></>}
          </p>
        </div>
      </header>

      <section className="verdict" aria-labelledby="r-v">
        <div className="vrow">
          <span className="lbl" id="r-v">{t.results.short}</span>
          <Badge st={v.st} label={v.label} knock="#fff" />
        </div>
        <p className="big num">{v.text}</p>
        <p className="fine">{R.fine}</p>
      </section>

      <section aria-labelledby="r-k">
        <div className="shead"><h2 className="disp" id="r-k">{R.key}</h2></div>
        <div className="card">
          <dl className="ocs rgrid num">
            <div><dt>{t.results.cf.title}</dt><dd className={u.reserveAdjustedCashFlow < 0 ? "neg" : ""}>{exact(u.reserveAdjustedCashFlow)}{t.common.mo}</dd></div>
            <div><dt>{R.coc}</dt><dd>{pct(u.cashOnCash)}</dd></div>
            <div><dt>{R.cap}</dt><dd>{pct(u.capRate)}</dd></div>
            <div><dt>{R.noi}</dt><dd>{exact(u.noi)}{t.common.mo}</dd></div>
            <div><dt>{R.be}</dt><dd>{u.breakEvenRent === null ? t.common.notReachable : `${usd(u.breakEvenRent)}${t.common.mo}`}</dd></div>
            <div><dt>{R.dscr}</dt><dd>{u.monthlyPI > 0 ? `${num(u.noi / u.monthlyPI)}×` : R.noMortgage}</dd></div>
            <div><dt>{R.pi}</dt><dd>{exact(u.monthlyPI)}</dd></div>
            <div><dt>{R.cash}</dt><dd>{usd(u.cashInvested)}</dd></div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="r-w">
        <div className="shead"><h2 className="disp" id="r-w">{t.results.wfTitle}</h2></div>
        <div className="card"><Waterfall u={u} cfStatus={v.st} /></div>
      </section>

      <section aria-labelledby="r-a">
        <div className="shead">
          <h2 className="disp" id="r-a">{R.aTitle}</h2>
          <p>{R.aSub}</p>
        </div>
        <div className="card">
          <table className="ct num">
            <caption className="sr-only">{R.aCaption}</caption>
            <thead><tr><th scope="col">{t.compare.assumption}</th><th scope="col">{R.value}</th><th scope="col">{R.source}</th></tr></thead>
            <tbody>
              {rows.map(([label, value, src]) => (
                <tr key={label}><th scope="row">{label}</th><td>{value}</td><td className={src === estimate ? "est" : "mut"}>{src}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="disc" role="note">
        <b>{R.important}</b>
        {R.disclaimer}
      </footer>
    </article>
  );
}
