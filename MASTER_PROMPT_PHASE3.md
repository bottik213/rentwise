# RENTWISE: MASTER PROMPT, PHASE 3 (LT Dynamics pilot: the landlord ledger)

# HOW TO USE
Keep `docs/MASTER_PROMPT.md` (Phase 1) and `docs/MASTER_PROMPT_PHASE2.md` in the repo. **All their rules still apply** (role, skills, competition rules, judging, never-fake, legal boundaries, regression locks, Playwright production checks, effort reminders, Opus + Fable advisor) unless this file overrides them. Phase 2's "STICK TO THE CURRENT DESIGN" section applies in full, with `docs/DESIGN_SYSTEM.md` as the source of truth.

# GOAL
Start the Landlord–Tenant (LT) Dynamics module with the slice that:
- needs **no partner, no tenant account, no login and no backend**
- makes the existing **EXPLAIN VARIANCE** step sharper by replacing monthly totals with real, dated entries that a variance contributor can point to ("Repairs −$1,800 ← Water heater replacement, Feb 12")
- gives owners a reason to come back **monthly** (Retention 20%; backs the "Landlord $19/mo" hypothesis)

Do NOT claim any of this is novel: Stessa, Landlord Studio, Avail and others track rent, expenses and maintenance. Our claim stays the connected workflow, so every entry flows into the plan-vs-actual variance.

# SCOPE: 5 PIECES (for properties marked "owned")
| # | Piece | Checklist IDs |
|---|---|---|
| L1 | Lease & rent roll | B15, B24 |
| L2 | Rent tracker (received / partial / late, late fees) | B20, B24 |
| L3 | Expense & maintenance log | B25, B47, B48 |
| L4 | "Coming up" panel (in-app reminders) | B15, B50 |
| L5 | Year summary + CSV export | B36, B42 |

STILL OUT (needs partners, tenant logins or legal review; roadmap slide only): online rent collection, tenant screening, tenant portal/messaging, eSignatures, lease templates, bank feeds, listings, receipt/document uploads, email/SMS reminders, owner portals, tax forms.

# NON-NEGOTIABLE RULES FOR THIS PHASE
- **No sensitive data.** Tenant = nickname only (e.g. "Unit A tenant"). No full names, phone, email, SSN, bank or card details, IDs or documents. Show a one-line note on the lease form saying so.
- **Deposits are not income.** A security deposit is a held liability: show it on the lease, never in income, cash flow or variance. Returning or applying a deposit is its own event; only the part applied to unpaid rent or damages becomes income, on the date it is applied.
- **Cash basis.** Actuals count money on the date it was actually received or paid, not when it was due. Rent due but unpaid is a receivable shown in the rent tracker, not income.
- **Late fees:** the landlord sets them per lease (flat $ or % of rent, grace days). Show the disclaimer "Late-fee rules vary by state and city; check yours". No legal validation; nothing is auto-charged to anyone, it's a ledger entry. Waivable per month.
- **No tax determinations.** The year summary is "Income & expenses by category, for your records/accountant". Never call it a Schedule E and never label anything deductible.
- **No double counting.** A month is either *ledger-driven* (actuals derived from entries) or *manual* (Phase 1 monthly totals), never both. Planned reserves are never actual expenses (Phase 1 rule).
- **Phase 1 + Phase 2 regression locks stay green**, unchanged.

# EXECUTION
1. Read the repo, the 3 prompts, `docs/DESIGN_SYSTEM.md`, `src/lib/finance/variance.ts`, `src/lib/storage.ts` and the current Actuals screen. List skills/tools available.
2. Report in ≤10 lines: how actuals and variance work today (categories, horizon, cash-flow definition), the storage migration needed, which existing components each piece reuses, top 3 risks. Consult the Fable advisor on the data model and the ledger → actuals → variance mapping before coding.
3. Build in the order below, deploying after each step. Ask me only for credentials, permission, a new dependency, or a change to an existing formula/output.

