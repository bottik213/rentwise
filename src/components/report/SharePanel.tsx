"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { localToday } from "@/lib/ledger/dates";
import { combinedActuals } from "@/lib/ledger/to-actuals";
import { buildShareLink, type SharePayload } from "@/lib/share";
import type { Deal, Stored } from "@/lib/storage";

/** Warns first, then makes a link that carries inputs only. Actuals go in only when ticked. */
export function SharePanel({ deal, s }: { deal: Deal; s: Pick<Stored, "scenarios" | "constraints" | "branding"> }) {
  const { t, locale } = useI18n();
  const S = t.share;
  const [withActuals, setWithActuals] = useState(false);
  const [link, setLink] = useState<{ url: string; logoDropped: boolean } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  // A link carries monthly totals (manual and ledger-derived), never the ledger entries themselves.
  const recorded = deal.plan ? combinedActuals(deal.actuals, deal.ledger, localToday()).months : [];
  const months = recorded.length;

  const create = async () => {
    const payload: SharePayload = {
      inputs: deal.inputs,
      isExample: deal.isExample,
      scenarios: s.scenarios,
      constraints: s.constraints,
      ...(s.branding ? { branding: s.branding } : {}),
      ...(withActuals && deal.plan ? { owned: { plan: deal.plan, actuals: recorded } } : {}),
    };
    try {
      setLink(await buildShareLink(`${location.origin}/${locale}`, payload));
      setStatus(null);
    } catch {
      setStatus(S.noLinks);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link!.url);
      setStatus(S.copied);
    } catch {
      setStatus(S.copyBlocked);
    }
  };

  return (
    <section className="card noprint bpanel" aria-labelledby="sh-h">
      <h2 className="disp" id="sh-h" style={{ margin: 0, fontSize: 22 }}>{S.title}</h2>
      <p className="callout" role="note" style={{ margin: "12px 0 16px" }}>
        {S.warn}
      </p>
      {months > 0 && (
        <label className="chk" style={{ marginBottom: 12 }}>
          <input type="checkbox" checked={withActuals} onChange={(e) => { setWithActuals(e.target.checked); setLink(null); }} />
          {S.withActuals(months)}
        </label>
      )}
      {!link ? (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void create()}>
          {S.create}
        </button>
      ) : (
        <div className="shr">
          <span className="inp">
            <input readOnly aria-label={S.link} value={link.url} onFocus={(e) => e.currentTarget.select()} />
          </span>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void copy()}>
            {S.copy}
          </button>
        </div>
      )}
      {link?.logoDropped && (
        <p className="note" style={{ margin: "8px 0 0" }}>
          {S.logoDropped}
        </p>
      )}
      <p role="status" className="note" style={{ margin: "8px 0 0" }}>
        {status}
      </p>
    </section>
  );
}
