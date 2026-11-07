import { randomBytes } from "node:crypto";
import { creerAuth, type Auth } from "./auth";
import { creerBaseMemoire, creerBasePostgres, type Base } from "./base";
import { expediteurMemoire, type Expediteur } from "./expediteur";
import { expediteurReel } from "./expediteur-reel";
import { deriverCle } from "./reseau";

export type Services = {
  base: Base;
  auth: Auth;
  expediteur: Expediteur;
  urlPublique: string;
  proxyFiable: boolean;
  // Production sans réglage de COMPTES_PROXY_FIABLE (et hors Vercel) : l'inscription libre est refusée.
  inscriptionLibreBloquee: boolean;
  plafondInscriptionGlobal: number;
  cleLimites: string;
  cleRobots: string;
  delaiMinMs: number;
  administrateurs: string[];
  boiteDeTest: boolean;
};

export function lireAdministrateurs(valeur: string | undefined): string[] {
  return (valeur ?? "").split(",").map((v) => v.normalize("NFC").trim().toLowerCase()).filter((v) => v !== "");
}

const CLE = Symbol.for("kit.comptes.services");
type Global = typeof globalThis & { [CLE]?: Promise<Services> };

async function construire(): Promise<Services> {
  const adresseBase = process.env.DATABASE_URL;
  const memoire = process.env.COMPTES_BASE === "memoire";
  if (adresseBase === undefined && !memoire) {
    throw new Error("Base non branchée : renseigner DATABASE_URL (ou COMPTES_BASE=memoire pour essayer en local).");
  }
  const reel = adresseBase !== undefined;
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  if (reel && secret.length < 32) throw new Error("BETTER_AUTH_SECRET manquant ou trop court (32 caractères minimum).");
  const secretEffectif = secret.length >= 32 ? secret : randomBytes(32).toString("hex");
  const urlPublique = process.env.BETTER_AUTH_URL ?? (reel ? "" : "http://localhost:3100");
  if (urlPublique === "") throw new Error("BETTER_AUTH_URL manquant (adresse publique de l'outil).");
  if (reel && expediteurReel === null) throw new Error("Expéditeur non branché : renseigner src/lib/comptes/expediteur-reel.ts.");
  const base = reel ? await creerBasePostgres(adresseBase) : await creerBaseMemoire();
  const expediteur = expediteurReel ?? expediteurMemoire;
  const surVercel = process.env.VERCEL !== undefined;
  const reglage = process.env.COMPTES_PROXY_FIABLE;
  const proxyFiable = reglage === "oui" || (surVercel && reglage !== "non");
  const inscriptionLibreBloquee = process.env.NODE_ENV === "production" && reglage === undefined && !surVercel;
  if (inscriptionLibreBloquee) {
    console.error("Inscription libre refusée en production : COMPTES_PROXY_FIABLE n'est pas réglé. Mettre « oui » derrière un relais de confiance, « non » sinon (voir docs/comptes.md).");
  }
  const plafond = Number(process.env.COMPTES_PLAFOND_INSCRIPTION_GLOBAL);
  const plafondInscriptionGlobal = Number.isInteger(plafond) && plafond > 0 && process.env.COMPTES_PLAFOND_INSCRIPTION_GLOBAL ? plafond : 30;
  const auth = creerAuth({ base, expediteur, secret: secretEffectif, urlPublique, proxyFiable });
  const delai = Number(process.env.COMPTES_DELAI_MIN_MS);
  return {
    base,
    auth,
    expediteur,
    urlPublique,
    proxyFiable,
    inscriptionLibreBloquee,
    plafondInscriptionGlobal,
    cleLimites: deriverCle(secretEffectif, "limites"),
    cleRobots: deriverCle(secretEffectif, "robots"),
    delaiMinMs: Number.isFinite(delai) && delai >= 0 && process.env.COMPTES_DELAI_MIN_MS ? delai : 3000,
    administrateurs: lireAdministrateurs(process.env.COMPTES_ADMINISTRATEURS),
    boiteDeTest: !reel && process.env.COMPTES_BOITE_TEST === "oui" && process.env.VERCEL === undefined,
  };
}

// Un seul jeu de services par processus (base, librairie, envoi).
export function obtenirServices(): Promise<Services> {
  const g = globalThis as Global;
  g[CLE] ??= construire();
  return g[CLE];
}

// Oublie les services déjà construits (utile aux tests qui changent les réglages).
export function reinitialiserServices(): void {
  delete (globalThis as Global)[CLE];
}
