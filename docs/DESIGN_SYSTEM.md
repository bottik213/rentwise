# RentWise design system (KZ)

Taken from the code (`src/app/globals.css`, page CSS, `src/components/*`) and production screenshots at 1440px and 390px.
No Figma file exists; the code is the source of truth. New screens use only what is listed here.

## Color roles (tokens in `globals.css`, light + dark)
| Role | Token | Use |
|---|---|---|
| Surfaces | `--paper` page, `--card` cards, `--sunk` wells, `--line` / `--line-2` dividers and decorative borders, `--field` form-field borders (3:1, since the border is the only outline of an input) | |
| Text | `--ink`, `--ink-2` secondary, `--muted` captions | |
| Brand / primary action | `--brand` steppe-sky blue (+ `-hi`, `-tint`, `--on-brand`) | Primary buttons, links, active nav, verdict panel (`--verdict`) |
| Call to action (one per page) | `--cta` gold (+ `-hi`, `--on-cta`) | The one CTA per page (WhatsApp, start the calculator). Always dark `--on-cta` text on gold; gold is never a text color (asserted in `tests/finance/palette.test.ts`) |
| Data | `--data` violet | Actual values (bars), sensitivity bars. Must differ from the brand blue |
| Forecast / plan | dashed `--ink` stroke, 2px | Plan line on Actuals; every projected series (F1, F3) |
| Deductions | `--deduct` | Cost steps in the rent waterfall |
| Status | `--good`, `--warn`, `--bad` (+ `-bg`) | Only good / warning / bad, always with icon + word (`Badge`) |
| Positive / negative numbers | `.pos` / `.neg` | Signed money |
| Infeasible | `.big.neg` "No price works" + one sentence naming the failing target | Offer ceiling |
| Synthetic | `.tag` "Synthetic example" in the page subtitle | Example data |
| Chart series | `--series-1..4` in fixed order: `--data` violet, gold, sky blue, green at chart lightness. Light `#6b4fc8 #b87a00 #1a7fc0 #26985e`, dark `#8c74e3 #c4851a #3b9ad6 #30a86e`. Gold sits between violet and blue because violet↔blue fails the deutan check when adjacent. The dataviz validator passes every check (lightness band, chroma, CVD ≥ 8, normal-vision ≥ 15, 3:1 contrast) on `--card` in both modes; lines still carry direct labels | Compare / portfolio chart only |

### Palette (light / dark)
| Token | Light | Dark |
|---|---|---|
| `--paper` / `--card` / `--sunk` | `#f4f6f7` / `#ffffff` / `#eaeff1` | `#0f1519` / `#172026` / `#0b1014` |
| `--line` / `--line-2` | `#d5dde1` / `#bcc7cd` | `#26323a` / `#34424b` |
| `--field` (input, select and segmented-control borders) | `#7d8b94` | `#64767f` |
| `--ink` / `--ink-2` / `--muted` | `#13212b` / `#3e4c56` / `#56646e` | `#eef3f5` / `#c7d1d6` / `#a3afb6` |
| `--brand` / `-hi` / `-tint` / `--on-brand` | `#0b5c7a` / `#084860` / `#e1f0f5` / `#ffffff` | `#6cc3e0` / `#8ed2ea` / `#15303b` / `#0f1519` |
| `--verdict` / `--verdict-ink` | `#0b3f55` / `#eef3f5` | `#15303b` / `#eef3f5` |
| `--cta` / `-hi` / `--on-cta` | `#f2b33d` / `#d99a1f` / `#13212b` | `#f5c25a` / `#f8d07a` / `#13212b` |
| `--data` | `#6b4fc8` | `#8c74e3` (the brief's `#a08bea` is too light for the dark chart band) |
| `--deduct` | `#7b8890` | `#7b878f` |
| `--good` / `--warn` / `--bad` | unchanged | unchanged |

Every text pair passes 4.5:1 and every mark 3:1 in both modes; `tests/finance/palette.test.ts` reads the values from `globals.css` and asserts it.
The test checks contrast only. After changing any `--series-*` or `--data` hex, re-run the dataviz skill's validator (`scripts/validate_palette.js`) in fixed order:
`node validate_palette.js "#6b4fc8,#b87a00,#1a7fc0,#26985e" --mode light --surface "#ffffff"` and
`node validate_palette.js "#8c74e3,#c4851a,#3b9ad6,#30a86e" --mode dark --surface "#172026"`.
The report's custom accent is `--accent` (it overrides `--brand` in the light theme and print only).

## Type
- One family: **Onest** (variable 100–900, `next/font`, subsets `latin`, `cyrillic`, `cyrillic-ext`). Built for Cyrillic and covers every Kazakh letter (ә ғ қ ң ө ұ ү һ і); checked by `tests/e2e/fonts.spec.ts`, screenshot `docs/screenshots/kazakh-glyphs.png`.
- Display: Onest 700 (`.disp`), letter-spacing −0.015em: h1 36–44px, section h2 28px (`.shead h2`), card h2 22px.
- Body: Onest 16px / 1.5. UI text 15px, captions 14px (`.note`), small 13px, tags 13px.
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

## What we borrowed from the references (principles only)
Read from `VoltAgent/awesome-design-md` (`apple/`, `meta/`, `claude/` DESIGN.md), cloned outside the repo. No logos, wordmarks, exact color sets or proprietary fonts were taken; our palette stays sky blue + gold and our font is Onest (SIL Open Font License).
- **Apple:** generous white space and one idea per section, so an owner reading on a phone never has two messages competing; large, confident headlines.
- **Meta:** clean light and dark surfaces with one clear action per view. For us that action is the single gold CTA; everything else is blue or quiet.
- **Claude:** warm restraint, editorial type and plain-spoken copy: short sentences, numbers in the sentence, no hype.
- Not taken: Claude's "cream canvas, never cool blue" and Meta's black marketing buttons. They conflict with the sky-blue/gold identity.
