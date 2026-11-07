import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { avancer, choisirMotDePasse, creerBanc, dernierLien, formulaire, type Banc } from "./banc";
import { inscrire } from "./inscription";
import { consentement, espace, journalAudit, membre, user } from "./schema";

let banc: Banc;
beforeAll(async () => {
  banc = await creerBanc();
});

const IP = "203.0.113.7";
let compteur = 0;
const ipNeuve = () => `198.51.100.${(compteur += 1)}`;

async function compter(email: string) {
  return (await banc.env.base.select().from(user).where(eq(user.email, email))).length;
}

describe("mode d'inscription refusé côté serveur", () => {
  it.each(["fermee", "sur_invitation"] as const)("mode %s : aucune inscription, aucun compte créé", async (mode) => {
    const refus = { ...banc.env, proprietes: { inscription: mode, essaiJours: 30 } };
    expect(await inscrire(refus, formulaire(refus, { email: `refus-${mode}@exemple.fr` }), ipNeuve())).toBe("inscription_fermee");
    expect(await compter(`refus-${mode}@exemple.fr`)).toBe(0);
  });
});

describe("inscription libre", () => {
  it("crée le compte, l'espace dont la personne est propriétaire, les consentements et le journal", async () => {
    const env = banc.env;
    expect(await inscrire(env, formulaire(env, { email: "ana@exemple.fr" }), ipNeuve())).toBe("inscription_envoyee");
    const [personne] = await env.base.select().from(user).where(eq(user.email, "ana@exemple.fr"));
    expect(personne?.emailVerified).toBe(false);
    const [lien] = await env.base.select().from(membre).where(eq(membre.utilisateurId, personne?.id ?? ""));
    expect(lien?.role).toBe("proprietaire");
    const [monEspace] = await env.base.select().from(espace).where(eq(espace.id, lien?.espaceId ?? ""));
    expect(monEspace?.nom).toBe("Boulangerie Ana");
    expect(monEspace?.essaiJusquAu?.toISOString()).toBe("2026-12-07T10:00:00.000Z");
    const accords = await env.base.select().from(consentement).where(eq(consentement.utilisateurId, personne?.id ?? ""));
    expect(accords.map((a) => a.document).sort()).toEqual(["cgu", "confidentialite"]);
    expect(accords.every((a) => a.version === "2026-11-01" && a.accepteLe.getTime() === env.maintenant.getTime())).toBe(true);
    const journal = await env.base.select().from(journalAudit).where(eq(journalAudit.utilisateurId, personne?.id ?? ""));
    expect(journal.map((j) => j.action)).toContain("inscription");
    expect(dernierLien(banc.expediteur, "ana@exemple.fr")).toContain("/api/auth/verify-email?token=");
  });

  it("sans limite de durée quand essai_jours vaut 0", async () => {
    const env = { ...banc.env, proprietes: { inscription: "libre" as const, essaiJours: 0 } };
    await inscrire(env, formulaire(env, { email: "sans-limite@exemple.fr" }), ipNeuve());
    const [p] = await env.base.select().from(user).where(eq(user.email, "sans-limite@exemple.fr"));
    const [l] = await env.base.select().from(membre).where(eq(membre.utilisateurId, p?.id ?? ""));
    const [e] = await env.base.select().from(espace).where(eq(espace.id, l?.espaceId ?? ""));
    expect(e?.essaiJusquAu).toBeNull();
  });

  it("l'adresse doit être vérifiée avant toute connexion, puis la connexion marche", async () => {
    const env = banc.env;
    await inscrire(env, formulaire(env, { email: "verif@exemple.fr" }), ipNeuve());
    const corps = { email: "verif@exemple.fr", password: "un mot de passe solide" };
    await expect(env.auth.api.signInEmail({ body: corps })).rejects.toThrow();
    const jeton = new URL(dernierLien(banc.expediteur, "verif@exemple.fr")).searchParams.get("token") ?? "";
    await env.auth.api.verifyEmail({ query: { token: jeton } });
    // Le mot de passe de l'inscription est neutralisé : la personne en choisit un via « mot de passe oublié ».
    await expect(env.auth.api.signInEmail({ body: corps })).rejects.toThrow();
    await choisirMotDePasse(banc, "verif@exemple.fr", "un mot de passe solide");
    const ouverte = await env.auth.api.signInEmail({ body: corps });
    expect(ouverte.user.email).toBe("verif@exemple.fr");
    await expect(env.auth.api.signInEmail({ body: { ...corps, password: "mauvais mot de passe" } })).rejects.toThrow();
  });

  it("la librairie ne permet pas de s'inscrire par un autre chemin", async () => {
    await expect(
      banc.env.auth.api.signUpEmail({ body: { email: "contourne@exemple.fr", password: "un mot de passe solide", name: "X" } }),
    ).rejects.toThrow();
    expect(await compter("contourne@exemple.fr")).toBe(0);
  });

  it("même réponse que l'adresse existe ou non, sans doublon, et l'ancien compte reçoit un avis", async () => {
    const env = banc.env;
    const premiere = await inscrire(env, formulaire(env, { email: "double@exemple.fr" }), ipNeuve());
    const avant = banc.expediteur.envoyes.length;
    const seconde = await inscrire(env, formulaire(env, { email: "double@exemple.fr", motDePasse: "un autre mot de passe" }), ipNeuve());
    expect(seconde).toBe(premiere);
    expect(await compter("double@exemple.fr")).toBe(1);
    const nouveau = banc.expediteur.envoyes.slice(avant);
    expect(nouveau).toHaveLength(1);
    expect(nouveau[0]?.sujet).toBe("Vous avez déjà un compte");
    // Le mot de passe de la seconde demande n'a rien écrasé.
    const jeton = new URL(dernierLien({ envoyes: banc.expediteur.envoyes.filter((m) => m.sujet === "Confirmez votre adresse") }, "double@exemple.fr")).searchParams.get("token") ?? "";
    await env.auth.api.verifyEmail({ query: { token: jeton } });
    await expect(env.auth.api.signInEmail({ body: { email: "double@exemple.fr", password: "un autre mot de passe" } })).rejects.toThrow();
    await choisirMotDePasse(banc, "double@exemple.fr", "un mot de passe solide");
    await expect(env.auth.api.signInEmail({ body: { email: "double@exemple.fr", password: "un mot de passe solide" } })).resolves.toBeDefined();
  });

  it("deux envois simultanés : un seul compte, même réponse", async () => {
    const env = banc.env;
    const reponses = await Promise.all([
      inscrire(env, formulaire(env, { email: "simultane@exemple.fr" }), ipNeuve()),
      inscrire(env, formulaire(env, { email: "simultane@exemple.fr" }), ipNeuve()),
    ]);
    expect(reponses).toEqual(["inscription_envoyee", "inscription_envoyee"]);
    expect(await compter("simultane@exemple.fr")).toBe(1);
  });

  it("adresse avec majuscules et espaces : même compte qu'en minuscules", async () => {
    const env = banc.env;
    await inscrire(env, formulaire(env, { email: "  Maj@Exemple.FR " }), ipNeuve());
    expect(await compter("maj@exemple.fr")).toBe(1);
    await inscrire(env, formulaire(env, { email: "MAJ@exemple.fr" }), ipNeuve());
    expect(await compter("maj@exemple.fr")).toBe(1);
  });

  it("nom d'entreprise avec accents et caractères non latins", async () => {
    const env = banc.env;
    await inscrire(env, formulaire(env, { email: "uni@exemple.fr", nomEntreprise: "  Café  Œuvre 東京 " }), ipNeuve());
    const [p] = await env.base.select().from(user).where(eq(user.email, "uni@exemple.fr"));
    expect(p?.name).toBe("Café Œuvre 東京");
  });

  it("refuse mot de passe trop court, adresse invalide, case non cochée", async () => {
    const env = banc.env;
    for (const surcharge of [
      { email: "court@exemple.fr", motDePasse: "onze-lettre" },
      { email: "pas-une-adresse" },
      { email: "case@exemple.fr", accepte: "" },
      { email: "vide@exemple.fr", nomEntreprise: "  " },
    ]) {
      expect(await inscrire(env, formulaire(env, surcharge), ipNeuve())).toBe("formulaire_invalide");
    }
    expect(await compter("court@exemple.fr")).toBe(0);
    expect(await compter("case@exemple.fr")).toBe(0);
  });
});

