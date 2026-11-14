"use client";
import { AnimatedNumber } from "@/components/results/AnimatedNumber";
import { pct, usd } from "@/lib/format";

const FORMATS = {
  exact: (v: number) => usd(Math.round(v), { exact: true }),
  whole: (v: number) => usd(Math.round(v)),
  rate: (v: number) => pct(v),
};

/** Counts up once on first view. For server components, which can't pass a format function to the client. */
export function CountUp({ value, as }: { value: number; as: keyof typeof FORMATS }) {
  return <AnimatedNumber value={value} format={FORMATS[as]} countUp />;
}
