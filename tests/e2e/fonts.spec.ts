import { expect, test } from "@playwright/test";

const KAZAKH = "Қазақстан әңгіме ұйым үй өнім ғимарат һ і";
const WEIGHTS = [400, 500, 700];

/**
 * Every letter must be drawn by an Onest file that the page has loaded: next/font splits the family into
 * subsets by unicode-range, so a letter outside every loaded range falls back to another font.
 * Georgian "ა" is the control: Onest has no Georgian, so the check must report it.
 */
test("Kazakh letters render in Onest in every weight, with no fallback", async ({ page }, info) => {
  await page.goto("/");
  const r = await page.evaluate(
    async ({ text, weights }) => {
      const family = getComputedStyle(document.body).fontFamily.split(",")[0].trim();
      await Promise.all(weights.map((w) => document.fonts.load(`${w} 32px ${family}`, text)));
      const name = family.replace(/['"]/g, "");
      const faces = [...document.fonts].filter((f) => f.family.replace(/['"]/g, "") === name && f.status === "loaded");
      const inRange = (cp: number, range: string) =>
        range.split(",").some((part) => {
          const [a, b = a] = part.trim().replace(/^U\+/i, "").split("-").map((h) => parseInt(h, 16));
          return cp >= a && cp <= b;
        });
      const weightOk = (f: FontFace, w: number) => {
        const [lo, hi = lo] = f.weight.split(" ").map(Number);
        return w >= lo && w <= hi;
      };
      const covered = (ch: string, w: number) => faces.some((f) => weightOk(f, w) && inRange(ch.codePointAt(0)!, f.unicodeRange));
      const missing = weights.flatMap((w) => [...new Set(text.replace(/\s/g, ""))].filter((ch) => !covered(ch, w)).map((ch) => `${w}:${ch}`));

      const box = document.createElement("div");
      box.id = "glyph-check";
      box.style.cssText = "position:fixed;inset:0 auto auto 0;z-index:9999;padding:24px;background:var(--card);color:var(--ink);font-size:32px";
      box.innerHTML = weights.map((w) => `<p style="font-weight:${w};margin:0 0 8px">${w}: ${text}</p>`).join("");
      document.body.append(box);
      return { family, faces: faces.length, missing, controlCaught: !covered("ა", 400) };
    },
    { text: KAZAKH, weights: WEIGHTS },
  );
  await page.locator("#glyph-check").screenshot({ path: info.outputPath("kazakh-glyphs.png") });
  expect(r.family).toMatch(/Onest/);
  expect(r.faces).toBeGreaterThan(0);
  expect(r.controlCaught, "the check must catch a letter the font lacks").toBe(true);
  expect(r.missing).toEqual([]);
});
