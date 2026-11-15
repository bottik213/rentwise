import type { IsoDate, IsoMonth } from "./types";

// Calendar math on UTC dates built from parts, so no local time zone or DST can shift a day.
const parts = (d: IsoDate) => d.split("-").map(Number) as [number, number, number];
const fmt = (t: Date) => t.toISOString().slice(0, 10);

export const monthOf = (d: IsoDate): IsoMonth => d.slice(0, 7);

export function addDays(d: IsoDate, n: number): IsoDate {
  const [y, m, day] = parts(d);
  return fmt(new Date(Date.UTC(y, m - 1, day + n)));
}

export function addMonths(month: IsoMonth, n: number): IsoMonth {
  const [y, m] = month.split("-").map(Number);
  return fmt(new Date(Date.UTC(y, m - 1 + n, 1))).slice(0, 7);
}

/** Day `day` of a month; day is 1–28, so it always exists. */
export const dayOf = (month: IsoMonth, day: number): IsoDate => `${month}-${String(day).padStart(2, "0")}`;

/** Inclusive list of months from a to b; empty when a is after b. */
export function monthsBetween(a: IsoMonth, b: IsoMonth): IsoMonth[] {
  const out: IsoMonth[] = [];
  for (let m = a; m <= b; m = addMonths(m, 1)) out.push(m);
  return out;
}

/** Today's date as the user's calendar shows it (local parts, not toISOString, which is UTC). */
export function localToday(now = new Date()): IsoDate {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** The same day n months later, clamped to the month's last day (Jan 31 + 1 month = Feb 28 or 29). */
export function addMonthsToDate(d: IsoDate, n: number): IsoDate {
  const [y, m, day] = parts(d);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return fmt(new Date(Date.UTC(y, m - 1 + n, Math.min(day, last))));
}
