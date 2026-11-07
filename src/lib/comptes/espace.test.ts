import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { avancer, creerBanc, formulaire, type Banc } from "./banc";
import { contexteDeLUtilisateur, essaiTermine } from "./contexte";
import type { ContexteEspace } from "./env";
import { ajouterElement, changerRole, listerElements, listerMembres, lireElement } from "./espace";
import { inscrire } from "./inscription";
import { journalAudit, user } from "./schema";

let banc: Banc;
let a: ContexteEspace;
let b: ContexteEspace;

async function ouvrir(email: string): Promise<ContexteEspace> {
  const env = banc.env;
  await inscrire(env, formulaire(env, { email, nomEntreprise: `Espace ${email}` }), `192.0.2.${email.length}`);
  const [p] = await env.base.select().from(user).where(eq(user.email, email));
  await env.base.update(user).set({ emailVerified: true }).where(eq(user.id, p?.id ?? ""));
  const ctx = await contexteDeLUtilisateur(env, p?.id ?? "");
  if (ctx === null) throw new Error("contexte absent");
  return ctx;
}

beforeAll(async () => {
  banc = await creerBanc();
  a = await ouvrir("a@exemple.fr");
  b = await ouvrir("bb@exemple.fr");
});

describe("isolation des espaces", () => {
  it("un compte ne lit jamais les données d'un autre espace", async () => {
    const env = banc.env;
    const secret = await ajouterElement(env, a, "Secret de A");
    await ajouterElement(env, b, "Donnée de B");
    expect((await listerElements(env, a)).map((e) => e.titre)).toEqual(["Secret de A"]);
    expect((await listerElements(env, b)).map((e) => e.titre)).toEqual(["Donnée de B"]);
    // Même en connaissant l'identifiant exact, B ne voit rien de A.
    expect(await lireElement(env, b, secret)).toBeNull();
    expect((await lireElement(env, a, secret))?.titre).toBe("Secret de A");
  });
  it("les membres listés et les rôles changés restent dans l'espace", async () => {
    const env = banc.env;
    expect((await listerMembres(env, a)).map((m) => m.email)).toEqual(["a@exemple.fr"]);
    const [chezB] = await listerMembres(env, b);
    expect(await changerRole(env, a, chezB?.id ?? "", "membre")).toBe(false);
    expect(await changerRole(env, a, "inexistant", "membre")).toBe(false);
  });
  it("le contexte vient du compte : un compte non vérifié ou fermé n'a pas d'espace", async () => {
    const env = banc.env;
    await env.base.update(user).set({ emailVerified: false }).where(eq(user.id, b.utilisateurId));
    expect(await contexteDeLUtilisateur(env, b.utilisateurId)).toBeNull();
    await env.base.update(user).set({ emailVerified: true, desactiveLe: env.maintenant }).where(eq(user.id, b.utilisateurId));
    expect(await contexteDeLUtilisateur(env, b.utilisateurId)).toBeNull();
    await env.base.update(user).set({ desactiveLe: null }).where(eq(user.id, b.utilisateurId));
    expect(await contexteDeLUtilisateur(env, "inconnu")).toBeNull();
    expect((await contexteDeLUtilisateur(env, b.utilisateurId))?.espaceId).toBe(b.espaceId);
  });
});

describe("fin de l'essai", () => {
  it("après la date, les données de l'espace ne sont plus accessibles", async () => {
    const env = banc.env;
    const apres = avancer(env, 31 * 24 * 60 * 60 * 1000);
    expect(essaiTermine(a, env.maintenant)).toBe(false);
    expect(essaiTermine(a, apres.maintenant)).toBe(true);
    expect(essaiTermine({ essaiJusquAu: null }, apres.maintenant)).toBe(false);
    await expect(listerElements(apres, a)).rejects.toThrow("essai_termine");
    await expect(ajouterElement(apres, a, "x")).rejects.toThrow("essai_termine");
    await expect(lireElement(apres, a, "x")).rejects.toThrow("essai_termine");
  });
});

describe("rôles", () => {
  it("garde toujours un propriétaire, journalise les changements", async () => {
    const env = banc.env;
    const [moi] = await listerMembres(env, a);
    expect(await changerRole(env, a, moi?.id ?? "", "membre")).toBe(false);
    expect(await changerRole(env, { ...a, role: "membre" }, moi?.id ?? "", "membre")).toBe(false);
    expect(await changerRole(env, a, moi?.id ?? "", "proprietaire")).toBe(true);
    const actions = await env.base.select().from(journalAudit).where(eq(journalAudit.utilisateurId, a.utilisateurId));
    expect(actions.map((j) => j.action)).toContain("changement_role");
  });
});
