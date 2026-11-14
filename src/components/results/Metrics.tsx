import type { Cents, Underwriting } from "@/lib/finance/types";
import { pct, usd } from "@/lib/format";
import { AnimatedNumber } from "./AnimatedNumber";

const money = (v: number) => usd(Math.round(v), { exact: true });
const rate = (v: number) => pct(v);

/** Headline tiles. All values come from the base scenario, i.e. exactly the inputs. */
export function HeadlineMetrics({ u }: { u: Underwriting }) {
  const be = u.breakEvenRent;
  return (
    <div className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
      <div className="bg-bg p-5 sm:col-span-2 lg:col-span-1 lg:row-span-2">
        <p className="text-sm text-muted">Cash flow after reserves</p>
        <p className={`mt-2 text-4xl font-medium tracking-tight ${u.reserveAdjustedCashFlow < 0 ? "text-bad" : ""}`}>
          <AnimatedNumber value={u.reserveAdjustedCashFlow} format={money} />
          <span className="ml-1 text-base text-muted">/mo</span>
        </p>
        <p className="mt-3 text-sm text-muted">
          After vacancy, operating costs, mortgage P&amp;I and the CapEx reserve.
        </p>
      </div>
      <Tile label="Cash-on-cash" value={u.cashOnCash} format={rate} note="Annual cash flow after reserves ÷ cash invested" />
      <Tile label="Cap rate" value={u.capRate} format={rate} note="Annual NOI ÷ price" />
      <Tile label="Total cash invested" value={u.cashInvested} format={(v) => usd(Math.round(v))} note="Down payment, closing, repairs, reserve" />
      <Tile label="Monthly P&I" value={u.monthlyPI} format={money} note="Principal and interest only" />
      <Tile label="Net operating income" value={u.noi} format={money} note="Per month, before debt service" />
      <div className="bg-bg p-5">
        <p className="text-sm text-muted">Break-even rent</p>
        {be === null ? (
          <p className="mt-2 text-sm">Not reachable: variable costs take all of the rent.</p>
        ) : (
          <>
            {/* Whole dollars: line items are rounded to cents, so cent-level precision here would be false precision. */}
            <p className="mt-2 text-2xl font-medium tracking-tight"><AnimatedNumber value={be} format={(v) => usd(Math.round(v))} /><span className="ml-1 text-sm text-muted">/mo</span></p>
            <p className="num mt-1 text-xs text-muted">Rent where cash flow after reserves is $0</p>
          </>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, format, note }: { label: string; value: number | null; format: (v: number) => string; note: string }) {
  return (
    <div className="bg-bg p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-medium tracking-tight">
        {value === null ? <span className="text-muted">n/a</span> : <AnimatedNumber value={value} format={format} />}
      </p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}

type Row = [label: string, monthly: Cents, kind?: "sub" | "total"];

/** Line-by-line monthly statement. Each total is the integer sum of the rows above it. */
export function Breakdown({ u }: { u: Underwriting }) {
  const rows: Row[] = [
    ["Gross scheduled rent", u.grossScheduledRent],
    ["Vacancy allowance", u.effectiveRent - u.grossScheduledRent],
    ["Effective rent", u.effectiveRent, "sub"],
    ["Other income", u.otherIncome],
    ["Property tax", -u.propertyTax],
    ["Insurance", -u.insurance],
    ["HOA", -u.hoa],
    ["Utilities", -u.utilities],
    ["Other fixed", -u.otherFixed],
    ["Maintenance", -u.maintenance],
    ["Management", -u.management],
    ["Operating expenses", -u.operatingExpenses, "sub"],
    ["Net operating income", u.noi, "total"],
    ["Mortgage P&I", -u.monthlyPI],
    ["Cash flow before CapEx", u.cashFlowBeforeCapex, "total"],
    ["CapEx reserve (planned, not spent)", -u.capexReserve],
    ["Cash flow after reserves", u.reserveAdjustedCashFlow, "total"],
  ];
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Monthly and annual cash flow statement</caption>
      <thead>
        <tr className="border-b border-line text-left text-muted">
          <th scope="col" className="py-2 font-normal">Line item</th>
          <th scope="col" className="py-2 text-right font-normal">Monthly</th>
          <th scope="col" className="py-2 text-right font-normal">Annual</th>
        </tr>
      </thead>
      <tbody>
        {rows.filter(([, v, kind]) => kind || v !== 0).map(([label, v, kind]) => (
          <tr key={label} className={kind === "total" ? "border-t border-ink font-medium" : kind === "sub" ? "border-t border-line" : ""}>
            <th scope="row" className={`py-2 text-left font-normal ${kind ? "font-medium" : "text-muted"}`}>{label}</th>
            <td className="num py-2 text-right">{usd(v, { exact: true })}</td>
            <td className="num py-2 text-right">{usd(12 * v, { exact: true })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
