import { defineConfig, devices } from "@playwright/test";

const PORT = 3300;
// E2E_BASE_URL=https://<prod> npx playwright test → runs the same journey against production.
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "safari", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } },
    { name: "iphone", use: { ...devices["iPhone 13"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `npm run build && npx next start -p ${PORT}`, url: baseURL, timeout: 240_000, reuseExistingServer: false }, // never test a stale build
});
