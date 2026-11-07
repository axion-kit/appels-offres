import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { avancer, creerBanc, dernierLien, type Banc } from "./banc";
import { contexteDeLUtilisateur } from "./contexte";
import type { ContexteEspace, Env } from "./env";
import { accepterInvitation, apercuInvitation, creerCompteParAdministrateur, INVITATION_JOURS, inviterColleague, inviterEntreprise, revoquerInvitations } from "./invitation";
import { journalAudit, user } from "./schema";

let banc: Banc;
let proprio: ContexteEspace;
let admin: ContexteEspace;

async function creerProprietaire(env: Env, email: string, nom: string, admin_ = false) {
  const code = await envoyerEtLire(env, null, email);
  await accepterInvitation(env, code, { nom: "Responsable", motDePasse: "un mot de passe solide", nomEntreprise: nom, accepte: "oui" });
  const [p] = await env.base.select().from(user).where(eq(user.email, email));
  const ctx = await contexteDeLUtilisateur(admin_ ? { ...env, administrateurs: [email] } : env, p?.id ?? "");
  if (ctx === null) throw new Error("contexte absent");
  return ctx;
}

async function envoyerEtLire(env: Env, ctx: ContexteEspace | null, email: string): Promise<string> {
  if (ctx === null) {
    // Invitation d'entreprise émise par un administrateur technique inséré directement.
    const { randomUUID } = await import("node:crypto");
    const { invitation } = await import("./schema");
    const { hacherCode } = await import("./invitation");
    const code = `code-${randomUUID()}`;
    await env.base.insert(invitation).values({ id: randomUUID(), espaceId: null, email, role: "proprietaire", codeHash: hacherCode(code), expireLe: new Date(env.maintenant.getTime() + 86_400_000) });
    return code;
  }
  await inviterColleague(env, ctx, email);
  return dernierLien(banc.expediteur, email).split("/invitation/")[1] ?? "";
}

beforeAll(async () => {
  banc = await creerBanc();
  proprio = await creerProprietaire(banc.env, "chef@exemple.fr", "Chez Chef");
  admin = await creerProprietaire(banc.env, "admin@exemple.fr", "Équipe", true);
});

const mdp = "un mot de passe solide";
const accord = (surcharge = {}) => ({ nom: "Camille", motDePasse: mdp, nomEntreprise: "", accepte: "oui", ...surcharge });

