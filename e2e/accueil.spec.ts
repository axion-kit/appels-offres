import { expect, test } from "@playwright/test";

test("l'accueil s'ouvre en vue mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Bonjour|Bonsoir/);
});

test("la page est en français et porte son titre", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page).toHaveTitle("Mon outil");
});
