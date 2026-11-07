import { expect, test, type Browser, type Page } from "@playwright/test";

const ORIGINE = "http://localhost:3100";
const MOT_DE_PASSE = "un mot de passe solide";
let rang = 0;

function adresseUnique(projet: string, prefixe: string) {
  rang += 1;
  return `${prefixe}-${projet}-${Date.now()}-${rang}@exemple.fr`;
}

// Chaque parcours vient d'une adresse réseau différente, comme des personnes différentes.
async function nouveauVisiteur(browser: Browser) {
  rang += 1;
  const contexte = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": `203.0.113.${(rang * 7 + Date.now()) % 250}` },
  });
  return { contexte, page: await contexte.newPage() };
}

async function dernierLien(page: Page, adresse: string, sujet: string): Promise<string> {
  const reponse = await page.request.get(`/api/test/boite?a=${encodeURIComponent(adresse)}`);
  const messages: { sujet: string; texte: string }[] = await reponse.json();
  const message = messages.filter((m) => m.sujet === sujet).pop();
  const lien = /https?:\/\/\S+/.exec(message?.texte ?? "");
  expect(lien, `message « ${sujet} » reçu`).not.toBeNull();
  return lien?.[0] ?? "";
}

async function remplirInscription(page: Page, email: string, motDePasse = MOT_DE_PASSE) {
  await page.goto("/inscription");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(motDePasse);
  await page.getByLabel("Nom de votre entreprise").fill("Boulangerie Ana");
  await page.getByLabel(/J'accepte les/).check();
  // Le formulaire ne part pas avant le délai minimal de remplissage.
  await page.waitForTimeout(1700);
}

async function seConnecter(page: Page, email: string, motDePasse = MOT_DE_PASSE) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").first().fill(email);
  await page.getByLabel("Mot de passe").fill(motDePasse);
  await page.getByRole("button", { name: "Me connecter" }).click();
}

test("inscription libre, vérification, connexion, invitation d'un collègue", async ({ browser }, info) => {
  const { contexte, page } = await nouveauVisiteur(browser);
  const email = adresseUnique(info.project.name, "ana");
  const collegue = adresseUnique(info.project.name, "collegue");

  await remplirInscription(page, `  ${email.toUpperCase()} `);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Vérifiez votre boîte e-mail" })).toBeVisible();

  // Tant que l'adresse n'est pas confirmée, la connexion est refusée.
  await seConnecter(page, email);
  await expect(page.getByText("Votre adresse n'est pas encore confirmée")).toBeVisible();

  await page.goto(await dernierLien(page, email, "Confirmez votre adresse"));
  await expect(page.getByRole("heading", { name: "Adresse confirmée" })).toBeVisible();

  // Le mot de passe saisi à l'inscription est retiré : il ne marche plus.
  await seConnecter(page, email);
  await expect(page.getByText("Adresse ou mot de passe incorrect")).toBeVisible();
  // La personne choisit son mot de passe par « mot de passe oublié ».
  await page.goto("/mot-de-passe-oublie");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByRole("button", { name: "Recevoir le lien" }).click();
  await expect(page.getByText("un message vient de vous être envoyé")).toBeVisible();
  await page.goto(await dernierLien(page, email, "Choisir un nouveau mot de passe"));
  await page.getByLabel("Nouveau mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Votre mot de passe est changé")).toBeVisible();

  // Adresse saisie avec des majuscules et des espaces : la connexion marche quand même.
  await seConnecter(page, `  ${email.toUpperCase()}  `);
  await expect(page.getByRole("heading", { name: "Mon compte", exact: true })).toBeVisible();
  await expect(page.getByText("propriétaire de l'espace « Boulangerie Ana »")).toBeVisible();

  await page.getByLabel("Adresse e-mail du collègue").fill(collegue);
  await page.getByRole("button", { name: "Envoyer l'invitation" }).click();
  await expect(page.getByText("l'invitation est partie")).toBeVisible();

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();

  // Le collègue ouvre son lien : un seul usage.
  const lien = await dernierLien(page, collegue, "Votre invitation");
  await page.goto(lien);
  await expect(page.getByRole("heading", { name: "Votre invitation" })).toBeVisible();
  await page.getByLabel("Votre nom").fill("Camille Durand");
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByLabel(/J'accepte les/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText("Votre compte est prêt")).toBeVisible();

  await page.goto(lien);
  await expect(page.getByText("Ce lien n'est plus valable")).toBeVisible();

  await seConnecter(page, collegue);
  await expect(page.getByText("membre de l'espace « Boulangerie Ana »")).toBeVisible();
  await expect(page.getByLabel("Adresse e-mail du collègue")).toHaveCount(0);
  await contexte.close();
});

