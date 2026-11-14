import { FIELDS } from "@/components/forms/fields";
import type { SensitivityRow } from "@/lib/finance/sensitivity";
import { usd } from "@/lib/format";

/** Real-dollar what-ifs as HTML bars. Every shock here is adverse, so bars grow left-to-right in red. */
export function Sensitivity({ rows }: { rows: SensitivityRow[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.annualImpact)));
  const topUnverified = rows.slice(0, 3).find((r) => !r.verified && r.annualImpact !== 0);
  const label = (k: SensitivityRow["key"]) => (k in FIELDS ? FIELDS[k as keyof typeof FIELDS].label : k);

  return (
    <div>
      {topUnverified && (
        <p className="mb-5 rounded-md bg-surface p-4 text-sm leading-relaxed">
          <strong className="font-medium">{label(topUnverified.key)}</strong> is one of your three biggest cash-flow drivers
          and is still marked as an estimate. Confirm it with a listing, bill, quote or document before you offer.
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[13rem_1fr_7rem]">
            <span className="flex items-center gap-2">
              {r.shock}
              {!r.verified && <span className="rounded-sm border border-line px-1 text-[11px] text-muted">estimate</span>}
            </span>
            <span className="h-2.5 rounded-sm bg-surface" aria-hidden>
              <span className="bar block h-full rounded-sm bg-bad-fill" style={{ transform: `scaleX(${Math.abs(r.annualImpact) / max})` }} />
            </span>
            <span className="num text-right">{usd(r.annualImpact)}/yr</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted">Change in annual cash flow after reserves, one shock at a time. No probabilities implied.</p>
    </div>
  );
}
