import { defineConfig } from "@playwright/test";

// Dedicated demo-mode dev server for E2E — kept off the real :3000 dev server
// and the manual :3010 demo launcher so a test run never collides with them.
const APP_URL = process.env.E2E_APP_URL ?? "http://127.0.0.1:3030";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  webServer: process.env.E2E_APP_URL
    ? undefined
    : {
        command:
          "VITE_DATA_MODE=demo NODE_NO_WARNINGS=1 bunx vite dev --port 3030 --strictPort --host 127.0.0.1",
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
