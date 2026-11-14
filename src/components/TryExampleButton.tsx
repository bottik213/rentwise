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
        setAppState((s) => {
          const keep = !s.property || s.isExample || !s.actuals.length || confirm("Loading the example replaces your property and its actuals. Continue?");
          return keep ? { ...EMPTY_STATE, property: DEMO_PROPERTY, isExample: true } : s;
        });
        router.push("/results");
      }}
    >
      Try the example property
    </button>
  );
}
