import { afterEach, describe, expect, it, vi } from "vitest";
import { lireAdministrateurs, obtenirServices, reinitialiserServices as vider } from "./services";

describe("services", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vider();
  });
  it("lit la liste des administrateurs", () => {
    expect(lireAdministrateurs(" Admin@Exemple.fr, ,b@exemple.fr ")).toEqual(["admin@exemple.fr", "b@exemple.fr"]);
    expect(lireAdministrateurs(undefined)).toEqual([]);
  });
  it("refuse de démarrer sans base branchée", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("COMPTES_BASE", "");
    delete process.env.DATABASE_URL;
    await expect(obtenirServices()).rejects.toThrow("Base non branchée");
  });
  it("une base réelle exige un secret long et une adresse publique", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://x");
    vi.stubEnv("BETTER_AUTH_SECRET", "trop court");
    await expect(obtenirServices()).rejects.toThrow("BETTER_AUTH_SECRET");
    vider();
    vi.stubEnv("BETTER_AUTH_SECRET", "s".repeat(40));
    vi.stubEnv("BETTER_AUTH_URL", "");
    await expect(obtenirServices()).rejects.toThrow("BETTER_AUTH_URL");
    vider();
    vi.stubEnv("BETTER_AUTH_URL", "https://outil.exemple.fr");
    await expect(obtenirServices()).rejects.toThrow("Expéditeur non branché");
  });
  it("en mémoire : boîte de test fermée sans demande expresse, ouverte avec, jamais chez l'hébergeur", { timeout: 30_000 }, async () => {
    vi.stubEnv("COMPTES_BASE", "memoire");
    delete process.env.DATABASE_URL;
    vi.stubEnv("COMPTES_DELAI_MIN_MS", "");
    expect((await obtenirServices()).boiteDeTest).toBe(false);
    expect((await obtenirServices()).delaiMinMs).toBe(3000);
    vider();
    vi.stubEnv("COMPTES_BOITE_TEST", "oui");
    vi.stubEnv("COMPTES_DELAI_MIN_MS", "1500");
    vi.stubEnv("COMPTES_ADMINISTRATEURS", "Chef@Exemple.fr");
    const s = await obtenirServices();
    expect(s.boiteDeTest).toBe(true);
    expect(s.delaiMinMs).toBe(1500);
    expect(s.administrateurs).toEqual(["chef@exemple.fr"]);
    vider();
    vi.stubEnv("VERCEL", "1");
    expect((await obtenirServices()).boiteDeTest).toBe(false);
  });
  it("relais de confiance : activé tout seul chez Vercel, réglable sinon", { timeout: 30_000 }, async () => {
    vi.stubEnv("COMPTES_BASE", "memoire");
    delete process.env.DATABASE_URL;
    vi.stubEnv("COMPTES_PROXY_FIABLE", "");
    delete process.env.COMPTES_PROXY_FIABLE;
    delete process.env.VERCEL;
    expect((await obtenirServices()).proxyFiable).toBe(false);
    vider();
    vi.stubEnv("VERCEL", "1");
    expect((await obtenirServices()).proxyFiable).toBe(true);
    vider();
    vi.stubEnv("COMPTES_PROXY_FIABLE", "oui");
    delete process.env.VERCEL;
    expect((await obtenirServices()).proxyFiable).toBe(true);
  });
  it("production sans réglage du relais et hors Vercel : inscription libre refusée, avec un message clair dans le journal", { timeout: 30_000 }, async () => {
    const journal = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("COMPTES_BASE", "memoire");
    delete process.env.DATABASE_URL;
    delete process.env.COMPTES_PROXY_FIABLE;
    delete process.env.VERCEL;
    vi.stubEnv("NODE_ENV", "production");
    expect((await obtenirServices()).inscriptionLibreBloquee).toBe(true);
    expect(journal).toHaveBeenCalledWith(expect.stringContaining("COMPTES_PROXY_FIABLE"));
    // Avec un réglage explicite (même « non ») ou chez Vercel : pas de blocage.
    vider();
    vi.stubEnv("COMPTES_PROXY_FIABLE", "non");
    expect((await obtenirServices()).inscriptionLibreBloquee).toBe(false);
    vider();
    delete process.env.COMPTES_PROXY_FIABLE;
    vi.stubEnv("VERCEL", "1");
    expect((await obtenirServices()).inscriptionLibreBloquee).toBe(false);
    // Hors production : jamais bloqué.
    vider();
    delete process.env.VERCEL;
    vi.stubEnv("NODE_ENV", "development");
    expect((await obtenirServices()).inscriptionLibreBloquee).toBe(false);
    journal.mockRestore();
  });
  it("plafond global d'inscription : 30 par heure, réglable", { timeout: 30_000 }, async () => {
    vi.stubEnv("COMPTES_BASE", "memoire");
    delete process.env.DATABASE_URL;
    delete process.env.COMPTES_PLAFOND_INSCRIPTION_GLOBAL;
    expect((await obtenirServices()).plafondInscriptionGlobal).toBe(30);
    vider();
    vi.stubEnv("COMPTES_PLAFOND_INSCRIPTION_GLOBAL", "12");
    expect((await obtenirServices()).plafondInscriptionGlobal).toBe(12);
  });
});
