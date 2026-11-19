"use client";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { clearAppData, exportAppData } from "@/lib/storage";

export function DataControls() {
  const router = useRouter();
  const { t, path } = useI18n();
  return (
    <div className="dc">
      <span>{t.data.stays}</span>
      <button type="button" className="lnk" onClick={exportAppData}>
        {t.data.export}
      </button>
      <button
        type="button"
        className="lnk danger"
        onClick={() => {
          if (!confirm(t.data.clearConfirm)) return;
          if (clearAppData()) router.push(path("/"));
        }}
      >
        {t.data.clear}
      </button>
    </div>
  );
}

/** The disclaimer plus data controls, at the end of every page. */
export function PageFooter({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <footer className={`pfoot ${className ?? ""}`}>
      <p>{t.disclaimer}</p>
      <DataControls />
    </footer>
  );
}
