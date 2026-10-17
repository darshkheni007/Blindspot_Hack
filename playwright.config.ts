import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

const dev = process.env.DATABASE_URL ?? "";
const testDb = process.env.DATABASE_URL_TEST ?? dev.replace(/\/[^/?"]+(\?|$)/, "/blindspot_test$1");
const PORT = 3101;

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: testDb,
      STORAGE_LOCAL_DIR: "./.e2e-storage",
      ANALYSIS_PROVIDER: "mock",
      AUTH_URL: `http://localhost:${PORT}`,
      // The bundled PGlite dev server accepts a single connection at a time.
      DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX ?? "1",
    },
  },
});
