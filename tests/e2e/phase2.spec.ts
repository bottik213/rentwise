import { expect, test } from "@playwright/test";

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

test("the report refuses a low-contrast accent, and prints without the app chrome", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example property" }).click();
  await expect(page).toHaveURL(/\/results$/);
  await page.getByRole("link", { name: "Report", exact: true }).click();
  await expect(page).toHaveURL(/\/report\//, { timeout: 15_000 }); // the one server-rendered route can cold-start on Vercel
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Example duplex");

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
  expect(await other.evaluate(() => localStorage.getItem("rentwise:v3"))).toBeNull(); // nothing saved by just looking

  await other.getByRole("button", { name: "Save to my RentWise" }).click();
  await expect(other).toHaveURL(/\/results$/);
  await expect(other.getByRole("heading", { level: 1 })).toContainText("Example duplex");
  expect(await other.evaluate(() => JSON.parse(localStorage.getItem("rentwise:v3")!).deals.length)).toBe(1);

  await other.goto(url.slice(0, -12));
  await expect(other.getByRole("heading", { name: "This link is broken or incomplete" })).toBeVisible();
  await fresh.close();
});
