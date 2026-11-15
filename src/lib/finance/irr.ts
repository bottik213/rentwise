import type { Rate } from "./types";

export type IrrResult = { ok: true; rate: Rate } | { ok: false; reason: "no-investment" | "no-sign-change" | "no-convergence" };

const npv = (flows: number[], r: number) => flows.reduce((s, c, i) => s + c / Math.pow(1 + r, i), 0);
const dnpv = (flows: number[], r: number) => flows.reduce((s, c, i) => s - (i * c) / Math.pow(1 + r, i + 1), 0);

/**
 * Annual IRR of flows[0..n] (flows[0] = −cash invested). Newton–Raphson, with a bisection fallback on a
 * bracket above −100%. Never returns NaN: anything it can't solve comes back as { ok: false, reason }.
 */
export function irr(flows: number[]): IrrResult {
  if (!(flows[0] < 0)) return { ok: false, reason: "no-investment" };
  if (!flows.some((c) => c > 0)) return { ok: false, reason: "no-sign-change" };

  let r = 0.1;
  for (let i = 0; i < 50; i++) {
    const f = npv(flows, r);
    const d = dnpv(flows, r);
    if (!Number.isFinite(f) || !Number.isFinite(d) || d === 0) break;
    const next = r - f / d;
    if (!Number.isFinite(next) || next <= -0.9999) break;
    if (Math.abs(next - r) < 1e-12) return { ok: true, rate: next };
    r = next;
  }

  // Fallback: bracket a sign change between just above −100% and a growing upper bound, then bisect.
  let lo = -0.9999;
  let hi = 1;
  const flo = npv(flows, lo);
  while (Math.sign(npv(flows, hi)) === Math.sign(flo) && hi < 1e6) hi *= 4;
  if (Math.sign(npv(flows, hi)) === Math.sign(flo)) return { ok: false, reason: "no-convergence" };
  for (let i = 0; i < 300 && hi - lo > 1e-13; i++) {
    const mid = (lo + hi) / 2;
    if (Math.sign(npv(flows, mid)) === Math.sign(flo)) lo = mid;
    else hi = mid;
  }
  const rate = (lo + hi) / 2;
  return Number.isFinite(rate) ? { ok: true, rate } : { ok: false, reason: "no-convergence" };
}
