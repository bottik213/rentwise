"use client";
import { useRouter } from "next/navigation";
import { clearAppData, exportAppData } from "@/lib/storage";

export function DataControls() {
  const router = useRouter();
  const btn = "inline-flex min-h-11 items-center underline-offset-4 hover:text-ink hover:underline";
  return (
    <div className="flex flex-wrap items-center gap-x-6 text-sm text-muted">
      <span>Your data stays in this browser.</span>
      <button type="button" className={btn} onClick={exportAppData}>Export my data (JSON)</button>
      <button
        type="button"
        className={btn}
        onClick={() => {
          if (!confirm("Delete the property, plan and actuals stored in this browser? This can't be undone.")) return;
          clearAppData();
          router.push("/");
        }}
      >
        Clear my data
      </button>
    </div>
  );
}
