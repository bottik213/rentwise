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

/** The full statement sits behind "Show full statement" on the analysis page; open it first. */
async function statementRow(page: Page, name: RegExp) {
  const details = page.locator("details", { hasText: "Show full statement" });
  if (!(await details.evaluate((d) => (d as HTMLDetailsElement).open))) await details.locator("summary").click();
  return page.getByRole("table", { name: "Monthly and annual cash flow statement" }).getByRole("row", { name });
}

/** On a phone the quick assumptions live in a bottom sheet. Both helpers do nothing on desktop. */
const sheet = (page: Page) => page.locator('aside[aria-label="Quick assumptions"]');
async function openQuick(page: Page) {
  await expect(sheet(page)).toBeAttached(); // the analysis has loaded
  if (await page.locator("aside.open").count()) return;
  const open = page.getByRole("button", { name: "Edit assumptions" });
  if (await open.isVisible()) await open.click();
}
async function closeQuick(page: Page) {
  const done = page.getByRole("button", { name: "Done" });
  if (!(await page.locator("aside.open").count()) || !(await done.isVisible())) return;
  await done.click();
  await expect(sheet(page)).toBeHidden(); // wait out the slide-down before the next step
}

test("analyze → stress → offer ceiling → actuals → variance", async ({ page }) => {
  const errors = watchConsole(page);

  // 1. No sign-up: the example loads straight into the analysis.
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example property" }).click();
  await expect(page).toHaveURL(/\/results$/);
  await expect(page.getByText("Synthetic example")).toBeVisible();
  await expect(await statementRow(page, /^Cash flow after reserves/)).toContainText("$65.36");
  await noHorizontalScroll(page);

  // 2. Numbers change with input: vacancy 5% → 10% turns cash flow negative (hand-computed: −$47.34).
  await openQuick(page);
  await page.getByLabel("Vacancy", { exact: true }).fill("10");
  await closeQuick(page);
  await expect(await statementRow(page, /^Cash flow after reserves/)).toContainText("−$47.34");
  await openQuick(page);
  await page.getByLabel("Vacancy", { exact: true }).fill("5");
  await closeQuick(page);
  await expect(await statementRow(page, /^Cash flow after reserves/)).toContainText("$65.36");

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
  await expect(page.getByRole("img", { name: /Effect on cash flow by category/ })).toBeVisible();
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

test("all-cash purchase: no P&I, price-independent cash flow, cash-on-cash ceiling", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example property" }).click();
  await page.getByRole("link", { name: "All inputs" }).click();
  await page.getByLabel("All-cash purchase", { exact: false }).check();
  await page.getByRole("button", { name: "Save and view analysis" }).click();

  // Hand-computed: NOI $1,435.30 − P&I $0 − CapEx reserve $122.50.
  await expect(await statementRow(page, /^Cash flow after reserves/)).toContainText("$1,312.80");
  await expect(page.getByLabel("Interest rate", { exact: true })).toBeDisabled();
  // Cash flow doesn't depend on price, so a $0 cash-flow target can't limit it.
  await expect(page.getByText("Not limited by your targets")).toBeVisible();

  // CoC = $15,753.60/yr ÷ (P + 3%·P + $15,000) ≥ 8% → P ≤ $176,621.36.
  await page.getByRole("checkbox", { name: "Use Min. cash-on-cash" }).check();
  await expect(page.getByText(/Limited by\s*minimum cash-on-cash/)).toBeVisible();
  await expect(page.getByText("$176,621", { exact: true }).last()).toBeAttached();
  // At 5%: P ≤ $291,332.04.
  await page.getByLabel("Min. cash-on-cash", { exact: true }).fill("5");
  await expect(page.getByText("$291,332", { exact: true }).last()).toBeAttached();
});

test("must also pass the conservative scenario lowers the ceiling", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example property" }).click();
  await page.getByLabel("Min. cash flow after reserves", { exact: true }).fill("200");
  await expect(page.getByText("$223,017", { exact: true }).last()).toBeAttached();

  // Conservative: NOI $1,176.25, reserve $186.20 → P&I ≤ $790.05 → price ≤ $158,334.
  await page.getByRole("checkbox", { name: "Must also pass the conservative scenario" }).check();
  await expect(page.getByText(/Limited by\s*minimum cash flow\s*in the conservative scenario/)).toBeVisible();
  await expect(page.getByText("$158,334", { exact: true }).last()).toBeAttached();
});

