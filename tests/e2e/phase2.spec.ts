import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const V1 = readFileSync("tests/fixtures/v1-state.json", "utf8");

test("Phase 1 data migrates on the first visit, with nothing lost", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));
  // Seed once, the way a Phase 1 visitor arrives: only rentwise:v1 exists.
  await page.goto("/");
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("rentwise:v1", raw); }, V1);

  await page.goto("/performance");
  await expect(page.getByRole("row", { name: /^Total variance/ })).toContainText("−$1,800.00");
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(1);

  await page.goto("/results");
  await expect(page.getByRole("checkbox", { name: "Use Min. cash-on-cash" })).toBeChecked();
  const v2 = await page.evaluate(() => JSON.parse(localStorage.getItem("rentwise:v2")!));
  expect(v2.deals).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem("rentwise:v1"))).toBe(V1);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Example duplex");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rentwise:v2")!).activeId)).toBe(v2.activeId);
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
