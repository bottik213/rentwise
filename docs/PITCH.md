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

**4. Product: one workflow.** Analyze → Stress test → Offer ceiling → Track actuals → Explain variance. Analysis
screenshot (16:9).

**5. Demo moment.**
1. The example property: $65.36/mo after reserves.
2. Raise vacancy, and the numbers animate down.
3. Back to 5%. Set a minimum of $200/mo: offer ceiling $223,017, $26,983 below asking.
4. Mark as owned, then record the first month with a surprise $1,800 repair.
5. Plan $187.86, actual −$1,612.14: −$1,800.00, all of it repairs, to the cent.

All values [computed]. Plan-vs-actual chart on the slide.

**6. Why you can trust the numbers.** [sourced: our repo]
- The integer-cent engine and the spec's reference case are asserted to the cent: 54 unit tests in total.
- 80 end-to-end runs (16 tests × 5 browser setups) pass on the production URL, with hand-computed expected values.
- Variance contributors sum exactly to the total.
- The offer ceiling discloses what it holds constant.
- The explanation is rule-based, not AI.

**7. Why users come back.** Event-driven, not daily:
- weekly while shopping: one analysis per candidate deal, plus an offer ceiling before each offer;
- monthly while owning: a 5-minute "record this month", after which the variance explains itself.

One owned property means 12 check-ins a year.

**8. Monetization.**
- **What users pay for** [estimate; pricing is a hypothesis, not built yet]:
  - **Free:** one property, the full analysis.
  - **Investor, $12/mo:** the shopping loop. Unlimited analyses, saved deals, offer ceilings, PDF deal reports.
  - **Landlord, $19/mo:** the owning loop. Locked plans, monthly actuals, variance history across properties.
  - **One-time report:** $9–19.
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

We don't claim any single feature is new. Our claim is the connected loop: the plan you bought on becomes the
benchmark your actual months are explained against. The plans-plus-actuals history is the moat to build.

**10. Team, roadmap, close.**
- **Team:** three developers [names to add].
- **Roadmap:** portfolio view, lender-ready PDF report, an optional AI explainer that reads computed numbers only,
  optional cloud sync.
- **Close:** the tagline and the URL.

## 60-second demo script

**Step 0, before going on stage:** open a private window, or click "Clear my data", so no confirmation dialogs
appear. Rehearse on the production URL and time it.

1. **(0–10s)** Click "Try the example property". "A synthetic duplex: $250,000, renting for $2,450. RentWise says
   $65 a month after reserves. Thin, but positive."
2. **(10–20s)** Type 10 into Vacancy. "Vacancy is a guess. At 10%, every number recomputes and it loses $47 a
   month. One assumption is the deal." Type 5 again.
3. **(20–35s)** Scroll to Offer ceiling and type 200. "I want at least $200 a month. The most I should pay is
   $223,017, which is $26,983 under asking. It shows what limits it and what it holds constant."
4. **(35–50s)** Click "Mark as owned". In "Repairs & maintenance" type 1996 and click "Add month". "I bought
   it. The first month brings a surprise $1,800 repair."
5. **(50–60s)** Point at the top card. "Cash flow is $1,800 below plan, and it says exactly why: repairs. Planned
   $187.86, actual −$1,612.14, and the table adds up to the cent. Know the numbers before you buy. Know the truth
   after."

## Q&A (two sentences each)

- **How is this different from DealCheck or Stessa?** DealCheck stops at the offer, and Stessa starts at the
  books. We connect the two, so the plan you bought on becomes the benchmark your actual months are explained
  against.
- **Why pay when free tools exist?** You pay to keep the history: every locked plan, its monthly actuals and the
  variance across properties. At $12–19 a month we're priced within the range of existing tools; this is a
  hypothesis we'd test first.
- **Why come back?** Weekly while shopping for deals, monthly while owning. We don't claim daily use.
- **How do you know the numbers are right?** All math is in integer cents, and the spec's reference case is
  tested to the cent among 54 unit tests. The end-to-end tests check hand-computed values on the live site in 5 browser setups, and variance contributors are asserted to sum exactly.
- **How is this $100M?** At a $15 blended price, $100M ARR means about 555,600 paying users. That's an aspiration,
  not a forecast, and it grows through mix shift to the Landlord tier and paid reports.
- **What's AI-powered?** Nothing in the numbers, on purpose: the explanation is deterministic. An optional AI
  explainer that only reads computed numbers is on the roadmap.
- **Why not a spreadsheet?** You can build this in a spreadsheet, if you build it, audit it and keep the plan
  linked to the actuals. We ship the tested model, the offer search and the reconciliation, ready on first use.
- **What did you deliberately not build?** Accounts, bank connections, tenant data, listings and scraping,
  valuations and tax advice. That was for privacy and focus: your data stays in your browser.
