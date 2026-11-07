import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DOCUMENTS_REQUIS, analyserTexte, lancer, verifierDossier } from "./verifier";

const racine = join(import.meta.dirname, "..", "..", "..");
const modele = (nom: string) => join(racine, "docs", `vente-${nom}`);
const temporaires: string[] = [];
function dossier(contenu: (nom: string) => string | null): string {
  const d = mkdtempSync(join(tmpdir(), "vente-"));
  temporaires.push(d);
  for (const nom of DOCUMENTS_REQUIS) {
    const c = contenu(nom);
    if (c !== null) writeFileSync(join(d, nom), c);
  }
  return d;
}
afterEach(() => temporaires.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

describe("analyserTexte", () => {
  it("repère les trous avec leur ligne", () => {
    expect(analyserTexte("ok\nNom : [À REMPLIR : nom]\n[A REMPLIR] et [À REMPLIR]").trous).toEqual([2, 3, 3]);
  });
  it("compte les marques de relecture", () => {
    expect(analyserTexte("[À FAIRE RELIRE PAR UN PROFESSIONNEL] x [À FAIRE RELIRE PAR UN PROFESSIONNEL]").marques).toBe(2);
  });
  it("ne voit rien dans un texte rempli", () => {
    expect(analyserTexte("Tout est écrit.")).toEqual({ trous: [], marques: 0, exonerations: [] });
  });
  it("compte une case non cochée comme un trou", () => {
    expect(analyserTexte("- [x] fait\n- [ ] à faire\n  - [ ] sous-tâche").trous).toEqual([2, 3]);
  });
  it("détecte un [À REMPLIR sans crochet fermant ou sur plusieurs lignes", () => {
    expect(analyserTexte("a [À REMPLIR : nom\nb").trous).toEqual([1]);
    expect(analyserTexte("a [À REMPLIR :\nsuite\n]").trous).toEqual([1]);
  });
  it("repère toute exonération de TVA écrite", () => {
    for (const phrase of ["TVA non applicable", "art. 293 B du CGI", "293B", "exonéré de TVA", "exonération de TVA", "T.V.A. : exonération", "taxe sur la valeur ajoutée non applicable", "franchise en base"]) {
      expect(analyserTexte(phrase).exonerations, phrase).toEqual([1]);
    }
    expect(analyserTexte("TVA 20 %, toujours facturée").exonerations).toEqual([]);
  });
  it("ne confond pas une clause hors TVA avec une exonération", () => {
    for (const phrase of ["Droit de rétractation : non applicable entre professionnels", "Le prestataire est exonéré de responsabilité en cas de force majeure"]) {
      expect(analyserTexte(phrase).exonerations, phrase).toEqual([]);
    }
  });
  it("repère aussi les cases vides écrites avec *, + ou une numérotation", () => {
    for (const ligne of ["* [ ] a", "+ [ ] b", "1. [ ] c"]) expect(analyserTexte(ligne).trous, ligne).toEqual([1]);
    expect(analyserTexte("- [x] fait").trous).toEqual([]);
  });
});

describe("verifierDossier", () => {
  it("accepte des documents sans trou", () => {
    expect(verifierDossier(dossier(() => "Rempli.")).ok).toBe(true);
  });
  it("refuse un trou restant", () => {
    const r = verifierDossier(dossier((n) => (n === "02-devis.md" ? "Prix : [À REMPLIR : montant]" : "ok")));
    expect(r.ok).toBe(false);
    expect(r.problemes[0]).toContain("02-devis.md");
  });
  it("refuse un document manquant", () => {
    const r = verifierDossier(dossier((n) => (n === "10-conservation.md" ? null : "ok")));
    expect(r.ok).toBe(false);
    expect(r.problemes.join()).toContain("10-conservation.md : document manquant");
  });
  it("refuse un dossier introuvable", () => {
    expect(verifierDossier(join(tmpdir(), "inexistant-vente-xyz")).ok).toBe(false);
  });
  it("avertit pour la relecture, et refuse en mode strict", () => {
    const d = dossier(() => "ok [À FAIRE RELIRE PAR UN PROFESSIONNEL]");
    const doux = verifierDossier(d);
    expect(doux.ok).toBe(true);
    expect(doux.avertissements.length).toBe(DOCUMENTS_REQUIS.length);
    expect(verifierDossier(d, { strictPro: true }).ok).toBe(false);
  });
});

describe("règles strictes", () => {
  it("refuse une exonération de TVA dans un document rempli", () => {
    const r = verifierDossier(dossier((n) => (n === "04-mentions-legales.md" ? "TVA non applicable" : "ok")));
    expect(r.ok).toBe(false);
    expect(r.problemes.join()).toContain("exonération de TVA");
  });
  it("refuse une case non cochée", () => {
    expect(verifierDossier(dossier((n) => (n === "07-accueil-client.md" ? "- [ ] sauvegarde" : "ok"))).ok).toBe(false);
  });
  it("refuse un [À REMPLIR sans crochet fermant", () => {
    expect(verifierDossier(dossier((n) => (n === "02-devis.md" ? "Prix [À REMPLIR : x" : "ok"))).ok).toBe(false);
  });
  it("le mode strict refuse aussi la mention « modèle à faire relire par un professionnel »", () => {
    const d = dossier(() => "> **Modèle à faire relire par un professionnel** avant usage");
    expect(verifierDossier(d).ok).toBe(true);
    expect(verifierDossier(d, { strictPro: true }).ok).toBe(false);
  });
  it("accepte les noms préfixés vente-", () => {
    const d = mkdtempSync(join(tmpdir(), "vente-"));
    temporaires.push(d);
    for (const nom of DOCUMENTS_REQUIS) writeFileSync(join(d, `vente-${nom}`), "ok");
    expect(verifierDossier(d).ok).toBe(true);
  });
});

describe("modèles du dépôt", () => {
  it("tous les documents requis ont un modèle avec des trous", () => {
    for (const nom of DOCUMENTS_REQUIS) {
      expect(analyserTexte(readFileSync(modele(nom), "utf8")).trous.length, nom).toBeGreaterThan(0);
    }
  });
  it("les modèles juridiques portent la mention « modèle à faire relire par un professionnel »", () => {
    const juridiques = ["02-devis.md", "03-cgv-cgu.md", "04-mentions-legales.md", "05-confidentialite-registre.md", "06-contrat-sous-traitance.md", "08-export-sortie.md", "09-suspension.md", "10-conservation.md"];
    for (const nom of juridiques) {
      const texte = readFileSync(modele(nom), "utf8");
      expect(texte.toLowerCase(), nom).toContain("modèle à faire relire par un professionnel");
      expect(analyserTexte(texte).marques, nom).toBeGreaterThan(0);
    }
  });
  it("il n'y a pas d'autre modèle vente que les documents requis, plus le mode d'emploi et le guide", () => {
    const presents = readdirSync(join(racine, "docs")).filter((n) => n.startsWith("vente-"));
    const attendus = DOCUMENTS_REQUIS.map((n) => `vente-${n}`).concat("vente-lisez-moi.md");
    expect(presents.sort()).toEqual(attendus.sort());
  });
});

describe("commande en ligne", () => {
  it("sort en erreur tant qu'il reste un trou, en succès sinon", () => {
    const avec = lancer([dossier(() => "[À REMPLIR]")]);
    expect(avec.code).toBe(1);
    expect(avec.erreurs.join()).toContain("refusée");
    const sans = dossier(() => "ok");
    mkdirSync(join(sans, "autre"));
    const r = lancer([sans]);
    expect(r.code).toBe(0);
    expect(r.infos.join()).toContain("aucun trou");
  });
  it("--relecture-obligatoire rend les marques bloquantes", () => {
    const d = dossier(() => "[À FAIRE RELIRE PAR UN PROFESSIONNEL]");
    expect(lancer([d]).code).toBe(0);
    expect(lancer([d, "--relecture-obligatoire"]).code).toBe(1);
  });
});
