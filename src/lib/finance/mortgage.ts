import type { Cents, Rate } from "./types";
import { roundCents } from "./money";

/** Monthly principal & interest, fully amortizing. P&I = L·r / (1 − (1+r)^−n); r = 0 → L/n. */
export function monthlyPayment(loan: Cents, annualRate: Rate, termYears: number): Cents {
  if (loan <= 0) return 0;
  const n = Math.round(termYears * 12);
  if (n <= 0) throw new RangeError("monthlyPayment: loan term must be at least 1 month");
  const r = annualRate / 12;
  return roundCents(r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n)));
}
