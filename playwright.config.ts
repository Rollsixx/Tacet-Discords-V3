import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 180000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", headless: true, trace: "retain-on-failure" },
  webServer: { command: "node scripts/start-browser-server.mjs", url: "http://127.0.0.1:3100", reuseExistingServer: false, timeout: 30000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
