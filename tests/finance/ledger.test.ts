import { describe, expect, it } from "vitest";
import { DEMO_PROPERTY } from "../../src/data/demo-property";
import { underwrite } from "../../src/lib/finance/underwriting";
import { variance } from "../../src/lib/finance/variance";
import type { ActualMonth } from "../../src/lib/finance/types";
import { addDays, addMonthsToDate } from "../../src/lib/ledger/dates";
import { nextDue } from "../../src/lib/ledger/maintenance";
import { settleLease } from "../../src/lib/ledger/rent";
import { combinedActuals } from "../../src/lib/ledger/to-actuals";
import { EMPTY_LEDGER, type Expense, type Lease, type Ledger, type RentPayment } from "../../src/lib/ledger/types";

const u = underwrite(DEMO_PROPERTY);
const LEASE: Lease = {
  id: "L1", tenantNickname: "Unit A tenant", startDate: "2026-01-01", endDate: null, trackFrom: "2026-01-01", monthlyRent: 245_000, dueDay: 1, graceDays: 5,
  lateFee: { kind: "flat", amount: 5_000 }, depositAmount: 245_000, depositReceivedDate: "2026-01-01", status: "active",
};
let n = 0;
const pay = (date: string, amount: number, forMonth = date.slice(0, 7)): RentPayment => ({ id: `p${++n}`, leaseId: "L1", date, amount, forMonth });
const exp = (date: string, category: Expense["category"], amount: number, extra: Partial<Expense> = {}): Expense => ({ id: `e${++n}`, date, category, amount, ...extra });
const ledger = (l: Partial<Ledger>): Ledger => ({ ...EMPTY_LEDGER, leases: [LEASE], ...l });

describe("ledger reference test (Phase 3 brief)", () => {
  const months = ["2026-01", "2026-02", "2026-03"];
  const bills = months.flatMap((m) => [exp(`${m}-05`, "propertyTax", 30_000), exp(`${m}-05`, "insurance", 16_000), exp(`${m}-05`, "utilities", 5_000), exp(`${m}-01`, "mortgagePI", u.monthlyPI)]);
  const L = ledger({
    payments: [pay("2026-01-01", 245_000), pay("2026-02-09", 250_000), pay("2026-03-03", 120_000), pay("2026-03-15", 125_000)],
    expenses: [...bills, exp("2026-01-20", "repairsMaintenance", 12_000), exp("2026-02-12", "repairsMaintenance", 180_000, { vendor: "Water heater replacement" })],
  });
  const today = "2026-03-20"; // inside M3, so M4 is not a month yet
  const c = combinedActuals([], L, today);
  const r = variance(u, c.months);
  const impact = (k: string) => r.contributors.find((x) => x.category === k)!.impact;
  const total = (k: keyof ActualMonth) => c.months.reduce((s, m) => s + (m[k] as number), 0);

  it("counts exactly M1–M3 as ledger months", () => {
    expect(c.months.map((m) => m.month)).toEqual(months);
    expect(Object.values(c.mode)).toEqual(["ledger", "ledger", "ledger"]);
  });
  it("keeps the deposit out of income and cash flow", () => {
    expect(c.months.every((m) => m.otherIncome <= 5_000)).toBe(true);
    expect(c.settlements[0].depositHeld).toBe(245_000);
    expect(Object.values(c.sources).flatMap((s) => Object.values(s).flat()).some((ref) => ref!.kind === "deposit")).toBe(false);
  });
  it("rent received 7,350.00; fees collected 50.00; the M3 fee is a receivable", () => {
    expect(total("rentReceived")).toBe(735_000);
    expect(total("otherIncome")).toBe(5_000);
    expect(c.settlements[0].receivable).toBe(5_000);
    expect(c.settlements[0].months.map((m) => m.status)).toEqual(["paid", "late", "late", "upcoming"]);
  });
  it("contributors match the table and sum exactly to −355.90", () => {
    expect(impact("rentReceived")).toBe(36_750);
    expect(impact("otherIncome")).toBe(5_000);
    expect(impact("repairsMaintenance")).toBe(-133_200);
    expect(impact("management")).toBe(55_860);
    for (const k of ["propertyTax", "insurance", "utilities", "mortgagePI", "hoa", "otherOperating"]) expect(impact(k)).toBe(0);
    expect(r.totalVariance).toBe(-35_590);
    expect(r.contributors.reduce((s, x) => s + x.impact, 0)).toBe(r.totalVariance);
  });
  it("the repairs contributor points at the water heater entry", () => {
    const refs = c.sources["2026-02"].repairsMaintenance!;
    expect(refs).toEqual([expect.objectContaining({ label: "Water heater replacement", amount: 180_000, date: "2026-02-12" })]);
  });
  it("source refs sum to every category total in every ledger month", () => {
    for (const m of c.months) {
      for (const [cat, refs] of Object.entries(c.sources[m.month] ?? {})) {
        expect(refs!.reduce((s, x) => s + x.amount, 0)).toBe(m[cat as keyof ActualMonth]);
      }
    }
  });
  it("cash basis: rent + fee income in a month equals the payments dated in it", () => {
    for (const m of c.months) {
      const paid = L.payments.filter((p) => p.date.startsWith(m.month)).reduce((s, p) => s + p.amount, 0);
      expect(m.rentReceived + m.otherIncome).toBe(paid);
    }
  });
});

