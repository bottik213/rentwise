import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../../src/lib/branding";

const APP = join(__dirname, "../../src/app");
const css = readFileSync(join(APP, "globals.css"), "utf8");

/** The `--name: #hex` tokens of one block (light = the first `:root`, dark = the prefers-color-scheme block). */
function tokens(block: string): Record<string, string> {
  const t: Record<string, string> = {};
  for (const [, k, v] of block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6}|var\(--[\w-]+\))/gi)) t[k] = v;
  for (const k in t) if (t[k].startsWith("var(")) t[k] = t[t[k].slice(6, -1)];
  return t;
}
const light = tokens(css.slice(css.indexOf(":root {"), css.indexOf("\n}")));
const darkStart = css.indexOf("(prefers-color-scheme: dark)");
const dark = { ...light, ...tokens(css.slice(darkStart, css.indexOf("\n}", darkStart))) };

/** [foreground, background, minimum ratio]. Body text 4.5:1; marks and large UI 3:1. */
const PAIRS: [string, string, number][] = [
  ...["ink", "ink-2", "muted"].flatMap((fg) => ["paper", "card", "sunk"].map((bg): [string, string, number] => [fg, bg, 4.5])),
  ["brand", "paper", 4.5],
  ["brand", "card", 4.5],
  ["brand", "brand-tint", 4.5],
  ["brand-hi", "card", 4.5],
  ["on-brand", "brand", 4.5],
  ["on-brand", "brand-hi", 4.5],
  ["on-cta", "cta", 4.5],
  ["on-cta", "cta-hi", 4.5],
  ["verdict-ink", "verdict", 4.5],
  ["tip-ink", "tip", 4.5],
  ["dock-ink", "dock", 4.5],
  ...["good", "warn", "bad"].flatMap((s): [string, string, number][] => [[s, "card", 4.5], [s, `${s}-bg`, 4.5]]),
  ["field", "card", 3], // form-field borders: the only thing outlining an input on a card
  ["field", "paper", 3],
  ["data", "card", 3],
  ["deduct", "card", 3],
  ...[1, 2, 3, 4].map((n): [string, string, number] => [`series-${n}`, "card", 3]),
];

describe.each([["light", light], ["dark", dark]] as const)("palette contrast, %s mode", (_, t) => {
  it.each(PAIRS)("%s on %s ≥ %s:1", (fg, bg, min) => {
    expect(t[fg], `--${fg}`).toMatch(/^#/);
    expect(t[bg], `--${bg}`).toMatch(/^#/);
    expect(contrastRatio(t[fg], t[bg])).toBeGreaterThanOrEqual(min);
  });
  it("actual values (--data) differ from the brand blue", () => expect(t.data.toLowerCase()).not.toBe(t.brand.toLowerCase()));
});

describe("palette usage", () => {
  const all = readdirSync(APP, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".css"))
    .map((f) => readFileSync(join(APP, f), "utf8"))
    .join("\n");
  it("gold is never used as a text color", () => expect(all).not.toMatch(/(^|[^-])color:\s*var\(--cta(-hi)?\)/m));
  it("the old token names are gone", () => expect(all).not.toMatch(/--(spruce|brick)|on-(spruce|brick)/));
});
