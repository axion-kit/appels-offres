import { createHash } from "node:crypto";
import { booleen, choix, liste, nombre, objet, texte, type Schema } from "../schema";

/** Type d'un champ de sortie : "texte" | "nombre" | "booleen" | liste de choix. */
export type TypeChamp = "texte" | "nombre" | "booleen" | string[];
export type Critere = "exact" | "contient" | { tolerance: number };

export interface Cas {
  id: string;
  entree: string;
  attendu: Record<string, string | number | boolean>;
  /** Par champ ; "exact" si absent. */
  criteres?: Record<string, Critere>;
}

export interface JeuDOr {
  nom: string;
  version_prompt: string;
  invite: string;
  sortie: Record<string, TypeChamp>;
  /** Part minimale de cas réussis, entre 0 et 1. Choisie par le responsable. */
  seuil: number;
  cas: Cas[];
}

const valeurAttendue = {
  lire: (v: unknown, c = "") =>
    typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))
      ? ({ ok: true, valeur: v } as const)
      : ({ ok: false, raison: `${c} : texte, nombre ou oui/non attendu` } as const),
} satisfies Schema<string | number | boolean>;

const dictionnaire = <T>(item: Schema<T>): Schema<Record<string, T>> => ({
  lire(v, c = "") {
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      return { ok: false, raison: `${c} : objet attendu` };
    }
    const sortie = Object.create(null) as Record<string, T>;
    for (const [k, x] of Object.entries(v)) {
      const r = item.lire(x, c ? `${c}.${k}` : k);
      if (!r.ok) return r;
      sortie[k] = r.valeur;
    }
    return { ok: true, valeur: sortie };
  },
});

const typeChamp: Schema<TypeChamp> = {
  lire(v, c = "") {
    if (v === "texte" || v === "nombre" || v === "booleen") return { ok: true, valeur: v };
    if (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string")) {
      return { ok: true, valeur: v as string[] };
    }
    return { ok: false, raison: `${c} : type de champ inconnu` };
  },
};

const critere: Schema<Critere> = {
  lire(v, c = "") {
    if (v === "exact" || v === "contient") return { ok: true, valeur: v };
    const r = objet<{ tolerance: number }>({ tolerance: nombre() }).lire(v, c);
    return r.ok && r.valeur.tolerance >= 0 ? r : { ok: false, raison: `${c} : critère inconnu` };
  },
};

const schemaCas = objet<Cas>({
  id: texte(),
  entree: texte(),
  attendu: dictionnaire(valeurAttendue),
  criteres: optionnel(dictionnaire(critere)),
});

function optionnel<T>(s: Schema<T>): Schema<T | undefined> {
  return { lire: (v, c) => (v === undefined ? { ok: true, valeur: undefined } : s.lire(v, c)) };
}

const schemaJeu = objet<JeuDOr>({
  nom: texte(),
  version_prompt: texte(),
  invite: texte(),
  sortie: dictionnaire(typeChamp),
  seuil: nombre(),
  cas: liste(schemaCas),
});

/** Lit et vérifie un jeu d'or (JSON déjà décodé). Lève une erreur claire si le format est faux. */
export function lireJeu(brut: unknown): JeuDOr {
  // Le fichier ne peut pas porter l'approbation : un champ `approuve` éventuel est retiré, jamais lu.
  let sansApprobation = brut;
  if (typeof brut === "object" && brut !== null && !Array.isArray(brut) && "approuve" in brut) {
    sansApprobation = Object.fromEntries(Object.entries(brut).filter(([cle]) => cle !== "approuve"));
  }
  const r = schemaJeu.lire(sansApprobation);
  if (!r.ok) throw new Error(`Jeu d'or invalide : ${r.raison}`);
  const jeu = r.valeur;
  if (jeu.seuil < 0 || jeu.seuil > 1) throw new Error("Jeu d'or invalide : le seuil doit être entre 0 et 1");
  if (jeu.cas.length === 0) throw new Error("Jeu d'or invalide : aucun cas");
  if (Object.keys(jeu.sortie).length === 0) throw new Error("Jeu d'or invalide : aucune sortie décrite");
  const ids = new Set<string>();
  for (const cas of jeu.cas) {
    if (ids.has(cas.id)) throw new Error(`Jeu d'or invalide : cas en double (${cas.id})`);
    ids.add(cas.id);
  }
  return jeu;
}

/** Schéma de la sortie attendue de l'IA, construit depuis la description du jeu. */
export function schemaSortie(jeu: JeuDOr): Schema<Record<string, unknown>> {
  const champs: Record<string, Schema<unknown>> = {};
  for (const [nom, type] of Object.entries(jeu.sortie)) {
    champs[nom] =
      type === "texte" ? texte() : type === "nombre" ? nombre() : type === "booleen" ? booleen() : choix(type);
  }
  return objet<Record<string, unknown>>(champs);
}

/**
 * Empreinte du jeu (version de la consigne, consigne, forme de la sortie, seuil, cas).
 * Le responsable la fournit hors dépôt dans la variable d'environnement IA_EVAL_APPROUVE.
 */
export function empreinte(jeu: JeuDOr): string {
  const base = JSON.stringify({
    version_prompt: jeu.version_prompt,
    seuil: jeu.seuil,
    invite: jeu.invite,
    sortie: jeu.sortie,
    cas: jeu.cas,
  });
  return createHash("sha256").update(base).digest("hex");
}