# DATA MODEL (`src/lib/finance/types.ts` + `src/lib/ledger/*`, pure TS, no React)
```
Lease        { id, dealId, tenantNickname, startDate, endDate|null, monthlyRent, dueDay(1–28),
               graceDays, lateFee: { kind: 'flat'|'percent', amount } | null,
               depositAmount, depositReceivedDate|null, status: 'active'|'ended' }
RentPayment  { id, leaseId, date, amount, forMonth: 'YYYY-MM', note? }
FeeWaiver    { leaseId, forMonth }
DepositEvent { id, leaseId, date, kind: 'returned'|'applied_to_rent'|'applied_to_damages', amount }
Expense      { id, dealId, date, category: <Phase 1 actuals category>, amount, vendor?, note?,
               maintenanceId? }
Maintenance  { id, dealId, title, openedDate, status: 'open'|'in_progress'|'done', doneDate?,
               recurring?: { everyMonths } }
MonthMode    { dealId, month: 'YYYY-MM', mode: 'ledger'|'manual' }
```
- Money in integer cents, dates as ISO `YYYY-MM-DD` strings (no timezone math). Inject `today` into every function that depends on it, for tests.
- Expense categories = exactly the Phase 1 actuals categories (taxes, insurance, utilities, HOA, repairs/maintenance, management, other operating, mortgage P&I paid, CapEx), so variance needs no new mapping.
- Late fees and the receivable are **derived**, not stored: for each lease-month, rent due by `dueDay + graceDays` minus payments for that month; if short at the end of grace and not waived → one fee charged for that month. **A fee becomes income only when a payment covers it.** Payments are applied to the oldest charges first (rent, then fee). Lock this order in a test.
- Storage: schema v(n+1). Existing Phase 1 monthly entries become `mode: 'manual'` months, with no data loss. Test the migration. "Clear my data" and JSON export/import cover the new entities (Zod-validated).

# LEDGER → ACTUALS → VARIANCE (`src/lib/ledger/to-actuals.ts`)
- For a ledger month: rent received = payments applied to rent; other income = fees collected + deposits applied (on the date applied); each expense category = sum of that month's expenses. The output is exactly the shape Phase 1 actuals already use, so `variance.ts` is reused unchanged.
- Every derived actual keeps references to its source entries. The variance UI lets each contributor expand to the entries behind it (date, vendor/title, amount). Contributors still sum **exactly** to the total variance (Phase 1 rule).

**Ledger reference test** (example property, forecast from Phase 1; 3 ledger months M1–M3; cents exact). Lease: rent 2,450, due day 1, grace 5, late fee flat $50, deposit 2,450 received M1.
- Payments: M1 2,450 on day 1 · M2 2,500 on day 9 (late: rent + fee) · M3 1,200 on day 3 + 1,250 on day 15 (late, fee not paid).
- Expenses: taxes 300/mo · insurance 160/mo · utilities 50/mo · repairs 120 (M1) + 1,800 water heater (M2) · management 0 · P&I paid = the engine's monthly P&I each month.

Expected:
| Check | Expected |
|---|---|
| Deposit in income / cash flow | 0 (shown on lease only) |
| Rent received (3 mo) | 7,350.00 |
| Other income: fees collected | 50.00 (M3 fee outstanding: receivable 50.00, not income) |
| Contributor: rent | +367.50 (7,350.00 vs forecast effective rent 3 × 2,327.50) |
| Contributor: other income | +50.00 |
| Contributor: repairs/maintenance | −1,332.00 (1,920.00 vs forecast 3 × 196.00) |
| Contributor: management | +558.60 (0 vs forecast 3 × 186.20) |
| Contributors: taxes, insurance, utilities, debt service | 0.00 each |
| Total variance in cash flow before CapEx | −355.90, and contributors sum to it exactly |
If Phase 1's variance definitions (horizon, categories, rounding) differ from these assumptions, keep Phase 1's, recompute this table by hand, and explain the difference in the PR. Don't bend the engine to the table.
Also test: no lease, lease ending mid-month (no rent due after end), overpayment (credit carried forward), payment before due date, waiver, deposit applied to rent, recurring maintenance next-due dates, a month switched from manual → ledger (no double count).

