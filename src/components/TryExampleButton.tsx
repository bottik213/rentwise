"use client";
import { useRouter } from "next/navigation";
import { DEMO_PROPERTY } from "@/data/demo-property";
import { EMPTY_STATE, setAppState } from "@/lib/storage";

export function TryExampleButton({ className }: { className: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        let loaded = false;
        setAppState((s) => {
          // Your own property is never replaced silently; the example itself can be reset freely.
          const months = s.actuals.length ? ` and its ${s.actuals.length} recorded month(s)` : "";
          loaded = !s.property || s.isExample || confirm(`Loading the example replaces your property${months}. Continue?`);
          return loaded ? { ...EMPTY_STATE, property: DEMO_PROPERTY, isExample: true } : s;
        });
        if (loaded) router.push("/results");
      }}
    >
      Try the example property
    </button>
  );
}
