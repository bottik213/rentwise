"use client";
import Link from "next/link";
import { useState } from "react";
import { DataControls } from "@/components/DataControls";
import { VarianceWaterfall } from "@/components/charts/VarianceWaterfall";
import { NumberField } from "@/components/forms/NumberField";
import { PageSkeleton } from "@/components/results/PageSkeleton";
import { CATEGORY_LABEL, explainVariance } from "@/lib/explain";
import { underwrite } from "@/lib/finance/underwriting";
import { monthlyForecast, variance } from "@/lib/finance/variance";
import { ACTUAL_CATEGORIES, type ActualMonth, type Cents } from "@/lib/finance/types";
import { monthLabel, usd } from "@/lib/format";
import { setAppState, useAppState } from "@/lib/storage";
import { ActualMonthSchema } from "@/lib/validation";

const FIELD_KEYS = [...ACTUAL_CATEGORIES, "capex"] as const;
const HELP: Partial<Record<(typeof FIELD_KEYS)[number], string>> = {
  rentReceived: "Rent actually collected. Security deposits are not income; leave them out.",
  capex: "Big replacements (roof, HVAC). Tracked against your reserve, not cash flow.",
};
const nextMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
};

export default function PerformancePage() {
  const s = useAppState();
  const [draft, setDraft] = useState<ActualMonth | null>(null);
  const [formRevision, setFormRevision] = useState(0);
  if (!s) return <PageSkeleton />;

  if (!s.plan) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <h1 className="text-3xl font-medium tracking-tight">No owned property yet</h1>
        <p className="mt-3 text-muted">
          Analyze a property, then choose “Mark as owned”. That locks the plan your actual months are compared against.
        </p>
        <Link href={s.property ? "/results" : "/analyze"} className="press mt-8 inline-flex h-11 items-center rounded-md bg-ink px-5 font-medium text-bg hover:bg-ink/85">
          {s.property ? "Go to the analysis" : "Analyze a property"}
        </Link>
      </div>
    );
  }

  const plan = s.plan;
  const u = underwrite(plan.inputs); // the locked plan, never the live inputs
  const forecast = monthlyForecast(u);
  const actuals = s.actuals;
  const blank = (month: string): ActualMonth => ({ month, ...forecast, capex: 0 });
  const form = draft ?? blank(actuals.length ? nextMonth(actuals[actuals.length - 1].month) : plan.lockedAt.slice(0, 7));
  const replacing = actuals.some((a) => a.month === form.month);
  const valid = ActualMonthSchema.safeParse(form).success;
  const monthOk = /^\d{4}-(0[1-9]|1[0-2])$/.test(form.month);
  const r = variance(u, actuals);
  const contributorSum = r.contributors.reduce((t, c) => t + c.impact, 0);

  const save = () => {
    if (!valid) return;
    // Upsert by month: a duplicate month would be counted twice.
    setAppState((x) => ({ ...x, actuals: [...x.actuals.filter((a) => a.month !== form.month), form].sort((a, b) => a.month.localeCompare(b.month)) }));
    setDraft(null);
  };
  const remove = (month: string) => {
    if (!confirm(`Delete ${monthLabel(month)}?`)) return;
    setAppState((x) => ({ ...x, actuals: x.actuals.filter((a) => a.month !== month) }));
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header>
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">{plan.inputs.nickname || "Your property"}: actuals vs. plan</h1>
        <p className="mt-2 text-muted">{s.isExample && <span className="mr-2 rounded-sm border border-line px-1.5 py-0.5 text-xs text-ink">Synthetic example</span>}
          Plan locked {new Date(plan.lockedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}. Later edits to the analysis
          don&apos;t change it. <Link href="/results" className="underline underline-offset-4 hover:text-ink">Back to analysis</Link>
        </p>
      </header>

      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section aria-labelledby="record" className="lg:order-2">
          {r.months === 0 ? (
            <div className="rounded-md border border-dashed border-line p-8 text-center">
              <h2 className="text-xl font-medium tracking-tight">Record your first month</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                The form starts at your plan&apos;s forecast. Change only what really happened, like a repair bill, and the
                variance explains itself.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-12">
              <div className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2">
                <Compare label="Rent received" f={r.forecastRent} a={r.actualRent} income />
                <Compare label="Operating costs" f={r.forecastOperatingCosts} a={r.actualOperatingCosts} />
                <Compare label="Cash flow before CapEx" f={r.forecastCashFlowBeforeCapex} a={r.actualCashFlowBeforeCapex} income />
                <div className="bg-bg p-5">
                  <p className="text-sm text-muted">Total variance · {r.months} month{r.months === 1 ? "" : "s"}</p>
                  <p className={`num mt-2 text-3xl font-medium tracking-tight ${r.totalVariance < 0 ? "text-bad" : r.totalVariance > 0 ? "text-good" : ""}`}>
                    {usd(r.totalVariance, { exact: true, signed: true })}
                  </p>
                  <p className="mt-1 text-xs text-muted">Actual minus forecast, same months, same definition</p>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-medium tracking-tight">Why cash flow differs from plan</h2>
                <div className="mt-5"><VarianceWaterfall r={r} /></div>
                <div className="mt-6 rounded-md bg-surface p-5">
                  <ul className="flex flex-col gap-2 text-sm leading-relaxed">
                    {explainVariance(r).map((line) => <li key={line}>{line}</li>)}
                  </ul>
                  <p className="mt-3 text-xs text-muted">Rule-based explanation computed from your numbers. No AI involved.</p>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-medium tracking-tight">Contributors</h2>
                <p className="mt-1 text-sm text-muted">Positive = better than plan. The rows add up exactly to the total.</p>
                <div className="-mx-4 mt-4 overflow-x-auto px-4">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-muted">
                        <th scope="col" className="py-2 font-normal">Category</th>
                        <th scope="col" className="py-2 text-right font-normal">Forecast</th>
                        <th scope="col" className="py-2 text-right font-normal">Actual</th>
                        <th scope="col" className="py-2 text-right font-normal">Effect on cash flow</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.contributors.map((c) => (
                        <tr key={c.category} className="border-b border-line/60">
                          <th scope="row" className="py-2 text-left font-normal">{CATEGORY_LABEL[c.category]}</th>
                          <td className="num py-2 text-right text-muted">{usd(c.forecast, { exact: true })}</td>
                          <td className="num py-2 text-right">{usd(c.actual, { exact: true })}</td>
                          <td className={`num py-2 text-right ${c.impact < 0 ? "text-bad" : c.impact > 0 ? "text-good" : "text-muted"}`}>
                            {usd(c.impact, { exact: true, signed: true })}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-ink font-medium">
                        <th scope="row" className="py-2 text-left">Total variance</th>
                        <td /><td />
                        <td className="num py-2 text-right">{usd(contributorSum, { exact: true, signed: true })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-medium tracking-tight">CapEx, kept separate</h2>
                <p className="num mt-2 text-sm">
                  Spent <strong className="font-medium">{usd(r.actualCapex, { exact: true })}</strong> against{" "}
                  <strong className="font-medium">{usd(r.plannedCapexReserve, { exact: true })}</strong> set aside in reserve over the same{" "}
                  {r.months} month{r.months === 1 ? "" : "s"}. The reserve is savings, not an expense.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-medium tracking-tight">Recorded months</h2>
                <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
                  {actuals.map((a) => (
                    <li key={a.month} className="flex items-center justify-between gap-4">
                      <span>{monthLabel(a.month)}</span>
                      <span className="flex">
                        <button type="button" onClick={() => setDraft(a)} className="inline-flex h-11 items-center px-3 underline-offset-4 hover:underline">Edit</button>
                        <button type="button" onClick={() => remove(a.month)} className="-mr-3 inline-flex h-11 items-center px-3 text-bad underline-offset-4 hover:underline">Delete</button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        <form
          key={formRevision}
          aria-labelledby="record"
          className="flex flex-col gap-4 lg:order-1"
          onSubmit={(e) => { e.preventDefault(); save(); }}
        >
          <h2 id="record" className="text-lg font-medium">{replacing ? `Edit ${monthLabel(form.month)}` : "Record a month"}</h2>
          <p className="-mt-2 text-xs text-muted">Prefilled with the plan&apos;s monthly forecast. Overwrite with what was actually received and paid.</p>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Month
            {/* Safari and Firefox desktop render type="month" as plain text, so the format is spelled out. */}
            <input
              type="month"
              required
              placeholder="YYYY-MM"
              pattern="\d{4}-(0[1-9]|1[0-2])"
              aria-invalid={!monthOk}
              aria-describedby="month-help"
              value={form.month}
              onChange={(e) => setDraft({ ...form, month: e.target.value.trim() })}
              className={`num h-11 rounded-md border bg-bg px-3 font-normal outline-none hover:border-muted focus:border-ink focus:ring-1 focus:ring-ink ${monthOk ? "border-line" : "border-bad"}`}
            />
            <span id="month-help" className={`text-xs font-normal ${monthOk ? "sr-only" : "text-bad"}`}>
              Use year and month, like 2026-11.
            </span>
          </label>
          {FIELD_KEYS.map((k) => (
            <NumberField
              key={`${form.month}-${k}`}
              def={{ label: k === "capex" ? "CapEx spent" : CATEGORY_LABEL[k], kind: "money", help: HELP[k] ?? "", min: 0, max: 1_000_000 }}
              value={form[k]}
              compact={!HELP[k]}
              onCommit={(v: Cents) => setDraft({ ...form, [k]: v })}
            />
          ))}
          {replacing && <p className="text-xs text-muted">Saving replaces the entry already recorded for this month.</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={!valid} className="h-11 flex-1 rounded-md bg-ink px-5 text-sm font-medium text-bg press hover:bg-ink/85 disabled:opacity-50">
              {replacing ? "Save changes" : "Add month"}
            </button>
            <button type="button" onClick={() => { setDraft(null); setFormRevision((n) => n + 1); }} className="press h-11 rounded-md border border-line px-4 text-sm hover:border-ink">Reset</button>
          </div>
        </form>
      </div>

      <div className="mt-16"><DataControls /></div>
    </div>
  );
}

function Compare({ label, f, a, income }: { label: string; f: Cents; a: Cents; income?: boolean }) {
  const better = income ? a > f : a < f;
  return (
    <div className="bg-bg p-5">
      <p className="text-sm text-muted">{label}</p>
      <dl className="mt-2 grid grid-cols-2 gap-2">
        <div><dt className="text-xs text-gold-ink">Forecast</dt><dd className="num text-lg">{usd(f, { exact: true })}</dd></div>
        <div>
          <dt className="text-xs">Actual</dt>
          <dd className={`num text-lg font-medium ${a === f ? "" : better ? "text-good" : "text-bad"}`}>{usd(a, { exact: true })}</dd>
        </div>
      </dl>
    </div>
  );
}
