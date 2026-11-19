import Image from "next/image";
import Link from "next/link";
import bungalows from "@/assets/photos/bungalows-buffalo.jpg";
import duplex from "@/assets/photos/duplex-hinesburg.jpg";
import { PageFooter } from "@/components/DataControls";
import { Arrow, Badge } from "@/components/Icons";
import { CountUp } from "@/components/CountUp";
import { TryExampleButton } from "@/components/TryExampleButton";
import { DEMO_PROPERTY } from "@/data/demo-property";
import { offerCeiling } from "@/lib/finance/offer-ceiling";
import { DEFAULT_SCENARIOS, runScenarios } from "@/lib/finance/scenarios";
import { monthlyForecast, variance } from "@/lib/finance/variance";
import { CATEGORY_LABEL } from "@/lib/explain";
import type { OfferConstraints } from "@/lib/finance/types";
import { usd } from "@/lib/format";
import { verdict } from "@/lib/verdict";
import "./home.css";

// Every number on this page comes from the same engine the app uses, run on the synthetic example
// with the app's default target (cash flow after reserves of at least $0).
const P = DEMO_PROPERTY;
const TARGETS: OfferConstraints = { minMonthlyCashFlow: 0 }; // same default as a fresh app state
const S = runScenarios(P, DEFAULT_SCENARIOS);
const U = S.base;
const C = offerCeiling(P, TARGETS);
const V = verdict(U, TARGETS, P.monthlyRent);
const CEIL = C.status === "feasible" ? C.price : null;
// The demo story: the example's first owned month, with a surprise $1,800 repair.
const F = monthlyForecast(U);
const R = variance(U, [{ month: "2026-01", ...F, repairsMaintenance: F.repairsMaintenance + 180_000, capex: 0 }]);
const MOVED = R.contributors.filter((c) => c.impact !== 0);


function WaterfallCrop() {
  const gross = U.grossScheduledRent;
  const running = gross - U.effectiveRent + U.operatingExpenses;
  const rows: [string, number, string, number, number][] = [];
  let run = gross;
  rows.push(["Gross rent", gross, "t-sp", 0, gross]);
  for (const [label, v] of [
    ["Running costs", running],
    ["Mortgage P&I", U.monthlyPI],
    ["CapEx reserve", U.capexReserve],
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
          <span className="r">{usd(v)}</span>
        </div>
      ))}
      <div className="wr" style={{ fontWeight: 600 }}>
        <span>Cash flow</span>
        <span className="tk">
          <i className="t-wa" style={{ left: 0, width: W(Math.max(0, run)) }} />
        </span>
        <span className="r">{usd(run)}</span>
      </div>
    </div>
  );
}

function RangeCrop() {
  const vals = [S.conservative.reserveAdjustedCashFlow, U.reserveAdjustedCashFlow, S.optimistic.reserveAdjustedCashFlow];
  const lo = Math.min(0, ...vals) * 1.15;
  const hi = Math.max(0, ...vals) * 1.15;
  const X = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const fill = ["var(--bad)", "var(--brand)", "var(--good)"];
  return (
    <div className="crop num" aria-hidden>
      <div className="rg">
        <span className="ln" />
        <span className="bd" style={{ left: X(vals[0]), width: `calc(${X(vals[2])} - ${X(vals[0])})` }} />
        <span className="z" style={{ left: X(0) }} />
        {vals.map((v, i) => (
          <span key={i} className="d" style={{ left: X(v), background: v < 0 && i === 0 ? fill[0] : fill[i] }} />
        ))}
        <span className="l" style={{ left: X(vals[0]) }}>{usd(vals[0])}</span>
        <span className="l" style={{ left: X(0) }}>$0</span>
        <span className="l" style={{ left: X(vals[2]) }}>{usd(vals[2], { signed: true })}</span>
      </div>
    </div>
  );
}

