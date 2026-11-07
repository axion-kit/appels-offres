import { and, eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { avancer, choisirMotDePasse, creerBanc, dernierLien, formulaire, type Banc } from "./banc";
import { expirerComptesNonVerifies } from "./expiration";
import { inscrire } from "./inscription";
import { codeVerification, texteMessage } from "./messages";
import { account, espace, journalAudit, membre, session, user } from "./schema";

let banc: Banc;
beforeAll(async () => {
  banc = await creerBanc();
});

afterEach(() => {
  vi.useRealTimers();
});

let rang = 0;
const ipNeuve = () => `198.18.0.${(rang += 1)}`;
const MDP_ATTAQUANT = "mot de passe de l'attaquant";
const MDP_VICTIME = "mot de passe de la victime";

async function ligne(email: string) {
  return (await banc.env.base.select().from(user).where(eq(user.email, email)))[0];
}
async function inscrireAttaquant(email: string) {
  expect(await inscrire(banc.env, formulaire(banc.env, { email, motDePasse: MDP_ATTAQUANT }), ipNeuve())).toBe("inscription_envoyee");
}
const connexionAttaquant = (email: string) => banc.env.auth.api.signInEmail({ body: { email, password: MDP_ATTAQUANT } });

describe("prise de compte préparée : le mot de passe de l'attaquant ne survit pas à la vérification", () => {
  it("par le lien de confirmation", async () => {
    const email = "victime-lien@exemple.fr";
    await inscrireAttaquant(email);
    await expect(connexionAttaquant(email)).rejects.toThrow(); // pas de connexion avant vérification
    const personne = await ligne(email);
    expect(personne?.autoInscrit).toBe(true);
    // Une session traînante (cas tordu) doit aussi disparaître.
    await banc.env.base.insert(session).values({ id: "s-lien", token: "t-lien", userId: personne?.id ?? "", expiresAt: new Date("2027-01-01") });

    const jeton = new URL(dernierLien(banc.expediteur, email)).searchParams.get("token") ?? "";
    await banc.env.auth.api.verifyEmail({ query: { token: jeton } });

    expect((await ligne(email))?.emailVerified).toBe(true);
    expect((await ligne(email))?.autoInscrit).toBe(false);
    await expect(connexionAttaquant(email)).rejects.toThrow();
    expect(await banc.env.base.select().from(session).where(eq(session.userId, personne?.id ?? ""))).toHaveLength(0);
    const journal = await banc.env.base.select().from(journalAudit).where(eq(journalAudit.utilisateurId, personne?.id ?? ""));
    expect(journal.map((j) => j.action)).toContain("mot_de_passe_neutralise");

    // La vraie personne choisit son mot de passe via « mot de passe oublié ».
    await choisirMotDePasse(banc, email, MDP_VICTIME);
    await expect(connexionAttaquant(email)).rejects.toThrow();
    await expect(banc.env.auth.api.signInEmail({ body: { email, password: MDP_VICTIME } })).resolves.toBeDefined();
  });

  it("par le lien de connexion reçu par e-mail", async () => {
    const email = "victime-magique@exemple.fr";
    await inscrireAttaquant(email);
    const personne = await ligne(email);
    await banc.env.base.insert(session).values({ id: "s-mag", token: "t-mag", userId: personne?.id ?? "", expiresAt: new Date("2027-01-01") });

    await banc.env.auth.api.signInMagicLink({ body: { email, callbackURL: "/compte" }, headers: new Headers() });
    const jeton = new URL(dernierLien({ envoyes: banc.expediteur.envoyes.filter((m) => m.sujet !== "Confirmez votre adresse") }, email)).searchParams.get("token") ?? "";
    await banc.env.auth.api.magicLinkVerify({ query: { token: jeton }, headers: new Headers() });

    expect((await ligne(email))?.emailVerified).toBe(true);
    expect((await ligne(email))?.autoInscrit).toBe(false);
    await expect(connexionAttaquant(email)).rejects.toThrow();
    expect(await banc.env.base.select().from(session).where(eq(session.id, "s-mag"))).toHaveLength(0);
    await choisirMotDePasse(banc, email, MDP_VICTIME);
    await expect(connexionAttaquant(email)).rejects.toThrow();
    await expect(banc.env.auth.api.signInEmail({ body: { email, password: MDP_VICTIME } })).resolves.toBeDefined();
  });

  it("la neutralisation vient du hachage lui-même : le mot de passe enregistré change", async () => {
    const email = "victime-hache@exemple.fr";
    await inscrireAttaquant(email);
    const personne = await ligne(email);
    const lire = async () => (await banc.env.base.select().from(account).where(and(eq(account.userId, personne?.id ?? ""), eq(account.providerId, "credential"))))[0]?.password;
    const avant = await lire();
    const jeton = new URL(dernierLien(banc.expediteur, email)).searchParams.get("token") ?? "";
    await banc.env.auth.api.verifyEmail({ query: { token: jeton } });
    const apres = await lire();
    expect(apres).toBeTruthy();
    expect(apres).not.toBe(avant);
  });
});

describe("comptes jamais vérifiés : expirés après 24 h, désactivés, jamais effacés", () => {
  it("expiration : désactivé, adresse libérée, rien d'effacé, connexion et lien impossibles", async () => {
    const email = "expire@exemple.fr";
    await inscrireAttaquant(email);
    const avant = await ligne(email);
    const lien = new URL(dernierLien(banc.expediteur, email)).searchParams.get("token") ?? "";

    await expirerComptesNonVerifies(banc.env.base, avancer(banc.env, 23 * 3600_000).maintenant);
    expect((await ligne(email))?.expireLe).toBeNull(); // 23 h : rien ne bouge

    await expirerComptesNonVerifies(banc.env.base, avancer(banc.env, 25 * 3600_000).maintenant);
    expect(await ligne(email)).toBeUndefined(); // l'adresse est libérée
    const [expire] = await banc.env.base.select().from(user).where(eq(user.id, avant?.id ?? ""));
    expect(expire?.desactiveLe).not.toBeNull();
    expect(expire?.expireLe).not.toBeNull();
    expect(expire?.emailInitial).toBe(email);
    expect(expire?.emailVerified).toBe(false);
    // Rien n'est effacé : compte, espace, membre.
    const [lienMembre] = await banc.env.base.select().from(membre).where(eq(membre.utilisateurId, avant?.id ?? ""));
    expect(lienMembre).toBeDefined();
    expect(await banc.env.base.select().from(espace).where(eq(espace.id, lienMembre?.espaceId ?? ""))).toHaveLength(1);
    // Ni connexion ni activation par l'ancien lien.
    await expect(connexionAttaquant(email)).rejects.toThrow();
    await expect(banc.env.auth.api.verifyEmail({ query: { token: lien } })).rejects.toThrow();
    expect((await banc.env.base.select().from(user).where(eq(user.id, avant?.id ?? "")))[0]?.emailVerified).toBe(false);
  });

  it("une nouvelle inscription de la même adresse repart proprement", async () => {
    const email = "reprise@exemple.fr";
    await inscrireAttaquant(email);
    const ancien = await ligne(email);
    const plusTard = avancer(banc.env, 30 * 3600_000);
    expect(await inscrire(plusTard, formulaire(plusTard, { email, motDePasse: MDP_VICTIME }), ipNeuve())).toBe("inscription_envoyee");
    const neuf = await ligne(email);
    expect(neuf?.id).not.toBe(ancien?.id);
    expect(neuf?.autoInscrit).toBe(true);
    expect((await banc.env.base.select().from(user).where(eq(user.id, ancien?.id ?? "")))[0]?.expireLe).not.toBeNull();
    const jeton = new URL(dernierLien(banc.expediteur, email)).searchParams.get("token") ?? "";
    await banc.env.auth.api.verifyEmail({ query: { token: jeton } });
    expect((await ligne(email))?.emailVerified).toBe(true);
  });

  it("un lien de confirmation qui arrive après 24 h n'active pas le compte : il expire", async () => {
    const email = "tard@exemple.fr";
    await inscrireAttaquant(email);
    const personne = await ligne(email);
    const jeton = new URL(dernierLien(banc.expediteur, email)).searchParams.get("token") ?? "";
    await banc.env.base.update(user).set({ createdAt: new Date(banc.env.maintenant.getTime() - 25 * 3600_000) }).where(eq(user.id, personne?.id ?? ""));
    const reponse = await banc.env.auth.api.verifyEmail({ query: { token: jeton } }).then(
      () => null,
      (e: unknown) => e as { status?: string; headers?: Record<string, string> },
    );
    // La personne est renvoyée vers « Ce lien a expiré », jamais vers « Adresse confirmée ».
    expect(reponse?.status).toBe("FOUND");
    expect(reponse?.headers?.Location).toBe("/verifier-adresse?m=lien_expire");
    expect(texteMessage("lien_expire")).toBe("Ce lien a expiré. Inscrivez-vous à nouveau.");
    const journal = await banc.env.base.select().from(journalAudit).where(eq(journalAudit.utilisateurId, personne?.id ?? ""));
    expect(journal.map((j) => j.action)).not.toContain("verification_adresse");
    const [apres] = await banc.env.base.select().from(user).where(eq(user.id, personne?.id ?? ""));
    expect(apres?.emailVerified).toBe(false);
    expect(apres?.expireLe).not.toBeNull();
    expect(apres?.desactiveLe).not.toBeNull();
  });

  it("le jeton du lien de confirmation lui-même expire après 24 h : retour vers l'écran « lien expiré »", async () => {
    const email = "jeton-perime@exemple.fr";
    await inscrireAttaquant(email);
    const lien = new URL(dernierLien(banc.expediteur, email));
    const jeton = lien.searchParams.get("token") ?? "";
    const callbackURL = lien.searchParams.get("callbackURL") ?? "";
    expect(callbackURL).toBe("/verifier-adresse?m=adresse_confirmee");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.now() + 25 * 3600_000));
    const reponse = await banc.env.auth.api.verifyEmail({ query: { token: jeton, callbackURL } }).then(
      () => null,
      (e: unknown) => e as { status?: string; headers?: Headers | Record<string, string> },
    );
    vi.useRealTimers();
    expect(reponse?.status).toBe("FOUND");
    const retour = new URL((reponse?.headers instanceof Headers ? reponse.headers.get("location") : reponse?.headers?.Location) ?? "", "http://exemple.test");
    expect(retour.pathname).toBe("/verifier-adresse");
    expect(retour.searchParams.get("error")?.toLowerCase()).toBe("token_expired");
    expect(codeVerification(undefined, retour.searchParams.get("error") ?? undefined)).toBe("lien_expire");
    expect((await ligne(email))?.emailVerified).toBe(false);
  });

  it("la page choisit le bon écran selon l'erreur renvoyée par la librairie", () => {
    expect(codeVerification(undefined, "token_expired")).toBe("lien_expire");
    expect(codeVerification(undefined, "user_not_found")).toBe("lien_expire");
    expect(codeVerification(undefined, "TOKEN_EXPIRED")).toBe("lien_expire");
    expect(codeVerification(undefined, "USER_NOT_FOUND")).toBe("lien_expire");
    expect(codeVerification(undefined, "invalid_token")).toBe("lien_invalide");
    expect(codeVerification("adresse_confirmee", "autre")).toBe("lien_invalide");
    expect(codeVerification("lien_expire", undefined)).toBe("lien_expire");
    expect(codeVerification(undefined, undefined)).toBeUndefined();
  });

  it("un compte déjà vérifié n'expire jamais", async () => {
    const email = "ok@exemple.fr";
    await inscrireAttaquant(email);
    const jeton = new URL(dernierLien(banc.expediteur, email)).searchParams.get("token") ?? "";
    await banc.env.auth.api.verifyEmail({ query: { token: jeton } });
    await expirerComptesNonVerifies(banc.env.base, avancer(banc.env, 1000 * 3600_000).maintenant);
    expect((await ligne(email))?.expireLe).toBeNull();
  });
});

