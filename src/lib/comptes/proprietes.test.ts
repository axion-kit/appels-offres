import { describe, expect, it } from "vitest";
import { lireProprietes, proprietesActuelles } from "./proprietes";

describe("réglages de l'outil", () => {
  it("par défaut : sur invitation, 30 jours d'essai", () => {
    expect(lireProprietes(null)).toEqual({ inscription: "sur_invitation", essaiJours: 30 });
    expect(lireProprietes("")).toEqual({ inscription: "sur_invitation", essaiJours: 30 });
  });
  it("lit les trois modes, les commentaires et les guillemets", () => {
    expect(lireProprietes("inscription: libre # ouvert\nessai_jours: 14").inscription).toBe("libre");
    expect(lireProprietes("# mot\ninscription: \"fermee\"").inscription).toBe("fermee");
    expect(lireProprietes("inscription: sur_invitation\r\nessai_jours: 0").essaiJours).toBe(0);
    expect(lireProprietes("ligne sans deux points\n: vide\ninscription: libre").inscription).toBe("libre");
  });
  it("une valeur inconnue ferme les inscriptions", () => {
    expect(lireProprietes("inscription: ouverte").inscription).toBe("fermee");
    expect(lireProprietes("inscription: LIBRE").inscription).toBe("fermee");
  });
  it("une durée invalide revient à 30 jours", () => {
    expect(lireProprietes("essai_jours: abc").essaiJours).toBe(30);
    expect(lireProprietes("essai_jours: -3").essaiJours).toBe(30);
  });
  it("la surcharge de déploiement l'emporte sur le fichier", () => {
    expect(lireProprietes("inscription: fermee", "libre").inscription).toBe("libre");
    expect(lireProprietes("inscription: libre", "nimporte").inscription).toBe("fermee");
  });
  it("le fichier du dépôt est lisible et garde « sur invitation » par défaut", () => {
    const avant = process.env.COMPTES_INSCRIPTION;
    delete process.env.COMPTES_INSCRIPTION;
    expect(proprietesActuelles().inscription).toBe("sur_invitation");
    if (avant !== undefined) process.env.COMPTES_INSCRIPTION = avant;
  });
  it("sans fichier lisible, les valeurs par défaut s'appliquent", () => {
    const dossier = process.cwd();
    process.chdir("/");
    expect(proprietesActuelles().inscription).toBe("sur_invitation");
    process.chdir(dossier);
  });
});
