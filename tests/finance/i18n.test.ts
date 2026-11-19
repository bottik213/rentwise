import { describe, expect, it } from "vitest";
import { i18n } from "../../src/i18n";
import { parseNumber } from "../../src/lib/validation";

// Intl separates groups with a no-break space (which one depends on the ICU version), so match \s, never " ".
describe("money in tenge", () => {
  it("shows whole tenge with the sign after the number in Russian and Kazakh", () => {
    expect(i18n("ru").money(25_000_000)).toMatch(/^250\s000\s₸$/);
    expect(i18n("kk").money(25_000_000)).toMatch(/^250\s000\s₸$/);
    expect(i18n("en").money(25_000_000)).toBe("₸250,000");
  });
  it("keeps the true minus, the + option and tiyn when exact", () => {
    expect(i18n("ru").money(-180_000, { exact: true })).toMatch(/^−1\s800,00\s₸$/);
    expect(i18n("en").money(-180_000, { exact: true })).toBe("−₸1,800.00");
    expect(i18n("en").money(6536, { exact: true, signed: true })).toBe("+₸65.36");
    expect(i18n("ru").money(-40)).toMatch(/^0\s₸$/); // rounds to zero: no minus
  });
  it("never shows a dollar sign", () => {
    for (const l of ["ru", "kk", "en"] as const) expect(i18n(l).money(123_456, { exact: true })).not.toContain("$");
  });
});

describe("percent and dates", () => {
  it("uses the locale's decimal mark", () => {
    expect(i18n("ru").pct(0.0092)).toMatch(/^0,92\s%$/);
    expect(i18n("en").pct(0.0092)).toBe("0.92%");
    expect(i18n("en").pct(-0.05)).toBe("−5.00%");
    expect(i18n("ru").pct(null)).toBe("н/д");
  });
  it("names months in the locale", () => {
    expect(i18n("ru").monthName("2026-03")).toBe("март");
    expect(i18n("en").month("2026-03")).toBe("Mar 2026");
  });
});

describe("parseNumber", () => {
  it("reads Russian and Kazakh input: spaces group, comma or dot is the decimal mark", () => {
    expect(parseNumber("250 000", "ru")).toBe(250_000);
    expect(parseNumber("250 000 ₸", "kk")).toBe(250_000);
    expect(parseNumber("0,5", "ru")).toBe(0.5);
    expect(parseNumber("1.5", "ru")).toBe(1.5);
    expect(parseNumber("1,234.5", "ru")).toBeNull(); // ambiguous: refused, not guessed
  });
  it("reads English input: commas group", () => {
    expect(parseNumber("$275,000", "en")).toBe(275_000);
    expect(parseNumber("2.5", "en")).toBe(2.5);
    expect(parseNumber("", "en")).toBeNull();
  });
});

describe("paths", () => {
  it("prefixes the locale", () => {
    expect(i18n("kk").path("/results")).toBe("/kk/results");
    expect(i18n("ru").path("/")).toBe("/ru");
  });
});