describe("neutralisation en échec : le compte vérifié reste verrouillé", () => {
  it("par le lien de confirmation : l'attaquant ne se connecte pas, la victime reprend la main", async () => {
    const panne = await creerBanc({ hacher: () => Promise.reject(new Error("panne de hachage")) });
    const email = "victime-panne@exemple.fr";
    expect(await inscrire(panne.env, formulaire(panne.env, { email, motDePasse: MDP_ATTAQUANT }), ipNeuve())).toBe("inscription_envoyee");
    const jeton = new URL(dernierLien(panne.expediteur, email)).searchParams.get("token") ?? "";
    await expect(panne.env.auth.api.verifyEmail({ query: { token: jeton } })).rejects.toThrow();
    const [apres] = await panne.env.base.select().from(user).where(eq(user.email, email));
    expect(apres?.emailVerified).toBe(true); // vérifié mais jamais neutralisé...
    expect(apres?.autoInscrit).toBe(true);
    await expect(panne.env.auth.api.signInEmail({ body: { email, password: MDP_ATTAQUANT } })).rejects.toThrow(); // ...donc verrouillé
    expect(await panne.env.base.select().from(session).where(eq(session.userId, apres?.id ?? ""))).toHaveLength(0);

    await choisirMotDePasse(panne, email, MDP_VICTIME);
    expect((await panne.env.base.select().from(user).where(eq(user.email, email)))[0]?.autoInscrit).toBe(false);
    await expect(panne.env.auth.api.signInEmail({ body: { email, password: MDP_ATTAQUANT } })).rejects.toThrow();
    await expect(panne.env.auth.api.signInEmail({ body: { email, password: MDP_VICTIME } })).resolves.toBeDefined();
  });

  it("par le lien de connexion : aucune session n'est créée", async () => {
    const panne = await creerBanc({ hacher: () => Promise.reject(new Error("panne de hachage")) });
    const email = "victime-panne-magique@exemple.fr";
    expect(await inscrire(panne.env, formulaire(panne.env, { email, motDePasse: MDP_ATTAQUANT }), ipNeuve())).toBe("inscription_envoyee");
    await panne.env.auth.api.signInMagicLink({ body: { email, callbackURL: "/compte" }, headers: new Headers() });
    const jeton = new URL(dernierLien({ envoyes: panne.expediteur.envoyes.filter((m) => m.sujet !== "Confirmez votre adresse") }, email)).searchParams.get("token") ?? "";
    await expect(panne.env.auth.api.magicLinkVerify({ query: { token: jeton }, headers: new Headers() })).rejects.toThrow();
    // Le compte est vérifié mais jamais neutralisé : un SECOND lien de connexion (plus de crochet de première vérification) doit échouer aussi.
    const avantSecond = panne.expediteur.envoyes.length;
    await panne.env.auth.api.signInMagicLink({ body: { email, callbackURL: "/compte" }, headers: new Headers() });
    const second = new URL(dernierLien({ envoyes: panne.expediteur.envoyes.slice(avantSecond) }, email)).searchParams.get("token") ?? "";
    expect(second).not.toBe("");
    expect(second).not.toBe(jeton);
    await expect(panne.env.auth.api.magicLinkVerify({ query: { token: second }, headers: new Headers() })).rejects.toThrow();
    const [apres] = await panne.env.base.select().from(user).where(eq(user.email, email));
    expect(await panne.env.base.select().from(session).where(eq(session.userId, apres?.id ?? ""))).toHaveLength(0);
    await expect(panne.env.auth.api.signInEmail({ body: { email, password: MDP_ATTAQUANT } })).rejects.toThrow();
  });

  it("« mot de passe oublié » sur un compte non vérifié ne lève rien", async () => {
    const email = "pas-verifie@exemple.fr";
    await inscrireAttaquant(email);
    await banc.env.auth.api.requestPasswordReset({ body: { email, redirectTo: "/mot-de-passe-oublie" } }).catch(() => undefined);
    expect((await ligne(email))?.autoInscrit).toBe(true);
  });
});
