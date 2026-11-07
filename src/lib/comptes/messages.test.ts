import { describe, expect, it } from "vitest";
import { expediteurConsole, expediteurDeTest, expediteurMemoire, boiteEnvoi } from "./expediteur";
import { MESSAGES_ECRAN, messageDejaInscrit, messageFermetureCompte, messageInvitation, messageLienMagique, messageNouveauMotDePasse, messageVerification, texteMessage } from "./messages";

describe("messages", () => {
  it("les courriels portent le lien et restent en français simple", () => {
    const lien = "https://outil.exemple.fr/x";
    for (const m of [messageVerification("a@b.fr", lien), messageLienMagique("a@b.fr", lien), messageNouveauMotDePasse("a@b.fr", lien), messageDejaInscrit("a@b.fr", lien), messageInvitation("a@b.fr", lien, "Chez Chef", 7), messageInvitation("a@b.fr", lien, null, 7)]) {
      expect(m.texte).toContain(lien);
      expect(m.a).toBe("a@b.fr");
    }
    expect(messageInvitation("a@b.fr", "l", "Chez Chef", 7).texte).toContain("« Chez Chef »");
    expect(messageFermetureCompte("admin@b.fr", "p@b.fr", "Espace").texte).toContain("aucune donnée n'est effacée");
  });
  it("aucun mot technique dans les messages d'écran", () => {
    for (const texte of Object.values(MESSAGES_ECRAN)) expect(texte).not.toMatch(/token|session|erreur 500|\bAPI\b/i);
  });
  it("retrouve un message par son code, ignore les codes inconnus", () => {
    expect(texteMessage("envoye")).toBe(MESSAGES_ECRAN.envoye);
    expect(texteMessage("constructor")).toBeNull();
    expect(texteMessage("nimporte")).toBeNull();
    expect(texteMessage(undefined)).toBeNull();
  });
});

describe("expéditeurs", () => {
  const courriel = { a: "a@b.fr", sujet: "S", texte: "T" };
  it("la console écrit sans rien envoyer", async () => {
    await expect(expediteurConsole.envoyer(courriel)).resolves.toBeUndefined();
  });
  it("la boîte mémoire garde les 200 derniers messages", async () => {
    for (let i = 0; i < 205; i += 1) await expediteurMemoire.envoyer({ ...courriel, sujet: `S${i}` });
    expect(boiteEnvoi()).toHaveLength(200);
    expect(boiteEnvoi().at(-1)?.sujet).toBe("S204");
  });
  it("l'expéditeur de test garde ce qu'il reçoit", async () => {
    const e = expediteurDeTest();
    await e.envoyer(courriel);
    expect(e.envoyes).toEqual([courriel]);
  });
});
