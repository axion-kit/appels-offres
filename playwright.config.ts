import { defineConfig, devices } from "@playwright/test";

// En CI, l'étape « pnpm build » a déjà construit l'outil : le serveur d'essai ne fait que démarrer (une construction de moins).
const commande = process.env.CI ? "pnpm start --port 3100" : "pnpm build && pnpm start --port 3100";

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  webServer: {
    command: commande,
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Base en mémoire et courriels gardés en mémoire : réservé aux parcours automatiques.
    // Outil Appels d'offres : faux services seulement, aucun appel réel, aucune donnée réelle.
    env: {
      COMPTES_BASE: "memoire",
      COMPTES_INSCRIPTION: "libre",
      COMPTES_PROXY_FIABLE: "oui",
      COMPTES_BOITE_TEST: "oui",
      COMPTES_DELAI_MIN_MS: "1500",
      BETTER_AUTH_URL: "http://localhost:3100",
      AO_IA: "fausse",
      AO_CONSOLE: "fausse",
      AO_HORLOGE: "2026-11-02T08:00:00+01:00",
      AO_RESEAU_EXTERIEUR: "bloque",
    },
  },
  use: { baseURL: "http://localhost:3100" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "ordinateur", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
});
