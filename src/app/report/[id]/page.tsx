"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Report } from "@/components/report/Report";
import { SharePanel } from "@/components/report/SharePanel";
import { PageSkeleton } from "@/components/results/PageSkeleton";
import { accentProblem, readLogo } from "@/lib/branding";
import { setStored, useAppState, type Stored } from "@/lib/storage";
import "../../results/results.css";
import "../report.css";

type Branding = NonNullable<Stored["branding"]>;
const setBranding = (patch: Partial<Branding>) =>
  setStored((s) => {
    const next: Branding = { ...s.branding, ...patch };
    for (const k of Object.keys(next) as (keyof Branding)[]) if (!next[k]) delete next[k];
    return { ...s, branding: next };
  });

function BrandingPanel({ b }: { b: Branding }) {
  const [accent, setAccent] = useState(b.accent ?? "#1e4d3b");
  const [err, setErr] = useState<string | null>(null);
  const text = (k: "name" | "company" | "contact", label: string, max: number) => (
    <label className="fld">
      <span className="flabel">{label}</span>
      <span className="inp">
        <input maxLength={max} defaultValue={b[k] ?? ""} onChange={(e) => setBranding({ [k]: e.target.value.trim() || undefined })} />
      </span>
    </label>
  );
  const pick = (hex: string) => {
    setAccent(hex);
    const problem = accentProblem(hex);
    setErr(problem);
    if (!problem) setBranding({ accent: hex });
  };
  return (
    <section className="card noprint bpanel" aria-labelledby="b-h">
      <h2 className="disp" id="b-h" style={{ margin: 0, fontSize: 22 }}>Your branding</h2>
      <p className="note" style={{ margin: "4px 0 16px" }}>Saved in this browser only. It appears on the report and the PDF; the disclaimer always stays.</p>
      <div className="bgrid">
        {text("name", "Your name", 60)}
        {text("company", "Company", 60)}
        {text("contact", "Contact line", 120)}
        <label className="fld">
          <span className="flabel">Accent color</span>
          <span className={`inp ${err ? "err" : ""}`}>
            <input type="color" aria-label="Accent color picker" value={/^#[0-9a-f]{6}$/i.test(accent) ? accent : "#000000"} onChange={(e) => pick(e.target.value)} style={{ width: 32, flex: "none", padding: 0, border: 0, background: "none" }} />
            <input aria-label="Accent color hex" value={accent} maxLength={7} aria-invalid={!!err} aria-describedby="acc-err" onChange={(e) => pick(e.target.value.trim())} />
          </span>
          <span id="acc-err" className="ferr" hidden={!err}>{err}</span>
        </label>
        <div className="fld">
          <span className="flabel">Logo (PNG or JPG, up to 200 KB)</span>
          <div className="logo-row">
            {b.logo && (
              // eslint-disable-next-line @next/next/no-img-element -- a local data URL
              <img src={b.logo} alt="Your logo" />
            )}
            <label className="btn btn-quiet btn-sm">
              {b.logo ? "Replace" : "Add logo"}
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) readLogo(f).then((logo) => { setErr(null); if (!setBranding({ logo })) setErr("That logo couldn't be saved."); }, (x: Error) => setErr(x.message));
                }}
              />
            </label>
            {b.logo && <button type="button" className="lnk danger" onClick={() => setBranding({ logo: undefined })}>Remove</button>}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ReportPage() {
  const s = useAppState();
  const { id } = useParams<{ id: string }>();
  const [panel, setPanel] = useState<"branding" | "share" | null>(null);
  const deal = s?.deals.find((d) => d.id === id);
  const name = deal?.inputs.nickname || "Property";

  useEffect(() => {
    if (!deal) return;
    const before = document.title;
    document.title = `RentWise report: ${name}`; // becomes the PDF file name
    return () => void (document.title = before);
  }, [deal, name]);

  if (!s) return <PageSkeleton />;
  if (!deal) {
    return (
      <div className="pg-results pg-report">
        <div className="empty">
          <h1 className="disp">This report isn&apos;t in this browser</h1>
          <p>Reports are made from properties saved here. The property may have been deleted, or saved in another browser.</p>
          <div className="ctas">
            <Link href="/compare" className="btn btn-primary">Your properties</Link>
          </div>
        </div>
      </div>
    );
  }

  const accent = s.branding?.accent;
  return (
    <div className="pg-results pg-report" data-brand={accent ? "" : undefined} style={accent ? ({ "--accent": accent } as React.CSSProperties) : undefined}>
      <div className="rwrap">
        <div className="rbar noprint">
          <Link href="/results" onClick={() => setStored((x) => ({ ...x, activeId: deal.id }))} className="lnk">← Back to the analysis</Link>
          <span className="sp" />
          <button type="button" className="btn btn-quiet btn-sm" aria-expanded={panel === "branding"} onClick={() => setPanel((o) => (o === "branding" ? null : "branding"))}>
            Branding
          </button>
          <button type="button" className="btn btn-quiet btn-sm" aria-expanded={panel === "share"} onClick={() => setPanel((o) => (o === "share" ? null : "share"))}>
            Share link
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
            Download PDF
          </button>
        </div>
        {panel === "branding" && <BrandingPanel b={s.branding ?? {}} />}
        {panel === "share" && <SharePanel deal={deal} s={s} />}
        <Report data={{ inputs: deal.inputs, isExample: deal.isExample, scenarios: s.scenarios, constraints: s.constraints, branding: s.branding }} generated={new Date()} />
      </div>
    </div>
  );
}
