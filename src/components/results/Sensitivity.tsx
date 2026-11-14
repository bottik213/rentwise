import { FIELDS } from "@/components/forms/fields";
import type { SensitivityRow } from "@/lib/finance/sensitivity";
import type { PropertyInputs } from "@/lib/finance/types";
import { usd } from "@/lib/format";

type Key = keyof PropertyInputs;
const label = (k: Key) => (k in FIELDS ? FIELDS[k as keyof typeof FIELDS].label : String(k));

/** How to firm up each assumption, in the order a first-time buyer would do it. */
const HOW: Partial<Record<Key, string>> = {
  annualInterestRate: "Confirm it with a lender quote",
  vacancyPct: "Ask a local property manager how long units sit empty",
  annualInsurance: "Get a landlord insurance quote",
  monthlyRent: "Check it against 3 to 5 comparable rentals",
  maintenancePct: "Get an inspection to judge upkeep",
  capexPct: "Check the age of the roof, HVAC and water heater",
  annualPropertyTax: "Check the county record",
  managementPct: "Ask two local managers for their fee",
  monthlyHoa: "Ask for the association's budget",
  monthlyUtilities: "Ask the seller for a year of utility bills",
};

export const TODO: Partial<Record<Key, [string, string]>> = {
  annualInterestRate: ["Get a written rate quote from a lender", "Interest rate is still an estimate and moves cash flow more than anything else here."],
  annualInsurance: ["Get a landlord insurance quote", "Insurance is still an estimate. Quotes for the same building vary a lot by area."],
  monthlyRent: ["Check rents for 3 to 5 comparable units nearby", "Rent is still an estimate. Listings and recent leases both count."],
  vacancyPct: ["Ask a local manager about vacancy", "How long do similar units sit empty between tenants?"],
  maintenancePct: ["Book an inspection before you commit", "Maintenance is still an estimate. An inspection shows what is worn out."],
  capexPct: ["Note the age of the roof, HVAC and water heater", "Your CapEx reserve is an estimate. Big items near the end of their life need more."],
  annualPropertyTax: ["Look up the county tax record", "Property tax is still an estimate. It often resets after a sale."],
};

/** Real-dollar what-ifs as bars, largest first. Every shock here is adverse, so all bars are losses. */
export function Sensitivity({ rows }: { rows: SensitivityRow[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.annualImpact)));
  const top = rows.slice(0, 3).filter((r) => !r.verified && r.annualImpact !== 0);
  let callout = "";
  if (top.length) {
    const first = top[0].key;
    callout = `${label(first)} is one of your 3 biggest cash-flow drivers and is still an estimate. ${HOW[first] ?? "Confirm it with a listing, bill, quote or document"} before you make an offer.`;
    const rest = top.slice(1).map((r) => label(r.key).toLowerCase());
    if (rest.length) {
      const names = rest.join(" and ");
      callout += ` ${names[0].toUpperCase()}${names.slice(1)} ${rest.length > 1 ? "are" : "is"} also near the top and still ${rest.length > 1 ? "estimates" : "an estimate"}.`;
    }
  }

  return (
    <div className="card">
      <div
        className="tor"
        role="img"
        aria-label={`Bar chart of yearly cash flow lost per assumption change, largest first: ${rows
          .slice(0, 3)
          .map((r) => `${r.shock} ${usd(r.annualImpact)} a year`)
          .join(", ")}.`}
      >
        {rows.map((r, j) => (
          <div key={r.key} className="tr">
            <span className="l">
              {r.shock}
              {!r.verified && <span className="etag">estimate</span>}
            </span>
            <span className="trk" aria-hidden>
              <span className="rv" style={{ animationDelay: `${j * 50}ms` }}>
                <span className="bar data" style={{ transform: `scaleX(${Math.max(0.004, Math.abs(r.annualImpact) / max)})` }} />
              </span>
            </span>
            <span className="r num">{usd(r.annualImpact)}/yr</span>
          </div>
        ))}
      </div>
      <p className="note">One change at a time, everything else held at your inputs. No probabilities implied.</p>
      {callout && (
        <div className="callout" role="note">
          <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 1.2l7.2 13.3H.8z" fill="currentColor" />
            <path d="M8 6v4" stroke="var(--warn-bg)" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="8" cy="12.2" r="1" fill="var(--warn-bg)" />
          </svg>
          <p>{callout}</p>
        </div>
      )}
    </div>
  );
}

const GLOSSARY: [string, string][] = [
  ["Cash flow", "Money left each month after every cost, the mortgage and reserves."],
  ["NOI", "Net operating income. Rent collected minus running costs, before the mortgage."],
  ["Cap rate", "A year of NOI as a percent of the price. Ignores the loan."],
  ["Cash-on-cash", "A year of cash flow divided by the cash you put in."],
  ["P&I", "Principal and interest, the loan part of your mortgage payment."],
  ["CapEx reserve", "Money set aside for big future repairs like a roof or HVAC. Planned, not spent."],
  ["Vacancy allowance", "Rent you expect to lose while a unit sits empty between tenants."],
  ["Break-even rent", "The lowest rent that still covers every cost."],
  ["Offer ceiling", "The most you could pay and still meet all your targets."],
];

/** A checklist built from the biggest drivers still marked as estimates, next to a plain glossary. */
export function NextSteps({ rows }: { rows: SensitivityRow[] }) {
  const todo = rows.filter((r) => !r.verified && TODO[r.key]).map((r) => TODO[r.key]!);
  const items = todo.length ? todo : [["All your estimates are confirmed", "Read the contract and inspection report closely before you sign."] as [string, string]];
  return (
    <section className="two" aria-label="Next steps and glossary">
      <div className="card">
        <h2 className="disp">Before you make an offer</h2>
        <p style={{ margin: "0 0 8px", color: "var(--muted)", fontSize: 15 }}>Built from the numbers you haven&apos;t confirmed yet.</p>
        <ul className="cl">
          {items.map(([title, why]) => (
            <li key={title}>
              <label>
                <input type="checkbox" />
                <span>
                  {title}
                  <small>{why}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h2 className="disp" style={{ marginBottom: 16 }}>
          Glossary
        </h2>
        <dl className="gls">
          {GLOSSARY.map(([t, d]) => (
            <div key={t}>
              <dt>{t}</dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
