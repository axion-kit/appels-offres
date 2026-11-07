import { describe, expect, it } from "vitest";
import { emailSchema, inscriptionSchema, motDePasseSchema, nomSchema, texteDuFormulaire } from "./validation";

describe("validation des saisies", () => {
  it("range l'adresse : majuscules, espaces autour", () => {
    expect(emailSchema.parse("  Ana@Exemple.FR \t")).toBe("ana@exemple.fr");
  });
  it("refuse une adresse invalide ou trop longue", () => {
    expect(emailSchema.safeParse("pas une adresse").success).toBe(false);
    expect(emailSchema.safeParse(`${"a".repeat(250)}@x.fr`).success).toBe(false);
  });
  it("mot de passe : 12 caractères minimum, comptés comme une personne les compte", () => {
    expect(motDePasseSchema.safeParse("court").success).toBe(false);
    expect(motDePasseSchema.safeParse("onze-lettre").success).toBe(false);
    expect(motDePasseSchema.safeParse("douze-lettre").success).toBe(true);
    expect(motDePasseSchema.safeParse("😀".repeat(11)).success).toBe(false);
    expect(motDePasseSchema.safeParse("é".repeat(12)).success).toBe(true);
    expect(motDePasseSchema.safeParse("a".repeat(129)).success).toBe(false);
  });
  it("nom d'entreprise : espaces nettoyés, accents conservés, caractères cachés refusés", () => {
    expect(nomSchema.parse("  Café   des  Amis ")).toBe("Café des Amis");
    expect(nomSchema.parse("Café")).toBe("Café");
    expect(nomSchema.safeParse("a").success).toBe(false);
    expect(nomSchema.safeParse("x".repeat(101)).success).toBe(false);
    expect(nomSchema.safeParse("Nom\u0000caché").success).toBe(false);
    expect(nomSchema.safeParse("Nom‮inversé").success).toBe(false);
  });
  it("l'acceptation des textes est obligatoire", () => {
    const base = { email: "a@b.fr", motDePasse: "douze-lettre", nomEntreprise: "Ana" };
    expect(inscriptionSchema.safeParse({ ...base, accepte: false }).success).toBe(false);
    expect(inscriptionSchema.safeParse({ ...base, accepte: true }).success).toBe(true);
  });
  it("lit un champ de formulaire, même absent ou envoyé comme fichier", () => {
    const donnees = new FormData();
    donnees.set("a", "x");
    donnees.set("f", new Blob(["x"]), "f.txt");
    expect(texteDuFormulaire(donnees, "a")).toBe("x");
    expect(texteDuFormulaire(donnees, "f")).toBe("");
    expect(texteDuFormulaire(donnees, "absent")).toBe("");
  });
});
