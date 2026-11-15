import type { Cents, Rate } from "./types";
import { roundCents } from "./money";

/** Unrounded monthly P&I, fully amortizing. P&I = L·r / (1 − (1+r)^−n); r = 0 → L/n. */
export function monthlyPaymentExact(loan: Cents, annualRate: Rate, termYears: number): number {
  if (loan <= 0) return 0;
  const n = Math.round(termYears * 12);
  if (n <= 0) throw new RangeError("monthlyPayment: loan term must be at least 1 month");
  const r = annualRate / 12;
  // log1p/expm1 preserve precision when r is so small that 1 + r rounds to 1.
  return r === 0 ? loan / n : (loan * r) / -Math.expm1(-n * Math.log1p(r));
}

/** Monthly P&I rounded to cents, as used by the monthly underwriting. */
export function monthlyPayment(loan: Cents, annualRate: Rate, termYears: number): Cents {
  return roundCents(monthlyPaymentExact(loan, annualRate, termYears));
}

/** Loan balance after `months` payments of the unrounded P&I; 0 once the loan is paid off. */
export function loanBalance(loan: Cents, annualRate: Rate, termYears: number, months: number): number {
  const n = Math.round(termYears * 12);
  if (loan <= 0 || months >= n) return 0;
  const r = annualRate / 12;
  if (r === 0) return loan * (1 - months / n);
  const pi = monthlyPaymentExact(loan, annualRate, termYears);
  const g = Math.exp(months * Math.log1p(r));
  return Math.max(0, loan * g - (pi * (g - 1)) / r);
}
