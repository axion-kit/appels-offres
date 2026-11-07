import { describe, expect, it } from "vitest";
import { motsInterdits, normaliser } from "./langage";

describe("langage sans jargon", () => {
  it("normalise accents et casse", () => {
    expect(normaliser("Déployer À")).toBe("deployer a");
  });
  it("laisse passer un texte simple", () => {
    expect(motsInterdits("Ajouter un élément. Vos changements sont enregistrés.")).toEqual([]);
  });
  it("attrape le jargon, sans tenir compte des accents ni de la casse", () => {
    const r = motsInterdits("Le Token et l'API ; DÉPLOYER la base de données");
    expect(r).toEqual(expect.arrayContaining(["token", "api", "deployer", "base de donnees"]));
  });
  it("n'attrape pas un mot qui en contient un autre (capital, apiculteur)", () => {
    expect(motsInterdits("Capital de l'apiculteur, logement")).toEqual([]);
  });
  it("attrape les motifs techniques", () => {
    expect(motsInterdits("Erreur 500")).toContain("erreur 500");
    expect(motsInterdits("Bonjour {{nom}}")).toContain("{{");
    expect(motsInterdits("valeur undefined")).toContain("undefined");
    expect(motsInterdits("id 3f2a9c1e-8b7d-4c6a-9e5f-1a2b3c4d5e6f")).toContain("identifiant long");
    expect(motsInterdits("voir /usr/local/bin")).toContain("chemin de fichier");
    expect(motsInterdits("Lorem ipsum")).toContain("lorem");
  });
  it("attrape les mots anglais d'interface", () => {
    expect(motsInterdits("Dashboard Settings Submit")).toEqual(expect.arrayContaining(["dashboard", "settings", "submit"]));
  });
  it("laisse passer des mots français courants (dépôt, cache, log, intégration)", () => {
    expect(motsInterdits("Dépôt de garantie, cache-cou, logement, intégration des nouveaux")).toEqual([]);
  });
  it("attrape les expressions techniques précises", () => {
    expect(motsInterdits("Vider le cache")).toContain("vider le cache");
    expect(motsInterdits("Dépôt git")).toContain("depot git");
    expect(motsInterdits("Voir les logs")).toContain("les logs");
  });
});
