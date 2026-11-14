"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { DataControls } from "@/components/DataControls";
import { TryExampleButton } from "@/components/TryExampleButton";
import { FIELDS } from "@/components/forms/fields";
import { NumberField } from "@/components/forms/NumberField";
import { Breakdown, HeadlineMetrics } from "@/components/results/Metrics";
import { OfferCeiling } from "@/components/results/OfferCeiling";
import { PageSkeleton } from "@/components/results/PageSkeleton";
import { Scenarios } from "@/components/results/Scenarios";
import { Sensitivity } from "@/components/results/Sensitivity";
import { runScenarios } from "@/lib/finance/scenarios";
import { sensitivity } from "@/lib/finance/sensitivity";
import type { PropertyInputs } from "@/lib/finance/types";
import { setAppState, useAppState } from "@/lib/storage";

const QUICK = ["purchasePrice", "monthlyRent", "vacancyPct", "annualInterestRate", "annualInsurance", "annualPropertyTax", "maintenancePct", "managementPct", "capexPct"] as const;

export default function ResultsPage() {
  const s = useAppState();
  const router = useRouter();
  if (!s) return <PageSkeleton />;
  const p = s.property;

  if (!p) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <h1 className="text-3xl font-medium tracking-tight">No property to analyze yet</h1>
        <p className="mt-3 text-muted">Enter your own numbers, or load the synthetic example to see the full workflow.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/analyze" className="press flex h-11 items-center justify-center rounded-md bg-ink px-5 font-medium text-bg hover:bg-ink/85">Analyze a property</Link>
          <TryExampleButton className="press h-11 rounded-md border border-line px-5 font-medium hover:border-ink" />
        </div>
      </div>
    );
  }

  const results = runScenarios(p, s.scenarios);
  const u = results.base; // headline = base column, so they can never disagree
  const setProp = (patch: Partial<PropertyInputs>) => setAppState((x) => (x.property ? { ...x, property: { ...x.property, ...patch } } : x));

  const markOwned = () => {
    if (s.plan && s.actuals.length && !confirm(`Lock these inputs as the new plan? Your ${s.actuals.length} recorded month(s) will be compared against them.`)) return;
    setAppState((x) => ({ ...x, plan: { inputs: x.property!, lockedAt: new Date().toISOString() } }));
    router.push("/performance");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">{p.nickname || "Your property"}</h1>
          <p className="mt-2 text-muted">{s.isExample && <span className="mr-2 rounded-sm border border-line px-1.5 py-0.5 text-xs text-ink">Synthetic example</span>}Investment analysis under your assumptions. Change any input and every number updates.</p>
        </div>
        <div className="flex shrink-0 gap-3">
          <Link href="/analyze" className="press flex h-11 items-center rounded-md border border-line px-4 text-sm hover:border-ink">All inputs</Link>
          <button type="button" onClick={markOwned} className="h-11 rounded-md bg-ink px-5 text-sm font-medium text-bg press hover:bg-ink/85">
            {s.plan ? "Re-lock plan and track actuals" : "Mark as owned"}
          </button>
        </div>
      </header>

      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside aria-label="Quick assumptions" className="lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-sm font-medium">Quick assumptions</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-1">
            {QUICK.map((k) => (
              <NumberField
                key={k}
                def={FIELDS[k]}
                value={p[k]}
                compact
                disabled={k === "annualInterestRate" && p.allCash}
                onCommit={(v) => setProp({ [k]: v })}
              />
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-12">
          <HeadlineMetrics u={u} />
          <Section title="Monthly statement" sub="Every total is the exact sum of the lines above it.">
            <Breakdown u={u} />
          </Section>
          <Section title="Scenarios" sub="Illustrative adjustments, not forecasts. Edit any percentage.">
            <Scenarios scenarios={s.scenarios} results={results} />
          </Section>
          <Section title="Offer ceiling" sub="The highest price that still meets every target you set.">
            <OfferCeiling property={p} constraints={s.constraints} conservative={s.scenarios.conservative} />
          </Section>
          <Section title="What moves cash flow most" sub="Each line changes one assumption and recomputes everything.">
            <Sensitivity rows={sensitivity(p)} />
          </Section>
          <DataControls />
        </div>
      </div>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-medium tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted">{sub}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}
