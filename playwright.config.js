import { defineConfig, devices } from "@playwright/test";

// PLAN-GLM5.2 task 1: real pixel-acceptance harness. Two viewports; headless
// WebGL uses ANGLE/SwiftShader flags so bloom/PMREM don't black-screen.
export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.spec\.js$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // SwiftShader software rendering: rendering is fast (~10ms/frame) but each
  // page.screenshot triggers a multi-second ReadPixels stall. The full suite
  // runs ~30 min under SwiftShader at 1280x1280 (authorized by user). Allow
  // generous per-test time.
  timeout: 600000,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    // SwiftShader's GPU ReadPixels stalls make full-viewport screenshots (esp.
    // 1280x1280) take 30-60s each; allow generous action time.
    actionTimeout: 120000,
    expect: { timeout: 30000 },
    launchOptions: {
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--ignore-gpu-blocklist",
        "--enable-unsafe-swiftshader"
      ]
    }
  },
  projects: [
    {
      name: "desktop",
      use: {
        viewport: { width: 1280, height: 1280 },
        deviceScaleFactor: 1
      }
    },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1
      }
    }
  ],
  webServer: {
    command: "npm run preview",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
    cwd: process.cwd()
  }
});
