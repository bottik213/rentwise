import { addMonthsToDate } from "./dates";
import type { IsoDate, Maintenance } from "./types";

/** When a recurring item is next due: every N months after it was last done (or opened, if never done). */
export const nextDue = (m: Maintenance): IsoDate | null =>
  m.recurring ? addMonthsToDate(m.doneDate ?? m.openedDate, m.recurring.everyMonths) : null;
