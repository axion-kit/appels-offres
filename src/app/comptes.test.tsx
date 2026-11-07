import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ taches: [] as Promise<unknown>[], entetes: new Headers() }));

vi.mock("next/server", () => ({
  after: (travail: () => Promise<void>) => {
    etat.taches.push(travail());
  },
}));
vi.mock("next/headers", () => ({ headers: async () => etat.entetes }));
vi.mock("next/navigation", () => ({
  redirect: (adresse: string) => {
    throw new Error(`REDIRECT:${adresse}`);
  },
}));

process.env.COMPTES_BASE = "memoire";
process.env.COMPTES_INSCRIPTION = "libre";
process.env.COMPTES_PROXY_FIABLE = "oui";
process.env.COMPTES_BOITE_TEST = "oui";
process.env.COMPTES_DELAI_MIN_MS = "0";
process.env.COMPTES_ADMINISTRATEURS = "admin@exemple.fr";
process.env.BETTER_AUTH_URL = "http://localhost:3100";

import { boiteEnvoi } from "@/lib/comptes/expediteur";
import { creerJetonOuverture } from "@/lib/comptes/piege";
import { obtenirServices } from "@/lib/comptes/services";
import { GET as routeAuth } from "./api/auth/[...all]/route";
import { POST as creerParAdmin } from "./api/administration/creer/route";
import { POST as inviterEntreprise } from "./api/administration/inviter/route";
import { GET as exporter } from "./api/compte/export/route";
import { POST as fermer } from "./api/compte/fermer/route";
import { POST as inviter } from "./api/compte/inviter/route";
import { POST as revoquer } from "./api/compte/revoquer/route";
import { POST as changerRole } from "./api/compte/role/route";
import { POST as connexion } from "./api/connexion/route";
import { POST as deconnexion } from "./api/deconnexion/route";
import { POST as inscription } from "./api/inscription/route";
import { POST as accepter } from "./api/invitation/[code]/route";
import { POST as lienMagique } from "./api/lien-magique/route";
import { POST as oubli } from "./api/mot-de-passe-oublie/route";
import { POST as nouveauMotDePasse } from "./api/nouveau-mot-de-passe/route";
import { GET as boite } from "./api/test/boite/route";
import Cgu from "./cgu/page";
import Compte from "./compte/page";
import Confidentialite from "./confidentialite/page";
import Connexion from "./connexion/page";
import Inscription from "./inscription/page";
import Invitation from "./invitation/[code]/page";
import MotDePasseOublie from "./mot-de-passe-oublie/page";
import VerifierAdresse from "./verifier-adresse/page";

const ORIGINE = "http://localhost:3100";
const MDP = "un mot de passe solide";
let rang = 0;

function formulaire(champs: Record<string, string>, cookie = "", origine = ORIGINE): Request {
  rang += 1;
  const entetes: Record<string, string> = { origin: origine, "x-forwarded-for": `10.0.${Math.floor(rang / 250)}.${rang % 250}` };
  if (cookie !== "") entetes.cookie = cookie;
  return new Request("http://localhost:3100/api/x", { method: "POST", headers: entetes, body: new URLSearchParams(champs) });
}
const lieu = (r: Response) => r.headers.get("location") ?? "";
async function terminer() {
  await Promise.all(etat.taches.splice(0));
}
function lienRecu(adresse: string, sujet: string): string {
  const m = boiteEnvoi().filter((c) => c.a === adresse && c.sujet === sujet).at(-1);
  return /https?:\/\/\S+/.exec(m?.texte ?? "")?.[0] ?? "";
}
const page = (u: string) => new Request(u, { headers: { "x-forwarded-for": "10.9.9.9" } });
const html = (jsx: Awaited<ReturnType<typeof Compte>>) => renderToStaticMarkup(jsx);
const chercher = (valeurs: Record<string, string | undefined>) => Promise.resolve(valeurs);

