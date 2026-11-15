"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Arrow } from "@/components/Icons";
import { Report } from "@/components/report/Report";
import { PageSkeleton } from "@/components/results/PageSkeleton";
import { EMPTY_LEDGER } from "@/lib/ledger/types";
import { decodeShare, type DecodeResult } from "@/lib/share";
import { newId, setStored } from "@/lib/storage";
import "../results/results.css";
import "../report/report.css";

const ERRORS = {
  empty: ["This link has no report in it", "The end of the link is missing, which usually happens when it's cut off while copying. Ask the sender to copy it again."],
  broken: ["This link is broken or incomplete", "Part of it is missing or was changed, so RentWise shows nothing rather than wrong numbers. Ask the sender to copy the link again."],
  newer: ["This link was made by a newer RentWise", "Reload the page to get the latest version. If that doesn't help, ask the sender for a new link."],
} as const;

/** A report shared as a link. Read-only, recalculated here; nothing is saved unless the reader asks. */
export default function SharedReportPage() {
  const router = useRouter();
  const [result, setResult] = useState<DecodeResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const read = () => void decodeShare(location.hash).then(setResult);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  useEffect(() => {
    if (!result?.ok) return;
    const before = document.title;
    document.title = `RentWise report: ${result.payload.inputs.nickname || "Shared property"}`;
    return () => void (document.title = before);
  }, [result]);

  if (!result) return <PageSkeleton />;
  if (!result.ok) {
    const [title, text] = ERRORS[result.reason];
    return (
      <div className="pg-results pg-report">
        <div className="empty">
          <h1 className="disp">{title}</h1>
          <p>{text}</p>
          <div className="ctas">
            <Link href="/" className="btn btn-primary">
              Go to RentWise <Arrow />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const p = result.payload;
  const save = () => {
    const now = new Date().toISOString();
    const id = newId();
    const ok = setStored((s) => ({
      ...s,
      deals: [...s.deals, { id, createdAt: now, updatedAt: now, inputs: p.inputs, isExample: p.isExample, plan: p.owned?.plan ?? null, actuals: p.owned?.actuals ?? [], ledger: EMPTY_LEDGER }],
      activeId: id,
    }));
    if (ok) router.push("/results");
    else setProblem("It couldn't be saved here: this browser may be blocking storage, or you already have 50 properties.");
  };

  const accent = p.branding?.accent;
  return (
    <div className="pg-results pg-report" data-brand={accent ? "" : undefined} style={accent ? ({ "--brand": accent } as React.CSSProperties) : undefined}>
      <div className="rwrap">
        <div className="rshare noprint">
          <p>
            <b>Shared report, read-only.</b> Recalculated in your browser from the inputs in this link; nothing was uploaded.
            {p.owned && ` The link also includes a locked plan and ${p.owned.actuals.length} recorded month${p.owned.actuals.length === 1 ? "" : "s"}.`}
          </p>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => window.print()}>
            Download PDF
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={save}>
            Save to my RentWise
          </button>
        </div>
        {problem && (
          <p role="alert" className="ferr" style={{ margin: 0 }}>
            {problem}
          </p>
        )}
        <p className="note noprint" style={{ margin: 0 }}>
          Saving adds this property to your list in this browser. Your own scenarios and targets stay as they are, so your numbers may differ from the sender&apos;s.
        </p>
        <Report data={{ inputs: p.inputs, isExample: p.isExample, scenarios: p.scenarios, constraints: p.constraints, branding: p.branding }} generated={new Date()} />
      </div>
    </div>
  );
}