describe("protection contre les robots", () => {
  it("champ piège rempli : même message qu'un succès, rien n'est créé", async () => {
    const env = banc.env;
    const reponse = await inscrire(env, formulaire(env, { email: "robot@exemple.fr", piege: "http://spam" }), ipNeuve());
    expect(reponse).toBe("inscription_envoyee");
    expect(await compter("robot@exemple.fr")).toBe(0);
  });
  it("envoi trop rapide : refusé avec un message d'attente", async () => {
    const env = banc.env;
    const ouvert = formulaire(env, { email: "vite@exemple.fr" });
    const reponse = await inscrire(avancer(env, -9_500), ouvert, ipNeuve());
    expect(reponse).toBe("trop_vite");
    expect(await compter("vite@exemple.fr")).toBe(0);
  });
  it("heure d'ouverture falsifiée : ignorée comme un robot", async () => {
    const env = banc.env;
    const reponse = await inscrire(env, { ...formulaire(env, { email: "faux@exemple.fr" }), jeton: "1.abc" }, ipNeuve());
    expect(reponse).toBe("inscription_envoyee");
    expect(await compter("faux@exemple.fr")).toBe(0);
  });
});

describe("limitation de fréquence", () => {
  it("par adresse IP : la 6e demande de l'heure est refusée, une heure plus tard c'est reparti", async () => {
    const env = banc.env;
    for (let i = 0; i < 5; i += 1) {
      expect(await inscrire(env, formulaire(env, { email: `ip${i}@exemple.fr` }), IP)).toBe("inscription_envoyee");
    }
    expect(await inscrire(env, formulaire(env, { email: "ip6@exemple.fr" }), IP)).toBe("trop_de_demandes");
    expect(await compter("ip6@exemple.fr")).toBe(0);
    const plusTard = avancer(env, 61 * 60 * 1000);
    expect(await inscrire(plusTard, formulaire(plusTard, { email: "ip7@exemple.fr" }), IP)).toBe("inscription_envoyee");
  });
  it("par adresse e-mail : la 4e demande est refusée même depuis d'autres IP", async () => {
    const env = banc.env;
    for (let i = 0; i < 3; i += 1) await inscrire(env, formulaire(env, { email: "insiste@exemple.fr" }), ipNeuve());
    expect(await inscrire(env, formulaire(env, { email: "insiste@exemple.fr" }), ipNeuve())).toBe("trop_de_demandes");
  });
});

