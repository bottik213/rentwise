"use client";
import { useState } from "react";
import { buildShareLink, type SharePayload } from "@/lib/share";
import type { Deal, Stored } from "@/lib/storage";

/** Warns first, then makes a link that carries inputs only. Actuals go in only when ticked. */
export function SharePanel({ deal, s }: { deal: Deal; s: Pick<Stored, "scenarios" | "constraints" | "branding"> }) {
  const [withActuals, setWithActuals] = useState(false);
  const [link, setLink] = useState<{ url: string; logoDropped: boolean } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const months = deal.plan ? deal.actuals.length : 0;

  const create = async () => {
    const payload: SharePayload = {
      inputs: deal.inputs,
      isExample: deal.isExample,
      scenarios: s.scenarios,
      constraints: s.constraints,
      ...(s.branding ? { branding: s.branding } : {}),
      ...(withActuals && deal.plan ? { owned: { plan: deal.plan, actuals: deal.actuals } } : {}),
    };
    try {
      setLink(await buildShareLink(location.origin, payload));
      setStatus(null);
    } catch {
      setStatus("This browser can't make share links. Download the PDF instead.");
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link!.url);
      setStatus("Link copied.");
    } catch {
      setStatus("Copying was blocked. Select the link above and copy it yourself.");
    }
  };

  return (
    <section className="card noprint bpanel" aria-labelledby="sh-h">
      <h2 className="disp" id="sh-h" style={{ margin: 0, fontSize: 22 }}>Share a link to this report</h2>
      <p className="callout" role="note" style={{ margin: "12px 0 16px" }}>
        Anyone with the link can see these numbers: the property&apos;s inputs, your scenarios and targets, and your branding. Nothing is uploaded; the numbers travel inside the link, and the recipient&apos;s browser recalculates the report.
      </p>
      {months > 0 && (
        <label className="chk" style={{ marginBottom: 12 }}>
          <input type="checkbox" checked={withActuals} onChange={(e) => { setWithActuals(e.target.checked); setLink(null); }} />
          Also include the locked plan and {months} recorded month{months === 1 ? "" : "s"}
        </label>
      )}
      {!link ? (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void create()}>
          I understand, create the link
        </button>
      ) : (
        <div className="shr">
          <span className="inp">
            <input readOnly aria-label="Share link" value={link.url} onFocus={(e) => e.currentTarget.select()} />
          </span>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void copy()}>
            Copy link
          </button>
        </div>
      )}
      {link?.logoDropped && (
        <p className="note" style={{ margin: "8px 0 0" }}>
          Your logo was left out: it would make the link too long to paste safely. Your name, company and accent color are included.
        </p>
      )}
      <p role="status" className="note" style={{ margin: "8px 0 0" }}>
        {status}
      </p>
    </section>
  );
}
