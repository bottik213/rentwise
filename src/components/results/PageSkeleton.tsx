"use client";
import { useI18n } from "@/i18n/client";

/** Shown while localStorage is read on the client (server render and hydration). */
export function PageSkeleton() {
  const { t } = useI18n();
  return (
    <div aria-busy="true" aria-label={t.common.loading} className="skel animate-pulse">
      <span style={{ height: 56, width: "min(420px, 100%)" }} />
      <span style={{ height: 200 }} />
      <span />
    </div>
  );
}