test("double clic sur le bouton : un seul compte, un seul message", async ({ browser }, info) => {
  const { contexte, page } = await nouveauVisiteur(browser);
  const email = adresseUnique(info.project.name, "double");
  await remplirInscription(page, email);
  await page.getByRole("button", { name: "Créer mon compte" }).dblclick();
  await expect(page.getByRole("heading", { name: "Vérifiez votre boîte e-mail" })).toBeVisible();
  const reponse = await page.request.get(`/api/test/boite?a=${encodeURIComponent(email)}`);
  const messages: { sujet: string }[] = await reponse.json();
  expect(messages.filter((m) => m.sujet === "Confirmez votre adresse")).toHaveLength(1);
  await contexte.close();
});

test("mot de passe trop court et envoi trop rapide refusés par le serveur", async ({ browser }, info) => {
  const { contexte, page } = await nouveauVisiteur(browser);
  const email = adresseUnique(info.project.name, "court");
  const envoyer = (motDePasse: string, ouvertLe: string) =>
    page.request.post("/api/inscription", {
      headers: { origin: ORIGINE },
      form: { email, mot_de_passe: motDePasse, nom_entreprise: "Atelier", accepte: "oui", site_web: "", ouvert_le: ouvertLe },
      maxRedirects: 0,
    });
  // Page d'inscription ouverte : on récupère la valeur cachée du formulaire.
  await page.goto("/inscription");
  const ouvertLe = await page.locator("input[name=ouvert_le]").inputValue();
  expect((await envoyer("court", ouvertLe)).headers().location).toContain("m=trop_vite");
  await page.waitForTimeout(1700);
  expect((await envoyer("court", ouvertLe)).headers().location).toContain("m=formulaire_invalide");
  await contexte.close();
});

test("champ piège rempli : rien n'est créé, même message de succès", async ({ browser }, info) => {
  const { contexte, page } = await nouveauVisiteur(browser);
  const email = adresseUnique(info.project.name, "robot");
  await page.goto("/inscription");
  const ouvertLe = await page.locator("input[name=ouvert_le]").inputValue();
  await page.waitForTimeout(1700);
  const reponse = await page.request.post("/api/inscription", {
    headers: { origin: ORIGINE },
    form: { email, mot_de_passe: MOT_DE_PASSE, nom_entreprise: "Atelier", accepte: "oui", site_web: "http://spam", ouvert_le: ouvertLe },
    maxRedirects: 0,
  });
  expect(reponse.headers().location).toContain("inscription_envoyee");
  const boite = await page.request.get(`/api/test/boite?a=${encodeURIComponent(email)}`);
  expect(await boite.json()).toEqual([]);
  await contexte.close();
});

test("formulaire envoyé d'un autre site : refusé", async ({ browser }) => {
  const { contexte, page } = await nouveauVisiteur(browser);
  const reponse = await page.request.post("/api/connexion", {
    headers: { origin: "http://autre-site.example" },
    form: { email: "a@exemple.fr", mot_de_passe: MOT_DE_PASSE },
    maxRedirects: 0,
  });
  expect(reponse.headers().location).toContain("origine_refusee");
  await contexte.close();
});

test("les liens internes de la librairie restent fermés", async ({ request }) => {
  const inscriptionDirecte = await request.post("/api/auth/sign-up/email", { data: { email: "x@exemple.fr", password: MOT_DE_PASSE, name: "x" } });
  expect([404, 405]).toContain(inscriptionDirecte.status());
  expect((await request.get("/api/auth/get-session")).status()).toBe(404);
});

test("l'écran tient dans la largeur et n'affiche aucun mot technique", async ({ page }) => {
  for (const chemin of ["/connexion", "/inscription", "/mot-de-passe-oublie", "/verifier-adresse"]) {
    await page.goto(chemin);
    const largeurPage = await page.evaluate(() => document.documentElement.scrollWidth);
    const largeurFenetre = await page.evaluate(() => window.innerWidth);
    expect(largeurPage).toBeLessThanOrEqual(largeurFenetre);
    const texte = await page.locator("body").innerText();
    expect(texte).not.toMatch(/token|session|erreur 500|\bAPI\b/i);
  }
});

test("page de compte fermée sans connexion", async ({ page }) => {
  await page.goto("/compte");
  await expect(page).toHaveURL(/\/connexion$/);
});
