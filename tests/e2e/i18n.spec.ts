import { expect, test, type Page } from "@playwright/test";

/** Latin words allowed in Russian and Kazakh text: our name, file formats, and names of services. */
const LATIN_OK = new Set(["RentWise", "JSON", "PDF", "PNG", "JPG", "KB", "WhatsApp", "Telegram", "Krisha", "Kaspi", "Salyq", "YYYY", "MM"]);

/** Visible text, without photo credits (authors' names and licenses stay as published). */
const visibleText = (page: Page) =>
  page.evaluate(() => {
    const body = document.body.cloneNode(true) as HTMLElement;
    body.querySelectorAll("figcaption, .credits, script, style").forEach((n) => n.remove());
    document.body.after(body); // innerText needs a rendered node
    body.style.cssText = "position:absolute;left:-99999px";
    const text = body.innerText;
    body.remove();
    return text;
  });

async function latinWords(page: Page) {
  const words = (await visibleText(page)).match(/[A-Za-z][A-Za-z&'-]{2,}/g) ?? [];
  return [...new Set(words.filter((w) => !LATIN_OK.has(w.replace(/[-']+$/, ""))))];
}

/** The example, owned, with one recorded month: every screen has content. Built through the English UI. */
async function seed(page: Page) {
  await page.goto("/en");
  await page.getByRole("button", { name: "Try the example property" }).click();
  await page.getByRole("button", { name: "Mark as owned" }).click();
  await page.getByRole("button", { name: "Add month" }).click();
  return page.evaluate(() => JSON.parse(localStorage.getItem("rentwise:kz:v1")!).activeId as string);
}

test("/ redirects to /ru, and <html lang> follows the locale", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/ru$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  for (const l of ["kk", "en"]) {
    await page.goto(`/${l}`);
    await expect(page.locator("html")).toHaveAttribute("lang", l);
  }
});

test("old links redirect into Russian and keep their query and fragment", async ({ page }) => {
  await page.goto("/results");
  await expect(page).toHaveURL(/\/ru\/results$/);
  await page.goto("/r#v1.broken");
  await expect(page).toHaveURL(/\/ru\/r#v1\.broken$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("the switcher changes the language and keeps the page", async ({ page }) => {
  await page.goto("/ru/compare");
  await page.getByRole("link", { name: "EN", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/compare$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your properties");
  await page.getByRole("link", { name: "KZ", exact: true }).click();
  await expect(page).toHaveURL(/\/kk\/compare$/);
});

test("every visible string is translated, and no screen shows a dollar sign", async ({ page }) => {
  test.slow();
  const id = await seed(page);
  const routes = ["", "/analyze", "/results", "/performance", "/compare", `/report/${id}`];
  for (const l of ["ru", "kk", "en"]) {
    for (const r of routes) {
      await page.goto(`/${l}${r}`);
      await expect(page.locator("main")).not.toHaveAttribute("aria-busy", "true");
      await expect(page.locator(".skel")).toHaveCount(0);
      const tabs = r === "/performance" ? [0, 1, 2] : [null];
      for (const tab of tabs) {
        if (tab !== null) await page.getByRole("tab").nth(tab).click();
        const where = `${l}${r}${tab ? ` tab ${tab}` : ""}`;
        expect(await visibleText(page), where).not.toContain("$");
        if (l !== "en") expect(await latinWords(page), where).toEqual([]);
      }
    }
  }
});

test("old saved data is left untouched, and can be exported once", async ({ page }) => {
  const V3 = JSON.stringify({ v: 3, deals: [], activeId: null, note: "old US data" });
  const V1 = JSON.stringify({ v: 1, property: null });
  await page.goto("/ru");
  await page.evaluate(([a, b]) => { localStorage.clear(); localStorage.setItem("rentwise:v3", a); localStorage.setItem("rentwise:v1", b); }, [V3, V1]);
  await page.goto("/ru/compare");
  const notice = page.getByRole("region", { name: /прежней версии/ });
  await expect(notice).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), notice.getByRole("button", { name: /Скачать старые данные/ }).click()]);
  const fs = await import("node:fs/promises");
  const saved = JSON.parse(await fs.readFile((await download.path())!, "utf8"));
  expect(saved).toEqual({ "rentwise:v3": V3, "rentwise:v1": V1 });

  // Nothing was migrated, rewritten or deleted.
  expect(await page.evaluate(() => [localStorage.getItem("rentwise:v3"), localStorage.getItem("rentwise:v1")])).toEqual([V3, V1]);
  await expect(page.getByRole("heading", { name: "Ещё нет квартир" })).toBeVisible();

  await notice.getByRole("button", { name: "Скрыть" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(notice).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("rentwise:v3"))).toBe(V3);
});
