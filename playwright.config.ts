import { defineConfig, devices } from '@playwright/test';

/**
 * ChronoGraph UI Testing Configuration
 * Tests both web version (mock data) and desktop Tauri app (real data)
 */
export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  use: {
    baseURL: 'http://localhost:1423',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium-web',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
      testMatch: /.*web\.spec\.ts/,
    },
    {
      name: 'firefox-web',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 }
      },
      testMatch: /.*web\.spec\.ts/,
    },
    {
      name: 'webkit-web',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 }
      },
      testMatch: /.*web\.spec\.ts/,
    },
    {
      name: 'desktop-tauri',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
      testMatch: /.*desktop\.spec\.ts/,
    }
  ],

  webServer: {
    command: 'npm run dev -- --port 1423',
    port: 1423,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  // Global test configuration
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
    // Visual comparison threshold
    threshold: 0.1,
    toHaveScreenshot: { threshold: 0.2 },
    toMatchSnapshot: { threshold: 0.2 }
  }
});