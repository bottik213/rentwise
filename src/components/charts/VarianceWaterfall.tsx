"use client";
import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ActualCategory, VarianceReport } from "@/lib/finance/types";
import { CATEGORY_LABEL } from "@/lib/explain";
import { usd } from "@/lib/format";

// Hex mirrors of the globals.css tokens (SVG fill attributes don't take CSS vars reliably).
const C = { forecast: "url(#hatch)", actual: "#0c0a08", good: "#2a6fdb", bad: "#d03b3b", gold: "#c9a45a", muted: "#5c5b59", line: "#e3dfd8" };
const SHORT: Record<ActualCategory, string> = {
  rentReceived: "Rent", otherIncome: "Other inc.", propertyTax: "Tax", insurance: "Insurance", utilities: "Utilities",
  hoa: "HOA", repairsMaintenance: "Repairs", management: "Mgmt", otherOperating: "Other op.", mortgagePI: "P&I",
};

interface Datum { name: string; full: string; range: [number, number]; fill: string; label: string; note: string }

/** Forecast → each contributor that moved → actual. Contributor steps land exactly on the actual bar. */
export function VarianceWaterfall({ r }: { r: VarianceReport }) {
  let run = r.forecastCashFlowBeforeCapex;
  const data: Datum[] = [
    { name: "Forecast", full: "Forecast cash flow before CapEx", range: [0, run], fill: C.forecast, label: usd(run), note: "Plan" },
  ];
  const addStep = (name: string, full: string, impact: number, note: string) => {
    data.push({ name, full, range: [run, run + impact], fill: impact > 0 ? C.good : impact < 0 ? C.bad : C.muted, label: usd(impact, { signed: true }), note });
    run += impact;
  };
  const movers = r.contributors.filter((c) => c.impact !== 0).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  // Phones fit ~6 bars before tick labels collide. shortcut: read once per render, not on resize; fine for a re-rendering form page.
  const wide = typeof window === "undefined" || matchMedia("(min-width: 640px)").matches;
  const maxSteps = wide ? 6 : 3;
  const shown = movers.length > maxSteps + 1 ? movers.slice(0, maxSteps) : movers;
  for (const c of shown) {
    addStep(SHORT[c.category], CATEGORY_LABEL[c.category], c.impact,
      `${c.impact > 0 ? "Better" : "Worse"} than plan · ${usd(c.actual, { exact: true })} actual vs. ${usd(c.forecast, { exact: true })} planned`);
  }
  const rest = movers.slice(shown.length);
  if (rest.length) {
    // Folded, not dropped: the steps still land exactly on the actual bar.
    addStep("Other", `${rest.length} smaller items`, rest.reduce((s, c) => s + c.impact, 0), rest.map((c) => CATEGORY_LABEL[c.category]).join(", "));
  }
  data.push({ name: "Actual", full: "Actual cash flow before CapEx", range: [0, r.actualCashFlowBeforeCapex], fill: C.actual, label: usd(r.actualCashFlowBeforeCapex), note: "Recorded" });
  const reduceMotion = typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Explicit domain: Recharts' auto domain for range bars ignores negative ends and clips them.
  const ends = data.flatMap((d) => d.range);
  const lo = Math.min(0, ...ends), hi = Math.max(0, ...ends);
  const raw = (hi - lo) / 4 || 100, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((x) => x * mag).find((s) => s >= raw)!; // 1-2-5 steps → round-dollar ticks
  let yMin = Math.floor(lo / step) * step, yMax = Math.ceil(hi / step) * step;
  if (lo < 0 && lo - yMin < step * 0.3) yMin -= step; // room for the value label under a negative bar
  if ((hi > 0 && yMax - hi < step * 0.3) || yMax === yMin) yMax += step;
  const ticks = Array.from({ length: Math.round((yMax - yMin) / step) + 1 }, (_, k) => yMin + k * step);

  return (
    <figure>
      <div className="h-80 w-full" role="img" aria-label={`Waterfall from forecast ${usd(r.forecastCashFlowBeforeCapex)} to actual ${usd(r.actualCashFlowBeforeCapex)} cash flow before CapEx. Table below lists every step.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 24, right: 8, bottom: 0, left: 8 }} barCategoryGap="22%">
            <defs>
              <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
                <rect width="6" height="6" fill="#fff" />
                <rect width="2" height="6" fill={C.gold} />
              </pattern>
            </defs>
            <XAxis dataKey="name" interval={0} tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={{ stroke: C.line }} />
            <YAxis domain={[yMin, yMax]} ticks={ticks} tickFormatter={(v: number) => usd(v)} tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} width={64} />
            <ReferenceLine y={0} stroke={C.muted} />
            <Tooltip
              cursor={{ fill: "rgba(12,10,8,0.04)" }}
              content={({ active, payload }) => {
                const d = payload?.[0]?.payload as Datum | undefined;
                if (!active || !d) return null;
                return (
                  <div className="rounded-md border border-line bg-bg px-3 py-2 text-xs shadow-sm">
                    <p className="font-medium">{d.full}</p>
                    <p className="num mt-0.5">{d.label}</p>
                    <p className="mt-0.5 text-muted">{d.note}</p>
                  </div>
                );
              }}
            />
            {/* Recharts animates in JS, so the CSS reduced-motion rule can't reach it. Default is 1.5s; 400ms explains without stalling. */}
            <Bar dataKey="range" radius={2} isAnimationActive={!reduceMotion} animationDuration={400} animationEasing="ease-out">
              {data.map((d) => <Cell key={d.name} fill={d.fill} stroke={d.fill === C.forecast ? C.gold : undefined} strokeWidth={1.5} />)}
              <LabelList dataKey="label" position="top" style={{ fontSize: 11, fill: "#0c0a08" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <Key className="hatch-forecast" label="Forecast (plan)" />
        <Key className="bg-ink" label="Actual" />
        <Key className="bg-good-fill" label="Better than plan" />
        <Key className="bg-bad-fill" label="Worse than plan" />
      </figcaption>
    </figure>
  );
}

const Key = ({ className, label }: { className: string; label: string }) => (
  <span className="flex items-center gap-1.5"><span className={`inline-block size-3 rounded-sm ${className}`} aria-hidden />{label}</span>
);
