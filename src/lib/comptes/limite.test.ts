import { beforeAll, describe, expect, it } from "vitest";
import { creerBaseMemoire, type Base } from "./base";
import { autoriserPassage, autoriserToutes, cleLimite, controleIp } from "./limite";

const regle = { max: 3, fenetreMs: 60_000 };
const t0 = new Date("2026-11-07T10:00:00Z");
let base: Base;
beforeAll(async () => {
  base = await creerBaseMemoire();
});

describe("limitation de fréquence (fenêtre glissante en base)", () => {
  it("refuse au-delà du maximum puis libère quand la fenêtre a glissé", async () => {
    const cle = "essai-a";
    expect(await autoriserPassage(base, cle, regle, new Date(t0.getTime()))).toBe(true);
    expect(await autoriserPassage(base, cle, regle, new Date(t0.getTime() + 10_000))).toBe(true);
    expect(await autoriserPassage(base, cle, regle, new Date(t0.getTime() + 20_000))).toBe(true);
    expect(await autoriserPassage(base, cle, regle, new Date(t0.getTime() + 30_000))).toBe(false);
    // 65 s après le premier passage : il sort de la fenêtre, une place se libère.
    expect(await autoriserPassage(base, cle, regle, new Date(t0.getTime() + 65_000))).toBe(true);
    expect(await autoriserPassage(base, cle, regle, new Date(t0.getTime() + 66_000))).toBe(false);
  });
  it("chaque clé a son propre compteur", async () => {
    for (let i = 0; i < 3; i += 1) await autoriserPassage(base, "essai-b", regle, t0);
    expect(await autoriserPassage(base, "essai-b", regle, t0)).toBe(false);
    expect(await autoriserPassage(base, "essai-c", regle, t0)).toBe(true);
  });
  it("des demandes simultanées ne dépassent pas le maximum", async () => {
    const resultats = await Promise.all(Array.from({ length: 8 }, () => autoriserPassage(base, "essai-d", regle, t0)));
    expect(resultats.filter(Boolean)).toHaveLength(3);
  });
  it("toutes les clés comptent, et l'adresse n'est pas écrite en clair", async () => {
    const cles = [
      { cle: cleLimite("secret", "ip", "1.2.3.4"), regle: { max: 1, fenetreMs: 60_000 } },
      { cle: cleLimite("secret", "email", "ana@exemple.fr"), regle },
    ];
    expect(await autoriserToutes(base, cles, t0)).toBe(true);
    expect(await autoriserToutes(base, cles, t0)).toBe(false);
    expect(cles[0]?.cle).not.toContain("1.2.3.4");
    expect(cleLimite("secret", "ip", "x")).not.toBe(cleLimite("autre", "ip", "x"));
  });
});

describe("limite par adresse IP", () => {
  const plafond = { famille: "inscription-global", regle: { max: 30, fenetreMs: 3_600_000 } };
  it("adresse connue : compteur propre à cette adresse", () => {
    const [a] = controleIp("secret", "inscription-ip", "203.0.113.1", regle, plafond);
    const [b] = controleIp("secret", "inscription-ip", "203.0.113.2", regle, plafond);
    expect(a?.regle).toBe(regle);
    expect(a?.cle).not.toBe(b?.cle);
  });
  it("adresse inconnue avec plafond : un seul compteur global, jamais « rien »", () => {
    const controles = controleIp("secret", "inscription-ip", "inconnue", regle, plafond);
    expect(controles).toHaveLength(1);
    expect(controles[0]?.regle).toEqual(plafond.regle);
    expect(controles[0]?.cle).toBe(cleLimite("secret", "inscription-global", "global"));
  });
  it("adresse inconnue sans plafond : pas de contrôle par adresse (la limite par e-mail reste)", () => {
    expect(controleIp("secret", "connexion-ip", "inconnue", regle)).toEqual([]);
  });
});