test("export downloads the saved data as JSON", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example property" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export my data (JSON)" }).click()]);
  expect(download.suggestedFilename()).toBe("rentwise-data.json");
  const fs = await import("node:fs/promises");
  const saved = JSON.parse(await fs.readFile((await download.path())!, "utf8"));
  expect(saved.property.nickname).toBe("Example duplex (synthetic)");
});

test("loading the example never silently replaces recorded months", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example property" }).click();
  await page.getByRole("button", { name: "Mark as owned" }).click();
  await page.getByRole("button", { name: "Add month" }).click();

  await page.goto("/");
  let asked = "";
  page.once("dialog", (d) => { asked = d.message(); void d.dismiss(); });
  await page.getByRole("button", { name: "Try the example property" }).click();
  expect(asked).toContain("1 recorded month");
  await expect(page).toHaveURL(/\/$/); // cancel stays put
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rentwise:v1")!).actuals.length)).toBe(1);
});

test("property form blocks invalid drafts and saves corrected values", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example property" }).click();
  await page.getByRole("link", { name: "All inputs" }).click();
  await expect(page).toHaveURL(/\/analyze$/); // the results sidebar also has an Insurance field
  const save = page.getByRole("button", { name: "Save and view analysis" });
  const insurance = page.getByLabel("Insurance", { exact: true });

  await insurance.fill("-1");
  await save.click();
  await expect(page).toHaveURL(/\/analyze$/);
  await expect(insurance).toBeFocused();
  await expect(insurance).toHaveAttribute("aria-invalid", "true");

  await insurance.fill("2400");
  const closing = page.getByLabel("Closing costs", { exact: true });
  await closing.fill("21");
  await save.click();
  await expect(page).toHaveURL(/\/analyze$/);
  await expect(closing).toBeFocused();
  await closing.fill("4");

  const price = page.getByLabel("Purchase price", { exact: true });
  await price.fill("");
  await price.press("Enter");
  await expect(page).toHaveURL(/\/analyze$/);
  await expect(price).toHaveAttribute("aria-invalid", "true");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rentwise:v1")!).property.annualInsurance)).toBe(192000);

  await price.fill("$275,000");
  await save.click();
  await expect(page).toHaveURL(/\/results$/);
  const property = await page.evaluate(() => JSON.parse(localStorage.getItem("rentwise:v1")!).property);
  expect(property.annualInsurance).toBe(240000);
  expect(property.purchasePrice).toBe(27500000);
  expect(property.closingCostValue).toBe(0.04);
});

test("disabled financing drafts do not block an all-cash purchase", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example property" }).click();
  await page.getByRole("link", { name: "All inputs" }).click();
  await page.getByLabel("Interest rate", { exact: true }).fill("-1");
  await page.getByLabel("All-cash purchase", { exact: false }).check();
  await page.getByRole("button", { name: "Save and view analysis" }).click();
  await expect(page).toHaveURL(/\/results$/);
  await expect(await statementRow(page, /^Cash flow after reserves/)).toContainText("$1,312.80");
});

