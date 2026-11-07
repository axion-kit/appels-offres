export type Resultat<T> = { ok: true; valeur: T } | { ok: false; raison: string };

/** Schéma minimal : valide une valeur inconnue et la rend typée. */
export interface Schema<T> {
  lire(valeur: unknown, chemin?: string): Resultat<T>;
}

const refus = (chemin: string, attendu: string): Resultat<never> => ({
  ok: false,
  raison: `${chemin || "valeur"} : ${attendu} attendu`,
});

export const texte = (): Schema<string> => ({
  lire: (v, c = "") => (typeof v === "string" ? { ok: true, valeur: v } : refus(c, "texte")),
});

export const nombre = (): Schema<number> => ({
  lire: (v, c = "") =>
    typeof v === "number" && Number.isFinite(v) ? { ok: true, valeur: v } : refus(c, "nombre"),
});

export const booleen = (): Schema<boolean> => ({
  lire: (v, c = "") => (typeof v === "boolean" ? { ok: true, valeur: v } : refus(c, "oui/non")),
});

export const choix = <const T extends readonly string[]>(valeurs: T): Schema<T[number]> => ({
  lire: (v, c = "") =>
    typeof v === "string" && valeurs.includes(v)
      ? { ok: true, valeur: v }
      : refus(c, `un choix parmi ${valeurs.join(", ")}`),
});

export const liste = <T>(item: Schema<T>): Schema<T[]> => ({
  lire(v, c = "") {
    if (!Array.isArray(v)) return refus(c, "liste");
    const sortie: T[] = [];
    for (const [i, element] of v.entries()) {
      const r = item.lire(element, `${c}[${i}]`);
      if (!r.ok) return r;
      sortie.push(r.valeur);
    }
    return { ok: true, valeur: sortie };
  },
});

/** Objet strict : les champs inconnus sont refusés. */
export const objet = <T extends object>(champs: {
  [K in keyof T]: Schema<T[K]>;
}): Schema<T> => ({
  lire(v, c = "") {
    if (typeof v !== "object" || v === null || Array.isArray(v)) return refus(c, "objet");
    const brut = v as Record<string, unknown>;
    const sortie: Record<string, unknown> = {};
    for (const [nom, schema] of Object.entries(champs as Record<string, Schema<unknown>>)) {
      const r = schema.lire(brut[nom], c ? `${c}.${nom}` : nom);
      if (!r.ok) return r;
      sortie[nom] = r.valeur;
    }
    for (const nom of Object.keys(brut)) {
      if (!Object.hasOwn(champs, nom)) return { ok: false, raison: `${c ? `${c}.` : ""}${nom} : champ inconnu` };
    }
    return { ok: true, valeur: sortie as T };
  },
});
