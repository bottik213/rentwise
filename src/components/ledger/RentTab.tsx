"use client";
import { useState } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { Badge, type Status } from "@/components/Icons";
import type { I18n } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { dayOf, monthOf } from "@/lib/ledger/dates";
import { feeFor, settleLease, type RentStatus } from "@/lib/ledger/rent";
import type { IsoDate, Lease, Ledger } from "@/lib/ledger/types";
import { newId } from "@/lib/storage";

type SetLedger = (fn: (l: Ledger) => Ledger) => boolean;

const STATUS: Record<RentStatus, Status> = { paid: "good", late: "warn", partial: "warn", unpaid: "bad", due: "none", upcoming: "none" };
const feeText = (l: Lease, { t, money, num }: I18n) =>
  !l.lateFee ? t.common.none : l.lateFee.kind === "flat" ? money(l.lateFee.amount, { exact: true }) : t.rent.pctOfRent(num(l.lateFee.amount * 100));

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
  const { t } = useI18n();
  const R = t.rent;
  const [d, setD] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<Lease>) => setD((x) => ({ ...x, ...patch }));
  const feeKind = d.lateFee?.kind ?? "none";
  return (
    <form
      className="lf"
      onSubmit={(e) => {
        e.preventDefault();
        if (!d.tenantNickname.trim() || !d.startDate || !d.trackFrom) return setErr(R.needBasics);
        if (d.endDate && d.endDate < d.startDate) return setErr(R.endBeforeStart);
        setErr(null);
        if (!onSave({ ...d, tenantNickname: d.tenantNickname.trim() })) setErr(R.leaseFailed);
      }}
    >
      <p className="note full" style={{ margin: 0 }}>{R.nicknameNote}</p>
      <label className="fld full">
        <span className="flabel">{R.tenant}</span>
        <span className="inp">
          <input maxLength={40} value={d.tenantNickname} required onChange={(e) => set({ tenantNickname: e.target.value })} />
        </span>
      </label>
      <DateField label={R.start} value={d.startDate} required onChange={(v) => set({ startDate: v })} />
      <DateField label={R.end} value={d.endDate ?? ""} onChange={(v) => set({ endDate: v || null })} />
      <DateField label={R.trackFrom} value={d.trackFrom} required onChange={(v) => set({ trackFrom: v })} help={R.trackHelp} />
      <NumberField def={{ label: R.monthlyRent, kind: "money", suffix: t.common.mo, help: "", min: 1, max: 1_000_000 }} value={d.monthlyRent} onCommit={(v) => set({ monthlyRent: v })} />
      <NumberField def={{ label: R.dueDay, kind: "years", suffix: R.ofMonth, help: "", min: 1, max: 28 }} value={d.dueDay} onCommit={(v) => set({ dueDay: v })} />
      <NumberField def={{ label: R.grace, kind: "years", suffix: R.days, help: "", min: 0, max: 31 }} value={d.graceDays} onCommit={(v) => set({ graceDays: v })} />
      <label className="fld">
        <span className="flabel">{R.lateFee}</span>
        <span className="inp">
          <select
            value={feeKind}
            onChange={(e) => set({ lateFee: e.target.value === "none" ? null : e.target.value === "flat" ? { kind: "flat", amount: 5_000 } : { kind: "percent", amount: 0.05 } })}
          >
            <option value="none">{R.noFee}</option>
            <option value="flat">{R.flat}</option>
            <option value="percent">{R.percent}</option>
          </select>
        </span>
      </label>
      {d.lateFee?.kind === "flat" && (
        <NumberField def={{ label: R.feeAmount, kind: "money", help: "", min: 0, max: 100_000 }} value={d.lateFee.amount} onCommit={(v) => set({ lateFee: { kind: "flat", amount: v } })} />
      )}
      {d.lateFee?.kind === "percent" && (
        <NumberField def={{ label: R.lateFee, kind: "rate", suffix: t.fields.vacancyPct.suffix, help: "", min: 0, max: 50 }} value={d.lateFee.amount} onCommit={(v) => set({ lateFee: { kind: "percent", amount: v } })} />
      )}
      <NumberField def={{ label: R.deposit, kind: "money", help: "", min: 0, max: 1_000_000 }} value={d.depositAmount} onCommit={(v) => set({ depositAmount: v })} />
      <DateField label={R.depositOn} value={d.depositReceivedDate ?? ""} onChange={(v) => set({ depositReceivedDate: v || null })} />
      <p className="note full" style={{ margin: 0 }}>{R.feeRule}</p>
      {err && <p role="alert" className="ferr full" style={{ margin: 0 }}>{err}</p>}
      <div className="full" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" className="btn btn-primary">{R.saveLease}</button>
        {onCancel && <button type="button" className="btn btn-quiet" onClick={onCancel}>{t.common.cancel}</button>}
      </div>
    </form>
  );
}