describe("settlement order and fees", () => {
  it("pays all rent before any fee: an old unpaid fee doesn't make the next month late", () => {
    const L = ledger({ payments: [pay("2026-01-01", 245_000), pay("2026-02-09", 245_000), pay("2026-03-01", 245_000)] });
    const s = settleLease(LEASE, L, "2026-03-20");
    expect(s.months.map((m) => m.status)).toEqual(["paid", "late", "paid", "upcoming"]);
    expect(s.months[1].fee).toEqual({ amount: 5_000, paid: 0, waived: false });
    expect(s.months[2].fee).toBeNull();
    expect(s.receivable).toBe(5_000);
  });
  it("a payment on the last grace day is on time; the day after is late", () => {
    expect(settleLease(LEASE, ledger({ payments: [pay("2026-01-06", 245_000)] }), "2026-01-20").months[0].status).toBe("paid");
    expect(settleLease(LEASE, ledger({ payments: [pay("2026-01-07", 245_000)] }), "2026-01-20").months[0].status).toBe("late");
  });
  it("waiving a month removes its fee but keeps it marked late", () => {
    const s = settleLease(LEASE, ledger({ payments: [pay("2026-01-09", 245_000)], waivers: [{ leaseId: "L1", forMonth: "2026-01" }] }), "2026-01-20");
    expect(s.months[0]).toMatchObject({ status: "late", fee: { waived: true, paid: 0 } });
    expect(s.receivable).toBe(0);
  });
  it("a percentage fee is a share of the rent, rounded to the cent", () => {
    const s = settleLease({ ...LEASE, lateFee: { kind: "percent", amount: 0.05 } }, ledger({}), "2026-01-20");
    expect(s.months[0].fee!.amount).toBe(12_250);
  });
  it("within the grace period an unpaid month is 'due', not late, and has no fee", () => {
    const s = settleLease(LEASE, ledger({}), "2026-01-04");
    expect(s.months[0]).toMatchObject({ status: "due", fee: null });
  });
  it("due day 28 plus 5 grace days crosses into the next month", () => {
    const s = settleLease({ ...LEASE, startDate: "2026-02-01", dueDay: 28 }, ledger({ payments: [pay("2026-03-04", 245_000)] }), "2026-03-10");
    expect(s.months[0]).toMatchObject({ month: "2026-02", graceEnd: "2026-03-05", status: "paid" });
    expect(addDays("2026-02-28", 5)).toBe("2026-03-05");
  });
  it("a payment before the due date covers that month and is never late", () => {
    const s = settleLease(LEASE, ledger({ payments: [pay("2025-12-28", 245_000, "2026-01")] }), "2026-01-20");
    expect(s.months[0].status).toBe("paid");
  });
  it("an overpayment is carried forward as credit and pays the next rent", () => {
    const L = ledger({ payments: [pay("2026-01-01", 490_000)] });
    const s = settleLease(LEASE, L, "2026-02-20");
    expect(s.months.map((m) => m.status)).toEqual(["paid", "paid", "upcoming"]);
    const c = combinedActuals([], L, "2026-03-20"); // February is complete, so it counts even with no entry
    expect(c.months.map((m) => m.rentReceived)).toEqual([490_000, 0]); // cash basis: counted when received
  });
  it("no rent is due after a lease ends mid-month", () => {
    const s = settleLease({ ...LEASE, endDate: "2026-02-15" }, ledger({}), "2026-05-20");
    expect(s.months.map((m) => m.month)).toEqual(["2026-01", "2026-02"]);
  });
});

