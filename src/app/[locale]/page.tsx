import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import bungalows from "@/assets/photos/bungalows-buffalo.jpg";
import duplex from "@/assets/photos/duplex-hinesburg.jpg";
import { PageFooter } from "@/components/DataControls";
import { Arrow, Badge } from "@/components/Icons";
import { CountUp } from "@/components/CountUp";
import { TryExampleButton } from "@/components/TryExampleButton";
import { DEMO_PROPERTY } from "@/data/demo-property";
import { i18n, isLocale, type I18n } from "@/i18n";
import { DEFAULT_SCENARIOS, runScenarios } from "@/lib/finance/scenarios";
import { monthlyForecast, variance } from "@/lib/finance/variance";
import type { OfferConstraints } from "@/lib/finance/types";
import { verdict } from "@/lib/verdict";
import "./home.css";

// Every number on this page comes from the same engine the app uses, run on the synthetic example
// with the app's default target (cash flow after reserves of at least zero).
const P = DEMO_PROPERTY;
const TARGETS: OfferConstraints = { minMonthlyCashFlow: 0 }; // same default as a fresh app state
const U = runScenarios(P, DEFAULT_SCENARIOS).base;
// The demo story: the example's first owned month, with a surprise 1,800 repair.
const F = monthlyForecast(U);
const R = variance(U, [{ month: "2026-01", ...F, repairsMaintenance: F.repairsMaintenance + 180_000, capex: 0 }]);
const MOVED = R.contributors.filter((c) => c.impact !== 0);

const CREDIT_LINKS = [
  "https://www.flickr.com/photos/23163410@N02/2808625039",
  "https://commons.wikimedia.org/wiki/File:Craftsman_bungalows_on_Thatcher_Avenue,_Buffalo,_New_York_-_20230206.jpg",
  "https://www.flickr.com/photos/7156765@N05/51682416943",
];

function WaterfallCrop({ i }: { i: I18n }) {
  const { t, money } = i;
  const gross = U.grossScheduledRent;
  const running = gross - U.effectiveRent + U.operatingExpenses;
  const rows: [string, number, string, number, number][] = [];
  let run = gross;
  rows.push([t.home.gross, gross, "t-sp", 0, gross]);
  for (const [label, v] of [
    [t.home.running, running],
    [t.home.mortgage, U.monthlyPI],
    [t.home.capex, U.capexReserve],
  ] as const) {
    rows.push([label, -v, "t-de", run - v, v]);
    run -= v;
  }
  const W = (v: number) => `${(v / gross) * 100}%`;
  return (
    <div className="crop num" aria-hidden>
      {rows.map(([label, v, cls, left, width]) => (
        <div key={label} className="wr">
          <span>{label}</span>
          <span className="tk">
            <i className={cls} style={{ left: W(left), width: W(width) }} />
          </span>
          <span className="r">{money(v)}</span>
        </div>
      ))}
      <div className="wr" style={{ fontWeight: 600 }}>
        <span>{t.home.cashFlow}</span>
        <span className="tk">
          <i className="t-wa" style={{ left: 0, width: W(Math.max(0, run)) }} />
        </span>
        <span className="r">{money(run)}</span>
      </div>
    </div>
  );
}

