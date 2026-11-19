import { expect, test } from "@playwright/test";

const KEY = "rentwise:kz:v1";
const iso = (d: Date) => d.toISOString().slice(0, 10);
const label = (d: Date) => d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

test("lease, late rent and a repair explain the variance to the exact entry, and survive a reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  const now = new Date();
  const m1 = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 2, 1));
  const m2Late = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 9));
  const m2Repair = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 12));

  await page.goto("/en");
  await page.getByRole("button", { name: "Try the example property" }).click();
  await expect(page).toHaveURL(/\/results$/);
  await page.getByRole("button", { name: "Mark as owned" }).click();
  await expect(page).toHaveURL(/\/performance$/);

  // Lease with a deposit, rent tracked from two months ago.
  await page.getByRole("tab", { name: "Rent" }).click();
  await expect(page.getByText("Don't enter names, phone numbers, emails or ID numbers")).toBeVisible();
  await page.getByLabel("Tenant nickname").fill("Unit A tenant");
  await page.getByLabel("Lease start").fill(iso(m1));
  await page.getByLabel("Track rent from").fill(iso(m1));
  await page.getByLabel("Deposit received on (optional)").fill(iso(m1));
  await page.getByRole("button", { name: "Save lease" }).click();
  await expect(page.getByText("held for the tenant, not income")).toBeVisible();

  // M1 on time, M2 late: rent plus the $50 fee.
  await page.getByLabel("Received on").fill(iso(m1));
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByLabel("Amount received").fill("2500");
  await page.getByLabel("Received on").fill(iso(m2Late));
  await page.getByRole("button", { name: "Record payment" }).click();
  const m2Row = page.getByRole("row", { name: new RegExp(`^${label(m2Late)}`) });
  await expect(m2Row).toContainText("Paid late");
  await expect(m2Row).toContainText("₸50.00 paid");

  // The water heater, done with its cost in one step.
  await page.getByRole("tab", { name: "Expenses & maintenance" }).click();
  await page.getByLabel("What needs doing").fill("Water heater replacement");
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByRole("button", { name: "Mark done + add cost" }).click();
  await page.getByLabel("Done on").fill(iso(m2Repair));
  await page.getByLabel("Cost (optional)").fill("1800");
  await page.getByRole("button", { name: "Save as done" }).click();
  await expect(page.getByRole("row", { name: /Water heater replacement/ })).toContainText("₸1,800.00");

  // Overview: add the usual bills, then the repairs line points at the water heater.
  await page.getByRole("tab", { name: "Overview" }).click();
  await page.getByRole("button", { name: "Add them at the planned amounts" }).click();
  await expect(page.getByRole("button", { name: "Add them at the planned amounts" })).toHaveCount(0);
  await page.getByRole("button", { name: "Repairs & maintenance" }).click();
  await expect(page.locator("tr.src")).toContainText(["Water heater replacement"]);
  await expect(page.locator("tr.src")).toContainText(["₸1,800.00"]);
  await expect(page.getByRole("row", { name: /^Total variance/ })).toContainText("−₸1,431.50");
  // The deposit never counts: other income is only the $50 fee.
  await expect(page.getByRole("row", { name: /Other income/ })).toContainText("₸50.00");
  await expect(page.getByRole("row", { name: /Other income/ })).not.toContainText("₸2,450");

  // Everything persists across a reload.
  await page.reload();
  await expect(page.getByRole("row", { name: /^Total variance/ })).toContainText("−₸1,431.50");
  await expect(page.getByText("2 months recorded")).toBeVisible();

  // Switch the month to manual totals: prefilled from the ledger, counted once.
  await page.getByRole("button", { name: `Enter totals manually for ${label(m2Late)}` }).click();
  await expect(page.getByText("2 months recorded")).toBeVisible();
  await expect(page.getByRole("row", { name: /^Total variance/ })).toContainText("−₸1,431.50");
  const saved = await page.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem(k)!);
    const d = s.deals.find((x: { id: string }) => x.id === s.activeId);
    return { actuals: d.actuals.length, modes: d.ledger.monthModes, payments: d.ledger.payments.length };
  }, KEY);
  expect(saved.actuals).toBe(1);
  expect(saved.payments).toBe(2); // switching deletes nothing
  expect(saved.modes).toContainEqual({ month: iso(m2Late).slice(0, 7), mode: "manual" });
  expect(errors).toEqual([]);
});
