"use client";
import { useSyncExternalStore, useState } from "react";
import { useI18n } from "@/i18n/client";
import { exportOldData, hideOldNotice, oldData, oldNoticeHidden } from "@/lib/storage";

const noop = () => () => {};

/** Once, while the US version's data is still in this browser: say it was left alone and offer a download. */
export function OldDataNotice() {
  const { t } = useI18n();
  const [hidden, setHidden] = useState(false);
  const show = useSyncExternalStore(noop, () => !oldNoticeHidden() && Object.keys(oldData()).length > 0, () => false);
  if (!show || hidden) return null;
  return (
    <section className="notice" aria-label={t.oldData.title}>
      <div>
        <p className="t">{t.oldData.title}</p>
        <p>{t.oldData.text}</p>
        <div className="flex flex-wrap gap-x-4">
          <button type="button" onClick={exportOldData} className="lnk" style={{ paddingLeft: 0, fontWeight: 600, color: "var(--ink)" }}>
            {t.oldData.export}
          </button>
          <button type="button" className="lnk" onClick={() => { hideOldNotice(); setHidden(true); }}>
            {t.oldData.dismiss}
          </button>
        </div>
      </div>
    </section>
  );
}
