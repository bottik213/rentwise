"use client";
import { AnimatedNumber } from "@/components/results/AnimatedNumber";
import { useI18n } from "@/i18n/client";

/** Counts up once on first view. For server components, which can't pass a format function to the client. */
export function CountUp({ value, as }: { value: number; as: "exact" | "whole" | "rate" }) {
  const { money, pct } = useI18n();
  const format = as === "rate" ? (v: number) => pct(v) : (v: number) => money(Math.round(v), { exact: as === "exact" });
  return <AnimatedNumber value={value} format={format} countUp />;
}