function PaymentForm({ lease, months, today, onSave }: { lease: Lease; months: string[]; today: IsoDate; onSave: (p: { amount: number; date: IsoDate; forMonth: string }) => boolean }) {
  const { t, month: monthLabel } = useI18n();
  const R = t.rent;
  const [amount, setAmount] = useState(lease.monthlyRent);
  const [date, setDate] = useState(today);
  const [forMonth, setForMonth] = useState(months[0] ?? monthOf(today));
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="lf"
      onSubmit={(e) => {
        e.preventDefault();
        if (!date || date > today) return setErr(R.futureDate);
        setErr(onSave({ amount, date, forMonth }) ? null : R.paymentFailed);
      }}
    >
      <NumberField def={{ label: R.amountReceived, kind: "money", help: "", min: 0.01, max: 1_000_000 }} value={amount} onCommit={setAmount} />
      <DateField label={R.receivedOn} value={date} required onChange={setDate} />
      <label className="fld">
        <span className="flabel">{R.for}</span>
        <span className="inp">
          <select value={forMonth} onChange={(e) => setForMonth(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{R.monthRent(monthLabel(m))}</option>)}
          </select>
        </span>
      </label>
      <div style={{ alignSelf: "end" }}>
        <button type="submit" className="btn btn-primary">{R.recordPayment}</button>
      </div>
      <p className="note full" style={{ margin: 0 }}>{R.paymentOrder}</p>
      {err && <p role="alert" className="ferr full" style={{ margin: 0 }}>{err}</p>}
    </form>
  );
}

