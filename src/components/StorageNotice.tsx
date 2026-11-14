"use client";
import { exportAppData, retryStorage, type StorageProblem, useStorageStatus } from "@/lib/storage";

const MESSAGES: Record<StorageProblem, { title: string; detail: string; action: string }> = {
  read: {
    title: "Saved data couldn't be loaded",
    detail: "Load your saved data before making changes. Enable browser storage for this site and try loading again.",
    action: "Try loading again",
  },
  save: {
    title: "Your changes aren't saved",
    detail: "Browser storage may be full or blocked. Free up space or enable storage for this site, then retry saving.",
    action: "Retry saving",
  },
  clear: {
    title: "Your saved data wasn't cleared",
    detail: "The browser refused to delete your saved data. Your current data is still available. Try clearing again when storage is available.",
    action: "Retry clearing",
  },
};

export function StorageNotice() {
  const status = useStorageStatus();
  if (!status?.problem) return null;
  const message = MESSAGES[status.problem];

  return (
    <div role="alert" className="notice">
      <div>
        <p className="t">{message.title}</p>
        <p>{message.detail}</p>
        {status.hasUnsavedChanges && (
          <p>Your latest changes are only kept in this tab. Export a copy before closing or reloading.</p>
        )}
        <div className="flex flex-wrap gap-x-4">
          <button type="button" onClick={() => retryStorage()} className="lnk" style={{ paddingLeft: 0, fontWeight: 600, color: "var(--ink)" }}>{message.action}</button>
          {status.problem !== "read" && (
            <button type="button" onClick={exportAppData} className="lnk">Export current data (JSON)</button>
          )}
        </div>
      </div>
    </div>
  );
}
