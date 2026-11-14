import { expect, test, type Page } from "@playwright/test";

/** Fails the test on any console error or uncaught exception. */
function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** On a phone, content wider than the screen makes the browser zoom the whole page out, so compare to the visual viewport. */
async function noHorizontalScroll(page: Page) {
  const { sw, vw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: Math.round(visualViewport!.width) }));
  expect(sw, "page is wider than the screen").toBeLessThanOrEqual(vw + 1);
}

const row = (page: Page, name: RegExp) => page.getByRole("row", { name });
const statementRow = (page: Page, name: RegExp) =>
  page.getByRole("table", { name: "Monthly and annual cash flow statement" }).getByRole("row", { name });

test("analyze → stress → offer ceiling → actuals → variance", async ({ page }) => {
  const errors = watchConsole(page);

  // 1. No sign-up: the example loads straight into the analysis.
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example property" }).click();
  await expect(page).toHaveURL(/\/results$/);
  await expect(page.getByText("Synthetic example")).toBeVisible();
  await expect(statementRow(page, /^Cash flow after reserves/)).toContainText("$65.36");
  await noHorizontalScroll(page);

  // 2. Numbers change with input: vacancy 5% → 10% turns cash flow negative (hand-computed: −$47.34).
  await page.getByLabel("Vacancy", { exact: true }).fill("10");
  await expect(statementRow(page, /^Cash flow after reserves/)).toContainText("−$47.34");
  await page.getByLabel("Vacancy", { exact: true }).fill("5");
  await expect(statementRow(page, /^Cash flow after reserves/)).toContainText("$65.36");

  // 3. Offer ceiling, then the infeasible state.
  const minCf = page.getByLabel("Min. cash flow after reserves", { exact: true });
  await minCf.fill("200");
  await expect(page.getByText(/Limited by\s*minimum cash flow/)).toBeVisible();
  await expect(page.getByText(/vs\. asking \$250,000/)).toBeVisible();
  await minCf.fill("5000");
  await expect(page.getByText("No price works")).toBeVisible();
  await minCf.fill("0");

  // 4. Mark as owned, record one on-plan month and one with a surprise $1,800 repair.
  await page.getByRole("button", { name: "Mark as owned" }).click();
  await expect(page).toHaveURL(/\/performance$/);
  await page.getByRole("button", { name: "Add month" }).click();
  await page.getByLabel("Repairs & maintenance", { exact: true }).fill("1996"); // forecast $196 + $1,800
  await page.getByRole("button", { name: "Add month" }).click();

  // 5. Variance reconciles to the cent and is explained.
  await expect(row(page, /^Total variance/)).toContainText("−$1,800.00");
  await expect(row(page, /^Repairs & maintenance/)).toContainText("−$1,800.00");
  await expect(page.getByText(/Repairs & maintenance: .* −\$1,800\.00 to cash flow\./)).toBeVisible();
  await expect(page.getByRole("img", { name: /Waterfall from forecast/ })).toBeVisible();
  await noHorizontalScroll(page);

  // 6. Actuals persist after refresh.
  await page.reload();
  await expect(row(page, /^Total variance/)).toContainText("−$1,800.00");
  await expect(page.getByRole("listitem").filter({ hasText: "Delete" })).toHaveCount(2);

  expect(errors).toEqual([]);
});

test("re-saving a month replaces it instead of double-counting", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example property" }).click();
  await page.getByRole("button", { name: "Mark as owned" }).click();
  await page.getByRole("button", { name: "Add month" }).click();

  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Insurance", { exact: true }).fill("260"); // forecast $160
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("listitem").filter({ hasText: "Delete" })).toHaveCount(1);
  await expect(row(page, /^Total variance/)).toContainText("−$100.00");
});

test("empty states and clearing data", async ({ page }) => {
  await page.goto("/performance");
  await expect(page.getByRole("heading", { name: "No owned property yet" })).toBeVisible();
  await page.goto("/results");
  await expect(page.getByRole("heading", { name: "No property to analyze yet" })).toBeVisible();

  await page.getByRole("button", { name: "Try the example property" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Clear my data" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem("rentwise:v1"))).toBeNull();
});
