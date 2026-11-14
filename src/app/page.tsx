import Link from "next/link";
import { TryExampleButton } from "@/components/TryExampleButton";
import { DEMO_PROPERTY } from "@/data/demo-property";
import { offerCeiling } from "@/lib/finance/offer-ceiling";
import { underwrite } from "@/lib/finance/underwriting";
import { usd, pct } from "@/lib/format";

const STEPS = [
  ["Analyze", "Cash flow, NOI, cap rate and cash-on-cash from your own inputs."],
  ["Stress test", "Conservative and optimistic cases, and which assumption moves cash flow most."],
  ["Offer ceiling", "The highest price that still meets your minimum return, under your assumptions."],
  ["Track actuals", "Record what you really collected and paid each month."],
  ["Explain variance", "See exactly which costs moved cash flow away from plan, to the cent."],
];

export default function Landing() {
  // Computed by the same engine the app uses, on the synthetic example.
  const u = underwrite(DEMO_PROPERTY);
  const ceiling = offerCeiling(DEMO_PROPERTY, { minMonthlyCashFlow: 20_000 });

  return (
    <>
      <section className="bg-night text-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-24">
          <div>
            <h1 className="text-4xl font-medium leading-[1.05] tracking-[-0.035em] sm:text-6xl">
              Know the numbers before you buy. <span className="text-gold">Know the truth after you buy.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
              For first-time rental investors and landlords with 1–5 properties. Underwrite a long-term rental, find the most you can pay and still hit your return target, then compare
              every month of real results against the plan you bought on.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/analyze" className="flex h-12 items-center justify-center rounded-md bg-gold px-6 font-medium text-night press hover:brightness-110">
                Analyze a property
              </Link>
              <TryExampleButton className="h-12 rounded-md border border-white/30 px-6 font-medium press hover:border-white" />
            </div>
            <p className="mt-4 text-sm text-white/60">No sign-up. The example uses synthetic numbers. Your data stays in this browser.</p>
          </div>

          <div className="rounded-md border border-white/15 bg-white/[0.04] p-6" aria-label="Example property, computed">
            <h2 className="text-sm font-medium">Example property <span className="font-normal text-white/60">· synthetic numbers</span></h2>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5">
              <Stat label="Purchase price" value={usd(DEMO_PROPERTY.purchasePrice)} />
              <Stat label="Rent" value={`${usd(DEMO_PROPERTY.monthlyRent)}/mo`} />
              <Stat label="Cash flow after reserves" value={`${usd(u.reserveAdjustedCashFlow, { exact: true })}/mo`} />
              <Stat label="Cash-on-cash" value={pct(u.cashOnCash)} />
            </dl>
            {ceiling.status === "feasible" && (
              <div className="mt-6 border-t border-white/15 pt-5">
                <p className="text-sm text-white/70">Offer ceiling for at least $200/mo cash flow</p>
                <p className="num mt-1 text-3xl font-medium tracking-tight text-gold">{usd(ceiling.price)}</p>
                <p className="num mt-1 text-sm text-white/70">{usd(ceiling.deltaFromAsking, { signed: true })} vs. asking price</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <h2 className="max-w-2xl text-2xl font-medium tracking-tight sm:text-3xl">One workflow from first look to first year of ownership</h2>
        <ol className="mt-10 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="bg-bg p-5">
              <span className="num text-sm text-gold-ink">0{i + 1}</span>
              <h3 className="mt-2 font-medium">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-white/60">{label}</dt>
      <dd className="num mt-1 text-xl font-medium">{value}</dd>
    </div>
  );
}
