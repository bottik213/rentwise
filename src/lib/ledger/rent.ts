import type { Cents } from "../finance/types";
import { roundCents } from "../finance/money";
import { addDays, addMonths, dayOf, monthOf, monthsBetween } from "./dates";
import type { IsoDate, IsoMonth, Lease, Ledger } from "./types";

export type RentStatus = "paid" | "late" | "partial" | "unpaid" | "due" | "upcoming";

export interface RentMonth {
  month: IsoMonth;
  dueDate: IsoDate;
  graceEnd: IsoDate;
  rent: Cents;
  paid: Cents;
  status: RentStatus;
  /** Charged once the grace period ends with rent still owed (unless waived). */
  fee: { amount: Cents; paid: Cents; waived: boolean } | null;
}

/** How one payment (or deposit applied to rent) was used. Its income lands in the month of its own date. */
export interface CreditUse {
  id: string;
  kind: "payment" | "deposit";
  date: IsoDate;
  amount: Cents;
  toRent: Cents;
  toFee: Cents;
  /** Overpayment, held as credit for the next charges. */
  toCredit: Cents;
}

export interface LeaseSettlement {
  lease: Lease;
  months: RentMonth[];
  credits: CreditUse[];
  /** Rent and fees owed now: a receivable, never income. */
  receivable: Cents;
  creditBalance: Cents;
  depositHeld: Cents;
  /** Deposit applied to damages: other income on its date, capped at what was held. */
  damages: { id: string; date: IsoDate; amount: Cents }[];
}

export const feeFor = (lease: Lease): Cents =>
  !lease.lateFee ? 0 : lease.lateFee.kind === "flat" ? lease.lateFee.amount : roundCents(lease.monthlyRent * lease.lateFee.amount);

/** Months a rent charge falls in: due on or after the start, on or before the end. */
function chargeMonths(lease: Lease, until: IsoMonth): IsoMonth[] {
  const from = lease.trackFrom > lease.startDate ? lease.trackFrom : lease.startDate;
  return monthsBetween(monthOf(from), until).filter((m) => {
    const due = dayOf(m, lease.dueDay);
    return due >= from && (lease.endDate === null || due <= lease.endDate);
  });
}

/**
 * Settles one lease as of `today`. Credits clear all outstanding rent, oldest month first, before any fee,
 * then fees oldest first; anything left is credit for later charges. A month is late when rent is still owed
 * after its grace period; that charges one fee unless the month is waived.
 */