describe("deposits", () => {
  it("a deposit applied to rent settles the charge, counts as other income on that date, and is capped at what's held", () => {
    const L = ledger({ depositEvents: [{ id: "d1", leaseId: "L1", date: "2026-01-10", kind: "applied_to_rent", amount: 300_000 }] });
    const s = settleLease(LEASE, L, "2026-01-20");
    expect(s.credits[0]).toMatchObject({ kind: "deposit", amount: 245_000, toRent: 245_000 });
    expect(s.depositHeld).toBe(0);
    const c = combinedActuals([], L, "2026-01-20");
    expect(c.months[0]).toMatchObject({ rentReceived: 0, otherIncome: 245_000 });
  });
  it("a deposit applied beyond what is owed counts only the part owed; the rest stays held", () => {
    const L = ledger({ payments: [pay("2026-01-01", 145_000)], depositEvents: [{ id: "d1", leaseId: "L1", date: "2026-01-04", kind: "applied_to_rent", amount: 245_000 }] });
    const s = settleLease(LEASE, L, "2026-01-20");
    expect(s.credits.find((c) => c.kind === "deposit")).toMatchObject({ amount: 100_000, toRent: 100_000, toCredit: 0 });
    expect(s.depositHeld).toBe(145_000);
    expect(s.months[0].status).toBe("paid");
    expect(combinedActuals([], L, "2026-01-20").months[0]).toMatchObject({ rentReceived: 145_000, otherIncome: 100_000 });
  });
  it("a returned deposit never touches income", () => {
    const L = ledger({ depositEvents: [{ id: "d1", leaseId: "L1", date: "2026-01-10", kind: "returned", amount: 245_000 }], expenses: [exp("2026-01-12", "utilities", 5_000)] });
    const c = combinedActuals([], L, "2026-01-20");
    expect(c.months[0].otherIncome).toBe(0);
    expect(c.settlements[0].depositHeld).toBe(0);
  });
});

