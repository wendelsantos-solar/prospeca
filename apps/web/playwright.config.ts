import { defineConfig } from "@playwright/test";

const APP_URL = process.env.E2E_APP_URL ?? "http://127.0.0.1:8080";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  webServer: process.env.E2E_APP_URL
    ? undefined
    : {
        command: "VITE_DATA_MODE=demo bun run dev -- --host 127.0.0.1",
        url: APP_URL,
        timeout: 120_000,
        reuseExistingServer: false,
      },
  use: {
    baseURL: APP_URL,
    trace: "on-first-retry",
  },
  reporter: [["list"]],
});
