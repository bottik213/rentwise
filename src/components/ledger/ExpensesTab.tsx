"use client";
import { useState } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { Badge, type Status } from "@/components/Icons";
import { CATEGORY_LABEL } from "@/lib/explain";
import { usd } from "@/lib/format";
import { nextDue } from "@/lib/ledger/maintenance";
import type { Expense, ExpenseCategory, IsoDate, Ledger, Maintenance } from "@/lib/ledger/types";
import { newId } from "@/lib/storage";

type SetLedger = (fn: (l: Ledger) => Ledger) => boolean;

export const EXPENSE_CATEGORIES: ExpenseCategory[] = ["repairsMaintenance", "propertyTax", "insurance", "utilities", "hoa", "management", "otherOperating", "mortgagePI", "capex"];
export const expenseLabel = (c: ExpenseCategory) => (c === "capex" ? "CapEx (big replacements)" : CATEGORY_LABEL[c]);
const MSTATUS: Record<Maintenance["status"], { st: Status; label: string }> = {
  open: { st: "warn", label: "Open" },
  in_progress: { st: "none", label: "In progress" },
  done: { st: "good", label: "Done" },
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="fld">
      <span className="flabel">{label}</span>
      <span className="inp">{children}</span>
    </label>
  );
}

/** Add or edit one dated expense. Cash basis: only money already paid, so the date can't be in the future. */
function ExpenseForm({ initial, today, onSave, onCancel, submit }: { initial: Omit<Expense, "id">; today: IsoDate; onSave: (e: Omit<Expense, "id">) => boolean; onCancel?: () => void; submit: string }) {
  const [d, setD] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<Expense>) => setD((x) => ({ ...x, ...patch }));
  return (
    <form
      className="lf"
      onSubmit={(e) => {
        e.preventDefault();
        if (!d.date || d.date > today) return setErr("Use the date you paid it; it can't be in the future.");
        if (!(d.amount > 0)) return setErr("Enter an amount above $0.");
        setErr(onSave({ ...d, vendor: d.vendor?.trim() || undefined, note: d.note?.trim() || undefined }) ? null : "That expense couldn't be saved.");
      }}
    >
      <Field label="Paid on"><input type="date" value={d.date} required onChange={(e) => set({ date: e.target.value })} /></Field>
      <Field label="Category">
        <select value={d.category} onChange={(e) => set({ category: e.target.value as ExpenseCategory })}>
          {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{expenseLabel(c)}</option>)}
        </select>
      </Field>
      <NumberField def={{ label: "Amount", kind: "money", help: "", min: 0.01, max: 10_000_000 }} value={d.amount || undefined} onCommit={(v) => set({ amount: v })} />
      <Field label="Vendor (optional)"><input maxLength={60} value={d.vendor ?? ""} onChange={(e) => set({ vendor: e.target.value })} /></Field>
      <Field label="Note (optional)"><input maxLength={120} value={d.note ?? ""} onChange={(e) => set({ note: e.target.value })} /></Field>
      <div style={{ alignSelf: "end", display: "flex", gap: 8 }}>
        <button type="submit" className="btn btn-primary">{submit}</button>
        {onCancel && <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>}
      </div>
      {err && <p role="alert" className="ferr full" style={{ margin: 0 }}>{err}</p>}
    </form>
  );
}

/** "Mark done + add cost": closes the item and records its cost as a linked expense in one save. */
function DoneForm({ item, today, onSave, onCancel }: { item: Maintenance; today: IsoDate; onSave: (doneDate: IsoDate, cost: Omit<Expense, "id"> | null) => boolean; onCancel: () => void }) {
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [category, setCategory] = useState<ExpenseCategory>("repairsMaintenance");
  const [vendor, setVendor] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="lf"
      onSubmit={(e) => {
        e.preventDefault();
        if (!date || date > today) return setErr("Use the date it was done; it can't be in the future.");
        const cost = amount && amount > 0 ? { date, category, amount, vendor: vendor.trim() || undefined, maintenanceId: item.id } : null;
        setErr(onSave(date, cost) ? null : "That couldn't be saved.");
      }}
    >
      <Field label="Done on"><input type="date" value={date} required onChange={(e) => setDate(e.target.value)} /></Field>
      <NumberField def={{ label: "Cost (optional)", kind: "money", help: "", min: 0, max: 10_000_000 }} value={amount} onCommit={setAmount} />
      <Field label="Counts as">
        <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
          <option value="repairsMaintenance">{expenseLabel("repairsMaintenance")}</option>
          <option value="capex">{expenseLabel("capex")}</option>
        </select>
      </Field>
      <Field label="Vendor (optional)"><input maxLength={60} value={vendor} onChange={(e) => setVendor(e.target.value)} /></Field>
      <div style={{ alignSelf: "end", display: "flex", gap: 8 }}>
        <button type="submit" className="btn btn-primary">Save as done</button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>
      </div>
      {err && <p role="alert" className="ferr full" style={{ margin: 0 }}>{err}</p>}
    </form>
  );
}

