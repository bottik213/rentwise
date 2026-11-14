"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NEW_PROPERTY_DEFAULTS } from "@/components/forms/fields";
import { PropertyForm } from "@/components/forms/PropertyForm";
import { setAppState, useAppState } from "@/lib/storage";
import { PageSkeleton } from "@/components/results/PageSkeleton";

export default function AnalyzePage() {
  const s = useAppState();
  const router = useRouter();
  const [fresh, setFresh] = useState(false);
  if (!s) return <PageSkeleton />;

  const editing = s.property && !fresh;
  const startOver = () => {
    if (s.actuals.length && !confirm("Starting a new property deletes the actuals you recorded. Continue?")) return;
    setFresh(true);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">{editing ? "Edit property inputs" : "Property inputs"}</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Prefilled percentages are illustrative assumptions, not local market data. Replace them with your own and mark
            where each number came from.
          </p>
        </div>
        {editing && (
          <button type="button" onClick={startOver} className="press h-11 shrink-0 rounded-md border border-line px-4 text-sm hover:border-ink">
            Start a blank property
          </button>
        )}
      </div>
      <PropertyForm
        key={editing ? "edit" : "new"}
        initial={editing ? s.property! : NEW_PROPERTY_DEFAULTS}
        submitLabel={editing ? "Save and view analysis" : "Analyze property"}
        onSubmit={(property) => {
          setAppState((x) =>
            editing ? { ...x, property } : { ...x, property, isExample: false, plan: null, actuals: [] },
          );
          router.push("/results");
        }}
      />
    </div>
  );
}