describe("which months count", () => {
  it("an unpaid month with no entries still counts, so missing rent shows as variance", () => {
    const L = ledger({ payments: [pay("2026-01-01", 245_000)] });
    const c = combinedActuals([], L, "2026-03-20");
    expect(c.months.map((m) => [m.month, m.rentReceived])).toEqual([["2026-01", 245_000], ["2026-02", 0]]);
  });
  it("a lease that began long ago creates no backlog; months start at the first dated entry", () => {
    const L: Ledger = { ...EMPTY_LEDGER, leases: [{ ...LEASE, startDate: "2024-01-01", trackFrom: "2026-03-01" }], payments: [pay("2026-03-01", 245_000)] };
    expect(combinedActuals([], L, "2026-03-20").months.map((m) => m.month)).toEqual(["2026-03"]);
    const s = settleLease(L.leases[0], L, "2026-03-20");
    expect(s.months.map((m) => [m.month, m.status])).toEqual([["2026-03", "paid"], ["2026-04", "upcoming"]]);
    expect(s.receivable).toBe(0);
  });
  it("a tenant who never pays still shows as overdue from the tracking date", () => {
    const s = settleLease({ ...LEASE, trackFrom: "2026-02-01" }, ledger({}), "2026-03-20");
    expect(s.months.map((m) => m.status)).toEqual(["unpaid", "unpaid", "upcoming"]);
    expect(s.receivable).toBe(2 * (245_000 + 5_000));
  });
  it("works with no lease at all (expenses only)", () => {
    const c = combinedActuals([], { ...EMPTY_LEDGER, expenses: [exp("2026-01-12", "repairsMaintenance", 9_000)] }, "2026-01-20");
    expect(c.months).toHaveLength(1);
    expect(c.months[0].repairsMaintenance).toBe(9_000);
    expect(combinedActuals([], EMPTY_LEDGER, "2026-01-20").months).toEqual([]);
  });
  it("a manual month is never also a ledger month, and switching modes deletes nothing", () => {
    const manualJan: ActualMonth = { month: "2026-01", rentReceived: 200_000, otherIncome: 0, propertyTax: 0, insurance: 0, utilities: 0, hoa: 0, repairsMaintenance: 0, management: 0, otherOperating: 0, mortgagePI: 0, capex: 0 };
    const L = ledger({ payments: [pay("2026-01-01", 245_000)] });
    const asManual = combinedActuals([manualJan], L, "2026-01-20");
    expect(asManual.months).toEqual([manualJan]);
    expect(asManual.mode["2026-01"]).toBe("manual");
    const asLedger = combinedActuals([manualJan], { ...L, monthModes: [{ month: "2026-01", mode: "ledger" }] }, "2026-01-20");
    expect(asLedger.months.map((m) => m.rentReceived)).toEqual([245_000]);
    expect(variance(u, asLedger.months).months).toBe(1); // counted once, never twice
  });
  it("CapEx expenses go to capex, never into cash flow", () => {
    const c = combinedActuals([], { ...EMPTY_LEDGER, expenses: [exp("2026-01-12", "capex", 400_000, { note: "Roof" })] }, "2026-01-20");
    expect(c.months[0].capex).toBe(400_000);
    expect(variance(u, c.months).actualCashFlowBeforeCapex).toBe(0);
  });
});

describe("recurring maintenance", () => {
  it("next due is N months after it was last done (or opened)", () => {
    expect(nextDue({ id: "m", title: "HVAC service", openedDate: "2026-01-10", status: "done", doneDate: "2026-02-03", recurring: { everyMonths: 6 } })).toBe("2026-08-03");
    expect(nextDue({ id: "m", title: "Gutters", openedDate: "2026-01-31", status: "open", recurring: { everyMonths: 1 } })).toBe("2026-02-28");
    expect(nextDue({ id: "m", title: "Once", openedDate: "2026-01-10", status: "open" })).toBeNull();
    expect(addMonthsToDate("2024-01-31", 1)).toBe("2024-02-29");
  });
});

describe("usual monthly bills", () => {
  it("lists only planned recurring bills a ledger month hasn't recorded, at the planned amount", async () => {
    const { missingBills } = await import("../../src/lib/ledger/bills");
    const { monthlyForecast } = await import("../../src/lib/finance/variance");
    const planned = monthlyForecast(u);
    const got = missingBills(["2026-01", "2026-02"], [exp("2026-01-05", "propertyTax", 31_000)], planned);
    expect(got.filter((b) => b.date === "2026-01-01").map((b) => b.category)).toEqual(["mortgagePI", "insurance", "utilities", "management"]);
    expect(got.filter((b) => b.date === "2026-02-01").map((b) => b.category)).toEqual(["mortgagePI", "propertyTax", "insurance", "utilities", "management"]);
    expect(got.find((b) => b.category === "mortgagePI")!.amount).toBe(u.monthlyPI);
    // With them added, those categories match the plan exactly: no phantom "better than plan".
    const L = { ...EMPTY_LEDGER, expenses: got.map((b, i) => ({ ...b, id: `b${i}` })) };
    const r = variance(u, combinedActuals([], L, "2026-03-20").months);
    for (const k of ["mortgagePI", "insurance", "utilities", "management"]) expect(r.contributors.find((c) => c.category === k)!.impact).toBe(0);
  });
});