# SCREENS (inside the existing Actuals area; same shell, nav and components, no new nav pattern)
Add tabs to `/performance` for an owned property: **Overview** (existing variance + waterfall) · **Rent** · **Expenses & maintenance** · **Coming up** · **Year summary**. Keep the existing route so Phase 1/2 e2e tests still pass.
- **Rent (L1 + L2):** lease card (rent, dates, due day, grace, late fee, deposit held). Month grid with a status per month: paid · partial · late · unpaid · upcoming, using existing badge styles. Quick "Record payment" (amount pre-filled, date defaults to today). Receivable total. Waive-fee action.
- **Expenses & maintenance (L3):** one list of dated expenses (filter by category). Maintenance items with status. "Mark done + add cost" creates the linked expense in one step. Recurring items (e.g. HVAC service every 6 months).
- **Coming up (L4):** rent due/overdue, lease ending within 60 days, recurring maintenance due, open maintenance older than 14 days. In-app only. Designed empty state ("Nothing due in the next 30 days").
- **Year summary (L5):** income & expenses by category for a calendar year, with ledger and manual months combined (marked which is which), and CSV export. The deposit held is shown separately as "held, not income".
- **Overview:** variance contributors expand to their source entries (the key demo moment). A per-month toggle: "Use ledger" / "Enter totals manually".
- Example property: add a clearly labeled **synthetic** ledger (dates relative to `today`) so a juror sees a populated state immediately, plus a designed empty state for real properties.
- Reuse existing forms, tables, badges, cards, number animation and chart styles. Actual = the existing *actual* style. Run the Phase 2 consistency check after each screen.

# BUILD ORDER (deploy + Playwright MCP prod check after each)
| Step | Work | Effort |
|---|---|---|
| 1 | Types + ledger engine (fees, receivable, payment application, deposits) + tests | High |
| 2 | to-actuals + variance source references + ledger reference test (Fable review once green) | High |
| 3 | Storage migration + MonthMode + export/import (tests) | High |
| 4 | Rent tab (L1 + L2) → deploy | Medium |
| 5 | Expenses & maintenance tab (L3) + Overview drill-down → deploy | Medium |
| 6 | Coming up (L4) + synthetic example ledger → deploy | Medium |
| 7 | Year summary + CSV (L5) → deploy | Medium |
| 8 | /impeccable consistency pass, /emil-design-eng (existing motion only), e2e, /ponytail:ponytail-review, README + deck | Medium |
If time is short, cut in this order: year summary CSV → Coming up → recurring maintenance → automatic late fees (make them a manual "other income" entry). Never cut the ledger → variance reconciliation, the deposit rule or the migration.

# PLAYWRIGHT E2E (tests/e2e, run on the PRODUCTION URL, 1440px + 390px, no console errors)
Example property → mark owned → add lease (deposit 2,450) → record M1 on time, M2 late (fee appears) → log maintenance "Water heater" done + $1,800 → Overview waterfall: repairs contributor expands to "Water heater … $1,800" → contributors sum to the total → deposit not in income → refresh: all data persists → switch one month to manual: no double count → CSV downloads.

# UPDATE THE PITCH & README
- README: the LT Dynamics pilot, the data model, the cash-basis/deposit/late-fee rules, the ledger reference table, the migration note, and what's deliberately out (and why).
- Deck: slide 4 workflow (add Rent + Expenses feeding Explain Variance) · slide 7 retention (monthly: record rent, log repairs) · slide 10 roadmap (rent collection, screening, tenant portal, bank feeds: all partner-dependent, so not faked).
- 60-second demo: … mark owned → record February rent as late (fee appears) → log the $1,800 water heater → waterfall's repairs bar expands to that exact entry.
- New Q&A: "Why not collect rent online?" → it needs a payment partner and tenant accounts, and the competition requires no login; we built the ledger every payment method ends up in, and integrations come next. "Is a manual ledger enough?" → small landlords log a few entries a month; each one explains the variance.

Success = a juror marks the example property owned, records a late rent payment and a repair, and the variance waterfall points to the exact entries behind each dollar. Contributors sum exactly, deposits never count as income, it works live with no login, and it looks like the same product.
