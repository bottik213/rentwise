"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageFooter } from "@/components/DataControls";
import { NEW_PROPERTY_DEFAULTS } from "@/components/forms/fields";
import { PropertyForm } from "@/components/forms/PropertyForm";
import { PageSkeleton } from "@/components/results/PageSkeleton";
import { EMPTY_LEDGER } from "@/lib/ledger/types";
import { setAppState, useAppState } from "@/lib/storage";
import "./analyze.css";

export default function AnalyzePage() {
  const s = useAppState();
  const router = useRouter();
  const [fresh, setFresh] = useState(false);
  if (!s) return <PageSkeleton />;

  const editing = s.property && !fresh;
  const startOver = () => {
    setFresh(true);
  };

  return (
    <div className="pg-inputs">
      <div className="wrap">
        <div className="ph">
          <div>
            <h1 className="disp">{editing ? "Edit the property" : "Tell us about the property"}</h1>
            <p>
              Use the listing and your best guesses. Mark where each number came from, and the analysis will tell you which estimates to check first. Prefilled percentages are common assumptions, not local market data.
            </p>
          </div>
          {editing && (
            <button type="button" onClick={startOver} className="btn btn-quiet">
              Start a blank property
            </button>
          )}
        </div>
        <PropertyForm
          key={editing ? "edit" : "new"}
          initial={editing ? s.property! : NEW_PROPERTY_DEFAULTS}
          submitLabel={editing ? "Save and view analysis" : "Analyze property"}
          onSubmit={(property) => {
            const accepted = setAppState((x) =>
              // Saving the full form makes it your property: it is no longer labeled synthetic or reset without asking.
              // A blank form becomes a new property; the one you had open stays in your list.
              editing ? { ...x, property, isExample: false } : { ...x, activeId: null, property, isExample: false, plan: null, actuals: [], ledger: EMPTY_LEDGER },
            );
            if (accepted) router.push("/results");
            else if (!editing && s.deals.length >= 50) alert("You have 50 saved properties, the most this browser keeps. Delete one under Compare first.");
          }}
        />
        <PageFooter className="mt-12">
          RentWise is a modeling tool, not financial advice. The starting values for a new property are common assumptions, not recommendations.
        </PageFooter>
      </div>
    </div>
  );
}
