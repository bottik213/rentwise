import { expect, test, type Page } from "@playwright/test";

async function simulateStorageFailures(page: Page) {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    const remove = Storage.prototype.removeItem;
    const blocked = (key: string, operation: string) =>
      key === "rentwise:v1" && get.call(sessionStorage, "rentwise-test:storage-failure") === operation;

    Storage.prototype.getItem = function (key) {
      if (blocked(key, "read")) throw new DOMException("Storage blocked", "SecurityError");
      return get.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (blocked(key, "save")) throw new DOMException("Storage full", "QuotaExceededError");
      set.call(this, key, value);
    };
    Storage.prototype.removeItem = function (key) {
      if (blocked(key, "clear")) throw new DOMException("Storage blocked", "SecurityError");
      remove.call(this, key);
    };
  });
}

const fail = (page: Page, operation: "read" | "save" | "clear") =>
  page.evaluate((op) => sessionStorage.setItem("rentwise-test:storage-failure", op), operation);
const recover = (page: Page) => page.evaluate(() => sessionStorage.removeItem("rentwise-test:storage-failure"));
const beforeUnloadBlocked = (page: Page) => page.evaluate(() => {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
});

test("failed saves stay available for export and survive a successful retry", async ({ page }) => {
  await simulateStorageFailures(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example property" }).click();
  await page.getByRole("button", { name: "Mark as owned" }).click();
  await fail(page, "save");
  await page.getByLabel("Insurance", { exact: true }).fill("260");
  await page.getByRole("button", { name: "Add month" }).click();

  const warning = page.getByRole("alert").filter({ hasText: "Your changes aren't saved" });
  await expect(warning).toContainText("Your changes aren't saved");
  await expect(warning).toContainText("only kept in this tab");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rentwise:v1")!).actuals)).toEqual([]);
  expect(await beforeUnloadBlocked(page)).toBe(true);

  // A cross-tab event must not replace our unsaved month with the older saved state.
  await page.evaluate(() => window.dispatchEvent(new StorageEvent("storage", { key: "rentwise:v1" })));
  await expect(page.getByRole("row", { name: /^Total variance/ })).toContainText("−$100.00");
  await warning.getByRole("button", { name: "Retry saving" }).click();
  await expect(warning).toBeVisible();

  // Recovery controls remain available on every page, including the landing page.
  await page.getByRole("link", { name: "RentWise", exact: true }).click();
  await expect(warning).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    warning.getByRole("button", { name: "Export current data (JSON)" }).click(),
  ]);
  const fs = await import("node:fs/promises");
  const exported = JSON.parse(await fs.readFile((await download.path())!, "utf8"));
  expect(exported.actuals).toHaveLength(1);
  expect(exported.actuals[0].insurance).toBe(26000);

  await recover(page);
  await warning.getByRole("button", { name: "Retry saving" }).click();
  await expect(warning).toHaveCount(0);
  expect(await beforeUnloadBlocked(page)).toBe(false);
  await page.reload();
  await page.getByRole("link", { name: "Actuals", exact: true }).click();
  await expect(page.getByRole("row", { name: /^Total variance/ })).toContainText("−$100.00");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rentwise:v1")!).actuals[0].insurance)).toBe(26000);
});

test("failed loads can be retried without replacing existing saved data", async ({ page }) => {
  await simulateStorageFailures(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example property" }).click();
  await page.getByLabel("Scheduled rent", { exact: true }).fill("3000");
  const saved = await page.evaluate(() => localStorage.getItem("rentwise:v1"));

  await fail(page, "read");
  await page.reload();
  const warning = page.getByRole("alert").filter({ hasText: "Saved data couldn't be loaded" });
  await expect(warning).toContainText("Saved data couldn't be loaded");
  await warning.getByRole("button", { name: "Try loading again" }).click();
  await expect(warning).toBeVisible();

  await recover(page);
  await warning.getByRole("button", { name: "Try loading again" }).click();
  await expect(warning).toHaveCount(0);
  await expect(page.getByLabel("Scheduled rent", { exact: true })).toHaveValue("3000");
  expect(await page.evaluate(() => localStorage.getItem("rentwise:v1"))).toBe(saved);
});

test("failed deletion keeps the property available until clearing succeeds", async ({ page }) => {
  await simulateStorageFailures(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example property" }).click();
  await page.getByRole("button", { name: "Mark as owned" }).click();
  await page.getByRole("button", { name: "Add month" }).click();
  const saved = await page.evaluate(() => localStorage.getItem("rentwise:v1"));
  await fail(page, "clear");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Clear my data" }).click();

  const warning = page.getByRole("alert").filter({ hasText: "Your saved data wasn't cleared" });
  await expect(page).toHaveURL(/\/performance$/);
  await expect(warning).toContainText("Your saved data wasn't cleared");
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem("rentwise:v1"))).toBe(saved);

  await recover(page);
  await warning.getByRole("button", { name: "Retry clearing" }).click();
  await expect(warning).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No owned property yet" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("rentwise:v1"))).toBeNull();
  await page.reload();
  await expect(page.getByRole("heading", { name: "No owned property yet" })).toBeVisible();
});

test("unread actuals cannot be replaced by the example or a new property", async ({ page }) => {
  await simulateStorageFailures(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example property" }).click();
  await page.getByRole("button", { name: "Mark as owned" }).click();
  await page.getByRole("button", { name: "Add month" }).click();
  const saved = await page.evaluate(() => localStorage.getItem("rentwise:v1"));
  await fail(page, "read");
  await page.reload();
  const warning = page.getByRole("alert").filter({ hasText: "Saved data couldn't be loaded" });
  await expect(warning).toBeVisible();
  await page.getByRole("link", { name: "RentWise", exact: true }).click();
  await page.getByRole("button", { name: "Try the example property" }).click();
  await expect(page).toHaveURL(/\/$/);

  await recover(page);
  await page.getByRole("button", { name: "Try the example property" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem("rentwise:v1"))).toBe(saved);

  await page.getByRole("link", { name: "Inputs", exact: true }).click();
  await page.getByLabel("Purchase price", { exact: true }).fill("250000");
  await page.getByLabel("Scheduled rent", { exact: true }).fill("2450");
  await page.getByLabel("Property tax", { exact: true }).fill("3600");
  await page.getByLabel("Insurance", { exact: true }).fill("1920");
  await page.getByRole("button", { name: "Analyze property", exact: true }).click();
  await expect(page).toHaveURL(/\/analyze$/);
  expect(await page.evaluate(() => localStorage.getItem("rentwise:v1"))).toBe(saved);

  await warning.getByRole("button", { name: "Try loading again" }).click();
  await expect(warning).toHaveCount(0);
  await page.getByRole("link", { name: "Actuals", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem("rentwise:v1"))).toBe(saved);
});