export default async function Landing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const i = i18n(locale);
  const { t, money, path } = i;
  const H = t.home;
  const V = verdict(U, TARGETS, P.monthlyRent, i);
  return (
    <div className="pg-home">
      <section className="hero">
        <div className="wrap hg">
          <div>
            <h1 className="disp">
              {H.h1} <span>{H.h1b}</span>
            </h1>
            <p className="lede">{H.lede}</p>
            <div className="ctas">
              <Link className="btn btn-cta btn-lg" href={path("/analyze")}>
                {t.common.analyzeProperty} <Arrow size={18} />
              </Link>
              <TryExampleButton className="btn btn-quiet btn-lg" />
            </div>
            <p className="fine">{H.fine}</p>
          </div>
          <figure className="vis">
            <Image className="ph" src={duplex} priority sizes="(max-width: 899px) 100vw, 600px" alt={H.heroAlt} />
            <figcaption>{H.heroCredit}</figcaption>
            <div className="mock" role="group" aria-label={H.mock}>
              <div className="mh">
                <Image src={duplex} alt="" width={40} height={40} />
                <div>
                  <b>{t.common.exampleName}</b>
                  <small className="num">{H.mockSub(money(P.purchasePrice), money(P.monthlyRent))}</small>
                </div>
                <Badge st={V.st} label={V.st === "good" ? H.meets : V.label} />
              </div>
              <dl className="mstats num">
                <div>
                  <dt>{H.cf}</dt>
                  <dd>
                    <CountUp value={U.reserveAdjustedCashFlow} as="exact" />
                  </dd>
                </div>
                <div>
                  <dt>{H.coc}</dt>
                  <dd>{U.cashOnCash === null ? t.common.na : <CountUp value={U.cashOnCash} as="rate" />}</dd>
                </div>
                <div>
                  <dt>{H.be}</dt>
                  <dd>{U.breakEvenRent === null ? t.common.na : <CountUp value={U.breakEvenRent} as="whole" />}</dd>
                </div>
              </dl>
            </div>
          </figure>
        </div>
      </section>

      <section className="sect">
        <div className="wrap">
          <div className="sh">
            <h2 className="disp">{H.stepsTitle}</h2>
            <p>{H.stepsSub}</p>
          </div>
          <ol className="steps">
            <li className="step lead">
              <div className="lead-in">
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <span className="sn">{H.step(1)}</span>
                  <h3 className="disp" style={{ fontSize: 32 }}>
                    {H.s1}
                  </h3>
                  <p>{H.s1t}</p>
                </div>
                <WaterfallCrop i={i} />
              </div>
            </li>
            <li className="step">
              <span className="sn">{H.step(2)}</span>
              <h3 className="disp">{H.s2}</h3>
              <p>{H.s2t}</p>
              <div className="crop" aria-hidden>
                <div className="pv">
                  <span className="pl" style={{ bottom: 46 }} />
                  {[62, 51, 70, 38, 60, 57].map((h, k) => (
                    <span key={k} style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </li>
            <li className="step">
              <span className="sn">{H.step(3)}</span>
              <h3 className="disp">{H.s3}</h3>
              <p>{H.s3t}</p>
              <div className="crop num vl" aria-hidden>
                {MOVED.map((c) => (
                  <div key={c.category}>
                    <span>{t.cat[c.category]}</span>
                    <span className={c.impact < 0 ? "neg" : "pos"}>{money(c.impact, { exact: true, signed: true })}</span>
                  </div>
                ))}
                <div>
                  <span>{H.everythingElse}</span>
                  <span>{money(0, { exact: true })}</span>
                </div>
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 6, fontWeight: 600 }}>
                  <span>{H.totalVsPlan}</span>
                  <span className={R.totalVariance < 0 ? "neg" : "pos"}>{money(R.totalVariance, { exact: true, signed: true })}</span>
                </div>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="sect">
        <div className="wrap start">
          <figure>
            <Image src={bungalows} sizes="(max-width: 899px) 100vw, 620px" alt={H.startAlt} />
            <figcaption>{H.startCredit}</figcaption>
          </figure>
          <div>
            <h2 className="disp">{H.startTitle}</h2>
            <p style={{ margin: 0, fontSize: 18, color: "var(--ink-2)" }}>{H.startText}</p>
            <ul className="need">
              {H.need.map(([a, b]) => (
                <li key={a}>
                  {a}
                  <small>{b}</small>
                </li>
              ))}
            </ul>
            <Link className="btn btn-cta btn-lg" href={path("/analyze")}>
              {H.startCta} <Arrow size={18} />
            </Link>
          </div>
        </div>
      </section>

      <div className="hfoot">
        <div className="wrap">
          <PageFooter />
          <p className="credits">
            {H.creditsLead}{" "}
            {H.credits.map(([work, rest], k) => (
              <span key={work}>
                <a href={CREDIT_LINKS[k]}>{work}</a>
                {rest}
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}
