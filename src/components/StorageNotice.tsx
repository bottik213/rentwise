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
    <div role="alert" className="border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-4 text-sm sm:px-6">
        <p className="font-medium text-bad">{message.title}</p>
        <p className="mt-1">{message.detail}</p>
        {status.hasUnsavedChanges && (
          <p className="mt-1">Your latest changes are only kept in this tab. Export a copy before closing or reloading.</p>
        )}
        <div className="mt-2 flex flex-wrap gap-x-6">
          <button type="button" onClick={() => retryStorage()} className="min-h-11 font-medium underline underline-offset-4">{message.action}</button>
          {status.problem !== "read" && (
            <button type="button" onClick={exportAppData} className="min-h-11 underline underline-offset-4">Export current data (JSON)</button>
          )}
        </div>
      </div>
    </div>
  );
}