function CeilingCrop() {
  if (CEIL === null) return null;
  const ask = P.purchasePrice;
  const lo = Math.min(ask, CEIL) * 0.9;
  const hi = Math.max(ask, CEIL) * 1.08;
  const X = (v: number) => ((v - lo) / (hi - lo)) * 100;
  return (
    <div className="crop num" aria-hidden>
      <div className="ps">
        <span className="ln" />
        <span className="gp" style={{ left: `${X(ask)}%`, width: `${X(CEIL) - X(ask)}%` }} />
        <span className="m" style={{ left: `${X(ask)}%`, background: "var(--ink)" }} />
        <span className="m" style={{ left: `${X(CEIL)}%`, background: "var(--brand)", width: 3 }} />
        <span className="ml" style={{ left: `${X(ask)}%`, transform: "translateX(calc(-100% - 6px))" }}>
          Asking ${Math.round(ask / 100_000)}k
        </span>
        <span className="ml" style={{ left: `${X(CEIL)}%`, transform: "translateX(6px)", color: "var(--brand)", fontWeight: 600 }}>
          {usd(CEIL)}
        </span>
        <span className="gl" style={{ left: `${(X(ask) + X(CEIL)) / 2}%` }}>
          {usd(CEIL - ask, { signed: true })}
        </span>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="pg-home">
      <section className="hero">
        <div className="wrap hg">
          <div>
            <h1 className="disp">
              Know the numbers before you buy. <span>Know the truth after you buy.</span>
            </h1>
            <p className="lede">
              For first-time rental investors and landlords with 1 to 5 properties. Check a long-term rental before you buy, find the most you can pay and still hit your targets, then compare each month of real results with the plan you bought on.
            </p>
            <div className="ctas">
              <Link className="btn btn-cta btn-lg" href="/analyze">
                Analyze a property <Arrow size={18} />
              </Link>
              <TryExampleButton className="btn btn-quiet btn-lg" />
            </div>
            <p className="fine">No sign-up. The example uses synthetic numbers. Your data stays in this browser.</p>
          </div>
          <figure className="vis">
            <Image
              className="ph"
              src={duplex}
              priority
              sizes="(max-width: 899px) 100vw, 600px"
              alt="A two-story side-by-side duplex with a long shared front porch, a young tree and a freshly paved street on a sunny day"
            />
            <figcaption>Photo: NNECAPA, CC BY 2.0</figcaption>
            <div className="mock" role="group" aria-label="Example property, computed by RentWise">
              <div className="mh">
                <Image src={duplex} alt="" width={40} height={40} />
                <div>
                  <b>Example duplex</b>
                  <small className="num">
                    {usd(P.purchasePrice)} asking · {usd(P.monthlyRent)}/mo rent
                  </small>
                </div>
                <Badge st={V.st} label={V.label === "Meets your target" ? "Meets target" : V.label} />
              </div>
              <dl className="mstats num">
                <div>
                  <dt>Cash flow</dt>
                  <dd>
                    <CountUp value={U.reserveAdjustedCashFlow} as="exact" />
                  </dd>
                </div>
                <div>
                  <dt>Cash-on-cash</dt>
                  <dd>{U.cashOnCash === null ? "n/a" : <CountUp value={U.cashOnCash} as="rate" />}</dd>
                </div>
                <div>
                  <dt>Break-even rent</dt>
                  <dd>{U.breakEvenRent === null ? "n/a" : <CountUp value={U.breakEvenRent} as="whole" />}</dd>
                </div>
                <div>
                  <dt>Offer ceiling</dt>
                  <dd style={{ color: "var(--brand)" }}>{CEIL === null ? "n/a" : <CountUp value={CEIL} as="whole" />}</dd>
                </div>
              </dl>
            </div>
          </figure>
        </div>
      </section>

      <section className="sect">
        <div className="wrap">
          <div className="sh">
            <h2 className="disp">One workflow, from first look to your first year as a landlord</h2>
            <p>Five steps. The first one takes about as long as reading a listing. The last two start the month you get the keys.</p>
          </div>
          <ol className="steps">
            <li className="step lead">
              <div className="lead-in">
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <span className="sn">Step 1</span>
                  <h3 className="disp" style={{ fontSize: 32 }}>
                    Analyze
                  </h3>
                  <p>Cash flow, net operating income, cap rate and cash-on-cash from your own numbers, with a plain-language summary at the top.</p>
                </div>
                <WaterfallCrop />
              </div>
            </li>
            <li className="step">
              <span className="sn">Step 2</span>
              <h3 className="disp">Stress test</h3>
              <p>A tougher year and an easier one, plus the assumptions that move cash flow most.</p>
              <RangeCrop />
            </li>
            <li className="step">
              <span className="sn">Step 3</span>
              <h3 className="disp">Offer ceiling</h3>
              <p>The highest price that still meets your targets, under your assumptions.</p>
              <CeilingCrop />
            </li>
            <li className="step">
              <span className="sn">Step 4</span>
              <h3 className="disp">Track actuals</h3>
              <p>Record what you really collected and paid each month.</p>
              <div className="crop" aria-hidden>
                <div className="pv">
                  <span className="pl" style={{ bottom: 46 }} />
                  {[62, 51, 70, 38, 60, 57].map((h, i) => (
                    <span key={i} style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </li>
            <li className="step">
              <span className="sn">Step 5</span>
              <h3 className="disp">Explain variance</h3>
              <p>See which costs pulled cash flow away from plan, to the cent.</p>
              <div className="crop num vl" aria-hidden>
                {MOVED.map((c) => (
                  <div key={c.category}>
                    <span>{CATEGORY_LABEL[c.category]}</span>
                    <span className={c.impact < 0 ? "neg" : "pos"}>{usd(c.impact, { exact: true, signed: true })}</span>
                  </div>
                ))}
                <div>
                  <span>Everything else</span>
                  <span>{usd(0, { exact: true })}</span>
                </div>
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 6, fontWeight: 600 }}>
                  <span>Total vs plan</span>
                  <span className={R.totalVariance < 0 ? "neg" : "pos"}>{usd(R.totalVariance, { exact: true, signed: true })}</span>
                </div>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="sect">
        <div className="wrap start">
          <figure>
            <Image
              src={bungalows}
              sizes="(max-width: 899px) 100vw, 620px"
              alt="A row of older wood-frame houses with deep front porches on a residential street in Buffalo, New York, under a gray winter sky"
            />
            <figcaption>Thatcher Avenue, Buffalo. Photo: Andre Carrotflower, CC BY-SA 4.0.</figcaption>
          </figure>
          <div>
            <h2 className="disp">Start with a listing you&apos;re already looking at</h2>
            <p style={{ margin: 0, fontSize: 18, color: "var(--ink-2)" }}>
              You need a handful of numbers. Anything you&apos;re unsure of, mark as an estimate and RentWise will tell you which ones to check first.
            </p>
            <ul className="need">
              <li>
                Price and rent<small>From the listing and 3 to 5 nearby rentals</small>
              </li>
              <li>
                Loan terms<small>Down payment, rate and length</small>
              </li>
              <li>
                Tax and insurance<small>County record and a landlord quote</small>
              </li>
              <li>
                Your targets<small>The least cash flow you&apos;d accept</small>
              </li>
            </ul>
            <Link className="btn btn-cta btn-lg" href="/analyze">
              Start your analysis <Arrow size={18} />
            </Link>
          </div>
        </div>
      </section>

      <div className="hfoot">
        <div className="wrap">
          <PageFooter>RentWise is a modeling tool, not financial, tax or legal advice. Every result depends on the assumptions you enter; nothing here is a guaranteed return.</PageFooter>
          <p className="credits">
            Photos, unedited apart from cropping:{" "}
            <a href="https://www.flickr.com/photos/23163410@N02/2808625039">duplex on Farmall Drive, Hinesburg VT</a> by NNECAPA, CC BY 2.0;{" "}
            <a href="https://commons.wikimedia.org/wiki/File:Craftsman_bungalows_on_Thatcher_Avenue,_Buffalo,_New_York_-_20230206.jpg">Craftsman bungalows on Thatcher Avenue, Buffalo</a> by Andre Carrotflower, CC BY-SA 4.0;{" "}
            <a href="https://www.flickr.com/photos/7156765@N05/51682416943">Beverly Street homes, Toronto</a> by Bill Badzo, public domain mark.
          </p>
        </div>
      </div>
    </div>
  );
}
