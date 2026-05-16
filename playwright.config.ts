import { defineConfig, devices } from "@playwright/test";

/**
 * E2E configuration.
 *
 * Requires:
 *   - Dashboard dev server on port 5173  (pnpm --filter @eso/dashboard dev)
 *   - API server on port 3001            (pnpm --filter @eso/api dev)
 *   - ESO_TEST_TOKEN env var: a valid JWT for a supervisor account (staging Auth0)
 *
 * In CI these are started by the webServer blocks below.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      command: "pnpm --filter @eso/api dev",
      url: "http://localhost:3001/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgresql://eso:eso@localhost:5432/eso",
        AUTH0_DOMAIN: process.env.AUTH0_DOMAIN ?? "",
        AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE ?? "",
        KAFKA_BROKERS: process.env.KAFKA_BROKERS ?? "localhost:9092",
        PORT: "3001",
      },
    },
    {
      command: "pnpm --filter @eso/dashboard dev",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        VITE_API_URL: "http://localhost:3001",
        VITE_WS_URL: "http://localhost:3001",
      },
    },
  ],
});
