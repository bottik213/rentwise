# RentWise design system (as shipped)

Taken from the code (`src/app/globals.css`, page CSS, `src/components/*`) and production screenshots at 1440px and 390px.
No Figma file exists; the code is the source of truth. New screens use only what is listed here.

## Color roles (tokens in `globals.css`, light + dark)
| Role | Token | Use |
|---|---|---|
| Surfaces | `--paper` page, `--card` cards, `--sunk` wells, `--line` / `--line-2` borders | |
| Text | `--ink`, `--ink-2` secondary, `--muted` captions | |
| Brand / primary action | `--spruce` (+ `-hi`, `-tint`, `--on-spruce`) | Primary buttons, links, active nav, verdict panel (`--verdict`) |
| Call to action (one per page) | `--brick` (+ `-hi`, `--on-brick`) | "Analyze a property", "Save and view analysis" |
| Data | `--data` | Actual values (bars), sensitivity bars |
| Forecast / plan | dashed `--ink` stroke, 2px | Plan line on Actuals; every projected series (F1, F3) |
| Deductions | `--deduct` | Cost steps in the rent waterfall |
| Status | `--good`, `--warn`, `--bad` (+ `-bg`) | Only good / warning / bad, always with icon + word (`Badge`) |
| Positive / negative numbers | `.pos` / `.neg` | Signed money |
| Infeasible | `.big.neg` "No price works" + one sentence naming the failing target | Offer ceiling |
| Synthetic | `.tag` "Synthetic example" in the page subtitle | Example data |
| Deal series (F3) | Pending: 4 tokens derived from the palette, checked with the dataviz validator before use | Compare chart only, always with direct labels |

## Type
- Display: Archivo, width 112, 700 (`.disp`): h1 36–44px, section h2 28px (`.shead h2`), card h2 22px.
- Body: Public Sans 16px / 1.5. UI text 15px, captions 14px (`.note`), small 13px, tags 13px.
- Big numbers: `MetricCard` value; headline sentence `.verdict .big`.
- Every number uses `.num` (tabular, lining figures). Minus is the true sign "−" (`usd()`, `pct()`).

## Space, shape, depth
- Spacing steps: 4, 8, 12, 16, 24, 32, 48, 64.
- Radius: 12 cards, 8 buttons / inputs / bubbles, 6 tags / badges, 4 bars, 16 icon buttons.
- One shadow token `--shadow`; cards use `1px --line` borders, not heavy shadows.

## Components to reuse
- Card: `.card` (white, 1px line, 12px radius, 24px padding). Section head: `.shead` (h2 + one-line `p`).
- Metric tile: `MetricCard` (value, badge, delta, tap/hover explainer). Small: `MetricCard small`.
- Key/value block: `dl.ocs` (offer ceiling "At the ceiling price").
- Table: `table.ct` (right-aligned numbers, first column left, `tr.s` total row, `td.mut` plan column).
- Fields: `NumberField` (label, ⓘ help, source select, unit, inline error), `.chk` checkbox, `.sw` switch row `.tgr`.
- Buttons: `.btn` + `-primary` / `-cta` / `-quiet`, `-sm` / `-lg`; text button `.lnk` (`.danger`).
- Badges: `Badge` with `StatusIcon`. Chips: `.chip` ("Limited by …").
- Edit-in-place details: `details.x` with chevron ("Edit scenario assumptions").

## Charts (plain HTML/CSS + SVG; Recharts was removed with the redesign)
- Frame: `.legend` row, `.ch` grid (y-axis `.ya` 64px + `.plot`), gridlines `.gl` (`.zero` darker), x labels `.xa`.
- Y ticks on a 1-2-5 step; money labels `usd()`.
- Actual: solid `--data` bar, 4px top radius, value label above. Plan / forecast: 2px dashed `--ink`.
- Tooltip: `.pop` bubble on hover, focus or tap (`useTapTip`); every chart also has a full `aria-label` sentence.
- One y-axis only. Two measures of different scale get two charts.

## Motion
- Numbers: `AnimatedNumber`, ease-out cubic, 450ms (900ms first count-up); retargets mid-tween.
- Enter: bars grow 600ms `--ease-out`; state swaps fade in (remount with `key`). Press: `.btn:active` scale.
- Easing tokens `--ease-out`, `--ease-drawer`. Reduced motion: numbers jump, animations off.

## States
- Empty: centered `.empty` block, h1 + one sentence + primary and quiet buttons.
- Loading: `PageSkeleton` (pulse). Storage errors: `StorageNotice` alert with retry.
- Infeasible: see color roles. Invalid input: red `.inp.err` border + `.ferr` text, value not committed.

## Copy
- Plain, second person, short sentences; numbers in the sentence ("about $65 a month").
- Every estimate is labeled ("Illustrative adjustments, not forecasts"); assumptions carry a source label
  (Estimate / From listing / From a bill / From a quote / From a document).
- Disclaimer in each page footer: modeling tool, not financial / tax / legal advice; nothing is guaranteed.
