"use client";
import { useState } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { Badge, type Status } from "@/components/Icons";
import { monthLabel, usd } from "@/lib/format";
import { dayOf, monthOf } from "@/lib/ledger/dates";
import { feeFor, settleLease, type RentStatus } from "@/lib/ledger/rent";
import type { IsoDate, Lease, Ledger } from "@/lib/ledger/types";
import { newId } from "@/lib/storage";

type SetLedger = (fn: (l: Ledger) => Ledger) => boolean;

const STATUS: Record<RentStatus, { st: Status; label: string }> = {
  paid: { st: "good", label: "Paid" },
  late: { st: "warn", label: "Paid late" },
  partial: { st: "warn", label: "Partial" },
  unpaid: { st: "bad", label: "Unpaid" },
  due: { st: "none", label: "Due" },
  upcoming: { st: "none", label: "Upcoming" },
};
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
const feeText = (l: Lease) => (!l.lateFee ? "None" : l.lateFee.kind === "flat" ? usd(l.lateFee.amount, { exact: true }) : `${+(l.lateFee.amount * 100).toFixed(2)}% of rent`);

function DateField({ label, value, onChange, required, help }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; help?: string }) {
  return (
    <label className="fld">
      <span className="flabel">{label}</span>
      <span className="inp">
        <input type="date" value={value} required={required} onChange={(e) => onChange(e.target.value)} />
      </span>
      {help && <span className="note">{help}</span>}
    </label>
  );
}

function LeaseForm({ initial, onSave, onCancel }: { initial: Lease; onSave: (l: Lease) => boolean; onCancel?: () => void }) {
  const [d, setD] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<Lease>) => setD((x) => ({ ...x, ...patch }));
  const feeKind = d.lateFee?.kind ?? "none";
  return (
    <form
      className="lf"
      onSubmit={(e) => {
        e.preventDefault();
        if (!d.tenantNickname.trim() || !d.startDate || !d.trackFrom) return setErr("Add a nickname, a start date and the date you track rent from.");
        if (d.endDate && d.endDate < d.startDate) return setErr("The end date is before the start date.");
        setErr(null);
        if (!onSave({ ...d, tenantNickname: d.tenantNickname.trim() })) setErr("That lease couldn't be saved. Check the amounts and dates.");
      }}
    >
      <p className="note full" style={{ margin: 0 }}>
        Use a nickname like &ldquo;Unit A tenant&rdquo;. Don&apos;t enter names, phone numbers, emails or ID numbers: RentWise doesn&apos;t need them.
      </p>
      <label className="fld full">
        <span className="flabel">Tenant nickname</span>
        <span className="inp">
          <input maxLength={40} value={d.tenantNickname} required onChange={(e) => set({ tenantNickname: e.target.value })} />
        </span>
      </label>
      <DateField label="Lease start" value={d.startDate} required onChange={(v) => set({ startDate: v })} />
      <DateField label="Lease end (optional)" value={d.endDate ?? ""} onChange={(v) => set({ endDate: v || null })} />
      <DateField label="Track rent from" value={d.trackFrom} required onChange={(v) => set({ trackFrom: v })} help="Earlier months are never charged. You can set a past date." />
      <NumberField def={{ label: "Monthly rent", kind: "money", suffix: "/mo", help: "", min: 1, max: 1_000_000 }} value={d.monthlyRent} onCommit={(v) => set({ monthlyRent: v })} />
      <NumberField def={{ label: "Rent due on day", kind: "years", suffix: "of the month", help: "", min: 1, max: 28 }} value={d.dueDay} onCommit={(v) => set({ dueDay: v })} />
      <NumberField def={{ label: "Grace period", kind: "years", suffix: "days", help: "", min: 0, max: 31 }} value={d.graceDays} onCommit={(v) => set({ graceDays: v })} />
      <label className="fld">
        <span className="flabel">Late fee</span>
        <span className="inp">
          <select
            value={feeKind}
            onChange={(e) => set({ lateFee: e.target.value === "none" ? null : e.target.value === "flat" ? { kind: "flat", amount: 5_000 } : { kind: "percent", amount: 0.05 } })}
          >
            <option value="none">No late fee</option>
            <option value="flat">Flat amount</option>
            <option value="percent">Percent of rent</option>
          </select>
        </span>
      </label>
      {d.lateFee?.kind === "flat" && (
        <NumberField def={{ label: "Late fee amount", kind: "money", help: "", min: 0, max: 100_000 }} value={d.lateFee.amount} onCommit={(v) => set({ lateFee: { kind: "flat", amount: v } })} />
      )}
      {d.lateFee?.kind === "percent" && (
        <NumberField def={{ label: "Late fee", kind: "rate", suffix: "% of rent", help: "", min: 0, max: 50 }} value={d.lateFee.amount} onCommit={(v) => set({ lateFee: { kind: "percent", amount: v } })} />
      )}
      <NumberField def={{ label: "Security deposit", kind: "money", help: "", min: 0, max: 1_000_000 }} value={d.depositAmount} onCommit={(v) => set({ depositAmount: v })} />
      <DateField label="Deposit received on (optional)" value={d.depositReceivedDate ?? ""} onChange={(v) => set({ depositReceivedDate: v || null })} />
      <p className="note full" style={{ margin: 0 }}>Late-fee rules vary by state and city; check yours. A fee here is only a ledger entry: nothing is charged to anyone.</p>
      {err && <p role="alert" className="ferr full" style={{ margin: 0 }}>{err}</p>}
      <div className="full" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" className="btn btn-primary">Save lease</button>
        {onCancel && <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

function PaymentForm({ lease, months, today, onSave }: { lease: Lease; months: string[]; today: IsoDate; onSave: (p: { amount: number; date: IsoDate; forMonth: string }) => boolean }) {
  const [amount, setAmount] = useState(lease.monthlyRent);
  const [date, setDate] = useState(today);
  const [forMonth, setForMonth] = useState(months[0] ?? monthOf(today));
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="lf"
      onSubmit={(e) => {
        e.preventDefault();
        if (!date || date > today) return setErr("Use a date that has already happened.");
        setErr(onSave({ amount, date, forMonth }) ? null : "That payment couldn't be saved.");
      }}
    >
      <NumberField def={{ label: "Amount received", kind: "money", help: "", min: 0.01, max: 1_000_000 }} value={amount} onCommit={setAmount} />
      <DateField label="Received on" value={date} required onChange={setDate} />
      <label className="fld">
        <span className="flabel">For</span>
        <span className="inp">
          <select value={forMonth} onChange={(e) => setForMonth(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)} rent</option>)}
          </select>
        </span>
      </label>
      <div style={{ alignSelf: "end" }}>
        <button type="submit" className="btn btn-primary">Record payment</button>
      </div>
      <p className="note full" style={{ margin: 0 }}>Payments always settle the oldest rent first, then any late fee. Security deposits aren&apos;t rent: record them on the lease.</p>
      {err && <p role="alert" className="ferr full" style={{ margin: 0 }}>{err}</p>}
    </form>
  );
}

