import type { ActualCategory, Cents } from "../finance/types";

/** ISO calendar date "YYYY-MM-DD" and month "YYYY-MM". No time zones: these are dates on a lease, not instants. */
export type IsoDate = string;
export type IsoMonth = string;

/** A tenant is a nickname only ("Unit A tenant"): no names, contacts, IDs or documents are ever stored. */
export interface Lease {
  id: string;
  tenantNickname: string;
  startDate: IsoDate;
  endDate: IsoDate | null;
  /** Rent is tracked in RentWise from this date (can be back-dated). Earlier months are never charged. */
  trackFrom: IsoDate;
  monthlyRent: Cents;
  /** 1–28, so every month has the day. */
  dueDay: number;
  graceDays: number;
  lateFee: { kind: "flat"; amount: Cents } | { kind: "percent"; amount: number } | null;
  /** Held for the tenant: never income. */
  depositAmount: Cents;
  depositReceivedDate: IsoDate | null;
  status: "active" | "ended";
}

export interface RentPayment {
  id: string;
  leaseId: string;
  date: IsoDate;
  amount: Cents;
  /** A label for the person recording it. Settlement always pays the oldest rent first. */
  forMonth: IsoMonth;
  note?: string;
}

export interface FeeWaiver {
  leaseId: string;
  forMonth: IsoMonth;
}

export interface DepositEvent {
  id: string;
  leaseId: string;
  date: IsoDate;
  kind: "returned" | "applied_to_rent" | "applied_to_damages";
  amount: Cents;
}

/** The eight cost categories of the Phase 1 actuals, plus CapEx (kept out of cash flow). */
export type ExpenseCategory = Exclude<ActualCategory, "rentReceived" | "otherIncome"> | "capex";

export interface Expense {
  id: string;
  date: IsoDate;
  category: ExpenseCategory;
  amount: Cents;
  vendor?: string;
  note?: string;
  maintenanceId?: string;
}

export interface Maintenance {
  id: string;
  title: string;
  openedDate: IsoDate;
  status: "open" | "in_progress" | "done";
  doneDate?: IsoDate;
  recurring?: { everyMonths: number };
}

export interface MonthMode {
  month: IsoMonth;
  mode: "ledger" | "manual";
}

/** Everything recorded for one owned property. */
export interface Ledger {
  leases: Lease[];
  payments: RentPayment[];
  waivers: FeeWaiver[];
  depositEvents: DepositEvent[];
  expenses: Expense[];
  maintenance: Maintenance[];
  monthModes: MonthMode[];
}

export const EMPTY_LEDGER: Ledger = { leases: [], payments: [], waivers: [], depositEvents: [], expenses: [], maintenance: [], monthModes: [] };
