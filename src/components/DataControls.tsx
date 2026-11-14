"use client";
import { useRouter } from "next/navigation";
import { clearAppData, exportAppData } from "@/lib/storage";

export function DataControls() {
  const router = useRouter();
  return (
    <div className="dc">
      <span>Your data stays in this browser.</span>
      <button type="button" className="lnk" onClick={exportAppData}>
        Export my data (JSON)
      </button>
      <button
        type="button"
        className="lnk danger"
        onClick={() => {
          if (!confirm("Delete the property, plan and actuals stored in this browser? This can't be undone.")) return;
          if (clearAppData()) router.push("/");
        }}
      >
        Clear my data
      </button>
    </div>
  );
}

/** Disclaimer plus data controls, at the end of every page. */
export function PageFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <footer className={`pfoot ${className ?? ""}`}>
      <p>{children}</p>
      <DataControls />
    </footer>
  );
}
