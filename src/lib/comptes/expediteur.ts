export type Courriel = { a: string; sujet: string; texte: string };

// L'outil branche ici son vrai service d'envoi (aucune clé n'est écrite dans le gabarit).
export interface Expediteur {
  envoyer(courriel: Courriel): Promise<void>;
}

export const expediteurConsole: Expediteur = {
  async envoyer(courriel) {
    console.info(`[courriel simulé] à ${courriel.a} : ${courriel.sujet}\n${courriel.texte}`);
  },
};

// Boîte d'envoi gardée en mémoire (tests et parcours automatiques uniquement).
const CLE_BOITE = Symbol.for("kit.comptes.boite");
type Global = typeof globalThis & { [CLE_BOITE]?: Courriel[] };

export function boiteEnvoi(): Courriel[] {
  const g = globalThis as Global;
  g[CLE_BOITE] ??= [];
  return g[CLE_BOITE];
}

export const expediteurMemoire: Expediteur = {
  async envoyer(courriel) {
    const boite = boiteEnvoi();
    boite.push(courriel);
    if (boite.length > 200) boite.shift();
  },
};

export function expediteurDeTest(): Expediteur & { envoyes: Courriel[] } {
  const envoyes: Courriel[] = [];
  return {
    envoyes,
    async envoyer(courriel) {
      envoyes.push(courriel);
    },
  };
}
