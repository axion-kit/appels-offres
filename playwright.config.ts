import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  webServer: {
    command: "pnpm build && pnpm start --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Base en mémoire et courriels gardés en mémoire : réservé aux parcours automatiques.
    env: {
      COMPTES_BASE: "memoire",
      COMPTES_INSCRIPTION: "libre",
      COMPTES_PROXY_FIABLE: "oui",
      COMPTES_BOITE_TEST: "oui",
      COMPTES_DELAI_MIN_MS: "1500",
      BETTER_AUTH_URL: "http://localhost:3100",
    },
  },
  use: { baseURL: "http://localhost:3100" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "ordinateur", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
});