async function ouvrirCompte(email: string, nom = "Atelier") {
  const s = await obtenirServices();
  const jeton = creerJetonOuverture(s.cleRobots, new Date(Date.now() - 10_000));
  const r = await inscription(formulaire({ email, mot_de_passe: MDP, nom_entreprise: nom, accepte: "oui", site_web: "", ouvert_le: jeton }));
  expect(lieu(r)).toBe("/verifier-adresse?m=inscription_envoyee");
  await terminer();
  const v = await routeAuth(page(lienRecu(email, "Confirmez votre adresse")));
  expect(lieu(v)).toContain("/verifier-adresse");
  // Le mot de passe choisi à l'inscription est neutralisé à la confirmation : on le (re)choisit par « mot de passe oublié ».
  expect(lieu(await connexion(formulaire({ email, mot_de_passe: MDP })))).toBe("/connexion?m=identifiants_incorrects");
  await oubli(formulaire({ email }));
  await terminer();
  const retour = await routeAuth(page(lienRecu(email, "Choisir un nouveau mot de passe")));
  const jetonReinit = new URL(lieu(retour), "http://localhost:3100").searchParams.get("token") ?? "";
  expect(lieu(await nouveauMotDePasse(formulaire({ lien: jetonReinit, mot_de_passe: MDP })))).toBe("/connexion?m=mot_de_passe_change");
  return connecter(email);
}
async function connecter(email: string, mdp = MDP) {
  const r = await connexion(formulaire({ email, mot_de_passe: mdp }));
  expect(lieu(r)).toBe("/compte");
  return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

let cookieAna = "";
let cookieAdmin = "";

beforeAll(async () => {
  cookieAna = await ouvrirCompte("ana@exemple.fr", "Boulangerie Ana");
  cookieAdmin = await ouvrirCompte("admin@exemple.fr", "Équipe");
}, 60_000);

describe("inscription", () => {
  it("refusée côté serveur selon le mode, mais autorisée en libre", async () => {
    const s = await obtenirServices();
    const jeton = creerJetonOuverture(s.cleRobots, new Date(Date.now() - 10_000));
    const champs = { email: "mode@exemple.fr", mot_de_passe: MDP, nom_entreprise: "Mode", accepte: "oui", site_web: "", ouvert_le: jeton };
    for (const mode of ["fermee", "sur_invitation"]) {
      process.env.COMPTES_INSCRIPTION = mode;
      expect(lieu(await inscription(formulaire(champs)))).toBe("/inscription?m=inscription_fermee");
      expect(html(await Inscription({ searchParams: chercher({}) }))).toContain("Les inscriptions ne sont pas ouvertes");
    }
    process.env.COMPTES_INSCRIPTION = "libre";
    expect(html(await Inscription({ searchParams: chercher({ m: "trop_vite" }) }))).toContain('name="site_web"');
  });
  it("la page d'inscription a les cases, les liens et le champ caché", async () => {
    const rendu = html(await Inscription({ searchParams: chercher({}) }));
    expect(rendu).toContain('href="/cgu"');
    expect(rendu).toContain('href="/confidentialite"');
    expect(rendu).toContain('name="ouvert_le"');
    expect(rendu).toContain('type="checkbox"');
    expect(rendu.replace(/<[^>]*>/g, " ")).not.toMatch(/token|session|erreur 500|\bAPI\b/i);
  });
  it("une erreur imprévue donne un message simple", async () => {
    const r = await inscription(new Request("http://localhost:3100/api/x", { method: "POST", headers: { origin: ORIGINE } }));
    expect(lieu(r)).toBe("/inscription?m=indisponible");
  });
  it("une provenance étrangère est refusée", async () => {
    expect(lieu(await inscription(formulaire({}, "", "http://autre.example")))).toBe("/inscription?m=origine_refusee");
  });
});

describe("connexion", () => {
  it("mauvais mot de passe, adresse inconnue, champs vides : même message", async () => {
    expect(lieu(await connexion(formulaire({ email: "ana@exemple.fr", mot_de_passe: "mauvais mot de passe" })))).toBe("/connexion?m=identifiants_incorrects");
    expect(lieu(await connexion(formulaire({ email: "inconnu@exemple.fr", mot_de_passe: "mauvais mot de passe" })))).toBe("/connexion?m=identifiants_incorrects");
    expect(lieu(await connexion(formulaire({ email: "", mot_de_passe: "" })))).toBe("/connexion?m=identifiants_incorrects");
  });
  it("adresse non confirmée : renvoi du message de confirmation, avec limite", async () => {
    const s = await obtenirServices();
    const jeton = creerJetonOuverture(s.cleRobots, new Date(Date.now() - 10_000));
    await inscription(formulaire({ email: "nonconf@exemple.fr", mot_de_passe: MDP, nom_entreprise: "Non", accepte: "oui", site_web: "", ouvert_le: jeton }));
    await terminer();
    const avant = boiteEnvoi().length;
    expect(lieu(await connexion(formulaire({ email: "nonconf@exemple.fr", mot_de_passe: MDP })))).toBe("/connexion?m=adresse_a_verifier");
    await terminer();
    expect(boiteEnvoi().length).toBe(avant + 1);
  });
  it("trop d'essais pour une adresse : refusé", async () => {
    let dernier = "";
    for (let i = 0; i < 10; i += 1) dernier = lieu(await connexion(formulaire({ email: "acharne@exemple.fr", mot_de_passe: "mauvais mot de passe" })));
    expect(dernier).toBe("/connexion?m=trop_de_demandes");
  });
  it("les pages s'affichent avec leur message", async () => {
    const rendu = html(await Connexion({ searchParams: chercher({ m: "envoye" }) }));
    expect(rendu).toContain("Me connecter");
    expect(rendu).toContain("Recevoir mon lien");
    expect(rendu).toContain("Mot de passe oublié");
    expect(rendu).toContain('href="/inscription"');
    expect(html(await VerifierAdresse({ searchParams: chercher({ m: "adresse_confirmee" }) }))).toContain("Adresse confirmée");
    expect(html(await VerifierAdresse({ searchParams: chercher({ error: "INVALID" }) }))).toContain("n&#x27;est plus valable");
    expect(html(await VerifierAdresse({ searchParams: chercher({}) }))).toContain("Vérifiez votre boîte e-mail");
  });
  it("lien de connexion et mot de passe oublié : même réponse avec ou sans compte", async () => {
    for (const route of [lienMagique, oubli]) {
      const a = await route(formulaire({ email: "ana@exemple.fr" }));
      const b = await route(formulaire({ email: "personne@exemple.fr" }));
      expect(lieu(a).split("?")[1]).toBe("m=envoye");
      expect(lieu(b)).toBe(lieu(a));
      expect(lieu(await route(formulaire({ email: "pas une adresse" })))).toBe(lieu(a));
    }
    await terminer();
    expect(boiteEnvoi().some((c) => c.a === "personne@exemple.fr")).toBe(false);
    expect(lienRecu("ana@exemple.fr", "Votre lien de connexion")).toContain("/api/auth/magic-link/verify");
  });
  it("limite les demandes de lien par adresse", async () => {
    let dernier = "";
    for (let i = 0; i < 5; i += 1) dernier = lieu(await lienMagique(formulaire({ email: "spam@exemple.fr" })));
    expect(dernier).toBe("/connexion?m=trop_de_demandes");
    for (let i = 0; i < 5; i += 1) dernier = lieu(await oubli(formulaire({ email: "spam2@exemple.fr" })));
    expect(dernier).toBe("/mot-de-passe-oublie?m=trop_de_demandes");
  });
  it("nouveau mot de passe : lien reçu, mot de passe trop court refusé, puis changé", async () => {
    await terminer();
    const lien = new URL(lienRecu("ana@exemple.fr", "Choisir un nouveau mot de passe"));
    const retour = await routeAuth(page(lien.toString()));
    const jeton = new URL(lieu(retour), "http://localhost:3100").searchParams.get("token") ?? "";
    expect(jeton).not.toBe("");
    expect(html(await MotDePasseOublie({ searchParams: chercher({ token: jeton }) }))).toContain("Nouveau mot de passe");
    expect(html(await MotDePasseOublie({ searchParams: chercher({}) }))).toContain("Recevoir le lien");
    expect(html(await MotDePasseOublie({ searchParams: chercher({ error: "INVALID_TOKEN" }) }))).toContain("Recevoir le lien");
    expect(lieu(await nouveauMotDePasse(formulaire({ lien: jeton, mot_de_passe: "court" })))).toBe("/mot-de-passe-oublie?m=formulaire_invalide");
    expect(lieu(await nouveauMotDePasse(formulaire({ lien: "faux", mot_de_passe: "nouveau mot de passe long" })))).toBe("/mot-de-passe-oublie?m=lien_invalide");
    expect(lieu(await nouveauMotDePasse(formulaire({ lien: jeton, mot_de_passe: "nouveau mot de passe long" })))).toBe("/connexion?m=mot_de_passe_change");
    cookieAna = await connecter("ana@exemple.fr", "nouveau mot de passe long");
  });
});

describe("liens de la librairie", () => {
  it("seuls les liens reçus par courriel passent", async () => {
    expect((await routeAuth(new Request("http://localhost:3100/api/auth/get-session"))).status).toBe(404);
    expect((await routeAuth(new Request("http://localhost:3100/api/auth/sign-in/email"))).status).toBe(404);
  });
});

describe("espace connecté", () => {
  it("sans connexion : renvoi vers la connexion", async () => {
    etat.entetes = new Headers();
    await expect(Compte({ searchParams: chercher({}) })).rejects.toThrow("REDIRECT:/connexion");
    expect(lieu(await inviter(formulaire({ email: "x@exemple.fr" })))).toBe("/connexion");
    expect(lieu(await exporter(new Request("http://localhost:3100/api/compte/export")))).toBe("/connexion");
  });
  it("le propriétaire invite, voit l'attente, révoque ; le collègue rejoint ; les rôles se changent", async () => {
    expect(lieu(await inviter(formulaire({ email: "collegue@exemple.fr" }, cookieAna)))).toBe("/compte?m=invitation_envoyee");
    await terminer();
    etat.entetes = new Headers({ cookie: cookieAna });
    const rendu = html(await Compte({ searchParams: chercher({ m: "invitation_envoyee" }) }));
    expect(rendu).toContain("propriétaire de l&#x27;espace « Boulangerie Ana »");
    expect(rendu).toContain("Invitations en attente : collegue@exemple.fr");
    expect(rendu).toContain("Télécharger mes données");
    expect(rendu).not.toContain("Administration");
    expect(rendu).toContain("Essai offert jusqu&#x27;au");

    const lien = lienRecu("collegue@exemple.fr", "Votre invitation");
    const code = lien.split("/invitation/")[1] ?? "";
    expect(html(await Invitation({ params: Promise.resolve({ code }), searchParams: chercher({}) }))).toContain("Boulangerie Ana");
    expect(html(await Invitation({ params: Promise.resolve({ code: "faux" }), searchParams: chercher({ m: "lien_invalide" }) }))).toContain("n&#x27;est plus valable");
    const requete = (champs: Record<string, string>) => accepter(formulaire(champs), { params: Promise.resolve({ code }) });
    expect(lieu(await requete({ nom: "Camille", mot_de_passe: "court", accepte: "oui" }))).toBe(`/invitation/${code}?m=formulaire_invalide`);
    expect(lieu(await requete({ nom: "Camille", mot_de_passe: MDP, nom_entreprise: "", accepte: "oui" }))).toBe("/connexion?m=compte_pret");
    expect(lieu(await requete({ nom: "Autre", mot_de_passe: MDP, accepte: "oui" }))).toBe(`/invitation/${code}?m=lien_invalide`);

    const cookieCollegue = await connecter("collegue@exemple.fr");
    etat.entetes = new Headers({ cookie: cookieCollegue });
    const vueMembre = html(await Compte({ searchParams: chercher({}) }));
    expect(vueMembre).toContain("membre de l&#x27;espace « Boulangerie Ana »");
    expect(vueMembre).not.toContain("Inviter un collègue");
    expect(lieu(await inviter(formulaire({ email: "x@exemple.fr" }, cookieCollegue)))).toBe("/compte?m=non_autorise");
    expect(lieu(await revoquer(formulaire({}, cookieCollegue)))).toBe("/compte?m=non_autorise");

    etat.entetes = new Headers({ cookie: cookieAna });
    const avecEquipe = html(await Compte({ searchParams: chercher({}) }));
    expect(avecEquipe).toContain("Rendre propriétaire");
    const s = await obtenirServices();
    const { listerMembres } = await import("@/lib/comptes/espace");
    const { contexteDepuisEntetes } = await import("@/lib/comptes/contexte");
    const env = { ...s, maintenant: new Date(), proprietes: { inscription: "libre" as const, essaiJours: 30 }, apres: async () => {} };
    const ctx = await contexteDepuisEntetes(env, new Headers({ cookie: cookieAna }));
    const membres = await listerMembres(env, ctx as NonNullable<typeof ctx>);
    const lui = membres.find((m) => m.email === "collegue@exemple.fr");
    const moi = membres.find((m) => m.email === "ana@exemple.fr");
    expect(lieu(await changerRole(formulaire({ membre: moi?.id ?? "", role: "membre" }, cookieAna)))).toBe("/compte?m=role_refuse");
    expect(lieu(await changerRole(formulaire({ membre: lui?.id ?? "", role: "proprietaire" }, cookieAna)))).toBe("/compte?m=role_change");
    expect(lieu(await changerRole(formulaire({ membre: lui?.id ?? "", role: "membre" }, cookieAna)))).toBe("/compte?m=role_change");
    expect(lieu(await inviter(formulaire({ email: "attente@exemple.fr" }, cookieAna)))).toBe("/compte?m=invitation_envoyee");
    expect(lieu(await revoquer(formulaire({}, cookieAna)))).toBe("/compte?m=role_change");
  });
  it("téléchargement des données", async () => {
    const r = await exporter(new Request("http://localhost:3100/api/compte/export", { headers: { cookie: cookieAna } }));
    expect(r.headers.get("content-disposition")).toContain("mes-donnees.json");
    const copie = await r.json();
    expect(copie.profil.email).toBe("ana@exemple.fr");
    expect(JSON.stringify(copie)).not.toMatch(/password/i);
  });
  it("administration : créer ou inviter, réservé à l'administrateur", async () => {
    expect(lieu(await inviterEntreprise(formulaire({ email: "neuve@exemple.fr" }, cookieAna)))).toBe("/compte?m=non_autorise");
    expect(lieu(await inviterEntreprise(formulaire({ email: "neuve@exemple.fr" }, cookieAdmin)))).toBe("/compte?m=invitation_envoyee");
    expect(lieu(await creerParAdmin(formulaire({ email: "cree@exemple.fr", nom_entreprise: "Créé" }, cookieAna)))).toBe("/compte?m=non_autorise");
    etat.entetes = new Headers({ cookie: cookieAdmin });
    expect(html(await Compte({ searchParams: chercher({}) }))).toContain("Adresse e-mail à inviter");
    process.env.COMPTES_INSCRIPTION = "fermee";
    expect(lieu(await creerParAdmin(formulaire({ email: "cree@exemple.fr", nom_entreprise: "Créé" }, cookieAdmin)))).toBe("/compte?m=compte_cree");
    const vueFermee = html(await Compte({ searchParams: chercher({}) }));
    expect(vueFermee).toContain("Créer le compte");
    expect(vueFermee).not.toContain("Inviter un collègue");
    process.env.COMPTES_INSCRIPTION = "libre";
    await terminer();
    expect(lienRecu("cree@exemple.fr", "Votre lien de connexion")).toContain("magic-link/verify");
  });
  it("déconnexion, puis fermeture du compte avec adresse à confirmer", async () => {
    const sortie = await deconnexion(formulaire({}, cookieAna));
    expect(lieu(sortie)).toBe("/connexion");
    const cookie = await connecter("collegue@exemple.fr");
    expect(lieu(await fermer(formulaire({ confirmation: "autre@exemple.fr" }, cookie)))).toBe("/compte?m=fermeture_confirmation");
    expect(lieu(await fermer(formulaire({ confirmation: "collegue@exemple.fr" }, cookie)))).toBe("/connexion");
    await terminer();
    expect(boiteEnvoi().some((c) => c.a === "admin@exemple.fr" && c.sujet === "Demande de fermeture de compte")).toBe(true);
    expect(lieu(await connexion(formulaire({ email: "collegue@exemple.fr", mot_de_passe: MDP })))).toBe("/connexion?m=identifiants_incorrects");
    etat.entetes = new Headers({ cookie });
    await expect(Compte({ searchParams: chercher({}) })).rejects.toThrow("REDIRECT:/connexion");
  });
});

describe("pages publiques et boîte de test", () => {
  it("conditions et confidentialité sont affichées avec leur version", () => {
    expect(renderToStaticMarkup(<Cgu />)).toContain("Version du 2026-11-01");
    expect(renderToStaticMarkup(<Confidentialite />)).toContain("Politique de confidentialité");
  });
  it("la boîte de test répond seulement quand tout est réuni", async () => {
    expect((await boite(new Request("http://localhost:3100/api/test/boite"))).status).toBe(404);
    const r = await boite(new Request("http://localhost:3100/api/test/boite?a=ana@exemple.fr"));
    expect(r.status).toBe(200);
    expect((await r.json()).length).toBeGreaterThan(0);
  });
});
