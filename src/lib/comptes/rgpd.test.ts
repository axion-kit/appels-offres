import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { choisirMotDePasse, creerBanc, dernierLien, formulaire, type Banc } from "./banc";
import { contexteDeLUtilisateur } from "./contexte";
import type { ContexteEspace } from "./env";
import { ajouterElement, changerRole, listerMembres } from "./espace";
import { inscrire } from "./inscription";
import { accepterInvitation, inviterColleague } from "./invitation";
import { exporterDonnees, fermerCompte } from "./rgpd";
import { journalAudit, session, user } from "./schema";

let banc: Banc;
let ana: ContexteEspace;

beforeAll(async () => {
  banc = await creerBanc();
  const env = banc.env;
  await inscrire(env, formulaire(env, { email: "ana@exemple.fr" }), "192.0.2.1");
  const jeton = new URL(dernierLien(banc.expediteur, "ana@exemple.fr")).searchParams.get("token") ?? "";
  await env.auth.api.verifyEmail({ query: { token: jeton } });
  await choisirMotDePasse(banc, "ana@exemple.fr", "un mot de passe solide");
  const [p] = await env.base.select().from(user).where(eq(user.email, "ana@exemple.fr"));
  const ctx = await contexteDeLUtilisateur(env, p?.id ?? "");
  if (ctx === null) throw new Error("contexte absent");
  ana = ctx;
  await ajouterElement(env, ana, "Ma première ligne");
});

describe("téléchargement des données", () => {
  it("contient le profil, les accords, le journal et les éléments de la personne, rien d'autre", async () => {
    const copie = await exporterDonnees(banc.env, ana);
    expect(copie.profil?.email).toBe("ana@exemple.fr");
    expect(copie.espace?.nom).toBe("Boulangerie Ana");
    expect(copie.consentements).toHaveLength(2);
    expect(copie.elements.map((e) => e.titre)).toEqual(["Ma première ligne"]);
    expect(copie.journal.map((j) => j.action)).toContain("verification_adresse");
    expect(JSON.stringify(copie)).not.toMatch(/password|motDePasse|token/i);
  });
});

describe("fermeture du compte", () => {
  it("demande l'adresse exacte pour confirmer", async () => {
    expect(await fermerCompte(banc.env, ana, "autre@exemple.fr")).toBe("fermeture_confirmation");
  });
  it("un propriétaire seul avec des collègues doit d'abord désigner un autre propriétaire", async () => {
    const env = banc.env;
    await inviterColleague(env, ana, "collegue@exemple.fr");
    const code = dernierLien(banc.expediteur, "collegue@exemple.fr").split("/invitation/")[1] ?? "";
    await accepterInvitation(env, code, { nom: "Co", motDePasse: "un mot de passe solide", nomEntreprise: "", accepte: "oui" });
    expect(await fermerCompte(env, ana, "ana@exemple.fr")).toBe("fermeture_proprietaire");
    const membres = await listerMembres(env, ana);
    const collegue = membres.find((m) => m.email === "collegue@exemple.fr");
    await changerRole(env, ana, collegue?.id ?? "", "proprietaire");
  });
  it("désactive sans rien effacer, coupe les connexions, empêche de se reconnecter et prévient l'administrateur", async () => {
    const env = banc.env;
    await env.auth.api.signInEmail({ body: { email: "ana@exemple.fr", password: "un mot de passe solide" } });
    expect(await env.base.select().from(session).where(eq(session.userId, ana.utilisateurId))).toHaveLength(1);
    const avant = banc.expediteur.envoyes.length;
    expect(await fermerCompte(env, ana, " Ana@Exemple.fr ")).toBe("ok");
    const [p] = await env.base.select().from(user).where(eq(user.id, ana.utilisateurId));
    expect(p?.desactiveLe).not.toBeNull();
    expect(p?.email).toBe("ana@exemple.fr");
    expect(await env.base.select().from(session).where(eq(session.userId, ana.utilisateurId))).toHaveLength(0);
    expect(await contexteDeLUtilisateur(env, ana.utilisateurId)).toBeNull();
    await expect(env.auth.api.signInEmail({ body: { email: "ana@exemple.fr", password: "un mot de passe solide" } })).rejects.toThrow();
    const prevenus = banc.expediteur.envoyes.slice(avant);
    expect(prevenus.map((m) => m.a)).toEqual(["admin@exemple.fr"]);
    expect(prevenus[0]?.texte).toContain("ana@exemple.fr");
    const actions = await env.base.select().from(journalAudit).where(eq(journalAudit.utilisateurId, ana.utilisateurId));
    expect(actions.map((j) => j.action)).toContain("fermeture");
  });
  it("un compte fermé ne reçoit plus de lien de connexion ni de nouveau mot de passe", async () => {
    const env = banc.env;
    const avant = banc.expediteur.envoyes.length;
    await env.auth.api.signInMagicLink({ body: { email: "ana@exemple.fr" }, headers: new Headers() });
    await env.auth.api.requestPasswordReset({ body: { email: "ana@exemple.fr" } });
    const envoyes = banc.expediteur.envoyes.slice(avant).filter((m) => m.a === "ana@exemple.fr" && m.sujet !== "Confirmez votre adresse");
    const lien = envoyes.find((m) => m.sujet === "Votre lien de connexion");
    if (lien !== undefined) {
      const jeton = new URL(/https?:\/\/\S+/.exec(lien.texte)?.[0] ?? "").searchParams.get("token") ?? "";
      await expect(env.auth.api.magicLinkVerify({ query: { token: jeton }, headers: new Headers() })).rejects.toThrow();
    }
    expect(envoyes.find((m) => m.sujet === "Choisir un nouveau mot de passe")).toBeUndefined();
    expect(await env.base.select().from(session).where(eq(session.userId, ana.utilisateurId))).toHaveLength(0);
  });
});

