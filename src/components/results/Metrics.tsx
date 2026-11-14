"use client";
import { Chevron, InfoIcon, type Status } from "@/components/Icons";
import { useTapTip } from "@/components/useTapTip";
import type { Cents, Underwriting } from "@/lib/finance/types";
import { usd } from "@/lib/format";

const VACANCY_TIP = "Rent you expect to lose while a unit sits empty between tenants. It is a planning number, not a bill.";
const CAPEX_TIP = "Money set aside for big future repairs like a roof or HVAC. Planned, not spent.";

/** An ⓘ inside a row; the bubble opens from the row's left edge. */
export function RowTip({ label, text }: { label: string; text: string }) {
  const tip = useTapTip<HTMLSpanElement>();
  return (
    <span ref={tip.ref} className={`jt tw ${tip.open ? "open" : ""}`} style={{ position: "static" }}>
      <button type="button" className="ib" aria-label={`What is ${label}?`} aria-expanded={tip.open} onClick={tip.toggle}>
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
  const steps: Step[] = [
    { label: "Gross rent", v: u.grossScheduledRent, kind: "total" },
    { label: "Vacancy allowance", v: u.effectiveRent - u.grossScheduledRent, tip: VACANCY_TIP },
  ];
  if (u.otherIncome) steps.push({ label: "Other income", v: u.otherIncome, kind: "add" });
  steps.push({ label: "Property tax", v: -u.propertyTax }, { label: "Insurance", v: -u.insurance });
  if (u.hoa) steps.push({ label: "HOA", v: -u.hoa });
  if (u.utilities) steps.push({ label: "Utilities", v: -u.utilities });
  if (u.otherFixed) steps.push({ label: "Other fixed costs", v: -u.otherFixed });
  steps.push({ label: "Maintenance", v: -u.maintenance }, { label: "Management", v: -u.management });
  steps.push({ label: "Net operating income", v: u.noi, kind: "sub" });
  if (u.monthlyPI) steps.push({ label: "Mortgage P&I", v: -u.monthlyPI });
  steps.push({ label: "CapEx reserve", v: -u.capexReserve, tip: CAPEX_TIP });
  steps.push({ label: "Cash flow", v: u.reserveAdjustedCashFlow, kind: "end" });

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

  const per = (v: number) => Math.round((v / u.grossScheduledRent) * 100);
  const cf = u.reserveAdjustedCashFlow;
  const caption =
    u.grossScheduledRent > 0
      ? `Out of every $100 of rent, about $${per(u.grossScheduledRent - u.effectiveRent)} is lost to empty months, $${per(u.operatingExpenses)} goes to running costs, $${per(u.monthlyPI)} to the mortgage and $${per(u.capexReserve)} to future repairs, leaving about ${cf < 0 ? "−" : ""}$${Math.abs(per(cf))} for you.`
      : "";

  return (
    <>
      <div className="wf num" role="group" aria-label={`Waterfall from ${usd(u.grossScheduledRent, { exact: true })} gross rent down to ${usd(cf, { exact: true })} monthly cash flow.`}>
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
          Show full statement
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
  const rows: Row[] = [
    ["Gross scheduled rent", u.grossScheduledRent],
    ["Vacancy allowance", u.effectiveRent - u.grossScheduledRent],
    ["Effective rent", u.effectiveRent, "s"],
    ["Other income", u.otherIncome],
    ["Property tax", -u.propertyTax],
    ["Insurance", -u.insurance],
    ["HOA", -u.hoa],
    ["Utilities", -u.utilities],
    ["Other fixed costs", -u.otherFixed],
    ["Maintenance", -u.maintenance],
    ["Management", -u.management],
    ["Operating expenses", -u.operatingExpenses, "s"],
    ["Net operating income", u.noi, "s"],
    ["Mortgage P&I", -u.monthlyPI],
    ["Cash flow before CapEx", u.cashFlowBeforeCapex, "s"],
    ["CapEx reserve (planned, not spent)", -u.capexReserve],
    ["Cash flow after reserves", u.reserveAdjustedCashFlow, "s"],
  ];
  return (
    <table className="st num">
      <caption className="sr-only">Monthly and annual cash flow statement</caption>
      <thead>
        <tr>
          <th scope="col">Line</th>
          <th scope="col">Monthly</th>
          <th scope="col">Yearly</th>
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
