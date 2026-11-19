"use client";
import { useI18n } from "@/i18n/client";
import { exportAppData, retryStorage, useStorageStatus } from "@/lib/storage";

export function StorageNotice() {
  const { t } = useI18n();
  const status = useStorageStatus();
  if (!status?.problem) return null;
  const message = t.storage[status.problem];

  return (
    <div role="alert" className="notice">
      <div>
        <p className="t">{message.title}</p>
        <p>{message.detail}</p>
        {status.hasUnsavedChanges && <p>{t.storage.unsaved}</p>}
        <div className="flex flex-wrap gap-x-4">
          <button type="button" onClick={() => retryStorage()} className="lnk" style={{ paddingLeft: 0, fontWeight: 600, color: "var(--ink)" }}>{message.action}</button>
          {status.problem !== "read" && (
            <button type="button" onClick={exportAppData} className="lnk">{t.storage.exportCurrent}</button>
          )}
        </div>
      </div>
    </div>
  );
}