test("actuals block invalid drafts, reset them, and save corrected amounts", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example property" }).click();
  await page.getByRole("button", { name: "Mark as owned" }).click();
  await expect(page).toHaveURL(/\/performance$/); // the results sidebar also has an Insurance field
  const insurance = page.getByLabel("Insurance", { exact: true });

  await insurance.fill("garbage");
  await page.getByRole("button", { name: "Add month" }).click();
  await expect(insurance).toBeFocused();
  await expect(insurance).toHaveAttribute("aria-invalid", "true");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rentwise:v1")!).actuals)).toEqual([]);

  // Reset must also clear an invalid draft that never committed a value to the parent.
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(insurance).toHaveValue("160");
  await expect(insurance).toHaveAttribute("aria-invalid", "false");
  await insurance.fill("260");
  await page.getByRole("button", { name: "Add month" }).click();
  await expect(row(page, /^Total variance/)).toContainText("−$100.00");
  const actuals = await page.evaluate(() => JSON.parse(localStorage.getItem("rentwise:v1")!).actuals);
  expect(actuals).toHaveLength(1);
  expect(actuals[0].insurance).toBe(26000);
});

test("loading the example protects edited inputs, scenarios and targets", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example property" }).click();
  const edits = [
    ["Scheduled rent", "3000"],
    ["Conservative Rent %", "-10"],
    ["Min. cash flow after reserves", "200"],
  ];

  for (const [label, value] of edits) {
    if (label === "Scheduled rent") await openQuick(page);
    if (label.startsWith("Conservative")) await page.getByText("Edit scenario assumptions").click();
    await page.getByLabel(label, { exact: true }).fill(value);
    await closeQuick(page);
    const saved = await page.evaluate(() => localStorage.getItem("rentwise:v1"));
    await page.goto("/");
    let asked = "";
    page.once("dialog", (d) => { asked = d.message(); void d.dismiss(); });
    await page.getByRole("button", { name: "Try the example property" }).click();
    expect(asked).toContain("Loading the example replaces your property");
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => localStorage.getItem("rentwise:v1"))).toBe(saved);

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Try the example property" }).click();
    await expect(page).toHaveURL(/\/results$/);
    const reset = await page.evaluate(() => JSON.parse(localStorage.getItem("rentwise:v1")!));
    expect(reset.property.monthlyRent).toBe(245000);
    expect(reset.scenarios.conservative.rentChangePct).toBe(-0.05);
    expect(reset.constraints.minMonthlyCashFlow).toBe(0);
  }

  // An untouched example can still be loaded again without a confirmation.
  await page.goto("/");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Try the example property" }).click();
  await expect(page).toHaveURL(/\/results$/);
});

test("invalid Quick assumptions block both locking and re-locking a plan", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example property" }).click();
  const insurance = page.getByLabel("Insurance", { exact: true });
  const markOwned = async (name: string) => {
    await closeQuick(page);
    await page.getByRole("button", { name }).click();
  };
  await openQuick(page);
  await insurance.fill("-1");
  await markOwned("Mark as owned");
  await expect(page).toHaveURL(/\/results$/);
  await expect(insurance).toBeFocused(); // on a phone the sheet reopens so the bad field can take focus
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rentwise:v1")!).plan)).toBeNull();
  await insurance.fill("");
  await markOwned("Mark as owned");
  await expect(page).toHaveURL(/\/results$/);
  await insurance.fill("2400");
  await insurance.press("Enter");
  await expect(page).toHaveURL(/\/results$/);
  await markOwned("Mark as owned");
  await page.getByRole("button", { name: "Add month" }).click();
  const plan = await page.evaluate(() => JSON.parse(localStorage.getItem("rentwise:v1")!).plan);
  await page.getByRole("link", { name: "Back to analysis" }).click();
  await openQuick(page);
  await insurance.fill("-1");
  let confirmations = 0;
  page.on("dialog", async (dialog) => { confirmations++; await dialog.accept(); });
  await markOwned("Re-lock plan and track actuals");
  await expect(page).toHaveURL(/\/results$/);
  expect(confirmations).toBe(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rentwise:v1")!).plan)).toEqual(plan);

  await insurance.fill("2600");
  await markOwned("Re-lock plan and track actuals");
  await expect(page).toHaveURL(/\/performance$/);
  expect(confirmations).toBe(1);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("rentwise:v1")!));
  expect(state.plan.inputs.annualInsurance).toBe(260000);
  expect(state.actuals).toHaveLength(1);
});