describe("propriétaires actifs", () => {
  it("l'invitation d'un propriétaire dont le compte est fermé ne vaut plus", async () => {
    const b = await creerBanc();
    const env = b.env;
    await inscrire(env, formulaire(env, { email: "chef@exemple.fr" }), "192.0.2.50");
    const [p] = await env.base.select().from(user).where(eq(user.email, "chef@exemple.fr"));
    await env.base.update(user).set({ emailVerified: true }).where(eq(user.id, p?.id ?? ""));
    const ctx = await contexteDeLUtilisateur(env, p?.id ?? "");
    if (ctx === null) throw new Error("contexte absent");
    await inviterColleague(env, ctx, "tard@exemple.fr");
    const code = dernierLien(b.expediteur, "tard@exemple.fr").split("/invitation/")[1] ?? "";
    expect(await fermerCompte(env, ctx, "chef@exemple.fr")).toBe("ok");
    expect(await accepterInvitation(env, code, { nom: "Tard", motDePasse: "un mot de passe solide", nomEntreprise: "", accepte: "oui" })).toBe("lien_invalide");
  });
  it("un propriétaire dont le collègue propriétaire est fermé ne peut pas partir en laissant l'espace sans responsable", async () => {
    const b = await creerBanc();
    const env = b.env;
    await inscrire(env, formulaire(env, { email: "p1@exemple.fr" }), "192.0.2.51");
    const [p1] = await env.base.select().from(user).where(eq(user.email, "p1@exemple.fr"));
    await env.base.update(user).set({ emailVerified: true }).where(eq(user.id, p1?.id ?? ""));
    const c1 = await contexteDeLUtilisateur(env, p1?.id ?? "");
    if (c1 === null) throw new Error("contexte absent");
    await inviterColleague(env, c1, "p2@exemple.fr");
    const code = dernierLien(b.expediteur, "p2@exemple.fr").split("/invitation/")[1] ?? "";
    await accepterInvitation(env, code, { nom: "P2", motDePasse: "un mot de passe solide", nomEntreprise: "", accepte: "oui" });
    const [p2] = await env.base.select().from(user).where(eq(user.email, "p2@exemple.fr"));
    const c2 = await contexteDeLUtilisateur(env, p2?.id ?? "");
    if (c2 === null) throw new Error("contexte absent");
    const [m2] = (await listerMembres(env, c1)).filter((m) => m.email === "p2@exemple.fr");
    await changerRole(env, c1, m2?.id ?? "", "proprietaire");
    expect(await fermerCompte(env, { ...c2, role: "proprietaire" }, "p2@exemple.fr")).toBe("ok");
    // Reste p1 seul actif : sa fermeture est permise (plus personne d'autre à protéger), mais pas son changement en simple membre.
    const [m1] = (await listerMembres(env, c1)).filter((m) => m.email === "p1@exemple.fr");
    expect(await changerRole(env, c1, m1?.id ?? "", "membre")).toBe(false);
  });
});
