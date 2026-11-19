"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageFooter } from "@/components/DataControls";
import { NEW_PROPERTY_DEFAULTS } from "@/components/forms/fields";
import { PropertyForm } from "@/components/forms/PropertyForm";
import { PageSkeleton } from "@/components/results/PageSkeleton";
import { useI18n } from "@/i18n/client";
import { EMPTY_LEDGER } from "@/lib/ledger/types";
import { setAppState, useAppState } from "@/lib/storage";
import "./analyze.css";

export default function AnalyzePage() {
  const s = useAppState();
  const router = useRouter();
  const { t, path } = useI18n();
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
            <h1 className="disp">{editing ? t.analyze.editTitle : t.analyze.newTitle}</h1>
            <p>{t.analyze.intro}</p>
          </div>
          {editing && (
            <button type="button" onClick={startOver} className="btn btn-quiet">
              {t.analyze.blank}
            </button>
          )}
        </div>
        <PropertyForm
          key={editing ? "edit" : "new"}
          initial={editing ? s.property! : NEW_PROPERTY_DEFAULTS}
          submitLabel={editing ? t.analyze.saveView : t.analyze.analyze}
          onSubmit={(property) => {
            const accepted = setAppState((x) =>
              // Saving the full form makes it your property: it is no longer labeled synthetic or reset without asking.
              // A blank form becomes a new property; the one you had open stays in your list.
              editing ? { ...x, property, isExample: false } : { ...x, activeId: null, property, isExample: false, plan: null, actuals: [], ledger: EMPTY_LEDGER },
            );
            if (accepted) router.push(path("/results"));
            else if (!editing && s.deals.length >= 50) alert(t.analyze.full);
          }}
        />
        <PageFooter className="mt-12" />
      </div>
    </div>
  );
}
