import type { ActualCategory, ActualMonth, Cents } from "../finance/types";
import { ACTUAL_CATEGORIES } from "../finance/types";
import { monthOf, monthsBetween } from "./dates";
import { settleLease, type LeaseSettlement } from "./rent";
import type { IsoDate, IsoMonth, Ledger } from "./types";

export type SourceCategory = ActualCategory | "capex";

/** One dated entry behind a derived actual, for the variance drill-down. */
export interface SourceRef {
  kind: "rent" | "fee" | "deposit" | "expense";
  /** What the UI says about a rent, fee or deposit entry; expenses show `label` as typed. */
  what?: "rent" | "rentCredit" | "fee" | "depositRent" | "depositDamages";
  id: string;
  date: IsoDate;
  /** The tenant nickname for rent, fee and deposit entries; the item, vendor and note for an expense (may be empty). */
  label: string;
  amount: Cents;
}

export interface CombinedActuals {
  /** Every month in the variance, manual and ledger, oldest first, in the Phase 1 shape. */
  months: ActualMonth[];
  mode: Record<IsoMonth, "ledger" | "manual">;
  /** Ledger months only: the entries behind each category total (they sum to it exactly). */
  sources: Record<IsoMonth, Partial<Record<SourceCategory, SourceRef[]>>>;
  settlements: LeaseSettlement[];
}

const zero = (month: IsoMonth): ActualMonth => ({ month, capex: 0, ...Object.fromEntries(ACTUAL_CATEGORIES.map((k) => [k, 0])) }) as ActualMonth;

/**
 * The one place months come from. A month is manual if it was entered as totals (Phase 1) or switched to
 * manual; otherwise it is a ledger month when it falls between the first dated ledger entry and today.
 * Ledger months with no entries still count (unpaid rent shows as variance); the current month counts once
 * it has an entry. An explicit month mode always wins, and switching deletes nothing.
 */
export function combinedActuals(manual: ActualMonth[], ledger: Ledger, today: IsoDate): CombinedActuals {
  const explicit = new Map(ledger.monthModes.map((m) => [m.month, m.mode]));
  const settlements = ledger.leases.map((l) => settleLease(l, ledger, today));

  const dated = [
    ...settlements.flatMap((s) => s.credits.map((c) => c.date)),
    ...ledger.depositEvents.filter((e) => e.date <= today && e.kind !== "returned").map((e) => e.date),
    ...ledger.expenses.filter((e) => e.date <= today).map((e) => e.date),
  ];
  const thisMonth = monthOf(today);
  const withEntries = new Set(dated.map(monthOf));
  const first = dated.length ? dated.reduce((a, b) => (a < b ? a : b)) : null;
  const span = first ? monthsBetween(monthOf(first), thisMonth).filter((m) => m < thisMonth || withEntries.has(m)) : [];

  const manualByMonth = new Map(manual.map((m) => [m.month, m]));
  const mode: Record<IsoMonth, "ledger" | "manual"> = {};
  for (const m of new Set([...manualByMonth.keys(), ...span, ...explicit.keys()])) {
    const e = explicit.get(m);
    if (e === "manual" && !manualByMonth.has(m)) continue; // switched to manual but no totals entered yet
    mode[m] = e ?? (manualByMonth.has(m) ? "manual" : "ledger");
  }

  const derived = new Map<IsoMonth, ActualMonth>();
  const sources: CombinedActuals["sources"] = {};
  const add = (month: IsoMonth, cat: SourceCategory, ref: SourceRef) => {
    if (mode[month] !== "ledger" || ref.amount === 0) return;
    const row = derived.get(month) ?? zero(month);
    row[cat] += ref.amount;
    derived.set(month, row);
    ((sources[month] ??= {})[cat] ??= []).push(ref);
  };

  for (const s of settlements) {
    for (const c of s.credits) {
      const m = monthOf(c.date);
      // Cash basis: money counts on the day it arrives. A deposit applied to rent is other income (it was held).
      if (c.kind === "deposit") add(m, "otherIncome", { kind: "deposit", what: "depositRent", id: c.id, date: c.date, label: s.lease.tenantNickname, amount: c.amount });
      else {
        add(m, "rentReceived", { kind: "rent", what: c.toCredit ? "rentCredit" : "rent", id: c.id, date: c.date, label: s.lease.tenantNickname, amount: c.toRent + c.toCredit });
        add(m, "otherIncome", { kind: "fee", what: "fee", id: c.id, date: c.date, label: s.lease.tenantNickname, amount: c.toFee });
      }
    }
  }
  for (const s of settlements) {
    for (const d of s.damages) add(monthOf(d.date), "otherIncome", { kind: "deposit", id: d.id, date: d.date, what: "depositDamages", label: s.lease.tenantNickname, amount: d.amount });
  }
  const titles = new Map(ledger.maintenance.map((m) => [m.id, m.title]));
  for (const e of ledger.expenses.filter((e) => e.date <= today)) {
    const label = [e.maintenanceId ? titles.get(e.maintenanceId) : null, e.vendor, e.note].filter(Boolean).join(" · ");
    add(monthOf(e.date), e.category, { kind: "expense", id: e.id, date: e.date, label, amount: e.amount });
  }

  const months = Object.keys(mode)
    .sort()
    .map((m) => (mode[m] === "manual" ? manualByMonth.get(m)! : (derived.get(m) ?? zero(m))));
  return { months, mode, sources, settlements };
}
