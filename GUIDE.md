# RentWise user guide

This guide explains every input in RentWise: what it means, what you can enter, what it changes, and a worked
example. Examples use the **synthetic example property** ("Try the example property" on the landing page): a
$250,000 duplex renting for $2,450/mo.

> RentWise is financial modeling and education only. It is not investment, legal, mortgage or tax advice. Every
> result depends on the assumptions you enter.

**Contents**

1. [How to enter numbers](#1-how-to-enter-numbers)
2. [Inputs screen](#2-inputs-screen)
3. [Analysis screen](#3-analysis-screen)
4. [Actuals screen](#4-actuals-screen)
5. [Your data](#5-your-data)
6. [Glossary of results](#6-glossary-of-results)

---

## 1. How to enter numbers

- **Money** is entered in dollars. You can type `250000`, `250,000` or `$250,000`; cents are allowed (`1247.44`).
- **Percentages** are plain numbers: type `5` for 5%, not `0.05`.
- **Units are shown inside each field**: `/mo` is per month, `/yr` is per year, `% of rent`, `% of price`, and so
  on. Annual amounts (property tax, insurance) are divided by 12 for monthly figures.
- **Invalid entries** turn the field red and show what's allowed ("Between 0 and 100"). The last valid value stays
  in use until you fix the entry, so a typo never breaks the numbers.
- **Prefilled percentages are illustrative assumptions, not local market data.** Replace them with your own numbers.

---

## 2. Inputs screen

Reached from **Analyze a property** on the landing page, or **Inputs** in the top navigation. Submitting the form
opens the Analysis screen.

If a property already exists, the form edits it. **Start a blank property** begins a new one. Analyzing the new
property replaces the old one, its plan and its recorded months. If you have recorded months, it asks first.

### 2.1 Property

| Input | Unit | Allowed | What it is | What it changes |
|---|---|---|---|---|
| **Nickname** (optional) | text | up to 60 characters | A name for the property, e.g. "Maple St duplex". | Page titles only. No effect on any number. |
| **Purchase price** | $ | $1,000 – $100,000,000 | The asking or expected price. | Loan amount, down payment, %-based closing costs, cap rate, cash invested. Also the "asking price" the offer ceiling compares against. |
| **Scheduled rent** | $/mo | $0 – $1,000,000 | Full monthly rent for all units, **before** vacancy. | Effective rent, maintenance, CapEx reserve and management, and through them every cash-flow result. |
| **Other income** | $/mo | $0 – $1,000,000 | Parking, laundry, storage, pet fees. **Security deposits are not income**; they belong to the tenant. | Added to income and NOI. Not reduced by vacancy. |

### 2.2 Financing

| Input | Unit | Allowed | What it is | What it changes |
|---|---|---|---|---|
| **All-cash purchase** | checkbox | on / off | You pay the full price with no mortgage. | When on: down payment = full price, loan = $0, P&I = $0. The interest rate and loan term are ignored. |
| **Down payment** | % of price | 0 – 100 | The share of the price you pay in cash at purchase. | Down payment = price × %; loan = price − down payment. Both feed P&I and cash invested. |
| **Interest rate** | %/yr | 0 – 30 | The annual mortgage rate, assumed fixed for the full term. | Monthly P&I. A 0% rate is handled (loan ÷ months). |
| **Loan term** | years | 1 – 40, whole years | The fully amortizing term, usually 30. | Monthly P&I. A shorter term means a higher payment. |

**Monthly P&I formula:** `P&I = L·r / (1 − (1 + r)^−n)`, where L is the loan, r is the annual rate ÷ 12, and n is
years × 12.

**Example:** $250,000 × 25% = $62,500 down → loan $187,500 → at 7% over 30 years, P&I = **$1,247.44/mo**.

### 2.3 Acquisition (one-time cash)

These are paid once at purchase. They count toward **total cash invested**, which drives cash-on-cash. They are
never monthly expenses.

| Input | Unit | Allowed | What it is | What it changes |
|---|---|---|---|---|
| **Closing costs** | % of price **or** $ | 0 – 20% or $0 – $10,000,000 | Lender, title, escrow and recording fees. 2–5% is common. Use the **% / $** toggle under the field to switch units; the value converts automatically. | Cash invested. In % mode it also changes when the price changes, including inside the offer-ceiling search. |
| **Initial repairs** | $ | $0 – $10,000,000 | Work needed before the first tenant moves in. | Cash invested. |
| **Cash reserve** | $ | $0 – $10,000,000 | Cash you set aside at purchase for surprises. | Cash invested. It is money you still hold, never an expense. |

**Example:** $62,500 down + $7,500 closing (3%) + $5,000 repairs + $10,000 reserve = **$85,000 cash invested**.

### 2.4 Recurring costs (fixed)

These don't change with rent.

| Input | Unit | Allowed | What it is | What it changes |
|---|---|---|---|---|
| **Property tax** | $/yr | $0 – $10,000,000 | The annual property tax. Check the county record: it often resets to the new purchase price after a sale. | Operating expenses (÷ 12 per month). |
| **Insurance** | $/yr | $0 – $10,000,000 | A landlord (dwelling) policy, not a homeowner's policy. | Operating expenses (÷ 12). |
| **HOA** | $/mo | $0 – $1,000,000 | Association dues, if any. | Operating expenses. |
| **Utilities you pay** | $/mo | $0 – $1,000,000 | Only the utilities the landlord pays (often water, sewer, trash). | Operating expenses. |
| **Other fixed costs** | $/mo | $0 – $1,000,000 | Lawn care, snow removal, software, rental licensing. | Operating expenses. |

**Example:** $3,600/yr tax → $300/mo; $1,920/yr insurance → $160/mo; utilities $50/mo.

### 2.5 Variable costs (scale with rent)

| Input | Unit | Allowed | What it is | What it changes |
|---|---|---|---|---|
| **Vacancy** | % of rent | 0 – 100 | Rent lost while units sit empty or tenants don't pay. 5% ≈ 2.5 weeks empty per year. | Effective rent = scheduled rent × (1 − vacancy). |
| **Maintenance** | % of rent | 0 – 100 | Routine repairs and upkeep (leaks, appliances, turnover). | Operating expenses = scheduled rent × %. |
| **Management** | % of collected rent | 0 – 100 | The property manager's fee. Use 0% if you self-manage. | Operating expenses = **effective** rent × % (managers are paid on rent collected). |
| **CapEx reserve** | % of rent | 0 – 100 | Money set aside each month for big replacements: roof, HVAC, water heater. | Subtracted to get **cash flow after reserves**. It is planned savings, not an operating expense, so it does **not** reduce NOI. |

**Example:**
- Vacancy 5% of $2,450 = $122.50 → effective rent **$2,327.50**.
- Maintenance 8% of $2,450 = **$196.00**.
- Management 8% of $2,327.50 = **$186.20**.
- CapEx reserve 5% of $2,450 = **$122.50**.

### 2.6 Source labels

Key fields have a small **estimate ⌄** selector next to the label. It records where the number came from:

| Source | Use it when the number comes from… |
|---|---|
| estimate | your own guess or a rule of thumb (the default) |
| listing | the property listing or county record |
| bill | a real bill (insurance, utilities, tax) |
| quote | a written quote (insurer, contractor, manager) |
| document | a lease, inspection report, HOA statement or other document |

Source labels don't change any number. They feed the **sensitivity** section: if one of your three biggest
cash-flow drivers is still marked "estimate", RentWise tells you to confirm it before making an offer.

---

## 3. Analysis screen

Reached with **Analysis** in the navigation. Everything recalculates instantly, and changed numbers animate
briefly (or jump straight to the new value if your device has reduced motion turned on).

### 3.1 Header buttons

| Button | What it does |
|---|---|
| **All inputs** | Opens the full Inputs form. |
| **Mark as owned** | Locks a snapshot of the current inputs as **the plan** and opens the Actuals screen. Later edits to the analysis don't change a locked plan. If a plan with recorded months already exists, the button reads **Re-lock plan and track actuals** and asks before replacing the plan. Your recorded months are kept and compared against the new plan. |

### 3.2 Quick assumptions (left sidebar)

Nine of the most influential inputs, editable without leaving the page: purchase price, scheduled rent, vacancy,
interest rate (disabled for all-cash), insurance, property tax, maintenance, management and CapEx reserve. They
behave exactly as described in [section 2](#2-inputs-screen), and every number on the page updates as you type.

**Try it:** change vacancy from 5 to 10. Cash flow after reserves drops from $65.36 to −$47.34/mo.

### 3.3 Scenarios

A table that stress-tests your inputs with three cases side by side. **Base** is always exactly your inputs.
**Conservative** and **Optimistic** apply the adjustments below on top of them, and each is editable.

| Adjustment | Unit | Allowed | What it does | Conservative default | Optimistic default |
|---|---|---|---|---|---|
| **Rent** | % change | −100 to +100 | Scales scheduled rent. | −5% | +3% |
| **Vacancy** | percentage points | −100 to +100 | Adds to your vacancy rate (+3 pts turns 5% into 8%). | +3 pts | −2 pts |
| **Maintenance** | percentage points | −100 to +100 | Adds to your maintenance rate. | +2 pts | −1 pt |
| **CapEx reserve** | percentage points | −100 to +100 | Adds to your CapEx rate. | +3 pts | −1 pt |
| **Fixed costs** | % change | −100 to +500 | Scales property tax, insurance, HOA, utilities and other fixed costs together. | +10% | 0% |

Rates are kept between 0% and 100% after an adjustment. Financing and acquisition costs don't change between
scenarios. The rows underneath show each scenario's cash flow after reserves, cash-on-cash and NOI. For the
example, that's −$257.39 (conservative), $65.36 (base) and $216.95/mo (optimistic).

These defaults are illustrative, not forecasts.

### 3.4 Offer ceiling

Finds the **highest purchase price that still meets every target you switch on**: an "offer ceiling under your
assumptions". It is not an appraisal, a safe price or a recommendation to buy.

| Target | Unit | Allowed | Meaning |
|---|---|---|---|
| **Min. cash flow after reserves** | $/mo | −$100,000 to $1,000,000 | Cash flow after reserves must be at least this much. On by default at $0. Ticking it on starts at $200. |
| **Min. cash-on-cash** | %/yr | 0 – 100 | Annual cash-on-cash must be at least this. Ticking it on starts at 8%. |
| **Max. upfront cash** | $ | $0 – $100,000,000 | Total cash invested must be at most this. Ticking it on starts at $100,000. |
| **Must also pass the conservative scenario** | checkbox | on / off | The price must meet your targets in the conservative scenario as well as the base case. |

Tick a checkbox to switch a target on; untick it to ignore that target.

**How it's computed:** RentWise tries prices from $1 up to max(4 × asking, $2M), narrowing in to the nearest $1.
At every candidate price it recomputes the loan, down payment and percentage closing costs. **Rent, property tax
and insurance stay at your inputs.**

**What you can see:**

| State | Meaning |
|---|---|
| A price, e.g. **$223,017** | The ceiling. It shows the difference vs. asking (e.g. −$26,983), which target limits it, and cash flow, cash-on-cash, cash invested and P&I at that price. |
| **No price works** | Even at $1 a target fails, usually because rent can't cover operating costs. It names the failing target. |
| **Not limited by your targets** | Every price up to the search limit meets them (common for all-cash purchases). Tighten or add a target. |
| Turn on at least one target | No targets are switched on. |

**Example:** min. cash flow $200/mo → ceiling **$223,017**, $26,983 below the $250,000 asking price, limited by
minimum cash flow.

### 3.5 What moves cash flow most (sensitivity)

There are no inputs here. RentWise changes **one assumption at a time** by a fixed, realistic amount, recomputes
everything, and ranks the effect on **annual** cash flow after reserves. No probabilities are implied.

| Shock | Example effect |
|---|---|
| Interest rate +1 pt | −$1,540/yr |
| Vacancy +5 pts | −$1,352/yr |
| Insurance +$100/mo | −$1,200/yr |
| Rent −$100/mo | −$893/yr |
| HOA +$50/mo, Utilities +$50/mo | −$600/yr each |
| Maintenance, CapEx, Management +2 pts | about −$560 to −$590/yr each |
| Property tax +10% | −$360/yr |

The interest-rate shock is left out for all-cash purchases. An **estimate** tag marks assumptions not yet backed
by a listing, bill, quote or document.

---

## 4. Actuals screen

Reached with **Actuals** in the navigation, after **Mark as owned**. Without a locked plan, it explains how to
create one.

### 4.1 Record a month

The form is **prefilled with the plan's monthly forecast**. Overwrite only what actually happened, then click
**Add month**.

| Input | What to enter |
|---|---|
| **Month** | The calendar month this entry covers. It defaults to the month after your last entry (or the month you locked the plan). Saving a month that already exists **replaces** it; it is never counted twice. |
| **Rent received** | Rent actually collected that month. **Leave out security deposits**: they are not income. Forecast = effective rent. |
| **Other income** | Other income actually collected. |
| **Property tax** | Tax actually paid that month (enter the full amount in the month you paid it, or 1/12 if you escrow). |
| **Insurance** | Premium actually paid. |
| **Utilities** | Landlord-paid utilities actually paid. |
| **HOA** | Dues actually paid. |
| **Repairs & maintenance** | What you actually spent on routine repairs. |
| **Management** | Manager fees actually paid. |
| **Other operating** | Other fixed costs actually paid (lawn, snow, software, licensing). |
| **Mortgage P&I** | Principal and interest actually paid. Leave out escrowed tax and insurance here; enter them in their own fields so nothing is counted twice. |
| **CapEx spent** | Spending on big replacements (roof, HVAC, water heater). It is compared with your planned reserve **separately** and never mixed into cash flow. |

All amounts are dollars from $0 to $1,000,000. **Reset** discards unsaved changes, and **Save changes** appears
when you're editing an existing month.

### 4.2 Recorded months

Each recorded month has **Edit** (loads it into the form) and **Delete** (asks first).

### 4.3 What the results show

| Section | Meaning |
|---|---|
| **Forecast vs. actual** tiles | Rent received, operating costs and cash flow before CapEx over the recorded months. Forecast labels are gold-brown; actuals turn blue when better than plan and red when worse. |
| **Total variance** | Actual minus forecast cash flow before CapEx, over the same months, using the same definition. |
| **Why cash flow differs from plan** | A waterfall chart: the forecast bar (gold hatch), then one bar per category that moved (blue = better, red = worse), ending at the actual bar (black). |
| Plain-English explanation | A rule-based summary of the biggest drivers and the CapEx comparison. No AI is involved. |
| **Contributors** table | Forecast, actual and effect on cash flow for every category. The rows **add up exactly** to the total variance. Positive means better than plan. |
| **CapEx, kept separate** | CapEx spent vs. the reserve you planned to set aside over the same months. |

**Example:** record one month exactly on plan, then a second month with repairs of **$1,996** instead of the
forecast $196. Total variance is **−$1,800.00**, and the whole difference is attributed to repairs and maintenance.

---

## 5. Your data

| Control | What it does |
|---|---|
| **Export my data (JSON)** | Downloads everything (property, plan, scenarios, targets, months) as `rentwise-data.json`. |
| **Clear my data** | Permanently deletes everything stored in this browser, after asking. |

- Data is saved automatically in **this browser only** (localStorage). There is no account, server or bank
  connection, and nothing is uploaded.
- Clearing your browser's site data or switching browsers or devices starts fresh, so export to keep a copy.
- Loading the example property asks before replacing your own property or any recorded months. An untouched example
  with no months is reset without asking. Saving the full Inputs form makes the property yours: the "Synthetic
  example" label goes away.

---

## 6. Glossary of results

| Result | Definition | Example |
|---|---|---|
| Gross scheduled rent | Monthly rent before vacancy | $2,450.00 |
| Effective rent | Rent × (1 − vacancy) | $2,327.50 |
| Operating expenses | Tax/12 + insurance/12 + HOA + utilities + other fixed + maintenance + management | $892.20 |
| NOI (net operating income) | Effective rent + other income − operating expenses. Excludes the mortgage, CapEx reserve and income tax. | $1,435.30 |
| Monthly P&I | Mortgage principal and interest | $1,247.44 |
| Cash flow before CapEx | NOI − P&I | $187.86 |
| Cash flow after reserves | Cash flow before CapEx − CapEx reserve | $65.36 |
| Total cash invested | Down payment + closing costs + initial repairs + cash reserve | $85,000 |
| Cap rate | Annual NOI ÷ price | 6.89% |
| Cash-on-cash | Annual cash flow after reserves ÷ cash invested | 0.92% |
| Break-even rent | The rent at which cash flow after reserves is $0 | $2,362/mo |

All calculations use whole cents, and every total on screen is the exact sum of the lines above it.