/** L3: one list of dated expenses, and maintenance items whose cost becomes a linked expense. */
export function ExpensesTab({ ledger, setLedger, today }: { ledger: Ledger; setLedger: SetLedger; today: IsoDate }) {
  const [filter, setFilter] = useState<ExpenseCategory | "all">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [adding, setAdding] = useState(0); // remounts the add form with fresh defaults after each save
  const [mTitle, setMTitle] = useState("");
  const [mEvery, setMEvery] = useState(0);
  const titles = new Map(ledger.maintenance.map((m) => [m.id, m.title]));
  const shown = ledger.expenses.filter((e) => filter === "all" || e.category === filter).sort((a, b) => b.date.localeCompare(a.date));
  const total = shown.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="ltab">
      <section className="card" aria-labelledby="ae-h">
        <h2 className="disp" id="ae-h" style={{ margin: "0 0 12px", fontSize: 22 }}>Add an expense</h2>
        <ExpenseForm
          key={adding}
          initial={{ date: today, category: "repairsMaintenance", amount: 0 }}
          today={today}
          submit="Add expense"
          onSave={(e) => {
            const ok = setLedger((x) => ({ ...x, expenses: [...x.expenses, { ...e, id: newId() }] }));
            if (ok) setAdding((n) => n + 1);
            return ok;
          }}
        />
        <p className="note" style={{ margin: "12px 0 0" }}>Record money on the day it was paid. CapEx (a roof, HVAC) is compared with your reserve, never with monthly cash flow.</p>
      </section>

      <section className="card" aria-labelledby="el-h">
        <div className="lch">
          <h2 className="disp" id="el-h" style={{ margin: 0, fontSize: 22 }}>Expenses</h2>
          <label className="fld" style={{ minWidth: 220 }}>
            <span className="sr-only">Filter by category</span>
            <span className="inp">
              <select aria-label="Filter by category" value={filter} onChange={(e) => setFilter(e.target.value as ExpenseCategory | "all")}>
                <option value="all">All categories</option>
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{expenseLabel(c)}</option>)}
              </select>
            </span>
          </label>
        </div>
        {shown.length ? (
          <table className="ct num">
            <caption className="sr-only">Expenses, newest first</caption>
            <thead><tr><th scope="col">Paid on</th><th scope="col" className="opt">Category</th><th scope="col">What</th><th scope="col">Amount</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {shown.map((e) =>
                editing === e.id ? (
                  <tr key={e.id}>
                    <td colSpan={5}>
                      <ExpenseForm
                        initial={e}
                        today={today}
                        submit="Save"
                        onCancel={() => setEditing(null)}
                        onSave={(next) => {
                          const ok = setLedger((x) => ({ ...x, expenses: x.expenses.map((y) => (y.id === e.id ? { ...next, id: e.id } : y)) }));
                          if (ok) setEditing(null);
                          return ok;
                        }}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={e.id}>
                    <th scope="row">{e.date}</th>
                    <td className="opt">{expenseLabel(e.category)}</td>
                    <td>{[e.maintenanceId ? titles.get(e.maintenanceId) : null, e.vendor, e.note].filter(Boolean).join(" · ") || <span className="mut">—</span>}</td>
                    <td>{usd(e.amount, { exact: true })}</td>
                    <td>
                      <span className="fee">
                        <button type="button" className="lnk" onClick={() => setEditing(e.id)}>Edit</button>
                        <button type="button" className="lnk danger" onClick={() => confirm("Delete this expense?") && setLedger((x) => ({ ...x, expenses: x.expenses.filter((y) => y.id !== e.id) }))}>Delete</button>
                      </span>
                    </td>
                  </tr>
                ),
              )}
              <tr className="s"><th scope="row">Total</th><td className="opt" /><td /><td>{usd(total, { exact: true })}</td><td /></tr>
            </tbody>
          </table>
        ) : (
          <p style={{ margin: "8px 0 0", color: "var(--ink-2)" }}>{filter === "all" ? "No expenses yet. Add one above, or mark a maintenance job done with its cost." : "Nothing in this category yet."}</p>
        )}
      </section>

      <section className="card" aria-labelledby="mt-h">
        <h2 className="disp" id="mt-h" style={{ margin: "0 0 12px", fontSize: 22 }}>Maintenance</h2>
        <form
          className="lf"
          onSubmit={(e) => {
            e.preventDefault();
            if (!mTitle.trim()) return;
            const item: Maintenance = { id: newId(), title: mTitle.trim(), openedDate: today, status: "open", ...(mEvery > 0 ? { recurring: { everyMonths: mEvery } } : {}) };
            if (setLedger((x) => ({ ...x, maintenance: [...x.maintenance, item] }))) {
              setMTitle("");
              setMEvery(0);
            }
          }}
        >
          <Field label="What needs doing"><input maxLength={60} value={mTitle} placeholder="e.g. Water heater leaking" onChange={(e) => setMTitle(e.target.value)} /></Field>
          <Field label="Repeats">
            <select value={mEvery} onChange={(e) => setMEvery(Number(e.target.value))}>
              <option value={0}>Once</option>
              <option value={1}>Every month</option>
              <option value={3}>Every 3 months</option>
              <option value={6}>Every 6 months</option>
              <option value={12}>Every year</option>
            </select>
          </Field>
          <div style={{ alignSelf: "end" }}>
            <button type="submit" className="btn btn-primary">Add item</button>
          </div>
        </form>
        {ledger.maintenance.length > 0 && (
          <ul className="mlist2">
            {[...ledger.maintenance].sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0) || b.openedDate.localeCompare(a.openedDate)).map((m) => {
              const due = nextDue(m);
              const cost = ledger.expenses.filter((e) => e.maintenanceId === m.id).reduce((s, e) => s + e.amount, 0);
              return (
                <li key={m.id}>
                  <div className="lch">
                    <span>
                      <b>{m.title}</b>{" "}
                      <Badge st={MSTATUS[m.status].st} label={MSTATUS[m.status].label} />
                    </span>
                    <span className="fee">
                      {m.status === "open" && (
                        <button type="button" className="lnk" onClick={() => setLedger((x) => ({ ...x, maintenance: x.maintenance.map((y) => (y.id === m.id ? { ...y, status: "in_progress" } : y)) }))}>Start</button>
                      )}
                      {(m.status !== "done" || m.recurring) && <button type="button" className="lnk" onClick={() => setClosing(m.id)}>Mark done + add cost</button>}
                      <button type="button" className="lnk danger" onClick={() => confirm(`Delete "${m.title}"? Its recorded costs stay as expenses.`) && setLedger((x) => ({ ...x, maintenance: x.maintenance.filter((y) => y.id !== m.id) }))}>Delete</button>
                    </span>
                  </div>
                  <p className="note num" style={{ margin: "4px 0 0" }}>
                    Opened {m.openedDate}
                    {m.doneDate && ` · done ${m.doneDate}`}
                    {cost > 0 && ` · cost ${usd(cost, { exact: true })}`}
                    {due && ` · repeats every ${m.recurring!.everyMonths} month${m.recurring!.everyMonths === 1 ? "" : "s"}, next due ${due}`}
                  </p>
                  {closing === m.id && (
                    <DoneForm
                      item={m}
                      today={today}
                      onCancel={() => setClosing(null)}
                      onSave={(doneDate, c) => {
                        const ok = setLedger((x) => ({
                          ...x,
                          maintenance: x.maintenance.map((y) => (y.id === m.id ? { ...y, status: "done", doneDate, openedDate: doneDate < y.openedDate ? doneDate : y.openedDate } : y)),
                          expenses: c ? [...x.expenses, { ...c, id: newId() }] : x.expenses,
                        }));
                        if (ok) setClosing(null);
                        return ok;
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
