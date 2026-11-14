"use client";
import { useRouter } from "next/navigation";
import { DEMO_PROPERTY } from "@/data/demo-property";
import { EMPTY_STATE, setAppState } from "@/lib/storage";
import { StoredStateSchema } from "@/lib/validation";

// Compare the complete validated snapshot so edits to inputs, scenarios or targets are protected.
const EXAMPLE_STATE = StoredStateSchema.parse({ ...EMPTY_STATE, property: DEMO_PROPERTY, isExample: true });
const EXAMPLE_JSON = JSON.stringify(EXAMPLE_STATE);

export function TryExampleButton({ className }: { className: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        let loaded = false;
        setAppState((s) => {
          // Never replace your own property or any recorded months silently; an untouched example resets freely.
          const months = s.actuals.length ? ` and its ${s.actuals.length} recorded month(s)` : "";
          loaded = !s.property || JSON.stringify(s) === EXAMPLE_JSON || confirm(`Loading the example replaces your property${months}. Continue?`);
          return loaded ? EXAMPLE_STATE : s;
        });
        if (loaded) router.push("/results");
      }}
    >
      Try the example property
    </button>
  );
}