describe("invitation d'un collègue", () => {
  it("le lien marche une seule fois, et le collègue rejoint l'espace comme membre", async () => {
    const env = banc.env;
    expect(await inviterColleague(env, proprio, "Collegue@Exemple.fr ")).toBe("invitation_envoyee");
    const code = dernierLien(banc.expediteur, "collegue@exemple.fr").split("/invitation/")[1] ?? "";
    expect(await apercuInvitation(env, code)).toEqual({ email: "collegue@exemple.fr", nomEspace: "Chez Chef" });
    expect(await accepterInvitation(env, code, accord())).toBe("compte_pret");
    const [p] = await env.base.select().from(user).where(eq(user.email, "collegue@exemple.fr"));
    const ctx = await contexteDeLUtilisateur(env, p?.id ?? "");
    expect(ctx?.role).toBe("membre");
    expect(ctx?.espaceId).toBe(proprio.espaceId);
    expect(p?.emailVerified).toBe(true);
    // Deuxième usage du même lien : refusé, et le lien n'est plus présenté.
    expect(await accepterInvitation(env, code, accord({ nom: "Intrus", motDePasse: "autre mot de passe long" }))).toBe("lien_invalide");
    expect(await apercuInvitation(env, code)).toBeNull();
    await expect(env.auth.api.signInEmail({ body: { email: "collegue@exemple.fr", password: mdp } })).resolves.toBeDefined();
  });

  it("deux personnes qui ouvrent le même lien en même temps : une seule réussit", async () => {
    const env = banc.env;
    await inviterColleague(env, proprio, "course@exemple.fr");
    const code = dernierLien(banc.expediteur, "course@exemple.fr").split("/invitation/")[1] ?? "";
    const reponses = await Promise.all([accepterInvitation(env, code, accord()), accepterInvitation(env, code, accord())]);
    expect(reponses.sort()).toEqual(["compte_pret", "lien_invalide"]);
    expect(await env.base.select().from(user).where(eq(user.email, "course@exemple.fr"))).toHaveLength(1);
  });

  it("un lien expiré est refusé", async () => {
    const env = banc.env;
    await inviterColleague(env, proprio, "tard@exemple.fr");
    const code = dernierLien(banc.expediteur, "tard@exemple.fr").split("/invitation/")[1] ?? "";
    const tard = avancer(env, (INVITATION_JOURS * 24 * 60 + 1) * 60 * 1000);
    expect(await apercuInvitation(tard, code)).toBeNull();
    expect(await accepterInvitation(tard, code, accord())).toBe("lien_invalide");
    expect(await env.base.select().from(user).where(eq(user.email, "tard@exemple.fr"))).toHaveLength(0);
  });

  it("un lien inventé est refusé, un formulaire incomplet ne consomme pas le lien", async () => {
    const env = banc.env;
    expect(await accepterInvitation(env, "inventé", accord())).toBe("lien_invalide");
    await inviterColleague(env, proprio, "incomplet@exemple.fr");
    const code = dernierLien(banc.expediteur, "incomplet@exemple.fr").split("/invitation/")[1] ?? "";
    expect(await accepterInvitation(env, code, accord({ motDePasse: "court" }))).toBe("formulaire_invalide");
    expect(await accepterInvitation(env, code, accord({ accepte: "" }))).toBe("formulaire_invalide");
    expect(await accepterInvitation(env, code, accord())).toBe("compte_pret");
  });

  it("l'adresse du compte est celle de l'invitation, pas une adresse saisie", async () => {
    const env = banc.env;
    await inviterColleague(env, proprio, "invite@exemple.fr");
    const code = dernierLien(banc.expediteur, "invite@exemple.fr").split("/invitation/")[1] ?? "";
    await accepterInvitation(env, code, { ...accord(), email: "autre@exemple.fr" } as never);
    expect(await env.base.select().from(user).where(eq(user.email, "autre@exemple.fr"))).toHaveLength(0);
    expect(await env.base.select().from(user).where(eq(user.email, "invite@exemple.fr"))).toHaveLength(1);
  });

  it("un membre ne peut pas inviter ; adresse invalide refusée ; adresse déjà inscrite : même réponse, pas de lien", async () => {
    const env = banc.env;
    expect(await inviterColleague(env, { ...proprio, role: "membre" }, "x@exemple.fr")).toBe("non_autorise");
    expect(await inviterColleague(env, proprio, "nimporte quoi")).toBe("formulaire_invalide");
    const avant = banc.expediteur.envoyes.length;
    expect(await inviterColleague(env, proprio, "admin@exemple.fr")).toBe("invitation_envoyee");
    expect(banc.expediteur.envoyes.length).toBe(avant);
  });

  it("en mode fermé, personne ne peut inviter ni accepter", async () => {
    const ferme = { ...banc.env, proprietes: { inscription: "fermee" as const, essaiJours: 30 } };
    expect(await inviterColleague(ferme, proprio, "ferme@exemple.fr")).toBe("non_autorise");
    expect(await inviterEntreprise(ferme, admin, "ferme@exemple.fr")).toBe("non_autorise");
    await inviterColleague(banc.env, proprio, "ferme2@exemple.fr");
    const code = dernierLien(banc.expediteur, "ferme2@exemple.fr").split("/invitation/")[1] ?? "";
    expect(await accepterInvitation(ferme, code, accord())).toBe("inscription_fermee");
  });

  it("limite le nombre d'invitations par espace et par jour", async () => {
    const env = banc.env;
    const autre = await creerProprietaire(env, "volume@exemple.fr", "Volume");
    let derniere = "";
    for (let i = 0; i < 21; i += 1) derniere = await inviterColleague(env, autre, `v${i}@exemple.fr`);
    expect(derniere).toBe("trop_de_demandes");
  });

  it("le propriétaire peut révoquer les invitations en attente", async () => {
    const env = banc.env;
    await inviterColleague(env, proprio, "revoque@exemple.fr");
    const code = dernierLien(banc.expediteur, "revoque@exemple.fr").split("/invitation/")[1] ?? "";
    await revoquerInvitations(env, proprio);
    expect(await apercuInvitation(env, code)).toBeNull();
    await expect(revoquerInvitations(env, { ...proprio, role: "membre" })).rejects.toThrow();
  });

  it("l'invitation, la révocation et l'acceptation sont écrites au journal", async () => {
    const actions = (await banc.env.base.select().from(journalAudit)).map((j) => j.action);
    expect(actions).toEqual(expect.arrayContaining(["invitation", "invitation_acceptee"]));
  });
});

