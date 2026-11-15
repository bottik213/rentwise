# RentWise pitch: storyline, demo script, Q&A

5-minute pitch plus 2 minutes of Q&A; 10 slides at most. Every number is labeled **[sourced]** (with a source),
**[estimate]** (our assumption), or **[computed]** (produced by RentWise's own engine on the synthetic example).
We have run no user interviews, and we say so.

**Still needed from the team before submission:** the team names for slide 10.

## Slides

**1. Title.** RentWise. "Know the numbers before you buy. Know the truth after you buy." A browser tool for
first-time and small (1–5 property) U.S. rental investors. https://rentwise-gamma-three.vercel.app, with a QR
code. No sign-up.

**2. The user and the pain.** A 25–45-year-old buying a first or second long-term rental with a spreadsheet or a
free calculator.
- **Before buying:** one guess decides the deal. On our synthetic duplex, vacancy at 5% gives +$65.36/mo after
  reserves, and at 10% it gives −$47.34/mo [computed].
- **After buying:** the plan is never compared with reality, so "why is cash flow lower than I expected?" goes
  unanswered and the next deal repeats the same guesses.

**3. Why current tools fall short.** The tools we checked each cover one side [sourced: official pricing pages,
Nov 2026]:
- **Before purchase:** DealCheck (underwriting and a "Purchase Offer Calculator").
- **After purchase:** Stessa (bookkeeping and reports), Baselane (banking and bookkeeping), TurboTenant (listings,
  screening, leases, rent collection).

None of these four leads with comparing the plan you bought on against what actually happened.

**4. Product: one workflow.** Analyze and stress test → Project the hold (IRR) → Offer ceiling → Compare and
report → Track actuals → Explain variance. None of the steps is new on its own; they share one engine and one set
of assumptions.

**5. Demo moment.**
1. The example property: $65.36/mo after reserves, 10-year IRR 9.29% (before tax).
2. Vacancy to 10%: −$47.34/mo, IRR 7.96%. Back to 5%.
3. Min. cash-on-cash 8%: offer ceiling $176,884; "Cash-on-cash ≥ 8% is the binding limit; cash flow would allow
   $263,099."
4. A branded report: a PDF, or a link that carries the inputs only.
5. Mark as owned, record a surprise $1,800 repair: −$1,800.00, all of it repairs, to the cent.

All values [computed]. Plan-vs-actual chart on the slide.

**6. Why you can trust the numbers.** [sourced: our repo]
- Phase 1 reference: the spec's property asserted to the cent (cash flow after reserves $65.36/mo).
- 10-year reference: IRR 9.2883%, equity multiple 2.3038×, net sale proceeds $164,922.13, matching a calculation
  done independently from the written definitions.
- 120 unit tests; 105 end-to-end runs (21 tests × 5 browser setups) pass on the production URL.
- The offer ceiling's Phase 1 outputs were captured before it was extended and are locked in a test.
- Variance contributors sum exactly to the total. The explanation is rule-based, not AI.

**7. Why users come back.** Event-driven, not daily:
- weekly while shopping: one analysis per candidate deal, an offer ceiling before each offer, and the compare
  page next to the deals already saved;
- monthly while owning: a 5-minute "record this month", after which the variance explains itself.

One owned property means 12 check-ins a year.

**8. Monetization.**
- **What users pay for** [estimate; every price is a hypothesis and payments aren't built]:
  - **Free:** the full analysis.
  - **One-time report, $9–19:** a branded report for one deal, as a PDF and a link, for a lender or partner. The
    report is built and live; the price is what we'd test.
  - **Investor, $12/mo:** the shopping loop. Unlimited saved deals, comparisons, offer ceilings and reports.
  - **Landlord, $19/mo:** the owning loop. Locked plans, monthly actuals, variance history across properties.
- **Unit economics** [estimate]: $15 blended ARPU, 85% gross margin and 5% monthly churn give an LTV of about
  $255, so the maximum CAC at 3:1 is about $85.
- **$100M ARR** [estimate]: at a $15 blended ARPU that needs about 555,600 paying users, or 438,600 if everyone
  paid $19. This is an aspiration, not a forecast. The levers are mix shifting toward Landlord and paid reports.

**9. Competition and differentiation.** [sourced: official pricing pages, Nov 2026]

| Tool | What it leads with | Price |
|---|---|---|
| DealCheck | Underwriting, "Purchase Offer Calculator" | $0 / $10 / $20 per month |
| Stessa | Bookkeeping, reports; budgeting/pro-forma on Pro | Free; $12–28/mo annual ($15–35 monthly) |
| Baselane | Landlord banking and bookkeeping | $0; $20/mo annual |
| TurboTenant | Listings, screening, leases, rent collection | Free; from $12.42/mo ($149/yr) |

We don't claim any single feature is new: DealCheck already does projections, offer calculations, comparisons and
branded reports. Our claim is the connected loop: the plan you bought on becomes the
benchmark your actual months are explained against. The plans-plus-actuals history is the moat to build.

**10. Team, roadmap, close.**
- **Team:** three developers [names to add].
- **Roadmap:** a portfolio view, an optional AI explainer that reads computed numbers only, optional cloud sync
  (which would also make share links revocable), tax and depreciation estimates.
- **Close:** the tagline and the URL.

## 60-second demo script

**Step 0, before going on stage:** open a private window, or click "Clear my data", so no confirmation dialogs
appear. Rehearse on the production URL and time it.

1. **(0–8s)** Click "Try the example property". "A synthetic duplex: $250,000, renting for $2,450. $65 a month
   after reserves, and a 10-year IRR of 9.29 percent, before tax."
2. **(8–18s)** Type 10 into Vacancy. "Vacancy is a guess. At 10 percent every number recomputes: it loses $47 a
   month and the IRR drops to 7.96." Type 5 again.
3. **(18–30s)** Scroll to Offer ceiling and switch on "Min. cash-on-cash" (8%). "I want 8 percent cash-on-cash. The
   most I should pay is $176,884, and it says why: cash-on-cash is the binding limit; cash flow alone would allow
   $263,099."
4. **(30–40s)** Scroll up and click "Report". "One click gives a branded report for a lender or partner: a PDF, or
   a link that carries the inputs only and recalculates on their side." Go back to the analysis.
5. **(40–55s)** Click "Mark as owned". In "Repairs & maintenance" type 1996 and click "Add month". "I bought it.
   The first month brings a surprise $1,800 repair."
6. **(55–60s)** Point at the top card. "Cash flow is $1,800 below plan, and it says exactly why: repairs, to the
   cent. Know the numbers before you buy. Know the truth after."

## Q&A (two sentences each)

- **How is this different from DealCheck or Stessa?** DealCheck stops at the offer, and Stessa starts at the
  books. We connect the two, so the plan you bought on becomes the benchmark your actual months are explained
  against.
- **DealCheck already does projections and reports. Why you?** Because ours aren't separate tools: the projection
  feeds the offer ceiling, the ceiling is the plan you lock when you buy, and every actual month is explained
  against it, all with the same engine and the same assumptions in one flow. DealCheck's numbers stop at the
  purchase; ours keep working after it.
- **Why pay when free tools exist?** You pay to keep the history: every locked plan, its monthly actuals and the
  variance across properties. At $12–19 a month we're priced within the range of existing tools; this is a
  hypothesis we'd test first.
- **Why come back?** Weekly while shopping for deals, monthly while owning. We don't claim daily use.
- **How do you know the numbers are right?** All math is in integer cents, and the spec's reference case is
  tested to the cent, and so is a 10-year reference projection (IRR 9.2883%), among 120 unit tests. The end-to-end tests check hand-computed values on the live site in 5 browser setups, and variance contributors are asserted to sum exactly.
- **How is this $100M?** At a $15 blended price, $100M ARR means about 555,600 paying users. That's an aspiration,
  not a forecast, and it grows through mix shift to the Landlord tier and paid reports.
- **What's AI-powered?** Nothing in the numbers, on purpose: the explanation is deterministic. An optional AI
  explainer that only reads computed numbers is on the roadmap.
- **Why not a spreadsheet?** You can build this in a spreadsheet, if you build it, audit it and keep the plan
  linked to the actuals. We ship the tested model, the offer search and the reconciliation, ready on first use.
- **What did you deliberately not build?** Accounts, bank connections, tenant data, listings and scraping,
  valuations and tax advice. That was for privacy and focus: your data stays in your browser.