export function settleLease(lease: Lease, ledger: Ledger, today: IsoDate): LeaseSettlement {
  const charged = chargeMonths(lease, monthOf(today)).filter((m) => dayOf(m, lease.dueDay) <= today);
  const next = chargeMonths(lease, addMonths(monthOf(today), 1)).find((m) => dayOf(m, lease.dueDay) > today);
  const waived = new Set(ledger.waivers.filter((w) => w.leaseId === lease.id).map((w) => w.forMonth));

  type Dep = { id: string; kind: "received" | "returned" | "applied_to_rent" | "applied_to_damages"; amount: Cents };
  type Ev = { date: IsoDate; order: number; month?: IsoMonth; credit?: CreditUse; deposit?: Dep };
  const events: Ev[] = [];
  for (const m of charged) {
    events.push({ date: dayOf(m, lease.dueDay), order: 0, month: m });
    const graceEnd = addDays(dayOf(m, lease.dueDay), lease.graceDays);
    if (graceEnd < today) events.push({ date: graceEnd, order: 2, month: m }); // a payment on the last grace day is on time
  }
  for (const p of ledger.payments.filter((p) => p.leaseId === lease.id && p.date <= today)) {
    events.push({ date: p.date, order: 1, credit: { id: p.id, kind: "payment", date: p.date, amount: p.amount, toRent: 0, toFee: 0, toCredit: 0 } });
  }
  if (lease.depositReceivedDate && lease.depositReceivedDate <= today) {
    events.push({ date: lease.depositReceivedDate, order: 1, deposit: { id: "", kind: "received", amount: lease.depositAmount } });
  }
  for (const e of ledger.depositEvents.filter((e) => e.leaseId === lease.id && e.date <= today)) {
    events.push({ date: e.date, order: 1.5, deposit: { id: e.id, kind: e.kind, amount: e.amount } });
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);

  const rentOut = new Map<IsoMonth, Cents>();
  const feeOut = new Map<IsoMonth, Cents>();
  const fees = new Map<IsoMonth, Cents>();
  const late = new Set<IsoMonth>();
  let balance = 0;
  let held = 0;
  const credits: CreditUse[] = [];
  const damages: { id: string; date: IsoDate; amount: Cents }[] = [];
  const owed = () => [...rentOut.values(), ...feeOut.values()].reduce((s, x) => s + x, 0);

  const pay = (owed: Map<IsoMonth, Cents>, amount: Cents): Cents => {
    for (const m of [...owed.keys()].sort()) {
      if (amount <= 0) break;
      const x = Math.min(amount, owed.get(m)!);
      owed.set(m, owed.get(m)! - x);
      amount -= x;
    }
    return amount;
  };

  for (const ev of events) {
    if (ev.deposit) {
      const d = ev.deposit;
      if (d.kind === "received") held += d.amount;
      else if (d.kind === "returned") held -= Math.min(d.amount, held);
      else if (d.kind === "applied_to_damages") {
        const used = Math.min(d.amount, held);
        held -= used;
        damages.push({ id: d.id, date: ev.date, amount: used });
      } else {
        // Only the part that pays rent or fees owed today becomes income; the rest stays held for the tenant.
        const used = Math.min(d.amount, held, owed());
        held -= used;
        const afterRent = pay(rentOut, used);
        credits.push({ id: d.id, kind: "deposit", date: ev.date, amount: used, toRent: used - afterRent, toFee: afterRent - pay(feeOut, afterRent), toCredit: 0 });
      }
    } else if (ev.credit) {
      const c = ev.credit;
      const afterRent = pay(rentOut, c.amount);
      const afterFees = pay(feeOut, afterRent);
      c.toRent = c.amount - afterRent;
      c.toFee = afterRent - afterFees;
      c.toCredit = afterFees;
      balance += afterFees;
      credits.push(c);
    } else if (ev.order === 0) {
      rentOut.set(ev.month!, lease.monthlyRent);
      balance = pay(rentOut, balance); // earlier overpayment covers the new rent
    } else if ((rentOut.get(ev.month!) ?? 0) > 0) {
      late.add(ev.month!);
      const fee = feeFor(lease);
      if (fee > 0 && !waived.has(ev.month!)) {
        fees.set(ev.month!, fee);
        feeOut.set(ev.month!, fee);
        balance = pay(feeOut, balance);
      }
    }
  }

  const months: RentMonth[] = charged.map((m) => {
    const dueDate = dayOf(m, lease.dueDay);
    const graceEnd = addDays(dueDate, lease.graceDays);
    const owed = rentOut.get(m) ?? 0;
    const paid = lease.monthlyRent - owed;
    const status: RentStatus = owed === 0 ? (late.has(m) ? "late" : "paid") : graceEnd >= today ? "due" : paid > 0 ? "partial" : "unpaid";
    const fee = fees.has(m) ? { amount: fees.get(m)!, paid: fees.get(m)! - (feeOut.get(m) ?? 0), waived: false } : late.has(m) && waived.has(m) && feeFor(lease) > 0 ? { amount: feeFor(lease), paid: 0, waived: true } : null;
    return { month: m, dueDate, graceEnd, rent: lease.monthlyRent, paid, status, fee };
  });
  if (next) months.push({ month: next, dueDate: dayOf(next, lease.dueDay), graceEnd: addDays(dayOf(next, lease.dueDay), lease.graceDays), rent: lease.monthlyRent, paid: 0, status: "upcoming", fee: null });

  const receivable = [...rentOut.values(), ...feeOut.values()].reduce((s, x) => s + x, 0);
  return { lease, months, credits, receivable, creditBalance: balance, depositHeld: held, damages };
}
