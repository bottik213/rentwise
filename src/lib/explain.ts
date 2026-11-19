import type { I18n } from "@/i18n";
import type { VarianceReport } from "./finance/types";

/** Plain-language, rule-based explanation of a variance report. Deterministic: same numbers, same words. */
export function explainVariance(r: VarianceReport, i: I18n): string[] {
  if (!r.months) return [];
  const { t: tx } = i;
  const $ = (c: number, signed = false) => i.money(c, { exact: true, signed });
  const span = tx.explain.span(r.months);
  const t = r.totalVariance;
  const out = [
    t === 0
      ? tx.explain.matched(span, $(r.actualCashFlowBeforeCapex))
      : tx.explain.diff(span, $(r.actualCashFlowBeforeCapex), $(Math.abs(t)), t < 0, $(r.forecastCashFlowBeforeCapex)),
  ];

  const movers = r.contributors.filter((c) => c.impact !== 0).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  for (const c of movers.slice(0, 3)) {
    out.push(tx.explain.driver(tx.cat[c.category], $(c.actual), $(c.forecast), $(c.impact, true)));
  }
  if (movers.length > 3) {
    const rest = movers.slice(3).reduce((s, c) => s + c.impact, 0);
    out.push(tx.explain.smaller(movers.length - 3, $(rest, true)));
  }

  out.push(tx.explain.capex($(r.actualCapex), $(r.plannedCapexReserve)));
  return out;
}