/** L1 + L2: the lease, its rent roll by month, what's owed now, and quick payment entry. */
export function RentTab({ ledger, setLedger, today, plannedRent }: { ledger: Ledger; setLedger: SetLedger; today: IsoDate; plannedRent: number }) {
  const i = useI18n();
  const { t, money: usd, month: monthLabel } = i;
  const R = t.rent;
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
          <h2 className="disp" style={{ margin: 0, fontSize: 22 }}>{R.noLease}</h2>
          <p style={{ margin: "8px 0 16px", color: "var(--ink-2)" }}>{R.noLeaseText}</p>
          <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>{R.addLease}</button>
        </section>
      )}
      {editing === "new" && (
        <section className="card" aria-labelledby="nl-h">
          <h2 className="disp" id="nl-h" style={{ margin: "0 0 12px", fontSize: 22 }}>{R.addLease}</h2>
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
                <h2 className="disp" style={{ margin: "0 0 12px", fontSize: 22 }}>{R.editLease}</h2>
                <LeaseForm initial={lease} onSave={saveLease} onCancel={() => setEditing(null)} />
              </section>
            ) : (
              <section className="card" aria-labelledby={`lc-${lease.id}`}>
                <div className="lch">
                  <h2 className="disp" id={`lc-${lease.id}`} style={{ margin: 0, fontSize: 22 }}>{lease.tenantNickname}</h2>
                  <span>
                    <button type="button" className="lnk" onClick={() => setEditing(lease.id)}>{R.editLease}</button>
                    <button
                      type="button"
                      className="lnk danger"
                      onClick={() => confirm(R.deleteLease(payments.length)) &&
                        setLedger((x) => ({ ...x, leases: x.leases.filter((l) => l.id !== lease.id), payments: x.payments.filter((p) => p.leaseId !== lease.id), waivers: x.waivers.filter((w) => w.leaseId !== lease.id), depositEvents: x.depositEvents.filter((e) => e.leaseId !== lease.id) }))}
                    >
                      {t.common.delete}
                    </button>
                  </span>
                </div>
                <dl className="ldl num">
                  <div><dt>{R.rent}</dt><dd>{usd(lease.monthlyRent, { exact: true })}{t.common.mo}</dd></div>
                  <div><dt>{R.due}</dt><dd>{R.dueText(R.day(lease.dueDay), lease.graceDays)}</dd></div>
                  <div><dt>{R.lateFee}</dt><dd>{feeText(lease, i)}</dd></div>
                  <div><dt>{R.lease}</dt><dd>{R.leaseSpan(lease.startDate, lease.endDate)}</dd></div>
                  <div><dt>{R.owed}</dt><dd className={s.receivable > 0 ? "neg" : ""}>{usd(s.receivable, { exact: true })}</dd></div>
                  {s.creditBalance > 0 && <div><dt>{R.credit}</dt><dd>{usd(s.creditBalance, { exact: true })}</dd></div>}
                  <div><dt>{R.held}</dt><dd>{usd(s.depositHeld, { exact: true })} <small>{R.heldNote}</small></dd></div>
                </dl>
              </section>
            )}

            <section className="card" aria-labelledby={`rr-${lease.id}`}>
              <h2 className="disp" id={`rr-${lease.id}`} style={{ margin: 0, fontSize: 22 }}>{R.byMonth}</h2>
              {s.months.length ? (
                <table className="ct num">
                  <caption className="sr-only">{R.byMonthCaption(lease.tenantNickname)}</caption>
                  <thead><tr><th scope="col">{R.month}</th><th scope="col">{R.statusCol}</th><th scope="col">{R.paid}</th><th scope="col">{R.lateFee}</th></tr></thead>
                  <tbody>
                    {s.months.map((m) => (
                      <tr key={m.month}>
                        <th scope="row">{monthLabel(m.month)}</th>
                        <td><Badge st={STATUS[m.status]} label={R.status[m.status]} /></td>
                        <td>{usd(m.paid, { exact: true })}<span className="opt">{R.of(usd(m.rent, { exact: true }))}</span></td>
                        <td>
                          {m.fee ? (
                            <span className="fee">
                              {m.fee.waived ? <span className="mut">{R.waived}</span> : <>{usd(m.fee.amount, { exact: true })}{m.fee.paid >= m.fee.amount ? R.feePaid : R.feeOwed}</>}
                              {m.fee.paid < m.fee.amount && (
                                <button type="button" className="lnk" onClick={() => waive(m.month, !m.fee!.waived)}>{m.fee.waived ? R.undo : R.waive}</button>
                              )}
                            </span>
                          ) : <span className="mut">{t.common.none}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ margin: "8px 0 0", color: "var(--ink-2)" }}>{R.noneDue(R.day(lease.dueDay), lease.trackFrom)}</p>
              )}
              {feeFor(lease) > 0 && <p className="note" style={{ margin: "12px 0 0" }}>{R.feeNote(usd(feeFor(lease), { exact: true }))}</p>}
            </section>

            <section className="card" aria-labelledby={`rp-${lease.id}`}>
              <h2 className="disp" id={`rp-${lease.id}`} style={{ margin: "0 0 12px", fontSize: 22 }}>{R.recordTitle}</h2>
              <PaymentForm
                key={payments.length /* fresh defaults after each payment */}
                lease={lease}
                months={payable.length ? payable : [monthOf(today)]}
                today={today}
                onSave={(p) => setLedger((x) => ({ ...x, payments: [...x.payments, { id: newId(), leaseId: lease.id, ...p }] }))}
              />
              {payments.length > 0 && (
                <table className="ct num">
                  <caption className="sr-only">{R.paymentsCaption(lease.tenantNickname)}</caption>
                  <thead><tr><th scope="col">{R.received}</th><th scope="col">{R.for}</th><th scope="col">{R.amount}</th><th scope="col"><span className="sr-only">{R.actions}</span></th></tr></thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <th scope="row">{p.date}</th>
                        <td>{monthLabel(p.forMonth)}</td>
                        <td>{usd(p.amount, { exact: true })}</td>
                        <td><button type="button" className="lnk danger" onClick={() => confirm(R.deletePayment) && setLedger((x) => ({ ...x, payments: x.payments.filter((y) => y.id !== p.id) }))}>{t.common.delete}</button></td>
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
        <button type="button" className="btn btn-quiet" style={{ alignSelf: "flex-start" }} onClick={() => setEditing("new")}>{R.another}</button>
      )}
    </div>
  );
}
