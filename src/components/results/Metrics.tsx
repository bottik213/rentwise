"use client";
import { Chevron, InfoIcon, type Status } from "@/components/Icons";
import { useTapTip } from "@/components/useTapTip";
import { useI18n } from "@/i18n/client";
import type { Cents, Underwriting } from "@/lib/finance/types";

/** An ⓘ inside a row; the bubble opens from the row's left edge. */
export function RowTip({ label, text }: { label: string; text: string }) {
  const tip = useTapTip<HTMLSpanElement>();
  const { t } = useI18n();
  return (
    <span ref={tip.ref} className={`jt tw ${tip.open ? "open" : ""}`} style={{ position: "static" }}>
      <button type="button" className="ib" aria-label={t.wf.whatIs(label)} aria-expanded={tip.open} onClick={tip.toggle}>
        <InfoIcon />
      </button>
      <span className="pop up" role="tooltip">
        {text}
      </span>
    </span>
  );
}

interface Step {
  label: string;
  v: Cents;
  kind?: "total" | "sub" | "end" | "add";
  tip?: string;
}

/** Gross rent stepping down through every cost to monthly cash flow. Bars are positioned on one shared scale. */
export function Waterfall({ u, cfStatus }: { u: Underwriting; cfStatus: Status }) {
  const { t, money: usd } = useI18n();
  const w = t.wf;
  const steps: Step[] = [
    { label: w.gross, v: u.grossScheduledRent, kind: "total" },
    { label: w.vacancy, v: u.effectiveRent - u.grossScheduledRent, tip: w.vacTip },
  ];
  if (u.otherIncome) steps.push({ label: w.otherIncome, v: u.otherIncome, kind: "add" });
  steps.push({ label: w.propertyTax, v: -u.propertyTax }, { label: w.insurance, v: -u.insurance });
  if (u.hoa) steps.push({ label: w.hoa, v: -u.hoa });
  if (u.utilities) steps.push({ label: w.utilities, v: -u.utilities });
  if (u.otherFixed) steps.push({ label: w.otherFixed, v: -u.otherFixed });
  steps.push({ label: w.maintenance, v: -u.maintenance }, { label: w.management, v: -u.management });
  steps.push({ label: w.noi, v: u.noi, kind: "sub" });
  if (u.monthlyPI) steps.push({ label: w.mortgage, v: -u.monthlyPI });
  steps.push({ label: w.capex, v: -u.capexReserve, tip: w.capexTip });
  steps.push({ label: w.cashFlow, v: u.reserveAdjustedCashFlow, kind: "end" });

  // Walk the steps once to find the scale, then again to place each bar.
  let run = 0;
  const spans = steps.map((s) => {
    let a: number, b: number;
    if (s.kind && s.kind !== "add") {
      a = Math.min(0, s.v);
      b = Math.max(0, s.v);
      run = s.v;
    } else {
      a = Math.min(run, run + s.v);
      b = Math.max(run, run + s.v);
      run += s.v;
    }
    return [a, b] as const;
  });
  const lo = Math.min(0, ...spans.map(([a]) => a));
  const hi = Math.max(1, ...spans.map(([, b]) => b));
  const X = (v: number) => ((v - lo) / (hi - lo)) * 100;

  // Shares of every 100 units of rent, shown in the money format ("100 ₸").
  const per = (v: number) => usd(Math.round((v / u.grossScheduledRent) * 100) * 100);
  const cf = u.reserveAdjustedCashFlow;
  const caption =
    u.grossScheduledRent > 0
      ? w.caption(usd(10_000), per(u.grossScheduledRent - u.effectiveRent), per(u.operatingExpenses), per(u.monthlyPI), per(u.capexReserve), per(cf))
      : "";

  return (
    <>
      <div className="wf num" role="group" aria-label={w.aria(usd(u.grossScheduledRent, { exact: true }), usd(cf, { exact: true }))}>
        {steps.map((s, j) => {
          const [a, b] = spans[j];
          const cls = s.kind === "end" ? cfStatus : s.kind === "add" ? "sub" : s.kind ?? "ded";
          const txt = s.kind && s.kind !== "add" ? usd(s.v, { exact: true }) : usd(s.v, { exact: true, signed: s.kind === "add" });
          return (
            <div key={s.label} className={`wfr ${s.kind ?? ""}`}>
              <span className="l">
                {s.label}
                {s.tip && <RowTip label={s.label} text={s.tip} />}
              </span>
              <span className="trk" aria-hidden>
                <span className="rv" style={{ animationDelay: `${j * 70}ms` }}>
                  <span className={`bar ${cls}`} style={{ transform: `translateX(${X(a)}%) scaleX(${Math.max(0.002, (X(b) - X(a)) / 100)})` }} />
                </span>
                {lo < 0 && <span className="zl" style={{ left: `${X(0)}%` }} />}
              </span>
              <span className={`r ${s.kind === "end" && s.v < 0 ? "neg" : ""}`}>{txt}</span>
            </div>
          );
        })}
      </div>
      {caption && <p className="cap">{caption}</p>}
      <details className="x">
        <summary>
          <Chevron />
          {w.showFull}
        </summary>
        <div className="xb">
          <Breakdown u={u} />
        </div>
      </details>
    </>
  );
}

type Row = [label: string, monthly: Cents, kind?: "s"];

/** Line-by-line monthly statement. Each total is the integer sum of the rows above it. */
export function Breakdown({ u }: { u: Underwriting }) {
  const { t, money: usd } = useI18n();
  const w = t.wf;
  const rows: Row[] = [
    [w.grossScheduled, u.grossScheduledRent],
    [w.vacancy, u.effectiveRent - u.grossScheduledRent],
    [w.effective, u.effectiveRent, "s"],
    [w.otherIncome, u.otherIncome],
    [w.propertyTax, -u.propertyTax],
    [w.insurance, -u.insurance],
    [w.hoa, -u.hoa],
    [w.utilities, -u.utilities],
    [w.otherFixed, -u.otherFixed],
    [w.maintenance, -u.maintenance],
    [w.management, -u.management],
    [w.opex, -u.operatingExpenses, "s"],
    [w.noi, u.noi, "s"],
    [w.mortgage, -u.monthlyPI],
    [w.cfBefore, u.cashFlowBeforeCapex, "s"],
    [w.capexPlanned, -u.capexReserve],
    [w.cfAfter, u.reserveAdjustedCashFlow, "s"],
  ];
  return (
    <table className="st num">
      <caption className="sr-only">{w.statement}</caption>
      <thead>
        <tr>
          <th scope="col">{w.line}</th>
          <th scope="col">{w.monthly}</th>
          <th scope="col">{w.yearly}</th>
        </tr>
      </thead>
      <tbody>
        {rows
          .filter(([, v, kind]) => kind || v !== 0)
          .map(([label, v, kind]) => (
            <tr key={label} className={kind ?? ""}>
              <th scope="row">{label}</th>
              <td className={v < 0 && kind ? "neg" : ""}>{usd(v, { exact: true })}</td>
              <td className={v < 0 && kind ? "neg" : ""}>{usd(12 * v, { exact: true })}</td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}
