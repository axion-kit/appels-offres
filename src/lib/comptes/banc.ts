import { creerAuth } from "./auth";
import { creerBaseMemoire } from "./base";
import type { Env } from "./env";
import { expediteurDeTest } from "./expediteur";
import { creerJetonOuverture } from "./piege";
import type { ModeInscription } from "./proprietes";
import { deriverCle } from "./reseau";

// Environnement complet pour les tests : vraie base Postgres (en mémoire), vraie librairie, courriels gardés.
export async function creerBanc(reglages: { inscription?: ModeInscription; essaiJours?: number; maintenant?: Date; administrateurs?: string[]; hacher?: (motDePasse: string) => Promise<string> } = {}) {
  const base = await creerBaseMemoire();
  const expediteur = expediteurDeTest();
  const secret = "a".repeat(40);
  const urlPublique = "http://localhost:3100";
  const maintenantBanc = reglages.maintenant ?? new Date("2026-11-07T10:00:00Z");
  const auth = creerAuth({ base, expediteur, secret, urlPublique, proxyFiable: true, horloge: () => maintenantBanc, hacher: reglages.hacher });
  const env: Env = {
    base,
    auth,
    expediteur,
    urlPublique,
    proxyFiable: true,
    inscriptionLibreBloquee: false,
    plafondInscriptionGlobal: 30,
    cleLimites: deriverCle(secret, "limites"),
    cleRobots: deriverCle(secret, "robots"),
    delaiMinMs: 3000,
    administrateurs: reglages.administrateurs ?? ["admin@exemple.fr"],
    boiteDeTest: false,
    maintenant: reglages.maintenant ?? new Date("2026-11-07T10:00:00Z"),
    proprietes: { inscription: reglages.inscription ?? "libre", essaiJours: reglages.essaiJours ?? 30 },
    apres: async (travail) => {
      await travail();
    },
  };
  return { env, expediteur };
}

export type Banc = Awaited<ReturnType<typeof creerBanc>>;

export function avancer(env: Env, millisecondes: number): Env {
  return { ...env, maintenant: new Date(env.maintenant.getTime() + millisecondes) };
}

// Un formulaire d'inscription rempli comme le ferait une personne (ouvert il y a 10 secondes).
export function formulaire(env: Env, surcharge: Partial<Record<"email" | "motDePasse" | "nomEntreprise" | "accepte" | "piege", string>> = {}) {
  return {
    email: "ana@exemple.fr",
    motDePasse: "un mot de passe solide",
    nomEntreprise: "Boulangerie Ana",
    accepte: "oui",
    piege: "",
    jeton: creerJetonOuverture(env.cleRobots, new Date(env.maintenant.getTime() - 10_000)),
    ...surcharge,
  };
}

export function dernierLien(expediteur: { envoyes: { a: string; texte: string }[] }, a: string): string {
  const messages = expediteur.envoyes.filter((m) => m.a === a);
  const texte = messages.at(-1)?.texte ?? "";
  const lien = /https?:\/\/\S+/.exec(texte);
  if (lien === null) throw new Error(`Aucun lien envoyé à ${a}`);
  return lien[0];
}

// Ce que fait une personne auto-inscrite après avoir confirmé son adresse : « mot de passe oublié » puis nouveau mot de passe.
export async function choisirMotDePasse(banc: Banc, email: string, motDePasse: string): Promise<void> {
  const avant = banc.expediteur.envoyes.length;
  await banc.env.auth.api.requestPasswordReset({ body: { email, redirectTo: "/mot-de-passe-oublie" } });
  const lien = banc.expediteur.envoyes.slice(avant).filter((m) => m.a === email && m.sujet !== "Confirmez votre adresse").at(-1)?.texte.match(/https?:\/\/\S+/)?.[0];
  if (lien === undefined) throw new Error(`Aucun lien de nouveau mot de passe pour ${email}`);
  const jeton = new URL(lien).pathname.split("/").at(-1) ?? "";
  await banc.env.auth.api.resetPassword({ body: { newPassword: motDePasse, token: jeton } });
}