describe("invitation d'une entreprise et création par l'administrateur", () => {
  it("l'administrateur invite : la personne crée son propre espace (nom obligatoire)", async () => {
    const env = banc.env;
    expect(await inviterEntreprise(env, proprio, "neuf@exemple.fr")).toBe("non_autorise");
    expect(await inviterEntreprise(env, admin, "neuf@exemple.fr")).toBe("invitation_envoyee");
    expect(await inviterEntreprise(env, admin, "pas valable")).toBe("formulaire_invalide");
    const code = dernierLien(banc.expediteur, "neuf@exemple.fr").split("/invitation/")[1] ?? "";
    expect(await apercuInvitation(env, code)).toEqual({ email: "neuf@exemple.fr", nomEspace: null });
    expect(await accepterInvitation(env, code, accord())).toBe("formulaire_invalide");
    expect(await accepterInvitation(env, code, accord({ nomEntreprise: "Atelier Neuf" }))).toBe("compte_pret");
    const [p] = await env.base.select().from(user).where(eq(user.email, "neuf@exemple.fr"));
    const ctx = await contexteDeLUtilisateur(env, p?.id ?? "");
    expect(ctx?.role).toBe("proprietaire");
    expect(ctx?.nomEspace).toBe("Atelier Neuf");
    expect(ctx?.espaceId).not.toBe(proprio.espaceId);
  });

  it("l'administrateur crée un compte : lien de connexion envoyé, adresse confirmée à la première ouverture", async () => {
    const env = { ...banc.env, proprietes: { inscription: "fermee" as const, essaiJours: 30 } };
    expect(await creerCompteParAdministrateur(env, proprio, "cree@exemple.fr", "Créé")).toBe("non_autorise");
    expect(await creerCompteParAdministrateur(env, admin, "pas valable", "Créé")).toBe("formulaire_invalide");
    expect(await creerCompteParAdministrateur(env, admin, "cree@exemple.fr", " ")).toBe("formulaire_invalide");
    expect(await creerCompteParAdministrateur(env, admin, "cree@exemple.fr", "Créé")).toBe("compte_cree");
    expect(await creerCompteParAdministrateur(env, admin, "cree@exemple.fr", "Créé")).toBe("compte_cree");
    expect(await env.base.select().from(user).where(eq(user.email, "cree@exemple.fr"))).toHaveLength(1);
    const lien = new URL(dernierLien(banc.expediteur, "cree@exemple.fr"));
    expect(lien.pathname).toBe("/api/auth/magic-link/verify");
    await expect(env.auth.api.magicLinkVerify({ query: { token: lien.searchParams.get("token") ?? "" }, headers: new Headers() })).resolves.toBeDefined();
    const [p] = await env.base.select().from(user).where(eq(user.email, "cree@exemple.fr"));
    expect(p?.emailVerified).toBe(true);
  });
});

describe("lien de connexion par e-mail", () => {
  it("n'ouvre jamais de compte pour une adresse inconnue, même si le lien est utilisé", async () => {
    await banc.env.auth.api.signInMagicLink({ body: { email: "inconnu@exemple.fr" }, headers: new Headers() });
    const jeton = new URL(dernierLien(banc.expediteur, "inconnu@exemple.fr")).searchParams.get("token") ?? "";
    await expect(banc.env.auth.api.magicLinkVerify({ query: { token: jeton }, headers: new Headers() })).rejects.toThrow();
    expect(await banc.env.base.select().from(user).where(eq(user.email, "inconnu@exemple.fr"))).toHaveLength(0);
  });
});
