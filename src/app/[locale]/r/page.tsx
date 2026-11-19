"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Arrow } from "@/components/Icons";
import { Report } from "@/components/report/Report";
import { PageSkeleton } from "@/components/results/PageSkeleton";
import { useI18n } from "@/i18n/client";
import { EMPTY_LEDGER } from "@/lib/ledger/types";
import { decodeShare, type DecodeResult } from "@/lib/share";
import { newId, setStored } from "@/lib/storage";
import "../results/results.css";
import "../report/report.css";

/** A report shared as a link. Read-only, recalculated here; nothing is saved unless the reader asks. */
export default function SharedReportPage() {
  const router = useRouter();
  const { t, path } = useI18n();
  const S = t.share;
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
    document.title = t.report.docTitle(result.payload.inputs.nickname || S.shared);
    return () => void (document.title = before);
  }, [result, t, S]);

  if (!result) return <PageSkeleton />;
  if (!result.ok) {
    const [title, text] = S.errors[result.reason];
    return (
      <div className="pg-results pg-report">
        <div className="empty">
          <h1 className="disp">{title}</h1>
          <p>{text}</p>
          <div className="ctas">
            <Link href={path("/")} className="btn btn-primary">
              {S.goHome} <Arrow />
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
    if (ok) router.push(path("/results"));
    else setProblem(S.cantSave);
  };

  const accent = p.branding?.accent;
  return (
    <div className="pg-results pg-report" data-brand={accent ? "" : undefined} style={accent ? ({ "--accent": accent } as React.CSSProperties) : undefined}>
      <div className="rwrap">
        <div className="rshare noprint">
          <p>
            <b>{S.readOnly}</b>
            {S.recalculated}
            {p.owned && S.includes(p.owned.actuals.length)}
          </p>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => window.print()}>
            {t.common.downloadPdf}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={save}>
            {S.saveMine}
          </button>
        </div>
        {problem && (
          <p role="alert" className="ferr" style={{ margin: 0 }}>
            {problem}
          </p>
        )}
        <p className="note noprint" style={{ margin: 0 }}>
          {S.savingNote}
        </p>
        <Report data={{ inputs: p.inputs, isExample: p.isExample, scenarios: p.scenarios, constraints: p.constraints, branding: p.branding }} generated={new Date()} />
      </div>
    </div>
  );
}
