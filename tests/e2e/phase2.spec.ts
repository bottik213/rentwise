import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const V1 = readFileSync("tests/fixtures/v1-state.json", "utf8");

test("Phase 1 data migrates on the first visit, with nothing lost", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));
  // Seed once, the way a Phase 1 visitor arrives: only rentwise:v1 exists.
  // Let each page settle before leaving it: an aborted link prefetch logs a console error in Safari and Firefox.
  const go = async (url: string) => { await page.goto(url); await page.waitForLoadState("networkidle"); };
  await go("/");
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("rentwise:v1", raw); }, V1);

  await go("/performance");
  await expect(page.getByRole("row", { name: /^Total variance/ })).toContainText("−$1,800.00");
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(1);

  await go("/results");
  await expect(page.getByRole("checkbox", { name: "Use Min. cash-on-cash" })).toBeChecked();
  const v2 = await page.evaluate(() => JSON.parse(localStorage.getItem("rentwise:v3")!));
  expect(v2.deals).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem("rentwise:v1"))).toBe(V1);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Example duplex");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rentwise:v3")!).activeId)).toBe(v2.activeId);
  expect(errors).toEqual([]);
});

test("two saved properties compare side by side, with the best value marked per row", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example property" }).click();
  await expect(page).toHaveURL(/\/results$/);
  await page.getByRole("link", { name: "Compare", exact: true }).click();
  await page.getByRole("button", { name: "Duplicate" }).click();
  await page.getByRole("button", { name: "Open" }).nth(1).click();
  await expect(page).toHaveURL(/\/results$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("(copy)");

  if ((page.viewportSize()?.width ?? 1440) < 900) await page.getByRole("button", { name: "Edit assumptions" }).click();
  await page.getByLabel("Scheduled rent", { exact: true }).fill("2600");
  if ((page.viewportSize()?.width ?? 1440) < 900) await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("link", { name: "Compare", exact: true }).click();

  const both = page.getByRole("checkbox", { name: /^Compare / });
  await expect(both).toHaveCount(2);
  await expect(both.nth(0)).toBeChecked();
  await expect(both.nth(1)).toBeChecked();
  // Rent: the copy (2nd) is higher and is marked best, on desktop (table) and phone (metric list) alike.
  await expect(page.getByText("$2,600/mo (best)", { exact: true }).filter({ visible: true })).toHaveCount(1);
  await expect(page.getByText("$2,450/mo (best)", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Every assumption matches")).toBeVisible();
});

test("the report shows the projection, refuses a low-contrast accent, and prints without the app chrome", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example property" }).click();
  await expect(page).toHaveURL(/\/results$/);
  await page.getByRole("link", { name: "Report", exact: true }).click();
  await expect(page).toHaveURL(/\/report\//, { timeout: 15_000 }); // the one server-rendered route can cold-start on Vercel
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Example duplex");
  await expect(page.getByRole("row", { name: /^IRR over 10 years/ })).toContainText("9.29%");

  await page.getByRole("button", { name: "Branding" }).click();
  await page.getByLabel("Accent color hex").fill("#ffd400");
  await expect(page.getByText(/too light to read on white/)).toBeVisible();
  await page.getByLabel("Accent color hex").fill("#8a1c3c");
  await expect(page.getByText(/too light to read on white/)).toBeHidden();

  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("banner")).toBeHidden();
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeHidden();
  await expect(page.getByRole("note").filter({ hasText: "Important." })).toContainText("not financial, investment, tax, legal or mortgage advice");
});

test("a share link opens read-only in a fresh browser, saves on request, and a broken link explains itself", async ({ page, browser, baseURL }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example property" }).click();
  await expect(page).toHaveURL(/\/results$/);
  await page.getByRole("link", { name: "Report", exact: true }).click();
  await page.getByRole("button", { name: "Share link" }).click();
  await expect(page.getByText("Anyone with the link can see these numbers")).toBeVisible();
  await page.getByRole("button", { name: "I understand, create the link" }).click();
  const url = await page.getByLabel("Share link").inputValue();
  expect(url).toMatch(/\/r#v1\.[A-Za-z0-9_-]+$/);

  const fresh = await browser.newContext({ baseURL });
  const other = await fresh.newPage();
  await other.goto(url);
  await expect(other.getByRole("heading", { level: 1 })).toHaveText("Example duplex");
  await expect(other.getByText("Shared report, read-only.")).toBeVisible();
  await expect(other.getByRole("row", { name: /^IRR over 10 years/ })).toContainText("9.29%");
  expect(await other.evaluate(() => localStorage.getItem("rentwise:v3"))).toBeNull(); // nothing saved by just looking

  await other.getByRole("button", { name: "Save to my RentWise" }).click();
  await expect(other).toHaveURL(/\/results$/);
  await expect(other.getByRole("heading", { level: 1 })).toContainText("Example duplex");
  expect(await other.evaluate(() => JSON.parse(localStorage.getItem("rentwise:v3")!).deals.length)).toBe(1);

  await other.goto(url.slice(0, -12));
  await expect(other.getByRole("heading", { name: "This link is broken or incomplete" })).toBeVisible();
  await fresh.close();
});

test("the offer ceiling names its binding target, including IRR, and shows the infeasible state", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example property" }).click();
  await expect(page).toHaveURL(/\/results$/);
  await expect(page.getByRole("button", { name: "Explain IRR over 10 years" })).toBeVisible();
  await expect(page.locator("#t-pirr").locator("..")).toContainText("9.29%");

  await page.getByRole("checkbox", { name: "Use Min. cash-on-cash" }).check();
  await expect(page.getByText("Cash-on-cash ≥ 8% is the binding limit; cash flow would allow $263,099.")).toBeVisible();
  await expect(page.getByRole("row", { name: /^Cash-on-cash ≥ 8% \(binding\)/ })).toContainText("$176,884");

  await page.getByRole("checkbox", { name: "Use Min. cash-on-cash" }).uncheck();
  await page.getByRole("checkbox", { name: "Use Min. IRR over the hold" }).check();
  await page.getByLabel("Min. IRR over the hold", { exact: true }).fill("30");
  await expect(page.getByText(/^IRR ≥ 30% is the binding limit/)).toBeVisible();

  // Infeasible: no price can reach $5,000 a month on this rent.
  await page.getByLabel("Min. cash flow after reserves", { exact: true }).fill("5000");
  await expect(page.getByText(/Even at \$1, the minimum cash flow target fails/)).toBeVisible();
});