/** L1 + L2: the lease, its rent roll by month, what's owed now, and quick payment entry. */
export function RentTab({ ledger, setLedger, today, plannedRent }: { ledger: Ledger; setLedger: SetLedger; today: IsoDate; plannedRent: number }) {
  const [editing, setEditing] = useState<string | null>(ledger.leases.length ? null : "new");
  const blank: Lease = {
    id: "", tenantNickname: "", startDate: today, endDate: null, trackFrom: dayOf(monthOf(today), 1), monthlyRent: plannedRent, dueDay: 1, graceDays: 5,
    lateFee: { kind: "flat", amount: 5_000 }, depositAmount: plannedRent, depositReceivedDate: null, status: "active",
  };
  const saveLease = (l: Lease) => {
    const ok = setLedger((x) => (l.id ? { ...x, leases: x.leases.map((y) => (y.id === l.id ? l : y)) } : { ...x, leases: [...x.leases, { ...l, id: newId() }] }));
    if (ok) setEditing(null);
    return ok;
  };

  return (
    <div className="ltab">
      {!ledger.leases.length && editing !== "new" && (
        <section className="card">
          <h2 className="disp" style={{ margin: 0, fontSize: 22 }}>No lease yet</h2>
          <p style={{ margin: "8px 0 16px", color: "var(--ink-2)" }}>Add the lease to track rent by month: what was paid, what&apos;s late and what&apos;s owed. Every payment flows into plan vs. actual.</p>
          <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>Add a lease</button>
        </section>
      )}
      {editing === "new" && (
        <section className="card" aria-labelledby="nl-h">
          <h2 className="disp" id="nl-h" style={{ margin: "0 0 12px", fontSize: 22 }}>Add a lease</h2>
          <LeaseForm initial={blank} onSave={saveLease} onCancel={ledger.leases.length ? () => setEditing(null) : undefined} />
        </section>
      )}

      {ledger.leases.map((lease) => {
        const s = settleLease(lease, ledger, today);
        const payable = s.months.filter((m) => m.status !== "paid" && m.status !== "late").map((m) => m.month);
        const payments = ledger.payments.filter((p) => p.leaseId === lease.id).sort((a, b) => b.date.localeCompare(a.date));
        const waive = (forMonth: string, on: boolean) =>
          setLedger((x) => ({ ...x, waivers: on ? [...x.waivers, { leaseId: lease.id, forMonth }] : x.waivers.filter((w) => !(w.leaseId === lease.id && w.forMonth === forMonth)) }));
        return (
          <div key={lease.id} className="ltab">
            {editing === lease.id ? (
              <section className="card">
                <h2 className="disp" style={{ margin: "0 0 12px", fontSize: 22 }}>Edit lease</h2>
                <LeaseForm initial={lease} onSave={saveLease} onCancel={() => setEditing(null)} />
              </section>
            ) : (
              <section className="card" aria-labelledby={`lc-${lease.id}`}>
                <div className="lch">
                  <h2 className="disp" id={`lc-${lease.id}`} style={{ margin: 0, fontSize: 22 }}>{lease.tenantNickname}</h2>
                  <span>
                    <button type="button" className="lnk" onClick={() => setEditing(lease.id)}>Edit lease</button>
                    <button
                      type="button"
                      className="lnk danger"
                      onClick={() => confirm(`Delete this lease and its ${payments.length} payment(s)? This can't be undone.`) &&
                        setLedger((x) => ({ ...x, leases: x.leases.filter((l) => l.id !== lease.id), payments: x.payments.filter((p) => p.leaseId !== lease.id), waivers: x.waivers.filter((w) => w.leaseId !== lease.id), depositEvents: x.depositEvents.filter((e) => e.leaseId !== lease.id) }))}
                    >
                      Delete
                    </button>
                  </span>
                </div>
                <dl className="ldl num">
                  <div><dt>Rent</dt><dd>{usd(lease.monthlyRent, { exact: true })}/mo</dd></div>
                  <div><dt>Due</dt><dd>{ordinal(lease.dueDay)}, {lease.graceDays} days&apos; grace</dd></div>
                  <div><dt>Late fee</dt><dd>{feeText(lease)}</dd></div>
                  <div><dt>Lease</dt><dd>{lease.startDate} to {lease.endDate ?? "ongoing"}</dd></div>
                  <div><dt>Owed now</dt><dd className={s.receivable > 0 ? "neg" : ""}>{usd(s.receivable, { exact: true })}</dd></div>
                  {s.creditBalance > 0 && <div><dt>Tenant credit</dt><dd>{usd(s.creditBalance, { exact: true })}</dd></div>}
                  <div><dt>Deposit held</dt><dd>{usd(s.depositHeld, { exact: true })} <small>held for the tenant, not income</small></dd></div>
                </dl>
              </section>
            )}

            <section className="card" aria-labelledby={`rr-${lease.id}`}>
              <h2 className="disp" id={`rr-${lease.id}`} style={{ margin: 0, fontSize: 22 }}>Rent by month</h2>
              {s.months.length ? (
                <table className="ct num">
                  <caption className="sr-only">Rent status by month for {lease.tenantNickname}</caption>
                  <thead><tr><th scope="col">Month</th><th scope="col">Status</th><th scope="col">Paid</th><th scope="col">Late fee</th></tr></thead>
                  <tbody>
                    {s.months.map((m) => (
                      <tr key={m.month}>
                        <th scope="row">{monthLabel(m.month)}</th>
                        <td><Badge st={STATUS[m.status].st} label={STATUS[m.status].label} /></td>
                        <td>{usd(m.paid, { exact: true })}<span className="opt"> of {usd(m.rent, { exact: true })}</span></td>
                        <td>
                          {m.fee ? (
                            <span className="fee">
                              {m.fee.waived ? <span className="mut">Waived</span> : <>{usd(m.fee.amount, { exact: true })}{m.fee.paid >= m.fee.amount ? " paid" : " owed"}</>}
                              {m.fee.paid < m.fee.amount && (
                                <button type="button" className="lnk" onClick={() => waive(m.month, !m.fee!.waived)}>{m.fee.waived ? "Undo" : "Waive"}</button>
                              )}
                            </span>
                          ) : <span className="mut">None</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ margin: "8px 0 0", color: "var(--ink-2)" }}>No rent is due yet. The first rent falls on the {ordinal(lease.dueDay)} after {lease.trackFrom}.</p>
              )}
              {feeFor(lease) > 0 && <p className="note" style={{ margin: "12px 0 0" }}>A month that is still short after the grace period gets one {usd(feeFor(lease), { exact: true })} fee. It counts as income only once it&apos;s paid. Late-fee rules vary by state and city; check yours.</p>}
            </section>

            <section className="card" aria-labelledby={`rp-${lease.id}`}>
              <h2 className="disp" id={`rp-${lease.id}`} style={{ margin: "0 0 12px", fontSize: 22 }}>Record a payment</h2>
              <PaymentForm
                key={payments.length /* fresh defaults after each payment */}
                lease={lease}
                months={payable.length ? payable : [monthOf(today)]}
                today={today}
                onSave={(p) => setLedger((x) => ({ ...x, payments: [...x.payments, { id: newId(), leaseId: lease.id, ...p }] }))}
              />
              {payments.length > 0 && (
                <table className="ct num">
                  <caption className="sr-only">Payments recorded for {lease.tenantNickname}</caption>
                  <thead><tr><th scope="col">Received</th><th scope="col">For</th><th scope="col">Amount</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <th scope="row">{p.date}</th>
                        <td>{monthLabel(p.forMonth)}</td>
                        <td>{usd(p.amount, { exact: true })}</td>
                        <td><button type="button" className="lnk danger" onClick={() => confirm("Delete this payment?") && setLedger((x) => ({ ...x, payments: x.payments.filter((y) => y.id !== p.id) }))}>Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        );
      })}
      {ledger.leases.length > 0 && editing !== "new" && (
        <button type="button" className="btn btn-quiet" style={{ alignSelf: "flex-start" }} onClick={() => setEditing("new")}>Add another lease</button>
      )}
    </div>
  );
}
