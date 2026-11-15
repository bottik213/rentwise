import type { ActualCategory, Cents } from "../finance/types";
import { dayOf } from "./dates";
import type { Expense, IsoMonth } from "./types";

/** Costs that recur every month, so a ledger month without them would look better than plan. */
export const USUAL_BILLS = ["mortgagePI", "propertyTax", "insurance", "utilities", "hoa", "otherOperating", "management"] as const satisfies readonly ActualCategory[];

/**
 * Recurring bills the plan expects but no expense records, for each ledger month.
 * The caller adds them at the planned amount, dated the 1st, for the owner to edit.
 */
export function missingBills(months: IsoMonth[], expenses: Expense[], planned: Record<ActualCategory, Cents>): Omit<Expense, "id">[] {
  const have = new Set(expenses.map((e) => `${e.date.slice(0, 7)}|${e.category}`));
  return months.flatMap((m) =>
    USUAL_BILLS.filter((c) => planned[c] > 0 && !have.has(`${m}|${c}`)).map((c) => ({ date: dayOf(m, 1), category: c, amount: planned[c], note: "Usual monthly bill" })),
  );
}
