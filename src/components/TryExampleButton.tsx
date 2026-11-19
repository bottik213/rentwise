"use client";
import { useRouter } from "next/navigation";
import { DEMO_PROPERTY } from "@/data/demo-property";
import { useI18n } from "@/i18n/client";
import { DEFAULT_SCENARIOS } from "@/lib/finance/scenarios";
import { EMPTY_LEDGER } from "@/lib/ledger/types";
import type { ScenarioName } from "@/lib/finance/types";
import { EMPTY_STORED, type Deal, newId, setStored, type Stored } from "@/lib/storage";
import { PropertyInputsSchema } from "@/lib/validation";

// Compare validated snapshots so any edit to the example, the scenarios or the targets is protected.
const EXAMPLE_INPUTS = JSON.stringify(PropertyInputsSchema.parse(DEMO_PROPERTY));
const NAMES: ScenarioName[] = ["conservative", "base", "optimistic"];
// Scenarios saved before Phase 2 have no growth deltas; they mean the defaults, so they count as untouched.
const settings = (s: Pick<Stored, "scenarios" | "constraints">) =>
  JSON.stringify({ sc: NAMES.map((n) => ({ ...DEFAULT_SCENARIOS[n], ...s.scenarios[n] })), c: s.constraints });
const DEFAULT_SETTINGS = settings(EMPTY_STORED);

/** Opens the synthetic example with default scenarios and targets. Your own properties are never touched. */
export function TryExampleButton({ className }: { className: string }) {
  const router = useRouter();
  const { t, path } = useI18n();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        let loaded = false;
        const ok = setStored((s) => {
          const ex = s.deals.find((d) => d.isExample);
          const lost: string[] = [];
          const entries = ex ? ex.ledger.payments.length + ex.ledger.expenses.length + ex.ledger.leases.length + ex.ledger.maintenance.length : 0;
          if (ex && (JSON.stringify(ex.inputs) !== EXAMPLE_INPUTS || ex.plan || ex.actuals.length || entries))
            lost.push(t.example.edits(ex.actuals.length, entries));
          if (settings(s) !== DEFAULT_SETTINGS) lost.push(t.example.settings);
          loaded = !lost.length || confirm(t.example.confirm(lost));
          if (!loaded) return s;
          const now = new Date().toISOString();
          const fresh: Deal = { id: ex?.id ?? newId(), createdAt: ex?.createdAt ?? now, updatedAt: now, inputs: DEMO_PROPERTY, isExample: true, plan: null, actuals: [], ledger: EMPTY_LEDGER };
          const deals = ex ? s.deals.map((d) => (d.id === ex.id ? fresh : d)) : [...s.deals, fresh];
          return { ...s, deals, activeId: fresh.id, scenarios: EMPTY_STORED.scenarios, constraints: EMPTY_STORED.constraints };
        });
        if (loaded && ok) router.push(path("/results"));
        else if (loaded) alert(t.example.full);
      }}
    >
      {t.example.button}
    </button>
  );
}