describe("adresse IP inconnue et réglage du relais", () => {
  it("IP inconnue : plafond global (réglable) au lieu d'aucune limite, par tous les visiteurs ensemble", async () => {
    const env = { ...banc.env, plafondInscriptionGlobal: 3 };
    for (let i = 0; i < 3; i += 1) {
      expect(await inscrire(env, formulaire(env, { email: `global${i}@exemple.fr` }), "inconnue")).toBe("inscription_envoyee");
    }
    expect(await inscrire(env, formulaire(env, { email: "global3@exemple.fr" }), "inconnue")).toBe("trop_de_demandes");
    expect(await compter("global3@exemple.fr")).toBe(0);
    // Une IP connue n'est pas touchée par ce plafond.
    expect(await inscrire(env, formulaire(env, { email: "global4@exemple.fr" }), ipNeuve())).toBe("inscription_envoyee");
    // La fenêtre glisse : une heure plus tard c'est reparti.
    const plusTard = avancer(env, 61 * 60 * 1000);
    expect(await inscrire(plusTard, formulaire(plusTard, { email: "global5@exemple.fr" }), "inconnue")).toBe("inscription_envoyee");
  });
  it("inscription libre bloquée (production sans réglage du relais) : refusée, rien n'est créé", async () => {
    const env = { ...banc.env, inscriptionLibreBloquee: true };
    expect(await inscrire(env, formulaire(env, { email: "bloque@exemple.fr" }), ipNeuve())).toBe("indisponible");
    expect(await compter("bloque@exemple.fr")).toBe(0);
  });
});
